import { describe, expect, it } from 'vitest';
import { fractionBarOracle } from '../fraction-bar';

/**
 * Seeded-violation tests for the fraction-bar oracle. Clean fixtures are trimmed
 * straight from real /api/lumina/eval-test generations (grade 3, topic
 * "Fractions with denominators to 8") — one for the deduped `build` mode and one
 * for the pool-cycling `identify` mode (which legitimately repeats cards) — plus
 * one mutated fixture per implemented check class that MUST fire.
 */

// "to 8" topic → scope ceiling 8; used to prove the scope check bites on a twelfth.
const ctx = { componentId: 'fraction-bar', evalMode: 'build', topic: 'Fractions with denominators to 8', gradeLevel: 'grade 3' };
const identifyCtx = { ...ctx, evalMode: 'identify' };

// ── build — real generation (3 proper non-unit fractions, deduped) ──
const buildClean = {
  title: 'Building Fractions on a Bar',
  description: 'Shade the parts to build each fraction.',
  challengeType: 'build',
  challenges: [
    { id: 'fraction-bar-1', numerator: 3, denominator: 6, numeratorChoices: [4, 2, 3, 6], denominatorChoices: [5, 3, 6, 7] },
    { id: 'fraction-bar-2', numerator: 4, denominator: 5, numeratorChoices: [6, 3, 5, 4], denominatorChoices: [5, 7, 4, 6] },
    { id: 'fraction-bar-3', numerator: 2, denominator: 3, numeratorChoices: [1, 3, 2, 4], denominatorChoices: [5, 2, 3, 4] },
  ],
};

// ── identify — real generation (7 unit fractions; note 1/2 & 1/6 each appear twice) ──
const identifyClean = {
  title: 'Fraction Bar Practice — Grade 3',
  description: 'Name the parts of each unit fraction.',
  challengeType: 'identify',
  challenges: [
    { id: 'fraction-bar-1', numerator: 1, denominator: 2, numeratorChoices: [3, 1, 2, 0], denominatorChoices: [3, 5, 4, 2] },
    { id: 'fraction-bar-2', numerator: 1, denominator: 6, numeratorChoices: [1, 6, 2, 0], denominatorChoices: [6, 8, 7, 5] },
    { id: 'fraction-bar-3', numerator: 1, denominator: 4, numeratorChoices: [1, 0, 2, 4], denominatorChoices: [3, 4, 5, 6] },
    { id: 'fraction-bar-4', numerator: 1, denominator: 8, numeratorChoices: [1, 8, 0, 2], denominatorChoices: [8, 7, 9, 10] },
    { id: 'fraction-bar-5', numerator: 1, denominator: 3, numeratorChoices: [1, 0, 2, 3], denominatorChoices: [5, 4, 3, 2] },
    { id: 'fraction-bar-6', numerator: 1, denominator: 2, numeratorChoices: [0, 1, 3, 2], denominatorChoices: [2, 4, 5, 3] },
    { id: 'fraction-bar-7', numerator: 1, denominator: 6, numeratorChoices: [6, 2, 0, 1], denominatorChoices: [7, 5, 6, 8] },
  ],
};

describe('fraction-bar oracle', () => {
  it('passes clean build (real generation)', () => {
    expect(fractionBarOracle.verify(buildClean, ctx).violations).toEqual([]);
  });

  it('passes clean identify (real generation — pool-cycled duplicate cards are in-contract)', () => {
    expect(fractionBarOracle.verify(identifyClean, identifyCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — correct numerator absent from numeratorChoices', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-1' ? { ...c, numeratorChoices: [4, 2, 5, 6] } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fraction-bar-1' && /numerator 3 is absent/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — correct denominator absent from denominatorChoices', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-2' ? { ...c, denominatorChoices: [9, 7, 4, 6] } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fraction-bar-2' && /denominator 5 is absent/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — improper fraction is unshadeable on the bar', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-3' ? { ...c, numerator: 5, numeratorChoices: [1, 3, 5, 4] } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations; // 5/3 — bar has 3 cells
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fraction-bar-3' && /unwinnable/.test(x.detail))).toBe(true);
  });

  it('flags scope — a twelfth exceeds a "to 8" ceiling', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-1' ? { ...c, numerator: 5, denominator: 12, numeratorChoices: [4, 5, 3, 6], denominatorChoices: [11, 12, 10, 13] } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'fraction-bar-1')).toBe(true);
  });

  it('flags clustering — every fraction is 1/2', () => {
    const data = {
      ...buildClean,
      challengeType: 'build',
      challenges: [
        { id: 'a', numerator: 1, denominator: 2, numeratorChoices: [1, 2, 3, 0], denominatorChoices: [2, 3, 4, 5] },
        { id: 'b', numerator: 1, denominator: 2, numeratorChoices: [1, 2, 3, 0], denominatorChoices: [2, 3, 4, 5] },
        { id: 'c', numerator: 1, denominator: 2, numeratorChoices: [1, 2, 3, 0], denominatorChoices: [2, 3, 4, 5] },
        { id: 'd', numerator: 1, denominator: 2, numeratorChoices: [1, 2, 3, 0], denominatorChoices: [2, 3, 4, 5] },
      ],
    };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate card outside identify (build dedups)', () => {
    const data = {
      ...buildClean,
      challengeType: 'build',
      challenges: [
        { id: 'a', numerator: 2, denominator: 3, numeratorChoices: [2, 1, 3, 4], denominatorChoices: [3, 2, 4, 5] },
        { id: 'b', numerator: 2, denominator: 3, numeratorChoices: [2, 1, 3, 4], denominatorChoices: [3, 2, 4, 5] }, // dup 2/3
        { id: 'c', numerator: 3, denominator: 4, numeratorChoices: [3, 2, 4, 5], denominatorChoices: [4, 3, 5, 6] },
      ],
    };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical fraction/.test(x.detail))).toBe(true);
  });

  it('does NOT flag identify pool-cycled duplicates as clustering', () => {
    // The clean identify fixture repeats 1/2 and 1/6 — must produce no clustering violation.
    const v = fractionBarOracle.verify(identifyClean, identifyCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(false);
  });

  it('flags schema — non-integer denominator', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-1' ? { ...c, denominator: 'six' } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'fraction-bar-1')).toBe(true);
  });

  it('flags schema — duplicate MC options', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'fraction-bar-1' ? { ...c, numeratorChoices: [3, 3, 2, 6] } : c) };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && /numeratorChoices/.test(x.where))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...buildClean, challenges: [buildClean.challenges[0]] };
    const v = fractionBarOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
