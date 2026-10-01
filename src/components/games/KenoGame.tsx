"use client";

import { useRef, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { Button } from "@/components/ui/Button";
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
  KENO_ALL_NUMBERS,
  KENO_DRAWS,
  KENO_MAX_PICKS,
  KENO_PAYTABLE,
  countHits,
  drawKeno,
  kenoMultiplierX100,
  type KenoPicks,
} from "@/lib/logic/keno";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage, sampleWithoutReplacement } from "@/lib/rng";

const REVEAL_MS = 220;
const REDUCED_REVEAL_MS = 40;
const SETTLE_AFTER_LAST_MS = 250;
const CAP_NOTE_MS = 2000;

type CellState = "idle" | "picked" | "hit" | "miss" | "drawn";

interface Draw {
  numbers: number[];
  /** How many of `numbers` are revealed so far (draw order). */
  revealed: number;
  settled: boolean;
}

const CELL_STYLES: Record<CellState, string> = {
  idle: "border-white/10 bg-white/5 text-ink enabled:hover:border-white/25 enabled:hover:bg-white/10",
  picked: "border-fuchsia-300/40 bg-linear-to-br from-fuchsia-600 to-violet-600 text-white shadow-glow-fuchsia",
  hit: "border-emerald-200 bg-emerald-400 text-bg-950 animate-win-glow",
  miss: "border-2 border-fuchsia-400/70 bg-transparent text-fuchsia-200/80 opacity-70",
  drawn: "border-slate-500/60 bg-slate-700 text-ink",
};

