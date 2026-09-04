import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent } },
}));

import { generateDiDiceRoll } from './gemini-di-dice-roll';

const safeChrome = {
  title: 'Lucky Roll',
  description: 'Roll the dice, study the dots, and answer aloud!',
};

beforeEach(() => {
  generateContent.mockReset();
  generateContent.mockResolvedValue({ text: JSON.stringify(safeChrome) });
});

describe('generateDiDiceRoll', () => {
  it('builds the count-pips DI contract from code-owned values', async () => {
    const data = await generateDiDiceRoll('subitizing', 'kindergarten', {
      targetEvalMode: 'count_pips',
      values: [1, 2, 3, 4, 5],
    });

    expect(data.challengeType).toBe('count_pips');
    expect(data.challenges).toHaveLength(5);
    expect(data.challenges[0]).toEqual({
      id: 'didr-1',
      challengeType: 'count_pips',
      action: 'count_pips',
      answerKind: 'voice',
      responseClass: 'number_word_to_20',
      sides: 6,
      value: 1,
      spokenAnswer: 'one',
      asrAliases: ['one', '1'],
    });
    expect(data.challenges.map((challenge) => challenge.id)).toEqual([
      'didr-1', 'didr-2', 'didr-3', 'didr-4', 'didr-5',
    ]);
  });

  it('makes a pinned count run varied, reproducible, and range-safe', async () => {
    const config = { targetEvalMode: 'count_pips', seed: 27 };
    const first = await generateDiDiceRoll('dice dots', 'kindergarten', config);
    const second = await generateDiDiceRoll('dice dots', 'kindergarten', config);
    const values = first.challenges.map((challenge) => challenge.value);

    expect(values).toEqual(second.challenges.map((challenge) => challenge.value));
    expect(new Set(values).size).toBe(5);
    expect(values.some((value) => value <= 3)).toBe(true);
    expect(values.some((value) => value >= 4)).toBe(true);
  });

  it('stamps every challenge and reshapes sum composition without changing totals', async () => {
    const base = {
      targetEvalMode: 'sum_two_dice',
      challengeCount: 4,
      pairs: [[5, 1], [4, 3], [6, 4], [6, 6]],
    };
    const [easy, medium, hard] = await Promise.all([
      generateDiDiceRoll('add dice', 'first grade', { ...base, difficulty: 'easy' }),
      generateDiDiceRoll('add dice', 'first grade', { ...base, difficulty: 'medium' }),
      generateDiDiceRoll('add dice', 'first grade', { ...base, difficulty: 'hard' }),
    ]);

    const totals = (data: typeof easy) => data.challenges.map((challenge) =>
      challenge.challengeType === 'sum_two_dice' ? challenge.total : null);
    const rightSteps = (data: typeof easy) => data.challenges.map((challenge) =>
      challenge.challengeType === 'sum_two_dice' ? challenge.secondValue : null);

    expect(totals(easy)).toEqual([6, 7, 10, 12]);
    expect(totals(medium)).toEqual(totals(easy));
    expect(totals(hard)).toEqual(totals(easy));
    expect(rightSteps(easy)).toEqual([1, 1, 4, 6]);
    expect(rightSteps(medium)).toEqual([3, 3, 5, 6]);
    expect(rightSteps(hard)).toEqual([5, 6, 6, 6]);
    expect(easy.challenges.every((challenge) => challenge.supportTier === 'easy')).toBe(true);
    expect(medium.challenges.every((challenge) => challenge.supportTier === 'medium')).toBe(true);
    expect(hard.challenges.every((challenge) => challenge.supportTier === 'hard')).toBe(true);
  });

  it('uses exact comparison gaps by tier while preserving left, right, and same', async () => {
    const base = {
      targetEvalMode: 'compare_dice',
      challengeCount: 3,
      pairs: [[6, 1], [2, 5], [4, 4]],
    };
    const [easy, medium, hard] = await Promise.all([
      generateDiDiceRoll('compare dice', 'kindergarten', { ...base, difficulty: 'easy' }),
      generateDiDiceRoll('compare dice', 'kindergarten', { ...base, difficulty: 'medium' }),
      generateDiDiceRoll('compare dice', 'kindergarten', { ...base, difficulty: 'hard' }),
    ]);

    const relationsAndGaps = (data: typeof easy) => data.challenges.map((challenge) => {
      if (challenge.challengeType !== 'compare_dice') throw new Error('unexpected challenge');
      return [challenge.comparison, Math.abs(challenge.value - challenge.secondValue)] as const;
    });

    expect(relationsAndGaps(easy)).toEqual([['left', 3], ['right', 3], ['same', 0]]);
    expect(relationsAndGaps(medium)).toEqual([['left', 2], ['right', 2], ['same', 0]]);
    expect(relationsAndGaps(hard)).toEqual([['left', 1], ['right', 1], ['same', 0]]);
  });

  it('keeps count-pips values structurally unchanged at every tier', async () => {
    const base = {
      targetEvalMode: 'count_pips',
      values: [6, 2, 5, 1, 4],
    };
    const [easy, medium, hard] = await Promise.all([
      generateDiDiceRoll('dice dots', 'kindergarten', { ...base, difficulty: 'easy' }),
      generateDiDiceRoll('dice dots', 'kindergarten', { ...base, difficulty: 'medium' }),
      generateDiDiceRoll('dice dots', 'kindergarten', { ...base, difficulty: 'hard' }),
    ]);

    for (const data of [easy, medium, hard]) {
      expect(data.challenges.map((challenge) => challenge.value)).toEqual(base.values);
    }
  });

  it('applies support tiers to mixed runs and ignores unknown difficulty values', async () => {
    const mixed = await generateDiDiceRoll('dice practice', 'first grade', {
      targetEvalMode: 'mixed',
      challengeCount: 6,
      difficulty: 'medium',
      seed: 17,
    });
    const unknown = await generateDiDiceRoll('dice practice', 'first grade', {
      targetEvalMode: 'count_pips',
      difficulty: 'extra-hard',
      seed: 17,
    });

    expect(new Set(mixed.challenges.map((challenge) => challenge.challengeType))).toEqual(
      new Set(['count_pips', 'compare_dice', 'sum_two_dice']),
    );
    expect(mixed.challenges.every((challenge) => challenge.supportTier === 'medium')).toBe(true);
    expect(unknown.challenges.every((challenge) => challenge.supportTier === undefined)).toBe(true);
  });

  it('derives left, right, and same comparison answers from finalized pairs', async () => {
    const data = await generateDiDiceRoll('compare dice', 'kindergarten', {
      targetEvalMode: 'compare_dice',
      challengeCount: 5,
      seed: 41,
    });

    expect(data.challenges.every((challenge) => challenge.challengeType === 'compare_dice')).toBe(true);
    const comparisons = data.challenges.map((challenge) => {
      if (challenge.challengeType !== 'compare_dice') throw new Error('unexpected challenge');
      const derived = challenge.value === challenge.secondValue
        ? 'same'
        : challenge.value > challenge.secondValue ? 'left' : 'right';
      expect(challenge.comparison).toBe(derived);
      expect(challenge.spokenAnswer).toBe(derived);
      expect(challenge.asrAliases).toContain(derived);
      return derived;
    });
    expect(new Set(comparisons)).toEqual(new Set(['left', 'right', 'same']));
  });

  it('derives unique low/high totals and number-word answers for addition', async () => {
    const data = await generateDiDiceRoll('add two dice', 'first grade', {
      targetEvalMode: 'sum_two_dice',
      challengeCount: 6,
      seed: 91,
    });
    const totals = data.challenges.map((challenge) => {
      if (challenge.challengeType !== 'sum_two_dice') throw new Error('unexpected challenge');
      expect(challenge.total).toBe(challenge.value + challenge.secondValue);
      expect(challenge.asrAliases).toEqual([challenge.spokenAnswer, String(challenge.total)]);
      return challenge.total;
    });

    expect(new Set(totals).size).toBe(6);
    expect(totals.some((total) => total <= 6)).toBe(true);
    expect(totals.some((total) => total >= 7)).toBe(true);
  });

  it('preserves complete controlled values and pairs for pinned QA runs', async () => {
    const counted = await generateDiDiceRoll('dice dots', 'kindergarten', {
      targetEvalMode: 'count_pips',
      challengeCount: 4,
      values: [6, 2, 5, 1],
    });
    const compared = await generateDiDiceRoll('compare dice', 'kindergarten', {
      targetEvalMode: 'compare_dice',
      challengeCount: 3,
      pairs: [[6, 1], [2, 5], [4, 4]],
    });

    expect(counted.challenges.map((challenge) => challenge.value)).toEqual([6, 2, 5, 1]);
    expect(compared.challenges.map((challenge) => [
      challenge.value,
      challenge.challengeType === 'compare_dice' ? challenge.secondValue : null,
    ])).toEqual([[6, 1], [2, 5], [4, 4]]);
  });

  it('keeps the no-tier controlled path byte-equivalent to its pre-L4 contract', async () => {
    const data = await generateDiDiceRoll('add dice', 'first grade', {
      targetEvalMode: 'sum_two_dice',
      challengeCount: 3,
      pairs: [[1, 5], [4, 2], [6, 6]],
    });

    expect(data.challenges).toEqual([
      {
        id: 'didr-1', challengeType: 'sum_two_dice', action: 'sum_two_dice',
        answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6,
        value: 1, secondValue: 5, total: 6, spokenAnswer: 'six', asrAliases: ['six', '6'],
      },
      {
        id: 'didr-2', challengeType: 'sum_two_dice', action: 'sum_two_dice',
        answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6,
        value: 4, secondValue: 2, total: 6, spokenAnswer: 'six', asrAliases: ['six', '6'],
      },
      {
        id: 'didr-3', challengeType: 'sum_two_dice', action: 'sum_two_dice',
        answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6,
        value: 6, secondValue: 6, total: 12, spokenAnswer: 'twelve', asrAliases: ['twelve', '12'],
      },
    ]);
  });

  it('stress-checks thousands of tiered shapes for exact gaps, stable totals, and band safety', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      for (let seed = 0; seed < 200; seed += 1) {
        const compareRuns = await Promise.all((['easy', 'medium', 'hard'] as const).map((difficulty) =>
          generateDiDiceRoll('compare dice', 'kindergarten', {
            targetEvalMode: 'compare_dice', difficulty, challengeCount: 6, seed,
          })));
        const sumRuns = await Promise.all((['easy', 'medium', 'hard'] as const).map((difficulty) =>
          generateDiDiceRoll('add dice', 'first grade', {
            targetEvalMode: 'sum_two_dice', difficulty, challengeCount: 6, seed,
          })));

        compareRuns.forEach((data, tierIndex) => {
          const targetGap = [3, 2, 1][tierIndex];
          const pairKeys = new Set<string>();
          for (const challenge of data.challenges) {
            if (challenge.challengeType !== 'compare_dice') throw new Error('unexpected challenge');
            expect(challenge.value).toBeGreaterThanOrEqual(1);
            expect(challenge.secondValue).toBeLessThanOrEqual(6);
            const gap = Math.abs(challenge.value - challenge.secondValue);
            expect(gap === 0 || gap === targetGap).toBe(true);
            expect(challenge.comparison).toBe(
              challenge.value === challenge.secondValue
                ? 'same'
                : challenge.value > challenge.secondValue ? 'left' : 'right',
            );
            pairKeys.add(`${challenge.value}:${challenge.secondValue}`);
          }
          expect(pairKeys.size).toBe(data.challenges.length);
        });

        const totalsByTier = sumRuns.map((data) => data.challenges.map((challenge) => {
          if (challenge.challengeType !== 'sum_two_dice') throw new Error('unexpected challenge');
          expect(challenge.value).toBeGreaterThanOrEqual(1);
          expect(challenge.value).toBeLessThanOrEqual(6);
          expect(challenge.secondValue).toBeGreaterThanOrEqual(1);
          expect(challenge.secondValue).toBeLessThanOrEqual(6);
          expect(challenge.total).toBe(challenge.value + challenge.secondValue);
          return challenge.total;
        }));
        expect(totalsByTier[1]).toEqual(totalsByTier[0]);
        expect(totalsByTier[2]).toEqual(totalsByTier[0]);
        for (let index = 0; index < sumRuns[0].challenges.length; index += 1) {
          const steps = sumRuns.map((data) => {
            const challenge = data.challenges[index];
            if (challenge.challengeType !== 'sum_two_dice') throw new Error('unexpected challenge');
            return challenge.secondValue;
          });
          expect(steps[0]).toBeLessThanOrEqual(steps[1]);
          expect(steps[1]).toBeLessThanOrEqual(steps[2]);
        }
      }
    } finally {
      log.mockRestore();
    }
  });

  it('rejects malformed controls and falls back to valid local pools', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const counted = await generateDiDiceRoll('dice dots', 'kindergarten', {
      targetEvalMode: 'count_pips',
      values: [1, 0, 2.5, 7, Number.NaN],
      seed: 44,
    });
    const summed = await generateDiDiceRoll('add dice', 'first grade', {
      targetEvalMode: 'sum_two_dice',
      pairs: [[1, 2], [0, 4], [3, 8]],
      seed: 44,
    });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(counted.challenges.every((challenge) => challenge.value >= 1 && challenge.value <= 6)).toBe(true);
    expect(summed.challenges.every((challenge) =>
      challenge.challengeType === 'sum_two_dice'
      && challenge.secondValue >= 1
      && challenge.secondValue <= 6)).toBe(true);
    warn.mockRestore();
  });

  it('a curated blend includes exactly the selected identities', async () => {
    const data = await generateDiDiceRoll('count and add dice', 'first grade', {
      targetEvalMode: 'count_pips|sum_two_dice',
      challengeCount: 6,
      seed: 7,
    });

    expect(new Set(data.challenges.map((challenge) => challenge.challengeType))).toEqual(
      new Set(['count_pips', 'sum_two_dice']),
    );
  });

  it('mixed and unknown pins spread across all three identities', async () => {
    for (const targetEvalMode of ['mixed', 'not-a-mode']) {
      const data = await generateDiDiceRoll('dice practice', 'first grade', {
        targetEvalMode,
        challengeCount: 6,
        seed: 7,
      });
      expect(new Set(data.challenges.map((challenge) => challenge.challengeType))).toEqual(
        new Set(['count_pips', 'compare_dice', 'sum_two_dice']),
      );
    }
  });

  it('uses intent resolution when no mode is pinned', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ modes: ['compare_dice'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify(safeChrome) });

    const data = await generateDiDiceRoll('dice quantities', 'kindergarten', {
      intent: 'Compare two dice and say which side has more dots.',
      challengeCount: 4,
      seed: 5,
    });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(data.challenges.every((challenge) => challenge.challengeType === 'compare_dice')).toBe(true);
  });

  it('replaces generated chrome that leaks any possible numeric answer', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Find Five',
        description: 'Add 5 dots out loud!',
      }),
    });

    const data = await generateDiDiceRoll('dice dots', 'kindergarten', {
      targetEvalMode: 'count_pips',
      seed: 1,
    });

    expect(data.title).toBe('Dice Time');
    expect(data.description).toBe('Roll, look at the dots, and answer out loud!');
  });
});
