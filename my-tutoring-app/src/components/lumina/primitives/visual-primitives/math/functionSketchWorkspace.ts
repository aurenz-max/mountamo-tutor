/**
 * Function sketch on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C20).
 *
 * Pure: the component, the adapter and the journey row read the same check, scene and harness input. Every mode is a
 * gesture item checked by the activity's own check: classify-shape by the family chosen (`correctType`),
 * compare-functions by the curve chosen (`correctCurve`), identify-features by the features found with taps on the curve
 * (every one), sketch-match by how close the learner's sketch passes to the item's key features (score 60 or more).
 * The tutor is never handed the answer: not the family, not the curve, not where a feature is, not the key features.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { FunctionSketchChallenge } from './FunctionSketch';
import { CANVAS_HEIGHT, CANVAS_WIDTH, PADDING, graphToCanvas, type CanvasConfig } from './canvas-2d/coords';
import { catmullRomSpline, featureDistance } from './canvas-2d/shapes';
import type { CurvePoint } from './canvas-2d/types';

export type FunctionSketchMode = FunctionSketchChallenge['type'];

// ── the drawn axes ───────────────────────────────────────────────────────

export function axesOf(c: FunctionSketchChallenge): CanvasConfig {
  return { xMin: c.xMin ?? -10, xMax: c.xMax ?? 10, yMin: c.yMin ?? -10, yMax: c.yMax ?? 10, xLabel: c.xLabel ?? 'x', yLabel: c.yLabel ?? 'y' };
}
const ranges = (c: FunctionSketchChallenge) => { const a = axesOf(c); return { xRange: a.xMax - a.xMin, yRange: a.yMax - a.yMin }; };

/** Whether a graph point lies inside the plotted axes (where a sketch tap is accepted). */
export function inPlot(c: FunctionSketchChallenge, p: CurvePoint): boolean {
  const { x, y } = graphToCanvas(p.x, p.y, axesOf(c));
  return x >= PADDING - 1e-6 && x <= CANVAS_WIDTH - PADDING + 1e-6 && y >= PADDING - 1e-6 && y <= CANVAS_HEIGHT - PADDING + 1e-6;
}

// ── the activity's check ─────────────────────────────────────────────────

/** The learner's work on the current item. */
export interface SketchWork {
  /** identify-features: indices of the features found. */
  found: readonly number[];
  /** identify-features: taps on the graph that landed on no feature. */
  strayTaps: number;
  /** classify-shape: the family chosen. */
  chosen: string | null;
  /** compare-functions: the curve chosen. */
  curve: 'A' | 'B' | null;
  /** sketch-match: the control points placed. */
  points: readonly CurvePoint[];
}
export const EMPTY_WORK: SketchWork = { found: [], strayTaps: 0, chosen: null, curve: null, points: [] };

/** identify-features: the index of the not-yet-found feature a tap at `p` lands on, or null. */
export function featureAt(c: FunctionSketchChallenge, p: CurvePoint, found: readonly number[]): number | null {
  const { xRange, yRange } = ranges(c);
  const features = c.features ?? [];
  for (let i = 0; i < features.length; i++) {
    if (found.includes(i)) continue;
    if (featureDistance(p, features[i], xRange, yRange) < (features[i].tolerance / Math.max(xRange, yRange)) + 0.04) return i;
  }
  return null;
}

/** sketch-match: each key feature's score (1 when the sketch passes within its tolerance), in the order of `keyFeatures`. */
export function keyFeatureScores(c: FunctionSketchChallenge, points: readonly CurvePoint[]): number[] {
  const { xRange, yRange } = ranges(c);
  const spline = points.length >= 2 ? catmullRomSpline([...points]) : [...points];
  return (c.keyFeatures ?? []).map(kf => {
    let minDist = Infinity;
    for (const pt of spline) minDist = Math.min(minDist, Math.sqrt(((pt.x - kf.x) / xRange) ** 2 + ((pt.y - kf.y) / yRange) ** 2));
    const tol = (kf.tolerance / Math.max(xRange, yRange)) + 0.05;
    return minDist <= tol ? 1 : Math.max(0, 1 - (minDist - tol) / (tol * 3));
  });
}

