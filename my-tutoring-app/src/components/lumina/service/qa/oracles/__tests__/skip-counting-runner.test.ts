import { describe, expect, it } from 'vitest';
import { skipCountingRunnerOracle } from '../skip-counting-runner';

/**
 * Seeded-violation tests: an oracle that never fires is decoration. Each
 * implemented check class gets a fixture the oracle MUST flag, plus clean
 * fixtures it must pass. Fixtures are trimmed from real eval-test output
 * (predict / fill_missing / connect_multiplication modes).
 */

const oracle = skipCountingRunnerOracle;

// ── predict clean fixture (topic "by 2s to 20", Grades 1-2) ─────────────────
const predictCtx = { componentId: 'skip-counting-runner', evalMode: 'predict', topic: 'Skip counting by 2s to 20', gradeLevel: 'grade 2' };

const predictClean = {
  title: 'Bouncing by 2s to 20',
  skipValue: 2,
  startFrom: 0,
  endAt: 20,
  direction: 'forward',
  gradeBand: '1-2',
  character: { type: 'rabbit' },
  challenges: [
    { id: 'c1', type: 'predict', instruction: 'The rabbit is at 2.', hint: 'Add 2.', narration: '2...', hiddenPositions: [4], startPosition: 2 },
    { id: 'c2', type: 'predict', instruction: 'The rabbit is at 4.', hint: 'Add 2.', narration: '4...', hiddenPositions: [6], startPosition: 4 },
    { id: 'c3', type: 'predict', instruction: 'The rabbit is at 8.', hint: 'Add 2.', narration: '8...', hiddenPositions: [10], startPosition: 8 },
    { id: 'c4', type: 'predict', instruction: 'The rabbit is at 12.', hint: 'Add 2.', narration: '12...', hiddenPositions: [14], startPosition: 12 },
    { id: 'c5', type: 'predict', instruction: 'The rabbit is at 16.', hint: 'Add 2.', narration: '16...', hiddenPositions: [18], startPosition: 16 },
    { id: 'c6', type: 'predict', instruction: 'The rabbit is at 18.', hint: 'Last jump!', narration: '18...', hiddenPositions: [20], startPosition: 18 },
  ],
};

// ── connect_multiplication clean fixture (topic "by 5s to 50", Grades 2-3) ──
const connectCtx = { componentId: 'skip-counting-runner', evalMode: 'connect_multiplication', topic: 'Skip counting by 5s to 50', gradeLevel: 'grade 3' };

const connectClean = {
  title: 'Groups of 5',
  skipValue: 5,
  startFrom: 0,
  endAt: 50,
  direction: 'forward',
  gradeBand: '2-3',
  character: { type: 'kangaroo' },
  challenges: [
    { id: 'c1', type: 'connect_multiplication', instruction: 'Reached 10.', hint: 'Count jumps.', narration: '10', startPosition: 10, targetFact: '2 × 5 = 10' },
    { id: 'c2', type: 'connect_multiplication', instruction: 'Reached 20.', hint: 'Count jumps.', narration: '20', startPosition: 20, targetFact: '4 × 5 = 20' },
    { id: 'c3', type: 'connect_multiplication', instruction: 'Reached 30.', hint: 'Count jumps.', narration: '30', startPosition: 30, targetFact: '6 × 5 = 30' },
    { id: 'c4', type: 'connect_multiplication', instruction: 'Reached 40.', hint: 'Count jumps.', narration: '40', startPosition: 40, targetFact: '8 × 5 = 40' },
    { id: 'c5', type: 'connect_multiplication', instruction: 'Reached 50.', hint: 'Count jumps.', narration: '50', startPosition: 50, targetFact: '10 × 5 = 50' },
  ],
};

// ── fill_missing clean fixture (topic "by 5s to 50", Grades 1-2) ────────────
const fillCtx = { componentId: 'skip-counting-runner', evalMode: 'fill_missing', topic: 'Skip counting by 5s to 50', gradeLevel: 'grade 2' };

