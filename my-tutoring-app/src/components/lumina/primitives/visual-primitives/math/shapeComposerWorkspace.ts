/**
 * Shape composer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C11).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the
 * screen (pieces dragged onto the board, shapes tapped, a number typed, or an open build) and checked by the
 * activity's own check, so the tutor is never handed piece targets, picture slots, `expectedComponents`,
 * `compositeDescription` or `minimumPiecesNeeded`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ShapeComposerChallenge } from './ShapeComposer';
import { judgeShapeBuild, recipeText, SHAPE_BUILD_MISS_WORDS, type BoardPiece, type ShapeBuildMiss } from './shapeComposerBuild';

export function workspaceAssignment(challenge: ShapeComposerChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface ShapeView {
  /** The pieces on the board for this challenge, in canvas units. */
  placed: BoardPiece[];
  /** decompose: the shapes tapped, in order. */
  taps: readonly string[];
  /** how-many-ways: the number typed (as typed). */
  answer: string;
  /** Distance (canvas units) within which a piece counts as on its spot. */
  snapTolerance: number;
}

const plural = (shape: string, n: number) => `${n} ${shape}${n === 1 ? '' : 's'}`;
/** "2 triangles, 1 square", in first-placed order. */
export function kindsText(shapes: readonly string[]): string {
  const by = new Map<string, number>();
  for (const s of shapes) by.set(s, (by.get(s) ?? 0) + 1);
  return Array.from(by, ([s, n]) => plural(s, n)).join(', ');
}

/** decompose: the shapes offered as answers. The parts plus shapes that are not in it, in a fixed (alphabetical)
 *  order, so neither which buttons exist nor where they sit says which shapes are the parts. */
const DECOMPOSE_POOL = ['triangle', 'square', 'rectangle', 'circle', 'hexagon', 'trapezoid', 'rhombus'];
export function decomposeChoices(c: ShapeComposerChallenge): string[] {
  const parts = Array.from(new Set((c.expectedComponents ?? []).map(p => p.shape)));
  const others = DECOMPOSE_POOL.filter(s => !parts.includes(s)).slice(0, Math.max(2, 4 - parts.length));
  return [...parts, ...others].sort();
}

/** compose-match: the placed pieces that sit on an outline spot of their shape (each piece fills one spot). */
export function fittedPieceIds(c: ShapeComposerChallenge, view: Pick<ShapeView, 'placed' | 'snapTolerance'>): Set<string> {
  const used = new Set<string>();
  for (const piece of c.pieces ?? []) {
    if (piece.targetX === undefined || piece.targetY === undefined) continue;
    const match = view.placed.find(s => !used.has(s.id) && s.shape === piece.shape
      && Math.hypot(s.x - piece.targetX!, s.y - piece.targetY!) < view.snapTolerance);
    if (match) used.add(match.id);
  }
  return used;
}

/** compose-match: how many outline spots hold a same-shape piece. */
export function fittedCount(c: ShapeComposerChallenge, view: Pick<ShapeView, 'placed' | 'snapTolerance'>): number {
  const free = (c.pieces ?? []).filter(p => p.targetX === undefined || p.targetY === undefined).length;
  return fittedPieceIds(c, view).size + free;
}

/** compose-picture: the picture spots that hold a piece of their shape. */
export function filledSlotIds(c: ShapeComposerChallenge, view: Pick<ShapeView, 'placed' | 'snapTolerance'>): Set<string> {
  return new Set((c.pictureSlots ?? []).filter(slot => view.placed.some(s => s.shape === slot.shape
    && Math.abs(s.x - slot.x) < view.snapTolerance && Math.abs(s.y - slot.y) < view.snapTolerance)).map(s => s.id));
}

/** compose-picture: how many picture spots hold a piece of their shape. */
export function filledSlots(c: ShapeComposerChallenge, view: Pick<ShapeView, 'placed' | 'snapTolerance'>): number {
  return filledSlotIds(c, view).size;
}

const tally = (shapes: readonly string[]) => {
  const by: Record<string, number> = {};
  for (const s of shapes) by[s] = (by[s] ?? 0) + 1;
  return by;
};

