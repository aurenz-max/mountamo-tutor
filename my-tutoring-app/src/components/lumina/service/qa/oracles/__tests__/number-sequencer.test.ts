import { describe, expect, it } from 'vitest';
import { numberSequencerOracle } from '../number-sequencer';

/**
 * Seeded-violation tests for the number-sequencer oracle. Clean fixtures per mode
 * are trimmed verbatim from real /api/lumina/eval-test generations
 * (topic "Counting and skip counting to 100", grade 2 → gradeBand '1'), plus one
 * mutated fixture per implemented check class that MUST fire. Mirrors the
 * comparison-builder / array-grid blocks.
 */

// gradeBand '1' → intrinsic ceiling 100; topic names 100, so clean values stay in scope.
const nsCtx = { componentId: 'number-sequencer', evalMode: 'fill_missing', topic: 'Counting and skip counting to 100', gradeLevel: 'grade 2' };
// Scope-bearing topic → ceiling 50; used to prove the scope check bites on the 67-90 cards.
const nsTo50Ctx = { ...nsCtx, topic: 'Counting to 50' };

// ── fill-missing — real generation (grade 2) ──
const fillClean = {
  title: 'Counting Adventures to 100',
  gradeBand: '1',
  showNumberLine: true,
  showDotArrays: false,
  challenges: [
    { id: 'seq1', type: 'fill-missing', instruction: 'Find the missing number.', sequence: [21, 22, null, 24, 25], correctAnswers: [23], rangeMin: 21, rangeMax: 25 },
    { id: 'seq2', type: 'fill-missing', instruction: 'Fill in the blanks.', sequence: [48, null, 50, 51, null], correctAnswers: [49, 52], rangeMin: 48, rangeMax: 52 },
    { id: 'seq3', type: 'fill-missing', instruction: 'Skip count by tens.', sequence: [10, 20, null, 40, null], correctAnswers: [30, 50], rangeMin: 10, rangeMax: 50 },
    { id: 'seq4', type: 'fill-missing', instruction: 'Spot the missing numbers.', sequence: [67, 68, null, null, 71], correctAnswers: [69, 70], rangeMin: 67, rangeMax: 71 },
    { id: 'seq5', type: 'fill-missing', instruction: 'Complete the pattern.', sequence: [85, null, null, 88, 89, null], correctAnswers: [86, 87, 90], rangeMin: 85, rangeMax: 90 },
  ],
};

// ── before-after — real generation ──
const beforeAfterClean = {
  title: 'Before and After', gradeBand: '1', showNumberLine: true, showDotArrays: false,
  challenges: [
    { id: 'b1', type: 'before-after', instruction: '?', sequence: [4, null], correctAnswers: [5], rangeMin: 4, rangeMax: 5 },
    { id: 'b2', type: 'before-after', instruction: '?', sequence: [null, 12], correctAnswers: [11], rangeMin: 11, rangeMax: 12 },
    { id: 'b3', type: 'before-after', instruction: '?', sequence: [29, null], correctAnswers: [30], rangeMin: 29, rangeMax: 30 },
    { id: 'b4', type: 'before-after', instruction: '?', sequence: [null, 50], correctAnswers: [49], rangeMin: 49, rangeMax: 50 },
    { id: 'b5', type: 'before-after', instruction: '?', sequence: [99, null], correctAnswers: [100], rangeMin: 99, rangeMax: 100 },
  ],
};

