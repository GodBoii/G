// Limbo: result = 0.99/(1−r) floored to 2 decimals, min 1.00x, cap 1,000,000.00x.
import { cryptoRng, randomFloat, type Rng } from "../rng";

export const LIMBO_MIN_TARGET_H = 101;
export const LIMBO_MAX_H = 100_000_000;
export const LIMBO_DEFAULT_TARGET_INPUT = "2.00";

const RANGE_ERROR = "Target must be between 1.01x and 1,000,000x";
const TOO_MANY_DECIMALS_RE = /^\d*\.\d{3,}$/;
const TARGET_RE = /^(\d{1,7}(\.\d{0,2})?|\.\d{1,2})$/;

export function parseMultiplierInput(text: string): { ok: true; hundredths: number } | { ok: false; error: string } {
  const t = text.trim();
  if (t === "") return { ok: false, error: "Enter a target multiplier" };
  if (TOO_MANY_DECIMALS_RE.test(t)) return { ok: false, error: "Use at most 2 decimal places" };
  if (!TARGET_RE.test(t)) return { ok: false, error: RANGE_ERROR };
  const [intPart, fracPart = ""] = t.split(".");
  const hundredths = Number(intPart === "" ? "0" : intPart) * 100 + Number(fracPart.padEnd(2, "0"));
  if (hundredths < LIMBO_MIN_TARGET_H || hundredths > LIMBO_MAX_H) return { ok: false, error: RANGE_ERROR };
  return { ok: true, hundredths };
}

/** r ∈ [0, 1) → result multiplier ×100. */
export function limboResultHundredths(r: number): number {
  const raw = Math.floor(99 / (1 - r));
  return Math.min(LIMBO_MAX_H, Math.max(100, raw));
}

export function rollLimbo(rng: Rng = cryptoRng): number {
  return limboResultHundredths(randomFloat(rng));
}

export function isLimboWin(resultH: number, targetH: number): boolean {
  return resultH >= targetH;
}

/** Win chance (99 / target %) as text with 2 decimals (floored), or "< 0.01%". */
export function limboWinChanceText(targetH: number): string {
  const basisPoints = Math.floor(990000 / targetH); // hundredths of a percent
  if (basisPoints < 1) return "< 0.01%";
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, "0")}%`;
}
