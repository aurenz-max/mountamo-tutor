/**
 * shape-composer's in-item levers (/add-support-tiers; report qa/eval-reports/shape-composer-levers-2026-10-09.md). The
 * misses are what `shapeComposerMiss` observes; there is no real-learner evidence. K-1 band: every help lever changes
 * the picture, and the only words on one (the parts model's tags) are read aloud by the tutor.
 *
 * - compose-match: `empty_space` (help) the part of the outline no piece covers yet is lit; `in_place` (help) each
 *   piece on the board is ringed green when it sits in a place, amber when it does not; `fewer_pieces` (simplify) a
 *   two-piece outline of another shape, when the item has three or more pieces.
 * - compose-picture: `empty_spots` (help) the picture spots no shape fills yet glow (drawn even when the session hides
 *   the spots); `smaller_picture` (simplify) a two-shape picture of something else, when the item has three or more.
 * - decompose: `split_lines` (help) the dashed lines inside the big shape, only where the session hides them;
 *   `parts_model` (help) a picture outside the item: another big shape split into its parts, each tinted and tagged
 *   with its shape, using none of the item's part shapes; `two_parts` (simplify) a big shape of two parts, when the
 *   item has more.
 * - how-many-ways: `pieces_model` (help) a picture outside the item: another shape built from squares, each square
 *   outlined, never the item's shape or its number of pieces; `smaller_build` (simplify) a known two-piece build of
 *   another shape, when the item needs more than two.
 * - free-create: `list_match` (help) each icon in the list lights when a shape of its kind is on the board, and a
 *   shape that is not on the list is ringed; `join_marks` (help) each shape is ringed green when it touches another,
 *   amber when it is on its own, red when it sits on top of another; `smaller_recipe` (simplify) the same kind of list
 *   one shape shorter. An older payload with no list has no lever (`too_few_shapes` is unanswered).
 *
 * Leak rules (code): no lever text or scene fact carries a digit; a decompose model never uses or names the item's part
 * shapes; a how-many-ways model is never the item's shape or its number of pieces; a practice item never repeats the
 * learner's item.
 *
 * Declared once as a lever set (`SHAPE_COMPOSER_LEVERS`, `bossLevers.ts`) by type: the lit outline, rings, glowing
 * spots, split lines and list lights are `marks`; the two pictures outside the item are `model` (a different item,
 * solved; when it comes is the set's `support`, by the item's tier); the five simplify levers are `easier`. Its context
 * is how many shapes are on the board: a ring on the learner's pieces is offered only once there is one.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ShapeComposerChallenge } from './ShapeComposer';
import { SHAPE_COMPOSER_MISSES_BY_MODE } from './shapeComposer.card';
import { hasOverlap, pieceGap, recipeInstruction, TOUCH_GAP, type BoardPiece, type RecipePart } from './shapeComposerBuild';

export const EMPTY_SPACE_LEVER = 'empty_space';
export const IN_PLACE_LEVER = 'in_place';
export const FEWER_PIECES_LEVER = 'fewer_pieces';
export const EMPTY_SPOTS_LEVER = 'empty_spots';
export const SMALLER_PICTURE_LEVER = 'smaller_picture';
export const SPLIT_LINES_LEVER = 'split_lines';
export const PARTS_MODEL_LEVER = 'parts_model';
export const TWO_PARTS_LEVER = 'two_parts';
export const PIECES_MODEL_LEVER = 'pieces_model';
export const SMALLER_BUILD_LEVER = 'smaller_build';
export const LIST_MATCH_LEVER = 'list_match';
export const JOIN_MARKS_LEVER = 'join_marks';
export const SMALLER_RECIPE_LEVER = 'smaller_recipe';

const SIMPLER = '~simpler';
export const isPracticeShape = (c: Pick<ShapeComposerChallenge, 'id'>) => c.id.endsWith(SIMPLER);

const square = (x: number, y: number, w: number, h: number) => `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

// ── models outside the item ─────────────────────────────────────────────────

/** decompose's parts model: a big shape, its parts' outlines (canvas units in a 160 x 100 box) and their shape. */
export interface PartsModel { name: string; part: string; outline: string; parts: string[] }
const PARTS_MODELS: PartsModel[] = [
  { name: 'rectangle', part: 'square', outline: square(10, 20, 140, 70),
    parts: [square(10, 20, 70, 70), square(80, 20, 70, 70)] },
  { name: 'square', part: 'triangle', outline: square(45, 10, 80, 80),
    parts: ['M 45 10 L 125 10 L 45 90 Z', 'M 125 10 L 125 90 L 45 90 Z'] },
  { name: 'rectangle', part: 'triangle', outline: square(10, 20, 140, 70),
    parts: ['M 10 20 L 150 20 L 10 90 Z', 'M 150 20 L 150 90 L 10 90 Z'] },
  { name: 'square', part: 'rectangle', outline: square(45, 10, 80, 80),
    parts: [square(45, 10, 40, 80), square(85, 10, 40, 80)] },
  { name: 'circle', part: 'semicircle', outline: 'M 40 50 A 40 40 0 1 1 120 50 A 40 40 0 1 1 40 50 Z',
    parts: ['M 40 50 A 40 40 0 0 1 120 50 Z', 'M 40 50 A 40 40 0 0 0 120 50 Z'] },
];
const itemParts = (c: ShapeComposerChallenge) => new Set((c.expectedComponents ?? []).map(p => p.shape));
/** The first model whose big shape and part shape are none of the item's parts (so its tags never say one). */
export function partsModelFor(c: ShapeComposerChallenge): PartsModel | null {
  return PARTS_MODELS.find(m => !itemParts(c).has(m.part) && !itemParts(c).has(m.name)) ?? null;
}

