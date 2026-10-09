/**
 * Net folder geometry, pure: the solids as vertices and faces (drawn by projection, so every solid type the
 * generator picks is drawn as itself), their nets as flat polygons, and the cube-net fold that decides by code
 * which square lands on which face and whether a net folds at all.
 *
 * Before 2026-10-09 the solid was a CSS 3D box: a triangular prism or pyramid was drawn as a cube, a square pyramid
 * as tilted rectangles, and every non-box net as the cube's cross. Validity and face matches were the model's word.
 */

export type Vec3 = [number, number, number];
export type Point = [number, number];
/** A unit square of a cube net: [row, column], row increasing downward. */
export type Cell = [number, number];
export type CubeFace = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

export interface SolidShape {
  type: string;
  dimensions: { length?: number | null; width?: number | null; height?: number | null; radius?: number | null };
}

export interface SolidModel {
  vertices: Vec3[];
  /** Outward-wound faces (counter-clockwise seen from outside). */
  faces: { label: string; idx: number[] }[];
}

// ── vectors ─────────────────────────────────────────────────────────────

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (ps: Vec3[]): Vec3 => {
  const n = ps.length || 1;
  return [ps.reduce((s, p) => s + p[0], 0) / n, ps.reduce((s, p) => s + p[1], 0) / n, ps.reduce((s, p) => s + p[2], 0) / n];
};
const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];

// ── solids ──────────────────────────────────────────────────────────────

const pos = (v: number | null | undefined, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback);

/** The solid's vertices and faces, math axes (y up, z toward the viewer), centred on the origin. */
export function solidModel(solid: SolidShape): SolidModel {
  const d = solid.dimensions ?? {};
  const L = pos(d.length, 1);
  let vertices: Vec3[] = [];
  let faces: { label: string; idx: number[] }[] = [];
  switch (solid.type) {
    case 'square_pyramid': {
      const H = pos(d.height, L * 0.85), h = L / 2;
      vertices = [[-h, -H / 2, h], [h, -H / 2, h], [h, -H / 2, -h], [-h, -H / 2, -h], [0, H / 2, 0]];
      faces = [{ label: 'base', idx: [0, 1, 2, 3] }, { label: 'front', idx: [0, 1, 4] }, { label: 'right', idx: [1, 2, 4] },
        { label: 'back', idx: [2, 3, 4] }, { label: 'left', idx: [3, 0, 4] }];
      break;
    }
    case 'triangular_prism': {
      const W = pos(d.width, L * 0.75), H = pos(d.height, W * 0.87), z = L / 2;
      // Cross-section in xy, extruded along z.
      vertices = [[-W / 2, -H / 2, z], [W / 2, -H / 2, z], [0, H / 2, z], [-W / 2, -H / 2, -z], [W / 2, -H / 2, -z], [0, H / 2, -z]];
      faces = [{ label: 'front', idx: [0, 1, 2] }, { label: 'back', idx: [3, 4, 5] }, { label: 'bottom', idx: [0, 1, 4, 3] },
        { label: 'right', idx: [1, 4, 5, 2] }, { label: 'left', idx: [0, 2, 5, 3] }];
      break;
    }
    case 'triangular_pyramid': {
      const H = pos(d.height, L * 0.82), r = L / Math.sqrt(3);
      const at = (deg: number): Vec3 => [r * Math.cos((deg * Math.PI) / 180), -H / 2, r * Math.sin((deg * Math.PI) / 180)];
      // A base corner at the back, so one side faces the viewer ("front").
      vertices = [at(270), at(30), at(150), [0, H / 2, 0]];
      faces = [{ label: 'base', idx: [0, 1, 2] }, { label: 'front', idx: [1, 2, 3] }, { label: 'right', idx: [0, 1, 3] },
        { label: 'left', idx: [2, 0, 3] }];
      break;
    }
    default: {
      // cube and rectangular prism: length along x, height along y, width along z.
      const cube = solid.type === 'cube';
      const H = cube ? L : pos(d.height, L * 0.5), W = cube ? L : pos(d.width, L * 0.7);
      const [x, y, z] = [L / 2, H / 2, W / 2];
      vertices = [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z]];
      faces = [{ label: 'front', idx: [0, 1, 2, 3] }, { label: 'back', idx: [5, 4, 7, 6] }, { label: 'right', idx: [1, 5, 6, 2] },
        { label: 'left', idx: [4, 0, 3, 7] }, { label: 'top', idx: [3, 2, 6, 7] }, { label: 'bottom', idx: [4, 5, 1, 0] }];
    }
  }
  // Wind every face outward, whatever order it was written in.
  const mid = centroid(vertices);
  faces = faces.map(f => {
    const [a, b, c] = f.idx.map(i => vertices[i]);
    const n = cross(sub(b, a), sub(c, a));
    return dot(n, sub(centroid(f.idx.map(i => vertices[i])), mid)) < 0 ? { ...f, idx: [...f.idx].reverse() } : f;
  });
  return { vertices, faces };
}

