/**
 * compare_groups count variety (CB-4, K atlas 2026-09-07).
 *
 * Two K objectives over two draws produced the same five comparisons — 5v1, 1v4,
 * 3v3, 1v5 — with only the objectType changing. The counts were the model's free
 * choice, and constrained decoding resolves a free numeric field the same way every
 * run. Code now pre-rolls the LEFT/RIGHT pairs, sized to the tier's gap, with one
 * equal pair guaranteed wherever the tier allows one.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateComparisonBuilder } from './gemini-comparison-builder';

const generateContent = vi.mocked(ai.models.generateContent);

function contextFor(difficulty?: string, grade = 'K'): GenerationContext {
  const topic = 'Compare groups of objects';
  return {
    componentId: 'comparison-builder',
    instanceId: 'comparison-builder-variety-test',
    topic,
    gradeLevel: 'kindergarten',
    gradeContext: 'kindergarten students - concrete, playful, visual',
    grade,
    intent: 'Decide whether the left group has more, fewer, or the same',
    objective: { text: 'Compare two groups of up to 10 objects' },
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'compare_groups',
    raw: { targetEvalMode: 'compare_groups', difficulty, gradeBand: grade === 'K' ? 'K' : '1' },
  } as GenerationContext;
}

/** The objective range the shared resolver reports back. null → the K band. */
let resolvedWindow: { min: number; max: number } | null = null;

/** The scope-range micro-call is the FIRST call the generator makes; both mocks
 *  answer it before falling through to the generation payload. */
const SCOPE_CALL = 'needs the numeric range for the two group counts';
function scopeReply(): string {
  return JSON.stringify(resolvedWindow ?? { min: 1, max: 10 });
}

/** The model echoes the pool it was handed — the shape of a compliant response. */
function mockFromPromptPool() {
  generateContent.mockImplementation(async (request: unknown) => {
    const contents = String((request as { contents: string }).contents);
    if (contents.includes(SCOPE_CALL)) return { text: scopeReply() } as never;
    const pairs = Array.from(contents.matchAll(/Comparison \d+: LEFT (\d+), RIGHT (\d+)/g))
      .map((match) => ({ left: Number(match[1]), right: Number(match[2]) }));
    return {
      text: JSON.stringify({
        title: 'More or Fewer?',
        description: 'Compare the two groups.',
        gradeBand: 'K',
        challenges: pairs.slice(0, 5).map((pair, index) => ({
          id: `c${index + 1}`,
          type: 'compare-groups',
          instruction: 'Does the left group have more, fewer, or the same as the right?',
          leftGroup: { count: pair.left, objectType: 'bears' },
          rightGroup: { count: pair.right, objectType: 'bears' },
          correctAnswer: 'more',
        })),
      }),
    } as never;
  });
}

/** The model ignoring the pool: the atlas's five fixed comparisons. */
function mockConvergedPairs() {
  generateContent.mockImplementation(async (request: unknown) => {
    const contents = String((request as { contents: string }).contents);
    if (contents.includes(SCOPE_CALL)) return { text: scopeReply() } as never;
    return {
    text: JSON.stringify({
      title: 'More or Fewer?',
      description: 'Compare the two groups.',
      gradeBand: 'K',
      challenges: [[5, 1], [1, 4], [3, 3], [1, 5], [5, 1]].map(([left, right], index) => ({
        id: `c${index + 1}`,
        type: 'compare-groups',
        instruction: 'Does the left group have more, fewer, or the same as the right?',
        leftGroup: { count: left, objectType: 'bears' },
        rightGroup: { count: right, objectType: 'bears' },
        correctAnswer: 'more',
      })),
    }),
  } as never;
  });
}

function promptOf(callIndex = 0): string {
  return generateContent.mock.calls
    .map((call) => String((call[0] as { contents: string }).contents))
    .filter((contents) => !contents.includes(SCOPE_CALL))[callIndex] ?? '';
}

