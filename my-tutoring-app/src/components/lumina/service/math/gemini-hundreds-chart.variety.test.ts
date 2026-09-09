/**
 * highlight_sequence session variety (HC-4, K atlas 2026-09-07).
 *
 * K COUNT001-01-E ("count by 2s and 5s") shipped the by-5s-from-5 highlight FIVE
 * times in one draw, plus one or two by-10s challenges the lesson never asked for.
 * Two causes: the skip pool was the whole grade-band CAPABILITY pool rather than the
 * intervals the objective names, and the session asked for 7 challenges when only a
 * handful of distinct problems exist — everything a challenge shows is derived from
 * (type, skipValue) once the board and tier are fixed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateHundredsChart, restrictToNamedSkips } from './gemini-hundreds-chart';

const generateContent = vi.mocked(ai.models.generateContent);

const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

/** The atlas context: a K objective that names two intervals and no ceiling. */
function twoIntervalContext(): GenerationContext {
  return {
    componentId: 'hundreds-chart',
    instanceId: 'obj1-chart-skip',
    topic: 'Skip counting by 2s and 5s',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: '1',
    intent: 'Practice skip counting by 2s and by 5s on the hundreds chart.',
    objective: { text: 'Skip count by 2s and 5s within 100' },
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'highlight_sequence',
    raw: { targetEvalMode: 'highlight_sequence' },
  } as GenerationContext;
}

/**
 * The scope resolver answers first, then the content call. `namedSkips` is what the
 * lesson names; the model's own `skipValues` are what it hands back for challenges.
 */
function mockGemini(namedSkips: number[], skipValues: number[], type = 'highlight_sequence') {
  generateContent.mockReset();
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify({ hasExplicitRange: false, max: 100, namedSkips }),
  } as never);
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify({
      title: 'Skip-Count Safari',
      description: 'Explore the patterns.',
      challenges: skipValues.map((sv) => ({ type, skipValue: sv, hint: 'Look at the ones digits.' })),
    }),
  } as never);
}

describe('restrictToNamedSkips (objective ∩ window pool)', () => {
  it('narrows the capability pool to what the lesson names', () => {
    expect(restrictToNamedSkips([2, 5, 10], [2, 5])).toEqual([2, 5]);
    expect(restrictToNamedSkips([2, 5, 10], [10])).toEqual([10]);
  });

  it('leaves the pool alone when the lesson names nothing holdable', () => {
    expect(restrictToNamedSkips([2, 5, 10], [])).toEqual([2, 5, 10]);
    // by-3s is not in the band-1 pool — a lesson naming only that keeps the pool
    // rather than shipping an interval the window/grade cannot hold.
    expect(restrictToNamedSkips([2, 5, 10], [3])).toEqual([2, 5, 10]);
  });
});

describe('generateHundredsChart — session variety', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('keeps by-10s out of a "2s and 5s" lesson, even when the model asks for it', async () => {
    mockGemini([2, 5], [5, 10, 5, 10, 5, 2, 10]);
    const data = await generateHundredsChart(twoIntervalContext());

    expect(data.challenges.length).toBeGreaterThan(0);
    for (const challenge of data.challenges) {
      expect([2, 5]).toContain(challenge.skipValue);
    }
  });

  it('caps the session at the distinct problems that exist and ships each once', async () => {
    // 7 slots, one mode, two legal intervals → exactly two problems.
    mockGemini([2, 5], [5, 5, 5, 5, 5, 5, 5]);
    const data = await generateHundredsChart(twoIntervalContext());

    expect(data.challenges).toHaveLength(2);
    expect(data.challenges.map((c) => c.skipValue).sort()).toEqual([2, 5]);
    // A repeat was replaced by the unused pair, not just dropped.
    expect(new Set(data.challenges.map((c) => `${c.type}|${c.skipValue}`)).size).toBe(2);
    expect(data.challenges.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('asks the model for exactly the distinct count', async () => {
    mockGemini([2, 5], [2, 5]);
    await generateHundredsChart(twoIntervalContext());

    const contentCall = generateContent.mock.calls[1][0] as unknown as {
      contents: string;
      config: { responseSchema: { properties: { challenges: { description: string } } } };
    };
    expect(contentCall.contents).toContain('Generate exactly 2 challenges.');
    expect(contentCall.contents).toContain('skipValue MUST come from this pool: 2, 5');
    expect(contentCall.config.responseSchema.properties.challenges.description)
      .toContain('Exactly 2 challenges');
  });

  it('an unnamed-interval lesson keeps the full grade pool and its per-mode count', async () => {
    // Non-vacuity: the generic lesson is the path this change must leave alone.
    mockGemini([], [2, 5, 10, 2, 5, 10, 2]);
    const data = await generateHundredsChart({
      ...twoIntervalContext(),
      topic: 'Skip counting patterns',
      intent: undefined,
      objective: {},
    } as GenerationContext);

    // Band-1 pool [2,5,10] × one mode = 3 distinct problems, so 7 slots cap at 3.
    expect(data.challenges).toHaveLength(3);
    expect(data.challenges.map((c) => c.skipValue).sort()).toEqual([10, 2, 5].sort());
  });

  it('a blended session counts type × skip, so the cap does not bite', async () => {
    generateContent.mockReset();
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ hasExplicitRange: false, max: 100, namedSkips: [2, 5] }),
    } as never);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Patterns',
        description: '',
        challenges: [
          { type: 'highlight_sequence', skipValue: 2, hint: 'h' },
          { type: 'highlight_sequence', skipValue: 5, hint: 'h' },
          { type: 'complete_sequence', skipValue: 2, hint: 'h' },
          { type: 'complete_sequence', skipValue: 5, hint: 'h' },
        ],
      }),
    } as never);

    const data = await generateHundredsChart({
      ...twoIntervalContext(),
      targetEvalMode: undefined,
      raw: {},
    } as GenerationContext);

    expect(data.challenges).toHaveLength(4);
    expect(new Set(data.challenges.map((c) => `${c.type}|${c.skipValue}`)).size).toBe(4);
  });

  it('a find_skip_value top-up hint never names the interval', async () => {
    mockGemini([2, 5], [2, 2, 2], 'find_skip_value');
    const data = await generateHundredsChart({
      ...twoIntervalContext(),
      targetEvalMode: 'find_skip_value',
      raw: { targetEvalMode: 'find_skip_value' },
    } as GenerationContext);

    for (const challenge of data.challenges) {
      expect(challenge.hint).not.toMatch(new RegExp(`\\b${challenge.skipValue}\\b`));
      expect(challenge.instruction).not.toMatch(new RegExp(`\\b${challenge.skipValue}\\b`));
    }
  });
});
