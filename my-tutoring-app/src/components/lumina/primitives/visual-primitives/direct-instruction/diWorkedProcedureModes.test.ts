import { describe, expect, it } from 'vitest';
import {
  DI_WORKED_PROCEDURE_CHALLENGE_TYPES,
  DI_WORKED_PROCEDURE_EVAL_MODES,
  DI_WORKED_PROCEDURE_TYPE_DOCS,
  diWorkedProcedureModePlan,
} from './diWorkedProcedureModes';

describe('DI Worked Procedure mode definitions', () => {
  it('projects the calibrated catalog ladder and generator docs', () => {
    expect(DI_WORKED_PROCEDURE_EVAL_MODES.map((mode) => [mode.evalMode, mode.beta])).toEqual([
      ['subtract_no_regroup', 2.0],
      ['subtract_regroup', 3.5],
    ]);
    expect(DI_WORKED_PROCEDURE_CHALLENGE_TYPES).toEqual([
      'subtract_no_regroup', 'subtract_regroup',
    ]);
    expect(Object.keys(DI_WORKED_PROCEDURE_TYPE_DOCS)).toEqual(
      DI_WORKED_PROCEDURE_CHALLENGE_TYPES,
    );
  });

  it('materializes the current generated column as the assessed voice step', () => {
    const plan = diWorkedProcedureModePlan({
      id: 'wp-1-c0-decide',
      challengeType: 'subtract_regroup',
      action: 'talk_through',
      responseClass: 'procedure_step',
      kind: 'decide',
      place: 'ones',
      regroup: true,
      supportTier: 'easy',
      column: { topAfterLend: 2, effectiveTop: 12, bottom: 8 },
    });
    expect(plan.groupingKey).toBe('talk_through');
    expect(plan.responseClass).toBe('procedure_step');
    expect(plan.answerStep.actionContract).toMatchObject({
      id: 'decide-ones',
      label: 'Decide in the ones',
      answerKind: 'voice',
    });
    expect(plan.answerStep.actionContract.instruction).toContain('two minus eight');
  });
});
