/**
 * Systems of equations on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C20).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item: the learner
 * types x and y and presses Check, and the activity's own check (`solutionCorrect`, within 0.01 of the item's
 * `expectedX`/`expectedY`) is the judge. The tutor is never handed the solution: not the pair, not either coordinate,
 * not a step's result.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { SystemEquation, SystemsEquationsChallenge } from './SystemsEquationsVisualizer';

export type SystemsMode = SystemsEquationsChallenge['type'];
export interface SolutionPoint { x: number; y: number }

const EPS = 0.01;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
export const pairText = (p: SolutionPoint) => `(${p.x}, ${p.y})`;
export const keyOf = (c: SystemsEquationsChallenge): SolutionPoint => ({ x: c.expectedX, y: c.expectedY });

// ── the activity's check ─────────────────────────────────────────────────

/** The learner's typed work on the current item, as typed. */
export interface SystemsWork { x: string; y: string }

/** A typed value as a number, or null when it is empty or not a number. */
export function typedNumber(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Both boxes hold numbers: the pair the learner entered, else null (the Check asks for both and grades nothing). */
export function enteredPoint(work: SystemsWork): SolutionPoint | null {
  const x = typedNumber(work.x), y = typedNumber(work.y);
  return x == null || y == null ? null : { x, y };
}

export function solutionCorrect(c: SystemsEquationsChallenge, p: SolutionPoint): boolean {
  return near(p.x, c.expectedX) && near(p.y, c.expectedY);
}

/** Whether a point satisfies one equation: its y on the line at that x (every equation carries its slope form). */
export function onLine(eq: SystemEquation, p: SolutionPoint): boolean {
  return near(eq.slope * p.x + eq.yIntercept, p.y);
}

/** The learner's work in words, never the key: the pair entered, or what is still empty. */
export function describeSystemsWork(work: SystemsWork): string {
  const x = work.x.trim(), y = work.y.trim();
  if (!x && !y) return 'nothing entered yet';
  if (!x || !y) return `entered ${x ? `x = ${x}` : `y = ${y}`}; the other box is empty`;
  return `entered x = ${x}, y = ${y}`;
}

// ── misses ───────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the pair entered against the key and the two
 * lines, drawn from the catalog's commonStruggles (reading the crossing wrong, forgetting to back-substitute, signs not
 * lined up), most specific first:
 * - `swapped` (y, x); `both_signs` (-x, -y); `x_sign` (-x, y); `y_sign` (x, -y);
 * - `intercept_point` a line's y-axis crossing (0, b): the start of one line, not where the two meet (graph and
 *   substitution, whose equations print b);
 * - `one_line_only` a point on one line and not the other: it solves one equation only;
 * - `off_by_one` one grid step from the solution;
 * - `x_only` x right, y wrong (the back-substitution); `y_only` y right, x wrong;
 * - `wrong_point` anything else.
 */
export type SystemsMiss = 'swapped' | 'both_signs' | 'x_sign' | 'y_sign' | 'intercept_point' | 'one_line_only'
  | 'off_by_one' | 'x_only' | 'y_only' | 'wrong_point';

const ALL: readonly SystemsMiss[] = ['swapped', 'both_signs', 'x_sign', 'y_sign', 'intercept_point', 'one_line_only',
  'off_by_one', 'x_only', 'y_only', 'wrong_point'];
export const SYSTEMS_MISSES_BY_MODE: Record<SystemsMode, readonly SystemsMiss[]> = {
  graph: ALL,
  substitution: ALL,
  elimination: ALL.filter(m => m !== 'intercept_point'),
};

