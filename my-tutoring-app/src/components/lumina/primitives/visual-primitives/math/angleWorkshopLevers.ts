/**
 * The in-item levers on angle-workshop (`/add-support-tiers`; reports qa/eval-reports/angle-workshop-levers-2026-10-08.md).
 * No real-learner evidence: the misses are what `makeAngleMiss` / `classicMiss` observe. Pure: the component draws from
 * these, the workspace publishes them, the tests hold each leak rule. Every lever starts released at every tier (the
 * generator's tier scaffolds, the reading cue, the perception marks and the named relationship, are the starting
 * positions and stay as they are).
 *
 * make_angle (open build; judging the opening by eye IS the task):
 * - `corner_marker` (help): a dashed square corner and straight line at the vertex. Leak rule: the benchmarks only.
 * - `protractor` (help): a degree scale behind the rays, nothing marked.
 * - `coarser_class` (simplify): an ask on one side of a right angle only (`<item>~coarser`); none on a right angle.
 *   `not_opened` has no lever: the screen already says to open the ray.
 * measure:
 * - `tens_labels` (help): places the protractor and numbers its scale every 10° from 0 up to the last ten at least 5°
 *   short of the second ray (`tensLabels`, `tensLeak`): the learner counts the last step.
 * - `simpler_item`: an acute angle on a ten, away from the item's reading and its other-scale reading.
 * classify_pairs (the relationship is the answer, so the help is the same on every item):
 * - `benchmarks` (help): dashed rays at a square corner and a straight line from the vertex along the bottom ray.
 * - `simpler_item`: a pair of ANOTHER relationship with two choices, neither of them the item's answer.
 * solve_unknown / solve_algebraic:
 * - `whole_angle` (help): a dashed arc over the whole the angles fill (two on vertical angles: each straight line through
 *   the unlabeled neighbour), no number (`wholeArcs`).
 * - `try_your_x` (help, solve_algebraic, after a wrong answer): the learner's own last x put into each label
 *   (`tryYourX`); never the key.
 * - `simpler_item`: one subtraction instead of two (around a point), a known on a ten, unit coefficients, or 2x and x.
 * transversal:
 * - `slide_copy` (help, parallel lines except corresponding): a dashed copy of the marked angle at the other crossing,
 *   never on x (`slideLeaks`). `straight_arcs` (corresponding): a dashed half-circle under the line at each crossing.
 *   `corners_on_line` (triangle sum): the two labeled corners side by side on a straight line, the rest blank.
 *   `straight_at_corner` (exterior angle): a dashed half-circle over the base at x's corner, the triangle's corner there
 *   outlined.
 * - `simpler_item`: exterior angle → triangle sum; co-interior → corresponding. None on the plainest shapes.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type {
  AnglePairRelationship, AngleTargetKind, AngleWorkshopChallenge, TransversalRelation,
} from './AngleWorkshop';
import { algebraicAngles, makeAngleAsk, solveTotal } from './angleWorkshopWorkspace';

export const CORNER_LEVER = 'corner_marker';
export const PROTRACTOR_LEVER = 'protractor';
export const COARSER_LEVER = 'coarser_class';
export const TENS_LEVER = 'tens_labels';
export const BENCHMARK_LEVER = 'benchmarks';
export const WHOLE_LEVER = 'whole_angle';
export const TRY_X_LEVER = 'try_your_x';
export const SLIDE_LEVER = 'slide_copy';
export const STRAIGHT_ARCS_LEVER = 'straight_arcs';
export const CORNERS_LEVER = 'corners_on_line';
export const EXTERIOR_LEVER = 'straight_at_corner';
export const SIMPLER_LEVER = 'simpler_item';
export const PRACTICE_SUFFIX = '~simpler';
export const COARSER_SUFFIX = '~coarser';
export const PRACTICE_NOTE = 'An easier practice question, ungraded; the full item comes back after it.';

// ── make_angle ─────────────────────────────────────────────────────────────

/** The coarser side of a right angle an ask reduces to, or null when it has none (a right angle). */
function coarserKind(c: AngleWorkshopChallenge): AngleTargetKind | null {
  switch (c.targetKind) {
    case 'acute': return 'smaller_than_right';
    case 'obtuse': case 'between_right_straight': case 'straight': return 'bigger_than_right';
    case 'range': return (c.targetMax ?? 0) < 90 ? 'smaller_than_right' : (c.targetMin ?? 0) > 90 ? 'bigger_than_right' : null;
    default: return null;
  }
}

