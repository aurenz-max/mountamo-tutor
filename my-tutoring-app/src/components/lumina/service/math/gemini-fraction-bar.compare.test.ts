import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: {} }));

import { compareChallenges } from './gemini-fraction-bar';
import { fractionBarOracle } from '../qa/oracles/fraction-bar';
import { fractionCompareMiss } from '../../primitives/visual-primitives/math/fractionBarWorkspace';

/** fraction-bar `compare` (QUEUE 8.1g): code picks every pair and its key from the fraction-compare item space. */
describe('fraction-bar compare pairs', () => {
  const ctx = { componentId: 'fraction-bar', evalMode: 'compare', topic: 'Compare fractions', gradeLevel: 'grade 4' };

  it.each([
    ['3', 'easy'], ['3', 'medium'], ['3', 'hard'], ['4', 'easy'], ['4', 'medium'], ['4', 'hard'], ['4', null], ['3', null],
  ] as const)('grade %s, tier %s: 30 sessions pass the oracle', (grade, tier) => {
    for (let run = 0; run < 30; run++) {
      const challenges = compareChallenges(5, grade, tier);
      expect(challenges).toHaveLength(5);
      const data = { challengeType: 'compare', challenges, ...(tier ? { supportTier: tier } : {}) };
      expect(fractionBarOracle.verify(data, ctx).violations).toEqual([]);
      if (grade === '3') for (const c of challenges) expect([2, 3, 4, 6, 8]).toEqual(expect.arrayContaining([c.denominator, c.compareWith!.denominator]));
    }
  });

  it('grade 3 hard compares against one half; grade 4 hard reaches pairs without a half', () => {
    const half = (n: number, d: number) => 2 * n === d;
    for (let run = 0; run < 20; run++)
      for (const c of compareChallenges(5, '3', 'hard')) expect(half(c.numerator, c.denominator) || half(c.compareWith!.numerator, c.compareWith!.denominator)).toBe(true);
    const g4 = Array.from({ length: 20 }, () => compareChallenges(5, '4', 'hard')).flat();
    expect(g4.some(c => !half(c.numerator, c.denominator) && !half(c.compareWith!.numerator, c.compareWith!.denominator))).toBe(true);
  });

  it('grade 2 keeps halves to fourths and never goes past same-numerator pairs', () => {
    for (const c of compareChallenges(4, '2', 'hard')) {
      expect(c.denominator).toBeLessThanOrEqual(4);
      expect(c.numerator === c.compareWith!.numerator || c.denominator === c.compareWith!.denominator).toBe(true);
    }
  });

  it('the oracle catches a wrong key and a tier that does not hold', () => {
    const bad = { challengeType: 'compare', supportTier: 'easy', challenges: [
      { id: 'a', numerator: 1, denominator: 3, compareWith: { numerator: 1, denominator: 4 }, relation: '<' },
      { id: 'b', numerator: 2, denominator: 6, compareWith: { numerator: 5, denominator: 6 }, relation: '<' },
      { id: 'c', numerator: 3, denominator: 8, compareWith: { numerator: 1, denominator: 8 }, relation: '>' },
    ] };
    const checks = fractionBarOracle.verify(bad, ctx).violations.map(v => `${v.where}:${v.check}`);
    expect(checks).toEqual(['a:answer-key-desync', 'a:scope']);
  });

  it('names the miss from the symbol picked', () => {
    const sameNum = { id: 'x', numerator: 1, denominator: 3, numeratorChoices: [], denominatorChoices: [],
      compareWith: { numerator: 1, denominator: 8 }, relation: '>' as const };
    expect(fractionCompareMiss(sameNum, '>')).toBeUndefined();
    expect(fractionCompareMiss(sameNum, '<')).toBe('more_parts_bigger');
    expect(fractionCompareMiss(sameNum, '=')).toBe('said_equal');
    expect(fractionCompareMiss({ ...sameNum, numerator: 2, denominator: 5, compareWith: { numerator: 5, denominator: 8 }, relation: '<' }, '>')).toBe('flipped');
    expect(fractionCompareMiss({ ...sameNum, numerator: 2, denominator: 4, compareWith: { numerator: 1, denominator: 2 }, relation: '=' }, '<')).toBe('said_unequal');
  });
});
