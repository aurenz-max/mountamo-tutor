/**
 * function-sketch's in-item levers (/add-support-tiers; report qa/eval-reports/function-sketch-levers-2026-10-09.md).
 * The misses are what `functionSketchMiss` observes in the family or curve chosen, the features found, or the sketch's
 * match; there is no real-learner evidence.
 *
 * Help:
 * - `family_gallery` (classify): beside the graph, the parent shape of every choice's family, each under the choice's own
 *   name; never the item's curve, and every choice gets a panel, so none is singled out.
 * - `turn_marks` (classify, compare; where a curve turns or crosses the x-axis): a dot on the item's curve(s) at every
 *   turning point and x-axis crossing. No label, no family.
 * - `equal_steps` (classify, compare): a staircase of equal steps across under the curve(s): each riser shows how much
 *   the curve rises or falls over one step (equal risers: a line; risers that grow by a factor: exponential). No number.
 * - `feature_guide` (identify): what each kind of feature is, in words under the graph. No digit.
 * - `axis_glow` (identify, where a root or y-intercept is asked): both axes drawn bright: roots sit on the x-axis, the
 *   y-intercept on the y-axis. Nothing on the curve.
 * - `feature_names` (identify, where the tier hid the names): the list below names each feature's kind. No place.
 * - `model_features` (identify): a worked example beside the graph, a different curve with its roots, lowest point and
 *   y-intercept marked and named; never at one of the item's features.
 * - `sketch_steps` (sketch): the order to find a sketch's anchors, in words under the graph. No digit.
 * - `flip_model` (sketch, where the item is not one of its two parabolas): an inset of y = x² beside y = -x², the sign in
 *   front deciding which way it opens.
 * Simplify: `simpler_item` (every mode): the same task on an easier item, built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` carries a digit; a model never sits on the item (`modelLeaks`); a practice
 * item has its own id, ask, curve and answer, keeps the mode, and never offers the item's key (`practiceLeaks`).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FunctionSketchChallenge } from './FunctionSketch';
import type { CurvePoint } from './canvas-2d/types';
import {
  FUNCTION_SKETCH_MISSES_BY_MODE, familyOf, type Family, type FunctionSketchMiss, type FunctionSketchMode,
} from './functionSketchWorkspace';

export const FAMILY_GALLERY = 'family_gallery';
export const TURN_MARKS = 'turn_marks';
export const EQUAL_STEPS = 'equal_steps';
export const FEATURE_GUIDE = 'feature_guide';
export const AXIS_GLOW = 'axis_glow';
export const FEATURE_NAMES = 'feature_names';
export const MODEL_FEATURES = 'model_features';
export const SKETCH_STEPS = 'sketch_steps';
export const FLIP_MODEL = 'flip_model';
export const SIMPLER = 'simpler_item';

const SUFFIX = '~simpler';
export const isPracticeItem = (c: Pick<FunctionSketchChallenge, 'id'>) => c.id.endsWith(SUFFIX);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

// ── curves ───────────────────────────────────────────────────────────────

/** 20 samples of `f` from lo to hi, as the generator draws curves. */
export const sample = (f: (x: number) => number, lo: number, hi: number, n = 20): CurvePoint[] =>
  Array.from({ length: n }, (_, i) => { const x = lo + (i * (hi - lo)) / (n - 1); return { x, y: f(x) }; });

/** The y of a sampled curve at x (straight between samples). */
export function yAt(curve: readonly CurvePoint[], x: number): number {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (x <= b.x || i === curve.length - 1) return b.x === a.x ? b.y : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return curve[0]?.y ?? 0;
}

/** Where a sampled curve turns (a local high or low sample) or crosses y = 0 (straight between samples). */
export function turnsAndCrossings(curve: readonly CurvePoint[]): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 1; i < curve.length - 1; i++) {
    const a = curve[i - 1].y, b = curve[i].y, c = curve[i + 1].y;
    if ((b > a && b > c) || (b < a && b < c)) out.push(curve[i]);
  }
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (a.y === 0) out.push(a);
    else if (a.y * b.y < 0) out.push({ x: a.x + (a.y / (a.y - b.y)) * (b.x - a.x), y: 0 });
  }
  return out;
}

