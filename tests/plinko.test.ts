import { describe, it, expect } from "vitest";
import {
  PLINKO_RISKS,
  PLINKO_ROWS,
  PLINKO_TABLES,
  PLINKO_X10,
  ballPosition,
  bucketLabel,
  bucketTone,
  dropBall,
  plinkoLayout,
  plinkoMultiplierX10,
} from "../src/lib/logic/plinko";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

describe("tables", () => {
  it("has all 27 tables", () => {
    let count = 0;
    for (const rows of PLINKO_ROWS) for (const risk of PLINKO_RISKS) if (PLINKO_TABLES[rows][risk]) count++;
    expect(count).toBe(27);
    expect(PLINKO_TABLES[8].low).toEqual([5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6]);
    expect(PLINKO_TABLES[9].low).toEqual([5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6]);
    expect(PLINKO_X10[12].medium).toEqual([330, 110, 40, 20, 11, 6, 3, 6, 11, 20, 40, 110, 330]);
    expect(PLINKO_X10[16].high[0]).toBe(10000);
  });

  for (const rows of PLINKO_ROWS) {
    for (const risk of PLINKO_RISKS) {
      it(`${rows} rows / ${risk}: length, symmetry, ×10 integral, edge max, centre min, RTP`, () => {
        const t = PLINKO_TABLES[rows][risk];
        const x10 = PLINKO_X10[rows][risk];
        expect(t).toHaveLength(rows + 1);
        expect(x10).toHaveLength(rows + 1);
        for (let k = 0; k <= rows; k++) {
          expect(t[k]).toBe(t[rows - k]);
          expect(Math.abs(t[k] * 10 - Math.round(t[k] * 10))).toBeLessThan(1e-9);
          expect(x10[k]).toBe(Math.round(t[k] * 10));
          expect(Number.isInteger(x10[k])).toBe(true);
        }
        const max = Math.max(...t);
        const min = Math.min(...t);
        expect(t[0]).toBe(max);
        expect(t[Math.floor(rows / 2)]).toBe(min);
        let rtp = 0;
        for (let k = 0; k <= rows; k++) rtp += (choose(rows, k) / 2 ** rows) * (x10[k] / 10);
        expect(rtp).toBeGreaterThanOrEqual(0.985);
        expect(rtp).toBeLessThanOrEqual(0.995);
      });
    }
  }
});

describe("dropBall", () => {
  it("bucket = sum(path) with rows steps", () => {
    const rng = seededRng(16);
    for (const rows of PLINKO_ROWS) {
      for (let i = 0; i < 100; i++) {
        const { path, bucket } = dropBall(rows, rng);
        expect(path).toHaveLength(rows);
        for (const s of path) expect([0, 1]).toContain(s);
        expect(bucket).toBe(path.reduce<number>((a, b) => a + b, 0));
      }
    }
    expect(dropBall(8, sequenceRng([1, 1, 0, 1, 0, 0, 0, 1]))).toEqual({ path: [1, 1, 0, 1, 0, 0, 0, 1], bucket: 4 });
  });
});

describe("plinkoMultiplierX10", () => {
  it("reads PLINKO_X10 and validates the bucket", () => {
    expect(plinkoMultiplierX10(12, "medium", 0)).toBe(330);
    expect(plinkoMultiplierX10(12, "medium", 6)).toBe(3);
    expect(plinkoMultiplierX10(16, "high", 16)).toBe(10000);
    expect(() => plinkoMultiplierX10(12, "medium", 13)).toThrow(RangeError);
    expect(() => plinkoMultiplierX10(12, "medium", -1)).toThrow(RangeError);
  });
});

describe("layout and ballPosition", () => {
  it("geometry follows the design", () => {
    const L = plinkoLayout(12, 560);
    expect(L.s).toBe(40);
    expect(L.cx).toBe(280);
    expect(L.height).toBeCloseTo(504);
    expect(L.pegR).toBeCloseTo(4.8);
    expect(L.ballR).toBeCloseTo(8.8);
    expect(L.rowY(0)).toBeCloseTo(32);
    expect(L.rowY(11)).toBeCloseTo(504 - 32);
    expect(L.pegs).toHaveLength(Array.from({ length: 12 }, (_, r) => r + 3).reduce((a, b) => a + b, 0));
    // Bucket k is s wide and centred at bucketX(k); the row spans s/2 … width − s/2.
    expect(L.bucketX(0)).toBe(40);
    expect(L.bucketX(0) - L.s / 2).toBe(L.s / 2);
    expect(L.bucketX(12)).toBe(520);
    expect(L.bucketX(12) + L.s / 2).toBe(L.width - L.s / 2);
  });

  it("ball lands on the bucket centre at t = 1 for every rows value", () => {
    const rng = seededRng(3);
    for (const rows of PLINKO_ROWS) {
      const L = plinkoLayout(rows, 400);
      for (let i = 0; i < 20; i++) {
        const { path, bucket } = dropBall(rows, rng);
        const end = ballPosition(path, 1, L);
        expect(end.x).toBeCloseTo(L.bucketX(bucket), 9);
        expect(end.y).toBeCloseTo(L.height - L.ballR, 9);
        const start = ballPosition(path, 0, L);
        expect(start.x).toBeCloseTo(L.cx, 9);
        expect(start.y).toBeCloseTo(-L.ballR, 9);
      }
    }
  });

  it("ball sits on top of a peg at each row keyframe", () => {
    const rows = 8;
    const L = plinkoLayout(rows, 400);
    const path: (0 | 1)[] = [1, 0, 1, 1, 0, 0, 1, 1];
    let right = 0;
    for (let i = 0; i < rows; i++) {
      const p = ballPosition(path, (i + 1) / (rows + 1), L);
      expect(p.y).toBeCloseTo(L.rowY(i) - (L.pegR + L.ballR), 9);
      const onPeg = L.pegs.some((peg) => Math.abs(peg.x - p.x) < 1e-9 && Math.abs(peg.y - L.rowY(i)) < 1e-9);
      expect(onPeg).toBe(true);
      right += path[i];
    }
    expect(right).toBe(5);
  });
});

describe("bucketTone", () => {
  it("thresholds in ×10 units", () => {
    expect(bucketTone(100).tone).toBe("rose");
    expect(bucketTone(10000).fill).toBe("bg-rose-400");
    expect(bucketTone(99).tone).toBe("orange");
    expect(bucketTone(30).tone).toBe("orange");
    expect(bucketTone(29).tone).toBe("amber");
    expect(bucketTone(15).tone).toBe("amber");
    expect(bucketTone(14).tone).toBe("yellow");
    expect(bucketTone(10).tone).toBe("yellow");
    expect(bucketTone(9).tone).toBe("slate");
    expect(bucketTone(9)).toEqual({ tone: "slate", fill: "bg-slate-700", text: "text-ink" });
    expect(bucketTone(30)).toEqual({ tone: "orange", fill: "bg-orange-400", text: "text-bg-950" });
  });

  it("labels 1000x as 1k", () => {
    expect(bucketLabel(10000)).toBe("1k");
    expect(bucketLabel(56)).toBe("5.6");
    expect(bucketLabel(3)).toBe("0.3");
    expect(bucketLabel(6200)).toBe("620");
  });
});
