/**
 * systems-equations-visualizer's in-item levers (/add-support-tiers; report
 * qa/eval-reports/systems-equations-visualizer-levers-2026-10-09.md). The misses are what `systemsMiss` observes in the
 * pair checked; there is no real-learner evidence.
 *
 * Help:
 * - `check_both` (every mode, after a check): the learner's last checked pair put into each equation, marked works or
 *   does not work. Only the learner's own numbers; no computed value.
 * - `method_steps` (every mode, where the tier did not open them): the method's steps in words. No digit.
 * - `axis_guide` (graph): how a crossing is read, x across first, then y up or down, with the signs. No digit.
 * - `every_line` (graph, where the hard tier hid the axis numbers): numbers the axes again.
 * - `set_equal` (substitution): the first step written under the equations, the two right-hand sides set equal. No
 *   solving.
 * - `line_up` (elimination): the two equations stacked in x, y and constant columns, opposite coefficients named.
 * - `worked_example` (every mode): a different system of the same kind, solved: two other lines with their crossing
 *   marked (graph), or each step written out (substitution, elimination).
 * Simplify: `simpler_item` (every mode): the same method on a system of slopes one and minus one (graph, substitution)
 * or of x + y and x - y (elimination), with a small solution, built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` carries a digit; a worked example shares neither coordinate with the key,
 * never prints the key's pair and is not the item's system; `check_both` prints only the learner's pair; `set_equal` and
 * `line_up` state no solved value; a practice item has its own id, ask, equations and answer, and keeps the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { SystemEquation, SystemsEquationsChallenge } from './SystemsEquationsVisualizer';
import {
  SYSTEMS_MISSES_BY_MODE, keyOf, methodSteps, onLine, pairText, type SolutionPoint, type SystemsMiss, type SystemsMode,
} from './systemsEquationsWorkspace';

export const CHECK_BOTH = 'check_both';
export const METHOD_STEPS = 'method_steps';
export const AXIS_GUIDE = 'axis_guide';
export const EVERY_LINE = 'every_line';
export const SET_EQUAL = 'set_equal';
export const LINE_UP = 'line_up';
export const WORKED_EXAMPLE = 'worked_example';
export const SIMPLER = 'simpler_item';

const SUFFIX = '~simpler';
export const isPracticeItem = (c: Pick<SystemsEquationsChallenge, 'id'>) => c.id.endsWith(SUFFIX);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

// ── printing equations ───────────────────────────────────────────────────

/** "2x - 1", "-x + 3", "x": the right-hand side of y = mx + b, as the generator prints it. */
export function slopeExpression(m: number, b: number): string {
  const mx = m === 1 ? 'x' : m === -1 ? '-x' : Number.isInteger(m) ? `${m}x` : `${m.toFixed(2).replace(/\.?0+$/, '')}x`;
  if (m === 0) return `${b}`;
  return b === 0 ? mx : b > 0 ? `${mx} + ${b}` : `${mx} - ${Math.abs(b)}`;
}
export const slopeDisplay = (m: number, b: number) => `y = ${slopeExpression(m, b)}`;

