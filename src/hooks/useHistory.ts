import { useCallback, useMemo, useReducer } from "react";
import { HISTORY_LIMIT } from "@/lib/money";
import type { HistoryEntry } from "@/components/ui/History";

type HistoryAction<T> = { type: "add"; entry: T } | { type: "clear" };

function historyReducer<T>(state: readonly T[], action: HistoryAction<T>): readonly T[] {
  switch (action.type) {
    case "add":
      return [action.entry, ...state].slice(0, HISTORY_LIMIT);
    case "clear":
      return state.length === 0 ? state : [];
  }
}

const EMPTY: readonly never[] = [];

/** In-memory round history, newest first, capped at HISTORY_LIMIT (20). */
export function useHistory<T = HistoryEntry>(): {
  entries: readonly T[];
  add(entry: T): void;
  clear(): void;
} {
  const [entries, dispatch] = useReducer(
    historyReducer as (state: readonly T[], action: HistoryAction<T>) => readonly T[],
    EMPTY as readonly T[],
  );
  const add = useCallback((entry: T) => dispatch({ type: "add", entry }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  return useMemo(() => ({ entries, add, clear }), [entries, add, clear]);
}
