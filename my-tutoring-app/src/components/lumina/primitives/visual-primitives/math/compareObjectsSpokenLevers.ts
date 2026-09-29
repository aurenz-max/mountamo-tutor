/**
 * The in-item levers on compare-objects' three spoken modes (`/add-support-tiers`, handoff 23 step 2; table
 * qa/support-levers/m2-lever-tables-2026-09-28.md, spoken slice). No real-learner evidence: the misses are what
 * `compareObjectsSpokenMisses` names, plus the catalog's documented struggles (the comparison turned around, one unit
 * too many).
 *
 * compare_two
 * - `word_model` (help): beside the picture, a model pair of plain shapes in the item's attribute, the one the asked
 *   word names glowing. Answers `other_object`. Leak rule: the model is fixed per comparison word (the same shapes and
 *   the same place for every item), so it says what the word means and nothing about which object wins.
 * - `far_pair` (simplify): an ungraded pair of two plain objects far apart in size, same attribute and word, no name of
 *   the item's; then the full item. Answers `other_object`. Only when the item's two sizes are within 25.
 * identify_attribute
 * - `menu_pictures` (help): one picture per spoken choice, in the ask's order, none marked. Answers `other_attribute`.
 *   Leak rule: every choice is pictured alike; no picture is the item's own drawing.
 * - `fewer_choices` (simplify, on the item): the menu pictures with one wrong choice greyed out. Answers
 *   `other_attribute`. Only on a menu of three or more; never greys the answer (handoff 21 ruling 3: assisted work).
 * non_standard (`showUnitNumbers` stays a post-answer reveal; it must never become a lever)
 * - `tap_boxes` (help): the unit boxes can be tapped; a tapped box fills. Answers `one_short`, `one_over`. Leak rule:
 *   fills only what the learner tapped, never a numeral.
 * - `five_marks` (help): a thicker line after every fifth box. Answers `short_by_more`, `over_by_more`. No numeral;
 *   only on more than five boxes.
 * - `shorter_measure` (simplify): an ungraded measure of a shorter plain object with the same unit, at most half the
 *   boxes (two or more), a count no session item has where one is free; then the full item. Answers `short_by_more`,
 *   `over_by_more`.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CompareObject, CompareObjectsChallenge } from './CompareObjects';
import { ATTRIBUTE_CHILD_FORM, isGreaterComparison, itemFromChallenge, type CompareObjectsItem, type ComparisonWord,
  type MeasurableAttribute } from './compareObjectsScript';

export const WORD_MODEL_LEVER = 'word_model';
export const FAR_PAIR_LEVER = 'far_pair';
export const MENU_LEVER = 'menu_pictures';
export const FEWER_CHOICES_LEVER = 'fewer_choices';
export const TAP_BOXES_LEVER = 'tap_boxes';
export const FIVE_MARKS_LEVER = 'five_marks';
export const SHORTER_LEVER = 'shorter_measure';

type Easier = { item: CompareObjectsItem; challenge: CompareObjectsChallenge };

/**
 * The model pair for a comparison word: two plain shapes, big first, and which one glows. Fixed per word, never read
 * from the item, which is the leak rule.
 */
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
// The drawings colour objects blue then pink by position, so the plain names say which one is which.
const COLOURS = ['blue', 'pink'];

const sizesClose = (objects: readonly CompareObject[]) =>
  objects.length === 2 && Math.abs(objects[0].visualSize - objects[1].visualSize) < 25;

/** The easier compare_two pair, or null when the item's pair is already far apart. */
export function farPair(item: CompareObjectsItem | null, challenge: CompareObjectsChallenge | null): Easier | null {
  if (item?.kind !== 'compare_two' || !challenge?.objects || !sizesClose(challenge.objects)) return null;
  const sizes = [85, 30];
  for (const noun of NOUNS[item.attribute]) {
    const objects: CompareObject[] = COLOURS.map((c, i) => ({ name: `${c} ${noun}`, visualSize: sizes[i], actualValue: sizes[i] }));
    if (objects.some(o => item.objectNames.includes(o.name))) continue;
    const winner = isGreaterComparison(item.comparisonWord) ? objects[0] : objects[1];
    const easier: CompareObjectsChallenge = { ...challenge, id: `${item.id}~simpler`, objects, correctAnswer: winner.name };
    const built = itemFromChallenge(easier, { band: item.band });
    if (built) return { item: built, challenge: easier };
  }
  return null;
}

const MEASURED = ['stick', 'straw', 'paper strip'];