/** "2x + 3y = 7", "x - y = 1". */
export function standardDisplay(a: number, b: number, c: number): string {
  const aTerm = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`;
  const bTerm = Math.abs(b) === 1 ? 'y' : `${Math.abs(b)}y`;
  return `${aTerm} ${b >= 0 ? '+' : '-'} ${bTerm} = ${c}`;
}

function slopeEquation(m: number, b: number, color: string, label: string): SystemEquation {
  return { display: slopeDisplay(m, b), slope: m, yIntercept: b, color, label };
}
function standardEquation(a: number, b: number, c: number, color: string, label: string): SystemEquation {
  return { display: standardDisplay(a, b, c), slope: -a / b, yIntercept: c / b, a, b, c, color, label };
}

/** The right-hand side of a slope-form equation as printed ("y = 2x + 1" gives "2x + 1"). */
const rightSide = (eq: SystemEquation) => eq.display.replace(/^\s*y\s*=\s*/, '');

// ── help: check both ─────────────────────────────────────────────────────

export interface CheckRow { label: string; display: string; works: boolean }

/** The learner's checked pair in each equation: works or not. No computed number. */
export function checkRows(c: SystemsEquationsChallenge, p: SolutionPoint): CheckRow[] {
  return [c.equationA, c.equationB].map((eq, i) => ({ label: eq.label || (i ? 'B' : 'A'), display: eq.display, works: onLine(eq, p) }));
}

export function checkSentence(c: SystemsEquationsChallenge, p: SolutionPoint): string {
  return checkRows(c, p).map(r => `${pairText(p)} in line ${r.label} (${r.display}): ${r.works ? 'works' : 'does not work'}`).join('; ');
}

// ── help: the item's own first step ──────────────────────────────────────

/** Substitution's first step: the two right-hand sides set equal. Not solved. */
export function setEqualLine(c: SystemsEquationsChallenge): string | null {
  if (c.type !== 'substitution') return null;
  return `${rightSide(c.equationA)} = ${rightSide(c.equationB)}`;
}

export interface Columns { rows: Array<{ label: string; a: number; b: number; c: number }>; note: string }

/** Elimination's equations in x, y and constant columns, and which coefficients are already opposites or equal. */
export function lineUpColumns(c: SystemsEquationsChallenge): Columns | null {
  if (c.type !== 'elimination') return null;
  const [A, B] = [c.equationA, c.equationB];
  if ([A.a, A.b, A.c, B.a, B.b, B.c].some(v => typeof v !== 'number')) return null;
  const rows = [A, B].map((eq, i) => ({ label: eq.label || (i ? 'B' : 'A'), a: eq.a!, b: eq.b!, c: eq.c! }));
  const opposite = (name: string, u: number, v: number) => (u === -v ? `the ${name}-coefficients are opposites, so adding the equations cancels ${name}` : null);
  const equal = (name: string, u: number, v: number) => (u === v ? `the ${name}-coefficients are equal, so subtracting one equation from the other cancels ${name}` : null);
  const note = opposite('x', rows[0].a, rows[1].a) ?? opposite('y', rows[0].b, rows[1].b)
    ?? equal('x', rows[0].a, rows[1].a) ?? equal('y', rows[0].b, rows[1].b)
    ?? 'no column cancels yet: multiply one equation (or both) so the x- or y-coefficients become opposites';
  return { rows, note };
}

// ── help: a worked example outside the item ──────────────────────────────

export interface WorkedExample {
  form: 'slope-intercept' | 'standard';
  equationA: SystemEquation; equationB: SystemEquation;
  solution: SolutionPoint;
  /** The lines of working, in order; the last names the solution. */
  steps: string[];
}

/** Slope-form systems for an example: (mA, bA, mB, bB), integer solutions within the inset's -4..4. */
const SLOPE_MODELS: Array<[number, number, number, number]> = [
  [1, 1, -1, 3], [2, -1, -1, 5], [1, 3, -1, -1], [-2, 1, 1, -2], [1, -3, -2, 3], [-1, -2, 1, 4], [2, 4, -1, -2],
  [1, -5, -1, 1], [-1, 4, 2, -2], [1, 2, -2, -1],
];
/** Standard-form systems for an example: (a1, b1, c1, a2, b2, c2), each with one pair of opposite coefficients. */
const STANDARD_MODELS: Array<[number, number, number, number, number, number]> = [
  [1, 1, 5, 1, -1, 1], [2, 1, 7, 1, -1, -1], [1, 2, 3, -1, 1, 3], [1, 1, -1, -1, 2, -5], [2, -1, -4, 1, 1, -5],
  [1, -1, 4, 1, 1, 0], [3, 1, 1, -3, 2, -7],
];

/** "3y", "-x", "y": a coefficient on a variable. */
const term = (n: number, v: string) => (n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`);
/** An expression with a variable put in as a bracketed number: "2x - 1" with x = 3 gives "2(3) - 1". */
const putIn = (expr: string, v: string, value: number) => expr.replace(v, `(${value})`);

