import { describe, it, expect } from "vitest";
import {
  SCRATCH_LOSE_PPM,
  SCRATCH_ODDS_PPM,
  SCRATCH_PRIZES_X100,
  SCRATCH_SYMBOLS,
  SCRATCH_THRESHOLDS,
  coverageFraction,
  drawScratchPrize,
  evaluateCard,
  generateCard,
  type ScratchSymbol,
} from "../src/lib/logic/scratch";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("tables", () => {
  it("prizes match the design", () => {
    expect(SCRATCH_PRIZES_X100).toEqual({ diamond: 10000, crown: 2000, clover: 1000, star: 500, bell: 200, cherry: 100 });
  });

  it("probabilities sum to 1,000,000 and RTP is 96.0%", () => {
    const won = SCRATCH_SYMBOLS.reduce((s, sym) => s + SCRATCH_ODDS_PPM[sym], 0);
    expect(won + SCRATCH_LOSE_PPM).toBe(1_000_000);
    expect(won).toBe(431_000);
    const rtpX100 = SCRATCH_SYMBOLS.reduce((s, sym) => s + SCRATCH_ODDS_PPM[sym] * SCRATCH_PRIZES_X100[sym], 0);
    expect(rtpX100 / 100 / 1_000_000).toBeCloseTo(0.96, 10);
    expect(SCRATCH_THRESHOLDS[SCRATCH_THRESHOLDS.length - 1].below).toBe(431_000);
  });

  it("maps draws to prizes by cumulative thresholds", () => {
    expect(drawScratchPrize(sequenceRng([0]))).toBe("diamond");
    expect(drawScratchPrize(sequenceRng([999]))).toBe("diamond");
    expect(drawScratchPrize(sequenceRng([1000]))).toBe("crown");
    expect(drawScratchPrize(sequenceRng([130_999]))).toBe("bell");
    expect(drawScratchPrize(sequenceRng([131_000]))).toBe("cherry");
    expect(drawScratchPrize(sequenceRng([430_999]))).toBe("cherry");
    expect(drawScratchPrize(sequenceRng([431_000]))).toBeNull();
    expect(drawScratchPrize(sequenceRng([999_999]))).toBeNull();
  });
});

describe("generateCard", () => {
  it("over 10,000 seeded cards: ≤ 1 triple, evaluateCard agrees, winningCells correct", () => {
    const rng = seededRng(31337);
    let wins = 0;
    for (let i = 0; i < 10_000; i++) {
      const card = generateCard(rng);
      expect(card.cells).toHaveLength(9);
      const counts = new Map<ScratchSymbol, number>();
      for (const s of card.cells) counts.set(s, (counts.get(s) ?? 0) + 1);
      const triples = [...counts.values()].filter((c) => c >= 3);
      expect(triples.length).toBeLessThanOrEqual(1);
      for (const c of counts.values()) expect(c).toBeLessThanOrEqual(3);
      expect(evaluateCard(card.cells)).toBe(card.prize);
      if (card.prize) {
        wins++;
        expect(card.winningCells).toHaveLength(3);
        for (const idx of card.winningCells) expect(card.cells[idx]).toBe(card.prize);
      } else {
        expect(card.winningCells).toEqual([]);
      }
    }
    // 43.1% expected; loose bound for 10k samples.
    expect(wins / 10_000).toBeGreaterThan(0.4);
    expect(wins / 10_000).toBeLessThan(0.46);
  });
});

describe("evaluateCard", () => {
  it("finds the triple or returns null", () => {
    expect(evaluateCard(["star", "bell", "star", "cherry", "star", "crown", "bell", "clover", "diamond"])).toBe("star");
    expect(evaluateCard(["star", "bell", "star", "cherry", "bell", "crown", "cherry", "clover", "diamond"])).toBeNull();
  });
});

describe("coverageFraction", () => {
  const W = 100;
  const H = 80;
  function rgba(alphaAt: (x: number, y: number) => number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[(y * W + x) * 4 + 3] = alphaAt(x, y);
    return data;
  }

  it("all opaque → 0", () => {
    expect(coverageFraction(rgba(() => 255), W, H)).toBe(0);
  });

  it("all cleared → 1", () => {
    expect(coverageFraction(rgba(() => 0), W, H)).toBe(1);
  });

  it("left half cleared → 0.5", () => {
    expect(coverageFraction(rgba((x) => (x < W / 2 ? 0 : 255)), W, H)).toBe(0.5);
  });

  it("treats alpha < 128 as cleared and accepts single-channel buffers", () => {
    expect(coverageFraction(rgba(() => 127), W, H)).toBe(1);
    expect(coverageFraction(rgba(() => 128), W, H)).toBe(0);
    const single = new Uint8ClampedArray(W * H).fill(0);
    expect(coverageFraction(single, W, H)).toBe(1);
  });
});
