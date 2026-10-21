/**
 * Life cycle sequencer's domain on the boss (`lifeCycleSequencer.boss.ts`): the item, the bank order, the check, the
 * miss and the scene.
 *
 * Pure: the component, the boss and any probe read the same item, bank order and scene. The payload is ONE sequence
 * (no `challenges` array), so the session has one item, `cycle`. The learner fills every slot and presses Check
 * Answer; the activity's own check is the judge, so the tutor is never handed `correctPosition`, `transitionToNext` or
 * the misconception correction (each can state the order).
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { LifeCycleSequencerData, LifeCycleStage } from './LifeCycleSequencer';
import type { CycleMiss } from './lifeCycleSequencer.card';

export { CYCLE_MISSES, type CycleMiss } from './lifeCycleSequencer.card';

export const CYCLE_ITEM_ID = 'cycle';

/** The one askable item in a payload; a simplify lever builds others of the same shape. */
export interface LifeCycleItem {
  id: string;
  title: string;
  instructions: string;
  cycleType: 'linear' | 'circular';
  gradeBand: LifeCycleSequencerData['gradeBand'];
  stages: LifeCycleStage[];
}

export const lifeCycleItem = (data: Pick<LifeCycleSequencerData, 'title' | 'instructions' | 'cycleType' | 'gradeBand' | 'stages'>): LifeCycleItem =>
  ({ id: CYCLE_ITEM_ID, title: data.title, instructions: data.instructions, cycleType: data.cycleType,
    gradeBand: data.gradeBand, stages: data.stages });

/** At K-2 tapping a picture places it in the next empty slot (reader-fit PRE); older bands tap a card, then a slot. */
export const tapPlaces = (item: Pick<LifeCycleItem, 'gradeBand'>) => item.gradeBand === 'K-2';

/** How many neighbouring cards in `order` are neighbouring stages (either way; across the end on a circle). */
function linkedPairs(order: readonly LifeCycleStage[], circular: boolean): number {
  const n = order.length;
  const linked = (a: number, b: number) => Math.abs(a - b) === 1 || (circular && n > 2 && Math.abs(a - b) === n - 1);
  return order.reduce((k, s, i) => k + (i > 0 && linked(order[i - 1].correctPosition, s.correctPosition) ? 1 : 0), 0);
}

/**
 * The order the cards are shown in. The generator returns `stages` sorted by `correctPosition`, so drawing them as
 * given printed the answer; a random shuffle could land on it, or on a run that reads as most of it. A shuffle
 * seeded by the item (stable across renders and mounts) with at most one neighbouring pair of stages side by side.
 */
export function bankOrder(item: Pick<LifeCycleItem, 'id' | 'stages' | 'cycleType'>): LifeCycleStage[] {
  let seed = 0;
  for (const ch of `${item.id}|${item.stages.map(s => s.label).join('|')}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const circular = item.cycleType === 'circular';
  let best: LifeCycleStage[] = [...item.stages];
  for (let tries = 0; tries < 60; tries++) {
    const order = [...item.stages];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (linkedPairs(order, circular) < linkedPairs(best, circular)) best = order;
    if (linkedPairs(best, circular) <= 1) break;
  }
  return best;
}

export interface CycleView {
  /** Slot index → placed stage id, or null while empty. */
  slots: readonly (string | null)[];
  /** After a check, until Try again: the slots the screen marks right and wrong. */
  marked: { right: readonly number[]; wrong: readonly number[] } | null;
}

const labelOf = (item: LifeCycleItem, id: string | null) => (id ? item.stages.find(s => s.id === id)?.label : undefined);

/** The learner's work in their own terms, never the key. */
export function describeCycleWork(item: LifeCycleItem, slots: readonly (string | null)[]): string {
  const labels = item.stages.map((_, i) => labelOf(item, slots[i] ?? null));
  if (labels.every(l => !l)) return 'No stage placed yet';
  return 'Placed: ' + labels.map((l, i) => `slot ${i + 1} ${l ? `"${l}"` : 'empty'}`).join(', ');
}

/** The correct position of the stage in each slot; null while a slot is empty. */
function placedPositions(item: LifeCycleItem, slots: readonly (string | null)[]): number[] | null {
  const seq = item.stages.map((_, i) => item.stages.find(s => s.id === slots[i])?.correctPosition);
  return seq.every((p): p is number => typeof p === 'number') ? seq : null;
}

/** The activity's own check: every slot filled, each with the stage whose `correctPosition` is its index. */
export function cycleCorrect(item: LifeCycleItem, slots: readonly (string | null)[]): boolean {
  const seq = placedPositions(item, slots);
  return !!seq && seq.every((p, i) => p === i);
}

export function cycleMiss(item: LifeCycleItem | null, slots: readonly (string | null)[]): CycleMiss | undefined {
  if (!item) return undefined;
  const seq = placedPositions(item, slots);
  if (!seq || seq.every((p, i) => p === i)) return undefined;
  const n = seq.length;
  if (item.cycleType === 'circular' && seq.every((p, i) => p === (seq[0] + i) % n)) return 'cycle_rotated';
  if (seq.every((p, i) => p === n - 1 - i)) return 'reversed';
  const off = seq.flatMap((p, i) => (p === i ? [] : [i]));
  if (off.length === 2 && seq[off[0]] === off[1] && seq[off[1]] === off[0])
    return off[1] - off[0] === 1 ? 'adjacent_swap' : 'two_swapped';
  if (seq.some((_, k) => seq.filter((__, i) => i !== k).every((p, i, rest) => i === 0 || p > rest[i - 1]))) return 'one_moved';
  return 'mixed_order';
}

/** What is drawn and asked. The cards are listed in the bank's order; the true order is not. */
export function workspaceScene(item: LifeCycleItem, view: CycleView): SceneOf {
  const bank = bankOrder(item);
  const n = item.stages.length;
  const facts: Record<string, string | number> = {
    kind: item.cycleType === 'circular'
      ? 'a cycle: after the last stage it starts again; slot 1 is the stage this item starts from'
      : 'a life in a line: it has a beginning and an end',
    title: item.title,
    slots: `${n} numbered slots, 1 to ${n}, filled in order of time`,
    stages: `${bank.map(s => s.label).join('; ')} (picture cards shown mixed up, not in order)`,
  };
  // Each card's own line, one fact per card: what is happening IN the picture is the stimulus, not the answer.
  bank.forEach((s, i) => { if (s.description) facts[`card${i + 1}`] = `${s.label}: ${s.description}`; });
  facts.learnerWork = describeCycleWork(item, view.slots);
  if (view.marked) {
    const list = (s: readonly number[]) => (s.length ? `: slot ${s.map(i => i + 1).join(', ')}` : '');
    facts.checkedMarks = `The screen marks ${view.marked.right.length} of ${n} slots right (green check`
      + `${list(view.marked.right)}) and ${view.marked.wrong.length} wrong (red cross${list(view.marked.wrong)})`;
  }
  return { objects: [], facts };
}
