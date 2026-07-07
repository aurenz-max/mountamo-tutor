import { describe, expect, it } from 'vitest';
import { mathFactFluencyOracle } from '../math-fact-fluency';
import { tenFrameOracle } from '../ten-frame';
import { vocabularyExplorerOracle } from '../vocabulary-explorer';

/**
 * Seeded-violation tests: an oracle that never fires is decoration. Each
 * recurring bug class gets a fixture the oracle MUST flag, plus a clean
 * fixture it must pass. Fixtures are trimmed from real eval-test output.
 */

const tfCtx = { componentId: 'ten-frame', evalMode: 'build', topic: 'Counting to 10', gradeLevel: 'kindergarten' };

const tenFrameClean = {
  mode: 'single',
  challenges: [
    { id: 'c1', type: 'build', targetCount: 2 },
    { id: 'c2', type: 'build', targetCount: 5 },
    { id: 'c3', type: 'build', targetCount: 7 },
    { id: 'c4', type: 'build', targetCount: 10 },
  ],
};

describe('ten-frame oracle', () => {
  it('passes clean data', () => {
    expect(tenFrameOracle.verify(tenFrameClean, tfCtx).violations).toEqual([]);
  });

  it('flags scope violation — target above the topic ceiling (the "to 10 taught 0-20" class)', () => {
    const data = { ...tenFrameClean, mode: 'double', challenges: [...tenFrameClean.challenges, { id: 'c5', type: 'build', targetCount: 14 }] };
    const v = tenFrameOracle.verify(data, tfCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'c5')).toBe(true);
  });

  it('flags clustering — the "every answer is 5" class', () => {
    const data = {
      mode: 'single',
      challenges: [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, type: 'build', targetCount: 5 })),
    };
    const v = tenFrameOracle.verify(data, tfCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { mode: 'single', challenges: [{ id: 'c1', type: 'build', targetCount: 3 }] };
    const v = tenFrameOracle.verify(data, tfCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });
});

const veCtx = { componentId: 'vocabulary-explorer', evalMode: 'recall', topic: 'Weather and Seasons', gradeLevel: 'kindergarten' };

const vocabClean = {
  terms: [
    { id: 'term1', word: 'season', definition: 'A time of year with a special kind of weather.' },
    { id: 'term2', word: 'sunny', definition: 'When the sky is bright because the sun is shining.' },
  ],
  challenges: [
    {
      type: 'match',
      matchPairs: [
        { term: 'season', definition: 'A time of year with a special kind of weather.' },
        { term: 'sunny', definition: 'When the sky is bright because the sun is shining.' },
      ],
    },
    {
      type: 'fill_blank',
      relatedTermId: 'term2',
      options: ['sunny', 'season', 'stormy'],
      correctIndex: 0,
      sentence: 'The sky is bright and blue because it is a _____ day.',
    },
  ],
};

