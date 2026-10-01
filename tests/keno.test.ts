import { describe, it, expect } from "vitest";
import { KENO_PAYTABLE, countHits, drawKeno, kenoMultiplierX100, type KenoPicks } from "../src/lib/logic/keno";
import { seededRng } from "./helpers/fakeRng";

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

const EXPECTED_RTP: Record<KenoPicks, number> = {
  1: 97.0, 2: 97.12, 3: 96.86, 4: 96.73, 5: 95.78, 6: 96.33, 7: 96.2, 8: 95.68, 9: 96.28, 10: 96.5,
};

describe("paytable", () => {
  it("row n has length n + 1 and starts with 0", () => {
    for (let n = 1; n <= 10; n++) {
      const row = KENO_PAYTABLE[n as KenoPicks];
      expect(row).toHaveLength(n + 1);
      expect(row[0]).toBe(0);
      for (const v of row) expect(Number.isInteger(v)).toBe(true);
    }
    expect(KENO_PAYTABLE[1]).toEqual([0, 388]);
    expect(KENO_PAYTABLE[10]).toEqual([0, 0, 0, 100, 210, 500, 1600, 7000, 30000, 80000, 100000]);
  });

  it("every RTP (exact combinatorics) lies in [95%, 97.5%] and matches the design", () => {
    const total = choose(40, 10);
    for (let n = 1; n <= 10; n++) {
      const row = KENO_PAYTABLE[n as KenoPicks];
      let rtp = 0;
      for (let h = 0; h <= n; h++) rtp += ((choose(n, h) * choose(40 - n, 10 - h)) / total) * (row[h] / 100);
      expect(rtp).toBeGreaterThanOrEqual(0.95);
      expect(rtp).toBeLessThanOrEqual(0.975);
      expect(Math.abs(rtp * 100 - EXPECTED_RTP[n as KenoPicks])).toBeLessThan(0.006);
    }
  });
});

describe("countHits", () => {
  it("counts the intersection", () => {
    expect(countHits([1, 2, 3], [3, 4, 5, 1])).toBe(2);
    expect(countHits([], [1, 2])).toBe(0);
    expect(countHits([7], [8])).toBe(0);
    expect(countHits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
  });
});

describe("kenoMultiplierX100", () => {
  it("reads the table", () => {
    expect(kenoMultiplierX100(1, 1)).toBe(388);
    expect(kenoMultiplierX100(5, 5)).toBe(9000);
    expect(kenoMultiplierX100(10, 2)).toBe(0);
  });

  it("throws RangeError on out-of-range lookups", () => {
    expect(() => kenoMultiplierX100(0, 0)).toThrow(RangeError);
    expect(() => kenoMultiplierX100(11, 0)).toThrow(RangeError);
    expect(() => kenoMultiplierX100(3, 4)).toThrow(RangeError);
    expect(() => kenoMultiplierX100(3, -1)).toThrow(RangeError);
    expect(() => kenoMultiplierX100(2.5, 1)).toThrow(RangeError);
  });
});

describe("drawKeno", () => {
  it("draws 10 distinct values in 1–40", () => {
    const rng = seededRng(40);
    for (let i = 0; i < 500; i++) {
      const d = drawKeno(rng);
      expect(d).toHaveLength(10);
      expect(new Set(d).size).toBe(10);
      for (const v of d) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(40);
      }
    }
  });
});