/** The easier ask for a make_angle item, or null. */
export function coarserMakeAngle(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  if (c.type !== 'make_angle') return null;
  const kind = coarserKind(c);
  if (!kind) return null;
  return { ...c, id: `${c.id}${COARSER_SUFFIX}`, targetKind: kind, targetMin: undefined, targetMax: undefined, instruction: makeAngleAsk(kind) };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

/** The levers on a make_angle session item (none on another type, or while the easier practice item is up). */
export function makeAngleLevers(c: AngleWorkshopChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.type !== 'make_angle') return [];
  return [
    lever(CORNER_LEVER, 'help', ['made_acute', 'made_right', 'made_obtuse', 'made_straight'],
      'The learner\'s angle is a different kind from the one asked for.',
      'Draws a dashed square corner and a dashed straight line at the vertex, to compare the angle with. The learner\'s ray stays where it is; no measure is written.',
      pulled),
    lever(PROTRACTOR_LEVER, 'help', ['below_range', 'above_range'],
      'The learner\'s angle is outside the degrees asked for, or they cannot judge its size.',
      'Puts a protractor scale behind the rays for the learner to read. No reading is marked.',
      pulled),
    ...(coarserMakeAngle(c) ? [lever(COARSER_LEVER, 'simplify', ['made_acute', 'made_obtuse', 'made_straight', 'below_range', 'above_range'],
      'The learner keeps making the wrong kind of angle, or cannot start.',
      'Opens an easier ask first: an angle on one side of a right angle only (bigger than, or smaller than, a right angle). It is not graded; the full item comes back after it.',
      pulled)] : []),
  ];
}

