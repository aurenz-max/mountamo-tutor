import { describe, expect, it } from 'vitest';
import { MULT_MULTI_DIGIT, MULT_MULTI_DIGIT_5, multDigitFeatures, multDigitItems, partialProducts, placeParts } from './multiDigitMult';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

describe('mult-multi-digit', () => {
  it('reads the work: cells, hard facts, carries in the sum, a zero inside a factor', () => {
    expect(placeParts(305)).toEqual([300, 5]);
    expect(partialProducts(36, 47).reduce((s, p) => s + p, 0)).toBe(36 * 47);
    expect(multDigitFeatures(36, 47)).toMatchObject({ cells: 4, hardFacts: 1, carries: 0, innerZero: 0, shape2x2: 1 });
    expect(multDigitFeatures(305, 24)).toMatchObject({ cells: 4, innerZero: 1, shape3x2: 1 });
    expect(multDigitFeatures(86, 7)).toMatchObject({ cells: 2, hardFacts: 2, carries: 1 });
  });

  it('every partial-products sum is the product; no ×1, ×10 or ×100', () => {
    for (const it of multDigitItems().filter((_, i) => i % 13 === 0)) {
      expect(partialProducts(it.a, it.b).reduce((s, p) => s + p, 0)).toBe(it.a * it.b);
      expect([1, 10, 100]).not.toContain(it.b);
    }
  });

  it('the grade-4 scope never draws 3 × 2', () => {
    for (const [lo, hi] of Object.values(TIER_BANDS)) expect(MULT_MULTI_DIGIT.pick(20, lo, hi).some((p) => p.shape === '3x2')).toBe(false);
  });

  it('every tier fills distinct items across structures; harder tiers hold bigger shapes and more cells', () => {
    const cells = Object.values(TIER_BANDS).map(([lo, hi]) => {
      const picks = MULT_MULTI_DIGIT_5.pick(8, lo, hi);
      expect(picks).toHaveLength(8);
      expect(new Set(picks.map((p) => `${p.a}x${p.b}`)).size).toBe(8);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      const band = multDigitItems().filter((p) => p.beta >= lo && p.beta <= hi);
      return band.reduce((s, p) => s + p.features.cells, 0) / band.length;
    });
    expect(cells[0]).toBeLessThan(cells[1]);
    expect(cells[1]).toBeLessThan(cells[2]);
  });

  it('jitter: one structure spans no more than its anchor', () => {
    const by = new Map<string, number[]>();
    for (const it of multDigitItems()) by.set(it.structure, [...(by.get(it.structure) ?? []), it.beta]);
    for (const betas of Array.from(by.values())) expect(Math.max(...betas) - Math.min(...betas)).toBeLessThanOrEqual(0.41);
  });

  it('keeps the ItemSpace contract', () => {
    for (const it of multDigitItems().filter((_, i) => i % 97 === 0)) {
      const sol = MULT_MULTI_DIGIT_5.solve(it);
      const d = MULT_MULTI_DIGIT_5.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(d.every((x) => Number(x.value) > 0)).toBe(true);
      expect(questionFitsSpec(MULT_MULTI_DIGIT.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
