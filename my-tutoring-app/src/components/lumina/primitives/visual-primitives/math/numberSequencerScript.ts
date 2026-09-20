import type { DiHarnessAnswers } from '../../../service/qa/di/diDrivePlan';
import type { DiActionContract, JudgedScriptItem, JudgedCueSurface, JudgedCueOptions } from '../../../hooks/judgedScriptContract';
import type { NumberSequencerChallenge } from './NumberSequencer';
import { numberSequencerModePlan } from './numberSequencerModes';
import { resolveScaffolds, type LiveScaffold } from '../../../components/live-activity/runtime/liveScaffolds';

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
/** The question as the runner asks it. The adapter publishes this as the tutor task. */
export const askFor = (i: SequencerItem): string => i.actionContract.instruction;

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

/* ------------------------------------------------------------------ *
 * Live-tutor misstep inventory (see `/add-live-tutor-tools`).
 *
 * Kept beside the correction lines above so the two stay distinguishable: the
 * DI correction STATES the answer and fires however the child was wrong, while
 * these aids name the misstep and never state the answer. Whatever the
 * correction already answers is not repeated here.
 *
 * Missteps deliberately left to another lane:
 *   - "counted correctly but mis-said the number word" — a production error the
 *     spoken judge already accepts or rejects; no visual aid reaches it.
 *   - "does not know the count sequence at all" — between-item remediation, not
 *     an in-item aid.
 *   - "needs the dot arrays or the reference line" — that is the support tier
 *     (R7), a difficulty axis, not an error response.
 * ------------------------------------------------------------------ */

/** What the child has actually done on this item, as the adapter publishes it. */
export interface SequencerMisstepEvidence {
  /** The number we heard, when it parsed. Null on a gesture item or no transcript. */
  heard: number | null;
  /** order-cards: the cards currently on the train, in the child's order. */
  placed: number[];
}

export type SequencerScaffold = LiveScaffold<SequencerItem, SequencerMisstepEvidence>;

/** The visible partner of a before-after gap. */
const visibleNeighbour = (i: SequencerItem) => i.sequence[i.slot === 0 ? 1 : 0] as number;
const descending = (order: number[]) => order.length > 1 && order.every((n, k) => k === 0 || n < order[k - 1]);

/**
 * One method reminder per mode. Always offered while the mode can act, and
 * deliberately number-free: `statesNumber` sweeps every line in the tests, and a
 * decade-fill answer really can be 9, 10 or 20.
 */
const METHOD: Record<NumberSequencerChallenge['type'], SequencerScaffold> = {
  'count-from': { strategyId: 'say-what-comes-next', when: 'the child needs the method again',
    hint: () => 'Start on the number I just said, then say what comes next.' },
  'before-after': { strategyId: 'look-next-to-the-space', when: 'the child needs the method again',
    hint: () => 'Find the number you can see, then say what belongs in the empty space.' },
  'fill-missing': { strategyId: 'count-along-the-train', when: 'the child needs the method again',
    hint: () => 'Count along the train, car by car, starting from a number you can see.' },
  'decade-fill': { strategyId: 'keep-the-count-going', when: 'the child needs the method again',
    hint: () => 'Keep the count going along the train. Do not start it over.' },
  'spot-error': { strategyId: 'read-it-out-loud', when: 'the child needs the method again',
    hint: () => 'Read the train out loud from the front car. Listen for the number that jumps.' },
  'order-cards': { strategyId: 'smallest-goes-first', when: 'the child needs the method again',
    hint: () => 'Find the smallest number and put it first. Then look for the next bigger card.' },
};

/**
 * The error-specific aids, offered only once the published evidence fits. Each
 * `when` states the CONDITION, because the model routes on that sentence.
 */
