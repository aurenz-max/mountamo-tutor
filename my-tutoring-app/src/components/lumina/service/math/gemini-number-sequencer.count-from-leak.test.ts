/**
 * count-from instruction answer leak (P0, 2026-09-08).
 *
 * The easy support tier told Gemini to "model the first step" with the example
 * "Start at 3, then say 4, 5, 6…", so the shipped instruction enumerated the whole
 * continuation — the student read the answer key instead of counting. The prompt now
 * models ONE step, and this asserts the post-parse guard that catches it regardless
 * of what the model writes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberSequencer } from './gemini-number-sequencer';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(difficulty?: string): GenerationContext {
  const topic = 'Count forward from any number within 20';
  const intent = 'Keep counting forward from a given number';
  return {
    componentId: 'number-sequencer',
    instanceId: 'number-sequencer-count-from-leak-test',
    topic,
    gradeLevel: 'elementary',
    gradeContext: 'elementary students (grades 1-5)',
    grade: '1',
    intent,
    objective: {},
    scope: { topic, intent },
    targetEvalMode: 'count_from',
    raw: { targetEvalMode: 'count_from', difficulty, intent },
  };
}

function mockGeneration(challenges: Array<Record<string, unknown>>) {
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
  } as never).mockResolvedValueOnce({
    text: JSON.stringify({
      title: 'Keep Counting!',
      description: 'Practice continuing the count from any starting number within 20.',
      gradeBand: '1',
      showNumberLine: true,
      showDotArrays: false,
      challenges,
    }),
  } as never);
}

/** Every integer the instruction states in the clear, digits or number words. */
function statedIn(instruction: string): Set<number> {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  };
  const stated = new Set<number>();
  const digits = /\d+/g;
  let digitMatch: RegExpExecArray | null;
  while ((digitMatch = digits.exec(instruction)) !== null) stated.add(Number(digitMatch[0]));
  const lower = instruction.toLowerCase();
  const wordRe = /[a-z]+/g;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRe.exec(lower)) !== null) {
    if (words[wordMatch[0]] !== undefined) stated.add(words[wordMatch[0]]);
  }
  return stated;
}

describe('number-sequencer count-from instruction leak', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('rejects an easy-tier instruction that spells out the whole continuation', async () => {
    mockGeneration([
      // The exact shape the leaking prompt produced.
      { id: 'c1', type: 'count-from', instruction: 'Start at 3, then say 4, 5, 6!', sequence: [3], correctAnswers: [4, 5, 6], rangeMin: 3, rangeMax: 6, startNumber: 3, direction: 'forward' },
      { id: 'c2', type: 'count-from', instruction: 'Start at 8. The next number is 9. Keep counting.', sequence: [8], correctAnswers: [9, 10, 11], rangeMin: 8, rangeMax: 11, startNumber: 8, direction: 'forward' },
      { id: 'c3', type: 'count-from', instruction: 'Start at 12. The next number is 13. Keep counting.', sequence: [12], correctAnswers: [13, 14, 15], rangeMin: 12, rangeMax: 15, startNumber: 12, direction: 'forward' },
    ]);

    const data = await generateNumberSequencer(contextFor('easy'));

    expect(data.challenges.map((c) => c.id)).not.toContain('c1');
    // The one-step models survive: scaffolding is not a leak.
    expect(data.challenges.map((c) => c.id)).toEqual(expect.arrayContaining(['c2', 'c3']));
  });

  it('catches a continuation spelled out in number words', async () => {
    mockGeneration([
      { id: 'w1', type: 'count-from', instruction: 'Start at three, then say four, five, six.', sequence: [3], correctAnswers: [4, 5, 6], rangeMin: 3, rangeMax: 6, startNumber: 3, direction: 'forward' },
      { id: 'w2', type: 'count-from', instruction: 'Start at 8. The next number is 9. Keep counting.', sequence: [8], correctAnswers: [9, 10, 11], rangeMin: 8, rangeMax: 11, startNumber: 8, direction: 'forward' },
      { id: 'w3', type: 'count-from', instruction: 'Start at 12. The next number is 13. Keep counting.', sequence: [12], correctAnswers: [13, 14, 15], rangeMin: 12, rangeMax: 15, startNumber: 12, direction: 'forward' },
    ]);

    const data = await generateNumberSequencer(contextFor('easy'));

    expect(data.challenges.map((c) => c.id)).not.toContain('w1');
  });

  it('leaves the student something to produce on every shipped challenge', async () => {
    mockGeneration([
      { id: 'a1', type: 'count-from', instruction: 'Start at 5, then say 6, 7, 8, 9!', sequence: [5], correctAnswers: [6, 7, 8, 9], rangeMin: 5, rangeMax: 9, startNumber: 5, direction: 'forward' },
      { id: 'a2', type: 'count-from', instruction: 'Count on from 11: 12, 13, 14, 15.', sequence: [11], correctAnswers: [12, 13, 14, 15], rangeMin: 11, rangeMax: 15, startNumber: 11, direction: 'forward' },
    ]);

    const data = await generateNumberSequencer(contextFor('medium'));

    // Both leaked, so the deterministic backfill supplies the mastery floor —
    // and the backfill states the start value only.
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    for (const challenge of data.challenges) {
      if (challenge.type !== 'count-from') continue;
      const stated = statedIn(challenge.instruction);
      expect(challenge.correctAnswers.every((a) => stated.has(a))).toBe(false);
    }
  });
});
