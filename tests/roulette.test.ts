import { describe, expect, it } from "vitest";
import { COLUMNS, DOZENS, EVEN_MONEY, nextWheelRotation, payoutMultiplier, pocketColor, POCKET_ANGLE,
  spinRoulette, WHEEL_ORDER } from "../src/lib/logic/roulette";
import { sequenceRng } from "./helpers/fakeRng";

describe("European roulette", () => {
  it("has exactly one of each pocket and balanced red and black sets", () => {
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, index) => index));
    expect(WHEEL_ORDER.filter((number) => pocketColor(number) === "red")).toHaveLength(18);
    expect(WHEEL_ORDER.filter((number) => pocketColor(number) === "black")).toHaveLength(18);
  });

  it("returns the standard gross payouts and excludes zero from outside bets", () => {
    for (const { id } of [...DOZENS, ...COLUMNS, ...EVEN_MONEY]) expect(payoutMultiplier(id, 0)).toBe(0);
    for (const { id } of [...DOZENS, ...COLUMNS]) {
      expect(WHEEL_ORDER.filter((number) => payoutMultiplier(id, number) === 3)).toHaveLength(12);
    }
    for (const { id } of EVEN_MONEY) {
      expect(WHEEL_ORDER.filter((number) => payoutMultiplier(id, number) === 2)).toHaveLength(18);
    }
    expect(spinRoulette([{ target: 0, cents: 100 }, { target: "red", cents: 400 }], sequenceRng([0])))
      .toEqual({ index: 0, number: 0, payout: 3600 });
    expect(spinRoulette([{ target: 32, cents: 100 }, { target: "red", cents: 400 }], sequenceRng([1])).payout)
      .toBe(4400);
  });

  it("lands the pointer on the drawn pocket over successive spins", () => {
    let rotation = 0;
    for (let pocket = 0; pocket < WHEEL_ORDER.length; pocket++) {
      const next = nextWheelRotation(rotation, pocket);
      expect(next - rotation).toBeGreaterThanOrEqual(1800);
      expect((next + pocket * POCKET_ANGLE) / 360).toBeCloseTo(Math.round((next + pocket * POCKET_ANGLE) / 360), 10);
      rotation = next;
    }
  });
});
