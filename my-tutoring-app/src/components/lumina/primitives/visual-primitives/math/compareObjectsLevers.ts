/**
 * The in-item levers on compare-objects, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 21 M2 for
 * order_three and handoff 23 for the spoken modes; tables qa/support-levers/m2-lever-tables-2026-09-28.md). No
 * real-learner evidence: the misses are what `compareOrderMiss` and `compareObjectsSpokenMisses` name. Pure: the
 * component draws a pulled lever. The context is the session's items (`shorter_measure` avoids their counts).
 *
 * order_three (answered with the hands)
 * - `order_steps` (marks): three wordless bars beside the objects that grow (or shrink) the way the order runs. The
 *   direction only; never an object.
 * - `touch_slots` (marks): three empty dots that fill one per touch. Counts touches only.
 * - `measure_grid` (marks): even lines behind a length, height or capacity drawing; uniform, so it singles out no
 *   object. Not on weight, whose scales already are the measuring tool.
 * - `far_three` (easier): an ungraded order of three plain objects far apart in size (same attribute and direction,
 *   no name of the item's), then the full item. Only when the item has two sizes closer than a quarter of the scale.
 * compare_two
 * - `word_model` (model): a model pair of plain shapes, the one the asked word names glowing. Fixed per comparison
 *   word, never read from the item: a different pair, solved.
 * - `far_pair` (easier): an ungraded pair of two plain objects far apart, same attribute and word; only when the
 *   item's two sizes are within 25.
 * identify_attribute
 * - `menu_pictures` (legend): one picture per spoken choice, in ask order, none marked.
 * - `fewer_choices` (custom): the menu pictures with one wrong choice greyed out, on this item; never the answer, only
 *   on a menu of three or more (handoff 21 ruling 3: assisted work).
 * non_standard (`showUnitNumbers` stays a post-answer reveal; it must never become a lever)
 * - `tap_boxes` (marks): the unit boxes can be tapped; a tapped box fills. Never a numeral.
 * - `five_marks` (marks): a thicker line after every fifth box; only on more than five boxes.
 * - `shorter_measure` (easier): an ungraded measure of a shorter plain object with the same unit, at most half the
 *   boxes (two or more), a count no session item has where one is free; then the full item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { compareObjectsCard } from './compareObjects.card';
import {
  ATTRIBUTE_CHILD_FORM, challengeOf, isGreaterComparison, itemFromChallenge,
  type CompareObjectsItem, type ComparisonWord, type MeasurableAttribute, type MeasuredObject,
} from './compareObjectsDomain';

export const STEPS_LEVER = 'order_steps';
export const SLOTS_LEVER = 'touch_slots';
export const GRID_LEVER = 'measure_grid';
export const FAR_LEVER = 'far_three';
export const WORD_MODEL_LEVER = 'word_model';
export const FAR_PAIR_LEVER = 'far_pair';
export const MENU_LEVER = 'menu_pictures';
export const FEWER_CHOICES_LEVER = 'fewer_choices';
export const TAP_BOXES_LEVER = 'tap_boxes';
export const FIVE_MARKS_LEVER = 'five_marks';
export const SHORTER_LEVER = 'shorter_measure';

/** Wordless bar heights, left to right, the way the asked order runs (greatest first shrinks). */
export const orderSteps = (item: CompareObjectsItem) => (isGreaterComparison(item.comparisonWord) ? [30, 20, 10] : [10, 20, 30]);

/** The model pair for a comparison word: two plain shapes, big first, and which one glows. Fixed per word. */
export const wordModel = (word: ComparisonWord) => ({ sizes: [90, 35] as const, glow: isGreaterComparison(word) ? 0 : 1 });

/** A picture for what each spoken choice means: a tool or a thing, never a drawing like the item's own. */
export const MENU_PICTURE: Record<MeasurableAttribute, string> = { length: '📏', height: '🦒', weight: '🏋️', capacity: '🫗' };

/** The wrong choice `fewer_choices` greys out: the last wrong one the ask names, on a menu of three or more. */
export function droppedChoice(item: CompareObjectsItem | null): MeasurableAttribute | null {
  if (item?.kind !== 'identify_attribute' || item.attributeOptions.length < 3) return null;
  return [...item.attributeOptions].reverse().find(a => a !== item.attribute) ?? null;
}