/** sketch-match: the weighted feature match, 0-100. */
export function sketchScore(c: FunctionSketchChallenge, points: readonly CurvePoint[]): number {
  const kfs = c.keyFeatures ?? [];
  const scores = keyFeatureScores(c, points);
  const total = kfs.reduce((s, kf) => s + kf.weight, 0);
  return total > 0 ? Math.round((kfs.reduce((s, kf, i) => s + scores[i] * kf.weight, 0) / total) * 100) : 0;
}
export const SKETCH_PASS = 60;
export const IDENTIFY_PASS = 80;

/** The activity's check of the work: the verdict and the score the primitive records. */
export function checkWork(c: FunctionSketchChallenge, work: SketchWork): { correct: boolean; score: number } {
  if (c.type === 'identify-features') {
    const total = c.features?.length ?? 0;
    const score = total ? Math.round((work.found.length / total) * 100) : 0;
    return { correct: score >= IDENTIFY_PASS, score };
  }
  if (c.type === 'classify-shape') {
    const correct = work.chosen != null && work.chosen === c.correctType;
    return { correct, score: correct ? 100 : 0 };
  }
  if (c.type === 'compare-functions') {
    const correct = work.curve != null && work.curve === c.correctCurve;
    return { correct, score: correct ? 100 : 0 };
  }
  const score = sketchScore(c, work.points);
  return { correct: score >= SKETCH_PASS, score };
}

/** Whether the work can be checked yet (the primitive's own Check gate). */
export function canCheck(c: FunctionSketchChallenge, work: SketchWork): boolean {
  if (c.type === 'identify-features') return work.found.length > 0;
  if (c.type === 'classify-shape') return work.chosen !== null;
  if (c.type === 'sketch-match') return work.points.length >= (c.minPoints ?? 3);
  return work.curve !== null;
}

// ── families ─────────────────────────────────────────────────────────────

export type Family = 'linear' | 'quadratic' | 'cubic' | 'polynomial' | 'exponential' | 'logarithmic' | 'periodic' | 'other';

/** A family name as the choices print it, normalized. */
export function familyOf(text: string | null | undefined): Family {
  const s = (text ?? '').toLowerCase();
  if (/\blinear\b/.test(s) && !/non-?linear/.test(s)) return 'linear';
  if (/quadratic|parabol/.test(s)) return 'quadratic';
  if (/cubic/.test(s)) return 'cubic';
  if (/quartic|polynomial/.test(s)) return 'polynomial';
  if (/exponential/.test(s)) return 'exponential';
  if (/log/.test(s)) return 'logarithmic';
  if (/sin|cos|trig|periodic|wave|oscillat/.test(s)) return 'periodic';
  return 'other';
}

/** Whether sampled points lie on one straight line (within 2% of the y range). */
export function isStraight(points: readonly CurvePoint[], yRange: number): boolean {
  if (points.length < 3 || !(yRange > 0)) return false;
  const a = points[0], b = points[points.length - 1];
  if (b.x === a.x) return false;
  const m = (b.y - a.y) / (b.x - a.x);
  return points.every(p => Math.abs(a.y + m * (p.x - a.x) - p.y) <= 0.02 * yRange);
}

// ── misses ───────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), drawn from the catalog's commonStruggles (roots and
 * extrema confused, families confused, points that miss the key features):
 * - classify-shape: `line_for_curve` chose linear for a curve; `curve_for_line` a curved family for a line;
 *   `polynomial_degree` one polynomial for another (quadratic, cubic); `growth_family` exponential or logarithmic
 *   confused with each other or with a polynomial; `periodic_family` periodic confused with anything; `wrong_family`;
 * - compare-functions: `other_curve`;
 * - identify-features: the first feature not found, `missed_root`, `missed_extremum` (a maximum or minimum),
 *   `missed_intercept`, `missed_asymptote`;
 * - sketch-match: `upside_down` the sketch would pass upside down (every y flipped); else the heaviest key feature the
 *   sketch misses, `missed_peak`, `missed_zero`, `missed_intercept`, `missed_trend`.
 */
