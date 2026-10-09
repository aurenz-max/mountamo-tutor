/**
 * Circle explorer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C18).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item: the learner
 * types a number and presses Check, and the activity's own check accepts it within the item's tolerance (which covers
 * π ≈ 3.14 against the true π). On discover π the circumference must be unrolled first. The tutor is never handed the
 * answer: not the ratio, the circumference, the area, the radius a reverse item asks for, or a composite's result.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { CircleExplorerChallenge, CircleExplorerChallengeType } from './CircleExplorer';

/** π as the activity tells the learner to use it (the generator computes every answer with it). */
export const PI_APPROX = 3.14;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** A number as the screen prints it: at most two decimals, no trailing zeros. */
export const fmt = (n: number) => String(round2(n));

/** The typed entry as a number: a decimal or a fraction ("22/7"); NaN when it is neither. */
export function parseCircleAnswer(typed: string): number {
  const t = typed.trim();
  if (!t) return NaN;
  if (t.includes('/')) {
    const [num, den] = t.split('/').map((s) => parseFloat(s.trim()));
    return Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? num / den : NaN;
  }
  return parseFloat(t);
}

/** The learner's work: what is typed, and whether the circumference was unrolled or the circle sliced. */
export interface CircleWork {
  typed: string;
  unrolled: boolean;
  sliced: boolean;
}

export const withinKey = (ch: CircleExplorerChallenge, value: number) => Math.abs(value - ch.expectedAnswer) <= ch.tolerance;

/** The activity's own check. An empty or non-numeric entry is not a check at all (the caller does not commit it). */
export function circleCorrect(ch: CircleExplorerChallenge, work: CircleWork): boolean {
  const n = parseCircleAnswer(work.typed);
  return Number.isFinite(n) && withinKey(ch, n);
}

