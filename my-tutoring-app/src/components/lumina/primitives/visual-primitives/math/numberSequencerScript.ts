import type { DiHarnessAnswers } from '../../../service/qa/di/diDrivePlan';
import type { DiActionContract, JudgedScriptItem, JudgedCueSurface, JudgedCueOptions } from '../../../hooks/judgedScriptContract';
import type { NumberSequencerChallenge } from './NumberSequencer';
import { numberSequencerModePlan } from './numberSequencerModes';

export interface SequencerItem extends JudgedScriptItem {
  sourceId: string;
  challengeType: NumberSequencerChallenge['type'];
  actionContract: DiActionContract;
  sequence: (number | null)[];
  slot: number;
  answer: number;
  answerOrder: number[];
  previous: number;
  direction: 'forward' | 'backward';
  repair?: number;
  rangeMin: number;
  rangeMax: number;
}
const isNumber = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 120;
const equal = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Independent key check. Cached and generated content pass the same gate.
 * Zero is outside the spoken-number contract; no invalid key is repaired here. */
export function sequencerChallengeValid(c: NumberSequencerChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id.trim() || !Array.isArray(c.sequence)
    || !Array.isArray(c.correctAnswers) || !c.correctAnswers.length
    || !c.correctAnswers.every(isNumber) || c.sequence.some(v => v !== null && !isNumber(v))) return false;
  const values = [...c.sequence.filter(isNumber), ...c.correctAnswers, ...(c.startNumber === undefined ? [] : [c.startNumber])];
  if (!values.every(isNumber) || c.rangeMin !== Math.min(...values) || c.rangeMax !== Math.max(...values)) return false;
  if (c.type === 'count-from') {
    const sign = c.direction === 'backward' ? -1 : 1;
    return isNumber(c.startNumber) && c.correctAnswers.length <= 6
      && (c.direction === undefined || c.direction === 'forward' || c.direction === 'backward')
      && (c.sequence.length === 0 || equal(c.sequence as number[], [c.startNumber]))
      && c.correctAnswers.every((n, i) => n === c.startNumber! + sign * (i + 1));
  }
  if (c.type === 'order-cards') {
    const numbers = c.sequence.filter(isNumber);
    return numbers.length >= 3 && numbers.length <= 8 && numbers.length === c.sequence.length
      && new Set(numbers).size === numbers.length
      && equal([...numbers].sort((a, b) => a - b), c.correctAnswers)
      && numbers.every((n, i) => n !== c.correctAnswers[i])
      && !numbers.some((n, i) => i > 1 && Math.abs(n - numbers[i - 1]) === 1 && n - numbers[i - 1] === numbers[i - 1] - numbers[i - 2]);
  }
  if (c.type === 'spot-error') {
    const i = c.wrongIndex;
    if (!Number.isInteger(i) || i! <= 0 || i! >= c.sequence.length - 1 || c.sequence.length < 5
      || c.sequence.length > 7 || c.sequence.includes(null) || c.correctAnswers.length !== 1) return false;
    const start = c.sequence[0]!;
    return c.correctAnswers[0] === start + i! && c.sequence[i!] !== c.correctAnswers[0]
      && c.sequence.every((n, index) => index === i || n === start + index);
  }
  if (!['fill-missing', 'before-after', 'decade-fill'].includes(c.type)) return false;
  if (c.sequence.length < 2 || c.sequence.length > 12 || c.sequence.filter(n => n === null).length !== c.correctAnswers.length) return false;
  let key = 0;
  const full = c.sequence.map(n => n === null ? c.correctAnswers[key++] : n);
  const step = full[1] - full[0];
  if (step === 0 || !full.every((n, i) => i === 0 || n - full[i - 1] === step)) return false;
  if (c.type === 'before-after') return full.length === 2 && c.correctAnswers.length === 1 && step === 1;
  if (c.sequence.filter(isNumber).length < 2) return false;
  return c.type !== 'decade-fill' || (step === 1 && Math.floor(full[0] / 10) !== Math.floor(full[full.length - 1] / 10));
}

