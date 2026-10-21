/**
 * shape-tracer's in-item levers (/add-support-tiers; report qa/eval-reports/shape-tracer-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `shapeTracerMiss` observes (journey scripted wrongs) and the catalog's
 * commonStruggles. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * The generator's tier guides (outline, numbers, next-dot glow) stay the starting positions: a guide the tier already
 * shows is declared pulled. Every other lever starts released.
 *
 * Declared once as a lever set (`SHAPE_TRACER_LEVERS`, `bossLevers.ts`); its context is the learner's work on the
 * item (`ShapeWork`), because the side bars draw nothing until there is a side to show.
 *
 * - `dotted_outline` (marks; trace, complete): the dashed outline of the whole shape through its corners (on trace with
 *   the moving arrows). The corners are on screen and the shape is named, so the outline is the path, not a secret.
 * - `order_numbers` (marks; trace): the corner numbers 1, 2, 3 ...
 * - `next_glow` (marks; trace, complete): the pulsing ring on the corner that comes next. Leak rule (`glowOffered`):
 *   never on connect-dots, where which dot comes next IS the answer.
 * - `number_strip` (legend; connect_dots): a strip of the dots' numbers in counting order above the canvas, ticking the
 *   ones joined. It marks no dot on the canvas: the learner still finds the next number among the dots.
 * - `fade_joined` (marks; connect_dots): joined dots turn into green ticks, so they stop looking like dots to tap.
 *   Offered from the start: its miss (`went_back`) needs a joined dot, so the tutor pulls it with one on screen, and
 *   pulled earlier it turns each dot into a tick as it is joined.
 * - `corner_rings` (marks; draw_from_description): a row of empty rings, one per corner the clue asks for, filling one
 *   per corner the learner places; a corner past the clue's count shows as a red ring after the row. The count is the
 *   clue's (on screen as words); the rings show the learner's own count against it, as pictures for a pre-reader.
 * - `side_bars` (layout; draw_from_description when the clue asks for equal sides): one bar per side of the learner's own
 *   shape, as long as the side, lined up from the left. Leak rule (`sideBars`): drawn from the learner's corners only;
 *   it never marks a grid dot or says which side to change. Offered once two corners are placed.
 * - `simpler_item` (easier): an ungraded item of the same mode, built here, then the full item back. trace and
 *   connect_dots: a triangle (none on a three-corner item); complete: a shape with one open corner (none when only one
 *   is open); draw_from_description: a three-sided clue with no equal sides (none when that is the clue). Leak rule
 *   (`practiceLeaks`): never the item's own corners, dots or clue, and always fewer to do.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ShapeTracerChallenge } from './ShapeTracer';
import { DOT_MISSES, DRAW_MISSES } from './shapeTracer.card';
import { tierGuides, type Point, type TracerGuides } from './shapeTracerWorkspace';

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

// ── the lever set ────────────────────────────────────────────────────────────

/** The learner's work on the session item, which decides whether a lever would change anything yet. */
export interface ShapeWork { placed: number }

/** The eval mode of an item (`connect-dots` → `connect_dots`). */
export const shapeModeOf = (c: ShapeTracerChallenge) => c.type.replace(/-/g, '_');

/** Where an item's guide levers start (its tier's guides), as lever ids. Not a pull: never recorded. */
export function startingLevers(c: ShapeTracerChallenge): string[] {
  const g = tierGuides(c);
  if (c.type === 'trace') return [...(g.guidePath ? [OUTLINE_LEVER] : []), ...(g.orderNumbers ? [NUMBERS_LEVER] : []),
    ...(g.nextCue ? [GLOW_LEVER] : [])];
  return c.type === 'complete' && g.nextCue ? [GLOW_LEVER] : [];
}

const WHEN_SIMPLER = 'A help lever is already on screen and the learner still cannot do this one.';
const PRACTICE_THEN = 'Not graded; the full item comes back after it.';

