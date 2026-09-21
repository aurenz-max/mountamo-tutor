/**
 * numberSequencerScript — the RETIRING control protocol for the number train:
 * affirmation and correction wording, the judging contract, the cues and the
 * pack base the standalone judged drill runs on.
 *
 * The task itself — validity gates, item builders, asks, harness answers and the
 * misstep inventory — moved to `numberSequencerDomain` in sunset slice S1
 * (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md). This module
 * re-exports it so the generator, the tester and the drive plan keep one address.
 */
import type { JudgedCueSurface, JudgedCueOptions } from '../../../hooks/judgedScriptContract';
import { sameOrder, type SequencerItem } from './numberSequencerDomain';

export * from './numberSequencerDomain';

const END = 'The quoted line is the only speech on this turn. Bracket tags and private rules are never spoken. Never announce waiting or listening. A verdict ends the turn; only the application supplies the next question. No invented next ask or floor handback.';
const affirm = (i: SequencerItem) => i.challengeType === 'spot-error'
  ? `Yes, ${i.answer} does not belong. ${i.repair} belongs there.` : `Yes, ${i.answer}.`;
const correction = (i: SequencerItem) => `My turn: ${i.challengeType === 'spot-error'
  ? `${i.answer} breaks the count. ${i.repair} belongs there.`
  : i.challengeType === 'count-from' ? `counting ${i.direction}, after ${i.previous} comes ${i.answer}.`
  : `${i.answer} belongs in the missing space.`} Your turn. ${i.actionContract.instruction}`;
export function sequencerJudging(i: SequencerItem): string {
  if (i.answerKind === 'gesture') return 'This is a hands turn. Speech is not an attempt. Only a [NS_ORDER] application cue supplies a code-computed verdict. No spoken number is graded and no ordering is revealed before that cue. ';
  return `Private target: ${i.answer}. Correct answer: say exactly: "${affirm(i)}". Wrong answer: say exactly: "${correction(i)}". `
    + `Accept the asserted number in digits, number words, or a short sentence. Reject negated answers, unresolved multiple guesses, and ${i.challengeType === 'spot-error'
      ? `the replacement ${i.repair} instead of the printed wrong number ${i.answer}`
      : i.challengeType === 'count-from' ? `echoing the starting number ${i.previous} or counting in the opposite direction`
      : 'a visible neighboring number instead of the missing value'}. Silence and questions are not wrong answers. `;
}
const itemCue = (i: SequencerItem, opts: JudgedCueOptions) => `[NS_ITEM] Say exactly: "${opts.opening ? 'Let us work on a number train. ' : ''}${i.actionContract.instruction}" ${sequencerJudging(i)}${END}`;
export function sequencerOrderCue(i: SequencerItem, placed: number[]): string {
  const correct = sameOrder(placed, i.answerOrder);
  return `[NS_ORDER] Code-computed correct=${correct}; placed=${placed.join(',')}. Say exactly: "${correct
    ? 'Yes, the numbers go from smallest to largest.'
    : `My turn: start with the smallest number, then find the next larger number. Your turn. ${i.actionContract.instruction}`}" ${END}`;
}
export function sequencerPackBase(items: SequencerItem[]): JudgedCueSurface<SequencerItem> {
  return { primitiveType: 'number-sequencer', activityLine: 'Complete number trains aloud and arrange number cards.', items,
    itemCue,
    pronounceCue: i => `[NS_HEAR] Say exactly: "${i.actionContract.instruction}" ${sequencerJudging(i)}${END}`,
    moveOnCue: (_i, next, opts) => next ? itemCue(next, { ...opts, opening: false }) : '[NS_DONE] Say exactly: "You worked on number sequences. Nice effort!"',
    completeCue: () => '[NS_DONE] Say exactly: "You worked on number sequences. Nice effort!"',
    contextFor: i => ({ challengeType: i.challengeType, stimulus: 'A number train; only the current scripted cue defines the question. Do not read this description aloud.' }),
  };
}
