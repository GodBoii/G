// Wheel of Fortune: 40 segments, multiplier ×10 clockwise from 12 o'clock starting at index 0.
import { cryptoRng, randomInt, type Rng } from "../rng";

export const WHEEL_SEGMENTS_X10 = [
  100,0,0,15,0,0,20,0,0,30, 0,15,0,0,20,0,0,15,0,0,
  50,0,0,20,0,0,15,0,0,30, 0,20,0,0,15,0,0,20,0,0,
] as const; // length 40

export const WHEEL_SEGMENT_COUNT = 40;

function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

export function spinWheel(rng: Rng = cryptoRng): number {
  return randomInt(0, WHEEL_SEGMENT_COUNT - 1, rng);
}

/**
 * Absolute rotation (deg, clockwise) that puts segment `index` under the 12 o'clock pointer.
 * Always ≥ currentDeg + spins·360; the jitter keeps the pointer within ±35% of the segment width.
 */
export function wheelTargetRotation(
  currentDeg: number,
  index: number,
  jitter01: number,
  spins = 6,
  n = WHEEL_SEGMENT_COUNT,
): number {
  const seg = 360 / n;
  const centre = index * seg + seg / 2;
  const offset = (jitter01 - 0.5) * seg * 0.7;
  const targetMod = mod(-(centre + offset), 360);
  const delta = mod(targetMod - mod(currentDeg, 360), 360);
  return currentDeg + spins * 360 + delta;
}

/** Segment under the pointer after rotating the wheel by `rotationDeg`. */
export function segmentAtPointer(rotationDeg: number, n = WHEEL_SEGMENT_COUNT): number {
  const seg = 360 / n;
  return Math.floor(mod(-rotationDeg, 360) / seg) % n;
}
