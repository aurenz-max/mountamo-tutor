/**
 * area-model factor pairs from an item space (service/itemSpace, skill /add-item-space).
 *
 * Every tier drew from the same random window (multiply: 311 × 45 at easy, 112 × 48 at medium; 10-13
 * probe); the tier changed only the on-screen aids. With a tier and a lesson the resolver fits to
 * mult-multi-digit (grade 4) or mult-multi-digit-5 (grade 5, the only one with 3 × 2), code picks each
 * pair at the tier's band. What each mode draws (contract, R1):
 *   - build_model: a one-digit factor 3..9 times a two-digit number with a non-zero ones digit (a 1×2
 *     grid). The builder's cap of 25 on the two-digit factor was below the objective (4.NBT.5 runs to 99)
 *     and left the hard tier nothing harder than 9 × 25.
 *   - find_area, factor: two two-digit numbers, both with a non-zero ones digit (a 2×2 grid), up to 99.
 *     factor asks for the parts from the cells; its order follows the forward work (hard digit facts make
 *     the parts harder to find too), the carries do not apply to it and are a known approximation.
 *   - multiply: a three-digit number with non-zero tens and ones times a two-digit number with a non-zero
 *     ones digit (a 3×2 grid), up to 999 × 99.
 *   - perimeter: not multiplication. Its difficulty is one ordered quantity, length + width, so each
 *     tier takes its window of sums (`tierWindow`).
 */
import { tierWindow } from '../itemSpace';
import { placeParts, type MultDigitItem } from '../itemSpace/multiDigitMult';

export type AreaGridMode = 'build_model' | 'find_area' | 'factor' | 'multiply';
export const AREA_GRID_MODES: readonly string[] = ['build_model', 'find_area', 'factor', 'multiply'];

/** The task the resolver reads for each grid mode, scoped by the lesson. */
export const AREA_TASKS: Record<AreaGridMode, string> = {
  build_model: 'builds an area model to multiply a one-digit number by a two-digit number (partial products)',
  find_area: 'finds each partial product and the total area to multiply two two-digit numbers with an area model',
  factor: 'reads the partial products in an area model of two two-digit numbers and finds the factors\' parts',
  multiply: 'multiplies a three-digit number by a two-digit number with an area model (partial products)',
};

/** The grid an item puts on screen for a mode, or null when the mode cannot draw it. */
export function areaPartsOf(mode: AreaGridMode, it: MultDigitItem): { factor1Parts: number[]; factor2Parts: number[] } | null {
  const pa = placeParts(it.a), pb = placeParts(it.b);
  const full = (n: number) => placeParts(n).length === String(n).length;
  if (mode === 'build_model') {
    return it.shape === '1x2' && it.b >= 3 && full(it.a) ? { factor1Parts: pb, factor2Parts: pa } : null;
  }
  if (mode === 'multiply') return it.shape === '3x2' && full(it.a) && full(it.b) ? { factor1Parts: pa, factor2Parts: pb } : null;
  return it.shape === '2x2' && full(it.a) && full(it.b) ? { factor1Parts: pa, factor2Parts: pb } : null;
}

/** Perimeter sides at a tier: `count` rectangles, length ≠ width, sides 5..30, distinct sums from the tier's window. */
export function perimeterSides(tier: 'easy' | 'medium' | 'hard', count: number, rand: () => number = Math.random): [number, number][] {
  const sums = Array.from({ length: 49 }, (_, i) => i + 11);
  const window = tierWindow(sums, tier, count).sort(() => rand() - 0.5).slice(0, count).sort((x, y) => x - y);
  return window.map((sum) => {
    const lengths = Array.from({ length: 26 }, (_, i) => i + 5).filter((l) => sum - l >= 5 && sum - l <= 30 && sum - l !== l);
    const length = lengths[Math.floor(rand() * lengths.length)];
    return [Math.max(length, sum - length), Math.min(length, sum - length)];
  });
}
