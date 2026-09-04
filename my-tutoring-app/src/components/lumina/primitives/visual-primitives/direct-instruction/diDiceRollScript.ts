/**
 * Hand-authored Direct Instruction script for Dice Roll.
 *
 * The dice are the stimulus and the spoken response is the answer. Exact cue
 * wording stays in code; generated content may choose finalized face values,
 * never lesson language or answer semantics.
 */

import type {
  JudgedCueOptions,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';

export type DiDiceRollChallengeType =
  | 'count_pips'
  | 'compare_dice'
  | 'sum_two_dice';

/**
 * One within-mode difficulty key controls two independent axes: how much
 * strategy is supplied around a retry and, where an honest structural lever
 * exists, the generated pair shape. It never changes eval mode, magnitude
 * bands, or judging rules.
 */
export type DiDiceRollSupportTier = 'easy' | 'medium' | 'hard';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceComparison = 'left' | 'right' | 'same';

const NUMBER_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
};

interface DiDiceRollChallengeBase extends JudgedScriptItem {
  challengeType: DiDiceRollChallengeType;
  /** Absent preserves the pre-L3 correction, which is equivalent to easy. */
  supportTier?: DiDiceRollSupportTier;
  sides: 6;
  /** Finalized before animation starts; the dice never generate scoring state. */
  value: DieValue;
  spokenAnswer: string;
  /** Passive ASR diagnostics only. The Live tutor remains the judge. */
  asrAliases: string[];
}

export interface CountPipsChallenge extends DiDiceRollChallengeBase {
  challengeType: 'count_pips';
  action: 'count_pips';
  answerKind: 'voice';
  responseClass: 'number_word_to_20';
}

export interface CompareDiceChallenge extends DiDiceRollChallengeBase {
  challengeType: 'compare_dice';
  action: 'compare_dice';
  answerKind: 'voice';
  responseClass: 'short_spoken_word';
  secondValue: DieValue;
  comparison: DiceComparison;
}

export interface SumTwoDiceChallenge extends DiDiceRollChallengeBase {
  challengeType: 'sum_two_dice';
  action: 'sum_two_dice';
  answerKind: 'voice';
  responseClass: 'number_word_to_20';
  secondValue: DieValue;
  total: number;
}

export type DiDiceRollChallenge =
  | CountPipsChallenge
  | CompareDiceChallenge
  | SumTwoDiceChallenge;

export const isTwoDiceChallenge = (
  item: DiDiceRollChallenge,
): item is CompareDiceChallenge | SumTwoDiceChallenge =>
  item.challengeType !== 'count_pips';

export const diceValuesFor = (
  item: DiDiceRollChallenge,
): readonly DieValue[] => isTwoDiceChallenge(item)
  ? [item.value, item.secondValue]
  : [item.value];

export const studentPrompt = (item: DiDiceRollChallenge): string => {
  switch (item.challengeType) {
    case 'compare_dice':
      return 'Roll both dice. Which has more: left, right, or same?';
    case 'sum_two_dice':
      return 'Roll both dice. How many dots are there altogether?';
    default:
      return 'Roll the die. Say how many dots you see.';
  }
};

/** Visible retry scaffold. It mirrors the exact spoken correction without
 * exposing the current quantity, total, or relation in application chrome. */
export const retryPrompt = (item: DiDiceRollChallenge): string => {
  const tier = item.supportTier ?? 'easy';
  if (tier === 'hard') return 'Try these dice again.';

  switch (item.challengeType) {
    case 'compare_dice':
      return tier === 'easy'
        ? 'Count each die, match the amounts, and try again.'
        : 'Compare both dot patterns carefully and try again.';
    case 'sum_two_dice':
      return tier === 'easy'
        ? 'Count the left die, then count on with the right die.'
        : 'Count all the dots carefully and try again.';
    default:
      return tier === 'easy'
        ? 'Touch each dot once as you count, then try again.'
        : 'Count the dots carefully and try again.';
  }
};

const openingAsk = (item: DiDiceRollChallenge): string => {
  switch (item.challengeType) {
    case 'compare_dice':
      return 'Tap both dice to roll them. Then tell me which has more: left, right, or same?';
    case 'sum_two_dice':
      return 'Tap both dice to roll them. Then tell me how many dots there are altogether.';
    default:
      return 'Tap the die to roll it. Then tell me how many dots you see.';
  }
};

const steadyAsk = (item: DiDiceRollChallenge): string => {
  switch (item.challengeType) {
    case 'compare_dice':
      return 'Roll both dice. Which has more: left, right, or same?';
    case 'sum_two_dice':
      return 'Roll both dice. How many dots altogether?';
    default:
      return 'Roll it. How many dots?';
  }
};

