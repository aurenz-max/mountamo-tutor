/**
 * The in-item levers on shape-sorter's four workspace modes (`/add-support-tiers`, class sweep 2026-10-08; report
 * qa/eval-reports/shape-sorter-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `shapeSorterSpokenMisses` names and the catalog's `commonStruggles`. The naming and counting levers copy di-shapes
 * (`diShapesLevers.ts`), the same task family.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `model_shape` (identify): a small card with a DIFFERENT shape, named by the tutor. Never the item's shape, a shape
 *   sharing an accepted name with it, its look-alike either way round, or a shape a later item asks about.
 * - `model_object` (find_real_object): a DIFFERENT object beside the outline of its shape. Same rules on its shape,
 *   and never an object or shape a later item asks about.
 * - `outline_only` (find_real_object): the object's inside details (hands, panes, spars) fade, so its outer edge
 *   stands out. Names nothing; offered on every real-object item, where a model often has nothing left to show.
 * - `model_count` (count): a DIFFERENT polygon with a mark on each side (or corner); the tutor says its total. Its
 *   count is not within one of the item's, nor a later item's count.
 * - `start_mark`, `touch_marks` (count): one dot on one side (or corner) of the learner's shape; each side (or corner)
 *   becomes a tap target that marks when tapped. No number, no order.
 * - `mat_pictures` (sort): under each mat label a picture of what the mat collects — that many sticks, a curved or a
 *   straight stroke, a colour swatch. Every mat alike, none marked, none a drawing of the ringed shape.
 * - `side_ticks` (sort by sides): a tick across each side of the ringed shape. No number.
 * Simplify:
 * - `plain_drawing` (identify): an ungraded DIFFERENT shape, upright, large, alone; then the full item. Only when the
 *   item is turned or small, so there is a step to drop.
 * - `fewer_sides` (count): an ungraded polygon with fewer sides, upright and large; then the full item. None on a
 *   triangle.
 * - `fewer_mats` (sort, on the item): one wrong mat greyed out on a three-mat sort. Never greys the answer.
 * find_real_object has no simplify: a bare outline is the identify mode.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { shapeSorterCard } from './shapeSorter.card';
import { REAL_WORLD_SHAPE_OBJECTS, type RealWorldShapeObjectSpec } from '../shared/realWorldShapeObjects';
import {
  NEAR_SHAPE, SHAPE_ALTERNATES, SHAPE_PROPERTIES, countNounOf, itemsFromChallenge, nameClassOf,
  type ShapeSorterItem, type ShapeSorterShapeLike,
} from './shapeSorterDomain';
import { OFF_BY } from '../../../components/live-activity/boss';

export const MODEL_SHAPE = 'model_shape';
export const MODEL_OBJECT = 'model_object';
export const OUTLINE_ONLY = 'outline_only';
export const MODEL_COUNT = 'model_count';
export const START_MARK = 'start_mark';
export const TOUCH_MARKS = 'touch_marks';
export const MAT_PICTURES = 'mat_pictures';
export const SIDE_TICKS = 'side_ticks';
export const PLAIN_DRAWING = 'plain_drawing';
export const FEWER_SIDES = 'fewer_sides';
export const FEWER_MATS = 'fewer_mats';

export const SIMPLER_SUFFIX = '~simpler';
const NAME_MISSES = shapeSorterCard.modes.identify.misses;

/** K core shapes first, so a model or practice shape is one a young child has met. */
const BY_CORE = ['circle', 'square', 'triangle', 'rectangle', 'hexagon', 'oval', 'pentagon', 'diamond', 'rhombus'];

/** The catalog mode an item belongs to. */
export const catalogModeOf = (item: ShapeSorterItem): 'identify' | 'find_real_object' | 'count' | 'sort' =>
  item.mode === 'identify' && item.realObjectId ? 'find_real_object' : item.mode;

const namesOf = (shape: string) => [shape, ...(SHAPE_ALTERNATES[shape] ?? [])];

/** True when `model` would name the item's answer or its look-alike: the same drawing, a shared accepted name, or a
 *  look-alike either way round (a rectangle beside a square answers it by elimination). */
export function shapeLeaks(model: string, item: string): boolean {
  if (nameClassOf(model) === nameClassOf(item)) return true;
  const mine = namesOf(model), theirs = namesOf(item);
  if (mine.some(n => theirs.includes(n))) return true;
  return theirs.some(n => mine.includes(NEAR_SHAPE[n])) || mine.some(n => theirs.includes(NEAR_SHAPE[n]));
}