/** The activity's own check. */
export function shapeComposerMatches(c: ShapeComposerChallenge, view: ShapeView): boolean {
  switch (c.type) {
    case 'compose-match': {
      const pieces = c.pieces ?? [];
      return fittedCount(c, view) === pieces.length && view.placed.length >= pieces.length;
    }
    case 'compose-picture': return filledSlots(c, view) === (c.pictureSlots ?? []).length;
    case 'decompose': {
      const expected = c.expectedComponents ?? [];
      const have = tally(view.taps);
      return expected.every(p => (have[p.shape] ?? 0) >= p.count)
        && view.taps.length === expected.reduce((sum, p) => sum + p.count, 0);
    }
    case 'how-many-ways': return parseInt(view.answer, 10) === (c.minimumPiecesNeeded ?? 0);
    case 'free-create': return c.recipe?.length ? judgeShapeBuild(c.recipe, view.placed).pass : view.placed.length >= 2;
    default: return false;
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - compose-match: `pieces_left` (pieces still in the palette), `piece_off_outline` (all out, one not on its spot);
 * - compose-picture: `shape_missing` (a shape the picture needs is not on the board), `shape_off_spot`;
 * - decompose: `not_a_part` (tapped a shape the big shape is not made of), `missed_part` (fewer parts than it has),
 *   `extra_part` (more), `wrong_mix` (as many parts, the wrong kinds of each);
 * - how-many-ways: `too_few` (fewer than the fewest pieces that build it), `too_many` (more than the fewest);
 * - free-create: the open build's own misses (`ShapeBuildMiss`), or `too_few_shapes` on an older payload with no recipe.
 */
export type ShapeComposerMiss = 'pieces_left' | 'piece_off_outline'
  | 'shape_missing' | 'shape_off_spot'
  | 'not_a_part' | 'missed_part' | 'extra_part' | 'wrong_mix'
  | 'too_few' | 'too_many'
  | ShapeBuildMiss | 'too_few_shapes';

export function shapeComposerMiss(c: ShapeComposerChallenge | null, view: ShapeView): ShapeComposerMiss | undefined {
  if (!c || shapeComposerMatches(c, view)) return undefined;
  switch (c.type) {
    case 'compose-match':
      return view.placed.length < (c.pieces ?? []).length ? 'pieces_left' : 'piece_off_outline';
    case 'compose-picture': {
      const need = tally((c.pictureSlots ?? []).map(s => s.shape)), have = tally(view.placed.map(p => p.shape));
      return Object.entries(need).some(([s, n]) => (have[s] ?? 0) < n) ? 'shape_missing' : 'shape_off_spot';
    }
    case 'decompose': {
      const expected = c.expectedComponents ?? [];
      const parts = new Set(expected.map(p => p.shape));
      const total = expected.reduce((sum, p) => sum + p.count, 0);
      if (view.taps.some(t => !parts.has(t))) return 'not_a_part';
      return view.taps.length < total ? 'missed_part' : view.taps.length > total ? 'extra_part' : 'wrong_mix';
    }
    case 'how-many-ways': {
      const n = parseInt(view.answer, 10);
      if (!Number.isFinite(n)) return undefined;
      return n < (c.minimumPiecesNeeded ?? 0) ? 'too_few' : 'too_many';
    }
    case 'free-create':
      return c.recipe?.length ? judgeShapeBuild(c.recipe, view.placed).miss ?? undefined : 'too_few_shapes';
    default: return undefined;
  }
}

/** What the board says after a miss: the problem, never which piece goes where, which shapes, or how many. */
export const SHAPE_MISS_WORDS: Record<ShapeComposerMiss, string> = {
  pieces_left: 'Some pieces are still waiting in the palette. Every piece goes in the outline.',
  piece_off_outline: 'A piece is not in its place yet. Slide or turn it until it fits inside the outline.',
  shape_missing: 'Your picture needs more shapes from the palette.',
  shape_off_spot: 'A shape is not in its place yet. Look at the picture and slide it to where it belongs.',
  not_a_part: 'One shape you tapped is not inside the big shape. Look at its edges again.',
  missed_part: 'The big shape has more parts than you tapped. Look for every part.',
  extra_part: 'You tapped more parts than the big shape has. Count each part once.',
  wrong_mix: 'Look again at each part. Which kind of shape is it?',
  too_few: 'That is not enough pieces to make it. Picture the small shapes fitting inside it, one at a time.',
  too_many: 'You can make it with fewer pieces than that. Picture the small shapes fitting inside it, one at a time.',
  too_few_shapes: 'Use at least two shapes in your picture.',
  ...SHAPE_BUILD_MISS_WORDS,
};

/** The learner's work in their own terms, never the key. */
export function describeShapeWork(c: ShapeComposerChallenge, view: ShapeView): string {
  const kinds = kindsText(view.placed.map(p => p.shape));
  switch (c.type) {
    case 'compose-match': {
      if (!view.placed.length) return 'No pieces on the board yet';
      const total = (c.pieces ?? []).length;
      return `On the board: ${kinds}; ${fittedCount(c, view)} of ${total} pieces snapped into the outline`;
    }
    case 'compose-picture': {
      if (!view.placed.length) return 'No shapes on the board yet';
      // The spots are drawn only while snap guides are shown; without them, how many are filled is not on screen.
      return c.showSnapGuides === false ? `On the board: ${kinds}`
        : `On the board: ${kinds}; ${filledSlots(c, view)} of ${(c.pictureSlots ?? []).length} picture spots filled`;
    }
    case 'decompose':
      return view.taps.length ? `Tapped: ${view.taps.join(', ')}` : 'No shapes tapped yet';
    case 'how-many-ways': {
      const typed = view.answer.trim() ? `Typed ${view.answer.trim()} pieces` : 'No number typed yet';
      return view.placed.length ? `${typed}; trying ${kinds} on the board` : typed;
    }
    case 'free-create':
      return view.placed.length ? `On the board: ${kinds}` : 'No shapes on the board yet';
    default: return 'No work yet';
  }
}

/** What is drawn and asked. Shapes on screen are named; no target spot, part list or piece count is. */
export function workspaceScene(c: ShapeComposerChallenge, view: ShapeView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  if (c.type === 'compose-match') {
    drawn.target = `the outline of a ${(c.targetShape ?? 'shape').replace(/-/g, ' ')}, dashed`;
    drawn.palette = kindsText((c.pieces ?? []).map(p => p.shape));
    drawn.pieceSpots = c.showSeams !== false ? 'shown: each piece’s spot is outlined inside the target' : 'hidden';
    drawn.howToAnswer = 'tap a palette piece to put it on the board, drag it into the outline (it snaps when close), '
      + 'select it and press the turn button to rotate it, then Check Answer';
  } else if (c.type === 'compose-picture') {
    drawn.picture = (c.targetPicture ?? 'picture').replace(/-/g, ' ');
    drawn.palette = (c.availableShapes ?? []).map(s => plural(s.shape, s.count)).join(', ');
    drawn.pictureSpots = c.showSnapGuides !== false ? 'shown: faint outlines mark where shapes go' : 'hidden';
    drawn.howToAnswer = 'tap a palette shape to put it on the board, drag it into place (it snaps when close), then Check Answer';
  } else if (c.type === 'decompose') {
    drawn.bigShape = 'one composite shape, filled purple';
    drawn.splitLines = c.showSeams !== false ? 'shown: dashed lines inside it' : 'hidden';
    drawn.choices = decomposeChoices(c).join(' | ');
    drawn.howToAnswer = 'tap a shape once for each part of that kind, then Check Answer; Reset Selections clears the taps';
  } else if (c.type === 'how-many-ways') {
    drawn.build = (c.targetForComposition ?? 'shape').replace(/-/g, ' ');
    drawn.pieces = (c.allowedPieces ?? []).join(', ');
    // The board has no outline of the shape to build: a tutor once asked how much of "the square on your board" a piece covered.
    drawn.board = 'empty: the shape to build is named in the ask, not drawn; palette pieces land in the middle and are for '
      + 'trying, and may not fit together into the named shape exactly';
    drawn.howToAnswer = 'type how many pieces, then Check Answer; the learner may add pieces to the board to try it first';
  } else if (c.type === 'free-create') {
    if (c.recipe?.length) {
      drawn.shapesToUse = `${recipeText(c.recipe)} (also drawn as shape icons under the ask)`;
      drawn.checkedAtDone = 'exactly the listed shapes, none on top of another, every shape touching another';
    }
    drawn.howToAnswer = 'tap palette shapes onto the board (the palette has more kinds than the list), drag and turn them, '
      + 'Start over clears the board, then I’m done!';
  }
  return {
    objects: [],
    facts: {
      kind: c.type, ...drawn,
      learnerWork: describeShapeWork(c, view),
      constraints: 'The learner answers on the screen: drags pieces onto the board, taps shapes, or types a number, then '
        + 'checks; the activity checks the work itself. You cannot drag, tap or type for the learner.',
    },
  };
}
