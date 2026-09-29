/**
 * numberSequencerDomain — what the number train TEACHES, with no teaching
 * engine attached: the key check both sides of the wire run, the item builders
 * that expand one challenge into its asks, the asks themselves, the workspace
 * assignment and scene, and the harness answer material.
 *
 * Sunset slice S1 for this primitive (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md),
 * following `countingBoardDomain` and `shapeSorterDomain`. `NumberSequencerTeaching`
 * — the tutor/JEV binding — needs the sequence, the slot and the ask and nothing
 * else, but reaching them through `numberSequencerScript` pulled the sentinel
 * scanner, the correction wording and the pack base into the destination
 * architecture's import graph. The split is by ownership:
 *
 *   - HERE: the task and its validity gates. Which trains can be asked, how a
 *     challenge expands into asks, what the child is asked and what counts as the
 *     answer.
 *   - `numberSequencerScript`: the retiring control protocol — affirmation and
 *     correction wording, the judging contract, the cues and the pack base.
 *     It re-exports this module, so the generator, the tester and the drive
 *     plan keep one address.
 *
 * `DiActionContract` is imported as a TYPE only. It describes the learner-facing
 * action, not the cue protocol, and carries no runtime code from the legacy engine.
 */
import type { DiHarnessAnswers } from '../../../service/qa/di/diDrivePlan';
import type { DiActionContract } from '../../../hooks/judgedScriptContract';
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { NumberSequencerChallenge } from './NumberSequencer';
import { NUMBER_SEQUENCER_MODES, numberSequencerModePlan } from './numberSequencerModes';
import { numberMisses, offByMisses, spokenNumber, type KnownMiss, type OffByMiss }
  from '../../../components/live-activity/runtime/spokenMissContract';
import { decadeWord, spokenIntegerWord } from './spokenNumberWords';

const isNumber = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 120;
/** Exported because the order cue and the gesture checker both compare arrangements. */
export const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * What a wrong card arrangement shows (`TeachingAttempt.miss`, handoff 20): `reversed` (largest to smallest),
 * `two_swapped` (only two cards out of place), `other_order`. Undefined for a right one and for spoken items.
 */
export type OrderMiss = 'reversed' | 'two_swapped' | 'other_order';

export function orderMiss(item: SequencerItem | null, placed: number[]): OrderMiss | undefined {
  if (!item || item.answerKind !== 'gesture' || sameOrder(placed, item.answerOrder)) return undefined;
  if (sameOrder(placed, [...item.answerOrder].reverse())) return 'reversed';
  return placed.filter((n, i) => n !== item.answerOrder[i]).length === 2 ? 'two_swapped' : 'other_order';
}