/** What the pulled make_angle levers put on screen, for the tutor's `onScreen` fact. */
export function makeAngleLeverFacts(pulled: readonly string[]): string | undefined {
  const notes = [
    pulled.includes(CORNER_LEVER) && 'A dashed square corner and a dashed straight line are drawn at the vertex.',
    pulled.includes(PROTRACTOR_LEVER) && 'A protractor scale is behind the rays.',
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

// ── measure: the tens labels ─────────────────────────────────────────────────

/** The tens numbered on the scale: 0 up to the last ten at least 5° short of the angle, none at or past it. */
export function tensLabels(c: AngleWorkshopChallenge): number[] {
  const m = c.angleMeasure ?? c.expectedAnswer;
  return Array.from({ length: Math.floor((m - 5) / 10) + 1 }, (_, i) => i * 10).filter(t => t <= m - 5);
}

/** Leak rule: a label at or within 5° of the reading (or of its other-scale reading) would read the angle out. */
export function tensLeak(labels: readonly number[], c: AngleWorkshopChallenge): boolean {
  const m = c.angleMeasure ?? c.expectedAnswer;
  return labels.some(t => t > m - 5);
}

// ── solve_unknown / solve_algebraic: the whole angle ───────────────────────

/** Dashed arcs (degrees, counter-clockwise from the bottom ray) over the whole the angles fill. On vertical angles, one
 *  arc over the labeled angle and its unlabeled neighbour, and one over that neighbour and x. */
export function wholeArcs(c: AngleWorkshopChallenge): Array<[number, number]> {
  if (c.type === 'solve_unknown') {
    if (c.solveConfig === 'vertical') { const k = c.knownAngle ?? 50; return [[0, 180], [k, k + 180]]; }
    return [[0, solveTotal(c) ?? 180]];
  }
  if (c.type === 'solve_algebraic') {
    if (c.algConfig === 'vertical') { const k = Math.max(20, Math.min(160, algebraicAngles(c)[0])); return [[0, 180], [k, k + 180]]; }
    return [[0, c.algConfig === 'complementary' ? 90 : 180]];
  }
  return [];
}

function wholeFact(c: AngleWorkshopChallenge): string {
  const vertical = c.solveConfig === 'vertical' || c.algConfig === 'vertical';
  if (vertical) return 'Two dashed arcs: one across the first labeled angle and the unlabeled angle beside it, one across '
    + 'that unlabeled angle and the other labeled angle. No number is written.';
  if (c.solveConfig === 'around_point') return 'A dashed circle is drawn all the way around the point, through all three angles. No number is written.';
  return 'A dashed arc is drawn across both angles together, from one outer ray to the other. No number is written.';
}

// ── solve_algebraic: the learner's own x in the labels ─────────────────────

const fmt = (a: number, b: number, x: string) => {
  const ax = a === 1 ? x : `${a}·${x}`;
  return b === 0 ? ax : `${ax} ${b > 0 ? '+' : '−'} ${Math.abs(b)}`;
};
const round = (n: number) => Math.round(n * 100) / 100;

/** The learner's last checked x put into each label, or null when there is none or it is the key (leak rule). */
export function tryYourX(c: AngleWorkshopChallenge, value: number | undefined): string | null {
  if (c.type !== 'solve_algebraic' || value === undefined || !Number.isFinite(value)) return null;
  if (Math.abs(value - c.expectedAnswer) <= c.tolerance) return null;
  const v = String(round(value));
  const a1 = c.a1 ?? 1, b1 = c.b1 ?? 0, a2 = c.a2 ?? 1, b2 = c.b2 ?? 0;
  return `Your x = ${v} put into the labels: (${fmt(a1, b1, v)})° = ${round(a1 * value + b1)}° and (${fmt(a2, b2, v)})° = ${round(a2 * value + b2)}°`;
}

// ── transversal ────────────────────────────────────────────────────────────

/** Where an angle sits at a crossing: below or above the parallel line, right or left of the transversal. */
export type CrossingPlace = 'lower_right' | 'upper_left' | 'upper_right' | 'lower_left';

/** The marked angle's place at the upper crossing: interior (below the top line) except an alternate exterior pair,
 *  whose marked angle is exterior (above it). */
export const markedPlace = (rel: TransversalRelation): CrossingPlace => rel === 'alternate_exterior' ? 'upper_right' : 'lower_right';

/** x's place at the lower crossing. */
export function xPlace(rel: TransversalRelation): CrossingPlace {
  switch (rel) {
    case 'corresponding': return 'lower_right';
    case 'alternate_interior': return 'upper_left';
    case 'co_interior': return 'upper_right';
    default: return 'lower_left';
  }
}

/** Leak rule: the slid copy lands on x's own place on a corresponding pair, which would draw the answer on x. */
export const slideLeaks = (rel: TransversalRelation) => markedPlace(rel) === xPlace(rel);

const TRANSVERSAL_HELP = (c: AngleWorkshopChallenge): string | null => {
  if (c.type !== 'transversal') return null;
  if (c.transversalShape === 'triangle_sum') return CORNERS_LEVER;
  if (c.transversalShape === 'exterior_angle') return EXTERIOR_LEVER;
  return slideLeaks(c.transRelation ?? 'corresponding') ? STRAIGHT_ARCS_LEVER : SLIDE_LEVER;
};

// ── simpler items ──────────────────────────────────────────────────────────

const practiceOf = (c: AngleWorkshopChallenge, fields: Partial<AngleWorkshopChallenge>): AngleWorkshopChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, narration: '', ...fields });
const firstFit = <T,>(xs: readonly T[], ok: (x: T) => boolean) => xs.find(ok) ?? null;

const MEASURE_PRACTICE = [40, 50, 70, 80, 20] as const;

function simplerMeasure(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  const m = c.angleMeasure ?? c.expectedAnswer;
  if (m <= 80 && m % 10 === 0) return null;
  const p = firstFit(MEASURE_PRACTICE, v => Math.abs(v - m) >= 10 && Math.abs(v - (180 - m)) >= 10);
  return p === null ? null : practiceOf(c, { angleMeasure: p, expectedAnswer: p, showReadingCue: true });
}

