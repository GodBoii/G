"use client";

import { useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import { WHEEL_SEGMENTS_X10, WHEEL_SEGMENT_COUNT, spinWheel, wheelTargetRotation } from "@/lib/logic/wheel";
import { formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage, randomFloat } from "@/lib/rng";

const SPIN_MS = 5000;
const REDUCED_SPIN_MS = 400;
const SETTLE_PAD_MS = 100;

const C = 200; // viewBox centre
const R_OUT = 176;
const R_IN = 48;
const SEG_DEG = 360 / WHEEL_SEGMENT_COUNT;
const BULBS = 20;

type SegValue = (typeof WHEEL_SEGMENTS_X10)[number];

/** Segment fill + label classes per multiplier ×10 (design §5.2 colours). */
const SEGMENT_STYLE: Record<SegValue, { fill: string; label: string; stroke?: string }> = {
  0: { fill: "fill-slate-800", label: "fill-slate-400" },
  15: { fill: "fill-sky-500", label: "fill-bg-950" },
  20: { fill: "fill-emerald-500", label: "fill-bg-950" },
  30: { fill: "fill-violet-500", label: "fill-bg-950" },
  50: { fill: "fill-amber-400", label: "fill-bg-950" },
  100: { fill: "fill-fuchsia-500", label: "fill-bg-950", stroke: "stroke-amber-300" },
};

/** Compact wheel label: "10x", "1.5x", "0". */
function wheelLabel(x10: number): string {
  return x10 === 0 ? "0" : `${x10 / 10}x`;
}

/** Point at clockwise-from-12 angle `deg`, radius `r`. */
function pt(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(C + r * Math.sin(a)).toFixed(3)} ${(C - r * Math.cos(a)).toFixed(3)}`;
}

function wedgePath(i: number): string {
  const a0 = i * SEG_DEG;
  const a1 = (i + 1) * SEG_DEG;
  return [
    `M ${pt(R_IN, a0)}`,
    `L ${pt(R_OUT, a0)}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${pt(R_OUT, a1)}`,
    `L ${pt(R_IN, a1)}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, a0)}`,
    "Z",
  ].join(" ");
}

// Pure geometry, computed once at module load (no randomness).
const SEGMENTS = WHEEL_SEGMENTS_X10.map((v, i) => ({ i, v, d: wedgePath(i), centre: i * SEG_DEG + SEG_DEG / 2 }));

const BULB_POINTS = Array.from({ length: BULBS }, (_, k) => {
  const a = ((k * 360) / BULBS) * (Math.PI / 180);
  // Rounded so server and client render identical attribute strings.
  return { k, cx: Number((C + 188 * Math.sin(a)).toFixed(3)), cy: Number((C - 188 * Math.cos(a)).toFixed(3)) };
});

const LEGEND_VALUES: readonly SegValue[] = [100, 50, 30, 20, 15, 0];
const LEGEND = LEGEND_VALUES.map((v) => ({ v, count: WHEEL_SEGMENTS_X10.filter((s) => s === v).length }));

export function WheelGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();

  const [rotation, setRotation] = useState(0);
  const [spinMs, setSpinMs] = useState(SPIN_MS);
  /** Winning segment, set at settle. */
  const [segIndex, setSegIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Place a bet and spin"));

  function onPlay() {
    if (!bet.valid || !lock.tryLock()) return;
    const reduced = reducedMotion;
    let ticket: Ticket | null;
    let index: number;
    let nextRotation: number;
    let multX10: number;
    try {
      index = spinWheel();
      nextRotation = wheelTargetRotation(rotation, index, randomFloat());
      multX10 = WHEEL_SEGMENTS_X10[index];
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, multX10, 10));
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

    const duration = reduced ? REDUCED_SPIN_MS : SPIN_MS;
    setNotice(null);
    setSpinMs(duration);
    setRotation(nextRotation);
    setBanner((b) => ({ kind: "pending", title: "Spinning…", round: b.round }));

    timers.setTimeout(() => {
      settle(ticket);
      setSegIndex(index);
      const label = wheelLabel(multX10);
      const multText = formatMultiplier(multX10, 10);
      setBanner((b) =>
        bannerFor({
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
          multiplierText: multText,
          round: b.round + 1,
          detail: `Wheel stopped on ${label}`,
          outcome: String(index),
        }),
      );
      history.add({
        id: ticket.id,
        label: `🎡 ${label}`,
        multiplierText: multText,
        betCents: ticket.betCents,
        payoutCents: ticket.payoutCents,
      });
      lock.unlock();
    }, duration + SETTLE_PAD_MS);
  }

  const spinning = lock.busy;
  const settledIndex = spinning ? null : segIndex;
  const settledValue = settledIndex !== null ? WHEEL_SEGMENTS_X10[settledIndex] : null;
  const ariaLabel =
    settledValue !== null
      ? `Wheel stopped on ${wheelLabel(settledValue)}`
      : spinning
        ? "Wheel spinning"
        : `Prize wheel with ${WHEEL_SEGMENT_COUNT} segments`;

  const board = (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative mx-auto aspect-square w-[min(100%,26rem)]">
        {/* Glow behind the wheel */}
        <div
          aria-hidden="true"
          className={`absolute inset-[6%] rounded-full blur-2xl transition-colors duration-700 ${
            settledValue !== null && settledValue > 0 ? "bg-amber-400/30" : "bg-fuchsia-500/20"
          }`}
        />

        {/* Rotor: only this element rotates. The round clip keeps the rotated box from causing overflow. */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          data-testid="wheel"
          data-rotation={rotation}
          data-segment-index={segIndex ?? undefined}
          className="absolute inset-0 will-change-transform"
          style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${spinMs}ms cubic-bezier(.12,.75,.1,1)` }}
        >
          <svg viewBox="0 0 400 400" role="img" aria-label={ariaLabel} className="size-full">
            {SEGMENTS.map((s) => {
              const style = SEGMENT_STYLE[s.v];
              return (
                <path
                  key={s.i}
                  d={s.d}
                  className={`${style.fill} ${style.stroke ?? "stroke-bg-950/70"}`}
                  strokeWidth={style.stroke ? 2.5 : 1}
                />
              );
            })}
            {SEGMENTS.map((s) => (
              <g key={`l${s.i}`} transform={`rotate(${s.centre} ${C} ${C})`}>
                <text
                  x={C}
                  y={C - R_OUT + 12}
                  transform={`rotate(90 ${C} ${C - R_OUT + 12})`}
                  dominantBaseline="central"
                  className={`${SEGMENT_STYLE[s.v].label} font-display text-[15px] font-extrabold`}
                >
                  {wheelLabel(s.v)}
                </text>
              </g>
            ))}
            {settledIndex !== null && (
              <path d={SEGMENTS[settledIndex].d} className="animate-pulse fill-white/25 stroke-white" strokeWidth={2} />
            )}
          </svg>
        </div>
        </div>

        {/* Static rim, bulbs, hub (outside the rotor). */}
        <svg viewBox="0 0 400 400" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <radialGradient id="wheel-hub" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#2a2160" />
              <stop offset="100%" stopColor="#07051a" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r={188} fill="none" className="stroke-amber-400/80" strokeWidth={14} />
          <circle cx={C} cy={C} r={195} fill="none" className="stroke-amber-200/40" strokeWidth={1.5} />
          <circle cx={C} cy={C} r={181} fill="none" className="stroke-bg-950" strokeWidth={2} />
          {BULB_POINTS.map((b) => (
            <circle
              key={b.k}
              cx={b.cx}
              cy={b.cy}
              r={4}
              className={`fill-amber-100 ${spinning ? "animate-bulb-blink" : ""}`}
              style={spinning && b.k % 2 === 1 ? { animationDelay: "600ms" } : undefined}
            />
          ))}
          <circle cx={C} cy={C} r={R_IN} fill="url(#wheel-hub)" className="stroke-amber-300/70" strokeWidth={3} />
          <text
            x={C}
            y={C}
            textAnchor="middle"
            dominantBaseline="central"
            className={`font-display text-[26px] font-extrabold ${
              settledValue === null ? "fill-ink-muted" : settledValue > 0 ? "fill-amber-300" : "fill-slate-400"
            }`}
          >
            {settledValue === null ? (spinning ? "…" : "SPIN") : wheelLabel(settledValue)}
          </text>
        </svg>

        {/* Fixed pointer at 12 o'clock */}
        <svg
          viewBox="0 0 40 48"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 w-8 -translate-x-1/2 -translate-y-1/4 drop-shadow-[0_4px_6px_rgb(0_0_0/.6)] sm:w-10"
        >
          <path d="M4 4 H36 L20 44 Z" className="fill-amber-400 stroke-amber-100" strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
      </div>

      <ul className="flex flex-wrap justify-center gap-2 text-xs" aria-label="Wheel segments">
        {LEGEND.map(({ v, count }) => (
          <li key={v} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 tabular-nums">
            <svg viewBox="0 0 10 10" aria-hidden="true" className="size-2.5">
              <circle cx={5} cy={5} r={5} className={SEGMENT_STYLE[v].fill} />
            </svg>
            <span className="font-semibold text-ink">{wheelLabel(v)}</span>
            <span className="text-ink-faint">×{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const controls = (
    <BetControls bet={bet} inputDisabled={lock.busy} primaryLabel={lock.busy ? "Spinning…" : "Spin wheel"} onPrimary={onPlay}>
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Prize wheel"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
