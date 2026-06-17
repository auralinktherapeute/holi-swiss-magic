import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

type Options<T> = {
  /** Stable identifier per form (e.g. "therapist_profile", "booking:<therapistId>"). */
  formType: string;
  /** Live snapshot of the form. Saved with debounce when it changes. */
  data: T;
  /** Only auto-save when true (e.g. after initial DB load completed and user started editing). */
  enabled: boolean;
  /** Debounce in ms (default 1500). */
  debounceMs?: number;
  /** Scores how much user-entered content exists; used to avoid overwriting rich drafts with accidental empty resets. */
  getCompletenessScore?: (data: T) => number;
};

const LS_PREFIX = "lovable.draft.";

function lsKey(formType: string, userId: string | null) {
  return `${LS_PREFIX}${userId ?? "anon"}.${formType}`;
}

type StoredDraft<T> = { data: T; updated_at: string };
type DraftRow<T> = { data: T; updated_at: string | null };
type DraftSelectQuery<T> = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: DraftRow<T> | null; error: unknown }>;
      };
    };
  };
};
type DraftUpsertQuery<T> = {
  upsert: (
    payload: { user_id: string; form_type: string; data: T; updated_at: string },
    options: { onConflict: string },
  ) => Promise<{ error: unknown }>;
};
type DraftDeleteQuery = {
  delete: () => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
  };
};

function draftsSelect<T>() {
  return supabase.from("drafts" as never) as unknown as DraftSelectQuery<T>;
}

function draftsUpsert<T>() {
  return supabase.from("drafts" as never) as unknown as DraftUpsertQuery<T>;
}

function draftsDelete() {
  return supabase.from("drafts" as never) as unknown as DraftDeleteQuery;
}

function defaultCompletenessScore(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return value.trim() ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? 1 : 0;
  if (typeof value === "boolean") return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>(
      (sum, item) => sum + Math.max(1, defaultCompletenessScore(item)),
      0,
    );
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, item) => sum + defaultCompletenessScore(item),
      0,
    );
  }
  return 0;
}

function pickBestDraft<T>(drafts: Array<StoredDraft<T> | null>, scoreDraft: (data: T) => number) {
  return drafts.filter(Boolean).reduce<StoredDraft<T> | null>((best, draft) => {
    if (!draft) return best;
    if (!best) return draft;
    const draftScore = scoreDraft(draft.data);
    const bestScore = scoreDraft(best.data);
    const draftIsMuchRicher = draftScore >= bestScore + 2 && bestScore <= draftScore * 0.6;
    const bestIsMuchRicher = bestScore >= draftScore + 2 && draftScore <= bestScore * 0.6;
    if (draftIsMuchRicher) return draft;
    if (bestIsMuchRicher) return best;
    return new Date(draft.updated_at).getTime() >= new Date(best.updated_at).getTime()
      ? draft
      : best;
  }, null);
}

function readLocalDraft<T>(
  formType: string,
  userId: string | null,
  scoreDraft: (data: T) => number,
): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  const candidates = [lsKey(formType, userId), ...(userId ? [lsKey(formType, null)] : [])];
  const drafts: Array<StoredDraft<T> | null> = [];
  for (const key of candidates) {
    const backupRaw = window.localStorage.getItem(`${key}.backup`);
    if (backupRaw) {
      try {
        drafts.push(JSON.parse(backupRaw) as StoredDraft<T>);
      } catch {
        window.localStorage.removeItem(`${key}.backup`);
      }
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      drafts.push(JSON.parse(raw) as StoredDraft<T>);
    } catch {
      window.localStorage.removeItem(key);
    }
  }
  return pickBestDraft(drafts, scoreDraft);
}

function writeLocalDraft<T>(formType: string, userId: string | null, data: T) {
  if (typeof window === "undefined") return null;
  const updated_at = new Date().toISOString();
  const key = lsKey(formType, userId);
  const previous = window.localStorage.getItem(key);
  if (previous) window.localStorage.setItem(`${key}.backup`, previous);
  window.localStorage.setItem(key, JSON.stringify({ data, updated_at }));
  return updated_at;
}

function removeLocalDraft(formType: string, userId: string | null) {
  if (typeof window === "undefined") return;
  [lsKey(formType, userId), lsKey(formType, null)].forEach((key) => {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(`${key}.backup`);
  });
}

