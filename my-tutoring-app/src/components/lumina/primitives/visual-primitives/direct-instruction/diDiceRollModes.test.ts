import { describe, expect, it } from 'vitest';
import {
  DI_DICE_ROLL_CHALLENGE_TYPES,
  DI_DICE_ROLL_EVAL_MODES,
  DI_DICE_ROLL_MODES,
  DI_DICE_ROLL_TYPE_DOCS,
  diDiceRollModePlan,
} from './diDiceRollModes';

describe('DI Dice Roll mode definition pilot', () => {
  it('projects the existing catalog ladder and generator docs from one registry', () => {
    expect(DI_DICE_ROLL_EVAL_MODES.map((mode) => [mode.evalMode, mode.beta])).toEqual([
      ['count_pips', 1.5],
      ['compare_dice', 2.5],
      ['sum_two_dice', 3.5],
    ]);
    expect(DI_DICE_ROLL_CHALLENGE_TYPES).toEqual(['count_pips', 'compare_dice', 'sum_two_dice']);
    expect(Object.keys(DI_DICE_ROLL_TYPE_DOCS)).toEqual(DI_DICE_ROLL_CHALLENGE_TYPES);
    expect(DI_DICE_ROLL_MODES.every((mode) => mode.steps.length === 2)).toBe(true);
  });

  it.each([
    ['count_pips', 'number_word_to_20', 'Tap the die to roll it.', 'Say how many dots you see.'],
    ['compare_dice', 'short_spoken_word', 'Tap both dice to roll them.', 'Say which has more: left, right, or same.'],
    ['sum_two_dice', 'number_word_to_20', 'Tap both dice to roll them.', 'Say how many dots there are altogether.'],
  ] as const)('builds the complete %s learner story', (challengeType, responseClass, hands, voice) => {
    const plan = diDiceRollModePlan({ id: `item-${challengeType}`, challengeType });
    expect(plan.responseClass).toBe(responseClass);
    expect(plan.groupingKey).toBe(challengeType);
    expect(plan.steps.map((step) => step.answerKind)).toEqual(['gesture', 'voice']);
    expect(plan.steps[0].actionContract.instruction).toBe(hands);
    expect(plan.answerStep.actionContract.instruction).toBe(voice);
  });
});
