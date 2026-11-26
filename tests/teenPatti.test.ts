import { describe, expect, it } from "vitest";
import { compareHands, dealHands, handName, type Card } from "../src/lib/logic/teenPatti";
import { seededRng } from "./helpers/fakeRng";

function card(rank: number, suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("Teen Patti", () => {
  it("deals two distinct hands from a single deck", () => {
    const rng = seededRng(168);
    for (let round = 0; round < 50; round++) {
      const { player, dealer } = dealHands(rng);
      expect(player).toHaveLength(3);
      expect(dealer).toHaveLength(3);
      expect(new Set([...player, ...dealer].map(({ rank, suit }) => `${rank}-${suit}`)).size).toBe(6);
    }
  });

  it("orders the six hand categories and breaks pair ties with the kicker", () => {
    const high = [card(14), card(8, "clubs"), card(2)] as const;
    const pair = [card(2), card(2, "hearts"), card(3)] as const;
    const color = [card(14), card(8), card(2)] as const;
    const sequence = [card(6), card(7, "clubs"), card(8)] as const;
    const pure = [card(6), card(7), card(8)] as const;
    const trail = [card(2), card(2, "hearts"), card(2, "clubs")] as const;
    const ordered = [high, pair, color, sequence, pure, trail];
    expect(ordered.map(handName)).toEqual(["High card", "Pair", "Color", "Sequence", "Pure sequence", "Trail"]);
    for (let index = 1; index < ordered.length; index++) {
      expect(compareHands(ordered[index], ordered[index - 1])).toBe(1);
    }
    expect(compareHands(pair, [card(2), card(2, "hearts"), card(4)])).toBe(-1);
  });

  it("places A-2-3 between A-K-Q and K-Q-J and ignores suits in ties", () => {
    const aceLow = [card(14), card(2), card(3)] as const;
    expect(compareHands(aceLow, [card(14), card(13), card(12)])).toBe(-1);
    expect(compareHands(aceLow, [card(13), card(12), card(11)])).toBe(1);
    expect(compareHands(aceLow, [card(3, "clubs"), card(14, "clubs"), card(2, "clubs")])).toBe(0);
  });
});
