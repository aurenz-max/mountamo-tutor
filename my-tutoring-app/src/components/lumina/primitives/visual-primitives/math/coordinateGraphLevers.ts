/**
 * coordinate-graph's in-item levers (/add-support-tiers; report qa/eval-reports/coordinate-graph-levers-2026-10-09.md).
 * The misses are what `coordinateMiss` observes in the crossing tapped or the choice taken; there is no real-learner
 * evidence.
 *
 * Help:
 * - `axis_guide` (plot, read): names each axis's direction (x across, y up or down) and writes each quadrant's sign
 *   pattern, (+, +) and so on. No digit.
 * - `every_line` (plot, read; where a grid line goes unnumbered): numbers every grid line on both axes.
 * - `drop_lines` (read, where not drawn): dashed lines from the point straight to each axis.
 * - `rise_run_triangle` (slope, where not drawn) and `unit_steps` (slope, where the legs are unlabelled): the triangle on
 *   the line; a tick at every grid step along its legs. No number.
 * - `slope_frame` (slope) and `intercept_frame` (intercept): the definition under the plane in words. No digit.
 * - `crossing_marker` (intercept, where hidden): a question mark where the line meets the y-axis.
 * - `model_point` (plot, read) and `model_line` (slope, intercept): a worked example outside the item, a different point
 *   drawn with its moves, or a different line in an inset with its slope or crossing worked out.
 * Simplify: `simpler_item` (every mode): the same task on a smaller point, a line with a small reduced rise and run, or a
 * line with slope one that crosses near its marked points, built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` carries a digit; a model's caption holds no number equal to the key and its
 * value is never the key; `every_line` is not offered where the key is a lone number (intercept); a practice item has its
 * own id, ask, points and answer, and keeps the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CoordinateGraphChallenge } from './CoordinateGraph';
import {
  COORDINATE_MISSES_BY_MODE, interceptOf, keyText, optionIsKey, optionsOf, parseNumber, parsePoint, runOf, riseOf, slopeOf,
  type CoordinateGraphMode, type CoordinateMiss, type GridPoint,
} from './coordinateGraphWorkspace';

export const AXIS_GUIDE = 'axis_guide';
export const EVERY_LINE = 'every_line';
export const DROP_LINES = 'drop_lines';
export const MODEL_POINT = 'model_point';
export const RISE_RUN = 'rise_run_triangle';
export const UNIT_STEPS = 'unit_steps';
export const SLOPE_FRAME = 'slope_frame';
export const CROSSING = 'crossing_marker';
export const INTERCEPT_FRAME = 'intercept_frame';
export const MODEL_LINE = 'model_line';
export const SIMPLER = 'simpler_item';

export interface Grid { gridMin: number; gridMax: number }

const SUFFIX = '~simpler';
export const isPracticeItem = (c: Pick<CoordinateGraphChallenge, 'id'>) => c.id.endsWith(SUFFIX);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

/** The plane's label step: every other line on a grid wider than 14. */
export const labelStep = (g: Grid) => (g.gridMax - g.gridMin > 14 ? 2 : 1);

// ── numbers ──────────────────────────────────────────────────────────────

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** A ratio as the choices print it: "2", "-1/3", "0". */
export function ratioText(rise: number, run: number): string {
  if (rise === 0) return '0';
  const g = gcd(rise, run), sign = (rise < 0) !== (run < 0) ? '-' : '';
  const n = Math.abs(rise) / g, d = Math.abs(run) / g;
  return d === 1 ? `${sign}${n}` : `${sign}${n}/${d}`;
}
const pair = (p: GridPoint) => `(${p.x}, ${p.y})`;
const moves = (p: GridPoint) => {
  const across = p.x === 0 ? 'no steps across' : `${Math.abs(p.x)} ${p.x > 0 ? 'right' : 'left'}`;
  const up = p.y === 0 ? 'no steps up or down' : `${Math.abs(p.y)} ${p.y > 0 ? 'up' : 'down'}`;
  return `${across}, then ${up}`;
};
const inGrid = (g: Grid, p: GridPoint) => p.x >= g.gridMin && p.x <= g.gridMax && p.y >= g.gridMin && p.y <= g.gridMax;

/** The numbers a caption writes, as printed ("-2", "1/2", "(3, -2)" gives "3" and "-2"). */
const numbersIn = (text: string) => text.match(/-?\d+(?:\/\d+)?/g) ?? [];

