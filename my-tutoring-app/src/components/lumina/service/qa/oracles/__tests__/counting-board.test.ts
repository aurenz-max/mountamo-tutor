import { describe, expect, it } from 'vitest';
import { countingBoardOracle } from '../counting-board';

/**
 * Seeded-violation tests for the counting-board oracle. Clean fixtures are
 * trimmed straight from real /api/lumina/eval-test generations (count mode, K,
 * "Counting to 20"; compare mode, grade 1). Each implemented check class then
 * gets a mutated fixture that MUST fire. Mirrors the array-grid / comparison-builder
 * blocks.
 */

// "Counting to 20" → ceiling 20; the real count fixture (counts ≤ 20) stays in scope.
const ctx = { componentId: 'counting-board', evalMode: 'count', topic: 'Counting to 20', gradeLevel: 'kindergarten' };
// Tighter "to 10" ceiling — used to prove the scope check bites on the same fixture.
const ctxScope10 = { componentId: 'counting-board', evalMode: 'count', topic: 'Counting to 10', gradeLevel: 'kindergarten' };
const ctxCompare = { componentId: 'counting-board', evalMode: 'compare', topic: 'Counting to 20', gradeLevel: 'grade 1' };

// Real count_all generation (K, "Counting to 20"): targetAnswer === count throughout.
const countClean = {
  title: 'Counting Blocks',
  objects: { type: 'blocks' },
  gradeBand: 'K',
  challenges: [
    { id: 'c1', type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'circle', groupSize: null, startFrom: null },
    { id: 'c2', type: 'count_all', count: 8, targetAnswer: 8, arrangement: 'line', groupSize: null, startFrom: null },
    { id: 'c3', type: 'count_all', count: 12, targetAnswer: 12, arrangement: 'scattered', groupSize: null, startFrom: null },
    { id: 'c4', type: 'count_all', count: 14, targetAnswer: 14, arrangement: 'groups', groupSize: 5, startFrom: null },
    { id: 'c5', type: 'count_all', count: 16, targetAnswer: 16, arrangement: 'line', groupSize: null, startFrom: null },
    { id: 'c6', type: 'count_all', count: 18, targetAnswer: 18, arrangement: 'scattered', groupSize: null, startFrom: null },
    { id: 'c7', type: 'count_all', count: 20, targetAnswer: 20, arrangement: 'circle', groupSize: null, startFrom: null },
  ],
};

// Real compare generation (grade 1): targetAnswer === groupSize (larger), count = larger + smaller.
const compareClean = {
  title: 'Which Has More Bears?',
  objects: { type: 'bears' },
  gradeBand: '1',
  challenges: [
    { id: 'c1', type: 'compare', count: 12, targetAnswer: 8, arrangement: 'groups', groupSize: 8, startFrom: null },
    { id: 'c2', type: 'compare', count: 5, targetAnswer: 4, arrangement: 'groups', groupSize: 4, startFrom: null },
    { id: 'c3', type: 'compare', count: 10, targetAnswer: 7, arrangement: 'groups', groupSize: 7, startFrom: null },
    { id: 'c4', type: 'compare', count: 8, targetAnswer: 6, arrangement: 'groups', groupSize: 6, startFrom: null },
    { id: 'c5', type: 'compare', count: 7, targetAnswer: 5, arrangement: 'groups', groupSize: 5, startFrom: null },
  ],
};

