// Satta Matka simulation: two pannas (open/close) per draw, demo credits only.
import { cryptoRng, randomInt, type Rng } from "../rng";

export type MatkaBetType = "single" | "jodi" | "singlePanna" | "doublePanna" | "triplePanna";
export type MatkaSide = "open" | "close";
export type PannaClass = "single" | "double" | "triple";

export interface MatkaBet {
  type: MatkaBetType;
  side: MatkaSide | null; // null only (and always) for "jodi"
  value: string; // canonical: "0".."9" | "00".."99" | canonical 3-digit panna
}

export interface MatkaResult {
  open: string;
  close: string;
} // canonical pannas

// | Bet | Input | Wins when | Pays (gross) | RTP |
// | Single | digit 0–9 | the chosen side's ank equals the digit | 9x | 90% |
// | Jodi | 2 digits 00–99 | open ank + close ank equals the input | 90x | 90% |
// | Single Panna | 3 distinct digits | the chosen side's panna equals the canonical input | 140x | 84% |
// | Double Panna | exactly two equal digits | the same | 280x | 84% |
// | Triple Panna | three equal digits | the same | 600x | 60% |
export const MATKA_PAYOUTS = { single: 9, jodi: 90, singlePanna: 140, doublePanna: 280, triplePanna: 600 } as const;

export const MATKA_RTP_PERCENT = { single: 90, jodi: 90, singlePanna: 84, doublePanna: 84, triplePanna: 60 } as const;

export const MATKA_BET_TYPES: readonly MatkaBetType[] = ["single", "jodi", "singlePanna", "doublePanna", "triplePanna"];

export const MATKA_BET_LABELS: Readonly<Record<MatkaBetType, string>> = {
  single: "Single",
  jodi: "Jodi",
  singlePanna: "Single Panna",
  doublePanna: "Double Panna",
  triplePanna: "Triple Panna",
};

const PANNA_CLASS_LABEL: Readonly<Record<PannaClass, string>> = { single: "Single", double: "Double", triple: "Triple" };

const PANNA_TYPE_CLASS: Readonly<Record<"singlePanna" | "doublePanna" | "triplePanna", PannaClass>> = {
  singlePanna: "single",
  doublePanna: "double",
  triplePanna: "triple",
};

const PANNA_RE = /^\d{3}$/;

/** Sort digits ascending with 0 treated as 10: 721 → 127, 012 → 120, 005 → 500, 000 → 000. */
export function canonicalPanna(s: string): string {
  if (!PANNA_RE.test(s)) throw new RangeError("matka: panna must be 3 digits");
  return s
    .split("")
    .map(Number)
    .sort((a, b) => (a === 0 ? 10 : a) - (b === 0 ? 10 : b))
    .join("");
}

export function classifyPanna(s: string): PannaClass {
  if (!PANNA_RE.test(s)) throw new RangeError("matka: panna must be 3 digits");
  const distinct = new Set(s.split("")).size;
  return distinct === 3 ? "single" : distinct === 2 ? "double" : "triple";
}

/** Sum of the panna's digits mod 10. */
export function ankOf(panna: string): number {
  if (!PANNA_RE.test(panna)) throw new RangeError("matka: panna must be 3 digits");
  return panna.split("").reduce((sum, d) => sum + Number(d), 0) % 10;
}

export function jodiOf(r: MatkaResult): string {
  return `${ankOf(r.open)}${ankOf(r.close)}`;
}

function drawPanna(rng: Rng): string {
  return canonicalPanna(`${randomInt(0, 9, rng)}${randomInt(0, 9, rng)}${randomInt(0, 9, rng)}`);
}

export function drawMatka(rng: Rng = cryptoRng): MatkaResult {
  const open = drawPanna(rng);
  const close = drawPanna(rng);
  return { open, close };
}

/** "137-17-250" */
export function formatMatkaResult(r: MatkaResult): string {
  return `${r.open}-${jodiOf(r)}-${r.close}`;
}

export function validateMatkaInput(
  type: MatkaBetType,
  text: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const t = text.trim();
  if (type === "single") {
    return /^\d$/.test(t) ? { ok: true, value: t } : { ok: false, error: "Pick a digit from 0 to 9" };
  }
  if (type === "jodi") {
    return /^\d{2}$/.test(t) ? { ok: true, value: t } : { ok: false, error: "Enter two digits (00–99)" };
  }
  if (!PANNA_RE.test(t)) return { ok: false, error: "Enter three digits" };
  const canonical = canonicalPanna(t);
  const actual = classifyPanna(canonical);
  const expected = PANNA_TYPE_CLASS[type];
  if (actual !== expected) {
    return {
      ok: false,
      error: `${canonical} is a ${PANNA_CLASS_LABEL[actual]} Panna, not a ${PANNA_CLASS_LABEL[expected]} Panna`,
    };
  }
  return { ok: true, value: canonical };
}

/** Gross multiplier for a bet against a draw. Throws RangeError for malformed bets. */
export function settleMatka(bet: MatkaBet, result: MatkaResult): 0 | 9 | 90 | 140 | 280 | 600 {
  if (bet.type === "jodi") {
    if (bet.side !== null) throw new RangeError("matka: jodi bets have no side");
  } else if (bet.side !== "open" && bet.side !== "close") {
    throw new RangeError("matka: this bet type needs a side");
  }
  const checked = validateMatkaInput(bet.type, bet.value);
  if (!checked.ok || checked.value !== bet.value) throw new RangeError("matka: bet value is not valid and canonical");

  switch (bet.type) {
    case "single":
      return ankOf(result[bet.side as MatkaSide]) === Number(bet.value) ? MATKA_PAYOUTS.single : 0;
    case "jodi":
      return jodiOf(result) === bet.value ? MATKA_PAYOUTS.jodi : 0;
    default:
      return result[bet.side as MatkaSide] === bet.value ? MATKA_PAYOUTS[bet.type] : 0;
  }
}
