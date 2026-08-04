/**
 * L4 structural difficulty for di-math-facts: the support tier's second dial
 * selects operand-boundary shapes from the code-owned pool. Gemini owns only
 * the wrapper, so these tests exercise the authoritative selection path.
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  crossesOperandBoundary,
  generateDiMathFacts,
  resolveProblemShape,
} from './gemini-di-math-facts';
import type {
  DiMathFactsChallenge,
  DiMathFactsChallengeType,
  DiMathFactsSupportTier,
} from '../../primitives/visual-primitives/direct-instruction/diMathFactsScript';

const TIERS: DiMathFactsSupportTier[] = ['easy', 'medium', 'hard'];
const MODES: DiMathFactsChallengeType[] = [
  'counting_next', 'answer_fact', 'fact_review', 'subtraction_fact',
];

const gen = (
  mode: string,
  difficulty?: string,
  intent = 'addition facts within 20',
  grade = 'first grade',
  challengeCount = 5,
) => generateDiMathFacts(intent, grade, {
  intent,
  targetEvalMode: mode,
  challengeCount,
  ...(difficulty ? { difficulty } : {}),
});

const pairOf = (c: DiMathFactsChallenge) => ({ a: c.a, b: c.b });
const magnitudeOf = (c: DiMathFactsChallenge) =>
  c.challengeType === 'counting_next' ? c.a
    : c.challengeType === 'subtraction_fact' ? c.a
      : c.a + c.b;

const expectAnswersRecomputed = (challenges: DiMathFactsChallenge[]) => {
  for (const c of challenges) {
    const expected = c.challengeType === 'counting_next' ? c.a + 1
      : c.challengeType === 'subtraction_fact' ? c.a - c.b
        : c.a + c.b;
    expect(c.answerNumeral).toBe(expected);
    expect(c.solvedDisplay).toContain(String(expected));
    expect(c.asrAliases).toContain(String(expected));
  }
};

describe('resolveProblemShape — birth-certificate gradient and caps', () => {
  it('resolves the full within-five → cross-five → cross-ten ladder', () => {
    expect(resolveProblemShape('answer_fact', 'easy', 20)).toMatchObject({
      maximum: 5, crossingBoundary: null, saturated: false,
    });
    expect(resolveProblemShape('answer_fact', 'medium', 20)).toMatchObject({
      maximum: 10, crossingBoundary: 5, saturated: false,
    });
    expect(resolveProblemShape('answer_fact', 'hard', 20)).toMatchObject({
      maximum: 20, crossingBoundary: 10, saturated: false,
    });
  });

  it('within-ten honestly saturates hard at crossing five', () => {
    expect(resolveProblemShape('answer_fact', 'hard', 10)).toMatchObject({
      maximum: 10, crossingBoundary: 5, saturated: true,
    });
  });

  it('within-five collapses every tier to the legal floor', () => {
    for (const tier of TIERS) {
      const shape = resolveProblemShape('answer_fact', tier, 5);
      expect(shape.maximum).toBe(5);
      expect(shape.crossingBoundary).toBeNull();
    }
  });
});

describe('addition and subtraction operand structure', () => {
  it('answer_fact easy stays within five', async () => {
    const data = await gen('answer_fact', 'easy');
    expect(data.challenges.every((c) => c.a + c.b <= 5)).toBe(true);
  });

  it('answer_fact medium crosses five', async () => {
    const data = await gen('answer_fact', 'medium');
    expect(data.challenges.every((c) => crossesOperandBoundary(c.challengeType, pairOf(c), 5))).toBe(true);
  });

  it('answer_fact hard crosses ten when the objective already permits within 20', async () => {
    const data = await gen('answer_fact', 'hard');
    expect(data.challenges.every((c) => crossesOperandBoundary(c.challengeType, pairOf(c), 10))).toBe(true);
    expect(data.challenges.every((c) => c.a <= 10 && c.b <= 10)).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });

  it('subtraction medium crosses five downward', async () => {
    const data = await gen('subtraction_fact', 'medium');
    expect(data.challenges.every((c) => crossesOperandBoundary(c.challengeType, pairOf(c), 5))).toBe(true);
  });

  it('subtraction hard crosses ten downward without a stale answer', async () => {
    const data = await gen('subtraction_fact', 'hard');
    expect(data.challenges.every((c) => crossesOperandBoundary(c.challengeType, pairOf(c), 10))).toBe(true);
    expect(data.challenges.every((c) => c.a > c.b)).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });
});

describe('mode floors, capacity, and scope precedence', () => {
  it('counting_next includes the tier boundary crossing and stays in its upper band', async () => {
    for (const [tier, boundary, maximum] of [
      ['medium', 5, 10], ['hard', 10, 20],
    ] as const) {
      const data = await gen('counting_next', tier);
      expect(data.challenges.some((c) => crossesOperandBoundary(c.challengeType, pairOf(c), boundary))).toBe(true);
      expect(data.challenges.every((c) => c.a <= maximum)).toBe(true);
      expectAnswersRecomputed(data.challenges);
    }
  });

  it('six-item counting easy fits the displayed-operand within-five floor', async () => {
    const data = await gen('counting_next', 'easy', 'counting within 20', 'first grade', 6);
    expect(data.challenges).toHaveLength(6);
    expect(data.challenges.every((c) => c.a <= 5)).toBe(true);
  });

  it('fact_review keeps its grade-wide within-ten cap and saturates hard at five', async () => {
    const data = await gen('fact_review', 'hard');
    expect(data.challenges.every((c) => magnitudeOf(c) <= 10)).toBe(true);
    expect(data.challenges.every((c) => crossesOperandBoundary(c.challengeType, pairOf(c), 5))).toBe(true);
  });

  it('a make-ten objective outranks an incompatible easy tier', async () => {
    const data = await gen('answer_fact', 'easy', 'practice pairs that make ten');
    expect(data.challenges.every((c) => c.a + c.b === 10)).toBe(true);
  });

  it('an explicitly named fact always ships even when it misses the tier shape', async () => {
    const data = await gen('answer_fact', 'hard', 'practice 2 + 1');
    expect(data.challenges.some((c) => c.a === 2 && c.b === 1)).toBe(true);
  });
});

describe('mixed spine, prompt/code alignment, and no-tier guardrail', () => {
  it('mixed hard retains every identity and enforces each legal boundary', async () => {
    const data = await gen('mixed', 'hard');
    expect(new Set(data.challenges.map((c) => c.challengeType))).toEqual(new Set(MODES));
    for (const c of data.challenges) {
      const boundary = c.challengeType === 'fact_review' ? 5 : 10;
      if (c.challengeType !== 'counting_next') {
        expect(crossesOperandBoundary(c.challengeType, pairOf(c), boundary)).toBe(true);
      }
      expect(c.supportTier).toBe('hard');
    }
    expect(data.challenges.some((c) =>
      c.challengeType === 'counting_next'
      && crossesOperandBoundary(c.challengeType, pairOf(c), 10),
    )).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });

  it('the tier reaches the advisory prompt and forbids widening factScope', async () => {
    mocks.generateContent.mockClear();
    await gen('answer_fact', 'hard');
    const call = mocks.generateContent.mock.calls.at(-1)?.[0] as { contents?: string } | undefined;
    expect(call?.contents).toContain('DIFFICULTY TIER (hard)');
    expect(call?.contents).toContain('cross ten');
    expect(call?.contents).toContain('never widen factScope');
  });

  it('no difficulty preserves the untiered path and prompt', async () => {
    mocks.generateContent.mockClear();
    const data = await gen('answer_fact');
    expect(data.challenges.every((c) => c.supportTier === undefined)).toBe(true);
    const call = mocks.generateContent.mock.calls.at(-1)?.[0] as { contents?: string } | undefined;
    expect(call?.contents).not.toContain('DIFFICULTY TIER');
  });

  it('stress: every mode × tier stays within its resolved cap and answer contract', async () => {
    for (let run = 0; run < 256; run++) {
      const mode = MODES[run % MODES.length];
      const tier = TIERS[Math.floor(run / MODES.length) % TIERS.length];
      const data = await gen(mode, tier);
      const cap = mode === 'fact_review'
        ? 10
        : resolveProblemShape(mode, tier, 20).maximum;
      expect(data.challenges.every((c) => magnitudeOf(c) <= cap)).toBe(true);
      expect(data.challenges.every((c) => c.supportTier === tier)).toBe(true);
      expectAnswersRecomputed(data.challenges);
    }
  });
});
