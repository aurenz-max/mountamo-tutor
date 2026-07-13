import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions } from './helpers';

/**
 * Function-sketch oracle — verifies the pre-built qualitative-function challenge
 * pool against the component's own judging contract, across all four types.
 *
 * The component (FunctionSketch.tsx, handleCheck :384-456) judges each type:
 *  - identify-features : the student CLICKS each feature; a hit registers when the
 *      click lands within tolerance of the feature (x, y); correct = all features
 *      hit. Key = features[].
 *  - classify-shape    : correct = selectedOption === correctType (MC over options).
 *  - sketch-match      : the student's spline is scored against keyFeatures — each
 *      kf contributes weight when the sketch passes within tolerance of (kf.x, kf.y).
 *      Key = keyFeatures[].
 *  - compare-functions : correct = selectedCurve === correctCurve ∈ {A, B}.
 *
 * THE INDEPENDENCE RULE — REACHABILITY over the drawn curve. The distinctive
 * failure mode here is a target the student cannot reach: a feature marker OFF
 * the reference curve (a "peak" floating in blank space the student can never
 * click on the curve), a keyFeature checkpoint that the reveal curve never
 * passes through, or a marker outside the plotted axes (off-canvas, unclickable).
 * This oracle re-derives reachability GEOMETRICALLY from the shipped curves:
 *  - every feature / keyFeature must lie WITHIN the plotted axes (clickable), and
 *  - a point-type feature (root / maximum / minimum / y-intercept; peak / zero /
 *    intercept for sketch) must lie ON the drawn curve — within tolerance of some
 *    sampled point of referenceCurve / revealCurve. A marker the curve never
 *    reaches is the unreachable-correct-state class this oracle catches.
 * For the MCQ types it verifies the winnable-and-unambiguous contract the way
 * knowledge-check does: correctType is present in options; correctCurve names a
 * real, non-empty curve.
 *
 * SCOPE — honest gap. Whether a classify-shape's correctType is the "right" name
 * for the curve, or a compare-functions' correctCurve truly matches the prose
 * question, is a SEMANTIC/perceptual judgment (linear vs quadratic vs exponential
 * by eye; does curve A "grow faster") with no robust code oracle — recorded as a
 * gap for /eval-test, never silently treated as covered. This oracle guarantees
 * the answer is selectable and the curve targets are reachable.
 *
 * Checks:
 *  - answer-key-desync :
 *      identify-features / sketch-match — a point-feature lies OFF the curve
 *        (unreachable), or any feature is outside the plotted axes (off-canvas).
 *      classify-shape — correctType is absent from options (unselectable).
 *      compare-functions — correctCurve is not 'A'/'B', or names an empty curve.
 *  - scope             : when ctx.evalMode names one of the four types, every
 *      challenge's type must match it (task identity). No numeric magnitude
 *      ceiling — the domain is set per challenge by the axes.
 *  - answer-leak       : classify-shape — the instruction must not name the
 *      correctType shape word (that hands over the MC answer).
 *  - clustering        : challenge instructions/answers must spread
 *      (checkAnswerVariety); no byte-identical card (same type + instruction).
 *  - schema            : ≥3 challenges (mastery-over-demo); known type; non-empty
 *      instruction; finite axes with xMin < xMax and yMin < yMax; per-type key
 *      fields present and well-formed (identify: non-empty referenceCurve +
 *      features; classify: correctType + ≥2 unique options; sketch: non-empty
 *      revealCurve + keyFeatures with weight > 0; compare: two non-empty curves
 *      + correctCurve).
 *
 * Deliberately NOT checked:
 *  - the SEMANTIC correctness of classify-shape's correctType / compare-functions'
 *    correctCurve vs the prose (perceptual — /eval-test).
 *  - whether a "maximum" feature is truly the curve's max (only that it lies on
 *    the curve) — extremum verification over a sampled spline is fragile; the
 *    reachability check catches the gross "marker in blank space" bug.
 *  - support-tier flags (showFeatureHints / showFeatureLabels): display-only.
 *  - the 'asymptote' / 'trend' feature types are NOT curve-point checked (an
 *    asymptote is a limit line, a trend is a direction — neither is a point on
 *    the curve); only their in-bounds placement is checked.
 */

