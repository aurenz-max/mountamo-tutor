import { describe, expect, it } from 'vitest';
import { hundredsChartOracle } from '../hundreds-chart';

/**
 * Seeded-violation tests for the hundreds-chart oracle. Two clean fixtures
 * (trimmed straight from real /api/lumina/eval-test generations — complete_sequence
 * and find_skip_value, grade 2, "Skip counting by 5s and 10s to 100") plus one
 * mutated fixture per implemented check class that MUST fire, including a
 * skip-count cell set with the WRONG step.
 */

// Scope-bearing topic → ceiling 100 (matches gridMax); real cells (≤100) stay in scope.
const ctx = {
  componentId: 'hundreds-chart',
  evalMode: 'complete_sequence',
  topic: 'Skip counting by 5s and 10s to 100',
  gradeLevel: 'grade 2',
};
// Tight topic → ceiling 50; used to prove the scope check bites on cells up to 100.
const ctxTo50 = { ...ctx, topic: 'Skip counting by 5s and 10s to 50' };

/** Canonical count-by-skip run to 100 (the same ground truth the oracle recomputes). */
const run = (skip: number): number[] => {
  const r: number[] = [];
  for (let n = skip; n <= 100; n += skip) r.push(n);
  return r;
};

// ── Clean fixture #1 — real complete_sequence generation (5 challenges) ──
const completeClean = {
  title: 'Number Path Adventures!',
  description: 'Explore skip counting patterns.',
  gridMax: 100,
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'complete_sequence', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15], correctCells: run(5).slice(3), correctAnswer: '', options: [] },
    { id: 'c2', type: 'complete_sequence', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30], correctCells: run(10).slice(3), correctAnswer: '', options: [] },
    { id: 'c3', type: 'complete_sequence', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6], correctCells: run(2).slice(3), correctAnswer: '', options: [] },
    { id: 'c4', type: 'complete_sequence', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15], correctCells: run(5).slice(3), correctAnswer: '', options: [] },
    { id: 'c5', type: 'complete_sequence', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30], correctCells: run(10).slice(3), correctAnswer: '', options: [] },
  ],
};

// ── Clean fixture #2 — real find_skip_value generation (5 challenges) ──
const skipClean = {
  title: 'Pattern Hunter Adventure!',
  description: 'Find the skip interval.',
  gridMax: 100,
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'find_skip_value', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6, 8], correctCells: [2, 4, 6, 8], correctAnswer: '2', options: ['2', '5', '3', '10'] },
    { id: 'c2', type: 'find_skip_value', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: '5', options: ['10', '3', '2', '5'] },
    { id: 'c3', type: 'find_skip_value', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30, 40], correctCells: [10, 20, 30, 40], correctAnswer: '10', options: ['2', '10', '5', '20'] },
    { id: 'c4', type: 'find_skip_value', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6, 8], correctCells: [2, 4, 6, 8], correctAnswer: '2', options: ['2', '3', '5', '10'] },
    { id: 'c5', type: 'find_skip_value', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: '5', options: ['3', '2', '5', '10'] },
  ],
};

