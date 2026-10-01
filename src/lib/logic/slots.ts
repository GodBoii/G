// Neon Slots: 5 reels × 3 rows, 10 fixed paylines, every cell drawn independently.
import { cryptoRng, weightedIndex, type Rng } from "../rng";

export type SymbolId = "cherry" | "lemon" | "grape" | "bell" | "star" | "diamond" | "seven";

export interface SlotSymbol {
  id: SymbolId;
  emoji: string;
  name: string;
  /** Out of a total of 100. */
  weight: number;
  /** Payout for [3, 4, 5] in a row, in tenths of the TOTAL bet (= units of line bet). */
  payTenths: readonly [number, number, number];
}

// | Symbol | id | weight | 3 in a row | 4 in a row | 5 in a row |
// | 🍒 | cherry | 30 | 0.4x | 2x | 5x |
// | 🍋 | lemon | 24 | 1x | 3x | 10x |
// | 🍇 | grape | 18 | 2x | 6x | 20x |
// | 🔔 | bell | 12 | 4x | 15x | 50x |
// | ⭐ | star | 8 | 10x | 40x | 150x |
// | 💎 | diamond | 5 | 20x | 100x | 400x |
// | 7️⃣ | seven | 3 | 50x | 250x | 1000x |
export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { id: "cherry", emoji: "🍒", name: "Cherry", weight: 30, payTenths: [4, 20, 50] },
  { id: "lemon", emoji: "🍋", name: "Lemon", weight: 24, payTenths: [10, 30, 100] },
  { id: "grape", emoji: "🍇", name: "Grape", weight: 18, payTenths: [20, 60, 200] },
  { id: "bell", emoji: "🔔", name: "Bell", weight: 12, payTenths: [40, 150, 500] },
  { id: "star", emoji: "⭐", name: "Star", weight: 8, payTenths: [100, 400, 1500] },
  { id: "diamond", emoji: "💎", name: "Diamond", weight: 5, payTenths: [200, 1000, 4000] },
  { id: "seven", emoji: "7️⃣", name: "Seven", weight: 3, payTenths: [500, 2500, 10000] },
];

export const SLOT_WEIGHTS: readonly number[] = SLOT_SYMBOLS.map((s) => s.weight);

export const SLOT_SYMBOL_BY_ID: Readonly<Record<SymbolId, SlotSymbol>> = Object.fromEntries(
  SLOT_SYMBOLS.map((s) => [s.id, s]),
) as Record<SymbolId, SlotSymbol>;

export const SLOT_REELS = 5;
export const SLOT_ROWS = 3;
export const SLOT_LINES = 10;

/** Row index per reel (0 = top). Line number = index + 1. */
export const SLOT_PAYLINES = [
  [1, 1, 1, 1, 1], // 1
  [0, 0, 0, 0, 0], // 2
  [2, 2, 2, 2, 2], // 3
  [0, 1, 2, 1, 0], // 4
  [2, 1, 0, 1, 2], // 5
  [0, 0, 1, 2, 2], // 6
  [2, 2, 1, 0, 0], // 7
  [1, 0, 0, 0, 1], // 8
  [1, 2, 2, 2, 1], // 9
  [1, 0, 1, 2, 1], // 10
] as const;

/** Grid indexed [reel][row]. */
export type SlotGrid = readonly (readonly SymbolId[])[];

/** Fixed pre-spin grid with no winning line (deterministic SSR/first render). */
export const INITIAL_GRID: SlotGrid = [
  ["cherry", "bell", "grape"],
  ["lemon", "star", "cherry"],
  ["grape", "seven", "lemon"],
  ["bell", "diamond", "star"],
  ["star", "cherry", "bell"],
];

export function randomSlotSymbol(rng: Rng = cryptoRng): SymbolId {
  return SLOT_SYMBOLS[weightedIndex(SLOT_WEIGHTS, rng)].id;
}

export function spinGrid(rng: Rng = cryptoRng): SymbolId[][] {
  const grid: SymbolId[][] = [];
  for (let reel = 0; reel < SLOT_REELS; reel++) {
    const col: SymbolId[] = [];
    for (let row = 0; row < SLOT_ROWS; row++) col.push(randomSlotSymbol(rng));
    grid.push(col);
  }
  return grid;
}

export interface LineWin {
  /** 1-based payline number. */
  line: number;
  symbol: SymbolId;
  count: 3 | 4 | 5;
  tenths: number;
  /** [reel, row] of each matching cell. */
  cells: [number, number][];
}

export function evaluateLines(grid: SlotGrid): { wins: LineWin[]; totalTenths: number } {
  const wins: LineWin[] = [];
  let totalTenths = 0;
  SLOT_PAYLINES.forEach((rows, i) => {
    const symbol = grid[0][rows[0]];
    let count = 1;
    while (count < SLOT_REELS && grid[count][rows[count]] === symbol) count++;
    if (count < 3) return;
    const c = count as 3 | 4 | 5;
    const tenths = SLOT_SYMBOL_BY_ID[symbol].payTenths[c - 3];
    const cells: [number, number][] = [];
    for (let reel = 0; reel < c; reel++) cells.push([reel, rows[reel]]);
    wins.push({ line: i + 1, symbol, count: c, tenths, cells });
    totalTenths += tenths;
  });
  return { wins, totalTenths };
}