describe('counting-board oracle', () => {
  it('passes clean count_all data', () => {
    expect(countingBoardOracle.verify(countClean, ctx).violations).toEqual([]);
  });

  it('passes clean compare data (targetAnswer = larger group, not count)', () => {
    expect(countingBoardOracle.verify(compareClean, ctxCompare).violations).toEqual([]);
  });

  it('flags answer-key-desync — board shows N objects but targetAnswer says M (count mode)', () => {
    const data = {
      ...countClean,
      challenges: countClean.challenges.map((c, i) =>
        i === 2 ? { ...c, targetAnswer: 11 } : c, // board shows 12, key says 11
      ),
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c3')).toBe(true);
  });

  it('flags answer-key-desync — compare groupSize disagrees with targetAnswer', () => {
    const data = {
      ...compareClean,
      challenges: compareClean.challenges.map((c) =>
        c.id === 'c1' ? { ...c, targetAnswer: 4 } : c, // larger group is 8 (groupSize), key says 4
      ),
    };
    const v = countingBoardOracle.verify(data, ctxCompare).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });

  it('flags answer-key-desync — subitize_perceptual answer > 3 is unreachable (only 1/2/3-finger hands)', () => {
    const data = {
      ...countClean,
      challenges: [
        { id: 'p1', type: 'subitize_perceptual', count: 2, targetAnswer: 2, arrangement: 'scattered', groupSize: null, startFrom: null },
        { id: 'p2', type: 'subitize_perceptual', count: 5, targetAnswer: 5, arrangement: 'scattered', groupSize: null, startFrom: null }, // 5 > 3 — no hand
        { id: 'p3', type: 'subitize_perceptual', count: 3, targetAnswer: 3, arrangement: 'groups', groupSize: null, startFrom: null },
      ],
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'p2')).toBe(true);
  });

  it('flags scope violation — count exceeds the topic ceiling ("Counting to 10" rendering 12+)', () => {
    const v = countingBoardOracle.verify(countClean, ctxScope10).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'c3')).toBe(true);
  });

  it('flags clustering — every board has the same targetAnswer', () => {
    const data = {
      ...countClean,
      challenges: [1, 2, 3, 4].map((i) => ({
        id: `k${i}`, type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'line', groupSize: null, startFrom: null,
      })),
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate board card (same type + count + arrangement)', () => {
    const data = {
      ...countClean,
      challenges: [
        ...countClean.challenges,
        { id: 'c8', type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'circle', groupSize: null, startFrom: null }, // dup of c1
      ],
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = {
      ...countClean,
      challenges: [{ id: 'c1', type: 'count_all', count: 5, targetAnswer: 5, arrangement: 'line', groupSize: null, startFrom: null }],
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a schema violation — non-integer count', () => {
    const data = {
      ...countClean,
      challenges: [
        { id: 'c1', type: 'count_all', count: 'five', targetAnswer: 5, arrangement: 'line', groupSize: null, startFrom: null },
        { id: 'c2', type: 'count_all', count: 8, targetAnswer: 8, arrangement: 'line', groupSize: null, startFrom: null },
        { id: 'c3', type: 'count_all', count: 10, targetAnswer: 10, arrangement: 'scattered', groupSize: null, startFrom: null },
      ],
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });

  it('flags a schema violation — count_on startFrom leaves nothing to count on (startFrom >= count)', () => {
    const data = {
      ...countClean,
      challenges: [
        { id: 'c1', type: 'count_on', count: 8, targetAnswer: 8, arrangement: 'line', groupSize: null, startFrom: 8 }, // == count
        { id: 'c2', type: 'count_on', count: 9, targetAnswer: 9, arrangement: 'line', groupSize: null, startFrom: 5 },
        { id: 'c3', type: 'count_on', count: 10, targetAnswer: 10, arrangement: 'scattered', groupSize: null, startFrom: 6 },
      ],
    };
    const v = countingBoardOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });

  it('records an unknown challenge type in uncheckedTypes rather than silently skipping', () => {
    const data = {
      ...countClean,
      challenges: [
        { id: 'c1', type: 'mystery_mode', count: 5, targetAnswer: 5, arrangement: 'line', groupSize: null, startFrom: null },
        { id: 'c2', type: 'count_all', count: 8, targetAnswer: 8, arrangement: 'line', groupSize: null, startFrom: null },
        { id: 'c3', type: 'count_all', count: 10, targetAnswer: 10, arrangement: 'scattered', groupSize: null, startFrom: null },
      ],
    };
    const res = countingBoardOracle.verify(data, ctx);
    expect(res.uncheckedTypes).toContain('mystery_mode');
  });
});
