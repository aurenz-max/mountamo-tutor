import { describe, expect, it } from 'vitest';
import { COMPARE_20, COMPARE_100, compareComputation, compareItems, isConsistent, solveCompare } from './compareStories';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('comparison word problems', () => {
  it('consistency: "more" asks to add only when the larger amount is unknown', () => {
    expect(isConsistent('larger', 'more')).toBe(true);
    expect(isConsistent('smaller', 'fewer')).toBe(true);
    expect(isConsistent('smaller', 'more')).toBe(false);
    expect(isConsistent('larger', 'fewer')).toBe(false);
    expect(isConsistent('difference', 'fewer')).toBe(true);
  });

  for (const [space, max, lo] of [[COMPARE_20, 20, 3], [COMPARE_100, 100, 21]] as const) {
    it(`${space.id}: every item is in scope and its answer is the unknown`, () => {
      for (const it of compareItems(max)) {
        expect(it.larger).toBeGreaterThanOrEqual(lo);
        expect(it.larger).toBeLessThanOrEqual(max);
        expect(it.larger - it.smaller).toBeGreaterThanOrEqual(2);
        const { a, b, op } = compareComputation(it);
        const { answer } = solveCompare(it);
        expect(op === '+' ? a + b : a - b).toBe(answer);
        expect(answer).toBe(it.unknown === 'difference' ? it.larger - it.smaller : it.unknown === 'larger' ? it.larger : it.smaller);
      }
    });

    it(`${space.id}: every tier fills 6 distinct items over several structures; hard holds more inconsistent wording than easy`, () => {
      const inconsistent: number[] = [];
      for (const [blo, bhi] of Object.values(TIER_BANDS)) {
        const picks = space.pick(6, blo, bhi);
        expect(picks).toHaveLength(6);
        expect(new Set(picks.map((p) => `${p.larger}|${p.smaller}`)).size).toBe(6);
        expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
        inconsistent.push(mean(picks.map((p) => p.features.inconsistent)));
      }
      expect(inconsistent[2]).toBeGreaterThan(inconsistent[0]);
    });

    it(`${space.id}: contract (three distinct wrong options in range, one far, a plain question that fits)`, () => {
      const sample = compareItems(max).filter((_, i) => i % (max === 20 ? 1 : 37) === 0);
      for (const it of sample) {
        const sol = space.solve(it);
        const d = space.distractors(it);
        expect(d).toHaveLength(3);
        expect(new Set(d.map((x) => x.value)).size).toBe(3);
        expect(d.some((x) => x.value === sol.answer)).toBe(false);
        expect(d.every((x) => Number(x.value) >= 0 && Number(x.value) <= max)).toBe(true);
        expect(d.some((x) => x.distance === 'far')).toBe(true);
        const q = space.plainQuestion(it);
        expect(questionFitsSpec(q, sol.shown, sol.answer)).toBe(true);
        expect(q).toContain(it.wording);
      }
    });
  }

  it('jitter: items of one structure with different digits sit within 0.5 logit', () => {
    const byStructure = new Map<string, number[]>();
    for (const it of compareItems(20)) byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it.beta]);
    for (const betas of Array.from(byStructure.values())) expect(Math.max(...betas) - Math.min(...betas)).toBeLessThanOrEqual(0.5);
  });
});
