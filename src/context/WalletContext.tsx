"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { safeRead, safeWrite } from "@/lib/storage";
import { WALLET_KEY, createWalletStore, type WalletStore } from "@/lib/walletStore";

const WalletStoreContext = createContext<WalletStore | null>(null);

function persistWallet(cents: number): void {
  safeWrite(WALLET_KEY, JSON.stringify({ v: 1, cents }));
}

const getServerSnapshot = (): number | null => null;

export function WalletProvider({ children }: { children: ReactNode }) {
  // The store constructor touches no browser API, so this is SSR-safe.
  const [store] = useState(() => createWalletStore(persistWallet));

  useEffect(() => {
    // Idempotent: StrictMode's second effect run is a no-op.
    store.hydrate(safeRead(WALLET_KEY));

    function onStorage(e: StorageEvent) {
      // e.key === null means another tab cleared storage; re-read so the repair path persists.
      if (e.key === WALLET_KEY || e.key === null) store.adoptExternal(safeRead(WALLET_KEY));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  return <WalletStoreContext.Provider value={store}>{children}</WalletStoreContext.Provider>;
}

export interface Wallet {
  /** Integer cents; null until hydrated from storage (server render and first client render). */
  balanceCents: number | null;
  hydrated: boolean;
  placeBet: (cents: number) => boolean;
  credit: (cents: number) => void;
  reset: () => void;
  topUp: () => void;
}

export function useWallet(): Wallet {
  const store = useContext(WalletStoreContext);
  if (!store) throw new Error("useWallet must be used inside <WalletProvider>");
  const balanceCents = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  return useMemo(
    () => ({
      balanceCents,
      hydrated: balanceCents !== null,
      // Store methods are closures (no `this`), so they are stable and safe to pass around.
      placeBet: store.placeBet,
      credit: store.credit,
      reset: store.reset,
      topUp: store.topUp,
    }),
    [balanceCents, store],
  );
}
