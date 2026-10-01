"use client";

import { useId, useRef, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { Segmented, type SegmentedOption } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import {
  DICE_DEFAULT_TARGET,
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  diceMultiplierX10000,
  isDiceWin,
  rollDice,
  winChance,
  type DiceDirection,
} from "@/lib/logic/dice";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";

const TICK_MS = 600;
const REDUCED_TICK_MS = 100;
const SETTLE_MS = 650;
const SCALE_TICKS = [0, 25, 50, 75, 100] as const;

const DIRECTION_OPTIONS: readonly SegmentedOption<DiceDirection>[] = [
  { value: "under", label: "Roll under", testId: "dice-under" },
  { value: "over", label: "Roll over", testId: "dice-over" },
];

function rollText(roll: number): string {
  return (roll / 100).toFixed(2);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function DiceGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();
  const targetId = useId();

  const [target, setTarget] = useState(DICE_DEFAULT_TARGET);
  const [dir, setDir] = useState<DiceDirection>("under");
  /** Text of the big readout (ticks up during a roll; exact roll at settle). */
  const [display, setDisplay] = useState<string | null>(null);
  /** Roll the marker slides to (set when the roll starts). */
  const [marker, setMarker] = useState<{ roll: number; ms: number } | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Set a target and roll"));
  // Bumped to stop a running tick-up loop (handlers/rAF only, never read in render).
  const animToken = useRef(0);

  const chance = winChance(target, dir);
  const multX10000 = diceMultiplierX10000(chance);
  const potential = bet.valid ? formatCredits(payoutFromMultiplier(bet.parsed, multX10000, 10000)) : "—";
  const winZoneUnder = dir === "under";

  function onPlay() {
    if (!bet.valid || !lock.tryLock()) return;
    const reduced = reducedMotion;
    const t = target;
    const d = dir;
    const mult = multX10000;
    let ticket: Ticket | null;
    let roll: number;
    let won: boolean;
    try {
      roll = rollDice();
      won = isDiceWin(roll, t, d);
      ticket = stake(bet.parsed, won ? payoutFromMultiplier(bet.parsed, mult, 10000) : 0);
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
    const tickMs = reduced ? REDUCED_TICK_MS : TICK_MS;
    setMarker({ roll, ms: tickMs });
    setBanner((b) => ({ kind: "pending", title: "Rolling…", round: b.round }));

    const token = ++animToken.current;
    let start: number | null = null;
    const tick = (now: number) => {
      if (animToken.current !== token) return;
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / tickMs);
      setDisplay(rollText(Math.floor(roll * easeOutCubic(p))));
      if (p < 1) timers.requestFrame(tick);
    };
    timers.requestFrame(tick);

    timers.setTimeout(() => {
      animToken.current++;
      settle(ticket);
      setDisplay(rollText(roll));
      setLastWin(won);
      const multText = formatMultiplier(won ? mult : 0, 10000);
      setBanner((b) =>
        bannerFor({
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
          multiplierText: multText,
          round: b.round + 1,
          detail: `Rolled ${rollText(roll)} · needed ${d === "under" ? "under" : "over"} ${t}.00`,
          outcome: String(roll),
        }),
      );
      history.add({
        id: ticket.id,
        label: `🎲 ${rollText(roll)}`,
        multiplierText: multText,
        betCents: ticket.betCents,
        payoutCents: ticket.payoutCents,
      });
      lock.unlock();
    }, SETTLE_MS);
  }

  const readoutTone = lastWin === true ? "text-emerald-300" : lastWin === false ? "text-rose-300" : "text-ink";

  const board = (
    <div className="flex h-full flex-col justify-center gap-8 py-4 sm:py-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-faint">Roll result</p>
        <p
          data-testid="dice-roll"
          className={`mt-1 font-display text-6xl font-extrabold tabular-nums tracking-tight transition-colors sm:text-7xl ${readoutTone} ${
            lastWin === true ? "drop-shadow-[0_0_24px_rgb(52_211_153/.45)]" : ""
          }`}
        >
          {display ?? "—"}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Win if roll {winZoneUnder ? "<" : "≥"} <span className="font-semibold tabular-nums text-ink">{target}.00</span>
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl px-1">
        {/* Roll marker lane */}
        <div className="relative h-12" aria-hidden="true">
          {marker && (
            <div
              className="absolute bottom-1 -translate-x-1/2"
              style={{ left: `${marker.roll / 100}%`, transition: `left ${marker.ms}ms cubic-bezier(.2,.8,.2,1)` }}
            >
              <div
                className={`grid h-9 w-10 place-items-center text-[0.7rem] font-bold tabular-nums text-bg-950 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)] ${
                  lastWin === false ? "bg-rose-300" : lastWin === true ? "bg-emerald-300" : "bg-amber-300"
                }`}
              >
                {display ?? ""}
              </div>
              <div
                className={`mx-auto h-2 w-0.5 ${lastWin === false ? "bg-rose-300" : lastWin === true ? "bg-emerald-300" : "bg-amber-300"}`}
              />
            </div>
          )}
        </div>

        {/* Track with win/lose zones; the range input sits on top of it. */}
        <div className="relative h-10">
          <div className="absolute inset-x-0 top-1/2 flex h-3 -translate-y-1/2 overflow-hidden rounded-full ring-1 ring-white/10">
            <div
              className={`h-full transition-colors ${winZoneUnder ? "bg-emerald-400" : "bg-rose-500"}`}
              style={{ width: `${target}%` }}
            />
            <div className={`h-full flex-1 transition-colors ${winZoneUnder ? "bg-rose-500" : "bg-emerald-400"}`} />
          </div>
          <label htmlFor={targetId} className="sr-only">
            Target
          </label>
          <input
            id={targetId}
            type="range"
            min={DICE_MIN_TARGET}
            max={DICE_MAX_TARGET}
            step={1}
            value={target}
            disabled={lock.busy}
            aria-valuetext={`Roll ${dir} ${target}, ${chance}% win chance`}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-linear-to-b [&::-moz-range-thumb]:from-fuchsia-500 [&::-moz-range-thumb]:to-violet-600 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-linear-to-b [&::-webkit-slider-thumb]:from-fuchsia-500 [&::-webkit-slider-thumb]:to-violet-600 [&::-webkit-slider-thumb]:shadow-glow-fuchsia"
          />
        </div>

        <div className="relative mt-1 h-5 text-xs tabular-nums text-ink-faint" aria-hidden="true">
          {SCALE_TICKS.map((v) => (
            <span
              key={v}
              className={`absolute top-0 ${v === 0 ? "" : v === 100 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${v}%` }}
            >
              {v}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-ink-muted">Target</span>
          <output htmlFor={targetId} className="font-display text-2xl font-bold tabular-nums text-ink">
            {target}
          </output>
        </div>
      </div>
    </div>
  );

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={lock.busy}
      primaryLabel={lock.busy ? "Rolling…" : "Roll dice"}
      onPrimary={onPlay}
      potentialPayout={potential}
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-muted">Direction</p>
        <Segmented<DiceDirection> label="Roll direction" options={DIRECTION_OPTIONS} value={dir} onChange={setDir} disabled={lock.busy} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Win chance" value={`${chance}%`} testId="dice-chance" />
        <StatTile label="Multiplier" value={formatMultiplier(multX10000, 10000)} testId="dice-multiplier" tone="gold" />
      </div>
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Dice table"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
