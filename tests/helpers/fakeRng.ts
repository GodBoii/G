import type { Rng } from "../../src/lib/rng";

/** Replays exact uint32 values; throws when exhausted. */
export function sequenceRng(values: number[]): Rng & { remaining(): number } {
  let i = 0;
  return {
    nextUint32() {
      if (i >= values.length) throw new Error("sequenceRng exhausted");
      return values[i++] >>> 0;
    },
    remaining: () => values.length - i,
  };
}

/** Deterministic mulberry32 generator. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    nextUint32() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
  };
}
