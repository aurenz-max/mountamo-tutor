/**
 * The in-item levers on di-shapes (`/add-support-tiers`, DI family 3; table
 * qa/support-levers/di-shapes-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `shapesSpokenMisses` names, and the catalog's `commonStruggles`.
 *
 * DI's correction is a PARALLEL-ITEM model (user ruling 2026-10-02): a different shape, solved, then the child's.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `model_shape` (name_shape, shape_review): a small card with a DIFFERENT shape, its name printed under it. Never the item's shape,
 *   its look-alike (`NEAR_SHAPE`, either way round), a shape sharing an accepted name with it (rhombus/diamond), or
 *   the shape of a session item still to come.
 * - `model_object` (find_real_object): a DIFFERENT object beside the outline of its shape, the shape's name printed. Same rules on the
 *   object's shape, and never an object still to come.
 * - `model_count` (count_sides, count_corners): a DIFFERENT polygon with a tick on each side (or a dot on each
 *   corner), its total printed in words ("six sides"). Its count is not within one of the item's, nor the count of an item still to come; its
 *   shape is never the item's. No numeral is drawn and no shape is named.
 * Every model card shows only while its lever is pulled: no tier starts with it on screen.
 * - `start_mark` (counting): one dot on one side (or corner) of the child's own shape. No number, no order.
 * - `touch_marks` (counting): each side (or corner) of the child's shape can be tapped; a tapped one is marked.
 * Simplify (an ungraded easier item of the same mode; then the full item comes back):
 * - `plain_drawing` (naming): a DIFFERENT shape, prototype, upright, full size. Offered only when the item is drawn
 *   as a variant, turned past its gentle band, or shrunk, so there is a step to drop.
 * - `fewer_sides` (counting): a prototype polygon with fewer sides (4 or 5 → triangle, 6 → square). None on a
 *   triangle.
 *
 * build_shape (the open build; the child MAKES the named shape on dots). Starts bare at every tier: keeping track
 * of sides IS the task, so the marks come on a miss.
 * - `model_shape`: a DIFFERENT straight-sided shape, named, a tick on each side. Never the asked shape or its look-alike.
 * - `side_ticks`: a tick on each side of the child's own shape. No numeral, no order.
 * - `corner_marks` (square, rectangle): a square-corner mark on each square corner of the child's shape.
 * - `same_length_marks` (square, rhombus): sides of one length share a colour on the child's shape.
 * - `make_triangle` (simplify): make a triangle first, ungraded; the asked shape comes back after it.
 *
 * Naming modes get no help on the child's own shape: naming is recognition, and ticks or corner dots would turn it
 * into counting. find_real_object has no simplify: a bare outline is name_shape.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { diShapesCard } from './diShapes.card';
import { NEAR_SHAPE } from '../math/shapeSorterDomain';
import { REAL_WORLD_SHAPE_OBJECTS, type RealWorldShapeObjectSpec } from '../shared/realWorldShapeObjects';
import { SHAPE_MENU } from './diShapesMenu';
import { countNoun, isCountingType, type DiShapeName, type DiShapesChallenge } from './diShapesScript';

export const MODEL_SHAPE = 'model_shape';
export const MODEL_OBJECT = 'model_object';
export const MODEL_COUNT = 'model_count';
export const START_MARK = 'start_mark';
export const TOUCH_MARKS = 'touch_marks';
export const PLAIN_DRAWING = 'plain_drawing';
export const FEWER_SIDES = 'fewer_sides';
export const SIDE_TICKS = 'side_ticks';
export const CORNER_MARKS = 'corner_marks';
export const SAME_LENGTH_MARKS = 'same_length_marks';
export const MAKE_TRIANGLE = 'make_triangle';

const SHAPES = Object.keys(SHAPE_MENU) as DiShapeName[];
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const NAME_MISSES = ['near_name', 'other_shape_name', 'described_shape'];

/** A real object's shape word as the drawable shape ("diamond" is drawn as the rhombus). */
const objectShape = (o: RealWorldShapeObjectSpec): DiShapeName => (o.shape === 'diamond' ? 'rhombus' : o.shape);

/** Every word a shape is named by: its own and the alternates the judge accepts. */
const namesOf = (shape: DiShapeName): string[] => [SHAPE_MENU[shape].word, ...(SHAPE_MENU[shape].spokenAlternates ?? [])];

/** True when `model` would name the item's answer or its look-alike: the item's shape, a shape sharing an accepted
 *  name with it, or a look-alike either way round (a rectangle beside a square answers it by elimination). */
