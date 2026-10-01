import { describe, it, expect } from "vitest";
import { diceMultiplierX10000, isDiceWin, rollDice, winChance } from "../src/lib/logic/dice";
import { formatMultiplier, payoutFromMultiplier } from "../src/lib/money";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("winChance / multiplier", () => {
  it("chance is target (Under) or 100 − target (Over)", () => {
    expect(winChance(50, "under")).toBe(50);
    expect(winChance(50, "over")).toBe(50);
    expect(winChance(2, "under")).toBe(2);
    expect(winChance(2, "over")).toBe(98);
    expect(winChance(98, "under")).toBe(98);
    expect(winChance(98, "over")).toBe(2);
  });

  it("multiplier ×10000 = floor(990000 / chance)", () => {
    expect(diceMultiplierX10000(50)).toBe(19800);
    expect(diceMultiplierX10000(2)).toBe(495000);
    expect(diceMultiplierX10000(98)).toBe(10102);
    expect(diceMultiplierX10000(33)).toBe(30000);
    expect(diceMultiplierX10000(7)).toBe(141428);
    expect(formatMultiplier(diceMultiplierX10000(50), 10000)).toBe("1.98x");
    expect(formatMultiplier(diceMultiplierX10000(2), 10000)).toBe("49.50x");
    expect(formatMultiplier(diceMultiplierX10000(98), 10000)).toBe("1.0102x");
  });

  it("RTP ≤ 99% for every target", () => {
    for (let t = 2; t <= 98; t++) {
      for (const dir of ["under", "over"] as const) {
        const c = winChance(t, dir);
        expect((c / 100) * (diceMultiplierX10000(c) / 10000)).toBeLessThanOrEqual(0.99 + 1e-12);
      }
    }
  });

  it("throws RangeError on invalid target or chance", () => {
    expect(() => winChance(1, "under")).toThrow(RangeError);
    expect(() => winChance(99, "under")).toThrow(RangeError);
    expect(() => winChance(50.5, "under")).toThrow(RangeError);
    expect(() => diceMultiplierX10000(0)).toThrow(RangeError);
  });

  it("payout uses the full 4-decimal integer", () => {
    expect(payoutFromMultiplier(1000, diceMultiplierX10000(50), 10000)).toBe(1980);
    expect(payoutFromMultiplier(101, diceMultiplierX10000(50), 10000)).toBe(199);
    expect(payoutFromMultiplier(10000, diceMultiplierX10000(98), 10000)).toBe(10102);
  });
});

describe("boundaries", () => {
  it("roll 4999 vs 5000 at target 50", () => {
    expect(isDiceWin(4999, 50, "under")).toBe(true);
    expect(isDiceWin(5000, 50, "under")).toBe(false);
    expect(isDiceWin(4999, 50, "over")).toBe(false);
    expect(isDiceWin(5000, 50, "over")).toBe(true);
  });

  it("extremes 2 and 98", () => {
    expect(isDiceWin(199, 2, "under")).toBe(true);
    expect(isDiceWin(200, 2, "under")).toBe(false);
    expect(isDiceWin(9799, 98, "over")).toBe(false);
    expect(isDiceWin(9800, 98, "over")).toBe(true);
    expect(isDiceWin(9999, 98, "over")).toBe(true);
    expect(isDiceWin(0, 2, "over")).toBe(false);
  });

  it("win counts match the chance exactly over all 10,000 rolls", () => {
    for (const t of [2, 37, 50, 98]) {
      let under = 0;
      let over = 0;
      for (let roll = 0; roll < 10000; roll++) {
        if (isDiceWin(roll, t, "under")) under++;
        if (isDiceWin(roll, t, "over")) over++;
      }
      expect(under).toBe(t * 100);
      expect(over).toBe((100 - t) * 100);
    }
  });
});

describe("rollDice", () => {
  it("stays in 0–9999", () => {
    const rng = seededRng(4);
    for (let i = 0; i < 5000; i++) {
      const r = rollDice(rng);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(9999);
    }
    expect(rollDice(sequenceRng([12345]))).toBe(12345 % 10000);
  });
});