/** Faces, edges and vertices of the model, counted from its geometry (the checks never trust a stored count). */
export function solidCounts(model: SolidModel): { faces: number; edges: number; vertices: number } {
  const edges = new Set<string>();
  for (const f of model.faces) f.idx.forEach((v, i) => {
    const w = f.idx[(i + 1) % f.idx.length];
    edges.add(v < w ? `${v}-${w}` : `${w}-${v}`);
  });
  return { faces: model.faces.length, edges: edges.size, vertices: model.vertices.length };
}

export interface ProjectedFace { label: string; points: Point[]; visible: boolean; depth: number; center: Point }
export interface ProjectedSolid {
  faces: ProjectedFace[];
  edges: { a: Point; b: Point; visible: boolean }[];
  vertices: { at: Point; visible: boolean }[];
}

/**
 * Orthographic view of the model in an SVG box `size` wide, turned by `rotation` (degrees, the component's drag
 * state: x tilts, y turns). A face is visible when it faces the viewer; an edge or a corner is visible when a
 * visible face holds it.
 */
export function projectSolid(model: SolidModel, rotation: { x: number; y: number }, size: number): ProjectedSolid {
  const ry = (-rotation.y * Math.PI) / 180, rx = (-rotation.x * Math.PI) / 180;
  const turn = ([x, y, z]: Vec3): Vec3 => {
    const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    return [x1, y * Math.cos(rx) - z1 * Math.sin(rx), y * Math.sin(rx) + z1 * Math.cos(rx)];
  };
  const turned = model.vertices.map(turn);
  const radius = Math.max(...model.vertices.map(v => Math.hypot(...v)), 1e-6);
  const scale = (size * 0.4) / radius;
  const flat = (v: Vec3): Point => [size / 2 + v[0] * scale, size / 2 - v[1] * scale];
  const faces = model.faces.map(f => {
    const ps = f.idx.map(i => turned[i]);
    const n = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
    const c = centroid(ps);
    return { label: f.label, points: ps.map(flat), visible: n[2] > 1e-9, depth: c[2], center: flat(c) };
  });
  const seen = new Map<string, { a: number; b: number; visible: boolean }>();
  model.faces.forEach((f, fi) => f.idx.forEach((v, i) => {
    const w = f.idx[(i + 1) % f.idx.length], key = v < w ? `${v}-${w}` : `${w}-${v}`;
    const was = seen.get(key);
    seen.set(key, { a: v, b: w, visible: (was?.visible ?? false) || faces[fi].visible });
  }));
  const cornerSeen = model.vertices.map((_, vi) => model.faces.some((f, fi) => faces[fi].visible && f.idx.includes(vi)));
  return {
    faces: faces.sort((a, b) => a.depth - b.depth),
    edges: Array.from(seen.values()).map(e => ({ a: flat(turned[e.a]), b: flat(turned[e.b]), visible: e.visible })),
    vertices: turned.map((v, i) => ({ at: flat(v), visible: cornerSeen[i] })),
  };
}

/** The view that looks straight at the solid's base (a pyramid's base, a prism's triangular end, a box's top). */
export function baseView(type: string): { x: number; y: number } {
  if (type === 'triangular_prism') return { x: 0, y: 0 };
  if (type === 'square_pyramid' || type === 'triangular_pyramid') return { x: 90, y: 0 };
  return { x: -90, y: 0 };
}

/** The faces a solid stands on: a pyramid's base, a prism's two ends (a box's top and bottom). */
export function baseFaces(type: string): string[] {
  if (type === 'square_pyramid' || type === 'triangular_pyramid') return ['base'];
  if (type === 'triangular_prism') return ['front', 'back'];
  return ['top', 'bottom'];
}

// ── nets ────────────────────────────────────────────────────────────────

/** One flat piece of a net: `label` is the face it folds to (empty where the net does not say). */
export interface NetFace { id: string; label: string; points: Point[] }

const rect = (id: string, label: string, x: number, y: number, w: number, h: number): NetFace =>
  ({ id, label, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });

/** A box's cross net: top over front, left / front / right / back in a row, bottom under front. */
export function boxNet(l: number, w: number, h: number): NetFace[] {
  return [
    rect('top', 'top', w, 0, l, w), rect('left', 'left', 0, w, w, h), rect('front', 'front', w, w, l, h),
    rect('right', 'right', w + l, w, w, h), rect('back', 'back', 2 * w + l, w, l, h), rect('bottom', 'bottom', w, w + h, l, w),
  ];
}

