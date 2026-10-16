/**
 * BizFlow Pilot V2 — BigInt-Safe Mathematical Utilities
 *
 * In standard JavaScript, Math.max() and Math.min() coerce arguments to numbers
 * and throw:
 *   TypeError: Cannot convert a BigInt value to a number
 *
 * These helpers provide pure, compiler-safe BigInt comparisons without type coercion.
 */

import { ARC_GAS_CONFIG } from "@/lib/networks";

/**
 * Returns the maximum of two or more BigInt values.
 * Pure BigInt arithmetic: (a > b ? a : b)
 */
export function bigintMax(a: bigint, b: bigint, ...rest: bigint[]): bigint {
  let max = a > b ? a : b;
  for (const val of rest) {
    if (val > max) {
      max = val;
    }
  }
  return max;
}

/**
 * Returns the minimum of two or more BigInt values.
 * Pure BigInt arithmetic: (a < b ? a : b)
 */
export function bigintMin(a: bigint, b: bigint, ...rest: bigint[]): bigint {
  let min = a < b ? a : b;
  for (const val of rest) {
    if (val < min) {
      min = val;
    }
  }
  return min;
}

/**
 * Clamps a BigInt value between a lower and upper bound.
 */
export function clampBigInt(val: bigint, min: bigint, max: bigint): bigint {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/**
 * Clamps maxFeePerGas to ensure it strictly respects Arc's 20 Gwei floor.
 * Safely handles undefined or null estimates.
 */
export function clampMaxFeePerGas(
  estimatedFee?: bigint | null,
  floorFee: bigint = ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI
): bigint {
  if (!estimatedFee || estimatedFee < floorFee) {
    return floorFee;
  }
  return estimatedFee;
}