export function shapeLeaks(model: DiShapeName, item: DiShapeName): boolean {
  if (model === item) return true;
  const mine = namesOf(model), theirs = namesOf(item);
  if (mine.some(n => theirs.includes(n))) return true;
  return theirs.some(n => mine.includes(NEAR_SHAPE[n])) || mine.some(n => theirs.includes(NEAR_SHAPE[n]));
}

const countOf = (item: DiShapesChallenge) => item.countNumeral ?? 0;
const countFor = (shape: DiShapeName, type: DiShapesChallenge['challengeType']) =>
  (type === 'count_corners' ? SHAPE_MENU[shape].corners : SHAPE_MENU[shape].sides) ?? null;

/** The session items after this one: a model never shows what a later item asks. */
const comingAfter = (item: DiShapesChallenge, items: readonly DiShapesChallenge[]) => {
  const at = items.findIndex(i => i.id === item.id);
  return at < 0 ? [] : items.slice(at + 1);
};

/** One drawable item of a shape, shaped as the generator shapes it: prototype, upright, full size. */
export function shapeItem(shape: DiShapeName, type: DiShapesChallenge['challengeType'], id: string,
    tier?: DiShapesChallenge['supportTier'], realObject?: RealWorldShapeObjectSpec): DiShapesChallenge {
  const spec = SHAPE_MENU[shape];
  const n = countFor(shape, type);
  return {
    id, challengeType: type, shape, shapeWord: spec.word, article: spec.article, sides: spec.sides, corners: spec.corners,
    rotationDeg: 0, exemplar: 'prototype', scalePct: 100,
    ...(tier ? { supportTier: tier } : {}),
    ...(realObject ? { realObjectId: realObject.id, realObjectLabel: realObject.label } : {}),
    ...(isCountingType(type) && n != null
      ? { countNumeral: n, countWord: COUNT_WORDS[n], asrAliases: [COUNT_WORDS[n], String(n)] }
      : { asrAliases: spec.asrAliases, ...(spec.spokenAlternates ? { spokenAlternates: spec.spokenAlternates } : {}) }),
  };
}

/** Prefer the K core five, then menu order, so the model is a shape a young child has met. */
const byCore = (a: DiShapeName, b: DiShapeName) =>
  Number(SHAPE_MENU[b].core) - Number(SHAPE_MENU[a].core) || SHAPES.indexOf(a) - SHAPES.indexOf(b);

/** The model a mode's model lever shows, or null when nothing passes the leak rules. Deterministic per item. */
export function modelFor(item: DiShapesChallenge, items: readonly DiShapesChallenge[]): DiShapesChallenge | null {
  const coming = comingAfter(item, items);
  const id = `${item.id}~model`;
  if (item.challengeType === 'name_real_object') {
    const comingObjects = new Set(coming.map(i => i.realObjectId));
    const object = REAL_WORLD_SHAPE_OBJECTS.find(o => o.id !== item.realObjectId && !comingObjects.has(o.id)
      && !shapeLeaks(objectShape(o), item.shape) && !coming.some(i => objectShape(o) === i.shape));
    return object ? shapeItem(objectShape(object), 'name_real_object', id, undefined, object) : null;
  }
  if (isCountingType(item.challengeType)) {
    const n = countOf(item), comingCounts = new Set(coming.map(countOf));
    const shape = SHAPES.filter(s => {
      const c = countFor(s, item.challengeType);
      return c != null && s !== item.shape && Math.abs(c - n) > 1 && !comingCounts.has(c);
    }).sort((a, b) => Math.abs(countFor(a, item.challengeType)! - n) - Math.abs(countFor(b, item.challengeType)! - n) || byCore(a, b))[0];
    return shape ? shapeItem(shape, item.challengeType, id) : null;
  }
  const comingShapes = coming.map(i => i.shape);
  // A build's model is a shape the child could make: straight sides, so its ticked sides can be shown.
  const pool = item.challengeType === 'build_shape' ? SHAPES.filter(s => SHAPE_MENU[s].sides != null) : SHAPES;
  const shape = pool.filter(s => !shapeLeaks(s, item.shape) && !comingShapes.some(c => shapeLeaks(s, c) || s === c))
    .sort(byCore)[0];
  return shape ? shapeItem(shape, item.challengeType, id) : null;
}

/** The item has a structural step to drop: a variant drawing, a turn past its gentle band, or a smaller drawing. */
const hasPlainStep = (item: DiShapesChallenge) => (item.exemplar ?? 'prototype') === 'variant'
  || Math.abs(item.rotationDeg ?? 0) > SHAPE_MENU[item.shape].maxRotationDeg || (item.scalePct ?? 100) < 100;