/** The staircase of equal steps under a curve: each step's corner points (run across, then rise or fall). */
export function staircase(curve: readonly CurvePoint[], steps = 6): Array<{ from: CurvePoint; corner: CurvePoint; to: CurvePoint }> {
  if (curve.length < 2) return [];
  const lo = curve[0].x, hi = curve[curve.length - 1].x, dx = (hi - lo) / steps;
  return Array.from({ length: steps }, (_, i) => {
    const x0 = lo + i * dx, x1 = x0 + dx, y0 = yAt(curve, x0), y1 = yAt(curve, x1);
    return { from: { x: x0, y: y0 }, corner: { x: x1, y: y0 }, to: { x: x1, y: y1 } };
  });
}

/** The curves the item draws. */
export function curvesOf(c: FunctionSketchChallenge): CurvePoint[][] {
  if (c.type === 'classify-shape') return c.classifyCurve ? [c.classifyCurve] : [];
  if (c.type === 'compare-functions') return [c.curveA, c.curveB].filter((x): x is CurvePoint[] => !!x);
  if (c.type === 'identify-features') return c.referenceCurve ? [c.referenceCurve] : [];
  return [];
}

// ── help: the models, outside the item ───────────────────────────────────

/** The parent shape of a family, on its own small plane from -3 to 3. */
export const PARENT: Partial<Record<Family, (x: number) => number>> = {
  linear: x => x,
  quadratic: x => x * x - 2,
  cubic: x => x * x * x / 3,
  polynomial: x => x ** 4 / 4 - 2 * x * x,
  exponential: x => 2 ** x - 3,
  logarithmic: x => (x > 0 ? Math.log2(x) : NaN),
  periodic: x => 2 * Math.sin(2 * x),
};

/** family_gallery: one panel per choice, under the choice's own name; the parent shape where the family is known. */
export function galleryPanels(c: FunctionSketchChallenge): Array<{ name: string; curve: CurvePoint[] | null }> {
  return (c.options ?? []).map(name => {
    const f = PARENT[familyOf(name)];
    return { name, curve: f ? sample(f, -3, 3, 40).filter(p => Number.isFinite(p.y) && Math.abs(p.y) <= 3.5) : null };
  });
}

/** The worked example for identify-features: y = (x - 1)² - 4 with its features marked and named. */
export const FEATURE_MODEL = {
  expression: 'y = (x - 1)² - 4',
  curve: sample(x => (x - 1) ** 2 - 4, -2, 4, 30),
  features: [
    { type: 'root', x: -1, y: 0, label: 'root' }, { type: 'root', x: 3, y: 0, label: 'root' },
    { type: 'minimum', x: 1, y: -4, label: 'minimum' }, { type: 'y-intercept', x: 0, y: -3, label: 'y-intercept' },
  ],
} as const;

const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
const plainExpr = (e: string | undefined) => (e ?? '').toLowerCase().replace(/\\left|\\right|[\s{}]/g, '')
  .replace(/^(?:y|[a-z]\(x\))=/, '').replace(/²/g, '^2');

/** Leak rule for a model: never on the item (a feature at one of the model's points, or the model's own function). */
export function modelLeaks(c: FunctionSketchChallenge, lever: string): boolean {
  if (lever === MODEL_FEATURES)
    return (c.features ?? []).some(f => FEATURE_MODEL.features.some(m => near(f.x, m.x) && near(f.y, m.y)))
      || plainExpr(c.expression) === plainExpr('(x-1)^2-4');
  if (lever === FLIP_MODEL) return ['x^2', '-x^2', 'x^{2}', '-x^{2}', 'x²', '-x²'].includes(plainExpr(c.sketchExpression));
  return false;
}

// ── simplify ─────────────────────────────────────────────────────────────