/** classify: the relationship the practice pair shows, and its two choices; the item's answer is in neither. */
const CONTRAST: Record<AnglePairRelationship, { rel: AnglePairRelationship; choices: AnglePairRelationship[] }> = {
  complementary: { rel: 'supplementary', choices: ['supplementary', 'vertical'] },
  supplementary: { rel: 'vertical', choices: ['complementary', 'vertical'] },
  vertical: { rel: 'supplementary', choices: ['complementary', 'supplementary'] },
  adjacent: { rel: 'complementary', choices: ['complementary', 'vertical'] },
};

function simplerClassify(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  const own = c.expectedRelationship;
  if (!own) return null;
  const { rel, choices } = CONTRAST[own];
  const figure = rel === 'vertical' ? { crossAngle: c.crossAngle === 60 ? 45 : 60 }
    : rel === 'complementary' ? { splitAngle: c.splitAngle === 30 ? 60 : 30 }
    : { splitAngle: c.splitAngle === 60 ? 120 : 60 };
  return practiceOf(c, { relationship: rel, expectedRelationship: rel, choices, outerAngle: undefined, crossAngle: undefined,
    splitAngle: undefined, ...figure, showPerceptionMarks: true });
}

const SUPP_INSTRUCTION = 'These two angles are supplementary (they add to 180°). Find the unknown angle x.';
const SUPP_HINT = 'Angles on a straight line add to 180°, so x = 180° − the known angle.';
const KNOWN_PRACTICE: Record<'complementary' | 'supplementary', readonly number[]> = {
  complementary: [30, 40, 60, 20, 70], supplementary: [60, 120, 40, 140, 70, 110],
};

function simplerSolve(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  const cfg = c.solveConfig, k = c.knownAngle ?? 0, ans = c.expectedAnswer;
  if (cfg === 'around_point') {
    const K = firstFit(KNOWN_PRACTICE.supplementary, v => v !== k && v !== c.knownAngle2 && v !== ans && 180 - v !== ans);
    return K === null ? null : practiceOf(c, { solveConfig: 'supplementary', knownAngle: K, knownAngle2: undefined,
      expectedAnswer: 180 - K, instruction: SUPP_INSTRUCTION, hint: SUPP_HINT });
  }
  if ((cfg !== 'complementary' && cfg !== 'supplementary') || k % 10 === 0) return null;
  const T = solveTotal(c)!;
  const K = firstFit(KNOWN_PRACTICE[cfg], v => Math.abs(v - k) >= 10 && v !== ans && T - v !== ans);
  return K === null ? null : practiceOf(c, { knownAngle: K, expectedAnswer: T - K });
}

/** The generator's three instruction forms for an algebraic item, so a practice item keeps the item's form. */
function algInstruction(c: AngleWorkshopChallenge, p: AngleWorkshopChallenge): string {
  if (/^Decide how/.test(c.instruction)) return c.instruction;
  if (/Solve the equation/.test(c.instruction)) {
    const e1 = `(${fmt(p.a1 ?? 1, p.b1 ?? 0, 'x')})`, e2 = `(${fmt(p.a2 ?? 1, p.b2 ?? 0, 'x')})`;
    if (p.algConfig === 'vertical') return `These two angles are vertical angles, so they are equal. Solve the equation ${e1} = ${e2} for x.`;
    const total = p.algConfig === 'complementary' ? 90 : 180;
    const rel = p.algConfig === 'complementary' ? 'complementary (they add to 90°)' : 'supplementary (they add to 180°)';
    return `These two angles are ${rel}. Solve the equation ${e1} + ${e2} = ${total} for x.`;
  }
  return c.instruction;
}

const X_PRACTICE = [6, 8, 5, 9, 7, 10, 4, 11, 12] as const;
const B_PRACTICE = [10, 20, 0, 30, 5, 15, 25] as const;