describe('comparison-builder compare_groups count pool', () => {
  beforeEach(() => {
    generateContent.mockReset();
    resolvedWindow = null;
  });

  it('hands the model pre-rolled pairs instead of asking it for counts', async () => {
    mockFromPromptPool();
    await generateComparisonBuilder(contextFor());

    const prompt = promptOf();
    expect(prompt).toContain('GROUP COUNT POOL');
    expect(prompt).toContain('do NOT invent your own counts');
    // Two more pairs than the session ships (COUNT_BY_MODE = 5).
    expect(Array.from(prompt.matchAll(/Comparison \d+: LEFT \d+, RIGHT \d+/g))).toHaveLength(7);
  });

  it('rolls different pairs on every call — the convergence the atlas caught', async () => {
    const sessions: string[] = [];
    for (let draw = 0; draw < 6; draw++) {
      generateContent.mockReset();
      mockFromPromptPool();
      const data = await generateComparisonBuilder(contextFor());
      sessions.push(
        data.challenges
          .map((challenge) => `${challenge.leftGroup?.count}v${challenge.rightGroup?.count}`)
          .join(' '),
      );
    }
    // Six independent generations of the SAME lesson: the atlas saw one signature
    // across two objectives and two draws.
    expect(new Set(sessions).size).toBeGreaterThanOrEqual(5);
  });

  it('guarantees an equal case in the session (untiered and easy/medium)', async () => {
    for (const tier of [undefined, 'easy', 'medium']) {
      generateContent.mockReset();
      mockFromPromptPool();
      const data = await generateComparisonBuilder(contextFor(tier));
      const equals = data.challenges.filter((challenge) => challenge.correctAnswer === 'equal');
      expect(equals.length).toBeGreaterThanOrEqual(1);
      for (const challenge of equals) {
        expect(challenge.leftGroup?.count).toBe(challenge.rightGroup?.count);
      }
    }
  });

  it('withholds the equal case at the hard tier and keeps the adjacent gap', async () => {
    mockFromPromptPool();
    const data = await generateComparisonBuilder(contextFor('hard'));

    for (const challenge of data.challenges) {
      const gap = Math.abs((challenge.leftGroup?.count ?? 0) - (challenge.rightGroup?.count ?? 0));
      expect(gap).toBe(1);
      expect(challenge.correctAnswer).not.toBe('equal');
    }
  });

  it('keeps the pool inside the grade band at every tier', async () => {
    for (const tier of ['easy', 'medium', 'hard']) {
      generateContent.mockReset();
      mockFromPromptPool();
      const data = await generateComparisonBuilder(contextFor(tier));
      for (const challenge of data.challenges) {
        for (const count of [challenge.leftGroup?.count ?? 0, challenge.rightGroup?.count ?? 0]) {
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThanOrEqual(10); // K band ceiling — a tier never widens it
        }
      }
    }
  });

  it('still repairs a tier-illegal gap when the model ignores the pool', async () => {
    mockConvergedPairs();
    const data = await generateComparisonBuilder(contextFor('hard'));

    for (const challenge of data.challenges) {
      const gap = Math.abs((challenge.leftGroup?.count ?? 0) - (challenge.rightGroup?.count ?? 0));
      expect(gap).toBe(1);
      // The answer is always recomputed from the shipped counts (contract R4).
      const expected = (challenge.leftGroup?.count ?? 0) > (challenge.rightGroup?.count ?? 0)
        ? 'more'
        : 'less';
      expect(challenge.correctAnswer).toBe(expected);
    }
  });

  it('leaves a non-compare-groups mode unpooled', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Order them',
        description: '',
        gradeBand: 'K',
        challenges: [{
          id: 'c1',
          type: 'order',
          instruction: 'Put these in order!',
          numbers: [3, 1, 5],
          direction: 'ascending',
        }],
      }),
    } as never);

    const ctx = contextFor();
    (ctx as { targetEvalMode?: string }).targetEvalMode = 'order';
    (ctx.raw as Record<string, unknown>).targetEvalMode = 'order';
    await generateComparisonBuilder(ctx);

    expect(promptOf()).not.toContain('GROUP COUNT POOL');
  });
});
/**
 * compare_groups objective window (P1 repair, K atlas full redraw 2026-09-09).
 *
 * The pool was anchored on the GRADE BAND, so two objectives naming groups of "up to
 * 5" drew 5v9, 10v4 and 3v8 — 7 of 10 comparisons out of the objective's range. The
 * range the objective names is now read in code and every code-owned draw is held
 * inside it; the tier's count gap relaxes when the window is too narrow to hold a
 * session's worth of distinct pairs, because scope outranks the structural lever.
 */
