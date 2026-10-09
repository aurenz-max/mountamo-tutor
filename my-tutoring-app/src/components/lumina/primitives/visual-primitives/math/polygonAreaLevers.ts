/**
 * Levers for polygon area builder's typed-area modes (`/add-support-tiers`).
 *
 * Pure: the component, the scene, the journey row and the tests read the same declarations, leak rule and builders.
 * The misses come from `areaMiss` (polygonAreaWorkspace.ts).
 * - find_area_triangle_parallelogram: `unit_grid`, `half_of_rectangle` (triangle), `slide_corner` (parallelogram),
 *   `smaller_figure`.
 * - decompose: `show_slot` (the dashed slot the cut triangle fits, when the tier hid it), `unit_grid`, `smaller_figure`
 *   (a smaller parallelogram leaning one square, slot and grid drawn).
 * - find_area_trapezoid: `unit_grid`, `cut_lines` (dashed lines down from the top corners), `turned_copy` (a copy turned
 *   upside down against the right side, the parallelogram they make outlined), `smaller_figure` (a smaller right
 *   trapezoid on the grid).
 * - composite_area: `split_pieces` (the rectangle pieces drawn, when the tier showed one outline), `left_out_piece` (the
 *   piece(s) the learner's last area left out, outlined bold), `square_rows` (every other row of squares tinted),
 *   `smaller_figure` (a smaller two-piece L, pieces drawn).
 * - coordinate_polygon: `outside_box` (the rectangle through the outermost corners, the part outside the polygon
 *   tinted), `square_rows` (rectilinear polygons), `rectangle_first` (a rectangle on the grid, for a triangle or an L).
 * No lever prints a number: every drawn label is one of the figure's own givens.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';
import type { AreaMiss } from './polygonAreaWorkspace';

type Pt = { x: number; y: number };

export const FIND_AREA = 'find_area_triangle_parallelogram';
export const GRID_LEVER = 'unit_grid';
export const HALF_LEVER = 'half_of_rectangle';
export const SLIDE_LEVER = 'slide_corner';
export const SMALLER_FIGURE_LEVER = 'smaller_figure';
export const SLOT_LEVER = 'show_slot';
export const CUT_LEVER = 'cut_lines';
export const TURNED_COPY_LEVER = 'turned_copy';
export const SPLIT_LEVER = 'split_pieces';
export const LEFT_OUT_LEVER = 'left_out_piece';
export const ROWS_LEVER = 'square_rows';
export const OUTSIDE_LEVER = 'outside_box';
export const RECTANGLE_FIRST_LEVER = 'rectangle_first';
/** The simplify levers: each puts a `~smaller` practice item built by `smallerFigure` in place of the item. */
export const SIMPLER_FIGURE_LEVERS: readonly string[] = [SMALLER_FIGURE_LEVER, RECTANGLE_FIRST_LEVER];
/** The same suffix the open build's easier item uses, so the journey row finds either practice item one way. */
const SMALLER = '~smaller';

const isFindArea = (c: PolygonAreaChallenge) =>
  c.type === FIND_AREA && (c.figureType === 'triangle' || c.figureType === 'parallelogram');
const isPractice = (c: PolygonAreaChallenge) => c.id.endsWith(SMALLER);
const TYPED_MODES = [FIND_AREA, 'decompose', 'find_area_trapezoid', 'composite_area', 'coordinate_polygon'];
const isTyped = (c: PolygonAreaChallenge | null): c is PolygonAreaChallenge => !!c && TYPED_MODES.includes(c.type)
  && (c.type !== FIND_AREA || isFindArea(c));

