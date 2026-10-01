// Scratch Card: 3×3, any three identical symbols win that symbol's prize. Prize is decided first.
import { cryptoRng, randomInt, shuffle, type Rng } from "../rng";

export type ScratchSymbol = "diamond" | "crown" | "clover" | "star" | "bell" | "cherry";

export const SCRATCH_SYMBOLS: readonly ScratchSymbol[] = ["diamond", "crown", "clover", "star", "bell", "cherry"];

export const SCRATCH_EMOJI: Readonly<Record<ScratchSymbol, string>> = {
  diamond: "💎",
  crown: "👑",
  clover: "🍀",
  star: "⭐",
  bell: "🔔",
  cherry: "🍒",
};

export const SCRATCH_NAMES: Readonly<Record<ScratchSymbol, string>> = {
  diamond: "Diamond",
  crown: "Crown",
  clover: "Clover",
  star: "Star",
  bell: "Bell",
  cherry: "Cherry",
};

// | Symbol | Prize | Probability |
// | 💎 diamond | 100x | 0.1% |
// | 👑 crown | 20x | 0.5% |
// | 🍀 clover | 10x | 1.5% |
// | ⭐ star | 5x | 3% |
// | 🔔 bell | 2x | 8% |
// | 🍒 cherry | 1x ("Money back") | 30% |
// | (none) | lose | 56.9% |
export const SCRATCH_PRIZES_X100 = { diamond: 10000, crown: 2000, clover: 1000, star: 500, bell: 200, cherry: 100 } as const;

/** Odds per 1,000,000 cards (randomInt(0, 999_999) against cumulative thresholds). */
export const SCRATCH_ODDS_PPM = { diamond: 1_000, crown: 5_000, clover: 15_000, star: 30_000, bell: 80_000, cherry: 300_000 } as const;
export const SCRATCH_LOSE_PPM = 569_000;

/** Cumulative upper bounds (exclusive) in SCRATCH_SYMBOLS order; a draw ≥ the last one loses. */
export const SCRATCH_THRESHOLDS: readonly { symbol: ScratchSymbol; below: number }[] = (() => {
  let cum = 0;
  return SCRATCH_SYMBOLS.map((symbol) => {
    cum += SCRATCH_ODDS_PPM[symbol];
    return { symbol, below: cum };
  });
})();

export interface ScratchCard {
  cells: ScratchSymbol[];
  prize: ScratchSymbol | null;
  winningCells: number[];
}

export function drawScratchPrize(rng: Rng = cryptoRng): ScratchSymbol | null {
  const r = randomInt(0, 999_999, rng);
  for (const t of SCRATCH_THRESHOLDS) if (r < t.below) return t.symbol;
  return null;
}

export function generateCard(rng: Rng = cryptoRng): ScratchCard {
  const prize = drawScratchPrize(rng);
  let cells: ScratchSymbol[];
  if (prize === null) {
    const pool = SCRATCH_SYMBOLS.flatMap((s) => [s, s]);
    cells = shuffle(pool, rng).slice(0, 9);
  } else {
    const others = SCRATCH_SYMBOLS.filter((s) => s !== prize).flatMap((s) => [s, s]);
    cells = shuffle([prize, prize, prize, ...shuffle(others, rng).slice(0, 6)], rng);
  }
  const winningCells = prize === null ? [] : cells.flatMap((s, i) => (s === prize ? [i] : []));
  return { cells, prize, winningCells };
}

/** Recomputes the prize from the cells: the symbol appearing ≥ 3 times, or null. */
export function evaluateCard(cells: readonly ScratchSymbol[]): ScratchSymbol | null {
  const counts = new Map<ScratchSymbol, number>();
  for (const s of cells) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const s of SCRATCH_SYMBOLS) if ((counts.get(s) ?? 0) >= 3) return s;
  return null;
}

/**
 * Fraction of a `lattice`×`lattice` sample grid whose alpha is < 128 (cleared).
 * `alpha` is either ImageData.data (RGBA, length w·h·4) or a single-channel buffer (length w·h).
 */
export function coverageFraction(alpha: Uint8ClampedArray, width: number, height: number, lattice = 24): number {
  if (width <= 0 || height <= 0 || lattice <= 0) return 0;
  const stride = alpha.length === width * height ? 1 : 4;
  const channel = stride === 4 ? 3 : 0;
  let cleared = 0;
  for (let iy = 0; iy < lattice; iy++) {
    const y = Math.min(height - 1, Math.floor(((iy + 0.5) * height) / lattice));
    for (let ix = 0; ix < lattice; ix++) {
      const x = Math.min(width - 1, Math.floor(((ix + 0.5) * width) / lattice));
      if (alpha[(y * width + x) * stride + channel] < 128) cleared++;
    }
  }
  return cleared / (lattice * lattice);
}
