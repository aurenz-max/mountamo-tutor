/**
 * Slope triangle on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C20).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own check: identify_slope by the rise and run typed, calculate by the slope typed (a number or a
 * fraction, compared by value, so 4/6 and 2/3 both count), draw_triangle by the triangle the learner built (its rise over
 * its run is the line's slope, so its top corner lands back on the line; any such run counts). The tutor is never
 * handed the answer: not the rise, the run or the slope, and a build has no target on screen. The line's label is drawn with its slope masked on the
 * two modes that ask for it (`lineLabel`).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { SlopeTriangleChallenge } from './SlopeTriangle';

export type SlopeTriangleMode = SlopeTriangleChallenge['type'];

// ── numbers ──────────────────────────────────────────────────────────────

const same = (a: number, b: number) => Math.abs(a - b) < 0.01;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** "2/3", "-1", "1.5", "−3/4" → its value; anything else null (the activity's own parse). */
export function parseSlope(text: string | undefined): number | null {
  const s = (text ?? '').trim().replace(/[−–]/g, '-');
  if (!s) return null;
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(p => parseFloat(p.trim()));
    return Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? num / den : null;
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

/** A ratio in lowest terms as a learner would type it: "2", "-1/3", "0". Integer legs only; else a decimal. */
export function ratioText(rise: number, run: number): string {
  if (!Number.isInteger(rise) || !Number.isInteger(run)) return String(Math.round((rise / run) * 100) / 100);
  if (rise === 0) return '0';
  const g = gcd(rise, run), sign = (rise < 0) !== (run < 0) ? '-' : '';
  const n = Math.abs(rise) / g, d = Math.abs(run) / g;
  return d === 1 ? `${sign}${n}` : `${sign}${n}/${d}`;
}

const signed = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);

/**
 * The line's label as the card draws it. identify_slope and calculate ask for what the slope gives (the rise for a
 * counted run, or the slope itself), so the slope is a question mark there: "y = ?x + 3". draw_triangle shows the
 * generated label.
 */
export function lineLabel(c: SlopeTriangleChallenge): string {
  if (c.type === 'draw_triangle') return c.attachedLine.label ?? c.attachedLine.equation;
  const b = c.attachedLine.yIntercept;
  return b === 0 ? 'y = ?x' : `y = ?x ${signed(b)}`;
}

// ── the activity's check ─────────────────────────────────────────────────

/** The learner's work on the current item: the two boxes (identify), the slope box (calculate), the built triangle (draw). */
export interface SlopeWork { rise: string; run: string; slope: string; size: number; baseX: number;
  /** draw_triangle: the rise the learner built, in whole grid steps (0 until the top corner is moved). */
  top: number }

export const emptyWork = (c: SlopeTriangleChallenge): SlopeWork =>
  ({ rise: '', run: '', slope: '', size: c.triangle.size, baseX: c.triangle.position.x, top: 0 });

const num = (text: string) => { const v = parseFloat(text); return Number.isFinite(v) ? v : null; };

export function identifyCorrect(c: SlopeTriangleChallenge, rise: number, run: number): boolean {
  return same(rise, c.expectedRise) && same(run, c.expectedRun);
}
export function calculateCorrect(c: SlopeTriangleChallenge, slope: number): boolean {
  return same(slope, c.expectedSlope);
}
/**
 * The left corner sits on the line by construction; the built triangle fits when its top corner is back on the line:
 * a whole-step rise over a run of at least one, in the line's ratio. Any run that allows a whole-step rise counts.
 */
export function drawCorrect(c: SlopeTriangleChallenge, size: number, rise: number): boolean {
  return size >= 1 && Number.isInteger(rise) && rise !== 0 && same(rise, c.attachedLine.slope * size);
}

/** Whether the learner's work can be checked at all (both boxes hold numbers, the slope parses). */
export function workComplete(c: SlopeTriangleChallenge, w: SlopeWork): boolean {
  if (c.type === 'identify_slope') return num(w.rise) != null && num(w.run) != null;
  if (c.type === 'calculate') return parseSlope(w.slope) != null;
  return true;
}

