import { MAX_BALANCE, MAX_BET, MIN_BET, START_BALANCE, TOP_UP_AMOUNT } from "./money";

export const WALLET_KEY = "gamess:wallet:v1"; // value: JSON {"v":1,"cents":<int>}

/** Stored JSON → cents. Anything invalid falls back to START_BALANCE (not logged: expected input). */
export function sanitizeStoredWallet(raw: string | null): number {
  if (raw === null) return START_BALANCE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return START_BALANCE;
    const { v, cents } = parsed as { v?: unknown; cents?: unknown };
    if (v !== 1) return START_BALANCE;
    if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents < 0 || cents > MAX_BALANCE) {
      return START_BALANCE;
    }
    return cents;
  } catch {
    return START_BALANCE;
  }
}

function encode(cents: number): string {
  return JSON.stringify({ v: 1, cents });
}

export interface WalletStore {
  /** null until hydrated. */
  getSnapshot(): number | null;
  subscribe(listener: () => void): () => void;
  /** sanitize(raw) → set, emit, persist(sanitized). Idempotent: later calls are ignored. */
  hydrate(raw: string | null): void;
  /** From a cross-tab 'storage' event. Persists only when repairing a bad value. */
  adoptExternal(raw: string | null): void;
  placeBet(cents: number): boolean;
  credit(cents: number): void;
  /** → START_BALANCE. No-op before hydration. */
  reset(): void;
  /** += TOP_UP_AMOUNT (clamped to MAX_BALANCE). No-op before hydration. */
  topUp(): void;
}

export function createWalletStore(persist: (cents: number) => void): WalletStore {
  let cents: number | null = null;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  function set(next: number): void {
    cents = Math.min(next, MAX_BALANCE);
    emit();
    persist(cents);
  }

  return {
    getSnapshot: () => cents,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate(raw) {
      if (cents !== null) return;
      set(sanitizeStoredWallet(raw));
    },
    adoptExternal(raw) {
      // Cross-tab sync is last-writer-wins: if two tabs play at once, the latest write
      // to localStorage is the balance both tabs end up with. Accepted for demo credits.
      const sanitized = sanitizeStoredWallet(raw);
      cents = sanitized;
      emit();
      // The other tab already wrote this value; re-writing would ping-pong storage events.
      // Only repair storage when the raw value doesn't encode what we adopted.
      if (raw !== encode(sanitized)) persist(sanitized);
    },
    placeBet(bet) {
      if (cents === null) return false;
      if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET || bet > cents) return false;
      set(cents - bet);
      return true;
    },
    credit(amount) {
      if (!Number.isSafeInteger(amount) || amount < 0) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[gamess] walletStore.credit ignored invalid amount: ${String(amount)}`);
        }
        return;
      }
      if (cents === null || amount === 0) return;
      set(cents + amount);
    },
    reset() {
      if (cents === null) return;
      set(START_BALANCE);
    },
    topUp() {
      if (cents === null) return;
      set(cents + TOP_UP_AMOUNT);
    },
  };
}