// ── order-cards — real generation ──
const orderClean = {
  title: 'Put Them In Order', gradeBand: '1', showNumberLine: true, showDotArrays: false,
  challenges: [
    { id: 'o1', type: 'order-cards', instruction: '?', sequence: [8, 2, 5, 1], correctAnswers: [1, 2, 5, 8], rangeMin: 1, rangeMax: 10 },
    { id: 'o2', type: 'order-cards', instruction: '?', sequence: [14, 20, 11, 17, 13], correctAnswers: [11, 13, 14, 17, 20], rangeMin: 11, rangeMax: 20 },
    { id: 'o3', type: 'order-cards', instruction: '?', sequence: [42, 49, 45, 41, 47], correctAnswers: [41, 42, 45, 47, 49], rangeMin: 41, rangeMax: 49 },
    { id: 'o4', type: 'order-cards', instruction: '?', sequence: [70, 30, 90, 20, 50], correctAnswers: [20, 30, 50, 70, 90], rangeMin: 20, rangeMax: 90 },
    { id: 'o5', type: 'order-cards', instruction: '?', sequence: [95, 62, 88, 74, 99, 68], correctAnswers: [62, 68, 74, 88, 95, 99], rangeMin: 62, rangeMax: 99 },
  ],
};

// ── count-from — real generation ──
const countClean = {
  title: 'Keep Counting', gradeBand: '1', showNumberLine: true, showDotArrays: true,
  challenges: [
    { id: 'c1', type: 'count-from', instruction: '?', sequence: [5], correctAnswers: [6, 7, 8], startNumber: 5, direction: 'forward', rangeMin: 5, rangeMax: 8 },
    { id: 'c2', type: 'count-from', instruction: '?', sequence: [22], correctAnswers: [23, 24, 25, 26], startNumber: 22, direction: 'forward', rangeMin: 22, rangeMax: 26 },
    { id: 'c3', type: 'count-from', instruction: '?', sequence: [15], correctAnswers: [14, 13, 12], startNumber: 15, direction: 'backward', rangeMin: 12, rangeMax: 15 },
    { id: 'c4', type: 'count-from', instruction: '?', sequence: [40], correctAnswers: [50, 60, 70], startNumber: 40, direction: 'forward', rangeMin: 40, rangeMax: 70 },
    { id: 'c5', type: 'count-from', instruction: '?', sequence: [95], correctAnswers: [94, 93, 92, 91], startNumber: 95, direction: 'backward', rangeMin: 91, rangeMax: 95 },
  ],
};

// ── decade-fill — real generation ──
const decadeClean = {
  title: 'Decade Fill', gradeBand: '1', showNumberLine: true, showDotArrays: false,
  challenges: [
    { id: 'd1', type: 'decade-fill', instruction: '?', sequence: [8, 9, null, 11, 12], correctAnswers: [10], rangeMin: 8, rangeMax: 12 },
    { id: 'd2', type: 'decade-fill', instruction: '?', sequence: [18, 19, null, 21, 22], correctAnswers: [20], rangeMin: 18, rangeMax: 22 },
    { id: 'd3', type: 'decade-fill', instruction: '?', sequence: [29, null, 31, 32, null], correctAnswers: [30, 33], rangeMin: 29, rangeMax: 33 },
    { id: 'd4', type: 'decade-fill', instruction: '?', sequence: [48, null, 50, 51, null], correctAnswers: [49, 52], rangeMin: 48, rangeMax: 52 },
    { id: 'd5', type: 'decade-fill', instruction: '?', sequence: [89, null, 91, null, 93], correctAnswers: [90, 92], rangeMin: 89, rangeMax: 93 },
  ],
};