function simplerAlgebraic(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  const a1 = c.a1 ?? 1, a2 = c.a2 ?? 1, x = c.expectedAnswer;
  const vertical = c.algConfig === 'vertical';
  if (vertical ? (a1 + a2 === 3) : (a1 === 1 && a2 === 1)) return null;
  const same = (p: AngleWorkshopChallenge) => p.a1 === c.a1 && p.b1 === c.b1 && p.a2 === c.a2 && p.b2 === c.b2;
  for (const xp of X_PRACTICE.filter(v => v !== x)) for (const b1 of B_PRACTICE) {
    let fields: Partial<AngleWorkshopChallenge>;
    if (vertical) {
      const angle = 2 * xp + b1, b2 = xp + b1;
      if (angle < 20 || angle > 160 || b2 > 60) continue;
      fields = { a1: 2, b1, a2: 1, b2, expectedAnswer: xp };
    } else {
      const T = c.algConfig === 'complementary' ? 90 : 180, angle1 = xp + b1, b2 = T - 2 * xp - b1;
      if (angle1 <= 5 || angle1 >= T - 5 || b2 < -40 || b2 > 175) continue;
      fields = { a1: 1, b1, a2: 1, b2, expectedAnswer: xp };
    }
    const p = practiceOf(c, fields);
    if (same(p)) continue;
    return { ...p, instruction: algInstruction(c, p) };
  }
  return null;
}

const TRIANGLE_PRACTICE: ReadonlyArray<[number, number]> = [[50, 60], [40, 70], [60, 45], [55, 65], [35, 75]];
const EQUAL_PRACTICE = [65, 110, 75, 120, 50, 130] as const;

function simplerTransversal(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  const g1 = c.givenAngle ?? 0, g2 = c.givenAngle2, ans = c.expectedAnswer;
  if (c.transversalShape === 'exterior_angle') {
    const pair = firstFit(TRIANGLE_PRACTICE, ([a, b]) => ![a, b].some(v => v === g1 || v === g2) && 180 - a - b !== ans);
    return pair && practiceOf(c, { transversalShape: 'triangle_sum', givenAngle: pair[0], givenAngle2: pair[1],
      expectedAnswer: 180 - pair[0] - pair[1], transRelation: undefined,
      instruction: 'The three angles of a triangle add to 180°. Two are given — find the third, x.',
      hint: 'The angles of any triangle add to 180°, so x = 180° − the two known angles.' });
  }
  if (c.transversalShape === 'parallel_transversal' && c.transRelation === 'co_interior') {
    const g = firstFit(EQUAL_PRACTICE, v => v !== g1 && v !== ans);
    return g === null ? null : practiceOf(c, { transRelation: 'corresponding', givenAngle: g, expectedAnswer: g,
      instruction: 'The marked angle and x are corresponding angles. Find x.',
      hint: 'corresponding angle pairs are equal when the lines are parallel, so x equals the marked angle.' });
  }
  return null;
}

/** The simpler item for a classic session item, same mode, or null on an item already the plainest of its mode. */
export function simplerItem(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  switch (c.type) {
    case 'measure': return simplerMeasure(c);
    case 'classify_pairs': return simplerClassify(c);
    case 'solve_unknown': return simplerSolve(c);
    case 'solve_algebraic': return simplerAlgebraic(c);
    case 'transversal': return simplerTransversal(c);
    default: return null;
  }
}

/** The practice item a simplify lever opens for any session item: the coarser make_angle ask, or the simpler item. */
export const practiceFor = (c: AngleWorkshopChallenge) => c.type === 'make_angle' ? coarserMakeAngle(c) : simplerItem(c);

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly AngleWorkshopChallenge[]) =>
  id && (id.endsWith(PRACTICE_SUFFIX) || id.endsWith(COARSER_SUFFIX))
    ? challenges.find(c => `${c.id}${c.type === 'make_angle' ? COARSER_SUFFIX : PRACTICE_SUFFIX}` === id) ?? null : null;

/** Leak rule for a simpler item: never the item's id, its answer, or (classify) its relationship as an answer or choice. */
export function practiceLeaks(p: AngleWorkshopChallenge, c: AngleWorkshopChallenge): boolean {
  if (p.id === c.id || p.type !== c.type) return true;
  if (c.type === 'classify_pairs') return p.expectedRelationship === c.expectedRelationship
    || (p.choices ?? []).includes(c.expectedRelationship!);
  return Math.abs(p.expectedAnswer - c.expectedAnswer) <= c.tolerance;
}

