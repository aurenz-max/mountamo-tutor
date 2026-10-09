/**
 * transformation-lab's in-item levers (/add-support-tiers; report qa/eval-reports/transformation-lab-levers-2026-10-09.md).
 * The misses are what `transformMiss` observes on the figure or the option tapped; there is no real-learner evidence.
 *
 * - drag modes (translate/reflect, rotate, dilate): `corner_letters` (help) the pre-image's corners lettered A, B, C and
 *   the pink corners A′, B′, C′, so the learner tracks which corner goes where; `model_point` (help) a green point P away
 *   from the figure and its image P′ under the item's transformation, joined by an arrow: the motion shown on a point
 *   outside the item; `pre_coords` (help, where the tier hid them) the (x, y) labels on the cyan pre-image; `rule_card`
 *   (help, where no rule card is on screen) the transformation's coordinate rule, "(x, y) → (−y, x)";
 *   `origin_rays` (help, dilation) a dashed ray from the origin through each pre-image corner;
 *   `simpler_figure` (simplify) the same transformation on a smaller triangle.
 * - identify: `corner_letters` on the cyan and the amber corners; `motion_models` (help) a model flag outside the item
 *   moved by each option's motion, one small picture per option, none marked; `pre_coords` (help, where hidden);
 *   `two_choices` (simplify) another identify item with two options, the right one and one of the other family.
 * - compose: `motion_models` a model flag moved by each palette flip and turn; `target_coords` (help) the dashed
 *   target's corners labelled (x, y); `corner_letters` on the pre-image, the pink figure and the target;
 *   `simpler_target` (simplify) a smaller figure reached by one flip or turn and a one-square slide.
 *
 * Leak rules (code): nothing a lever draws or says carries one of a drag item's image corners (`leverTextLeaks`); the
 * model point and its image are not corners of the pre-image or the image (`modelPointLeaks`); identify never gets the
 * rule card or the model point (the motion IS the answer there), and its motion models mark no option; a practice item
 * has its own id and narration, keeps the mode, and shares no corner with the item's pre-image or image, nor its
 * transformation (identify) or its flip, turn and slide (compose) (`practiceLeaks`).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { GridPoint, TransformationLabChallenge } from './TransformationLab';
import {
  PALETTE_TURNS, SEQUENCE_PALETTE, applySpec, composeOf, fmtPoint, inGrid, isReflection, mapSpec, polygonsMatch, specFromLabel,
  specOf, type TransformMiss, type TransformSpec,
} from './transformationLabWorkspace';

export const CORNER_LETTERS_LEVER = 'corner_letters';
export const MODEL_POINT_LEVER = 'model_point';
export const PRE_COORDS_LEVER = 'pre_coords';
export const RULE_CARD_LEVER = 'rule_card';
export const ORIGIN_RAYS_LEVER = 'origin_rays';
export const MOTION_MODELS_LEVER = 'motion_models';
export const TARGET_COORDS_LEVER = 'target_coords';
export const SIMPLER_FIGURE_LEVER = 'simpler_figure';
export const TWO_CHOICES_LEVER = 'two_choices';
export const SIMPLER_TARGET_LEVER = 'simpler_target';

const SIMPLER = '~simpler';
export const isPracticeTransform = (c: Pick<TransformationLabChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const same = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;
const shares = (a: readonly GridPoint[], b: readonly GridPoint[]) => a.some(p => b.some(q => same(p, q)));
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── the motion on a point outside the item ───────────────────────────────────────────────────────────────────────

/** The model point P and its image P′ under the item's transformation, as far from the figure as the grid allows. */
export function modelPoint(c: TransformationLabChallenge): { from: GridPoint; to: GridPoint } | null {
  const spec = specOf(c);
  if (!spec || c.answerKind !== 'drag') return null;
  const figure = [...c.preImage, ...c.expectedImage];
  let best: { from: GridPoint; to: GridPoint; d: number } | null = null;
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) {
    const from = { x, y }, to = applySpec(spec, from);
    if (!inGrid(to) || modelPointLeaks(c, from, to)) continue;
    // Away from every corner, and the arrow short enough to read.
    const d = Math.min(...[from, to].flatMap(p => figure.map(q => Math.hypot(p.x - q.x, p.y - q.y))))
      - Math.hypot(to.x - from.x, to.y - from.y) / 8;
    if (!best || d > best.d) best = { from, to, d };
  }
  return best && { from: best.from, to: best.to };
}

