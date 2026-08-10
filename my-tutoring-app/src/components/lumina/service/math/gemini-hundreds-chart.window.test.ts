/**
 * Numeric-window resolution for hundreds-chart — the chart's ceiling comes from
 * the LESSON, not from the primitive's name.
 *
 * The defect (found in a live Kindergarten "counting to 10" lesson): the
 * manifest asked for "Introduce the numbers 1-10 in order ... use the highlight
 * mode for numbers 1 to 10" and the first thing the student saw was the full
 * 1-100 board reading "Count by 5s and tap every number you land on, all the way
 * to 100." Three independent hardcoded 100s (buildSequence's loop bound,
 * buildInstruction's prose, the returned gridMax) plus a skip pool that never
 * contained 1 meant "count to 10 in order" was not an expressible activity at
 * ANY grade — the generator's whole output space was skip-counting to 100.
 *
 * These tests pin:
 *   • the WINDOW — an explicit lesson bound shrinks the board, the sequences,
 *     AND the instruction prose together (all three 100s, not just one),
 *   • by-1s — counting in order becomes legal at windows ≤20, in counting
 *     language rather than skip-counting language,
 *   • the pool intersection — skips too coarse for the board drop out,
 *   • code enforcement — an out-of-window skipValue from the LLM is rejected
 *     rather than rendered as a 1-cell "sequence", and
 *   • the legacy default — an unbounded lesson keeps the 1-100 board and the
 *     untouched grade pool (14m template: never delete the fallback).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateHundredsChart, resolveLegalSkips } from './gemini-hundreds-chart';

const generateContent = vi.mocked(ai.models.generateContent);

const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

/** The real production context from the failing lesson. */
function countingToTenContext(): GenerationContext {
  return {
    componentId: 'hundreds-chart',
    instanceId: 'obj1-chart-intro',
    topic: 'counting to 10',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: 'K',
    intent:
      'Introduce the numbers 1-10 in order using a visual grid to show the sequence '
      + 'and pattern of digits. Use the highlight mode for numbers 1 to 10.',
    objective: { text: 'Identify numbers from one to ten in order' },
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'highlight_sequence',
    raw: { targetEvalMode: 'highlight_sequence', difficulty: 'easy' },
  } as GenerationContext;
}

function unboundedContext(): GenerationContext {
  return {
    componentId: 'hundreds-chart',
    instanceId: 'hundreds-chart-test',
    topic: 'Skip counting patterns',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: undefined,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: undefined,
    raw: {},
  } as GenerationContext;
}

/**
 * Two calls happen in order: the window resolver, then the content call.
 * `windowMax === null` mocks an unbounded lesson (hasExplicitRange=false).
 */
function mockGemini(windowMax: number | null, skipValues: number[], type = 'highlight_sequence') {
  generateContent.mockReset();
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify(
      windowMax == null
        ? { hasExplicitRange: false, max: 100 }
        : { hasExplicitRange: true, max: windowMax },
    ),
  } as never);
  generateContent.mockResolvedValueOnce({
    text: JSON.stringify({
      title: 'First Steps on the Grid!',
      description: 'Explore the very beginning of the chart.',
      challenges: skipValues.map((sv) => ({ type, skipValue: sv, hint: 'Look at the order.' })),
    }),
  } as never);
}

describe('resolveLegalSkips (window ∩ grade pool)', () => {
  it('leaves every grade pool untouched on the full 1-100 board', () => {
    expect(resolveLegalSkips([2, 5, 10], 100)).toEqual([2, 5, 10]);
    expect(resolveLegalSkips([2, 3, 4, 5], 100)).toEqual([2, 3, 4, 5]);
    expect(resolveLegalSkips([3, 4, 6, 7, 8, 9], 100)).toEqual([3, 4, 6, 7, 8, 9]);
  });

  it('drops skips too coarse to draw a sequence, and admits by-1s at small windows', () => {
    // 1-10: by-5s is 2 cells and by-10s is 1 — neither is a readable pattern.
    expect(resolveLegalSkips([2, 5, 10], 10)).toEqual([1, 2]);
    // 1-20: by-5s survives (4 cells); by-10s (2 cells) does not.
    expect(resolveLegalSkips([2, 5, 10], 20)).toEqual([1, 2, 5]);
  });

  it('never returns an empty pool', () => {
    expect(resolveLegalSkips([10], 10).length).toBeGreaterThan(0);
    expect(resolveLegalSkips([9], 30)).toEqual([9]);
    // >20 so by-1s is not added; nothing fits → the grade's first value stands.
    expect(resolveLegalSkips([50], 30)).toEqual([50]);
  });
});

describe('generateHundredsChart — lesson window', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('a "counting to 10" lesson renders a 1-10 board, not the 1-100 board', async () => {
    // The LLM answers with the by-5s-to-100 skips that shipped the bug.
    mockGemini(10, [5, 10, 2, 5]);
    const data = await generateHundredsChart(countingToTenContext());

    expect(data.gridMax).toBe(10);
    // Every cell the student is asked to touch is inside the lesson.
    for (const c of data.challenges) {
      expect(c.correctCells.length).toBeGreaterThan(0);
      expect(Math.max(...c.correctCells)).toBeLessThanOrEqual(10);
      expect(legalForTen).toContain(c.skipValue);
      // The prose must not send them past the end of the board.
      expect(c.instruction).not.toContain('100');
    }
  });

  it('by-1s is expressible and reads as counting, not skip-counting', async () => {
    mockGemini(10, [1, 1]);
    const data = await generateHundredsChart(countingToTenContext());

    const first = data.challenges[0];
    expect(first.skipValue).toBe(1);
    expect(first.correctCells).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.instruction).toMatch(/in order|one at a time/i);
    expect(first.instruction).not.toMatch(/skip/i);
    // "the ones digits repeat" is a 10-wide-grid claim; a single row has no
    // second row to repeat into, so the easy tier must withhold it here.
    expect(first.instruction).not.toMatch(/ones digits/i);
  });

  it('an out-of-window skipValue is rejected in code, never rendered', async () => {
    // by-10s on a 1-10 board would be the single cell [10].
    mockGemini(10, [10]);
    const data = await generateHundredsChart(countingToTenContext());

    expect(data.challenges[0].skipValue).not.toBe(10);
    expect(data.challenges[0].correctCells.length).toBeGreaterThanOrEqual(4);
  });

  it('an unbounded lesson keeps the legacy 1-100 board and grade pool', async () => {
    // Non-vacuity: this is the path the whole change must leave byte-compatible.
    mockGemini(null, [5]);
    const data = await generateHundredsChart(unboundedContext());

    expect(data.gridMax).toBe(100);
    expect(data.challenges[0].skipValue).toBe(5);
    expect(data.challenges[0].correctCells).toContain(100);
    expect(data.challenges[0].instruction).toContain('100');
  });

  it('an explicit config.gridMax pin outranks the resolver', async () => {
    mockGemini(10, [2]);
    const ctx = countingToTenContext();
    (ctx.raw as Record<string, unknown>).gridMax = 20;
    const data = await generateHundredsChart(ctx);

    expect(data.gridMax).toBe(20);
    expect(Math.max(...data.challenges[0].correctCells)).toBeLessThanOrEqual(20);
  });
});

/** Band '1' (K clamps here) is [2,5,10]; a 1-10 board leaves by-1s and by-2s. */
const legalForTen = [1, 2];
