/**
 * shape-builder's open build, `make_shape` (/add-eval-modes references/build-mode.md): "Make a shape with 4 sides
 * and exactly 1 right angle." The learner makes ANY shape with the asked properties on an empty dot grid; many
 * shapes pass. Pure: the component, the generator, the oracle and the journey driver read the same geometry.
 *
 * Grid points are integers, so the judge is exact: a right angle is a zero dot product, parallel sides a zero cross
 * product, equal sides equal squared lengths. A point on a straight run between its neighbours is not a corner, so
 * a "4-dot triangle" reads as 3 sides. The build stays a simple polygon: a tap that would cross or fold back over a
 * side is refused on the board, so no check ever sees a crossed shape.
 */

export interface Pt { x: number; y: number }

/** The asked properties. `sides` is always asked; every other property is asked only when set, and exactly. */
export interface ShapeAsk {
  sides: number;
  rightAngles?: number;
  parallelPairs?: number;
  equalSides?: 'all';
  linesOfSymmetry?: number;
}

/** What the learner's closed shape has, computed from its corners. */
export interface ShapeFacts {
  sides: number;
  rightAngles: number;
  parallelPairs: number;
  /** The most sides that share one length (all of them when every side is equal). */
  sidesOfOneLength: number;
  symmetryLines: number;
  /** The real corners, in order: the placed points less any on a straight run. */
  corners: Pt[];
}

/** One miss per asked property, in the order the ask states them (TeachingAttempt.miss). */
export type ShapeMakeMiss = 'sides_off' | 'right_angles_off' | 'parallel_off' | 'equal_sides_off' | 'symmetry_off';
export const SHAPE_MAKE_MISSES: readonly ShapeMakeMiss[] = ['sides_off', 'right_angles_off', 'parallel_off', 'equal_sides_off', 'symmetry_off'];

export const MAX_CORNERS = 8;

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len2 = (a: Pt) => a.x * a.x + a.y * a.y;
export const samePt = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** The corners of a closed polygon: drop every point whose two sides run on one straight line. */
export function cornersOf(points: readonly Pt[]): Pt[] {
  let pts = [...points];
  for (let changed = true; changed && pts.length >= 3;) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length];
      if (cross(sub(pts[i], prev), sub(next, pts[i])) === 0) { pts = pts.filter((_, j) => j !== i); changed = true; break; }
    }
  }
  return pts;
}

/** Twice the signed area (zero for a flat shape). */
const area2 = (pts: readonly Pt[]) => pts.reduce((s, p, i) => s + cross(p, pts[(i + 1) % pts.length]), 0);

/** Lines of symmetry: each order-reversing relabelling of the corners that a reflection carries out exactly. */
const symmetryLines = (c: readonly Pt[]) => symmetryAxes(c).length;

/** Each line of symmetry as a point on it and its direction. */
function symmetryAxes(c: readonly Pt[]): Array<{ through: Pt; along: Pt }> {
  const n = c.length;
  const axes: Array<{ through: Pt; along: Pt }> = [];
  for (let k = 0; k < n; k++) {
    const pair = (i: number) => ((k - i) % n + n) % n;
    const i0 = c.findIndex((_, i) => pair(i) !== i);
    if (i0 < 0) continue;
    const a = c[i0], b = c[pair(i0)];
    // The axis is the perpendicular bisector of a-b: reflect p across it.
    const d = sub(b, a), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dd = len2(d);
    const reflect = (p: Pt) => {
      const t = ((p.x - m.x) * d.x + (p.y - m.y) * d.y) / dd;
      return { x: p.x - 2 * t * d.x, y: p.y - 2 * t * d.y };
    };
    if (c.every((p, i) => { const r = reflect(p), q = c[pair(i)]; return Math.abs(r.x - q.x) < 1e-9 && Math.abs(r.y - q.y) < 1e-9; })) {
      axes.push({ through: m, along: { x: -d.y, y: d.x } });
    }
  }
  return axes;
}

/** What the help levers draw on the learner's own closed shape (shapeBuilderLevers.ts). */
export interface ShapeMarks {
  corners: Pt[];
  /** Indexes into `corners` of the right-angle corners. */
  rightCorners: number[];
  /** Side i runs from corners[i] to corners[i+1]. Each group: two or more sides on one direction. */
  parallelGroups: number[][];
  /** Each group: two or more sides of one length. */
  lengthGroups: number[][];
  /** Each fold line as a segment reaching past the shape. */
  foldLines: Array<[Pt, Pt]>;
}

