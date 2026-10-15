import { describe, expect, it } from 'vitest';
import { TIER_BANDS, tierPick } from './index';
import { FRACTION_COMPARE, compareStrategy, compareSymbol, fractionCompareItems } from './fractionCompare';
import { SKIP_COUNT, pickSkipLines, skipCountAccept, skipCountItems, skipRun } from './skipCount';
import { DIV_MULTI_DIGIT, DIV_MULTI_DIGIT_5, division4Items, division5Items, divisionFeatures } from './divisionMultiDigit';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';
import type { ItemSpace } from './types';

const contract = (space: ItemSpace<any>, items: any[]) => {
  for (const it of items) {
    const sol = space.solve(it);
    const d = space.distractors(it);
    expect(d).toHaveLength(3);
    expect(new Set(d.map((x) => x.value)).size).toBe(3);
    expect(d.some((x) => x.value === sol.answer)).toBe(false);
    expect(d.some((x) => x.distance === 'far')).toBe(true);
    expect(questionFitsSpec(space.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
  }
};
const sample = <T>(xs: T[], k: number) => xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / k)) === 0);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('fraction-compare', () => {
  it('reads the strategy a pair allows', () => {
    expect(compareStrategy(2, 6, 5, 6)).toBe('sameDen');
    expect(compareStrategy(1, 3, 1, 8)).toBe('sameNum');
    expect(compareStrategy(2, 5, 5, 8)).toBe('benchmark');
    expect(compareStrategy(9, 12, 3, 6)).toBe('benchmark');
    expect(compareStrategy(3, 4, 5, 6)).toBe('residual');
    expect(compareStrategy(2, 3, 5, 8)).toBe('general');
    expect(compareStrategy(2, 4, 1, 2)).toBe('equal');
    expect(compareSymbol({ a: 1, b: 3, c: 1, d: 8 })).toBe('>');
  });

  it('every tier fills distinct pairs over several structures; hard holds more general and equal pairs', () => {
    const share: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = FRACTION_COMPARE.pick(6, lo, hi);
      expect(picks).toHaveLength(6);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      expect(picks.filter((p) => p.strategy === 'equal').length).toBeLessThanOrEqual(1);
      share.push(fractionCompareItems().filter((p) => p.beta >= lo && p.beta <= hi)
        .filter((p) => p.strategy === 'general' || p.strategy === 'equal').length);
    }
    const easy = fractionCompareItems().filter((p) => p.beta < -0.6);
    expect(easy.every((p) => p.strategy !== 'general')).toBe(true);
    expect(share[2]).toBeGreaterThan(share[0]);
  });

  it('a grade-3 scope (same numerator or denominator, 2-8) still separates by thirds', () => {
    const g3 = (it: any) => [it.b, it.d].every((x: number) => [2, 3, 4, 6, 8].includes(x))
      && ['sameNum', 'sameDen'].includes(it.strategy);
    const pick = tierPick(FRACTION_COMPARE, undefined, g3);
    const means = Object.values(TIER_BANDS).map(([lo, hi]) => {
      const picks = pick(5, lo, hi, undefined, g3);
      expect(picks).toHaveLength(5);
      return mean(picks.map((p: any) => p.beta));
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });

  it('meets the ItemSpace contract', () => contract(FRACTION_COMPARE, sample(fractionCompareItems(), 300)));
});

describe('skip-count', () => {
  it('every line stays in 0..1000 and its answer is the fifth number', () => {
    for (const it of skipCountItems()) {
      const run = skipRun(it);
      expect(Math.min(...run)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...run)).toBeLessThanOrEqual(1000);
      expect(SKIP_COUNT.solve(it).answer).toBe(String(run[4]));
    }
  });

  it('every tier fills distinct starts over several structures; hard counts back and off the multiples more', () => {
    const heavy: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = SKIP_COUNT.pick(6, lo, hi);
      expect(picks).toHaveLength(6);
      expect(new Set(picks.map((p) => p.start)).size).toBe(6);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      const band = skipCountItems().filter((p) => p.beta >= lo && p.beta <= hi);
      heavy.push(mean(band.map((p) => p.features.backward + p.features.offMultiple + p.features.noPattern)));
    }
    expect(heavy[0]).toBeLessThan(heavy[1]);
    expect(heavy[1]).toBeLessThan(heavy[2]);
  });

  it('a grade-1 by-5s lesson keeps 5s, forward, within 120, and its tiers still separate', () => {
    const accept = skipCountAccept('1', [5]);
    const lines = skipCountItems().filter(accept);
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.every((it) => it.step === 5 && it.direction === 'forward' && it.start % 5 === 0)).toBe(true);
    const pick = tierPick(SKIP_COUNT, undefined, accept);
    // One line per session: average many sessions.
    const means = Object.values(TIER_BANDS).map(([lo, hi]) =>
      mean(Array.from({ length: 30 }, () => pick(1, lo, hi, undefined, accept)[0].beta)));
    expect(means[0]).toBeLessThan(means[2]);
  });

  it('pickSkipLines: a grade-1 by-5s lesson gives three different betas, easy < medium < hard', () => {
    const accept = skipCountAccept('1', [5]);
    const betas = Object.values(TIER_BANDS).map((band) => Array.from({ length: 20 }, () => pickSkipLines(1, band, accept)[0].beta));
    expect(Math.max(...betas[0])).toBeLessThan(Math.min(...betas[1]));
    expect(Math.max(...betas[1])).toBeLessThan(Math.min(...betas[2]));
  });

  it('meets the ItemSpace contract', () => contract(SKIP_COUNT, sample(skipCountItems(), 400)));
});

describe('div-multi-digit (grade 4) and div-multi-digit-5', () => {
  it('reads the work: a zero in the quotient, a first digit under the divisor, carried remainders', () => {
    expect(divisionFeatures(624, 3)).toMatchObject({ quotientZero: 1, leadSmall: 0, remainder: 0 });
    expect(divisionFeatures(156, 6)).toMatchObject({ leadSmall: 1, steps: 1, hardDivisor: 1 });
    expect(divisionFeatures(846, 2)).toMatchObject({ steps: 0, quotientZero: 0, anchor: 1 });
  });

  for (const [space, items] of [[DIV_MULTI_DIGIT, division4Items], [DIV_MULTI_DIGIT_5, division5Items]] as const) {
    it(`${space.id}: quotients of two digits or more; every tier fills distinct dividends; hard is longer`, () => {
      expect(items().every((it) => it.quotient >= 10 && it.dividend === it.quotient * it.divisor + it.remainder
        && it.remainder < it.divisor && it.dividend < 10000)).toBe(true);
      const digits: number[] = [];
      for (const [lo, hi] of Object.values(TIER_BANDS)) {
        const picks = space.pick(6, lo, hi);
        expect(picks).toHaveLength(6);
        expect(new Set(picks.map((p) => p.dividend)).size).toBe(6);
        digits.push(mean(items().filter((p) => p.beta >= lo && p.beta <= hi).map((p) => String(p.dividend).length + p.features.quotientZero)));
      }
      expect(digits[0]).toBeLessThan(digits[2]);
    });

    it(`${space.id}: meets the ItemSpace contract`, () => contract(space, sample(items(), 300)));
  }
});
