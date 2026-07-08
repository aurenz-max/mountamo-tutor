import { describe, expect, it } from 'vitest';
import { comparisonBuilderOracle } from '../comparison-builder';

/**
 * Seeded-violation tests for the comparison-builder oracle. Clean fixtures per
 * mode (trimmed from real /api/lumina/eval-test generations) plus one mutated
 * fixture per implemented check class that MUST fire. Mirrors the array-grid /
 * math-fact-fluency blocks.
 */

// gradeBand 'K' → intrinsic ceiling 10, so clean quantities (≤9) stay in scope.
const cbCtx = { componentId: 'comparison-builder', evalMode: 'compare_groups', topic: 'Comparing groups of objects', gradeLevel: 'kindergarten' };
// Scope-bearing topic → ceiling 5; used to prove the scope check bites.
const cbTo5Ctx = { ...cbCtx, topic: 'Comparing numbers to 5' };

// ── compare-groups — trimmed straight from a real generation (grade K) ──
const groupsClean = {
  title: 'Comparing Our Collections',
  gradeBand: 'K',
  challenges: [
    { id: 'c1', type: 'compare-groups', instruction: 'more, fewer, or same?', leftGroup: { count: 2, objectType: 'butterflies' }, rightGroup: { count: 1, objectType: 'butterflies' }, correctAnswer: 'more' },
    { id: 'c2', type: 'compare-groups', instruction: 'more, fewer, or same?', leftGroup: { count: 3, objectType: 'apples' }, rightGroup: { count: 4, objectType: 'apples' }, correctAnswer: 'less' },
    { id: 'c3', type: 'compare-groups', instruction: 'more, fewer, or same?', leftGroup: { count: 5, objectType: 'stars' }, rightGroup: { count: 5, objectType: 'stars' }, correctAnswer: 'equal' },
    { id: 'c4', type: 'compare-groups', instruction: 'more, fewer, or same?', leftGroup: { count: 7, objectType: 'bears' }, rightGroup: { count: 5, objectType: 'bears' }, correctAnswer: 'more' },
    { id: 'c5', type: 'compare-groups', instruction: 'more, fewer, or same?', leftGroup: { count: 6, objectType: 'cookies' }, rightGroup: { count: 9, objectType: 'cookies' }, correctAnswer: 'less' },
  ],
};

const numbersClean = {
  title: 'Which is bigger?',
  gradeBand: 'K',
  challenges: [
    { id: 'n1', type: 'compare-numbers', instruction: '?', leftNumber: 3, rightNumber: 5, correctSymbol: '<' },
    { id: 'n2', type: 'compare-numbers', instruction: '?', leftNumber: 7, rightNumber: 2, correctSymbol: '>' },
    { id: 'n3', type: 'compare-numbers', instruction: '?', leftNumber: 4, rightNumber: 4, correctSymbol: '=' },
    { id: 'n4', type: 'compare-numbers', instruction: '?', leftNumber: 8, rightNumber: 6, correctSymbol: '>' },
    { id: 'n5', type: 'compare-numbers', instruction: '?', leftNumber: 1, rightNumber: 9, correctSymbol: '<' },
  ],
};

const orderClean = {
  title: 'Put them in order',
  gradeBand: 'K',
  challenges: [
    { id: 'o1', type: 'order', instruction: '?', numbers: [3, 1, 2], direction: 'ascending' },
    { id: 'o2', type: 'order', instruction: '?', numbers: [5, 8, 6], direction: 'ascending' },
    { id: 'o3', type: 'order', instruction: '?', numbers: [9, 4, 7], direction: 'descending' },
  ],
};

const oneMoreLessClean = {
  title: 'One more, one less',
  gradeBand: 'K',
  challenges: [
    { id: 'm1', type: 'one-more-one-less', instruction: '?', targetNumber: 4, askFor: 'both' },
    { id: 'm2', type: 'one-more-one-less', instruction: '?', targetNumber: 6, askFor: 'both' },
    { id: 'm3', type: 'one-more-one-less', instruction: '?', targetNumber: 8, askFor: 'both' },
  ],
};