/** The easier item a simplify lever opens, or null when there is none for this item. */
export function simplerShape(item: DiShapesChallenge, lever: string, items: readonly DiShapesChallenge[]): DiShapesChallenge | null {
  const id = `${item.id}~simpler`, tier = item.supportTier;
  if (lever === PLAIN_DRAWING) {
    if (isCountingType(item.challengeType) || item.challengeType === 'name_real_object' || !hasPlainStep(item)) return null;
    const coming = comingAfter(item, items).map(i => i.shape);
    // A different shape from the model, so the practice is not answered off the model card.
    const model = modelFor(item, items)?.shape;
    const shape = SHAPES.filter(s => s !== model && !shapeLeaks(s, item.shape) && !coming.some(c => shapeLeaks(s, c) || s === c))
      .sort(byCore)[0];
    return shape ? shapeItem(shape, item.challengeType, id, tier) : null;
  }
  if (lever === MAKE_TRIANGLE) {
    return item.challengeType === 'build_shape' && item.shape !== 'triangle' ? shapeItem('triangle', 'build_shape', id, tier) : null;
  }
  if (lever === FEWER_SIDES) {
    if (!isCountingType(item.challengeType)) return null;
    const n = countOf(item);
    const shape: DiShapeName | null = n === 6 ? 'square' : n === 4 || n === 5 ? 'triangle' : null;
    return shape && shape !== item.shape ? shapeItem(shape, item.challengeType, id, tier) : null;
  }
  return null;
}

/** The model lever of an item's mode. */
export const modelLever = (item: DiShapesChallenge) => item.challengeType === 'name_real_object' ? MODEL_OBJECT
  : isCountingType(item.challengeType) ? MODEL_COUNT : MODEL_SHAPE;

/** What the levers read beyond the item: the session's items, so a model never shows a shape (or count) still to come. */
export interface ShapeLeverContext { items: readonly DiShapesChallenge[] }

const PRACTICE = 'Opens an easier one of the same kind first. It is not graded; the full shape comes back after it.';
const NAMING = ['name_shape', 'shape_review'];
/** The eval mode of an item (`find_real_object` asks a `name_real_object` item). */
const modeOf = (item: DiShapesChallenge) => (item.challengeType === 'name_real_object' ? 'find_real_object' : item.challengeType);

const solved = (model: DiShapesChallenge, noun: string) => (model.challengeType === 'name_real_object'
  ? `a ${model.realObjectLabel} beside the outline of its shape, answered ${model.article} ${model.shapeWord}`
  : noun ? `a different shape with a mark on each of its ${noun}, answered ${model.countWord} ${noun}`
    : `${model.article} ${model.shapeWord}`);
const modelFact = (where: 'object' | 'shape', noun = '') => (model: DiShapesChallenge) =>
  `Beside the learner's ${where}, a model card shows a different one, solved: ${solved(model, noun)}. It is not this one.`;

/** The three counting levers, one spec per counting mode: their words name what is counted. */
const countingSpecs = (mode: 'count_sides' | 'count_corners'): LeverSpec<DiShapesChallenge, ShapeLeverContext>[] => {
  const noun = mode === 'count_sides' ? 'sides' : 'corners', one = noun.slice(0, -1);
  return [
    { id: MODEL_COUNT, type: 'model', modes: [mode], answers: ['said_shape_name', ...OFF_BY],
      when: `The learner gives a wrong number of ${noun}, says a shape name, or does not know how to start.`,
      does: `Shows a small card with a DIFFERENT shape, a mark on each of its ${noun} (onScreen says how many). Say only its total as `
        + `your turn ("My turn: this shape has … ${noun}"); never count it aloud and never name either shape. Then ask about the learner's shape again.`,
      content: (item, { items }) => modelFor(item, items), fact: modelFact('shape', noun) },
    { id: START_MARK, type: 'marks', modes: [mode], answers: ['one_short', 'one_over'],
      when: `The learner counts one ${one} twice or misses the one they started on.`,
      does: `Puts one dot on one ${one} of the learner's shape: start there and stop when you are back. No number.`,
      fact: `One dot marks a starting ${one} on the learner's shape. No number.` },
    { id: TOUCH_MARKS, type: 'marks', modes: [mode], answers: OFF_BY,
      when: `The learner loses track while counting the ${noun}.`,
      does: `Lets the learner tap each ${one} as they count it; a tapped one is marked. No numbers.`,
      fact: `The ${noun} of the learner's shape can be tapped; each tapped one is marked. No number.` },
  ];
};
const fewerSides = (mode: 'count_sides' | 'count_corners'): LeverSpec<DiShapesChallenge, ShapeLeverContext> => ({
  id: FEWER_SIDES, type: 'easier', modes: [mode], answers: OFF_BY,
  when: `This many ${mode === 'count_sides' ? 'sides' : 'corners'} is too many to count yet.`, does: PRACTICE,
  content: (item, { items }) => simplerShape(item, FEWER_SIDES, items) });
