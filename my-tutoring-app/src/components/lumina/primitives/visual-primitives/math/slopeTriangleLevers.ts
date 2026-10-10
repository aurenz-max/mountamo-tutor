/**
 * slope-triangle's in-item levers (/add-support-tiers; report qa/eval-reports/slope-triangle-levers-2026-10-09.md).
 * The misses are what `slopeTriangleMiss` observes in the typed legs, the typed slope or the built run; there is no
 * real-learner evidence.
 *
 * Help:
 * - `count_ticks` (every mode, where the tier withheld the overlay): a tick at every grid step along each leg. No number.
 * - `leg_names` (identify): the words rise and run written on their legs. No number, no direction.
 * - `sign_frame` (identify): the sign rule under the card, in words. No digit.
 * - `leg_labels` (calculate, where withheld): each leg's length printed on it, as the easy tier does. The answer is the
 *   ratio, which the learner still forms and reduces.
 * - `formula_frame` (calculate): the slope = Δy ÷ Δx badge on the grid and the rule under the card. No digit.
 * - `build_frame` (draw): the fit rule under the card: the top corner lands back on the line when the rise is the slope
 *   times the run, below the corner for a falling line. No digit.
 * - `model_triangle` (every mode): a worked example outside the item, a triangle on a different line with its rise, run
 *   and slope worked out.
 * Simplify: `simpler_item` (every mode): the same task on a smaller triangle (identify), a triangle whose legs need no
 * reducing, labelled (calculate), or a line with a whole-number slope (draw), built here on another line; ungraded
 * practice.
 *
 * Leak rules (code): no lever's `when`/`does` carries a digit; a model's caption holds no number whose size is the item's
 * rise, run or slope (or the slope turned over), and its line's slope is not the item's; a practice item has its own id,
 * ask, line and answer, keeps the mode, and its legs and slope are not the item's.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { SlopeTriangleChallenge } from './SlopeTriangle';
import { SLOPE_TRIANGLE_MISSES_BY_MODE, ratioText, type SlopeTriangleMiss } from './slopeTriangleWorkspace';

export const COUNT_TICKS = 'count_ticks';
export const LEG_NAMES = 'leg_names';
export const SIGN_FRAME = 'sign_frame';
export const LEG_LABELS = 'leg_labels';
export const FORMULA_FRAME = 'formula_frame';
export const BUILD_FRAME = 'build_frame';
export const MODEL_TRIANGLE = 'model_triangle';
export const SIMPLER = 'simpler_item';

const SUFFIX = '~simpler';
export const isPracticeItem = (c: Pick<SlopeTriangleChallenge, 'id'>) => c.id.endsWith(SUFFIX);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const labelsShown = (c: SlopeTriangleChallenge) => !!(c.triangle.showRiseRunLabels ?? c.triangle.showMeasurements);

// ── help: the worked model, outside the item ─────────────────────────────

export interface TriangleModel { rise: number; run: number; caption: string }

/** The numbers a caption writes, as printed ("-4", "2/3"). */
const numbersIn = (text: string) => text.match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? [];
const valueOf = (t: string) => { const [a, b] = t.split('/').map(Number); return b ? a / b : a; };

/** Leak rule for a model's caption: no number in it has the size of the item's rise, run or slope, or the slope turned over. */
export function captionLeaks(c: SlopeTriangleChallenge, caption: string): boolean {
  const sizes = [c.expectedRise, c.expectedRun, c.expectedSlope, c.expectedRise ? c.expectedRun / c.expectedRise : NaN]
    .filter(Number.isFinite).map(Math.abs);
  return numbersIn(caption).some(t => sizes.some(s => near(Math.abs(valueOf(t)), s)));
}

const MODELS: Array<[number, number]> = [[1, 3], [3, 1], [1, 4], [4, 1], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5], [5, 3],
  [1, 5], [5, 1], [2, 7], [7, 2], [4, 5], [5, 4], [6, 5], [5, 6]];

/**
 * A worked triangle on a different line: the item's sign where it has one, a slope that is not the item's (nor its
 * opposite or its turn-over), and no number in the caption that the item's answer has.
 */
export function triangleModel(c: SlopeTriangleChallenge): TriangleModel | null {
  const sign = c.expectedSlope < 0 ? -1 : 1;
  for (const [r0, run] of MODELS) {
    const rise = sign * r0, m = rise / run;
    if (near(Math.abs(m), Math.abs(c.expectedSlope)) || (c.expectedSlope && near(Math.abs(m), Math.abs(1 / c.expectedSlope)))) continue;
    const caption = c.type === 'identify_slope'
      ? `Example: from the left corner, ${run} steps across, then ${Math.abs(rise)} ${rise < 0 ? 'down' : 'up'}: rise ${rise}, run ${run}`
      : c.type === 'calculate' ? `Example: rise ${rise}, run ${run}, so slope = ${rise} ÷ ${run} = ${ratioText(rise, run)}`
        : `Example: on a line of slope ${ratioText(rise, run)}, a run of ${run} needs a rise of ${rise} to land back on the line`;
    if (!captionLeaks(c, caption)) return { rise, run, caption };
  }
  return null;
}

