import { describe, expect, it } from 'vitest';
import { COMPARE_NUMBERS, compareNumbersFeatures, compareNumbersItems, symbolOf } from './compareNumbers';
import { TIER_BANDS, tierPick } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const within100 = (it: { left: number; right: number }) => it.left <= 100 && it.right <= 100;
/** A seeded generator (mulberry32): the sampled tier assertions failed now and then in full runs (8.1o). */
const SEED = Number(process.env.TIER_SEED ?? 7);
function seeded(seed = SEED): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Eight sessions of five: a tier's property is a mean over sessions, not over one draw of five. */
const SESSIONS = 8;

describe('compare-numbers', () => {
  it('reads the structure: digit count, shared tens, swapped digits', () => {
    expect(compareNumbersFeatures(7, 23)).toMatchObject({ fewerDigits: 1, sameTens: 0 });
    expect(compareNumbersFeatures(34, 38)).toMatchObject({ sameTens: 1, reversal: 0 });
    expect(compareNumbersFeatures(47, 74)).toMatchObject({ reversal: 1, sameTens: 0 });
    expect(compareNumbersFeatures(12, 12)).toMatchObject({ equal: 1, closeness: 0 });
  });

  it('no pair reaches the hard band: comparing within 100 is easy for a taught grade-1 learner', () => {
    expect(Math.max(...compareNumbersItems().filter(within100).map((it) => it.beta))).toBeLessThan(TIER_BANDS.hard[0]);
  });

  it('within 100 by tier thirds: 5 distinct pairs over several structures; hard holds more shared-tens or swapped pairs', () => {
    const subtle: number[] = [];
    const pick = tierPick(COMPARE_NUMBERS, undefined, within100);
    const rand = seeded();
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const all: typeof subtle = [];
      const signs = new Set<number>();
      for (let k = 0; k < SESSIONS; k++) {
        const picks = pick(5, lo, hi, rand, within100);
        expect(picks).toHaveLength(5);
        expect(new Set(picks.map((p) => `${Math.min(p.left, p.right)}|${Math.max(p.left, p.right)}`)).size).toBe(5);
        expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
        all.push(...picks.map((p) => p.features.sameTens + p.features.reversal));
        picks.forEach((p) => signs.add(Math.sign(p.left - p.right)));
        expect(picks.filter((p) => p.left === p.right).length).toBeLessThanOrEqual(1);
      }
      // Both directions across the tier's sessions; one session of five can draw only "<" (6 of 40 seeds).
      expect(signs.size).toBeGreaterThan(1);
      subtle.push(mean(all));
    }
    expect(subtle[2]).toBeGreaterThan(subtle[0]);
  });

  for (const max of [10, 20]) {
    it(`within ${max}: tierPick keeps easy < medium < hard inside the scope`, () => {
      const scope = (it: { left: number; right: number }) => it.left <= max && it.right <= max;
      const pick = tierPick(COMPARE_NUMBERS, undefined, scope);
      const means = Object.values(TIER_BANDS).map(([lo, hi]) => {
        const picks = pick(5, lo, hi, Math.random, scope);
        expect(picks).toHaveLength(5);
        expect(picks.every(scope)).toBe(true);
        return mean(picks.map((p) => p.beta));
      });
      expect(means[0]).toBeLessThan(means[1]);
      expect(means[1]).toBeLessThan(means[2]);
    });
  }

  it('two-digit pairs: easy, medium and hard thirds differ in mean gap or structure', () => {
    const scope = (it: { left: number; right: number }) => Math.min(it.left, it.right) >= 10 && Math.max(it.left, it.right) <= 99;
    const pick = tierPick(COMPARE_NUMBERS, undefined, scope);
    const rand = seeded();
    const gaps = Object.values(TIER_BANDS).map(([lo, hi]) => mean(Array.from({ length: SESSIONS },
      () => pick(5, lo, hi, rand, scope).map((p) => Math.abs(p.left - p.right))).flat()));
    expect(gaps[0]).toBeGreaterThan(gaps[1]);
    expect(gaps[1]).toBeGreaterThan(gaps[2]);
  });

  it('three-digit (8.1j): only an objective that asks for them draws them; hard has more shared-hundreds or swapped pairs', () => {
    expect(compareNumbersFeatures(347, 374)).toMatchObject({ threeDigit: 1, sameHundreds: 1, reversal: 1 });
    expect(compareNumbersFeatures(352, 358)).toMatchObject({ sameHundredsTens: 1 });
    expect(compareNumbersFeatures(87, 103)).toMatchObject({ fewerDigits: 1, threeDigit: 0 });
    const plain = COMPARE_NUMBERS.scopeOf!('Compare two numbers using >, =, <')!;
    expect(compareNumbersItems().filter(plain).every(within100)).toBe(true);
    const scope = COMPARE_NUMBERS.scopeOf!('Compare two three-digit numbers based on meanings of the hundreds, tens, and ones digits')!;
    const pick = tierPick(COMPARE_NUMBERS, undefined, scope);
    const subtle = Object.values(TIER_BANDS).map(([lo, hi]) => {
      const picks = pick(5, lo, hi, Math.random, scope);
      expect(picks).toHaveLength(5);
      for (const p of picks) expect(Math.min(p.left, p.right)).toBeGreaterThanOrEqual(100);
      return mean(picks.map((p) => p.features.sameHundreds + p.features.sameHundredsTens + p.features.reversal));
    });
    expect(subtle[2]).toBeGreaterThan(subtle[0]);
  });

  it('contract: three distinct wrong statements, one far, never the key; a plain question that fits', () => {
    for (const it of compareNumbersItems().filter((_, i) => i % 7 === 0)) {
      const sol = COMPARE_NUMBERS.solve(it);
      expect(sol.answer).toBe(`${it.left} ${symbolOf(it.left, it.right)} ${it.right}`);
      const d = COMPARE_NUMBERS.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      for (const x of d) {
        const [l, s, r] = x.value.split(' ');
        expect(symbolOf(Number(l), Number(r))).not.toBe(s);
      }
      expect(questionFitsSpec(COMPARE_NUMBERS.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