/** The session items after this one: a model or practice item never shows what a later item asks. */
const comingAfter = (item: ShapeSorterItem, items: readonly ShapeSorterItem[]) => {
  const at = items.findIndex(i => i.id === item.id);
  return at < 0 ? [] : items.slice(at + 1);
};
const countOf = (shape: string, item: ShapeSorterItem) => {
  const g = SHAPE_PROPERTIES[shape];
  return countNounOf(item) === 'corners' ? g.corners : g.sides;
};

/** The shape `model_shape` shows, or null when nothing passes the leak rules. Deterministic per item. */
export function modelShapeFor(item: ShapeSorterItem, items: readonly ShapeSorterItem[]): string | null {
  if (catalogModeOf(item) !== 'identify') return null;
  const coming = comingAfter(item, items).map(i => i.shape);
  return BY_CORE.find(s => !shapeLeaks(s, item.shape) && !coming.some(c => shapeLeaks(s, c))) ?? null;
}

/** The object `model_object` shows, or null. Never the item's object, its shape's look-alike, or a later one. */
export function modelObjectFor(item: ShapeSorterItem, items: readonly ShapeSorterItem[]): RealWorldShapeObjectSpec | null {
  if (catalogModeOf(item) !== 'find_real_object') return null;
  const coming = comingAfter(item, items);
  return REAL_WORLD_SHAPE_OBJECTS.find(o => o.id !== item.realObjectId && !shapeLeaks(o.shape, item.shape)
    && !coming.some(c => c.realObjectId === o.id || shapeLeaks(o.shape, c.shape))) ?? null;
}

/** The polygon `model_count` shows, or null: its count is not within one of the item's nor a later item's count. */
export function modelCountFor(item: ShapeSorterItem, items: readonly ShapeSorterItem[]): string | null {
  if (item.mode !== 'count' || item.countNumeral == null) return null;
  const n = item.countNumeral;
  const coming = comingAfter(item, items).filter(i => i.mode === 'count');
  const comingCounts = new Set(coming.map(i => i.countNumeral));
  return BY_CORE.filter(s => SHAPE_PROPERTIES[s] && !SHAPE_PROPERTIES[s].curved && nameClassOf(s) !== nameClassOf(item.shape)
    && Math.abs(countOf(s, item) - n) > 1 && !comingCounts.has(countOf(s, item))
    && !coming.some(c => nameClassOf(c.shape) === nameClassOf(s)))
    .sort((a, b) => Math.abs(countOf(a, item) - n) - Math.abs(countOf(b, item) - n))[0] ?? null;
}

/** The turn a shape's drawing repeats at; a turn within 10 degrees of it reads as upright. */
const PERIOD: Record<string, number> = { square: 90, rectangle: 180, diamond: 180, rhombus: 180, oval: 180,
  triangle: 120, pentagon: 72, hexagon: 60 };
export function isTurned(shape: string, rotation: number): boolean {
  const period = PERIOD[shape];
  if (!period) return false;
  const r = ((rotation % period) + period) % period;
  return Math.min(r, period - r) > 10;
}

export interface SimplerShapeItem { item: ShapeSorterItem; shapes: ShapeSorterShapeLike[] }

const practiceOf = (item: ShapeSorterItem, shape: ShapeSorterShapeLike, type: 'identify' | 'count'): SimplerShapeItem | null => {
  const id = `${item.id}${SIMPLER_SUFFIX}`;
  const built = itemsFromChallenge({ id, type, ruleAttribute: 'shape', shapes: [shape], supportTier: item.tier },
    { tier: item.tier, countNoun: item.countNoun })[0];
  return built ? { item: { ...built, id, practiceShapes: [shape] }, shapes: [shape] } : null;
};

/**
 * The easier item a simplify lever opens, or null when this item has none. `plain_drawing`: a different shape,
 * upright, large and alone, only when the item is turned or small; never the model's shape, a look-alike, or a later
 * item's shape. `fewer_sides`: a polygon with fewer sides, upright and large; never a later counted shape.
 */
export function simplerShape(item: ShapeSorterItem | null, items: readonly ShapeSorterItem[],
  shapes: readonly ShapeSorterShapeLike[]): SimplerShapeItem | null {
  if (!item) return null;
  const drawn = shapes[item.shapeIndex];
  const color = drawn?.color ?? 'blue';
  const coming = comingAfter(item, items);
  if (catalogModeOf(item) === 'identify') {
    if (!drawn || (!isTurned(item.shape, drawn.rotation ?? 0) && drawn.size !== 'small')) return null;
    const model = modelShapeFor(item, items);
    const shape = BY_CORE.find(s => s !== model && !shapeLeaks(s, item.shape)
      && !coming.some(c => shapeLeaks(s, c.shape)) && !(model && shapeLeaks(s, model)));
    return shape ? practiceOf(item, { shape, color, size: 'large', rotation: 0 }, 'identify') : null;
  }
  if (item.mode === 'count' && item.countNumeral != null) {
    const later = new Set(coming.filter(c => c.mode === 'count').map(c => nameClassOf(c.shape)));
    const shape = ['triangle', 'square', 'pentagon']
      .find(s => countOf(s, item) < item.countNumeral! && !later.has(nameClassOf(s)) && nameClassOf(s) !== nameClassOf(item.shape));
    return shape ? practiceOf(item, { shape, color, size: 'large', rotation: 0 }, 'count') : null;
  }
  return null;
}

