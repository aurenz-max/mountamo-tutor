/**
 * shape-tracer's in-item levers (/add-support-tiers; report qa/eval-reports/shape-tracer-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `shapeTracerMiss` observes (journey scripted wrongs) and the catalog's
 * commonStruggles. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * The generator's tier guides (outline, numbers, next-dot glow) stay the starting positions: a guide the tier already
 * shows is declared pulled. Every other lever starts released.
 *
 * - `dotted_outline` (help; trace, complete): the dashed outline of the whole shape through its corners (on trace with
 *   the moving arrows). The corners are on screen and the shape is named, so the outline is the path, not a secret.
 * - `order_numbers` (help; trace): the corner numbers 1, 2, 3 ...
 * - `next_glow` (help; trace, complete): the pulsing ring on the corner that comes next. Leak rule (`glowOffered`):
 *   never on connect-dots, where which dot comes next IS the answer.
 * - `number_strip` (help; connect_dots): a strip of the dots' numbers in counting order above the canvas, ticking the
 *   ones joined. It marks no dot on the canvas: the learner still finds the next number among the dots.
 * - `fade_joined` (help; connect_dots): joined dots turn into green ticks, so they stop looking like dots to tap.
 *   Refused while no dot is joined (it would change nothing).
 * - `corner_rings` (help; draw_from_description): a row of empty rings, one per corner the clue asks for, filling one
 *   per corner the learner places; a corner past the clue's count shows as a red ring after the row. The count is the
 *   clue's (on screen as words); the rings show the learner's own count against it, as pictures for a pre-reader.
 * - `side_bars` (help; draw_from_description when the clue asks for equal sides): one bar per side of the learner's own
 *   shape, as long as the side, lined up from the left. Leak rule (`sideBars`): drawn from the learner's corners only;
 *   it never marks a grid dot or says which side to change.
 * - `simpler_item` (simplify): an ungraded item of the same mode, built here, then the full item back. trace and
 *   connect_dots: a triangle (none on a three-corner item); complete: a shape with one open corner (none when only one
 *   is open); draw_from_description: a three-sided clue with no equal sides (none when that is the clue). Leak rule
 *   (`practiceLeaks`): never the item's own corners, dots or clue, and always fewer to do.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ShapeTracerChallenge } from './ShapeTracer';
import { tierGuides, type Point, type ShapeTracerMiss, type TracerGuides } from './shapeTracerWorkspace';

export const OUTLINE_LEVER = 'dotted_outline';
export const NUMBERS_LEVER = 'order_numbers';
export const GLOW_LEVER = 'next_glow';
export const STRIP_LEVER = 'number_strip';
export const FADE_LEVER = 'fade_joined';
export const RINGS_LEVER = 'corner_rings';
export const BARS_LEVER = 'side_bars';
export const SIMPLER_LEVER = 'simpler_item';

const PRACTICE_SUFFIX = '~simpler';
export const isPracticeShape = (c: Pick<ShapeTracerChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly ShapeTracerChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Leak rule: the glow marks the next dot; on connect-dots that is the answer. */
export const glowOffered = (type: ShapeTracerChallenge['type']) => type === 'trace' || type === 'complete';

/** The guides on the canvas: the tier's, plus the guide levers pulled on this item. */
export function guidesWith(c: ShapeTracerChallenge, pulled: readonly string[]): TracerGuides {
  const g = tierGuides(c), on = (id: string) => pulled.includes(id);
  if (c.type === 'trace') return { guidePath: g.guidePath || on(OUTLINE_LEVER), arrows: g.arrows || on(OUTLINE_LEVER),
    nextCue: g.nextCue || on(GLOW_LEVER), orderNumbers: g.orderNumbers || on(NUMBERS_LEVER) };
  if (c.type === 'complete') return { ...g, nextCue: g.nextCue || on(GLOW_LEVER) };
  return g;
}

// ── draw_from_description ────────────────────────────────────────────────────

/** The corners the clue asks for. */
export const cluedCorners = (c: ShapeTracerChallenge) => c.requiredProperties?.sides ?? c.requiredProperties?.corners ?? 0;

/** corner_rings: the clue's rings and how many of them the learner's corners fill; corners past the clue are `extra`. */
export function cornerRings(c: ShapeTracerChallenge, placed: number): { rings: number; filled: number; extra: number } {
  const rings = cluedCorners(c);
  return { rings, filled: Math.min(placed, rings), extra: Math.max(0, placed - rings) };
}