/** how-many-ways' pieces model: another shape built from squares, each square outlined (a 160 x 100 box). */
export interface PiecesModel { name: string; count: number; word: string; squares: Array<[number, number, number]> }
const PIECES_MODELS: PiecesModel[] = [
  { name: 'rectangle', count: 3, word: 'three', squares: [[20, 30, 40], [60, 30, 40], [100, 30, 40]] },
  { name: 'square', count: 4, word: 'four', squares: [[40, 10, 40], [80, 10, 40], [40, 50, 40], [80, 50, 40]] },
  { name: 'rectangle', count: 2, word: 'two', squares: [[40, 30, 40], [80, 30, 40]] },
];
const targetName = (c: ShapeComposerChallenge) => (c.targetForComposition ?? '').replace(/-/g, ' ').toLowerCase();
/** The first model that is neither the item's shape nor its number of pieces. */
export function piecesModelFor(c: ShapeComposerChallenge): PiecesModel | null {
  const name = targetName(c);
  return PIECES_MODELS.find(m => !name.split(' ').includes(m.name) && m.count !== c.minimumPiecesNeeded) ?? null;
}

// ── free-create marks (the learner's own work against the list and the touching rule) ──

/** list_match: how many icons of each listed kind are lit, and the pieces beyond the list (an unlisted kind, or one
 *  more of a kind than the list asks for; the later-placed ones). */
export function listMatch(recipe: readonly RecipePart[], pieces: readonly BoardPiece[]): { lit: number[]; offList: Set<string> } {
  const seen: Record<string, number> = {};
  const offList = new Set<string>();
  for (const p of pieces) {
    seen[p.shape] = (seen[p.shape] ?? 0) + 1;
    const want = recipe.find(r => r.shape === p.shape)?.count ?? 0;
    if (seen[p.shape] > want) offList.add(p.id);
  }
  return { lit: recipe.map(r => Math.min(r.count, seen[r.shape] ?? 0)), offList };
}

