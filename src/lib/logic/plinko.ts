// Plinko: deterministic path animation. `rows` fair left/right steps; bucket = number of right steps.
import { cryptoRng, randomInt, type Rng } from "../rng";

export type PlinkoRows = 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export type PlinkoRisk = "low" | "medium" | "high";

export const PLINKO_ROWS: readonly PlinkoRows[] = [8, 9, 10, 11, 12, 13, 14, 15, 16];
export const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"];
export const PLINKO_DEFAULT_ROWS: PlinkoRows = 12;
export const PLINKO_DEFAULT_RISK: PlinkoRisk = "medium";

/** Bucket multipliers, index 0 = left edge. Symmetric, length rows + 1. */
export const PLINKO_TABLES: Record<PlinkoRows, Record<PlinkoRisk, readonly number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  9: {
    low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  },
  10: {
    low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  },
  11: {
    low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    high: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  13: {
    low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
  },
  14: {
    low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
  },
  15: {
    low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

/** PLINKO_TABLES as integer multipliers ×10 (Math.round(v·10)). */
export const PLINKO_X10: Record<PlinkoRows, Record<PlinkoRisk, readonly number[]>> = (() => {
  const out = {} as Record<PlinkoRows, Record<PlinkoRisk, readonly number[]>>;
  for (const rows of PLINKO_ROWS) {
    out[rows] = {
      low: PLINKO_TABLES[rows].low.map((v) => Math.round(v * 10)),
      medium: PLINKO_TABLES[rows].medium.map((v) => Math.round(v * 10)),
      high: PLINKO_TABLES[rows].high.map((v) => Math.round(v * 10)),
    };
  }
  return out;
})();

export function dropBall(rows: PlinkoRows, rng: Rng = cryptoRng): { path: (0 | 1)[]; bucket: number } {
  const path: (0 | 1)[] = [];
  let bucket = 0;
  for (let i = 0; i < rows; i++) {
    const step = randomInt(0, 1, rng) as 0 | 1;
    path.push(step);
    bucket += step;
  }
  return { path, bucket };
}

export function plinkoMultiplierX10(rows: PlinkoRows, risk: PlinkoRisk, bucket: number): number {
  const table = PLINKO_X10[rows]?.[risk];
  if (!table) throw new RangeError("plinko: unknown rows/risk");
  if (!Number.isInteger(bucket) || bucket < 0 || bucket >= table.length) {
    throw new RangeError("plinko: bucket out of range");
  }
  return table[bucket];
}

export interface PlinkoLayout {
  rows: number;
  width: number;
  height: number;
  /** Horizontal peg spacing = bucket width. */
  s: number;
  cx: number;
  pegR: number;
  ballR: number;
  rowY(r: number): number;
  pegs: { x: number; y: number }[];
  bucketX(k: number): number;
}

/** Board geometry in CSS pixels. */
export function plinkoLayout(rows: number, width: number): PlinkoLayout {
  const s = width / (rows + 2);
  const cx = width / 2;
  const height = width * 0.9;
  const rowY = (r: number) => s * 0.8 + (r * (height - 1.6 * s)) / (rows - 1);
  const pegs: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < r + 3; j++) pegs.push({ x: cx + (j - (r + 2) / 2) * s, y: rowY(r) });
  }
  return {
    rows,
    width,
    height,
    s,
    cx,
    pegR: s * 0.12,
    ballR: s * 0.22,
    rowY,
    pegs,
    bucketX: (k: number) => cx + (k - rows / 2) * s,
  };
}

/**
 * Ball position at progress t ∈ [0, 1] along `path`. There are rows + 1 equal segments:
 * an entry fall from above the board onto the first peg, then one hop per row, ending
 * directly above the bucket. x is linear within a segment; y adds a parabolic hop.
 */
export function ballPosition(path: readonly (0 | 1)[], t: number, layout: PlinkoLayout): { x: number; y: number } {
  const rows = path.length;
  const { cx, s, pegR, ballR, height } = layout;
  const keyframes: { x: number; y: number }[] = [];
  let right = 0;
  for (let i = 0; i < rows; i++) {
    keyframes.push({ x: cx + (right - i / 2) * s, y: layout.rowY(i) - (pegR + ballR) });
    right += path[i];
  }
  keyframes.push({ x: layout.bucketX(right), y: height - ballR });

  const clamped = Math.min(1, Math.max(0, t));
  if (clamped >= 1) return keyframes[rows];
  const segments = rows + 1;
  const pos = clamped * segments;
  const seg = Math.floor(pos);
  const u = pos - seg;
  if (seg === 0) {
    // Entry: fall straight down onto the first peg.
    const k0 = keyframes[0];
    return { x: k0.x, y: -ballR + (k0.y + ballR) * u * u };
  }
  const a = keyframes[seg - 1];
  const b = keyframes[seg];
  const hop = s * 0.35;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - hop * 4 * u * (1 - u) };
}

export type BucketTone = "rose" | "orange" | "amber" | "yellow" | "slate";

/** AA-safe bucket fill/text classes by multiplier ×10. */
export function bucketTone(x10: number): { tone: BucketTone; fill: string; text: string } {
  if (x10 >= 100) return { tone: "rose", fill: "bg-rose-400", text: "text-bg-950" };
  if (x10 >= 30) return { tone: "orange", fill: "bg-orange-400", text: "text-bg-950" };
  if (x10 >= 15) return { tone: "amber", fill: "bg-amber-300", text: "text-bg-950" };
  if (x10 >= 10) return { tone: "yellow", fill: "bg-yellow-300", text: "text-bg-950" };
  return { tone: "slate", fill: "bg-slate-700", text: "text-ink" };
}

/** Static bucket label: "1k" for 1000, otherwise the table value. */
export function bucketLabel(x10: number): string {
  if (x10 >= 10000) return `${x10 / 10000}k`;
  return String(x10 / 10);
}