/**
 * Generic draft auto-save hook.
 * - Authenticated users → persists in Supabase `drafts` (RLS scoped to user).
 * - Anonymous users → falls back to localStorage.
 * Returns the loaded draft (once, on mount) plus save status / actions.
 */
export function useFormDraft<T>({
  formType,
  data,
  enabled,
  debounceMs = 1500,
  getCompletenessScore = defaultCompletenessScore,
}: Options<T>) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [initialDraft, setInitialDraft] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const lastSerializedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);
  const enabledRef = useRef(enabled);
  const loadedRef = useRef(loaded);
  const lastSavedScoreRef = useRef(0);

  latestDataRef.current = data;
  enabledRef.current = enabled;
  loadedRef.current = loaded;

  const writeIfSafe = useCallback(
    (nextData: T) => {
      const nextScore = getCompletenessScore(nextData);
      const previousScore = lastSavedScoreRef.current;
      const wouldEraseRichDraft =
        previousScore >= nextScore + 2 && nextScore <= previousScore * 0.6;
      if (wouldEraseRichDraft) return null;
      const updatedAt = writeLocalDraft(formType, userId, nextData);
      lastSavedScoreRef.current = nextScore;
      return updatedAt;
    },
    [formType, userId, getCompletenessScore],
  );

  // Initial load (once per user/formType).
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoaded(false);
    setInitialDraft(null);
    (async () => {
      try {
        const localDraft = readLocalDraft<T>(formType, userId, getCompletenessScore);
        let bestDraft: StoredDraft<T> | null = localDraft;
        if (userId) {
          const { data: row } = await draftsSelect<T>()
            .select("data, updated_at")
            .eq("user_id", userId)
            .eq("form_type", formType)
            .maybeSingle();
          if (row?.data) {
            const remoteDraft = {
              data: row.data,
              updated_at: row.updated_at ?? new Date().toISOString(),
            };
            bestDraft = pickBestDraft([bestDraft, remoteDraft], getCompletenessScore);
          }
        }
        if (!cancelled && bestDraft?.data) {
          setInitialDraft(bestDraft.data);
          setSavedAt(bestDraft.updated_at ? new Date(bestDraft.updated_at) : null);
          lastSerializedRef.current = JSON.stringify(bestDraft.data);
          lastSavedScoreRef.current = getCompletenessScore(bestDraft.data);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, formType, getCompletenessScore]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistLocalLatest = (updateState: boolean) => {
      if (!enabledRef.current || !loadedRef.current) return;
      const latestData = latestDataRef.current;
      const serialized = JSON.stringify(latestData);
      if (serialized === lastSerializedRef.current) return;
      const updatedAt = writeIfSafe(latestData);
      if (!updatedAt) return;
      lastSerializedRef.current = serialized;
      if (updateState && updatedAt) {
        setSavedAt(new Date(updatedAt));
        setStatus("saved");
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistLocalLatest(false);
    };
    const handlePageHide = () => persistLocalLatest(false);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      persistLocalLatest(false);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [formType, userId, writeIfSafe]);

  // Debounced save on data change.
  useEffect(() => {
    if (!enabled || !loaded) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSerializedRef.current) return;
    const localUpdatedAt = writeIfSafe(data);
    if (!localUpdatedAt) return;
    lastSerializedRef.current = serialized;
    if (localUpdatedAt) {
      setSavedAt(new Date(localUpdatedAt));
      setStatus("saved");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        if (userId) {
          const payload = {
            user_id: userId,
            form_type: formType,
            data,
            updated_at: new Date().toISOString(),
          };
          const { error } = await draftsUpsert<T>().upsert(payload, {
            onConflict: "user_id,form_type",
          });
          if (error) throw error;
        }
        setSavedAt(new Date());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, loaded, userId, formType, debounceMs, writeIfSafe]);

  const clearDraft = useCallback(async () => {
    try {
      if (userId) {
        await draftsDelete().delete().eq("user_id", userId).eq("form_type", formType);
      }
      removeLocalDraft(formType, userId);
    } catch {
      /* ignore */
    }
    setInitialDraft(null);
    setSavedAt(null);
    setStatus("idle");
    lastSerializedRef.current = JSON.stringify(data);
  }, [userId, formType, data]);

  const dismissDraft = useCallback(() => {
    setInitialDraft(null);
  }, []);

  return { initialDraft, loaded, status, savedAt, clearDraft, dismissDraft };
}