// ── the levers on a classic item ───────────────────────────────────────────

const back = 'It is not graded; the full item comes back blank after it.';

/** The levers on a session item of any mode. `pulled` holds this item's runtime pulls; `lastWrong` the learner's last
 *  checked wrong number on it (try_your_x is offered only once there is one). */
export function angleWorkshopLevers(c: AngleWorkshopChallenge | null, pulled: readonly string[], lastWrong?: number):
  WorkspaceLever[] {
  if (!c) return [];
  if (c.type === 'make_angle') return makeAngleLevers(c, pulled);
  const levers: WorkspaceLever[] = [];
  const help = (id: string, answers: readonly string[], when: string, does: string) => levers.push(lever(id, 'help', answers, when, does, pulled));
  const simpler = simplerItem(c);
  const simplify = (answers: readonly string[], does: string) => {
    if (simpler) levers.push(lever(SIMPLER_LEVER, 'simplify', answers,
      'The learner cannot do this item even with the help on screen: a simpler one of the same kind first.', `${does} ${back}`, pulled));
  };
  switch (c.type) {
    case 'measure':
      help(TENS_LEVER, ['other_scale', 'near', 'far'],
        'The learner reads the wrong number off the scale, or does not know where to start counting.',
        'Places the protractor and numbers its scale every 10° from 0 at the bottom ray, stopping short of the second ray. '
          + 'You may point to the 0 and to the numbers; never say the reading.');
      simplify(['other_scale', 'far'], 'Opens a practice angle to read that lands on a ten and is smaller than a square corner.');
      break;
    case 'classify_pairs':
      help(BENCHMARK_LEVER, ['chose_complementary', 'chose_supplementary', 'chose_vertical', 'chose_adjacent'],
        'The learner taps a relationship that does not fit the figure.',
        'Draws a dashed ray at a square corner and a dashed ray making a straight line, both from the vertex along the bottom '
          + 'ray, the same on every figure. You may ask how the outer rays compare with them; never name the relationship.');
      simplify(['chose_complementary', 'chose_supplementary', 'chose_vertical', 'chose_adjacent'],
        'Opens a practice pair of a different relationship with only two choices.');
      break;
    case 'solve_unknown':
      help(WHOLE_LEVER, ['total_ninety', 'total_one_eighty', 'total_three_sixty', 'copied_known', 'one_known_left', 'far'],
        'The learner uses the wrong total, copies a labeled angle, or leaves an angle out.',
        'Draws a dashed arc over the whole the angles fill together (on crossing lines, over each straight line through the '
          + 'unlabeled angle between them). No number is written; never say the total or x.');
      simplify(c.solveConfig === 'around_point' ? ['one_known_left', 'total_ninety', 'total_one_eighty', 'near', 'far'] : ['near'],
        c.solveConfig === 'around_point' ? 'Opens a practice figure of two angles on a straight line: one subtraction.'
          : 'Opens a practice figure of the same kind with a rounder labeled angle.');
      break;
    case 'solve_algebraic':
      help(WHOLE_LEVER, ['total_ninety', 'total_one_eighty'],
        'The learner sets the expressions to the wrong total, or adds angles that are equal.',
        'Draws a dashed arc over the whole the labeled angles fill (on crossing lines, over each straight line through the '
          + 'unlabeled angle between them). No number is written; never say the equation or x.');
      if (tryYourX(c, lastWrong)) help(TRY_X_LEVER, ['typed_an_angle', 'total_ninety', 'total_one_eighty', 'near', 'far'],
        'The learner\'s x is wrong: let them see what it makes the angles.',
        'Writes under the figure the learner\'s own last x put into each label, and the angle each makes. You may ask '
          + 'whether those angles fit the figure; never say the right x.');
      simplify(['typed_an_angle', 'total_ninety', 'total_one_eighty', 'near', 'far'],
        c.algConfig === 'vertical' ? 'Opens a practice pair labeled 2x + b and x + b′: the plainest equal pair.'
          : 'Opens a practice pair whose labels both have x alone (no number in front of x).');
      break;
    case 'transversal': {
      const id = TRANSVERSAL_HELP(c)!;
      if (id === SLIDE_LEVER) help(SLIDE_LEVER, ['supplement_given', 'copied_given', 'near', 'far'],
        'The learner does not see how the angle at one crossing matches an angle at the other.',
        'Draws a dashed copy of the marked angle at the lower crossing, in the same place against the lines as the marked '
          + 'angle at the upper crossing. It is not on x and has no number; never say how it relates to x.');
      if (id === STRAIGHT_ARCS_LEVER) help(STRAIGHT_ARCS_LEVER, ['supplement_given', 'copied_given', 'near', 'far'],
        'The learner subtracts from 180 or cannot see how the two crossings match.',
        'Draws a dashed half-circle under the parallel line at each crossing, across the marked angle (upper crossing) or '
          + 'x (lower crossing) and the angle beside it. No number is written; never say x.');
      if (id === CORNERS_LEVER) help(CORNERS_LEVER, ['added_givens', 'one_given_left', 'copied_given', 'near', 'far'],
        'The learner adds the two labeled angles, or leaves one out.',
        'Draws, below the triangle, a straight line with copies of the two labeled corners side by side on it; the rest of '
          + 'the straight line is blank. No other number is written; never say x.');
      if (id === EXTERIOR_LEVER) help(EXTERIOR_LEVER, ['found_interior', 'copied_given', 'near', 'far'],
        'The learner finds the triangle\'s own corner instead of the outside angle, or copies a labeled angle.',
        'Draws a dashed half-circle over the straight base line at x\'s corner, across x and the triangle\'s own corner '
          + 'there, and outlines that corner dashed. No number is written; never say x.');
      simplify(c.transversalShape === 'exterior_angle' ? ['found_interior', 'copied_given', 'far']
        : ['copied_given', 'supplement_given', 'far'],
      c.transversalShape === 'exterior_angle' ? 'Opens a practice triangle: find its third angle.'
        : 'Opens a practice pair of corresponding angles on the same parallel lines.');
      break;
    }
  }
  return levers;
}

