/**
 * Polygon area builder's open builds. `build_perimeter` (3.MD.D.8, at the end of this file) shares the grid, the
 * connectedness check and the turned-copy check; everything below until its section is `build_area`.
 *
 * Polygon area builder's open build (`build_area`, `/add-eval-modes` references/build-mode.md): on an EMPTY grid the
 * learner shades unit squares into ONE shape (squares joined along a side) whose area is the stated number of squares,
 * and on a two-shape item then changes it into a DIFFERENT shape with the same area. Any shape with that area passes.
 *
 * Pure: the component, the workspace scene, the generator, the oracle and the tests read the same check and levers.
 * Code judges at "I'm done!": the count of squares, that they make one connected shape, and on the second shape that it
 * is not the first one moved, turned or flipped. Levers start bare (counting the squares IS the task) and come on a miss.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';

export const BUILD_AREA = 'build_area';
/** The empty grid the learner builds on. Every area the generator asks for fits many ways. */
export const BUILD_COLS = 10;
export const BUILD_ROWS = 8;
/** The areas a build may ask for: at least 3 (two different shapes exist), at most 24 (a third of the grid). */
export const BUILD_MIN_AREA = 3;
export const BUILD_MAX_AREA = 24;

export interface Cell { c: number; r: number }
export const cellKey = (x: Cell) => `${x.c},${x.r}`;

/** The ask, written by code. The area IS the task, so stating it is not a leak. */
export function buildAreaAsk(area: number, shapes: 1 | 2): string {
  return shapes === 2
    ? `Make a shape with an area of ${area} squares. Then make a different shape with the same area.`
    : `Make a shape with an area of ${area} squares.`;
}