const hash = (s: string) => Array.from(s).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const NAME: Partial<Record<Family, string>> = { linear: 'linear', quadratic: 'quadratic', periodic: 'sinusoidal', exponential: 'exponential' };
const CLASSIFY_PRACTICE: Array<{ family: Family; f: (x: number) => number; yMin: number; yMax: number }> = [
  { family: 'linear', f: x => x, yMin: -4, yMax: 4 },
  { family: 'periodic', f: x => 2 * Math.sin(2 * x), yMin: -3, yMax: 3 },
  { family: 'quadratic', f: x => x * x - 2, yMin: -4, yMax: 8 },
  { family: 'exponential', f: x => 2 ** x, yMin: -1, yMax: 9 },
];
const COMPARE_PRACTICE: Array<{ question: string; right: (x: number) => number; other: (x: number) => number }> = [
  { question: 'Which curve is a straight line?', right: x => x + 1, other: x => x * x / 2 - 2 },
  { question: 'Which curve repeats the same up-and-down pattern?', right: x => 2 * Math.sin(2 * x) + 1, other: x => x },
  { question: 'Which curve grows faster and faster?', right: x => 2 ** x - 1, other: x => x + 2 },
];
const IDENTIFY_PRACTICE = [
  { expression: 'y = (x - 2)^2', f: (x: number) => (x - 2) ** 2, x: [-1, 5], y: [-2, 10],
    features: [{ type: 'minimum' as const, x: 2, y: 0, label: 'lowest point' }, { type: 'y-intercept' as const, x: 0, y: 4, label: 'y-intercept' }] },
  { expression: 'y = 6 - (x + 1)^2', f: (x: number) => 6 - (x + 1) ** 2, x: [-5, 3], y: [-6, 8],
    features: [{ type: 'maximum' as const, x: -1, y: 6, label: 'highest point' }, { type: 'y-intercept' as const, x: 0, y: 5, label: 'y-intercept' }] },
  { expression: 'y = (x + 2)^2 - 1', f: (x: number) => (x + 2) ** 2 - 1, x: [-5, 1], y: [-2, 8],
    features: [{ type: 'minimum' as const, x: -2, y: -1, label: 'lowest point' }, { type: 'y-intercept' as const, x: 0, y: 3, label: 'y-intercept' }] },
];
const SKETCH_PRACTICE = [
  { expression: 'y = x^2 - 1', f: (x: number) => x * x - 1, y: [-3, 9],
    description: 'A U-shaped parabola: it crosses the x-axis at x = -1 and x = 1, and its lowest point is (0, -1).',
    keys: [{ type: 'zero' as const, x: -1, y: 0, weight: 0.3, description: 'crosses at x = -1' },
      { type: 'zero' as const, x: 1, y: 0, weight: 0.3, description: 'crosses at x = 1' },
      { type: 'peak' as const, x: 0, y: -1, weight: 0.4, description: 'lowest point (0, -1)' }] },
  { expression: 'y = 4 - x^2', f: (x: number) => 4 - x * x, y: [-6, 6],
    description: 'An upside-down U: it crosses the x-axis at x = -2 and x = 2, and its highest point is (0, 4).',
    keys: [{ type: 'zero' as const, x: -2, y: 0, weight: 0.3, description: 'crosses at x = -2' },
      { type: 'zero' as const, x: 2, y: 0, weight: 0.3, description: 'crosses at x = 2' },
      { type: 'peak' as const, x: 0, y: 4, weight: 0.4, description: 'highest point (0, 4)' }] },
];

/**
 * The easier practice item for `c`, same mode: a textbook curve of a family that is not the key's with two far choices
 * (classify); a far-apart pair with a plain question (compare); a parabola with two named, ringed features (identify);
 * a parabola fully described (sketch). Null where no candidate differs from the item.
 */
export function simplerItem(c: FunctionSketchChallenge): FunctionSketchChallenge | null {
  if (isPracticeItem(c)) return null;
  const base = { id: `${c.id}${SUFFIX}`, type: c.type, xLabel: 'x', yLabel: 'y' } as const;
  const candidates: FunctionSketchChallenge[] = [];
  if (c.type === 'classify-shape') {
    const key = familyOf(c.correctType);
    const pool = CLASSIFY_PRACTICE.filter(p => p.family !== key);
    for (let i = 0; i + 1 < pool.length; i++) {
      const right = pool[i], other = pool[i + 1];
      const names = [NAME[right.family]!, NAME[other.family]!];
      candidates.push({ ...base, instruction: 'Practice first: which family does this curve belong to?', xMin: -3, xMax: 3,
        yMin: right.yMin, yMax: right.yMax, classifyCurve: sample(right.f, -3, 3),
        options: hash(c.id) % 2 ? names : [names[1], names[0]], correctType: names[0] });
    }
  } else if (c.type === 'compare-functions') {
    const rightIsA = hash(c.id) % 2 === 0;
    for (const t of COMPARE_PRACTICE) {
      const right = sample(t.right, -3, 3), other = sample(t.other, -3, 3);
      candidates.push({ ...base, instruction: 'Practice first: two curves are drawn.', question: t.question, xMin: -3, xMax: 3, yMin: -4, yMax: 8,
        curveA: rightIsA ? right : other, curveB: rightIsA ? other : right, labelA: 'Curve A', labelB: 'Curve B', correctCurve: rightIsA ? 'A' : 'B' });
    }
  } else if (c.type === 'identify-features') {
    for (const t of IDENTIFY_PRACTICE) {
      const tol = (t.x[1] - t.x[0]) * 0.06;
      candidates.push({ ...base, instruction: 'Practice first: tap the two marked features on this curve.', expression: t.expression,
        xMin: t.x[0], xMax: t.x[1], yMin: t.y[0], yMax: t.y[1], referenceCurve: sample(t.f, t.x[0], t.x[1]),
        features: t.features.map(f => ({ ...f, tolerance: tol })), showFeatureHints: true, showFeatureLabels: true });
    }
  } else {
    for (const t of SKETCH_PRACTICE) {
      candidates.push({ ...base, instruction: 'Practice first: sketch this parabola. Place a point where it crosses the x-axis and at its turning point.',
        sketchDescription: t.description, sketchExpression: t.expression, xMin: -3, xMax: 3, yMin: t.y[0], yMax: t.y[1],
        revealCurve: sample(t.f, -3, 3), minPoints: 3, keyFeatures: t.keys.map(k => ({ ...k, tolerance: 6 * 0.08 })) });
    }
  }
  return candidates.find(p => !practiceLeaks(c, p)) ?? null;
}

