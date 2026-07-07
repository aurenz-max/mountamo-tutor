import { describe, expect, it } from 'vitest';
import { factorTreeOracle } from '../factor-tree';

/**
 * Seeded-violation tests for the factor-tree oracle. One clean fixture (trimmed
 * from a real /api/lumina/eval-test run: componentId=factor-tree, guided_small,
 * topic "Factors of numbers to 24") that must pass, plus one mutated fixture per
 * implemented check class that MUST fire. An oracle that never fires is decoration.
 */

const ftCtx = {
  componentId: 'factor-tree',
  evalMode: 'guided_small',
  topic: 'Factors of numbers to 24',
  gradeLevel: 'grade 4',
};

// Trimmed from real output — all rootValues are composites ≤ 24, distinct.
const factorTreeClean = {
  title: 'Exploring Number Branches',
  description: 'Practice breaking numbers into their prime building blocks.',
  challenges: [
    { id: 'ft-1', rootValue: 6 },
    { id: 'ft-2', rootValue: 10 },
    { id: 'ft-3', rootValue: 21 },
    { id: 'ft-4', rootValue: 8 },
    { id: 'ft-5', rootValue: 12 },
  ],
  highlightPrimes: true,
  showExponentForm: true,
  guidedMode: true,
  allowReset: true,
};

describe('factor-tree oracle', () => {
  it('passes clean data with zero violations', () => {
    const result = factorTreeOracle.verify(factorTreeClean, ftCtx);
    expect(result.violations).toEqual([]);
    expect(result.checkedChallenges).toBe(5);
    expect(result.uncheckedTypes).toEqual([]);
  });

  it('flags answer-key-desync — a PRIME rootValue is an unsolvable tree', () => {
    // 7 is prime: the component can never split it, so all-prime-leaves is unreachable.
    const data = {
      ...factorTreeClean,
      challenges: [...factorTreeClean.challenges.slice(0, 4), { id: 'ft-5', rootValue: 7 }],
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'ft-5')).toBe(true);
  });

  it('flags answer-key-desync — a NON-composite (unit) rootValue', () => {
    const data = {
      ...factorTreeClean,
      challenges: [...factorTreeClean.challenges.slice(0, 4), { id: 'ft-5', rootValue: 1 }],
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'ft-5')).toBe(true);
  });

  it('flags scope violation — a rootValue above the topic ceiling (the "to 24 taught 60" class)', () => {
    const data = {
      ...factorTreeClean,
      challenges: [...factorTreeClean.challenges.slice(0, 4), { id: 'ft-5', rootValue: 60 }],
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'ft-5')).toBe(true);
  });

  it('flags clustering — the "every tree is the same number" class', () => {
    const data = {
      ...factorTreeClean,
      challenges: [6, 6, 6, 6, 6].map((rootValue, i) => ({ id: `ft-${i + 1}`, rootValue })),
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — a duplicated challenge card (same rootValue twice)', () => {
    const data = {
      ...factorTreeClean,
      challenges: [
        { id: 'ft-1', rootValue: 6 },
        { id: 'ft-2', rootValue: 10 },
        { id: 'ft-3', rootValue: 21 },
        { id: 'ft-4', rootValue: 8 },
        { id: 'ft-5', rootValue: 6 }, // duplicate of ft-1
      ],
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('appears 2'))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = {
      ...factorTreeClean,
      challenges: [{ id: 'ft-1', rootValue: 6 }, { id: 'ft-2', rootValue: 10 }],
    };
    const v = factorTreeOracle.verify(data, ftCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('respects an explicit scopeMax over the topic parse', () => {
    const data = {
      ...factorTreeClean,
      challenges: [...factorTreeClean.challenges.slice(0, 4), { id: 'ft-5', rootValue: 20 }],
    };
    // scopeMax 12 → 20 and 21 exceed it; clean-topic parse (24) would have passed.
    const v = factorTreeOracle.verify(data, { ...ftCtx, scopeMax: 12 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'ft-5')).toBe(true);
  });
});
