import { describe, it, expect } from "vitest";
import {
  RNG_UNAVAILABLE,
  cryptoRng,
  playErrorMessage,
  randomFloat,
  randomInt,
  sampleWithoutReplacement,
  shuffle,
  weightedIndex,
} from "../src/lib/rng";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("randomInt", () => {
  it("stays in range for many seeds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seededRng(seed);
      for (let i = 0; i < 200; i++) {
        const v = randomInt(-3, 7, rng);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-3);
        expect(v).toBeLessThanOrEqual(7);
      }
    }
  });

  it("covers every value of a small range", () => {
    const rng = seededRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomInt(0, 5, rng));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("rejects values at or above the limit (no modulo bias)", () => {
    // span 3: limit = 2^32 − (2^32 % 3) = 4294967295. 4294967295 must be skipped.
    const rng = sequenceRng([4294967295, 4294967294, 7]);
    expect(randomInt(0, 2, rng)).toBe(4294967294 % 3);
    expect(randomInt(10, 12, rng)).toBe(10 + (7 % 3));
    expect(rng.remaining()).toBe(0);
  });

  it("handles the full 2^32 span", () => {
    expect(randomInt(0, 4294967295, sequenceRng([4294967295]))).toBe(4294967295);
  });

  it("throws RangeError on bad args", () => {
    expect(() => randomInt(5, 4, seededRng(1))).toThrow(RangeError);
    expect(() => randomInt(0.5, 4, seededRng(1))).toThrow(RangeError);
    expect(() => randomInt(0, 4.5, seededRng(1))).toThrow(RangeError);
    expect(() => randomInt(0, 4294967296, seededRng(1))).toThrow(RangeError);
    expect(() => randomInt(Number.NaN, 1, seededRng(1))).toThrow(RangeError);
  });
});

describe("randomFloat", () => {
  it("stays in [0, 1)", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) {
      const f = randomFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("uses 53 bits: extremes map to 0 and just below 1", () => {
    expect(randomFloat(sequenceRng([0, 0]))).toBe(0);
    const max = randomFloat(sequenceRng([0xffffffff, 0xffffffff]));
    expect(max).toBe(1 - 2 ** -53);
  });
});

describe("shuffle / sampleWithoutReplacement", () => {
  it("shuffle is a permutation and does not mutate the input", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const copy = items.slice();
    const out = shuffle(items, seededRng(3));
    expect(items).toEqual(copy);
    expect(out).toHaveLength(20);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  it("sample is distinct with size k", () => {
    const items = Array.from({ length: 40 }, (_, i) => i + 1);
    for (let seed = 1; seed <= 100; seed++) {
      const s = sampleWithoutReplacement(items, 10, seededRng(seed));
      expect(s).toHaveLength(10);
      expect(new Set(s).size).toBe(10);
      for (const v of s) expect(items).toContain(v);
    }
    expect(sampleWithoutReplacement(items, 0, seededRng(1))).toEqual([]);
    expect(() => sampleWithoutReplacement(items, 41, seededRng(1))).toThrow(RangeError);
    expect(() => sampleWithoutReplacement(items, -1, seededRng(1))).toThrow(RangeError);
  });
});

describe("weightedIndex", () => {
  it("respects zero weights", () => {
    const rng = seededRng(11);
    for (let i = 0; i < 2000; i++) {
      const idx = weightedIndex([0, 3, 0, 1, 0], rng);
      expect([1, 3]).toContain(idx);
    }
  });

  it("maps the draw to the first index whose cumulative sum exceeds it", () => {
    // total 4 → randomInt(0, 3); uint32 values 0..3 map directly.
    expect(weightedIndex([1, 0, 3], sequenceRng([0]))).toBe(0);
    expect(weightedIndex([1, 0, 3], sequenceRng([1]))).toBe(2);
    expect(weightedIndex([1, 0, 3], sequenceRng([3]))).toBe(2);
  });

  it("throws on invalid weights", () => {
    expect(() => weightedIndex([0, 0], seededRng(1))).toThrow(RangeError);
    expect(() => weightedIndex([1, -1], seededRng(1))).toThrow(RangeError);
    expect(() => weightedIndex([1.5], seededRng(1))).toThrow(RangeError);
    expect(() => weightedIndex([], seededRng(1))).toThrow(RangeError);
  });
});

describe("cryptoRng", () => {
  it("produces uint32s in node", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = cryptoRng.nextUint32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(150);
  });

  it("is the default rng", () => {
    const v = randomInt(1, 6);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
  });
});

describe("playErrorMessage", () => {
  it("maps the RNG error to the secure-RNG text", () => {
    expect(playErrorMessage(new Error(RNG_UNAVAILABLE))).toBe("Secure random numbers are unavailable in this browser");
  });

  it("maps everything else to the generic text", () => {
    const generic = "Something went wrong. Your bet was not placed.";
    expect(playErrorMessage(new RangeError("bad"))).toBe(generic);
    expect(playErrorMessage(new Error("x"))).toBe(generic);
    expect(playErrorMessage("oops")).toBe(generic);
    expect(playErrorMessage(undefined)).toBe(generic);
  });
});
