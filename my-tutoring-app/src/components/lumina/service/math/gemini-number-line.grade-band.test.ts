/**
 * Grade-band resolution for number-line — canonical `ctx.grade` first, prose fallback.
 *
 * The reader-fit 14m defect: `resolveGradeBand()` substring-matches `gradeContext`
 * PROSE, and every production sentence matches its K-2 test ("elementary students
 * (grades 1-5)" contains a '1'; middle/high-school prose contains a 'k' in
 * "thinking") — so every lesson landed on 'K-2' and the '3-5' band was
 * unreachable, while a bare band key like "elementary" inverted to '3-5'.
 * These tests pin:
 *   • the canonical mapper (K/1/2 → 'K-2', 3+ → '3-5', null without a grade),
 *   • the WIRING — with a canonical grade the emitted `gradeBand` comes from it,
 *     never from prose (reverting `canonicalGradeBand` threading fails these),
 *   • the legacy fallback — no canonical grade ⇒ prose path byte-compatible
 *     (contract R2: never delete the fallback), and
 *   • the `identify` K floor — pinned 0–10/'K-2' regardless of grade (contract R3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberLine, numberLineGradeBandFromGrade } from './gemini-number-line';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends for grades 1-5 (geminiService.getGradeLevelContext).
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';
const MIDDLE_SCHOOL_PROSE =
  'middle school students (grades 6-8) - Use more sophisticated vocabulary, abstract concepts, real-world applications, and encourage critical thinking.';

function contextFor(opts: {
  grade?: string;
  gradeContext?: string;
  targetEvalMode?: string;
  numberRange?: { min: number; max: number };
}): GenerationContext {
  return {
    componentId: 'number-line',
    instanceId: 'number-line-test',
    topic: 'Working with numbers',
    gradeLevel: 'elementary',
    gradeContext: opts.gradeContext ?? ELEMENTARY_PROSE,
    grade: opts.grade,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: opts.targetEvalMode,
    raw: {
      targetEvalMode: opts.targetEvalMode,
      // Supplying numberRange skips the resolveTopicNumberRange micro-LLM call,
      // keeping these tests deterministic.
      numberRange: opts.numberRange ?? { min: 0, max: 20 },
    },
  };
}

describe('numberLineGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the component bands', () => {
    expect(numberLineGradeBandFromGrade('K')).toBe('K-2');
    expect(numberLineGradeBandFromGrade('1')).toBe('K-2');
    expect(numberLineGradeBandFromGrade('2')).toBe('K-2');
    expect(numberLineGradeBandFromGrade('3')).toBe('3-5');
    expect(numberLineGradeBandFromGrade('4')).toBe('3-5');
    expect(numberLineGradeBandFromGrade('12')).toBe('3-5');
    expect(numberLineGradeBandFromGrade(' 1 ')).toBe('K-2');
    expect(numberLineGradeBandFromGrade('k')).toBe('K-2');
  });

  it('returns null when there is no canonical grade — the prose fallback must stay reachable', () => {
    expect(numberLineGradeBandFromGrade(undefined)).toBeNull();
    expect(numberLineGradeBandFromGrade('')).toBeNull();
    expect(numberLineGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateNumberLine grade-band wiring', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Number Line Session',
        description: 'Practice with the number line.',
        instruction: 'Find the number on the line.',
        hint: 'Count the tick marks from the start.',
      }),
    } as never);
  });

  it('a Grade-4 objective reaches the 3-5 band even though the prose says "grades 1-5"', async () => {
    // Non-vacuity: without canonicalGradeBand threading, ELEMENTARY_PROSE
    // contains a '1' so the prose parser returns 'K-2' and this fails.
    const data = await generateNumberLine(contextFor({ grade: '4', targetEvalMode: 'plot' }));
    expect(data.gradeBand).toBe('3-5');
  });

  it('a Grade-1 objective stays on K-2 (the band all 8 authored consumers demand)', async () => {
    const data = await generateNumberLine(contextFor({ grade: '1', targetEvalMode: 'plot' }));
    expect(data.gradeBand).toBe('K-2');
    expect(data.numberType).toBe('integer');
  });

  it('no canonical grade → the legacy prose path is unchanged (fallback kept)', async () => {
    const elementary = await generateNumberLine(contextFor({ targetEvalMode: 'plot' }));
    expect(elementary.gradeBand).toBe('K-2');
    // Documents the fallback's KNOWN limitation (the 'k' in "thinking" matches):
    // prose banding is fallback-only; any "fix" to it must go through the contract.
    const middle = await generateNumberLine(
      contextFor({ targetEvalMode: 'plot', gradeContext: MIDDLE_SCHOOL_PROSE }),
    );
    expect(middle.gradeBand).toBe('K-2');
  });

  it('identify stays pinned to the K floor regardless of canonical grade (contract R3)', async () => {
    const data = await generateNumberLine(contextFor({ grade: '4', targetEvalMode: 'identify' }));
    expect(data.gradeBand).toBe('K-2');
    expect(data.numberType).toBe('integer');
    expect(data.range).toEqual({ min: 0, max: 10 });
    for (const challenge of data.challenges ?? []) {
      for (const value of challenge.targetValues ?? []) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('a Grade-1 jump session keeps the K-2 jump-size table (contract R4)', async () => {
    const data = await generateNumberLine(contextFor({ grade: '1', targetEvalMode: 'jump' }));
    expect(data.gradeBand).toBe('K-2');
    for (const op of data.operations ?? []) {
      const size = Math.abs(op.changeValue);
      expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(5);
    }
  });
});
