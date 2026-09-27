/**
 * Every item lies on the line the child sees (contract C1 + item integrity).
 *
 * The K-2 legibility clamp used to run AFTER the sub-generators drew their values, so a
 * 0-100 domain produced 53-2 and 84+2 on a 0-30 line; the component zoomed them away and
 * snapped a click to 30 (2026-09-27 probe: 7 of 8 jump items off the line). The clamp now
 * decides the displayed range first, and a final check drops any item still off it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { challengeValues, clampK2Range, generateNumberLine } from './gemini-number-line';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(grade: string, targetEvalMode: string, numberRange: { min: number; max: number }): GenerationContext {
  return {
    componentId: 'number-line', instanceId: 'number-line-test', topic: 'Hopping on the number line',
    gradeLevel: 'elementary', gradeContext: 'elementary students (grades 1-5)', grade,
    intent: undefined, objective: {}, scope: {} as GenerationContext['scope'], targetEvalMode,
    // A supplied numberRange skips the topic-range model call, so the draw is the only randomness.
    raw: { targetEvalMode, numberRange },
  };
}

const offLine = (data: Awaited<ReturnType<typeof generateNumberLine>>) =>
  (data.challenges ?? []).filter(ch => challengeValues(ch).some(v => v < data.range.min || v > data.range.max)).map(ch => ch.id);

describe('number-line items lie on the displayed line', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify({
      title: 'Hops', description: 'Hop on the line.', instruction: 'Hop and land.', hint: 'Count each hop.',
      challenges: [], instructions: [] }) } as never);
  });

  it('a Grade-2 jump session on a 0-100 domain draws only from the 0-30 line it shows', async () => {
    for (let draw = 0; draw < 20; draw++) {
      const data = await generateNumberLine(contextFor('2', 'jump', { min: 0, max: 100 }));
      expect(data.range).toEqual({ min: 0, max: 30 });
      expect(data.challenges?.length ?? 0).toBeGreaterThan(0);
      expect(offLine(data)).toEqual([]);
    }
  });

  it('an explicit Grade-1 domain up to 120 keeps its wider line (contract C1 fork) and stays on it', async () => {
    const data = await generateNumberLine(contextFor('1', 'jump', { min: 0, max: 100 }));
    expect(data.range.max).toBe(100);
    expect(offLine(data)).toEqual([]);
  });

  it('a Grade-4 domain is not clamped', async () => {
    const data = await generateNumberLine(contextFor('4', 'plot', { min: 0, max: 100 }));
    expect(data.range.max).toBe(100);
    expect(offLine(data)).toEqual([]);
  });
});

describe('clampK2Range', () => {
  it('caps the top, keeps integer bounds, and never returns an empty line', () => {
    expect(clampK2Range({ min: 0, max: 100 }, 30)).toEqual({ min: 0, max: 30 });
    expect(clampK2Range({ min: -5, max: 12.4 }, 30)).toEqual({ min: -1, max: 12 });
    expect(clampK2Range({ min: 40, max: 100 }, 30)).toEqual({ min: 0, max: 30 });
    expect(clampK2Range({ min: 0, max: 110 }, 120)).toEqual({ min: 0, max: 110 });
  });
});
