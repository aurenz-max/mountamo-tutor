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
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { REAL_WORLD_SHAPE_OBJECTS, type RealWorldShapeObjectSpec } from '../shared/realWorldShapeObjects';
import {
  NEAR_SHAPE, SHAPE_ALTERNATES, SHAPE_PROPERTIES, countNounOf, itemsFromChallenge, nameClassOf,
  type ShapeSorterItem, type ShapeSorterShapeLike,
} from './shapeSorterDomain';

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
const NAME_MISSES = ['near_name', 'other_shape_name'];
const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];

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
  return built ? { item: { ...built, id }, shapes: [shape] } : null;
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

export function shapeSorterLevers(item: ShapeSorterItem | null, pulled: readonly string[],
  items: readonly ShapeSorterItem[], shapes: readonly ShapeSorterShapeLike[]): WorkspaceLever[] {
  if (!item) return [];
  const on = [...startingLevers(item), ...pulled];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: on.includes(id), answers, when, does });
  const practice = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';
  const out: WorkspaceLever[] = [];
  const mode = catalogModeOf(item);
  if (mode === 'identify') {
    if (modelShapeFor(item, items)) out.push(lever(MODEL_SHAPE, 'help', 'both', NAME_MISSES,
      'The learner names a wrong shape, or does not know how to start.',
      'Shows a small card with a DIFFERENT shape (onScreen names it). Say it as your turn ("My turn: this shape is a …"), '
        + 'then ask about the learner\'s own shape again. Never say what the model means for their shape.'));
    if (simplerShape(item, items, shapes)) out.push(lever(PLAIN_DRAWING, 'simplify', 'both', NAME_MISSES,
      'The learner cannot name a shape drawn turned or small yet.', practice));
  } else if (mode === 'find_real_object') {
    out.push(lever(OUTLINE_ONLY, 'help', 'shown', ['said_object', ...NAME_MISSES],
      'The learner names the object, or a wrong shape, instead of the shape of its outside edge.',
      'Fades the inside details of the learner\'s object, so its outside edge stands out. It names nothing.'));
    if (modelObjectFor(item, items)) out.push(lever(MODEL_OBJECT, 'help', 'both', ['said_object', ...NAME_MISSES],
      'The learner names the object, names a wrong shape, or does not know how to start.',
      'Shows a small card with a DIFFERENT object beside the outline of its shape (onScreen names it). Say it as your turn '
        + '("My turn: the … is a …"), then ask about the learner\'s own object again. Never say what the model means for their object.'));
  } else if (mode === 'count') {
    const noun = countNounOf(item), one = noun.slice(0, -1);
    if (modelCountFor(item, items)) out.push(lever(MODEL_COUNT, 'help', 'both', ['said_shape_name', ...OFF_BY],
      `The learner gives a wrong number of ${noun}, says a shape name, or does not know how to start.`,
      `Shows a small card with a DIFFERENT shape, a mark on each of its ${noun} (onScreen says how many). Say only its total as `
        + `your turn ("My turn: this shape has … ${noun}"); never count it aloud and never name either shape. Then ask about the learner's shape again.`));
    out.push(lever(START_MARK, 'help', 'shown', ['one_short', 'one_over'],
      `The learner counts one ${one} twice or misses the one they started on.`,
      `Puts one dot on one ${one} of the learner's shape: start there and stop when you are back. No number.`));
    out.push(lever(TOUCH_MARKS, 'help', 'shown', ['said_shape_name', ...OFF_BY],
      `The learner loses track while counting the ${noun}, or says the shape's name instead of a number.`,
      `Lets the learner tap each ${one} as they count it; a tapped one is marked. No numbers.`));
    if (simplerShape(item, items, shapes)) out.push(lever(FEWER_SIDES, 'simplify', 'both', OFF_BY,
      `This many ${noun} is too many to count yet.`, practice));
  } else {
    out.push(lever(MAT_PICTURES, 'help', 'shown', ['said_shape_name', 'other_group'],
      'The learner names the shape instead of a mat, or picks another mat.',
      `Shows under each mat label a picture of what it collects (${item.rule === 'sides' ? 'that many sticks'
        : item.rule === 'curved' ? 'a curved or a straight stroke' : 'a patch of that colour'}). Every mat alike; none is marked.`));
    if (item.rule === 'sides' && SHAPE_PROPERTIES[item.shape] && !SHAPE_PROPERTIES[item.shape].curved)
      out.push(lever(SIDE_TICKS, 'help', 'shown', ['other_group'], 'The learner picks a mat with the wrong number of sides.',
        'Puts a small tick across each side of the gold-ringed shape. No number.'));
    if (droppedMat(item)) out.push(lever(FEWER_MATS, 'simplify', 'shown', ['other_group'],
      'Three mats are too many to choose between yet.', 'Greys out one wrong mat on this item; two are left.'));
  }
  return out;
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** What the levers on screen show, as a scene fact. Names a model; never the learner's shape, count or group. */
export function shapeSorterLeverFacts(item: ShapeSorterItem | null, pulled: readonly string[],
  items: readonly ShapeSorterItem[]): string {
  if (!item) return '';
  const on = new Set([...startingLevers(item), ...pulled]);
  const noun = item.mode === 'count' ? countNounOf(item) : '';
  const shape = on.has(MODEL_SHAPE) ? modelShapeFor(item, items) : null;
  const object = on.has(MODEL_OBJECT) ? modelObjectFor(item, items) : null;
  const counted = on.has(MODEL_COUNT) ? modelCountFor(item, items) : null;
  const dropped = on.has(FEWER_MATS) ? droppedMat(item) : null;
  return [
    shape && `Beside the learner's shape, a model card shows a different one, solved: ${article(shape)} ${shape}. It is not this one.`,
    object && `Beside the learner's object, a model card shows a different one, solved: a ${object.label} beside the outline of its shape, ${article(object.shape)} ${object.shape}. It is not this one.`,
    on.has(OUTLINE_ONLY) && 'The inside details of the learner\'s object are faded; its outside edge stands out.',
    counted && `Beside the learner's shape, a model card shows a different shape with a mark on each of its ${noun}: ${COUNT_WORDS[countOf(counted, item)]} ${noun}. It is not this one.`,
    item.mode === 'count' && on.has(START_MARK) && `One dot marks a starting ${noun.slice(0, -1)} on the learner's shape. No number.`,
    item.mode === 'count' && on.has(TOUCH_MARKS) && `The ${noun} of the learner's shape can be tapped; each tapped one is marked. No number.`,
    item.mode === 'sort' && on.has(MAT_PICTURES) && `Under each mat label is a picture of what that mat collects (${item.rule === 'sides'
      ? 'that many sticks' : item.rule === 'curved' ? 'a curved or a straight stroke' : 'a patch of that colour'}); none is marked.`,
    item.mode === 'sort' && on.has(SIDE_TICKS) && 'A small tick crosses each side of the gold-ringed shape. No number.',
    dropped && `The "${dropped}" mat is greyed out; ${item.choices.filter(c => c !== dropped).map(c => `"${c}"`).join(' and ')} are left.`,
  ].filter((s): s is string => !!s).join(' ');
}

/** A practice item's parent and the easier item it is, rebuilt with the component's builder (journey rows). */
export function simplerFromId(itemId: string, items: readonly ShapeSorterItem[],
  shapesOf: (item: ShapeSorterItem) => readonly ShapeSorterShapeLike[]): SimplerShapeItem | null {
  if (!itemId.endsWith(SIMPLER_SUFFIX)) return null;
  const parent = items.find(i => `${i.id}${SIMPLER_SUFFIX}` === itemId);
  return parent ? simplerShape(parent, items, shapesOf(parent)) : null;
}