/** The wrong mat `fewer_mats` greys out: the last wrong one, on a sort with three mats. Never the answer. */
export function droppedMat(item: ShapeSorterItem | null): string | null {
  if (item?.mode !== 'sort' || item.choices.length < 3) return null;
  return [...item.choices].reverse().find(c => c.toLowerCase() !== item.answer.toLowerCase()) ?? null;
}

/** What a mat's picture draws: that many sticks, a curved or straight stroke, or a swatch. Read from the label only,
 *  so every mat is pictured alike and none is a drawing of the ringed shape. */
export type MatPicture = { kind: 'sticks'; n: number } | { kind: 'stroke'; curved: boolean } | { kind: 'swatch'; color: string };
export function matPicture(item: ShapeSorterItem, label: string): MatPicture | null {
  if (item.rule === 'sides') {
    const n = Number(label.split(' ')[0]);
    return Number.isFinite(n) && n > 0 ? { kind: 'sticks', n } : null;
  }
  if (item.rule === 'curved') return { kind: 'stroke', curved: label.toLowerCase() === 'curved' };
  if (item.rule === 'color') return { kind: 'swatch', color: label.toLowerCase() };
  return null;
}

/** Levers an item's tier starts with on screen. Not a pull; never recorded. Easy sorts start with the mat pictures:
 *  a pre-reader cannot read the mats, and the pictures let the learner check a group against the shape. */
export const startingLevers = (item: ShapeSorterItem | null): string[] =>
  item?.mode === 'sort' && item.tier === 'easy' ? [MAT_PICTURES] : [];

/** What the levers read beyond the item: the session's items (a model never shows what a later item asks) and the
 *  shapes of the item's challenge. */
export interface ShapeSorterLeverContext { items: readonly ShapeSorterItem[]; shapes: readonly ShapeSorterShapeLike[] }

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const PRACTICE = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';
const collects = (item: ShapeSorterItem) => (item.rule === 'sides' ? 'that many sticks'
  : item.rule === 'curved' ? 'a curved or a straight stroke' : 'a patch of that colour');
const one = (item: ShapeSorterItem) => countNounOf(item).slice(0, -1);

