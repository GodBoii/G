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
  { id: "column-1", label: "Column 1" },
  { id: "column-2", label: "Column 2" },
  { id: "column-3", label: "Column 3" },
] as const;

export const OUTSIDE_PICKS = [
  { id: "low", label: "1–18" },
  { id: "even", label: "Even" },
  { id: "red", label: "Red" },
  { id: "black", label: "Black" },
  { id: "odd", label: "Odd" },
  { id: "high", label: "19–36" },
] as const;

const groups = [...DOZENS, ...COLUMNS, ...OUTSIDE_PICKS];
export type Pick = number | (typeof groups)[number]["id"];

export function pickLabel(pick: Pick): string {
  if (typeof pick === "number") return String(pick);
  return groups.find(({ id }) => id === pick)?.label ?? pick;
}

export function matchesPocket(pick: Pick, pocket: number): boolean {
  if (typeof pick === "number") return pick === pocket;
  if (pocket === 0) return false;

  switch (pick) {
    case "first": return pocket <= 12;
    case "second": return pocket > 12 && pocket <= 24;
    case "third": return pocket > 24;
    case "column-1": return pocket % 3 === 1;
    case "column-2": return pocket % 3 === 2;
    case "column-3": return pocket % 3 === 0;
    case "low": return pocket <= 18;
    case "high": return pocket > 18;
    case "odd": return pocket % 2 === 1;
    case "even": return pocket % 2 === 0;
    case "red":
    case "black": return pocketColor(pocket) === pick;
  }
}

export function spinRoulette(rng?: Rng) {
  const index = randomInt(0, WHEEL_ORDER.length - 1, rng);
  return { index, number: WHEEL_ORDER[index] };
}

export const POCKET_ANGLE = 360 / WHEEL_ORDER.length;

export function nextWheelRotation(previous: number, pocket: number): number {
  const offset = (360 - pocket * POCKET_ANGLE - (previous % 360) + 360) % 360;
  return previous + 5 * 360 + offset;
}
