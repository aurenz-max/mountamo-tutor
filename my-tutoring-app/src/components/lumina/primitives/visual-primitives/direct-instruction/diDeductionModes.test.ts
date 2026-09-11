import { describe, expect, it } from 'vitest';
import {
  DI_DEDUCTION_CHALLENGE_TYPES,
  DI_DEDUCTION_EVAL_MODES,
  DI_DEDUCTION_TYPE_DOCS,
  diDeductionModePlan,
} from './diDeductionModes';

describe('DI Deduction mode definitions', () => {
  it('projects the calibrated catalog ladder and generator docs', () => {
    expect(DI_DEDUCTION_EVAL_MODES.map((mode) => [mode.evalMode, mode.beta])).toEqual([
      ['conclude', 2.5],
      ['deny', 3.5],
      ['cannot_tell', 4.5],
    ]);
    expect(DI_DEDUCTION_CHALLENGE_TYPES).toEqual(['conclude', 'deny', 'cannot_tell']);
    expect(Object.keys(DI_DEDUCTION_TYPE_DOCS)).toEqual(DI_DEDUCTION_CHALLENGE_TYPES);
  });

  it.each([
    ['conclude', 'Say what the rule tells you about a robin.'],
    ['deny', "Is a robin a bird? Say yes, no, or can't tell—then explain using the rule."],
    ['cannot_tell', "Is a robin a bird? Say yes, no, or can't tell—then explain using the rule."],
  ] as const)('builds the %s deduction action', (shape, instruction) => {
    const plan = diDeductionModePlan({
      id: `case-${shape}`,
      challengeType: shape,
      action: 'deduce',
      responseClass: 'deduction',
      shape,
      case: { subject: 'a robin' },
      rule: { category: 'bird' },
    });
    expect(plan.groupingKey).toBe('deduce');
    expect(plan.responseClass).toBe('deduction');
    expect(plan.answerStep.actionContract).toMatchObject({
      id: shape, answerKind: 'voice', instruction,
    });
  });
});
