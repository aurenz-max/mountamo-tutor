/**
 * Timeline builder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component, the journey row and any probe read the same bank order, assignment and scene. The
 * learner places every event in a slot and presses Check Order; the activity's own check is the judge, so the
 * tutor is never handed `correctPosition` or the order.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TimelineBuilderChallenge, TimelineEvent } from './TimelineBuilder';

export function workspaceAssignment(challenge: TimelineBuilderChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

/**
 * The order the event bank shows. The generator sorts `events` by `correctPosition`, so drawing them as given
 * printed the answer left to right. A shuffle seeded by the challenge (stable across renders and mounts), never
 * the timeline's own order.
 */
export function bankOrder(challenge: TimelineBuilderChallenge): TimelineEvent[] {
  const events = [...challenge.events];
  let seed = 0;
  for (const ch of `${challenge.id}|${events.map(e => e.label).join('|')}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = events.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [events[i], events[j]] = [events[j], events[i]];
  }
  // Neither time order nor its reverse (reversing the bank would be the whole answer): a rotation breaks both.
  const runs = (sign: number) => events.every((e, i) => i === 0 || sign * (e.correctPosition - events[i - 1].correctPosition) > 0);
  return (runs(1) || runs(-1)) && events.length > 1 ? [...events.slice(1), events[0]] : events;
}

export interface TimelineView {
  /** Slot index (left to right) → placed event id. */
  placements: Readonly<Record<number, string>>;
  /** After a check, until Try again: the slots the screen marks right and wrong. */
  marked: { right: readonly number[]; wrong: readonly number[] } | null;
  /** The challenge's hint, once the learner opened it. */
  hintShown: boolean;
}

const labelOf = (challenge: TimelineBuilderChallenge, id: string | undefined) =>
  challenge.events.find(e => e.id === id)?.label;

/** The learner's work in their own terms, never the key. */
export function describeTimelineWork(challenge: TimelineBuilderChallenge, view: TimelineView): string {
  const slots = challenge.events.map((_, i) => labelOf(challenge, view.placements[i]));
  if (slots.every(s => !s)) return 'No event placed yet';
  return `Placed, from ${challenge.scaleStart} to ${challenge.scaleEnd}: `
    + slots.map((s, i) => `slot ${i + 1} ${s ? `"${s}"` : 'empty'}`).join(', ');
}

/**
 * What a wrong order shows (`TeachingAttempt.miss`, handoff 20), read from the placed order alone:
 * - `reversed`: latest to earliest, every event mirrored;
 * - `adjacent_swap`: two neighbouring events traded places, the rest right (events close in time);
 * - `two_swapped`: two events further apart traded places, the rest right;
 * - `one_moved`: one event put in the wrong place, the others in the right order around it;
 * - `mixed_order`: anything else.
 */
export type TimelineMiss = 'reversed' | 'adjacent_swap' | 'two_swapped' | 'one_moved' | 'mixed_order';
export const TIMELINE_MISSES: readonly TimelineMiss[] = ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

/** The correct position of the event in each slot, left to right; null while a slot is empty. */
function placedPositions(challenge: TimelineBuilderChallenge, placements: TimelineView['placements']): number[] | null {
  const seq = challenge.events.map((_, i) => challenge.events.find(e => e.id === placements[i])?.correctPosition);
  return seq.every((p): p is number => typeof p === 'number') ? seq : null;
}

export function timelineCorrect(challenge: TimelineBuilderChallenge, placements: TimelineView['placements']): boolean {
  const seq = placedPositions(challenge, placements);
  return !!seq && seq.every((p, i) => p === i);
}

export function timelineMiss(challenge: TimelineBuilderChallenge | null, placements: TimelineView['placements']): TimelineMiss | undefined {
  if (!challenge) return undefined;
  const seq = placedPositions(challenge, placements);
  if (!seq || seq.every((p, i) => p === i)) return undefined;
  const n = seq.length;
  if (seq.every((p, i) => p === n - 1 - i)) return 'reversed';
  const off = seq.flatMap((p, i) => (p === i ? [] : [i]));
  if (off.length === 2 && seq[off[0]] === off[1] && seq[off[1]] === off[0])
    return off[1] - off[0] === 1 ? 'adjacent_swap' : 'two_swapped';
  // One event out of place: without it, the rest run in order.
  if (seq.some((_, k) => seq.filter((__, i) => i !== k).every((p, i, rest) => i === 0 || p > rest[i - 1]))) return 'one_moved';
  return 'mixed_order';
}

/** What is drawn and asked. The events are listed in the bank's order; the timeline's order is not. */
export function workspaceScene(challenge: TimelineBuilderChallenge, view: TimelineView): WorkspaceScene {
  const bank = bankOrder(challenge);
  const facts: Record<string, string | number> = {
    kind: `${challenge.type} timeline`,
    title: challenge.title,
    scale: `${challenge.events.length} slots from ${challenge.scaleStart} on the left to ${challenge.scaleEnd} on the right`,
    events: `${bank.map(e => e.label).join('; ')} (shown in a mixed-up bank, not in time order)`,
  };
  // Each card's own line, one fact per card so a long line stays one short fact.
  bank.forEach((e, i) => { if (e.description) facts[`card${i + 1}`] = `${e.label}: ${e.description}`; });
  if (view.hintShown && challenge.hint) facts.hintOnScreen = challenge.hint;
  facts.learnerWork = describeTimelineWork(challenge, view);
  if (view.marked) {
    const slots = (s: readonly number[]) => (s.length ? `: slot ${s.map(i => i + 1).join(', ')}` : '');
    facts.checkedMarks = `The screen marks ${view.marked.right.length} of ${challenge.events.length} slots right (green`
      + `${slots(view.marked.right)}) and ${view.marked.wrong.length} wrong (red${slots(view.marked.wrong)})`;
  }
  facts.constraints = 'The learner taps an event, then taps a slot to place it (tapping a filled slot empties it); with every '
    + 'slot filled they press Check Order and the activity checks the order itself. You cannot place events for the learner.';
  return { objects: [], facts };
}