/**
 * Leak rule for a practice item: never the learner's item (id, ask, curve, expression), never its answer (the key's
 * family among the choices, the same question), and the same mode.
 */
export function practiceLeaks(parent: FunctionSketchChallenge, practice: FunctionSketchChallenge): boolean {
  if (practice.id === parent.id || practice.type !== parent.type || practice.instruction === parent.instruction) return true;
  if (parent.type === 'classify-shape') {
    const key = familyOf(parent.correctType);
    return (practice.options ?? []).some(o => o === parent.correctType || familyOf(o) === key);
  }
  if (parent.type === 'compare-functions') return (practice.question ?? '').toLowerCase() === (parent.question ?? '').toLowerCase();
  if (parent.type === 'identify-features') {
    return plainExpr(practice.expression) === plainExpr(parent.expression)
      || (practice.features ?? []).some(f => (parent.features ?? []).some(p => near(p.x, f.x) && near(p.y, f.y)));
  }
  return plainExpr(practice.sketchExpression) === plainExpr(parent.sketchExpression)
    || (practice.sketchDescription ?? '') === (parent.sketchDescription ?? '');
}

// ── declarations ─────────────────────────────────────────────────────────

const FEATURE_ASKED: Record<string, FunctionSketchMiss> = {
  root: 'missed_root', maximum: 'missed_extremum', minimum: 'missed_extremum', 'y-intercept': 'missed_intercept', asymptote: 'missed_asymptote',
};

