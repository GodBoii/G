"use client";

import { useId, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { StatTile } from "@/components/ui/StatTile";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import {
  LIMBO_DEFAULT_TARGET_INPUT,
  isLimboWin,
  limboWinChanceText,
  parseMultiplierInput,
  rollLimbo,
} from "@/lib/logic/limbo";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";

const REDUCED_SETTLE_MS = 150;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Height (0..1) of a multiplier on the log-scaled flight board. */
function heightOf(valueH: number, topX: number): number {
  const x = valueH / 100;
  if (x <= 1) return 0;
  return Math.min(1, Math.log(x) / Math.log(topX));
}

export function LimboGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();
  const targetInputId = useId();
  const targetErrorId = `${targetInputId}-error`;

  const [targetText, setTargetText] = useState(LIMBO_DEFAULT_TARGET_INPUT);
  /** Readout value in hundredths (1.00x at rest). */
  const [currentH, setCurrentH] = useState(100);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Set a target and launch"));

  const target = parseMultiplierInput(targetText);
  const targetH = target.ok ? target.hundredths : null;
  const chanceText = targetH !== null ? limboWinChanceText(targetH) : "—";
  const potential =
    targetH !== null && bet.valid ? formatCredits(payoutFromMultiplier(bet.parsed, targetH, 100)) : "—";

  // Board scale: the target line sits about halfway up for small targets, higher for big ones.
  const topX = Math.max(4, ((targetH ?? 200) / 100) ** 1.6);
  const rocketHeight = heightOf(currentH, topX);
  const targetHeight = targetH !== null ? heightOf(targetH, topX) : null;

  function onPlay() {
    if (!bet.valid || !target.ok || !lock.tryLock()) return;
    const reduced = reducedMotion;
    const tH = target.hundredths;
    let ticket: Ticket | null;
    let resultH: number;
    let won: boolean;
    try {
      resultH = rollLimbo();
      won = isLimboWin(resultH, tH);
      ticket = stake(bet.parsed, won ? payoutFromMultiplier(bet.parsed, tH, 100) : 0);
    } catch (e) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(e), round: b.round }));
      console.error(e);
      lock.unlock();
      return;
    }
    if (!ticket) {
      setNotice("Not enough credits");
      lock.unlock();
      return;
    }

    setNotice(null);
    setLastWin(null);
    setBanner((b) => ({ kind: "pending", title: "Launching…", round: b.round }));

    const finish = () => {
      settle(ticket);
      setLastWin(won);
      const multText = formatMultiplier(won ? tH : 0, 100);
      setBanner((b) =>
        bannerFor({
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
          multiplierText: multText,
          round: b.round + 1,
          detail: `Result ${formatMultiplier(resultH, 100)} · target ${formatMultiplier(tH, 100)}`,
          outcome: String(resultH),
        }),
      );
      history.add({
        id: ticket.id,
        label: `🚀 ${formatMultiplier(resultH, 100)}`,
        multiplierText: multText,
        betCents: ticket.betCents,
        payoutCents: ticket.payoutCents,
      });
      lock.unlock();
    };

    if (reduced) {
      setCurrentH(resultH);
      timers.setTimeout(finish, REDUCED_SETTLE_MS);
      return;
    }

    // D grows with log10 of the result multiplier (NIT 4).
    const durationMs = Math.min(1500, 500 + 250 * Math.log10(resultH / 100));
    const lnResult = Math.log(resultH / 100);
    setCurrentH(100);
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        // Exact final string and settlement land in the same render.
        setCurrentH(resultH);
        finish();
        return;
      }
      const v = Math.exp(lnResult * easeOutCubic(elapsed / durationMs));
      setCurrentH(Math.min(resultH, Math.max(100, Math.floor(v * 100))));
      timers.requestFrame(step);
    };
    timers.requestFrame(step);
  }

  const flying = lock.busy && lastWin === null;
  const readoutTone = lastWin === true ? "text-emerald-300" : lastWin === false ? "text-rose-300" : "text-ink";

  const board = (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-white/5 bg-bg-950/60 sm:h-80">
      {/* Faint grid backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/.05)_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-rose-500/15 via-fuchsia-500/5 to-transparent"
      />

      {/* Target line */}
      {targetHeight !== null && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t-2 border-dashed border-amber-300/70"
          style={{ bottom: `calc(1.5rem + ${targetHeight} * (100% - 4.5rem))` }}
        >
          <span className="absolute -top-3 right-3 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold tabular-nums text-bg-950">
            Target {formatMultiplier(targetH ?? 0, 100)}
          </span>
        </div>
      )}

      {/* Rocket */}
      <div
        aria-hidden="true"
        className="absolute left-[14%] flex flex-col items-center sm:left-[18%]"
        style={{ bottom: `calc(0.75rem + ${rocketHeight} * (100% - 4.5rem))` }}
      >
        <span className={`text-4xl drop-shadow-[0_0_12px_rgb(244_63_94/.6)] sm:text-5xl ${lastWin === false ? "" : "-rotate-45"}`}>
          {lastWin === false ? "💥" : "🚀"}
        </span>
        {flying && <span className="-mt-1 h-10 w-2 rounded-full bg-linear-to-b from-amber-300 via-orange-500 to-transparent blur-[2px]" />}
      </div>

      {/* Readout */}
      {/* Readout sits above the highest possible target line (≈ 62% of the flight height). */}
      <div className="absolute inset-x-0 top-0 flex justify-center pt-5 sm:pt-6">
        <div className="text-center">
          <p
            data-testid="limbo-result"
            className={`font-display text-6xl font-extrabold tabular-nums tracking-tight transition-colors sm:text-7xl ${readoutTone} ${
              lastWin === true ? "drop-shadow-[0_0_28px_rgb(52_211_153/.5)]" : ""
            }`}
          >
            {formatMultiplier(currentH, 100)}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {lastWin === true ? "Cleared the target" : lastWin === false ? "Fell short of the target" : flying ? "Climbing…" : "Ready for launch"}
          </p>
        </div>
      </div>
    </div>
  );

  const targetError = target.ok ? null : target.error;

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={lock.busy}
      primaryDisabled={lock.busy || !bet.valid || !target.ok}
      primaryLabel={lock.busy ? "Launching…" : "Launch"}
      onPrimary={onPlay}
      potentialPayout={potential}
    >
      <div>
        <label htmlFor={targetInputId} className="text-sm font-medium text-ink-muted">
          Target multiplier
        </label>
        <div className="relative mt-1.5">
          <input
            id={targetInputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            data-testid="limbo-target"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            disabled={lock.busy}
            aria-invalid={targetError ? true : undefined}
            aria-describedby={targetError ? targetErrorId : undefined}
            className={`h-11 w-full rounded-xl border bg-bg-950/70 pl-3 pr-9 font-semibold tabular-nums text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              targetError ? "border-rose-400/70" : "border-white/10 hover:border-white/20"
            }`}
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-semibold text-ink-muted">
            x
          </span>
        </div>
        {targetError && (
          <p id={targetErrorId} role="alert" className="mt-1.5 text-sm text-rose-300">
            {targetError}
          </p>
        )}
      </div>
      <StatTile label="Win chance" value={chanceText} testId="limbo-chance" />
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Limbo flight"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