const [sidesModel, sidesStart, sidesTouch] = countingSpecs('count_sides');
const [cornersModel, cornersStart, cornersTouch] = countingSpecs('count_corners');

/** Every lever of the pack, by type, in the order the tutor sees them. build_shape's words name the build, never a spoken answer. */
export const SHAPE_LEVERS = leverSet<DiShapesChallenge, ShapeLeverContext>({
  modeOf,
  missesOf: mode => diShapesCard.modes[mode]?.misses ?? [],
  // The build never models first: easy and medium both start bare.
  support: { tier: item => item.challengeType === 'build_shape' ? (item.supportTier === 'hard' ? 'hard' : 'medium') : item.supportTier ?? 'easy',
    different: 'a different shape', own: item => item.challengeType === 'build_shape' ? 'how many sides it has' : 'this answer' },
  specs: [
    { id: MODEL_OBJECT, type: 'model', modes: ['find_real_object'], answers: ['said_object', ...NAME_MISSES],
      when: 'The learner names the object, names a wrong shape, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT object beside the outline of its shape (onScreen names it). Say it as your turn '
        + '("My turn: the … is a …"), then ask about the learner\'s own object again. Never say what the model means for their object.',
      content: (item, { items }) => modelFor(item, items), fact: modelFact('object') },
    sidesModel, cornersModel,
    { id: MODEL_SHAPE, type: 'model', modes: NAMING, answers: NAME_MISSES,
      when: 'The learner names a wrong shape, describes it instead of naming it, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT shape (onScreen names it). Say it as your turn ("My turn: this shape is a …"), '
        + 'then ask about the learner\'s own shape again. Never say what the model means for their shape.',
      content: (item, { items }) => modelFor(item, items), fact: modelFact('shape') },
    { id: MODEL_SHAPE, type: 'model', modes: ['build_shape'], answers: ['too_few_sides', 'too_many_sides'],
      when: 'The learner does not know how to start, or makes a shape with the wrong number of sides.',
      does: 'Shows a small card with a DIFFERENT shape, named, a tick on each side (onScreen names it). Say it as your turn '
        + '("My turn: this shape is a …"), then let the learner make theirs. Never say what the asked shape has.',
      content: (item, { items }) => modelFor(item, items),
      fact: (model: DiShapesChallenge) => `Beside the grid, a model card shows a different shape, solved: ${model.article} ${model.shapeWord}, a tick on each side. It is not the asked shape.` },
    sidesStart, cornersStart, sidesTouch, cornersTouch,
    { id: PLAIN_DRAWING, type: 'easier', modes: NAMING, answers: ['near_name', 'other_shape_name'],
      when: 'The learner cannot name a shape drawn turned, small or unusual yet.', does: PRACTICE,
      content: (item, { items }) => simplerShape(item, PLAIN_DRAWING, items) },
    fewerSides('count_sides'), fewerSides('count_corners'),
    { id: SIDE_TICKS, type: 'marks', modes: ['build_shape'], answers: ['too_few_sides', 'too_many_sides'],
      when: 'The learner loses track of how many sides their shape has.',
      does: "Puts a tick on each side of the learner's own shape, so they can count them. No number.",
      fact: "Each side of the learner's own shape has a tick. No number." },
    { id: CORNER_MARKS, type: 'marks', modes: ['build_shape'], answers: ['corners_not_square'],
      offer: item => item.shape === 'square' || item.shape === 'rectangle',
      when: "The learner's corners are not square corners.",
      does: "Marks each square corner of the learner's own shape; a corner with no mark is not square.",
      fact: "Each square corner of the learner's own shape is marked." },
    { id: SAME_LENGTH_MARKS, type: 'marks', modes: ['build_shape'], answers: ['sides_not_equal', 'made_square'],
      offer: item => item.shape === 'square' || item.shape === 'rhombus',
      when: "The learner's sides are not all the same length.",
      does: "Colours the sides of the learner's own shape so sides of one length match.",
      fact: "Sides of one length on the learner's own shape share a colour." },
    { id: MAKE_TRIANGLE, type: 'easier', modes: ['build_shape'],
      answers: ['too_few_sides', 'too_many_sides', 'corners_not_square', 'sides_not_equal', 'made_square', 'parallel_off'],
      when: 'This shape is too hard to make yet.',
      does: `${PRACTICE.replace('the full shape', 'the asked shape')} The easier one is a triangle.`,
      content: (item, { items }) => simplerShape(item, MAKE_TRIANGLE, items) },
  ],
});