export function sequencerItemsForChallenge(c: NumberSequencerChallenge): SequencerItem[] {
  if (!sequencerChallengeValid(c)) return [];
  const direction = c.direction === 'backward' ? 'backward' : 'forward';
  const targets = c.type === 'order-cards' ? [-1] : c.type === 'count-from'
    ? c.correctAnswers.map((_, i) => i + 1) : c.type === 'spot-error' ? [c.wrongIndex!]
    : c.sequence.flatMap((n, i) => n === null ? [i] : []);
  return targets.map((slot, index) => {
    const sequence = c.type === 'count-from'
      ? [c.startNumber!, ...c.correctAnswers.map(() => null)] : [...c.sequence];
    const previous = c.type === 'count-from' ? (index === 0 ? c.startNumber! : c.correctAnswers[index - 1]) : 0;
    const answer = c.type === 'spot-error' ? c.sequence[slot]! : c.correctAnswers[index];
    let ask: string;
    if (c.type === 'order-cards') ask = `Put ${c.sequence.join(', ')} in order from smallest to largest.`;
    else if (c.type === 'count-from') ask = `Count ${direction} from ${previous}. What is the next number?`;
    else if (c.type === 'before-after') ask = `What number comes ${slot === 0 ? 'before' : 'after'} ${c.sequence[slot === 0 ? 1 : 0]}?`;
    else if (c.type === 'spot-error') ask = `Listen to this count: ${c.sequence.join(', ')}. Which number does not belong? Say that number.`;
    else ask = `Look at the number train: ${c.sequence.map((n, i) => i === slot ? 'hmm' : n === null ? 'blank' : n).join(', ')}. What number belongs in the glowing space?`;
    const plan = numberSequencerModePlan({ id: `${c.id}:${slot}`, challengeType: c.type, answer, ask });
    return { id: plan.answerStep.id, sourceId: c.id, challengeType: c.type, action: plan.groupingKey,
      answerKind: plan.answerStep.answerKind, responseClass: plan.answerStep.responseClass,
      actionContract: plan.answerStep.actionContract, sequence, slot, answer, previous, direction,
      answerOrder: c.type === 'order-cards' ? [...c.correctAnswers] : [],
      repair: c.type === 'spot-error' ? c.correctAnswers[0] : undefined, rangeMin: c.rangeMin, rangeMax: c.rangeMax };
  });
}

/** Preserve complete problems and give each mode a place before adding repeats.
 * Repeated numbers in a counting run are intentional dependencies, not new cold probes. */
export function buildSequencerItems(challenges: NumberSequencerChallenge[]) {
  const groups = challenges.map(c => ({ c, items: sequencerItemsForChallenge(c) }));
  const seenModes = new Set<string>();
  const first = groups.filter(g => g.items.length && !seenModes.has(g.c.type) && !!seenModes.add(g.c.type));
  const ordered = [...first, ...groups.filter(g => !first.includes(g))];
  const ids = new Set<string>();
  const windows = new Set<string>();
  const items: SequencerItem[] = [];
  let droppedChallenges = 0;
  for (const { c, items: group } of ordered) {
    if (!group.length) { droppedChallenges++; continue; }
    const window = `${c.type}:${Array.from(new Set([...c.sequence.filter(isNumber), ...c.correctAnswers])).sort((a, b) => a - b).join(',')}`;
    if (ids.has(c.id) || windows.has(window) || items.length + group.length > 18) { droppedChallenges++; continue; }
    ids.add(c.id); windows.add(window); items.push(...group);
  }
  return { items, droppedChallenges };
}

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
  const correct = equal(placed, i.answerOrder);
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
export function sequencerHarnessAnswers(i: SequencerItem): DiHarnessAnswers {
  if (i.answerKind === 'gesture') return { correct: i.answerOrder.join(','), plainWrong: [...i.answerOrder].reverse().join(','),
    tapped: { correct: i.answerOrder.join(','), wrong: [...i.answerOrder].reverse().join(',') }, leakTokens: [] };
  return { correct: String(i.answer), plainWrong: String(i.answer === 120 ? 118 : i.answer + 2),
    signatureWrong: { text: String(i.repair ?? (i.previous || (i.answer === 1 ? 2 : i.answer - 1))),
      why: i.repair ? 'Names the repair instead of the printed wrong value.' : 'Echoes the anchor or names the neighbor instead of the missing value.' },
    leakTokens: [String(i.answer)],
    ...(i.challengeType === 'spot-error' ? { leakExemptSpan: i.sequence.join(', ') } : {}) };
}