describe('hundreds-chart oracle', () => {
  it('passes clean complete_sequence data (real generation)', () => {
    expect(hundredsChartOracle.verify(completeClean, ctx).violations).toEqual([]);
  });

  it('passes clean find_skip_value data (real generation)', () => {
    expect(hundredsChartOracle.verify(skipClean, ctx).violations).toEqual([]);
  });

  it('does NOT flag legitimate small-pool card reuse (c1≡c4, c2≡c5 by design)', () => {
    // The clean fixtures ALREADY contain exact (type, skipValue) repeats — assert
    // no clustering violation fires on them (the deliberate non-check).
    const v = hundredsChartOracle.verify(completeClean, ctx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  it('records identify_pattern in uncheckedTypes (free-text pattern not derivable)', () => {
    const data = {
      ...skipClean,
      challenges: [
        { id: 'p1', type: 'identify_pattern', skipValue: 5, startNumber: 5, givenCells: run(5), correctCells: run(5), correctAnswer: 'Two vertical columns (5th and 10th)', options: ['Two vertical columns (5th and 10th)', 'A checkerboard pattern', 'They fill every row completely', 'A diagonal stripe'] },
        { id: 'p2', type: 'identify_pattern', skipValue: 10, startNumber: 10, givenCells: run(10), correctCells: run(10), correctAnswer: 'One vertical column (the last column)', options: ['One vertical column (the last column)', 'They fill every other row', 'Every other cell in each row', 'A diagonal stripe'] },
        { id: 'p3', type: 'identify_pattern', skipValue: 2, startNumber: 2, givenCells: run(2), correctCells: run(2), correctAnswer: 'Every other cell in each row', options: ['Every other cell in each row', 'A checkerboard pattern', 'They are scattered randomly', 'A diagonal stripe'] },
      ],
    };
    const res = hundredsChartOracle.verify(data, ctx);
    expect(res.violations).toEqual([]);
    expect(res.uncheckedTypes).toContain('identify_pattern');
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — a highlight_sequence cell set with the WRONG step', () => {
    const bad = run(5);
    bad[4] = 26; // 25 → 26: no longer a clean count-by-5 run
    const data = {
      ...completeClean,
      challenges: [
        { id: 'h1', type: 'highlight_sequence', skipValue: 5, startNumber: 5, givenCells: [], correctCells: bad, correctAnswer: '', options: [] },
        { id: 'h2', type: 'highlight_sequence', skipValue: 10, startNumber: 10, givenCells: [], correctCells: run(10), correctAnswer: '', options: [] },
        { id: 'h3', type: 'highlight_sequence', skipValue: 2, startNumber: 2, givenCells: [], correctCells: run(2), correctAnswer: '', options: [] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'h1')).toBe(true);
  });

  it('flags answer-key-desync — a complete_sequence run mislabeled with the wrong skipValue', () => {
    // skipValue says 10 but the cells are a count-by-5 run — a step desync.
    const data = {
      ...completeClean,
      challenges: [
        { id: 'm1', type: 'complete_sequence', skipValue: 10, startNumber: 5, givenCells: [5, 10, 15], correctCells: run(5).slice(3), correctAnswer: '', options: [] },
        { id: 'm2', type: 'complete_sequence', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6], correctCells: run(2).slice(3), correctAnswer: '', options: [] },
        { id: 'm3', type: 'complete_sequence', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15], correctCells: run(5).slice(3), correctAnswer: '', options: [] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1')).toBe(true);
  });

  it('flags answer-key-desync — a correctCell off the rendered chart (unreachable)', () => {
    const data = {
      ...completeClean,
      challenges: [
        { id: 'o1', type: 'complete_sequence', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15], correctCells: [...run(5).slice(3), 105], correctAnswer: '', options: [] },
        { id: 'o2', type: 'complete_sequence', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6], correctCells: run(2).slice(3), correctAnswer: '', options: [] },
        { id: 'o3', type: 'complete_sequence', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30], correctCells: run(10).slice(3), correctAnswer: '', options: [] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'o1')).toBe(true);
  });

  it('flags answer-key-desync — find_skip_value with the correct skip absent from options', () => {
    const data = {
      ...skipClean,
      challenges: [
        { id: 's1', type: 'find_skip_value', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: '5', options: ['2', '3', '4', '10'] }, // no '5'
        { id: 's2', type: 'find_skip_value', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6, 8], correctCells: [2, 4, 6, 8], correctAnswer: '2', options: ['2', '3', '5', '10'] },
        { id: 's3', type: 'find_skip_value', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30, 40], correctCells: [10, 20, 30, 40], correctAnswer: '10', options: ['2', '5', '10', '20'] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1')).toBe(true);
  });

  it('flags answer-key-desync — identify_pattern correctAnswer absent from options', () => {
    const data = {
      ...skipClean,
      challenges: [
        { id: 'p1', type: 'identify_pattern', skipValue: 5, startNumber: 5, givenCells: run(5), correctCells: run(5), correctAnswer: 'Two vertical columns (5th and 10th)', options: ['A checkerboard pattern', 'They fill every row', 'They are scattered randomly', 'A diagonal stripe'] }, // correct not present
        { id: 'p2', type: 'identify_pattern', skipValue: 2, startNumber: 2, givenCells: run(2), correctCells: run(2), correctAnswer: 'Every other cell in each row', options: ['Every other cell in each row', 'A checkerboard pattern', 'They are scattered randomly', 'A diagonal stripe'] },
        { id: 'p3', type: 'identify_pattern', skipValue: 10, startNumber: 10, givenCells: run(10), correctCells: run(10), correctAnswer: 'One vertical column (the last column)', options: ['One vertical column (the last column)', 'They fill every other row', 'Every other cell in each row', 'A diagonal stripe'] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'p1')).toBe(true);
  });

  // ── scope ──
  it('flags scope — cells exceed a tighter topic ceiling ("to 50")', () => {
    // Same clean complete fixture, but under a "to 50" objective: cells run to 100.
    const v = hundredsChartOracle.verify(completeClean, ctxTo50).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'c1')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every challenge is skip-by-5', () => {
    const data = {
      ...completeClean,
      challenges: [1, 2, 3, 4].map((i) => ({
        id: `k${i}`, type: 'complete_sequence', skipValue: 5, startNumber: 5,
        givenCells: [5, 10, 15], correctCells: run(5).slice(3), correctAnswer: '', options: [],
      })),
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  // ── schema ──
  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...completeClean, challenges: completeClean.challenges.slice(0, 2) };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a schema violation — non-integer cell', () => {
    const data = {
      ...completeClean,
      challenges: [
        { id: 'x1', type: 'complete_sequence', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15], correctCells: [20, 'twenty-five', 30], correctAnswer: '', options: [] },
        { id: 'x2', type: 'complete_sequence', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6], correctCells: run(2).slice(3), correctAnswer: '', options: [] },
        { id: 'x3', type: 'complete_sequence', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30], correctCells: run(10).slice(3), correctAnswer: '', options: [] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'x1')).toBe(true);
  });

  it('flags a schema violation — MC mode with duplicate options', () => {
    const data = {
      ...skipClean,
      challenges: [
        { id: 'd1', type: 'find_skip_value', skipValue: 5, startNumber: 5, givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: '5', options: ['5', '5', '2', '10'] },
        { id: 'd2', type: 'find_skip_value', skipValue: 2, startNumber: 2, givenCells: [2, 4, 6, 8], correctCells: [2, 4, 6, 8], correctAnswer: '2', options: ['2', '3', '5', '10'] },
        { id: 'd3', type: 'find_skip_value', skipValue: 10, startNumber: 10, givenCells: [10, 20, 30, 40], correctCells: [10, 20, 30, 40], correctAnswer: '10', options: ['2', '5', '10', '20'] },
      ],
    };
    const v = hundredsChartOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'd1')).toBe(true);
  });
});