/** side_bars: the length of each side of the learner's own closed shape, in canvas units. Nothing from the item. */
export function sideBars(points: readonly Point[]): number[] {
  if (points.length < 2) return [];
  const n = points.length, closed = n >= 3;
  return Array.from({ length: closed ? n : n - 1 }, (_, i) => {
    const a = points[i], b = points[(i + 1) % n];
    return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  });
}

// ── simpler items ────────────────────────────────────────────────────────────

const TRIANGLE: Point[] = [{ x: 250, y: 90 }, { x: 130, y: 310 }, { x: 370, y: 310 }];
const SQUARE: Point[] = [{ x: 160, y: 110 }, { x: 340, y: 110 }, { x: 340, y: 290 }, { x: 160, y: 290 }];
const sameCorners = (a: readonly Point[] = [], b: readonly Point[] = []) =>
  a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
const scaffolds = (c: ShapeTracerChallenge) => ({ showGuidePath: c.showGuidePath, showDirectionArrows: c.showDirectionArrows,
  showNextCue: c.showNextCue, showOrderNumbers: c.showOrderNumbers, supportTier: c.supportTier });

/** The corners of a complete item, in order: the drawn sides' ends, then the open corners. */
function completeCorners(c: ShapeTracerChallenge): Point[] {
  const out: Point[] = [];
  for (const s of c.drawnSides ?? []) {
    const last = out[out.length - 1];
    if (!last || last.x !== s.from.x || last.y !== s.from.y) out.push(s.from);
    out.push(s.to);
  }
  return [...out, ...(c.remainingVertices ?? [])];
}

export function practiceItem(c: ShapeTracerChallenge): ShapeTracerChallenge | null {
  if (isPracticeShape(c)) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  switch (c.type) {
    case 'trace':
      if ((c.tracePath?.length ?? 0) <= 3) return null;
      return { id, type: 'trace', instruction: 'Trace the triangle by following the dots!', targetShape: 'triangle',
        tracePath: TRIANGLE, ...scaffolds(c) };
    case 'connect-dots':
      if ((c.dots?.length ?? 0) <= 3) return null;
      return { id, type: 'connect-dots', instruction: 'Connect the dots to find the shape!', targetShape: 'triangle',
        dots: TRIANGLE.map((p, i) => ({ ...p, label: String(i + 1) })), correctOrder: [0, 1, 2], revealShape: 'triangle',
        ...scaffolds(c) };
    case 'complete': {
      if ((c.remainingVertices?.length ?? 0) <= 1) return null;
      // Another shape, every side drawn but the last two: one corner to tap.
      const square = c.targetShape === 'triangle' || completeCorners(c).length === 3;
      const v = square ? SQUARE : TRIANGLE;
      return { id, type: 'complete', instruction: `Finish the ${square ? 'square' : 'triangle'}!`, targetShape: square ? 'square' : 'triangle',
        drawnSides: v.slice(0, -2).map((p, i) => ({ from: p, to: v[i + 1] })), remainingVertices: [v[v.length - 1]], ...scaffolds(c) };
    }
    default: {
      const r = c.requiredProperties;
      if (!r || (cluedCorners(c) <= 3 && !r.allSidesEqual)) return null;
      return { id, type: 'draw-from-description', instruction: 'Read the clue and draw the shape!', targetShape: 'triangle',
        description: 'A shape with 3 straight sides and 3 corners',
        requiredProperties: { sides: 3, corners: 3, allSidesEqual: false, hasCurvedSides: false }, ...scaffolds(c) };
    }
  }
}

/** Leak rule for a practice item: never the item itself or its corners, dots or clue, and always less to do. */
export function practiceLeaks(parent: ShapeTracerChallenge, p: ShapeTracerChallenge): boolean {
  if (p.id === parent.id || p.type !== parent.type) return true;
  switch (p.type) {
    case 'trace': return sameCorners(p.tracePath, parent.tracePath) || (p.tracePath?.length ?? 0) >= (parent.tracePath?.length ?? 0);
    case 'connect-dots': return sameCorners(p.dots, parent.dots) || (p.dots?.length ?? 0) >= (parent.dots?.length ?? 0);
    case 'complete': return sameCorners(completeCorners(p), completeCorners(parent))
      || (p.remainingVertices?.length ?? 0) >= (parent.remainingVertices?.length ?? 0);
    default: {
      const a = p.requiredProperties, b = parent.requiredProperties;
      return p.description === parent.description || !a || !b
        || (cluedCorners(p) === cluedCorners(parent) && !!a.allSidesEqual === !!b.allSidesEqual)
        || cluedCorners(p) > cluedCorners(parent) || (!!a.allSidesEqual && !b.allSidesEqual);
    }
  }
}

