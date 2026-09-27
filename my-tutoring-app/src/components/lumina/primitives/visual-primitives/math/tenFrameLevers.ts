/**
 * The in-item levers on a ten-frame `build` item (`/add-support-tiers`, handoff 18 B1).
 *
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * From the failure inventory (qa/eval-reports/ten-frame-levers-2026-09-27.md):
 * - `running_count` (help): the count of counters the learner has placed, under the frame. Answers
 *   "miscounts while placing". Leak rule: it counts placed counters only, never the number to build.
 *   Easy (and no tier) starts with it pulled: the generator's `showOptions.showCount`.
 * - `five_frame` (help): the first row outlined and marked 5, the frame's own structure for counting
 *   past five. Leak rule: never offered when five IS the number to build.
 * - `smaller_build` (simplify): build about half as many first, as ungraded practice, then the full
 *   item. Leak rule: never the full item's number; same mode (build), same frame.
 * Other kinds declare no levers yet: their inventories are drafted in the brief, not built.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemsFromChallenges, type TenFrameBand, type TenFrameItem } from './tenFrameScript';

export const COUNT_LEVER = 'running_count';
export const FIVE_LEVER = 'five_frame';
export const SMALLER_LEVER = 'smaller_build';

/** Leak rule for the five-frame: outlining a row of five marks the answer when five is what to build. */
export const fiveFrameLeaks = (item: TenFrameItem) => item.answer === 5;

/** The easier build for `item`, or null: about half as many, never the same number, on the same frame. */
export function smallerBuild(item: TenFrameItem, band: TenFrameBand): TenFrameItem | null {
  if (item.kind !== 'build' || item.answer < 2) return null;
  const target = Math.ceil(item.answer / 2);
  if (target === item.answer) return null;
  return itemsFromChallenges([{ id: `${item.id}~smaller`, type: 'build', targetCount: target }],
    { capacity: item.capacity, band })[0] ?? null;
}

export function tenFrameLevers(item: TenFrameItem | null, pulled: readonly string[], band: TenFrameBand): WorkspaceLever[] {
  if (!item || item.kind !== 'build' || item.answerKind !== 'gesture') return [];
  const levers: WorkspaceLever[] = [{
    id: COUNT_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(COUNT_LEVER),
    when: 'The learner miscounts while placing: one too many, one too few, or loses track.',
    does: 'Shows under the frame how many counters the learner has placed so far. Never the number to build.',
  }];
  if (!fiveFrameLeaks(item)) levers.push({
    id: FIVE_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(FIVE_LEVER),
    when: 'The learner counts one by one and loses track past five.',
    does: 'Outlines the top row of the frame and marks it 5, so the learner can count on from a full row.',
  });
  if (smallerBuild(item, band)) levers.push({
    id: SMALLER_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SMALLER_LEVER),
    when: 'The learner cannot build a number this big yet.',
    does: 'Opens an easier build first, about half as many counters. It is not graded; the full item comes back after it.',
  });
  return levers;
}