const NOUNS: Record<MeasurableAttribute, readonly string[]> = {
  length: ['ribbon', 'rope', 'scarf'], height: ['tower', 'plant', 'lamp'],
  weight: ['bag', 'box', 'basket'], capacity: ['cup', 'jar', 'bucket'] };
// The drawing colours objects blue, pink, green by position, so the plain names say which one is which.
const COLOURS = ['blue', 'pink', 'green'];
// far_three's screen order: middle, biggest, smallest, never already in either answer order.
const THREE_SIZES = [60, 95, 25];
const PAIR_SIZES = [85, 30];
const MEASURED = ['stick', 'straw', 'paper strip'];

const plain = (noun: string, sizes: readonly number[]): MeasuredObject[] =>
  sizes.map((size, i) => ({ name: `${COLOURS[i]} ${noun}`, visualSize: size, actualValue: size }));
const ranked = (item: CompareObjectsItem, objects: readonly MeasuredObject[]) => [...objects]
  .sort((a, b) => (isGreaterComparison(item.comparisonWord) ? b.actualValue - a.actualValue : a.actualValue - b.actualValue))
  .map(o => o.name);

/** The easier order, or null when the item's sizes are already far apart. */
export function farThree(item: CompareObjectsItem | null): CompareObjectsItem | null {
  if (item?.kind !== 'order_three') return null;
  const sizes = item.objects.map(o => o.visualSize).sort((a, b) => a - b);
  if (!sizes.some((s, i) => i > 0 && s - sizes[i - 1] < 25)) return null;
  for (const noun of NOUNS[item.attribute]) {
    const objects = plain(noun, THREE_SIZES);
    if (objects.some(o => item.objectNames.includes(o.name))) continue;
    const built = itemFromChallenge(challengeOf(item, objects, { correctAnswer: ranked(item, objects).join(', ') }), { band: item.band });
    if (built) return built;
  }
  return null;
}

/** The easier compare_two pair, or null when the item's pair is already far apart. */
export function farPair(item: CompareObjectsItem | null): CompareObjectsItem | null {
  if (item?.kind !== 'compare_two' || item.objects.length !== 2
    || Math.abs(item.objects[0].visualSize - item.objects[1].visualSize) >= 25) return null;
  for (const noun of NOUNS[item.attribute]) {
    const objects = plain(noun, PAIR_SIZES);
    if (objects.some(o => item.objectNames.includes(o.name))) continue;
    const built = itemFromChallenge(challengeOf(item, objects, { correctAnswer: ranked(item, objects)[0] }), { band: item.band });
    if (built) return built;
  }
  return null;
}

/** The easier non_standard measure, or null when no shorter count of two or more fits. */
export function shorterMeasure(item: CompareObjectsItem | null, session: readonly CompareObjectsItem[]): CompareObjectsItem | null {
  if (item?.kind !== 'non_standard' || !item.objects[0]) return null;
  const name = MEASURED.find(n => n !== item.objectNames[0]);
  if (!name) return null;
  const counts: number[] = [];
  for (let n = Math.ceil(item.unitCount / 2); n >= 2; n--) if (n < item.unitCount) counts.push(n);
  const size = item.objects[0].visualSize;
  for (const taken of [new Set([item, ...session].map(i => i.unitCount)), new Set([item.unitCount])])
    for (const n of counts) {
      if (taken.has(n)) continue;
      const scaled = Math.max(10, Math.round(size * n / item.unitCount));
      const built = itemFromChallenge(challengeOf(item, [{ name, visualSize: scaled, actualValue: scaled }],
        { unitName: item.unitName, unitCount: n }), { band: item.band });
      if (built) return built;
    }
  return null;
}

/** An easier item rebuilt from its id (`<parent>~simpler`), for the journey harness. */
export function practiceFromId(id: string, items: readonly CompareObjectsItem[]): CompareObjectsItem | null {
  const parent = items.find(i => `${i.id}~simpler` === id);
  if (!parent) return null;
  return parent.kind === 'order_three' ? farThree(parent) : parent.kind === 'compare_two' ? farPair(parent)
    : shorterMeasure(parent, items);
}

const wordPhrase = (word: ComparisonWord) => (word === 'shorter_height' ? 'shorter' : word.replace('_', ' '));
const PRACTICE = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';

