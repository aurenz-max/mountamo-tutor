/**
 * order-cards presentation regression.
 *
 * Field report (2026-08-06, "Order the Numbers Within 20", Grade 1, hard tier):
 * every card pool rendered as the SORTED set rotated left by one — [12,13,14,15,16,11],
 * then [15,16,17,18,20,14]. Cause: the support-tier reshaper rebuilt the pool as
 * `[...set.slice(1), set[0]]`, so five of six cards were already beside their
 * neighbour and the task was solvable from layout. It also read as a rendering bug.
 *
 * Contract asserted here: whatever path produces the pool (LLM, support-tier
 * reshape, fallback), the shipped pool is never sorted, never a rotation of
 * sorted, and no card sits in its answer position.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberSequencer } from './gemini-number-sequencer';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(opts: { targetEvalMode?: string; difficulty?: string } = {}): GenerationContext {
  const topic = 'Order the numbers within 20';
  return {
    componentId: 'number-sequencer',
    instanceId: 'number-sequencer-order-shuffle-test',
    topic,
    gradeLevel: 'elementary',
    gradeContext: 'elementary students (grades 1-5)',
    grade: '1',
    intent: 'Arrange mixed-up numbers in counting order',
    objective: {},
    scope: { topic, intent: 'Arrange mixed-up numbers in counting order' },
    targetEvalMode: opts.targetEvalMode,
    raw: {
      targetEvalMode: opts.targetEvalMode,
      difficulty: opts.difficulty,
      intent: 'Arrange mixed-up numbers in counting order',
    },
  };
}

function generated(challenges: Array<Record<string, unknown>>) {
  return {
    title: 'Order the Numbers Within 20',
    description: 'Practice arranging mixed-up numbers in the correct counting order up to 20.',
    gradeBand: '1',
    showNumberLine: true,
    showDotArrays: false,
    challenges,
  };
}

/** Longest stretch of cards already consecutive AND adjacent, in either direction. */
function longestConsecutiveRun(pool: number[]): number {
  const sorted = [...pool].sort((a, b) => a - b);
  const rank = new Map(sorted.map((v, i) => [v, i] as const));
  let longest = 1;
  let run = 1;
  for (let i = 1; i < pool.length; i++) {
    if (Math.abs((rank.get(pool[i]) ?? -99) - (rank.get(pool[i - 1]) ?? 99)) === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

function cardsInAnswerPosition(pool: number[]): number {
  const sorted = [...pool].sort((a, b) => a - b);
  return pool.filter((v, i) => v === sorted[i]).length;
}

function expectWellShuffled(pool: number[]): void {
  const sorted = [...pool].sort((a, b) => a - b);
  expect(pool.join(',')).not.toBe(sorted.join(','));
  expect(cardsInAnswerPosition(pool)).toBe(0);
  expect(longestConsecutiveRun(pool)).toBeLessThanOrEqual(2);
}

describe('number-sequencer order-cards presentation', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('never ships a rotated pool after a hard-tier reshape (the field regression)', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        // Step-1 sets so the hard tier's 6-card extension stays inside 1-20 and the
        // reshape path (not the fallback) is what we assert on.
        { id: 'o1', type: 'order-cards', instruction: '?', sequence: [13, 11, 16, 12], correctAnswers: [11, 12, 13, 16], rangeMin: 11, rangeMax: 16 },
        { id: 'o2', type: 'order-cards', instruction: '?', sequence: [10, 8, 13, 9], correctAnswers: [8, 9, 10, 13], rangeMin: 8, rangeMax: 13 },
        { id: 'o3', type: 'order-cards', instruction: '?', sequence: [3, 1, 7, 2], correctAnswers: [1, 2, 3, 7], rangeMin: 1, rangeMax: 7 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({
      targetEvalMode: 'order_cards',
      difficulty: 'hard',
    }));

    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    for (const challenge of data.challenges) {
      expect(challenge.type).toBe('order-cards');
      const pool = challenge.sequence.filter((n): n is number => typeof n === 'number');
      // hard tier grows the set to 6 cards — the reshape path that produced the bug.
      expect(pool).toHaveLength(6);
      expectWellShuffled(pool);
      expect([...challenge.correctAnswers]).toEqual([...pool].sort((a, b) => a - b));
    }
  });

  it('re-shuffles an already-sorted pool the model handed back', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        { id: 'o1', type: 'order-cards', instruction: '?', sequence: [3, 4, 5, 6], correctAnswers: [3, 4, 5, 6], rangeMin: 3, rangeMax: 6 },
        { id: 'o2', type: 'order-cards', instruction: '?', sequence: [12, 13, 14, 15, 11], correctAnswers: [11, 12, 13, 14, 15], rangeMin: 11, rangeMax: 15 },
        { id: 'o3', type: 'order-cards', instruction: '?', sequence: [9, 2, 17, 5], correctAnswers: [2, 5, 9, 17], rangeMin: 2, rangeMax: 17 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({ targetEvalMode: 'order_cards' }));

    for (const challenge of data.challenges) {
      const pool = challenge.sequence.filter((n): n is number => typeof n === 'number');
      expectWellShuffled(pool);
      expect([...challenge.correctAnswers]).toEqual([...pool].sort((a, b) => a - b));
    }
    // The pool the model already shuffled acceptably is left alone.
    const o3 = data.challenges.find((c) => c.id === 'o3');
    expect(o3?.sequence).toEqual([9, 2, 17, 5]);
  });

  it('shuffles the deterministic fallback pool too', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
    } as never).mockResolvedValueOnce({
      // Every challenge is out of scope, forcing the fallback builder.
      text: JSON.stringify(generated([
        { id: 'o1', type: 'order-cards', instruction: '?', sequence: [88, 91, 90], correctAnswers: [88, 90, 91], rangeMin: 88, rangeMax: 91 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({ targetEvalMode: 'order_cards' }));

    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    for (const challenge of data.challenges) {
      const pool = challenge.sequence.filter((n): n is number => typeof n === 'number');
      expectWellShuffled(pool);
    }
  });

  it('is deterministic — the same card set always presents the same way', async () => {
    const run = async () => {
      generateContent.mockReset();
      generateContent.mockResolvedValueOnce({
        text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
      } as never).mockResolvedValueOnce({
        text: JSON.stringify(generated([
          { id: 'o1', type: 'order-cards', instruction: '?', sequence: [11, 12, 13, 14, 15, 16], correctAnswers: [11, 12, 13, 14, 15, 16], rangeMin: 11, rangeMax: 16 },
          { id: 'o2', type: 'order-cards', instruction: '?', sequence: [14, 15, 16, 17, 18, 20], correctAnswers: [14, 15, 16, 17, 18, 20], rangeMin: 14, rangeMax: 20 },
          { id: 'o3', type: 'order-cards', instruction: '?', sequence: [1, 2, 3, 4, 5, 6], correctAnswers: [1, 2, 3, 4, 5, 6], rangeMin: 1, rangeMax: 6 },
        ])),
      } as never);
      const data = await generateNumberSequencer(contextFor({ targetEvalMode: 'order_cards' }));
      return data.challenges.map((c) => c.sequence.join(','));
    };

    const first = await run();
    const second = await run();
    expect(first).toEqual(second);
    // Distinct card sets must not collapse onto the same visual arrangement pattern.
    expect(new Set(first).size).toBe(first.length);
  });
});