/** The key's value(s): the pair's two numbers (plot, read), or the slope or intercept. */
function keyValues(c: CoordinateGraphChallenge): number[] {
  if (c.type === 'plot_point' || c.type === 'read_point') return [c.x1, c.y1];
  return [c.type === 'find_slope' ? slopeOf(c) : interceptOf(c)];
}

/** Leak rule for a model's caption: no number in it has the key's value, nor (pair keys) the key's pair. */
export function captionLeaks(c: CoordinateGraphChallenge, caption: string): boolean {
  if (c.type === 'plot_point' || c.type === 'read_point')
    return caption.replace(/\s/g, '').includes(pair({ x: c.x1, y: c.y1 }).replace(/\s/g, ''));
  const [key] = keyValues(c);
  return numbersIn(caption).some(t => { const v = parseNumber(t); return v != null && Math.abs(v - key) < 1e-9; });
}

// ── help: the worked models, outside the item ────────────────────────────

export interface PointModel { point: GridPoint; caption: string }

/**
 * A different point to model plotting on: magnitudes 1-5, unequal, neither one of the key's magnitudes, not a choice on
 * screen, in another quadrant than the key where the grid has one.
 */
export function pointModel(c: CoordinateGraphChallenge, g: Grid): PointModel | null {
  if (c.type !== 'plot_point' && c.type !== 'read_point') return null;
  const taken = new Set([Math.abs(c.x1), Math.abs(c.y1)]);
  const onScreen = optionsOf(c).map(o => parsePoint(o)).filter((p): p is GridPoint => !!p);
  const quadrant = (p: GridPoint) => `${Math.sign(p.x)}${Math.sign(p.y)}`;
  const cands: GridPoint[] = [];
  for (const [a, b] of [[3, 2], [2, 4], [4, 1], [1, 3], [5, 2], [2, 5], [3, 1], [1, 4], [4, 3], [5, 3], [3, 5], [5, 1]])
    for (const [sx, sy] of [[1, -1], [-1, 1], [-1, -1], [1, 1]]) cands.push({ x: a * sx, y: b * sy });
  const ok = (p: GridPoint) => inGrid(g, p) && !taken.has(Math.abs(p.x)) && !taken.has(Math.abs(p.y))
    && !onScreen.some(o => o.x === p.x && o.y === p.y);
  const point = cands.find(p => ok(p) && quadrant(p) !== quadrant({ x: c.x1, y: c.y1 })) ?? cands.find(ok);
  if (!point) return null;
  const model = { point, caption: `Example ${pair(point)}: from the origin, ${moves(point)}` };
  return captionLeaks(c, model.caption) ? null : model;
}

export interface LineModel {
  /** The inset's own two points (an inset plane from -4 to 4). */
  a: GridPoint; b: GridPoint;
  /** The crossing to mark, for an intercept model. */
  crossing: number | null;
  caption: string;
}

const SLOPE_MODELS: Array<[number, number]> = [[1, 2], [2, 1], [3, 1], [1, 3], [-1, 2], [-2, 1], [-3, 1], [-1, 3], [2, 3], [3, 2], [-2, 3], [-3, 2]];

/** A worked line outside the item: a different slope with its rise and run, or a different crossing. */
export function lineModel(c: CoordinateGraphChallenge): LineModel | null {
  const onScreen = optionsOf(c).map(o => parseNumber(o)).filter((v): v is number => v != null);
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-9;
  if (c.type === 'find_slope') {
    for (const [rise, run] of SLOPE_MODELS) {
      const m = rise / run;
      if (near(m, slopeOf(c)) || onScreen.some(v => near(v, m))) continue;
      const a = { x: -2, y: rise > 0 ? -2 : 2 }, b = { x: -2 + run, y: (rise > 0 ? -2 : 2) + rise };
      const caption = `Example: rise ${rise}, run ${run}, so slope = ${rise} ÷ ${run} = ${ratioText(rise, run)}`;
      if (!captionLeaks(c, caption)) return { a, b, crossing: null, caption };
    }
    return null;
  }
  if (c.type === 'find_intercept') {
    for (const k of [2, -1, 3, -2, 1, -3]) for (const m of [1, -1, 2, -2]) {
      if (near(k, interceptOf(c)) || onScreen.some(v => near(v, k))) continue;
      const a = { x: 1, y: m + k }, b = { x: 2, y: 2 * m + k };
      if ([a.y, b.y].some(y => Math.abs(y) > 4)) continue;
      const caption = `Example: this line meets the y-axis at y = ${k}, so its y-intercept is ${k}`;
      if (!captionLeaks(c, caption)) return { a, b, crossing: k, caption };
    }
  }
  return null;
}

