/**
 * Transformation lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C18).
 *
 * Pure: the component, the journey row and any probe read the same geometry, assignment and scene. Every mode is a
 * gesture item checked by the activity's own Check: the pink image's corners match the expected image (drag and
 * compose modes, as a set of grid points), or the tapped option is the right one (identify). The tutor is never
 * handed the expected image's coordinates (drag modes), the move sequence (compose) or which option is right.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { GridPoint, SequenceOp, TransformationLabChallenge, TransformationLabChallengeType } from './TransformationLab';

// ── canvas geometry (the component draws with these; the journey row drags in them) ──────────────────────────────

export const CANVAS_W = 460;
export const CANVAS_H = 460;
export const GRID_MIN = -7;
export const GRID_MAX = 7;
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = CANVAS_H / 2;
export const CELL = CANVAS_W / (GRID_MAX - GRID_MIN);

/** A grid point in the canvas's logical pixels. */
export const gridToCanvas = (p: GridPoint) => ({ x: ORIGIN_X + p.x * CELL, y: ORIGIN_Y - p.y * CELL });
/** A logical canvas pixel to the nearest grid point. */
export const canvasToGrid = (x: number, y: number): GridPoint => ({
  x: Math.round((x - ORIGIN_X) / CELL), y: Math.round((ORIGIN_Y - y) / CELL) });

export const ptKey = (p: GridPoint) => `${p.x},${p.y}`;
const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;
export const inGrid = (p: GridPoint) => p.x >= GRID_MIN && p.x <= GRID_MAX && p.y >= GRID_MIN && p.y <= GRID_MAX;
export const fmtPoint = (p: GridPoint) => `(${p.x}, ${p.y})`;
export const fmtPoints = (pts: readonly GridPoint[]) => pts.map(fmtPoint).join(', ');

