import { describe, it, expect } from "vitest";
import {
  INITIAL_MINES_ROUND,
  cashoutCents,
  currentMultiplier,
  minesMultiplierHundredths,
  minesReducer,
  nextMultiplier,
  placeMines,
  safeTilesLeft,
  type Round,
} from "../src/lib/logic/mines";
import { formatMultiplier } from "../src/lib/money";
import { seededRng } from "./helpers/fakeRng";

describe("minesMultiplierHundredths", () => {
  it("known values (AC3)", () => {
    expect(minesMultiplierHundredths(1, 1)).toBe(103);
    expect(minesMultiplierHundredths(24, 1)).toBe(2475);
    expect(minesMultiplierHundredths(3, 5)).toBe(199);
    expect(minesMultiplierHundredths(1, 24)).toBe(2475);
    expect(formatMultiplier(minesMultiplierHundredths(1, 1), 100)).toBe("1.03x");
    expect(formatMultiplier(minesMultiplierHundredths(24, 1), 100)).toBe("24.75x");
  });

  it("increases strictly with k for every mine count", () => {
    for (let m = 1; m <= 24; m++) {
      let prev = 0;
      for (let k = 1; k <= 25 - m; k++) {
        const v = minesMultiplierHundredths(m, k);
        expect(Number.isSafeInteger(v)).toBe(true);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
    }
  });

  it("throws RangeError outside the domain", () => {
    expect(() => minesMultiplierHundredths(0, 1)).toThrow(RangeError);
    expect(() => minesMultiplierHundredths(25, 1)).toThrow(RangeError);
    expect(() => minesMultiplierHundredths(3, 0)).toThrow(RangeError);
    expect(() => minesMultiplierHundredths(3, 23)).toThrow(RangeError);
    expect(() => minesMultiplierHundredths(1.5, 1)).toThrow(RangeError);
  });
});

const MINES3 = [0, 6, 12];
function started(from: Round = INITIAL_MINES_ROUND, betCents = 1000, mineCount = 3, mines = MINES3): Round {
  return minesReducer(from, { type: "start", betCents, mineCount, mines });
}

describe("minesReducer", () => {
  it("start from idle", () => {
    const r = started();
    expect(r).toEqual({ phase: "playing", mineCount: 3, betCents: 1000, mines: MINES3, revealed: [], hit: null });
    expect(currentMultiplier(r)).toBeNull();
    expect(nextMultiplier(r)).toBe(minesMultiplierHundredths(3, 1));
    expect(cashoutCents(r)).toBe(0);
    expect(safeTilesLeft(r)).toBe(22);
  });

  it("start while playing is ignored (same object)", () => {
    const r = started();
    expect(started(r, 5000, 5, [1, 2, 3, 4, 5])).toBe(r);
  });

  it("start validates the mines", () => {
    expect(() => started(INITIAL_MINES_ROUND, 100, 3, [0, 1])).toThrow(RangeError);
    expect(() => started(INITIAL_MINES_ROUND, 100, 3, [0, 1, 1])).toThrow(RangeError);
    expect(() => started(INITIAL_MINES_ROUND, 100, 3, [0, 1, 25])).toThrow(RangeError);
    expect(() => started(INITIAL_MINES_ROUND, 100, 0, [])).toThrow(RangeError);
    expect(() => started(INITIAL_MINES_ROUND, 100, 25, Array.from({ length: 25 }, (_, i) => i))).toThrow(RangeError);
  });

  it("reveal safe tile, then a mine → busted", () => {
    const r0 = started();
    const r1 = minesReducer(r0, { type: "reveal", index: 1 });
    expect(r1.phase).toBe("playing");
    expect(r1.revealed).toEqual([1]);
    expect(currentMultiplier(r1)).toBe(minesMultiplierHundredths(3, 1));
    expect(cashoutCents(r1)).toBe(Math.floor((1000 * minesMultiplierHundredths(3, 1)) / 100));
    const r2 = minesReducer(r1, { type: "reveal", index: 6 });
    expect(r2.phase).toBe("busted");
    expect(r2.hit).toBe(6);
    expect(r2.revealed).toEqual([1]);
    expect(cashoutCents(r2)).toBe(0);
  });

  it("duplicate reveal and out-of-range reveal are ignored", () => {
    const r1 = minesReducer(started(), { type: "reveal", index: 1 });
    expect(minesReducer(r1, { type: "reveal", index: 1 })).toBe(r1);
    expect(minesReducer(r1, { type: "reveal", index: 25 })).toBe(r1);
    expect(minesReducer(r1, { type: "reveal", index: -1 })).toBe(r1);
  });

  it("cashout at k = 0 is ignored; cashout after a reveal → cashed", () => {
    const r0 = started();
    expect(minesReducer(r0, { type: "cashout" })).toBe(r0);
    const r1 = minesReducer(r0, { type: "reveal", index: 2 });
    const r2 = minesReducer(r1, { type: "reveal", index: 3 });
    const c = minesReducer(r2, { type: "cashout" });
    expect(c.phase).toBe("cashed");
    expect(currentMultiplier(c)).toBe(minesMultiplierHundredths(3, 2));
    expect(cashoutCents(c)).toBe(Math.floor((1000 * minesMultiplierHundredths(3, 2)) / 100));
  });

  it("revealing the last safe tile auto-cashes out", () => {
    let r = started(INITIAL_MINES_ROUND, 1000, 24, Array.from({ length: 24 }, (_, i) => i + 1));
    r = minesReducer(r, { type: "reveal", index: 0 });
    expect(r.phase).toBe("cashed");
    expect(nextMultiplier(r)).toBeNull();
    expect(cashoutCents(r)).toBe(24750);

    let all = started(INITIAL_MINES_ROUND, 100, 1, [24]);
    for (let i = 0; i < 23; i++) all = minesReducer(all, { type: "reveal", index: i });
    expect(all.phase).toBe("playing");
    expect(nextMultiplier(all)).toBe(2475);
    all = minesReducer(all, { type: "reveal", index: 23 });
    expect(all.phase).toBe("cashed");
    expect(cashoutCents(all)).toBe(2475);
  });

  it("reveal / cashout after the end return the same object", () => {
    const busted = minesReducer(started(), { type: "reveal", index: 0 });
    expect(busted.phase).toBe("busted");
    expect(minesReducer(busted, { type: "reveal", index: 1 })).toBe(busted);
    expect(minesReducer(busted, { type: "cashout" })).toBe(busted);

    const cashed = minesReducer(minesReducer(started(), { type: "reveal", index: 1 }), { type: "cashout" });
    expect(minesReducer(cashed, { type: "reveal", index: 2 })).toBe(cashed);
    expect(minesReducer(cashed, { type: "cashout" })).toBe(cashed);

    expect(minesReducer(INITIAL_MINES_ROUND, { type: "reveal", index: 1 })).toBe(INITIAL_MINES_ROUND);
    expect(minesReducer(INITIAL_MINES_ROUND, { type: "cashout" })).toBe(INITIAL_MINES_ROUND);
  });

  it("start from busted and cashed resets revealed/hit", () => {
    const busted = minesReducer(minesReducer(started(), { type: "reveal", index: 1 }), { type: "reveal", index: 0 });
    const again = started(busted, 2000, 5, [20, 21, 22, 23, 24]);
    expect(again).toEqual({ phase: "playing", mineCount: 5, betCents: 2000, mines: [20, 21, 22, 23, 24], revealed: [], hit: null });

    const cashed = minesReducer(minesReducer(started(), { type: "reveal", index: 1 }), { type: "cashout" });
    const again2 = started(cashed);
    expect(again2.phase).toBe("playing");
    expect(again2.revealed).toEqual([]);
    expect(again2.hit).toBeNull();
  });

  it("does not mutate its input", () => {
    const r0 = started();
    const snapshot = JSON.stringify(r0);
    minesReducer(r0, { type: "reveal", index: 1 });
    minesReducer(r0, { type: "reveal", index: 0 });
    expect(JSON.stringify(r0)).toBe(snapshot);
  });
});

describe("cashoutCents", () => {
  it("floors bet × multiplier / 100", () => {
    let r = started(INITIAL_MINES_ROUND, 101, 1, [24]);
    r = minesReducer(r, { type: "reveal", index: 0 });
    expect(cashoutCents(r)).toBe(Math.floor((101 * 103) / 100)); // 104
    expect(cashoutCents(INITIAL_MINES_ROUND)).toBe(0);
  });
});

describe("placeMines", () => {
  it("returns m distinct tiles in 0–24", () => {
    const rng = seededRng(6);
    for (let m = 1; m <= 24; m++) {
      const mines = placeMines(m, rng);
      expect(mines).toHaveLength(m);
      expect(new Set(mines).size).toBe(m);
      for (const t of mines) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(24);
      }
    }
    expect(() => placeMines(0, rng)).toThrow(RangeError);
    expect(() => placeMines(25, rng)).toThrow(RangeError);
  });
});
