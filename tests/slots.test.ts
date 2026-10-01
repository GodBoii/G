import { describe, it, expect } from "vitest";
import {
  INITIAL_GRID,
  SLOT_PAYLINES,
  SLOT_SYMBOLS,
  SLOT_SYMBOL_BY_ID,
  evaluateLines,
  spinGrid,
  type SymbolId,
} from "../src/lib/logic/slots";
import { payoutFromMultiplier } from "../src/lib/money";
import { seededRng } from "./helpers/fakeRng";

/** Build a grid from a 3-row × 5-reel picture (rows[row][reel]). */
function fromRows(rows: SymbolId[][]): SymbolId[][] {
  return Array.from({ length: 5 }, (_, reel) => [rows[0][reel], rows[1][reel], rows[2][reel]]);
}

const FILL: SymbolId[][] = [
  ["lemon", "grape", "bell", "star", "diamond"],
  ["grape", "bell", "star", "diamond", "seven"],
  ["bell", "star", "diamond", "seven", "lemon"],
];

describe("tables", () => {
  it("weights total 100 and paytable matches the design", () => {
    expect(SLOT_SYMBOLS.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(SLOT_SYMBOLS.map((s) => [s.id, s.weight, ...s.payTenths])).toEqual([
      ["cherry", 30, 4, 20, 50],
      ["lemon", 24, 10, 30, 100],
      ["grape", 18, 20, 60, 200],
      ["bell", 12, 40, 150, 500],
      ["star", 8, 100, 400, 1500],
      ["diamond", 5, 200, 1000, 4000],
      ["seven", 3, 500, 2500, 10000],
    ]);
  });

  it("has 10 paylines of length 5 with rows in 0–2", () => {
    expect(SLOT_PAYLINES).toHaveLength(10);
    for (const line of SLOT_PAYLINES) {
      expect(line).toHaveLength(5);
      for (const r of line) expect([0, 1, 2]).toContain(r);
    }
    expect(SLOT_PAYLINES[3]).toEqual([0, 1, 2, 1, 0]);
    expect(SLOT_PAYLINES[9]).toEqual([1, 0, 1, 2, 1]);
  });

  it("INITIAL_GRID is 5×3 with no winning line", () => {
    expect(INITIAL_GRID).toHaveLength(5);
    for (const col of INITIAL_GRID) expect(col).toHaveLength(3);
    const r = evaluateLines(INITIAL_GRID);
    expect(r.totalTenths).toBe(0);
    expect(r.wins).toEqual([]);
  });
});

describe("evaluateLines", () => {
  it("pays 3, 4, and 5 in a row from reel 1", () => {
    const three = fromRows([FILL[0], ["cherry", "cherry", "cherry", "lemon", "grape"], FILL[2]]);
    const r3 = evaluateLines(three);
    expect(r3.wins).toEqual([{ line: 1, symbol: "cherry", count: 3, tenths: 4, cells: [[0, 1], [1, 1], [2, 1]] }]);
    expect(r3.totalTenths).toBe(4);

    const four = fromRows([["star", "star", "star", "star", "lemon"], ["grape", "bell", "lemon", "diamond", "seven"], FILL[2]]);
    const r4 = evaluateLines(four);
    expect(r4.wins.map((w) => [w.line, w.symbol, w.count, w.tenths])).toEqual([[2, "star", 4, 400]]);

    const five = fromRows([FILL[0], FILL[1], ["seven", "seven", "seven", "seven", "seven"]]);
    const r5 = evaluateLines(five);
    expect(r5.wins.map((w) => [w.line, w.symbol, w.count, w.tenths])).toEqual([[3, "seven", 5, 10000]]);
    expect(r5.wins[0].cells).toEqual([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]);
  });

  it("does not pay non-consecutive matches", () => {
    const top: SymbolId[] = ["lemon", "grape", "grape", "star", "diamond"];
    const grid = fromRows([top, ["bell", "bell", "lemon", "bell", "bell"], FILL[2]]);
    expect(evaluateLines(grid).totalTenths).toBe(0);
    const notFromLeft = fromRows([top, ["lemon", "bell", "bell", "bell", "bell"], FILL[2]]);
    expect(evaluateLines(notFromLeft).totalTenths).toBe(0);
  });

  it("adds wins on multiple lines", () => {
    // All cherries: every one of the 10 lines pays 5× cherry.
    const all = Array.from({ length: 5 }, () => ["cherry", "cherry", "cherry"] as SymbolId[]);
    const r = evaluateLines(all);
    expect(r.wins).toHaveLength(10);
    expect(r.totalTenths).toBe(500);
    expect(payoutFromMultiplier(1000, r.totalTenths, 10)).toBe(50000);

    // Top row diamonds ×3 (line 2) + V-shape line 4 (0,1,2,1,0) shares the first cell.
    const grid = fromRows([
      ["diamond", "diamond", "diamond", "lemon", "grape"],
      ["grape", "diamond", "star", "diamond", "seven"],
      ["bell", "star", "diamond", "seven", "lemon"],
    ]);
    const m = evaluateLines(grid);
    expect(m.wins.map((w) => [w.line, w.count])).toEqual([
      [2, 3],
      [4, 4],
    ]);
    expect(m.totalTenths).toBe(200 + 1000);
  });

  it("spinGrid returns 5×3 valid symbols", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 200; i++) {
      const g = spinGrid(rng);
      expect(g).toHaveLength(5);
      for (const col of g) {
        expect(col).toHaveLength(3);
        for (const s of col) expect(SLOT_SYMBOL_BY_ID[s]).toBeDefined();
      }
    }
  });
});

describe("RTP", () => {
  it("is 96.99% ± 0.01 exactly (per line, linear over lines)", () => {
    let rtp = 0;
    for (const s of SLOT_SYMBOLS) {
      const p = s.weight / 100;
      const [a3, a4, a5] = s.payTenths;
      rtp += p ** 3 * (1 - p) * a3 + p ** 4 * (1 - p) * a4 + p ** 5 * a5;
    }
    expect(Math.abs(rtp * 100 - 96.99)).toBeLessThanOrEqual(0.01);
  });
});
