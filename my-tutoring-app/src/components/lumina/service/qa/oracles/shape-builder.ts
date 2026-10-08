import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import { formKey, makesShape, type Pt, type ShapeAsk } from '../../../primitives/visual-primitives/math/shapeMakeBuild';

/**
 * Shape-builder oracle, `make_shape` (the open build). The component judges a closed shape with `readShape` +
 * `shapeMakeMiss`: every asked property must hold exactly. The generator picks each ask from a menu that carries its
 * own proof shapes; this oracle does NOT trust them. It searches the 10x10 dot grid itself (random convex polygons
 * from edge vectors, and random star polygons from points) for passing shapes under the board's judge, and requires
 * two of different form: an ask only one shape can meet is a closed answer, not an open build.
 *
 * Checks (make_shape only):
 *  - schema         : sides 3-8, every other property a whole number >= 0 or absent, equalSides only 'all'.
 *  - answer-key     : the ask is satisfiable AND open on the grid (two passing shapes of different form found).
 *  - task-statement : the instruction states the side count and each asked property (it is the task, not a leak).
 *  - answer-leak    : no shape name anywhere in the item's text (naming the shape can be the skill).
 *  - scope          : K-2 asks no parallel sides or lines of symmetry.
 *  - clustering     : no two items in a session ask the same property set.
 * Other challenge types are reported as unchecked.
 */

const SHAPE_NAME = /\b(triangles?|squares?|rectangles?|rhomb(us|i|uses)|diamonds?|trapez(oid|ium)s?|parallelograms?|kites?|quadrilaterals?|pentagons?|hexagons?|heptagons?|octagons?)\b/i;

/** A small seeded generator, so a run is repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const fits = (pts: Pt[], size: number) => pts.every(p => p.x >= 0 && p.y >= 0 && p.x <= size && p.y <= size);
const shift = (pts: Pt[]) => {
  const mx = Math.min(...pts.map(p => p.x)), my = Math.min(...pts.map(p => p.y));
  return pts.map(p => ({ x: p.x - mx, y: p.y - my }));
};

/** Random lattice polygons with `n` corners: convex ones from edge vectors, star ones from points round a centre. */
function candidate(n: number, rand: () => number): Pt[] | null {
  const r = (k: number) => Math.floor(rand() * k);
  if (rand() < 0.5) {
    const vs: Pt[] = Array.from({ length: n - 1 }, () => ({ x: r(7) - 3, y: r(7) - 3 }));
    const last = { x: -vs.reduce((s, v) => s + v.x, 0), y: -vs.reduce((s, v) => s + v.y, 0) };
    const all = [...vs, last];
    if (all.some(v => v.x === 0 && v.y === 0)) return null;
    all.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    const pts: Pt[] = [{ x: 0, y: 0 }];
    for (const v of all.slice(0, -1)) pts.push({ x: pts.at(-1)!.x + v.x, y: pts.at(-1)!.y + v.y });
    return shift(pts);
  }
  const pts: Pt[] = Array.from({ length: n }, () => ({ x: r(7), y: r(7) }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
  return pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/** Different forms of passing shape found on the grid, up to two. */
export function searchForms(ask: ShapeAsk, size = 10, tries = 60000, seed = 7): number {
  const rand = rng(seed), forms = new Set<string>();
  for (let t = 0; t < tries && forms.size < 2; t++) {
    const pts = candidate(ask.sides, rand);
    if (!pts || !fits(pts, size) || new Set(pts.map(p => `${p.x},${p.y}`)).size !== pts.length) continue;
    if (makesShape(ask, pts)) forms.add(formKey(pts));
  }
  return forms.size;
}

const whole = (v: unknown) => v === undefined || v === null || (Number.isInteger(v) && (v as number) >= 0);

function readAsk(t: Record<string, unknown> | null | undefined): ShapeAsk | null {
  if (!t || !Number.isInteger(t.sides)) return null;
  const ask: ShapeAsk = { sides: t.sides as number };
  if (t.rightAngles != null) ask.rightAngles = t.rightAngles as number;
  if (t.parallelPairs != null) ask.parallelPairs = t.parallelPairs as number;
  if (t.equalSides === 'all') ask.equalSides = 'all';
  if (t.linesOfSymmetry != null) ask.linesOfSymmetry = t.linesOfSymmetry as number;
  return ask;
}

export const shapeBuilderOracle: ContentOracle = {
  componentId: 'shape-builder',
  modes: ['make_shape'],
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const challenges = asRecordArray(data.challenges);
    const unchecked = new Set<string>();
    const band = data.gradeBand === '3-5' ? '3-5' : 'K-2';
    const grid = data.grid as { size?: { rows?: number; columns?: number } } | undefined;
    const size = Math.min(grid?.size?.rows ?? 10, grid?.size?.columns ?? 10);
    const seen = new Set<string>();
    let checked = 0;
    challenges.forEach((c, i) => {
      const where = `challenge[${i}] ${c.id ?? ''}`.trim();
      if (c.type !== 'make_shape') { unchecked.add(String(c.type)); return; }
      checked++;
      const t = c.targetProperties as Record<string, unknown> | null | undefined;
      const ask = readAsk(t);
      if (!ask || ask.sides < 3 || ask.sides > 8 || !t || !whole(t.rightAngles) || !whole(t.parallelPairs) || !whole(t.linesOfSymmetry)
        || (t.equalSides != null && t.equalSides !== 'all')) {
        violations.push({ check: 'schema', where, detail: `unreadable ask: ${JSON.stringify(t)}` });
        return;
      }
      const key = JSON.stringify(ask);
      if (seen.has(key)) violations.push({ check: 'clustering', where, detail: `ask repeated in the session: ${key}` });
      seen.add(key);
      const forms = searchForms(ask, size);
      if (forms < 2) violations.push({ check: 'answer-key-desync', where,
        detail: forms ? `only one form of shape passes ${key}: a closed answer, not an open build` : `no shape on the grid passes ${key}` });
      const text = String(c.instruction ?? '');
      const states: Array<[boolean, RegExp, string]> = [
        [true, new RegExp(`\\b${ask.sides} sides\\b`), `${ask.sides} sides`],
        [ask.rightAngles !== undefined, /right angle|square corner/i, 'right angles'],
        [ask.parallelPairs !== undefined, /parallel/i, 'parallel sides'],
        [ask.equalSides === 'all', /same length|equal/i, 'equal sides'],
        [ask.linesOfSymmetry !== undefined, /symmetry/i, 'lines of symmetry'],
      ];
      for (const [asked, re, what] of states) {
        if (asked && !re.test(text)) violations.push({ check: 'schema', where, detail: `instruction does not state ${what}: ${JSON.stringify(text)}` });
      }
      for (const field of ['instruction', 'hint', 'narration']) {
        // "square corner" is the K-2 word for a right angle, not a shape name.
        const m = String(c[field] ?? '').replace(/square corners?/gi, '').match(SHAPE_NAME);
        if (m) violations.push({ check: 'answer-leak', where, detail: `${field} names a shape ("${m[0]}")` });
      }
      if (band === 'K-2' && (ask.parallelPairs !== undefined || ask.linesOfSymmetry !== undefined)) {
        violations.push({ check: 'scope', where, detail: `K-2 ask uses parallel sides or symmetry: ${key}` });
      }
    });
    void ctx;
    return { violations, uncheckedTypes: Array.from(unchecked), checkedChallenges: checked };
  },
};