/** Unit squares at the cells; labelled with the face each folds to when the net folds (else unlabelled). */
export function cellNet(cells: readonly Cell[], labels?: readonly (string | null)[]): NetFace[] {
  return cells.map(([r, c], i) => rect(`cell-${i}`, labels?.[i] ?? '', c, r, 1, 1));
}

function squarePyramidNet(L: number, H: number): NetFace[] {
  const s = Math.hypot(H, L / 2), h = L / 2;
  return [
    rect('base', 'base', -h, -h, L, L),
    { id: 'front', label: 'front', points: [[-h, h], [h, h], [0, h + s]] },
    { id: 'back', label: 'back', points: [[h, -h], [-h, -h], [0, -h - s]] },
    { id: 'left', label: 'left', points: [[-h, -h], [-h, h], [-h - s, 0]] },
    { id: 'right', label: 'right', points: [[h, h], [h, -h], [h + s, 0]] },
  ];
}

function triangularPrismNet(L: number, W: number, H: number): NetFace[] {
  const side = Math.hypot(W / 2, H);
  return [
    rect('left', 'left', 0, 0, side, L), rect('bottom', 'bottom', side, 0, W, L), rect('right', 'right', side + W, 0, side, L),
    { id: 'front', label: 'front', points: [[side, 0], [side + W, 0], [side + W / 2, -H]] },
    { id: 'back', label: 'back', points: [[side + W, L], [side, L], [side + W / 2, L + H]] },
  ];
}

function triangularPyramidNet(L: number, H: number): NetFace[] {
  const slant = Math.hypot(H, L / (2 * Math.sqrt(3)));
  const a: Point = [0, 0], b: Point = [L, 0], c: Point = [L / 2, (-L * Math.sqrt(3)) / 2];
  const mid = (p: Point, q: Point): Point => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const centre: Point = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  const apex = (p: Point, q: Point): Point => {
    const m = mid(p, q), dx = m[0] - centre[0], dy = m[1] - centre[1], n = Math.hypot(dx, dy) || 1;
    return [m[0] + (dx / n) * slant, m[1] + (dy / n) * slant];
  };
  return [
    { id: 'base', label: 'base', points: [a, b, c] },
    { id: 'front', label: 'front', points: [a, b, apex(a, b)] },
    { id: 'right', label: 'right', points: [b, c, apex(b, c)] },
    { id: 'left', label: 'left', points: [c, a, apex(c, a)] },
  ];
}

/** Cells of the cube nets the session layouts name (`NetLayout`). */
export const LAYOUT_CELLS: Record<string, Cell[]> = {
  cross: [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]],
  t_shape: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1], [3, 1]],
  // A column of four with its flaps on opposite sides. The flaps were both on the right until 2026-10-09: two squares
  // on one face, drawn as a cube's net.
  l_shape: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [3, 0]],
};
/** The cell each layout folds around (labelled front). */
const LAYOUT_ROOT: Record<string, number> = { cross: 2, t_shape: 1, l_shape: 0 };

/** The solid's own net: the cube on its layout's cells, a box as its cross, the others as theirs. */
export function solidNet(solid: SolidShape, layout: string): NetFace[] {
  const d = solid.dimensions ?? {};
  const L = pos(d.length, 1);
  switch (solid.type) {
    case 'square_pyramid': return squarePyramidNet(L, pos(d.height, L * 0.85));
    case 'triangular_prism': { const W = pos(d.width, L * 0.75); return triangularPrismNet(L, W, pos(d.height, W * 0.87)); }
    case 'triangular_pyramid': return triangularPyramidNet(L, pos(d.height, L * 0.82));
    case 'rectangular_prism': return boxNet(L, pos(d.width, L * 0.7), pos(d.height, L * 0.5));
    default: {
      const cells = LAYOUT_CELLS[layout] ?? LAYOUT_CELLS.cross;
      const fold = foldCubeCells(cells, LAYOUT_ROOT[layout] ?? 2);
      return cellNet(cells, fold.faces).map(f => ({ ...f, id: f.label || f.id }));
    }
  }
}

/** Edges two net pieces share: where the net hinges when it folds. */
export function sharedEdges(faces: readonly NetFace[]): Array<[Point, Point]> {
  const key = (p: Point) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const seen = new Map<string, number>();
  const out: Array<[Point, Point]> = [];
  faces.forEach((f, fi) => f.points.forEach((p, i) => {
    const q = f.points[(i + 1) % f.points.length];
    const k = [key(p), key(q)].sort().join('|');
    const owner = seen.get(k);
    if (owner === undefined) seen.set(k, fi);
    else if (owner !== fi) out.push([p, q]);
  }));
  return out;
}

// ── the cube fold ───────────────────────────────────────────────────────