/** Leak rule: P and P′ differ and neither is a corner of the pre-image or the image (P on a corner would work the corner). */
export function modelPointLeaks(c: TransformationLabChallenge, from: GridPoint, to: GridPoint): boolean {
  const corners = [...c.preImage, ...c.expectedImage];
  return same(from, to) || corners.some(q => same(q, from) || same(q, to));
}

const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
/** The transformation's coordinate rule, as the easy tier's rule card prints it. Never for identify. */
export function ruleFor(c: TransformationLabChallenge): string | null {
  if (c.answerKind === 'identify') return null;
  const spec = specOf(c);
  if (!spec) return null;
  switch (spec.kind) {
    case 'translation': return `(x, y) → (x ${signed(spec.dx)}, y ${signed(spec.dy)})`;
    case 'reflect_x': return '(x, y) → (x, −y)';
    case 'reflect_y': return '(x, y) → (−x, y)';
    case 'reflect_yx': return '(x, y) → (y, x)';
    case 'rotate90': return '(x, y) → (−y, x)';
    case 'rotate180': return '(x, y) → (−x, −y)';
    case 'rotate270': return '(x, y) → (y, −x)';
    case 'dilate': return `(x, y) → (${spec.k}x, ${spec.k}y)`;
  }
}

/** The model flag the motion models move: six corners, so never one of the items' three- and four-corner figures. */
export const MODEL_FLAG: GridPoint[] = [
  { x: 1, y: 0 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 },
];

/** One small picture per motion: identify's options in their order, compose's palette flips and turns. No mark on any. */
export function motionModels(c: TransformationLabChallenge): { caption: string; image: GridPoint[] }[] {
  if (c.answerKind === 'identify') return (c.options ?? []).flatMap(o => {
    const spec = specFromLabel(o);
    return spec ? [{ caption: o, image: mapSpec(spec, MODEL_FLAG) }] : [];
  });
  if (c.answerKind === 'sequence') return PALETTE_TURNS.map(({ op, spec }) => ({
    caption: SEQUENCE_PALETTE.find(p => p.op === op)!.label, image: mapSpec(spec, MODEL_FLAG) }));
  return [];
}

// ── simplify builders ────────────────────────────────────────────────────────────────────────────────────────────

const SMALL_TRIANGLES: GridPoint[][] = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 2 }],
];
const extent = (pts: readonly GridPoint[]) => Math.max(
  Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y)));
/** Offsets nearest `near` first, so the practice figure sits where the item's did. */
const offsetsNear = (near: GridPoint) => {
  const out: GridPoint[] = [];
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) out.push({ x, y });
  return out.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y) || a.x - b.x || a.y - b.y);
};
const placeAt = (shape: readonly GridPoint[], o: GridPoint) => shape.map(p => ({ x: p.x + o.x, y: p.y + o.y }));

/** drag: the same transformation on a smaller triangle (fewer corners, or a shorter side), or null when none fits. */
function simplerFigure(c: TransformationLabChallenge): TransformationLabChallenge | null {
  const spec = specOf(c);
  if (!spec) return null;
  for (const shape of SMALL_TRIANGLES) {
    if (shape.length >= c.preImage.length && extent(shape) >= extent(c.preImage)) continue;
    for (const o of offsetsNear(c.preImage[0])) {
      const pre = placeAt(shape, o), img = mapSpec(spec, pre);
      if (!pre.every(inGrid) || !img.every(inGrid) || shares(pre, img)) continue;
      const practice = { ...c, id: `${c.id}${SIMPLER}`, narration: 'Practice first, on a smaller figure.', hint: '',
        preImage: pre, expectedImage: img };
      if (!practiceLeaks(c, practice)) return practice;
    }
  }
  return null;
}

const IDENTIFY_SPECS: { spec: TransformSpec; label: string }[] = [
  { spec: { kind: 'reflect_x' }, label: 'Reflection over the x-axis' },
  { spec: { kind: 'reflect_y' }, label: 'Reflection over the y-axis' },
  { spec: { kind: 'rotate180' }, label: 'Rotation 180° about the origin' },
  { spec: { kind: 'rotate90' }, label: 'Rotation 90° counterclockwise about the origin' },
  { spec: { kind: 'reflect_yx' }, label: 'Reflection over the line y = x' },
  { spec: { kind: 'rotate270' }, label: 'Rotation 270° counterclockwise about the origin' },
];

