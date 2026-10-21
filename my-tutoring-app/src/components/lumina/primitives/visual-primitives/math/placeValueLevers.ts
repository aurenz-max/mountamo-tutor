/**
 * The in-item levers on place-value-chart's dictated build steps and say_value asks, declared once as a lever set
 * (`components/live-activity/bossLevers.ts`; approved table qa/support-levers/m1-lever-tables-2026-09-28.md).
 * find_place has no lever: any place label, on the item or on a model, names the answer by its column position. The
 * misses are what `placeValueMiss` and `placeValueSpokenMisses` name.
 *
 * Build steps:
 * - `model_chart` (model): a small chart beside the learner's, holding the item's foreign `modelNumber` (contract R9:
 *   as wide as the chart, no column digit shared with the target) with its places. Never drawn in the learner's chart.
 * - `column_worth` (legend): the x100 / x10 / x1 row over the columns, the worth of every column alike, never a digit.
 *   `showMultipliers` is its starting position.
 * - `expanded_readback` (layout): the learner's own digits read back as a sum, once the chart is full. Only the
 *   learner's digits, never a match colour. `showExpandedForm` is its starting position.
 * - `model_teen` (model): a teen and its -ty on two small charts (fourteen, forty), from a digit the item does not use
 *   in its last two places.
 * - `plain_number` (easier): an ungraded dictation of a number with the same places, no zero and no teen, that shares
 *   no column digit with the item and is no session number; then the full item. Offered only when the item has a zero
 *   or a teen, the two traps it takes away.
 *
 * say_value:
 * - `model_value` (model): a model number beside the item's, a digit glowing in the SAME place with its worth written
 *   under it. The model digit is not the item's, its worth is no say_value answer in the session, no place name shows.
 * - `block_picture` (custom): the glowing digit drawn as that many blocks of its place (ten-sticks, hundred-flats,
 *   thousand-blocks), no numeral or word. Tens to thousands only: on the ones place the blocks would be the answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { placeValueChartCard } from './placeValueChart.card';
import { itemsFromChallenges, type PlaceValueItem } from './placeValueDomain';

export const MODEL_LEVER = 'model_chart';
export const WORTH_LEVER = 'column_worth';
export const READBACK_LEVER = 'expanded_readback';
export const TEEN_LEVER = 'model_teen';
export const PLAIN_LEVER = 'plain_number';
export const VALUE_MODEL_LEVER = 'model_value';
export const BLOCKS_LEVER = 'block_picture';

const DIGITS = [3, 4, 6, 2, 7, 5, 8, 9];
const digitAt = (n: number, place: number) => Math.floor(n / 10 ** place) % 10;
const hasTeen = (n: number) => digitAt(n, 1) === 1 && digitAt(n, 0) > 0;

/** What a lever reads beyond the item: the session's numbers (kept out of a plainer number) and its say_value asks. */
export interface PlaceValueLeverContext {
  sessionNumbers: ReadonlySet<number>;
  /** The session's say_value asks as `digit@place`: a model worth must be none of them. */
  asked: ReadonlySet<string>;
}

/** The say_value asks of a session as `digit@place`: a model worth must be none of them. */
export const askedValues = (items: readonly PlaceValueItem[]) =>
  new Set(items.filter(i => i.kind === 'say_value').map(i => `${i.digit}@${i.place}`));

/** One lesson's lever context, from its items. */
export const placeValueLeverContext = (items: readonly PlaceValueItem[]): PlaceValueLeverContext =>
  ({ sessionNumbers: new Set(items.map(i => i.targetNumber)), asked: askedValues(items) });

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
export function plainItem(item: PlaceValueItem, sessionNumbers: ReadonlySet<number>): PlaceValueItem | null {
  const n = plainNumber(item, sessionNumbers);
  if (n === null) return null;
  const built = itemsFromChallenges([{ id: `${item.id}~plain`, targetNumber: n, highlightedDigitPlace: 0, minPlace: 0,
    maxPlace: item.chartPlaces.length - 1 } as never], { mode: 'build', tier: item.tier }).items;
  return built.find(i => i.kind === 'build_number') ?? null;
}