/** The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing then. */
export const SHAPE_TRACER_LEVERS = leverSet<ShapeTracerChallenge, ShapeWork>({
  modeOf: shapeModeOf,
  missesOf: mode => (mode === 'connect_dots' ? DOT_MISSES : mode === 'draw_from_description' ? DRAW_MISSES : []),
  specs: [
    { id: OUTLINE_LEVER, type: 'marks', modes: ['trace', 'complete'], answers: [],
      when: 'The learner cannot see where the sides of the shape go.',
      does: c => (c.type === 'trace' ? 'Draws the dashed outline of the whole shape through its corners, with arrows moving along it.'
        : 'Draws the dashed outline of the whole shape, through the open corners too.'),
      // On a trace the scene reports the outline itself (`dottedOutline`).
      fact: (_content, c) => (c.type === 'complete' ? 'A dashed outline of the whole shape runs through every corner, the open ones too.' : '') },
    { id: NUMBERS_LEVER, type: 'marks', modes: ['trace'], carrier: 'both', answers: [],
      when: 'The learner taps corners out of turn and loses the way round.',
      does: 'Writes a number on each corner, in the order to tap them.' },
    // Leak rule (`glowOffered`): never on connect-dots, where the next dot is the answer.
    { id: GLOW_LEVER, type: 'marks', modes: ['trace', 'complete'], answers: [],
      when: 'The learner does not know which corner comes next.',
      does: 'Puts a pulsing ring on the corner that comes next.' },
    { id: STRIP_LEVER, type: 'legend', modes: ['connect_dots'], carrier: 'both', answers: ['started_elsewhere', 'skipped_number'],
      when: 'The learner starts at another number or skips a number.',
      does: 'Shows the dots\' numbers in counting order in a strip above the picture, with a tick on each number already '
        + 'joined. No dot on the picture is marked.',
      fact: 'A strip above the picture shows the dots\' numbers in counting order, with a tick on each one joined.' },
    { id: FADE_LEVER, type: 'marks', modes: ['connect_dots'], answers: ['went_back'],
      when: 'The learner taps a dot that is already joined.',
      does: 'Turns every joined dot into a green tick, so only the dots still to join look like dots.',
      fact: 'Every joined dot is a green tick.' },
    { id: RINGS_LEVER, type: 'marks', modes: ['draw_from_description'], answers: ['too_few_sides', 'too_many_sides'],
      when: 'The learner places too few or too many corners for the clue.',
      does: 'Shows a row of empty rings under the grid, one for each corner the clue asks for; each corner the learner places '
        + 'fills one, and a corner too many shows as a red ring after the row.',
      fact: 'A row of rings under the grid has one ring for each corner the clue asks for; each corner placed '
        + 'fills one, and a corner too many shows as a red ring after the row.' },
    { id: BARS_LEVER, type: 'layout', modes: ['draw_from_description'], answers: ['sides_unequal'],
      when: 'The clue asks for sides of one length and the learner\'s sides are not.',
      does: 'Shows one bar for each side of the learner\'s shape, as long as that side, lined up so they can be compared.',
      content: c => (c.requiredProperties?.allSidesEqual ? true : null),
      offer: (_c, work) => work.placed >= 2,
      fact: 'Under the grid, one bar per side of the learner\'s shape shows how long each side is.' },
    { id: SIMPLER_LEVER, type: 'easier', modes: ['trace'], answers: [], when: WHEN_SIMPLER,
      does: `Opens an easier one first: a shape with fewer corners. ${PRACTICE_THEN}`,
      content: c => practiceItem(c) },
    { id: SIMPLER_LEVER, type: 'easier', modes: ['complete'], answers: [], when: WHEN_SIMPLER,
      does: `Opens an easier one first: another shape with one corner left to tap. ${PRACTICE_THEN}`,
      content: c => practiceItem(c) },
    { id: SIMPLER_LEVER, type: 'easier', modes: ['connect_dots'], answers: ['started_elsewhere', 'skipped_number'], when: WHEN_SIMPLER,
      does: `Opens an easier one first: fewer dots to join. ${PRACTICE_THEN}`,
      content: c => practiceItem(c) },
    { id: SIMPLER_LEVER, type: 'easier', modes: ['draw_from_description'], answers: DRAW_MISSES, when: WHEN_SIMPLER,
      does: `Opens an easier one first: a clue for a shape with three sides. ${PRACTICE_THEN}`,
      content: c => practiceItem(c) },
  ],
});
