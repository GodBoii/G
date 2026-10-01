import { describe, it, expect } from "vitest";
import {
  DEFAULT_BET_INPUT,
  HISTORY_LIMIT,
  MAX_BALANCE,
  MAX_BET,
  MIN_BET,
  START_BALANCE,
  TOP_UP_AMOUNT,
  doubleBet,
  formatCredits,
  formatMultiplier,
  halveBet,
  maxBet,
  parseBetInput,
  payoutFromMultiplier,
  validateBet,
} from "../src/lib/money";

describe("constants", () => {
  it("match the design", () => {
    expect(START_BALANCE).toBe(100_000);
    expect(TOP_UP_AMOUNT).toBe(100_000);
    expect(MIN_BET).toBe(100);
    expect(MAX_BET).toBe(100_000_000);
    expect(MAX_BALANCE).toBe(1_000_000_000_000_000);
    expect(DEFAULT_BET_INPUT).toBe("10.00");
    expect(HISTORY_LIMIT).toBe(20);
  });
});

describe("parseBetInput", () => {
  const POSITIVE = "Bet must be a positive number";
  it.each([
    ["", { ok: false, error: "Enter a bet amount" }],
    ["   ", { ok: false, error: "Enter a bet amount" }],
    ["0", { ok: true, cents: 0 }],
    ["-5", { ok: false, error: POSITIVE }],
    ["abc", { ok: false, error: POSITIVE }],
    ["1e3", { ok: false, error: POSITIVE }],
    ["1,000", { ok: false, error: POSITIVE }],
    ["1.2.3", { ok: false, error: POSITIVE }],
    ["1234567890123", { ok: false, error: POSITIVE }],
    ["10.555", { ok: false, error: "Use at most 2 decimal places" }],
    [".555", { ok: false, error: "Use at most 2 decimal places" }],
    ["10", { ok: true, cents: 1000 }],
    ["10.", { ok: true, cents: 1000 }],
    ["10.5", { ok: true, cents: 1050 }],
    [".5", { ok: true, cents: 50 }],
    ["12.34", { ok: true, cents: 1234 }],
    [" 7.05 ", { ok: true, cents: 705 }],
    ["999999999999.99", { ok: true, cents: 99999999999999 }],
  ])("%j", (input, expected) => {
    expect(parseBetInput(input)).toEqual(expected);
  });
});

describe("validateBet", () => {
  it("applies min, max, and balance rules in order", () => {
    expect(validateBet(0, 100_000)).toBe("Minimum bet is 1.00");
    expect(validateBet(99, 100_000)).toBe("Minimum bet is 1.00");
    expect(validateBet(100, 100_000)).toBeNull();
    expect(validateBet(100_000, 100_000)).toBeNull();
    expect(validateBet(100_001, 100_000)).toBe("Bet exceeds your balance");
    expect(validateBet(MAX_BET + 1, MAX_BALANCE)).toBe("Maximum bet is 1,000,000.00");
    expect(validateBet(MAX_BET, MAX_BALANCE)).toBeNull();
    expect(validateBet(50, 10)).toBe("Minimum bet is 1.00");
  });
});

describe("½ / 2x / Max", () => {
  it("halves without going below the minimum", () => {
    expect(halveBet("25.00")).toBe("12.50");
    expect(halveBet("1.50")).toBe("1.00");
    expect(halveBet("0.03")).toBe("1.00");
    expect(halveBet("abc")).toBe("1.00");
    expect(halveBet("10.01")).toBe("5.00");
  });

  it("doubles, capped by balance and MAX_BET, never below the minimum", () => {
    expect(doubleBet("10.00", 100_000)).toBe("20.00");
    expect(doubleBet("600.00", 100_000)).toBe("1000.00");
    expect(doubleBet("abc", 100_000)).toBe("2.00");
    expect(doubleBet("900000.00", MAX_BALANCE)).toBe("1000000.00");
    expect(doubleBet("10.00", 50)).toBe("1.00");
  });

  it("Max uses the balance capped at MAX_BET, never below the minimum", () => {
    expect(maxBet(123_456)).toBe("1234.56");
    expect(maxBet(MAX_BALANCE)).toBe("1000000.00");
    expect(maxBet(5)).toBe("1.00");
    expect(maxBet(0)).toBe("1.00");
  });

  it("returns strings that re-parse to the same cents", () => {
    for (const s of [halveBet("33.33"), doubleBet("33.33", 100_000), maxBet(98_765)]) {
      const p = parseBetInput(s);
      expect(p.ok).toBe(true);
    }
    expect(parseBetInput(maxBet(98_765))).toEqual({ ok: true, cents: 98_765 });
  });
});

describe("payoutFromMultiplier", () => {
  it("floors to the cent", () => {
    expect(payoutFromMultiplier(100, 2, 10)).toBe(20); // 1.00 × 0.2x
    expect(payoutFromMultiplier(101, 19800, 10000)).toBe(199); // 1.01 × 1.98x = 1.9998
    expect(payoutFromMultiplier(1000, 198, 100)).toBe(1980);
    expect(payoutFromMultiplier(333, 1, 3)).toBe(111);
    expect(payoutFromMultiplier(1, 99, 100)).toBe(0);
    expect(payoutFromMultiplier(0, 500, 1)).toBe(0);
    expect(payoutFromMultiplier(1000, 0, 10)).toBe(0);
  });

  it("is exact for large values", () => {
    // max bet × mines (24 mines… bounded) style large multipliers
    expect(payoutFromMultiplier(MAX_BET, 520_000_000, 100)).toBe(520_000_000_000_000);
    expect(payoutFromMultiplier(MAX_BET, 100_000_000, 100)).toBe(100_000_000_000_000);
    expect(payoutFromMultiplier(Number.MAX_SAFE_INTEGER, 3, 3)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws RangeError on bad arguments", () => {
    expect(() => payoutFromMultiplier(-1, 1, 1)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(1.5, 1, 1)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(1, -1, 1)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(1, 1.5, 1)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(1, 1, 0)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(1, 1, -1)).toThrow(RangeError);
    expect(() => payoutFromMultiplier(Number.MAX_SAFE_INTEGER + 1, 1, 1)).toThrow(RangeError);
  });
});

describe("formatCredits", () => {
  it("uses en-US grouping with 2 decimals", () => {
    expect(formatCredits(0)).toBe("0.00");
    expect(formatCredits(5)).toBe("0.05");
    expect(formatCredits(100_000)).toBe("1,000.00");
    expect(formatCredits(123_456_789)).toBe("1,234,567.89");
    expect(formatCredits(MAX_BALANCE)).toBe("10,000,000,000,000.00");
  });
});

describe("formatMultiplier", () => {
  it.each([
    [19800, 10000, "1.98x"],
    [10102, 10000, "1.0102x"],
    [495000, 10000, "49.50x"],
    [2475, 100, "24.75x"],
    [5, 10, "0.50x"],
    [9, 1, "9.00x"],
    [100_000_000, 100, "1,000,000.00x"],
    [103, 100, "1.03x"],
    [15, 10, "1.50x"],
    [10000, 10000, "1.00x"],
    [12345, 10000, "1.2345x"],
    [12340, 10000, "1.234x"],
    [0, 100, "0.00x"],
  ] as const)("(%d, %d) → %s", (scaled, scale, expected) => {
    expect(formatMultiplier(scaled, scale)).toBe(expected);
  });

  it("throws RangeError on non-integer or negative input", () => {
    expect(() => formatMultiplier(1.5, 10)).toThrow(RangeError);
    expect(() => formatMultiplier(-1, 10)).toThrow(RangeError);
  });
});