// ── simplify ─────────────────────────────────────────────────────────────

const signedText = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
const labelOf = (m: number, b: number) => {
  const k = m === 1 ? 'x' : m === -1 ? '-x' : Number.isInteger(m) ? `${m}x` : `${ratioText(Math.round(m * 6), 6)}x`;
  return b === 0 ? `y = ${k}` : `y = ${k} ${signedText(b)}`;
};

/** A practice item on its own line: the left corner at (x0, y0), `run` across, `rise` up or down. */
function practiceItem(c: SlopeTriangleChallenge, rise: number, run: number, x0: number, y0: number, start: number,
  instruction: string): SlopeTriangleChallenge {
  const m = rise / run, b = y0 - m * x0;
  return { ...c, id: `${c.id}${SUFFIX}`, instruction, hint: '', supportTier: undefined,
    attachedLine: { equation: labelOf(m, b), slope: m, yIntercept: b, color: c.attachedLine.color, label: labelOf(m, b) },
    triangle: { ...c.triangle, position: { x: x0, y: 0 }, size: start,
      showRiseRunLabels: c.type === 'calculate', showMeasurements: c.type === 'calculate', showGridCountOverlay: true },
    expectedRise: rise, expectedRun: run, expectedSlope: m };
}

/**
 * The easier practice item for `c`, same mode: a smaller triangle with ticks to count (identify); a small triangle whose
 * labelled legs need no reducing (calculate); a target run one step shorter (draw). Same sign of slope, another line.
 * Null where the item is already that simple.
 */
