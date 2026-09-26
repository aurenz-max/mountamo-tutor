/**
 * di-dice-roll on the shared tutor/JEV teaching workspace (rollout C6), through `DiTeachingStage`.
 * Each item is a roll the learner makes (a tap, not an answer) and then one spoken answer: how many
 * dots, which die has more, or how many altogether. Pure: the component and the journey read the same
 * assignment and scene.
 *
 * The roll is the learner's, and nothing can be answered before it: until the dice land the workspace
 * reports `readyForResponse: false` and the scene says the dice are still covered. What the scripted
 * judging contract carried that is task structure stays in the key: counting aloud that lands on the
 * total is the answer, and a comparison has three answers ("left", "right", "same") in the child's words.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { DI_DICE_ROLL_MODES } from './diDiceRollModes';
import { diceValuesFor, isTwoDiceChallenge, studentPrompt, type DiDiceRollChallenge } from './diDiceRollScript';

const MODES = new Set<string>(DI_DICE_ROLL_MODES.map(definition => definition.evalMode));
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** The roll instruction, then the ask. Neither names a value: the dice are covered until the roll. */
export const diceAskFor = (item: DiDiceRollChallenge): string => studentPrompt(item);

export function diceKey(item: DiDiceRollChallenge): string {
  if (item.challengeType === 'compare_dice') {
    return item.comparison === 'same'
      ? '"same" (also accept "equal", "a tie", or "they are the same")'
      : `"${item.comparison}" (also accept "the ${item.comparison} one" or "the ${item.comparison} die")`;
  }
  const counted = item.challengeType === 'sum_two_dice'
    ? `Counting all the dots aloud and ending on ${item.spokenAnswer} is the answer.`
    : `Counting the dots aloud and ending on ${item.spokenAnswer} is the answer.`;
  return `"${item.spokenAnswer}". ${counted}`;
}

export function diceAssignment(item: DiDiceRollChallenge): TeachingAssignment {
  return { id: item.id, task: diceAskFor(item), response: 'speech', expectedAnswer: diceKey(item) };
}

export function diceScene(item: DiDiceRollChallenge, view: { ready: boolean }): WorkspaceScene {
  const two = isTwoDiceChallenge(item);
  const dice = two ? 'two dice, left and right' : 'one die';
  return {
    objects: [{ id: 'dice', selected: false, group: 'assignment target', label: dice }],
    facts: { kind: item.challengeType, ...(item.supportTier ? { supportTier: item.supportTier } : {}),
      rolled: view.ready ? 'yes' : 'no',
      constraints: view.ready
        ? `The learner rolled ${two ? 'the dice' : 'the die'}; the dots are showing and no number is printed. `
          + 'The learner answers aloud.'
        : `The ${two ? 'dice are' : 'die is'} still covered. The learner taps ${two ? 'them' : 'it'} to roll; `
          + 'there is nothing to answer until then, and you cannot roll for them.' },
  };
}

/** The journey's answers: the key's word, or a plainly different one. */
export function diDiceRollHarnessAnswers(item: DiDiceRollChallenge): { correct: string; plainWrong: string } {
  if (item.challengeType === 'compare_dice') {
    return { correct: item.comparison, plainWrong: item.comparison === 'left' ? 'right' : 'left' };
  }
  const n = item.challengeType === 'sum_two_dice' ? item.total : item.value;
  return { correct: item.spokenAnswer, plainWrong: WORDS[n >= 2 ? n - 1 : n + 1] };
}

/** An item the stage can ask: a known mode, die faces 1-6, and an answer that matches them. */
export function diceChallengeValid(item: DiDiceRollChallenge): boolean {
  if (!item || typeof item.id !== 'string' || !MODES.has(item.challengeType) || !item.spokenAnswer?.trim()) return false;
  const faces = diceValuesFor(item);
  if (!faces.every(v => Number.isInteger(v) && v >= 1 && v <= 6)) return false;
  if (item.challengeType === 'sum_two_dice') return item.total === item.value + item.secondValue;
  if (item.challengeType === 'compare_dice') {
    const expected = item.value === item.secondValue ? 'same' : item.value > item.secondValue ? 'left' : 'right';
    return item.comparison === expected;
  }
  return true;
}
