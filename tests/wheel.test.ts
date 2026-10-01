import { describe, it, expect } from "vitest";
import { WHEEL_SEGMENTS_X10, segmentAtPointer, spinWheel, wheelTargetRotation } from "../src/lib/logic/wheel";
import { randomFloat, randomInt } from "../src/lib/rng";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("segments", () => {
  it("has 40 segments with the design distribution", () => {
    expect(WHEEL_SEGMENTS_X10).toHaveLength(40);
    const counts = new Map<number, number>();
    for (const v of WHEEL_SEGMENTS_X10) counts.set(v, (counts.get(v) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({ 0: 26, 15: 5, 20: 5, 30: 2, 50: 1, 100: 1 });
    expect(WHEEL_SEGMENTS_X10[0]).toBe(100);
    expect(WHEEL_SEGMENTS_X10[20]).toBe(50);
  });

  it("RTP is 96.25% and hit rate 35%", () => {
    const sum = WHEEL_SEGMENTS_X10.reduce<number>((s, v) => s + v, 0);
    expect(sum / 10 / 40).toBe(0.9625);
    expect(WHEEL_SEGMENTS_X10.filter((v) => v > 0).length / 40).toBe(0.35);
  });
});

describe("spinWheel", () => {
  it("returns 0–39", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 1000; i++) {
      const idx = spinWheel(rng);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(39);
    }
    expect(spinWheel(sequenceRng([17]))).toBe(17);
  });
});

describe("rotation", () => {
  it("round-trips through segmentAtPointer over 1,000 cases and always adds > 5 turns", () => {
    const rng = seededRng(77);
    for (let n = 0; n < 1000; n++) {
      const current = randomInt(-5000, 50000, rng) + randomFloat(rng);
      const index = randomInt(0, 39, rng);
      const jitter = randomFloat(rng);
      const target = wheelTargetRotation(current, index, jitter);
      expect(segmentAtPointer(target, 40)).toBe(index);
      expect(target).toBeGreaterThan(current + 5 * 360);
      expect(target).toBeLessThan(current + 7 * 360);
    }
  });

  it("handles jitter extremes 0 and 1 and keeps the pointer inside the segment", () => {
    for (let index = 0; index < 40; index++) {
      for (const jitter of [0, 0.5, 0.999999, 1]) {
        const target = wheelTargetRotation(0, index, jitter);
        expect(segmentAtPointer(target)).toBe(index);
        const angle = (((-target % 360) + 360) % 360);
        const within = angle - index * 9;
        expect(within).toBeGreaterThanOrEqual(9 * 0.15 - 1e-9);
        expect(within).toBeLessThanOrEqual(9 * 0.85 + 1e-9);
      }
    }
  });

  it("accumulates: rotation strictly increases across consecutive spins", () => {
    const rng = seededRng(12);
    let r = 0;
    for (let i = 0; i < 100; i++) {
      const next = wheelTargetRotation(r, randomInt(0, 39, rng), randomFloat(rng));
      expect(next).toBeGreaterThan(r);
      r = next;
    }
    expect(r).toBeGreaterThan(100 * 6 * 360 - 1);
  });

  it("segmentAtPointer uses the clockwise-from-12 convention", () => {
    expect(segmentAtPointer(0)).toBe(0);
    expect(segmentAtPointer(-4.5)).toBe(0);
    expect(segmentAtPointer(-9)).toBe(1);
    expect(segmentAtPointer(4.5)).toBe(39);
    expect(segmentAtPointer(360 * 10 - 13.5)).toBe(1);
  });
});
