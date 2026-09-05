/**
 * `name_numeral` — the fifth di-math-facts identity (lesson-bench item 20,
 * 2026-09-05).
 *
 * The finding: a fresh K "Counting objects to 10" package scored WARN because
 * objective 2 — "Recognize and name the written numbers 1 through 10 in order"
 * — was only ASSESSED_INDIRECTLY. Every component the manifest could reach
 * proxied a neighbour skill (handwriting motion, pattern-tap, sequence
 * neighbour); nothing in the catalog had a task whose act IS "see a written
 * numeral, say its name". The objective's verb is expressive, so the fix is
 * spoken (user ruling, 2026-09-05) and lands on this pack.
 *
 * Two failure channels are pinned here, because both would silently cap a
 * "1 through 10" session at 1-5 while every type check stayed green:
 *  - SCOPE: "1 through 10" matched no pattern in `resolveTextScope` at HEAD,
 *    so the objective fell through to the K grade default (within 5);
 *  - TIER: the L4 operand-boundary shape, if applied to a naming pool, clamps
 *    the easy tier to a maximum of five — the same cap through a second door.
 * Plus the two prompt-text guards: a naming item has no "count to the answer"
 * route, and its echo warning would otherwise describe the CORRECT answer.
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import { generateDiMathFacts, numberWordFor, resolveTextScope } from './gemini-di-math-facts';
import {
  judgingContract,
  type DiMathFactsChallenge,
} from '../../primitives/visual-primitives/direct-instruction/diMathFactsScript';

/** The census objective, verbatim from the item-20 lesson-coverage row. */
const CENSUS_OBJECTIVE = 'Recognize and name the written numbers 1 through 10 in order';

const build = (difficulty?: string, challengeCount?: number) =>
  generateDiMathFacts(CENSUS_OBJECTIVE, 'kindergarten', {
    intent: CENSUS_OBJECTIVE,
    objectiveText: CENSUS_OBJECTIVE,
    targetEvalMode: 'name_numeral',
    ...(challengeCount !== undefined ? { challengeCount } : {}),
    ...(difficulty ? { difficulty } : {}),
  });

describe('resolveTextScope — a "through" range is a range', () => {
  it('parses the census objective (null at HEAD before this slice)', () => {
    expect(resolveTextScope(CENSUS_OBJECTIVE)).toEqual({ kind: 'within', maxSum: 10 });
  });

  it('leaves every pre-existing ask byte-identical', () => {
    // The `through` alternative sits ahead of the bare `to`; these pin that the
    // reorder changed nothing that already parsed.
    expect(resolveTextScope('counting forward within 120')).toEqual({ kind: 'within', maxSum: 120 });
    expect(resolveTextScope('count up to 100')).toEqual({ kind: 'within', maxSum: 100 });
    expect(resolveTextScope('add numbers to 50')).toEqual({ kind: 'within', maxSum: 50 });
    expect(resolveTextScope('addition facts within 5')).toEqual({ kind: 'within', maxSum: 5 });
    expect(resolveTextScope('taught to 2026 standards')).toBeNull();
  });
});

describe('name_numeral — the session the census objective asks for', () => {
  it('names EVERY numeral the objective enumerates, not a five-item sample', async () => {
    // The lesson pipeline pins no challengeCount, so this is the session a real
    // lesson gets. The objective's target set is the whole 1..10 range: at the
    // pack's five-item default the coverage judge scored it
    // ASSESSED_INSUFFICIENTLY with "3, 5, 6, 7 and 8 are omitted".
    const data = await build();
    expect(data.challenges).toHaveLength(10);
    expect(new Set(data.challenges.map((c) => c.a))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    );

    const numerals = data.challenges.map((c) => c.a);
    for (const challenge of data.challenges) {
      expect(challenge.challengeType).toBe('name_numeral');
      // The floor is ONE: naming "zero" is a later, separate idea, and the
      // counting pool's zero start is why it is not reused here.
      expect(challenge.a).toBeGreaterThanOrEqual(1);
      expect(challenge.a).toBeLessThanOrEqual(10);
      // The shown numeral IS the answer — nothing is computed.
      expect(challenge.display).toBe(String(challenge.a));
      expect(challenge.answerNumeral).toBe(challenge.a);
      expect(challenge.answerWord).toBe(numberWordFor(challenge.a));
      expect(challenge.problem).toBe('this number');
      expect(challenge.solvedDisplay).toBe(`${challenge.a} = ${numberWordFor(challenge.a)}`);
      expect(challenge.asrAliases).toContain(String(challenge.a));
      expect(challenge.asrAliases).toContain(numberWordFor(challenge.a));
    }

    // One distinct answer each (the variance pass): a pool that had silently
    // collapsed to {1..5} could not have filled this session at all.
    expect(new Set(numerals).size).toBe(10);
    expect(Math.max(...numerals)).toBe(10);
  });

  it('an explicitly pinned count still wins — the caller asked', async () => {
    const data = await build(undefined, 4);
    expect(data.challenges).toHaveLength(4);
    expect(new Set(data.challenges.map((c) => c.a)).size).toBe(4);
  });

  it('the easy tier withdraws SUPPORT, never half the objective range', async () => {
    // The operand-boundary shape is undefined for naming and is skipped; if it
    // were applied, `easy` would cap the pool at five and re-create the bug.
    const data = await build('easy');
    expect(data.challenges).toHaveLength(10);
    expect(Math.max(...data.challenges.map((c) => c.a))).toBe(10);
    for (const challenge of data.challenges) {
      expect(challenge.supportTier).toBe('easy');
      expect(challenge.a).toBeLessThanOrEqual(10);
    }
  });

  it('never leaks the answer into the printed stimulus or the wrapper', async () => {
    const data = await build();
    for (const challenge of data.challenges) {
      expect(challenge.display).not.toContain(challenge.answerWord);
    }
    expect(`${data.title} ${data.description}`).not.toMatch(/\d/);
  });
});

describe('name_numeral — the judging contract drops the two clauses that misfire', () => {
  const naming: DiMathFactsChallenge = {
    id: 'dimf-1-id7',
    challengeType: 'name_numeral',
    a: 7,
    b: 0,
    display: '7',
    problem: 'this number',
    answerWord: 'seven',
    answerNumeral: 7,
    solvedDisplay: '7 = seven',
  };
  const counting: DiMathFactsChallenge = {
    id: 'dimf-1-n5',
    challengeType: 'counting_next',
    a: 5,
    b: 1,
    display: '5 →',
    problem: 'the number after five',
    answerWord: 'six',
    answerNumeral: 6,
    solvedDisplay: '5 → 6',
  };

  it('offers no "count to the answer" route — you do not count to a name', () => {
    expect(judgingContract(naming)).not.toContain('after counting');
    expect(judgingContract(naming)).toContain('right away, or with young-child pronunciation');
    // Every other identity keeps the benched wording.
    expect(judgingContract(counting)).toContain('or after counting up to it');
  });

  it('drops the echo warning, which here would describe the CORRECT answer', () => {
    // The stimulus is a bare numeral, so "a number straight out of the problem"
    // IS the target production — leaving the clause in would tell the tutor to
    // treat a right answer as a common error.
    expect(judgingContract(naming)).not.toContain('echoing a number straight out of the problem');
    expect(judgingContract(counting)).toContain('echoing a number straight out of the problem');
  });

  it('still corrects a different number word', () => {
    const contract = judgingContract(naming);
    expect(contract).toContain('Yes, this number is seven.');
    expect(contract).toContain('A different number word is always wrong');
  });
});
