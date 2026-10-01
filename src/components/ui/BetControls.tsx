"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import type { useBetInput } from "@/hooks/useBetInput";
import { MIN_BET } from "@/lib/money";
import { Button } from "./Button";
import { StatTile } from "./StatTile";

interface BetControlsProps {
  bet: ReturnType<typeof useBetInput>;
  inputDisabled: boolean;          // disables <input>, ½, 2x, Max; also suppresses error/hint rendering
  primaryLabel: string;
  onPrimary: () => void;
  /** If provided, fully replaces the default rule `!bet.valid || inputDisabled`. */
  primaryDisabled?: boolean;
  primaryTestId?: string; primaryVariant?: "primary" | "success";
  children?: ReactNode; potentialPayout?: string;
}

export type { BetControlsProps };

export function BetControls({
  bet,
  inputDisabled,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryTestId = "play-button",
  primaryVariant = "primary",
  children,
  potentialPayout,
}: BetControlsProps) {
  const id = useId();
  const inputId = `${id}-bet`;
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;

  const primaryIsDisabled = primaryDisabled ?? (!bet.valid || inputDisabled);
  const showMessages = !inputDisabled;   // no role="alert"/hint while a round is in progress

  const error = showMessages ? bet.error : null;
  const hint = !showMessages
    ? null
    : bet.loading
      ? "Loading balance…"
      : bet.balanceCents !== null && bet.balanceCents < MIN_BET
        ? "Out of credits: use Top up in the header"
        : null;
  const describedBy = [error && errId, hint && hintId].filter(Boolean).join(" ") || undefined;
  const quickDisabled = inputDisabled || bet.loading;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!primaryIsDisabled) onPrimary();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={inputId} className="text-sm font-medium text-ink-muted">
          Bet amount
        </label>
        <div className="mt-1.5 flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base">
              🪙
            </span>
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              data-testid="bet-input"
              value={bet.text}
              onChange={(e) => bet.setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={inputDisabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={`h-11 w-full rounded-xl border bg-bg-950/70 pl-10 pr-3 font-semibold tabular-nums text-ink transition-colors placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60 ${
                error ? "border-rose-400/70" : "border-white/10 hover:border-white/20"
              }`}
            />
          </div>
          <Button size="icon" className="shrink-0" aria-label="Halve bet" disabled={quickDisabled} onClick={bet.half}>
            ½
          </Button>
          <Button size="icon" className="shrink-0" aria-label="Double bet" disabled={quickDisabled} onClick={bet.double}>
            2x
          </Button>
          <Button size="md" className="shrink-0" aria-label="Set bet to maximum" disabled={quickDisabled} onClick={bet.max}>
            Max
          </Button>
        </div>
        {error && (
          <p id={errId} role="alert" className="mt-1.5 text-sm text-rose-300">
            {error}
          </p>
        )}
        {hint && (
          <p id={hintId} className="mt-1.5 text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>

      {children}

      {potentialPayout !== undefined && <StatTile label="Potential payout" value={potentialPayout} />}

      <Button
        variant={primaryVariant}
        size="lg"
        block
        data-testid={primaryTestId}
        disabled={primaryIsDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