export function workCorrect(c: SlopeTriangleChallenge, w: SlopeWork): boolean {
  if (c.type === 'identify_slope') {
    const rise = num(w.rise), run = num(w.run);
    return rise != null && run != null && identifyCorrect(c, rise, run);
  }
  if (c.type === 'calculate') { const v = parseSlope(w.slope); return v != null && calculateCorrect(c, v); }
  return drawCorrect(c, w.size, w.top);
}

/** The learner's work in words. It is what they typed or built; it names no key they have not given. */
export function describeSlopeWork(c: SlopeTriangleChallenge, w: SlopeWork): string {
  if (c.type === 'identify_slope') {
    if (!w.rise.trim() && !w.run.trim()) return 'nothing typed yet';
    return `typed rise ${w.rise.trim() || '(blank)'} and run ${w.run.trim() || '(blank)'}`;
  }
  if (c.type === 'calculate') return w.slope.trim() ? `typed slope ${w.slope.trim()}` : 'nothing typed yet';
  return `built a triangle with run ${w.size} and rise ${w.top}, its left corner at x = ${w.baseX}`;
}

// ── misses ───────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), drawn from the catalog's commonStruggles (rise and run
 * confused, the sign of a falling line, slope versus one triangle's legs, the ratio turned over):
 * - identify_slope: `swapped` rise and run exchanged; `rise_sign` the rise's sign lost (a falling line's rise typed
 *   positive, or the reverse); `run_sign` the run typed negative; `same_ratio` a pair with the line's slope but not this
 *   triangle's legs (the slope read as rise over one); `rise_off` the run right and the rise one off; `run_off` the
 *   rise right and the run one off; `wrong_legs` anything else;
 * - calculate: `opposite_sign` -m; `reciprocal` run over rise; `negative_reciprocal` -run over rise; `rise_only` the
 *   rise alone; `run_only` the run alone; `wrong_slope` anything else;
 * - draw_triangle: `flat` checked with the top corner never raised or lowered; `wrong_sign` the rise the line needs
 *   for that run, the other way; `swapped` the run over the rise (rise/run is the slope turned over); `rise_off` one
 *   step from the rise the run needs; `wrong_ratio` anything else.
 */
export type SlopeTriangleMiss = 'swapped' | 'rise_sign' | 'run_sign' | 'same_ratio' | 'rise_off' | 'run_off' | 'wrong_legs'
  | 'opposite_sign' | 'reciprocal' | 'negative_reciprocal' | 'rise_only' | 'run_only' | 'wrong_slope'
  | 'flat' | 'wrong_sign' | 'rise_off' | 'wrong_ratio';

export const SLOPE_TRIANGLE_MISSES_BY_MODE: Record<SlopeTriangleMode, readonly SlopeTriangleMiss[]> = {
  identify_slope: ['swapped', 'rise_sign', 'run_sign', 'same_ratio', 'rise_off', 'run_off', 'wrong_legs'],
  calculate: ['opposite_sign', 'reciprocal', 'negative_reciprocal', 'rise_only', 'run_only', 'wrong_slope'],
  draw_triangle: ['flat', 'wrong_sign', 'swapped', 'rise_off', 'wrong_ratio'],
};

/** The miss a typed rise and run show against the drawn triangle's legs. */
export function legsMiss(c: SlopeTriangleChallenge, rise: number, run: number): SlopeTriangleMiss | undefined {
  const R = c.expectedRise, N = c.expectedRun;
  if (identifyCorrect(c, rise, run)) return undefined;
  if (same(rise, N) && same(run, R)) return 'swapped';
  if (same(run, N) && R !== 0 && same(rise, -R)) return 'rise_sign';
  if (same(rise, R) && same(run, -N)) return 'run_sign';
  if (run !== 0 && same(rise / run, c.expectedSlope)) return 'same_ratio';
  if (same(run, N) && Math.abs(rise - R) <= 1.01) return 'rise_off';
  if (same(rise, R) && Math.abs(run - N) <= 1.01) return 'run_off';
  return 'wrong_legs';
}

