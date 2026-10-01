"use client";

import { useState, type CSSProperties } from "react";
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
import {
  INITIAL_GRID,
  SLOT_LINES,
  SLOT_PAYLINES,
  SLOT_REELS,
  SLOT_ROWS,
  SLOT_SYMBOL_BY_ID,
  evaluateLines,
  randomSlotSymbol,
  spinGrid,
  type LineWin,
  type SlotGrid,
  type SymbolId,
} from "@/lib/logic/slots";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";

type Phase = "rest" | "arm" | "spin";

const BASE_STOP_MS = 900;
const STOP_STEP_MS = 280;
const SETTLE_MS = BASE_STOP_MS + STOP_STEP_MS * 4 + 120;
const REDUCED_STOP_STEP_MS = 120;
const REDUCED_SETTLE_MS = 600;

const ALL_STOPPED: readonly boolean[] = Array.from({ length: SLOT_REELS }, () => true);
const NONE_STOPPED: readonly boolean[] = Array.from({ length: SLOT_REELS }, () => false);
const REEL_INDEXES = Array.from({ length: SLOT_REELS }, (_, i) => i);
const ROW_INDEXES = Array.from({ length: SLOT_ROWS }, (_, r) => r);

/** One colour per payline (line n uses LINE_COLORS[n - 1]). */
const LINE_COLORS = ["#fbbf24", "#f472b6", "#38bdf8", "#34d399", "#a78bfa", "#fb923c", "#f87171", "#22d3ee", "#a3e635", "#e879f9"] as const;

// Overlay coordinates: one reel = 100 units, gap ≈ 8 units (the real gap is a fixed 0.375rem,
// so line centres are within a few pixels at every cell size; strokes do not scale).
const VB_CELL = 100;
const VB_GAP = 8;
const VB_W = SLOT_REELS * VB_CELL + (SLOT_REELS - 1) * VB_GAP;
const VB_H = SLOT_ROWS * VB_CELL;

/** Container-query sizing (design §5.1, verbatim). */
const REEL_AREA_STYLE = {
  containerType: "inline-size",
  padding: "0.5rem",
  "--gap": "0.375rem",
  "--cell": "min(5.5rem, calc((100cqi - 4 * var(--gap) - 1rem) / 5))",
} as CSSProperties;

const CELL_STYLE: CSSProperties = { height: "var(--cell)", fontSize: "calc(var(--cell) * 0.55)" };

function emojiOf(id: SymbolId): string {
  return SLOT_SYMBOL_BY_ID[id].emoji;
}

function describeGrid(grid: SlotGrid): string {
  const rows = ROW_INDEXES.map((r) => `row ${r + 1} ${REEL_INDEXES.map((i) => emojiOf(grid[i][r])).join(" ")}`);
  return `Result: ${rows.join("; ")}`;
}

function linePoints(line: number): string {
  return SLOT_PAYLINES[line - 1]
    .map((row, reel) => `${reel * (VB_CELL + VB_GAP) + VB_CELL / 2},${row * VB_CELL + VB_CELL / 2}`)
    .join(" ");
}