function slopeExample(type: SystemsMode, [mA, bA, mB, bB]: [number, number, number, number]): WorkedExample {
  const x = (bB - bA) / (mA - mB), y = mA * x + bA;
  const A = slopeEquation(mA, bA, '#a78bfa', 'A'), B = slopeEquation(mB, bB, '#f0abfc', 'B');
  const steps = type === 'graph'
    ? [`${A.display} and ${B.display} cross at ${pairText({ x, y })}: that point is on both lines.`]
    : [`${A.display} and ${B.display}`, `Set equal: ${rightSide(A)} = ${rightSide(B)}`,
      `Collect the x terms: ${term(mA - mB, 'x')} = ${bB - bA}`, `x = ${x}`,
      `Put x back in A: y = ${putIn(rightSide(A), 'x', x)} = ${y}`, `Solution ${pairText({ x, y })}`];
  return { form: 'slope-intercept', equationA: A, equationB: B, solution: { x, y }, steps };
}

function standardExample([a1, b1, c1, a2, b2, c2]: [number, number, number, number, number, number]): WorkedExample {
  const A = standardEquation(a1, b1, c1, '#a78bfa', 'A'), B = standardEquation(a2, b2, c2, '#f0abfc', 'B');
  const det = a1 * b2 - a2 * b1;
  const x = (c1 * b2 - c2 * b1) / det, y = (a1 * c2 - a2 * c1) / det;
  const steps = [`${A.display} and ${B.display}`];
  if (a1 === -a2) {
    steps.push(`Add the equations: the x terms cancel, ${term(b1 + b2, 'y')} = ${c1 + c2}`, `y = ${y}`,
      `Put y back in A: ${putIn(A.display, 'y', y)}, so x = ${x}`);
  } else {
    steps.push(`Add the equations: the y terms cancel, ${term(a1 + a2, 'x')} = ${c1 + c2}`, `x = ${x}`,
      `Put x back in A: ${putIn(A.display, 'x', x)}, so y = ${y}`);
  }
  steps.push(`Solution ${pairText({ x, y })}`);
  return { form: 'standard', equationA: A, equationB: B, solution: { x, y }, steps };
}

/** The examples a mode can show, in preference order. */
export function exampleCandidates(type: SystemsMode): WorkedExample[] {
  return type === 'elimination' ? STANDARD_MODELS.map(standardExample) : SLOPE_MODELS.map(m => slopeExample(type, m));
}

/** Leak rule for an example: a coordinate of the key, the key's pair in its words, or the item's own system. */
export function exampleLeaks(c: SystemsEquationsChallenge, ex: WorkedExample): boolean {
  const k = keyOf(c), flat = (s: string) => s.replace(/\s/g, '');
  const same = (u: SystemEquation, v: SystemEquation) => flat(u.display) === flat(v.display);
  return ex.solution.x === k.x || ex.solution.y === k.y
    || ex.steps.some(s => flat(s).includes(flat(pairText(k))))
    || [ex.equationA, ex.equationB].some(e => same(e, c.equationA) || same(e, c.equationB));
}

export function workedExample(c: SystemsEquationsChallenge): WorkedExample | null {
  return exampleCandidates(c.type).find(ex => !exampleLeaks(c, ex)) ?? null;
}

// ── simplify ─────────────────────────────────────────────────────────────

const SMALL: SolutionPoint[] = [{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: -1, y: 2 }, { x: 2, y: -1 }, { x: -2, y: 1 },
  { x: 1, y: -2 }, { x: 1, y: 3 }, { x: 3, y: 1 }, { x: -1, y: -2 }, { x: -2, y: -1 }];

const ASK: Record<SystemsMode, string> = {
  graph: 'Practice first: find where the two lines cross and enter (x, y).',
  substitution: 'Practice first: set the two equations equal, solve for x, then find y. Enter (x, y).',
  elimination: 'Practice first: add the equations so one variable cancels, then solve. Enter (x, y).',
};

