/**
 * Reader-fit 14h regression coverage:
 *  - curated eval-mode blends constrain both schema and post-processing;
 *  - Grade-1 scope can reach 120 without an unrenderable rangeMax=100 mask;
 *  - canonical grade owns the K/1 band while the prose fallback remains available.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberSequencer } from './gemini-number-sequencer';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(opts: {
  topic?: string;
  intent?: string;
  grade?: string;
  gradeContext?: string;
  targetEvalMode?: string;
} = {}): GenerationContext {
  const topic = opts.topic ?? 'Number sequence practice';
  return {
    componentId: 'number-sequencer',
    instanceId: 'number-sequencer-14h-test',
    topic,
    gradeLevel: opts.grade === 'K' ? 'kindergarten' : 'elementary',
    gradeContext: opts.gradeContext ?? 'elementary students (grades 1-5)',
    grade: opts.grade,
    intent: opts.intent,
    objective: {},
    scope: { topic, intent: opts.intent },
    targetEvalMode: opts.targetEvalMode,
    raw: {
      targetEvalMode: opts.targetEvalMode,
      intent: opts.intent,
    },
  };
}

function generated(challenges: Array<Record<string, unknown>>, gradeBand: 'K' | '1' = '1') {
  return {
    title: 'Number Sequence Session',
    description: 'Practice number order.',
    gradeBand,
    showNumberLine: true,
    showDotArrays: false,
    challenges,
  };
}

describe('number-sequencer reader-fit 14h', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('constrains count_from|before_after to the two requested types', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 120 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        { id: 'c1', type: 'count-from', instruction: '?', sequence: [40], correctAnswers: [41, 42, 43], startNumber: 40, direction: 'forward', rangeMin: 1, rangeMax: 100 },
        { id: 'b1', type: 'before-after', instruction: '?', sequence: [79, null], correctAnswers: [80], rangeMin: 1, rangeMax: 100 },
        { id: 'f1', type: 'fill-missing', instruction: '?', sequence: [90, null, 92], correctAnswers: [91], rangeMin: 1, rangeMax: 100 },
        { id: 'd1', type: 'decade-fill', instruction: '?', sequence: [98, 99, null, 101], correctAnswers: [100], rangeMin: 1, rangeMax: 100 },
        { id: 'o1', type: 'order-cards', instruction: '?', sequence: [4, 2, 3], correctAnswers: [2, 3, 4], rangeMin: 1, rangeMax: 100 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({
      grade: '1',
      targetEvalMode: 'count_from|before_after',
      topic: 'Count forward within 120',
      intent: 'Count forward and identify the number before or after',
    }));

    const request = generateContent.mock.calls[1][0] as unknown as {
      contents: string;
      config: { responseSchema: { properties: { challenges: { items: { properties: { type: { enum: string[] } } } } } } };
    };
    expect(request.config.responseSchema.properties.challenges.items.properties.type.enum)
      .toEqual(['count-from', 'before-after']);
    expect(request.contents).toContain('EVAL MODES — CURATED BLEND');
    expect(request.contents).toContain('Do NOT introduce decade-fill or any other challenge type outside the active eval-mode set.');
    expect(data.challenges.every((challenge) => ['count-from', 'before-after'].includes(challenge.type))).toBe(true);
    expect(new Set(data.challenges.map((challenge) => challenge.type))).toEqual(new Set(['count-from', 'before-after']));
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps 101-120 values reachable in derived local windows', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 101, max: 120 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        { id: 'd1', type: 'decade-fill', instruction: '?', sequence: [101, 102, null, 104], correctAnswers: [103], rangeMin: 1, rangeMax: 100 },
        { id: 'd2', type: 'decade-fill', instruction: '?', sequence: [108, 109, null, 111], correctAnswers: [110], rangeMin: 1, rangeMax: 100 },
        { id: 'd3', type: 'decade-fill', instruction: '?', sequence: [117, 118, null, 120], correctAnswers: [119], rangeMin: 1, rangeMax: 100 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({
      grade: '1',
      targetEvalMode: 'decade_fill',
      topic: 'Identify missing numbers when counting forward within 120',
      intent: 'Show 101, 102, a missing number, and 104',
    }));

    expect(data.gradeBand).toBe('1');
    expect(data.challenges.map(({ rangeMin, rangeMax }) => [rangeMin, rangeMax]))
      .toEqual([[101, 104], [108, 111], [117, 120]]);
    expect(Math.max(...data.challenges.flatMap((challenge) => challenge.correctAnswers))).toBe(119);
    const prompt = String((generateContent.mock.calls[1][0] as { contents: string }).contents);
    expect(prompt).toContain('RESOLVED NUMERIC WINDOW — AUTHORITATIVE FOR THIS RENDER: 101 through 120');
    expect(prompt).toContain('use 101-120 only when the AUTHORITATIVE scope explicitly requires it');
    expect(prompt).toContain('never exceed 120');
  });

  it('keeps generic Grade-1 guidance at the existing 1-100 default', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: false, min: 1, max: 100 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        { id: 'c1', type: 'count-from', instruction: '?', sequence: [40], correctAnswers: [41, 42, 43], startNumber: 40, direction: 'forward', rangeMin: 1, rangeMax: 100 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({ grade: '1' }));
    const prompt = String((generateContent.mock.calls[1][0] as { contents: string }).contents);
    expect(prompt).toContain('Default broad practice uses numbers from 1-100');
    expect(prompt).toContain('RESOLVED NUMERIC WINDOW — AUTHORITATIVE FOR THIS RENDER: 1 through 100');
    expect(data.gradeBand).toBe('1');
    expect(data.challenges[0].rangeMax).toBe(43);
  });

  it('uses canonical K even when legacy prose says elementary', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify(generated([
        { id: 'c1', type: 'count-from', instruction: '?', sequence: [16], correctAnswers: [17, 18, 19], startNumber: 16, direction: 'forward', rangeMin: 1, rangeMax: 100 },
      ], '1')),
    } as never);

    const data = await generateNumberSequencer(contextFor({
      grade: 'K',
      gradeContext: 'elementary students (grades 1-5)',
      targetEvalMode: 'count_from',
    }));
    expect(data.gradeBand).toBe('K');
    expect(data.challenges[0]).toMatchObject({ rangeMin: 16, rangeMax: 19 });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-scope generated values against the structured ceiling', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: true, min: 1, max: 20 }),
    } as never).mockResolvedValueOnce({
      text: JSON.stringify(generated([
        { id: 'bad', type: 'count-from', instruction: '?', sequence: [95], correctAnswers: [96, 97, 98], startNumber: 95, direction: 'forward', rangeMin: 1, rangeMax: 100 },
        { id: 'good', type: 'count-from', instruction: '?', sequence: [15], correctAnswers: [16, 17, 18], startNumber: 15, direction: 'forward', rangeMin: 1, rangeMax: 100 },
      ])),
    } as never);

    const data = await generateNumberSequencer(contextFor({
      grade: '1',
      targetEvalMode: 'count_from',
      topic: 'Count forward within 20',
      intent: 'Use values from 1 through 20 only',
    }));
    expect(data.challenges.map((challenge) => challenge.id)).toContain('good');
    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    expect(data.challenges.every((challenge) =>
      challenge.correctAnswers.every((answer) => answer >= 1 && answer <= 20),
    )).toBe(true);
  });
});