export function shapeMarks(points: readonly Pt[]): ShapeMarks | null {
  const f = readShape(points);
  if (!f) return null;
  const c = f.corners, n = c.length;
  const edges = c.map((p, i) => sub(c[(i + 1) % n], p));
  const group = (same: (a: number, b: number) => boolean) => {
    const out: number[][] = [], seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (seen.has(i)) continue;
      const g = [i, ...Array.from({ length: n - i - 1 }, (_, k) => i + 1 + k).filter(j => same(i, j))];
      g.forEach(j => seen.add(j));
      if (g.length > 1) out.push(g);
    }
    return out;
  };
  const reach = Math.max(...c.map(p => Math.max(p.x, p.y))) + 2;
  return {
    corners: c,
    rightCorners: c.map((_, i) => i).filter(i => dot(edges[(i - 1 + n) % n], edges[i]) === 0),
    parallelGroups: group((a, b) => cross(edges[a], edges[b]) === 0),
    lengthGroups: group((a, b) => len2(edges[a]) === len2(edges[b])),
    foldLines: symmetryAxes(c).map(({ through, along }) => {
      const s = reach / Math.sqrt(len2(along));
      return [{ x: through.x - along.x * s, y: through.y - along.y * s }, { x: through.x + along.x * s, y: through.y + along.y * s }];
    }),
  };
}

/** The facts of a closed shape, or null when it is not a shape (fewer than 3 corners, or flat). */
export function readShape(points: readonly Pt[]): ShapeFacts | null {
  const c = cornersOf(points);
  if (c.length < 3 || area2(c) === 0) return null;
  const n = c.length;
  const edges = c.map((p, i) => sub(c[(i + 1) % n], p));
  let rightAngles = 0, parallelPairs = 0;
  for (let i = 0; i < n; i++) if (dot(edges[(i - 1 + n) % n], edges[i]) === 0) rightAngles++;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (cross(edges[i], edges[j]) === 0) parallelPairs++;
  const lengths = edges.map(len2);
  const sidesOfOneLength = Math.max(...lengths.map(l => lengths.filter(m => m === l).length));
  return { sides: n, rightAngles, parallelPairs, sidesOfOneLength, symmetryLines: symmetryLines(c), corners: c };
}

/** The first asked property the shape does not have, or undefined when it has them all (the code judge). */
export function shapeMakeMiss(ask: ShapeAsk, facts: ShapeFacts | null): ShapeMakeMiss | undefined {
  if (!facts || facts.sides !== ask.sides) return 'sides_off';
  if (ask.rightAngles !== undefined && facts.rightAngles !== ask.rightAngles) return 'right_angles_off';
  if (ask.parallelPairs !== undefined && facts.parallelPairs !== ask.parallelPairs) return 'parallel_off';
  if (ask.equalSides === 'all' && facts.sidesOfOneLength !== facts.sides) return 'equal_sides_off';
  if (ask.linesOfSymmetry !== undefined && facts.symmetryLines !== ask.linesOfSymmetry) return 'symmetry_off';
  return undefined;
}

export const makesShape = (ask: ShapeAsk, points: readonly Pt[]) => !shapeMakeMiss(ask, readShape(points));

// ── The board: tap to build, never a crossed or folded shape ────────────────────────────────────────────────────

/** Whether segments p1-p2 and q1-q2 share any point. */
function touches(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const d1 = cross(sub(p2, p1), sub(q1, p1)), d2 = cross(sub(p2, p1), sub(q2, p1));
  const d3 = cross(sub(q2, q1), sub(p1, q1)), d4 = cross(sub(q2, q1), sub(p2, q1));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (a: Pt, b: Pt, p: Pt) => cross(sub(b, a), sub(p, a)) === 0
    && Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
  return on(p1, p2, q1) || on(p1, p2, q2) || on(q1, q2, p1) || on(q1, q2, p2);
}

/** A chain (or, closed, a polygon) whose sides meet only at their shared corners and never fold back. */
export function isSimple(points: readonly Pt[], closed: boolean): boolean {
  const n = points.length;
  if (new Set(points.map(p => `${p.x},${p.y}`)).size !== n) return false;
  const m = closed ? n : n - 1;
  const edge = (i: number): [Pt, Pt] => [points[i], points[(i + 1) % n]];
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    const [a, b] = edge(i), [c, d] = edge(j);
    const adjacent = j === i + 1 || (closed && i === 0 && j === m - 1);
    if (!adjacent) { if (touches(a, b, c, d)) return false; continue; }
    // Adjacent sides share one corner; they may not run back over each other.
    const shared = j === i + 1 ? b : a, out1 = j === i + 1 ? a : b, out2 = j === i + 1 ? d : c;
    const u = sub(out1, shared), v = sub(out2, shared);
    if (cross(u, v) === 0 && dot(u, v) > 0) return false;
  }
  return true;
}

