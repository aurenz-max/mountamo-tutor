import { describe, expect, it } from 'vitest';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { MULT_MULTI_DIGIT, MULT_MULTI_DIGIT_5, multDigitItems, type MultDigitItem } from '../itemSpace/multiDigitMult';
import { areaPartsOf, perimeterSides, type AreaGridMode } from './areaModelItemSpace';

const MODES: AreaGridMode[] = ['build_model', 'find_area', 'factor', 'multiply'];
const GRID: Record<AreaGridMode, [number, number]> = { build_model: [1, 2], find_area: [2, 2], factor: [2, 2], multiply: [3, 2] };
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

describe('area-model pairs from mult-multi-digit', () => {
  it('every drawable item fills the mode\'s grid with place-value parts whose product is the item', () => {
    for (const mode of MODES) {
      let drawn = 0;
      for (const it of multDigitItems()) {
        const parts = areaPartsOf(mode, it);
        if (!parts) continue;
        drawn++;
        expect([parts.factor1Parts.length, parts.factor2Parts.length]).toEqual(GRID[mode]);
        expect(sum(parts.factor1Parts) * sum(parts.factor2Parts)).toBe(it.a * it.b);
        for (const p of [...parts.factor1Parts, ...parts.factor2Parts]) expect(String(p).replace(/0+$/, '')).toHaveLength(1);
      }
      expect(drawn).toBeGreaterThan(100);
    }
  });

  it('every tier fills a session of distinct pairs, mean beta rising', () => {
    for (const mode of MODES) {
      const scope = (it: MultDigitItem) => areaPartsOf(mode, it) !== null;
      const means = Object.values(TIER_BANDS).map(([lo, hi]) => {
        const space = mode === 'multiply' ? MULT_MULTI_DIGIT_5 : MULT_MULTI_DIGIT;
        const picks = tierPick(space, undefined, scope)(5, lo, hi, Math.random, scope) as MultDigitItem[];
        expect(picks, mode).toHaveLength(5);
        expect(new Set(picks.map((p) => `${p.a}x${p.b}`)).size).toBe(5);
        return sum(picks.map((p) => p.beta)) / 5;
      });
      expect(means[0], mode).toBeLessThan(means[1]);
      expect(means[1], mode).toBeLessThan(means[2]);
    }
  });

  it('perimeter: distinct valid rectangles, sums rising with the tier', () => {
    const top = (tier: 'easy' | 'medium' | 'hard') => Math.max(...perimeterSides(tier, 5, () => 0.99).map(([l, w]) => l + w));
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const sides = perimeterSides(tier, 5);
      expect(new Set(sides.map(([l, w]) => l + w)).size).toBe(5);
      for (const [l, w] of sides) { expect(l).not.toBe(w); expect(Math.min(l, w)).toBeGreaterThanOrEqual(5); expect(Math.max(l, w)).toBeLessThanOrEqual(30); }
    }
    expect(top('easy')).toBeLessThan(top('medium'));
    expect(top('medium')).toBeLessThan(top('hard'));
  });
});