describe('comparison-builder oracle', () => {
  it('passes clean compare-groups', () => {
    expect(comparisonBuilderOracle.verify(groupsClean, cbCtx).violations).toEqual([]);
  });
  it('passes clean compare-numbers', () => {
    expect(comparisonBuilderOracle.verify(numbersClean, cbCtx).violations).toEqual([]);
  });
  it('passes clean order', () => {
    expect(comparisonBuilderOracle.verify(orderClean, cbCtx).violations).toEqual([]);
  });
  it('passes clean one-more-one-less', () => {
    expect(comparisonBuilderOracle.verify(oneMoreLessClean, cbCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — compare-groups relation disagrees with the counts', () => {
    const data = { ...groupsClean, challenges: groupsClean.challenges.map((c) => c.id === 'c1' ? { ...c, correctAnswer: 'less' } : c) };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });

  it('flags answer-key-desync — compare-numbers symbol disagrees with the numbers', () => {
    const data = { ...numbersClean, challenges: numbersClean.challenges.map((c) => c.id === 'n1' ? { ...c, correctSymbol: '>' } : c) };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'n1')).toBe(true);
  });

  it('flags answer-key-desync — one-less of target 0 is an unreachable answer', () => {
    const data = { ...oneMoreLessClean, challenges: [{ id: 'm0', type: 'one-more-one-less', instruction: '?', targetNumber: 0, askFor: 'both' }, ...oneMoreLessClean.challenges] };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm0')).toBe(true);
  });

  it('flags scope — group counts exceed a "to 5" ceiling', () => {
    const v = comparisonBuilderOracle.verify(groupsClean, cbTo5Ctx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'c4')).toBe(true); // 7 vs 5
  });

  it('flags scope — one-more produces a value past the ceiling', () => {
    const data = { ...oneMoreLessClean, challenges: [{ id: 'mMax', type: 'one-more-one-less', instruction: '?', targetNumber: 10, askFor: 'one-more' }, ...oneMoreLessClean.challenges] };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations; // K ceiling 10; one-more of 10 = 11
    expect(v.some((x) => x.check === 'scope' && x.where === 'mMax')).toBe(true);
  });

  it('flags clustering — every group relation is "more"', () => {
    const data = {
      ...groupsClean,
      challenges: [
        { id: 'a', type: 'compare-groups', instruction: '?', leftGroup: { count: 2, objectType: 'x' }, rightGroup: { count: 1, objectType: 'x' }, correctAnswer: 'more' },
        { id: 'b', type: 'compare-groups', instruction: '?', leftGroup: { count: 3, objectType: 'x' }, rightGroup: { count: 2, objectType: 'x' }, correctAnswer: 'more' },
        { id: 'c', type: 'compare-groups', instruction: '?', leftGroup: { count: 5, objectType: 'x' }, rightGroup: { count: 4, objectType: 'x' }, correctAnswer: 'more' },
        { id: 'd', type: 'compare-groups', instruction: '?', leftGroup: { count: 7, objectType: 'x' }, rightGroup: { count: 6, objectType: 'x' }, correctAnswer: 'more' },
      ],
    };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate group card', () => {
    const data = {
      ...groupsClean,
      challenges: [
        { id: 'a', type: 'compare-groups', instruction: '?', leftGroup: { count: 3, objectType: 'x' }, rightGroup: { count: 1, objectType: 'x' }, correctAnswer: 'more' },
        { id: 'b', type: 'compare-groups', instruction: '?', leftGroup: { count: 3, objectType: 'y' }, rightGroup: { count: 1, objectType: 'y' }, correctAnswer: 'more' }, // dup 3v1
        { id: 'c', type: 'compare-groups', instruction: '?', leftGroup: { count: 2, objectType: 'z' }, rightGroup: { count: 5, objectType: 'z' }, correctAnswer: 'less' },
        { id: 'd', type: 'compare-groups', instruction: '?', leftGroup: { count: 4, objectType: 'w' }, rightGroup: { count: 4, objectType: 'w' }, correctAnswer: 'equal' },
      ],
    };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags schema — non-integer group count', () => {
    const data = { ...groupsClean, challenges: groupsClean.challenges.map((c) => c.id === 'c1' ? { ...c, leftGroup: { count: 'two', objectType: 'x' } } : c) };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });

  it('flags schema — duplicate values in an ordering task (non-unique answer)', () => {
    const data = { ...orderClean, challenges: orderClean.challenges.map((c) => c.id === 'o1' ? { ...c, numbers: [3, 3, 5] } : c) };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'o1')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...groupsClean, challenges: [groupsClean.challenges[0]] };
    const v = comparisonBuilderOracle.verify(data, cbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