export function SlotsGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();

  /** Destination grid of the current/last spin (INITIAL_GRID before the first spin). */
  const [grid, setGrid] = useState<SlotGrid>(INITIAL_GRID);
  /** Grid shown before the current spin (reduced motion keeps it until each reel stops). */
  const [prevGrid, setPrevGrid] = useState<SlotGrid>(INITIAL_GRID);
  /** Per-reel strips (previous column + filler + destination column) while spinning with motion. */
  const [strips, setStrips] = useState<readonly (readonly SymbolId[])[] | null>(null);
  const [phase, setPhase] = useState<Phase>("rest");
  const [stopped, setStopped] = useState<readonly boolean[]>(ALL_STOPPED);
  const [wins, setWins] = useState<readonly LineWin[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Place a bet and spin"));

  function onPlay() {
    if (!bet.valid || !lock.tryLock()) return;
    const reduced = reducedMotion;
    let ticket: Ticket | null;
    let next: SymbolId[][];
    let result: { wins: LineWin[]; totalTenths: number };
    let fillers: SymbolId[][] | null;
    try {
      next = spinGrid();
      result = evaluateLines(next);
      // Filler symbols are drawn here, in the click handler, never during render.
      fillers = reduced
        ? null
        : REEL_INDEXES.map((i) => Array.from({ length: 16 + 3 * i }, () => randomSlotSymbol()));
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, result.totalTenths, 10));
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

    const previous = grid;
    setNotice(null);
    setWins([]);
    setPrevGrid(previous);
    setGrid(next);
    setStopped(NONE_STOPPED);
    setBanner((b) => ({ kind: "pending", title: "Spinning…", round: b.round }));

    if (fillers) {
      const f = fillers;
      setStrips(REEL_INDEXES.map((i) => [...previous[i], ...f[i], ...next[i]]));
      // NIT 7: commit "arm" (translateY(0), no transition), then start the transition two frames later.
      setPhase("arm");
      timers.requestFrame(() => timers.requestFrame(() => setPhase("spin")));
    } else {
      setStrips(null);
      setPhase("rest");
    }

    for (const i of REEL_INDEXES) {
      timers.setTimeout(
        () => setStopped((s) => s.map((v, j) => (j === i ? true : v))),
        reduced ? REDUCED_STOP_STEP_MS * i : BASE_STOP_MS + STOP_STEP_MS * i,
      );
    }

    timers.setTimeout(
      () => {
        settle(ticket);
        setPhase("rest");
        setStrips(null);
        setStopped(ALL_STOPPED);
        setWins(result.wins);
        const n = result.wins.length;
        const multText = formatMultiplier(result.totalTenths, 10);
        setBanner((b) =>
          bannerFor({
            betCents: ticket.betCents,
            payoutCents: ticket.payoutCents,
            multiplierText: multText,
            round: b.round + 1,
            detail: n === 0 ? "No winning lines" : `${n} winning line${n === 1 ? "" : "s"}`,
          }),
        );
        history.add({
          id: ticket.id,
          label: n === 0 ? "🎰 No lines" : `🎰 ${n} line${n === 1 ? "" : "s"}`,
          multiplierText: multText,
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
        });
        lock.unlock();
      },
      reduced ? REDUCED_SETTLE_MS : SETTLE_MS,
    );
  }

  const spinning = lock.busy;
  const winCells = new Set<string>();
  for (const w of wins) for (const [reel, row] of w.cells) winCells.add(`${reel}-${row}`);
  const lineBet = bet.valid ? formatCredits(Math.floor(bet.parsed / SLOT_LINES)) : "—";

  function destCell(reel: number, row: number, symbol: SymbolId, isStopped: boolean, dim: boolean) {
    const win = winCells.has(`${reel}-${row}`);
    return (
      <div
        key={`d${row}`}
        data-testid="slot-cell"
        data-reel={reel}
        data-row={row}
        data-symbol={isStopped ? symbol : undefined}
        data-win={win ? "true" : undefined}
        aria-hidden="true"
        style={CELL_STYLE}
        className={`relative grid select-none place-items-center leading-none transition-opacity duration-[120ms] ${dim ? "opacity-40" : "opacity-100"} ${
          win ? "z-10 rounded-lg bg-amber-300/10 ring-2 ring-inset ring-amber-300 animate-win-glow" : ""
        }`}
      >
        {emojiOf(symbol)}
      </div>
    );
  }

  const reels = REEL_INDEXES.map((i) => {
    const isStopped = stopped[i];
    const strip = phase !== "rest" ? strips?.[i] : undefined;
    let content;
    let stripStyle: CSSProperties | undefined;
    if (strip) {
      const len = strip.length;
      const destStart = len - SLOT_ROWS;
      stripStyle =
        phase === "spin"
          ? {
              transform: `translateY(calc(-1 * var(--cell) * ${destStart}))`,
              transition: `transform ${BASE_STOP_MS + STOP_STEP_MS * i}ms cubic-bezier(.15,.85,.3,1)`,
            }
          : { transform: "translateY(0)", transition: "none" };
      content = strip.map((sym, k) =>
        k >= destStart ? (
          destCell(i, k - destStart, sym, isStopped, false)
        ) : (
          <div key={`f${k}`} aria-hidden="true" style={CELL_STYLE} className="grid select-none place-items-center leading-none">
            {emojiOf(sym)}
          </div>
        ),
      );
    } else {
      // At rest (or reduced motion): just the column. Reduced motion shows the previous
      // column dimmed until this reel's stop time, then fades in the new one.
      const showPrev = spinning && !isStopped;
      const column = showPrev ? prevGrid[i] : grid[i];
      content = ROW_INDEXES.map((r) => destCell(i, r, column[r], isStopped, showPrev));
    }
    return (
      <div
        key={i}
        data-testid="reel"
        data-reel={i}
        data-stopped={isStopped ? "true" : "false"}
        className="relative overflow-hidden rounded-lg bg-linear-to-b from-bg-800 via-bg-900 to-bg-800 shadow-[inset_0_0_0_1px_rgb(255_255_255/.08),inset_0_10px_18px_-8px_rgb(0_0_0/.8),inset_0_-10px_18px_-8px_rgb(0_0_0/.8)]"
        style={{ width: "var(--cell)", height: "calc(3 * var(--cell))" }}
      >
        <div style={stripStyle} className={phase === "spin" && !isStopped ? "blur-[0.5px]" : undefined}>
          {content}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/45 via-transparent to-black/45"
        />
      </div>
    );
  });

  const showWins = !spinning && wins.length > 0;

  const board = (
    <div className="mx-auto w-full max-w-xl">
      {/* Cabinet */}
      <div className="rounded-[1.75rem] bg-linear-to-b from-fuchsia-500/70 via-violet-500/40 to-fuchsia-500/70 p-[2px] shadow-glow-fuchsia">
        <div className="rounded-[calc(1.75rem-2px)] bg-bg-950/90 px-2 pb-4 pt-3 sm:px-4">
          {/* Marquee */}
          <div className="relative mx-auto mb-3 w-fit rounded-xl border border-fuchsia-400/40 bg-bg-900 px-5 py-1.5 shadow-[0_0_24px_-6px_rgb(217_70_239/.7)]">
            <div aria-hidden="true" className="absolute inset-x-2 -top-1 flex justify-between">
              {Array.from({ length: 8 }, (_, k) => (
                <span
                  key={k}
                  className={`size-1.5 rounded-full bg-amber-200 ${spinning ? "animate-bulb-blink" : ""}`}
                  style={spinning && k % 2 ? { animationDelay: "600ms" } : undefined}
                />
              ))}
            </div>
            <p className="bg-linear-to-r from-fuchsia-300 via-amber-200 to-sky-300 bg-clip-text font-display text-xl font-extrabold tracking-[0.3em] text-transparent sm:text-2xl">
              NEON SLOTS
            </p>
          </div>

          {/* Reel area (container query sizing) */}
          <div style={REEL_AREA_STYLE} className="rounded-2xl bg-black/40 shadow-[inset_0_2px_12px_rgb(0_0_0/.7)]">
            <div className="flex justify-center">
              <div className="relative flex" style={{ gap: "var(--gap)" }}>
                {reels}
                {showWins && (
                  <svg
                    aria-hidden="true"
                    viewBox={`0 0 ${VB_W} ${VB_H}`}
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 z-20 size-full"
                  >
                    {wins.map((w) => (
                      <polyline
                        key={w.line}
                        points={linePoints(w.line)}
                        fill="none"
                        stroke={LINE_COLORS[w.line - 1]}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        opacity={0.9}
                        style={{ filter: `drop-shadow(0 0 4px ${LINE_COLORS[w.line - 1]})` }}
                      />
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 px-1 text-xs text-ink-faint">
            <span>{SLOT_LINES} fixed lines</span>
            <span className="tabular-nums">Line bet {lineBet}</span>
          </div>
        </div>
      </div>

      <p className="sr-only">{spinning ? "Reels spinning" : describeGrid(grid)}</p>

      {showWins && (
        <ul aria-label="Winning lines" className="mt-4 flex flex-wrap justify-center gap-2">
          {wins.map((w) => (
            <li
              key={w.line}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm tabular-nums text-ink"
            >
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[w.line - 1] }} />
              {`Line ${w.line} · ${w.count}× ${emojiOf(w.symbol)} · ${formatMultiplier(w.tenths, 10)}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const controls = (
    <BetControls bet={bet} inputDisabled={lock.busy} primaryLabel={lock.busy ? "Spinning…" : "Spin"} onPrimary={onPlay}>
      <p className="text-xs text-ink-faint">Your bet is split evenly across all {SLOT_LINES} lines.</p>
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Slot reels"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