export type FunctionSketchMiss = 'line_for_curve' | 'curve_for_line' | 'polynomial_degree' | 'growth_family' | 'periodic_family'
  | 'wrong_family' | 'other_curve' | 'missed_root' | 'missed_extremum' | 'missed_intercept' | 'missed_asymptote'
  | 'upside_down' | 'missed_peak' | 'missed_zero' | 'missed_trend';

export const FUNCTION_SKETCH_MISSES_BY_MODE: Record<FunctionSketchMode, readonly FunctionSketchMiss[]> = {
  'classify-shape': ['line_for_curve', 'curve_for_line', 'polynomial_degree', 'growth_family', 'periodic_family', 'wrong_family'],
  'compare-functions': ['other_curve'],
  'identify-features': ['missed_root', 'missed_extremum', 'missed_intercept', 'missed_asymptote'],
  'sketch-match': ['upside_down', 'missed_peak', 'missed_zero', 'missed_intercept', 'missed_trend'],
};

const POLY: readonly Family[] = ['quadratic', 'cubic', 'polynomial'];

/** classify-shape: the miss a chosen family shows against the key. */
export function familyMiss(key: Family, chosen: Family): FunctionSketchMiss {
  if (chosen === 'linear' && key !== 'linear') return 'line_for_curve';
  if (key === 'linear') return 'curve_for_line';
  if (key === 'periodic' || chosen === 'periodic') return 'periodic_family';
  if (POLY.includes(key) && POLY.includes(chosen)) return 'polynomial_degree';
  const growth = (f: Family) => f === 'exponential' || f === 'logarithmic';
  if ((growth(key) || growth(chosen)) && [key, chosen].every(f => growth(f) || POLY.includes(f))) return 'growth_family';
  return 'wrong_family';
}

const FEATURE_MISS: Record<string, FunctionSketchMiss> = {
  root: 'missed_root', maximum: 'missed_extremum', minimum: 'missed_extremum', 'y-intercept': 'missed_intercept', asymptote: 'missed_asymptote',
};
const KEY_FEATURE_MISS: Record<string, FunctionSketchMiss> = {
  peak: 'missed_peak', zero: 'missed_zero', intercept: 'missed_intercept', trend: 'missed_trend',
};

/** The miss a wrong check shows, or undefined when the check credits the work. */
export function functionSketchMiss(c: FunctionSketchChallenge, work: SketchWork): FunctionSketchMiss | undefined {
  if (checkWork(c, work).correct) return undefined;
  if (c.type === 'classify-shape') return work.chosen == null ? undefined : familyMiss(familyOf(c.correctType), familyOf(work.chosen));
  if (c.type === 'compare-functions') return work.curve == null ? undefined : 'other_curve';
  if (c.type === 'identify-features') {
    const missed = (c.features ?? []).findIndex((_, i) => !work.found.includes(i));
    return missed < 0 ? undefined : FEATURE_MISS[c.features![missed].type] ?? 'missed_root';
  }
  const flipped = work.points.map(p => ({ x: p.x, y: -p.y }));
  if (work.points.length && sketchScore(c, flipped) >= SKETCH_PASS) return 'upside_down';
  const scores = keyFeatureScores(c, work.points);
  const kfs = c.keyFeatures ?? [];
  const worst = kfs.map((kf, i) => ({ kf, i })).filter(({ i }) => scores[i] < 1)
    .sort((a, b) => b.kf.weight - a.kf.weight || scores[a.i] - scores[b.i])[0];
  return worst ? KEY_FEATURE_MISS[worst.kf.type] ?? 'missed_trend' : 'missed_trend';
}

