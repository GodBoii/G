// All randomness comes from here (crypto.getRandomValues). No other random source is allowed in src/.

export interface Rng {
  /** Uniform integer in [0, 2^32). */
  nextUint32(): number;
}

export const RNG_UNAVAILABLE = "Secure random generator unavailable";

const POOL_SIZE = 64;
let pool: Uint32Array | null = null;
let poolIndex = POOL_SIZE;

/** Pooled crypto.getRandomValues. The pool is allocated lazily, never at module load (SSR-safe). */
export const cryptoRng: Rng = {
  nextUint32(): number {
    if (poolIndex >= POOL_SIZE || pool === null) {
      const c = globalThis.crypto;
      if (!c || typeof c.getRandomValues !== "function") throw new Error(RNG_UNAVAILABLE);
      if (pool === null) pool = new Uint32Array(POOL_SIZE);
      c.getRandomValues(pool);
      poolIndex = 0;
    }
    return pool[poolIndex++];
  },
};

const TWO_26 = 67_108_864;
const TWO_32 = 4_294_967_296;
const TWO_53 = 9_007_199_254_740_992;

/** Uniform float in [0, 1) with 53 bits of randomness. */
export function randomFloat(rng: Rng = cryptoRng): number {
  const a = rng.nextUint32() >>> 5;
  const b = rng.nextUint32() >>> 6;
  return (a * TWO_26 + b) / TWO_53;
}

/** Uniform integer in [min, max] (inclusive) via rejection sampling (no modulo bias). */
export function randomInt(min: number, max: number, rng: Rng = cryptoRng): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RangeError("randomInt: min and max must be integers");
  }
  if (max < min) throw new RangeError("randomInt: max must be >= min");
  const span = max - min + 1;
  if (span > TWO_32) throw new RangeError("randomInt: span must be <= 2^32");
  const limit = TWO_32 - (TWO_32 % span);
  let x = rng.nextUint32();
  while (x >= limit) x = rng.nextUint32();
  return min + (x % span);
}

/** Fisher–Yates shuffle on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i, rng);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** k distinct items, in random order (partial Fisher–Yates). */
export function sampleWithoutReplacement<T>(items: readonly T[], k: number, rng: Rng = cryptoRng): T[] {
  if (!Number.isInteger(k) || k < 0 || k > items.length) {
    throw new RangeError("sampleWithoutReplacement: k must be an integer in 0..items.length");
  }
  const pool = items.slice();
  for (let i = 0; i < k; i++) {
    const j = randomInt(i, pool.length - 1, rng);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, k);
}

/** Index drawn proportionally to non-negative integer weights (sum > 0). */
export function weightedIndex(weights: readonly number[], rng: Rng = cryptoRng): number {
  let total = 0;
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) throw new RangeError("weightedIndex: weights must be non-negative integers");
    total += w;
  }
  if (total <= 0) throw new RangeError("weightedIndex: weights must sum to > 0");
  const r = randomInt(0, total - 1, rng);
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (cum > r) return i;
  }
  // Unreachable: cum reaches total > r.
  throw new RangeError("weightedIndex: unreachable");
}

/** Error banner text for a failed play handler (§9). */
export function playErrorMessage(e: unknown): string {
  return e instanceof Error && e.message === RNG_UNAVAILABLE
    ? "Secure random numbers are unavailable in this browser"
    : "Something went wrong. Your bet was not placed.";
}
