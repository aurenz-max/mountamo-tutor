import { describe, expect, it } from 'vitest';
import { balanceScaleOracle } from '../balance-scale';
import { knowledgeCheckOracle } from '../knowledge-check';
import { functionMachineOracle } from '../function-machine';
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

const kcCtx = { componentId: 'knowledge-check', evalMode: 'recall', topic: 'The Water Cycle', gradeLevel: 'elementary' };

// A mixed orchestrated set — one of each of the four checked types, all clean.
const kcClean = {
  problemType: 'orchestrated',
  topic: 'The Water Cycle',
  problems: [
    {
      type: 'multiple_choice',
      id: 'mc_1',
      question: 'What is the process by which water turns into vapor?',
      options: [
        { id: 'A', text: 'Evaporation' },
        { id: 'B', text: 'Condensation' },
        { id: 'C', text: 'Precipitation' },
      ],
      correctOptionId: 'A',
    },
    {
      type: 'true_false',
      id: 'tf_1',
      statement: 'Clouds are made of tiny drops of water.',
      correct: true,
    },
    {
      type: 'matching_activity',
      id: 'match_1',
      prompt: 'Match each stage to its description.',
      leftItems: [
        { id: 'L1', text: 'Evaporation' },
        { id: 'L2', text: 'Condensation' },
      ],
      rightItems: [
        { id: 'R1', text: 'Water rises as vapor' },
        { id: 'R2', text: 'Vapor cools into droplets' },
      ],
      mappings: [
        { leftId: 'L1', rightIds: ['R1'] },
        { leftId: 'L2', rightIds: ['R2'] },
      ],
    },
    {
      type: 'categorization_activity',
      id: 'cat_1',
      instruction: 'Sort each item by where the water is.',
      categories: ['Sky', 'Ground'],
      categorizationItems: [
        { itemText: 'cloud', correctCategory: 'Sky' },
        { itemText: 'rain', correctCategory: 'Sky' },
        { itemText: 'river', correctCategory: 'Ground' },
        { itemText: 'puddle', correctCategory: 'Ground' },
      ],
    },
  ],
};

