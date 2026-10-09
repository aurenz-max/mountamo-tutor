/**
 * Coordinate graph on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C19).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own check: plot_point by the grid crossing tapped, the other three by the choice tapped (the item's
 * `correctOptionIndex`, which the adapter refuses unless it is the one choice whose value is the key). The tutor is
 * never handed the answer: not the highlighted point's pair, not the slope, not the y-intercept.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { CoordinateGraphChallenge } from './CoordinateGraph';

export type CoordinateGraphMode = CoordinateGraphChallenge['type'];
export interface GridPoint { x: number; y: number }

// ── the drawn plane ──────────────────────────────────────────────────────

/** The SVG plane: a 500 x 500 viewBox with a 50-unit margin. */
export const PLANE = { size: 500, pad: 50 } as const;

/** A grid point's position in the plane's viewBox. */
export function planePixel(gridMin: number, gridMax: number, p: GridPoint): GridPoint {
  const draw = PLANE.size - 2 * PLANE.pad, span = gridMax - gridMin;
  return { x: PLANE.pad + ((p.x - gridMin) / span) * draw, y: PLANE.pad + ((gridMax - p.y) / span) * draw };
}

/** The grid crossing nearest a viewBox position, or null outside the grid. */
export function nearestCrossing(gridMin: number, gridMax: number, px: number, py: number): GridPoint | null {
  const draw = PLANE.size - 2 * PLANE.pad, span = gridMax - gridMin;
  const x = Math.round(((px - PLANE.pad) / draw) * span + gridMin);
  const y = Math.round(gridMax - ((py - PLANE.pad) / draw) * span);
  if (x < gridMin || x > gridMax || y < gridMin || y > gridMax) return null;
  return { x, y };
}

// ── numbers on the choices ───────────────────────────────────────────────

const pairText = (p: GridPoint) => `(${p.x}, ${p.y})`;