describe('vocabulary-explorer oracle', () => {
  it('passes clean data', () => {
    expect(vocabularyExplorerOracle.verify(vocabClean, veCtx).violations).toEqual([]);
  });

  it('flags answer-key desync — correctIndex points at the wrong option (the 2026-07-04 bug class)', () => {
    const data = JSON.parse(JSON.stringify(vocabClean));
    data.challenges[1].correctIndex = 1; // key says "season"; oracle solves to "sunny"
    const v = vocabularyExplorerOracle.verify(data, veCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync')).toBe(true);
  });

  it('flags answer-key desync — expected answer missing from the options entirely', () => {
    const data = JSON.parse(JSON.stringify(vocabClean));
    data.challenges[1].options = ['cloudy', 'season', 'stormy'];
    const v = vocabularyExplorerOracle.verify(data, veCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync')).toBe(true);
  });

  it('flags definition desync in match pairs', () => {
    const data = JSON.parse(JSON.stringify(vocabClean));
    data.challenges[0].matchPairs[0].definition = 'A completely different definition.';
    const v = vocabularyExplorerOracle.verify(data, veCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync')).toBe(true);
  });

  it('flags answer leak — the sentence contains the answer word', () => {
    const data = JSON.parse(JSON.stringify(vocabClean));
    data.challenges[1].sentence = 'It is sunny today, so it is a _____ day.';
    const v = vocabularyExplorerOracle.verify(data, veCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak')).toBe(true);
  });

  it('flags out-of-range correctIndex', () => {
    const data = JSON.parse(JSON.stringify(vocabClean));
    data.challenges[1].correctIndex = 9;
    const v = vocabularyExplorerOracle.verify(data, veCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });
});

const mffCtx = { componentId: 'math-fact-fluency', evalMode: 'equation-solve', topic: 'Addition facts to 5', gradeLevel: 'kindergarten' };

const mffClean = {
  maxNumber: 5,
  challenges: [
    { id: 'c1', type: 'visual-fact', instruction: 'How many in all?', equation: '1 + 2 = 3', operation: 'addition', operand1: 1, operand2: 2, result: 3, unknownPosition: 'result', correctAnswer: 3, options: [2, 3, 4, 1], visualType: 'dot-array', visualCount: 3 },
    { id: 'c2', type: 'equation-solve', instruction: 'Solve this one.', equation: '1 + 4 = 5', operation: 'addition', operand1: 1, operand2: 4, result: 5, unknownPosition: 'result', correctAnswer: 5, options: [3, 4, 5, 2] },
    { id: 'c3', type: 'missing-number', instruction: 'What number plus 1 makes 3?', equation: '2 + 1 = 3', operation: 'addition', operand1: 2, operand2: 1, result: 3, unknownPosition: 'operand1', correctAnswer: 2 },
    { id: 'c4', type: 'match', instruction: 'Which equation shows these 4 objects?', equation: '2 + 2 = 4', operation: 'addition', operand1: 2, operand2: 2, result: 4, unknownPosition: 'result', correctAnswer: 4, matchDirection: 'visual-to-equation', equationOptions: ['1 + 1 = 2', '2 + 2 = 4', '3 + 2 = 5', '1 + 0 = 1'] },
  ],
};

describe('math-fact-fluency oracle', () => {
  it('passes clean data', () => {
    expect(mathFactFluencyOracle.verify(mffClean, mffCtx).violations).toEqual([]);
  });

  it('flags answer-key desync — result contradicts the operands', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.challenges[1].result = 6; // 1 + 4 = 5, not 6
    data.challenges[1].correctAnswer = 6;
    data.challenges[1].equation = '1 + 4 = 6';
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags answer-key desync — correctAnswer wrong for unknownPosition', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.challenges[2].correctAnswer = 1; // operand1 is 2, not 1
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c3'))).toBe(true);
  });

  it('flags answer-key desync — correct answer missing from options', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.challenges[1].options = [3, 4, 6, 2]; // 5 is gone
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags answer-key desync — ambiguous match (two equationOptions share the result)', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.challenges[3].equationOptions = ['2 + 2 = 4', '1 + 3 = 4', '1 + 1 = 2', '1 + 0 = 1'];
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /ambiguous/.test(x.detail))).toBe(true);
  });

  it('flags scope violation — an operand exceeds the topic ceiling (the "facts to 5 taught to 10" class)', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.challenges[1] = { id: 'c2', type: 'equation-solve', instruction: 'Solve.', equation: '3 + 6 = 9', operation: 'addition', operand1: 3, operand2: 6, result: 9, unknownPosition: 'result', correctAnswer: 9, options: [8, 9, 10, 7] };
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags scope violation — maxNumber wider than the objective ceiling', () => {
    const data = JSON.parse(JSON.stringify(mffClean));
    data.maxNumber = 10; // topic is "to 5"
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'maxNumber')).toBe(true);
  });

  it('flags clustering — every answer is the same value', () => {
    const data = {
      maxNumber: 5,
      challenges: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, type: 'equation-solve', instruction: 'Solve.', equation: `${i} + ${5 - i} = 5`, operation: 'addition', operand1: i, operand2: 5 - i, result: 5, unknownPosition: 'result', correctAnswer: 5, options: [3, 4, 5, 6] })),
    };
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate challenge (same fact + type + unknown)', () => {
    const dup = { id: 'c4', type: 'equation-solve', instruction: 'Solve.', equation: '1 + 4 = 5', operation: 'addition', operand1: 1, operand2: 4, result: 5, unknownPosition: 'result', correctAnswer: 5, options: [3, 4, 5, 2] };
    const data = { maxNumber: 5, challenges: [...mffClean.challenges, dup] };
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag the same fact shown as a different type/unknown (legitimate multi-representation)', () => {
    // 2 + 1 = 3 already appears as missing-number(operand1) in c3; add it as an
    // equation-solve(result) — same fact, different task. Must stay clean.
    const data = {
      maxNumber: 5,
      challenges: [
        ...mffClean.challenges,
        { id: 'c5', type: 'equation-solve', instruction: 'Solve.', equation: '2 + 1 = 3', operation: 'addition', operand1: 2, operand2: 1, result: 3, unknownPosition: 'result', correctAnswer: 3, options: [2, 3, 4, 1] },
      ],
    };
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { maxNumber: 5, challenges: [{ id: 'c1', type: 'equation-solve', instruction: 'Solve.', equation: '2 + 3 = 5', operation: 'addition', operand1: 2, operand2: 3, result: 5, unknownPosition: 'result', correctAnswer: 5, options: [4, 5, 6, 3] }] };
    const v = mathFactFluencyOracle.verify(data, mffCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });
});