export type JoinState = 'touching' | 'alone' | 'on_top';
/** join_marks: each piece on top of another (red), touching another (green), or on its own (amber). */
export function joinStates(pieces: readonly BoardPiece[]): Map<string, JoinState> {
  const out = new Map<string, JoinState>();
  for (const a of pieces) {
    const others = pieces.filter(b => b.id !== a.id);
    out.set(a.id, others.some(b => hasOverlap([a, b])) ? 'on_top'
      : others.some(b => pieceGap(a, b) <= TOUCH_GAP) ? 'touching' : 'alone');
  }
  return out;
}

// ── simplify builders ──────────────────────────────────────────────────────

/** compose-match: a two-piece outline of a shape the item is not. */
const TWO_PIECE_MATCHES: Array<Pick<ShapeComposerChallenge, 'targetShape' | 'targetOutlinePath' | 'pieces'> & { ask: string }> = [
  { targetShape: 'long-rectangle', ask: 'Use the two squares to fill the long rectangle!', targetOutlinePath: square(100, 125, 200, 100),
    pieces: [{ id: 'sq-a', shape: 'square', color: '#3B82F6', width: 100, height: 100, targetX: 100, targetY: 125 },
      { id: 'sq-b', shape: 'square', color: '#60A5FA', width: 100, height: 100, targetX: 200, targetY: 125 }] },
  { targetShape: 'big-square', ask: 'Use the two rectangles to fill the big square!', targetOutlinePath: square(125, 100, 150, 150),
    pieces: [{ id: 're-a', shape: 'rectangle', color: '#10B981', width: 150, height: 75, targetX: 125, targetY: 100 },
      { id: 're-b', shape: 'rectangle', color: '#34D399', width: 150, height: 75, targetX: 125, targetY: 175 }] },
];

/** compose-picture: a two-shape picture of something else. */
const TWO_SHAPE_PICTURES: Array<Pick<ShapeComposerChallenge, 'targetPicture' | 'availableShapes' | 'pictureSlots'> & { ask: string }> = [
  { targetPicture: 'lollipop', ask: 'Build a lollipop with a circle and a rectangle stick!',
    availableShapes: [{ shape: 'circle', color: '#F59E0B', count: 1 }, { shape: 'rectangle', color: '#10B981', count: 1 }],
    pictureSlots: [{ id: 'lp-top', shape: 'circle', x: 150, y: 50, width: 100, height: 100, rotation: 0 },
      { id: 'lp-stick', shape: 'rectangle', x: 185, y: 150, width: 30, height: 140, rotation: 0 }] },
  { targetPicture: 'tent', ask: 'Build a tent with a triangle on a square!',
    availableShapes: [{ shape: 'triangle', color: '#8B5CF6', count: 1 }, { shape: 'square', color: '#3B82F6', count: 1 }],
    pictureSlots: [{ id: 'tn-top', shape: 'triangle', x: 150, y: 40, width: 100, height: 100, rotation: 0 },
      { id: 'tn-base', shape: 'square', x: 150, y: 140, width: 100, height: 100, rotation: 0 }] },
];

/** decompose: a big shape of two parts. */
const TWO_PART_SHAPES: Array<Pick<ShapeComposerChallenge, 'compositeShapePath' | 'compositeDescription' | 'expectedComponents' | 'divisionLineHints'>> = [
  { compositeShapePath: square(100, 125, 200, 100), compositeDescription: 'A rectangle that can be split into 2 squares',
    expectedComponents: [{ shape: 'square', count: 2 }], divisionLineHints: [{ x1: 200, y1: 125, x2: 200, y2: 225 }] },
  { compositeShapePath: square(125, 100, 150, 150), compositeDescription: 'A square that can be split into 2 triangles',
    expectedComponents: [{ shape: 'triangle', count: 2 }], divisionLineHints: [{ x1: 125, y1: 100, x2: 275, y2: 250 }] },
];

/** how-many-ways: the known two-piece builds (the generator's KNOWN_ANSWERS). */
const TWO_PIECE_BUILDS: Array<{ target: string; piece: string }> = [
  { target: 'rectangle', piece: 'square' }, { target: 'square', piece: 'triangle' },
];

