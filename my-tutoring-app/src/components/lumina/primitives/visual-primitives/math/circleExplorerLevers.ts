/**
 * circle-explorer's in-item levers (/add-support-tiers; report qa/eval-reports/circle-explorer-levers-2026-10-09.md).
 * The misses are what `circleMiss` observes in the number typed; there is no real-learner evidence.
 *
 * - `formula_labels` (help, every mode, only where the hard tier withheld them): the figure's formula labels back on.
 * - discover π: `ratio_frame` (help) "C ÷ d = <C> ÷ <d> = ?" under the figure, the item's own labels (or words when
 *   the circumference is not labelled); `tenth_marks` (help) the unrolled length's piece past the whole diameters
 *   measured against a diameter cut into ten equal, unlabelled parts. No simplify: π is every circle's answer, so any
 *   practice circle would carry the item's answer.
 * - circumference: `other_length` (help) the length the figure does not give, drawn and named by letter (d = r + r, or
 *   r = half of d); `diameters_around` (help) the circumference laid straight with diameter-length bars along it;
 *   `simpler_problem` (simplify) the diameter given (one step fewer) on a round diameter.
 * - area: `radius_square` (help) a square drawn on the radius, captioned that the circle covers a little more than
 *   three of them; `other_length` (help, a given diameter) the radius drawn, r = half of d; `simpler_problem`
 *   (simplify) the radius given on a round radius.
 * - reverse: `undo_chain` (help) the formula's steps from r to the given value and back, symbols only; `other_length`
 *   (help) a dashed diameter, d = r + r; `simpler_problem` (simplify) from a circumference, on a round radius.
 * - composite: `whole_circle` (semicircle area) the missing half drawn dashed; `trace_edges` (semicircle perimeter) the
 *   curved edge and the straight edge in two colours, each named; `shade_corners` (circle in square) the leftover
 *   corners shaded and the inner radius drawn as half the side; `simpler_problem` (simplify) the same figure on round
 *   numbers.
 *
 * Leak rules (code): no lever's `when`/`does` text or scene fact carries a digit; no lever picture's text carries the
 * item's answer as the screen would print it; a practice problem has its own id, a different radius and answer, and
 * keeps the mode (and the composite figure).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CircleExplorerChallenge } from './CircleExplorer';
import { CIRCLE_MISSES_BY_MODE, PI_APPROX, fmt, withinKey, type CircleMiss } from './circleExplorerWorkspace';

export const FORMULA_LEVER = 'formula_labels';
export const RATIO_FRAME_LEVER = 'ratio_frame';
export const TENTHS_LEVER = 'tenth_marks';
export const OTHER_LENGTH_LEVER = 'other_length';
export const AROUND_LEVER = 'diameters_around';
export const SQUARE_LEVER = 'radius_square';
export const CHAIN_LEVER = 'undo_chain';
export const WHOLE_LEVER = 'whole_circle';
export const EDGES_LEVER = 'trace_edges';
export const CORNERS_LEVER = 'shade_corners';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticeCircle = (c: Pick<CircleExplorerChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── pictures ─────────────────────────────────────────────────────────────

/** The discover π frame: the item's own C and d as the figure labels them, or words where C is not labelled. */
export function ratioFrame(c: CircleExplorerChallenge): string {
  const d = 2 * c.radius;
  return c.showFormulaReveal === false
    ? `C ÷ d = unrolled length ÷ ${fmt(d)} ${c.unitLabel} = ?`
    : `C ÷ d = ${fmt(round1(Math.PI * d))} ÷ ${fmt(d)} = ?`;
}

/** The reverse chain: the formula's steps from r to the given value, and the way back, symbols only. */
export function undoChain(c: CircleExplorerChallenge): { forward: string; back: string } {
  return c.reverseGiven === 'area'
    ? { forward: 'r → square it → × π → A', back: 'A → ÷ π → square root → r' }
    : { forward: 'r → × 2 → × π → C', back: 'C → ÷ π → ÷ 2 → r' };
}

/**
 * The discover π track's geometry on a canvas `width` wide: the unrolled line (π diameters) and, for `tenth_marks`,
 * one diameter cut into ten parts starting where the third whole diameter ends. Four diameters fit between the margins,
 * so the ruler's last mark is always inside the canvas. The figure is drawn at a fixed size, whatever the radius.
 */
export function discoverTrack(width: number) {
  const startX = 60, diaPx = (width - 2 * startX) / 4;
  const rulerStart = startX + 3 * diaPx;
  return { startX, diaPx, lineEnd: startX + Math.PI * diaPx,
    tenths: Array.from({ length: 11 }, (_, k) => rulerStart + (k * diaPx) / 10) };
}