// ── simplify ─────────────────────────────────────────────────────────────

/** Four choices with the key at `at`; a distractor is never the key, a repeat, or `avoid` (the learner's item's key). */
function withChoices(base: CoordinateGraphChallenge, key: string, distractors: string[], at: number, avoid: string): CoordinateGraphChallenge | null {
  const norm = (o: string) => o.replace(/\s/g, '');
  const opts: string[] = [];
  for (const d of distractors) {
    if (opts.length < 3 && norm(d) !== norm(key) && norm(d) !== norm(avoid) && !opts.some(o => norm(o) === norm(d))) opts.push(d);
  }
  if (opts.length < 3) return null;
  opts.splice(at % 4, 0, key);
  const item = { ...base, option0: opts[0], option1: opts[1], option2: opts[2], option3: opts[3], correctOptionIndex: at % 4 };
  // Exactly the indexed choice has the key's value.
  return optionsOf(item).filter(o => optionIsKey(item, o)).length === 1 && optionIsKey(item, opts[at % 4]) ? item : null;
}

/**
 * The easier practice item for `c`, same mode: a point with small magnitudes in the key's quadrant (plot, read); a
 * line with a small, already reduced rise and run of the key's sign, labelled (slope); a line of slope one that crosses
 * one step from its first marked point, marked (intercept). Null where the item is already that simple.
 */
export function simplerItem(c: CoordinateGraphChallenge, g: Grid): CoordinateGraphChallenge | null {
  if (isPracticeItem(c)) return null;
  const base = { ...c, id: `${c.id}${SUFFIX}`, hint: '' };
  const parentKey = keyText(c);
  let practice: CoordinateGraphChallenge | null = null;
  if (c.type === 'plot_point' || c.type === 'read_point') {
    if (Math.max(Math.abs(c.x1), Math.abs(c.y1)) <= 3) return null;
    const sx = Math.sign(c.x1), sy = Math.sign(c.y1);
    for (const [a, b] of [[2, 3], [3, 1], [1, 2], [3, 2], [1, 3], [2, 1]]) {
      const p = { x: sx * a, y: sy * b };
      if (!inGrid(g, p) || (p.x === c.x1 && p.y === c.y1) || (p.x === c.y1 && p.y === c.x1) || p.x === p.y) continue;
      if (c.type === 'plot_point') {
        practice = { ...base, instruction: `Practice first: plot the point ${pair(p)}.`, x1: p.x, y1: p.y, showHoverReadout: true, showAxisLabels: true };
      } else {
        const distract = [{ x: p.y, y: p.x }, { x: -p.x, y: p.y }, { x: p.x, y: -p.y }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }].map(pair);
        practice = withChoices({ ...base, instruction: 'Practice first: what are the coordinates of the highlighted point?', x1: p.x, y1: p.y,
          showDropLines: true, showAxisLabels: true }, pair(p), distract, 1, parentKey);
      }
      if (practice && !practiceLeaks(c, practice)) return practice;
    }
    return null;
  }
  if (c.type === 'find_slope') {
    const rise = riseOf(c), run = runOf(c), g0 = gcd(rise, run);
    if (rise === 0 || (Math.abs(rise) <= 3 && Math.abs(run) <= 3 && g0 === 1)) return null;
    const negative = slopeOf(c) < 0;
    for (const [r0, n] of [[2, 1], [1, 2], [3, 1], [1, 3], [3, 2], [2, 3]]) {
      const r = negative ? -r0 : r0;
      if (Math.abs(r / n - slopeOf(c)) < 1e-9) continue;
      const a = { x: -1, y: negative ? 2 : -1 };
      const key = ratioText(r, n);
      const distract = [ratioText(n, r), ratioText(-r, n), `${r}`, `${n}`, ratioText(r + n, n)];
      practice = withChoices({ ...base, instruction: 'Practice first: find the slope of this line.', x1: a.x, y1: a.y, x2: a.x + n, y2: a.y + r,
        showRiseRunGuides: true, showRiseRunLabels: true, showPointLabels: true, showAxisLabels: true }, key, distract, 2, parentKey);
      if (practice && !practiceLeaks(c, practice)) return practice;
    }
    return null;
  }
  if (c.type === 'find_intercept') {
    if (c.x1 === 0 || c.x2 === 0) return null;
    const m = slopeOf(c) < 0 ? -1 : 1, b = interceptOf(c);
    for (const k of [2, -2, 3, -3, 1, -1]) {
      if (k === b) continue;
      const a = { x: 1, y: m + k }, p2 = { x: 3, y: 3 * m + k };
      if (!inGrid(g, a) || !inGrid(g, p2)) continue;
      const distract = [`${-k}`, `${m}`, `${k + 1}`, `${k - 1}`, `${a.y}`, `${k + 2}`, `${k - 2}`];
      practice = withChoices({ ...base, instruction: 'Practice first: where does this line cross the y-axis?', x1: a.x, y1: a.y, x2: p2.x, y2: p2.y,
        equationLabel: undefined, showEquationLabel: false, showInterceptMarker: true, showAxisLabels: true }, `${k}`, distract, 3, parentKey);
      if (practice && !practiceLeaks(c, practice)) return practice;
    }
  }
  return null;
}

