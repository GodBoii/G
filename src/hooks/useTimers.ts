import { useEffect, useMemo, useRef } from "react";

export interface Timers {
  /** window.setTimeout that is cleared automatically on unmount. */
  setTimeout(fn: () => void, ms: number): number;
  /** requestAnimationFrame that is cancelled automatically on unmount. */
  requestFrame(fn: (time: number) => void): number;
  clearAll(): void;
}

/**
 * Tracked timeouts / animation frames. Everything still pending is cleared on unmount,
 * so no state updates happen after unmount. Resolve animations with these timeouts,
 * not with transitionend.
 */
export function useTimers(): Timers {
  const timeouts = useRef<Set<number>>(new Set());
  const frames = useRef<Set<number>>(new Set());

  useEffect(() => {
    const t = timeouts.current;
    const f = frames.current;
    return () => {
      for (const id of t) window.clearTimeout(id);
      for (const id of f) window.cancelAnimationFrame(id);
      t.clear();
      f.clear();
    };
  }, []);

  return useMemo<Timers>(
    () => ({
      setTimeout(fn, ms) {
        const id = window.setTimeout(() => {
          timeouts.current.delete(id);
          fn();
        }, ms);
        timeouts.current.add(id);
        return id;
      },
      requestFrame(fn) {
        const id = window.requestAnimationFrame((time) => {
          frames.current.delete(id);
          fn(time);
        });
        frames.current.add(id);
        return id;
      },
      clearAll() {
        for (const id of timeouts.current) window.clearTimeout(id);
        for (const id of frames.current) window.cancelAnimationFrame(id);
        timeouts.current.clear();
        frames.current.clear();
      },
    }),
    [],
  );
}