const FACE_OF: Record<string, CubeFace> = {
  '0,0,1': 'front', '0,0,-1': 'back', '0,1,0': 'top', '0,-1,0': 'bottom', '1,0,0': 'right', '-1,0,0': 'left',
};
const OPPOSITE: Record<CubeFace, CubeFace> = { front: 'back', back: 'front', top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
export const oppositeFace = (f: string): string => OPPOSITE[f as CubeFace] ?? '';
export const CUBE_FACES: readonly CubeFace[] = ['front', 'back', 'top', 'bottom', 'left', 'right'];

export interface CubeFold {
  /** The face each cell folds to (null where the cell was never reached). */
  faces: (CubeFace | null)[];
  valid: boolean;
  /** `count`: not six squares; `overlap`: two squares land on one face; `disconnected`: the pieces do not join. */
  reason: 'ok' | 'count' | 'overlap' | 'disconnected';
}

/**
 * Fold the net around the `root` cell (front, with the net's up as the cube's top) by rolling a frame across
 * shared edges. Valid when six joined squares land on six different faces.
 */
export function foldCubeCells(cells: readonly Cell[], root = 0): CubeFold {
  const faces: (CubeFace | null)[] = cells.map(() => null);
  const at = new Map(cells.map(([r, c], i) => [`${r},${c}`, i]));
  const frames: Array<{ n: Vec3; u: Vec3; r: Vec3 } | null> = cells.map(() => null);
  if (!cells.length) return { faces, valid: false, reason: 'count' };
  const name = (v: Vec3) => FACE_OF[v.map(x => (Object.is(x, -0) ? 0 : x)).join(',')];
  frames[root] = { n: [0, 0, 1], u: [0, 1, 0], r: [1, 0, 0] };
  const queue = [root];
  while (queue.length) {
    const i = queue.shift()!, f = frames[i]!, [row, col] = cells[i];
    const moves: Array<[number, number, { n: Vec3; u: Vec3; r: Vec3 }]> = [
      [row - 1, col, { n: f.u, u: neg(f.n), r: f.r }],
      [row + 1, col, { n: neg(f.u), u: f.n, r: f.r }],
      [row, col + 1, { n: f.r, u: f.u, r: neg(f.n) }],
      [row, col - 1, { n: neg(f.r), u: f.u, r: f.n }],
    ];
    for (const [r, c, frame] of moves) {
      const j = at.get(`${r},${c}`);
      if (j === undefined || frames[j]) continue;
      frames[j] = frame;
      queue.push(j);
    }
  }
  frames.forEach((f, i) => { faces[i] = f ? name(f.n) : null; });
  if (faces.some(f => f === null)) return { faces, valid: false, reason: 'disconnected' };
  if (cells.length !== 6) return { faces, valid: false, reason: 'count' };
  if (new Set(faces).size !== 6) return { faces, valid: false, reason: 'overlap' };
  return { faces, valid: true, reason: 'ok' };
}

/** Cells from rows of `X` and `.`. */
export const cellsOf = (art: string): Cell[] => art.trim().split('/').flatMap((row, r) =>
  Array.from(row).flatMap((ch, c) => (ch === 'X' ? [[r, c] as Cell] : [])));

/** The shape of a set of cells up to turning and flipping, as one string. */
export function shapeKey(cells: readonly Cell[]): string {
  const forms: string[] = [];
  const maps: Array<(p: Cell) => Cell> = [
    ([r, c]) => [r, c], ([r, c]) => [c, -r], ([r, c]) => [-r, -c], ([r, c]) => [-c, r],
    ([r, c]) => [r, -c], ([r, c]) => [-c, -r], ([r, c]) => [-r, c], ([r, c]) => [c, r],
  ];
  for (const m of maps) {
    const ps = cells.map(m);
    const r0 = Math.min(...ps.map(p => p[0])), c0 = Math.min(...ps.map(p => p[1]));
    forms.push(ps.map(([r, c]) => `${r - r0},${c - c0}`).sort().join(';'));
  }
  return forms.sort()[0];
}

/** The eleven cube nets. */
export const VALID_CUBE_NETS: readonly string[] = [
  'X.../XXXX/X...', 'X.../XXXX/.X..', 'X.../XXXX/..X.', 'X.../XXXX/...X', '.X../XXXX/.X..', '.X../XXXX/..X.',
  'XX../.XXX/.X..', 'XX../.XXX/..X.', 'XX../.XXX/...X', 'XX../.XX./..XX', 'XXX.../..XXX.',
];
/** Arrangements that do not fold into a cube: two squares on one face, or not six squares. */
export const INVALID_CUBE_NETS: readonly string[] = [
  'XXX/XXX', 'XXXXXX', 'XXXXX/X....', 'X.X./XXXX', 'XX../XXXX', 'XXXX/X..X', 'XXXX/.XX.',
  '.X../XXXX', '.X../XXXX/.XX.', 'XXX/.X./.X.',
];
export const CROSS_NET = '.X../XXXX/.X..';
export const STRIP_NET = 'XXXXXX';