/**
 * Leak rule for a practice item: never the learner's item (id, ask, points), never its answer (as the practice's key or
 * among its choices), and the same mode.
 */
export function practiceLeaks(parent: CoordinateGraphChallenge, practice: CoordinateGraphChallenge): boolean {
  const samePoints = parent.x1 === practice.x1 && parent.y1 === practice.y1 && parent.x2 === practice.x2 && parent.y2 === practice.y2;
  const parentKey = keyValues(parent), practiceKey = keyValues(practice);
  const sameKey = parentKey.length === practiceKey.length && parentKey.every((v, i) => Math.abs(v - practiceKey[i]) < 1e-9);
  const key = keyText(parent);
  return practice.id === parent.id || practice.instruction === parent.instruction || practice.type !== parent.type || samePoints || sameKey
    || (key !== '' && practice.instruction.replace(/\s/g, '').includes(key.replace(/\s/g, '')))
    || (key !== '' && optionsOf(practice).some(o => o.replace(/\s/g, '') === key.replace(/\s/g, '')));
}

// ── declarations ─────────────────────────────────────────────────────────

const POINT_SIGNS: readonly CoordinateMiss[] = ['swapped', 'both_signs', 'x_sign', 'y_sign', 'one_axis'];

export function coordinateLevers(c: CoordinateGraphChallenge | null, g: Grid, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeItem(c)) return [];
  const t: CoordinateGraphMode = c.type;
  const all = COORDINATE_MISSES_BY_MODE[t];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly CoordinateMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (t === 'plot_point' || t === 'read_point') {
    out.push(lever(AXIS_GUIDE, 'help', 'shown', POINT_SIGNS,
      'The learner swapped x and y, or went the wrong way on an axis.',
      'Names each axis on the plane with its direction (x across, y up or down) and writes each quadrant\'s sign pattern. No number.'));
    if (c.showAxisLabels === false || labelStep(g) > 1) {
      out.push(lever(EVERY_LINE, 'help', 'shown', ['off_by_one', 'one_axis', 'wrong_point'],
        'The learner landed a step off, or lost count of the grid lines.',
        'Numbers every grid line on both axes.'));
    }
    if (t === 'read_point' && !c.showDropLines) {
      out.push(lever(DROP_LINES, 'help', 'shown', ['off_by_one', 'one_axis', 'swapped', 'wrong_point'],
        'The learner read the wrong line, or one coordinate only.',
        'Draws dashed lines from the point straight to each axis.'));
    }
    if (pointModel(c, g)) {
      out.push(lever(MODEL_POINT, 'help', 'both', all,
        'The learner does not know how an ordered pair finds a point.',
        'Draws a different example point on the plane, marked Example, with its moves from the origin: across first, then up or '
          + 'down. Read it aloud; it is never the item\'s point.'));
    }
  } else if (t === 'find_slope') {
    if (c.showRiseRunGuides === false) {
      out.push(lever(RISE_RUN, 'help', 'shown', ['reciprocal', 'negative_reciprocal', 'rise_only', 'run_only'],
        'The learner put the run over the rise, or used one leg only.',
        'Draws the dashed rise and run triangle on the line. No number.'));
    }
    if (c.showRiseRunGuides === false || c.showRiseRunLabels === false) {
      out.push(lever(UNIT_STEPS, 'help', 'shown', ['rise_only', 'run_only', 'reciprocal', 'wrong_slope'],
        'The learner miscounted the rise or the run.',
        'Draws the triangle and a tick at every grid step along its rise and its run, to count. No number.'));
    }
    out.push(lever(SLOPE_FRAME, 'help', 'both', all,
      'The learner turned the ratio over, lost the sign, or gave one leg.',
      'Writes under the plane: slope is rise divided by run, the change in y over the change in x, and a line that falls from '
        + 'left to right has a negative slope. No number.'));
  } else {
    if (c.showInterceptMarker === false) {
      out.push(lever(CROSSING, 'help', 'shown', ['point_y', 'x_intercept', 'slope_instead', 'off_by_one', 'wrong_intercept'],
        'The learner read somewhere other than where the line meets the y-axis.',
        'Marks where the line crosses the y-axis with a question mark. No number.'));
    }
    out.push(lever(INTERCEPT_FRAME, 'help', 'both', ['slope_instead', 'x_intercept', 'point_y', 'opposite_sign'],
      'The learner gave the slope, the x-axis crossing or a marked point\'s height.',
      'Writes under the plane: the y-intercept is the y-value where the line meets the up-and-down axis, where x is zero; not '
        + 'the slope, not where it meets the across axis. No number.'));
  }
  if ((t === 'find_slope' || t === 'find_intercept') && lineModel(c)) {
    out.push(lever(MODEL_LINE, 'help', 'both', all,
      t === 'find_slope' ? 'The learner does not know how a slope is read from a line.'
        : 'The learner does not know where a y-intercept is on a graph.',
      t === 'find_slope'
        ? 'Shows a worked example beside the plane: a different line with its rise, run and slope worked out. Read it aloud; it '
          + 'never shows the item\'s slope.'
        : 'Shows a worked example beside the plane: a different line with its y-axis crossing marked and named. Read it aloud; '
          + 'it never shows the item\'s intercept.'));
  }
  if (simplerItem(c, g)) {
    out.push(lever(SIMPLER, 'simplify', 'shown', all,
      'This item is too big a step yet.',
      t === 'plot_point' || t === 'read_point'
        ? 'Opens an easier point of the same kind first: smaller moves in the same direction. It is not graded; the full item '
          + 'comes back after it.'
        : t === 'find_slope'
          ? 'Opens an easier line first: a small rise and run that need no reducing, with the triangle labelled. It is not graded; '
            + 'the full item comes back after it.'
          : 'Opens an easier line first: one that crosses one step from a marked point, with the crossing marked. It is not graded; '
            + 'the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. A model's caption, never the key. */
export function leverFacts(c: CoordinateGraphChallenge | null, g: Grid, pulled: readonly string[]): string {
  if (!c || isPracticeItem(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const point = on(MODEL_POINT) ? pointModel(c, g) : null;
  const line = on(MODEL_LINE) ? lineModel(c) : null;
  return [
    on(AXIS_GUIDE) && 'Each axis is named with its direction (x across, y up or down), and each quadrant shows its sign pattern.',
    on(EVERY_LINE) && 'Every grid line on both axes is numbered.',
    on(DROP_LINES) && 'Dashed lines run from the point straight to each axis.',
    point && `A different example point is drawn in violet, marked Example: ${point.caption}.`,
    on(RISE_RUN) && 'A dashed rise and run triangle is drawn on the line, without numbers.',
    on(UNIT_STEPS) && 'The rise and run triangle is drawn with a tick at every grid step along each leg, without numbers.',
    on(SLOPE_FRAME) && 'Under the plane: slope = rise ÷ run, the change in y over the change in x; a line that falls from left to right has a negative slope.',
    on(CROSSING) && 'Where the line crosses the y-axis is marked with a question mark.',
    on(INTERCEPT_FRAME) && 'Under the plane: the y-intercept is the y-value where the line meets the y-axis, where x is zero; not the slope, not where the line meets the x-axis.',
    line && `Beside the plane, a worked example on a different line: ${line.caption}.`,
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' when/does words: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
