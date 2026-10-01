// Mines: 5×5 grid, 1–24 mines, pure round reducer.
import { payoutFromMultiplier } from "../money";
import { cryptoRng, sampleWithoutReplacement, type Rng } from "../rng";

export const MINES_TILES = 25;
export const MINES_MIN = 1;
export const MINES_MAX = 24;
export const MINES_DEFAULT = 3;

/**
 * floor(99 · ∏_{i<k}(25−i) / ∏_{i<k}(25−m−i)) = 0.99 · C(25,k)/C(25−m,k) floored to 2 decimals, ×100.
 * Defined for 1 ≤ m ≤ 24 and 1 ≤ k ≤ 25 − m.
 */
export function minesMultiplierHundredths(m: number, k: number): number {
  if (!Number.isInteger(m) || m < MINES_MIN || m > MINES_MAX) {
    throw new RangeError("mines: mine count must be an integer from 1 to 24");
  }
  if (!Number.isInteger(k) || k < 1 || k > MINES_TILES - m) {
    throw new RangeError("mines: revealed count must be an integer from 1 to 25 − mines");
  }
  let num = BigInt(99);
  let den = BigInt(1);
  for (let i = 0; i < k; i++) {
    num *= BigInt(MINES_TILES - i);
    den *= BigInt(MINES_TILES - m - i);
  }
  return Number(num / den);
}

export type MinesPhase = "idle" | "playing" | "busted" | "cashed";

export interface Round {
  phase: MinesPhase;
  mineCount: number;
  betCents: number;
  mines: number[];
  /** Safe tiles revealed, in reveal order (a hit mine is in `hit`, not here). */
  revealed: number[];
  hit: number | null;
}

export type MinesAction =
  | { type: "start"; betCents: number; mineCount: number; mines: number[] }
  | { type: "reveal"; index: number }
  | { type: "cashout" };

export const INITIAL_MINES_ROUND: Round = {
  phase: "idle",
  mineCount: MINES_DEFAULT,
  betCents: 0,
  mines: [],
  revealed: [],
  hit: null,
};

function validateMines(mineCount: number, mines: readonly number[]): void {
  if (!Number.isInteger(mineCount) || mineCount < MINES_MIN || mineCount > MINES_MAX) {
    throw new RangeError("mines: mine count must be an integer from 1 to 24");
  }
  if (mines.length !== mineCount) throw new RangeError("mines: mines length must equal mine count");
  const seen = new Set<number>();
  for (const m of mines) {
    if (!Number.isInteger(m) || m < 0 || m >= MINES_TILES || seen.has(m)) {
      throw new RangeError("mines: mines must be distinct integers from 0 to 24");
    }
    seen.add(m);
  }
}

/** Ignored actions return the same object (reference-equal). */
export function minesReducer(round: Round, action: MinesAction): Round {
  switch (action.type) {
    case "start": {
      if (round.phase === "playing") return round;
      validateMines(action.mineCount, action.mines);
      return {
        phase: "playing",
        mineCount: action.mineCount,
        betCents: action.betCents,
        mines: action.mines.slice(),
        revealed: [],
        hit: null,
      };
    }
    case "reveal": {
      if (round.phase !== "playing") return round;
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index >= MINES_TILES) return round;
      if (round.revealed.includes(index)) return round;
      if (round.mines.includes(index)) return { ...round, phase: "busted", hit: index };
      const revealed = [...round.revealed, index];
      const phase = revealed.length === MINES_TILES - round.mineCount ? "cashed" : "playing";
      return { ...round, phase, revealed };
    }
    case "cashout": {
      if (round.phase !== "playing" || round.revealed.length === 0) return round;
      return { ...round, phase: "cashed" };
    }
  }
}

/** Current multiplier ×100, or null when no safe tile is revealed. */
export function currentMultiplier(round: Round): number | null {
  const k = round.revealed.length;
  return k === 0 ? null : minesMultiplierHundredths(round.mineCount, k);
}

/** Multiplier ×100 after one more safe tile, or null when no safe tiles remain. */
export function nextMultiplier(round: Round): number | null {
  const k = round.revealed.length;
  if (k >= MINES_TILES - round.mineCount) return null;
  return minesMultiplierHundredths(round.mineCount, k + 1);
}

/** Cash-out value in cents: 0 when nothing is revealed or the round is busted. */
export function cashoutCents(round: Round): number {
  if (round.phase === "busted") return 0;
  const m = currentMultiplier(round);
  return m === null ? 0 : payoutFromMultiplier(round.betCents, m, 100);
}

export function safeTilesLeft(round: Round): number {
  return MINES_TILES - round.mineCount - round.revealed.length;
}

export const MINES_ALL_TILES: readonly number[] = Array.from({ length: MINES_TILES }, (_, i) => i);

export function placeMines(m: number, rng: Rng = cryptoRng): number[] {
  if (!Number.isInteger(m) || m < MINES_MIN || m > MINES_MAX) {
    throw new RangeError("mines: mine count must be an integer from 1 to 24");
  }
  return sampleWithoutReplacement(MINES_ALL_TILES, m, rng);
}
