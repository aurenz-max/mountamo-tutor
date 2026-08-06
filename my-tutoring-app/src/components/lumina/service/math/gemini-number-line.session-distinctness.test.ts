/**
 * Session distinctness for number-line's structural difficulty levers (contract R9).
 *
 * The defect these pin: the `order`/`between` structural re-selectors scored the
 * POOL, not the per-challenge input, and returned the single best-scoring
 * set/pair. Both are pure functions of (pool, perSet), so every challenge in the
 * session got the SAME values — an easy-tier "Counting within 20" order session
 * rendered 12, 15, 17 four times, and an easy-tier between session rendered one
 * bound pair four times. (`sets.map((s) => reshapeOrderSet(pool, perSet, gap) ?? s)`
 * — the `s` was never read.)
 *
 * These tests drive the REAL generator with a mocked LLM, so they exercise the
 * production path end to end: pool service → picker → structural re-selector →
 * orchestrator. Reverting to a single-optimum re-selector fails them immediately.
 *
 * They also pin that the fix did not flatten R5/R7's gap lever: easy must still
 * spread values wider than hard clusters them.
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

/** The exact shape the reported session ran with: G1, "Counting within 20", 0-20. */
function contextFor(opts: {
  targetEvalMode: string;
  difficulty?: string;
  grade?: string;
  numberRange?: { min: number; max: number };
}): GenerationContext {
  return {
    componentId: 'number-line',
    instanceId: 'number-line-test',
    topic: 'Counting within 20',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: opts.grade ?? '1',
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: opts.targetEvalMode,
    raw: {
      targetEvalMode: opts.targetEvalMode,
      // Supplying numberRange skips the resolveTopicNumberRange micro-LLM call,
      // keeping these deterministic in what matters (the range) while leaving the
      // in-code pickers free to randomise (which is exactly what is under test).
      numberRange: opts.numberRange ?? { min: 0, max: 20 },
      difficulty: opts.difficulty,
    },
  };
}

const RUNS = 20; // the bug reproduced on EVERY run; 20 defeats luck either way

const keyOf = (vals: number[]) => [...vals].sort((a, b) => a - b).join('|');

/**
 * `challenges` is optional on the generated type, so narrow it ONCE here rather
 * than defaulting to `[]` at each call site — an empty default would let a
 * generator that emitted nothing pass every distinctness assertion vacuously.
 */
function challengesOf(data: Awaited<ReturnType<typeof generateNumberLine>>) {
  expect(data.challenges).toBeDefined();
  return data.challenges!;
}

function minAdjacentGap(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < s.length; i++) min = Math.min(min, s[i] - s[i - 1]);
  return min;
}

describe('number-line session distinctness (R9) under structural difficulty', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Number Line Adventure to 20',
        description: 'Learn to order numbers correctly on a number line from 0 to 20.',
        instruction: 'Put these numbers in order from smallest to largest.',
        hint: 'Find each number on the line first.',
      }),
    } as never);
  });

  it.each(['easy', 'medium', 'hard'])(
    'order @ %s gives a DIFFERENT value set per challenge',
    async (difficulty) => {
      for (let run = 0; run < RUNS; run++) {
        const data = await generateNumberLine(contextFor({ targetEvalMode: 'order', difficulty }));
        const sets = challengesOf(data).map((c) => c.targetValues);

        expect(sets.length).toBeGreaterThan(1);
        // Every set: 3 distinct in-range values at K-2 (R5).
        for (const s of sets) {
          expect(s).toHaveLength(3);
          expect(new Set(s).size).toBe(3);
          for (const v of s) {
            expect(v).toBeGreaterThanOrEqual(data.range.min);
            expect(v).toBeLessThanOrEqual(data.range.max);
          }
        }
        // R9 — the sets differ from each other. This is what 12,15,17 ×4 broke.
        expect(new Set(sets.map(keyOf)).size).toBe(sets.length);
      }
    },
  );

  it.each(['easy', 'medium', 'hard'])(
    'between @ %s gives a DIFFERENT, answerable bound pair per challenge',
    async (difficulty) => {
      for (let run = 0; run < RUNS; run++) {
        const data = await generateNumberLine(contextFor({ targetEvalMode: 'between', difficulty }));
        const pairs = challengesOf(data).map((c) => c.targetValues as [number, number]);

        expect(pairs.length).toBeGreaterThan(1);
        for (const [lo, hi] of pairs) {
          expect(hi).toBeGreaterThan(lo);
          // The answerability floor (R6): an integer lies strictly between.
          expect(Math.floor(lo) + 1).toBeLessThan(hi);
          expect(lo).toBeGreaterThanOrEqual(data.range.min);
          expect(hi).toBeLessThanOrEqual(data.range.max);
        }
        // R9 — the pairs differ from each other.
        expect(new Set(pairs.map(([a, b]) => `${a}|${b}`)).size).toBe(pairs.length);
      }
    },
  );

  it('the easy→hard gap lever survives the distinctness fix (R5/R7 non-vacuity)', async () => {
    // Distinctness must not be bought by abandoning the profile: easy spreads
    // values apart, hard clusters them. Averaged over runs because both tiers
    // draw from a randomly-placed sub-window.
    const meanMinGap = async (difficulty: string) => {
      let total = 0;
      let n = 0;
      for (let run = 0; run < RUNS; run++) {
        const data = await generateNumberLine(contextFor({ targetEvalMode: 'order', difficulty }));
        for (const c of challengesOf(data)) {
          total += minAdjacentGap(c.targetValues);
          n++;
        }
      }
      return total / n;
    };

    const easy = await meanMinGap('easy');
    const hard = await meanMinGap('hard');
    expect(easy).toBeGreaterThan(hard);
    expect(hard).toBeLessThanOrEqual(2); // hard really is a tight run
  });
});
