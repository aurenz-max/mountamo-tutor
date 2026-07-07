import { describe, expect, it } from 'vitest';
import { numberBondOracle } from '../number-bond';

/**
 * Seeded-violation tests for the number-bond oracle. One clean fixture — a mix of
 * all four challenge types, trimmed from real /api/lumina/eval-test runs
 * (componentId=number-bond, decompose / missing_part / fact_family /
 * build_equation, topic "Number bonds to 10", grade 1) — that must pass, plus one
 * mutated fixture per implemented check class that MUST fire. An oracle that never
 * fires is decoration.
 */

const nbCtx = {
  componentId: 'number-bond',
  evalMode: 'decompose',
  topic: 'Number bonds to 10',
  gradeLevel: 'grade 1',
};

// Trimmed from real output. Wholes 6,7,8,9,10 (varied); every value ≤ 10.
const numberBondClean = {
  title: 'Bonding with 10!',
  description: 'Break numbers apart into two parts.',
  maxNumber: 10,
  showCounters: true,
  showEquation: true,
  gradeBand: '1',
  challenges: [
    { id: 'c1', type: 'decompose', instruction: 'Break apart 6.', whole: 6, part1: null, part2: null, allPairs: [[0, 6], [1, 5], [2, 4], [3, 3]] },
    { id: 'c2', type: 'missing-part', instruction: 'The whole is 7. One part is 3.', whole: 7, part1: 3, part2: null, allPairs: null, factFamily: null, targetEquation: null },
    { id: 'c3', type: 'fact-family', instruction: 'Write all 4 equations for 8 with parts 3 and 5.', whole: 8, part1: 3, part2: 5, factFamily: ['3+5=8', '5+3=8', '8-3=5', '8-5=3'], allPairs: null, targetEquation: null },
    { id: 'c4', type: 'build-equation', instruction: 'Build an equation for 9.', whole: 9, part1: 4, part2: 5, targetEquation: '4+5=9', allPairs: null, factFamily: null },
    { id: 'c5', type: 'decompose', instruction: 'Break apart 10.', whole: 10, part1: null, part2: null, allPairs: [[0, 10], [1, 9], [2, 8], [3, 7], [4, 6], [5, 5]] },
  ],
};

describe('number-bond oracle', () => {
  it('passes clean data with zero violations', () => {
    const result = numberBondOracle.verify(numberBondClean, nbCtx);
    expect(result.violations).toEqual([]);
    expect(result.checkedChallenges).toBe(5);
    expect(result.uncheckedTypes).toEqual([]);
  });

  it('flags answer-key-desync — decompose allPairs is incomplete (missing a pair)', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        { id: 'c1', type: 'decompose', instruction: 'Break apart 6.', whole: 6, part1: null, part2: null, allPairs: [[0, 6], [1, 5], [2, 4]] }, // missing [3,3]
        ...numberBondClean.challenges.slice(1),
      ],
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags answer-key-desync — fact-family parts do not sum to the whole', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        ...numberBondClean.challenges.slice(0, 2),
        { id: 'c3', type: 'fact-family', instruction: 'Bad bond.', whole: 8, part1: 3, part2: 4, factFamily: ['3+4=8', '4+3=8', '8-3=4', '8-4=3'], allPairs: null, targetEquation: null }, // 3+4≠8
        ...numberBondClean.challenges.slice(3),
      ],
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c3'))).toBe(true);
  });

  it('flags answer-key-desync — build-equation targetEquation is arithmetically wrong', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        ...numberBondClean.challenges.slice(0, 3),
        { id: 'c4', type: 'build-equation', instruction: 'Build 9.', whole: 9, part1: 4, part2: 5, targetEquation: '4+5=8', allPairs: null, factFamily: null }, // 4+5≠8
        numberBondClean.challenges[4],
      ],
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c4'))).toBe(true);
  });

  it('flags answer-key-desync — missing-part reveals BOTH parts on screen', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        numberBondClean.challenges[0],
        { id: 'c2', type: 'missing-part', instruction: 'The whole is 7.', whole: 7, part1: 3, part2: 4, allPairs: null, factFamily: null, targetEquation: null }, // both parts given
        ...numberBondClean.challenges.slice(2),
      ],
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags scope — values above the objective ceiling (the "bonds to 5 taught 10" class)', () => {
    // scopeMax 5 → wholes 6..10 all exceed it; the clean topic-parse (10) passes.
    const v = numberBondOracle.verify(numberBondClean, { ...nbCtx, scopeMax: 5 }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags clustering — the "every bond is the same whole" class', () => {
    const data = {
      ...numberBondClean,
      challenges: [6, 6, 6, 6, 6].map((whole, i) => ({
        id: `c${i + 1}`, type: 'decompose', instruction: `Break apart ${whole}.`, whole,
        part1: null, part2: null, allPairs: [[0, 6], [1, 5], [2, 4], [3, 3]],
      })),
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — a duplicated challenge card (identical decompose twice)', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        numberBondClean.challenges[0], // decompose 6
        numberBondClean.challenges[1], // missing-part 7 → answer 4
        numberBondClean.challenges[2], // fact-family 8
        numberBondClean.challenges[3], // build-equation 9
        { id: 'c5', type: 'decompose', instruction: 'Break apart 6.', whole: 6, part1: null, part2: null, allPairs: [[0, 6], [1, 5], [2, 4], [3, 3]] }, // dup of c1
      ],
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('appears 2'))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = {
      ...numberBondClean,
      challenges: numberBondClean.challenges.slice(0, 2),
    };
    const v = numberBondOracle.verify(data, nbCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('records unchecked types honestly', () => {
    const data = {
      ...numberBondClean,
      challenges: [
        ...numberBondClean.challenges,
        { id: 'c6', type: 'mystery-mode', instruction: '?', whole: 5 },
      ],
    };
    const result = numberBondOracle.verify(data, nbCtx);
    expect(result.uncheckedTypes).toContain('mystery-mode');
  });
});
