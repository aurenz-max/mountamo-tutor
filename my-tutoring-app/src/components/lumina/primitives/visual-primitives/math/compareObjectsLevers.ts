/**
 * The in-item levers on compare-objects `order_three`, the one mode answered with the hands (`/add-support-tiers`,
 * handoff 21 M2; table qa/support-levers/m2-lever-tables-2026-09-28.md). The three spoken modes are a later slice.
 * No real-learner evidence: the misses are what `compareOrderMiss` observes.
 *
 * - `order_steps` (help): three wordless bars beside the objects that grow (or shrink) the way the order runs.
 *   Answers `reversed`. The direction only; never an object.
 * - `touch_slots` (help): three empty dots that fill one per touch. Answers `not_all_placed`. Counts touches only.
 * - `measure_grid` (help): even lines behind a length, height or capacity drawing, so ends and levels can be read
 *   against them. Answers `two_swapped`, `other_order`. Uniform, so it singles out no object. Not on weight, whose
 *   scales already are the measuring tool.
 * - `far_three` (simplify): an ungraded order of three plain objects far apart in size (same attribute, same
 *   direction, no name of the item's); then the full item. Answers `two_swapped`, `other_order`. Offered only when the
 *   item's own drawing has two sizes closer than a quarter of the scale.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CompareObject, CompareObjectsChallenge } from './CompareObjects';
import { isGreaterComparison, itemFromChallenge, type CompareObjectsItem } from './compareObjectsScript';

export const STEPS_LEVER = 'order_steps';
export const SLOTS_LEVER = 'touch_slots';
export const GRID_LEVER = 'measure_grid';
export const FAR_LEVER = 'far_three';

/** Wordless bar heights, left to right, the way the asked order runs (greatest first shrinks). */
export const orderSteps = (item: CompareObjectsItem) =>
  isGreaterComparison(item.comparisonWord) ? [30, 20, 10] : [10, 20, 30];

const NOUNS: Record<string, readonly string[]> = {
  length: ['ribbon', 'rope', 'scarf'],
  height: ['tower', 'plant', 'lamp'],
  weight: ['bag', 'box', 'basket'],
  capacity: ['cup', 'jar', 'bucket'],
};
// The drawing colours objects blue, pink, green by position, so the plain names say which one is which.
const COLOURS = ['blue', 'pink', 'green'];
// Screen order middle, biggest, smallest: never already in either answer order.
const SIZES = [60, 95, 25];

const closeSizes = (objects: readonly CompareObject[]) => {
  const sizes = objects.map(o => o.visualSize).sort((a, b) => a - b);
  return sizes.some((s, i) => i > 0 && s - sizes[i - 1] < 25);
};

/** The easier order and the drawing it needs, or null when the item's sizes are already far apart. */
export function farThree(item: CompareObjectsItem | null, challenge: CompareObjectsChallenge | null)
  : { item: CompareObjectsItem; challenge: CompareObjectsChallenge } | null {
  if (item?.kind !== 'order_three' || !challenge?.objects || !closeSizes(challenge.objects)) return null;
  for (const noun of NOUNS[item.attribute] ?? []) {
    const objects: CompareObject[] = COLOURS.map((colour, i) => ({ name: `${colour} ${noun}`, visualSize: SIZES[i], actualValue: SIZES[i] }));
    if (objects.some(o => item.objectNames.includes(o.name))) continue;
    const answer = [...objects].sort((a, b) => isGreaterComparison(item.comparisonWord)
      ? b.actualValue - a.actualValue : a.actualValue - b.actualValue).map(o => o.name);
    const easier: CompareObjectsChallenge = { ...challenge, id: `${item.id}~simpler`, objects, correctAnswer: answer.join(', '),
      showScaleReadout: challenge.showScaleReadout };
    const built = itemFromChallenge(easier, { band: item.band });
    if (built) return { item: built, challenge: easier };
  }
  return null;
}

export function compareObjectsLevers(item: CompareObjectsItem | null, challenge: CompareObjectsChallenge | null,
  pulled: readonly string[]): WorkspaceLever[] {
  if (item?.kind !== 'order_three') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(STEPS_LEVER, 'help', ['reversed'], 'The learner orders from the wrong end.',
      'Shows three bars beside the objects that grow the way the order goes. They name no object.'),
    lever(SLOTS_LEVER, 'help', ['not_all_placed'], 'The learner stops before touching all three.',
      'Shows three empty dots that fill one for each object touched.'),
    ...(item.attribute !== 'weight' ? [lever(GRID_LEVER, 'help', ['two_swapped', 'other_order'],
      'The learner mixes up two objects that are close in size.',
      'Puts even lines behind the drawing so the ends can be compared against them.')] : []),
    ...(farThree(item, challenge) ? [lever(FAR_LEVER, 'simplify', ['two_swapped', 'other_order'],
      'These objects are too close in size to order yet.',
      'Opens an easier set first: three plain objects far apart in size. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never an object's place in the order. */
export function leverFacts(item: CompareObjectsItem | null, pulled: readonly string[], touched: number): string {
  if (item?.kind !== 'order_three') return '';
  return [
    pulled.includes(STEPS_LEVER) && 'Three wordless bars beside the objects grow the way the order goes.',
    pulled.includes(SLOTS_LEVER) && `Three dots show touches: ${touched} of 3 filled.`,
    pulled.includes(GRID_LEVER) && 'Even lines sit behind the drawing.',
  ].filter((s): s is string => !!s).join(' ');
}