/** The squares as separate pieces: squares that share a side are one piece. */
export function connectedParts(cells: readonly Cell[]): Cell[][] {
  const left = new Map(cells.map(x => [cellKey(x), x]));
  const parts: Cell[][] = [];
  for (const start of cells) {
    if (!left.has(cellKey(start))) continue;
    const part: Cell[] = [];
    const queue = [start];
    left.delete(cellKey(start));
    while (queue.length) {
      const x = queue.shift()!;
      part.push(x);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x.c + dc},${x.r + dr}`;
        const next = left.get(k);
        if (next) { left.delete(k); queue.push(next); }
      }
    }
    parts.push(part);
  }
  return parts;
}

/** The eight ways to turn and flip a shape on the grid. */
const TURNS: ReadonlyArray<(x: Cell) => Cell> = [
  x => ({ c: x.c, r: x.r }), x => ({ c: -x.r, r: x.c }), x => ({ c: -x.c, r: -x.r }), x => ({ c: x.r, r: -x.c }),
  x => ({ c: -x.c, r: x.r }), x => ({ c: x.r, r: x.c }), x => ({ c: x.c, r: -x.r }), x => ({ c: -x.r, r: -x.c }),
];

/** The shape moved to the top-left corner, in reading order. */
function placed(cells: readonly Cell[]): Cell[] {
  const minC = Math.min(...cells.map(x => x.c)), minR = Math.min(...cells.map(x => x.r));
  return cells.map(x => ({ c: x.c - minC, r: x.r - minR })).sort((a, b) => a.r - b.r || a.c - b.c);
}
const keyOf = (cells: readonly Cell[]) => placed(cells).map(cellKey).join(';');

/** The first shape turned and flipped to line up with `now`, or null when no turn or flip makes them the same. */
export function turnedToMatch(first: readonly Cell[], now: readonly Cell[]): Cell[] | null {
  if (!first.length || first.length !== now.length) return null;
  const target = keyOf(now);
  for (const turn of TURNS) {
    const turned = first.map(turn);
    if (keyOf(turned) === target) return placed(turned);
  }
  return null;
}

/** The same shape: one is the other moved, turned or flipped. */
export const sameShape = (a: readonly Cell[], b: readonly Cell[]) => turnedToMatch(a, b) !== null;

/** A shape's size on the grid, in words: what is drawn, never its area. */
export function shapeSize(cells: readonly Cell[]): string {
  if (!cells.length) return 'no squares';
  const rows = new Set(cells.map(x => x.r)).size, cols = new Set(cells.map(x => x.c)).size;
  return `${rows} row${rows === 1 ? '' : 's'} tall and ${cols} column${cols === 1 ? '' : 's'} wide`;
}

/**
 * What a build that does not pass shows, in precedence order: the count (`one_short`, `one_over`, `short_by_more`,
 * `over_by_more`), then `not_connected` (the squares make more than one piece), then on the second shape
 * `same_as_first` (the first shape again, moved, turned or flipped). Undefined when the build passes.
 */
export type BuildAreaMiss = 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'not_connected' | 'same_as_first';
export const BUILD_AREA_MISSES: readonly BuildAreaMiss[] =
  ['one_short', 'one_over', 'short_by_more', 'over_by_more', 'not_connected', 'same_as_first'];

export function buildAreaMiss(area: number, cells: readonly Cell[], first: readonly Cell[] | null): BuildAreaMiss | undefined {
  const n = cells.length;
  if (n !== area) return n === area - 1 ? 'one_short' : n === area + 1 ? 'one_over' : n < area ? 'short_by_more' : 'over_by_more';
  if (connectedParts(cells).length > 1) return 'not_connected';
  if (first && sameShape(first, cells)) return 'same_as_first';
  return undefined;
}

/** The learner's work in words, as the tutor hears the check: what is shaded, never the area asked for. */
export function describeBuild(cells: readonly Cell[], first: readonly Cell[] | null): string {
  const parts = connectedParts(cells).length;
  const now = cells.length
    ? `${cells.length} square${cells.length === 1 ? '' : 's'} shaded, in ${parts} separate piece${parts === 1 ? '' : 's'}`
    : 'No squares shaded yet';
  return first ? `Second shape: ${now} (the first shape was ${shapeSize(first)})` : now;
}

/** The check's words under the grid: what the learner's own build shows, never how many to add or take away. */
export function buildAreaVerdict(area: number, miss: BuildAreaMiss | undefined, cells: readonly Cell[], second: boolean): string {
  if (!miss) return second ? `Two different shapes, each with an area of ${area} squares!` : `Yes! Your shape has an area of ${area} squares.`;
  if (miss === 'not_connected') return `Not yet. Your squares make ${connectedParts(cells).length} separate pieces. `
    + 'Make one shape: every square touches another along a side.';
  if (miss === 'same_as_first') return 'That is your first shape again, just moved, turned or flipped. Make a different shape.';
  return 'Not yet. Count the squares in your shape, then fix it.';
}

// ── Levers ────────────────────────────────────────────────────────────────────

export const NUMBERS_LEVER = 'square_numbers';
export const PIECES_LEVER = 'piece_colors';
export const TURNED_LEVER = 'turned_first';
export const SMALLER_LEVER = 'smaller_area';
const SMALLER = '~smaller';

export const isBuildArea = (c: Pick<PolygonAreaChallenge, 'type'> | null) => c?.type === BUILD_AREA;
export const isPracticeBuild = (c: Pick<PolygonAreaChallenge, 'id'> | null) => !!c?.id.endsWith(SMALLER);

/** The easier build for `smaller_area`: about half the area, one shape, on an empty grid. Never the item's own area. */
export function smallerArea(c: PolygonAreaChallenge): PolygonAreaChallenge | null {
  const area = c.targetArea ?? 0;
  if (!isBuildArea(c) || isPracticeBuild(c) || area < BUILD_MIN_AREA * 2) return null;
  const half = Math.max(BUILD_MIN_AREA, Math.floor(area / 2));
  return { ...c, id: `${c.id}${SMALLER}`, targetArea: half, expectedArea: half, shapesAsked: 1,
    instruction: buildAreaAsk(half, 1) };
}

export function buildAreaLevers(c: PolygonAreaChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || !isBuildArea(c) || isPracticeBuild(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: BuildAreaMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const easier = smallerArea(c);
  return [
    lever(NUMBERS_LEVER, 'help', 'both', ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      'The learner shades one square too many or too few, or loses count of the squares in the shape.',
      'Numbers each square the learner has shaded, 1, 2, 3..., in the order they shaded them, so they can count the '
        + 'squares in their shape. It never shows the area asked for.'),
    lever(PIECES_LEVER, 'help', 'shown', ['not_connected'],
      "The learner's squares make more than one separate piece.",
      "Tints each separate piece of the learner's squares a different colour, so they can see which squares do not touch "
        + 'the rest along a side.'),
    ...(c.shapesAsked === 2 ? [lever(TURNED_LEVER, 'help', 'shown', ['same_as_first'],
      'The learner makes the first shape again, turned or flipped, and thinks it is a new shape.',
      "Draws the learner's first shape beside the grid turned and flipped to line up with the shape on the grid when the "
        + 'two are the same shape, so the learner can see they match.')] : []),
    ...(easier || pulled.includes(SMALLER_LEVER) ? [lever(SMALLER_LEVER, 'simplify', 'shown',
      ['short_by_more', 'over_by_more', 'not_connected'],
      'The learner cannot keep track of this many squares yet.',
      `Opens an easier shape to make first, with an area of ${easier?.targetArea ?? 'fewer'} squares, on an empty grid. `
        + 'It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What each pulled lever put on screen, in terms of what is drawn. */
export function buildLeverFacts(c: PolygonAreaChallenge, pulled: readonly string[]): string {
  const said: string[] = [];
  if (pulled.includes(NUMBERS_LEVER)) said.push("each shaded square carries a number, in the order the learner shaded it");
  if (pulled.includes(PIECES_LEVER)) said.push('each separate piece of shaded squares is tinted its own colour');
  if (c.shapesAsked === 2 && pulled.includes(TURNED_LEVER)) {
    said.push("the learner's first shape is drawn beside the grid, turned to line up with the grid's shape when they match");
  }
  return said.length ? `On the grid: ${said.join('; ')}.` : '';
}

/** The build's scene facts: the made quantities as NUMBERS (the shared work history reads them), never the target beside them. */
export function buildAreaFacts(c: PolygonAreaChallenge, cells: readonly Cell[], first: readonly Cell[] | null,
  practice: boolean): Record<string, string | number> {
  const facts: Record<string, string | number> = {
    kind: BUILD_AREA,
    squaresPlaced: cells.length,
    separatePieces: connectedParts(cells).length,
    grid: `an empty grid of ${BUILD_COLS} by ${BUILD_ROWS} squares; each square is one square unit`,
    learnerWork: describeBuild(cells, first),
  };
  if (c.shapesAsked === 2) {
    facts.shape = first ? 'second' : 'first';
    if (first) facts.firstShape = `checked right and drawn beside the grid: ${shapeSize(first)}`;
  }
  if (practice) facts.practice = 'An easier shape to make is on screen in place of the item. It is not graded; the full item comes back after it.';
  facts.constraints = first
    ? "The first shape was checked right. The learner changes the squares on the grid into a different shape with the same "
      + "area, then presses I'm done. The grid checks the count, that the squares make one shape, and that it is not the "
      + 'first shape moved, turned or flipped.'
    : "The learner taps squares on an empty grid to shade them (tap again to clear one) and presses I'm done. The grid "
      + 'checks the count and that the squares make one shape joined along sides. The grid prints no count.';
  return facts;
}

// ── Perimeter build (`build_perimeter`, 3.MD.D.8) ─────────────────────────────
// A second open build on the same grid, for a different skill: the learner shades squares into ONE shape whose
// perimeter (the unit sides around its outside) is the stated number of units, and on a two-shape item then changes it
// into a DIFFERENT shape with the same perimeter. Any shape with that perimeter passes (3 by 3, 2 by 4, an L, ...).
// A fork of `build_area`, never an edit of it: its own kind, misses, levers and facts; the grid, `connectedParts` and
// `sameShape` are shared.

export const BUILD_PERIMETER = 'build_perimeter';
/** The perimeters a build may ask for: even (every shape of squares has an even perimeter), at least 8 (the smallest
 *  perimeter with two different shapes: a strip of three and an L of three), at most 24 (fits the grid many ways). */
export const BUILD_MIN_PERIMETER = 8;
export const BUILD_MAX_PERIMETER = 24;

type Side = 'right' | 'left' | 'bottom' | 'top';
const SIDES: ReadonlyArray<readonly [number, number, Side]> = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'bottom'], [0, -1, 'top']];

/** Every unit side of a shaded square that no other shaded square covers: the sides around the shape. */
export function outsideSides(cells: readonly Cell[]): Array<Cell & { side: Side }> {
  const on = new Set(cells.map(cellKey));
  return cells.flatMap(x => SIDES.filter(([dc, dr]) => !on.has(`${x.c + dc},${x.r + dr}`)).map(([, , side]) => ({ c: x.c, r: x.r, side })));
}

/** The perimeter of the shaded squares, in units: the count of their uncovered sides. */
export const perimeterOf = (cells: readonly Cell[]) => outsideSides(cells).length;

/** How many holes the shaded squares close in: empty regions the outside cannot reach through a side. */
export function holesIn(cells: readonly Cell[]): number {
  if (!cells.length) return 0;
  const on = new Set(cells.map(cellKey));
  const minC = Math.min(...cells.map(x => x.c)) - 1, maxC = Math.max(...cells.map(x => x.c)) + 1;
  const minR = Math.min(...cells.map(x => x.r)) - 1, maxR = Math.max(...cells.map(x => x.r)) + 1;
  const seen = new Set<string>();
  const fill = (c: number, r: number) => {
    const queue: Array<[number, number]> = [[c, r]];
    seen.add(`${c},${r}`);
    while (queue.length) {
      const [qc, qr] = queue.shift()!;
      for (const [dc, dr] of SIDES) {
        const nc = qc + dc, nr = qr + dr, k = `${nc},${nr}`;
        if (nc < minC || nc > maxC || nr < minR || nr > maxR || on.has(k) || seen.has(k)) continue;
        seen.add(k); queue.push([nc, nr]);
      }
    }
  };
  fill(minC, minR);
  let holes = 0;
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) {
    if (!on.has(`${c},${r}`) && !seen.has(`${c},${r}`)) { holes++; fill(c, r); }
  }
  return holes;
}

/** The ask, written by code. The perimeter IS the task, so stating it is not a leak. */
export function buildPerimeterAsk(perimeter: number, shapes: 1 | 2): string {
  return shapes === 2
    ? `Make a shape with a perimeter of ${perimeter} units. Then make a different shape with the same perimeter.`
    : `Make a shape with a perimeter of ${perimeter} units.`;
}

/**
 * What a perimeter build that does not pass shows, in precedence order: `not_connected` (more than one piece: a
 * perimeter goes around ONE shape), `has_hole` (its perimeter would include the sides around the hole), then on the
 * right perimeter `same_as_first` (the first shape again, moved, turned or flipped); on a wrong perimeter
 * `counted_squares` when the squares number the target (the area made instead of the perimeter), else the count
 * misses (`two_short`, `two_over`: one step, since a shape of squares always has an even perimeter; `short_by_more`,
 * `over_by_more`). Undefined when the build passes.
 */
export type BuildPerimeterMiss = 'two_short' | 'two_over' | 'short_by_more' | 'over_by_more' | 'counted_squares'
  | 'not_connected' | 'has_hole' | 'same_as_first';
export const BUILD_PERIMETER_MISSES: readonly BuildPerimeterMiss[] =
  ['two_short', 'two_over', 'short_by_more', 'over_by_more', 'counted_squares', 'not_connected', 'has_hole', 'same_as_first'];

export function buildPerimeterMiss(target: number, cells: readonly Cell[], first: readonly Cell[] | null): BuildPerimeterMiss | undefined {
  if (connectedParts(cells).length > 1) return 'not_connected';
  if (holesIn(cells) > 0) return 'has_hole';
  const p = perimeterOf(cells);
  if (p === target) return first && sameShape(first, cells) ? 'same_as_first' : undefined;
  if (cells.length === target) return 'counted_squares';
  return p === target - 2 ? 'two_short' : p === target + 2 ? 'two_over' : p < target ? 'short_by_more' : 'over_by_more';
}

/** The learner's perimeter work in words, as the tutor hears the check: what is shaded and the sides around it. */
export function describePerimeterBuild(cells: readonly Cell[], first: readonly Cell[] | null): string {
  const parts = connectedParts(cells).length, holes = holesIn(cells), sides = perimeterOf(cells);
  const now = cells.length
    ? `${cells.length} square${cells.length === 1 ? '' : 's'} shaded, in ${parts} separate piece${parts === 1 ? '' : 's'}`
      + `${holes ? `, closing in ${holes} hole${holes === 1 ? '' : 's'}` : ''}, with ${sides} unit sides around the outside`
    : 'No squares shaded yet';
  return first ? `Second shape: ${now} (the first shape was ${shapeSize(first)})` : now;
}

/** The check's words under the grid: what the learner's own build shows, never how many sides to add or take away. */
export function buildPerimeterVerdict(target: number, miss: BuildPerimeterMiss | undefined, cells: readonly Cell[],
  second: boolean): string {
  if (!miss) return second ? `Two different shapes, each with a perimeter of ${target} units!`
    : `Yes! Your shape has a perimeter of ${target} units.`;
  switch (miss) {
    case 'not_connected': return `Not yet. Your squares make ${connectedParts(cells).length} separate pieces. `
      + 'Make one shape: every square touches another along a side.';
    case 'has_hole': return 'Not yet. Your shape has a hole in it. Make a shape with no holes, so its perimeter is only '
      + 'the way around the outside.';
    case 'same_as_first': return 'That is your first shape again, just moved, turned or flipped. Make a different shape '
      + 'with the same perimeter.';
    case 'counted_squares': return 'Not yet. Perimeter is the distance around the outside of the shape, not the squares '
      + 'inside it. Count the sides along the edge.';
    default: return 'Not yet. Walk around the outside of your shape and count the unit sides, then fix it.';
  }
}

export const EDGES_LEVER = 'edge_marks';
export const SMALLER_PERIMETER_LEVER = 'smaller_perimeter';

export const isBuildPerimeter = (c: Pick<PolygonAreaChallenge, 'type'> | null) => c?.type === BUILD_PERIMETER;
/** Either open build on the grid: the learner shades squares and presses I'm done. */
export const isGridBuild = (c: Pick<PolygonAreaChallenge, 'type'> | null) => isBuildArea(c) || isBuildPerimeter(c);

/** The easier build for `smaller_perimeter`: about half the perimeter (even, at least 6), one shape, on an empty grid. */
export function smallerPerimeter(c: PolygonAreaChallenge): PolygonAreaChallenge | null {
  const p = c.targetPerimeter ?? 0;
  if (!isBuildPerimeter(c) || isPracticeBuild(c) || p < 12) return null;
  const half = Math.max(6, Math.floor(p / 4) * 2);
  return { ...c, id: `${c.id}${SMALLER}`, targetPerimeter: half, expectedArea: half, shapesAsked: 1,
    instruction: buildPerimeterAsk(half, 1) };
}

export function buildPerimeterLevers(c: PolygonAreaChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || !isBuildPerimeter(c) || isPracticeBuild(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: BuildPerimeterMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const easier = smallerPerimeter(c);
  return [
    lever(EDGES_LEVER, 'help', 'shown', ['two_short', 'two_over', 'short_by_more', 'over_by_more', 'counted_squares', 'has_hole'],
      'The learner counts the squares instead of the sides around them, skips or double-counts a side at a corner, or '
        + 'misses the sides around a hole.',
      'Puts a dot on every side of a shaded square that is on the edge of the shape, the sides around a hole included, '
        + 'so the learner can count the sides that make the perimeter. No numbers; it never shows the perimeter asked for.'),
    lever(PIECES_LEVER, 'help', 'shown', ['not_connected'],
      "The learner's squares make more than one separate piece.",
      "Tints each separate piece of the learner's squares a different colour, so they can see which squares do not touch "
        + 'the rest along a side.'),
    ...(c.shapesAsked === 2 ? [lever(TURNED_LEVER, 'help', 'shown', ['same_as_first'],
      'The learner makes the first shape again, turned or flipped, and thinks it is a new shape.',
      "Draws the learner's first shape beside the grid turned and flipped to line up with the shape on the grid when the "
        + 'two are the same shape, so the learner can see they match.')] : []),
    ...(easier || pulled.includes(SMALLER_PERIMETER_LEVER) ? [lever(SMALLER_PERIMETER_LEVER, 'simplify', 'shown',
      ['short_by_more', 'over_by_more', 'counted_squares'],
      'The learner cannot keep track of this many sides around a shape yet.',
      `Opens an easier shape to make first, with a perimeter of ${easier?.targetPerimeter ?? 'fewer'} units, on an empty `
        + 'grid. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What each pulled perimeter lever put on screen, in terms of what is drawn. */
export function buildPerimeterLeverFacts(c: PolygonAreaChallenge, pulled: readonly string[]): string {
  const said: string[] = [];
  if (pulled.includes(EDGES_LEVER)) said.push('a dot sits on every side of a shaded square on the edge of the shape');
  if (pulled.includes(PIECES_LEVER)) said.push('each separate piece of shaded squares is tinted its own colour');
  if (c.shapesAsked === 2 && pulled.includes(TURNED_LEVER)) {
    said.push("the learner's first shape is drawn beside the grid, turned to line up with the grid's shape when they match");
  }
  return said.length ? `On the grid: ${said.join('; ')}.` : '';
}

/** The perimeter build's scene facts: the made perimeter as a NUMBER (the shared work history reads it), never the target. */
export function buildPerimeterFacts(c: PolygonAreaChallenge, cells: readonly Cell[], first: readonly Cell[] | null,
  practice: boolean): Record<string, string | number> {
  const facts: Record<string, string | number> = {
    kind: BUILD_PERIMETER,
    sidesAround: perimeterOf(cells),
    squaresPlaced: cells.length,
    separatePieces: connectedParts(cells).length,
    holes: holesIn(cells),
    grid: `an empty grid of ${BUILD_COLS} by ${BUILD_ROWS} squares; each side of a square is one unit long`,
    learnerWork: describePerimeterBuild(cells, first),
  };
  if (c.shapesAsked === 2) {
    facts.shape = first ? 'second' : 'first';
    if (first) facts.firstShape = `checked right and drawn beside the grid: ${shapeSize(first)}`;
  }
  if (practice) facts.practice = 'An easier shape to make is on screen in place of the item. It is not graded; the full item comes back after it.';
  facts.constraints = first
    ? "The first shape was checked right. The learner changes the squares on the grid into a different shape with the same "
      + "perimeter, then presses I'm done. The grid checks the sides around the outside, that the squares make one shape "
      + 'with no hole, and that it is not the first shape moved, turned or flipped.'
    : "The learner taps squares on an empty grid to shade them (tap again to clear one) and presses I'm done. The grid "
      + 'counts the unit sides around the outside of the shape and checks the squares make one shape with no hole. '
      + 'The grid prints no count.';
  return facts;
}
