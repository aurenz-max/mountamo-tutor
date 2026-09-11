import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent } },
}));

import { generateWordWorkout } from './gemini-word-workout';
import { itemsFromChallenges } from '../../primitives/visual-primitives/literacy/wordWorkoutScript';

const contextFor = (
  targetEvalMode: string | undefined,
  objectiveText: string,
): GenerationContext => ({
  topic: objectiveText,
  gradeContext: 'Kindergarten',
  gradeLevel: 'K',
  grade: 'K',
  intent: objectiveText,
  objective: { id: 'test-objective', text: objectiveText },
  ...(targetEvalMode ? { targetEvalMode } : {}),
  scope: {
    topic: objectiveText,
    intent: objectiveText,
    objectiveText,
  },
  raw: { challengeCount: 2 },
} as unknown as GenerationContext);

beforeEach(() => generateContent.mockReset());

describe('WordWorkout extended decoding generation', () => {
  it('resolves a read-and-comprehend objective to an inflected + compound blend', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ modes: ['read_inflected', 'read_compound'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ challenges: [
        { id: 'i1', targetWord: 'cats' }, { id: 'i2', targetWord: 'jumped' },
      ] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ challenges: [
        { id: 'c1', targetWord: 'sunset' }, { id: 'c2', targetWord: 'catnap' },
      ] }) });

    const data = await generateWordWorkout(contextFor(
      undefined,
      'Read and comprehend words with common endings and compound words',
    ));

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(new Set(data.challenges.map((challenge) => challenge.mode))).toEqual(
      new Set(['inflected-word', 'compound-word']),
    );
    expect(data.challenges.every((challenge) => challenge.includeMeaning)).toBe(true);
    expect(itemsFromChallenges(data.challenges).map((item) => item.kind)).toEqual([
      'read_extended_word', 'read_extended_word', 'read_extended_word', 'read_extended_word',
      'answer_word_meaning', 'answer_word_meaning', 'answer_word_meaning', 'answer_word_meaning',
    ]);
  });

  it('pins inflected words to the code-owned enum and adds a separate meaning turn for comprehension', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ challenges: [
        { id: 'c1', targetWord: 'cats' },
        { id: 'c2', targetWord: 'jumped' },
      ] }),
    });

    const data = await generateWordWorkout(contextFor(
      'read_inflected',
      'Read and comprehend words with common endings -s, -ing, and -ed',
    ));

    expect(data.mode).toBe('inflected-word');
    expect(data.challenges).toEqual([
      { id: 'c1', mode: 'inflected-word', targetWord: 'cats', includeMeaning: true },
      { id: 'c2', mode: 'inflected-word', targetWord: 'jumped', includeMeaning: true },
    ]);
    expect(itemsFromChallenges(data.challenges).map((item) => item.kind)).toEqual([
      'read_extended_word', 'read_extended_word',
      'answer_word_meaning', 'answer_word_meaning',
    ]);

    const call = generateContent.mock.calls[0][0] as {
      config: { responseSchema: { properties: { challenges: { items: { properties: { targetWord: { enum: string[] } } } } } } };
    };
    expect(call.config.responseSchema.properties.challenges.items.properties.targetWord.enum)
      .toEqual(expect.arrayContaining(['cats', 'mixing', 'jumped']));
    expect(call.config.responseSchema.properties.challenges.items.properties.targetWord.enum)
      .not.toContain('unhappily');
  });

  it('drops an invented compound and falls back to scoped familiar compounds', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ challenges: [{ id: 'c1', targetWord: 'moonlight' }] }),
    });

    const data = await generateWordWorkout(contextFor(
      'read_compound',
      'Read familiar compound words',
    ));

    expect(data.challenges.length).toBeGreaterThanOrEqual(2);
    expect(data.challenges.every((challenge) => challenge.mode === 'compound-word')).toBe(true);
    expect(data.challenges.some((challenge) => challenge.targetWord === 'moonlight')).toBe(false);
    expect(data.challenges.every((challenge) => challenge.includeMeaning === undefined)).toBe(true);
  });

  it('keeps near-word decoding and context choice as three independently judged items', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ challenges: [{ id: 'c1', contextTrialId: 'hen-pen' }] }),
    });

    const data = await generateWordWorkout(contextFor(
      'choose_in_context',
      'Distinguish similarly spelled words in context',
    ));
    const items = itemsFromChallenges(data.challenges);

    expect(data.mode).toBe('context-discrimination');
    expect(items.map((item) => item.kind)).toEqual([
      'read_context_word', 'read_context_word', 'choose_context_word',
    ]);
    expect(items[2]).toMatchObject({
      contextSentence: 'The ___ laid an egg.',
      contextWords: ['hen', 'pen'],
      answerWord: 'hen',
    });
  });
});