/** What the pulled levers put on screen, for the tutor's `onScreen` fact. Says what is drawn, never the key. */
export function angleLeverFacts(c: AngleWorkshopChallenge | null, pulled: readonly string[], lastWrong?: number): string | undefined {
  if (!c) return undefined;
  if (c.type === 'make_angle') return makeAngleLeverFacts(pulled);
  const on = (id: string) => pulled.includes(id);
  const notes: string[] = [];
  if (on(TENS_LEVER)) {
    const labels = tensLabels(c);
    notes.push(`The protractor is placed, its scale numbered every 10° from 0 at the bottom ray up to ${labels.at(-1)}°; past that only its usual numbers.`);
  }
  if (on(BENCHMARK_LEVER)) notes.push('A dashed ray at a square corner and a dashed ray making a straight line are drawn from the vertex, along the bottom ray.');
  if (on(WHOLE_LEVER)) notes.push(wholeFact(c));
  const tried = on(TRY_X_LEVER) ? tryYourX(c, lastWrong) : null;
  if (tried) notes.push(`Under the figure: ${tried}.`);
  if (on(SLIDE_LEVER)) notes.push('A dashed copy of the marked angle, with no number, is at the lower crossing in the same place against the lines as the marked angle at the upper crossing.');
  if (on(STRAIGHT_ARCS_LEVER)) notes.push('At each crossing a dashed half-circle is drawn under the parallel line, across the marked angle (upper) or x (lower) and the angle beside it. No number is written.');
  if (on(CORNERS_LEVER)) notes.push(`Below the triangle: a straight line with copies of the ${c.givenAngle}° and ${c.givenAngle2}° corners side by side on it; the rest of the straight line is blank, with no number.`);
  if (on(EXTERIOR_LEVER)) notes.push('At x\'s corner: a dashed half-circle over the straight base line, across x and the triangle\'s own corner there; that corner is outlined, with no number.');
  return notes.length ? notes.join(' ') : undefined;
}
