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

function readLocalDraft<T>(formType: string, userId: string | null): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  const candidates = [lsKey(formType, userId), ...(userId ? [lsKey(formType, null)] : [])];
  for (const key of candidates) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as StoredDraft<T>;
    } catch {
      window.localStorage.removeItem(key);
    }
  }
  return null;
}

function writeLocalDraft<T>(formType: string, userId: string | null, data: T) {
  if (typeof window === "undefined") return null;
  const updated_at = new Date().toISOString();
  window.localStorage.setItem(lsKey(formType, userId), JSON.stringify({ data, updated_at }));
  return updated_at;
}

function removeLocalDraft(formType: string, userId: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(lsKey(formType, userId));
  window.localStorage.removeItem(lsKey(formType, null));
}

/**
 * Generic draft auto-save hook.
 * - Authenticated users → persists in Supabase `drafts` (RLS scoped to user).
 * - Anonymous users → falls back to localStorage.
 * Returns the loaded draft (once, on mount) plus save status / actions.
 */
export function useFormDraft<T>({ formType, data, enabled, debounceMs = 1500 }: Options<T>) {
  const { user } = useAuth();
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

  latestDataRef.current = data;
  enabledRef.current = enabled;
  loadedRef.current = loaded;

  // Initial load (once per user/formType).
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setInitialDraft(null);
    (async () => {
      try {
        const localDraft = readLocalDraft<T>(formType, userId);
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
            if (
              !bestDraft ||
              new Date(remoteDraft.updated_at).getTime() >= new Date(bestDraft.updated_at).getTime()
            ) {
              bestDraft = remoteDraft;
            }
          }
        }
        if (!cancelled && bestDraft?.data) {
          setInitialDraft(bestDraft.data);
          setSavedAt(bestDraft.updated_at ? new Date(bestDraft.updated_at) : null);
          lastSerializedRef.current = JSON.stringify(bestDraft.data);
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
  }, [userId, formType]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistLocalLatest = (updateState: boolean) => {
      if (!enabledRef.current || !loadedRef.current) return;
      const latestData = latestDataRef.current;
      const serialized = JSON.stringify(latestData);
      if (serialized === lastSerializedRef.current) return;
      const updatedAt = writeLocalDraft(formType, userId, latestData);
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
  }, [formType, userId]);

  // Debounced save on data change.
  useEffect(() => {
    if (!enabled || !loaded) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSerializedRef.current) return;
    const localUpdatedAt = writeLocalDraft(formType, userId, data);
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
        setStatus(localUpdatedAt ? "saved" : "error");
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, loaded, userId, formType, debounceMs]);

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