/** Every lever of the family, by type, in the order the tutor sees them. */
export const SHAPE_SORTER_LEVERS = leverSet<ShapeSorterItem, ShapeSorterLeverContext>({
  modeOf: catalogModeOf,
  missesOf: mode => shapeSorterCard.modes[mode]?.misses ?? [],
  support: { tier: item => item.tier ?? 'easy',
    different: item => (catalogModeOf(item) === 'find_real_object' ? 'a different object' : 'a different shape'),
    own: 'this answer' },
  specs: [
    { id: MODEL_SHAPE, type: 'model', modes: ['identify'], answers: NAME_MISSES,
      when: 'The learner names a wrong shape, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT shape (onScreen names it). Say it as your turn ("My turn: this shape is a …"), '
        + 'then ask about the learner\'s own shape again. Never say what the model means for their shape.',
      content: (item, { items }) => modelShapeFor(item, items),
      fact: (shape: string) => `Beside the learner's shape, a model card shows a different one, solved: ${article(shape)} ${shape}. It is not this one.` },
    { id: PLAIN_DRAWING, type: 'easier', modes: ['identify'], answers: NAME_MISSES,
      when: 'The learner cannot name a shape drawn turned or small yet.', does: PRACTICE,
      content: (item, { items, shapes }) => simplerShape(item, items, shapes)?.item ?? null },
    { id: OUTLINE_ONLY, type: 'layout', modes: ['find_real_object'], answers: ['said_object', ...NAME_MISSES],
      when: 'The learner names the object, or a wrong shape, instead of the shape of its outside edge.',
      does: 'Fades the inside details of the learner\'s object, so its outside edge stands out. It names nothing.',
      fact: 'The inside details of the learner\'s object are faded; its outside edge stands out.' },
    { id: MODEL_OBJECT, type: 'model', modes: ['find_real_object'], answers: ['said_object', ...NAME_MISSES],
      when: 'The learner names the object, names a wrong shape, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT object beside the outline of its shape (onScreen names it). Say it as your turn '
        + '("My turn: the … is a …"), then ask about the learner\'s own object again. Never say what the model means for their object.',
      content: (item, { items }) => modelObjectFor(item, items),
      fact: (object: RealWorldShapeObjectSpec) => `Beside the learner's object, a model card shows a different one, solved: a ${object.label} `
        + `beside the outline of its shape, ${article(object.shape)} ${object.shape}. It is not this one.` },
    { id: MODEL_COUNT, type: 'model', modes: ['count'], answers: ['said_shape_name', ...OFF_BY],
      when: 'The learner gives a wrong number, says a shape name, or does not know how to start.',
      does: item => `Shows a small card with a DIFFERENT shape, a mark on each of its ${countNounOf(item)} (onScreen says how many). `
        + `Say only its total as your turn ("My turn: this shape has … ${countNounOf(item)}"); never count it aloud and never name `
        + 'either shape. Then ask about the learner\'s shape again.',
      content: (item, { items }) => modelCountFor(item, items),
      fact: (shape: string, item) => `Beside the learner's shape, a model card shows a different shape with a mark on each of its `
        + `${countNounOf(item)}: ${COUNT_WORDS[countOf(shape, item)]} ${countNounOf(item)}. It is not this one.` },
    { id: START_MARK, type: 'marks', modes: ['count'], answers: ['one_short', 'one_over'],
      when: 'The learner counts one side or corner twice, or misses the one they started on.',
      does: item => `Puts one dot on one ${one(item)} of the learner's shape: start there and stop when you are back. No number.`,
      fact: (_on: unknown, item) => `One dot marks a starting ${one(item)} on the learner's shape. No number.` },
    { id: TOUCH_MARKS, type: 'marks', modes: ['count'], answers: ['said_shape_name', ...OFF_BY],
      when: 'The learner loses track while counting, or says the shape\'s name instead of a number.',
      does: item => `Lets the learner tap each ${one(item)} as they count it; a tapped one is marked. No numbers.`,
      fact: (_on: unknown, item) => `The ${countNounOf(item)} of the learner's shape can be tapped; each tapped one is marked. No number.` },
    { id: FEWER_SIDES, type: 'easier', modes: ['count'], answers: OFF_BY,
      when: 'This many sides or corners is too many to count yet.', does: PRACTICE,
      content: (item, { items, shapes }) => simplerShape(item, items, shapes)?.item ?? null },
    { id: MAT_PICTURES, type: 'marks', modes: ['sort'], answers: ['said_shape_name', 'other_group'],
      when: 'The learner names the shape instead of a mat, or picks another mat.',
      does: item => `Shows under each mat label a picture of what it collects (${collects(item)}). Every mat alike; none is marked.`,
      fact: (_on: unknown, item) => `Under each mat label is a picture of what that mat collects (${collects(item)}); none is marked.` },
    { id: SIDE_TICKS, type: 'marks', modes: ['sort'], answers: ['other_group'],
      offer: item => item.rule === 'sides' && !!SHAPE_PROPERTIES[item.shape] && !SHAPE_PROPERTIES[item.shape].curved,
      when: 'The learner picks a mat with the wrong number of sides.',
      does: 'Puts a small tick across each side of the gold-ringed shape. No number.',
      fact: 'A small tick crosses each side of the gold-ringed shape. No number.' },
    { id: FEWER_MATS, type: 'custom', modes: ['sort'], answers: ['other_group'], carrier: 'shown',
      why: 'It narrows this item in place (one wrong mat greyed out) rather than opening a practice item.',
      when: 'Three mats are too many to choose between yet.', does: 'Greys out one wrong mat on this item; two are left.',
      content: item => droppedMat(item),
      fact: (dropped: string, item) => `The "${dropped}" mat is greyed out; `
        + `${item.choices.filter(c => c !== dropped).map(c => `"${c}"`).join(' and ')} are left.` },
  ],
});

/** A practice item's parent and the easier item it is, rebuilt with the component's builder (journey rows). */
export function simplerFromId(itemId: string, items: readonly ShapeSorterItem[],
  shapesOf: (item: ShapeSorterItem) => readonly ShapeSorterShapeLike[]): SimplerShapeItem | null {
  if (!itemId.endsWith(SIMPLER_SUFFIX)) return null;
  const parent = items.find(i => `${i.id}${SIMPLER_SUFFIX}` === itemId);
  return parent ? simplerShape(parent, items, shapesOf(parent)) : null;
}