export function simplerItem(c: SlopeTriangleChallenge): SlopeTriangleChallenge | null {
  if (isPracticeItem(c)) return null;
  const R = c.expectedRise, N = c.expectedRun, sign = c.expectedSlope < 0 ? -1 : 1;
  const y0 = sign > 0 ? -2 : 2;
  let practice: SlopeTriangleChallenge | null = null;
  if (c.type === 'identify_slope') {
    if (N <= 2 && Math.abs(R) <= 2) return null;
    const run = N === 2 ? 1 : 2;
    for (const m of [1, 2, 0.5, 3]) {
      const rise = sign * m * run;
      if (!Number.isInteger(rise)) continue;
      practice = practiceItem(c, rise, run, 0, y0, run, 'Practice first: count the rise and the run of this smaller triangle.');
      if (!practiceLeaks(c, practice)) return practice;
    }
    return null;
  }
  if (c.type === 'calculate') {
    if (gcd(R, N) === 1 && Math.abs(R) <= 3 && N <= 3) return null;
    for (const [r0, run] of [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]]) {
      practice = practiceItem(c, sign * r0, run, 0, y0, run, 'Practice first: find the slope of this line from its labelled triangle.');
      if (!practiceLeaks(c, practice)) return practice;
    }
    return null;
  }
  // draw: a line with a whole-number slope of the same sign, so every run lands on a whole step.
  if (Number.isInteger(c.expectedSlope) && Math.abs(c.expectedSlope) <= 1) return null;
  for (const m of [1, 2]) {
    practice = practiceItem(c, sign * m * 2, 2, -2, sign > 0 ? -3 : 3, 1,
      'Practice first: build a slope triangle on this line, its top corner back on the line.');
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice item: never the learner's item (id, ask, line, legs), never its answer, and the same mode. */
export function practiceLeaks(parent: SlopeTriangleChallenge, practice: SlopeTriangleChallenge): boolean {
  const sameLine = near(parent.attachedLine.slope, practice.attachedLine.slope) && near(parent.attachedLine.yIntercept, practice.attachedLine.yIntercept);
  const sameKey = parent.type === 'identify_slope'
    ? near(parent.expectedRise, practice.expectedRise) || near(parent.expectedRun, practice.expectedRun)
    : near(parent.expectedSlope, practice.expectedSlope);
  const inView = [practice.triangle.position.x, practice.triangle.position.x + practice.expectedRun].every(x => x >= -8 && x <= 8)
    && [0, practice.expectedRun].every(dx => Math.abs(practice.attachedLine.slope * (practice.triangle.position.x + dx) + practice.attachedLine.yIntercept) <= 9);
  return practice.id === parent.id || practice.instruction === parent.instruction || practice.type !== parent.type
    || sameLine || sameKey || near(parent.expectedSlope, practice.expectedSlope) || !inView;
}

// ── declarations ─────────────────────────────────────────────────────────

export function slopeTriangleLevers(c: SlopeTriangleChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeItem(c)) return [];
  const all = SLOPE_TRIANGLE_MISSES_BY_MODE[c.type];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly SlopeTriangleMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  const ticks = !c.triangle.showGridCountOverlay;
  if (c.type === 'identify_slope') {
    if (ticks) out.push(lever(COUNT_TICKS, 'help', 'shown', ['rise_off', 'run_off', 'same_ratio', 'wrong_legs'],
      'The learner miscounted a leg, or gave the slope in place of this triangle\'s legs.',
      'Draws a tick at every grid step along the rise and along the run, to count. No number.'));
    out.push(lever(LEG_NAMES, 'help', 'shown', ['swapped', 'run_sign', 'same_ratio', 'wrong_legs'],
      'The learner mixed up which leg is the rise and which is the run.',
      'Writes the word rise on the up-or-down leg and the word run on the across leg. No number, no direction.'));
    out.push(lever(SIGN_FRAME, 'help', 'both', ['rise_sign', 'run_sign'],
      'The learner gave the rise the wrong sign, or a negative run.',
      'Writes under the card: from the left corner, a rise that goes up is positive and one that goes down is negative; the run '
        + 'counts to the right, so it is positive. No number.'));
  } else if (c.type === 'calculate') {
    if (!labelsShown(c)) out.push(lever(LEG_LABELS, 'help', 'shown', ['rise_only', 'run_only', 'wrong_slope'],
      'The learner misread a leg or used one leg only.',
      'Prints each leg\'s length on it, the change in y on the up-or-down leg and the change in x on the across leg. The learner '
        + 'still forms the fraction.'));
    if (ticks) out.push(lever(COUNT_TICKS, 'help', 'shown', ['rise_only', 'run_only', 'wrong_slope'],
      'The learner miscounted a leg.',
      'Draws a tick at every grid step along each leg, to count. No number.'));
    out.push(lever(FORMULA_FRAME, 'help', 'both', ['reciprocal', 'negative_reciprocal', 'rise_only', 'run_only', 'opposite_sign'],
      'The learner turned the ratio over, used one leg, or lost the sign.',
      'Shows the badge slope = change in y over change in x on the grid, and writes under the card that the up-or-down leg goes on '
        + 'top and that a line falling from left to right has a negative slope. No number.'));
  } else {
    if (ticks) out.push(lever(COUNT_TICKS, 'help', 'shown', ['rise_off', 'wrong_ratio'],
      'The learner miscounted the rise or the run they built.',
      'Draws a tick at every grid step along the learner\'s run and rise as they build, to count. No number.'));
    out.push(lever(BUILD_FRAME, 'help', 'both', ['flat', 'wrong_sign', 'swapped', 'rise_off', 'wrong_ratio'],
      'The learner checked a triangle whose top corner is off the line.',
      'Writes under the card: the top corner lands back on the line when the rise is the slope times the run, with the top corner '
        + 'below the right angle for a line that falls from left to right; the top corner\'s buttons change the rise. No number.'));
  }
  if (triangleModel(c)) out.push(lever(MODEL_TRIANGLE, 'help', 'both', all,
    c.type === 'identify_slope' ? 'The learner does not know how to read a rise and a run off a triangle.'
      : c.type === 'calculate' ? 'The learner does not know how a slope comes from a triangle\'s legs.'
        : 'The learner does not know how a line\'s slope sets a triangle\'s rise.',
    'Shows a worked example beside the grid: a triangle on a different line with its rise, run'
      + (c.type === 'identify_slope' ? '' : ' and slope') + ' worked out. Read it aloud; it never shows this item\'s numbers.'));
  if (simplerItem(c)) out.push(lever(SIMPLER, 'simplify', 'shown', all,
    'This item is too big a step yet.',
    c.type === 'identify_slope' ? 'Opens a smaller triangle on another line first, with ticks to count. It is not graded; the full item comes back after it.'
      : c.type === 'calculate' ? 'Opens a small triangle on another line first, its legs labelled and needing no reducing. It is not graded; the full item comes back after it.'
        : 'Opens another line first whose slope is a whole number, ticks shown. It is not graded; the full item comes back after it.'));
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. A model's caption and printed legs, never the key. */
export function leverFacts(c: SlopeTriangleChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeItem(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const delta = c.triangle.notation === 'deltaNotation';
  const model = on(MODEL_TRIANGLE) ? triangleModel(c) : null;
  return [
    on(COUNT_TICKS) && 'A tick marks every grid step along each leg of the triangle, without numbers.',
    on(LEG_NAMES) && 'The word rise is written on the up-or-down leg and the word run on the across leg.',
    on(SIGN_FRAME) && 'Under the card: from the left corner, a rise that goes up is positive and one that goes down is negative; the run counts to the right, so it is positive.',
    on(LEG_LABELS) && `The legs are labelled ${delta ? 'Δy' : 'rise'} = ${c.expectedRise} and ${delta ? 'Δx' : 'run'} = ${c.expectedRun}.`,
    on(FORMULA_FRAME) && `A badge on the grid reads slope = ${delta ? 'Δy ÷ Δx' : 'rise ÷ run'}; under the card: the up-or-down leg goes on top, and a line that falls from left to right has a negative slope.`,
    on(BUILD_FRAME) && 'Under the card: the top corner lands back on the line when the rise is the slope times the run, with the top corner below the right angle for a line that falls from left to right; the top corner\'s buttons change the rise.',
    model && `Beside the grid, a worked example on a different line: ${model.caption}.`,
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' when/does words: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