/** The `model_value` number: the item's width, a different digit glowing in the item's place; null when none is free. */
export function valueModel(item: PlaceValueItem, asked: ReadonlySet<string>): { number: number; place: number; digit: number; worth: number } | null {
  if (item.kind !== 'say_value') return null;
  const width = String(item.targetNumber).length, p = item.place;
  const digit = DIGITS.find(d => d !== item.digit && !asked.has(`${d}@${p}`));
  if (digit === undefined) return null;
  let number = 0;
  for (let q = 0; q < width; q++) {
    number += (q === p ? digit : DIGITS.find(d => d !== digitAt(item.targetNumber, q) && d !== digit && d !== item.digit)!) * 10 ** q;
  }
  return { number, place: p, digit, worth: digit * 10 ** p };
}

const onBuild = (item: PlaceValueItem) => item.kind === 'build_number';

export const PLACE_VALUE_LEVERS = leverSet<PlaceValueItem, PlaceValueLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => placeValueChartCard.modes[mode].misses,
  support: {
    tier: item => item.tier,
    different: item => (item.kind === 'say_value' ? "a different digit's worth in the same place" : 'a different number in a chart'),
    own: item => (item.kind === 'say_value' ? "this digit's worth" : "this number's digits"),
  },
  specs: [
    { id: MODEL_LEVER, type: 'model', answers: ['zero_left_empty', 'column_empty'],
      when: 'The learner leaves a column empty, or does not know a place with nothing in it still needs a digit.',
      does: 'Shows a small model chart beside theirs with a different number written in it, a digit in every column.',
      content: item => (onBuild(item) ? item.modelNumber : null),
      fact: (n: number) => `A model chart beside the learner's shows ${n}.` },
    { id: WORTH_LEVER, type: 'legend', answers: ['digits_swapped', 'one_ten_off'],
      when: 'The learner puts digits in the wrong columns.',
      does: 'Shows what each column is worth above it.',
      content: item => onBuild(item) || null,
      fact: 'Each column shows what it is worth above it.' },
    { id: READBACK_LEVER, type: 'layout', answers: ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      when: 'The learner writes a number that is off from the one they heard.',
      does: "Reads the learner's own digits back as a sum under the chart once every column is written.",
      content: item => onBuild(item) || null,
      fact: "The learner's own digits are read back as a sum once the chart is full." },
    { id: TEEN_LEVER, type: 'model', answers: ['teen_ty_swap'],
      when: 'The learner mixes up a teen number and a -ty number they hear.',
      does: 'Shows a teen number and its -ty number on two small charts, with a digit this item does not use.',
      content: item => (onBuild(item) ? teenDigit(item.targetNumber) : null),
      fact: (d: number) => `Two small charts show ${10 + d} and ${d * 10}.` },
    { id: PLAIN_LEVER, type: 'easier', carrier: 'shown', answers: ['zero_left_empty', 'teen_ty_swap'],
      when: 'The zero or the teen in this number is too hard yet.',
      does: 'Opens an easier number to write first, with the same places and no zero or teen. It is not graded; the full item comes back after it.',
      content: (item, ctx) => (onBuild(item) ? plainItem(item, ctx.sessionNumbers) : null) },
    { id: VALUE_MODEL_LEVER, type: 'model', answers: ['said_number', 'said_place', 'shifted_place'],
      when: 'The learner reads the whole number, names the place, or gives the worth one column over.',
      does: 'Shows a model number beside this one with a different digit glowing in the same place and what it is worth. Say the model; never the answer.',
      content: (item, ctx) => valueModel(item, ctx.asked),
      fact: (m: { number: number; digit: number; worth: number }) =>
        `A model beside the number shows ${m.number} with its ${m.digit} glowing, worth ${m.worth}.` },
    { id: BLOCKS_LEVER, type: 'custom', carrier: 'shown', answers: ['said_digit', 'next_digit_value'],
      why: "It draws this item's own glowing digit again as base-ten blocks, a second picture of its quantity: no stock "
        + 'type adds a new representation of the item itself.',
      when: 'The learner says the digit alone, or the worth of a nearby digit.',
      does: 'Draws the glowing digit as that many blocks of its place under the number, with no numeral or word.',
      content: item => (item.kind === 'say_value' && item.place >= 1 && item.place <= 3) || null,
      fact: 'Under the number, the glowing digit is drawn as that many blocks of its place, with no numeral.' },
  ],
});
