import { useCallback, useMemo, useRef, useState } from "react";

export interface RoundLock {
  /** Mirrors the lock for rendering (disable controls while true). */
  busy: boolean;
  /** Synchronous guard: false if already locked, otherwise locks and returns true. */
  tryLock(): boolean;
  /** Idempotent. */
  unlock(): void;
}

export function useRoundLock(): RoundLock {
  // The ref blocks double clicks / Enter auto-repeat in the same tick; `busy` is for render.
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);

  const tryLock = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }, []);

  const unlock = useCallback(() => {
    locked.current = false;
    setBusy(false);
  }, []);

  return useMemo(() => ({ busy, tryLock, unlock }), [busy, tryLock, unlock]);
}