/** The values each signature miss stands for on a calculate item, most specific first. */
export function slopeSignatures(c: SlopeTriangleChallenge): Array<[SlopeTriangleMiss, number]> {
  const R = c.expectedRise, N = c.expectedRun, m = c.expectedSlope;
  const out: Array<[SlopeTriangleMiss, number]> = [['opposite_sign', -m]];
  if (R !== 0) out.push(['reciprocal', N / R], ['negative_reciprocal', -N / R]);
  out.push(['rise_only', R], ['run_only', N]);
  return out.filter(([, v]) => Number.isFinite(v) && !same(v, m));
}

/** The miss a typed slope shows. */
export function slopeValueMiss(c: SlopeTriangleChallenge, v: number): SlopeTriangleMiss | undefined {
  if (calculateCorrect(c, v)) return undefined;
  return slopeSignatures(c).find(([, s]) => same(s, v))?.[0] ?? 'wrong_slope';
}

/** The miss a built run shows. */
export function buildMiss(c: SlopeTriangleChallenge, size: number, rise: number): SlopeTriangleMiss | undefined {
  if (drawCorrect(c, size, rise)) return undefined;
  const m = c.attachedLine.slope, need = m * size;
  if (rise === 0) return 'flat';
  if (same(rise, -need)) return 'wrong_sign';
  if (same(rise * m, size)) return 'swapped';
  if (Number.isInteger(Math.round(need * 100) / 100) && Math.abs(rise - need) <= 1.01) return 'rise_off';
  return 'wrong_ratio';
}

/** The miss a wrong check shows. Undefined for a right answer or work that cannot be checked yet. */
export function slopeTriangleMiss(c: SlopeTriangleChallenge, w: SlopeWork): SlopeTriangleMiss | undefined {
  if (!workComplete(c, w)) return undefined;
  if (c.type === 'identify_slope') return legsMiss(c, num(w.rise)!, num(w.run)!);
  if (c.type === 'calculate') return slopeValueMiss(c, parseSlope(w.slope)!);
  return buildMiss(c, w.size, w.top);
}

// ── what the tutor is told ───────────────────────────────────────────────

/** draw_triangle's ask is the card's own sentence; it names no run or rise. */
export function askOf(c: SlopeTriangleChallenge): string {
  if (c.type === 'draw_triangle')
    return 'Build a slope triangle on the line: drag the left corner along the line, size the run with the right corner, then raise or lower the top corner until it lands back on the line.';
  return c.instruction;
}

export function workspaceAssignment(c: SlopeTriangleChallenge): TeachingAssignment {
  return { id: c.id, task: askOf(c), response: 'gesture' };
}

const KIND: Record<SlopeTriangleMode, string> = {
  identify_slope: 'read a slope triangle: a right triangle is drawn on the line, and the learner types its rise (the up-or-down leg) and its run (the across leg)',
  calculate: 'calculate a slope: a right triangle is drawn on the line, and the learner types the line\'s slope as a number or a fraction',
  draw_triangle: 'build a slope triangle: the left corner sits on the line; the learner chooses a run and sets the rise so the top corner lands back on the line (any run whose rise is a whole number of steps works)',
};

const direction = (c: SlopeTriangleChallenge) => {
  const m = c.attachedLine.slope;
  return m > 0 ? 'rises from left to right' : m < 0 ? 'falls from left to right' : 'is flat';
};