/** identify: another figure moved by another transformation, two options: its name and one of the other family. */
function twoChoices(c: TransformationLabChallenge): TransformationLabChallenge | null {
  const right = specOf(c);
  if (!right) return null;
  const answerLabel = c.options?.[c.correctOption ?? -1];
  for (const { spec, label } of IDENTIFY_SPECS) {
    if (spec.kind === right.kind) continue;
    const foil = IDENTIFY_SPECS.find(f => isReflection(f.spec) !== isReflection(spec) && f.label !== answerLabel);
    if (!foil) continue;
    for (const o of offsetsNear({ x: 2, y: 2 })) {
      if (o.x < 1 || o.y < 1) continue;   // Quadrant I, as the generator places identify figures.
      const pre = placeAt(SMALL_TRIANGLES[1], o), img = mapSpec(spec, pre);
      if (!pre.every(inGrid) || !img.every(inGrid) || shares(pre, img)) continue;
      // The right option first or second by the item's own answer slot, so its place is not always the same.
      const options = (c.correctOption ?? 0) % 2 === 0 ? [label, foil.label] : [foil.label, label];
      const practice: TransformationLabChallenge = { ...c, id: `${c.id}${SIMPLER}`, narration: 'Practice first, with two choices.',
        hint: '', preImage: pre, expectedImage: img, transformLabel: label, options, correctOption: options.indexOf(label) };
      if (!practiceLeaks(c, practice)) return practice;
    }
  }
  return null;
}

/** compose: a smaller figure reached by another flip or turn and a slide of one square. */
function simplerTarget(c: TransformationLabChallenge): TransformationLabChallenge | null {
  const plan = composeOf(c);
  if (!plan) return null;
  for (const { op, spec } of PALETTE_TURNS) {
    if (op === plan.op) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      if (dx === plan.dx && dy === plan.dy) continue;
      for (const o of offsetsNear(c.preImage[0])) {
        const pre = placeAt(SMALL_TRIANGLES[1], o), img = mapSpec(spec, pre).map(p => ({ x: p.x + dx, y: p.y + dy }));
        if (!pre.every(inGrid) || !img.every(inGrid) || shares(pre, img)) continue;
        const practice = { ...c, id: `${c.id}${SIMPLER}`, narration: 'Practice first: one flip or turn and one short slide.',
          hint: '', preImage: pre, expectedImage: img, transformLabel: '' };
        if (!practiceLeaks(c, practice)) return practice;
      }
    }
  }
  return null;
}

/** The easier practice item for `c` (same mode), or null. */
export function simplerItem(c: TransformationLabChallenge): TransformationLabChallenge | null {
  if (isPracticeTransform(c)) return null;
  if (c.answerKind === 'identify') return twoChoices(c);
  if (c.answerKind === 'sequence') return simplerTarget(c);
  return simplerFigure(c);
}

/** Leak rule for a practice item: never the learner's item, the same mode, no corner of the item's pre-image or image,
 *  not the item's transformation (identify, whose answer it is) nor its flip, turn or slide (compose). */
export function practiceLeaks(parent: TransformationLabChallenge, practice: TransformationLabChallenge): boolean {
  if (practice.id === parent.id || practice.narration === parent.narration || practice.type !== parent.type
      || practice.answerKind !== parent.answerKind) return true;
  if (shares(practice.preImage, parent.preImage) || shares(practice.expectedImage, parent.expectedImage)) return true;
  if (polygonsMatch(practice.expectedImage, parent.expectedImage)) return true;
  if (parent.answerKind === 'identify') {
    const theirs = specOf(parent), ours = specOf(practice), answer = parent.options?.[parent.correctOption ?? -1];
    if (!theirs || !ours || theirs.kind === ours.kind || (answer && practice.options?.includes(answer))) return true;
    if (practice.options?.[practice.correctOption ?? -1] !== practice.transformLabel) return true;
  }
  if (parent.answerKind === 'sequence') {
    const theirs = composeOf(parent), ours = composeOf(practice);
    if (!theirs || !ours || theirs.op === ours.op || (theirs.dx === ours.dx && theirs.dy === ours.dy)) return true;
  }
  if (parent.answerKind === 'drag') {
    const theirs = specOf(parent), ours = specOf(practice);
    if (!theirs || !ours || JSON.stringify(theirs) !== JSON.stringify(ours)) return true;
  }
  return false;
}

