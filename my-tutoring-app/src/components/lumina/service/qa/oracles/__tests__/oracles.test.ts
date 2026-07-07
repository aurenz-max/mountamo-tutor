import { describe, expect, it } from 'vitest';
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
