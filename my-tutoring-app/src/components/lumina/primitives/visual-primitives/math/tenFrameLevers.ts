/**
 * The in-item levers on a ten-frame `build` item (`/add-support-tiers`, handoff 18 B1).
 *
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * From the failure inventory (qa/eval-reports/ten-frame-levers-2026-09-27.md):
 * - `running_count` (help): the count of counters the learner has placed, under the frame. Answers
 *   "miscounts while placing". Leak rule: it counts placed counters only, never the number to build.
 *   Starts withdrawn at every tier (user ruling 2026-09-29): shown from the first tap, the child can tap
 *   until it reads the target without counting. It is pulled after a miss, never by default.
 * - `five_frame` (help): the first row outlined and marked 5, the frame's own structure for counting
 *   past five. Leak rule: never offered when five IS the number to build.
 * - `smaller_build` (simplify): build about half as many first, as ungraded practice, then the full
 *   item. Leak rule: never the full item's number; same mode (build), same frame.
 * `build_teen` carries the same three on its ones (2026-09-29): the running count reads the counters on
 * both frames (the given ten plus the ones placed), so it too starts withdrawn; the five-frame outlines the
 * first row of the ONES frame and is never offered on fifteen; the easier item is a teen number with about
 * half as many ones (14 -> 12), never the same teen number.
 * Other kinds declare no levers yet: their inventories are drafted in the brief, not built.
 * `frameMiss` names what a wrong placement shows on every gesture kind (handoff 20).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemsFromChallenges, judgeSplit, teenTargetFor, teenTotalFor, type TenFrameBand, type TenFrameItem } from './tenFrameScript';

export const COUNT_LEVER = 'running_count';
export const FIVE_LEVER = 'five_frame';
export const SMALLER_LEVER = 'smaller_build';

/**
 * What a wrong placement shows (`TeachingAttempt.miss`), from the count the frame commits: counters placed
 * (build), added to the seeded ones (make_ten, build_teen) or turned yellow (split, decompose_teen).
 * - `one_short` / `one_over`: one fewer or one more than the number to produce;
 * - `short_by_more` / `over_by_more`: two or more off;
 * - `filled_frame`: every empty box filled (build, build_teen), when that is more than one over;
 * - `all_flipped` / `none_flipped`: the whole group turned yellow, or none of it (split; decompose_teen's
 *   whole group when that is more than one over);
 * - `same_way_again`: a split already shown for this total while another way remains.
 * Only the observable pattern; why the learner did it is the tutor's and the distiller's to judge.
 * Undefined for a right placement or a spoken item.
 */
export type FrameMiss = 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'filled_frame'
  | 'all_flipped' | 'none_flipped' | 'same_way_again';

export function frameMiss(item: TenFrameItem | null, work: { placed: number; shownWays?: ReadonlySet<string> }): FrameMiss | undefined {
  if (!item || item.answerKind !== 'gesture') return undefined;
  const { placed } = work;
  if (item.kind === 'split') {
    const verdict = judgeSplit(item, { a: item.answer - placed, b: placed }, work.shownWays);
    if (verdict === 'repeat') return 'same_way_again';
    if (verdict === 'correct') return undefined;
    return placed <= 0 ? 'none_flipped' : 'all_flipped';
  }
  const target = item.kind === 'build_teen' || item.kind === 'decompose_teen' ? teenTargetFor(item) : item.answer;
  const off = placed - target;
  if (off === 0) return undefined;
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (off > 0 && item.kind === 'decompose_teen' && placed === item.answer) return 'all_flipped';
  if (off > 0 && (item.kind === 'build' || item.kind === 'build_teen') && placed === item.capacity - item.shown) return 'filled_frame';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

const LEVER_KINDS: readonly TenFrameItem['kind'][] = ['build', 'build_teen'];

/** Leak rule for the five-frame: outlining a row of five marks the answer when five is what to place
 *  (`answer` is the ones on `build_teen`, so fifteen is refused too). */
export const fiveFrameLeaks = (item: TenFrameItem) => item.answer === 5;

/** Which frame the five-frame outlines: the one the learner fills (the ones frame on `build_teen`). */
export const fiveFrameIndex = (item: TenFrameItem) => (item.kind === 'build_teen' ? 1 : 0);

/** The easier item for `item`, or null: about half as many to place, never the same number, same mode and frame. */
export function smallerBuild(item: TenFrameItem, band: TenFrameBand): TenFrameItem | null {
  if (!LEVER_KINDS.includes(item.kind) || item.answer < 2) return null;
  const place = Math.ceil(item.answer / 2);
  if (place === item.answer) return null;
  const targetCount = item.kind === 'build_teen' ? teenTotalFor(item) - item.answer + place : place;
  return itemsFromChallenges([{ id: `${item.id}~smaller`, type: item.kind, targetCount }],
    { capacity: item.capacity, band })[0] ?? null;
}

export function tenFrameLevers(item: TenFrameItem | null, pulled: readonly string[], band: TenFrameBand): WorkspaceLever[] {
  if (!item || !LEVER_KINDS.includes(item.kind) || item.answerKind !== 'gesture') return [];
  const teen = item.kind === 'build_teen';
  const levers: WorkspaceLever[] = [{
    id: COUNT_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(COUNT_LEVER),
    // One off, or not stopping at the number: seeing how many are placed answers both.
    answers: ['one_short', 'one_over', 'filled_frame'],
    when: 'The learner miscounts while placing: one too many, one too few, or loses track.',
    does: teen
      ? 'Shows under the frames how many counters are on them so far, the ten included. Never the number to make.'
      : 'Shows under the frame how many counters the learner has placed so far. Never the number to build.',
  }];
  if (!fiveFrameLeaks(item)) levers.push({
    id: FIVE_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(FIVE_LEVER),
    answers: ['short_by_more', 'over_by_more', 'filled_frame'],
    when: 'The learner counts one by one and loses track past five.',
    does: teen
      ? 'Outlines the top row of the second frame and marks it 5, so the learner can count the ones on from a full row.'
      : 'Outlines the top row of the frame and marks it 5, so the learner can count on from a full row.',
  });
  if (smallerBuild(item, band)) levers.push({
    id: SMALLER_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SMALLER_LEVER),
    answers: ['short_by_more', 'over_by_more'],
    when: teen ? 'The learner cannot place this many ones beside the ten yet.' : 'The learner cannot build a number this big yet.',
    does: teen
      ? 'Opens an easier teen number first, with about half as many ones beside the ten. It is not graded; the full item comes back after it.'
      : 'Opens an easier build first, about half as many counters. It is not graded; the full item comes back after it.',
  });
  return levers;
}
