/**
 * DI misconception-loop S5 pilot. The private diagnosis may only re-rank the
 * code-owned subtraction pool; it must never enter Gemini or returned data.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  crossesOperandBoundary,
  generateDiMathFacts,
  resolveDiRemediationMove,
} from './gemini-di-math-facts';
import type { DiMathFactsChallenge } from '../../primitives/visual-primitives/direct-instruction/diMathFactsScript';

const SUCCESSOR_FOCUS =
  'When answering a subtraction fact, the student identifies the successor—the number that comes after the first number—instead of subtracting.';

const generate = (
  remediationFocus?: string,
  options: { mode?: string; difficulty?: string; intent?: string; count?: number } = {},
) => {
  const intent = options.intent ?? 'subtraction facts within 5';
  return generateDiMathFacts(intent, 'kindergarten', {
    intent,
    targetEvalMode: options.mode ?? 'subtraction_fact',
    challengeCount: options.count ?? 5,
    ...(options.difficulty ? { difficulty: options.difficulty } : {}),
    ...(remediationFocus !== undefined ? { remediationFocus } : {}),
  });
};

const isSuccessorCounterexample = (challenge: DiMathFactsChallenge): boolean =>
  challenge.challengeType === 'subtraction_fact'
  && challenge.b === 1
  && challenge.a - 1 !== challenge.a + 1;

const expectAnswersRecomputed = (challenges: DiMathFactsChallenge[]) => {
  for (const challenge of challenges) {
    const expected = challenge.challengeType === 'counting_next'
      ? challenge.a + 1
      : challenge.challengeType === 'subtraction_fact'
        ? challenge.a - challenge.b
        : challenge.a + challenge.b;
    expect(challenge.answerNumeral).toBe(expected);
    expect(challenge.solvedDisplay).toContain(String(expected));
    expect(challenge.asrAliases).toContain(String(expected));
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  mocks.generateContent.mockClear();
});

describe('resolveDiRemediationMove — narrow task-bounded mapping', () => {
  it('maps only successor/adding diagnoses explicitly bounded to subtraction', () => {
    expect(resolveDiRemediationMove('subtraction_fact', SUCCESSOR_FOCUS))
      .toBe('subtracts_by_adding');
    expect(resolveDiRemediationMove(
      'subtraction_fact',
      'When subtracting, the student adds the operands.',
    )).toBe('subtracts_by_adding');

    expect(resolveDiRemediationMove('counting_next', SUCCESSOR_FOCUS)).toBeNull();
    expect(resolveDiRemediationMove('subtraction_fact', 'The student counts up.')).toBeNull();
    expect(resolveDiRemediationMove('subtraction_fact', 'The student struggles with subtraction.')).toBeNull();
    expect(resolveDiRemediationMove('subtraction_fact', '')).toBeNull();
    expect(resolveDiRemediationMove('subtraction_fact')).toBeNull();
  });

  it('maps operand echoes and reversed counting only inside their task identities', () => {
    const echo = 'When answering an addition fact, the student repeats the second addend.';
    const reverse = 'When saying the number after, the student counts backward to the number before.';
    expect(resolveDiRemediationMove('answer_fact', echo)).toBe('echoes_operand');
    expect(resolveDiRemediationMove('fact_review', echo)).toBe('echoes_operand');
    expect(resolveDiRemediationMove('counting_next', echo)).toBeNull();
    expect(resolveDiRemediationMove('counting_next', reverse)).toBe('reverses_count_direction');
    expect(resolveDiRemediationMove('subtraction_fact', reverse)).toBeNull();
  });
});

describe('di-math-facts subtraction remediation selection', () => {
  it('places exactly two legal take-away-one counterexamples, then transfer items', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const data = await generate(SUCCESSOR_FOCUS);

    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.filter(isSuccessorCounterexample)).toHaveLength(2);
    expect(data.challenges.slice(0, 2).every(isSuccessorCounterexample)).toBe(true);
    expect(data.challenges.slice(2).every((challenge) => !isSuccessorCounterexample(challenge))).toBe(true);
    expect(data.challenges.every((challenge) => challenge.challengeType === 'subtraction_fact')).toBe(true);
    expect(data.challenges.every((challenge) => challenge.a <= 5)).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });

  it('keeps the structural tier authoritative and logs honest saturation', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const data = await generate(SUCCESSOR_FOCUS, {
      difficulty: 'medium',
      intent: 'subtraction facts within 10',
    });

    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.every((challenge) =>
      crossesOperandBoundary(challenge.challengeType, challenge, 5),
    )).toBe(true);
    expect(data.challenges.filter(isSuccessorCounterexample)).toHaveLength(1);
    expect(data.challenges.every((challenge) => challenge.supportTier === 'medium')).toBe(true);
    expectAnswersRecomputed(data.challenges);
    expect(log).toHaveBeenCalledWith('[DiRemediation]', expect.objectContaining({
      primitive: 'di-math-facts',
      type: 'subtraction_fact',
      move: 'subtracts_by_adding',
      requested: 2,
      actual: 1,
      skippedReason: 'insufficient_eligible_targets',
    }));
  });

  it('targets the one subtraction slot in a mixed session without changing allocation', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const data = await generate(SUCCESSOR_FOCUS, {
      mode: 'mixed',
      intent: 'math facts within 5',
    });

    expect(data.challenges).toHaveLength(5);
    expect(new Set(data.challenges.map((challenge) => challenge.challengeType))).toEqual(new Set([
      'counting_next', 'answer_fact', 'fact_review', 'subtraction_fact',
    ]));
    const subtraction = data.challenges.filter((challenge) => challenge.challengeType === 'subtraction_fact');
    expect(subtraction).toHaveLength(1);
    expect(subtraction.every(isSuccessorCounterexample)).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });

  it('varies both operands while excluding echo collisions', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const focus = 'When answering an addition fact, the student repeats the second addend.';
    const data = await generate(focus, { mode: 'answer_fact', intent: 'addition facts within 5' });
    const targeted = data.challenges.slice(0, 2);

    expect(targeted.every((challenge) =>
      challenge.answerNumeral !== challenge.a && challenge.answerNumeral !== challenge.b,
    )).toBe(true);
    expect(targeted[0].a).not.toBe(targeted[1].a);
    expect(targeted[0].b).not.toBe(targeted[1].b);
    expectAnswersRecomputed(data.challenges);
  });

  it('places legal five-boundary successors first for reversed counting', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const focus = 'When saying the number after, the student counts backward to the number before.';
    const data = await generate(focus, { mode: 'counting_next', intent: 'counting within 10' });

    expect(data.challenges.slice(0, 2).every((challenge) =>
      challenge.a % 5 === 0 || challenge.a % 5 === 4,
    )).toBe(true);
    expectAnswersRecomputed(data.challenges);
  });
});

describe('remediation privacy and baseline compatibility', () => {
  it('keeps no-focus, blank-focus, and unsupported-focus selection byte-compatible', async () => {
    const run = async (focus?: string) => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.37);
      const data = await generate(focus);
      random.mockRestore();
      return data;
    };

    const baseline = await run();
    expect(await run('   ')).toEqual(baseline);
    expect(await run('The student is uncertain about subtraction.')).toEqual(baseline);
  });

  it('does not bleed a subtraction diagnosis into counting_next', async () => {
    const run = async (focus?: string) => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.37);
      const data = await generate(focus, { mode: 'counting_next', intent: 'counting within 5' });
      random.mockRestore();
      return data;
    };

    expect(await run(SUCCESSOR_FOCUS)).toEqual(await run());
  });

  it('never sends or serializes the private diagnosis', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.37);
    const data = await generate(SUCCESSOR_FOCUS);
    const call = mocks.generateContent.mock.calls.at(-1)?.[0] as { contents?: string } | undefined;
    const serialized = JSON.stringify(data);

    expect(call?.contents).not.toContain(SUCCESSOR_FOCUS);
    expect(serialized).not.toContain(SUCCESSOR_FOCUS);
    expect(serialized).not.toContain('remediationFocus');
    expect(serialized).not.toContain('remediationMove');
    expect(serialized).not.toContain('subtracts_by_adding');
  });
});
