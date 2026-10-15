import { describe, expect, it } from 'vitest';
import { RATIO_MISSING_VALUE, ratioAnswer, ratioItems, scaledSecond } from './ratioMissingValue';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('ratio-missing-value', () => {
  it('every item is an equivalent ratio with whole values, and the answer is the hidden quantity', () => {
    for (const it of ratioItems()) {
      const second = scaledSecond(it);
      if (it.k === 1) expect(Number.isInteger(Math.round(second * 1e6) / 1e4)).toBe(true);
      else expect(Number.isInteger(second)).toBe(true);
      expect(Math.abs(it.k * it.b - second * it.a)).toBeLessThan(1e-9);
      expect(ratioAnswer(it)).toBe(it.hidden === 'first' ? it.k : second);
    }
  });

  it('every tier fills 4 distinct items over several structures; hard has more non-whole factors than easy', () => {
    const frac: number[] = [];
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = RATIO_MISSING_VALUE.pick(4, lo, hi);
      expect(picks).toHaveLength(4);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(1);
      expect(new Set(picks.map((p) => `${p.a}:${p.b}`)).size).toBe(4);
      frac.push(mean(picks.map((p) => p.features.nonWhole)));
    }
    expect(frac[2]).toBeGreaterThan(frac[0]);
  });

  it('unit rates: whole ones are easy, decimal ones are not', () => {
    const units = ratioItems().filter((it) => it.k === 1);
    expect(units.some((u) => u.features.decimalAnswer)).toBe(true);
    for (const u of units.filter((x) => !x.features.big)) expect(u.beta < -0.6).toBe(!u.features.decimalAnswer);
    const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
    const below = units.filter((u) => u.features.belowOne).map((u) => u.beta);
    const half = units.filter((u) => u.features.decimalAnswer && !u.features.notHalf && !u.features.belowOne).map((u) => u.beta);
    expect(mean(below)).toBeGreaterThan(mean(half));
  });

  it('contract: three distinct whole wrong options, one far, never the key; a plain question that fits', () => {
    for (const it of ratioItems().filter((_, i) => i % 3 === 0)) {
      const sol = RATIO_MISSING_VALUE.solve(it);
      const d = RATIO_MISSING_VALUE.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(RATIO_MISSING_VALUE.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