/** The easier non_standard measure, or null when no shorter count of two or more fits. */
export function shorterMeasure(item: CompareObjectsItem | null, challenge: CompareObjectsChallenge | null,
  session: readonly CompareObjectsItem[]): Easier | null {
  if (item?.kind !== 'non_standard' || !challenge?.objects?.[0]) return null;
  const name = MEASURED.find(n => n !== item.objectNames[0]);
  if (!name) return null;
  const counts: number[] = [];
  for (let n = Math.ceil(item.unitCount / 2); n >= 2; n--) if (n < item.unitCount) counts.push(n);
  const size = challenge.objects[0].visualSize;
  for (const taken of [new Set([item, ...session].map(i => i.unitCount)), new Set([item.unitCount])])
    for (const n of counts) {
      if (taken.has(n)) continue;
      const scaled = Math.max(10, Math.round(size * n / item.unitCount));
      const easier: CompareObjectsChallenge = { ...challenge, id: `${item.id}~simpler`, unitCount: n, correctAnswer: String(n),
        objects: [{ name, visualSize: scaled, actualValue: scaled }], showUnitNumbers: false };
      const built = itemFromChallenge(easier, { band: item.band });
      if (built) return { item: built, challenge: easier };
    }
  return null;
}

export function compareObjectsSpokenLevers(item: CompareObjectsItem | null, challenge: CompareObjectsChallenge | null,
  pulled: readonly string[], session: readonly CompareObjectsItem[]): WorkspaceLever[] {
  if (!item || item.answerKind === 'gesture') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const practiceDoes = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';
  switch (item.kind) {
    case 'compare_two': return [
      lever(WORD_MODEL_LEVER, 'help', ['other_object'], 'The learner names the other object: the comparison turned around.',
        `Shows a model pair of plain shapes beside the picture, the ${wordPhrase(item.comparisonWord)} one glowing. `
          + 'The model is the same for every item; it is not these objects.'),
      ...(farPair(item, challenge) ? [lever(FAR_PAIR_LEVER, 'simplify', ['other_object'],
        'These two objects are too close in size to compare yet.', practiceDoes)] : [])];
    case 'identify_attribute': return [
      lever(MENU_LEVER, 'help', ['other_attribute'], 'The learner picks a choice the picture does not show.',
        'Shows one small picture for each spoken choice, in the order they are asked. None is marked.'),
      ...(droppedChoice(item) ? [lever(FEWER_CHOICES_LEVER, 'simplify', ['other_attribute'],
        'Three choices are too many to hold yet.', 'Shows the choice pictures with one wrong choice greyed out, on this item.')] : [])];
    case 'non_standard': return [
      lever(TAP_BOXES_LEVER, 'help', ['one_short', 'one_over'], 'The learner skips a box or counts one twice.',
        'Lets the learner tap each unit box as they count it; a tapped box fills. No numbers.'),
      ...(item.unitCount > 5 ? [lever(FIVE_MARKS_LEVER, 'help', ['short_by_more', 'over_by_more'],
        'The learner loses count along a long row of boxes.', 'Draws a thicker line after every fifth box. No numbers.')] : []),
      ...(shorterMeasure(item, challenge, session) ? [lever(SHORTER_LEVER, 'simplify', ['short_by_more', 'over_by_more'],
        'The learner is far off counting this many boxes.', practiceDoes)] : [])];
    default: return [];
  }
}

const wordPhrase = (word: ComparisonWord) => word === 'shorter_height' ? 'shorter' : word.replace('_', ' ');

/** What the pulled levers put on screen, as a scene fact. Never the answer: no object, no count, no marked choice. */
export function spokenLeverFacts(item: CompareObjectsItem | null, pulled: readonly string[]): string {
  if (!item || item.answerKind === 'gesture') return '';
  const dropped = droppedChoice(item);
  return [
    item.kind === 'compare_two' && pulled.includes(WORD_MODEL_LEVER)
      && `Beside the picture, a model pair of plain shapes shows what "${wordPhrase(item.comparisonWord)}" means: that one glows. It is not the item's objects.`,
    item.kind === 'identify_attribute' && (pulled.includes(MENU_LEVER) || pulled.includes(FEWER_CHOICES_LEVER))
      && `A small picture stands for each choice: ${item.attributeOptions.map(a => ATTRIBUTE_CHILD_FORM[a]).join(', ')}.`,
    item.kind === 'identify_attribute' && pulled.includes(FEWER_CHOICES_LEVER) && dropped
      && `"${ATTRIBUTE_CHILD_FORM[dropped]}" is greyed out; ${item.attributeOptions.filter(a => a !== dropped).map(a => `"${ATTRIBUTE_CHILD_FORM[a]}"`).join(' and ')} are left.`,
    item.kind === 'non_standard' && pulled.includes(TAP_BOXES_LEVER) && 'The unit boxes can be tapped; each tapped box fills.',
    item.kind === 'non_standard' && pulled.includes(FIVE_MARKS_LEVER) && 'A thicker line follows every fifth unit box.',
  ].filter((s): s is string => !!s).join(' ');
}
