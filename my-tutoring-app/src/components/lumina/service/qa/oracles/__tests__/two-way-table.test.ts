import { describe, expect, it } from 'vitest';
import { twoWayTableOracle } from '../two-way-table';

/**
 * Seeded-violation tests for the two-way-table oracle. Clean fixtures mirror real
 * /api/lumina/eval-test generations (conditional + independence, grade 8), plus one
 * mutated fixture per implemented check class that MUST fire. The oracle re-derives
 * the FULL space of valid answers from the frequencies and checks the stored key
 * lands on one — so a desync fixture stores a probability the table can't produce.
 */

const ctx = { componentId: 'two-way-table', evalMode: 'conditional_probability', topic: 'two-way tables', gradeLevel: 'grade 8' };

const conditionalClean = {
  title: 'Conditional', description: 'Read the table.',
  challenges: [
    { id: 'twt-1', challengeType: 'conditional_probability', scenario: 'Music by age', rowLabel: 'Age', columnLabel: 'Music', rowCategories: ['Teen', 'Adult'], columnCategories: ['Pop', 'Rock'], frequencies: [[32, 8], [12, 28]], question: 'P(Rock | Teen)?', expectedProbability: 0.2, tolerance: 0.02, showTotals: false, answerTotalAxis: 'row', answerTotalIndex: 0, hint: '8 ÷ 40' },
    { id: 'twt-2', challengeType: 'conditional_probability', scenario: 'Phone by age', rowLabel: 'Age', columnLabel: 'Brand', rowCategories: ['Under 30', '30+'], columnCategories: ['A', 'B'], frequencies: [[42, 18], [15, 45]], question: 'P(30+ | A)?', expectedProbability: 0.2632, tolerance: 0.02, showTotals: false, answerTotalAxis: 'col', answerTotalIndex: 0, hint: '15 ÷ 57' },
    { id: 'twt-3', challengeType: 'conditional_probability', scenario: 'Lunch by grade', rowLabel: 'Grade', columnLabel: 'Lunch', rowCategories: ['Grade 6', 'Grade 7'], columnCategories: ['Cafeteria', 'Packed'], frequencies: [[36, 24], [28, 32]], question: 'P(Packed | Grade 6)?', expectedProbability: 0.4, tolerance: 0.02, showTotals: false, answerTotalAxis: 'row', answerTotalIndex: 0, hint: '24 ÷ 60' },
  ],
};

const independenceClean = {
  title: 'Independence', description: 'Expected under independence.',
  challenges: [
    { id: 'it-1', challengeType: 'independence_test', scenario: 'Gender by genre', rowLabel: 'Gender', columnLabel: 'Genre', rowCategories: ['Male', 'Female'], columnCategories: ['Comedy', 'Drama'], frequencies: [[30, 20], [18, 32]], question: 'P(Male)×P(Drama)?', expectedProbability: 0.26, tolerance: 0.02, showTotals: false, answerTotalAxis: 'both', answerTotalIndex: null, hint: '?' },
    { id: 'it-2', challengeType: 'independence_test', scenario: 'Gender by pet', rowLabel: 'Gender', columnLabel: 'Pet', rowCategories: ['Male', 'Female'], columnCategories: ['Cats', 'Dogs'], frequencies: [[28, 12], [18, 22]], question: 'P(Female)×P(Dogs)?', expectedProbability: 0.2875, tolerance: 0.02, showTotals: false, answerTotalAxis: 'both', answerTotalIndex: null, hint: '?' },
    { id: 'it-3', challengeType: 'independence_test', scenario: 'Row by col', rowLabel: 'R', columnLabel: 'C', rowCategories: ['R1', 'R2'], columnCategories: ['C1', 'C2'], frequencies: [[40, 10], [10, 40]], question: 'P(R1)×P(C1)?', expectedProbability: 0.25, tolerance: 0.02, showTotals: false, answerTotalAxis: 'both', answerTotalIndex: null, hint: '?' },
  ],
};

describe('two-way-table oracle', () => {
  it('passes clean conditional_probability', () => {
    expect(twoWayTableOracle.verify(conditionalClean, ctx).violations).toEqual([]);
  });
  it('passes clean independence_test', () => {
    expect(twoWayTableOracle.verify(independenceClean, ctx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — a conditional probability the table cannot produce', () => {
    const data = { ...conditionalClean, challenges: conditionalClean.challenges.map((c) => c.id === 'twt-1' ? { ...c, expectedProbability: 0.5 } : c) };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'twt-1')).toBe(true);
  });
  it('flags answer-key-desync — an independence value that is not P(row)·P(col)', () => {
    const data = { ...independenceClean, challenges: independenceClean.challenges.map((c) => c.id === 'it-1' ? { ...c, expectedProbability: 0.42 } : c) };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'it-1')).toBe(true);
  });

  // ── scope ──
  it('flags scope — a probability outside [0,1]', () => {
    const data = { ...conditionalClean, challenges: conditionalClean.challenges.map((c) => c.id === 'twt-1' ? { ...c, expectedProbability: 1.5 } : c) };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every stored probability is the same', () => {
    const data = { ...conditionalClean, challenges: conditionalClean.challenges.map((c, i) => ({ ...c, id: `k${i}`, frequencies: [[20, 20], [20, 20]], expectedProbability: 0.5, answerTotalAxis: 'row', answerTotalIndex: 0, question: `q${i}` })) };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate card', () => {
    const dup = { ...conditionalClean.challenges[0], id: 'twt-dup' };
    const data = { ...conditionalClean, challenges: [...conditionalClean.challenges, dup] };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /duplicated/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...conditionalClean, challenges: [conditionalClean.challenges[0]] };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
  it('flags schema — a non-rectangular frequencies matrix', () => {
    const data = { ...conditionalClean, challenges: conditionalClean.challenges.map((c) => c.id === 'twt-1' ? { ...c, frequencies: [[1, 2], [3]] } : c) };
    const v = twoWayTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'twt-1')).toBe(true);
  });
});
