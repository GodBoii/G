import { randomInt, type Rng } from "../rng";

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function pocketColor(number: number) {
  if (number === 0) return "green";
  return red.has(number) ? "red" : "black";
}

export const DOZENS = [
  { id: "first", label: "1st 12" },
  { id: "second", label: "2nd 12" },
  { id: "third", label: "3rd 12" },
] as const;

export const COLUMNS = [
  { id: "column-1", label: "Col 1" },
  { id: "column-2", label: "Col 2" },
  { id: "column-3", label: "Col 3" },
] as const;

export const EVEN_MONEY = [
  { id: "low", label: "1–18" },
  { id: "even", label: "Even" },
  { id: "red", label: "Red" },
  { id: "black", label: "Black" },
  { id: "odd", label: "Odd" },
  { id: "high", label: "19–36" },
] as const;

const outsideBets = [...DOZENS, ...COLUMNS, ...EVEN_MONEY];
export type BetTarget = number | (typeof outsideBets)[number]["id"];
export type PlacedChip = { target: BetTarget; cents: number };

export function targetLabel(target: BetTarget): string {
  if (typeof target === "number") return String(target);
  return outsideBets.find(({ id }) => id === target)?.label ?? target;
}

export function payoutMultiplier(target: BetTarget, number: number): number {
  if (typeof target === "number") return target === number ? 36 : 0;
  if (number === 0) return 0;

  switch (target) {
    case "first": return number <= 12 ? 3 : 0;
    case "second": return number > 12 && number <= 24 ? 3 : 0;
    case "third": return number > 24 ? 3 : 0;
    case "column-1": return number % 3 === 1 ? 3 : 0;
    case "column-2": return number % 3 === 2 ? 3 : 0;
    case "column-3": return number % 3 === 0 ? 3 : 0;
    case "low": return number <= 18 ? 2 : 0;
    case "high": return number > 18 ? 2 : 0;
    case "odd": return number % 2 === 1 ? 2 : 0;
    case "even": return number % 2 === 0 ? 2 : 0;
    case "red":
    case "black": return pocketColor(number) === target ? 2 : 0;
  }
}

export function spinRoulette(chips: readonly PlacedChip[], rng?: Rng) {
  const index = randomInt(0, WHEEL_ORDER.length - 1, rng);
  const number = WHEEL_ORDER[index];
  const payout = chips.reduce((total, chip) => total + chip.cents * payoutMultiplier(chip.target, number), 0);
  return { index, number, payout };
}

export const POCKET_ANGLE = 360 / WHEEL_ORDER.length;

export function nextWheelRotation(previous: number, pocket: number): number {
  const offset = (360 - pocket * POCKET_ANGLE - (previous % 360) + 360) % 360;
  return previous + 5 * 360 + offset;
}