export function functionSketchLevers(c: FunctionSketchChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeItem(c)) return [];
  const t: FunctionSketchMode = c.type;
  const all = FUNCTION_SKETCH_MISSES_BY_MODE[t];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly FunctionSketchMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  const turns = curvesOf(c).some(curve => turnsAndCrossings(curve).length > 0);
  if (t === 'classify-shape') {
    out.push(lever(FAMILY_GALLERY, 'help', 'both', all,
      'The learner cannot tell the families apart by their shapes.',
      'Shows, beside the graph, the basic shape of every family in the choices, each under its own name. The item\'s curve is '
        + 'not among them: the learner still matches it.'));
    if (turns) {
      out.push(lever(TURN_MARKS, 'help', 'shown', ['line_for_curve', 'polynomial_degree', 'periodic_family', 'wrong_family'],
        'The learner missed where the curve bends, or how many times it turns.',
        'Marks a dot on the curve at every turning point and every crossing of the x-axis. No label.'));
    }
    out.push(lever(EQUAL_STEPS, 'help', 'shown', ['line_for_curve', 'curve_for_line', 'growth_family', 'wrong_family'],
      'The learner confused a straight line with a curve, or two kinds of growth.',
      'Draws a staircase of equal steps across under the curve: each riser shows how much the curve rises or falls over one '
        + 'step. Equal risers make a line. No number.'));
  } else if (t === 'compare-functions') {
    out.push(lever(EQUAL_STEPS, 'help', 'shown', all,
      'The learner cannot see how the two curves change differently.',
      'Draws a staircase of equal steps across under both curves: each riser shows how much that curve rises or falls over one '
        + 'step. No number, and neither curve is singled out.'));
    if (turns) {
      out.push(lever(TURN_MARKS, 'help', 'shown', all,
        'The learner missed where the curves turn or cross the x-axis.',
        'Marks a dot on both curves at every turning point and every crossing of the x-axis. No label.'));
    }
  } else if (t === 'identify-features') {
    out.push(lever(FEATURE_GUIDE, 'help', 'both', all,
      'The learner confuses roots, turning points and intercepts, or does not know where to look.',
      'Writes under the graph what each kind of feature is: a root is where the curve crosses the x-axis, a maximum or minimum '
        + 'is where it turns, the y-intercept is where it crosses the y-axis, an asymptote is a line it approaches. No place.'));
    const asked = new Set((c.features ?? []).map(f => FEATURE_ASKED[f.type]));
    if (asked.has('missed_root') || asked.has('missed_intercept')) {
      out.push(lever(AXIS_GLOW, 'help', 'shown', ['missed_root', 'missed_intercept'],
        'The learner missed a root or the y-intercept.',
        'Draws both axes bright: roots sit on the x-axis, the y-intercept on the y-axis. Nothing is marked on the curve.'));
    }
    if (c.showFeatureLabels !== true) {
      out.push(lever(FEATURE_NAMES, 'help', 'shown', all,
        'The learner does not know which kinds of feature to look for.',
        'Names the kind of each feature in the list under the graph. It does not say where they are.'));
    }
    if (!modelLeaks(c, MODEL_FEATURES)) {
      out.push(lever(MODEL_FEATURES, 'help', 'both', all,
        'The learner does not know what a root, a turning point or an intercept looks like on a graph.',
        'Shows a worked example beside the graph: a different curve with its roots, its lowest point and its y-intercept '
          + 'marked and named. Read it aloud; it is never the item\'s curve.'));
    }
  } else {
    out.push(lever(SKETCH_STEPS, 'help', 'both', all,
      'The learner placed points without anchors, or missed a crossing, a turning point or the ends.',
      'Writes under the graph the order to find a sketch\'s anchors: where it crosses the x-axis, where it crosses the y-axis, '
        + 'where it turns, which way each end goes; then points between. No number.'));
    if (!modelLeaks(c, FLIP_MODEL)) {
      out.push(lever(FLIP_MODEL, 'help', 'both', ['upside_down', 'missed_peak', 'missed_trend'],
        'The learner drew the curve upside down, or the ends going the wrong way.',
        'Shows an example beside the graph: a parabola that opens up beside one that opens down, with the sign in front that '
          + 'decides it. It is never the item\'s function.'));
    }
  }
  if (simplerItem(c)) {
    out.push(lever(SIMPLER, 'simplify', 'shown', all,
      'This item is too big a step yet.',
      t === 'classify-shape' ? 'Opens an easier curve first: a textbook shape with two far-apart choices. It is not graded; the '
        + 'full item comes back after it.'
        : t === 'compare-functions' ? 'Opens an easier pair first: two very different curves and a plain question. It is not '
          + 'graded; the full item comes back after it.'
          : t === 'identify-features' ? 'Opens an easier curve first: a parabola with two features, ringed and named. It is not '
            + 'graded; the full item comes back after it.'
            : 'Opens an easier sketch first: a parabola whose crossings and turning point are written out. It is not graded; '
              + 'the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. Never a place, a family or a curve's letter. */
export function leverFacts(c: FunctionSketchChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeItem(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const both = c.type === 'compare-functions';
  return [
    on(FAMILY_GALLERY) && `Beside the graph, the basic shape of every choice's family, each under its name: ${(c.options ?? []).join(', ')}.`,
    on(TURN_MARKS) && `A dot marks every turning point and every x-axis crossing on ${both ? 'both curves' : 'the curve'}, unlabelled.`,
    on(EQUAL_STEPS) && `A staircase of equal steps across is drawn under ${both ? 'both curves' : 'the curve'}; each riser shows the rise or fall over one step, without numbers.`,
    on(FEATURE_GUIDE) && 'Under the graph: a root is where the curve crosses the x-axis; a maximum or minimum is where it turns; the y-intercept is where it crosses the y-axis; an asymptote is a line it approaches but never reaches.',
    on(AXIS_GLOW) && 'Both axes are drawn bright: roots sit on the x-axis, the y-intercept on the y-axis.',
    on(FEATURE_NAMES) && `The list under the graph names each feature's kind: ${(c.features ?? []).map(f => f.type).join(', ')}.`,
    on(MODEL_FEATURES) && `Beside the graph, a worked example on a different curve, ${FEATURE_MODEL.expression}: its two roots, its minimum and its y-intercept are marked and named.`,
    on(SKETCH_STEPS) && 'Under the graph, the order to sketch: find where it crosses the x-axis, where it crosses the y-axis, where it turns, and which way each end goes; then add points between.',
    on(FLIP_MODEL) && 'Beside the graph, an example: y = x² opens up and y = -x² opens down; the sign in front decides which way.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' when/does words: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
