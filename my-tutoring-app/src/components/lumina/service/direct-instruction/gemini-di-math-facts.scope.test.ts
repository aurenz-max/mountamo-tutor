/**
 * Objective-scope parsing for di-math-facts — reader-fit 14g.
 *
 * The census finding: the published Grade-1 objective `NBT001-01-a` ("Identify
 * missing numbers when counting forward … within 120") produced `counting_next`
 * items topping out at TWELVE. The channel was a two-digit capture in
 * `resolveTextScope`, which read "within 120" as "within 12" — a three-digit ask
 * was mangled rather than saturated.
 *
 * These tests pin both halves of the fix:
 *  - the PARSE now reads the whole number (the non-vacuity gate: every
 *    `\d{1,3}` assertion below fails against the old `\d{1,2}` regex);
 *  - the CLAMP still saturates at twenty, the pack's benched single-number-word
 *    ceiling. Saturation is the honest degradation; widening it is an unbenched
 *    response class gated behind a bench sitting (qa/di/BACKLOG.md item 10).
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import { generateDiMathFacts, resolveTextScope } from './gemini-di-math-facts';

/** The census objective, verbatim from `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md`. */
const CENSUS_OBJECTIVE =
  'Identify missing numbers when counting forward by ones within 120';

describe('resolveTextScope — three-digit asks parse whole, then saturate', () => {
  it('reads the census objective as 120, not 12 (the 14g defect)', () => {
    // Non-vacuity: the old `\d{1,2}` capture returned maxSum 12 here.
    expect(resolveTextScope(CENSUS_OBJECTIVE)).toEqual({ kind: 'within', maxSum: 20 });
  });

  it('saturates every above-ceiling ask at the benched twenty', () => {
    for (const text of [
      'counting forward within 120',
      'count up to 100',
      'add numbers to 50',
      'sums to 30',
    ]) {
      expect(resolveTextScope(text)).toEqual({ kind: 'within', maxSum: 20 });
    }
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

describe('counting_next on the census objective', () => {
  it('serves the whole benched sequence instead of stopping at twelve', async () => {
    // The pool is shuffled per session, so the reachable CEILING is what this
    // asserts: over repeated sessions the pack must produce starts above twelve.
    // At HEAD (maxSum 12 → buildCountingPool(12) → a = 0..11) no run could.
    let highestStart = 0;
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
        // Saturation is a CEILING, not a suggestion: nothing may leave the
        // benched single-number-word range.
        expect(challenge.answerNumeral).toBeLessThanOrEqual(20);
        expect(challenge.answerWord).toBeTruthy();
        expect(challenge.problem).not.toContain('undefined');
        highestStart = Math.max(highestStart, challenge.a);
      }
    }
    expect(highestStart).toBeGreaterThan(12);
  });
});
