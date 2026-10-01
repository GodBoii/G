"use client";

import { useWallet } from "@/context/WalletContext";
import { formatCredits } from "@/lib/money";

const PILL = "inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 text-sm font-semibold tabular-nums";

/** data-testid="balance"; data-cents is present only once the wallet has hydrated. */
export function BalancePill() {
  const { balanceCents } = useWallet();

  if (balanceCents === null) {
    return (
      <span data-testid="balance" role="img" aria-label="Loading balance" className={`${PILL} animate-pulse text-ink-muted`}>
        <span aria-hidden="true">🪙</span>
        <span aria-hidden="true" className="inline-block w-[7ch] text-center">
          —
        </span>
      </span>
    );
  }

  return (
    <span data-testid="balance" data-cents={balanceCents} className={`${PILL} text-amber-100`}>
      <span aria-hidden="true">🪙</span>
      <span className="sr-only">Balance: </span>
      <span>{formatCredits(balanceCents)}</span>
      <span className="sr-only"> demo credits</span>
    </span>
  );
}