export interface ShapeBuild { points: Pt[]; closed: boolean }
export const EMPTY_BUILD: ShapeBuild = { points: [], closed: false };

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const d = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), d) / len2(d)));
  return Math.hypot(p.x - (a.x + t * d.x), p.y - (a.y + t * d.y));
}

/**
 * One tap on a grid dot. Open: tap a new dot to add a corner, the first corner (with 3 or more) to close the shape,
 * any other corner to take it out. Closed: tap a corner to take it out (the shape stays closed while 3 remain), tap
 * a new dot to add a corner on the nearest side. Returns null when the tap would cross or fold the shape: the board
 * refuses it and nothing changes.
 */
export function tapDot(build: ShapeBuild, p: Pt): ShapeBuild | null {
  const { points, closed } = build;
  const at = points.findIndex(q => samePt(q, p));
  if (!closed) {
    if (at === 0 && points.length >= 3) return isSimple(points, true) && readShape(points) ? { points, closed: true } : null;
    if (at >= 0) {
      const next = points.filter((_, i) => i !== at);
      return isSimple(next, false) ? { points: next, closed: false } : null;
    }
    if (points.length >= MAX_CORNERS) return null;
    const next = [...points, p];
    return isSimple(next, false) ? { points: next, closed: false } : null;
  }
  if (at >= 0) {
    const next = points.filter((_, i) => i !== at);
    if (next.length < 3) return { points: next, closed: false };
    return isSimple(next, true) && readShape(next) ? { points: next, closed: true } : null;
  }
  if (points.length >= MAX_CORNERS) return null;
  const order = points.map((a, i) => ({ i, d: distToSegment(p, a, points[(i + 1) % points.length]) })).sort((a, b) => a.d - b.d);
  for (const { i } of order) {
    const next = [...points.slice(0, i + 1), p, ...points.slice(i + 1)];
    if (isSimple(next, true) && readShape(next)) return { points: next, closed: true };
  }
  return null;
}

// ── The asks: code owns the property set, and every set is proved open by two different shapes that pass ─────────

export type ShapeBand = 'K-2' | '3-5';

interface MenuEntry { ask: ShapeAsk; band: ShapeBand; witnesses: Pt[][] }

const P = (...xy: number[]): Pt[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));

