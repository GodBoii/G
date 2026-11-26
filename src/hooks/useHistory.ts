import { useCallback, useState } from "react";
const HISTORY_LIMIT = 20;

export function useHistory<T>() {
  const [entries, setEntries] = useState<readonly T[]>([]);
  const add = useCallback((entry: T) => {
    setEntries((history) => [entry, ...history].slice(0, HISTORY_LIMIT));
  }, []);

  return { entries, add };
}
