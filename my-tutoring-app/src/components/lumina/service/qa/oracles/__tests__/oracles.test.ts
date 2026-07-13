import { describe, expect, it } from 'vitest';
import { angleWorkshopOracle } from '../angle-workshop';
import { balanceScaleOracle } from '../balance-scale';
import { circleExplorerOracle } from '../circle-explorer';
import { coordinateGraphOracle } from '../coordinate-graph';
import { distributionExplorerOracle } from '../distribution-explorer';
import { dotPlotOracle } from '../dot-plot';
import { equationBuilderOracle } from '../equation-builder';
import { equationWorkspaceOracle } from '../equation-workspace';
import { matrixDisplayOracle } from '../matrix-display';
import { systemsEquationsVisualizerOracle } from '../systems-equations-visualizer';
import { knowledgeCheckOracle } from '../knowledge-check';
import { functionMachineOracle } from '../function-machine';
import { functionSketchOracle } from '../function-sketch';
import { histogramOracle } from '../histogram';
import { mathFactFluencyOracle } from '../math-fact-fluency';
import { polygonAreaBuilderOracle } from '../polygon-area-builder';
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

// ---------------------------------------------------------------------------
// coordinate-graph
// ---------------------------------------------------------------------------

const cgReadCtx = { componentId: 'coordinate-graph', evalMode: 'read_point', topic: 'Plot points on a coordinate grid', gradeLevel: 'grade 5' };
const cgSlopeCtx = { componentId: 'coordinate-graph', evalMode: 'find_slope', topic: 'Slope of a line', gradeLevel: 'grade 8' };

// read_point: the option at correctOptionIndex must parse to the drawn (x1,y1).
const cgReadClean = {
  gridMin: -10,
  gridMax: 10,
  challenges: [
    { id: 'c1', type: 'read_point', x1: 2, y1: 3, instruction: 'What are the coordinates of the plotted point?', hint: 'Read across, then up.', option0: '(2, 3)', option1: '(3, 2)', option2: '(2, -3)', option3: '(-2, 3)', correctOptionIndex: 0 },
    { id: 'c2', type: 'read_point', x1: -4, y1: 1, instruction: 'Name the point on the grid.', hint: 'Left is negative x.', option0: '(-4, 1)', option1: '(4, 1)', option2: '(-4, -1)', option3: '(1, -4)', correctOptionIndex: 0 },
    { id: 'c3', type: 'read_point', x1: 5, y1: -2, instruction: 'Which pair matches the dot?', hint: 'Down is negative y.', option0: '(5, -2)', option1: '(-5, 2)', option2: '(5, 2)', option3: '(-5, -2)', correctOptionIndex: 0 },
  ],
};

// find_slope: the keyed option must parse (integer or fraction) to (y2-y1)/(x2-x1).
const cgSlopeClean = {
  gridMin: -10,
  gridMax: 10,
  challenges: [
    { id: 's1', type: 'find_slope', x1: 0, y1: 0, x2: 2, y2: 4, instruction: 'What is the slope of the line?', hint: 'Compare the rise to the run.', option0: '2', option1: '1', option2: '4', option3: '-2', correctOptionIndex: 0 },
    { id: 's2', type: 'find_slope', x1: 0, y1: 0, x2: 1, y2: 3, instruction: 'Find the slope.', hint: 'Rise over run.', option0: '3', option1: '2', option2: '1', option3: '6', correctOptionIndex: 0 },
    { id: 's3', type: 'find_slope', x1: 0, y1: 0, x2: 2, y2: -2, instruction: 'Read the slope off the graph.', hint: 'A falling line is negative.', option0: '-1', option1: '1', option2: '2', option3: '-2', correctOptionIndex: 0 },
  ],
};

