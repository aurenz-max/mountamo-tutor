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

function spoken(item: NumberBondItem, view: NumberBondView): { task: string; answer: number } {
  if (item.splitPhase === 'say') {
    const q = splitQuestion(item, view.counters);
    return { task: q.ask, answer: q.answer };
  }
  if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
    const q = relatedQuestion(item, relatedCounters(item, view.counters));
    return { task: q.ask, answer: q.answer };
  }
  return { task: askFor(item), answer: item.answer };
}

export function workspaceAssignment(item: NumberBondItem, view: NumberBondView): TeachingAssignment {
  if (item.answerKind !== 'gesture') {
    const { task, answer } = spoken(item, view);
    return { id: item.id, task, response: 'speech', expectedAnswer: String(answer) };
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