const AIDS: readonly SequencerScaffold[] = [
  // count-from
  { strategyId: 'not-the-number-we-started-on', when: 'the child said the number the count started on',
    // Not "say the one that comes after": a count-from answer really can be 1, and
    // `statesNumber` reads the word "one" as the number.
    hint: () => 'That is the number we started on. Say what comes after it.',
    matches: (i, e) => i.challengeType === 'count-from' && e.heard !== null && e.heard === i.previous },
  { strategyId: 'we-are-counting-the-other-way', when: 'the child counted in the opposite direction',
    hint: i => `That number comes the other way. We are counting ${i.direction === 'backward' ? 'down' : 'up'}.`,
    matches: (i, e) => i.challengeType === 'count-from' && e.heard !== null
      && e.heard === i.previous + (i.direction === 'backward' ? 1 : -1) },

  // before-after
  { strategyId: 'that-one-is-already-printed', when: 'the child said the number that is already on the train',
    hint: () => 'That number is already on the train. Say what belongs in the empty space.',
    matches: (i, e) => i.challengeType === 'before-after' && e.heard !== null && e.heard === visibleNeighbour(i) },
  { strategyId: 'the-space-is-on-the-other-side', when: 'the child went the wrong way along the train',
    hint: () => 'You went the wrong way along the train. The empty space is on the other side of that number.',
    matches: (i, e) => i.challengeType === 'before-after' && e.heard !== null
      && e.heard === visibleNeighbour(i) + (i.slot === 0 ? 1 : -1) },

  // fill-missing
  { strategyId: 'that-car-already-has-a-number', when: 'the child named a number that is already on a car',
    hint: () => 'That number is already sitting on a car. The empty space needs a different number.',
    matches: (i, e) => i.challengeType === 'fill-missing' && e.heard !== null && i.sequence.includes(e.heard) },
  { strategyId: 'count-the-cars-again', when: 'the child was off by a single step',
    hint: () => 'You are very close. Touch each car as you count along again.',
    matches: (i, e) => i.challengeType === 'fill-missing' && e.heard !== null && Math.abs(e.heard - i.answer) === 1 },

  // decade-fill
  { strategyId: 'do-not-go-back-along-the-train', when: 'the child slipped back to a part of the count already passed',
    hint: () => 'You went back to numbers we already passed. Keep counting forward from the last car you can see.',
    matches: (i, e) => i.challengeType === 'decade-fill' && e.heard !== null
      && Math.floor(e.heard / 10) === Math.floor((i.answer - 1) / 10) && e.heard < i.answer },
  { strategyId: 'move-one-car-at-a-time', when: 'the child jumped far past the next car',
    hint: () => 'That jumped too far ahead. Move along the train car by car.',
    matches: (i, e) => i.challengeType === 'decade-fill' && e.heard !== null
      && Math.floor(e.heard / 10) > Math.floor(i.answer / 10) },

  // spot-error
  { strategyId: 'that-number-fits-the-count', when: 'the child named a number that does fit the count',
    hint: () => 'That number fits the count. Keep reading and listen for the number that jumps.',
    matches: (i, e) => i.challengeType === 'spot-error' && e.heard !== null
      && i.sequence.includes(e.heard) && e.heard !== i.answer },
  { strategyId: 'name-one-you-can-see', when: 'the child named a number that is not on the train at all',
    hint: () => 'Say a number you can see on the train.',
    matches: (i, e) => i.challengeType === 'spot-error' && e.heard !== null && !i.sequence.includes(e.heard) },

  // order-cards (gesture: the evidence is the arrangement, not a transcript)
  { strategyId: 'every-card-gets-a-place', when: 'the child left some cards off the train',
    hint: () => 'There are still cards waiting. Every card gets a place on the train.',
    matches: (i, e) => i.challengeType === 'order-cards'
      && e.placed.length > 0 && e.placed.length < i.answerOrder.length },
  { strategyId: 'start-small-then-grow', when: 'the child arranged the cards from biggest down to smallest',
    hint: () => 'You started with the biggest. Put the smallest card first, then bigger and bigger.',
    matches: (i, e) => i.challengeType === 'order-cards' && descending(e.placed) },
  { strategyId: 'find-the-very-smallest', when: 'the child began with a card that is not the smallest',
    hint: () => 'Look at all the cards and find the very smallest. That card goes first.',
    matches: (i, e) => i.challengeType === 'order-cards' && e.placed.length > 0 && !descending(e.placed)
      && e.placed[0] !== Math.min(...i.answerOrder) },
];

/** The mode's method reminder plus every aid whose evidence currently fits. */
export function sequencerScaffoldsFor(item: SequencerItem | null | undefined,
  evidence: SequencerMisstepEvidence): SequencerScaffold[] {
  return resolveScaffolds(item, evidence, item ? METHOD[item.challengeType] : undefined, AIDS);
}
