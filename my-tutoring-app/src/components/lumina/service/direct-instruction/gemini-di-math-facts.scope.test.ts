/**
 * Objective-scope parsing for di-math-facts — reader-fit 14g + DI item 10.
 *
 * The census finding: the published Grade-1 objective `NBT001-01-a` ("Identify
 * missing numbers when counting forward … within 120") produced `counting_next`
 * items topping out at TWELVE. The channel was a two-digit capture in
 * `resolveTextScope`, which read "within 120" as "within 12" — a three-digit ask
 * was mangled rather than saturated.
 *
 * 14g fixed the parse and saturated at twenty; the ITEM-10 EXTENSION
 * (user-ruled build-ahead 2026-08-06, #63 = the acceptance sitting) raised the
 * COUNTING ceiling to 120 with a code-owned numeral builder. These tests pin
 * the current contract:
 *  - the PARSE reads the whole number (non-vacuity vs. the old `\d{1,2}`);
 *  - the scope keeps the RAW ask up to the 120 hard cap;
 *  - every ARITHMETIC pool still applies its own benched single-word cap of
 *    twenty at build time — the raise widened counting only.
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import { generateDiMathFacts, numberWordFor, resolveTextScope } from './gemini-di-math-facts';

/** The census objective, verbatim from `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md`. */
const CENSUS_OBJECTIVE =
  'Identify missing numbers when counting forward by ones within 120';

describe('resolveTextScope — three-digit asks parse whole up to the 120 cap', () => {
  it('reads the census objective as 120, not 12 (the 14g defect)', () => {
    // Non-vacuity: the old `\d{1,2}` capture returned maxSum 12 here.
    expect(resolveTextScope(CENSUS_OBJECTIVE)).toEqual({ kind: 'within', maxSum: 120 });
  });

  it('keeps the raw ask up to 120 and saturates above it', () => {
    expect(resolveTextScope('counting forward within 120')).toEqual({ kind: 'within', maxSum: 120 });
    expect(resolveTextScope('count up to 100')).toEqual({ kind: 'within', maxSum: 100 });
    expect(resolveTextScope('add numbers to 50')).toEqual({ kind: 'within', maxSum: 50 });
    expect(resolveTextScope('sums to 30')).toEqual({ kind: 'within', maxSum: 30 });
    // 120 is a HARD CAP that saturates, never a knob.
    expect(resolveTextScope('count to 500')).toEqual({ kind: 'within', maxSum: 120 });
  });

  it('leaves in-range asks exactly where they were', () => {
    expect(resolveTextScope('addition facts within 5')).toEqual({ kind: 'within', maxSum: 5 });
    expect(resolveTextScope('addition facts within 10')).toEqual({ kind: 'within', maxSum: 10 });
    expect(resolveTextScope('addition facts within 20')).toEqual({ kind: 'within', maxSum: 20 });
    expect(resolveTextScope('counting within 20')).toEqual({ kind: 'within', maxSum: 20 });
    // Floor is unchanged: a below-five ask still lands on the five-fact floor.
    expect(resolveTextScope('sums within 3')).toEqual({ kind: 'within', maxSum: 5 });
  });

  it('pins nothing from a number that is not a range (word boundary)', () => {
    // A truncating capture would have read "202" / "20" out of a year and
    // silently scoped the session from it.
    expect(resolveTextScope('taught to 2026 standards')).toBeNull();
  });

  it('keeps the precedence ladder: named facts and patterns outrank a range', () => {
    expect(resolveTextScope('practice 3 + 2 within 120')).toEqual({
      kind: 'named',
      facts: [{ a: 3, b: 2 }],
    });
    expect(resolveTextScope('pairs that make ten within 120')).toEqual({ kind: 'make_10' });
    expect(resolveTextScope('doubles within 120')).toEqual({ kind: 'doubles' });
  });
});

describe('counting_next on the census objective — the 1–120 extension', () => {
  it('serves the full 120 range, windowed near the ceiling, never rote from zero', async () => {
    let highestAnswer = 0;
    let sawDecadeTransition = false;
    for (let run = 0; run < 10; run++) {
      const data = await generateDiMathFacts(CENSUS_OBJECTIVE, 'first grade', {
        intent: CENSUS_OBJECTIVE,
        objectiveText: CENSUS_OBJECTIVE,
        targetEvalMode: 'counting_next',
        challengeCount: 6,
      });
      expect(data.challenges).toHaveLength(6);
      for (const challenge of data.challenges) {
        expect(challenge.challengeType).toBe('counting_next');
        // 120 is the hard ceiling; every spoken form comes from the builder.
        expect(challenge.answerNumeral).toBeLessThanOrEqual(120);
        expect(challenge.answerWord).toBe(numberWordFor(challenge.answerNumeral));
        expect(challenge.problem).not.toContain('undefined');
        // Windowed pool: an above-twenty session never drills rote-from-the-
        // bottom starts (they belong to within-20 asks).
        expect(challenge.a).toBeGreaterThanOrEqual(12);
        highestAnswer = Math.max(highestAnswer, challenge.answerNumeral);
        if (challenge.a % 10 === 9) sawDecadeTransition = true;
      }
    }
    // Over 10 sessions the extension range and its decade transitions must be
    // reachable — at HEAD-before-this-slice highestAnswer could never pass 20.
    expect(highestAnswer).toBeGreaterThan(20);
    expect(sawDecadeTransition).toBe(true);
  });

  it('keeps every ARITHMETIC pool inside the benched single-word twenty under a 120 ask', async () => {
    for (const mode of ['answer_fact', 'subtraction_fact'] as const) {
      const data = await generateDiMathFacts(CENSUS_OBJECTIVE, 'first grade', {
        intent: CENSUS_OBJECTIVE,
        objectiveText: CENSUS_OBJECTIVE,
        targetEvalMode: mode,
        challengeCount: 6,
      });
      for (const challenge of data.challenges) {
        expect(challenge.challengeType).toBe(mode);
        // No multi-digit arithmetic ever: "119 − 3" is the failure this pins.
        expect(challenge.a).toBeLessThanOrEqual(20);
        expect(challenge.answerNumeral).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('numberWordFor — the code-owned numeral builder (bench-canonical forms)', () => {
  it('builds every form class the probe set names', () => {
    expect(numberWordFor(0)).toBe('zero');
    expect(numberWordFor(13)).toBe('thirteen');
    expect(numberWordFor(20)).toBe('twenty');
    expect(numberWordFor(21)).toBe('twenty-one');
    expect(numberWordFor(30)).toBe('thirty');
    expect(numberWordFor(40)).toBe('forty');
    expect(numberWordFor(51)).toBe('fifty-one');
    expect(numberWordFor(77)).toBe('seventy-seven');
    expect(numberWordFor(99)).toBe('ninety-nine');
    expect(numberWordFor(100)).toBe('one hundred');
    expect(numberWordFor(107)).toBe('one hundred seven');
    expect(numberWordFor(115)).toBe('one hundred fifteen');
    expect(numberWordFor(120)).toBe('one hundred twenty');
  });

  it('never emits undefined anywhere in 0..120 and refuses out-of-ceiling input', () => {
    for (let n = 0; n <= 120; n++) {
      expect(numberWordFor(n)).not.toContain('undefined');
      expect(numberWordFor(n).length).toBeGreaterThan(0);
    }
    expect(() => numberWordFor(121)).toThrow();
    expect(() => numberWordFor(-1)).toThrow();
  });
});
