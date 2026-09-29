/**
 * Number bond on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The
 * items still come from `buildBondItems` + `expandNumberBondInteractions`; each
 * item's task is the pack's own ask, taken from the quoted line of its cue, so
 * the tutor hears the same words without the cue's judging protocol. A spoken
 * phase that asks about the child's own split reads its question and answer
 * from the counters as they stand.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askFor, type NumberBondItem } from './numberBondScript';
import { splitAndSayCue, splitCounts, splitQuestion, type BondCounters } from './numberBondSplit';
import { bondActionOf, countersForAction, groupsForBond, numberBondInteractionCue, relatedQuestion } from './numberBondModes';

export interface NumberBondView {
  counters: BondCounters;
  found: ReadonlyArray<readonly [number, number]>;
  tiles: readonly string[];
}

/** The catalog mode a challenge type is tracked under. */
export const evalModeForKind = (kind: NumberBondItem['kind']) => kind.replace(/-/g, '_');

const quoted = (cue: string) => cue.match(/Say exactly: "([^"]*)"/)?.[1]?.trim() || null;

/** The counters a related question is asked about: the committed move, or the modelled one. */
const relatedCounters = (item: NumberBondItem, counters: BondCounters) =>
  item.bondAction && bondActionOf(counters, groupsForBond(item)) !== item.bondAction
    ? countersForAction(item, item.bondAction) : counters;

/**
 * A spoken phase's ask and key, with the other numbers it says or shows: `given`, the part the ask names;
 * `taken`, the part a take-away removes.
 */
function spoken(item: NumberBondItem, view: NumberBondView): { task: string; answer: number; given?: number; taken?: number } {
  if (item.splitPhase === 'say') {
    const q = splitQuestion(item, view.counters);
    return { task: q.ask, answer: q.answer, given: q.known };
  }
  if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
    const q = relatedQuestion(item, relatedCounters(item, view.counters));
    return item.interactionPhase === 'related-say-addend' ? { task: q.ask, answer: q.answer, given: item.whole - q.answer }
      : { task: q.ask, answer: q.answer, taken: item.whole - q.answer };
  }
  return { task: askFor(item), answer: item.answer, ...(item.kind === 'missing-part' ? { given: item.knownPart } : {}) };
}

/** What a wrong spoken part shows (handoff 20 Part B): the bond's own numbers first, then the off-by misses. */
export type SpokenBondMiss = OffByMiss | 'said_ten' | 'said_whole' | 'said_given_part' | 'said_change' | 'added_both';

/**
 * A spoken phase's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers this
 * bond says or shows (the ten, the part the ask names, the part taken away, the whole), then the off-by misses.
 */
export function numberBondSpokenMisses(item: NumberBondItem, view: NumberBondView): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const { answer, given, taken } = spoken(item, view), w = item.whole;
  if (item.kind === 'ten-and-ones') return [...numberMisses(answer, [
    { id: 'said_ten', value: 10, pattern: n => `The whole is ${w}, made of a ten and some ones. The learner's answer is only ${n}, the ten, with no number of ones.` },
    { id: 'said_whole', value: w, pattern: n => `The whole is ${n}. The learner's answer is ${n}, the whole number, not the ones in it.` }]),
    ...offByMisses(answer, `the ${answer} ones`)];
  const other = given ?? taken;
  const own = numberMisses(answer, [
    { id: 'said_given_part', value: given, pattern: n => `The question already names a part of ${n}. The learner's answer is ${n}, that part again, not the other part.` },
    { id: 'said_change', value: taken, pattern: n => `${n} are taken away from the whole. The learner's answer is ${n}, the number taken away, not how many are left.` },
    { id: 'said_whole', value: w, pattern: n => `The whole is ${n}. The learner's answer is ${n}, the whole, not ${taken !== undefined ? 'how many are left' : 'the other part'}.` },
    { id: 'added_both', value: item.splitPhase || other === undefined ? undefined : w + other,
      pattern: n => `The two numbers in the question are ${w} and ${other}. The learner's answer is ${n}, those two numbers added together.` },
  ]);
  const of = taken !== undefined ? `the ${answer} left` : item.splitPhase ? `the ${answer} in the highlighted part` : `the ${answer} in the other part`;
  return [...own, ...offByMisses(answer, of)];
}

export function workspaceAssignment(item: NumberBondItem, view: NumberBondView): TeachingAssignment {
  if (item.answerKind !== 'gesture') {
    const { task, answer } = spoken(item, view);
    const misses = numberBondSpokenMisses(item, view);
    return { id: item.id, task, response: 'speech', expectedAnswer: String(answer), ...(misses.length ? { misses } : {}) };
  }
  // A hands phase: the frame's ask, checked by code at commit, so the tutor is not handed a key.
  const cue = item.splitPhase ? splitAndSayCue(item, {}, view.counters, view.found)
    : item.interactionPhase ? numberBondInteractionCue(item, {}, view.counters) : '';
  return { id: item.id, task: quoted(cue) ?? askFor(item), response: 'gesture' };
}

export function workspaceScene(item: NumberBondItem, view: NumberBondView): WorkspaceScene {
  const { whole, left, right } = splitCounts(view.counters);
  // Counter counts only where the board is what the item is about. On a missing-part turn the
  // counters are optional support, and "0 in each part" beside a credited "three" reads as a
  // contradiction to the observer (the LA-13 `counted: 0` finding).
  const boardAsked = item.answerKind === 'gesture' || item.splitPhase === 'say'
    || item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder';
  return {
    objects: [],
    facts: {
      kind: item.kind, phase: item.splitPhase ?? item.interactionPhase ?? 'answer', bondWhole: item.whole,
      ...(boardAsked ? { countersInWhole: whole, countersInLeftPart: left, countersInRightPart: right } : {}),
      ...(view.found.length ? { pairsAlreadyMade: view.found.map(([a, b]) => `${a} and ${b}`).join('; ') } : {}),
      ...(view.tiles.length ? { equationBuilt: view.tiles.join(' ') } : {}),
      constraints: item.answerKind === 'gesture'
        ? 'The learner answers with the counters or tiles. The activity checks the committed work once the learner stops.'
        : 'The learner says the number.',
    },
  };
}
