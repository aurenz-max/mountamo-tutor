import { describe, expect, it } from 'vitest';
import { MULT_DIV_FACTS, multDivItems, pickMultDiv, solveMultDiv } from './multDivFacts';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

describe('mult-div-facts item space', () => {
  it('every item has factors 2..10, a product within 100, and its answer in the unknown slot', () => {
    for (const it of multDivItems()) {
      expect(Math.min(it.a, it.b)).toBeGreaterThanOrEqual(2);
      expect(Math.max(it.a, it.b)).toBeLessThanOrEqual(10);
      const { answer } = solveMultDiv(it);
      const expected = { product: it.a * it.b, factor1: it.a, factor2: it.b, quotient: it.b }[it.form];
      expect(answer).toBe(expected);
    }
  });

  it('a tier band yields distinct facts inside it across more than two structures', () => {
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = pickMultDiv(8, lo, hi);
      expect(picks).toHaveLength(8);
      expect(picks.every((p) => p.beta >= lo && p.beta <= hi)).toBe(true);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      expect(new Set(picks.map((p) => `${Math.min(p.a, p.b)}x${Math.max(p.a, p.b)}`)).size).toBe(8);
    }
  });

  it('every tier fills a session of product-unknown facts (consumers that only ask the product)', () => {
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      expect(pickMultDiv(6, lo, hi, Math.random, (it) => it.form === 'product')).toHaveLength(6);
    }
  });

  it('harder tiers hold the no-rule facts (6-9) and the inverse forms; easier ones the anchors', () => {
    const share = (tier: keyof typeof TIER_BANDS, f: (p: ReturnType<typeof pickMultDiv>[number]) => boolean) => {
      const picks = pickMultDiv(20, ...TIER_BANDS[tier]);
      return picks.filter(f).length / picks.length;
    };
    const heavy = (p: ReturnType<typeof pickMultDiv>[number]) => p.features.hardFactors === 2 || p.form !== 'product';
    expect(share('hard', heavy)).toBeGreaterThan(share('easy', heavy));
    expect(share('easy', (p) => p.features.anchor === 1)).toBeGreaterThan(share('hard', (p) => p.features.anchor === 1));
  });

  it('jitter control: items of one structure differ in beta only by problem size', () => {
    const groups = new Map<string, number[]>();
    for (const it of multDivItems()) groups.set(it.structure, [...(groups.get(it.structure) ?? []), it.beta]);
    for (const betas of Array.from(groups.values())) expect(Math.max(...betas) - Math.min(...betas)).toBeLessThanOrEqual(1.2);
  });

  it('meets the ItemSpace contract: three distinct wrong options in range, one far, a plain question that fits', () => {
    for (const it of multDivItems()) {
      const sol = MULT_DIV_FACTS.solve(it);
      const d = MULT_DIV_FACTS.distractors(it);
      const max = it.form === 'product' ? 100 : 10;
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.every((x) => Number(x.value) >= 1 && Number(x.value) <= max)).toBe(true);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(MULT_DIV_FACTS.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
