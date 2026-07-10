import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Polygon-area-builder oracle — verifies the pre-built figure pool against the
 * component's own judging contract.
 *
 * The component (PolygonAreaBuilder.tsx) judges EVERY mode the same way
 * (handleCheckArea, :872-925): the student types a number (decimals and "a/b"
 * fractions accepted) and correct = |parsed − expectedArea| < 0.01. The five
 * challenge types differ only in WHAT figure is drawn and what interaction
 * precedes the answer (decompose additionally requires the cut triangle to be
 * dragged into the slot before the input unlocks).
 *
 * THE INDEPENDENCE RULE: the shipped key is `expectedArea`, but the VISUAL
 * TRUTH the student reads is the drawn figure — the polygon the canvas strokes
 * from base/height/skew/topOffset/parts/vertices. This oracle re-derives every
 * area GEOMETRICALLY from those drawn coordinates (shoelace over the exact
 * vertex loop the canvas strokes for triangle / parallelogram / trapezoid /
 * coordinate figures; disjoint-rectangle union for composite figures) and
 * checks the shipped key agrees. It never re-uses the generator's constructive
 * formulas (b·h, ½(b₁+b₂)h, Σw·h computed at build time) as its own source of
 * truth — a generator whose formula and figure drift apart (e.g. a topOffset
 * that reverses the quad, overlapping composite parts whose sum overstates the
 * visible union, a self-intersecting vertex order) is exactly the
 * correct-count-marked-wrong class this oracle exists to catch.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) expectedArea must equal the area of the DRAWN figure (shoelace over
 *          the stroked vertex loop; union of the drawn rectangles).
 *      (b) degenerate figures: any base/height/base2 ≤ 0, a composite piece
 *          with w/h < 1, or a zero-area polygon — the student is shown nothing
 *          countable (and the shoelace |·| would silently hide a reversed
 *          dimension, so signs are checked explicitly).
 *      (c) decompose reachability: the cut triangle is [(off,0),(s+off,0),
 *          (s+off,h)] and the drag snaps at offset = base. skew (s) must be in
 *          [1, base−1]: skew < 1 makes a zero-area grab target (pointInTriangle
 *          never true → the input NEVER unlocks, the "unreachable correct
 *          state" class), skew ≥ base reverses the fixed remaining quad.
 *      (d) composite pieces must be pairwise DISJOINT — overlapping rectangles
 *          make Σw·h (the key) larger than the figure the student sees.
 *      (e) composite hard-tier render contract: when showDecompositionGuides
 *          === false the component walks a 2-rect stacked L outline (bottom at
 *          minY, top stacked flush left or right, :631-668). ≠2 pieces, a
 *          non-stacked top, or a middle-placed top draws a wrong/self-crossing
 *          outline the labels no longer describe.
 *      (f) coordinate polygons must be SIMPLE (no properly-crossing edges) —
 *          strokePolygon fills the crossed shape but shoelace/expectedArea no
 *          longer equals the painted region — and must sit on the anchored
 *          first-quadrant grid (getBounds pins the grid at the origin, :224;
 *          a negative vertex plots off the labeled grid, uncountable).
 *  - scope             : the produced quantity (the AREA the student types)
 *      exceeds ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? the mode's
 *      intrinsic ceiling derived from the generator's uncapped randInt bands.
 *      Also: when ctx.evalMode names one of the five modes, every challenge's
 *      type must match it (a trapezoid session full of triangles teaches a
 *      different task identity than the objective asked for).
 *  - answer-leak       : narration/instruction/hint must not state the asked
 *      area value (value-matched only — "area is 24", "= 24", "24 cm²",
 *      "24 square feet"). The on-canvas base/height/vertex labels are the
 *      INTENDED scaffolding for every mode (the asked value is always the
 *      area, a product the canvas never prints), so they are NOT leaks.
 *  - clustering        : expectedArea must spread across the session
 *      (checkAnswerVariety) and no byte-identical figure card — the same drawn
 *      dimensions/parts/vertices twice.
 *  - schema            : ≥3 challenges (mastery-over-demo); figureType matches
 *      the challenge type's family; finite dimensions / integer grid-aligned
 *      parts and vertices (both grid renderers step in whole units); ≥3
 *      vertices; non-empty unitLabel (the canvas prints "<b> <unit>" labels
 *      and the input suffix "<unit>²").
 *
 * Deliberately NOT checked:
 *  - On-canvas dimension labels. Every mode asks for the AREA; the drawn base/
 *    height/bases/piece dimensions/vertex coordinates are the task's givens,
 *    not the answer. showRegionAreaLabel is structurally leak-guarded by the
 *    component (first composite piece only, :627 — a single sub-area can never
 *    sum to the asked total on a ≥2-piece figure).
 *  - apexX / topOffset placement and b2 < b orientation: shoelace over the
 *    stroked loop is position-independent, the drawn quad stays simple for any
 *    offset the generator can emit, and a b2 ≥ b "trapezoid" still has area
 *    ½(b₁+b₂)h — the key stays true, so it's an /eval-test aesthetics call.
 *  - Fractional areas: the input parses decimals AND "a/b" fractions, so a
 *    non-integer expectedArea is fully answerable — not an unreachable state.
 *  - Composite piece CONNECTIVITY at guides-shown tiers: separated labeled
 *    rectangles are still individually computable; only overlap (double-counted
 *    area) breaks the key.
 *  - supportTier/show* flag coherence with config.difficulty: the tier is
 *    applied by the generator post-process, not part of the answer contract;
 *    scaffold-withdrawal quality stays with /eval-test.
 *  - gradeBand and title/description prose (schema-constrained, number-free by
 *    prompt) — /eval-test territory.
 */

/** Half the component's 0.01 judging tolerance — generator values are exact. */
const EPS = 0.005;

const KNOWN_TYPES = new Set([
  'decompose',
  'find_area_triangle_parallelogram',
  'find_area_trapezoid',
  'composite_area',
  'coordinate_polygon',
]);

/** figureType families each challenge type may draw (component render branches). */
const FIGURES_BY_TYPE: Record<string, Set<string>> = {
  decompose: new Set(['parallelogram']),
  find_area_triangle_parallelogram: new Set(['triangle', 'parallelogram']),
  find_area_trapezoid: new Set(['trapezoid']),
  composite_area: new Set(['composite']),
  coordinate_polygon: new Set(['coordinate']),
};

// Intrinsic ceilings on the produced AREA, from the generator's uncapped
// randInt bands (gemini-polygon-area-builder.ts): decompose 12×9=108;
// tri/para max = parallelogram 14×10=140 (triangle ≤ 17·12/2=102); trapezoid
// ½(16+8)·10=120; composite 10·5+9·5=95; coordinate rectangle 8·6=48 — each
// rounded up so a legitimate max-range generation never trips scope when no
// topic ceiling exists.
const INTRINSIC_BY_MODE: Record<string, number> = {
  decompose: 110,
  find_area_triangle_parallelogram: 150,
  find_area_trapezoid: 125,
  composite_area: 100,
  coordinate_polygon: 50,
};
const DEFAULT_INTRINSIC = 150;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function near(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

interface Pt { x: number; y: number }

/** Signed-loop shoelace over the exact vertex order the canvas strokes. */
function shoelaceArea(pts: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Proper (interior) crossing of segments p1p2 and p3p4 — the simplicity test. */
function properlyCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True when any two NON-ADJACENT edges of the closed polygon properly cross. */
function selfIntersects(pts: Pt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (share a vertex), incl. the (0, n-1) wrap pair
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) continue;
      if (properlyCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Value-matched area-leak probes over narration/instruction/hint:
 * "area is 24", "answer = 24", "total: 24", "24 cm²", "24 square feet".
 * Linear dimension mentions ("the base is 12 cm") carry no ² and no area label,
 * so intended dimension scaffolding never matches.
 */
export function leakedAreaValues(text: string): number[] {
  const out: number[] = [];
  const labeled = /\b(?:area|answer|total)\b[^.?!\n]{0,60}?(?:=|:|\bis\b|\bequals\b)\s*(\d+(?:\.\d+)?)/gi;
  const squared = /\b(\d+(?:\.\d+)?)\s*(?:square\s+\w+|sq\.?\s*\w+|\w*²|\w+\^2)/gi;
  for (const re of [labeled, squared]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(parseFloat(m[1]));
  }
  return out;
}

interface RectPart { x: number; y: number; w: number; h: number }

function asRectParts(v: unknown): RectPart[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: RectPart[] = [];
  for (const p of v) {
    if (typeof p !== 'object' || p === null) return null;
    const r = p as Record<string, unknown>;
    if (!isNum(r.x) || !isNum(r.y) || !isNum(r.w) || !isNum(r.h)) return null;
    out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  }
  return out;
}

function asVertices(v: unknown): Pt[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Pt[] = [];
  for (const p of v) {
    if (typeof p !== 'object' || p === null) return null;
    const r = p as Record<string, unknown>;
    if (!isNum(r.x) || !isNum(r.y)) return null;
    out.push({ x: r.x, y: r.y });
  }
  return out;
}

export const polygonAreaBuilderOracle: ContentOracle = {
  componentId: 'polygon-area-builder',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    const topicCeiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);

    const areaValues: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── scope: the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const figureType = String(c.figureType ?? '');
      if (!FIGURES_BY_TYPE[type].has(figureType)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `figureType "${figureType}" is not drawable for challenge type "${type}" (expected ${Array.from(FIGURES_BY_TYPE[type]).join('/')})`,
        });
        continue;
      }

      const expectedArea = c.expectedArea;
      if (!isNum(expectedArea)) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `expectedArea=${String(expectedArea)} is not a finite number — the checker compares against it directly`,
        });
        continue;
      }
      if (typeof c.unitLabel !== 'string' || c.unitLabel.trim() === '') {
        violations.push({
          check: 'schema',
          where: id,
          detail: `missing/empty unitLabel — the canvas prints "<dim> <unit>" labels and the input suffix "<unit>²"`,
        });
      }

      // ── Re-derive the drawn figure's area (the independence rule) ──
      let derived: number | null = null;
      let cardKey = '';

      if (figureType === 'triangle' || figureType === 'parallelogram' || figureType === 'trapezoid') {
        const b = c.base;
        const h = c.height;
        if (!isNum(b) || !isNum(h) || (figureType === 'trapezoid' && !isNum(c.base2))) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `missing dimensions for ${figureType}: base=${String(c.base)} height=${String(c.height)}${figureType === 'trapezoid' ? ` base2=${String(c.base2)}` : ''}`,
          });
          continue;
        }
        const b2 = figureType === 'trapezoid' ? (c.base2 as number) : null;
        if (b <= 0 || h <= 0 || (b2 !== null && b2 <= 0)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `non-positive dimension (base=${b}, height=${h}${b2 !== null ? `, base2=${b2}` : ''}) — a degenerate/reversed figure the student cannot measure (shoelace |·| would hide the reversal)`,
          });
          continue;
        }
        checked++;

        if (figureType === 'triangle') {
          const apex = isNum(c.apexX) ? c.apexX : b / 2;
          derived = shoelaceArea([{ x: 0, y: 0 }, { x: b, y: 0 }, { x: apex, y: h }]);
          cardKey = `tri|b=${b}|h=${h}|apex=${apex}`;
        } else if (figureType === 'parallelogram') {
          const s = isNum(c.skew) ? c.skew : 1;
          derived = shoelaceArea([{ x: 0, y: 0 }, { x: b, y: 0 }, { x: b + s, y: h }, { x: s, y: h }]);
          cardKey = `para|b=${b}|h=${h}|s=${s}`;
          // (c) decompose reachability: the cut triangle [(off,0),(s+off,0),(s+off,h)]
          // must be grabbable (area > 0) and the remaining quad non-reversed.
          if (type === 'decompose' && (s < 1 || s > b - 1)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `decompose skew=${s} outside [1, ${b - 1}] — ${s < 1 ? 'a zero-area cut triangle can never be grabbed, so the answer input never unlocks' : 'the fixed remaining quad is reversed'} (unreachable correct state)`,
            });
          }
        } else {
          const off = isNum(c.topOffset) ? c.topOffset : (b - (b2 as number)) / 2;
          derived = shoelaceArea([
            { x: 0, y: 0 },
            { x: b, y: 0 },
            { x: off + (b2 as number), y: h },
            { x: off, y: h },
          ]);
          cardKey = `trap|b=${b}|b2=${b2}|h=${h}|off=${off}`;
        }
      } else if (figureType === 'composite') {
        const parts = asRectParts(c.parts);
        if (!parts || parts.length < 2) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `composite needs ≥2 well-formed rectangle parts, got ${JSON.stringify(c.parts)}`,
          });
          continue;
        }
        if (parts.some((p) => !Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.w) || !Number.isInteger(p.h))) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `non-integer composite part — the unit grid steps in whole units, so pieces must be grid-aligned: ${JSON.stringify(parts)}`,
          });
          continue;
        }
        if (parts.some((p) => p.w < 1 || p.h < 1)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `degenerate composite piece (w/h < 1) in ${JSON.stringify(parts)} — an invisible rectangle the key still counts`,
          });
          continue;
        }
        checked++;

        // (d) disjointness — overlap means Σw·h overstates the drawn union.
        let overlapped = false;
        for (let a = 0; a < parts.length && !overlapped; a++) {
          for (let bIdx = a + 1; bIdx < parts.length; bIdx++) {
            const pa = parts[a];
            const pb = parts[bIdx];
            const ow = Math.min(pa.x + pa.w, pb.x + pb.w) - Math.max(pa.x, pb.x);
            const oh = Math.min(pa.y + pa.h, pb.y + pb.h) - Math.max(pa.y, pb.y);
            if (ow > 0 && oh > 0) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `composite parts ${a} and ${bIdx} overlap by ${ow}×${oh} — the shipped key Σw·h counts that region twice, so the student summing the VISIBLE figure is marked wrong`,
              });
              overlapped = true;
              break;
            }
          }
        }
        // Disjoint rectangles: union area = Σ w·h — re-derived, not read from a key.
        derived = overlapped ? null : parts.reduce((s, p) => s + p.w * p.h, 0);
        cardKey = `comp|${parts.map((p) => `${p.x},${p.y},${p.w},${p.h}`).join(';')}`;

        // (e) hard-tier union-outline render contract (guides explicitly off).
        if (c.showDecompositionGuides === false) {
          if (parts.length !== 2) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `showDecompositionGuides=false with ${parts.length} parts — the hard-tier union outline is a 2-rect walk; the drawn boundary will not match the figure the key sums`,
            });
          } else {
            const bottom = parts[0].y <= parts[1].y ? parts[0] : parts[1];
            const top = bottom === parts[0] ? parts[1] : parts[0];
            const stacked = top.y === bottom.y + bottom.h;
            const aligned = top.x === bottom.x || top.x + top.w === bottom.x + bottom.w;
            if (!stacked || !aligned) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `showDecompositionGuides=false but the top rect is ${!stacked ? 'not stacked on the bottom rect' : 'flush to neither side'} — the L-outline walk (:643-659) draws a self-crossing/mislabeled boundary`,
              });
            }
          }
        }
      } else {
        // coordinate
        const vs = asVertices(c.vertices);
        if (!vs || vs.length < 3) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `coordinate polygon needs ≥3 well-formed vertices, got ${JSON.stringify(c.vertices)}`,
          });
          continue;
        }
        if (vs.some((v) => !Number.isInteger(v.x) || !Number.isInteger(v.y))) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `non-integer vertex — the coordinate grid and axis labels step in whole units: ${JSON.stringify(vs)}`,
          });
          continue;
        }
        checked++;

        // (f) first-quadrant anchor: getBounds pins the grid at the origin.
        if (vs.some((v) => v.x < 0 || v.y < 0)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `vertex outside the first quadrant in ${JSON.stringify(vs)} — the grid is anchored at the origin (:224), so the point plots off the labeled grid (uncountable)`,
          });
        }
        // (f) simplicity: shoelace only equals the painted region on a simple loop.
        if (selfIntersects(vs)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `vertex order self-intersects: ${vs.map((v) => `(${v.x},${v.y})`).join(' ')} — the stroked/filled shape no longer has the shoelace area the key stores`,
          });
        } else {
          derived = shoelaceArea(vs);
        }
        cardKey = `coord|${vs.map((v) => `${v.x},${v.y}`).join(';')}`;
      }

      // ── (a)/(b) the key must equal the drawn figure's area, and be non-zero ──
      if (derived !== null) {
        if (derived <= EPS) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the drawn ${figureType} has zero area — a degenerate figure`,
          });
        } else if (!near(expectedArea, derived)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `expectedArea=${expectedArea} but the drawn ${figureType} measures ${derived} — the student computing the figure on screen is marked wrong`,
          });
        }
      }

      // ── scope: the produced area honors the objective ceiling ──
      const ceiling = topicCeiling ?? INTRINSIC_BY_MODE[type] ?? DEFAULT_INTRINSIC;
      if (expectedArea > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `area ${expectedArea} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // ── answer-leak: the text must not state the asked area value ──
      const text = `${String(c.narration ?? '')} ${String(c.instruction ?? '')} ${String(c.hint ?? '')}`;
      if (leakedAreaValues(text).some((v) => near(v, expectedArea))) {
        violations.push({
          check: 'answer-leak',
          where: id,
          detail: `narration/instruction/hint states the asked area value ${expectedArea}: "${text.trim().slice(0, 120)}"`,
        });
      }

      areaValues.push(expectedArea);
      if (cardKey) cardSeen.set(cardKey, (cardSeen.get(cardKey) ?? 0) + 1);
    }

    // ── clustering: areas spread; no byte-identical figure card ──
    const variety = checkAnswerVariety(areaValues, 'challenges[].expectedArea');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical figure "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
