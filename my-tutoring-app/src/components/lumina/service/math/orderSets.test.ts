import { describe, expect, it } from 'vitest';
import { orderSets } from './comparisonBuilderTargets';

const gaps = (s: number[]) => { const x = [...s].sort((a, b) => a - b); return x.slice(1).map((v, i) => v - x[i]); };

describe('comparison-builder order sets (8.1b)', () => {
  for (const window of [{ min: 1, max: 20 }, { min: 1, max: 100 }]) {
    it(`window ${window.min}-${window.max}: sets stay in the window, differ, are never shown sorted, and the tier sets closeness`, () => {
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        const sets = orderSets(window, 4, tier, 5);
        expect(sets).toHaveLength(5);
        expect(new Set(sets.map((s) => [...s].sort((a, b) => a - b).join())).size).toBe(5);
        for (const s of sets) {
          expect(Math.min(...s)).toBeGreaterThanOrEqual(window.min);
          expect(Math.max(...s)).toBeLessThanOrEqual(window.max);
          const sorted = [...s].sort((a, b) => a - b);
          expect(s.join()).not.toBe(sorted.join());
          expect(s.join()).not.toBe([...sorted].reverse().join());
          const g = Math.min(...gaps(s));
          if (tier === 'easy') expect(g).toBeGreaterThanOrEqual(3);
          if (tier === 'medium') expect(g).toBeGreaterThanOrEqual(2);
          if (tier === 'hard') expect(g).toBe(1);
        }
      }
    });
  }

  it('a window too narrow for the tier still fills the session', () => {
    expect(orderSets({ min: 1, max: 5 }, 3, 'easy', 5)).toHaveLength(5);
  });
});
