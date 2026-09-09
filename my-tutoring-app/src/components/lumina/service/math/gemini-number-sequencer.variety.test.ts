/**
 * fill_missing session variety (NS-4, K atlas 2026-09-07).
 *
 * K COUNT001-01-H put the blank in the SECOND slot on 10/10 items and served
 * "1, _, 3, 4" two or three times in one session. Both halves were free choices
 * nobody owned: flash-lite converges on the slot right after the anchor and on the
 * window itself, and no code rejected the repeat. Code now chooses the slot and
 * rejects a window that is already in the session.
 *
 * These assert PROPERTIES, not fixed values — the placement is a real draw, so a
 * test pinning an index would only pin the seed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberSequencer } from './gemini-number-sequencer';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(mode = 'fill_missing', difficulty?: string): GenerationContext {
  const topic = 'Find the missing number when counting to 20';
  const intent = 'Fill the missing number in a short forward count';
  return {
    componentId: 'number-sequencer',
    instanceId: 'number-sequencer-variety-test',
    topic,
    gradeLevel: 'elementary',
    gradeContext: 'elementary students (grades 1-5)',
    grade: '1',
    intent,
    objective: {},
    scope: { topic, intent },
    targetEvalMode: mode,
    raw: { targetEvalMode: mode, difficulty, intent, challengeCount: 5 },
  } as GenerationContext;
}

function mockGeneration(challenges: Array<Record<string, unknown>>) {
  generateContent.mockReset();
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
  } as never).mockResolvedValueOnce({
    text: JSON.stringify({
      title: 'Missing Numbers',
      description: 'Find the number that is hiding.',
      gradeBand: '1',
      showNumberLine: true,
      showDotArrays: false,
      challenges,
    }),
  } as never);
}

/** The model's habit: four in a row, blank in slot 1, one window per draw. */
function fillMissing(id: string, start: number) {
  return {
    id,
    type: 'fill-missing',
    instruction: 'What number is missing?',
    sequence: [start, null, start + 2, start + 3],
    correctAnswers: [start + 1],
    rangeMin: start,
    rangeMax: start + 3,
  };
}

function blankIndex(challenge: { sequence: (number | null)[] }): number {
  return challenge.sequence.findIndex((value) => value === null);
}

/** The complete window a null-fill challenge is cut from, answers restored. */
function window(challenge: { sequence: (number | null)[]; correctAnswers: number[] }): number[] {
  let next = 0;
  return challenge.sequence.map((value) => (value === null ? challenge.correctAnswers[next++] : value));
}

describe('number-sequencer fill_missing variety', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('moves the blank off the second slot across a session and across draws', async () => {
    const seen = new Set<number>();
    for (let draw = 0; draw < 8; draw++) {
      mockGeneration([1, 6, 11, 16].map((start, i) => fillMissing(`f${i}`, start)));
      const data = await generateNumberSequencer(contextFor());
      for (const challenge of data.challenges) seen.add(blankIndex(challenge));
    }
    // Every slot of a 4-cell window is a legal single blank, so a code-owned draw
    // reaches all four; the model reached only slot 1 on 10/10 atlas items.
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(Array.from(seen).every((index) => index >= 0 && index <= 3)).toBe(true);
  });

  it('keeps the window intact and the answer key aligned wherever the blank lands', async () => {
    mockGeneration([1, 6, 11, 16].map((start, i) => fillMissing(`f${i}`, start)));
    const data = await generateNumberSequencer(contextFor());

    expect(data.challenges).toHaveLength(4);
    for (const challenge of data.challenges) {
      // Same four consecutive numbers the model chose — placement moves, values don't.
      const full = window(challenge);
      expect(full).toEqual([full[0], full[0] + 1, full[0] + 2, full[0] + 3]);
      expect(challenge.correctAnswers).toHaveLength(1);
      expect(challenge.sequence.filter((value) => value === null)).toHaveLength(1);
      expect(challenge.rangeMin).toBe(full[0]);
      expect(challenge.rangeMax).toBe(full[3]);
    }
  });

  it('rejects a repeated window and tops the session back up with distinct ones', async () => {
    // The atlas symptom: the same 1,2,3,4 served five times.
    mockGeneration([0, 1, 2, 3, 4].map((i) => fillMissing(`dup${i}`, 1)));
    const data = await generateNumberSequencer(contextFor());

    const windows = data.challenges.map((challenge) => window(challenge).join(','));
    expect(new Set(windows).size).toBe(windows.length);
    // Duplicates cost slots the model did try to fill, so the count is restored.
    expect(data.challenges).toHaveLength(5);
    expect(windows.filter((w) => w === '1,2,3,4')).toHaveLength(1);
  });

  it('places a hard tier its extra blanks non-adjacently', async () => {
    mockGeneration([1, 7, 13].map((start, i) => ({
      id: `f${i}`,
      type: 'fill-missing',
      instruction: 'What number is missing?',
      sequence: [start, null, start + 2, start + 3, start + 4],
      correctAnswers: [start + 1],
      rangeMin: start,
      rangeMax: start + 4,
    })));
    const data = await generateNumberSequencer(contextFor('fill_missing', 'hard'));

    for (const challenge of data.challenges) {
      const blanks = challenge.sequence
        .map((value, index) => (value === null ? index : -1))
        .filter((index) => index >= 0);
      expect(blanks.length).toBeGreaterThanOrEqual(2);
      expect(blanks).toEqual(challenge.correctAnswers.map((_, i) => blanks[i]));
      for (let i = 1; i < blanks.length; i++) {
        expect(blanks[i] - blanks[i - 1]).toBeGreaterThanOrEqual(2);
      }
      // Answers still read left-to-right off the blanks (R5/R6).
      expect(challenge.correctAnswers).toEqual(blanks.map((index) => window(challenge)[index]));
    }
  });

  it('keeps decade-fill blanks on the decade seam', async () => {
    generateContent.mockReset();
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 100 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Crossing Tens',
        description: 'Count across a ten.',
        gradeBand: '1',
        showNumberLine: true,
        showDotArrays: false,
        challenges: [28, 48, 68].map((start, i) => ({
          id: `d${i}`,
          type: 'decade-fill',
          instruction: 'What number is missing?',
          sequence: [start, null, start + 2, start + 3],
          correctAnswers: [start + 1],
          rangeMin: start,
          rangeMax: start + 3,
        })),
      }),
    } as never);

    const data = await generateNumberSequencer({
      ...contextFor('decade_fill'),
      raw: { targetEvalMode: 'decade_fill', challengeCount: 5 },
    } as GenerationContext);

    for (const challenge of data.challenges) {
      if (challenge.type !== 'decade-fill') continue;
      for (const answer of challenge.correctAnswers) {
        // 29 or 30 on a 28..31 window — the crossing itself, never a plain successor.
        expect(answer % 10 === 9 || answer % 10 === 0).toBe(true);
      }
    }
  });
});