/** "(3, -2)" → { x: 3, y: -2 }; anything else null. */
export function parsePoint(text: string | undefined): GridPoint | null {
  const m = /^\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*$/.exec(text ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** "2/3", "-1", "0", "1.5", "-3/4" → its value; anything else null. */
export function parseNumber(text: string | undefined): number | null {
  const s = (text ?? '').replace(/\s/g, '').replace(/[−–]/g, '-');
  const frac = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export const riseOf = (c: CoordinateGraphChallenge) => c.y2 - c.y1;
export const runOf = (c: CoordinateGraphChallenge) => c.x2 - c.x1;
export const slopeOf = (c: CoordinateGraphChallenge) => riseOf(c) / runOf(c);
export const interceptOf = (c: CoordinateGraphChallenge) => c.y1 - slopeOf(c) * c.x1;

export function optionsOf(c: CoordinateGraphChallenge): string[] {
  return [c.option0, c.option1, c.option2, c.option3].filter((o): o is string => typeof o === 'string' && o.trim() !== '');
}

/** The value a choice stands for in this mode: a pair (read), a number (slope, intercept). */
function optionValue(c: CoordinateGraphChallenge, text: string): GridPoint | number | null {
  return c.type === 'read_point' ? parsePoint(text) : parseNumber(text);
}

/** Whether a choice's value is the item's key, computed from the drawn points (not from `correctOptionIndex`). */
export function optionIsKey(c: CoordinateGraphChallenge, text: string): boolean {
  const v = optionValue(c, text);
  if (v == null) return false;
  if (c.type === 'read_point') return typeof v === 'object' && v.x === c.x1 && v.y === c.y1;
  if (c.type === 'find_slope') return typeof v === 'number' && same(v, slopeOf(c));
  if (c.type === 'find_intercept') return typeof v === 'number' && same(v, interceptOf(c));
  return false;
}

/** The key as the screen would print it: the pair to plot or read, the slope or intercept choice. */
export function keyText(c: CoordinateGraphChallenge): string {
  if (c.type === 'plot_point' || c.type === 'read_point') return pairText({ x: c.x1, y: c.y1 });
  return optionsOf(c).find(o => optionIsKey(c, o)) ?? '';
}

// ── the activity's check ─────────────────────────────────────────────────

/** The learner's work on the current item: the crossing tapped (plot), or the choice tapped (the rest). */
export interface CoordinateWork { placed: GridPoint | null; chosen: number | null }

export function plotCorrect(c: CoordinateGraphChallenge, p: GridPoint): boolean {
  return p.x === c.x1 && p.y === c.y1;
}

export function choiceCorrect(c: CoordinateGraphChallenge, index: number): boolean {
  return index === c.correctOptionIndex;
}

const ORDINAL = ['first', 'second', 'third', 'fourth'];

/**
 * The learner's work in words, never the key. A slope or intercept choice is named by its place in the choices (the
 * scene lists them in order): its number would often hold the key's digits ("-2" or "1/2" beside a key of 2).
 */
export function describeCoordinateWork(c: CoordinateGraphChallenge, work: CoordinateWork): string {
  if (c.type === 'plot_point') return work.placed ? `placed a point at ${pairText(work.placed)}` : 'no point placed yet';
  const text = work.chosen != null ? [c.option0, c.option1, c.option2, c.option3][work.chosen] : undefined;
  if (!text || work.chosen == null) return 'nothing chosen yet';
  return c.type === 'read_point' ? `chose ${text}` : `chose the ${ORDINAL[work.chosen]} choice`;
}

// ── misses ───────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the point placed or the choice's value, drawn from
 * the catalog's commonStruggles (x and y swapped, negative directions, slope upside down, slope and intercept confused):
 * - plot and read: `swapped` (y, x); `both_signs` (-x, -y); `x_sign` (-x, y); `y_sign` (x, -y); `one_axis` a point on
 *   an axis at one of the two numbers (only one direction moved); `off_by_one` one grid step from the point;
 *   `wrong_point` anything else;
 * - slope: `opposite_sign` -m; `reciprocal` run over rise; `negative_reciprocal` -run over rise; `rise_only` the rise
 *   alone; `run_only` the run alone; `wrong_slope` anything else;
 * - intercept: `opposite_sign` -b; `slope_instead` the slope m; `x_intercept` where the line crosses the x-axis;
 *   `point_y` the y of a marked point (read at the point, not at the crossing); `off_by_one` b plus or minus one;
 *   `wrong_intercept` anything else.
 */
export type CoordinateMiss = 'swapped' | 'both_signs' | 'x_sign' | 'y_sign' | 'one_axis' | 'off_by_one' | 'wrong_point'
  | 'opposite_sign' | 'reciprocal' | 'negative_reciprocal' | 'rise_only' | 'run_only' | 'wrong_slope'
  | 'slope_instead' | 'x_intercept' | 'point_y' | 'wrong_intercept';

const POINT_MISSES: readonly CoordinateMiss[] = ['swapped', 'both_signs', 'x_sign', 'y_sign', 'one_axis', 'off_by_one', 'wrong_point'];
export const COORDINATE_MISSES_BY_MODE: Record<CoordinateGraphMode, readonly CoordinateMiss[]> = {
  plot_point: POINT_MISSES,
  read_point: POINT_MISSES,
  find_slope: ['opposite_sign', 'reciprocal', 'negative_reciprocal', 'rise_only', 'run_only', 'wrong_slope'],
  find_intercept: ['opposite_sign', 'slope_instead', 'x_intercept', 'point_y', 'off_by_one', 'wrong_intercept'],
};

/** The miss a wrong point shows against the key point. */
export function pointMiss(key: GridPoint, p: GridPoint): CoordinateMiss | undefined {
  if (p.x === key.x && p.y === key.y) return undefined;
  if (p.x === key.y && p.y === key.x) return 'swapped';
  if (p.x === -key.x && p.y === -key.y) return 'both_signs';
  if (p.x === -key.x && p.y === key.y) return 'x_sign';
  if (p.x === key.x && p.y === -key.y) return 'y_sign';
  if ((p.x === key.x && p.y === 0) || (p.x === 0 && p.y === key.y) || (p.x === key.y && p.y === 0) || (p.x === 0 && p.y === key.x))
    return 'one_axis';
  if (Math.abs(p.x - key.x) + Math.abs(p.y - key.y) === 1) return 'off_by_one';
  return 'wrong_point';
}

/** The values each signature miss stands for on a slope or intercept item, most specific first. */
export function signatureValues(c: CoordinateGraphChallenge): Array<[CoordinateMiss, number]> {
  const rise = riseOf(c), run = runOf(c), m = slopeOf(c);
  const out: Array<[CoordinateMiss, number]> = [];
  if (c.type === 'find_slope') {
    out.push(['opposite_sign', -m]);
    if (rise !== 0) out.push(['reciprocal', run / rise], ['negative_reciprocal', -run / rise]);
    out.push(['rise_only', rise], ['run_only', run]);
  } else if (c.type === 'find_intercept') {
    const b = interceptOf(c);
    out.push(['opposite_sign', -b], ['slope_instead', m]);
    if (m !== 0) out.push(['x_intercept', -b / m]);
    for (const p of [{ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }]) if (p.x !== 0) out.push(['point_y', p.y]);
    out.push(['off_by_one', b + 1], ['off_by_one', b - 1]);
  }
  return out.filter(([, v]) => Number.isFinite(v));
}

/** The miss a value shows on a slope or intercept item. */
export function valueMiss(c: CoordinateGraphChallenge, v: number): CoordinateMiss | undefined {
  const key = c.type === 'find_slope' ? slopeOf(c) : interceptOf(c);
  if (same(v, key)) return undefined;
  const hit = signatureValues(c).find(([, s]) => !same(s, key) && same(s, v));
  if (hit) return hit[0];
  return c.type === 'find_slope' ? 'wrong_slope' : 'wrong_intercept';
}

/** The miss a wrong check shows: the point placed (plot), or the chosen choice's value. */
export function coordinateMiss(c: CoordinateGraphChallenge, work: CoordinateWork): CoordinateMiss | undefined {
  const key = { x: c.x1, y: c.y1 };
  if (c.type === 'plot_point') return work.placed ? pointMiss(key, work.placed) : undefined;
  if (work.chosen == null || choiceCorrect(c, work.chosen)) return undefined;
  const text = [c.option0, c.option1, c.option2, c.option3][work.chosen];
  const v = text != null ? optionValue(c, text) : null;
  if (c.type === 'read_point') return v != null && typeof v === 'object' ? pointMiss(key, v) : 'wrong_point';
  return typeof v === 'number' ? valueMiss(c, v) : c.type === 'find_slope' ? 'wrong_slope' : 'wrong_intercept';
}

// ── what the tutor is told ───────────────────────────────────────────────

export function workspaceAssignment(c: CoordinateGraphChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** A slope as an equation's coefficient: "2", "-1/3"; "" for 1, "-" for -1. */
function coefficient(rise: number, run: number): string {
  if (rise === 0) return '0';
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  const d = g(rise, run), sign = (rise < 0) !== (run < 0) ? '-' : '';
  const n = Math.abs(rise) / d, k = Math.abs(run) / d;
  if (k === 1) return n === 1 ? sign : `${sign}${n}`;
  return `${sign}(${n}/${k})`;
}

/** The equation label the intercept item draws: the slope, with the intercept a question mark. */
export function maskedEquation(c: CoordinateGraphChallenge): string {
  const k = coefficient(riseOf(c), runOf(c));
  return k === '0' ? 'y = ?' : `y = ${k}x + ?`;
}

const direction = (c: CoordinateGraphChallenge) => {
  const m = slopeOf(c);
  return m > 0 ? 'rises from left to right' : m < 0 ? 'falls from left to right' : 'is flat (horizontal)';
};

const KIND: Record<CoordinateGraphMode, string> = {
  plot_point: 'plot a point: tap the grid crossing at the ordered pair the instruction names (x first: across; y second: up or down)',
  read_point: 'read a point: one highlighted point is drawn, and the learner picks its ordered pair from the choices',
  find_slope: 'slope: a line through two drawn points, and the learner picks its slope (rise over run) from the choices',
  find_intercept: 'y-intercept: a line drawn across the grid, and the learner picks the y-value where it crosses the y-axis from the choices',
};

/** What is drawn and asked. Pairs and numbers only where the plane prints them; the key never. */
export function workspaceScene(c: CoordinateGraphChallenge, view: { gridMin: number; gridMax: number; work: CoordinateWork }): WorkspaceScene {
  const numbered = c.showAxisLabels !== false;
  const facts: Record<string, string> = {
    kind: KIND[c.type],
    grid: `x and y each run from ${view.gridMin} to ${view.gridMax}; ${numbered ? 'the axes are numbered'
      : 'the axes are not numbered, so the learner counts grid lines from the origin'}`,
  };
  if (c.type === 'plot_point') {
    facts.aids = c.showHoverReadout !== false
      ? 'while the pointer is over the grid, the crossing under it shows its ordered pair'
      : 'no ordered pair shows under the pointer';
  } else if (c.type === 'read_point') {
    facts.aids = c.showDropLines ? 'dashed lines run from the point straight to each axis' : 'no guide lines from the point to the axes';
  } else if (c.type === 'find_slope') {
    facts.line = `the line ${direction(c)}`;
    facts.points = c.showPointLabels !== false
      ? `the two points are labelled (${c.x1}, ${c.y1}) and (${c.x2}, ${c.y2})` : 'the two points are not labelled';
    facts.triangle = c.showRiseRunGuides === false ? 'no rise and run triangle is drawn'
      : c.showRiseRunLabels !== false ? `a dashed rise and run triangle is drawn, labelled rise = ${riseOf(c)} and run = ${runOf(c)}`
        : 'a dashed rise and run triangle is drawn, without numbers';
  } else {
    facts.line = `the line runs across the whole grid and ${direction(c)}; two points on it are marked, not labelled`;
    facts.crossing = c.showInterceptMarker !== false
      ? 'where the line crosses the y-axis is marked with a question mark' : 'the crossing is not marked';
    if (c.equationLabel && c.showEquationLabel !== false) facts.equation = `a label on the line reads ${maskedEquation(c)}`;
  }
  if (c.type !== 'plot_point') facts.choices = `on screen, in order: ${optionsOf(c).join('; ')}`;
  facts.learnerWork = describeCoordinateWork(c, view.work);
  facts.constraints = c.type === 'plot_point'
    ? 'The learner taps a grid crossing to place the point; the activity checks it itself. You cannot tap the grid.'
    : 'The learner taps one choice; the activity checks it itself. You cannot choose.';
  return { objects: [], facts };
}

// ── the journey row's input ──────────────────────────────────────────────

export type CoordinateHarnessInput = { kind: 'plot'; point: GridPoint } | { kind: 'choose'; label: string };

/** The key, or the item's first signature miss: a wrong crossing in the grid, or a wrong choice with a named miss. */
export function coordinateHarnessInput(c: CoordinateGraphChallenge, intent: 'correct' | 'wrong',
  grid: { gridMin: number; gridMax: number }): CoordinateHarnessInput {
  const opts = [c.option0, c.option1, c.option2, c.option3];
  if (c.type === 'plot_point') {
    const key = { x: c.x1, y: c.y1 };
    if (intent === 'correct') return { kind: 'plot', point: key };
    const inGrid = (p: GridPoint) => p.x >= grid.gridMin && p.x <= grid.gridMax && p.y >= grid.gridMin && p.y <= grid.gridMax;
    const tries = [{ x: key.y, y: key.x }, { x: -key.x, y: key.y }, { x: key.x, y: -key.y }, { x: key.x + 1, y: key.y }, { x: key.x - 1, y: key.y }];
    return { kind: 'plot', point: tries.find(p => inGrid(p) && !plotCorrect(c, p))! };
  }
  if (intent === 'correct') return { kind: 'choose', label: opts[c.correctOptionIndex ?? 0] ?? '' };
  const wrong = opts.map((t, i) => ({ t, i })).filter(o => o.t && !choiceCorrect(c, o.i));
  const named = wrong.find(o => { const m = coordinateMiss(c, { placed: null, chosen: o.i }); return m && !m.startsWith('wrong_'); });
  return { kind: 'choose', label: (named ?? wrong[0]).t! };
}
