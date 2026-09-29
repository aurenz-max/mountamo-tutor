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
import { offByMisses, spokenNumber, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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

/** What a wrong spoken answer about the dice shows (handoff 20 Part B). */
export type SpokenDiceMiss = OffByMiss | 'skipped_a_number' | 'other_die' | 'said_same' | 'picked_a_side' | 'said_number' | 'said_addend';

const dots = (n: number) => `${n} dot${n === 1 ? '' : 's'}`;

/**
 * A rolled item's known wrong answers, in precedence order, for the `spoken_miss` observer: the dots on the dice
 * stated first, then the learner's word. Concrete per roll, never a cause.
 */
export function diceSpokenMisses(item: DiDiceRollChallenge): KnownMiss[] {
  if (item.challengeType === 'count_pips') {
    return [...(item.value >= 3 ? [{ id: 'skipped_a_number', pattern: 'The learner counts aloud and leaves a number out of the counting sequence, whatever number they end on.',
      examples: ['one, two, four'] }] : []), ...offByMisses(item.value, `the ${dots(item.value)} on the die`)];
  }
  const fact = `The left die shows ${dots(item.value)} and the right die shows ${dots(item.secondValue)}.`;
  if (item.challengeType === 'sum_two_dice') {
    const addends = Array.from(new Set([item.value, item.secondValue])).filter(v => v !== item.total);
    return [...(addends.length ? [{ id: 'said_addend', pattern: `${fact} The learner's answer is ${addends.join(' or ')}, the dots on one die, not both together.`,
      examples: addends.map(spokenNumber) }] : []), ...offByMisses(item.total, `the ${item.total} dots on both dice together`)];
  }
  const numbers = Array.from(new Set([item.value, item.secondValue]));
  const said: KnownMiss = { id: 'said_number', pattern: `${fact} The learner says a number (${numbers.join(' or ')}) and not left, right or same.`,
    examples: [spokenNumber(Math.max(...numbers))] };
  if (item.comparison === 'same') {
    return [{ id: 'picked_a_side', pattern: `${fact} The learner's answer is left or right, one die, not that they are the same.`, examples: ['left', 'right'] }, said];
  }
  const other = item.comparison === 'left' ? 'right' : 'left';
  return [
    { id: 'other_die', pattern: `${fact} The learner's answer is ${other}, the die with fewer dots.`, examples: [other, `the ${other} one`] },
    { id: 'said_same', pattern: `${fact} The learner's answer is that they are the same.`, examples: ['same'] },
    said,
  ];
}

export function diceAssignment(item: DiDiceRollChallenge): TeachingAssignment {
  const misses = diceSpokenMisses(item);
  return { id: item.id, task: diceAskFor(item), response: 'speech', expectedAnswer: diceKey(item), ...(misses.length ? { misses } : {}) };
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
