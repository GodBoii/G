import { randomInt, type Rng, cryptoRng } from "@/lib/rng";

export type NumberGameKind = "jodi" | "pick3" | "seven-up-down";
export type SevenPick = "down" | "seven" | "up";

export const NUMBER_RULES = {
  jodi: { digits: 2, multiplierX100: 9500, chance: "1 in 100", instruction: "Match both digits in order. Leading zeros count.", rtp: "95%" },
  pick3: { digits: 3, multiplierX100: 95000, chance: "1 in 1,000", instruction: "Match all three digits in exact order. Repeated digits and leading zeros count.", rtp: "95%" },
  "seven-up-down": { digits: 2, multiplierX100: 228, chance: "15 in 36", instruction: "Roll two dice. Pick a total below 7, exactly 7, or above 7.", rtp: "95%" },
} as const;

export function validNumberPick(kind: NumberGameKind, pick: string): boolean {
  if (kind === "seven-up-down") return pick === "down" || pick === "seven" || pick === "up";
  return new RegExp(`^[0-9]{${NUMBER_RULES[kind].digits}}$`).test(pick);
}

export function numberMultiplierX100(kind: NumberGameKind, pick: string): number {
  return kind === "seven-up-down" && pick === "seven" ? 570 : NUMBER_RULES[kind].multiplierX100;
}

export function drawNumbers(kind: NumberGameKind, rng: Rng = cryptoRng): string {
  if (kind === "seven-up-down") return `${randomInt(1, 6, rng)}${randomInt(1, 6, rng)}`;
  return Array.from({ length: NUMBER_RULES[kind].digits }, () => randomInt(0, 9, rng)).join("");
}

export function settleNumbers(kind: NumberGameKind, pick: string, draw: string): number {
  if (!validNumberPick(kind, pick)) throw new RangeError("Invalid number selection");
  const pattern = kind === "seven-up-down" ? /^[1-6]{2}$/ : new RegExp(`^[0-9]{${NUMBER_RULES[kind].digits}}$`);
  if (!pattern.test(draw)) throw new RangeError("Invalid number draw");
  const total = Number(draw[0]) + Number(draw[1]);
  const outcome: SevenPick = total < 7 ? "down" : total === 7 ? "seven" : "up";
  const won = kind === "seven-up-down" ? pick === outcome : pick === draw;
  return won ? numberMultiplierX100(kind, pick) : 0;
}

export function describeNumberDraw(kind: NumberGameKind, draw: string): string {
  return kind === "seven-up-down" ? `${draw[0]} + ${draw[1]} = ${Number(draw[0]) + Number(draw[1])}` : draw;
}
