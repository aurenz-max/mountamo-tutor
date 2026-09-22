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

const isNumber = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 120;
/** Exported because the order cue and the gesture checker both compare arrangements. */
export const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

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

/** The item as the tutor and the outcome observer are told it. Gesture items are checked
 *  by the train; the ordered string is what the tutor sees, not a parser. */
export const workspaceAssignment = (item: SequencerItem): TeachingAssignment => ({ id: item.id, task: askFor(item),
  expectedAnswer: item.answerKind === 'gesture' ? item.answerOrder.join(', ') : String(item.answer),
  response: item.answerKind === 'gesture' ? 'gesture' : 'speech' });

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
