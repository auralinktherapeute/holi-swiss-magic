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

  // Initial load (once per user/formType).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (userId) {
          const { data: row } = await supabase
            .from("drafts" as never)
            .select("data, updated_at")
            .eq("user_id", userId)
            .eq("form_type", formType)
            .maybeSingle() as any;
          if (!cancelled && row?.data) {
            setInitialDraft(row.data as T);
            setSavedAt(row.updated_at ? new Date(row.updated_at) : null);
          }
        } else if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(lsKey(formType, null));
          if (raw && !cancelled) {
            const parsed = JSON.parse(raw) as { data: T; updated_at: string };
            setInitialDraft(parsed.data);
            setSavedAt(parsed.updated_at ? new Date(parsed.updated_at) : null);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, formType]);

  // Debounced save on data change.
  useEffect(() => {
    if (!enabled || !loaded) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSerializedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        if (userId) {
          const { error } = await supabase
            .from("drafts" as never)
            .upsert(
              { user_id: userId, form_type: formType, data: data as any, updated_at: new Date().toISOString() },
              { onConflict: "user_id,form_type" },
            ) as any;
          if (error) throw error;
        } else if (typeof window !== "undefined") {
          window.localStorage.setItem(
            lsKey(formType, null),
            JSON.stringify({ data, updated_at: new Date().toISOString() }),
          );
        }
        lastSerializedRef.current = serialized;
        setSavedAt(new Date());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, loaded, userId, formType, debounceMs]);

  const clearDraft = useCallback(async () => {
    try {
      if (userId) {
        await supabase.from("drafts" as never).delete().eq("user_id", userId).eq("form_type", formType);
      } else if (typeof window !== "undefined") {
        window.localStorage.removeItem(lsKey(formType, null));
      }
    } catch { /* ignore */ }
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