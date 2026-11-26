"use client";

import { useWallet } from "@/context/WalletContext";
import { formatCredits } from "@/lib/money";

export function BalancePill() {
  const { balanceCents, topUp } = useWallet();

  return (
    <div className="wallet">
      <span className="chip-symbol wallet-chip" aria-hidden="true">✦</span>
      <span className="wallet-value" aria-live="polite" aria-atomic="true">
        <span className="wallet-label">CHIP BALANCE</span>
        <strong data-testid="balance" data-cents={balanceCents ?? undefined}>
          {balanceCents === null ? "—" : formatCredits(balanceCents)}
        </strong>
      </span>
      <button
        type="button"
        className="wallet-refill"
        onClick={topUp}
        disabled={balanceCents === null}
        title="Add 1,000 virtual chips"
        aria-label="Add 1,000 virtual chips"
      >+</button>
    </div>
  );
}