export const COMPARE_LEVERS = leverSet<CompareObjectsItem, readonly CompareObjectsItem[]>({
  modeOf: item => item.kind,
  missesOf: mode => compareObjectsCard.modes[mode].misses,
  // Only compare_two has a model lever; the set states no support rule in the other modes.
  support: { tier: item => item.supportTier, different: 'a different pair, two plain shapes',
    own: 'which of these objects the question asks for' },
  specs: [
    // order_three
    { id: STEPS_LEVER, type: 'marks', modes: ['order_three'], answers: ['reversed'],
      when: 'The learner orders from the wrong end.',
      does: 'Shows three bars beside the objects that grow the way the order goes. They name no object.',
      fact: 'Three wordless bars beside the objects grow the way the order goes.' },
    { id: SLOTS_LEVER, type: 'marks', modes: ['order_three'], answers: ['not_all_placed'],
      when: 'The learner stops before touching all three.',
      does: 'Shows three empty dots that fill one for each object touched.',
      fact: 'Three dots below the objects fill one for each object touched.' },
    { id: GRID_LEVER, type: 'marks', modes: ['order_three'], answers: ['two_swapped', 'other_order'],
      offer: item => item.attribute !== 'weight',
      when: 'The learner mixes up two objects that are close in size.',
      does: 'Puts even lines behind the drawing so the ends can be compared against them.',
      fact: 'Even lines sit behind the drawing.' },
    { id: FAR_LEVER, type: 'easier', modes: ['order_three'], carrier: 'shown', answers: ['two_swapped', 'other_order'],
      when: 'These objects are too close in size to order yet.',
      does: 'Opens an easier set first: three plain objects far apart in size. It is not graded; the full item comes back after it.',
      content: item => farThree(item) },
    // compare_two
    { id: WORD_MODEL_LEVER, type: 'model', modes: ['compare_two'], carrier: 'shown', answers: ['other_object'],
      when: 'The learner names the other object: the comparison turned around.',
      does: item => `Shows a model pair of plain shapes beside the picture, the ${wordPhrase(item.comparisonWord)} one glowing. `
        + 'The model is the same for every item; it is not these objects.',
      fact: (_content, item) => `Beside the picture, a model pair of plain shapes shows what "${wordPhrase(item.comparisonWord)}" `
        + 'means: that one glows. It is not the item\'s objects.' },
    { id: FAR_PAIR_LEVER, type: 'easier', modes: ['compare_two'], carrier: 'shown', answers: ['other_object'],
      when: 'These two objects are too close in size to compare yet.', does: PRACTICE, content: item => farPair(item) },
    // identify_attribute
    { id: MENU_LEVER, type: 'legend', modes: ['identify_attribute'], answers: ['other_attribute'],
      when: 'The learner picks a choice the picture does not show.',
      does: 'Shows one small picture for each spoken choice, in the order they are asked. None is marked.',
      fact: (_content, item) => `A small picture stands for each choice: ${item.attributeOptions.map(a => ATTRIBUTE_CHILD_FORM[a]).join(', ')}.` },
    { id: FEWER_CHOICES_LEVER, type: 'custom', modes: ['identify_attribute'], carrier: 'shown', answers: ['other_attribute'],
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'Three choices are too many to hold yet.',
      does: 'Shows the choice pictures with one wrong choice greyed out, on this item.',
      content: item => droppedChoice(item),
      fact: (dropped: MeasurableAttribute, item) => `"${ATTRIBUTE_CHILD_FORM[dropped]}" is greyed out; `
        + `${item.attributeOptions.filter(a => a !== dropped).map(a => `"${ATTRIBUTE_CHILD_FORM[a]}"`).join(' and ')} are left.` },
    // non_standard
    { id: TAP_BOXES_LEVER, type: 'marks', modes: ['non_standard'], answers: ['one_short', 'one_over'],
      when: 'The learner skips a box or counts one twice.',
      does: 'Lets the learner tap each unit box as they count it; a tapped box fills. No numbers.',
      fact: 'The unit boxes can be tapped; each tapped box fills.' },
    { id: FIVE_MARKS_LEVER, type: 'marks', modes: ['non_standard'], answers: ['short_by_more', 'over_by_more'],
      offer: item => item.unitCount > 5,
      when: 'The learner loses count along a long row of boxes.', does: 'Draws a thicker line after every fifth box. No numbers.',
      fact: 'A thicker line follows every fifth unit box.' },
    { id: SHORTER_LEVER, type: 'easier', modes: ['non_standard'], carrier: 'shown', answers: ['short_by_more', 'over_by_more'],
      when: 'The learner is far off counting this many boxes.', does: PRACTICE,
      content: (item, session) => shorterMeasure(item, session) },
  ],
});