const STATE_LABEL: Record<CellState, string> = {
  idle: "",
  picked: ", picked",
  hit: ", picked, hit",
  miss: ", picked, not drawn",
  drawn: ", drawn",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function KenoGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();

  /** Picked numbers, ascending. */
  const [picks, setPicks] = useState<number[]>([]);
  const [draw, setDraw] = useState<Draw | null>(null);
  /** Paytable row to highlight after settlement. */
  const [matched, setMatched] = useState<{ picks: number; hits: number } | null>(null);
  const [capNote, setCapNote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Pick 1–10 numbers and play"));
  const boardRef = useRef<HTMLDivElement>(null);
  // Bumped on every rejected 11th pick so only the latest note timer hides it.
  const capToken = useRef(0);

  const busy = lock.busy;
  const pickSet = new Set(picks);
  const revealedSet = new Set(draw ? draw.numbers.slice(0, draw.revealed) : []);

  function cellState(n: number): CellState {
    const picked = pickSet.has(n);
    if (revealedSet.has(n)) return picked ? "hit" : "drawn";
    if (picked) return draw?.settled ? "miss" : "picked";
    return "idle";
  }

  function clearDraw() {
    setDraw(null);
    setMatched(null);
  }

  function rejectPick() {
    const token = ++capToken.current;
    setCapNote(true);
    timers.setTimeout(() => {
      if (capToken.current === token) setCapNote(false);
    }, CAP_NOTE_MS);
    if (!reducedMotion) {
      boardRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-in-out" },
      );
    }
  }

  function togglePick(n: number) {
    if (busy) return;
    if (pickSet.has(n)) {
      setPicks(picks.filter((p) => p !== n));
      clearDraw();
      return;
    }
    if (picks.length >= KENO_MAX_PICKS) {
      rejectPick();
      return;
    }
    setPicks([...picks, n].sort((a, b) => a - b));
    clearDraw();
  }

  function onQuickPick() {
    if (busy) return;
    const count = picks.length || KENO_MAX_PICKS;
    let next: number[];
    try {
      next = sampleWithoutReplacement(KENO_ALL_NUMBERS, count);
    } catch (e) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(e), round: b.round }));
      console.error(e);
      return;
    }
    setPicks(next.sort((a, b) => a - b));
    clearDraw();
  }

  function onClear() {
    if (busy) return;
    setPicks([]);
    clearDraw();
  }

  function onPlay() {
    if (!bet.valid || picks.length === 0 || !lock.tryLock()) return;
    const reduced = reducedMotion;
    const chosen = picks;
    let ticket: Ticket | null;
    let numbers: number[];
    let hits: number;
    let multX100: number;
    try {
      numbers = drawKeno();
      hits = countHits(chosen, numbers);
      multX100 = kenoMultiplierX100(chosen.length, hits);
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, multX100, 100));
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
    setMatched(null);
    setDraw({ numbers, revealed: 0, settled: false });
    setBanner((b) => ({ kind: "pending", title: "Drawing…", round: b.round }));

    const step = reduced ? REDUCED_REVEAL_MS : REVEAL_MS;
    for (let i = 1; i <= KENO_DRAWS; i++) {
      timers.setTimeout(() => {
        setDraw((d) => (d && d.numbers === numbers ? { ...d, revealed: i } : d));
      }, step * i);
    }

    timers.setTimeout(() => {
      settle(ticket);
      setDraw({ numbers, revealed: KENO_DRAWS, settled: true });
      setMatched({ picks: chosen.length, hits });
      const multText = formatMultiplier(multX100, 100);
      setBanner((b) =>
        bannerFor({
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
          multiplierText: multText,
          round: b.round + 1,
          detail: `${plural(hits, "hit")} from ${plural(chosen.length, "pick")}`,
        }),
      );
      history.add({
        id: ticket.id,
        label: `🔢 ${hits}/${chosen.length}`,
        multiplierText: multText,
        betCents: ticket.betCents,
        payoutCents: ticket.payoutCents,
      });
      lock.unlock();
    }, step * KENO_DRAWS + SETTLE_AFTER_LAST_MS);
  }

  const pickCount = picks.length;
  const paytable = pickCount > 0 ? KENO_PAYTABLE[pickCount as KenoPicks] : null;
  const hitsSoFar = draw ? countHits(picks, draw.numbers.slice(0, draw.revealed)) : 0;
  const maxMultX100 = paytable ? paytable[paytable.length - 1] : 0;
  const potential = bet.valid && paytable ? formatCredits(payoutFromMultiplier(bet.parsed, maxMultX100, 100)) : "—";

  const board = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-ink-muted">
          Picks <span className="font-display text-lg font-bold tabular-nums text-ink">{pickCount}</span>
          <span className="text-ink-faint">/{KENO_MAX_PICKS}</span>
        </p>
        <p className="tabular-nums text-ink-muted" aria-live="off">
          {draw ? (
            <>
              Drawn: <span className="font-semibold text-ink">{draw.revealed}/{KENO_DRAWS}</span>
              <span className="mx-2 text-ink-faint">·</span>
              Hits: <span className="font-semibold text-emerald-300">{hitsSoFar}</span>
            </>
          ) : (
            <span className="text-ink-faint">10 numbers are drawn from 40</span>
          )}
        </p>
      </div>

      <div ref={boardRef} role="group" aria-label="Keno numbers" className="mx-auto grid w-full max-w-2xl grid-cols-8 gap-1.5 sm:gap-2">
        {KENO_ALL_NUMBERS.map((n) => {
          const state = cellState(n);
          const picked = pickSet.has(n);
          return (
            <button
              key={n}
              type="button"
              data-testid="keno-cell"
              data-number={n}
              data-state={state}
              aria-pressed={picked}
              aria-label={`Number ${n}${STATE_LABEL[state]}`}
              disabled={busy}
              onClick={() => togglePick(n)}
              className={`relative grid aspect-square min-w-0 place-items-center rounded-lg border font-display text-sm font-bold tabular-nums transition-[background-color,border-color,color,transform] duration-200 active:scale-95 disabled:cursor-not-allowed sm:rounded-xl sm:text-lg ${CELL_STYLES[state]}`}
            >
              {n}
              {state === "hit" && (
                <span aria-hidden="true" className="absolute -right-1 -top-1.5 text-[0.7rem] drop-shadow sm:text-sm">
                  💎
                </span>
              )}
              {state === "drawn" && (
                <span aria-hidden="true" className="absolute bottom-0.5 size-1 rounded-full bg-slate-300 sm:bottom-1.5 sm:size-1.5" />
              )}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Cell legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded bg-linear-to-br from-fuchsia-600 to-violet-600" /> Picked
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded bg-emerald-400" /> Hit 💎
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="relative size-3 rounded bg-slate-700">
            <span className="absolute inset-0 m-auto size-1 rounded-full bg-slate-300" />
          </span>{" "}
          Drawn
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded border-2 border-fuchsia-400/70" /> Missed pick
        </li>
      </ul>
    </div>
  );

  const controls = (
    <div className="flex flex-col gap-5">
      <BetControls
        bet={bet}
        inputDisabled={lock.busy}
        primaryDisabled={lock.busy || !bet.valid || picks.length === 0}
        primaryLabel={lock.busy ? "Drawing…" : pickCount === 0 ? "Pick numbers to play" : "Play"}
        onPrimary={onPlay}
        potentialPayout={potential}
      >
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onQuickPick} disabled={busy}>
            🎲 Quick pick
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={busy || pickCount === 0}>
            Clear
          </Button>
        </div>
        <p role="status" className="min-h-5 text-sm text-amber-200">
          {capNote ? "Maximum 10 picks" : ""}
        </p>
        {notice && (
          <p role="alert" className="text-sm text-rose-300">
            {notice}
          </p>
        )}
      </BetControls>

      <div>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Paytable{pickCount > 0 ? ` · ${plural(pickCount, "pick")}` : ""}
        </h2>
        {paytable ? (
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="px-2 py-1 font-medium">Hits</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">Pays</th>
              </tr>
            </thead>
            <tbody>
              {paytable.map((x100, h) => {
                const active = matched !== null && matched.picks === pickCount && matched.hits === h;
                return (
                  <tr
                    key={h}
                    aria-current={active ? "true" : undefined}
                    className={`border-t border-white/5 ${
                      active ? (x100 > 0 ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-ink") : x100 > 0 ? "text-ink" : "text-ink-faint"
                    }`}
                  >
                    <td className="px-2 py-1">
                      {active && <span aria-hidden="true">▶ </span>}
                      {h}
                    </td>
                    <td className="px-2 py-1 text-right font-semibold">{formatMultiplier(x100, 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">Pick numbers to see what each hit count pays.</p>
        )}
      </div>
    </div>
  );

  return (
    <GameLayout
      boardLabel="Keno board"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
