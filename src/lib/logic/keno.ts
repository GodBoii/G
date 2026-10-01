// Keno: 40 numbers, 10 drawn, 1–10 picks.
import { cryptoRng, sampleWithoutReplacement, type Rng } from "../rng";

export const KENO_NUMBERS = 40;
export const KENO_DRAWS = 10;
export const KENO_MAX_PICKS = 10;

export type KenoPicks = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// | Picks \ hits | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | RTP |
// | 1 | 0 | 3.88 | | | | | | | | | | 97.00% |
// | 2 | 0 | 1.7 | 5.5 | | | | | | | | | 97.12% |
// | 3 | 0 | 1 | 2.8 | 12 | | | | | | | | 96.86% |
// | 4 | 0 | 0.5 | 2 | 6 | 35 | | | | | | | 96.73% |
// | 5 | 0 | 0.2 | 1.4 | 4 | 14 | 90 | | | | | | 95.78% |
// | 6 | 0 | 0 | 1 | 2.5 | 9 | 45 | 400 | | | | | 96.33% |
// | 7 | 0 | 0 | 0.7 | 1.8 | 5 | 22 | 120 | 800 | | | | 96.20% |
// | 8 | 0 | 0 | 0.4 | 1.4 | 3.5 | 13 | 50 | 250 | 1000 | | | 95.68% |
// | 9 | 0 | 0 | 0.3 | 1.1 | 2.7 | 7 | 25 | 120 | 500 | 1000 | | 96.28% |
// | 10 | 0 | 0 | 0 | 1 | 2.1 | 5 | 16 | 70 | 300 | 800 | 1000 | 96.50% |
/** Gross multiplier ×100, indexed [picks][hits]. */
export const KENO_PAYTABLE: Readonly<Record<KenoPicks, readonly number[]>> = {
  1: [0, 388],
  2: [0, 170, 550],
  3: [0, 100, 280, 1200],
  4: [0, 50, 200, 600, 3500],
  5: [0, 20, 140, 400, 1400, 9000],
  6: [0, 0, 100, 250, 900, 4500, 40000],
  7: [0, 0, 70, 180, 500, 2200, 12000, 80000],
  8: [0, 0, 40, 140, 350, 1300, 5000, 25000, 100000],
  9: [0, 0, 30, 110, 270, 700, 2500, 12000, 50000, 100000],
  10: [0, 0, 0, 100, 210, 500, 1600, 7000, 30000, 80000, 100000],
};

export const KENO_ALL_NUMBERS: readonly number[] = Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1);

export function countHits(picks: readonly number[], drawn: readonly number[]): number {
  const set = new Set(drawn);
  let hits = 0;
  for (const p of new Set(picks)) if (set.has(p)) hits++;
  return hits;
}

export function kenoMultiplierX100(picks: number, hits: number): number {
  if (!Number.isInteger(picks) || picks < 1 || picks > KENO_MAX_PICKS) {
    throw new RangeError("keno: picks must be an integer from 1 to 10");
  }
  if (!Number.isInteger(hits) || hits < 0 || hits > picks) {
    throw new RangeError("keno: hits must be an integer from 0 to picks");
  }
  return KENO_PAYTABLE[picks as KenoPicks][hits];
}

/** 10 distinct numbers from 1–40, in draw order. */
export function drawKeno(rng: Rng = cryptoRng): number[] {
  return sampleWithoutReplacement(KENO_ALL_NUMBERS, KENO_DRAWS, rng);
}
