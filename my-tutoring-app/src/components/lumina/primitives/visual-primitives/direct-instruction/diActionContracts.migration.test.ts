import { describe, expect, it } from 'vitest';
import {
  itemCue as shapeCue,
  withShapesAction,
  type DiShapesChallenge,
} from './diShapesScript';
import {
  diceRollGestureAction,
  itemCue as diceCue,
  studentPrompt,
  withDiceRollAction,
  type DiDiceRollChallenge,
} from './diDiceRollScript';

const shape: DiShapesChallenge = {
  id: 'shape-triangle', challengeType: 'name_shape', shape: 'triangle',
  shapeWord: 'triangle', article: 'a', sides: 3, corners: 3,
  rotationDeg: 0, asrAliases: ['triangle'],
};
const dice: DiDiceRollChallenge = {
  id: 'dice-four', challengeType: 'count_pips', action: 'count_pips',
  answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6, value: 4,
  spokenAnswer: 'four', asrAliases: ['four', '4'],
};

describe('legacy DI action-contract migration', () => {
  it.each([
    ['shapes', withShapesAction(shape), shapeCue(shape, true)],
  ])('%s exposes the exact spoken ask as its visible voice action', (_name, item, cue) => {
    expect(item.answerKind).toBe('voice');
    expect(item.actionContract.answerKind).toBe('voice');
    expect(item.actionContract.instruction.trim()).not.toBe('');
    expect(cue).toContain(item.actionContract.instruction);
  });

  it('dice exposes its hands step and voice step in the same code-owned story', () => {
    const roll = diceRollGestureAction(dice);
    const answer = withDiceRollAction(dice).actionContract;
    const prompt = studentPrompt(dice);
    const cue = diceCue(dice, { opening: true, howToPlay: true });

    expect(roll.answerKind).toBe('gesture');
    expect(answer.answerKind).toBe('voice');
    expect(prompt).toContain(roll.instruction);
    expect(prompt).toContain(answer.instruction);
    expect(cue).toContain(roll.instruction);
    expect(cue).toContain(answer.instruction);
  });
});
