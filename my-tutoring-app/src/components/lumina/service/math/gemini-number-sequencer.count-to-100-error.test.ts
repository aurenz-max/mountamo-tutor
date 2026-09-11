import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberSequencer } from './gemini-number-sequencer';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(mode: 'count_from' | 'spot_error'): GenerationContext {
  const objectiveText = 'Count forward from any given number up to 100 and identify sequence errors';
  return {
    componentId: 'number-sequencer',
    instanceId: `number-sequencer-${mode}-test`,
    topic: 'Count to 100 and spot sequence errors',
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent: mode === 'count_from'
      ? 'Count forward from any given number up to 100'
      : 'Identify the one wrong number in a counting sequence',
    objective: { text: objectiveText },
    scope: { topic: 'Count to 100 and spot sequence errors' },
    targetEvalMode: mode,
    raw: { targetEvalMode: mode, objectiveText, challengeCount: 5 },
  } as GenerationContext;
}

function generated(challenges: Array<Record<string, unknown>>) {
  return {
    title: 'Count and Check',
    description: 'Count carefully.',
    gradeBand: 'K',
    showNumberLine: true,
    showDotArrays: false,
    challenges,
  };
}

describe('number-sequencer COUNT001-01-G extension', () => {
  beforeEach(() => generateContent.mockReset());

  it('widens an explicitly named K objective to 100 and guarantees a count-from start above 20', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify(generated([2, 5, 8, 11, 14].map((start, index) => ({
        id: `c${index}`,
        type: 'count-from',
        instruction: `Count forward from ${start}.`,
        sequence: [start],
        correctAnswers: [start + 1, start + 2, start + 3],
        startNumber: start,
        direction: 'forward',
        rangeMin: start,
        rangeMax: start + 3,
      })))),
    } as never);

    const data = await generateNumberSequencer(contextFor('count_from'));

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(data.gradeBand).toBe('K');
    expect(data.challenges.some((challenge) =>
      challenge.type === 'count-from' && (challenge.startNumber ?? 0) > 20,
    )).toBe(true);
    expect(data.challenges.flatMap((challenge) => [
      ...challenge.sequence.filter((value): value is number => typeof value === 'number'),
      ...challenge.correctAnswers,
    ]).every((value) => value >= 1 && value <= 100)).toBe(true);
    const prompt = String((generateContent.mock.calls[0][0] as { contents: string }).contents);
    expect(prompt).toContain('RESOLVED NUMERIC WINDOW');
    expect(prompt).toContain('1 through 100');
  });

  it('code chooses one unmarked wrong index whose keyed repair uniquely restores the count', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify(generated([3, 13, 23, 33, 43].map((start, index) => ({
        id: `e${index}`,
        type: 'spot-error',
        instruction: 'Which number is wrong?',
        sequence: [start, start + 1, start + 2, start + 3, start + 4],
        correctAnswers: [],
        rangeMin: start,
        rangeMax: start + 4,
      })))),
    } as never);

    const data = await generateNumberSequencer(contextFor('spot_error'));
    const request = generateContent.mock.calls[0][0] as unknown as {
      config: { responseSchema: { properties: { challenges: { items: { properties: { type: { enum: string[] } } } } } } };
    };

    expect(request.config.responseSchema.properties.challenges.items.properties.type.enum)
      .toEqual(['spot-error']);
    expect(data.challenges).toHaveLength(5);
    expect(new Set(data.challenges.map((challenge) => challenge.wrongIndex)).size)
      .toBeGreaterThanOrEqual(3);

    for (const challenge of data.challenges) {
      expect(challenge.type).toBe('spot-error');
      expect(challenge.instruction).toBe('Which number is wrong? Tap it.');
      expect(challenge.wrongIndex).toBeGreaterThan(0);
      expect(challenge.wrongIndex).toBeLessThan(challenge.sequence.length - 1);
      expect(challenge.correctAnswers).toHaveLength(1);

      const repaired = [...challenge.sequence] as number[];
      repaired[challenge.wrongIndex!] = challenge.correctAnswers[0];
      expect(repaired.every((value, index) => index === 0 || value === repaired[index - 1] + 1)).toBe(true);
      const mismatches = challenge.sequence.filter((value, index) => value !== repaired[index]);
      expect(mismatches).toHaveLength(1);
      expect(repaired).not.toContain(challenge.sequence[challenge.wrongIndex!]);
    }
  });

  it('routes the unpinned combined objective to a count-from plus spot-error blend', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ modes: ['count_from', 'spot_error'] }) } as never)
      .mockResolvedValueOnce({
        text: JSON.stringify(generated([
          { id: 'c1', type: 'count-from', instruction: 'Keep counting.', sequence: [40], correctAnswers: [41, 42, 43], startNumber: 40, direction: 'forward', rangeMin: 40, rangeMax: 43 },
          { id: 'c2', type: 'count-from', instruction: 'Keep counting.', sequence: [70], correctAnswers: [71, 72, 73], startNumber: 70, direction: 'forward', rangeMin: 70, rangeMax: 73 },
          { id: 'e1', type: 'spot-error', instruction: 'Which number is wrong?', sequence: [20, 21, 22, 23, 24], correctAnswers: [], rangeMin: 20, rangeMax: 24 },
          { id: 'e2', type: 'spot-error', instruction: 'Which number is wrong?', sequence: [80, 81, 82, 83, 84], correctAnswers: [], rangeMin: 80, rangeMax: 84 },
        ])),
      } as never);

    const pinned = contextFor('count_from');
    const objectiveText = pinned.objective.text;
    const data = await generateNumberSequencer({
      ...pinned,
      targetEvalMode: undefined,
      intent: 'Count forward from any number to 100 and identify sequence errors',
      raw: { objectiveText, challengeCount: 4 },
    } as GenerationContext);

    const request = generateContent.mock.calls[1][0] as unknown as {
      config: { responseSchema: { properties: { challenges: { items: { properties: { type: { enum: string[] } } } } } } };
    };
    expect(request.config.responseSchema.properties.challenges.items.properties.type.enum)
      .toEqual(['count-from', 'spot-error']);
    expect(new Set(data.challenges.map((challenge) => challenge.type)))
      .toEqual(new Set(['count-from', 'spot-error']));
  });
});