// ── declarations ─────────────────────────────────────────────────────────────

const DOT_MISSES: ShapeTracerMiss[] = ['started_elsewhere', 'skipped_number'];
const COUNT_MISSES: ShapeTracerMiss[] = ['too_few_sides', 'too_many_sides'];

export function shapeTracerLevers(c: ShapeTracerChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeShape(c)) return [];
  const g = tierGuides(c), levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly ShapeTracerMiss[], when: string, does: string,
    shown = false, carrier: WorkspaceLever['carrier'] = 'shown') =>
    levers.push({ id, kind, carrier, pulled: shown || pulled.includes(id), answers, when, does });

  if (c.type === 'trace' || c.type === 'complete') {
    add(OUTLINE_LEVER, 'help', [], 'The learner cannot see where the sides of the shape go.',
      c.type === 'trace' ? 'Draws the dashed outline of the whole shape through its corners, with arrows moving along it.'
        : 'Draws the dashed outline of the whole shape, through the open corners too.',
      c.type === 'trace' && g.guidePath);
    if (c.type === 'trace') add(NUMBERS_LEVER, 'help', [], 'The learner taps corners out of turn and loses the way round.',
      'Writes a number on each corner, in the order to tap them.', g.orderNumbers, 'both');
    add(GLOW_LEVER, 'help', [], 'The learner does not know which corner comes next.',
      'Puts a pulsing ring on the corner that comes next.', g.nextCue);
  }
  if (c.type === 'connect-dots') {
    add(STRIP_LEVER, 'help', DOT_MISSES, 'The learner starts at another number or skips a number.',
      'Shows the dots\' numbers in counting order in a strip above the picture, with a tick on each number already '
        + 'joined. No dot on the picture is marked.', false, 'both');
    add(FADE_LEVER, 'help', ['went_back'], 'The learner taps a dot that is already joined.',
      'Turns every joined dot into a green tick, so only the dots still to join look like dots.');
  }
  if (c.type === 'draw-from-description') {
    add(RINGS_LEVER, 'help', COUNT_MISSES, 'The learner places too few or too many corners for the clue.',
      'Shows a row of empty rings under the grid, one for each corner the clue asks for; each corner the learner places '
        + 'fills one, and a corner too many shows as a red ring after the row.');
    if (c.requiredProperties?.allSidesEqual) add(BARS_LEVER, 'help', ['sides_unequal'],
      'The clue asks for sides of one length and the learner\'s sides are not.',
      'Shows one bar for each side of the learner\'s shape, as long as that side, lined up so they can be compared.');
  }
  if (practiceItem(c)) add(SIMPLER_LEVER, 'simplify',
    c.type === 'connect-dots' ? DOT_MISSES : c.type === 'draw-from-description' ? [...COUNT_MISSES, 'sides_unequal'] : [],
    'A help lever is already on screen and the learner still cannot do this one.',
    c.type === 'complete' ? 'Opens an easier one first: another shape with one corner left to tap. Not graded; the full item comes back after it.'
      : c.type === 'draw-from-description' ? 'Opens an easier one first: a clue for a shape with three sides. Not graded; the full item comes back after it.'
        : c.type === 'connect-dots' ? 'Opens an easier one first: fewer dots to join. Not graded; the full item comes back after it.'
          : 'Opens an easier one first: a shape with fewer corners. Not graded; the full item comes back after it.');
  return levers;
}

/** What the pulled levers put on screen beyond the guides the scene already reports, for the tutor. No digit. */
export function leverFacts(c: ShapeTracerChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    c.type === 'complete' && on(OUTLINE_LEVER) && 'A dashed outline of the whole shape runs through every corner, the open ones too.',
    on(STRIP_LEVER) && 'A strip above the picture shows the dots\' numbers in counting order, with a tick on each one joined.',
    on(FADE_LEVER) && 'Every joined dot is a green tick.',
    on(RINGS_LEVER) && 'A row of rings under the grid has one ring for each corner the clue asks for; each corner placed '
      + 'fills one, and a corner too many shows as a red ring after the row.',
    on(BARS_LEVER) && 'Under the grid, one bar per side of the learner\'s shape shows how long each side is.',
  ].filter((s): s is string => !!s).join(' ');
}
