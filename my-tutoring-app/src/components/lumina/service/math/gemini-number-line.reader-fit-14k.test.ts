/**
 * Reader-fit 14k: Grade-1 missing-number work needs a local high-magnitude
 * window without changing the legacy "any value between" task identity.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberLine } from './gemini-number-line';

const generateContent = vi.mocked(ai.models.generateContent);

const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

function contextFor(raw: Record<string, unknown>): GenerationContext {
  return {
    componentId: 'number-line',
    instanceId: 'number-line-reader-fit-14k',
    topic: 'Identify missing numbers when counting forward from a specific starting point within 120',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: '1',
    intent: 'Hide one number in a by-ones sequence using values around 90 through 110.',
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'between',
    raw: { targetEvalMode: 'between', ...raw },
  };
}

describe('number-line reader-fit 14k', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockImplementation(async (request: unknown) => {
      const contents = String((request as { contents?: unknown }).contents ?? '');
      if (contents.includes('numeric range inferred')) {
        return {
          text: JSON.stringify({
            hasExplicitRange: true,
            min: 0,
            max: 120,
            hasFocusWindow: true,
            focusMin: 90,
            focusMax: 110,
            requiresExactMissingNumber: true,
          }),
        } as never;
      }
      return {
        text: JSON.stringify({
          title: 'Missing Number Line',
          description: 'Find the hidden number.',
          instruction: 'Which number is missing?',
          hint: 'Count by ones from the left number.',
        }),
      } as never;
    });
  });

  it('keeps the 0-120 domain, focuses 90-110, and binds one adjacent missing-number answer', async () => {
    const data = await generateNumberLine(contextFor({}));

    expect(data.gradeBand).toBe('K-2');
    expect(data.numberType).toBe('integer');
    expect(data.range).toEqual({ min: 0, max: 120 });
    expect(data.challenges).toHaveLength(4);

    for (const challenge of data.challenges ?? []) {
      const exactTargetValue = (challenge as typeof challenge & { exactTargetValue?: number }).exactTargetValue;
      const [lo, hi] = [...challenge.targetValues].sort((a, b) => a - b);
      expect(exactTargetValue).toBeTypeOf('number');
      expect(lo).toBeGreaterThanOrEqual(90);
      expect(hi).toBeLessThanOrEqual(110);
      expect(hi - lo).toBe(2);
      expect(exactTargetValue).toBe(lo + 1);
    }
  });

  it('preserves legacy any-interior semantics when no exact task is requested', async () => {
    const data = await generateNumberLine(contextFor({ numberRange: { min: 0, max: 20 } }));

    expect(data.range).toEqual({ min: 0, max: 20 });
    for (const challenge of data.challenges ?? []) {
      expect((challenge as typeof challenge & { exactTargetValue?: number }).exactTargetValue).toBeUndefined();
      const [lo, hi] = [...challenge.targetValues].sort((a, b) => a - b);
      expect(hi - lo).toBeGreaterThan(1);
    }
  });
});
