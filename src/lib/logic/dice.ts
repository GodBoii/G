// Dice: roll 0–9999 (shown as 0.00–99.99), target 2–98, Over/Under.
import { cryptoRng, randomInt, type Rng } from "../rng";

export type DiceDirection = "under" | "over";

export const DICE_MIN_TARGET = 2;
export const DICE_MAX_TARGET = 98;
export const DICE_DEFAULT_TARGET = 50;

function assertTarget(target: number): void {
  if (!Number.isInteger(target) || target < DICE_MIN_TARGET || target > DICE_MAX_TARGET) {
    throw new RangeError("dice: target must be an integer from 2 to 98");
  }
}

/** Win chance in whole percent. Under: target; Over: 100 − target. */
export function winChance(target: number, dir: DiceDirection): number {
  assertTarget(target);
  return dir === "under" ? target : 100 - target;
}

/** 99 / chance, floored to 4 decimals, as ×10000 integer. */
export function diceMultiplierX10000(chance: number): number {
  if (!Number.isInteger(chance) || chance < 1 || chance > 99) {
    throw new RangeError("dice: chance must be an integer from 1 to 99");
  }
  return Math.floor(990000 / chance);
}

export function rollDice(rng: Rng = cryptoRng): number {
  return randomInt(0, 9999, rng);
}

/** Under wins iff roll < target·100; Over wins iff roll ≥ target·100. */
export function isDiceWin(roll: number, target: number, dir: DiceDirection): boolean {
  return dir === "under" ? roll < target * 100 : roll >= target * 100;
}