/** Order-independent equality of two vertex sets (the activity's check since birth). */
export function polygonsMatch(a: readonly GridPoint[], b: readonly GridPoint[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(ptKey).sort();
  const sb = b.map(ptKey).sort();
  return sa.every((v, i) => v === sb[i]);
}

// ── transformations ─────────────────────────────────────────────────────────────────────────────────────────────

export type TransformSpec =
  | { kind: 'translation'; dx: number; dy: number }
  | { kind: 'reflect_x' } | { kind: 'reflect_y' } | { kind: 'reflect_yx' }
  | { kind: 'rotate90' } | { kind: 'rotate180' } | { kind: 'rotate270' }
  | { kind: 'dilate'; k: number };

export function applySpec(spec: TransformSpec, p: GridPoint): GridPoint {
  switch (spec.kind) {
    case 'translation': return { x: p.x + spec.dx, y: p.y + spec.dy };
    case 'reflect_x': return { x: p.x, y: -p.y };
    case 'reflect_y': return { x: -p.x, y: p.y };
    case 'reflect_yx': return { x: p.y, y: p.x };
    case 'rotate90': return { x: -p.y, y: p.x };
    case 'rotate180': return { x: -p.x, y: -p.y };
    case 'rotate270': return { x: p.y, y: -p.x };
    case 'dilate': return { x: p.x * spec.k, y: p.y * spec.k };
  }
}
export const mapSpec = (spec: TransformSpec, pts: readonly GridPoint[]) => pts.map(p => applySpec(spec, p));

/** One palette move on one point (compose mode). */
export function applyOp(op: SequenceOp, p: GridPoint): GridPoint {
  switch (op) {
    case 'reflect_x': return { x: p.x, y: -p.y };
    case 'reflect_y': return { x: -p.x, y: p.y };
    case 'rotate90': return { x: -p.y, y: p.x };
    case 'rotate180': return { x: -p.x, y: -p.y };
    case 'rotate270': return { x: p.y, y: -p.x };
    case 'tr_up': return { x: p.x, y: p.y + 1 };
    case 'tr_down': return { x: p.x, y: p.y - 1 };
    case 'tr_left': return { x: p.x - 1, y: p.y };
    case 'tr_right': return { x: p.x + 1, y: p.y };
  }
}

export const SEQUENCE_PALETTE: { op: SequenceOp; label: string }[] = [
  { op: 'reflect_x', label: 'Reflect over x-axis' },
  { op: 'reflect_y', label: 'Reflect over y-axis' },
  { op: 'rotate90', label: 'Rotate 90° ⟲' },
  { op: 'rotate180', label: 'Rotate 180°' },
  { op: 'rotate270', label: 'Rotate 270° ⟲' },
  { op: 'tr_left', label: '← Left' },
  { op: 'tr_right', label: 'Right →' },
  { op: 'tr_up', label: '↑ Up' },
  { op: 'tr_down', label: '↓ Down' },
];
const opLabel = (op: SequenceOp) => SEQUENCE_PALETTE.find(p => p.op === op)?.label ?? op;
/** The palette's flips and turns, as specs. */
export const PALETTE_TURNS: { op: SequenceOp; spec: TransformSpec }[] = [
  { op: 'reflect_x', spec: { kind: 'reflect_x' } }, { op: 'reflect_y', spec: { kind: 'reflect_y' } },
  { op: 'rotate90', spec: { kind: 'rotate90' } }, { op: 'rotate180', spec: { kind: 'rotate180' } },
  { op: 'rotate270', spec: { kind: 'rotate270' } },
];

const REFLECTIONS: TransformSpec[] = [{ kind: 'reflect_x' }, { kind: 'reflect_y' }, { kind: 'reflect_yx' }];
const ROTATIONS: TransformSpec[] = [{ kind: 'rotate90' }, { kind: 'rotate180' }, { kind: 'rotate270' }];
export const isReflection = (s: TransformSpec) => s.kind.startsWith('reflect');
export const isRotation = (s: TransformSpec) => s.kind.startsWith('rotate');

/** The single transformation that maps the pre-image onto the expected image corner by corner, from the geometry. */
export function specOf(ch: Pick<TransformationLabChallenge, 'preImage' | 'expectedImage'>): TransformSpec | null {
  const pre = ch.preImage, img = ch.expectedImage;
  if (!pre?.length || pre.length !== img?.length) return null;
  const fits = (s: TransformSpec) => pre.every((p, i) => samePoint(applySpec(s, p), img[i]));
  for (const s of [...REFLECTIONS, ...ROTATIONS]) if (fits(s)) return s;
  const t: TransformSpec = { kind: 'translation', dx: img[0].x - pre[0].x, dy: img[0].y - pre[0].y };
  if (fits(t)) return t;
  const at = pre.findIndex(p => p.x !== 0 || p.y !== 0);
  if (at >= 0) {
    const k = pre[at].x !== 0 ? img[at].x / pre[at].x : img[at].y / pre[at].y;
    if (Number.isInteger(k) && k > 1 && fits({ kind: 'dilate', k })) return { kind: 'dilate', k };
  }
  return null;
}

/** An option label ("Reflection over the x-axis", "Rotation 90° counterclockwise about the origin") as a spec. */
export function specFromLabel(label: string): TransformSpec | null {
  const l = label.toLowerCase();
  if (l.includes('reflection')) return l.includes('y = x') ? { kind: 'reflect_yx' } : l.includes('x-axis') ? { kind: 'reflect_x' }
    : l.includes('y-axis') ? { kind: 'reflect_y' } : null;
  if (l.includes('rotation')) return l.includes('180') ? { kind: 'rotate180' } : l.includes('270') ? { kind: 'rotate270' }
    : l.includes('90') ? { kind: 'rotate90' } : null;
  return null;
}

/** compose: the palette flip or turn, then the slide, that takes the pre-image onto the target corner by corner. */
export function composeOf(ch: Pick<TransformationLabChallenge, 'preImage' | 'expectedImage'>):
  { op: SequenceOp; dx: number; dy: number } | null {
  const pre = ch.preImage, img = ch.expectedImage;
  if (!pre?.length || pre.length !== img?.length) return null;
  for (const { op, spec } of PALETTE_TURNS) {
    const mid = mapSpec(spec, pre), dx = img[0].x - mid[0].x, dy = img[0].y - mid[0].y;
    if (mid.every((p, i) => p.x + dx === img[i].x && p.y + dy === img[i].y)) return { op, dx, dy };
  }
  return null;
}

/** Is `b` the set `a` slid by some vector (and which)? */
export function slideBetween(a: readonly GridPoint[], b: readonly GridPoint[]): { dx: number; dy: number } | null {
  if (a.length !== b.length || !a.length) return null;
  const order = (pts: readonly GridPoint[]) => [...pts].sort((p, q) => p.x - q.x || p.y - q.y);
  const sa = order(a), sb = order(b), dx = sb[0].x - sa[0].x, dy = sb[0].y - sa[0].y;
  return sa.every((p, i) => p.x + dx === sb[i].x && p.y + dy === sb[i].y) ? { dx, dy } : null;
}

// ── assignment, work, check ───────────────────────────────────────────────────────────────────────────────────────

export function workspaceAssignment(ch: TransformationLabChallenge): TeachingAssignment {
  return { id: ch.id, task: [ch.narration, ch.instruction].filter(Boolean).join(' '), response: 'gesture' };
}

/** The learner's work on the current item. */
export interface TransformWork {
  /** The pink figure's corners now (drag and compose modes), in the pre-image's corner order. */
  image: readonly GridPoint[];
  /** The palette moves applied so far (compose). */
  steps: readonly SequenceOp[];
  /** The option index tapped (identify). */
  selected: number | null;
}

/** The activity's own check. */
export function transformCorrect(ch: TransformationLabChallenge, work: TransformWork): boolean {
  if (ch.answerKind === 'identify') return work.selected !== null && work.selected === ch.correctOption;
  return polygonsMatch(work.image, ch.expectedImage);
}

/** The learner's work in their terms, never the key. */
export function describeTransformWork(ch: TransformationLabChallenge, work: TransformWork): string {
  if (ch.answerKind === 'identify') {
    const chosen = work.selected !== null ? ch.options?.[work.selected] : undefined;
    return chosen ? `chose "${chosen}"` : 'no option chosen yet';
  }
  if (ch.answerKind === 'sequence') {
    if (!work.steps.length) return 'no moves yet: the pink figure sits on the pre-image';
    return `applied ${work.steps.map(opLabel).join(', then ')} (${work.steps.length} move${work.steps.length === 1 ? '' : 's'}); `
      + `the pink figure's corners are at ${fmtPoints(work.image)}`;
  }
  if (polygonsMatch(work.image, ch.preImage)) return 'no corner moved yet: the pink corners sit on the pre-image';
  return `the pink corners are at ${fmtPoints(work.image)}`;
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), named from the figure the learner made or the option
 * tapped, drawn from the catalog's commonStruggles (wrong axis, wrong turn direction, a dilation taken as congruent)
 * and the patterns a drag shows:
 * - `unmoved`: checked with the figure still on the pre-image (no corner dragged, no move pressed);
 * - translation: `opposite_shift` the slide the other way; `swapped_shift` the two numbers swapped; `one_axis_shift`
 *   only one of the two numbers applied;
 * - reflection: `wrong_axis` reflected over another line (identify: another reflection chosen);
 * - rotation: `wrong_direction` turned the other way (90 for 270); `wrong_angle` another angle (180 for a quarter turn);
 *   `reflected_instead` the figure flipped instead of turned;
 * - dilation: `added_factor` the scale factor added to each coordinate; `wrong_factor` scaled by another factor;
 *   `one_axis_scaled` only x or only y multiplied;
 * - `partly_placed`: some corners on their image points, not all; `shape_changed`: the corners no longer make the
 *   figure's shape (a rigid motion keeps it; a dilation keeps it in proportion); `misplaced`: the right shape, elsewhere;
 * - identify: `reflection_for_rotation` / `rotation_for_reflection` the other family chosen;
 * - compose: `orientation_off` the figure faces another way than the target; `position_off` it faces the target's way
 *   and sits elsewhere.
 */
export type TransformMiss = 'unmoved' | 'opposite_shift' | 'swapped_shift' | 'one_axis_shift' | 'wrong_axis'
  | 'wrong_direction' | 'wrong_angle' | 'reflected_instead' | 'added_factor' | 'wrong_factor' | 'one_axis_scaled'
  | 'partly_placed' | 'shape_changed' | 'misplaced' | 'reflection_for_rotation' | 'rotation_for_reflection'
  | 'orientation_off' | 'position_off';

const DRAG_TAIL: readonly TransformMiss[] = ['partly_placed', 'shape_changed', 'misplaced'];
export const TRANSFORM_MISSES_BY_MODE: Record<TransformationLabChallengeType, readonly TransformMiss[]> = {
  apply_translation_reflection: ['unmoved', 'opposite_shift', 'swapped_shift', 'one_axis_shift', 'wrong_axis', ...DRAG_TAIL],
  apply_rotation: ['unmoved', 'wrong_direction', 'wrong_angle', 'reflected_instead', ...DRAG_TAIL],
  identify_transformation: ['wrong_axis', 'reflection_for_rotation', 'rotation_for_reflection', 'wrong_direction', 'wrong_angle'],
  compose_sequence: ['unmoved', 'orientation_off', 'position_off'],
  dilation_similarity: ['unmoved', 'added_factor', 'wrong_factor', 'one_axis_scaled', ...DRAG_TAIL],
};

type Mapper = (p: GridPoint) => GridPoint;
const viaSpec = (s: TransformSpec): Mapper => p => applySpec(s, p);

/** The figures a drag item's signature misses make: each miss with the point maps that produce it. */
export function signatureMaps(spec: TransformSpec): Array<[TransformMiss, Mapper[]]> {
  switch (spec.kind) {
    case 'translation': {
      const t = (dx: number, dy: number) => viaSpec({ kind: 'translation', dx, dy });
      return [
        ['opposite_shift', [t(-spec.dx, -spec.dy)]],
        ['swapped_shift', spec.dx !== spec.dy ? [t(spec.dy, spec.dx)] : []],
        ['one_axis_shift', [...(spec.dy ? [t(spec.dx, 0)] : []), ...(spec.dx ? [t(0, spec.dy)] : [])]],
      ];
    }
    case 'reflect_x': case 'reflect_y': case 'reflect_yx':
      return [['wrong_axis', REFLECTIONS.filter(r => r.kind !== spec.kind).map(viaSpec)]];
    case 'rotate90': case 'rotate270':
      return [
        ['wrong_direction', [viaSpec({ kind: spec.kind === 'rotate90' ? 'rotate270' : 'rotate90' })]],
        ['wrong_angle', [viaSpec({ kind: 'rotate180' })]],
        ['reflected_instead', REFLECTIONS.map(viaSpec)],
      ];
    case 'rotate180':
      return [['wrong_angle', [viaSpec({ kind: 'rotate90' }), viaSpec({ kind: 'rotate270' })]], ['reflected_instead', REFLECTIONS.map(viaSpec)]];
    case 'dilate': {
      const k = spec.k;
      return [
        ['added_factor', [viaSpec({ kind: 'translation', dx: k, dy: k })]],
        ['wrong_factor', [1, 2, 3, 4].filter(f => f !== k).map(f => viaSpec({ kind: 'dilate', k: f }))],
        ['one_axis_scaled', [p => ({ x: p.x * k, y: p.y }), p => ({ x: p.x, y: p.y * k })]],
      ];
    }
  }
}

/** Squared distances between every two corners, sorted: equal lists mean congruent point sets. */
const distances = (pts: readonly GridPoint[]) => {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
    out.push((pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2);
  return out.sort((a, b) => a - b);
};
/** Does `image` keep the pre-image's shape: congruent for a rigid motion, in proportion for a dilation? */
function keepsShape(pre: readonly GridPoint[], image: readonly GridPoint[], scaled: boolean): boolean {
  const a = distances(pre), b = distances(image);
  if (a.length !== b.length || !a.length) return false;
  if (!scaled) return a.every((d, i) => d === b[i]);
  const r = b[a.length - 1] / (a[a.length - 1] || 1);
  return r > 0 && a.every((d, i) => Math.abs(d * r - b[i]) < 1e-9);
}

export function transformMiss(ch: TransformationLabChallenge, work: TransformWork): TransformMiss | undefined {
  if (transformCorrect(ch, work)) return undefined;
  if (ch.answerKind === 'identify') {
    if (work.selected === null) return undefined;
    const right = specOf(ch), chosen = specFromLabel(ch.options?.[work.selected] ?? '');
    if (!right || !chosen) return undefined;
    if (isReflection(right) && isReflection(chosen)) return 'wrong_axis';
    if (isRotation(right) && isReflection(chosen)) return 'reflection_for_rotation';
    if (isReflection(right) && isRotation(chosen)) return 'rotation_for_reflection';
    const quarter = (s: TransformSpec) => s.kind === 'rotate90' || s.kind === 'rotate270';
    return quarter(right) && quarter(chosen) ? 'wrong_direction' : 'wrong_angle';
  }
  const pre = ch.preImage, image = work.image;
  if (polygonsMatch(image, pre)) return 'unmoved';
  if (ch.answerKind === 'sequence') {
    if (!work.steps.length) return 'unmoved';
    return slideBetween(image, ch.expectedImage) ? 'position_off' : 'orientation_off';
  }
  const spec = specOf(ch);
  if (spec) for (const [miss, maps] of signatureMaps(spec))
    if (maps.some(m => polygonsMatch(image, pre.map(m)))) return miss;
  if (image.some(p => ch.expectedImage.some(e => samePoint(e, p)))) return 'partly_placed';
  if (!keepsShape(pre, image, ch.type === 'dilation_similarity')) return 'shape_changed';
  return 'misplaced';
}

// ── scene ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const MODE_LABEL: Record<TransformationLabChallengeType, string> = {
  apply_translation_reflection: 'apply a translation or reflection',
  apply_rotation: 'apply a rotation about the origin',
  identify_transformation: 'name the transformation',
  compose_sequence: 'reach the target with a sequence of moves',
  dilation_similarity: 'apply a dilation about the origin',
};

export interface TransformView extends TransformWork {
  /** The cyan pre-image's corners carry (x, y) labels. */
  preCoordsShown: boolean;
  /** The rule card on screen, if any. */
  rule: string | null;
}

/** What is drawn and asked. The expected image's coordinates (drag), the moves (compose) and the right option
 *  (identify) are never named. */
export function workspaceScene(ch: TransformationLabChallenge, view: TransformView): WorkspaceScene {
  const n = ch.preImage.length;
  const facts: Record<string, string> = {
    kind: MODE_LABEL[ch.type],
    ask: ch.instruction,
    grid: `a coordinate grid from ${GRID_MIN} to ${GRID_MAX} on both axes, the origin at the centre`,
    preImage: `a cyan pre-image with ${n} corners${view.preCoordsShown
      ? ` at ${fmtPoints(ch.preImage)}, each labelled` : ', its corners not labelled with coordinates (they are read off the grid)'}`,
  };
  if (ch.answerKind === 'identify') {
    facts.image = `an amber image with ${n} corners at ${fmtPoints(ch.expectedImage)}, each labelled`;
    facts.options = (ch.options ?? []).join('; ');
  } else if (ch.answerKind === 'sequence') {
    facts.target = `a dashed target outline with ${n} corners, not labelled`;
    facts.palette = SEQUENCE_PALETTE.map(p => p.label).join(', ');
  } else {
    facts.target = 'no target is drawn: the image is what the learner makes';
  }
  if (view.rule) facts.rule = `a rule card reads ${view.rule}`;
  facts.learnerWork = describeTransformWork(ch, view);
  facts.constraints = ch.answerKind === 'identify'
    ? 'The learner taps one option and presses Check. The activity checks it itself. You cannot choose or press Check.'
    : ch.answerKind === 'sequence'
    ? 'The learner presses the move buttons (each moves the whole pink figure at once; Reset starts over) and presses '
      + 'Check. The activity checks whether the figure lies on the target. You cannot press a move or Check.'
    : 'The learner drags each pink corner to a grid point (corners snap) and presses Check. The activity checks the whole '
      + 'image itself. You cannot move a corner or press Check.';
  return { objects: [], facts };
}

// ── journey inputs ────────────────────────────────────────────────────────────────────────────────────────────────

export type TransformHarnessInput =
  | { type: 'draw'; strokes: { x: number; y: number }[][] }
  | { type: 'choose'; label: string }
  | { type: 'check' };

/** The grid canvas's `data-pip-object` id, the one the driver's canvas strokes look for (mouse events, logical pixels). */
export const GRID_TARGET = 'canvas';

/** One drag per corner from `from` to `to` (corner order), never dropping a corner onto another one. */
export function dragStrokes(from: readonly GridPoint[], to: readonly GridPoint[]): { x: number; y: number }[][] {
  const cur = from.map(p => ({ ...p }));
  const strokes: { x: number; y: number }[][] = [];
  const line = (a: GridPoint, b: GridPoint) => {
    const s = gridToCanvas(a), e = gridToCanvas(b);
    return Array.from({ length: 5 }, (_, i) => ({ x: s.x + ((e.x - s.x) * i) / 4, y: s.y + ((e.y - s.y) * i) / 4 }));
  };
  const occupied = (p: GridPoint, except: number) => cur.some((q, j) => j !== except && samePoint(q, p));
  const pending = () => cur.map((_, i) => i).filter(i => !samePoint(cur[i], to[i]));
  for (let guard = 0; pending().length && guard < 40; guard++) {
    const free = pending().find(i => !occupied(to[i], i));
    if (free !== undefined) { strokes.push(line(cur[free], to[free])); cur[free] = { ...to[free] }; continue; }
    // Every target is under another corner: park one corner on a free point first.
    const i = pending()[0];
    let park: GridPoint | undefined;
    for (let r = 1; r <= 3 && !park; r++) for (const d of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
      const p = { x: cur[i].x + d[0], y: cur[i].y + d[1] };
      if (inGrid(p) && !occupied(p, i) && !to.some(t => samePoint(t, p))) { park = p; break; }
    }
    if (!park) break;
    strokes.push(line(cur[i], park)); cur[i] = park;
  }
  return strokes;
}

/** The figure a wrong drag makes: the mode's signature miss when it stays on the grid, else one corner off by a square. */
export function wrongDragImage(ch: TransformationLabChallenge): GridPoint[] {
  const spec = specOf(ch);
  if (spec) for (const [, maps] of signatureMaps(spec)) for (const m of maps) {
    const image = ch.preImage.map(m);
    if (image.every(inGrid) && !polygonsMatch(image, ch.expectedImage) && !polygonsMatch(image, ch.preImage)) return image;
  }
  const image = ch.expectedImage.map(p => ({ ...p }));
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const p = { x: image[0].x + d[0], y: image[0].y + d[1] };
    if (inGrid(p) && !image.some(q => samePoint(q, p))) { image[0] = p; break; }
  }
  return image;
}