/** The other length's name, as `other_length` writes it on the figure. */
export const otherLengthLabel = (c: CircleExplorerChallenge) =>
  c.type === 'reverse' || c.given === 'radius' ? 'd = r + r' : 'r = half of d';

/** The caption each lever picture prints under the figure (no digit). */
export const LEVER_CAPTIONS: Record<string, (c: CircleExplorerChallenge) => string> = {
  [FORMULA_LEVER]: () => 'The figure\'s formula labels are shown.',
  [TENTHS_LEVER]: () => 'The piece of the unrolled length past the whole diameters, against one diameter cut into ten equal parts.',
  [OTHER_LENGTH_LEVER]: (c) => (c.type === 'reverse' || c.given === 'radius'
    ? 'The diameter drawn across: two radii end to end.'
    : 'The radius drawn from the center: half of the diameter.'),
  [AROUND_LEVER]: () => 'The circumference laid straight, with diameter-length bars along it: a few whole diameters and a little more.',
  [SQUARE_LEVER]: () => 'A square on the radius, r by r. The circle covers a little more than three of these squares.',
  [WHOLE_LEVER]: () => 'The whole circle, dashed: the shape is half of it.',
  [EDGES_LEVER]: () => 'Curved edge: half of the whole circle\'s distance around. Straight edge: the diameter, two radii.',
  [CORNERS_LEVER]: () => 'Shaded: the four corners of the square the circle does not cover. The circle\'s radius is half the side.',
};

/** The help levers that act on the figure itself (drawn on the canvas, with a caption under it). */
export const FIGURE_LEVERS: readonly string[] = [TENTHS_LEVER, OTHER_LENGTH_LEVER, AROUND_LEVER, SQUARE_LEVER, WHOLE_LEVER,
  EDGES_LEVER, CORNERS_LEVER];

// ── simplify ─────────────────────────────────────────────────────────────

const lengthTol = (k: number) => Math.max(0.5, Math.abs(k) * 0.02);

/**
 * The easier practice problem for `c`: same mode, one step fewer where the mode has one (circumference from a given
 * diameter, area from a given radius, reverse from a circumference), on a round radius, with its own id and an ask
 * built here. Null for discover π (π is every circle's answer) and when the item is already that problem.
 */