/** Each ask with two shapes of different form that pass it (the proof that it is satisfiable and open). */
export const SHAPE_ASK_MENU: readonly MenuEntry[] = [
  // K-2: sides, then sides with one more property in the words a young learner uses (square corners, same length).
  { band: 'K-2', ask: { sides: 3 }, witnesses: [P(0, 0, 2, 0, 0, 2), P(0, 0, 3, 0, 1, 2)] },
  { band: 'K-2', ask: { sides: 4 }, witnesses: [P(0, 0, 2, 0, 2, 2, 0, 2), P(0, 0, 3, 0, 2, 2, 0, 1)] },
  { band: 'K-2', ask: { sides: 5 }, witnesses: [P(1, 0, 3, 0, 4, 2, 2, 3, 0, 2), P(0, 0, 2, 0, 2, 2, 1, 3, 0, 2)] },
  { band: 'K-2', ask: { sides: 6 }, witnesses: [P(1, 0, 3, 0, 4, 1, 3, 2, 1, 2, 0, 1), P(1, 0, 3, 0, 4, 1, 4, 3, 1, 3, 0, 1)] },
  { band: 'K-2', ask: { sides: 3, rightAngles: 1 }, witnesses: [P(0, 0, 2, 0, 0, 2), P(0, 0, 3, 0, 0, 1)] },
  { band: 'K-2', ask: { sides: 4, rightAngles: 4 }, witnesses: [P(0, 0, 2, 0, 2, 2, 0, 2), P(0, 0, 3, 0, 3, 1, 0, 1)] },
  { band: 'K-2', ask: { sides: 4, equalSides: 'all' }, witnesses: [P(0, 0, 2, 0, 2, 2, 0, 2), P(2, 0, 4, 1, 2, 2, 0, 1)] },
  { band: 'K-2', ask: { sides: 4, rightAngles: 0 }, witnesses: [P(0, 0, 2, 0, 3, 1, 1, 1), P(0, 0, 4, 0, 3, 2, 1, 2)] },
  { band: 'K-2', ask: { sides: 5, rightAngles: 2 }, witnesses: [P(0, 1, 2, 0, 4, 1, 4, 3, 0, 3), P(0, 0, 3, 0, 4, 2, 1, 3, 0, 3)] },
  // 3-5: right angles, parallel sides, equal sides and lines of symmetry together (3.G.A.1, 4.G.A.2, 4.G.A.3).
  { band: '3-5', ask: { sides: 4, rightAngles: 1 }, witnesses: [P(0, 0, 4, 0, 2, 2, 0, 1), P(0, 0, 2, 0, 2, 3, 1, 1)] },
  { band: '3-5', ask: { sides: 4, rightAngles: 2 }, witnesses: [P(0, 0, 3, 0, 2, 2, 0, 2), P(0, 2, 1, 0, 3, 1, 1, 3)] },
  { band: '3-5', ask: { sides: 4, parallelPairs: 1 }, witnesses: [P(0, 0, 4, 0, 3, 2, 1, 2), P(0, 0, 3, 0, 2, 2, 0, 2)] },
  { band: '3-5', ask: { sides: 4, parallelPairs: 2, rightAngles: 0 }, witnesses: [P(0, 0, 2, 0, 3, 1, 1, 1), P(2, 0, 4, 1, 2, 2, 0, 1)] },
  { band: '3-5', ask: { sides: 4, parallelPairs: 1, rightAngles: 2 }, witnesses: [P(0, 0, 3, 0, 2, 2, 0, 2), P(0, 0, 4, 0, 2, 1, 0, 1)] },
  { band: '3-5', ask: { sides: 4, equalSides: 'all', rightAngles: 0 }, witnesses: [P(2, 0, 4, 1, 2, 2, 0, 1), P(0, 0, 4, 3, 9, 3, 5, 0)] },
  { band: '3-5', ask: { sides: 3, linesOfSymmetry: 1 }, witnesses: [P(0, 0, 4, 0, 2, 1), P(0, 0, 2, 0, 1, 3)] },
  { band: '3-5', ask: { sides: 4, linesOfSymmetry: 1 }, witnesses: [P(2, 0, 4, 2, 2, 5, 0, 2), P(0, 0, 4, 0, 3, 2, 1, 2)] },
  { band: '3-5', ask: { sides: 4, linesOfSymmetry: 2 }, witnesses: [P(0, 0, 3, 0, 3, 1, 0, 1), P(2, 0, 4, 1, 2, 2, 0, 1)] },
  { band: '3-5', ask: { sides: 4, parallelPairs: 1, linesOfSymmetry: 1 }, witnesses: [P(0, 0, 4, 0, 3, 2, 1, 2), P(0, 0, 6, 0, 4, 1, 2, 1)] },
  { band: '3-5', ask: { sides: 5, rightAngles: 3 }, witnesses: [P(0, 1, 1, 0, 2, 1, 2, 3, 0, 3), P(0, 0, 3, 0, 3, 2, 2, 3, 0, 3)] },
  { band: '3-5', ask: { sides: 5, linesOfSymmetry: 1 }, witnesses: [P(0, 1, 2, 0, 4, 1, 4, 3, 0, 3), P(1, 0, 3, 0, 4, 2, 2, 4, 0, 2)] },
  { band: '3-5', ask: { sides: 6, parallelPairs: 3 }, witnesses: [P(1, 0, 3, 0, 4, 1, 3, 2, 1, 2, 0, 1), P(0, 0, 2, 0, 4, 2, 4, 3, 2, 3, 0, 1)] },
];

/** Same form: equal angles and side ratios, whatever the size or turn (a bigger square is the same shape). */
export function formKey(points: readonly Pt[]): string {
  const f = readShape(points);
  if (!f) return '';
  const c = f.corners, n = c.length;
  const lengths = c.map((p, i) => len2(sub(c[(i + 1) % n], p)));
  const min = Math.min(...lengths);
  const angles = c.map((p, i) => {
    const u = sub(c[(i - 1 + n) % n], p), v = sub(c[(i + 1) % n], p);
    return Math.round(Math.acos(dot(u, v) / Math.sqrt(len2(u) * len2(v))) * 180 / Math.PI);
  });
  return `${lengths.map(l => (l / min).toFixed(3)).sort().join(',')}|${angles.sort((a, b) => a - b).join(',')}`;
}