const fillClean = {
  title: 'Fill the gaps',
  skipValue: 5,
  startFrom: 0,
  endAt: 50,
  direction: 'forward',
  gradeBand: '1-2',
  character: { type: 'frog' },
  challenges: [
    { id: 'c1', type: 'fill_missing', instruction: 'Find the gap.', hint: 'Count by 5s.', narration: '...', startPosition: 0, hiddenPositions: [15] },
    { id: 'c2', type: 'fill_missing', instruction: 'Find the gap.', hint: 'Count by 5s.', narration: '...', startPosition: 0, hiddenPositions: [20] },
    { id: 'c3', type: 'fill_missing', instruction: 'Find the gap.', hint: 'Count by 5s.', narration: '...', startPosition: 0, hiddenPositions: [30] },
    { id: 'c4', type: 'fill_missing', instruction: 'Find the gap.', hint: 'Count by 5s.', narration: '...', startPosition: 0, hiddenPositions: [45, 50] },
    { id: 'c5', type: 'fill_missing', instruction: 'Find the gaps.', hint: 'Count by 5s.', narration: '...', startPosition: 0, hiddenPositions: [10, 25, 35] },
  ],
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

describe('skip-counting-runner oracle — clean fixtures', () => {
  it('passes clean predict data', () => {
    expect(oracle.verify(predictClean, predictCtx).violations).toEqual([]);
  });
  it('passes clean connect_multiplication data', () => {
    expect(oracle.verify(connectClean, connectCtx).violations).toEqual([]);
  });
  it('passes clean fill_missing data', () => {
    expect(oracle.verify(fillClean, fillCtx).violations).toEqual([]);
  });
});

describe('skip-counting-runner oracle — answer-key-desync', () => {
  it('flags an off-grid startPosition (character placed between multiples)', () => {
    const data = clone(predictClean);
    data.challenges[2].startPosition = 9; // odd — not on the by-2 grid
    const v = oracle.verify(data, predictCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c3'))).toBe(true);
  });

  it('flags an unanswerable predict (next landing overshoots endAt)', () => {
    const data = clone(predictClean);
    data.challenges[5].startPosition = 20; // 20 + 2 = 22 > endAt 20 → input never renders
    const v = oracle.verify(data, predictCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /unanswerable/.test(x.detail))).toBe(true);
  });

  it('flags a fill_missing gap equal to startFrom (unsolvable)', () => {
    const data = clone(fillClean);
    data.challenges[0].hiddenPositions = [0]; // === startFrom → can never be filled
    const v = oracle.verify(data, fillCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags a fill_missing gap off the sequence grid', () => {
    const data = clone(fillClean);
    data.challenges[1].hiddenPositions = [22]; // not a multiple of 5
    const v = oracle.verify(data, fillCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags an arithmetically false targetFact (a·b ≠ c)', () => {
    const data = clone(connectClean);
    data.challenges[0].targetFact = '2 × 5 = 25'; // 2×5=10, not 25
    const v = oracle.verify(data, connectCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags a targetFact product that disagrees with the graded answer', () => {
    const data = clone(connectClean);
    // 3 × 5 = 15 is arithmetically true but the character is at 20 (jumpCount 4).
    data.challenges[1].targetFact = '3 × 5 = 15';
    const v = oracle.verify(data, connectCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });
});

describe('skip-counting-runner oracle — scope', () => {
  it('flags a number line above the topic ceiling (the "to 10 taught to 20" class)', () => {
    const tightCtx = { ...predictCtx, topic: 'Skip counting by 2s to 10' };
    const v = oracle.verify(predictClean, tightCtx).violations; // endAt 20 > ceiling 10
    expect(v.some((x) => x.check === 'scope' && x.where === 'range')).toBe(true);
  });

  it('flags a Grades 1-2 skip value outside {2,5,10}', () => {
    const data = {
      ...clone(predictClean),
      skipValue: 3,
      endAt: 30,
      challenges: [
        { id: 'c1', type: 'count_along', instruction: 'Watch.', hint: 'h', narration: 'n', startPosition: 0 },
        { id: 'c2', type: 'count_along', instruction: 'Watch.', hint: 'h', narration: 'n', startPosition: 0 },
        { id: 'c3', type: 'count_along', instruction: 'Watch.', hint: 'h', narration: 'n', startPosition: 0 },
      ],
    };
    const v = oracle.verify(data, { ...predictCtx, topic: 'Skip counting by 3s to 30' }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'skipValue')).toBe(true);
  });
});

describe('skip-counting-runner oracle — clustering', () => {
  it('flags every-answer-the-same predict challenges', () => {
    const data = {
      ...clone(predictClean),
      challenges: [1, 2, 3, 4].map((i) => ({
        id: `c${i}`, type: 'predict', instruction: 'At 4.', hint: 'h', narration: 'n', hiddenPositions: [6], startPosition: 4,
      })),
    };
    const v = oracle.verify(data, predictCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags an exact-duplicate challenge (same type + startPosition + targetFact)', () => {
    const data = clone(connectClean);
    data.challenges.push(clone(connectClean.challenges[0])); // byte-identical to c1
    const v = oracle.verify(data, connectCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag identical find_skip_value answers (one activity = one skip value)', () => {
    const data = {
      ...clone(connectClean),
      challenges: [1, 2, 3, 4, 5].map((i) => ({
        id: `c${i}`, type: 'find_skip_value', instruction: `Look at ${i * 5}.`, hint: 'h', narration: 'n', startPosition: 0,
      })),
    };
    const v = oracle.verify(data, connectCtx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });
});

describe('skip-counting-runner oracle — schema', () => {
  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...clone(predictClean), challenges: [clone(predictClean.challenges[0])] };
    const v = oracle.verify(data, predictCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('flags a non-positive skipValue', () => {
    const data = { ...clone(predictClean), skipValue: 0 };
    const v = oracle.verify(data, predictCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'skipValue')).toBe(true);
  });
});
