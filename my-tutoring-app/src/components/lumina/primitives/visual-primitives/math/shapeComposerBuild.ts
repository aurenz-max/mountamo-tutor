/**
 * Shape Composer `free-create` as an open build (`/add-eval-modes` references/build-mode.md).
 *
 * Code states a recipe ("2 triangles and 1 square") and the learner composes their own picture from it on an empty
 * board. Many pictures pass. The judge is code, at "I'm done!": the board holds exactly the asked shapes, the pieces
 * do not sit on top of each other, and every piece touches another so they make one composite shape (K.G.6, 1.G.2).
 * Pure geometry, no React, so the generator, the component and vitest share it.
 */

export interface RecipePart { shape: string; count: number }

/** A piece on the board, in canvas units. Rotation is degrees about the piece's centre, as the svg draws it. */
export interface BoardPiece { id: string; shape: string; x: number; y: number; width: number; height: number; rotation: number }

export type ShapeBuildMiss = 'missing_piece' | 'extra_piece' | 'overlapping' | 'not_touching';

export interface ShapeBuildVerdict { pass: boolean; miss: ShapeBuildMiss | null }

/** Two pieces closer than this (canvas units) touch. */
export const TOUCH_GAP = 4;
/** On a drop, a piece this close to another slides over until they touch. */
export const MAGNET_GAP = 16;
/** Overlap larger than this share of the smaller piece reads as one piece on top of another. */
const OVERLAP_SHARE = 0.2;

type Pt = [number, number];

/** The piece's outline in its own box, before rotation. Matches `getShapePath` in ShapeComposer.tsx. */
function localOutline(shape: string, w: number, h: number): Pt[] {
  switch (shape) {
    case 'triangle': return [[w / 2, 0], [w, h], [0, h]];
    case 'hexagon': return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)] as Pt;
    });
    case 'trapezoid': return [[w * 0.2, 0], [w * 0.8, 0], [w, h], [0, h]];
    case 'rhombus': return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
    case 'circle': return Array.from({ length: 24 }, (_, i) => {
      const a = (2 * Math.PI * i) / 24;
      return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)] as Pt;
    });
    case 'semicircle': return [
      ...Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (Math.PI * i) / 12;
        return [w / 2 + (w / 2) * Math.cos(a), h + h * Math.sin(a)] as Pt;
      }),
    ];
    default: return [[0, 0], [w, 0], [w, h], [0, h]];
  }
}

/** The piece's outline on the board: rotated about its centre, then moved to (x, y), as `translate() rotate(r, cx, cy)`. */
export function pieceOutline(p: BoardPiece): Pt[] {
  const cx = p.width / 2, cy = p.height / 2;
  const r = (p.rotation * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  return localOutline(p.shape, p.width, p.height).map(([px, py]) => [
    p.x + cx + (px - cx) * cos - (py - cy) * sin,
    p.y + cy + (px - cx) * sin + (py - cy) * cos,
  ]);
}

function inside([x, y]: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function closestOnSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): Pt {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return [ax + t * dx, ay + t * dy];
}

/** The nearest pair of points between two outlines that do not cross, as [on a, on b]. Null when they cross. */
function nearestPair(a: Pt[], b: Pt[]): { from: Pt; to: Pt; gap: number } | null {
  if (a.some(p => inside(p, b)) || b.some(p => inside(p, a))) return null;
  let best = { from: a[0], to: b[0], gap: Infinity };
  const scan = (pts: Pt[], poly: Pt[], flip: boolean) => {
    for (const p of pts) for (let i = 0; i < poly.length; i++) {
      const q = closestOnSegment(p, poly[i], poly[(i + 1) % poly.length]);
      const gap = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (gap < best.gap) best = flip ? { from: q, to: p, gap } : { from: p, to: q, gap };
    }
  };
  scan(a, b, false);
  scan(b, a, true);
  // Two outlines can cross with no vertex inside the other (a plus sign); the vertex scan then reports a gap above 0.
  return edgesCross(a, b) ? null : best;
}

function edgesCross(a: Pt[], b: Pt[]): boolean {
  const side = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length], q1 = b[j], q2 = b[(j + 1) % b.length];
    if (side(p1, p2, q1) * side(p1, p2, q2) < 0 && side(q1, q2, p1) * side(q1, q2, p2) < 0) return true;
  }
  return false;
}

