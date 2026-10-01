import { describe, it, expect } from "vitest";
import {
  isLimboWin,
  limboResultHundredths,
  limboWinChanceText,
  parseMultiplierInput,
  rollLimbo,
} from "../src/lib/logic/limbo";
import { formatMultiplier } from "../src/lib/money";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("limboResultHundredths", () => {
  it("follows floor(99 / (1 − r)) with min 100 and the cap", () => {
    expect(limboResultHundredths(0)).toBe(100);
    expect(limboResultHundredths(0.5)).toBe(198);
    expect(limboResultHundredths(0.75)).toBe(396);
    expect(limboResultHundredths(1 - 2 ** -40)).toBe(100_000_000);
    expect(limboResultHundredths(0.9)).toBe(990);
  });

  it("floors (never rounds up)", () => {
    // 99 / (1 − 0.2) = 123.75 → 123
    expect(limboResultHundredths(0.2)).toBe(123);
    // 99 / (1 − 0.6) = 247.5 → 247
    expect(limboResultHundredths(0.6)).toBe(247);
  });

  it("minimum is 1.00x for small r", () => {
    expect(limboResultHundredths(0.005)).toBe(100);
    expect(limboResultHundredths(0.01)).toBe(100);
  });

  it("rollLimbo uses randomFloat and stays in range", () => {
    expect(rollLimbo(sequenceRng([0, 0]))).toBe(100);
    expect(rollLimbo(sequenceRng([0x80000000, 0]))).toBe(198); // r = 0.5
    const rng = seededRng(99);
    for (let i = 0; i < 2000; i++) {
      const h = rollLimbo(rng);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(100);
      expect(h).toBeLessThanOrEqual(100_000_000);
    }
  });

  it("formats with formatMultiplier", () => {
    expect(formatMultiplier(limboResultHundredths(0.5), 100)).toBe("1.98x");
    expect(formatMultiplier(100_000_000, 100)).toBe("1,000,000.00x");
  });
});

describe("win boundary", () => {
  it("wins at equality", () => {
    expect(isLimboWin(200, 200)).toBe(true);
    expect(isLimboWin(199, 200)).toBe(false);
    expect(isLimboWin(201, 200)).toBe(true);
  });

  it("win chance text", () => {
    expect(limboWinChanceText(200)).toBe("49.50%");
    expect(limboWinChanceText(101)).toBe("98.01%");
    expect(limboWinChanceText(100_000_000)).toBe("< 0.01%");
    expect(limboWinChanceText(990_000)).toBe("0.01%");
  });
});

describe("parseMultiplierInput", () => {
  const RANGE = "Target must be between 1.01x and 1,000,000x";
  it.each([
    ["", { ok: false, error: "Enter a target multiplier" }],
    ["  ", { ok: false, error: "Enter a target multiplier" }],
    ["2", { ok: true, hundredths: 200 }],
    ["2.", { ok: true, hundredths: 200 }],
    ["2.5", { ok: true, hundredths: 250 }],
    [" 2.00 ", { ok: true, hundredths: 200 }],
    [".5", { ok: false, error: RANGE }],
    ["1.005", { ok: false, error: "Use at most 2 decimal places" }],
    ["1", { ok: false, error: RANGE }],
    ["1.00", { ok: false, error: RANGE }],
    ["1.01", { ok: true, hundredths: 101 }],
    ["1000000", { ok: true, hundredths: 100_000_000 }],
    ["1000000.01", { ok: false, error: RANGE }],
    ["12345678", { ok: false, error: RANGE }],
    ["abc", { ok: false, error: RANGE }],
    ["-2", { ok: false, error: RANGE }],
    ["1e3", { ok: false, error: RANGE }],
    ["1,000", { ok: false, error: RANGE }],
  ])("%j", (input, expected) => {
    expect(parseMultiplierInput(input)).toEqual(expected);
  });
});