/** The rectangle through a polygon's outermost corners. */
function box(vs: readonly Pt[]) {
  const xs = vs.map(v => v.x), ys = vs.map(v => v.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/**
 * The numbers a lever must never print or say for this item: its area, and each intermediate product that is one
 * multiplication from it (base × height, (b1 + b2) × height, a composite piece's area, a coordinate polygon's bounding
 * rectangle). The drawn givens (base, height, piece sides, coordinates) are allowed.
 */
export function figureLeverLeaks(c: PolygonAreaChallenge, text: string): boolean {
  const b = c.base ?? 0, h = c.height ?? 0, b2 = c.base2 ?? 0;
  const banned = [c.expectedArea, b * h, (b * h) / 2, (b + b2) * h, ...(c.parts ?? []).map(p => p.w * p.h)];
  const givens = [b, h, b2, ...(c.parts ?? []).flatMap(p => [p.w, p.h])];
  if ((c.vertices ?? []).length) {
    const r = box(c.vertices!);
    banned.push((r.maxX - r.minX) * (r.maxY - r.minY));
    givens.push(...c.vertices!.flatMap(v => [v.x, v.y]));
  }
  const set = new Set(banned.filter(n => n > 0 && !givens.includes(n)));
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).some(n => set.has(Number(n)));
}

// ---------------------------------------------------------------------------
// Simpler items (simplify levers). Each keeps the mode, recomputes its answer, never repeats the item or its area.
// ---------------------------------------------------------------------------

/** Small whole-number figures for the simpler item, smallest first. Each product is even (½·b·h stays whole). */
const SMALL_DIMS: ReadonlyArray<[number, number]> = [[4, 2], [2, 4], [4, 3], [3, 4], [6, 2], [2, 6], [5, 2], [4, 4], [6, 3]];
/** Small right trapezoids [bottom, top, height]; (b1 + b2) × h is even. */
const SMALL_TRAPS: ReadonlyArray<[number, number, number]> =
  [[3, 1, 2], [4, 2, 2], [3, 1, 3], [5, 1, 2], [5, 3, 2], [6, 2, 2], [4, 2, 3], [5, 3, 3]];
/** Small two-piece L shapes [bottom width, bottom height, top width, top height]. */
const SMALL_LS: ReadonlyArray<[number, number, number, number]> =
  [[3, 1, 1, 2], [3, 2, 1, 1], [4, 1, 2, 2], [3, 1, 2, 2], [5, 1, 2, 2], [4, 2, 1, 2], [4, 2, 2, 2]];
/** Small rectangles [width, height] for the coordinate simplify. */
const SMALL_RECTS: ReadonlyArray<[number, number]> = [[3, 2], [2, 3], [4, 2], [3, 3], [2, 4], [4, 3], [5, 2]];

const rotate = <T,>(list: ReadonlyArray<T>, by: number): T[] => {
  const s = ((by % list.length) + list.length) % list.length;
  return [...list.slice(s), ...list.slice(0, s)];
};

/**
 * The simpler item for this mode's simplify lever, or null when there is nothing simpler (or the item is already a
 * practice item). find_area / decompose: the same figure smaller (a triangle with its height along a side, a
 * parallelogram leaning one square); trapezoid: a smaller right trapezoid; composite: a smaller two-piece L with its
 * pieces drawn; coordinate: a rectangle (a triangle or an L only; a rectangle is already the plainest polygon).
 */
export function smallerFigure(c: PolygonAreaChallenge): PolygonAreaChallenge | null {
  if (!isTyped(c) || isPractice(c)) return null;
  const id = `${c.id}${SMALLER}`;
  const b = c.base ?? 0, h = c.height ?? 0;
  if (c.type === FIND_AREA || c.type === 'decompose') {
    const triangle = c.figureType === 'triangle';
    const area = (x: number, y: number) => triangle ? (x * y) / 2 : x * y;
    const fit = rotate(SMALL_DIMS, b + h).find(([x, y]) => x * y < b * h && !(x === b && y === h)
      && area(x, y) !== c.expectedArea && (!triangle || (x * y) % 2 === 0));
    if (!fit) return null;
    const [base, height] = fit;
    return {
      ...c, id, base, height,
      ...(triangle ? { apexX: 0 } : { skew: 1 }),
      expectedArea: area(base, height),
      showGridOverlay: true,
      showDecompositionGuides: c.type === 'decompose',
      showRegionAreaLabel: false,
      narration: `A smaller ${c.figureType} to try first.`,
    };
  }
  if (c.type === 'find_area_trapezoid') {
    const b2 = c.base2 ?? 0;
    const fit = rotate(SMALL_TRAPS, b + b2 + h).find(([x, y, z]) => (x + y) * z < (b + b2) * h
      && ((x + y) * z) / 2 !== c.expectedArea && !(x === b && y === b2 && z === h));
    if (!fit) return null;
    const [base, base2, height] = fit;
    return {
      ...c, id, base, base2, height, topOffset: 0,
      expectedArea: ((base + base2) * height) / 2,
      showGridOverlay: true, showDecompositionGuides: false, showRegionAreaLabel: false,
      narration: 'A smaller trapezoid to try first.',
    };
  }
  if (c.type === 'composite_area') {
    const fit = rotate(SMALL_LS, c.expectedArea).find(([W, h1, w2, h2]) => W * h1 + w2 * h2 < c.expectedArea);
    if (!fit) return null;
    const [W, h1, w2, h2] = fit;
    return {
      ...c, id, parts: [{ x: 0, y: 0, w: W, h: h1 }, { x: 0, y: h1, w: w2, h: h2 }],
      expectedArea: W * h1 + w2 * h2,
      showDecompositionGuides: true, showRegionAreaLabel: false,
      narration: 'A smaller figure made of two rectangles to try first.',
    };
  }
  // coordinate_polygon
  const vs = c.vertices ?? [];
  if (vs.length < 3 || vs.length === 4) return null;
  const r = box(vs);
  const boxArea = (r.maxX - r.minX) * (r.maxY - r.minY);
  const fit = rotate(SMALL_RECTS, vs.length + r.maxX).find(([w, hh]) => w * hh !== c.expectedArea && w * hh !== boxArea);
  if (!fit) return null;
  const [w, hh] = fit;
  return {
    ...c, id, vertices: rect(1, 1, 1 + w, 1 + hh),
    expectedArea: w * hh,
    showDecompositionGuides: false, showRegionAreaLabel: false,
    narration: 'A rectangle on the grid to try first.',
  };
}

// ---------------------------------------------------------------------------
// Geometry the help levers draw
// ---------------------------------------------------------------------------

/** The part of the rectangle through a right triangle's or an L's outermost corners that lies outside it. */
export function outsideOfBox(c: PolygonAreaChallenge): Pt[] | null {
  const vs = c.vertices ?? [];
  if (c.figureType !== 'coordinate' || (vs.length !== 3 && vs.length !== 6)) return null;
  const r = box(vs);
  const corners = rect(r.minX, r.minY, r.maxX, r.maxY);
  const missing = corners.filter(k => !vs.some(v => v.x === k.x && v.y === k.y));
  if (missing.length !== 1) return null;
  const C = missing[0];
  if (vs.length === 3) {
    // A right triangle with axis-aligned legs: the outside is the triangle on its long side, at the missing corner.
    const rest = vs.filter(v => v.x === C.x || v.y === C.y);
    return rest.length === 2 ? [C, ...rest] : null;
  }
  // An L: the notch is the rectangle between the missing corner and the corner inside the box.
  const inner = vs.find(v => v.x !== r.minX && v.x !== r.maxX && v.y !== r.minY && v.y !== r.maxY);
  return inner ? rect(Math.min(C.x, inner.x), Math.min(C.y, inner.y), Math.max(C.x, inner.x), Math.max(C.y, inner.y)) : null;
}

function insidePolygon(p: Pt, vs: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const a = vs[i], b = vs[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const rectilinear = (vs: readonly Pt[]) =>
  vs.length >= 4 && vs.every((v, i) => { const n = vs[(i + 1) % vs.length]; return v.x === n.x || v.y === n.y; });

/**
 * The figure's unit squares as rows (one rectangle per run of squares in a row, bottom row first), for a figure made of
 * whole squares: a composite figure, or a rectilinear coordinate polygon. Null for any other figure.
 */
export function squareRows(c: PolygonAreaChallenge): Array<{ row: number; cells: Pt[] }> | null {
  let inside: (p: Pt) => boolean;
  let r: ReturnType<typeof box>;
  if (c.figureType === 'composite' && (c.parts ?? []).length) {
    const parts = c.parts!;
    inside = p => parts.some(q => p.x > q.x && p.x < q.x + q.w && p.y > q.y && p.y < q.y + q.h);
    r = box(parts.flatMap(q => [{ x: q.x, y: q.y }, { x: q.x + q.w, y: q.y + q.h }]));
  } else if (c.figureType === 'coordinate' && rectilinear(c.vertices ?? [])) {
    const vs = c.vertices!;
    inside = p => insidePolygon(p, vs);
    r = box(vs);
  } else return null;
  const rows: Array<{ row: number; cells: Pt[] }> = [];
  for (let y = r.minY; y < r.maxY; y++) {
    let start: number | null = null;
    for (let x = r.minX; x <= r.maxX; x++) {
      const on = x < r.maxX && inside({ x: x + 0.5, y: y + 0.5 });
      if (on && start === null) start = x;
      if (!on && start !== null) { rows.push({ row: y - r.minY, cells: rect(start, y, x, y + 1) }); start = null; }
    }
  }
  return rows;
}

/** composite_area: the pieces the learner's typed area left out, when it is one piece's area; else null. */
export function leftOutPieces(c: PolygonAreaChallenge, typed: number): number[] | null {
  const parts = c.parts ?? [];
  const hit = parts.findIndex(p => Math.abs(p.w * p.h - typed) < 0.01);
  return c.figureType === 'composite' && hit >= 0 ? parts.map((_, i) => i).filter(i => i !== hit) : null;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export function figureLevers(c: PolygonAreaChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!isTyped(c) || isPractice(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: AreaMiss[], when: string, does: string,
    on = false): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: on || pulled.includes(id), answers, when, does });
  const easier = smallerFigure(c);
  const simplify = (id: string, answers: AreaMiss[], does: string) =>
    easier || pulled.includes(id) ? [lever(id, 'simplify', answers,
      `The learner cannot find this ${c.type === 'coordinate_polygon' ? 'polygon' : c.figureType}'s area yet, even with the picture.`,
      `${does} It is not graded; the full item comes back after it.`)] : [];
  // A tier that already shows the grid (easy) starts it on screen; that is a starting position, not a pull.
  const grid = (answers: AreaMiss[]) => lever(GRID_LEVER, 'help', answers,
    'The learner adds the lengths, or types an area that does not match the figure.',
    `Draws the unit grid behind the ${c.figureType}, each square one square unit, so the learner can see the area as `
      + 'the squares the figure covers. No square is numbered or counted.', !!c.showGridOverlay);
  const rows = squareRows(c) ? [lever(ROWS_LEVER, 'help', ['halved', 'wrong_area'],
    'The learner types an area that is not the number of squares inside the figure, such as half of it.',
    'Tints every other row of unit squares inside the figure, so each row of squares reads apart. No row or square is '
      + 'numbered or counted.')] : [];

  switch (c.type) {
    case 'decompose':
      return [
        lever(SLOT_LEVER, 'help', [], 'The learner cannot find where the cut triangle goes.',
          'Draws the dashed slot at the far end of the parallelogram where the cut triangle fits. No number is drawn.',
          c.showDecompositionGuides !== false),
        grid(['halved', 'added_sides', 'wrong_area']),
        ...simplify(SMALLER_FIGURE_LEVER, ['halved', 'added_sides', 'wrong_area'],
          'Opens a smaller parallelogram first, leaning one square, with its slot and the unit grid drawn.'),
      ];
    case 'find_area_trapezoid':
      return [
        grid(['added_sides', 'wrong_area']),
        lever(CUT_LEVER, 'help', ['added_sides', 'wrong_area'],
          'The learner adds the lengths, or cannot see the trapezoid as shapes they know.',
          'Draws dashed lines straight down from the two top corners to the bottom base, splitting the trapezoid into a '
            + 'rectangle and side triangles. No length or area is written.', c.showDecompositionGuides === true),
        lever(TURNED_COPY_LEVER, 'help', ['forgot_half', 'wrong_area'],
          'The learner multiplies the two bases added together by the height and leaves out the half.',
          'Draws a copy of the trapezoid turned upside down against its right side and outlines the parallelogram the two '
            + 'make together, with the same height. No length or area is written.'),
        ...simplify(SMALLER_FIGURE_LEVER, ['forgot_half', 'added_sides', 'wrong_area'],
          'Opens a smaller trapezoid first, with one square corner, on the unit grid.'),
      ];
    case 'composite_area':
      return [
        lever(SPLIT_LEVER, 'help', ['halved', 'wrong_area'],
          'The learner cannot see the figure as rectangles.',
          'Draws the figure split into its rectangle pieces, each piece\'s width and height labelled. No area is written.',
          c.showDecompositionGuides !== false),
        lever(LEFT_OUT_LEVER, 'help', ['one_piece'],
          'The learner types the area of one rectangle piece, not the whole figure.',
          'Outlines in bold the piece or pieces of the figure that the learner\'s last area left out. No area is written.'),
        ...rows,
        ...simplify(SMALLER_FIGURE_LEVER, ['one_piece', 'halved', 'wrong_area'],
          'Opens a smaller figure first, made of two rectangles, with its pieces drawn and labelled.'),
      ];
    case 'coordinate_polygon':
      return [
        ...(outsideOfBox(c) ? [lever(OUTSIDE_LEVER, 'help', ['bounding_box', 'halved', 'wrong_area'],
          'The learner types the area of the rectangle around the polygon, or an area that does not match it.',
          'Draws the dashed rectangle through the polygon\'s outermost corners and tints the part of it that lies outside '
            + 'the polygon. No length or area is written.')] : []),
        ...rows,
        ...simplify(RECTANGLE_FIRST_LEVER, ['bounding_box', 'halved', 'wrong_area'],
          'Opens a rectangle on the coordinate grid first, its corners labelled.'),
      ];
    default: {
      const triangle = c.figureType === 'triangle';
      return [
        grid(['added_sides', 'wrong_area']),
        triangle
          ? lever(HALF_LEVER, 'help', ['forgot_half', 'wrong_area'],
            'The learner multiplies base by height on the triangle and leaves out the half.',
            'Draws the rectangle with the same base and height around the triangle and tints the two pieces of it outside '
              + 'the triangle; each matches a piece of the triangle on one side of the dashed height. No area is written.')
          : lever(SLIDE_LEVER, 'help', ['halved', 'wrong_area'],
            'The learner takes half of base times height on the parallelogram.',
            'Tints the corner piece left of the dashed height, draws a copy of it moved to the far end, and outlines the '
              + 'rectangle the parallelogram becomes, with the same base and height. No area is written.'),
        ...simplify(SMALLER_FIGURE_LEVER, ['forgot_half', 'halved', 'added_sides', 'wrong_area'],
          `Opens a smaller ${c.figureType} first, ${triangle ? 'with its height along one side' : 'leaning one square'}, on the unit grid.`),
      ];
    }
  }
}

/** What each pulled lever put on screen, in terms of what is drawn. Never a number. */
export function figureLeverFacts(c: PolygonAreaChallenge, pulled: readonly string[]): string {
  const said: string[] = [];
  const on = (id: string) => pulled.includes(id);
  const gridable = c.figureType === 'triangle' || c.figureType === 'parallelogram' || c.figureType === 'trapezoid';
  if (gridable && (c.showGridOverlay || on(GRID_LEVER))) said.push('a unit grid is drawn behind the figure, each square one square unit');
  if (c.type === 'decompose' && on(SLOT_LEVER)) said.push('the dashed slot where the cut triangle fits is drawn at the far end');
  if (c.figureType === 'triangle' && on(HALF_LEVER)) {
    said.push('a dashed rectangle with the same base and height is drawn around the triangle; its two pieces outside '
      + 'the triangle are tinted, each matching a piece of the triangle on one side of the dashed height');
  }
  if (c.type === FIND_AREA && c.figureType === 'parallelogram' && on(SLIDE_LEVER)) {
    said.push('the corner piece left of the dashed height is tinted, a copy of it is drawn moved to the far end, and the '
      + 'rectangle they make is outlined with the same base and height');
  }
  if (c.figureType === 'trapezoid' && (c.showDecompositionGuides === true || on(CUT_LEVER))) {
    said.push('dashed lines run straight down from the two top corners of the trapezoid to the bottom base');
  }
  if (c.figureType === 'trapezoid' && on(TURNED_COPY_LEVER)) {
    said.push('a copy of the trapezoid turned upside down is drawn dashed against its right side, and the parallelogram '
      + 'the two make together is outlined');
  }
  if (c.figureType === 'composite' && on(SPLIT_LEVER)) said.push('the figure is drawn split into its rectangle pieces, each labelled with its width and height');
  if (c.figureType === 'composite' && on(LEFT_OUT_LEVER)) said.push('the piece or pieces the learner\'s last area left out are outlined in bold');
  if (on(ROWS_LEVER)) said.push('every other row of unit squares inside the figure is tinted, so each row reads apart');
  if (c.figureType === 'coordinate' && on(OUTSIDE_LEVER)) {
    said.push('a dashed rectangle through the polygon\'s outermost corners is drawn, and the part of it outside the polygon is tinted');
  }
  return said.length ? `On the figure: ${said.join('; ')}.` : '';
}

/** The pieces a pulled figure lever draws, in figure units (y up). The component paints them; tests read them. */
export interface FigureOverlay {
  /** Dashed outline of the shape the figure is part of, or becomes (empty when none). */
  rectangle: Pt[];
  /** Tinted pieces. */
  tinted: Pt[][];
  /** The moved or turned copy, drawn dashed. */
  moved: Pt[] | null;
  /** Pieces outlined in bold (composite left-out pieces). */
  outlined: Pt[][];
  /** Rows of unit squares; the painter tints every other one (`row` even). */
  rows: Array<{ row: number; cells: Pt[] }>;
}

/** `leftOut`: the composite pieces the learner's last area left out (`leftOutPieces`), stored when the lever was pulled. */
export function figureOverlay(c: PolygonAreaChallenge, pulled: readonly string[], leftOut: readonly number[] = []): FigureOverlay | null {
  const b = c.base ?? 0, h = c.height ?? 0;
  const o: FigureOverlay = { rectangle: [], tinted: [], moved: null, outlined: [], rows: [] };
  let drew = false;
  if (c.type === FIND_AREA && c.figureType === 'triangle' && pulled.includes(HALF_LEVER)) {
    const apex = c.apexX ?? b / 2;
    o.tinted = [
      ...(apex > 0 ? [[{ x: 0, y: 0 }, { x: apex, y: h }, { x: 0, y: h }]] : []),
      ...(apex < b ? [[{ x: b, y: 0 }, { x: b, y: h }, { x: apex, y: h }]] : []),
    ];
    o.rectangle = rect(0, 0, b, h);
    drew = true;
  }
  if (c.type === FIND_AREA && c.figureType === 'parallelogram' && pulled.includes(SLIDE_LEVER)) {
    const s = c.skew ?? 1;
    o.rectangle = rect(s, 0, b + s, h);
    o.tinted = [[{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: h }]];
    o.moved = [{ x: b, y: 0 }, { x: b + s, y: 0 }, { x: b + s, y: h }];
    drew = true;
  }
  if (c.figureType === 'trapezoid' && pulled.includes(TURNED_COPY_LEVER)) {
    // The trapezoid turned half a turn about the middle of its right side: its top base lands on the bottom line.
    const b2 = c.base2 ?? b, off = c.topOffset ?? (b - b2) / 2;
    o.moved = [{ x: b, y: 0 }, { x: b + b2, y: 0 }, { x: b + b2 + off, y: h }, { x: off + b2, y: h }];
    o.rectangle = [{ x: 0, y: 0 }, { x: b + b2, y: 0 }, { x: b + b2 + off, y: h }, { x: off, y: h }];
    drew = true;
  }
  if (c.figureType === 'composite' && pulled.includes(LEFT_OUT_LEVER) && leftOut.length) {
    o.outlined = leftOut.map(i => c.parts?.[i]).filter((p): p is NonNullable<typeof p> => !!p)
      .map(p => rect(p.x, p.y, p.x + p.w, p.y + p.h));
    drew = o.outlined.length > 0;
  }
  if (pulled.includes(ROWS_LEVER)) {
    const rows = squareRows(c);
    if (rows) { o.rows = rows; drew = true; }
  }
  if (c.figureType === 'coordinate' && pulled.includes(OUTSIDE_LEVER)) {
    const out = outsideOfBox(c);
    if (out) {
      const r = box(c.vertices!);
      o.rectangle = rect(r.minX, r.minY, r.maxX, r.maxY);
      o.tinted = [out];
      drew = true;
    }
  }
  return drew ? o : null;
}

/** Every point an overlay draws, so the canvas can fit them (the turned trapezoid copy reaches past the figure). */
export function overlayPoints(o: FigureOverlay | null): Pt[] {
  return o ? [...o.rectangle, ...(o.moved ?? []), ...o.tinted.flat()] : [];
}

/** Twice the area of a polygon (shoelace), for the tests' geometry checks. */
export function doubledArea(pts: ReadonlyArray<Pt>): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], n = pts[(i + 1) % pts.length]; s += a.x * n.y - n.x * a.y; }
  return Math.abs(s);
}
