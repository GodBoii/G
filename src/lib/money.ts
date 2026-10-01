// Money is integer cents everywhere (1 credit = 100 cents). The UI only formats.
// Multipliers are passed as scaled integers, never floats, whenever money is computed.

export const START_BALANCE = 100_000; // 1,000.00 credits
export const TOP_UP_AMOUNT = 100_000; // +1,000.00
export const MIN_BET = 100; // 1.00 credit
export const MAX_BET = 100_000_000; // 1,000,000.00 credits (table limit)
export const MAX_BALANCE = 1_000_000_000_000_000; // 10 trillion credits, far below MAX_SAFE_INTEGER
export const DEFAULT_BET_INPUT = "10.00";
export const HISTORY_LIMIT = 20;

function isNonNegativeSafeInt(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

/**
 * Gross payout in cents for `betCents × numerator / denominator`, floored to the cent.
 * BigInt keeps the intermediate product exact. Throws RangeError on bad arguments.
 */
export function payoutFromMultiplier(betCents: number, numerator: number, denominator: number): number {
  if (!isNonNegativeSafeInt(betCents) || !isNonNegativeSafeInt(numerator) || !isNonNegativeSafeInt(denominator)) {
    throw new RangeError("payoutFromMultiplier: arguments must be non-negative safe integers");
  }
  if (denominator <= 0) throw new RangeError("payoutFromMultiplier: denominator must be > 0");
  return Number((BigInt(betCents) * BigInt(numerator)) / BigInt(denominator));
}

const BET_RE = /^(\d{1,12}(\.\d{0,2})?|\.\d{1,2})$/;
const TOO_MANY_DECIMALS_RE = /^\d*\.\d{3,}$/;

export type ParsedBet = { ok: true; cents: number } | { ok: false; error: string };

/** Parses user bet text with string math (no parseFloat × 100). */
export function parseBetInput(text: string): ParsedBet {
  const t = text.trim();
  if (t === "") return { ok: false, error: "Enter a bet amount" };
  if (TOO_MANY_DECIMALS_RE.test(t)) return { ok: false, error: "Use at most 2 decimal places" };
  if (!BET_RE.test(t)) return { ok: false, error: "Bet must be a positive number" };
  const [intPart, fracPart = ""] = t.split(".");
  const cents = Number(intPart === "" ? "0" : intPart) * 100 + Number(fracPart.padEnd(2, "0"));
  return { ok: true, cents };
}

/** First failing rule, or null. Only called once the balance is known. */
export function validateBet(cents: number, balanceCents: number): string | null {
  if (cents < MIN_BET) return "Minimum bet is 1.00";
  if (cents > MAX_BET) return "Maximum bet is 1,000,000.00";
  if (cents > balanceCents) return "Bet exceeds your balance";
  return null;
}

/** Cents → bet input text like "12.50" (no grouping, so it re-parses). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function baseCents(text: string): number {
  const parsed = parseBetInput(text);
  return parsed.ok ? parsed.cents : MIN_BET;
}

export function halveBet(text: string): string {
  return centsToInput(Math.max(MIN_BET, Math.floor(baseCents(text) / 2)));
}

export function doubleBet(text: string, balanceCents: number): string {
  return centsToInput(Math.max(MIN_BET, Math.min(baseCents(text) * 2, balanceCents, MAX_BET)));
}

export function maxBet(balanceCents: number): string {
  return centsToInput(Math.max(MIN_BET, Math.min(balanceCents, MAX_BET)));
}

const CREDITS_FORMAT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "1,234.56" — fixed en-US locale so server and client output match. */
export function formatCredits(cents: number): string {
  return CREDITS_FORMAT.format(cents / 100);
}

const SCALE_DIGITS: Record<1 | 10 | 100 | 10000, number> = { 1: 0, 10: 1, 100: 2, 10000: 4 };

/** The only multiplier formatter: integer math, ≥ 2 decimals, trailing zeros trimmed beyond 2. */
export function formatMultiplier(scaled: number, scale: 1 | 10 | 100 | 10000): string {
  if (!Number.isSafeInteger(scaled) || scaled < 0) {
    throw new RangeError("formatMultiplier: scaled must be a non-negative integer");
  }
  const d = SCALE_DIGITS[scale];
  if (d === undefined) throw new RangeError("formatMultiplier: unsupported scale");
  const int = Math.floor(scaled / scale);
  let frac = d === 0 ? "" : String(scaled % scale).padStart(d, "0");
  frac = frac.padEnd(2, "0");
  while (frac.length > 2 && frac.endsWith("0")) frac = frac.slice(0, -1);
  return `${INT_FORMAT.format(int)}.${frac}x`;
}