export function systemsMiss(c: SystemsEquationsChallenge, p: SolutionPoint): SystemsMiss | undefined {
  const k = keyOf(c);
  if (solutionCorrect(c, p)) return undefined;
  const is = (x: number, y: number) => near(p.x, x) && near(p.y, y);
  if (is(k.y, k.x)) return 'swapped';
  if (is(-k.x, -k.y)) return 'both_signs';
  if (is(-k.x, k.y)) return 'x_sign';
  if (is(k.x, -k.y)) return 'y_sign';
  if (c.type !== 'elimination' && near(p.x, 0)
    && [c.equationA, c.equationB].some(eq => near(p.y, eq.yIntercept))) return 'intercept_point';
  if (onLine(c.equationA, p) !== onLine(c.equationB, p)) return 'one_line_only';
  if (Math.abs(p.x - k.x) + Math.abs(p.y - k.y) < 1 + EPS && (near(p.x, k.x) || near(p.y, k.y))
    && Number.isInteger(p.x) && Number.isInteger(p.y)) return 'off_by_one';
  if (near(p.x, k.x)) return 'x_only';
  if (near(p.y, k.y)) return 'y_only';
  return 'wrong_point';
}

// ── what the tutor is told ───────────────────────────────────────────────

export function workspaceAssignment(c: SystemsEquationsChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** The method's steps in words, never a number: what the easy tier opens and the method_steps lever shows. */
export function methodSteps(type: SystemsMode): string {
  switch (type) {
    case 'graph':
      return 'Trace each line carefully. The solution is the single point that lies on BOTH lines — read its x first, then its y.';
    case 'substitution':
      return 'Both equations are solved for y, so set the two right-hand sides equal. Use inverse operations to isolate x, then substitute x back into either equation to find y.';
    case 'elimination':
      return 'Scale one (or both) equations so a variable\'s coefficients become opposites, add the equations to cancel that variable, solve for what remains, then back-substitute.';
  }
}

const KIND: Record<SystemsMode, string> = {
  graph: 'graphing: two lines are drawn on a grid, and the learner types the x and y of the one point where they cross',
  substitution: 'substitution: two equations each solved for y; the learner sets them equal, solves for x, then finds y, '
    + 'and types both. The graph stays hidden until the answer is right',
  elimination: 'elimination: two equations in a·x + b·y = c form; the learner adds or scales them so one variable cancels, '
    + 'solves, and types x and y. The graph stays hidden until the answer is right',
};

/** What is drawn and asked: the two equations as printed, the grid and its aids. The solution never. */
export function workspaceScene(c: SystemsEquationsChallenge,
  view: { xRange: [number, number]; yRange: [number, number]; work: SystemsWork; linesShown: boolean }): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: KIND[c.type],
    equations: `line A: ${c.equationA.display}; line B: ${c.equationB.display}`,
  };
  if (c.type === 'graph' || view.linesShown) {
    facts.grid = `x runs from ${view.xRange[0]} to ${view.xRange[1]} and y from ${view.yRange[0]} to ${view.yRange[1]}; ${
      c.showAxisLabels !== false ? 'the axes are numbered' : 'the axes are not numbered, so the learner counts grid lines from the origin'}`;
    facts.lines = 'both lines are drawn; the crossing is not marked';
    if (c.type === 'graph' && c.showIntersectionRegion) facts.aids = 'a soft glow lies over the area near the crossing; it marks no exact point';
  } else {
    facts.graph = 'hidden until the answer is right';
  }
  if (c.showStepHint && c.stepHint) facts.methodSteps = `shown on screen: ${c.stepHint}`;
  facts.learnerWork = describeSystemsWork(view.work);
  facts.constraints = 'The learner types x and y into the two boxes and presses Check; the activity checks it itself. '
    + 'You cannot type or press Check.';
  return { objects: [], facts };
}

// ── the journey row's input ──────────────────────────────────────────────

/** The key, or the item's first signature miss that the check names (a sign flip or a swap, else one step off). */
export function systemsHarnessPoint(c: SystemsEquationsChallenge, intent: 'correct' | 'wrong'): SolutionPoint {
  const k = keyOf(c);
  if (intent === 'correct') return k;
  const tries = [{ x: k.y, y: k.x }, { x: -k.x, y: k.y }, { x: k.x, y: -k.y }, { x: -k.x, y: -k.y },
    { x: k.x + 1, y: k.y }, { x: k.x, y: k.y + 1 }];
  return tries.find(p => { const m = systemsMiss(c, p); return m && m !== 'wrong_point'; }) ?? { x: k.x + 7, y: k.y + 7 };
}
