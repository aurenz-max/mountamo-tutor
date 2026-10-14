import { describe, expect, it } from 'vitest';
import { multDivItems, pickMultDiv } from '../itemSpace/multDivFacts';
import { TIER_BANDS } from '../itemSpace';
import { FACT_BAND } from './gemini-multiplication-explorer';
import { itemAsFact, pickSpaceFacts } from './multiplicationExplorerItemSpace';

const pick = (opts: Partial<Parameters<typeof pickSpaceFacts>[0]> & { band: [number, number] }) =>
  pickSpaceFacts({ space: 'mult-div-facts', pick: pickMultDiv, count: 5, factBand: FACT_BAND['3-4'], missingFactor: false, ...opts });

describe('multiplication-explorer item-space adapter', () => {
  it('product modes take product-unknown items; missing_factor takes a hidden factor and never a square', () => {
    for (const it of multDivItems()) {
      const product = itemAsFact('mult-div-facts', it, { band: FACT_BAND['3-4'], missingFactor: false });
      expect(product !== null).toBe(it.form === 'product');
      const missing = itemAsFact('mult-div-facts', it, { band: FACT_BAND['3-4'], missingFactor: true });
      expect(missing !== null).toBe((it.form === 'factor1' || it.form === 'factor2') && it.a !== it.b);
      if (missing) expect(missing.hiddenValue).toBe(it.form);
    }
  });

  it('the 2-3 band keeps products within 50', () => {
    for (const it of multDivItems()) {
      const f = itemAsFact('mult-div-facts', it, { band: FACT_BAND['2-3'], missingFactor: false });
      if (f) expect(f.factor1 * f.factor2).toBeLessThanOrEqual(50);
    }
  });

  it('every tier fills a 3-4 session of distinct facts, harder facts at hard, in both kinds of mode', () => {
    for (const missingFactor of [false, true]) {
      const hardShare: number[] = [];
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        const facts = pick({ band: TIER_BANDS[tier], missingFactor });
        expect(facts).toHaveLength(5);
        expect(new Set(facts.map((f) => `${Math.min(f.factor1, f.factor2)}x${Math.max(f.factor1, f.factor2)}`)).size).toBe(5);
        hardShare.push(facts.filter((f) => f.itemSpace.structure.endsWith('h2')).length);
      }
      expect(hardShare[2]).toBeGreaterThan(hardShare[0]);
    }
  });

  it('a pinned factor stays in its slot; two pins keep the own path', () => {
    const facts = pick({ band: TIER_BANDS.medium, pinnedFactor1: 7, count: 4 });
    expect(facts.every((f) => f.factor1 === 7)).toBe(true);
    expect(pick({ band: TIER_BANDS.medium, pinnedFactor1: 7, pinnedFactor2: 8 })).toEqual([]);
  });
});