const KNOWN_TYPES = new Set(['identify-features', 'classify-shape', 'sketch-match', 'compare-functions']);
/** Feature types that ARE points on the curve (so the on-curve check applies). */
const CURVE_POINT_FEATURES = new Set(['root', 'maximum', 'minimum', 'y-intercept', 'peak', 'zero', 'intercept']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
const norm = (s: string): string => s.trim().toLowerCase();

interface Pt { x: number; y: number }

function asCurve(v: unknown): Pt[] | null {
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

/** Minimum Euclidean distance from a point to any sampled curve point. */
function minDistToCurve(fx: number, fy: number, curve: Pt[]): number {
  let best = Infinity;
  for (const p of curve) {
    const d = Math.hypot(fx - p.x, fy - p.y);
    if (d < best) best = d;
  }
  return best;
}

interface Axes { xMin: number; xMax: number; yMin: number; yMax: number }
const inBounds = (x: number, y: number, a: Axes): boolean =>
  x >= a.xMin && x <= a.xMax && y >= a.yMin && y <= a.yMax;

/** Light content signature of a curve (length + endpoints) for duplicate detection. */
function curveSig(v: unknown): string {
  const c = asCurve(v);
  if (!c) return '';
  const f = c[0], l = c[c.length - 1];
  return `${c.length}:${f.x},${f.y}:${l.x},${l.y}`;
}
/** Signature of a feature/keyFeature list (type + position each). */
function featSig(v: unknown): string {
  if (!Array.isArray(v)) return '';
  return v.map((f) => {
    const r = f as Record<string, unknown>;
    return `${String(r.type)}@${String(r.x)},${String(r.y)}`;
  }).join('|');
}

export const functionSketchOracle: ContentOracle = {
  componentId: 'function-sketch',
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
    const answerValues: string[] = [];
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

      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      if (instruction.trim() === '' || !isNum(c.xMin) || !isNum(c.xMax) || !isNum(c.yMin) || !isNum(c.yMax) || c.xMin >= c.xMax || c.yMin >= c.yMax) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: instruction=${JSON.stringify(c.instruction)} axes=[${String(c.xMin)},${String(c.xMax)}]×[${String(c.yMin)},${String(c.yMax)}]`,
        });
        continue;
      }
      const axes: Axes = { xMin: c.xMin, xMax: c.xMax, yMin: c.yMin, yMax: c.yMax };
      const span = Math.max(axes.xMax - axes.xMin, axes.yMax - axes.yMin);
      // Generous on-curve / in-bounds slack: catch gross off-curve markers without
      // nitpicking spline sampling.
      const curveMargin = 0.1 * span;

      if (type === 'identify-features') {
        const referenceCurve = asCurve(c.referenceCurve);
        const features = Array.isArray(c.features) ? c.features : null;
        if (!referenceCurve || !features || features.length === 0) {
          violations.push({ check: 'schema', where: id, detail: `identify-features needs a non-empty referenceCurve and features (got referenceCurve=${referenceCurve ? 'ok' : 'bad'} features=${JSON.stringify(c.features)})` });
          continue;
        }
        checked++;
        for (let fi = 0; fi < features.length; fi++) {
          const f = features[fi] as Record<string, unknown>;
          if (!isNum(f.x) || !isNum(f.y)) {
            violations.push({ check: 'schema', where: id, detail: `feature ${fi} has non-numeric (x, y)` });
            continue;
          }
          const tol = isNum(f.tolerance) ? f.tolerance : 0;
          if (!inBounds(f.x, f.y, axes)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `feature "${String(f.label ?? f.type ?? fi)}" at (${f.x}, ${f.y}) is outside the plotted axes — off-canvas and unclickable` });
          } else if (CURVE_POINT_FEATURES.has(String(f.type)) && minDistToCurve(f.x, f.y, referenceCurve) > tol + curveMargin) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `feature "${String(f.label ?? f.type)}" at (${f.x}, ${f.y}) does not lie on the reference curve — the student can never click it on the curve (unreachable)` });
          }
        }
        answerValues.push(`feat:${id}`);
        const kIF = `identify-features#${norm(instruction)}#${curveSig(c.referenceCurve)}#${featSig(c.features)}`;
        cardSeen.set(kIF, (cardSeen.get(kIF) ?? 0) + 1);
      } else if (type === 'classify-shape') {
        const correctType = typeof c.correctType === 'string' ? c.correctType : '';
        const options = Array.isArray(c.options) ? c.options.map(String) : null;
        if (correctType === '' || !options || options.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `classify-shape needs correctType + ≥2 options (got correctType=${JSON.stringify(c.correctType)} options=${JSON.stringify(c.options)})` });
          continue;
        }
        checked++;
        const dup = checkUniqueOptions(options, id);
        if (dup) violations.push(dup);
        if (!options.map(norm).includes(norm(correctType))) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `correctType "${correctType}" is not among options [${options.join(', ')}] — the correct choice is unselectable` });
        }
        if (new RegExp(`\\b${norm(correctType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(norm(instruction))) {
          violations.push({ check: 'answer-leak', where: id, detail: `the instruction names the correct shape "${correctType}"` });
        }
        answerValues.push(`shape:${norm(correctType)}`);
        const kCS = `classify-shape#${norm(instruction)}#${norm(correctType)}#${curveSig(c.classifyCurve)}`;
        cardSeen.set(kCS, (cardSeen.get(kCS) ?? 0) + 1);
      } else if (type === 'sketch-match') {
        const revealCurve = asCurve(c.revealCurve);
        const keyFeatures = Array.isArray(c.keyFeatures) ? c.keyFeatures : null;
        if (!revealCurve || !keyFeatures || keyFeatures.length === 0) {
          violations.push({ check: 'schema', where: id, detail: `sketch-match needs a non-empty revealCurve and keyFeatures (got revealCurve=${revealCurve ? 'ok' : 'bad'} keyFeatures=${JSON.stringify(c.keyFeatures)})` });
          continue;
        }
        checked++;
        for (let ki = 0; ki < keyFeatures.length; ki++) {
          const kf = keyFeatures[ki] as Record<string, unknown>;
          if (!isNum(kf.x) || !isNum(kf.y)) {
            violations.push({ check: 'schema', where: id, detail: `keyFeature ${ki} has non-numeric (x, y)` });
            continue;
          }
          if (!isNum(kf.weight) || kf.weight <= 0) {
            violations.push({ check: 'schema', where: id, detail: `keyFeature ${ki} has non-positive weight ${String(kf.weight)} — it can never contribute to the score` });
          }
          const tol = isNum(kf.tolerance) ? kf.tolerance : 0;
          if (!inBounds(kf.x, kf.y, axes)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `keyFeature "${String(kf.description ?? kf.type ?? ki)}" at (${kf.x}, ${kf.y}) is outside the plotted axes — the student can never sketch through it` });
          } else if (CURVE_POINT_FEATURES.has(String(kf.type)) && minDistToCurve(kf.x, kf.y, revealCurve) > tol + curveMargin) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `keyFeature "${String(kf.description ?? kf.type)}" at (${kf.x}, ${kf.y}) does not lie on the reveal curve — the model answer never passes through the checkpoint` });
          }
        }
        answerValues.push(`sketch:${id}`);
        const kSM = `sketch-match#${norm(instruction)}#${curveSig(c.revealCurve)}#${featSig(c.keyFeatures)}`;
        cardSeen.set(kSM, (cardSeen.get(kSM) ?? 0) + 1);
      } else {
        // compare-functions
        const curveA = asCurve(c.curveA);
        const curveB = asCurve(c.curveB);
        const correctCurve = String(c.correctCurve ?? '');
        if (!curveA || !curveB) {
          violations.push({ check: 'schema', where: id, detail: `compare-functions needs non-empty curveA and curveB (got curveA=${curveA ? 'ok' : 'bad'} curveB=${curveB ? 'ok' : 'bad'})` });
          continue;
        }
        checked++;
        if (correctCurve !== 'A' && correctCurve !== 'B') {
          violations.push({ check: 'answer-key-desync', where: id, detail: `correctCurve="${correctCurve}" is not 'A' or 'B' — there is no gradable answer` });
        }
        // compare's answer is binary A/B — a variety check over 3 challenges would
        // false-fire (2-1 splits exceed the threshold), so clustering relies on the
        // byte-identical card key alone (the known small-domain caveat).
        const kCF = `compare-functions#${norm(instruction)}#${correctCurve}#${curveSig(c.curveA)}#${curveSig(c.curveB)}`;
        cardSeen.set(kCF, (cardSeen.get(kCF) ?? 0) + 1);
      }
    }

    // ── clustering: instructions/answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge "${key.slice(0, 80)}…" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
