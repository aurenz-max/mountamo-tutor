import { describe, expect, it } from 'vitest';
import { crossesDecade, fallbackSession, oneMoreLessTargets } from './comparisonBuilderTargets';

describe('comparison-builder code numbers', () => {
  for (const max of [10, 20]) {
    for (const askFor of ['one-more', 'one-less', 'both'] as const) {
      it(`one-more-one-less within ${max} (${askFor}): distinct valid targets; hard crosses a decade more than easy`, () => {
        const crossings = (['easy', 'medium', 'hard'] as const).map((tier) => {
          let n = 0;
          for (let run = 0; run < 40; run++) {
            const t = oneMoreLessTargets(max, askFor, tier, 5);
            expect(t).toHaveLength(5);
            expect(new Set(t).size).toBe(5);
            for (const x of t) {
              if (askFor !== 'one-less') expect(x + 1).toBeLessThanOrEqual(max);
              if (askFor !== 'one-more') expect(x - 1).toBeGreaterThanOrEqual(1);
            }
            n += t.filter((x) => crossesDecade(x, askFor)).length;
          }
          return n;
        });
        expect(crossings[2]).toBeGreaterThan(crossings[0]);
      });
    }
  }

  it('the fallback builds a full session for every mode with correct keys', () => {
    for (const mode of ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'] as const) {
      const cards = fallbackSession(mode, 5, { numeralMin: 10, numeralMax: 99, groupPairs: [{ left: 2, right: 6 }, { left: 4, right: 4 }] });
      expect(cards).toHaveLength(5);
      for (const c of cards) {
        expect(c.type).toBe(mode);
        if (mode === 'compare-numbers') {
          expect(c.correctSymbol).toBe(c.leftNumber! > c.rightNumber! ? '>' : c.leftNumber! < c.rightNumber! ? '<' : '=');
          expect(Math.min(c.leftNumber!, c.rightNumber!)).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });
});
