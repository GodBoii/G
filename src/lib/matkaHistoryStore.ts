// Persisted Satta Matka result chart: external store read via useSyncExternalStore.
import { canonicalPanna } from "./logic/matka";
import { safeWrite } from "./storage";

export const MATKA_KEY = "gamess:matka-history:v1";
export const MATKA_HISTORY_LIMIT = 30;

export interface MatkaChartItem {
  n: number;
  open: string;
  close: string;
  at: number;
}

export interface MatkaHistoryStore {
  /** sanitize → set, emit, persist(sanitized). Idempotent: a second call is ignored. */
  hydrate(raw: string | null): void;
  /** null until hydrated. Returns the stored (frozen) array by reference. */
  getSnapshot(): readonly MatkaChartItem[] | null;
  subscribe(listener: () => void): () => void;
  /** n = (items[0]?.n ?? 0) + 1; prepend; trim to 30; emit; persist. Ignored before hydration. */
  append(draw: { open: string; close: string; at: number }): void;
  /** → [], emit, persist. */
  clear(): void;
}

const PANNA_RE = /^\d{3}$/;

function isCanonicalPanna(v: unknown): v is string {
  return typeof v === "string" && PANNA_RE.test(v) && canonicalPanna(v) === v;
}

/** Stored JSON → items. Any violation resets the whole chart to []. */
export function sanitizeMatkaHistory(raw: string | null): MatkaChartItem[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    const { v, items } = parsed as { v?: unknown; items?: unknown };
    if (v !== 1 || !Array.isArray(items) || items.length > MATKA_HISTORY_LIMIT) return [];
    const out: MatkaChartItem[] = [];
    for (const item of items as unknown[]) {
      if (typeof item !== "object" || item === null) return [];
      const { n, open, close, at } = item as Record<string, unknown>;
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) return [];
      if (!isCanonicalPanna(open) || !isCanonicalPanna(close)) return [];
      if (typeof at !== "number" || !Number.isFinite(at)) return [];
      out.push(Object.freeze({ n, open, close, at }));
    }
    return out;
  } catch {
    return [];
  }
}

export function createMatkaHistoryStore(persist: (items: readonly MatkaChartItem[]) => void): MatkaHistoryStore {
  let items: readonly MatkaChartItem[] | null = null;
  const listeners = new Set<() => void>();

  function set(next: MatkaChartItem[]): void {
    const frozen = Object.freeze(next);
    items = frozen;
    for (const l of listeners) l();
    persist(frozen);
  }

  return {
    hydrate(raw) {
      if (items !== null) return;
      set(sanitizeMatkaHistory(raw));
    },
    getSnapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    append(draw) {
      if (items === null) return;
      const n = (items[0]?.n ?? 0) + 1;
      const entry = Object.freeze({ n, open: draw.open, close: draw.close, at: draw.at });
      set([entry, ...items].slice(0, MATKA_HISTORY_LIMIT));
    },
    clear() {
      if (items === null) return;
      set([]);
    },
  };
}

/** Module-level singleton. The constructor touches no browser API. */
export const matkaHistoryStore = createMatkaHistoryStore((items) =>
  safeWrite(MATKA_KEY, JSON.stringify({ v: 1, items })),
);
