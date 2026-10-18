/**
 * Dice Roll items: the challenge types and the helpers the component, levers and workspace share.
 *
 * The dice are the stimulus and the spoken response is the answer. Generated content may choose finalized
 * face values, never lesson language or answer semantics. The tutor's words come from the boss
 * (`diDiceRoll.boss.ts`), not from this module.
 */

import type { JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import {
  diDiceRollModePlan,
  type DiDiceRollMode,
} from './diDiceRollModes';

export type DiDiceRollChallengeType = DiDiceRollMode;

/**
 * The within-mode difficulty key. Where an honest structural lever exists it
 * sets the generated pair shape; it never changes eval mode, magnitude bands,
 * or judging rules.
 */
export type DiDiceRollSupportTier = 'easy' | 'medium' | 'hard';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceComparison = 'left' | 'right' | 'same';

interface DiDiceRollChallengeBase extends JudgedScriptItem {
  challengeType: DiDiceRollChallengeType;
  /** Absent = easy. */
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

export const studentPrompt = (item: DiDiceRollChallenge): string =>
  diDiceRollModePlan(item).steps.map((step) => step.actionContract.instruction).join(' ');
