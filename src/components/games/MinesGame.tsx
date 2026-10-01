"use client";

import { useId, useRef, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { Button } from "@/components/ui/Button";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { StatTile } from "@/components/ui/StatTile";
import { useWallet } from "@/context/WalletContext";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useTimers } from "@/hooks/useTimers";
import {
  INITIAL_MINES_ROUND,
  MINES_ALL_TILES,
  MINES_DEFAULT,
  MINES_MAX,
  MINES_MIN,
  MINES_TILES,
  cashoutCents,
  currentMultiplier,
  minesMultiplierHundredths,
  minesReducer,
  nextMultiplier,
  placeMines,
  safeTilesLeft,
  type Round,
} from "@/lib/logic/mines";
import { formatCredits, formatMultiplier } from "@/lib/money";
import { playErrorMessage, randomInt } from "@/lib/rng";

const END_COOLDOWN_MS = 500;
const MINE_CHIPS = [1, 3, 5, 10, 24] as const;
const MINE_OPTIONS = Array.from({ length: MINES_MAX - MINES_MIN + 1 }, (_, i) => i + MINES_MIN);

type TileState = "hidden" | "gem" | "mine";

// Mines does not use useSettlement, so history ids come from a local counter.
let nextMinesRoundId = 1;

function tilePosition(index: number): { row: number; col: number } {
  return { row: Math.floor(index / 5) + 1, col: (index % 5) + 1 };
}

