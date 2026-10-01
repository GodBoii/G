import { describe, it, expect } from "vitest";
import {
  MATKA_PAYOUTS,
  ankOf,
  canonicalPanna,
  classifyPanna,
  drawMatka,
  formatMatkaResult,
  jodiOf,
  settleMatka,
  validateMatkaInput,
  type MatkaBet,
  type MatkaResult,
} from "../src/lib/logic/matka";
import { payoutFromMultiplier } from "../src/lib/money";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

const R: MatkaResult = { open: "137", close: "250" };

describe("canonicalPanna", () => {
  it.each([
    ["721", "127"],
    ["012", "120"],
    ["005", "500"],
    ["000", "000"],
    ["137", "137"],
    ["902", "290"],
    ["550", "550"],
    ["999", "999"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalPanna(input)).toBe(expected);
  });

  it("rejects non-3-digit input", () => {
    expect(() => canonicalPanna("12")).toThrow(RangeError);
    expect(() => canonicalPanna("abc")).toThrow(RangeError);
  });
});

describe("classify / ank / jodi / format", () => {
  it("classifies", () => {
    expect(classifyPanna("127")).toBe("single");
    expect(classifyPanna("112")).toBe("double");
    expect(classifyPanna("500")).toBe("double");
    expect(classifyPanna("777")).toBe("triple");
    expect(classifyPanna("000")).toBe("triple");
  });

  it("ank is digit sum mod 10; jodi is open ank + close ank", () => {
    expect(ankOf("137")).toBe(1);
    expect(ankOf("250")).toBe(7);
    expect(ankOf("000")).toBe(0);
    expect(ankOf("999")).toBe(7);
    expect(jodiOf(R)).toBe("17");
    expect(jodiOf({ open: "000", close: "500" })).toBe("05");
  });

  it("formats XXX-YY-XXX", () => {
    expect(formatMatkaResult(R)).toBe("137-17-250");
    expect(formatMatkaResult({ open: "000", close: "500" })).toBe("000-05-500");
  });
});

describe("drawMatka", () => {
  it("produces canonical pannas", () => {
    const rng = seededRng(55);
    for (let i = 0; i < 1000; i++) {
      const r = drawMatka(rng);
      for (const p of [r.open, r.close]) {
        expect(p).toMatch(/^\d{3}$/);
        expect(canonicalPanna(p)).toBe(p);
      }
      expect(formatMatkaResult(r)).toMatch(/^\d{3}-\d{2}-\d{3}$/);
    }
  });

  it("canonicalises the drawn digits", () => {
    expect(drawMatka(sequenceRng([7, 2, 1, 0, 5, 2]))).toEqual({ open: "127", close: "250" });
  });
});

describe("validateMatkaInput", () => {
  it("single", () => {
    expect(validateMatkaInput("single", "7")).toEqual({ ok: true, value: "7" });
    expect(validateMatkaInput("single", " 0 ")).toEqual({ ok: true, value: "0" });
    expect(validateMatkaInput("single", "")).toEqual({ ok: false, error: "Pick a digit from 0 to 9" });
    expect(validateMatkaInput("single", "12")).toEqual({ ok: false, error: "Pick a digit from 0 to 9" });
  });

  it("jodi", () => {
    expect(validateMatkaInput("jodi", "05")).toEqual({ ok: true, value: "05" });
    expect(validateMatkaInput("jodi", "5")).toEqual({ ok: false, error: "Enter two digits (00–99)" });
    expect(validateMatkaInput("jodi", "a5")).toEqual({ ok: false, error: "Enter two digits (00–99)" });
  });

  it("pannas", () => {
    expect(validateMatkaInput("singlePanna", "721")).toEqual({ ok: true, value: "127" });
    expect(validateMatkaInput("doublePanna", "005")).toEqual({ ok: true, value: "500" });
    expect(validateMatkaInput("triplePanna", "000")).toEqual({ ok: true, value: "000" });
    expect(validateMatkaInput("singlePanna", "12")).toEqual({ ok: false, error: "Enter three digits" });
    expect(validateMatkaInput("triplePanna", "1234")).toEqual({ ok: false, error: "Enter three digits" });
    expect(validateMatkaInput("singlePanna", "112")).toEqual({
      ok: false,
      error: "112 is a Double Panna, not a Single Panna",
    });
    expect(validateMatkaInput("doublePanna", "777")).toEqual({
      ok: false,
      error: "777 is a Triple Panna, not a Double Panna",
    });
    expect(validateMatkaInput("doublePanna", "123")).toEqual({
      ok: false,
      error: "123 is a Single Panna, not a Double Panna",
    });
    expect(validateMatkaInput("triplePanna", "211")).toEqual({
      ok: false,
      error: "112 is a Double Panna, not a Triple Panna",
    });
  });
});

describe("settleMatka", () => {
  const cases: [MatkaBet, MatkaResult, number][] = [
    // single, open side ank 1 / close side ank 7
    [{ type: "single", side: "open", value: "1" }, R, 9],
    [{ type: "single", side: "open", value: "7" }, R, 0],
    [{ type: "single", side: "close", value: "7" }, R, 9],
    [{ type: "single", side: "close", value: "1" }, R, 0],
    // jodi
    [{ type: "jodi", side: null, value: "17" }, R, 90],
    [{ type: "jodi", side: null, value: "71" }, R, 0],
    // single panna
    [{ type: "singlePanna", side: "open", value: "137" }, R, 140],
    [{ type: "singlePanna", side: "close", value: "137" }, R, 0],
    [{ type: "singlePanna", side: "close", value: "250" }, R, 140],
    [{ type: "singlePanna", side: "open", value: "250" }, R, 0],
    // double panna
    [{ type: "doublePanna", side: "open", value: "500" }, { open: "500", close: "127" }, 280],
    [{ type: "doublePanna", side: "close", value: "500" }, { open: "500", close: "127" }, 0],
    [{ type: "doublePanna", side: "close", value: "112" }, { open: "500", close: "112" }, 280],
    [{ type: "doublePanna", side: "open", value: "112" }, { open: "500", close: "112" }, 0],
    // triple panna
    [{ type: "triplePanna", side: "open", value: "777" }, { open: "777", close: "000" }, 600],
    [{ type: "triplePanna", side: "close", value: "000" }, { open: "777", close: "000" }, 600],
    [{ type: "triplePanna", side: "close", value: "777" }, { open: "777", close: "000" }, 0],
    [{ type: "triplePanna", side: "open", value: "000" }, { open: "777", close: "000" }, 0],
  ];

  it.each(cases)("%j vs %j → %d", (bet, result, expected) => {
    expect(settleMatka(bet, result)).toBe(expected);
  });

  it("payout = bet × multiplier", () => {
    expect(payoutFromMultiplier(1000, settleMatka({ type: "jodi", side: null, value: "17" }, R), 1)).toBe(90_000);
    expect(MATKA_PAYOUTS).toEqual({ single: 9, jodi: 90, singlePanna: 140, doublePanna: 280, triplePanna: 600 });
  });

  it("throws RangeError on malformed bets", () => {
    expect(() => settleMatka({ type: "single", side: null, value: "1" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "jodi", side: "open", value: "17" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "single", side: "open", value: "12" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "jodi", side: null, value: "1" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "singlePanna", side: "open", value: "721" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "singlePanna", side: "open", value: "112" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "doublePanna", side: "close", value: "777" }, R)).toThrow(RangeError);
    expect(() => settleMatka({ type: "triplePanna", side: "open", value: " 777" }, R)).toThrow(RangeError);
  });
});