// ── declarations ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface TransformLeverContext {
  /** The session already labels the pre-image's corners (a starting position, not a pull). */
  preCoordsShown: boolean;
  /** The session already shows a rule card. */
  ruleShown: boolean;
}

const SIGNATURE: Record<string, TransformMiss[]> = {
  apply_translation_reflection: ['opposite_shift', 'swapped_shift', 'one_axis_shift', 'wrong_axis'],
  apply_rotation: ['wrong_direction', 'wrong_angle', 'reflected_instead'],
  dilation_similarity: ['added_factor', 'wrong_factor', 'one_axis_scaled'],
};
const IDENTIFY_MISSES: TransformMiss[] = ['wrong_axis', 'reflection_for_rotation', 'rotation_for_reflection', 'wrong_direction', 'wrong_angle'];

export function transformLevers(c: TransformationLabChallenge | null, pulled: readonly string[], ctx: TransformLeverContext): WorkspaceLever[] {
  if (!c || isPracticeTransform(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly TransformMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const simpler = simplerItem(c);
  if (c.answerKind === 'identify') return [
    lever(CORNER_LETTERS_LEVER, 'help', 'shown', IDENTIFY_MISSES,
      'The learner cannot tell which corner went where, so cannot see the motion.',
      'Letters the cyan pre-image\'s corners A, B, C and the matching amber corners A′, B′, C′. Nothing else changes; no '
        + 'option is marked.'),
    lever(MOTION_MODELS_LEVER, 'help', 'shown', IDENTIFY_MISSES,
      'The learner mixes up the motions: which axis, which way a turn goes, a flip against a turn.',
      'Shows, beside the grid, a small model flag (not the item\'s figure) moved by each option\'s motion, one picture per '
        + 'option under its name. None is marked; the learner compares them with the item.'),
    ...(!ctx.preCoordsShown ? [lever(PRE_COORDS_LEVER, 'help', 'shown', ['wrong_axis', 'wrong_direction', 'wrong_angle'],
      'The learner cannot compare where a corner was with where it is.',
      'Labels the cyan pre-image\'s corners with their (x, y); the amber corners are already labelled.')] : []),
    ...(simpler ? [lever(TWO_CHOICES_LEVER, 'simplify', 'shown', IDENTIFY_MISSES,
      'Four choices are too many to sort yet.',
      'Opens an easier identify item first: another figure moved by another motion, with two options, one of each family. '
        + 'It is not graded; the full item comes back after it.')] : []),
  ];
  if (c.answerKind === 'sequence') return [
    lever(MOTION_MODELS_LEVER, 'help', 'shown', ['orientation_off', 'unmoved'],
      'The learner slides without matching how the target faces, or does not know what a flip or a turn will do.',
      'Shows, beside the grid, a small model flag (not the item\'s figure) moved by each flip and turn on the move '
        + 'buttons, one picture per button under its name. None is marked.'),
    lever(TARGET_COORDS_LEVER, 'help', 'shown', ['position_off'],
      'The figure faces the right way but sits off the target.',
      'Labels the dashed target\'s corners with their (x, y), so the learner can count the squares still to slide.'),
    lever(CORNER_LETTERS_LEVER, 'help', 'shown', ['orientation_off', 'position_off'],
      'The learner cannot tell which pink corner has to land on which target corner.',
      'Letters the pre-image\'s corners A, B, C, the pink figure\'s A′, B′, C′ and the target\'s A″, B″, C″. No move is named.'),
    ...(simpler ? [lever(SIMPLER_TARGET_LEVER, 'simplify', 'shown', ['orientation_off', 'position_off', 'unmoved'],
      'This target is too many moves away yet.',
      'Opens an easier compose item first: a smaller figure that one flip or turn and a one-square slide put on its target. '
        + 'It is not graded; the full item comes back after it.')] : []),
  ];
  const signature = SIGNATURE[c.type] ?? [];
  const dilation = c.type === 'dilation_similarity';
  return [
    ...(dilation ? [lever(ORIGIN_RAYS_LEVER, 'help', 'shown', ['shape_changed', 'one_axis_scaled', 'added_factor', 'misplaced'],
      'The learner moves corners off the line from the origin, so the shape changes or the figure slides.',
      'Draws a dashed ray from the origin through each cyan corner, out to the edge of the grid. No point on a ray is marked.')] : []),
    lever(CORNER_LETTERS_LEVER, 'help', 'shown', ['partly_placed', 'shape_changed'],
      'Some corners are placed and others are not, or the corners no longer make the figure\'s shape.',
      'Letters the cyan pre-image\'s corners A, B, C and the pink corners A′, B′, C′, so each pink corner\'s partner is '
        + 'clear. No place is marked.'),
    ...(modelPoint(c) ? [lever(MODEL_POINT_LEVER, 'help', 'shown', [...signature, 'unmoved', 'misplaced'],
      'The learner moves the figure the wrong way, or does not know where to start.',
      'Draws a green model point P away from the figure and its image P′ under this same transformation, joined by an '
        + 'arrow. P is not a corner of the figure; the learner does the corners.')] : []),
    ...(!ctx.preCoordsShown ? [lever(PRE_COORDS_LEVER, 'help', 'shown', ['partly_placed', 'misplaced'],
      'The learner cannot read the cyan corners\' coordinates off the grid.',
      'Labels the cyan pre-image\'s corners with their (x, y). The pink corners already show theirs.')] : []),
    ...(!ctx.ruleShown && ruleFor(c) ? [lever(RULE_CARD_LEVER, 'help', 'shown', [...signature, 'partly_placed', 'misplaced'],
      'The learner knows the motion\'s name but not what it does to a coordinate.',
      'Shows the transformation\'s coordinate rule on a card, "(x, y) → …". It gives no corner\'s image.')] : []),
    ...(simpler ? [lever(SIMPLER_FIGURE_LEVER, 'simplify', 'shown', [...signature, 'partly_placed', 'shape_changed', 'misplaced'],
      'This figure is too big to move corner by corner yet.',
      'Opens an easier item first: the same transformation on a smaller triangle. It is not graded; the full item comes back '
        + 'after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor and JEV. Never an image corner of a drag item. */
export function leverFacts(c: TransformationLabChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeTransform(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const model = on(MODEL_POINT_LEVER) ? modelPoint(c) : null;
  const rule = on(RULE_CARD_LEVER) ? ruleFor(c) : null;
  return [
    on(CORNER_LETTERS_LEVER) && (c.answerKind === 'sequence'
      ? 'The corners are lettered: A, B, C on the pre-image, A′, B′, C′ on the pink figure, A″, B″, C″ on the target.'
      : `The corners are lettered A, B, C on the cyan pre-image and A′, B′, C′ on the ${c.answerKind === 'identify' ? 'amber image' : 'pink corners'}.`),
    model && `A green model point P at ${fmtPoint(model.from)} and its image P′ at ${fmtPoint(model.to)} under this transformation are drawn away from the figure, joined by an arrow.`,
    on(PRE_COORDS_LEVER) && 'The cyan pre-image\'s corners are labelled with their coordinates.',
    rule && `A rule card reads ${rule}.`,
    on(ORIGIN_RAYS_LEVER) && 'A dashed ray runs from the origin through each cyan corner to the edge of the grid; no point on it is marked.',
    on(MOTION_MODELS_LEVER) && `Beside the grid, a model flag (not the item's figure) is shown moved by each ${c.answerKind === 'identify' ? 'option' : 'flip and turn button'}, one picture per name; none is marked.`,
    on(TARGET_COORDS_LEVER) && `The dashed target's corners are labelled ${fmtPointsOf(c.expectedImage)}.`,
  ].filter((s): s is string => !!s).join(' ');
}
const fmtPointsOf = (pts: readonly GridPoint[]) => pts.map(fmtPoint).join(', ');

/** Leak rule for lever words, captions and facts: no drag item's image corner, and on identify not the right option. */
export function leverTextLeaks(c: TransformationLabChallenge, text: string): boolean {
  if (c.answerKind === 'identify') {
    const answer = c.options?.[c.correctOption ?? -1];
    return !!answer && text.includes(answer);
  }
  if (c.answerKind === 'sequence') return false;   // the target is drawn by design; its coordinates are not the moves
  return c.expectedImage.some(e => !c.preImage.some(p => same(p, e)) && text.includes(fmtPoint(e)));
}