const partTotal = (c: ShapeComposerChallenge) => (c.expectedComponents ?? []).reduce((s, p) => s + p.count, 0);
const recipeTotal = (r: readonly RecipePart[]) => r.reduce((s, p) => s + p.count, 0);

/** The same kind of list one shape shorter: the largest count drops by one (a kind at zero leaves the list). */
export function smallerRecipe(recipe: readonly RecipePart[]): RecipePart[] | null {
  if (recipeTotal(recipe) < 3) return null;
  const at = recipe.reduce((best, r, i) => (r.count > recipe[best].count ? i : best), 0);
  return recipe.map((r, i) => (i === at ? { ...r, count: r.count - 1 } : r)).filter(r => r.count > 0);
}

/** The simpler item a simplify lever opens, by mode. Null where the item is already the smallest of its mode. */
export function simplerShape(c: ShapeComposerChallenge): ShapeComposerChallenge | null {
  if (isPracticeShape(c)) return null;
  const id = `${c.id}${SIMPLER}`;
  const keep = { id, type: c.type, supportTier: c.supportTier, showSeams: c.showSeams, showSnapGuides: c.showSnapGuides };
  switch (c.type) {
    case 'compose-match': {
      if ((c.pieces ?? []).length < 3) return null;
      const t = TWO_PIECE_MATCHES.find(m => m.targetShape !== c.targetShape && m.targetOutlinePath !== c.targetOutlinePath);
      return t ? { ...keep, instruction: t.ask, targetShape: t.targetShape, targetOutlinePath: t.targetOutlinePath,
        pieces: t.pieces!.map(p => ({ ...p, id: `${id}-${p.id}` })) } : null;
    }
    case 'compose-picture': {
      if ((c.pictureSlots ?? []).length < 3) return null;
      const t = TWO_SHAPE_PICTURES.find(p => p.targetPicture !== c.targetPicture);
      return t ? { ...keep, instruction: t.ask, targetPicture: t.targetPicture, availableShapes: t.availableShapes,
        pictureSlots: t.pictureSlots } : null;
    }
    case 'decompose': {
      if (partTotal(c) <= 2) return null;
      const t = TWO_PART_SHAPES.find(s => s.compositeShapePath !== c.compositeShapePath);
      return t ? { ...keep, ...t, instruction: 'What smaller shapes make up this big shape?' } : null;
    }
    case 'how-many-ways': {
      if ((c.minimumPiecesNeeded ?? 0) <= 2) return null;
      const t = TWO_PIECE_BUILDS.find(b => b.target !== c.targetForComposition);
      return t ? { ...keep, instruction: `How many ${t.piece}s do you need to build a ${t.target}?`, targetForComposition: t.target,
        allowedPieces: [t.piece], minimumPiecesNeeded: 2 } : null;
    }
    case 'free-create': {
      const recipe = c.recipe?.length ? smallerRecipe(c.recipe) : null;
      return recipe ? { ...keep, instruction: recipeInstruction(recipe), recipe } : null;
    }
    default: return null;
  }
}

/** Leak rule for a practice item: never the learner's item (its id, its target or picture, its composite, its list). */
export function simplerLeaks(parent: ShapeComposerChallenge, simpler: ShapeComposerChallenge): boolean {
  if (simpler.id === parent.id || simpler.type !== parent.type) return true;
  switch (parent.type) {
    case 'compose-match': return simpler.targetShape === parent.targetShape || simpler.targetOutlinePath === parent.targetOutlinePath
      || (simpler.pieces ?? []).length >= (parent.pieces ?? []).length;
    case 'compose-picture': return simpler.targetPicture === parent.targetPicture
      || (simpler.pictureSlots ?? []).length >= (parent.pictureSlots ?? []).length;
    case 'decompose': return simpler.compositeShapePath === parent.compositeShapePath || partTotal(simpler) >= partTotal(parent);
    case 'how-many-ways': return simpler.targetForComposition === parent.targetForComposition
      || (simpler.minimumPiecesNeeded ?? 0) >= (parent.minimumPiecesNeeded ?? 0);
    case 'free-create': {
      const key = (r?: readonly RecipePart[]) => (r ?? []).map(p => `${p.count}${p.shape}`).sort().join('+');
      return !simpler.recipe?.length || key(simpler.recipe) === key(parent.recipe) || recipeTotal(simpler.recipe) >= recipeTotal(parent.recipe ?? []);
    }
    default: return true;
  }
}

