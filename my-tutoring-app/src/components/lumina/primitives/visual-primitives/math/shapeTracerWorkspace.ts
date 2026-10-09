/**
 * Shape tracer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C11).
 *
 * Pure: the component and any probe read the same assignment, scene and check. Every challenge is answered by
 * tapping dots on the canvas and checked by the activity itself, so the tutor is never handed the dot order or a
 * shape the screen has not named yet.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ShapeTracerChallenge } from './ShapeTracer';

export type Point = { x: number; y: number };

export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 400;
const GRID_PAD = 40;

/** The grid dots a draw-from-description challenge places corners on, column by column (`grid-<index>` on screen). */
export function gridDots(gridSize: number): Point[] {
  const dots: Point[] = [];
  for (let x = GRID_PAD; x <= CANVAS_WIDTH - GRID_PAD; x += gridSize) {
    for (let y = GRID_PAD; y <= CANVAS_HEIGHT - GRID_PAD; y += gridSize) dots.push({ x, y });
  }
  return dots;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The draw-from-description check: corner count against the clue, then (when asked) sides of about one length. */
export function checkShapeProperties(
  vertices: readonly Point[],
  required: NonNullable<ShapeTracerChallenge['requiredProperties']>,
): { correct: boolean; feedback: string } {
  const numSides = vertices.length;
  if (required.sides !== undefined && numSides !== required.sides) {
    return { correct: false, feedback: `Your shape has ${numSides} sides but needs ${required.sides}.` };
  }
  if (required.corners !== undefined && numSides !== required.corners) {
    return { correct: false, feedback: `Your shape has ${numSides} corners but needs ${required.corners}.` };
  }
  if (required.allSidesEqual && numSides >= 2) {
    const lengths = vertices.map((v, i) => dist(v, vertices[(i + 1) % numSides]));
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const tolerance = avg * 0.35; // generous for small hands
    if (!lengths.every(len => Math.abs(len - avg) <= tolerance)) {
      return { correct: false, feedback: 'Try to make all sides about the same length!' };
    }
  }
  return { correct: true, feedback: 'Great shape!' };
}

/** The tracing help a challenge's tier left on the canvas. Undefined = on (no tier applied). */
export interface TracerGuides { guidePath: boolean; arrows: boolean; nextCue: boolean; orderNumbers: boolean }
export const tierGuides = (c: ShapeTracerChallenge): TracerGuides => ({
  guidePath: c.showGuidePath ?? true, arrows: c.showDirectionArrows ?? true,
  nextCue: c.showNextCue ?? true, orderNumbers: c.showOrderNumbers ?? true,
});

/**
 * A trace with no order numbers and no next-dot glow shows nothing that says which corner is first, so any corner
 * may start and the outline may go either way round. With either cue on, the numbered order is the task.
 */
export const freeTrace = (c: ShapeTracerChallenge): boolean => {
  const g = tierGuides(c);
  return c.type === 'trace' && !g.orderNumbers && !g.nextCue;
};

/** Whether tapping corner `idx` continues a trace of an `n`-corner outline. */
export function traceAccepts(n: number, tapped: readonly number[], idx: number, free: boolean): boolean {
  if (tapped.includes(idx) || idx < 0 || idx >= n) return false;
  if (!free) return idx === tapped.length;
  if (!tapped.length) return true;
  const last = tapped[tapped.length - 1];
  if (tapped.length === 1) return idx === (last + 1) % n || idx === (last - 1 + n) % n;
  const step = (tapped[1] - tapped[0] + n) % n === 1 ? 1 : -1;
  return idx === (last + step + n) % n;
}

/** The corner a trace continues to (where the next-dot glow sits). */
export function nextTraceCorner(n: number, tapped: readonly number[], free: boolean): number {
  if (!free || !tapped.length) return tapped.length;
  const last = tapped[tapped.length - 1];
  if (tapped.length === 1) return (last + 1) % n;
  const step = (tapped[1] - tapped[0] + n) % n === 1 ? 1 : -1;
  return (last + step + n) % n;
}

/**
 * The instruction, plus what the screen states as part of the ask: a drawing's clue (it IS the task, and a
 * pre-reader hears it from the tutor), and a trace's corner numbers when its tier shows them (the numbered order is
 * then the instruction on the canvas, not a secret).
 */
export function workspaceAssignment(challenge: ShapeTracerChallenge): TeachingAssignment {
  const n = challenge.tracePath?.length ?? 0;
  const extra = challenge.type === 'draw-from-description' && challenge.description ? ` Clue: ${challenge.description}`
    : challenge.type === 'trace' && tierGuides(challenge).orderNumbers && n
      ? ` The corners are numbered ${Array.from({ length: n }, (_, i) => i + 1).join(', ')}.` : '';
  return { id: challenge.id, task: challenge.instruction + extra, response: 'gesture' };
}

/** What the learner has done on the current challenge, as the component holds it. */
export interface ShapeTracerView {
  /** Corners (trace), open corners (complete) or dots (connect-dots) joined so far, in tap order. */
  tapped: readonly number[];
  /** Corners placed on the grid (draw-from-description). */
  points: readonly Point[];
  /** The last tap was not the next one, so the activity did not draw it (trace, complete, draw). */
  refused: boolean;
  /** The shape is finished and credited. */
  complete: boolean;
  /** The tracing help on the canvas now. */
  guides: TracerGuides;
  /** The "Needs:" chips under the instruction (draw-from-description). */
  propertyReminder: boolean;
}

const corners = (n: number) => `${n} corner${n === 1 ? '' : 's'}`;
const labelOf = (c: ShapeTracerChallenge, i: number) => c.dots?.[i]?.label ?? String(i + 1);

/** The learner's work in their own terms, never the key. `wrongDot`: the dot a wrong connect-dots tap landed on. */
export function describeShapeWork(c: ShapeTracerChallenge, view: ShapeTracerView, wrongDot?: number): string {
  const refused = view.refused ? '; the last tap was not the next one, so it was not drawn' : '';
  switch (c.type) {
    case 'trace': {
      const n = c.tracePath?.length ?? 0;
      if (view.complete) return `Traced all ${corners(n)}; the shape is closed`;
      return (view.tapped.length ? `Tapped ${view.tapped.length} of ${n} corners in turn` : 'No corner tapped yet') + refused;
    }
    case 'complete': {
      const n = c.remainingVertices?.length ?? 0;
      if (view.complete) return 'Finished the shape; it is closed';
      return (view.tapped.length ? `Tapped ${view.tapped.length} of ${n} open corners in turn` : 'No open corner tapped yet') + refused;
    }
    case 'draw-from-description':
      if (!view.points.length) return 'No corner placed yet' + refused;
      return `Placed ${corners(view.points.length)} on the grid` + refused;
    default: {
      const joined = view.tapped.map(i => labelOf(c, i));
      const so = joined.length ? `Joined ${joined.join(', ')}` : 'No dot joined yet';
      if (wrongDot !== undefined) return `${joined.length ? `${so}, then tapped` : 'Tapped'} dot ${labelOf(c, wrongDot)}`;
      return view.complete ? `${so}; every dot is joined` : so;
    }
  }
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20). Only connect-dots and draw-from-description have a
 * wrong check: a trace or completion tap that is not the next corner is refused on the dot, never checked.
 * - connect-dots, from the dot tapped instead of the next number: `went_back` (a dot already joined),
 *   `started_elsewhere` (the first tap is not the first number), `skipped_number` (a later number);
 * - draw-from-description, from the checked corners: `too_few_sides`, `too_many_sides`, `sides_unequal` (the
 *   right count, but the clue asks for sides of one length and these are not).
 */
export type ShapeTracerMiss = 'went_back' | 'started_elsewhere' | 'skipped_number'
  | 'too_few_sides' | 'too_many_sides' | 'sides_unequal';

export function shapeTracerMiss(c: ShapeTracerChallenge | null,
  work: { tapped: readonly number[]; points: readonly Point[]; wrongDot?: number }): ShapeTracerMiss | undefined {
  if (!c) return undefined;
  if (c.type === 'connect-dots') {
    const order = c.correctOrder ?? [];
    if (work.wrongDot === undefined || work.wrongDot === order[work.tapped.length]) return undefined;
    if (work.tapped.includes(work.wrongDot)) return 'went_back';
    return work.tapped.length === 0 ? 'started_elsewhere' : 'skipped_number';
  }
  if (c.type === 'draw-from-description') {
    const required = c.requiredProperties;
    if (!required || work.points.length < 3 || checkShapeProperties(work.points, required).correct) return undefined;
    const want = required.sides ?? required.corners;
    if (want !== undefined && work.points.length < want) return 'too_few_sides';
    if (want !== undefined && work.points.length > want) return 'too_many_sides';
    return 'sides_unequal';
  }
  return undefined;
}

const shown = (on: boolean) => (on ? 'shown' : 'hidden');

/** What is drawn and asked. The order of the dots is on screen only as their numbers; no hidden shape is named. */
export function workspaceScene(c: ShapeTracerChallenge, view: ShapeTracerView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const g = view.guides;
  if (c.type === 'trace') {
    drawn.shape = c.targetShape;
    drawn.corners = c.tracePath?.length ?? 0;
    drawn.dottedOutline = shown(g.guidePath);
    drawn.orderNumbers = shown(g.orderNumbers);
    drawn.nextDotGlow = shown(g.nextCue);
    drawn.howToAnswer = freeTrace(c)
      ? 'tap the corners one after another around the outline, starting at any corner; the shape closes on the last one'
      : 'tap the numbered corners in order from 1; the shape closes on the last one';
  } else if (c.type === 'complete') {
    drawn.shape = c.targetShape;
    drawn.sidesAlreadyDrawn = c.drawnSides?.length ?? 0;
    drawn.openCorners = c.remainingVertices?.length ?? 0;
    drawn.nextDotGlow = shown(g.nextCue);
    drawn.howToAnswer = 'tap the open corners one after another, carrying on from where the drawn sides stop; the shape closes on the last one';
  } else if (c.type === 'draw-from-description') {
    drawn.clue = c.description ?? '';
    if (view.propertyReminder && c.requiredProperties) {
      const r = c.requiredProperties;
      drawn.needsChips = [r.sides !== undefined ? `${r.sides} sides` : '', r.corners !== undefined ? `${r.corners} corners` : '',
        r.allSidesEqual ? 'all sides equal' : ''].filter(Boolean).join(', ');
    }
    drawn.cornerNumbers = shown(g.orderNumbers);
    drawn.howToAnswer = 'tap grid dots to place corners in turn around the shape, then press Check Shape';
  } else {
    const n = c.dots?.length ?? 0;
    drawn.dots = `${n} dots numbered 1 to ${n}`;
    drawn.nextDotGlow = shown(g.nextCue);
    drawn.howToAnswer = 'tap the dots in number order, starting at 1; the shape appears when every dot is joined';
    if (view.complete) drawn.revealed = c.revealShape || c.targetShape;
  }
  return {
    objects: [],
    facts: {
      kind: c.type, ...drawn,
      learnerWork: describeShapeWork(c, view),
      constraints: 'The learner answers on the screen by tapping dots on the canvas (and Check Shape when drawing); the '
        + 'activity checks the work itself. You cannot tap, draw or check for the learner.',
    },
  };
}

/**
 * The grid corners a test or journey taps for a draw-from-description challenge: a regular polygon with the clue's
 * side count (`wrong`: one corner fewer, or one more for a triangle), snapped to the grid, that the check accepts.
 */
export function drawCorners(c: ShapeTracerChallenge, gridSize: number, wrong = false): number[] {
  const dots = gridDots(gridSize);
  const cols = Math.floor((CANVAS_WIDTH - 2 * GRID_PAD) / gridSize) + 1;
  const rows = Math.floor((CANVAS_HEIGHT - 2 * GRID_PAD) / gridSize) + 1;
  const required = c.requiredProperties ?? {};
  const want = required.sides ?? required.corners ?? 3;
  const n = wrong ? (want > 3 ? want - 1 : want + 1) : want;
  const ci = Math.floor(cols / 2), cj = Math.floor(rows / 2);
  for (let r = 1; r <= Math.min(ci, cj); r++) {
    for (const turn of [0, Math.PI / n]) {
      const cells = Array.from({ length: n }, (_, k) => {
        const a = -Math.PI / 2 + turn + (2 * Math.PI * k) / n;
        return { i: ci + Math.round(r * Math.cos(a)), j: cj + Math.round(r * Math.sin(a)) };
      });
      if (new Set(cells.map(p => `${p.i},${p.j}`)).size !== n) continue;
      if (cells.some(p => p.i < 0 || p.j < 0 || p.i >= cols || p.j >= rows)) continue;
      const points = cells.map(p => dots[p.i * rows + p.j]);
      if (!wrong && !checkShapeProperties(points, required).correct) continue;
      return cells.map(p => p.i * rows + p.j);
    }
  }
  throw new Error(`shape-tracer: no ${n}-corner shape fits a ${gridSize}px grid`);
}
