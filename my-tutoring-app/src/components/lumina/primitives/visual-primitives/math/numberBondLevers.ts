/**
 * The in-item levers on number-bond (`/add-support-tiers`, handoff 21 M1, slice 1; the equation levers are a
 * later slice). Approved table: qa/support-levers/m1-lever-tables-2026-09-28.md. No real-learner evidence; the
 * misses are what `bondMiss` observes, plus the catalog's documented struggles.
 *
 * - decompose (build): `made_ways` (help) draws the pairs the learner already made as small dot bonds, in the
 *   order made, and marks the one the board shows now. Answers `same_way_again`. Leak rule: only pairs the
 *   learner made, never sorted by part (a sorted row shows the gaps), never a pair not yet found. Offered once a
 *   pair is made.
 * - ten_and_ones (build): `ten_frame_part` (help) lays each part's own counters out in a two-by-five outline.
 *   Answers `ten_one_off`, `no_full_ten`. Leak rule: draws placed counters only; no "N more" and no box filled
 *   for the learner. `smaller_teen` (simplify) opens an ungraded split of eleven first, then the full item.
 *   Answers `no_full_ten`. Leak rule: still a teen with the ten-and-ones accept set, never the learner's whole;
 *   refused at twelve or below (eleven would be as hard, or the item itself).
 * - related_fact (join / separate): `show_move` (help) highlights the move button. Answers `other_move`. The
 *   move is the instruction, not the assessed answer; no count is shown.
 * - missing_part (spoken): `open_counters` (help) opens the counters tray for the learner. The covered part
 *   stays covered; the support is recorded as counters. No miss (spoken).
 * `not_all_placed` cannot be committed on the split path (a split commits only when the parts make the whole),
 * so the catalog lists it as unanswered.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { NumberBondItem } from './numberBondScript';
import { buildBondItems } from './numberBondScript';
import { expandNumberBondInteractions } from './numberBondModes';

export const WAYS_LEVER = 'made_ways';
export const FRAME_LEVER = 'ten_frame_part';
export const SMALLER_LEVER = 'smaller_teen';
export const MOVE_LEVER = 'show_move';
export const COUNTERS_LEVER = 'open_counters';

/** The easier teen split for `item`, or null: eleven as ten and one, on its own id; never at twelve or below. */
export function smallerTeen(item: NumberBondItem | null): NumberBondItem | null {
  if (item?.kind !== 'ten-and-ones' || item.splitPhase !== 'build' || item.whole <= 12) return null;
  const built = buildBondItems([{ id: `${item.sourceId}~smaller`, type: 'ten-and-ones', whole: 11 }], { band: 'K', maxNumber: 10 });
  return expandNumberBondInteractions(built.items).find(i => i.splitPhase === 'build') ?? null;
}

export function numberBondLevers(item: NumberBondItem | null, pulled: readonly string[],
  view: { pairsMade: number; countersOpen: boolean }): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  if (item.kind === 'decompose' && item.splitPhase === 'build')
    return view.pairsMade > 0 || pulled.includes(WAYS_LEVER) ? [lever(WAYS_LEVER, 'help', 'shown', ['same_way_again'],
      'The learner makes a way to split the whole that they already made.',
      'Draws the ways the learner already made as small pictures of dots, in the order made, and marks the way the board shows now.')] : [];
  if (item.kind === 'ten-and-ones' && item.splitPhase === 'build') return [
    lever(FRAME_LEVER, 'help', 'both', ['ten_one_off', 'no_full_ten'],
      'The learner cannot see how many make a ten while moving counters.',
      "Lays each part's counters out in a ten-frame outline, two rows of five. Only the learner's own counters are in it."),
    ...(smallerTeen(item) ? [lever(SMALLER_LEVER, 'simplify', 'shown', ['no_full_ten'],
      'The learner cannot find the ten in a number this big yet.',
      'Opens an easier teen number to split first. It is not graded; the full item comes back after it.')] : []),
  ];
  if (item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate')
    return [lever(MOVE_LEVER, 'help', 'shown', ['other_move'],
      'The learner does not know which move to make with the groups.',
      'Highlights the button for the move this step asks for.')];
  if (item.interactionPhase === 'missing-infer' && (!view.countersOpen || pulled.includes(COUNTERS_LEVER)))
    return [lever(COUNTERS_LEVER, 'help', 'shown', [],
      'The learner cannot work out the covered part in their head.',
      'Opens the counters tray so the learner can set the known part aside and look at the rest. The covered part stays covered.')];
  return [];
}

/** What the pulled levers put on screen, as a scene fact. Never a count, a pair still to find, or the covered part. */
export function leverFacts(item: NumberBondItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  return [
    pulled.includes(WAYS_LEVER) && item.kind === 'decompose' && 'The ways already made are drawn as small dot pictures, in the order made.',
    pulled.includes(FRAME_LEVER) && item.kind === 'ten-and-ones' && "Each part's counters sit in a ten-frame outline.",
    pulled.includes(MOVE_LEVER) && item.kind === 'related-fact' && 'The move button for this step is highlighted.',
    pulled.includes(COUNTERS_LEVER) && item.kind === 'missing-part' && 'The counters tray is open; the covered part stays covered.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for `made_ways`: the pairs in the order made, exactly as made; nothing added, nothing sorted. */
export const madeWaysOrder = (found: ReadonlyArray<readonly [number, number]>) => found.map(([a, b]) => [a, b] as const);