describe('coordinate-graph oracle', () => {
  it('passes clean read_point data', () => {
    expect(coordinateGraphOracle.verify(cgReadClean, cgReadCtx).violations).toEqual([]);
  });

  it('passes clean find_slope data', () => {
    expect(coordinateGraphOracle.verify(cgSlopeClean, cgSlopeCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — the keyed option is not the drawn point (correct read marked wrong)', () => {
    const data = JSON.parse(JSON.stringify(cgReadClean));
    data.challenges[0].correctOptionIndex = 1; // option1 is (3, 2), drawn point is (2, 3)
    const v = coordinateGraphOracle.verify(data, cgReadCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });

  it('flags answer-key-desync — two options name the true slope (unsimplified twin)', () => {
    const data = JSON.parse(JSON.stringify(cgSlopeClean));
    data.challenges[0].option1 = '4/2'; // 4/2 === 2 === the true slope, but only index 0 is judged
    const v = coordinateGraphOracle.verify(data, cgSlopeCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1')).toBe(true);
  });

  it('flags scope — a coordinate magnitude above the objective ceiling', () => {
    const v = coordinateGraphOracle.verify(cgReadClean, { ...cgReadCtx, scopeMax: 4 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'c3')).toBe(true); // (5, -2) exceeds ±4
  });

  it('flags answer-leak — the instruction states the asked point', () => {
    const data = JSON.parse(JSON.stringify(cgReadClean));
    data.challenges[0].instruction = 'The point is at (2, 3) — pick it.';
    const v = coordinateGraphOracle.verify(data, cgReadCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'c1')).toBe(true);
  });

  it('flags clustering — every card is the same point', () => {
    const data = {
      gridMin: -10,
      gridMax: 10,
      challenges: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, type: 'read_point', x1: 2, y1: 3, instruction: 'Name the point.', hint: 'Read it.', option0: '(2, 3)', option1: '(3, 2)', option2: '(2, -3)', option3: '(-2, 3)', correctOptionIndex: 0 })),
    };
    const v = coordinateGraphOracle.verify(data, cgReadCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — correctOptionIndex out of range (unwinnable card)', () => {
    const data = JSON.parse(JSON.stringify(cgReadClean));
    data.challenges[0].correctOptionIndex = 9;
    const v = coordinateGraphOracle.verify(data, cgReadCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { gridMin: -10, gridMax: 10, challenges: [cgReadClean.challenges[0]] };
    const v = coordinateGraphOracle.verify(data, cgReadCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// polygon-area-builder
// ---------------------------------------------------------------------------

const pabTriCtx = { componentId: 'polygon-area-builder', evalMode: 'find_area_triangle_parallelogram', topic: 'Area of triangles and parallelograms', gradeLevel: 'grade 6' };
const pabCompCtx = { componentId: 'polygon-area-builder', evalMode: 'composite_area', topic: 'Area of composite figures', gradeLevel: 'grade 6' };

// find_area: expectedArea must equal the shoelace area of the DRAWN figure.
const pabTriClean = {
  challenges: [
    { id: 't1', type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 6, height: 4, apexX: 3, expectedArea: 12, unitLabel: 'cm', instruction: 'Find the area of the triangle.', hint: 'Use the base and the height.' },
    { id: 't2', type: 'find_area_triangle_parallelogram', figureType: 'parallelogram', base: 5, height: 4, skew: 1, expectedArea: 20, unitLabel: 'cm', instruction: 'Find the area of the parallelogram.', hint: 'Base times height.' },
    { id: 't3', type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 10, height: 3, apexX: 5, expectedArea: 15, unitLabel: 'cm', instruction: 'Find the area of the figure.', hint: 'Half of base times height.' },
  ],
};

// composite: union area = Σ w·h over DISJOINT rectangle parts.
const pabCompClean = {
  challenges: [
    { id: 'p1', type: 'composite_area', figureType: 'composite', parts: [{ x: 0, y: 0, w: 4, h: 3 }, { x: 0, y: 3, w: 2, h: 2 }], expectedArea: 16, unitLabel: 'cm', instruction: 'Find the total area.', hint: 'Split into rectangles.' },
    { id: 'p2', type: 'composite_area', figureType: 'composite', parts: [{ x: 0, y: 0, w: 5, h: 3 }, { x: 0, y: 3, w: 2, h: 2 }], expectedArea: 19, unitLabel: 'cm', instruction: 'Find the total area.', hint: 'Add the pieces.' },
    { id: 'p3', type: 'composite_area', figureType: 'composite', parts: [{ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 2, w: 3, h: 3 }], expectedArea: 17, unitLabel: 'cm', instruction: 'Find the total area.', hint: 'Sum the sub-rectangles.' },
  ],
};

describe('polygon-area-builder oracle', () => {
  it('passes clean triangle/parallelogram data', () => {
    expect(polygonAreaBuilderOracle.verify(pabTriClean, pabTriCtx).violations).toEqual([]);
  });

  it('passes clean composite data', () => {
    expect(polygonAreaBuilderOracle.verify(pabCompClean, pabCompCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — expectedArea disagrees with the drawn figure (correct count marked wrong)', () => {
    const data = JSON.parse(JSON.stringify(pabTriClean));
    data.challenges[0].expectedArea = 14; // drawn triangle measures 12
    const v = polygonAreaBuilderOracle.verify(data, pabTriCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 't1')).toBe(true);
  });

  it('flags answer-key-desync — overlapping composite parts double-count area', () => {
    const data = JSON.parse(JSON.stringify(pabCompClean));
    data.challenges[0].parts = [{ x: 0, y: 0, w: 4, h: 3 }, { x: 2, y: 1, w: 3, h: 3 }]; // overlap 2×2
    const v = polygonAreaBuilderOracle.verify(data, pabCompCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'p1' && /overlap/.test(x.detail))).toBe(true);
  });

  it('flags scope — an area above the objective ceiling', () => {
    const v = polygonAreaBuilderOracle.verify(pabTriClean, { ...pabTriCtx, scopeMax: 13 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 't2')).toBe(true); // area 20 exceeds 13
  });

  it('flags answer-leak — the instruction states the asked area', () => {
    const data = JSON.parse(JSON.stringify(pabTriClean));
    data.challenges[0].instruction = 'The area is 12 square cm; confirm it.';
    const v = polygonAreaBuilderOracle.verify(data, pabTriCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 't1')).toBe(true);
  });

  it('flags clustering — every figure has the same area', () => {
    const data = {
      challenges: [1, 2, 3, 4].map((i) => ({ id: `t${i}`, type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 6, height: 4, apexX: 3, expectedArea: 12, unitLabel: 'cm', instruction: 'Find the area.', hint: 'Base times height over two.' })),
    };
    const v = polygonAreaBuilderOracle.verify(data, pabTriCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { challenges: [pabTriClean.challenges[0]] };
    const v = polygonAreaBuilderOracle.verify(data, pabTriCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// circle-explorer
// ---------------------------------------------------------------------------

const ceAreaCtx = { componentId: 'circle-explorer', evalMode: 'area', topic: 'Area of a circle', gradeLevel: 'grade 7' };
const ceReverseCtx = { componentId: 'circle-explorer', evalMode: 'reverse', topic: 'Circle measurements', gradeLevel: 'grade 7' };

// area: a student using π ≈ 3.14 computes 3.14·r², which must land in the window.
const ceAreaClean = {
  challenges: [
    { id: 'a1', type: 'area', given: 'radius', radius: 5, expectedAnswer: 78.5, tolerance: 2, unitLabel: 'cm', answerKind: 'area', instruction: 'Find the area of the circle.', hint: 'Use π ≈ 3.14 and the radius.' },
    { id: 'a2', type: 'area', given: 'radius', radius: 3, expectedAnswer: 28.26, tolerance: 2, unitLabel: 'cm', answerKind: 'area', instruction: 'Find the area.', hint: 'Area is π times radius squared.' },
    { id: 'a3', type: 'area', given: 'radius', radius: 7, expectedAnswer: 153.86, tolerance: 3.1, unitLabel: 'cm', answerKind: 'area', instruction: 'Compute the area of the circle.', hint: 'Square the radius first.' },
  ],
};

// reverse: work backward from the printed givenValue; radius and expectedAnswer must agree.
const ceReverseClean = {
  challenges: [
    { id: 'r1', type: 'reverse', given: 'radius', radius: 7, reverseGiven: 'circumference', givenValue: 44.0, expectedAnswer: 7, tolerance: 0.2, unitLabel: 'cm', answerKind: 'length', instruction: 'Find the radius of the circle.', hint: 'Work backward from the circumference using π ≈ 3.14.' },
    { id: 'r2', type: 'reverse', given: 'radius', radius: 5, reverseGiven: 'circumference', givenValue: 31.4, expectedAnswer: 5, tolerance: 0.2, unitLabel: 'cm', answerKind: 'length', instruction: 'Find the radius.', hint: 'Divide by 2π.' },
    { id: 'r3', type: 'reverse', given: 'radius', radius: 9, reverseGiven: 'circumference', givenValue: 56.5, expectedAnswer: 9, tolerance: 0.2, unitLabel: 'cm', answerKind: 'length', instruction: 'What is the radius?', hint: 'Undo the circumference formula.' },
  ],
};

describe('circle-explorer oracle', () => {
  it('passes clean area data', () => {
    expect(circleExplorerOracle.verify(ceAreaClean, ceAreaCtx).violations).toEqual([]);
  });

  it('passes clean reverse data', () => {
    expect(circleExplorerOracle.verify(ceReverseClean, ceReverseCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — the 3.14 answer falls outside the shipped window (correct work marked wrong)', () => {
    const data = JSON.parse(JSON.stringify(ceAreaClean));
    data.challenges[0].expectedAnswer = 90; // student computes 78.5, window is 90 ± 2
    const v = circleExplorerOracle.verify(data, ceAreaCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'a1')).toBe(true);
  });

  it('flags answer-key-desync — reverse stores a radius the key does not accept', () => {
    const data = JSON.parse(JSON.stringify(ceReverseClean));
    data.challenges[0].expectedAnswer = 8; // radius is 7; the tutor coaches toward a different value
    const v = circleExplorerOracle.verify(data, ceReverseCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'r1')).toBe(true);
  });

  it('flags scope — a radius above the objective ceiling', () => {
    const v = circleExplorerOracle.verify(ceAreaClean, { ...ceAreaCtx, scopeMax: 4 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'a1')).toBe(true); // radius 5 exceeds 4
  });

  it('flags answer-leak — the instruction states the asked area value', () => {
    const data = JSON.parse(JSON.stringify(ceAreaClean));
    data.challenges[0].instruction = 'The area is 78.5 square cm — verify it.';
    const v = circleExplorerOracle.verify(data, ceAreaCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'a1')).toBe(true);
  });

  it('flags clustering — every circle has the same answer', () => {
    const data = {
      challenges: [1, 2, 3, 4].map((i) => ({ id: `a${i}`, type: 'area', given: 'radius', radius: 5, expectedAnswer: 78.5, tolerance: 2, unitLabel: 'cm', answerKind: 'area', instruction: 'Find the area.', hint: 'π times radius squared.' })),
    };
    const v = circleExplorerOracle.verify(data, ceAreaCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { challenges: [ceAreaClean.challenges[0]] };
    const v = circleExplorerOracle.verify(data, ceAreaCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// systems-equations-visualizer
// ---------------------------------------------------------------------------

const seGraphCtx = { componentId: 'systems-equations-visualizer', evalMode: 'graph', topic: 'Solve systems by graphing', gradeLevel: 'grade 8' };
const seElimCtx = { componentId: 'systems-equations-visualizer', evalMode: 'elimination', topic: 'Solve systems by elimination', gradeLevel: 'algebra 2' };

const eq = (display: string, slope: number, yIntercept: number, extra: Record<string, number> = {}) => ({ display, slope, yIntercept, ...extra });

// graph / slope-intercept: the two drawn lines cross at (expectedX, expectedY).
const seGraphClean = {
  title: 'Solving Systems by Graphing',
  description: 'Read the intersection of two lines off the grid.',
  xRange: [-10, 10],
  yRange: [-10, 10],
  challenges: [
    { id: 'g1', type: 'graph', systemForm: 'slope-intercept', equationA: eq('y = 2x + 1', 2, 1), equationB: eq('y = -x + 4', -1, 4), expectedX: 1, expectedY: 3, instruction: 'Find where the two lines cross and enter (x, y).', hint: 'Trace both lines.' },
    { id: 'g2', type: 'graph', systemForm: 'slope-intercept', equationA: eq('y = x - 2', 1, -2), equationB: eq('y = -2x + 4', -2, 4), expectedX: 2, expectedY: 0, instruction: 'Read the crossing point.', hint: 'Where do they meet?' },
    { id: 'g3', type: 'graph', systemForm: 'slope-intercept', equationA: eq('y = 3x', 3, 0), equationB: eq('y = x - 4', 1, -4), expectedX: -2, expectedY: -6, instruction: 'Enter the intersection coordinates.', hint: 'Follow each line.' },
  ],
};

// elimination / standard: (expectedX, expectedY) satisfies each a·x + b·y = c.
const seElimClean = {
  title: 'Solving Systems by Elimination',
  description: 'Scale and add the equations to cancel a variable.',
  xRange: [-10, 10],
  yRange: [-10, 10],
  challenges: [
    { id: 'e1', type: 'elimination', systemForm: 'standard', equationA: eq('2x + y = 5', -2, 5, { a: 2, b: 1, c: 5 }), equationB: eq('x - y = 1', 1, -1, { a: 1, b: -1, c: 1 }), expectedX: 2, expectedY: 1, instruction: 'Eliminate a variable, then enter (x, y).', hint: 'Add the equations.' },
    { id: 'e2', type: 'elimination', systemForm: 'standard', equationA: eq('x + 2y = 1', -0.5, 0.5, { a: 1, b: 2, c: 1 }), equationB: eq('2x - y = 7', 2, -7, { a: 2, b: -1, c: 7 }), expectedX: 3, expectedY: -1, instruction: 'Solve by elimination.', hint: 'Scale then add.' },
    { id: 'e3', type: 'elimination', systemForm: 'standard', equationA: eq('3x + y = -1', -3, -1, { a: 3, b: 1, c: -1 }), equationB: eq('x - 2y = -5', 0.5, 2.5, { a: 1, b: -2, c: -5 }), expectedX: -1, expectedY: 2, instruction: 'Cancel a variable and enter (x, y).', hint: 'Line them up.' },
  ],
};

describe('systems-equations-visualizer oracle', () => {
  it('passes clean graph data', () => {
    expect(systemsEquationsVisualizerOracle.verify(seGraphClean, seGraphCtx).violations).toEqual([]);
  });

  it('passes clean elimination data', () => {
    expect(systemsEquationsVisualizerOracle.verify(seElimClean, seElimCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — the drawn lines cross somewhere other than the key', () => {
    const data = JSON.parse(JSON.stringify(seGraphClean));
    data.challenges[0].expectedY = 5; // lines cross at (1, 3)
    const v = systemsEquationsVisualizerOracle.verify(data, seGraphCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'g1')).toBe(true);
  });

  it('flags answer-key-desync — the printed standard equation lies (display-string independence)', () => {
    const data = JSON.parse(JSON.stringify(seElimClean));
    data.challenges[0].equationA.display = '2x + y = 9'; // a/b/c fields stay 2,1,5; only the banner drifts
    const v = systemsEquationsVisualizerOracle.verify(data, seElimCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e1' && /not satisfied by the key/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — a drawn line contradicts its own standard form (slope ≠ −a/b)', () => {
    const data = JSON.parse(JSON.stringify(seElimClean));
    data.challenges[0].equationA.slope = 5; // should be −2 for 2x + y = 5
    const v = systemsEquationsVisualizerOracle.verify(data, seElimCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e1' && /contradicts its own standard form/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — parallel lines have no unique crossing', () => {
    const data = JSON.parse(JSON.stringify(seGraphClean));
    data.challenges[0].equationB.slope = 2; // equationA slope is also 2
    const v = systemsEquationsVisualizerOracle.verify(data, seGraphCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'g1' && /parallel/.test(x.detail))).toBe(true);
  });

  it('flags scope — a solution magnitude above the objective ceiling', () => {
    const v = systemsEquationsVisualizerOracle.verify(seGraphClean, { ...seGraphCtx, scopeMax: 1 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'g3')).toBe(true); // (-2, -6) exceeds ±1
  });

  it('flags scope — an eval-mode identity mismatch (graph challenge in an elimination session)', () => {
    const v = systemsEquationsVisualizerOracle.verify(seGraphClean, seElimCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — the description prints the solution pair', () => {
    const data = JSON.parse(JSON.stringify(seElimClean));
    data.description = 'For example, the solution is (2, 1).';
    const v = systemsEquationsVisualizerOracle.verify(data, seElimCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'e1')).toBe(true);
  });

  it('flags clustering — every system has the same solution', () => {
    const data = {
      title: 'x', description: 'y', xRange: [-10, 10], yRange: [-10, 10],
      challenges: [1, 2, 3, 4].map((i) => ({ id: `g${i}`, type: 'graph', systemForm: 'slope-intercept', equationA: eq('y = 2x + 1', 2, 1), equationB: eq('y = -x + 4', -1, 4), expectedX: 1, expectedY: 3, instruction: 'Find the crossing.', hint: 'Trace.' })),
    };
    const v = systemsEquationsVisualizerOracle.verify(data, seGraphCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...seGraphClean, challenges: [seGraphClean.challenges[0]] };
    const v = systemsEquationsVisualizerOracle.verify(data, seGraphCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matrix-display
// ---------------------------------------------------------------------------

const mdDetCtx = { componentId: 'matrix-display', evalMode: 'determinant', topic: 'Determinants', gradeLevel: 'algebra 2' };
const mdMulCtx = { componentId: 'matrix-display', evalMode: 'multiply', topic: 'Matrix multiplication', gradeLevel: 'algebra 2' };
const mdTransCtx = { componentId: 'matrix-display', evalMode: 'transpose', topic: 'Matrix transpose', gradeLevel: 'algebra 2' };

// determinant → scalar path (expectedScalar = ad − bc).
const mdDetClean = {
  title: 'Determinant Practice', description: 'Compute the determinant of each 2×2 matrix.',
  challengeType: 'determinant',
  challenges: [
    { id: 'd1', challengeType: 'determinant', rows: 2, columns: 2, values: [[2, 1], [3, 2]], expectedScalar: 1, instruction: 'Calculate the determinant.', hint: 'det = ad − bc.' },
    { id: 'd2', challengeType: 'determinant', rows: 2, columns: 2, values: [[3, 1], [2, 4]], expectedScalar: 10, instruction: 'Calculate the determinant.', hint: 'det = ad − bc.' },
    { id: 'd3', challengeType: 'determinant', rows: 2, columns: 2, values: [[5, 2], [1, 3]], expectedScalar: 13, instruction: 'Calculate the determinant.', hint: 'det = ad − bc.' },
  ],
};

// multiply → matrix path (result = row·column dot products).
const mdMulClean = {
  title: 'Matrix Multiplication', description: 'Multiply the matrices.',
  challengeType: 'multiply',
  challenges: [
    { id: 'm1', challengeType: 'multiply', rows: 2, columns: 2, values: [[1, 2], [3, 4]], secondMatrix: { rows: 2, columns: 2, values: [[5, 6], [7, 8]], label: 'Matrix B' }, expectedMatrix: [[19, 22], [43, 50]], instruction: 'Multiply A by B.', hint: 'Row · column.' },
    { id: 'm2', challengeType: 'multiply', rows: 2, columns: 2, values: [[2, 0], [1, 3]], secondMatrix: { rows: 2, columns: 2, values: [[1, 4], [2, 5]], label: 'Matrix B' }, expectedMatrix: [[2, 8], [7, 19]], instruction: 'Multiply A by B.', hint: 'Row · column.' },
    { id: 'm3', challengeType: 'multiply', rows: 2, columns: 2, values: [[1, 1], [0, 2]], secondMatrix: { rows: 2, columns: 2, values: [[3, 2], [1, 4]], label: 'Matrix B' }, expectedMatrix: [[4, 6], [2, 8]], instruction: 'Multiply A by B.', hint: 'Row · column.' },
  ],
};

// transpose → matrix path (result[j][i] = A[i][j]).
const mdTransClean = {
  title: 'Transpose', description: 'Swap rows and columns.',
  challengeType: 'transpose',
  challenges: [
    { id: 't1', challengeType: 'transpose', rows: 2, columns: 3, values: [[1, 2, 3], [4, 5, 6]], expectedMatrix: [[1, 4], [2, 5], [3, 6]], instruction: 'Transpose the matrix.', hint: 'Rows become columns.' },
    { id: 't2', challengeType: 'transpose', rows: 3, columns: 2, values: [[7, 8], [9, 1], [2, 3]], expectedMatrix: [[7, 9, 2], [8, 1, 3]], instruction: 'Transpose the matrix.', hint: 'Rows become columns.' },
    { id: 't3', challengeType: 'transpose', rows: 2, columns: 3, values: [[2, 0, 1], [3, 5, 4]], expectedMatrix: [[2, 3], [0, 5], [1, 4]], instruction: 'Transpose the matrix.', hint: 'Rows become columns.' },
  ],
};

describe('matrix-display oracle', () => {
  it('passes clean determinant data', () => {
    expect(matrixDisplayOracle.verify(mdDetClean, mdDetCtx).violations).toEqual([]);
  });

  it('passes clean multiply data', () => {
    expect(matrixDisplayOracle.verify(mdMulClean, mdMulCtx).violations).toEqual([]);
  });

  it('passes clean transpose data', () => {
    expect(matrixDisplayOracle.verify(mdTransClean, mdTransCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — expectedScalar ≠ the true determinant', () => {
    const data = JSON.parse(JSON.stringify(mdDetClean));
    data.challenges[0].expectedScalar = 5; // det [[2,1],[3,2]] = 1
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'd1')).toBe(true);
  });

  it('flags answer-key-desync — expectedMatrix ≠ the re-derived product (independence)', () => {
    const data = JSON.parse(JSON.stringify(mdMulClean));
    data.challenges[0].expectedMatrix[0][0] = 99; // true product [0][0] is 19
    const v = matrixDisplayOracle.verify(data, mdMulCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1')).toBe(true);
  });

  it('flags answer-key-desync — transpose that keeps the original shape', () => {
    const data = JSON.parse(JSON.stringify(mdTransClean));
    data.challenges[0].expectedMatrix = [[1, 2, 3], [4, 5, 6]]; // not transposed
    const v = matrixDisplayOracle.verify(data, mdTransCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 't1')).toBe(true);
  });

  it('flags answer-key-desync — a matrix op shipping an expectedScalar (wrong grading path)', () => {
    const data = JSON.parse(JSON.stringify(mdMulClean));
    data.challenges[0].expectedScalar = 10; // component grades scalar, ignores the result matrix
    const v = matrixDisplayOracle.verify(data, mdMulCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1' && /expectedScalar/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — a determinant with no expectedScalar (unwinnable)', () => {
    const data = JSON.parse(JSON.stringify(mdDetClean));
    delete data.challenges[0].expectedScalar;
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'd1' && /no expectedScalar/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — multiply with incompatible dimensions', () => {
    const data = JSON.parse(JSON.stringify(mdMulClean));
    data.challenges[0].secondMatrix = { rows: 3, columns: 2, values: [[1, 2], [3, 4], [5, 6]], label: 'Matrix B' }; // A has 2 cols, B has 3 rows
    const v = matrixDisplayOracle.verify(data, mdMulCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1' && /undefined/.test(x.detail))).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = matrixDisplayOracle.verify(mdDetClean, mdMulCtx).violations; // determinant cards in a multiply session
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags scope — an entry magnitude above the objective ceiling', () => {
    const v = matrixDisplayOracle.verify(mdDetClean, { ...mdDetCtx, scopeMax: 2 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'd2')).toBe(true); // entry 4 exceeds ±2
  });

  it('flags answer-leak — the description states the determinant value', () => {
    const data = JSON.parse(JSON.stringify(mdDetClean));
    data.description = 'Nice — the determinant is 13.';
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'd3')).toBe(true);
  });

  it('flags clustering — every matrix is identical', () => {
    const data = {
      title: 'x', description: 'y', challengeType: 'determinant',
      challenges: [1, 2, 3, 4].map((i) => ({ id: `d${i}`, challengeType: 'determinant', rows: 2, columns: 2, values: [[2, 1], [3, 2]], expectedScalar: 1, instruction: 'Determinant.', hint: 'ad − bc.' })),
    };
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — rows/columns disagree with the values grid', () => {
    const data = JSON.parse(JSON.stringify(mdDetClean));
    data.challenges[0].rows = 3; // values is 2×2
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'd1')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...mdDetClean, challenges: [mdDetClean.challenges[0]] };
    const v = matrixDisplayOracle.verify(data, mdDetCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// equation-builder
// ---------------------------------------------------------------------------

const ebTfCtx = { componentId: 'equation-builder', evalMode: 'true-false', topic: 'Equations', gradeLevel: 'grade 1' };
const ebMvCtx = { componentId: 'equation-builder', evalMode: 'missing-result', topic: 'Missing numbers', gradeLevel: 'grade 1' };
const ebBuildCtx = { componentId: 'equation-builder', evalMode: 'build-simple', topic: 'Build equations', gradeLevel: 'grade 1' };
const ebBalCtx = { componentId: 'equation-builder', evalMode: 'balance-both-sides', topic: 'Balance equations', gradeLevel: 'grade 1' };
const ebRwCtx = { componentId: 'equation-builder', evalMode: 'rewrite', topic: 'Rewrite equations', gradeLevel: 'grade 1' };

const ebTfClean = {
  title: 'True or False', maxNumber: 10, gradeBand: '1',
  challenges: [
    { id: 't1', type: 'true-false', instruction: 'Is this true or false?', displayEquation: '3 + 2 = 5', isTrue: true },
    { id: 't2', type: 'true-false', instruction: 'Is this true or false?', displayEquation: '4 + 1 = 6', isTrue: false },
    { id: 't3', type: 'true-false', instruction: 'Is this true or false?', displayEquation: '7 - 2 = 5', isTrue: true },
    { id: 't4', type: 'true-false', instruction: 'Is this true or false?', displayEquation: '2 + 2 = 5', isTrue: false },
  ],
};

const ebMvClean = {
  title: 'Missing Number', maxNumber: 10, gradeBand: '1',
  challenges: [
    { id: 'v1', type: 'missing-value', instruction: 'What is missing?', equation: '3 + ? = 5', missingPosition: 2, correctValue: 2, options: [2, 3, 4, 1] },
    { id: 'v2', type: 'missing-value', instruction: 'What is missing?', equation: '4 + 2 = ?', missingPosition: 4, correctValue: 6, options: [6, 5, 7, 4] },
    { id: 'v3', type: 'missing-value', instruction: 'What is missing?', equation: '? + 1 = 4', missingPosition: 0, correctValue: 3, options: [3, 2, 4, 5] },
  ],
};

const ebBuildClean = {
  title: 'Build It', maxNumber: 10, gradeBand: '1',
  challenges: [
    { id: 'b1', type: 'build', instruction: 'Build an equation that equals 5.', targetEquation: '3 + 2 = 5', availableTiles: ['3', '+', '2', '=', '5', '4', '-'] },
    { id: 'b2', type: 'build', instruction: 'Build an equation that equals 7.', targetEquation: '4 + 3 = 7', availableTiles: ['4', '+', '3', '=', '7', '2', '-'] },
    { id: 'b3', type: 'build', instruction: 'Build an equation that equals 8.', targetEquation: '6 + 1 = 7', availableTiles: ['6', '+', '1', '=', '7', '5', '-'] },
  ],
};

const ebBalClean = {
  title: 'Balance', maxNumber: 10, gradeBand: '1',
  challenges: [
    { id: 'a1', type: 'balance', instruction: 'Balance both sides.', leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 },
    { id: 'a2', type: 'balance', instruction: 'Balance both sides.', leftSide: '2 + 2', rightSide: '? + 1', correctAnswer: 3 },
    { id: 'a3', type: 'balance', instruction: 'Balance both sides.', leftSide: '5 + 4', rightSide: '? + 3', correctAnswer: 6 },
  ],
};

const ebRwClean = {
  title: 'Rewrite', maxNumber: 10, gradeBand: '1',
  challenges: [
    { id: 'r1', type: 'rewrite', instruction: 'Write it another way.', originalEquation: '3 + 2 = 5', acceptedForms: ['2 + 3 = 5', '5 = 3 + 2', '5 - 3 = 2', '5 - 2 = 3'], availableTiles: ['3', '+', '2', '=', '5', '-'] },
    { id: 'r2', type: 'rewrite', instruction: 'Write it another way.', originalEquation: '4 + 1 = 5', acceptedForms: ['1 + 4 = 5', '5 = 4 + 1', '5 - 4 = 1', '5 - 1 = 4'], availableTiles: ['4', '+', '1', '=', '5', '-'] },
    { id: 'r3', type: 'rewrite', instruction: 'Write it another way.', originalEquation: '6 + 2 = 8', acceptedForms: ['2 + 6 = 8', '8 = 6 + 2', '8 - 6 = 2', '8 - 2 = 6'], availableTiles: ['6', '+', '2', '=', '8', '-'] },
  ],
};

describe('equation-builder oracle', () => {
  it('passes clean true-false data', () => {
    expect(equationBuilderOracle.verify(ebTfClean, ebTfCtx).violations).toEqual([]);
  });
  it('passes clean missing-value data', () => {
    expect(equationBuilderOracle.verify(ebMvClean, ebMvCtx).violations).toEqual([]);
  });
  it('passes clean build data', () => {
    expect(equationBuilderOracle.verify(ebBuildClean, ebBuildCtx).violations).toEqual([]);
  });
  it('passes clean balance data', () => {
    expect(equationBuilderOracle.verify(ebBalClean, ebBalCtx).violations).toEqual([]);
  });
  it('passes clean rewrite data', () => {
    expect(equationBuilderOracle.verify(ebRwClean, ebRwCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — true-false isTrue contradicts the actual equation', () => {
    const data = JSON.parse(JSON.stringify(ebTfClean));
    data.challenges[0].isTrue = false; // 3 + 2 = 5 is true
    const v = equationBuilderOracle.verify(data, ebTfCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 't1')).toBe(true);
  });

  it('flags answer-key-desync — correctValue does not satisfy the equation (substitute-back)', () => {
    const data = JSON.parse(JSON.stringify(ebMvClean));
    data.challenges[0].correctValue = 3; // 3 + 3 = 5 is false
    const v = equationBuilderOracle.verify(data, ebMvCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'v1' && /does not satisfy/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — correctValue missing from the options (unselectable)', () => {
    const data = JSON.parse(JSON.stringify(ebMvClean));
    data.challenges[0].options = [3, 4, 1, 5]; // 2 is gone
    const v = equationBuilderOracle.verify(data, ebMvCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'v1' && /unselectable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — build target that is not a true equation', () => {
    const data = JSON.parse(JSON.stringify(ebBuildClean));
    data.challenges[0].targetEquation = '3 + 2 = 6'; // false
    data.challenges[0].availableTiles = ['3', '+', '2', '=', '6', '4', '-'];
    const v = equationBuilderOracle.verify(data, ebBuildCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b1' && /not a true equation/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — build target not buildable from the tiles (unreachable)', () => {
    const data = JSON.parse(JSON.stringify(ebBuildClean));
    data.challenges[0].availableTiles = ['3', '+', '2', '=', '4', '-']; // no '5'
    const v = equationBuilderOracle.verify(data, ebBuildCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b1' && /unreachable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — balance answer that does not make the sides equal', () => {
    const data = JSON.parse(JSON.stringify(ebBalClean));
    data.challenges[0].correctAnswer = 9; // 9 + 2 = 11 ≠ 3 + 4 = 7
    const v = equationBuilderOracle.verify(data, ebBalCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'a1' && /do not balance/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — a rewrite accepted form that is false', () => {
    const data = JSON.parse(JSON.stringify(ebRwClean));
    data.challenges[0].acceptedForms[0] = '2 + 3 = 6'; // false
    const v = equationBuilderOracle.verify(data, ebRwCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'r1' && /not a true equation/.test(x.detail))).toBe(true);
  });

  it('flags scope — a number above the objective ceiling', () => {
    const v = equationBuilderOracle.verify(ebTfClean, { ...ebTfCtx, scopeMax: 4 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 't3')).toBe(true); // 7 exceeds 4
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = equationBuilderOracle.verify(ebTfClean, ebBuildCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — build instruction spells out the target', () => {
    const data = JSON.parse(JSON.stringify(ebBuildClean));
    data.challenges[0].instruction = 'Build 3 + 2 = 5 with the tiles.';
    const v = equationBuilderOracle.verify(data, ebBuildCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'b1')).toBe(true);
  });

  it('flags clustering — every true-false answer is true (the "all true" pattern)', () => {
    const data = {
      title: 'x', maxNumber: 10, gradeBand: '1',
      challenges: [
        { id: 't1', type: 'true-false', instruction: 'q', displayEquation: '3 + 2 = 5', isTrue: true },
        { id: 't2', type: 'true-false', instruction: 'q', displayEquation: '4 + 1 = 5', isTrue: true },
        { id: 't3', type: 'true-false', instruction: 'q', displayEquation: '7 - 2 = 5', isTrue: true },
        { id: 't4', type: 'true-false', instruction: 'q', displayEquation: '6 + 2 = 8', isTrue: true },
      ],
    };
    const v = equationBuilderOracle.verify(data, ebTfCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — isTrue is not a boolean', () => {
    const data = JSON.parse(JSON.stringify(ebTfClean));
    data.challenges[0].isTrue = 'true';
    const v = equationBuilderOracle.verify(data, ebTfCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 't1')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...ebTfClean, challenges: [ebTfClean.challenges[0]] };
    const v = equationBuilderOracle.verify(data, ebTfCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// equation-workspace
// ---------------------------------------------------------------------------

const ewSolveCtx = { componentId: 'equation-workspace', evalMode: 'solve', topic: 'Solving linear equations', gradeLevel: 'algebra 1' };
const ewIdCtx = { componentId: 'equation-workspace', evalMode: 'identify-operation', topic: 'Solving linear equations', gradeLevel: 'algebra 1' };

const OPS = [
  { id: 'sub3', label: 'Subtract 3', category: 'arithmetic' },
  { id: 'div2', label: 'Divide by 2', category: 'arithmetic' },
  { id: 'add6', label: 'Add 6', category: 'arithmetic' },
  { id: 'div3', label: 'Divide by 3', category: 'arithmetic' },
  { id: 'mul4', label: 'Multiply by 4', category: 'arithmetic' },
];

const ewSolveClean = {
  title: 'Solve for x',
  challenges: [
    { id: 's1', type: 'solve', instruction: 'Solve for x.', equation: '2x + 3 = 7', targetVariable: 'x', solutionSteps: [{ operation: 'Subtract 3', operationId: 'sub3', resultLatex: '2x = 4' }, { operation: 'Divide by 2', operationId: 'div2', resultLatex: 'x = 2' }], availableOperations: OPS },
    { id: 's2', type: 'solve', instruction: 'Solve for x.', equation: '3x - 6 = 9', targetVariable: 'x', solutionSteps: [{ operation: 'Add 6', operationId: 'add6', resultLatex: '3x = 15' }, { operation: 'Divide by 3', operationId: 'div3', resultLatex: 'x = 5' }], availableOperations: OPS },
    { id: 's3', type: 'solve', instruction: 'Solve for x.', equation: 'x / 4 = 2', targetVariable: 'x', solutionSteps: [{ operation: 'Multiply by 4', operationId: 'mul4', resultLatex: 'x = 8' }], availableOperations: OPS },
  ],
};

const ewIdClean = {
  title: 'Identify the next step',
  challenges: [
    { id: 'i1', type: 'identify-operation', instruction: 'What is the first step?', equation: '2x + 3 = 7', targetVariable: 'x', solutionSteps: [{ operation: 'Subtract 3', operationId: 'sub3', resultLatex: '2x = 4' }], availableOperations: OPS, correctOperationId: 'sub3' },
    { id: 'i2', type: 'identify-operation', instruction: 'What is the first step?', equation: '3x - 6 = 9', targetVariable: 'x', solutionSteps: [{ operation: 'Add 6', operationId: 'add6', resultLatex: '3x = 15' }], availableOperations: OPS, correctOperationId: 'add6' },
    { id: 'i3', type: 'identify-operation', instruction: 'What is the first step?', equation: 'x / 4 = 2', targetVariable: 'x', solutionSteps: [{ operation: 'Multiply by 4', operationId: 'mul4', resultLatex: 'x = 8' }], availableOperations: OPS, correctOperationId: 'mul4' },
  ],
};

describe('equation-workspace oracle', () => {
  it('passes clean solve data', () => {
    expect(equationWorkspaceOracle.verify(ewSolveClean, ewSolveCtx).violations).toEqual([]);
  });

  it('passes clean identify-operation data', () => {
    expect(equationWorkspaceOracle.verify(ewIdClean, ewIdCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — a step operation is not in the menu (unreachable)', () => {
    const data = JSON.parse(JSON.stringify(ewSolveClean));
    data.challenges[0].solutionSteps[1].operationId = 'div7'; // not in availableOperations
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1' && /unreachable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — identify correctOperationId ≠ the first solve step', () => {
    const data = JSON.parse(JSON.stringify(ewIdClean));
    data.challenges[0].correctOperationId = 'div2'; // first step is sub3
    const v = equationWorkspaceOracle.verify(data, ewIdCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'i1' && /contradicts the solve path/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — identify correctOperationId not selectable', () => {
    const data = JSON.parse(JSON.stringify(ewIdClean));
    data.challenges[0].correctOperationId = 'ghost';
    const v = equationWorkspaceOracle.verify(data, ewIdCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'i1' && /unselectable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — the final step never isolates the variable', () => {
    const data = JSON.parse(JSON.stringify(ewSolveClean));
    data.challenges[0].solutionSteps = [{ operation: 'Subtract 3', operationId: 'sub3', resultLatex: '2x = 4' }]; // ends at 2x = 4
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1' && /never actually solves/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — empty solutionSteps', () => {
    const data = JSON.parse(JSON.stringify(ewSolveClean));
    data.challenges[0].solutionSteps = [];
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1' && /no work to grade/.test(x.detail))).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = equationWorkspaceOracle.verify(ewSolveClean, ewIdCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — the instruction states the solved form', () => {
    const data = JSON.parse(JSON.stringify(ewSolveClean));
    data.challenges[0].instruction = 'Solve it — the answer is x = 2.';
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 's1')).toBe(true);
  });

  it('flags clustering — every challenge is the same equation', () => {
    const data = {
      title: 'x',
      challenges: [1, 2, 3, 4].map((i) => ({ id: `s${i}`, type: 'solve', instruction: 'Solve for x.', equation: '2x + 3 = 7', targetVariable: 'x', solutionSteps: [{ operation: 'Subtract 3', operationId: 'sub3', resultLatex: '2x = 4' }, { operation: 'Divide by 2', operationId: 'div2', resultLatex: 'x = 2' }], availableOperations: OPS })),
    };
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — duplicate operation ids in the menu', () => {
    const data = JSON.parse(JSON.stringify(ewSolveClean));
    data.challenges[0].availableOperations = [{ id: 'sub3', label: 'Subtract 3', category: 'arithmetic' }, { id: 'sub3', label: 'Subtract three', category: 'arithmetic' }, { id: 'div2', label: 'Divide by 2', category: 'arithmetic' }];
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 's1' && /duplicate ids/.test(x.detail))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...ewSolveClean, challenges: [ewSolveClean.challenges[0]] };
    const v = equationWorkspaceOracle.verify(data, ewSolveCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// angle-workshop
// ---------------------------------------------------------------------------

const awSolveCtx = { componentId: 'angle-workshop', evalMode: 'solve_unknown', topic: 'Angle relationships', gradeLevel: 'grade 7' };
const awClassCtx = { componentId: 'angle-workshop', evalMode: 'classify_pairs', topic: 'Angle pairs', gradeLevel: 'grade 7' };
const awTransCtx = { componentId: 'angle-workshop', evalMode: 'transversal', topic: 'Parallel lines', gradeLevel: 'grade 8' };
const awAlgCtx = { componentId: 'angle-workshop', evalMode: 'solve_algebraic', topic: 'Angle equations', gradeLevel: 'grade 8' };

const awSolveClean = {
  title: 'Find the Angle', description: 'Solve for the unknown angle.', challengeType: 'solve_unknown',
  challenges: [
    { id: 'u1', type: 'solve_unknown', narration: 'Two angles meet.', instruction: 'Find x.', hint: 'Use the relationship.', answerKind: 'degrees', solveConfig: 'complementary', knownAngle: 30, expectedAnswer: 60, tolerance: 1 },
    { id: 'u2', type: 'solve_unknown', narration: 'A straight line.', instruction: 'Find x.', hint: 'Use the relationship.', answerKind: 'degrees', solveConfig: 'supplementary', knownAngle: 50, expectedAnswer: 130, tolerance: 1 },
    { id: 'u3', type: 'solve_unknown', narration: 'Lines cross.', instruction: 'Find x.', hint: 'Use the relationship.', answerKind: 'degrees', solveConfig: 'around_point', knownAngle: 120, knownAngle2: 140, expectedAnswer: 100, tolerance: 1 },
  ],
};

const awClassClean = {
  title: 'Name the Pair', description: 'Classify the angle pair.', challengeType: 'classify_pairs',
  challenges: [
    { id: 'c1', type: 'classify_pairs', narration: 'Two angles.', instruction: 'What is the relationship?', hint: 'Look at the sum.', answerKind: 'relationship', relationship: 'complementary', splitAngle: 40, expectedRelationship: 'complementary', expectedAnswer: 0, tolerance: 0.5 },
    { id: 'c2', type: 'classify_pairs', narration: 'Two angles.', instruction: 'What is the relationship?', hint: 'Look at the sum.', answerKind: 'relationship', relationship: 'supplementary', splitAngle: 110, expectedRelationship: 'supplementary', expectedAnswer: 0, tolerance: 0.5 },
    { id: 'c3', type: 'classify_pairs', narration: 'Lines cross.', instruction: 'What is the relationship?', hint: 'Opposite angles.', answerKind: 'relationship', relationship: 'vertical', crossAngle: 65, expectedRelationship: 'vertical', expectedAnswer: 0, tolerance: 0.5 },
  ],
};

const awTransClean = {
  title: 'Transversal', description: 'Find the angle.', challengeType: 'transversal',
  challenges: [
    { id: 't1', type: 'transversal', narration: 'Parallel lines.', instruction: 'Find x.', hint: 'Corresponding angles are equal.', answerKind: 'degrees', transversalShape: 'parallel_transversal', transRelation: 'corresponding', givenAngle: 70, expectedAnswer: 70, tolerance: 1 },
    { id: 't2', type: 'transversal', narration: 'Parallel lines.', instruction: 'Find x.', hint: 'Same-side interior.', answerKind: 'degrees', transversalShape: 'parallel_transversal', transRelation: 'co_interior', givenAngle: 100, expectedAnswer: 80, tolerance: 1 },
    { id: 't3', type: 'transversal', narration: 'A triangle.', instruction: 'Find x.', hint: 'Angles sum to 180.', answerKind: 'degrees', transversalShape: 'triangle_sum', givenAngle: 55, givenAngle2: 65, expectedAnswer: 60, tolerance: 1 },
  ],
};

const awAlgClean = {
  title: 'Angle Equations', description: 'Solve for x.', challengeType: 'solve_algebraic',
  challenges: [
    { id: 'g1', type: 'solve_algebraic', narration: 'Two angles.', instruction: 'Find x.', hint: 'Set up the equation.', answerKind: 'x_value', algConfig: 'complementary', a1: 1, b1: 20, a2: 1, b2: 10, expectedAnswer: 30, tolerance: 0.01 },
    { id: 'g2', type: 'solve_algebraic', narration: 'A straight line.', instruction: 'Find x.', hint: 'Set up the equation.', answerKind: 'x_value', algConfig: 'supplementary', a1: 2, b1: 10, a2: 1, b2: 20, expectedAnswer: 50, tolerance: 0.01 },
    { id: 'g3', type: 'solve_algebraic', narration: 'Lines cross.', instruction: 'Find x.', hint: 'Vertical angles are equal.', answerKind: 'x_value', algConfig: 'vertical', a1: 3, b1: 5, a2: 1, b2: 25, expectedAnswer: 10, tolerance: 0.01 },
  ],
};

describe('angle-workshop oracle', () => {
  it('passes clean solve_unknown data', () => {
    expect(angleWorkshopOracle.verify(awSolveClean, awSolveCtx).violations).toEqual([]);
  });
  it('passes clean classify_pairs data', () => {
    expect(angleWorkshopOracle.verify(awClassClean, awClassCtx).violations).toEqual([]);
  });
  it('passes clean transversal data', () => {
    expect(angleWorkshopOracle.verify(awTransClean, awTransCtx).violations).toEqual([]);
  });
  it('passes clean solve_algebraic data', () => {
    expect(angleWorkshopOracle.verify(awAlgClean, awAlgCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — solve_unknown key ≠ the geometry (supplementary keyed as complementary)', () => {
    const data = JSON.parse(JSON.stringify(awSolveClean));
    data.challenges[1].expectedAnswer = 40; // 180 - 50 = 130, not 40
    const v = angleWorkshopOracle.verify(data, awSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'u2')).toBe(true);
  });

  it('flags answer-key-desync — classify figure drawn as one relationship, judged as another', () => {
    const data = JSON.parse(JSON.stringify(awClassClean));
    data.challenges[0].expectedRelationship = 'supplementary'; // figure is complementary
    const v = angleWorkshopOracle.verify(data, awClassCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /naming what they see/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — transversal triangle sum keyed wrong', () => {
    const data = JSON.parse(JSON.stringify(awTransClean));
    data.challenges[2].expectedAnswer = 70; // 180 - 55 - 65 = 60
    const v = angleWorkshopOracle.verify(data, awTransCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 't3')).toBe(true);
  });

  it('flags answer-key-desync — solve_algebraic x solved wrong', () => {
    const data = JSON.parse(JSON.stringify(awAlgClean));
    data.challenges[0].expectedAnswer = 25; // (90 - 20 - 10)/(1+1) = 30
    const v = angleWorkshopOracle.verify(data, awAlgCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'g1')).toBe(true);
  });

  it('flags answer-key-desync — solve_algebraic vertical with a1 = a2 (no unique x)', () => {
    const data = JSON.parse(JSON.stringify(awAlgClean));
    data.challenges[2].a1 = 1; // a2 is also 1 → a1 - a2 = 0
    const v = angleWorkshopOracle.verify(data, awAlgCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'g3' && /no unique x/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — wrong answerKind grades the wrong path', () => {
    const data = JSON.parse(JSON.stringify(awSolveClean));
    data.challenges[0].answerKind = 'relationship'; // a degrees answer graded as relationship
    const v = angleWorkshopOracle.verify(data, awSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'u1' && /wrong path/.test(x.detail))).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = angleWorkshopOracle.verify(awSolveClean, awClassCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — the hint states the computed answer', () => {
    const data = JSON.parse(JSON.stringify(awSolveClean));
    data.challenges[0].hint = 'The answer is 60 degrees.'; // answer 60 not a given (given is 30)
    const v = angleWorkshopOracle.verify(data, awSolveCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'u1')).toBe(true);
  });

  it('does NOT leak-flag vertical/corresponding where the answer equals the shown given', () => {
    // transversal t1: corresponding, given 70, answer 70 — a hint stating 70 shows the given, not the answer.
    const data = JSON.parse(JSON.stringify(awTransClean));
    data.challenges[0].hint = 'The marked angle is 70 degrees.';
    const v = angleWorkshopOracle.verify(data, awTransCtx).violations;
    expect(v.filter((x) => x.check === 'answer-leak')).toEqual([]);
  });

  it('flags clustering — every answer is the same', () => {
    const data = {
      title: 'x', description: 'y', challengeType: 'solve_unknown',
      challenges: [1, 2, 3, 4].map((i) => ({ id: `u${i}`, type: 'solve_unknown', narration: 'n', instruction: 'Find x.', hint: 'h', answerKind: 'degrees', solveConfig: 'complementary', knownAngle: 30, expectedAnswer: 60, tolerance: 1 })),
    };
    const v = angleWorkshopOracle.verify(data, awSolveCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...awSolveClean, challenges: [awSolveClean.challenges[0]] };
    const v = angleWorkshopOracle.verify(data, awSolveCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// histogram
// ---------------------------------------------------------------------------

const hgModalCtx = { componentId: 'histogram', evalMode: 'find_modal_bin', topic: 'Data distributions', gradeLevel: 'grade 7' };
const hgFreqCtx = { componentId: 'histogram', evalMode: 'read_frequency', topic: 'Reading histograms', gradeLevel: 'grade 6' };
const hgCenterCtx = { componentId: 'histogram', evalMode: 'estimate_center', topic: 'Mean and median', gradeLevel: 'grade 6' };
const hgShapeCtx = { componentId: 'histogram', evalMode: 'identify_shape', topic: 'Distribution shape', gradeLevel: 'grade 7' };

// find_modal_bin: expectedBinStart = the unique tallest bar's start.
const hgModalClean = {
  title: 'Modal Bin', description: 'Find the tallest bar.', challengeType: 'find_modal_bin',
  challenges: [
    { id: 'm1', challengeType: 'find_modal_bin', data: [1, 2, 2, 3, 3, 3, 4, 5], binWidth: 1, binStart: 0, contextTitle: 'Scores', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Which bin has the most values?', expectedBinStart: 3, expectedBinEnd: 4 },
    { id: 'm2', challengeType: 'find_modal_bin', data: [10, 10, 11, 12, 13, 14, 15], binWidth: 2, binStart: 10, contextTitle: 'Heights', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Which bin has the most values?', expectedBinStart: 10, expectedBinEnd: 12 },
    { id: 'm3', challengeType: 'find_modal_bin', data: [20, 21, 22, 22, 22, 24, 24], binWidth: 5, binStart: 20, contextTitle: 'Temps', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Which bin has the most values?', expectedBinStart: 20, expectedBinEnd: 25 },
  ],
};

// read_frequency: targetFrequency = count of data in [targetBinStart, targetBinEnd).
const hgFreqClean = {
  title: 'Read Frequency', description: 'Count the bar.', challengeType: 'read_frequency',
  challenges: [
    { id: 'f1', challengeType: 'read_frequency', data: [1, 2, 3, 3, 4, 5, 6, 7], binWidth: 2, binStart: 0, contextTitle: 'A', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'How many values are in the marked bin?', targetBinStart: 2, targetBinEnd: 4, targetFrequency: 3 },
    { id: 'f2', challengeType: 'read_frequency', data: [10, 11, 12, 13, 14, 15, 16], binWidth: 5, binStart: 10, contextTitle: 'B', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'How many values are in the marked bin?', targetBinStart: 15, targetBinEnd: 20, targetFrequency: 2 },
    { id: 'f3', challengeType: 'read_frequency', data: [20, 21, 22, 23, 24, 25], binWidth: 10, binStart: 20, contextTitle: 'C', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'How many values are in the marked bin?', targetBinStart: 20, targetBinEnd: 30, targetFrequency: 6 },
  ],
};

// estimate_center: targetAnswer = mean/median of the data.
const hgCenterClean = {
  title: 'Estimate Center', description: 'Estimate the center.', challengeType: 'estimate_center',
  challenges: [
    { id: 'e1', challengeType: 'estimate_center', data: [2, 4, 6, 8, 10], binWidth: 2, binStart: 0, contextTitle: 'A', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Estimate the mean.', targetStatistic: 'mean', targetAnswer: 6, tolerance: 1 },
    { id: 'e2', challengeType: 'estimate_center', data: [1, 2, 3, 4, 5, 6, 7], binWidth: 2, binStart: 0, contextTitle: 'B', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Estimate the median.', targetStatistic: 'median', targetAnswer: 4, tolerance: 1 },
    { id: 'e3', challengeType: 'estimate_center', data: [10, 20, 30], binWidth: 10, binStart: 0, contextTitle: 'C', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Estimate the mean.', targetStatistic: 'mean', targetAnswer: 20, tolerance: 2 },
  ],
};

// identify_shape: expectedShape present in shapeOptions.
const hgShapeClean = {
  title: 'Shape', description: 'Name the shape.', challengeType: 'identify_shape',
  challenges: [
    { id: 's1', challengeType: 'identify_shape', data: [3, 4, 5, 5, 5, 6, 7], binWidth: 1, binStart: 3, contextTitle: 'A', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'What shape?', expectedShape: 'symmetric', shapeOptions: ['symmetric', 'right-skewed', 'left-skewed', 'uniform'] },
    { id: 's2', challengeType: 'identify_shape', data: [1, 1, 1, 2, 2, 3, 6], binWidth: 1, binStart: 1, contextTitle: 'B', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'What shape?', expectedShape: 'right-skewed', shapeOptions: ['symmetric', 'right-skewed', 'left-skewed', 'uniform'] },
    { id: 's3', challengeType: 'identify_shape', data: [1, 1, 2, 5, 6, 6], binWidth: 1, binStart: 1, contextTitle: 'C', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'What shape?', expectedShape: 'bimodal', shapeOptions: ['bimodal', 'symmetric', 'uniform', 'left-skewed'] },
  ],
};

describe('histogram oracle', () => {
  it('passes clean find_modal_bin data', () => {
    expect(histogramOracle.verify(hgModalClean, hgModalCtx).violations).toEqual([]);
  });
  it('passes clean read_frequency data', () => {
    expect(histogramOracle.verify(hgFreqClean, hgFreqCtx).violations).toEqual([]);
  });
  it('passes clean estimate_center data', () => {
    expect(histogramOracle.verify(hgCenterClean, hgCenterCtx).violations).toEqual([]);
  });
  it('passes clean identify_shape data', () => {
    expect(histogramOracle.verify(hgShapeClean, hgShapeCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — expectedBinStart is not the tallest bar', () => {
    const data = JSON.parse(JSON.stringify(hgModalClean));
    data.challenges[0].expectedBinStart = 2; // tallest bar starts at 3
    const v = histogramOracle.verify(data, hgModalCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1')).toBe(true);
  });

  it('flags answer-key-desync — a modal-bin tie (ambiguous key)', () => {
    const data = JSON.parse(JSON.stringify(hgModalClean));
    data.challenges[0].data = [1, 1, 2, 2, 4]; // bins [1,2) and [2,3) both count 2
    const v = histogramOracle.verify(data, hgModalCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'm1' && /ambiguous/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — targetFrequency miscounts the bar (independence)', () => {
    const data = JSON.parse(JSON.stringify(hgFreqClean));
    data.challenges[0].targetFrequency = 5; // [2,4) actually holds 3
    const v = histogramOracle.verify(data, hgFreqCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'f1')).toBe(true);
  });

  it('flags answer-key-desync — targetAnswer outside the true center window', () => {
    const data = JSON.parse(JSON.stringify(hgCenterClean));
    data.challenges[0].targetAnswer = 8; // mean is 6, tolerance 1
    const v = histogramOracle.verify(data, hgCenterCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'e1')).toBe(true);
  });

  it('flags answer-key-desync — expectedShape not among the options (unselectable)', () => {
    const data = JSON.parse(JSON.stringify(hgShapeClean));
    data.challenges[0].expectedShape = 'bimodal'; // options don't include bimodal
    const v = histogramOracle.verify(data, hgShapeCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1' && /unselectable/.test(x.detail))).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = histogramOracle.verify(hgModalClean, hgCenterCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — the prompt states the center value', () => {
    const data = JSON.parse(JSON.stringify(hgCenterClean));
    data.challenges[0].prompt = 'The mean is about 6 — confirm it.';
    const v = histogramOracle.verify(data, hgCenterCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'e1')).toBe(true);
  });

  it('flags clustering — every challenge is the same dataset', () => {
    const data = {
      title: 'x', description: 'y', challengeType: 'find_modal_bin',
      challenges: [1, 2, 3, 4].map((i) => ({ id: `m${i}`, challengeType: 'find_modal_bin', data: [1, 2, 2, 3, 3, 3, 4, 5], binWidth: 1, binStart: 0, contextTitle: 'A', xAxisLabel: 'x', yAxisLabel: 'freq', prompt: 'Which bin?', expectedBinStart: 3, expectedBinEnd: 4 })),
    };
    const v = histogramOracle.verify(data, hgModalCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — binWidth of 0', () => {
    const data = JSON.parse(JSON.stringify(hgModalClean));
    data.challenges[0].binWidth = 0;
    const v = histogramOracle.verify(data, hgModalCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'm1')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...hgModalClean, challenges: [hgModalClean.challenges[0]] };
    const v = histogramOracle.verify(data, hgModalCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dot-plot (self-report component; the shipped answer keys drive the tutor/stats)
// ---------------------------------------------------------------------------

const dpStatsCtx = { componentId: 'dot-plot', evalMode: 'compute_stats', topic: 'Median mode range', gradeLevel: 'grade 6' };
const dpFreqCtx = { componentId: 'dot-plot', evalMode: 'read_frequency', topic: 'Reading dot plots', gradeLevel: 'grade 3' };
const dpCmpCtx = { componentId: 'dot-plot', evalMode: 'compare_datasets', topic: 'Comparing datasets', gradeLevel: 'grade 6' };

// A dot-plot session ships ONE challenge over a shared top-level dataset.
const dpStatsClean = {
  title: 'Median', description: 'Find the median.', range: [0, 10], dataPoints: [2, 3, 3, 4, 5, 5, 5, 6], showStatistics: true, editable: false, stackStyle: 'dots',
  challenges: [{ id: 'c1', evalMode: 'compute_stats', instruction: 'What is the median of this data set?', targetStat: 'median', targetAnswer: 4.5 }],
};

const dpFreqClean = {
  title: 'Most Frequent', description: 'Read the plot.', range: [0, 10], dataPoints: [1, 2, 2, 3, 3, 3, 4], showStatistics: false, editable: false, stackStyle: 'dots',
  challenges: [{ id: 'c1', evalMode: 'read_frequency', instruction: 'Which value appears most often?', targetAnswer: 3 }],
};

const dpCmpClean = {
  title: 'Compare', description: 'Compare two plots.', range: [0, 10], dataPoints: [1, 2, 3], secondaryDataPoints: [4, 5, 6], primaryLabel: 'A', secondaryLabel: 'B', parallel: true, showStatistics: true, editable: false, stackStyle: 'dots',
  challenges: [{ id: 'c1', evalMode: 'compare_datasets', instruction: 'Which set has the higher center?', comparisonAnswer: 'Set B has the higher center.' }],
};

describe('dot-plot oracle', () => {
  it('passes clean compute_stats data', () => {
    expect(dotPlotOracle.verify(dpStatsClean, dpStatsCtx).violations).toEqual([]);
  });
  it('passes clean read_frequency data', () => {
    expect(dotPlotOracle.verify(dpFreqClean, dpFreqCtx).violations).toEqual([]);
  });
  it('passes clean compare_datasets data', () => {
    expect(dotPlotOracle.verify(dpCmpClean, dpCmpCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — median key ≠ the dataset median (independence)', () => {
    const data = JSON.parse(JSON.stringify(dpStatsClean));
    data.challenges[0].targetAnswer = 5; // true median is 4.5
    const v = dotPlotOracle.verify(data, dpStatsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });

  it('flags answer-key-desync — a multi-modal dataset makes a single "mode" ambiguous', () => {
    const data = {
      title: 'Mode', description: 'Find the mode.', range: [0, 10], dataPoints: [2, 2, 3, 3, 4], showStatistics: true, editable: false, stackStyle: 'dots',
      challenges: [{ id: 'c1', evalMode: 'compute_stats', instruction: 'What is the mode?', targetStat: 'mode', targetAnswer: 2 }],
    };
    const v = dotPlotOracle.verify(data, dpStatsCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /multi-modal/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — read_frequency answer is not the most frequent value', () => {
    const data = JSON.parse(JSON.stringify(dpFreqClean));
    data.challenges[0].targetAnswer = 2; // freq 2, but 3 (freq 3) is the most frequent
    const v = dotPlotOracle.verify(data, dpFreqCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /most frequent/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — read_frequency most-frequent tie (ambiguous)', () => {
    const data = {
      title: 'F', description: 'Read.', range: [0, 10], dataPoints: [1, 1, 2, 2, 3], showStatistics: false, editable: false, stackStyle: 'dots',
      challenges: [{ id: 'c1', evalMode: 'read_frequency', instruction: 'Which value appears most often?', targetAnswer: 1 }],
    };
    const v = dotPlotOracle.verify(data, dpFreqCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /tie for most frequent/.test(x.detail))).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = dotPlotOracle.verify(dpStatsClean, dpFreqCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags scope — a data point off the plotted axis', () => {
    const data = JSON.parse(JSON.stringify(dpStatsClean));
    data.dataPoints = [2, 3, 3, 4, 5, 5, 5, 15]; // 15 is outside [0, 10]
    const v = dotPlotOracle.verify(data, dpStatsCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'dataPoints')).toBe(true);
  });

  it('flags answer-leak — the instruction states the median answer', () => {
    const data = JSON.parse(JSON.stringify(dpStatsClean));
    data.challenges[0].instruction = 'The median is 4.5 — confirm it.';
    const v = dotPlotOracle.verify(data, dpStatsCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'c1')).toBe(true);
  });

  it('flags schema — compare_datasets with no second dataset', () => {
    const data = JSON.parse(JSON.stringify(dpCmpClean));
    delete data.secondaryDataPoints;
    const v = dotPlotOracle.verify(data, dpCmpCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });

  it('flags clustering — a session with duplicated challenges', () => {
    const data = {
      title: 'x', description: 'y', range: [0, 10], dataPoints: [2, 3, 3, 4, 5, 5, 5, 6], showStatistics: true, editable: false, stackStyle: 'dots',
      challenges: [1, 2, 3].map((i) => ({ id: `c${i}`, evalMode: 'compute_stats', instruction: 'Median?', targetStat: 'median', targetAnswer: 4.5 })),
    };
    const v = dotPlotOracle.verify(data, dpStatsCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// distribution-explorer (MCQ-contract oracle; semantic probability = honest gap)
// ---------------------------------------------------------------------------

const deIdCtx = { componentId: 'distribution-explorer', evalMode: 'identify', topic: 'Distribution families', gradeLevel: 'college' };
const deCompCtx = { componentId: 'distribution-explorer', evalMode: 'compute_basic', topic: 'Probability', gradeLevel: 'college' };
const deShapeCtx = { componentId: 'distribution-explorer', evalMode: 'compute_advanced', topic: 'Distribution shape', gradeLevel: 'college' };

const deBase = { title: 'Distributions', subject: 'Probability', initial: { family: 'poisson', parameters: {} }, lessonContext: 'Explore distributions.' };

const deIdClean = {
  ...deBase, evalMode: 'identify',
  challenges: [
    { id: 'i1', type: 'identify', prompt: 'Counts of rare events per day. Which family fits?', rationale: 'Counts of rare events follow a Poisson.', correctFamily: 'poisson', distractors: ['binomial', 'exponential'] },
    { id: 'i2', type: 'identify', prompt: 'Successes in a fixed number of trials. Which family?', rationale: 'Fixed trials with successes is Binomial.', correctFamily: 'binomial', distractors: ['poisson', 'exponential'] },
  ],
};

const deCompClean = {
  ...deBase, evalMode: 'compute_basic',
  challenges: [
    { id: 'c1', type: 'compute', prompt: 'Find P(no claims tomorrow).', scenario: 'Claims arrive at rate lambda per day.', rationale: 'Use the Poisson PMF at 0.', correctValue: 0.0498, distractors: [0.1494, 0.0025, 0.9502], unit: '', decimals: 4 },
    { id: 'c2', type: 'compute', prompt: 'Find the expected value.', scenario: 'A binomial experiment with several trials.', rationale: 'E[X] = np.', correctValue: 3, distractors: [7, 2.1, 0.35], unit: '', decimals: 2 },
  ],
};

const deShapeClean = {
  ...deBase, evalMode: 'compute_advanced',
  challenges: [
    { id: 's1', type: 'predict_shape', prompt: 'What shape does this waiting-time distribution have?', rationale: 'Exponential is right-skewed.', acceptableAnswers: ['right-skewed', 'skewed right'], distractors: ['symmetric', 'left-skewed', 'uniform'] },
    { id: 's2', type: 'predict_shape', prompt: 'What shape does a fair coin-count distribution take?', rationale: 'A fair binomial is symmetric.', acceptableAnswers: ['symmetric', 'bell-shaped'], distractors: ['right-skewed', 'left-skewed', 'uniform'] },
  ],
};

describe('distribution-explorer oracle', () => {
  it('passes clean identify data', () => {
    expect(distributionExplorerOracle.verify(deIdClean, deIdCtx).violations).toEqual([]);
  });
  it('passes clean compute data', () => {
    expect(distributionExplorerOracle.verify(deCompClean, deCompCtx).violations).toEqual([]);
  });
  it('passes clean predict_shape data', () => {
    expect(distributionExplorerOracle.verify(deShapeClean, deShapeCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — a compute distractor equals the correct value (ambiguous MCQ)', () => {
    const data = JSON.parse(JSON.stringify(deCompClean));
    data.challenges[0].distractors[0] = 0.0498; // equals correctValue
    const v = distributionExplorerOracle.verify(data, deCompCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /two correct options/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — identify correctFamily is also a distractor', () => {
    const data = JSON.parse(JSON.stringify(deIdClean));
    data.challenges[0].distractors = ['poisson', 'exponential']; // correctFamily is poisson
    const v = distributionExplorerOracle.verify(data, deIdCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'i1' && /appears twice/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — a predict_shape distractor matches an acceptable answer', () => {
    const data = JSON.parse(JSON.stringify(deShapeClean));
    data.challenges[0].distractors[0] = 'skewed right'; // matches acceptableAnswers
    const v = distributionExplorerOracle.verify(data, deShapeCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 's1' && /actually correct/.test(x.detail))).toBe(true);
  });

  it('flags scope — content authored for a different evalMode', () => {
    const v = distributionExplorerOracle.verify(deIdClean, deCompCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'evalMode')).toBe(true);
  });

  it('flags answer-leak — the prompt states the compute answer value', () => {
    const data = JSON.parse(JSON.stringify(deCompClean));
    data.challenges[0].prompt = 'Find P(no claims) — it works out to 0.0498.';
    const v = distributionExplorerOracle.verify(data, deCompCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'c1')).toBe(true);
  });

  it('flags answer-leak — the identify prompt names the correct family', () => {
    const data = JSON.parse(JSON.stringify(deIdClean));
    data.challenges[0].prompt = 'This is a poisson process. Which family fits?';
    const v = distributionExplorerOracle.verify(data, deIdCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'i1')).toBe(true);
  });

  it('flags clustering — duplicated challenges', () => {
    const data = {
      ...deBase, evalMode: 'identify',
      challenges: [
        { id: 'i1', type: 'identify', prompt: 'Counts of rare events. Which family?', rationale: 'r', correctFamily: 'poisson', distractors: ['binomial', 'exponential'] },
        { id: 'i2', type: 'identify', prompt: 'Counts of rare events. Which family?', rationale: 'r', correctFamily: 'poisson', distractors: ['binomial', 'exponential'] },
      ],
    };
    const v = distributionExplorerOracle.verify(data, deIdCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — a single-challenge (demo) session', () => {
    const data = { ...deIdClean, challenges: [deIdClean.challenges[0]] };
    const v = distributionExplorerOracle.verify(data, deIdCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('reports guided_exploration as answer-key-free but counted (no graded answer)', () => {
    const data = {
      ...deBase, evalMode: 'explore',
      challenges: [
        { id: 'g1', type: 'guided_exploration', prompt: 'Slide n up — what happens to the peak?', rationale: 'Bigger n shifts the peak right.' },
        { id: 'g2', type: 'guided_exploration', prompt: 'Slide p down — what happens to the spread?', rationale: 'Smaller p skews it right.' },
      ],
    };
    const r = distributionExplorerOracle.verify(data, { ...deIdCtx, evalMode: 'explore' });
    expect(r.violations).toEqual([]);
    expect(r.checkedChallenges).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// function-sketch
// ---------------------------------------------------------------------------

const fsClassCtx = { componentId: 'function-sketch', evalMode: 'classify-shape', topic: 'Function families', gradeLevel: 'algebra 2' };
const fsFeatCtx = { componentId: 'function-sketch', evalMode: 'identify-features', topic: 'Key features', gradeLevel: 'algebra 2' };
const fsCmpCtx = { componentId: 'function-sketch', evalMode: 'compare-functions', topic: 'Comparing functions', gradeLevel: 'algebra 2' };

const PARABOLA = [{ x: -3, y: 9 }, { x: -2, y: 4 }, { x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 9 }];
const LINE = [{ x: -3, y: -3 }, { x: -2, y: -2 }, { x: -1, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
const AXES = { xMin: -5, xMax: 5, yMin: -5, yMax: 25 };

const fsClassClean = {
  title: 'Classify', context: 'Name each function family.',
  challenges: [
    { id: 'c1', type: 'classify-shape', instruction: 'What family is this curve?', ...AXES, xLabel: 'x', yLabel: 'y', classifyCurve: PARABOLA, correctType: 'quadratic', options: ['linear', 'quadratic', 'exponential', 'periodic'] },
    { id: 'c2', type: 'classify-shape', instruction: 'What family is this curve?', ...AXES, xLabel: 'x', yLabel: 'y', classifyCurve: LINE, correctType: 'linear', options: ['linear', 'quadratic', 'exponential', 'periodic'] },
    { id: 'c3', type: 'classify-shape', instruction: 'Name this function family.', ...AXES, xLabel: 'x', yLabel: 'y', classifyCurve: PARABOLA, correctType: 'exponential', options: ['linear', 'quadratic', 'exponential', 'periodic'] },
  ],
};

const fsFeatClean = {
  title: 'Features', context: 'Find the key features.',
  challenges: [
    { id: 'f1', type: 'identify-features', instruction: 'Mark the vertex and y-intercept.', ...AXES, xLabel: 'x', yLabel: 'y', referenceCurve: PARABOLA, features: [{ type: 'minimum', x: 0, y: 0, label: 'Vertex', tolerance: 0.5 }, { type: 'y-intercept', x: 0, y: 0, label: 'Y-int', tolerance: 0.5 }] },
    { id: 'f2', type: 'identify-features', instruction: 'Mark the root of the line.', ...AXES, xLabel: 'x', yLabel: 'y', referenceCurve: LINE, features: [{ type: 'root', x: 0, y: 0, label: 'Root', tolerance: 0.5 }] },
    { id: 'f3', type: 'identify-features', instruction: 'Mark the maximum on the parabola arm.', ...AXES, xLabel: 'x', yLabel: 'y', referenceCurve: PARABOLA, features: [{ type: 'maximum', x: 3, y: 9, label: 'Max', tolerance: 0.5 }] },
  ],
};

const fsCmpClean = {
  title: 'Compare', context: 'Which curve fits?',
  challenges: [
    { id: 'p1', type: 'compare-functions', instruction: 'Which curve grows faster?', ...AXES, xLabel: 'x', yLabel: 'y', curveA: LINE, curveB: PARABOLA, labelA: 'A', labelB: 'B', question: 'Which grows faster?', correctCurve: 'B' },
    { id: 'p2', type: 'compare-functions', instruction: 'Which curve is linear?', ...AXES, xLabel: 'x', yLabel: 'y', curveA: LINE, curveB: PARABOLA, labelA: 'A', labelB: 'B', question: 'Which is linear?', correctCurve: 'A' },
    { id: 'p3', type: 'compare-functions', instruction: 'Which curve has a minimum?', ...AXES, xLabel: 'x', yLabel: 'y', curveA: LINE, curveB: PARABOLA, labelA: 'A', labelB: 'B', question: 'Which has a minimum?', correctCurve: 'B' },
  ],
};

describe('function-sketch oracle', () => {
  it('passes clean classify-shape data', () => {
    expect(functionSketchOracle.verify(fsClassClean, fsClassCtx).violations).toEqual([]);
  });
  it('passes clean identify-features data', () => {
    expect(functionSketchOracle.verify(fsFeatClean, fsFeatCtx).violations).toEqual([]);
  });
  it('passes clean compare-functions data', () => {
    expect(functionSketchOracle.verify(fsCmpClean, fsCmpCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — a feature that does not lie on the reference curve (unreachable)', () => {
    const data = JSON.parse(JSON.stringify(fsFeatClean));
    data.challenges[0].features[0] = { type: 'minimum', x: 4, y: 20, label: 'Vertex', tolerance: 0.5 }; // (4,20) is off the parabola
    const v = functionSketchOracle.verify(data, fsFeatCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'f1' && /does not lie on the reference curve/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — a feature outside the plotted axes (off-canvas)', () => {
    const data = JSON.parse(JSON.stringify(fsFeatClean));
    data.challenges[0].features[0] = { type: 'minimum', x: 99, y: 0, label: 'Vertex', tolerance: 0.5 };
    const v = functionSketchOracle.verify(data, fsFeatCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'f1' && /off-canvas/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — classify correctType not among the options', () => {
    const data = JSON.parse(JSON.stringify(fsClassClean));
    data.challenges[0].correctType = 'logarithmic'; // not in options
    const v = functionSketchOracle.verify(data, fsClassCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /unselectable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — compare correctCurve is neither A nor B', () => {
    const data = JSON.parse(JSON.stringify(fsCmpClean));
    data.challenges[0].correctCurve = 'C';
    const v = functionSketchOracle.verify(data, fsCmpCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'p1')).toBe(true);
  });

  it('flags scope — an eval-mode identity mismatch', () => {
    const v = functionSketchOracle.verify(fsClassClean, fsFeatCtx).violations;
    expect(v.some((x) => x.check === 'scope' && /task identity/.test(x.detail))).toBe(true);
  });

  it('flags answer-leak — the classify instruction names the correct shape', () => {
    const data = JSON.parse(JSON.stringify(fsClassClean));
    data.challenges[0].instruction = 'This is a quadratic — pick its family.';
    const v = functionSketchOracle.verify(data, fsClassCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'c1')).toBe(true);
  });

  it('flags clustering — every classify answer is the same family', () => {
    const data = {
      title: 'x', context: 'y',
      challenges: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, type: 'classify-shape', instruction: `Classify curve ${i}.`, ...AXES, xLabel: 'x', yLabel: 'y', classifyCurve: PARABOLA, correctType: 'quadratic', options: ['linear', 'quadratic', 'exponential', 'periodic'] })),
    };
    const v = functionSketchOracle.verify(data, fsClassCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags schema — sketch-match keyFeature with non-positive weight', () => {
    const data = {
      title: 'x', context: 'y',
      challenges: [
        { id: 's1', type: 'sketch-match', instruction: 'Sketch it.', ...AXES, xLabel: 'x', yLabel: 'y', revealCurve: PARABOLA, keyFeatures: [{ type: 'zero', x: 0, y: 0, tolerance: 0.5, weight: 0, description: 'root' }] },
        { id: 's2', type: 'sketch-match', instruction: 'Sketch another.', ...AXES, xLabel: 'x', yLabel: 'y', revealCurve: LINE, keyFeatures: [{ type: 'zero', x: 0, y: 0, tolerance: 0.5, weight: 1, description: 'root' }] },
        { id: 's3', type: 'sketch-match', instruction: 'Sketch a third.', ...AXES, xLabel: 'x', yLabel: 'y', revealCurve: PARABOLA, keyFeatures: [{ type: 'peak', x: 3, y: 9, tolerance: 0.5, weight: 1, description: 'arm' }] },
      ],
    };
    const v = functionSketchOracle.verify(data, { ...fsFeatCtx, evalMode: 'sketch-match' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 's1' && /weight/.test(x.detail))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...fsClassClean, challenges: [fsClassClean.challenges[0]] };
    const v = functionSketchOracle.verify(data, fsClassCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