/** The learner's work in words, never the key. */
export function describeCircleWork(ch: CircleExplorerChallenge, work: CircleWork): string {
  const t = work.typed.trim();
  const typed = t ? `typed ${t}` : 'nothing typed yet';
  if (ch.type === 'discover_pi') return `${work.unrolled ? 'unrolled the circumference; ' : 'has not unrolled the circumference; '}${typed}`;
  return typed;
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the number typed, drawn from the catalog's
 * commonStruggles (radius and diameter swapped, the radius not squared, around and inside confused, multiplying where
 * the reverse divides) and from what each mode's formula can be mistaken for:
 * - discover π: `inverse_ratio` d ÷ C; `typed_length` the circumference or the diameter typed instead of the ratio (a
 *   plain 3 is inside the item's tolerance and is credited);
 * - circumference: `pi_times_radius` π × r (half of it); `two_pi_times_diameter` 2 × π × d (twice it);
 *   `area_formula` π × r²; `no_pi` the diameter or the radius alone;
 * - area: `circumference_formula` 2 × π × r; `pi_times_radius` π × r (not squared); `diameter_squared` π × d²;
 *   `no_pi` r²;
 * - reverse: `diameter_not_radius` C ÷ π (the diameter); `multiplied` C or A times π (or 2π); `divided_by_two_only`
 *   C ÷ 2; `no_square_root` A ÷ π (r²); `divided_by_two_pi` A ÷ 2π; `no_pi_divide` √A;
 * - composite: semicircle area `whole_circle` π × r², `diameter_as_radius` ½ × π × (2r)², `half_circumference` π × r;
 *   semicircle perimeter `curve_only` π × r, `full_circle_edge` 2 × π × r (with or without the diameter), `radius_edge`
 *   π × r + r; circle in square `circle_area` π × r², `square_area` s², `added` s² + π × r²;
 * - every mode: `near_miss` within 10%, else `too_high` / `too_low`.
 */
export type CircleMiss = 'inverse_ratio' | 'typed_length'
  | 'pi_times_radius' | 'two_pi_times_diameter' | 'area_formula' | 'no_pi'
  | 'circumference_formula' | 'diameter_squared'
  | 'diameter_not_radius' | 'multiplied' | 'divided_by_two_only' | 'no_square_root' | 'divided_by_two_pi' | 'no_pi_divide'
  | 'whole_circle' | 'diameter_as_radius' | 'half_circumference' | 'curve_only' | 'full_circle_edge' | 'radius_edge'
  | 'circle_area' | 'square_area' | 'added'
  | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly CircleMiss[] = ['near_miss', 'too_high', 'too_low'];
export const CIRCLE_MISSES_BY_MODE: Record<CircleExplorerChallengeType, readonly CircleMiss[]> = {
  discover_pi: ['inverse_ratio', 'typed_length', ...SIZE],
  circumference: ['pi_times_radius', 'two_pi_times_diameter', 'area_formula', 'no_pi', ...SIZE],
  area: ['circumference_formula', 'pi_times_radius', 'diameter_squared', 'no_pi', ...SIZE],
  reverse: ['diameter_not_radius', 'multiplied', 'divided_by_two_only', 'no_square_root', 'divided_by_two_pi', 'no_pi_divide', ...SIZE],
  composite: ['whole_circle', 'diameter_as_radius', 'half_circumference', 'curve_only', 'full_circle_edge', 'radius_edge',
    'circle_area', 'square_area', 'added', ...SIZE],
};

/** The values each signature miss stands for on this item, most specific first. Shared by the check and the harness. */
export function signatureValues(ch: CircleExplorerChallenge): Array<[CircleMiss, number]> {
  const r = ch.radius, d = 2 * r, P = PI_APPROX;
  switch (ch.type) {
    case 'discover_pi': {
      const c = round1(Math.PI * d);
      return [['inverse_ratio', d / c], ['typed_length', c], ['typed_length', d]];
    }
    case 'circumference':
      return [['pi_times_radius', P * r], ['two_pi_times_diameter', 2 * P * d], ['area_formula', P * r * r],
        ['no_pi', d], ['no_pi', r]];
    case 'area':
      return [['circumference_formula', 2 * P * r], ['pi_times_radius', P * r], ['diameter_squared', P * d * d], ['no_pi', r * r]];
    case 'reverse': {
      const g = ch.givenValue ?? 0;
      return ch.reverseGiven === 'area'
        ? [['no_square_root', g / P], ['divided_by_two_pi', g / (2 * P)], ['no_pi_divide', Math.sqrt(g)], ['multiplied', g * P]]
        : [['diameter_not_radius', g / P], ['divided_by_two_only', g / 2], ['multiplied', g * 2 * P], ['multiplied', g * P]];
    }
    case 'composite': {
      if (ch.compositeShape === 'circle_in_square') {
        const s = ch.squareSide ?? d;
        return [['circle_area', P * r * r], ['square_area', s * s], ['added', s * s + P * r * r]];
      }
      if (ch.compositeShape === 'semicircle_perimeter') {
        return [['curve_only', P * r], ['full_circle_edge', 2 * P * r], ['full_circle_edge', 2 * P * r + d], ['radius_edge', P * r + r]];
      }
      return [['whole_circle', P * r * r], ['diameter_as_radius', 0.5 * P * d * d], ['half_circumference', P * r]];
    }
  }
}

/** Within `v`'s own band: 2% of `v` (rounding, or π as 22/7), and at least 0.06. The item's tolerance is sized to the
 *  key, not to a signature value, so it is not used here. */
const near = (value: number, v: number) => Math.abs(value - v) <= Math.max(0.06, Math.abs(v) * 0.02);

export function circleMiss(ch: CircleExplorerChallenge, work: CircleWork): CircleMiss | undefined {
  if (circleCorrect(ch, work)) return undefined;
  const value = parseCircleAnswer(work.typed);
  if (!Number.isFinite(value)) return undefined;
  for (const [miss, v] of signatureValues(ch)) {
    if (v > 0 && !withinKey(ch, v) && near(value, v)) return miss;
  }
  const key = ch.expectedAnswer;
  if (Math.abs(value - key) <= Math.abs(key) * 0.1) return 'near_miss';
  return value > key ? 'too_high' : 'too_low';
}

export function workspaceAssignment(ch: CircleExplorerChallenge): TeachingAssignment {
  return { id: ch.id, task: `${ch.narration} ${ch.instruction}`.trim(), response: 'gesture' };
}

/** What the box in front of the answer says (`C ÷ d =`, `r =`, `Area =` ...), as the component prints it. */
export function answerLead(ch: CircleExplorerChallenge): string {
  if (ch.type === 'discover_pi') return 'C ÷ d =';
  if (ch.type === 'reverse') return 'r =';
  if (ch.answerKind === 'area') return 'Area =';
  if (ch.type === 'composite') return 'Perimeter =';
  return 'C =';
}

/** The answer's unit as the component prints it after the box: none for a ratio, square units for an area. */
export function unitSuffix(ch: CircleExplorerChallenge): string {
  if (ch.answerKind === 'ratio') return '';
  if (ch.answerKind === 'area') return `${ch.unitLabel}²`;
  return ch.unitLabel;
}

/** What the figure prints, as the canvas draws it (the canvas text is not in the page, so this is the tutor's view). */
export function figureLabels(ch: CircleExplorerChallenge, view: Pick<CircleWork, 'unrolled' | 'sliced'>): string {
  const u = ch.unitLabel, r = ch.radius, d = 2 * r, formula = ch.showFormulaReveal !== false;
  switch (ch.type) {
    case 'discover_pi':
      return [`a circle with its diameter drawn across and labelled d = ${fmt(d)} ${u}`,
        formula ? `the circumference labelled C = ${fmt(round1(Math.PI * d))} ${u}` : 'the circumference is not labelled with a number',
        view.unrolled
          ? `the circumference unrolled into a straight line under the circle, with diameter-length pieces marked along it${formula ? ' (each labelled 1 d)' : ', unlabelled'}`
          : 'the circumference is not unrolled yet'].join('; ');
    case 'circumference':
      return [ch.given === 'diameter' ? `a circle with its diameter drawn across and labelled d = ${fmt(d)} ${u}`
        : `a circle with its radius drawn from the center and labelled r = ${fmt(r)} ${u}`,
        view.unrolled ? `the circumference unrolled into a straight line, labelled ${formula ? '"C = 2 × π × r = π × d"' : '"Circumference unrolled"'}` : 'the circumference is not unrolled'].join('; ');
    case 'area':
      return [ch.given === 'diameter' ? `a circle with its diameter drawn across and labelled d = ${fmt(d)} ${u}`
        : `a circle with its radius drawn from the center and labelled r = ${fmt(r)} ${u}`,
        view.sliced ? `the circle sliced into wedges and rearranged into a near-rectangle, its height marked r${formula ? ', labelled "base ≈ π × r" and "A = π × r²"' : ''}`
          : 'the circle is not sliced'].join('; ');
    case 'reverse':
      return `a circle labelled ${ch.reverseGiven === 'area' ? `A = ${fmt(ch.givenValue ?? 0)} ${u}²` : `C = ${fmt(ch.givenValue ?? 0)} ${u}`}; `
        + 'a dashed radius labelled r = ?';
    case 'composite':
      if (ch.compositeShape === 'circle_in_square') {
        return `a square labelled side = ${fmt(ch.squareSide ?? d)} ${u} with a circle fitting exactly inside it, captioned "Shaded = square − circle"`;
      }
      return `a semicircle, flat side down, with its radius labelled r = ${fmt(r)} ${u}, captioned "${ch.compositeShape === 'semicircle_perimeter'
        ? 'Find the perimeter (curve + diameter)' : 'Find the area (half a circle)'}"`;
  }
}

const KIND: Record<CircleExplorerChallengeType, string> = {
  discover_pi: 'discover π: the circumference divided by the diameter, a number with no unit',
  circumference: 'circumference: the distance all the way around the circle',
  area: 'area: the space inside the circle, in square units',
  reverse: 'find the radius, working back from the given circumference or area',
  composite: 'a composite figure made from part of a circle',
};

/** What is drawn and asked. The answer is never named. */
export function workspaceScene(ch: CircleExplorerChallenge, view: CircleWork): WorkspaceScene {
  const suffix = unitSuffix(ch);
  const facts: Record<string, string> = {
    kind: KIND[ch.type],
    figure: figureLabels(ch, view),
    answerBox: `${answerLead(ch)} [box]${suffix ? ` ${suffix}` : ''}`,
    ...(ch.type !== 'discover_pi' ? { piNote: 'The screen says to use π ≈ 3.14.' } : {}),
    formulaLabels: ch.showFormulaReveal === false
      ? 'withheld: the figure prints no formula on its reveals'
      : 'shown on the figure\'s reveals (unroll or slice)',
    learnerWork: describeCircleWork(ch, view),
  };
  facts.constraints = ch.type === 'discover_pi'
    ? 'The learner presses "Unroll the circumference" first, then types a number in the answer box and presses Check. '
      + 'The activity checks it itself, within a small rounding band. You cannot unroll, type, or press Check.'
    : 'The learner types a number in the answer box and presses Check; '
      + (ch.type === 'circumference' ? 'they may unroll the circumference first. '
        : ch.type === 'area' ? 'they may slice the circle into wedges first. ' : '')
      + 'The activity checks it itself, within a small rounding band. You cannot type, press its buttons, or press Check.';
  return { objects: [], facts };
}

/**
 * The journey row's input (`liveJourneySpec.ts`): the number to type. `correct`: the key. `wrong`: the item's first
 * signature miss that is not itself right, else the key half again too high.
 */
export function circleHarnessText(ch: CircleExplorerChallenge, intent: 'correct' | 'wrong'): string {
  if (intent === 'correct') return fmt(ch.expectedAnswer);
  const signature = signatureValues(ch).find(([, v]) => v > 0 && !withinKey(ch, round2(v)));
  return fmt(signature ? signature[1] : ch.expectedAnswer * 1.5);
}