export function MinesGame() {
  const wallet = useWallet();
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const history = useHistory();
  const selectId = useId();

  // Authoritative round lives in the ref (mutated only in handlers); `round` mirrors it for render.
  const roundRef = useRef<Round>(INITIAL_MINES_ROUND);
  const [round, setRound] = useState<Round>(INITIAL_MINES_ROUND);
  const [mineCount, setMineCount] = useState(MINES_DEFAULT);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Choose your mines and press Start"));

  function commit(next: Round) {
    roundRef.current = next;
    setRound(next);
  }

  /** Banner, history and the 500 ms end-of-round cooldown (keeps a double click from starting a new round). */
  function endRound(next: Round) {
    const busted = next.phase === "busted";
    const k = next.revealed.length;
    const payoutCents = cashoutCents(next);
    const multH = busted ? 0 : (currentMultiplier(next) ?? 0);
    const multText = formatMultiplier(multH, 100);
    let detail: string;
    if (busted && next.hit !== null) {
      const { row, col } = tilePosition(next.hit);
      detail = `Hit a mine on tile row ${row} column ${col}`;
    } else {
      detail = `Cashed out after ${k} ${k === 1 ? "gem" : "gems"}`;
    }
    setBanner((b) =>
      bannerFor({ betCents: next.betCents, payoutCents, multiplierText: multText, round: b.round + 1, detail }),
    );
    history.add({
      id: nextMinesRoundId++,
      label: busted ? `💥 ${next.mineCount}m` : `💎 ${k} · ${next.mineCount}m`,
      multiplierText: multText,
      betCents: next.betCents,
      payoutCents,
    });
    lock.tryLock();
    timers.setTimeout(() => lock.unlock(), END_COOLDOWN_MS);
  }

  function onStart() {
    if (!bet.valid) return;
    // 1. Synchronous double-click guard.
    if (!lock.tryLock()) return;
    // 2. Phase guard BEFORE any side effect (the wallet is untouched if a round is live).
    if (roundRef.current.phase === "playing") {
      lock.unlock();
      return;
    }
    const betCents = bet.parsed;
    const count = mineCount;
    // 3. Draw the mines before taking the bet, so an RNG failure never costs credits.
    let mines: number[];
    try {
      mines = placeMines(count);
    } catch (e) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(e), round: b.round }));
      console.error(e);
      lock.unlock();
      return;
    }
    // 4. Take the bet.
    if (!wallet.placeBet(betCents)) {
      setNotice("Not enough credits");
      lock.unlock();
      return;
    }
    // 5. Start the round (ref first, synchronously).
    commit(minesReducer(roundRef.current, { type: "start", betCents, mineCount: count, mines }));
    setNotice(null);
    setBanner((b) => ({ kind: "pending", title: "Pick a tile…", round: b.round }));
    // 6.
    lock.unlock();
  }

  function onReveal(index: number) {
    const prev = roundRef.current;
    const next = minesReducer(prev, { type: "reveal", index });
    if (next === prev) return;
    commit(next);
    if (next.phase === "cashed") {
      wallet.credit(cashoutCents(next));
      endRound(next);
    } else if (next.phase === "busted") {
      endRound(next);
    }
  }

  function onCashOut() {
    const prev = roundRef.current;
    const next = minesReducer(prev, { type: "cashout" });
    if (next === prev) return;
    commit(next);
    wallet.credit(cashoutCents(next));
    endRound(next);
  }

  function onPrimary() {
    if (roundRef.current.phase === "playing") return onCashOut(); // button reads "Cash out" while playing
    return onStart();
  }

  function onRandomTile() {
    const r = roundRef.current;
    if (r.phase !== "playing") return;
    const hidden = MINES_ALL_TILES.filter((i) => !r.revealed.includes(i));
    if (hidden.length === 0) return;
    let index: number;
    try {
      index = hidden[randomInt(0, hidden.length - 1)];
    } catch (e) {
      console.error(e);
      return;
    }
    onReveal(index);
  }

  const phase = round.phase;
  const playing = phase === "playing";
  const ended = phase === "busted" || phase === "cashed";
  const k = round.revealed.length;
  const cashout = cashoutCents(round);
  const revealedSet = new Set(round.revealed);
  const mineSet = new Set(round.mines);

  const currentH = playing || phase === "cashed" ? currentMultiplier(round) : null;
  const nextH = playing ? nextMultiplier(round) : ended ? null : minesMultiplierHundredths(mineCount, 1);
  const safeLeft = playing ? safeTilesLeft(round) : ended ? safeTilesLeft(round) : MINES_TILES - mineCount;

  function tileState(i: number): TileState {
    if (revealedSet.has(i)) return "gem";
    if (round.hit === i) return "mine";
    if (ended) return mineSet.has(i) ? "mine" : "gem";
    return "hidden";
  }

  const board = (
    <div className="flex flex-col items-center gap-4">
      <div
        data-testid="mines-phase"
        data-phase={phase}
        className={`w-full max-w-[28rem] rounded-2xl p-2 transition-shadow sm:p-3 ${
          phase === "cashed" ? "shadow-glow-emerald" : phase === "busted" ? "shadow-[0_0_28px_-4px_rgb(251_113_133/.55)]" : ""
        }`}
      >
        <div role="group" aria-label="Mines board" className="grid grid-cols-5 gap-2 sm:gap-2.5">
          {MINES_ALL_TILES.map((i) => {
            const state = tileState(i);
            const { row, col } = tilePosition(i);
            const isHit = round.hit === i;
            const byPlayer = revealedSet.has(i) || isHit;
            const dim = ended && !byPlayer;
            const clickable = playing && state === "hidden";
            let look: string;
            if (state === "hidden") {
              look =
                "border-white/10 bg-linear-to-b from-bg-700 to-bg-800 shadow-[inset_0_1px_0_rgb(255_255_255/.08)] enabled:hover:-translate-y-0.5 enabled:hover:border-fuchsia-400/50 enabled:hover:shadow-glow-fuchsia";
            } else if (state === "gem") {
              look = `border-emerald-300/60 bg-emerald-500/20 ${byPlayer ? "shadow-glow-emerald" : ""}`;
            } else if (isHit) {
              look = "border-rose-300 bg-rose-500/80 animate-shake";
            } else {
              look = "border-rose-400/40 bg-rose-500/15";
            }
            return (
              <button
                key={i}
                type="button"
                data-testid="mine-tile"
                data-index={i}
                data-state={state}
                aria-label={`Tile row ${row} column ${col}, ${state}`}
                disabled={!clickable}
                onClick={() => onReveal(i)}
                className={`grid aspect-square min-w-0 place-items-center rounded-xl border text-2xl transition-[transform,box-shadow,border-color] duration-150 disabled:cursor-default sm:text-3xl ${look} ${
                  dim ? "opacity-40" : ""
                } ${playing && state === "hidden" ? "cursor-pointer" : ""}`}
              >
                {state !== "hidden" && (
                  <span
                    aria-hidden="true"
                    className={byPlayer ? "motion-safe:animate-[tile-flip_250ms_ease-out]" : ""}
                  >
                    {state === "gem" ? "💎" : isHit ? "💥" : "💣"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="max-w-md text-center text-xs text-ink-faint">
        Leaving or reloading the page during a round forfeits your bet.
      </p>
    </div>
  );

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={phase === "playing" || lock.busy}
      primaryDisabled={phase === "playing" ? k === 0 || lock.busy : !bet.valid || lock.busy}
      primaryLabel={phase === "playing" ? `Cash out ${formatCredits(cashout)}` : "Start"}
      primaryVariant={phase === "playing" ? "success" : "primary"}
      onPrimary={onPrimary}
    >
      <div>
        <label htmlFor={selectId} className="text-sm font-medium text-ink-muted">
          Mines
        </label>
        <div className="mt-1.5 flex gap-2">
          <select
            id={selectId}
            value={mineCount}
            disabled={playing}
            onChange={(e) => setMineCount(Number(e.target.value))}
            className="h-11 w-20 shrink-0 rounded-xl border border-white/10 bg-bg-950/70 px-3 font-semibold tabular-nums text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {MINE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Quick mine count" className="grid min-w-0 flex-1 grid-cols-5 gap-1">
            {MINE_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mineCount === m}
                disabled={playing}
                onClick={() => setMineCount(m)}
                className={`h-11 min-w-0 rounded-lg text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  mineCount === m
                    ? "bg-linear-to-r from-fuchsia-600 to-violet-600 text-white"
                    : "border border-white/10 bg-white/5 text-ink-muted enabled:hover:bg-white/10 enabled:hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Multiplier" value={currentH !== null ? formatMultiplier(currentH, 100) : "—"} tone="gold" testId="mines-multiplier" />
        <StatTile label="Next tile" value={nextH !== null ? formatMultiplier(nextH, 100) : "—"} testId="mines-next" />
        <StatTile
          label="Cash-out value"
          value={playing ? formatCredits(cashout) : "—"}
          tone={playing && k > 0 ? "win" : "default"}
          testId="mines-cashout"
        />
        <StatTile label="Safe tiles left" value={safeLeft} testId="mines-safe-left" />
      </div>

      <Button onClick={onRandomTile} disabled={!playing} block>
        🎲 Random tile
      </Button>

      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Mines game"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