/**
 * The tutor replay's keys, as the screen prints them: a drag item's image corners that are not also pre-image corners
 * ("(6, 0)"; the origin a dilation keeps fixed is not a key), identify's right option, compose's flip or turn.
 */
export function transformReplayKeys(ch: TransformationLabChallenge): string[] {
  if (ch.answerKind === 'identify') return ch.options?.[ch.correctOption ?? -1] ? [ch.options[ch.correctOption!].toLowerCase()] : [];
  if (ch.answerKind === 'sequence') {
    const plan = composeOf(ch);
    return plan ? [opLabel(plan.op).toLowerCase()] : [];
  }
  return ch.expectedImage.filter(e => !ch.preImage.some(p => samePoint(p, e))).map(fmtPoint);
}

/**
 * The journey row's inputs for the current item, from a blank start (the pre-image; Try again clears the work).
 * drag: one drag per corner on the grid, then Check; wrong is the mode's signature miss (`signatureMaps`).
 * identify: the option, then Check; wrong is another of the same family where there is one.
 * compose: the flip or turn, then the slides, then Check; wrong is the slides alone (`orientation_off`).
 */
export function transformHarnessInputs(ch: TransformationLabChallenge, intent: 'correct' | 'wrong'): TransformHarnessInput[] {
  const check: TransformHarnessInput = { type: 'check' };
  if (ch.answerKind === 'identify') {
    const options = ch.options ?? [], right = ch.correctOption ?? -1;
    if (intent === 'correct') return [{ type: 'choose', label: options[right] }, check];
    const spec = specOf(ch);
    const family = (s: TransformSpec | null) => (s ? (isReflection(s) ? 'r' : 't') : '');
    const others = options.map((o, i) => ({ o, i })).filter(x => x.i !== right);
    const pick = others.find(x => spec && family(specFromLabel(x.o)) === family(spec)) ?? others[0];
    return [{ type: 'choose', label: pick.o }, check];
  }
  if (ch.answerKind === 'sequence') {
    const plan = composeOf(ch);
    if (!plan) throw new Error(`transformation-lab compose_sequence: no palette move reaches the target of ${ch.id}`);
    const slides = [
      ...Array.from({ length: Math.abs(plan.dx) }, () => (plan.dx > 0 ? 'Right →' : '← Left')),
      ...Array.from({ length: Math.abs(plan.dy) }, () => (plan.dy > 0 ? '↑ Up' : '↓ Down')),
    ];
    const labels = intent === 'correct' ? [opLabel(plan.op), ...slides] : slides.length ? slides : ['Right →'];
    return [...labels.map((label): TransformHarnessInput => ({ type: 'choose', label })), check];
  }
  const to = intent === 'correct' ? ch.expectedImage : wrongDragImage(ch);
  return [{ type: 'draw', strokes: dragStrokes(ch.preImage, to) }, check];
}
