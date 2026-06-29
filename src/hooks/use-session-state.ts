import { useCallback, useEffect, useRef, useState } from "react";

type StoredSessionState<T> = { data: T; updated_at: string };

const sessionState = new Map<string, StoredSessionState<unknown>>();

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : initial;
}

export function readSessionState<T>(key: string): StoredSessionState<T> | null {
  return (sessionState.get(key) as StoredSessionState<T> | undefined) ?? null;
}

export function hasSessionState(key: string) {
  return sessionState.has(key);
}

export function writeSessionState<T>(key: string, data: T) {
  const updated_at = new Date().toISOString();
  sessionState.set(key, { data, updated_at });
  return updated_at;
}

export function removeSessionState(key: string) {
  sessionState.delete(key);
}

export function clearAllSessionState() {
  sessionState.clear();
}

export function useSessionState<T>(key: string, initial: T | (() => T)) {
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const [value, setValue] = useState<T>(() => {
    const stored = readSessionState<T>(key);
    return stored ? stored.data : resolveInitial(initial);
  });

  useEffect(() => {
    const stored = readSessionState<T>(key);
    setValue(stored ? stored.data : resolveInitial(initialRef.current));
  }, [key]);

  const setSessionValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        writeSessionState(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const clearSessionValue = useCallback(() => {
    removeSessionState(key);
  }, [key]);

  return [value, setSessionValue, clearSessionValue] as const;
}