export function simplerCircle(c: CircleExplorerChallenge): CircleExplorerChallenge | null {
  if (isPracticeCircle(c) || c.type === 'discover_pi') return null;
  const P = PI_APPROX, u = c.unitLabel;
  for (const r of [5, 10, 2, 4]) {
    const base = { ...c, id: `${c.id}${SIMPLER}`, radius: r, hint: '', showFormulaReveal: c.showFormulaReveal };
    let practice: CircleExplorerChallenge;
    if (c.type === 'circumference') {
      const k = round2(P * 2 * r);
      practice = { ...base, given: 'diameter', expectedAnswer: k, tolerance: lengthTol(k),
        narration: `Practice first: this circle's diameter is ${2 * r} ${u}.`, instruction: 'Find the circumference — the distance all the way around.' };
    } else if (c.type === 'area') {
      const k = round2(P * r * r);
      practice = { ...base, given: 'radius', expectedAnswer: k, tolerance: lengthTol(k),
        narration: `Practice first: this circle's radius is ${r} ${u}.`, instruction: 'Find the area — the amount of space inside the circle.' };
    } else if (c.type === 'reverse') {
      practice = { ...base, reverseGiven: 'circumference', givenValue: round1(2 * P * r), expectedAnswer: r, tolerance: 0.2,
        narration: 'Practice first: this circle has the circumference shown.', instruction: 'The circumference is given. Work backward to find the radius.' };
    } else {
      const shape = c.compositeShape ?? 'semicircle_area';
      if (shape === 'circle_in_square') {
        const s = 2 * r, k = round2(s * s - P * r * r);
        practice = { ...base, squareSide: s, expectedAnswer: k, tolerance: lengthTol(k),
          narration: `Practice first: a circle fits exactly inside a square with side ${s} ${u}.`,
          instruction: 'A circle is inscribed in the square. Find the shaded area left over.' };
      } else if (shape === 'semicircle_perimeter') {
        const k = round2(P * r + 2 * r);
        practice = { ...base, expectedAnswer: k, tolerance: lengthTol(k), narration: `Practice first: a semicircle with radius ${r} ${u}.`,
          instruction: 'Find the perimeter of this semicircle — the curved part plus the straight diameter.' };
      } else {
        const k = round2(0.5 * P * r * r);
        practice = { ...base, expectedAnswer: k, tolerance: lengthTol(k), narration: `Practice first: a semicircle with radius ${r} ${u}.`,
          instruction: 'Find the area of this semicircle — half of a full circle.' };
      }
    }
    // Already the simpler problem: a round radius with the same given length (or the same figure).
    const sameShape = c.type === 'circumference' ? c.given === 'diameter' : c.type === 'area' ? c.given === 'radius'
      : c.type === 'reverse' ? c.reverseGiven !== 'area' : true;
    if (sameShape && [5, 10].includes(c.radius)) return null;
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice problem: never the learner's item (id, radius), never its answer, and the same mode. */
export function practiceLeaks(parent: CircleExplorerChallenge, practice: CircleExplorerChallenge): boolean {
  return practice.id === parent.id || practice.type !== parent.type || practice.compositeShape !== parent.compositeShape
    || practice.radius === parent.radius || withinKey(parent, practice.expectedAnswer) || withinKey(practice, parent.expectedAnswer)
    || `${practice.narration} ${practice.instruction}`.includes(fmt(parent.expectedAnswer));
}

// ── declarations ─────────────────────────────────────────────────────────

const SIZE: readonly CircleMiss[] = ['near_miss', 'too_high', 'too_low'];

export function circleLevers(c: CircleExplorerChallenge | null, pulled: readonly string[], unrolled = true): WorkspaceLever[] {
  if (!c || isPracticeCircle(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly CircleMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const all = CIRCLE_MISSES_BY_MODE[c.type];
  const out: WorkspaceLever[] = [];
  if (c.showFormulaReveal === false) {
    out.push(lever(FORMULA_LEVER, 'help', 'shown', all,
      'The learner cannot recall which formula the figure shows.',
      'Turns the figure\'s formula labels back on (the ones its reveals print at an easier level). Formulas only, never '
        + 'the answer.'));
  }
  switch (c.type) {
    case 'discover_pi':
      out.push(lever(RATIO_FRAME_LEVER, 'help', 'shown', ['inverse_ratio', 'typed_length', 'too_high', 'too_low'],
        'The learner divides the wrong way round, or types a length instead of the ratio.',
        'Writes "C divided by d equals ?" under the figure with the circumference and the diameter as the figure labels '
          + 'them (words for a circumference the figure does not label). The result is not written.'));
      if (unrolled) {
        out.push(lever(TENTHS_LEVER, 'help', 'shown', ['near_miss', 'too_high', 'too_low'],
          'The learner\'s ratio is off because they cannot see how much is left past the whole diameters.',
          'Under the figure, puts the piece of the unrolled length past the whole diameters beside one diameter cut into '
            + 'ten equal, unlabelled parts, so the leftover can be read in tenths. No number is written.'));
      }
      break;
    case 'circumference':
      out.push(lever(OTHER_LENGTH_LEVER, 'help', 'shown', ['pi_times_radius', 'two_pi_times_diameter', 'no_pi'],
        'The learner uses the radius where the diameter goes, or the other way round.',
        c.given === 'radius'
          ? 'Draws the diameter all the way across the circle, named "d equals r plus r". No number is written.'
          : 'Draws a radius from the center, named "r equals half of d". No number is written.'));
      out.push(lever(AROUND_LEVER, 'help', 'shown', ['no_pi', 'area_formula', 'pi_times_radius', 'two_pi_times_diameter', ...SIZE],
        'The learner does not see that the circumference is a little more than three diameters long.',
        'Lays the circumference out straight under the figure with diameter-length bars along it: three whole ones and a '
          + 'little more. Nothing is labelled with a number.'));
      break;
    case 'area':
      out.push(lever(SQUARE_LEVER, 'help', 'shown', ['circumference_formula', 'pi_times_radius', 'no_pi', 'diameter_squared', ...SIZE],
        'The learner does not square the radius, uses the diameter, or uses the distance around.',
        'Draws a square on the radius, r by r, captioned that the circle covers a little more than three of these squares. '
          + 'No number is written.'));
      if (c.given === 'diameter') {
        out.push(lever(OTHER_LENGTH_LEVER, 'help', 'shown', ['diameter_squared', 'circumference_formula'],
          'The learner uses the diameter where the radius goes.',
          'Draws a radius from the center, named "r equals half of d". No number is written.'));
      }
      break;
    case 'reverse':
      out.push(lever(CHAIN_LEVER, 'help', 'both', all,
        'The learner multiplies where the reverse divides, stops a step early, or skips a step.',
        c.reverseGiven === 'area'
          ? 'Writes the area formula\'s steps under the figure, from r to the area (square it, times pi) and the way back '
            + '(divide by pi, square root). Symbols only; read it aloud.'
          : 'Writes the circumference formula\'s steps under the figure, from r to the circumference (times two, times pi) '
            + 'and the way back (divide by pi, divide by two). Symbols only; read it aloud.'));
      out.push(lever(OTHER_LENGTH_LEVER, 'help', 'shown', ['diameter_not_radius', 'divided_by_two_only'],
        'The learner stops at the diameter.',
        'Draws a dashed diameter across the circle, named "d equals r plus r". No number is written.'));
      break;
    case 'composite':
      if (c.compositeShape === 'circle_in_square') {
        out.push(lever(CORNERS_LEVER, 'help', 'shown', ['circle_area', 'square_area', 'added', ...SIZE],
          'The learner gives the circle or the square, or adds them, instead of what is left over.',
          'Shades the four corners of the square the circle does not cover and draws the circle\'s radius as half the side, '
            + 'captioned "the square without the circle". No number is written.'));
      } else if (c.compositeShape === 'semicircle_perimeter') {
        out.push(lever(EDGES_LEVER, 'help', 'shown', ['curve_only', 'full_circle_edge', 'radius_edge', ...SIZE],
          'The learner leaves out the straight edge, uses the whole circle, or adds the radius.',
          'Traces the curved edge and the straight edge in two colours, named "half of the whole circle\'s distance around" '
            + 'and "the diameter, two radii". No number is written.'));
      } else {
        out.push(lever(WHOLE_LEVER, 'help', 'shown', ['whole_circle', 'diameter_as_radius', 'half_circumference', ...SIZE],
          'The learner gives the whole circle\'s area, or does not see the shape as half of one.',
          'Draws the missing half of the circle dashed, captioned "the whole circle; the shape is half of it". No number is '
            + 'written.'));
      }
      break;
  }
  const easier = simplerCircle(c);
  if (easier) {
    out.push(lever(SIMPLER_LEVER, 'simplify', 'shown', all,
      'These numbers, or this many steps, are too hard yet.',
      c.type === 'circumference' && c.given === 'radius' ? 'Opens an easier problem of the same kind first, with the diameter given '
        + 'instead of the radius, on a round number. It is not graded; the full item comes back after it.'
        : c.type === 'area' && c.given === 'diameter' ? 'Opens an easier problem of the same kind first, with the radius given '
          + 'instead of the diameter, on a round number. It is not graded; the full item comes back after it.'
          : c.type === 'reverse' && c.reverseGiven === 'area' ? 'Opens an easier problem of the same kind first, working back from '
            + 'a circumference instead of an area. It is not graded; the full item comes back after it.'
            : 'Opens an easier problem of the same kind first, on a round radius. It is not graded; the full item comes back '
              + 'after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no answer. */
export function leverFacts(c: CircleExplorerChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeCircle(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(FORMULA_LEVER) && 'The figure\'s formula labels are shown.',
    on(RATIO_FRAME_LEVER) && 'Under the figure: "C divided by d equals ?", with the circumference and the diameter as labelled.',
    on(TENTHS_LEVER) && 'Under the figure, the piece of the unrolled length past the whole diameters sits beside one diameter cut into ten equal, unlabelled parts.',
    on(OTHER_LENGTH_LEVER) && (c.type === 'reverse' || c.given === 'radius'
      ? 'The diameter is drawn across the circle, named d equals r plus r.' : 'A radius is drawn from the center, named r equals half of d.'),
    on(AROUND_LEVER) && 'Under the figure, the circumference is laid straight with diameter-length bars along it, unlabelled.',
    on(SQUARE_LEVER) && 'A square is drawn on the radius, r by r, captioned that the circle covers a little more than three of these squares.',
    on(CHAIN_LEVER) && 'Under the figure are the formula\'s steps from r to the given value and back, in symbols.',
    on(WHOLE_LEVER) && 'The missing half of the circle is drawn dashed: the shape is half of the whole circle.',
    on(EDGES_LEVER) && 'The curved edge and the straight edge are traced in two colours and named.',
    on(CORNERS_LEVER) && 'The corners of the square outside the circle are shaded, and the circle\'s radius is drawn as half the side.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' words and facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/** Leak rule for a lever picture's text: the item's answer as the screen would print it, as a whole number token. */
export const pictureLeaks = (c: CircleExplorerChallenge, text: string) =>
  new RegExp(`(^|[^\\d.])${fmt(c.expectedAnswer).replace('.', '\\.')}(?![\\d])`).test(text);