const compareStatement = (item: CompareDiceChallenge): string =>
  item.comparison === 'same'
    ? 'they show the same amount'
    : `${item.comparison} has more`;

const verifyLine = (item: DiDiceRollChallenge): string => {
  switch (item.challengeType) {
    case 'compare_dice':
      return `Yes, ${compareStatement(item)}.`;
    case 'sum_two_dice':
      return `Yes, ${item.spokenAnswer} dots altogether.`;
    default:
      return `Yes, ${item.spokenAnswer} ${item.value === 1 ? 'dot' : 'dots'}.`;
  }
};

const retryStrategy = (item: DiDiceRollChallenge): string => {
  const tier = item.supportTier ?? 'easy';
  if (tier === 'hard') return '';

  switch (item.challengeType) {
    case 'compare_dice':
      return tier === 'easy'
        ? ' Match the dots across the dice one by one.'
        : ' Compare both dot patterns carefully.';
    case 'sum_two_dice':
      return tier === 'easy'
        ? ' Count the left die, then count on with the right die.'
        : ' Count all the dots carefully.';
    default:
      return tier === 'easy'
        ? ' Touch each dot as you count.'
        : ' Count the dots carefully.';
  }
};

const modelLine = (item: DiDiceRollChallenge): string => {
  const strategy = retryStrategy(item);
  switch (item.challengeType) {
    case 'compare_dice':
      return `My turn: ${compareStatement(item)}.${strategy} Your turn. Which has more: left, right, or same?`;
    case 'sum_two_dice':
      return `My turn: ${NUMBER_WORDS[item.value]} and ${NUMBER_WORDS[item.secondValue]} make ${item.spokenAnswer} dots altogether.${strategy} Your turn. How many dots altogether?`;
    default:
      return `My turn: this die shows ${item.spokenAnswer} ${item.value === 1 ? 'dot' : 'dots'}.${strategy} Your turn. How many dots?`;
  }
};

const contrastModelLine = (item: DiDiceRollChallenge): string =>
  modelLine(item).replace('My turn:', 'My turn: not ⟨what they said⟩ —');

const acceptableResponse = (item: DiDiceRollChallenge): string => {
  if (item.challengeType !== 'compare_dice') return `the number "${item.spokenAnswer}"`;
  if (item.comparison === 'same') return '"same", "equal", or "tie"';
  return `"${item.comparison}", "the ${item.comparison} one", or "the ${item.comparison} die"`;
};

const judgingContract = (item: DiDiceRollChallenge): string => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against ${acceptableResponse(item)}:
- If the learner gives that answer clearly${item.challengeType === 'sum_two_dice' ? `, either straight away or by counting aloud and ending on ${item.spokenAnswer}` : ''}, say exactly "${verifyLine(item)}" and stop.
- If the learner gives a DIFFERENT answer, say exactly "${contrastModelLine(item)}" and stop, then wait again. Replace ⟨what they said⟩ with the answer actually heard. Never speak the ⟨ ⟩ marks.
- If there is no answer, or the response is unrelated, say exactly "${modelLine(item)}" and stop, then wait again.
Judge the answer heard, never the answer expected.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After an affirmation, wait silently for the application's next instruction.`;

/** First exposure to an action explains the physical roll; repeats stay brisk. */
export const itemCue = (
  item: DiDiceRollChallenge,
  opts: JudgedCueOptions,
): string => {
  const ask = opts.opening || opts.howToPlay ? openingAsk(item) : steadyAsk(item);
  return `[DICE_ITEM] Say exactly: "${ask}" ${judgingContract(item)}`;
};

export const moveOnCue = (
  _item: DiDiceRollChallenge,
  next: DiDiceRollChallenge | null,
): string => next
  ? `[DICE_MOVE_ON] Say exactly: "Good try. Let's roll the next one. ${steadyAsk(next)}" ${judgingContract(next)}`
  : '[DICE_MOVE_ON] Say exactly: "Good try. We will practice more later. That is the end of dice time."';

export const completeCue = (): string =>
  '[DICE_COMPLETE] Say exactly: "That is the end of dice time. Great work today!" Then stop — the activity is over.';

/** Runtime context is action-side only. Values, totals, and correct relations stay absent. */
export const contextFor = (
  item: DiDiceRollChallenge,
): Record<string, string> => ({
  challengeType: item.challengeType,
  supportTier: item.supportTier ?? 'easy',
  interaction: item.challengeType === 'count_pips'
    ? 'tap one die, inspect its pips, answer aloud'
    : item.challengeType === 'sum_two_dice'
      ? 'tap two dice, combine all visible pips, answer aloud'
      : 'tap two dice, compare their visible pip quantities, answer left, right, or same aloud',
});