const sameAsk = (a: ShapeAsk, b: ShapeAsk) => a.sides === b.sides && a.rightAngles === b.rightAngles
  && a.parallelPairs === b.parallelPairs && a.equalSides === b.equalSides && a.linesOfSymmetry === b.linesOfSymmetry;

/**
 * Whether an ask is satisfiable AND open on a grid this size: at least two shapes of different form pass it, each
 * fitting the grid. The proof is the menu's witnesses, checked by the same judge the board runs.
 */
export function askIsOpen(ask: ShapeAsk, gridSize = 10): boolean {
  const entry = SHAPE_ASK_MENU.find(e => sameAsk(e.ask, ask));
  if (!entry) return false;
  const fits = (w: Pt[]) => w.every(p => p.x >= 0 && p.y >= 0 && p.x <= gridSize && p.y <= gridSize);
  const passing = entry.witnesses.filter(w => fits(w) && makesShape(ask, w));
  return new Set(passing.map(formKey)).size >= 2;
}

/** The passing shapes the menu proves an ask with (the journey driver builds the first one). */
export const witnessesFor = (ask: ShapeAsk): Pt[][] => SHAPE_ASK_MENU.find(e => sameAsk(e.ask, ask))?.witnesses ?? [];

/** The asks for a band, narrowed to one shape family when the topic names one ("quadrilaterals", "triangles"). */
export function asksFor(band: ShapeBand, topic = ''): ShapeAsk[] {
  const family: Array<[RegExp, number]> = [[/triangle/i, 3], [/quadrilateral|four-sided|rectangle|square|rhomb|parallelogram|trapezoid/i, 4],
    [/pentagon/i, 5], [/hexagon/i, 6]];
  const named = family.filter(([re]) => re.test(topic)).map(([, n]) => n);
  const all = SHAPE_ASK_MENU.filter(e => e.band === band && askIsOpen(e.ask)).map(e => e.ask);
  const narrowed = named.length ? all.filter(a => named.includes(a.sides)) : all;
  return narrowed.length ? narrowed : all;
}

// ── The words: the ask STATES the properties (it is the task, not a leak), never a shape name ─────────────────────

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The ask in the band's words: "square corners" and "same length" at K-2, "right angles" and "parallel" at 3-5. */
export function shapeAskText(ask: ShapeAsk, band: ShapeBand): string {
  const k2 = band === 'K-2';
  const parts = [count(ask.sides, 'side')];
  if (ask.rightAngles !== undefined) {
    const what = k2 ? ['square corner', 'square corners'] : ['right angle', 'right angles'];
    parts.push(ask.rightAngles === 0 ? `no ${what[1]}` : `exactly ${count(ask.rightAngles, what[0], what[1])}`);
  }
  if (ask.parallelPairs !== undefined) {
    parts.push(ask.parallelPairs === 0 ? 'no parallel sides' : `exactly ${count(ask.parallelPairs, 'pair', 'pairs')} of parallel sides`);
  }
  if (ask.equalSides === 'all') parts.push(k2 ? 'all sides the same length' : 'all sides equal in length');
  if (ask.linesOfSymmetry !== undefined) parts.push(`exactly ${count(ask.linesOfSymmetry, 'line', 'lines')} of symmetry`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `Make a shape with ${list}.`;
}

/** The same ask with its last property dropped (the simplify lever), or null when only the sides are asked. */
export function fewerProperties(ask: ShapeAsk): ShapeAsk | null {
  const keys = (['linesOfSymmetry', 'equalSides', 'parallelPairs', 'rightAngles'] as const).filter(k => ask[k] !== undefined);
  if (!keys.length) return null;
  const next: ShapeAsk = { ...ask };
  delete next[keys[0]];
  return next;
}

/** Shape names, and the words that would do the checking, which the live watcher line may never say. */
export const SHAPE_WATCH_NEVER_SAY: readonly string[] = ['triangle', 'square', 'rectangle', 'rhombus', 'diamond',
  'trapezoid', 'trapezium', 'parallelogram', 'kite', 'quadrilateral', 'pentagon', 'hexagon', 'heptagon', 'octagon',
  'polygon', 'parallel', 'equal', 'same length', 'right angle', 'symmetry', 'symmetric', 'corner', 'side'];
