import { describe, it, expect } from "vitest";
import {
  COIN_PAYOUT_X100,
  coinMultiplierX100,
  faceAtRotation,
  flipCoin,
  nextCoinRotation,
  type CoinFace,
} from "../src/lib/logic/coinflip";
import { payoutFromMultiplier } from "../src/lib/money";
import { seededRng, sequenceRng } from "./helpers/fakeRng";

describe("flipCoin", () => {
  it("0 → heads, 1 → tails", () => {
    expect(flipCoin(sequenceRng([0]))).toBe("heads");
    expect(flipCoin(sequenceRng([1]))).toBe("tails");
  });

  it("produces both faces", () => {
    const rng = seededRng(8);
    const seen = new Set<CoinFace>();
    for (let i = 0; i < 100; i++) seen.add(flipCoin(rng));
    expect(seen.size).toBe(2);
  });
});

describe("payout", () => {
  it("pays 1.98x on a correct call, 0 otherwise", () => {
    expect(COIN_PAYOUT_X100).toBe(198);
    expect(coinMultiplierX100("heads", "heads")).toBe(198);
    expect(coinMultiplierX100("heads", "tails")).toBe(0);
    expect(payoutFromMultiplier(1000, coinMultiplierX100("tails", "tails"), 100)).toBe(1980);
  });
});

describe("rotation", () => {
  it("lands on the outcome face, increases by ≥ 1440°, and is a multiple of 180", () => {
    const rng = seededRng(21);
    let deg = 0;
    for (let i = 0; i < 500; i++) {
      const face = flipCoin(rng);
      const next = nextCoinRotation(deg, face);
      expect(faceAtRotation(next)).toBe(face);
      expect(next - deg).toBeGreaterThanOrEqual(1440);
      expect(next % 180).toBe(0);
      deg = next;
    }
  });

  it("matches the formula", () => {
    expect(nextCoinRotation(0, "heads")).toBe(1800);
    expect(nextCoinRotation(0, "tails")).toBe(1980);
    expect(nextCoinRotation(1980, "heads")).toBe(3600);
    expect(nextCoinRotation(1980, "tails")).toBe(3780);
  });

  it("faceAtRotation", () => {
    expect(faceAtRotation(0)).toBe("heads");
    expect(faceAtRotation(180)).toBe("tails");
    expect(faceAtRotation(1980)).toBe("tails");
    expect(faceAtRotation(3600)).toBe("heads");
  });
});
