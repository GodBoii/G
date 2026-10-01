import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { DEFAULT_BET_INPUT, doubleBet, halveBet, maxBet, parseBetInput, validateBet } from "@/lib/money";

export interface BetInput {
  /** Raw input text. */
  text: string;
  setText(text: string): void;
  /** Live wallet balance in cents (null until hydrated). */
  balanceCents: number | null;
  /** True until the wallet hydrates (neutral state, not an error). */
  loading: boolean;
  /** Parsed bet in cents; 0 when the text does not parse. Only meaningful when `valid`. */
  parsed: number;
  /** null while loading; otherwise the parse or validation error, or null when OK. */
  error: string | null;
  /** !loading && error === null */
  valid: boolean;
  /** Â½ / 2x / Max (FR-4.5). No-ops while loading. */
  half(): void;
  double(): void;
  max(): void;
}

export function useBetInput(initial: string = DEFAULT_BET_INPUT): BetInput {
  const { balanceCents } = useWallet();
  const [text, setText] = useState(initial);

  const loading = balanceCents === null;
  const result = parseBetInput(text);
  const parsed = result.ok ? result.cents : 0;
  const error = balanceCents === null ? null : result.ok ? validateBet(result.cents, balanceCents) : result.error;
  const valid = !loading && error === null;

  const half = useCallback(() => {
    if (balanceCents === null) return;
    setText((t) => halveBet(t));
  }, [balanceCents]);

  const double = useCallback(() => {
    if (balanceCents === null) return;
    setText((t) => doubleBet(t, balanceCents));
  }, [balanceCents]);

  const max = useCallback(() => {
    if (balanceCents === null) return;
    setText(maxBet(balanceCents));
  }, [balanceCents]);

  return useMemo(
    () => ({ text, setText, balanceCents, loading, parsed, error, valid, half, double, max }),
    [text, balanceCents, loading, parsed, error, valid, half, double, max],
  );
}
