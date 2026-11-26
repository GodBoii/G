import { sampleWithoutReplacement, type Rng } from "../rng";

const SUITS = ["spades", "hearts", "clubs", "diamonds"] as const;
export type Suit = (typeof SUITS)[number];
export type Card = { rank: number; suit: Suit };
type Hand = readonly [Card, Card, Card];

const deck = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit })));

export const HAND_RANKS = [
  { name: "High card", description: "Highest card, then the next two" },
  { name: "Pair", description: "Two cards of the same rank" },
  { name: "Color", description: "Three cards of the same suit" },
  { name: "Sequence", description: "Three consecutive ranks" },
  { name: "Pure sequence", description: "A sequence in the same suit" },
  { name: "Trail", description: "Three cards of the same rank" },
] as const;

export function rankHand(hand: Hand) {
  const [high, middle, low] = hand.map(({ rank }) => rank).sort((a, b) => b - a);
  const flush = hand.every(({ suit }) => suit === hand[0].suit);
  const aceLow = high === 14 && middle === 3 && low === 2;
  const run = high - middle === 1 && middle - low === 1;

  if (high === low) return { category: 5, tie: [high] };
  if (run || aceLow) {
    const strength = aceLow ? 13 : high === 14 ? 14 : high - 1;
    return { category: flush ? 4 : 3, tie: [strength] };
  }
  if (flush) return { category: 2, tie: [high, middle, low] };
  if (high === middle) return { category: 1, tie: [high, low] };
  if (middle === low) return { category: 1, tie: [middle, high] };
  return { category: 0, tie: [high, middle, low] };
}

export function handName(hand: Hand): string {
  return HAND_RANKS[rankHand(hand).category].name;
}

export function compareHands(player: Hand, dealer: Hand): number {
  const a = rankHand(player);
  const b = rankHand(dealer);
  if (a.category !== b.category) return Math.sign(a.category - b.category);
  for (let index = 0; index < a.tie.length; index++) {
    if (a.tie[index] !== b.tie[index]) return Math.sign(a.tie[index] - b.tie[index]);
  }
  return 0;
}

export function dealHands(rng?: Rng) {
  const [playerFirst, dealerFirst, playerSecond, dealerSecond, playerThird, dealerThird] =
    sampleWithoutReplacement(deck, 6, rng);
  const player: Hand = [playerFirst, playerSecond, playerThird];
  const dealer: Hand = [dealerFirst, dealerSecond, dealerThird];
  return { player, dealer };
}
