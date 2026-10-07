import { describe, expect, it } from "vitest";
import { drawNumbers, settleNumbers, validNumberPick } from "../src/lib/logic/numbers";

describe("number draws", () => {
  it("preserves leading zeros and draws each digit independently", () => {
    const values = [0, 5, 0, 0, 7, 0, 5];
    const rng = { nextUint32: () => values.shift() ?? 0 };
    expect(drawNumbers("jodi", rng)).toBe("05");
    expect(drawNumbers("pick3", rng)).toBe("007");
    expect(drawNumbers("seven-up-down", rng)).toBe("16");
  });

  it("requires exact numeric inputs and order", () => {
    for (const pick of ["", "5", "123", "a5", " 5", "٥٥"]) expect(validNumberPick("jodi", pick)).toBe(false);
    expect(validNumberPick("jodi", "05")).toBe(true);
    expect(validNumberPick("pick3", "000")).toBe(true);
    expect(settleNumbers("jodi", "05", "05")).toBe(9500);
    expect(settleNumbers("jodi", "05", "50")).toBe(0);
    expect(settleNumbers("pick3", "007", "007")).toBe(95000);
    expect(settleNumbers("pick3", "007", "070")).toBe(0);
    expect(() => settleNumbers("pick3", "07", "007")).toThrow(RangeError);
    expect(() => settleNumbers("seven-up-down", "up", "07")).toThrow(RangeError);
  });

  it("settles all 36 dice outcomes with the advertised odds and 95% return", () => {
    for (const pick of ["down", "seven", "up"]) {
      let wins = 0;
      let total = 0;
      for (let a = 1; a <= 6; a++) {
        for (let b = 1; b <= 6; b++) {
          const payout = settleNumbers("seven-up-down", pick, `${a}${b}`);
          wins += Number(payout > 0);
          total += payout;
          if (a + b === 7 && pick !== "seven") expect(payout).toBe(0);
        }
      }
      expect(wins).toBe(pick === "seven" ? 6 : 15);
      expect(total / 36).toBe(95);
    }
  });
});