describe('comparison-builder compare_groups objective window', () => {
  const UP_TO_5 =
    'Compare two groups of up to 5 objects using one-to-one correspondence and the '
    + 'terms "more than," "less than," and "equal to"';
  const SIX_TO_10 =
    'Compare two groups of 6-10 objects using visual patterns and one-to-one correspondence';

  /** The atlas drives topic AND intent from the requirement text. */
  function windowContext(objective: string, difficulty = 'easy'): GenerationContext {
    const ctx = contextFor(difficulty);
    (ctx as { topic: string }).topic = objective;
    (ctx as { intent?: string }).intent = objective;
    return ctx;
  }

  function countsOf(data: Awaited<ReturnType<typeof generateComparisonBuilder>>): number[] {
    return data.challenges.flatMap((challenge) => [
      challenge.leftGroup?.count ?? 0,
      challenge.rightGroup?.count ?? 0,
    ]);
  }

  beforeEach(() => {
    generateContent.mockReset();
    resolvedWindow = null;
  });

  it('holds every count inside an "up to 5" objective (COUNT001-03-A / MEAS001-02-B)', async () => {
    for (let draw = 0; draw < 4; draw++) {
      generateContent.mockReset();
      resolvedWindow = { min: 1, max: 5 };
      mockFromPromptPool();
      const data = await generateComparisonBuilder(windowContext(UP_TO_5));

      expect(data.challenges.length).toBeGreaterThanOrEqual(5);
      for (const count of countsOf(data)) {
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(5);
      }
      // The equal case and the distinct-pair rule survive the narrower window.
      expect(data.challenges.some((c) => c.correctAnswer === 'equal')).toBe(true);
      const pairs = data.challenges.map((c) => {
        const left = c.leftGroup?.count ?? 0;
        const right = c.rightGroup?.count ?? 0;
        return `${Math.min(left, right)}-${Math.max(left, right)}`;
      });
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });

  it('holds every count inside a "6-10" objective (COUNT001-03-B) — a FLOOR, not just a ceiling', async () => {
    for (let draw = 0; draw < 4; draw++) {
      generateContent.mockReset();
      resolvedWindow = { min: 6, max: 10 };
      mockFromPromptPool();
      const data = await generateComparisonBuilder(windowContext(SIX_TO_10));

      for (const count of countsOf(data)) {
        expect(count).toBeGreaterThanOrEqual(6);
        expect(count).toBeLessThanOrEqual(10);
      }
      expect(data.challenges.some((c) => c.correctAnswer === 'equal')).toBe(true);
      const pairs = data.challenges.map((c) => {
        const left = c.leftGroup?.count ?? 0;
        const right = c.rightGroup?.count ?? 0;
        return `${Math.min(left, right)}-${Math.max(left, right)}`;
      });
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });

  it('leaves a K objective that names no range on the full 1-10 band', async () => {
    const counts: number[] = [];
    for (let draw = 0; draw < 4; draw++) {
      generateContent.mockReset();
      mockFromPromptPool();
      counts.push(...countsOf(await generateComparisonBuilder(contextFor('easy'))));
    }
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(10);
    }
    // Not silently narrowed to the small end: the band is still in play.
    expect(Math.max(...counts)).toBeGreaterThan(5);
  });

  it('pulls the model back into the window when it ignores the pool', async () => {
    resolvedWindow = { min: 6, max: 10 };
    mockConvergedPairs(); // 5v1, 1v4, 3v3, 1v5 — every count below a 6-10 floor
    const data = await generateComparisonBuilder(windowContext(SIX_TO_10));

    for (const challenge of data.challenges) {
      const left = challenge.leftGroup?.count ?? 0;
      const right = challenge.rightGroup?.count ?? 0;
      expect(left).toBeGreaterThanOrEqual(6);
      expect(right).toBeGreaterThanOrEqual(6);
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(10);
      // Contract R4: the key is recomputed from whatever counts actually shipped.
      const expected = left > right ? 'more' : left < right ? 'less' : 'equal';
      expect(challenge.correctAnswer).toBe(expected);
    }
  });

  it('relaxes the tier gap rather than leaving the window (hard @ up-to-5)', async () => {
    resolvedWindow = { min: 1, max: 5 };
    mockFromPromptPool();
    const data = await generateComparisonBuilder(windowContext(UP_TO_5, 'hard'));

    for (const challenge of data.challenges) {
      const left = challenge.leftGroup?.count ?? 0;
      const right = challenge.rightGroup?.count ?? 0;
      expect(Math.max(left, right)).toBeLessThanOrEqual(5);
      expect(Math.min(left, right)).toBeGreaterThanOrEqual(1);
      // Still a hard tier: adjacent-ish, never equal, never the easy tier's spread.
      const gap = Math.abs(left - right);
      expect(gap).toBeGreaterThanOrEqual(1);
      expect(gap).toBeLessThanOrEqual(2);
      expect(challenge.correctAnswer).not.toBe('equal');
    }
  });

  it('states the range in the prompt as well as enforcing it in code', async () => {
    resolvedWindow = { min: 1, max: 5 };
    mockFromPromptPool();
    await generateComparisonBuilder(windowContext(UP_TO_5));

    const prompt = promptOf();
    expect(prompt).toContain('MUST be between 1 and 5 inclusive');
    expect(prompt).toContain("objective's range (1-5)");
  });

  it('falls back to the band when the resolver fails — the no-scope path is unchanged', async () => {
    generateContent.mockImplementation(async (request: unknown) => {
      const contents = String((request as { contents: string }).contents);
      // A resolver that returns junk: resolveScopeRange yields null, the band stands.
      if (contents.includes(SCOPE_CALL)) return { text: '{"min":"x"}' } as never;
      const pairs = Array.from(contents.matchAll(/Comparison \d+: LEFT (\d+), RIGHT (\d+)/g))
        .map((match) => ({ left: Number(match[1]), right: Number(match[2]) }));
      return {
        text: JSON.stringify({
          title: 'More or Fewer?',
          description: 'Compare the two groups.',
          gradeBand: 'K',
          challenges: pairs.slice(0, 5).map((pair, index) => ({
            id: `c${index + 1}`,
            type: 'compare-groups',
            instruction: 'Does the left group have more, fewer, or the same as the right?',
            leftGroup: { count: pair.left, objectType: 'bears' },
            rightGroup: { count: pair.right, objectType: 'bears' },
            correctAnswer: 'more',
          })),
        }),
      } as never;
    });

    const data = await generateComparisonBuilder(windowContext(UP_TO_5));
    expect(data.challenges.length).toBeGreaterThanOrEqual(5);
    for (const count of countsOf(data)) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(10);
    }
    expect(promptOf()).not.toContain('MUST be between');
  });
});