describe('number-sequencer oracle', () => {
  // ── clean generations pass ──
  it('passes clean fill-missing', () => {
    expect(numberSequencerOracle.verify(fillClean, nsCtx).violations).toEqual([]);
  });
  it('passes clean before-after', () => {
    expect(numberSequencerOracle.verify(beforeAfterClean, nsCtx).violations).toEqual([]);
  });
  it('passes clean order-cards', () => {
    expect(numberSequencerOracle.verify(orderClean, nsCtx).violations).toEqual([]);
  });
  it('passes clean count-from', () => {
    expect(numberSequencerOracle.verify(countClean, nsCtx).violations).toEqual([]);
  });
  it('passes clean decade-fill', () => {
    expect(numberSequencerOracle.verify(decadeClean, nsCtx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — a fill-missing blank value disagrees with the pattern', () => {
    const data = { ...fillClean, challenges: fillClean.challenges.map((c) => c.id === 'seq1' ? { ...c, correctAnswers: [99] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'seq1')).toBe(true);
  });
  it('flags answer-key-desync — blank count disagrees with correctAnswers length', () => {
    const data = { ...fillClean, challenges: fillClean.challenges.map((c) => c.id === 'seq2' ? { ...c, correctAnswers: [49] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'seq2')).toBe(true);
  });
  it('flags answer-key-desync — visible terms are not one arithmetic rule', () => {
    const data = { ...fillClean, challenges: fillClean.challenges.map((c) => c.id === 'seq1' ? { ...c, sequence: [21, 22, null, 30, 25] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'seq1')).toBe(true);
  });
  it('flags answer-key-desync — order-cards key is not the ascending order', () => {
    const data = { ...orderClean, challenges: orderClean.challenges.map((c) => c.id === 'o1' ? { ...c, correctAnswers: [8, 5, 2, 1] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'o1')).toBe(true);
  });
  it('flags answer-key-desync — order-cards key value not in the pool (unreachable)', () => {
    const data = { ...orderClean, challenges: orderClean.challenges.map((c) => c.id === 'o1' ? { ...c, correctAnswers: [1, 2, 5, 9] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'o1')).toBe(true);
  });
  it('flags answer-key-desync — count-from run does not start from startNumber', () => {
    const data = { ...countClean, challenges: countClean.challenges.map((c) => c.id === 'c1' ? { ...c, correctAnswers: [7, 8, 9] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });
  it('flags answer-key-desync — count-from direction contradicts the run', () => {
    const data = { ...countClean, challenges: countClean.challenges.map((c) => c.id === 'c3' ? { ...c, direction: 'forward' } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c3')).toBe(true);
  });
  it('flags answer-key-desync — decade-fill answer outside the rendered grid', () => {
    const data = { ...decadeClean, challenges: decadeClean.challenges.map((c) => c.id === 'd1' ? { ...c, correctAnswers: [99], sequence: [8, 9, null, 11, 12] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'd1')).toBe(true);
  });

  // ── scope ──
  it('flags scope — values exceed a "to 50" ceiling', () => {
    const v = numberSequencerOracle.verify(fillClean, nsTo50Ctx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'seq4')).toBe(true); // 67-71
    expect(v.some((x) => x.check === 'scope' && x.where === 'seq5')).toBe(true); // 85-90
  });

  // ── clustering ──
  it('flags clustering — every card has the same answers', () => {
    const data = {
      ...fillClean,
      challenges: [
        { id: 'a', type: 'fill-missing', instruction: '?', sequence: [1, null, 3], correctAnswers: [2], rangeMin: 1, rangeMax: 3 },
        { id: 'b', type: 'fill-missing', instruction: '?', sequence: [3, null, 1], correctAnswers: [2], rangeMin: 1, rangeMax: 3 },
        { id: 'c', type: 'fill-missing', instruction: '?', sequence: [0, null, 4], correctAnswers: [2], rangeMin: 0, rangeMax: 4 },
        { id: 'd', type: 'fill-missing', instruction: '?', sequence: [4, null, 0], correctAnswers: [2], rangeMin: 0, rangeMax: 4 },
      ],
    };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate card', () => {
    const dup = { id: 'seq1b', type: 'fill-missing', instruction: 'dup', sequence: [21, 22, null, 24, 25], correctAnswers: [23], rangeMin: 21, rangeMax: 25 };
    const data = { ...fillClean, challenges: [...fillClean.challenges, dup] };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a null-fill sequence with no blank', () => {
    const data = { ...fillClean, challenges: fillClean.challenges.map((c) => c.id === 'seq1' ? { ...c, sequence: [21, 22, 23, 24, 25], correctAnswers: [23] } : c) };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'seq1')).toBe(true);
  });
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...fillClean, challenges: [fillClean.challenges[0]] };
    const v = numberSequencerOracle.verify(data, nsCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
