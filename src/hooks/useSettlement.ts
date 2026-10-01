import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWallet } from "@/context/WalletContext";

export type Ticket = { id: number; betCents: number; payoutCents: number };

type Pending = { payoutCents: number; onSettle?: () => void };

let nextTicketId = 1;

export interface Settlement {
  /**
   * placeBet(betCents); on success remembers the pre-computed payout and returns a ticket.
   * Returns null (and records nothing) when the wallet rejects the bet.
   * `onSettle` is for external-store side effects only: it may run after unmount, so it
   * must never call React setState.
   */
  stake(betCents: number, payoutCents: number, onSettle?: () => void): Ticket | null;
  /**
   * Exactly-once: credits the ticket's payout (skipped when 0), runs onSettle, returns the amount.
   * Unknown / already-settled tickets return 0. Build banners and history from the ticket's
   * fields, never from this return value (pagehide may already have settled it).
   */
  settle(ticket: Ticket): number;
}

export function useSettlement(): Settlement {
  const { placeBet, credit } = useWallet();
  const pending = useRef<Map<number, Pending>>(new Map());

  const stake = useCallback(
    (betCents: number, payoutCents: number, onSettle?: () => void): Ticket | null => {
      if (!placeBet(betCents)) return null;
      const ticket: Ticket = { id: nextTicketId++, betCents, payoutCents };
      pending.current.set(ticket.id, { payoutCents, onSettle });
      return ticket;
    },
    [placeBet],
  );

  const settle = useCallback(
    (ticket: Ticket): number => {
      const entry = pending.current.get(ticket.id);
      if (!entry) return 0;
      pending.current.delete(ticket.id);
      if (entry.payoutCents > 0) credit(entry.payoutCents);
      entry.onSettle?.();
      return entry.payoutCents;
    },
    [credit],
  );

  // A decided outcome is paid even if the user navigates away or reloads mid-animation.
  useEffect(() => {
    const map = pending.current;
    function flush() {
      for (const [id, entry] of Array.from(map)) {
        map.delete(id);
        if (entry.payoutCents > 0) credit(entry.payoutCents);
        entry.onSettle?.();
      }
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [credit]);

  return useMemo(() => ({ stake, settle }), [stake, settle]);
}