// ── declarations ─────────────────────────────────────────────────────────

/** What the lever set reads beside the item: how many shapes the learner has on the board now. */
export interface ShapeLeverCtx { onBoard: number }

const FULL_ITEM = 'It is not graded; the full item comes back after it.';
const onBoard = (_c: ShapeComposerChallenge, ctx: ShapeLeverCtx) => ctx.onBoard > 0;
const listed = (c: ShapeComposerChallenge) => (c.recipe?.length ? c.recipe : null);

/** The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing then. */
export const SHAPE_COMPOSER_LEVERS = leverSet<ShapeComposerChallenge, ShapeLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => SHAPE_COMPOSER_MISSES_BY_MODE[mode] ?? [],
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: c => (c.type === 'how-many-ways' ? 'a different shape built from squares' : 'a different big shape with its parts tagged'),
    own: c => (c.type === 'how-many-ways' ? 'how many pieces build this shape' : 'the parts of this big shape'),
  },
  specs: [
    // compose-match
    { id: EMPTY_SPACE_LEVER, type: 'marks', modes: ['compose-match'], answers: ['pieces_left', 'piece_off_outline'],
      when: 'The learner cannot see which part of the outline is still empty.',
      does: 'Lights the part of the outline that no piece covers yet. It shows no piece’s place.',
      fact: 'The part of the outline that no piece covers is lit yellow.' },
    { id: IN_PLACE_LEVER, type: 'marks', modes: ['compose-match'], answers: ['piece_off_outline'], offer: onBoard,
      when: 'The learner cannot tell which piece is not in its place.',
      does: 'Rings each piece on the board: green when it sits in a place, amber when it does not. It does not say where a piece goes.',
      fact: 'Each piece on the board is ringed green when it sits in a place, amber when it does not.' },
    { id: FEWER_PIECES_LEVER, type: 'easier', modes: ['compose-match'], answers: ['pieces_left', 'piece_off_outline'],
      when: 'This outline has too many pieces to fit yet.',
      does: `Opens an easier item first: a different outline filled by just two pieces. ${FULL_ITEM}`,
      content: c => simplerShape(c) },
    // compose-picture
    { id: EMPTY_SPOTS_LEVER, type: 'marks', modes: ['compose-picture'], answers: ['shape_missing', 'shape_off_spot'],
      when: 'The learner cannot see which parts of the picture still need a shape.',
      does: 'Makes every picture spot that no shape fills yet glow, with its outline drawn. Filled spots stay plain.',
      fact: 'Every picture spot that no shape fills yet glows with its outline drawn.' },
    { id: SMALLER_PICTURE_LEVER, type: 'easier', modes: ['compose-picture'], answers: ['shape_missing', 'shape_off_spot'],
      when: 'This picture has too many shapes to place yet.',
      does: `Opens an easier item first: a different picture made of just two shapes. ${FULL_ITEM}`,
      content: c => simplerShape(c) },
    // decompose. Split lines only where the session hides them (they are on screen otherwise).
    { id: SPLIT_LINES_LEVER, type: 'marks', modes: ['decompose'], answers: ['missed_part', 'extra_part', 'wrong_mix'],
      offer: c => c.showSeams === false,
      when: 'The learner cannot see where the big shape splits.',
      does: 'Draws the dashed lines inside the big shape where its parts meet. No part is named.',
      fact: 'Dashed lines inside the big shape show where its parts meet.' },
    { id: PARTS_MODEL_LEVER, type: 'model', modes: ['decompose'], answers: ['not_a_part', 'missed_part', 'extra_part', 'wrong_mix'],
      content: c => partsModelFor(c),
      when: 'The learner does not yet look for each part and name its shape.',
      does: c => `Shows a picture outside the item: a ${partsModelFor(c)?.name ?? 'shape'} split into parts, each part tinted and `
        + 'tagged with its shape. Read the tags aloud while pointing at each part; it uses none of the item’s part shapes.',
      fact: (m: PartsModel) => `Beside the big shape is a picture outside the item: a ${m.name} split into parts, each tinted `
        + `and tagged ${m.part}.` },
    { id: TWO_PARTS_LEVER, type: 'easier', modes: ['decompose'], answers: ['missed_part', 'extra_part', 'wrong_mix'],
      when: 'This big shape has too many parts yet.',
      does: `Opens an easier item first: a big shape of only two parts. ${FULL_ITEM}`,
      content: c => simplerShape(c) },
    // how-many-ways
    { id: PIECES_MODEL_LEVER, type: 'model', modes: ['how-many-ways'], answers: ['too_few', 'too_many'],
      content: c => piecesModelFor(c),
      when: 'The learner guesses instead of picturing the pieces inside the shape.',
      does: c => {
        const m = piecesModelFor(c);
        return `Shows a picture outside the item: a ${m?.name ?? 'shape'} built from ${m?.word ?? 'some'} squares, each square `
          + 'outlined. Count its squares aloud with the learner; it is neither the item’s shape nor its number of pieces.';
      },
      // The model's own count in words: without it a tutor counted the picture to the item's answer (replay r4).
      fact: (m: PiecesModel) => `Beside the ask is a picture outside the item: a ${m.name} built from ${m.word} squares, each square outlined.` },
    { id: SMALLER_BUILD_LEVER, type: 'easier', modes: ['how-many-ways'], answers: ['too_few', 'too_many'],
      when: 'This shape takes too many pieces to picture yet.',
      does: `Opens an easier item first: a smaller shape that takes fewer pieces. ${FULL_ITEM}`,
      content: c => simplerShape(c) },
    // free-create, on a payload with a list (an older one has none: `too_few_shapes` is unanswered)
    { id: LIST_MATCH_LEVER, type: 'marks', modes: ['free-create'], answers: ['missing_piece', 'extra_piece'],
      content: listed, offer: onBoard,
      when: 'The learner’s shapes do not match the list.',
      does: 'Lights each shape icon in the list when a shape of its kind is on the board, and rings any shape on the board that is not on the list.',
      fact: 'Each shape icon in the list is lit when a shape of its kind is on the board; a shape not on the list is ringed.' },
    { id: JOIN_MARKS_LEVER, type: 'marks', modes: ['free-create'], answers: ['not_touching', 'overlapping'],
      content: listed, offer: onBoard,
      when: 'The learner’s shapes are apart, or one sits on another.',
      does: 'Rings each shape on the board: green when it touches another, amber when it is on its own, red when it sits on top of another.',
      fact: 'Each shape on the board is ringed green when it touches another, amber when on its own, red when on top of another.' },
    { id: SMALLER_RECIPE_LEVER, type: 'easier', modes: ['free-create'],
      answers: ['missing_piece', 'extra_piece', 'not_touching', 'overlapping'],
      when: 'Building with this many shapes is too much yet.',
      does: `Opens an easier item first: the same kind of list with one shape fewer. ${FULL_ITEM}`,
      content: c => simplerShape(c) },
  ],
});

/** Leak rule for the help levers' words: no digit (a count or a number of pieces), and on decompose none of the parts' shapes. */
export function leverTextLeaks(c: ShapeComposerChallenge, text: string): boolean {
  if (/\d/.test(text)) return true;
  const lower = text.toLowerCase();
  const word = (w: string) => new RegExp(`\\b${w}s?\\b`).test(lower);
  return c.type === 'decompose' && Array.from(itemParts(c)).some(word);
}