describe('knowledge-check oracle', () => {
  it('passes clean data across all four checked types', () => {
    expect(knowledgeCheckOracle.verify(kcClean, kcCtx).violations).toEqual([]);
  });

  it('reports fill_in_blanks / sequencing as unchecked (honest coverage gap)', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems.push({ type: 'fill_in_blanks', id: 'fib_1' }, { type: 'sequencing_activity', id: 'seq_1' });
    const r = knowledgeCheckOracle.verify(data, kcCtx);
    expect(r.uncheckedTypes.sort()).toEqual(['fill_in_blanks', 'sequencing_activity']);
    expect(r.checkedChallenges).toBe(4); // the unchecked types don't inflate the count
  });

  // ── multiple_choice ────────────────────────────────────────────────────────
  it('MC: flags answer-key desync — correctOptionId matches no option (unwinnable)', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[0].correctOptionId = 'D'; // no option D exists
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('problem#1'))).toBe(true);
  });

  it('MC: flags duplicate option labels (ambiguous grading)', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[0].options[1].text = 'Evaporation'; // same label as the correct option
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'schema' && /duplicate option labels/.test(x.detail))).toBe(true);
  });

  it('MC: flags answer leak — the stem uniquely reveals the answer word', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[0].question = 'Evaporation is when water turns into vapor. Which process is this?';
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where.startsWith('problem#1'))).toBe(true);
  });

  it('MC: does NOT flag a leak when a distractor also appears in the stem', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    // Both the answer (Evaporation) and a distractor (Condensation) appear — not a giveaway.
    data.problems[0].question = 'Is evaporation or condensation the process where water turns to vapor?';
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.filter((x) => x.check === 'answer-leak')).toEqual([]);
  });

  it('MC: flags clustering — every correct answer is in the same position', () => {
    const mc = (id: string) => ({
      type: 'multiple_choice',
      id,
      question: `Question ${id}?`,
      options: [
        { id: 'A', text: `${id}-right` },
        { id: 'B', text: `${id}-wrong1` },
        { id: 'C', text: `${id}-wrong2` },
      ],
      correctOptionId: 'A',
    });
    const data = { problems: [mc('m1'), mc('m2'), mc('m3'), mc('m4')] };
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  // ── true_false ─────────────────────────────────────────────────────────────
  it('TF: flags schema — "correct" is not a boolean', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[1].correct = 'true'; // string, not boolean
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where.startsWith('problem#2'))).toBe(true);
  });

  it('TF: flags clustering — every statement is true (the "all true" pattern)', () => {
    const tf = (id: string) => ({ type: 'true_false', id, statement: `Statement ${id}.`, correct: true });
    const data = { problems: [tf('t1'), tf('t2'), tf('t3')] };
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  // ── matching_activity ──────────────────────────────────────────────────────
  it('Match: flags answer-key desync — a mapping targets a non-existent right item', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[2].mappings[0].rightIds = ['R9']; // no right item R9
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('problem#3'))).toBe(true);
  });

  it('Match: flags answer-key desync — a left item has no mapping (renders but ungradable)', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[2].mappings = [data.problems[2].mappings[0]]; // drop L2's mapping
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /has no mapping/.test(x.detail))).toBe(true);
  });

  it('Match: flags schema — duplicate right-column text (indistinguishable buttons)', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[2].rightItems[1].text = 'Water rises as vapor'; // same text as R1
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'schema' && /duplicate right-column text/.test(x.detail))).toBe(true);
  });

  // ── categorization_activity ────────────────────────────────────────────────
  it('Cat: flags answer-key desync — correctCategory has no matching drop zone', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[3].categorizationItems[0].correctCategory = 'Ocean'; // not in categories
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('problem#4'))).toBe(true);
  });

  it('Cat: flags schema — duplicate itemText collides in the placement map', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[3].categorizationItems[1].itemText = 'cloud'; // dup of item 0
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'schema' && /duplicate itemText/.test(x.detail))).toBe(true);
  });

  it('Cat: flags answer leak — the item names its own category', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    data.problems[3].categorizationItems[0].itemText = 'Sky cloud'; // contains category "Sky"
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where.startsWith('problem#4'))).toBe(true);
  });

  it('Cat: flags clustering — every item lands in one category', () => {
    const data = JSON.parse(JSON.stringify(kcClean));
    for (const it of data.problems[3].categorizationItems) it.correctCategory = 'Sky';
    const v = knowledgeCheckOracle.verify(data, kcCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.where.startsWith('problem#4'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// function-machine
// ---------------------------------------------------------------------------

const fmPredictCtx = { componentId: 'function-machine', evalMode: 'predict', topic: 'Function Rules', gradeLevel: 'grade 5' };
const fmDiscoverCtx = { componentId: 'function-machine', evalMode: 'discover_rule', topic: 'Function Rules', gradeLevel: 'grade 5' };

// predict: rule shown, integer inputs, distinct rules per challenge.
const fmPredictClean = {
  title: 'Function Machine Practice',
  description: 'Predict the output of each machine before feeding numbers through it.',
  challengeType: 'predict',
  gradeBand: '5',
  challenges: [
    { id: 'fm-1', rule: '2*x + 1', inputQueue: [2, 3, 4, 6, 8], showRule: true },
    { id: 'fm-2', rule: '3*x - 2', inputQueue: [2, 3, 4, 6, 8], showRule: true },
    { id: 'fm-3', rule: 'x + 7', inputQueue: [2, 3, 4, 6, 8], showRule: true },
  ],
};

// discover_rule: rule hidden, ≥2 distinct inputs, no leak.
const fmDiscoverClean = {
  title: 'Discover the Rule',
  description: 'Feed inputs through each machine and figure out the hidden rule from the pairs.',
  challengeType: 'discover_rule',
  gradeBand: '5',
  challenges: [
    { id: 'fm-1', rule: '2*x + 1', inputQueue: [0, 1, 2, 3, 4], showRule: false },
    { id: 'fm-2', rule: '3*x - 2', inputQueue: [0, 1, 2, 3, 4], showRule: false },
    { id: 'fm-3', rule: 'x + 5', inputQueue: [0, 1, 2, 3, 4], showRule: false },
  ],
};

describe('function-machine oracle', () => {
  it('passes clean predict data', () => {
    expect(functionMachineOracle.verify(fmPredictClean, fmPredictCtx).violations).toEqual([]);
  });

  it('passes clean discover_rule data', () => {
    expect(functionMachineOracle.verify(fmDiscoverClean, fmDiscoverCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — an input the rule cannot evaluate (uncompletable challenge)', () => {
    const data = JSON.parse(JSON.stringify(fmPredictClean));
    data.challenges[0].rule = '2*n + 1'; // wrong variable → evaluateRule returns null for every input
    const v = functionMachineOracle.verify(data, fmPredictCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fm-1')).toBe(true);
  });

  it('flags answer-leak — showRule=true in a hidden-rule mode reveals the answer', () => {
    const data = JSON.parse(JSON.stringify(fmDiscoverClean));
    data.challenges[1].showRule = true;
    const v = functionMachineOracle.verify(data, fmDiscoverCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'fm-2')).toBe(true);
  });

  it('flags answer-leak — the hidden rule leaked into the description', () => {
    const data = JSON.parse(JSON.stringify(fmDiscoverClean));
    data.description = 'Discover the rule 2x + 1 by watching the machine.';
    const v = functionMachineOracle.verify(data, fmDiscoverCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'fm-1')).toBe(true);
  });

  it('flags schema — hidden rule with too few distinct inputs to recover', () => {
    const data = JSON.parse(JSON.stringify(fmDiscoverClean));
    data.challenges[0].inputQueue = [2, 2, 2];
    const v = functionMachineOracle.verify(data, fmDiscoverCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'fm-1')).toBe(true);
  });

  it('flags schema — observe/predict with showRule=false (nothing to observe)', () => {
    const data = JSON.parse(JSON.stringify(fmPredictClean));
    data.challenges[2].showRule = false;
    const v = functionMachineOracle.verify(data, fmPredictCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'fm-3')).toBe(true);
  });

  it('flags clustering — every challenge is the same rule', () => {
    const data = JSON.parse(JSON.stringify(fmPredictClean));
    for (const c of data.challenges) c.rule = 'x + 1';
    const v = functionMachineOracle.verify(data, fmPredictCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags scope — an output above the explicit ceiling', () => {
    const v = functionMachineOracle.verify(fmPredictClean, { ...fmPredictCtx, scopeMax: 10 }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...fmPredictClean, challenges: [fmPredictClean.challenges[0]] };
    const v = functionMachineOracle.verify(data, fmPredictCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('re-derives outputs correctly — clean quadratic passes, degenerate pairs flagged', () => {
    // x^2 over distinct inputs is fine; a rule that ties every output is ambiguous.
    const good = JSON.parse(JSON.stringify(fmDiscoverClean));
    good.gradeBand = 'advanced';
    good.challenges[0].rule = 'x^2 + 1';
    expect(functionMachineOracle.verify(good, fmDiscoverCtx).violations.some((x) => x.where === 'fm-1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// balance-scale
// ---------------------------------------------------------------------------

const bsCtx = { componentId: 'balance-scale', evalMode: 'one_step', topic: 'Solving Equations', gradeLevel: 'grade 4' };

const V = (label = 'x') => ({ value: 1, label, isVariable: true });
const K = (n: number) => ({ value: n, label: String(n) });

// one_step, decomposed [x, b] = [answer, b] — solvable, distinct answers.
const bsClean = {
  title: 'Solving One-Step Equations',
  description: 'Isolate the variable by removing the same block from both sides.',
  challengeType: 'one_step',
  gradeBand: '3-4',
  allowOperations: ['add', 'subtract'],
  challenges: [
    { type: 'one_step', instruction: 'Solve for x.', hint: 'Remove 5.', leftSide: [V(), K(5)], rightSide: [K(6), K(5)], variableValue: 6 },
    { type: 'one_step', instruction: 'Solve for x.', hint: 'Remove 3.', leftSide: [V(), K(3)], rightSide: [K(9), K(3)], variableValue: 9 },
    { type: 'one_step', instruction: 'Solve for x.', hint: 'Remove 4.', leftSide: [V(), K(4)], rightSide: [K(2), K(4)], variableValue: 2 },
  ],
};

// two_step, [x, x, b] = [k·x, b] — coefficient with divide available.
const bsTwoStep = {
  title: 'Two-Step Equations',
  description: 'Remove the constant, then divide to isolate x.',
  challengeType: 'two_step',
  gradeBand: '5',
  allowOperations: ['add', 'subtract', 'multiply', 'divide'],
  challenges: [
    { type: 'two_step', instruction: 'Solve for x.', hint: 'Remove 3, divide by 2.', leftSide: [V(), V(), K(3)], rightSide: [K(8), K(3)], variableValue: 4 },
    { type: 'two_step', instruction: 'Solve for x.', hint: 'Remove 1, divide by 3.', leftSide: [V(), V(), V(), K(1)], rightSide: [K(15), K(1)], variableValue: 5 },
    { type: 'two_step', instruction: 'Solve for x.', hint: 'Remove 2, divide by 2.', leftSide: [V(), V(), K(2)], rightSide: [K(12), K(2)], variableValue: 6 },
  ],
};

describe('balance-scale oracle', () => {
  it('passes clean one-step data', () => {
    expect(balanceScaleOracle.verify(bsClean, bsCtx).violations).toEqual([]);
  });

  it('passes clean two-step data (coefficient + divide)', () => {
    expect(balanceScaleOracle.verify(bsTwoStep, { ...bsCtx, evalMode: 'two_step', gradeLevel: 'grade 5' }).violations).toEqual([]);
  });

  it('flags answer-key-desync — variableValue is not the equation solution (correct solve marked wrong)', () => {
    const data = JSON.parse(JSON.stringify(bsClean));
    data.challenges[0].variableValue = 7; // real solution is 6
    const v = balanceScaleOracle.verify(data, bsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('one_step#1'))).toBe(true);
  });

  it('flags answer-key-desync — a constant on the variable side has no twin to remove', () => {
    const data = JSON.parse(JSON.stringify(bsClean));
    // [x, 5] = [11] : arithmetic still solves to x=6, but the 5 can never be removed.
    data.challenges[0].leftSide = [V(), K(5)];
    data.challenges[0].rightSide = [K(11)];
    data.challenges[0].variableValue = 6;
    const v = balanceScaleOracle.verify(data, bsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /cannot remove/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — the variable cancels (equal var counts, no unique x)', () => {
    const data = JSON.parse(JSON.stringify(bsClean));
    data.challenges[0].leftSide = [V(), K(5)];
    data.challenges[0].rightSide = [V(), K(3)];
    const v = balanceScaleOracle.verify(data, bsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /cancels/.test(x.detail))).toBe(true);
  });

  it('flags schema — a kx equation with no divide operation available', () => {
    const data = JSON.parse(JSON.stringify(bsTwoStep));
    data.allowOperations = ['add', 'subtract'];
    const v = balanceScaleOracle.verify(data, { ...bsCtx, evalMode: 'two_step' }).violations;
    expect(v.some((x) => x.check === 'schema' && /divide operation/.test(x.detail))).toBe(true);
  });

  it('flags scope — a constant above the band ceiling', () => {
    const v = balanceScaleOracle.verify(bsClean, { ...bsCtx, scopeMax: 5 }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags clustering — every equation has the same answer', () => {
    const data = JSON.parse(JSON.stringify(bsClean));
    for (const c of data.challenges) { c.rightSide = [K(6), c.leftSide[1]]; c.variableValue = 6; }
    const v = balanceScaleOracle.verify(data, bsCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...bsClean, challenges: [bsClean.challenges[0]] };
    const v = balanceScaleOracle.verify(data, bsCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