export interface SequencerItem extends TeachingItem {
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
      && (c.sequence.length === 0 || sameOrder(c.sequence as number[], [c.startNumber]))
      && c.correctAnswers.every((n, i) => n === c.startNumber! + sign * (i + 1));
  }
  if (c.type === 'order-cards') {
    const numbers = c.sequence.filter(isNumber);
    return numbers.length >= 3 && numbers.length <= 8 && numbers.length === c.sequence.length
      && new Set(numbers).size === numbers.length
      && sameOrder([...numbers].sort((a, b) => a - b), c.correctAnswers)
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

/**
 * The modes the tutor/JEV teaching workspace binds: every mode, derived from the mode
 * definitions rather than listed. `order_cards` is checked by the activity itself; a
 * checked-wrong arrangement is reopened by the observer, or by the learner's own
 * Try again in the runtime shell (`LiveRuntimeSurface`) when the observer abstains.
 */
export const NUMBER_SEQUENCER_WORKSPACE_MODES = NUMBER_SEQUENCER_MODES.map(mode => mode.evalMode);

/** The question as the runner asks it. The adapter publishes this as the tutor task. */
export const askFor = (i: SequencerItem): string => i.actionContract.instruction;

/** What completes THIS item, said plainly, and what does not. Never the answer. */
export function assignmentFor(item: SequencerItem): string {
  switch (item.challengeType) {
    case 'count-from': return `Say the next number counting ${item.direction} from ${item.previous}. `
      + 'Counting along with the child is teaching; the number the child says is the answer.';
    case 'before-after': return 'Say the number that belongs in the empty car. '
      + 'Reading back the number already printed on the train is not the answer.';
    case 'spot-error': return 'Say which printed number breaks the count. '
      + 'The number that should have been there instead is not the answer to this question.';
    case 'order-cards': return 'Put every card on the train from smallest to largest. '
      + 'The train checks the arrangement itself as soon as the last card is placed.';
    default: return 'Say the number that belongs in the glowing empty car. '
      + 'A number already printed on another car is not the answer.';
  }
}

/** The car the question is about. Spot-error asks about the whole train, so no car glows. */
export const targetSlot = (item: SequencerItem): number => item.challengeType === 'spot-error' ? -1 : item.slot;

/** What a wrong spoken number on the train shows (handoff 20 Part B). */
export type SpokenSequencerMiss = OffByMiss | 'said_start' | 'wrong_direction' | 'skipped_one' | 'said_shown' | 'said_neighbor'
  | 'wrong_side' | 'counted_by_one' | 'said_repair' | 'decade_word' | 'teen_ty_swap';

/** The step of a train with a gap: from its first two printed numbers. */
const trainStep = (seq: (number | null)[]) => {
  const known = seq.flatMap((n, i) => n === null ? [] : [[i, n] as const]);
  return known.length >= 2 ? (known[1][1] - known[0][1]) / (known[1][0] - known[0][0]) : 1;
};

/** One miss naming several printed numbers ("6 or 8"), when any is a real wrong answer. */
const printedMiss = (id: string, values: Array<number | null | undefined>, answer: number, pattern: (ns: string) => string): KnownMiss[] => {
  const ns = Array.from(new Set(values.filter((n): n is number => typeof n === 'number' && n >= 1 && n !== answer)));
  return ns.length ? [{ id, pattern: pattern(ns.join(' or ')), examples: ns.map(spokenNumber) }] : [];
};

/** The sound-alike forms of a spoken number: a teen for its -ty or the reverse, and "twenty-ten" when counting up to a ten. */
function soundAlikeMisses(a: number, countsUp: boolean): KnownMiss[] {
  return [
    ...(a >= 13 && a <= 19 ? [{ id: 'teen_ty_swap', pattern: `The right number is ${spokenIntegerWord(a)}. The learner's answer is `
      + `${decadeWord(a - 10)}, the -ty number that sounds like it.`, examples: [decadeWord(a - 10)] }] : []),
    ...(a >= 30 && a <= 90 && a % 10 === 0 ? [{ id: 'teen_ty_swap', pattern: `The right number is ${spokenIntegerWord(a)}. The learner's `
      + `answer is ${spokenIntegerWord(a / 10 + 10)}, the teen number that sounds like it.`, examples: [spokenIntegerWord(a / 10 + 10)] }] : []),
    ...(countsUp && a >= 30 && a <= 100 && a % 10 === 0 ? [{ id: 'decade_word', pattern: `The number after ${spokenIntegerWord(a - 1)} is `
      + `${spokenIntegerWord(a)}. The learner says ${decadeWord(a / 10 - 1)}-ten, the ones counted on past nine instead of the next ten.`,
      examples: [`${decadeWord(a / 10 - 1)}-ten`] }] : []),
  ];
}

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers on this train
 * (the start said again, the other direction, a printed neighbour, the repair on spot-error), then the sound-alike
 * forms, then the off-by misses not already named.
 */
export function numberSequencerSpokenMisses(item: SequencerItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const a = item.answer, seq = item.sequence;
  const withOffBy = (own: KnownMiss[], of: string) => {
    const said = new Set(own.flatMap(m => m.examples ?? []));
    return [...own, ...offByMisses(a, of).filter(m => !(m.examples ?? []).some(e => said.has(e)))];
  };
  switch (item.challengeType) {
    case 'count-from': {
      const p = item.previous, up = item.direction !== 'backward';
      return [...numberMisses(a, [
        { id: 'said_start', value: p, pattern: n => `The count is at ${n}. The learner's answer is ${n}, the number already said, not the next one.` },
        { id: 'wrong_direction', value: up ? p - 1 : p + 1, pattern: n => `Counting ${item.direction} from ${p}, the next number is ${a}. `
          + `The learner's answer is ${n}, the number on the other side of ${p}.` },
        { id: 'skipped_one', value: 2 * a - p, pattern: n => `Counting ${item.direction} from ${p}, the next number is ${a}. `
          + `The learner's answer is ${n}, one number further on, skipping ${a}.` }]), ...soundAlikeMisses(a, up)];
    }
    case 'before-after': {
      const before = item.slot === 0, shown = seq[before ? 1 : 0]!;
      return [...numberMisses(a, [
        { id: 'said_shown', value: shown, pattern: n => `The printed number is ${n}. The learner's answer is ${n}, that printed number again.` },
        { id: 'wrong_side', value: before ? shown + 1 : shown - 1, pattern: n => `The number ${before ? 'before' : 'after'} ${shown} is ${a}. `
          + `The learner's answer is ${n}, the number ${before ? 'after' : 'before'} ${shown} instead.` },
        { id: 'skipped_one', value: before ? a - 1 : a + 1, pattern: n => `The number ${before ? 'before' : 'after'} ${shown} is ${a}. `
          + `The learner's answer is ${n}, one number further on, skipping ${a}.` }]),
        ...soundAlikeMisses(a, !before)];
    }
    case 'spot-error': {
      const i = item.slot;
      return [...numberMisses(a, [{ id: 'said_repair', value: item.repair, pattern: n => `The printed ${a} breaks the count; ${n} should be in its `
        + `place. The learner's answer is ${n}, the number that belongs there, not the printed number that does not belong.` }]),
        ...printedMiss('said_neighbor', [seq[i - 1], seq[i + 1]], a, ns => `The printed ${a} breaks the count; ${ns} is printed right beside it. `
          + `The learner's answer is ${ns}, a number that does belong in the count.`)];
    }
    default: {
      const step = trainStep(seq), i = item.slot, before = a - step;
      const printed = [seq[i - 1], seq[i + 1]].filter((n): n is number => typeof n === 'number');
      const byOne = Math.abs(step) > 1 ? before + Math.sign(step) : undefined;
      return withOffBy([
        ...printedMiss('said_neighbor', printed, a, ns => `The cars beside the glowing gap show ${ns}. The learner's answer is ${ns}, `
          + 'a number already printed next to the gap.'),
        ...(byOne !== undefined && !printed.includes(byOne) ? numberMisses(a, [{ id: 'counted_by_one', value: byOne,
          pattern: n => `The train counts by ${Math.abs(step)}s and the number before the gap is ${before}. The learner's answer is ${n}, `
            + `the number next to ${before} when counting by ones.` }]) : []),
        ...soundAlikeMisses(a, step === 1),
      ], `the ${a} that belongs in the gap`);
    }
  }
}

/** The item as the tutor and the outcome observer are told it. Gesture items are checked
 *  by the train; the ordered string is what the tutor sees, not a parser. */
export const workspaceAssignment = (item: SequencerItem): TeachingAssignment => {
  const misses = numberSequencerSpokenMisses(item);
  return { id: item.id, task: askFor(item),
    expectedAnswer: item.answerKind === 'gesture' ? item.answerOrder.join(', ') : String(item.answer),
    response: item.answerKind === 'gesture' ? 'gesture' : 'speech', ...(misses.length ? { misses } : {}) };
};

/** `shown` is the drawn train, with slots of this challenge answered earlier filled in;
 *  `placed` is the learner's arrangement so far on an order-cards item. */
export interface SequencerView { shown: (number | null)[]; placed: number[] }

/** The drawn stage: whole cars, or whole cards on an order-cards item. */
export function workspaceScene(item: SequencerItem, { shown, placed }: SequencerView): WorkspaceScene {
  const gesture = item.answerKind === 'gesture';
  const cards = item.sequence.filter((n): n is number => n !== null);
  const target = targetSlot(item);
  return {
    objects: gesture
      ? cards.map(n => ({ id: `card-${n}`, label: `number card ${n}`, selected: placed.includes(n),
        group: placed.includes(n) ? `on the train in place ${placed.indexOf(n) + 1}` : 'still waiting beside the train' }))
      : shown.map((value, position) => ({ id: `car-${position}`,
        label: value === null ? `car ${position + 1}, empty` : `car ${position + 1} showing ${value}`,
        selected: false, group: position === target ? 'assignment target (the glowing empty car)' : 'visible car' })),
    facts: { kind: item.challengeType, assignment: assignmentFor(item),
      ...(item.challengeType === 'count-from' ? { countingDirection: item.direction, countingFrom: item.previous } : {}),
      ...(gesture ? { cardsPlaced: placed.length, cardsWaiting: cards.length - placed.length } : {}),
      markMeaning: 'Purple dashed rings are tutor marks. They never fill a car, move a card or change which car is being asked about.' },
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
