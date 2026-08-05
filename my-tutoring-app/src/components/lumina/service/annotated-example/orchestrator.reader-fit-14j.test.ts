import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import {
  buildAnnotatedExampleAuthoringContract,
  deriveDeterministicRepeatedAdditionModel,
  validateTextAgainstAuthoringContract,
} from './authoring-contract';
import { runAnnotatedExampleOrchestrator } from './orchestrator';

const generateContent = vi.mocked(ai.models.generateContent);

const COIN_INTENT =
  'Use this exact worked example: six nickels. Skip-count by 5 cents to 30 cents.';

function response(problemStatement: string) {
  return {
    text: JSON.stringify({
      difficulty: 'easy',
      insetType: null,
      problemStatement,
      insetBrief: null,
      rationale: 'Practices the requested skill.',
    }),
  } as never;
}

describe('annotated-example reader-fit 14j authoring contract', () => {
  beforeEach(() => generateContent.mockReset());

  it('extracts concrete quantities, entities, units, grade, and operation identity', () => {
    const contract = buildAnnotatedExampleAuthoringContract({
      intent: COIN_INTENT,
      canonicalGrade: '1',
    });
    expect(contract).toMatchObject({
      binding: 'strict',
      canonicalGrade: '1',
      requiredNumbers: [6, 5, 30],
      requiredTerms: ['nickel', 'cent'],
      operationFamily: 'skip-counting',
      explicitlyAllowsMultiplication: false,
    });
  });

  it('derives the safe fallback arithmetically without a denomination branch', () => {
    const contract = buildAnnotatedExampleAuthoringContract({
      intent: COIN_INTENT,
      canonicalGrade: '1',
    });
    expect(deriveDeterministicRepeatedAdditionModel(contract)).toEqual({
      count: 6,
      increment: 5,
      target: 30,
      entity: 'nickel',
      unit: 'cent',
      rows: [
        ['1', '5'],
        ['2', '10'],
        ['3', '15'],
        ['4', '20'],
        ['5', '25'],
        ['6', '30'],
      ],
    });
  });

  it('rejects the recorded 4x5 dime/200-cent replacement plan', () => {
    const contract = buildAnnotatedExampleAuthoringContract({ intent: COIN_INTENT, canonicalGrade: '1' });
    const violations = validateTextAgainstAuthoringContract(
      'Arrange 20 dimes in a 4 × 5 array. Multiply to find a total of 200 cents.',
      contract,
    );
    expect(violations.map((violation) => violation.code)).toEqual(
      expect.arrayContaining(['missing-number', 'missing-term', 'scope-overflow', 'operation-missing', 'grade1-operation']),
    );
  });

  it('repairs one rejected authoring plan and keeps the exact coin scenario', async () => {
    generateContent
      .mockResolvedValueOnce(response('Arrange 20 dimes in a 4 × 5 array and find 200 cents.'))
      .mockResolvedValueOnce(
        response('Skip-count six nickels by 5 cents: 5, 10, 15, 20, 25, 30 cents.'),
      );

    const contract = buildAnnotatedExampleAuthoringContract({ intent: COIN_INTENT, canonicalGrade: '1' });
    const plan = await runAnnotatedExampleOrchestrator({
      topic: 'Count identical coins',
      gradeLevel: 'elementary',
      authoringContract: contract,
    });

    expect(plan.problemStatement).toContain('six nickels');
    expect(plan.problemStatement).toContain('30 cents');
    expect(plan.problemStatement).not.toMatch(/dimes|200|×|times|array/i);
    expect(generateContent).toHaveBeenCalledTimes(2);
    const repairPrompt = String(generateContent.mock.calls[1][0].contents);
    expect(repairPrompt).toContain('Repair the rejected plan');
    expect(repairPrompt).toContain('grade1-operation');
  });

  it('falls back to the exact intent after one bounded repair also fails', async () => {
    generateContent
      .mockResolvedValueOnce(response('Use 4 rows of 5 dimes for 200 cents.'))
      .mockResolvedValueOnce(response('Multiply 4 × 5 dimes to get 200 cents.'));

    const contract = buildAnnotatedExampleAuthoringContract({ intent: COIN_INTENT, canonicalGrade: '1' });
    const plan = await runAnnotatedExampleOrchestrator({
      topic: 'Count identical coins',
      gradeLevel: 'elementary',
      authoringContract: contract,
    });

    expect(plan.problemStatement).toBe(COIN_INTENT);
    expect(plan.insetType).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('keeps a strict session alive when the repair call itself errors', async () => {
    generateContent
      .mockResolvedValueOnce(response('Use 4 rows of 5 dimes for 200 cents.'))
      .mockRejectedValueOnce(new Error('malformed repair response'));

    const contract = buildAnnotatedExampleAuthoringContract({ intent: COIN_INTENT, canonicalGrade: '1' });
    const plan = await runAnnotatedExampleOrchestrator({
      topic: 'Count identical coins',
      gradeLevel: 'elementary',
      authoringContract: contract,
    });

    expect(plan.problemStatement).toBe(COIN_INTENT);
    expect(plan.insetType).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('keeps generic Grade-1 authoring varied when no concrete constraint is present', async () => {
    generateContent
      .mockResolvedValueOnce(
        response('Mia counts a small collection of shells. How many shells are there?'),
      )
      .mockResolvedValueOnce(
        response('Noah counts buttons into a cup. How many buttons did he collect?'),
      );
    const contract = buildAnnotatedExampleAuthoringContract({
      intent: 'Practice counting a collection.',
      canonicalGrade: '1',
    });

    expect(contract.binding).toBe('representative');
    const firstPlan = await runAnnotatedExampleOrchestrator({
      topic: 'Counting collections',
      gradeLevel: 'elementary',
      authoringContract: contract,
    });
    const secondPlan = await runAnnotatedExampleOrchestrator({
      topic: 'Counting collections',
      gradeLevel: 'elementary',
      authoringContract: contract,
    });
    expect(firstPlan.problemStatement).toContain('shells');
    expect(secondPlan.problemStatement).toContain('buttons');
    expect(firstPlan.problemStatement).not.toBe(secondPlan.problemStatement);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('preserves the exact 108–111 missing-number control and rejects a shifted sequence', () => {
    const contract = buildAnnotatedExampleAuthoringContract({
      intent: 'Use this exact worked example: 108, 109, ?, 111. Find the missing number.',
      canonicalGrade: '1',
    });
    expect(
      validateTextAgainstAuthoringContract('Find the missing number in 108, 109, ?, 111.', contract),
    ).toEqual([]);
    expect(
      validateTextAgainstAuthoringContract('Find the missing number in 105, 106, ?, 108.', contract),
    ).not.toEqual([]);
  });

  it('allows explicit multiplication and upper-grade algebra/calculus controls', () => {
    const explicitMultiplication = buildAnnotatedExampleAuthoringContract({
      intent: 'Use this exact problem: multiply 4 × 5.',
      canonicalGrade: '1',
    });
    expect(
      validateTextAgainstAuthoringContract('Use multiplication to calculate 4 × 5.', explicitMultiplication),
    ).toEqual([]);

    const calculus = buildAnnotatedExampleAuthoringContract({
      intent: 'Demonstrate an area-between-curves integral.',
      canonicalGrade: '12',
    });
    expect(
      validateTextAgainstAuthoringContract('Evaluate the product inside $\\int_0^1 x(x+1)\\,dx$.', calculus),
    ).toEqual([]);
  });

  it('preserves the practice-problem legacy context path', async () => {
    generateContent.mockResolvedValueOnce(response('Solve $2x + 3 = 11$.'));
    const plan = await runAnnotatedExampleOrchestrator({
      topic: 'Linear equations',
      gradeLevel: 'middle school',
      context: 'Target a medium derivation.',
    });
    expect(plan.problemStatement).toBe('Solve $2x + 3 = 11$.');
    expect(String(generateContent.mock.calls[0][0].contents)).toContain(
      '## Additional context\nTarget a medium derivation.',
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejects multiplication introduced only in the hydrated step chain', () => {
    const contract = buildAnnotatedExampleAuthoringContract({ intent: COIN_INTENT, canonicalGrade: '1' });
    const violations = validateTextAgainstAuthoringContract(
      'Skip-count six nickels by 5 cents to 30 cents, then verify with $6 \\times 5 = 30$.',
      contract,
    );
    expect(violations.some((violation) => violation.code === 'grade1-operation')).toBe(true);
  });
});