// ── what the tutor is told ───────────────────────────────────────────────

const round = (n: number) => Math.round(n * 10) / 10;
const pt = (p: CurvePoint) => `(${round(p.x)}, ${round(p.y)})`;
export const labelOf = (c: FunctionSketchChallenge, curve: 'A' | 'B') => (curve === 'A' ? c.labelA : c.labelB) || `Curve ${curve}`;
const featureName = (c: FunctionSketchChallenge, i: number) =>
  c.showFeatureLabels === true && c.features?.[i]?.label ? `"${c.features[i].label}"` : `feature ${i + 1}`;

/** The learner's work in words, never the key. */
export function describeSketchWork(c: FunctionSketchChallenge, work: SketchWork): string {
  if (c.type === 'identify-features') {
    const total = c.features?.length ?? 0;
    const stray = work.strayTaps ? `; ${work.strayTaps} tap${work.strayTaps === 1 ? '' : 's'} landed on no feature` : '';
    if (!work.found.length) return `found none of the ${total} features yet${stray}`;
    return `found ${work.found.length} of ${total} features (${work.found.map(i => featureName(c, i)).join(', ')})${stray}`;
  }
  if (c.type === 'classify-shape') return work.chosen ? `chose "${work.chosen}"` : 'nothing chosen yet';
  if (c.type === 'compare-functions') return work.curve ? `chose Curve ${work.curve} ("${labelOf(c, work.curve)}")` : 'no curve chosen yet';
  if (!work.points.length) return 'no points placed yet';
  const sorted = [...work.points].sort((a, b) => a.x - b.x);
  return `placed ${sorted.length} point${sorted.length === 1 ? '' : 's'}, left to right: ${sorted.map(pt).join(', ')}`;
}

export function workspaceAssignment(c: FunctionSketchChallenge): TeachingAssignment {
  const ask = c.type === 'compare-functions' && c.question ? `${c.instruction} ${c.question}` : c.instruction;
  return { id: c.id, task: ask, response: 'gesture' };
}

const KIND: Record<FunctionSketchMode, string> = {
  'classify-shape': 'classify a curve: one curve is drawn on the graph, and the learner picks the family it belongs to from the choices',
  'identify-features': 'identify features: a curve is drawn, and the learner taps each key feature on it (roots, turning points, intercepts, asymptotes)',
  'compare-functions': 'compare two curves: Curve A (blue) and Curve B (amber) are drawn on the same axes, and the learner picks the one the question describes',
  'sketch-match': 'sketch a function: the graph is empty, and the learner taps points on it to sketch the described function; a smooth curve joins the points',
};

/** What is drawn and asked. Names and expressions only where the screen prints them; the key never. */
export function workspaceScene(c: FunctionSketchChallenge, view: { work: SketchWork }): WorkspaceScene {
  const a = axesOf(c);
  const facts: Record<string, string> = {
    kind: KIND[c.type],
    axes: `x (${a.xLabel}) runs from ${a.xMin} to ${a.xMax}; y (${a.yLabel}) runs from ${a.yMin} to ${a.yMax}`,
  };
  if (c.type === 'identify-features') {
    const n = c.features?.length ?? 0;
    if (c.expression) facts.expression = `the function shown is ${c.expression}`;
    facts.markers = c.showFeatureHints === false
      ? `the curve is bare: no feature is marked, and a list below counts ${n} features to find, unnamed`
      : c.showFeatureLabels !== true
        ? `a ring marks each of the ${n} features on the curve, unnamed`
        : `a ring marks each of the ${n} features on the curve, each named: ${(c.features ?? []).map(f => `"${f.label}"`).join(', ')}`;
    facts.rule = 'a tap on a feature turns it green; Check credits the item only when every feature is found';
  } else if (c.type === 'classify-shape') {
    facts.choices = `on screen: ${(c.options ?? []).join('; ')}`;
  } else if (c.type === 'compare-functions') {
    if (c.question) facts.question = c.question;
    facts.curves = `the buttons read "${labelOf(c, 'A')}" (Curve A, blue) and "${labelOf(c, 'B')}" (Curve B, amber)`;
  } else {
    if (c.sketchDescription) facts.description = `the description shown: ${c.sketchDescription}`;
    if (c.sketchExpression) facts.expression = `the expression shown: ${c.sketchExpression}`;
    facts.rule = `at least ${c.minPoints ?? 3} points are needed before Check; the sketch is scored on how close it passes to the function's key features; Clear removes every point`;
  }
  facts.learnerWork = describeSketchWork(c, view.work);
  facts.constraints = c.type === 'identify-features' || c.type === 'sketch-match'
    ? 'The learner taps the graph, then presses Check; the activity checks it itself. You cannot tap the graph or press Check.'
    : 'The learner taps one choice, then presses Check; the activity checks it itself. You cannot choose or press Check.';
  return { objects: [], facts };
}