/** What is drawn and asked. Numbers only where the card prints them; the rise, run and slope never otherwise. */
export function workspaceScene(c: SlopeTriangleChallenge, view: { work: SlopeWork }): WorkspaceScene {
  const t = c.triangle;
  const delta = t.notation === 'deltaNotation';
  const labels = t.showRiseRunLabels ?? t.showMeasurements;
  const facts: Record<string, string> = {
    kind: KIND[c.type],
    grid: 'a grid with numbered axes, one unit per square',
    line: `the line ${direction(c)}; its label reads ${lineLabel(c)}`,
  };
  if (c.type === 'draw_triangle') {
    facts.triangle = `the learner's triangle has run ${view.work.size} and rise ${view.work.top}, its left corner on the line at `
      + `x = ${view.work.baseX}; the card prints the run and the rise under the grid`;
  } else if (labels) {
    facts.triangle = `the triangle's legs are labelled ${delta ? 'Δy' : 'rise'} = ${c.expectedRise} and ${delta ? 'Δx' : 'run'} = ${c.expectedRun}`;
  } else {
    facts.triangle = 'the triangle\'s legs carry no numbers';
  }
  const aids = [
    t.showGridCountOverlay && 'a tick marks every grid step along each leg, to count',
    t.showFormulaReminder && `a badge reads slope = ${delta ? 'Δy ÷ Δx' : 'rise ÷ run'}`,
  ].filter((s): s is string => !!s);
  facts.aids = aids.length ? aids.join('; ') : 'no counting ticks and no formula badge';
  facts.learnerWork = describeSlopeWork(c, view.work);
  facts.constraints = c.type === 'draw_triangle'
    ? 'The learner drags the triangle\'s corners or presses Move left, Move right, Shorter run, Longer run, Lower rise and Higher rise, then Check; the activity checks it itself. You cannot move the triangle or press Check.'
    : 'The learner types into the boxes and presses Check; the activity checks it itself. You cannot type or press Check.';
  return { objects: [], facts };
}

// ── the journey row's input ──────────────────────────────────────────────

export type SlopeHarnessStep = { kind: 'write'; label: string; text: string } | { kind: 'choose'; label: string } | { kind: 'check' };

/** The run and rise the scene prints for a draw item ("run 3 and rise 0, ..."), else the item's start. */
export function builtTriangle(c: SlopeTriangleChallenge, learnerWork: unknown): { run: number; rise: number } {
  const m = /run (\d+) and rise (-?\d+)/.exec(String(learnerWork ?? ''));
  return m ? { run: Number(m[1]), rise: Number(m[2]) } : { run: c.triangle.size, rise: 0 };
}

/**
 * The key, or the item's first signature miss, through the real controls. identify: swapped legs (or a lost sign where
 * rise equals run); calculate: run over rise (or the sign lost); draw: the generated run with its rise the wrong way.
 */
export function slopeHarnessSteps(c: SlopeTriangleChallenge, intent: 'correct' | 'wrong', built: { run: number; rise: number }): SlopeHarnessStep[] {
  const R = c.expectedRise, N = c.expectedRun;
  if (c.type === 'identify_slope') {
    const [rise, run] = intent === 'correct' ? [R, N] : R !== N ? [N, R] : [-R, N];
    return [{ kind: 'write', label: 'Rise', text: String(rise) }, { kind: 'write', label: 'Run', text: String(run) }, { kind: 'check' }];
  }
  if (c.type === 'calculate') {
    const text = intent === 'correct' ? ratioText(R, N) : R !== 0 && !same(N / R, c.expectedSlope) ? ratioText(N, R) : ratioText(-R, N);
    return [{ kind: 'write', label: 'Slope', text }, { kind: 'check' }];
  }
  const rise = intent === 'correct' ? R : -R;
  const steps: SlopeHarnessStep[] = [];
  for (let s = built.run; s < N; s++) steps.push({ kind: 'choose', label: 'Longer run' });
  for (let s = built.run; s > N; s--) steps.push({ kind: 'choose', label: 'Shorter run' });
  for (let r = built.rise; r < rise; r++) steps.push({ kind: 'choose', label: 'Higher rise' });
  for (let r = built.rise; r > rise; r--) steps.push({ kind: 'choose', label: 'Lower rise' });
  return [...steps, { kind: 'check' }];
}
