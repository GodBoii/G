import { describe, expect, it } from "vitest";
import { COLUMNS, DOZENS, OUTSIDE_PICKS, matchesPocket, nextBallRotation, pocketColor, POCKET_ANGLE,
  spinRoulette, WHEEL_ORDER } from "../src/lib/logic/roulette";
import { sequenceRng } from "./helpers/fakeRng";

describe("European roulette", () => {
  it("has exactly one of each pocket and balanced red and black sets", () => {
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, index) => index));
    expect(WHEEL_ORDER.filter((number) => pocketColor(number) === "red")).toHaveLength(18);
    expect(WHEEL_ORDER.filter((number) => pocketColor(number) === "black")).toHaveLength(18);
  });

  it("matches direct picks, twelve-pocket groups and eighteen-pocket groups", () => {
    expect(matchesPocket(0, 0)).toBe(true);
    expect(matchesPocket(32, 0)).toBe(false);
    expect(matchesPocket(32, 32)).toBe(true);
    for (const { id } of [...DOZENS, ...COLUMNS, ...OUTSIDE_PICKS]) expect(matchesPocket(id, 0)).toBe(false);
    for (const { id } of [...DOZENS, ...COLUMNS]) {
      expect(WHEEL_ORDER.filter((number) => matchesPocket(id, number))).toHaveLength(12);
    }
    for (const { id } of OUTSIDE_PICKS) {
      expect(WHEEL_ORDER.filter((number) => matchesPocket(id, number))).toHaveLength(18);
    }
    expect(matchesPocket("red", 32)).toBe(true);
    expect(matchesPocket("column-2", 32)).toBe(true);
    expect(matchesPocket("column-3", 32)).toBe(false);
    expect(spinRoulette(sequenceRng([0]))).toEqual({ index: 0, number: 0 });
    expect(spinRoulette(sequenceRng([1]))).toEqual({ index: 1, number: 32 });
  });

  it("seats the counter-rotating ball in the drawn rotor pocket over successive spins", () => {
    let rotation = 0;
    for (let pocket = 0; pocket < WHEEL_ORDER.length; pocket++) {
      const next = nextBallRotation(rotation, pocket);
      expect(rotation - next).toBeGreaterThanOrEqual(1800);
      expect((next - pocket * POCKET_ANGLE) / 360).toBeCloseTo(Math.round((next - pocket * POCKET_ANGLE) / 360), 10);
      rotation = next;
    }
  });
});