/** Already that simple: slopes one and minus one (graph, substitution), or unit coefficients with an opposite pair. */
function alreadySimple(c: SystemsEquationsChallenge): boolean {
  const k = keyOf(c), small = Math.abs(k.x) <= 3 && Math.abs(k.y) <= 3;
  if (c.type === 'elimination') {
    const [A, B] = [c.equationA, c.equationB];
    const unit = [A.a, A.b, B.a, B.b].every(v => typeof v === 'number' && Math.abs(v) === 1);
    return unit && (A.a === -B.a! || A.b === -B.b!) && small;
  }
  const slopes = [c.equationA.slope, c.equationB.slope].sort();
  return slopes[0] === -1 && slopes[1] === 1 && small;
}

/**
 * The easier practice item for `c`, same mode: a system whose lines have slopes one and minus one (graph, substitution:
 * set equal, the x terms collect in one step), or x + y and x - y (elimination: adding cancels y at once), with a small
 * solution that is not the key or the key swapped. Null where the item is already that simple.
 */
export function simplerItem(c: SystemsEquationsChallenge): SystemsEquationsChallenge | null {
  if (isPracticeItem(c) || alreadySimple(c)) return null;
  const k = keyOf(c);
  for (const p of SMALL) {
    if ((p.x === k.x && p.y === k.y) || (p.x === k.y && p.y === k.x)) continue;
    const [A, B] = c.type === 'elimination'
      ? [standardEquation(1, 1, p.x + p.y, c.equationA.color ?? '#3b82f6', 'A'), standardEquation(1, -1, p.x - p.y, c.equationB.color ?? '#10b981', 'B')]
      : [slopeEquation(1, p.y - p.x, c.equationA.color ?? '#3b82f6', 'A'), slopeEquation(-1, p.y + p.x, c.equationB.color ?? '#10b981', 'B')];
    const practice: SystemsEquationsChallenge = {
      ...c, id: `${c.id}${SUFFIX}`, instruction: ASK[c.type], hint: '', equationA: A, equationB: B,
      expectedX: p.x, expectedY: p.y, showAxisLabels: true, showIntersectionRegion: false,
      showStepHint: true, stepHint: methodSteps(c.type),
    };
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice item: never the learner's item (id, ask, equations), never its answer, and the same mode. */
export function practiceLeaks(parent: SystemsEquationsChallenge, practice: SystemsEquationsChallenge): boolean {
  const flat = (s: string) => s.replace(/\s/g, '');
  const sameEq = [practice.equationA, practice.equationB].some(e => [parent.equationA, parent.equationB]
    .some(f => flat(e.display) === flat(f.display)));
  return practice.id === parent.id || practice.instruction === parent.instruction || practice.type !== parent.type || sameEq
    || (practice.expectedX === parent.expectedX && practice.expectedY === parent.expectedY)
    || flat(practice.instruction).includes(flat(pairText(keyOf(parent))));
}

// ── declarations ─────────────────────────────────────────────────────────

export function systemsLevers(c: SystemsEquationsChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeItem(c)) return [];
  const t: SystemsMode = c.type;
  const all = SYSTEMS_MISSES_BY_MODE[t];
  const only = (ms: SystemsMiss[]) => ms.filter(m => all.includes(m));
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly SystemsMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  // The mode's own levers first: the observer's next lever after a miss is the first open one that answers it.
  const out: WorkspaceLever[] = [];
  if (t === 'graph') {
    out.push(lever(AXIS_GUIDE, 'help', 'both', only(['swapped', 'x_sign', 'y_sign', 'both_signs', 'intercept_point']),
      'The learner swapped x and y, read a sign the wrong way, or read where one line meets the y-axis.',
      'Writes under the graph how a crossing is read: from the origin, x across first (left is negative), then y up or '
        + 'down (down is negative); the solution is where the two lines meet, not where a line meets an axis. No number.'));
    if (c.showAxisLabels === false) {
      out.push(lever(EVERY_LINE, 'help', 'shown', only(['off_by_one', 'x_only', 'y_only', 'wrong_point']),
        'The learner lost count of the grid lines.', 'Numbers the axes again.'));
    }
  }
  if (t === 'substitution') {
    out.push(lever(SET_EQUAL, 'help', 'both', only(['intercept_point', 'y_only', 'wrong_point', 'x_sign', 'both_signs']),
      'The learner did not start by setting the two expressions for y equal, or lost a term doing it.',
      'Writes the first step under the equations: the two right-hand sides set equal. It does no solving.'));
  }
  if (t === 'elimination' && lineUpColumns(c)) {
    out.push(lever(LINE_UP, 'help', 'both', only(['x_sign', 'y_sign', 'both_signs', 'y_only', 'wrong_point']),
      'The learner added or subtracted terms that were not lined up, or lost a sign.',
      'Stacks the two equations in x, y and constant columns and says which column already cancels, or that one must be '
        + 'scaled first. It does no solving.'));
  }
  out.push(lever(CHECK_BOTH, 'help', 'shown', all,
    'The learner\'s checked pair solves one equation, or neither, and they cannot see which.',
    'Under the answer boxes, puts the learner\'s last checked pair into each equation and marks each works or does not '
      + 'work. Only the learner\'s own numbers; it computes nothing new. Pull it after a check.'));
  if (!(c.showStepHint && c.stepHint)) {
    out.push(lever(METHOD_STEPS, 'help', 'both', only(['one_line_only', 'intercept_point', 'x_only', 'y_only', 'wrong_point']),
      t === 'graph' ? 'The learner does not know what the solution of two lines is.' : 'The learner does not know the method\'s next step.',
      'Shows the method\'s steps in words under the equations. No number.'));
  }
  if (workedExample(c)) {
    out.push(lever(WORKED_EXAMPLE, 'help', 'both', all,
      t === 'graph' ? 'The learner does not know where to read the solution on a graph.' : 'The learner does not know how the method goes.',
      t === 'graph'
        ? 'Shows a worked example beside the graph: two different lines with the point where they cross marked and named. '
          + 'Read it aloud; it never shows this item\'s lines or solution.'
        : 'Shows a worked example beside the equations: a different system solved the same way, every step written out. '
          + 'Read it aloud; it never shows this item\'s system or solution.'));
  }
  if (simplerItem(c)) {
    out.push(lever(SIMPLER, 'simplify', 'shown', all,
      'This system is too big a step yet.',
      t === 'elimination'
        ? 'Opens an easier system first: one where adding the two equations cancels a variable at once, with the steps shown. '
          + 'It is not graded; the full item comes back after it.'
        : 'Opens an easier system first: two lines that rise and fall one step at a time, with the steps shown. It is not '
          + 'graded; the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. The learner's own pair and the item's givens only. */
export function leverFacts(c: SystemsEquationsChallenge | null, pulled: readonly string[], lastTried: SolutionPoint | null): string {
  if (!c || isPracticeItem(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const ex = on(WORKED_EXAMPLE) ? workedExample(c) : null;
  const cols = on(LINE_UP) ? lineUpColumns(c) : null;
  return [
    on(CHECK_BOTH) && lastTried && `Under the boxes, the learner's last checked pair in each equation: ${checkSentence(c, lastTried)}.`,
    on(AXIS_GUIDE) && 'Under the graph: from the origin, x across first (left is negative), then y up or down (down is negative); the solution is where the two lines meet, not where a line meets an axis.',
    on(EVERY_LINE) && 'The axes are numbered again.',
    on(SET_EQUAL) && `Under the equations, the first step: ${setEqualLine(c)}.`,
    cols && `The equations are stacked in x, y and constant columns; ${cols.note}.`,
    on(METHOD_STEPS) && `Under the equations, the method: ${methodSteps(c.type)}`,
    ex && `A worked example on a different system is shown: ${ex.steps.join('; ')}.`,
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' when/does words: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