/** Gap between two pieces in canvas units; 0 when they touch or cross. */
export function pieceGap(a: BoardPiece, b: BoardPiece): number {
  const pair = nearestPair(pieceOutline(a), pieceOutline(b));
  return pair ? pair.gap : 0;
}

/** Area two pieces share, sampled on a 2-unit grid. */
function sharedArea(a: Pt[], b: Pt[]): number {
  const box = (poly: Pt[]) => poly.reduce((m, [x, y]) => [Math.min(m[0], x), Math.min(m[1], y), Math.max(m[2], x), Math.max(m[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const [ax0, ay0, ax1, ay1] = box(a), [bx0, by0, bx1, by1] = box(b);
  const x0 = Math.max(ax0, bx0), y0 = Math.max(ay0, by0), x1 = Math.min(ax1, bx1), y1 = Math.min(ay1, by1);
  if (x0 >= x1 || y0 >= y1) return 0;
  let n = 0;
  for (let x = x0 + 1; x < x1; x += 2) for (let y = y0 + 1; y < y1; y += 2) if (inside([x, y], a) && inside([x, y], b)) n++;
  return n * 4;
}

function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

/** True when some piece lies substantially on top of another (a small corner overlap from turning is allowed). */
export function hasOverlap(pieces: BoardPiece[]): boolean {
  const outlines = pieces.map(pieceOutline);
  for (let i = 0; i < outlines.length; i++) for (let j = i + 1; j < outlines.length; j++) {
    const smaller = Math.min(area(outlines[i]), area(outlines[j]));
    if (sharedArea(outlines[i], outlines[j]) > OVERLAP_SHARE * smaller) return true;
  }
  return false;
}

/** How many separate groups the pieces make, where touching pieces are one group. */
export function groupCount(pieces: BoardPiece[]): number {
  const parent = pieces.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    if (pieceGap(pieces[i], pieces[j]) <= TOUCH_GAP) parent[root(i)] = root(j);
  }
  return new Set(pieces.map((_, i) => root(i))).size;
}

/** The check at "I'm done!": the asked shapes, nothing on top of another, all one composite. */
export function judgeShapeBuild(recipe: RecipePart[], pieces: BoardPiece[]): ShapeBuildVerdict {
  const have: Record<string, number> = {};
  for (const p of pieces) have[p.shape] = (have[p.shape] ?? 0) + 1;
  if (recipe.some(r => (have[r.shape] ?? 0) < r.count)) return { pass: false, miss: 'missing_piece' };
  const asked = new Set(recipe.map(r => r.shape));
  if (recipe.some(r => (have[r.shape] ?? 0) > r.count) || pieces.some(p => !asked.has(p.shape))) {
    return { pass: false, miss: 'extra_piece' };
  }
  if (hasOverlap(pieces)) return { pass: false, miss: 'overlapping' };
  if (groupCount(pieces) > 1) return { pass: false, miss: 'not_touching' };
  return { pass: true, miss: null };
}

/** What the board says after a miss. It names the problem, never which piece to add, take off or move where. */
export const SHAPE_BUILD_MISS_WORDS: Record<ShapeBuildMiss, string> = {
  missing_piece: 'Some shapes on the list are not in your picture yet. Look at the list again.',
  extra_piece: 'Your picture has a shape that is not on the list. Look at the list again.',
  overlapping: 'Two shapes are on top of each other. Slide them so they meet at their edges.',
  not_touching: 'Some shapes are on their own. Slide them so every shape touches another one.',
};

/**
 * On a drop: when the moved piece is near another but not touching, slide it the rest of the way along the nearest
 * gap. Returns the new top-left, or null to leave it where it was dropped.
 */
export function magnetTo(moved: BoardPiece, others: BoardPiece[]): { x: number; y: number } | null {
  const mine = pieceOutline(moved);
  let best: { from: Pt; to: Pt; gap: number } | null = null;
  for (const o of others) {
    const pair = nearestPair(mine, pieceOutline(o));
    if (!pair) return null; // already crossing another piece: leave it
    if (pair.gap <= TOUCH_GAP) return null; // already touching
    if (pair.gap <= MAGNET_GAP && (!best || pair.gap < best.gap)) best = pair;
  }
  if (!best) return null;
  const shift = (best.gap - 0.5) / best.gap;
  return { x: moved.x + (best.to[0] - best.from[0]) * shift, y: moved.y + (best.to[1] - best.from[1]) * shift };
}

/** A free top-left for a new piece: the first spot on a coarse grid that touches nothing already on the board. */
export function freeSpot(newPiece: Omit<BoardPiece, 'x' | 'y'>, board: BoardPiece[], canvasW: number, canvasH: number): { x: number; y: number } {
  const step = 20;
  const xs: number[] = [], ys: number[] = [];
  for (let x = 20; x <= canvasW - newPiece.width - 20; x += step) xs.push(x);
  for (let y = 20; y <= canvasH - newPiece.height - 20; y += step) ys.push(y);
  // Centre-out, so a first piece lands in the middle and later ones nearby.
  const cx = canvasW / 2 - newPiece.width / 2, cy = canvasH / 2 - newPiece.height / 2;
  const spots = xs.flatMap(x => ys.map(y => ({ x, y }))).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  for (const s of spots) {
    const candidate = { ...newPiece, ...s };
    if (board.every(o => pieceGap(candidate, o) > MAGNET_GAP + 4)) return s;
  }
  return { x: cx, y: cy };
}

// ---------------------------------------------------------------------------
// Recipes (generator side): code owns the shapes and counts; the model never writes them.
// ---------------------------------------------------------------------------

const K_RECIPE_SHAPES = ['triangle', 'square', 'rectangle', 'circle'];
const G1_RECIPE_SHAPES = [...K_RECIPE_SHAPES, 'hexagon', 'trapezoid', 'rhombus'];

/** Piece totals per item, easy to hard. K stays small; grade 1 reaches five. */
const TOTALS: Record<'K' | '1', number[]> = { K: [2, 3, 3, 4], '1': [3, 4, 4, 5] };

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

export function recipeText(recipe: RecipePart[]): string {
  const parts = recipe.map(r => `${NUMBER_WORDS[r.count] ?? r.count} ${r.shape}${r.count === 1 ? '' : 's'}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** The ask: the recipe stated, since the recipe is the task, and the touching rule that makes it one shape. */
export function recipeInstruction(recipe: RecipePart[]): string {
  return `Make your own picture with ${recipeText(recipe)}. Every shape must touch another shape.`;
}

/**
 * `count` distinct recipes of one or two kinds, piece totals rising. Grade 1 recipes use at least one of the newer
 * shapes (hexagon, trapezoid, rhombus) on later items.
 */
export function buildRecipes(gradeBand: 'K' | '1', count: number, rand: () => number = Math.random): RecipePart[][] {
  const pool = gradeBand === '1' ? G1_RECIPE_SHAPES : K_RECIPE_SHAPES;
  const totals = TOTALS[gradeBand];
  const out: RecipePart[][] = [];
  const seen = new Set<string>();
  const pick = (from: string[]) => from[Math.floor(rand() * from.length)];
  for (let i = 0; i < count; i++) {
    const total = totals[Math.min(i, totals.length - 1)];
    for (let tries = 0; tries < 40; tries++) {
      const first = gradeBand === '1' && i >= 2 ? pick(['hexagon', 'trapezoid', 'rhombus']) : pick(pool);
      const second = pick(pool.filter(s => s !== first));
      // One kind only on the very first K item half the time; otherwise two kinds.
      const oneKind = total === 2 && rand() < 0.5;
      const firstCount = oneKind ? total : 1 + Math.floor(rand() * (total - 1));
      const recipe: RecipePart[] = oneKind
        ? [{ shape: first, count: total }]
        : [{ shape: first, count: firstCount }, { shape: second, count: total - firstCount }];
      const key = recipe.map(r => `${r.count}${r.shape}`).sort().join('+');
      if (seen.has(key) && tries < 39) continue;
      seen.add(key);
      out.push(recipe);
      break;
    }
  }
  return out;
}
