// Coin Flip: heads (0) or tails (1), correct call pays 1.98x.
import { cryptoRng, randomInt, type Rng } from "../rng";

export type CoinFace = "heads" | "tails";

/** Gross payout ×100 for a correct call (1.98x, RTP 99%). */
export const COIN_PAYOUT_X100 = 198;

export function flipCoin(rng: Rng = cryptoRng): CoinFace {
  return randomInt(0, 1, rng) === 0 ? "heads" : "tails";
}

/** Multiplier ×100 for a pick vs the landed face: 198 or 0. */
export function coinMultiplierX100(pick: CoinFace, face: CoinFace): number {
  return pick === face ? COIN_PAYOUT_X100 : 0;
}

function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

/** Next rotateY angle: five full turns past the current turn, +180 for tails. */
export function nextCoinRotation(currentDeg: number, face: CoinFace): number {
  const base = currentDeg - mod(currentDeg, 360) + 1800;
  return face === "tails" ? base + 180 : base;
}

export function faceAtRotation(deg: number): CoinFace {
  return mod(deg, 360) === 180 ? "tails" : "heads";
}
