import { describe, expect, it } from 'vitest';
import { additionSubtractionSceneOracle } from '../addition-subtraction-scene';

/**
 * Seeded-violation tests for the addition-subtraction-scene oracle. One clean
 * fixture — trimmed from a real /api/lumina/eval-test run
 * (componentId=addition-subtraction-scene, evalMode=act_out, topic
 * "Addition and subtraction within 5", grade 1) — that must pass with zero
 * violations, plus one mutated fixture per implemented check class that MUST
 * fire. An oracle that never fires is decoration.
 */

const ctx = {
  componentId: 'addition-subtraction-scene',
  evalMode: 'act_out',
  topic: 'Addition and subtraction within 5',
  gradeLevel: 'grade 1',
};

// Trimmed verbatim from a real generation. maxNumber 5, gradeBand K, every count
// ≤ 5. Results [3,2,5,2] spread; each equation reconstructs from its operands.
const clean = {
  title: 'Story Math Fun',
  description: 'Act out addition and subtraction stories.',
  maxNumber: 5,
  showTenFrame: true,
  showEquationBar: true,
  gradeBand: 'K',
  challenges: [
    { id: 'ch1', type: 'act-out', instruction: 'Drag 2 ducks in, then 1 more.', storyText: '2 ducks are swimming. 1 more joins them.', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3' },
    { id: 'ch2', type: 'act-out', instruction: 'Drag 2 cookies away.', storyText: '4 cookies are on the tray. 2 cookies are eaten.', scene: 'kitchen', objectType: 'cookies', operation: 'subtraction', storyType: 'separate', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2' },
    { id: 'ch3', type: 'act-out', instruction: 'Add 3 flowers, then 2 more.', storyText: '3 yellow flowers bloom. 2 pink flowers are planted.', scene: 'garden', objectType: 'flowers', operation: 'addition', storyType: 'part-whole', startCount: 3, changeCount: 2, resultCount: 5, equation: '3 + 2 = 5' },
    { id: 'ch4', type: 'act-out', instruction: 'Drag 3 frogs into the water.', storyText: '5 frogs sit on a log. 3 jump into the water.', scene: 'pond', objectType: 'frogs', operation: 'subtraction', storyType: 'separate', startCount: 5, changeCount: 3, resultCount: 2, equation: '5 - 3 = 2' },
  ],
};

// A clean build-equation set (has allowedTiles + unknownPosition='result').
const cleanBuild = {
  title: 'Build the Equation',
  description: 'Match the story with tiles.',
  maxNumber: 5,
  showTenFrame: false,
  showEquationBar: true,
  gradeBand: 'K',
  challenges: [
    { id: 'b1', type: 'build-equation', instruction: 'Build it.', storyText: '2 ducks, 1 joins.', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3', unknownPosition: 'result', allowedTiles: ['1', '2', '3'] },
    { id: 'b2', type: 'build-equation', instruction: 'Build it.', storyText: '4 cookies, ate 2.', scene: 'kitchen', objectType: 'cookies', operation: 'subtraction', storyType: 'separate', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2', unknownPosition: 'result', allowedTiles: ['2', '4'] },
    { id: 'b3', type: 'build-equation', instruction: 'Build it.', storyText: '3 and 2 flowers.', scene: 'garden', objectType: 'flowers', operation: 'addition', storyType: 'join', startCount: 3, changeCount: 2, resultCount: 5, equation: '3 + 2 = 5', unknownPosition: 'result', allowedTiles: ['2', '3', '5'] },
  ],
};

describe('addition-subtraction-scene oracle', () => {
  it('passes clean act-out data with zero violations', () => {
    const result = additionSubtractionSceneOracle.verify(clean, ctx);
    expect(result.violations).toEqual([]);
    expect(result.checkedChallenges).toBe(4);
    expect(result.uncheckedTypes).toEqual([]);
  });

  it('passes clean build-equation data (allowedTiles cover the answer)', () => {
    const result = additionSubtractionSceneOracle.verify(cleanBuild, ctx);
    expect(result.violations).toEqual([]);
  });

  it('flags answer-key-desync — resultCount ≠ start±change', () => {
    const data = {
      ...clean,
      challenges: [
        { ...clean.challenges[0], resultCount: 4, equation: '2 + 1 = 4' }, // 2+1≠4
        ...clean.challenges.slice(1),
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('ch1'))).toBe(true);
  });

  it('flags answer-key-desync — equation string does not reconstruct', () => {
    const data = {
      ...clean,
      challenges: [
        { ...clean.challenges[0], equation: '9 + 9 = 3' }, // wrong operands in the string
        ...clean.challenges.slice(1),
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.detail.includes('reconstruct'))).toBe(true);
  });

  it('flags answer-key-desync — build-equation allowedTiles cannot build the answer', () => {
    const data = {
      ...cleanBuild,
      challenges: [
        { ...cleanBuild.challenges[0], allowedTiles: ['1', '2'] }, // missing result 3 → unbuildable
        ...cleanBuild.challenges.slice(1),
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.detail.includes('missing resultCount 3'))).toBe(true);
  });

  it('flags scope — a count above the objective ceiling (scopeMax)', () => {
    // scopeMax 3 → counts 4,5 exceed it; the clean topic passes at maxNumber 5.
    const v = additionSubtractionSceneOracle.verify(clean, { ...ctx, scopeMax: 3 }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags scope — subtraction yields a negative result', () => {
    const data = {
      ...clean,
      challenges: [
        { ...clean.challenges[1], startCount: 2, changeCount: 5, resultCount: -3, equation: '2 - 5 = -3' },
        ...clean.challenges.slice(2),
        clean.challenges[0],
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'scope' && x.detail.includes('negative'))).toBe(true);
  });

  it('flags clustering — the "every answer is 3" class', () => {
    const data = {
      ...clean,
      challenges: [
        { id: 'c1', type: 'act-out', instruction: '', storyText: '', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3' },
        { id: 'c2', type: 'act-out', instruction: '', storyText: '', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 0, changeCount: 3, resultCount: 3, equation: '0 + 3 = 3' },
        { id: 'c3', type: 'act-out', instruction: '', storyText: '', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 3, changeCount: 0, resultCount: 3, equation: '3 + 0 = 3' },
        { id: 'c4', type: 'act-out', instruction: '', storyText: '', scene: 'pond', objectType: 'ducks', operation: 'subtraction', storyType: 'separate', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2' },
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('answers'))).toBe(true);
  });

  it('flags clustering — a duplicated challenge card (identical act-out twice)', () => {
    const data = {
      ...clean,
      challenges: [
        clean.challenges[0], // 2 + 1 = 3
        clean.challenges[1], // 4 - 2 = 2
        clean.challenges[2], // 3 + 2 = 5
        { ...clean.challenges[0], id: 'ch4' }, // byte-identical task to ch1
      ],
    };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('appears 2'))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...clean, challenges: clean.challenges.slice(0, 2) };
    const v = additionSubtractionSceneOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('records unchecked types honestly', () => {
    const data = {
      ...clean,
      challenges: [
        ...clean.challenges,
        { id: 'ch5', type: 'mystery-mode', instruction: '?', storyText: '', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 1, changeCount: 1, resultCount: 2, equation: '1 + 1 = 2' },
      ],
    };
    const result = additionSubtractionSceneOracle.verify(data, ctx);
    expect(result.uncheckedTypes).toContain('mystery-mode');
  });
});
