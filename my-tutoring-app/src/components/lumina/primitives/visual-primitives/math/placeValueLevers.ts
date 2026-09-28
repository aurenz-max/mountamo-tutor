/**
 * The in-item levers on place-value-chart's dictated build items (`/add-support-tiers`, handoff 21 M1; approved table
 * qa/support-levers/m1-lever-tables-2026-09-28.md). The spoken asks (find_place, say_value) are a later slice. No
 * real-learner evidence: the misses are what `placeValueMiss` observes, plus the catalog's documented struggles
 * (an empty column, 406 written as 46, thirteen heard as thirty).
 *
 * - `model_chart` (help): a small chart beside the learner's, holding the correction's own foreign number
 *   (`modelNumber`, contract R9: as wide as the chart, no column digit shared with the target) with its places.
 *   Answers `zero_left_empty`, `column_empty`. Leak rule: never drawn in the learner's chart; never the target.
 * - `column_worth` (help): the x100 / x10 / x1 row over the columns. Answers `digits_swapped`, `one_ten_off`.
 *   `showMultipliers` is its starting position. The worth of a column, never a digit.
 * - `expanded_readback` (help): the learner's own digits read back as a sum, once the chart is full. Answers one
 *   off and far off. `showExpandedForm` is its starting position. Only the learner's digits, never a match colour.
 * - `model_teen` (help): a teen and its -ty on two small charts (fourteen, forty), from a digit the item does not
 *   use in its last two places. Answers `teen_ty_swap`. Leak rule: the pair's digit is never the item's tens or ones.
 * - `plain_number` (simplify): an ungraded dictation of a number with the same places, no zero and no teen, that
 *   shares no column digit with the item and is no session number; then the full item. Answers `zero_left_empty`,
 *   `teen_ty_swap`. Offered only when the item has a zero or a teen, the two traps it takes away.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemsFromChallenges, type PlaceValueItem, type PlaceValueTier } from './placeValueScript';

export const MODEL_LEVER = 'model_chart';
export const WORTH_LEVER = 'column_worth';
export const READBACK_LEVER = 'expanded_readback';
export const TEEN_LEVER = 'model_teen';
export const PLAIN_LEVER = 'plain_number';

const DIGITS = [3, 4, 6, 2, 7, 5, 8, 9];
const digitAt = (n: number, place: number) => Math.floor(n / 10 ** place) % 10;
const hasTeen = (n: number) => digitAt(n, 1) === 1 && digitAt(n, 0) > 0;

/** Levers the tier starts pulled: a starting position, never a recorded pull. */
export const startLevers = (item: PlaceValueItem | null, show: { showMultipliers?: boolean; showExpandedForm?: boolean }) =>
  item?.kind !== 'build_number' ? [] : [...(show.showMultipliers ?? true ? [WORTH_LEVER] : []), ...(show.showExpandedForm ?? true ? [READBACK_LEVER] : [])];

/** The teen digit for `model_teen`: two to nine, never the item's tens or ones digit. */
export const teenDigit = (target: number) => DIGITS.find(d => d !== digitAt(target, 0) && d !== digitAt(target, 1)) ?? 9;

/** The plainer number to write first, or null when the item has neither a zero nor a teen to take away. */
export function plainNumber(item: PlaceValueItem, sessionNumbers: ReadonlySet<number>): number | null {
  const t = item.targetNumber, width = item.chartPlaces.length;
  const hasZero = Array.from({ length: width }, (_, p) => digitAt(t, p)).includes(0);
  if (!hasZero && !hasTeen(t)) return null;
  for (let shift = 0; shift < DIGITS.length; shift++) {
    let n = 0;
    for (let p = width - 1; p >= 0; p--) {
      const options = DIGITS.filter(d => d !== digitAt(t, p) && !(p === 1 && d === 1));
      n += options[(p + shift) % options.length] * 10 ** p;
    }
    if (!sessionNumbers.has(n) && !hasTeen(n)) return n;
  }
  return null;
}

/** The dictation item for the plainer number: a build item on its own id, answer recomputed by the item builder. */
export function plainItem(item: PlaceValueItem, sessionNumbers: ReadonlySet<number>, tier: PlaceValueTier): PlaceValueItem | null {
  const n = plainNumber(item, sessionNumbers);
  if (n === null) return null;
  const built = itemsFromChallenges([{ id: `${item.id}~plain`, targetNumber: n, highlightedDigitPlace: 0, minPlace: 0,
    maxPlace: item.chartPlaces.length - 1 } as never], { mode: 'build', tier }).items;
  return built.find(i => i.kind === 'build_number') ?? null;
}

export function placeValueLevers(item: PlaceValueItem | null, pulled: readonly string[], sessionNumbers: ReadonlySet<number>,
  tier: PlaceValueTier): WorkspaceLever[] {
  if (item?.kind !== 'build_number') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  return [
    lever(MODEL_LEVER, 'help', 'both', ['zero_left_empty', 'column_empty'],
      'The learner leaves a column empty, or does not know a place with nothing in it still needs a digit.',
      'Shows a small model chart beside theirs with a different number written in it, a digit in every column.'),
    lever(WORTH_LEVER, 'help', 'shown', ['digits_swapped', 'one_ten_off'],
      'The learner puts digits in the wrong columns.',
      'Shows what each column is worth above it.'),
    lever(READBACK_LEVER, 'help', 'shown', ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      'The learner writes a number that is off from the one they heard.',
      "Reads the learner's own digits back as a sum under the chart once every column is written."),
    lever(TEEN_LEVER, 'help', 'both', ['teen_ty_swap'],
      'The learner mixes up a teen number and a -ty number they hear.',
      'Shows a teen number and its -ty number on two small charts, with a digit this item does not use.'),
    ...(plainNumber(item, sessionNumbers) !== null && plainItem(item, sessionNumbers, tier) ? [lever(PLAIN_LEVER, 'simplify', 'shown',
      ['zero_left_empty', 'teen_ty_swap'],
      'The zero or the teen in this number is too hard yet.',
      'Opens an easier number to write first, with the same places and no zero or teen. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Names the model numbers (never the target), no count. */
export function leverFacts(item: PlaceValueItem | null, pulled: readonly string[], started: readonly string[]): string {
  if (item?.kind !== 'build_number') return '';
  const live = pulled.filter(id => !started.includes(id));
  const d = teenDigit(item.targetNumber);
  return [
    live.includes(MODEL_LEVER) && `A model chart beside the learner's shows ${item.modelNumber}.`,
    live.includes(WORTH_LEVER) && 'Each column shows what it is worth above it.',
    live.includes(READBACK_LEVER) && "The learner's own digits are read back as a sum once the chart is full.",
    live.includes(TEEN_LEVER) && `Two small charts show ${10 + d} and ${d * 10}.`,
  ].filter((s): s is string => !!s).join(' ');
}