// ── the journey row's input ──────────────────────────────────────────────

export type SketchHarnessInput =
  | { kind: 'choose'; label: string }
  | { kind: 'taps'; points: CurvePoint[] };

/** The canvas pixel of a graph point (the journey row taps there). */
export const canvasPixel = (c: FunctionSketchChallenge, p: CurvePoint) => graphToCanvas(p.x, p.y, axesOf(c));

/** sketch-match: the reveal curve's points inside the plot, a sketch the check must credit. */
export function revealSketch(c: FunctionSketchChallenge): CurvePoint[] {
  return (c.revealCurve ?? []).filter(p => inPlot(c, p));
}

/** sketch-match: a wrong sketch with a named miss when there is one: upside down, or a flat line high or low. */
export function wrongSketch(c: FunctionSketchChallenge): CurvePoint[] | null {
  const a = axesOf(c), n = Math.max(8, c.minPoints ?? 3);
  const flat = (y: number) => Array.from({ length: n }, (_, i) => ({ x: a.xMin + ((i + 0.5) / n) * (a.xMax - a.xMin), y }));
  const tries = [revealSketch(c).map(p => ({ x: p.x, y: -p.y })), flat(a.yMax - 0.1 * (a.yMax - a.yMin)), flat(a.yMin + 0.1 * (a.yMax - a.yMin))];
  const ok = tries.filter(t => t.length >= (c.minPoints ?? 3) && t.every(p => inPlot(c, p)) && sketchScore(c, t) < SKETCH_PASS);
  return ok[0] ?? null;
}

/** The key, or the item's first signature miss: a wrong choice with a named miss, one feature only, a wrong sketch. */
export function functionSketchHarnessInput(c: FunctionSketchChallenge, intent: 'correct' | 'wrong'): SketchHarnessInput {
  if (c.type === 'classify-shape') {
    const opts = c.options ?? [];
    if (intent === 'correct') return { kind: 'choose', label: c.correctType ?? '' };
    const wrong = opts.filter(o => o !== c.correctType);
    const named = wrong.find(o => familyMiss(familyOf(c.correctType), familyOf(o)) !== 'wrong_family');
    return { kind: 'choose', label: named ?? wrong[0] };
  }
  if (c.type === 'compare-functions') {
    const right = c.correctCurve === 'B' ? 'B' : 'A';
    return { kind: 'choose', label: labelOf(c, intent === 'correct' ? right : right === 'A' ? 'B' : 'A') };
  }
  if (c.type === 'identify-features') {
    const features = c.features ?? [];
    return { kind: 'taps', points: (intent === 'correct' ? features : features.slice(0, 1)).map(f => ({ x: f.x, y: f.y })) };
  }
  if (intent === 'correct') return { kind: 'taps', points: revealSketch(c) };
  const wrong = wrongSketch(c);
  if (!wrong) throw new Error(`function-sketch sketch-match ${c.id}: no wrong sketch the check refuses`);
  return { kind: 'taps', points: wrong };
}
