/**
 * Angle workshop on the shared tutor/JEV teaching workspace: W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md), plus the open build `make_angle` (`/add-eval-modes` references/build-mode.md).
 *
 * Pure: the component, the live adapter, the journey row and the probes read the same assignment, scene and check.
 * Every challenge is answered on the screen and checked by the activity, so the tutor is never handed
 * `expectedAnswer`, `expectedRelationship` or a passing opening.
 *
 * make_angle judge (code, at "I'm done!"). The learner turns one ray from a fixed ray; the opening runs 0..180 in
 * whole degrees. Boundary tolerance, because a dragged ray is placed by eye and hand:
 * - right: 87..93 (90 ± RIGHT_TOL). An opening inside that band is a right angle and is neither acute nor obtuse.
 * - straight: 177..180 (STRAIGHT_MIN). The ray cannot pass 180.
 * - acute: MIN_OPEN..86; obtuse: 94..176. Below MIN_OPEN (5) the ray still lies on the fixed ray: no angle yet.
 * - a degree range ("between 40° and 60°") is inclusive at both ends, no tolerance: the numbers are the ask.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { AngleTargetKind, AngleWorkshopChallenge, AnglePairRelationship } from './AngleWorkshop';

/** The miss for a total other than the figure's (ids are words: the catalog's miss ids take no digits). */
const TOTAL_MISS = { 90: 'total_ninety', 180: 'total_one_eighty', 360: 'total_three_sixty' } as const;

export const RIGHT_TOL = 3;
export const STRAIGHT_MIN = 177;
export const MIN_OPEN = 5;
/** One press of "Open wider" / "Close in". A drag places the ray to the degree. */
export const STEP_DEG = 5;

export const DONE_LABEL = "I'm done!";
export const WIDER_LABEL = 'Open wider';
export const CLOSER_LABEL = 'Close in';
export const RESET_LABEL = 'Start over';
export const ANSWER_LABEL = 'Your answer';
export const PROTRACTOR_LABEL = 'Place the protractor';

export type AngleBand = 'closed' | 'acute' | 'right' | 'obtuse' | 'straight';

/** Which band an opening falls in, with the tolerance above. */
export function bandOf(deg: number): AngleBand {
  if (deg < MIN_OPEN) return 'closed';
  if (deg < 90 - RIGHT_TOL) return 'acute';
  if (deg <= 90 + RIGHT_TOL) return 'right';
  if (deg < STRAIGHT_MIN) return 'obtuse';
  return 'straight';
}

/** Whether an opening is the kind of angle the item asks for. */
export function fitsTarget(c: Pick<AngleWorkshopChallenge, 'targetKind' | 'targetMin' | 'targetMax'>, deg: number): boolean {
  const band = bandOf(deg);
  switch (c.targetKind) {
    case 'acute': case 'smaller_than_right': return band === 'acute';
    case 'right': return band === 'right';
    case 'obtuse': case 'between_right_straight': return band === 'obtuse';
    case 'straight': return band === 'straight';
    case 'bigger_than_right': return band === 'obtuse' || band === 'straight';
    case 'range': return band !== 'closed' && deg >= (c.targetMin ?? 0) && deg <= (c.targetMax ?? -1);
    default: return false;
  }
}

/**
 * What a missed build shows: the kind of angle the learner MADE (never a guessed cause), or, on a degree range,
 * which side of it. `not_opened`: the ray never left the fixed ray.
 */
export type MakeAngleMiss = 'not_opened' | 'made_acute' | 'made_right' | 'made_obtuse' | 'made_straight' | 'below_range' | 'above_range';
export const MAKE_ANGLE_MISSES: readonly MakeAngleMiss[] =
  ['not_opened', 'made_acute', 'made_right', 'made_obtuse', 'made_straight', 'below_range', 'above_range'];

export function makeAngleMiss(c: AngleWorkshopChallenge, deg: number): MakeAngleMiss | undefined {
  if (fitsTarget(c, deg)) return undefined;
  const band = bandOf(deg);
  if (band === 'closed') return 'not_opened';
  if (c.targetKind === 'range') return deg < (c.targetMin ?? 0) ? 'below_range' : 'above_range';
  return `made_${band}` as MakeAngleMiss;
}

// ── The classic modes' misses: what a wrong typed or tapped answer shows ──────

/**
 * The pattern a wrong answer shows on a classic mode, named for the value typed (never a guessed cause). Each id is the
 * total or given the learner's number matches, checked in this order; `near` / `far` are the rest.
 * - measure: `other_scale` (the reading from the other end of the scale, 180 − the angle).
 * - classify_pairs: `chose_<relationship>` (the relationship tapped).
 * - solve_unknown: `total_ninety` / `total_one_eighty` / `total_three_sixty` (a total other than the figure's minus the labeled angles),
 *   `copied_known` (a labeled angle), `one_known_left` (360 minus one labeled angle only, around a point).
 * - solve_algebraic: `typed_an_angle` (the value of one labeled expression, not x), `total_ninety` / `total_one_eighty` (x for a
 *   sum to the other total, or to a total on equal angles).
 * - transversal: `supplement_given` (180 − the marked angle), `copied_given` (a labeled angle), `added_givens` (the two
 *   labeled angles added, on a triangle), `one_given_left` (180 minus one labeled angle only), `found_interior` (the
 *   triangle's own corner where the exterior angle is, 180 − both labeled angles).
 */
export const CLASSIC_MISSES = {
  measure: ['other_scale', 'near', 'far'],
  classify_pairs: ['chose_complementary', 'chose_supplementary', 'chose_vertical', 'chose_adjacent'],
  solve_unknown: ['total_ninety', 'total_one_eighty', 'total_three_sixty', 'copied_known', 'one_known_left', 'near', 'far'],
  solve_algebraic: ['typed_an_angle', 'total_ninety', 'total_one_eighty', 'near', 'far'],
  transversal: ['supplement_given', 'copied_given', 'added_givens', 'one_given_left', 'found_interior', 'near', 'far'],
} as const;

/** A typed answer within this many degrees (or 2 for x) of the key, missed, is `near`. */
const NEAR_DEG = 10;
const NEAR_X = 2;

/** The total a solve_unknown figure's angles fill, or null on vertical angles (equal, no total). */
export function solveTotal(c: AngleWorkshopChallenge): number | null {
  switch (c.solveConfig) {
    case 'complementary': return 90;
    case 'supplementary': return 180;
    case 'around_point': return 360;
    default: return null;
  }
}

/** The two labeled angles' measures on a solve_algebraic item, from its x. */
export function algebraicAngles(c: AngleWorkshopChallenge): [number, number] {
  const x = c.expectedAnswer;
  return [(c.a1 ?? 1) * x + (c.b1 ?? 0), (c.a2 ?? 1) * x + (c.b2 ?? 0)];
}

/** The miss a wrong classic answer shows; undefined when it is right (or on make_angle, judged by `makeAngleMiss`). */
export function classicMiss(c: AngleWorkshopChallenge, answer: { value?: number; relationship?: AnglePairRelationship | null }):
  string | undefined {
  if (c.type === 'make_angle') return undefined;
  if (c.type === 'classify_pairs') {
    const r = answer.relationship;
    return r && r !== c.expectedRelationship ? `chose_${r}` : undefined;
  }
  const v = answer.value;
  if (v === undefined || !Number.isFinite(v) || Math.abs(v - c.expectedAnswer) <= c.tolerance) return undefined;
  const is = (target: number, tol = c.tolerance) => Math.abs(v - target) <= tol;
  const rest = (near: number) => Math.abs(v - c.expectedAnswer) <= near ? 'near' : 'far';
  switch (c.type) {
    case 'measure':
      return is(180 - (c.angleMeasure ?? c.expectedAnswer)) ? 'other_scale' : rest(NEAR_DEG);
    case 'solve_unknown': {
      const k1 = c.knownAngle ?? 0, k2 = c.knownAngle2;
      const known = k1 + (c.solveConfig === 'around_point' ? k2 ?? 0 : 0);
      const own = solveTotal(c);
      for (const t of [90, 180, 360] as const) if (t !== own && is(t - known)) return TOTAL_MISS[t];
      if (is(k1) || (k2 !== undefined && is(k2))) return 'copied_known';
      if (c.solveConfig === 'around_point' && (is(360 - k1) || (k2 !== undefined && is(360 - k2)))) return 'one_known_left';
      return rest(NEAR_DEG);
    }
    case 'solve_algebraic': {
      const [A1, A2] = algebraicAngles(c);
      if (is(A1, 0.5) || is(A2, 0.5)) return 'typed_an_angle';
      const a = (c.a1 ?? 1) + (c.a2 ?? 1), b = (c.b1 ?? 0) + (c.b2 ?? 0);
      const own = c.algConfig === 'complementary' ? 90 : c.algConfig === 'supplementary' ? 180 : null;
      for (const t of [90, 180] as const) if (t !== own && is((t - b) / a, 0.05)) return TOTAL_MISS[t];
      return rest(NEAR_X);
    }
    case 'transversal': {
      const g1 = c.givenAngle ?? 0, g2 = c.givenAngle2;
      if (c.transversalShape === 'parallel_transversal') {
        if (is(180 - g1)) return 'supplement_given';
        if (is(g1)) return 'copied_given';
        return rest(NEAR_DEG);
      }
      const g = g2 ?? 0;
      if (c.transversalShape === 'exterior_angle' && is(180 - g1 - g)) return 'found_interior';
      if (c.transversalShape === 'triangle_sum' && is(g1 + g)) return 'added_givens';
      if (is(g1) || is(g)) return 'copied_given';
      if (c.transversalShape === 'triangle_sum' && (is(180 - g1) || is(180 - g))) return 'one_given_left';
      return rest(NEAR_DEG);
    }
    default:
      return undefined;
  }
}

/** The ask. It states the target: that is the task, not a leak. */
export function makeAngleAsk(kind: AngleTargetKind, min?: number, max?: number): string {
  switch (kind) {
    case 'acute': return 'Make an acute angle.';
    case 'right': return 'Make a right angle.';
    case 'obtuse': return 'Make an obtuse angle.';
    case 'straight': return 'Make a straight angle.';
    case 'between_right_straight': return 'Make an angle that is bigger than a right angle but smaller than a straight angle.';
    case 'smaller_than_right': return 'Make an angle that is smaller than a right angle.';
    case 'bigger_than_right': return 'Make an angle that is bigger than a right angle.';
    default: return `Make an angle between ${min}° and ${max}°.`;
  }
}

/** The words a missed build shows. They name neither the kind the learner made nor its degrees. */
export function makeAngleMissWords(c: AngleWorkshopChallenge, miss: MakeAngleMiss | undefined): string {
  if (miss === 'not_opened') return 'The ray is still lying on the other ray. Open it up to make an angle.';
  if (c.targetKind === 'range') return `Not quite: that angle is not between ${c.targetMin}° and ${c.targetMax}°. Change it, then press I'm done!`;
  return 'Not quite: that is not the angle asked for. Compare it with a square corner, then turn the ray.';
}

// ── The workspace binding (every mode) ──────────────────────────────────────

export function workspaceAssignment(challenge: AngleWorkshopChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface AngleView {
  answerInput: string;
  relationship: AnglePairRelationship | null;
  protractorShown: boolean;
  /** make_angle: the learner's opening in whole degrees, 0 until the ray moves. */
  opening: number;
}

const typed = (text: string, unit: string) => text.trim() ? `Typed ${text.trim()}${unit}` : 'Nothing typed yet';

/** The learner's work in their own terms, never the key. */
export function describeAngleWork(c: AngleWorkshopChallenge, view: AngleView): string {
  if (c.type === 'make_angle') return view.opening < MIN_OPEN ? 'The ray still lies on the fixed ray' : `Opened the angle to ${view.opening}°`;
  if (c.type === 'classify_pairs') return view.relationship ? `Chose ${view.relationship}` : 'No relationship chosen yet';
  return typed(view.answerInput, c.answerKind === 'x_value' ? '' : '°');
}

/** What the figure shows, without its measure, relationship or answer. */
function figure(c: AngleWorkshopChallenge): string {
  switch (c.type) {
    case 'measure': return 'one angle between two rays from a vertex; its measure is not printed';
    case 'classify_pairs': return c.relationship === 'vertical'
      ? 'two lines crossing at a point, with two angles shaded' : 'three rays from one vertex, making two shaded angles';
    case 'solve_unknown': return c.solveConfig === 'around_point'
      ? `rays around a point; angles labeled ${c.knownAngle}° and ${c.knownAngle2}°, and x°`
      : `two angles at one vertex, labeled ${c.knownAngle}° and x°`;
    case 'solve_algebraic': return 'two angles labeled with expressions in x';
    case 'transversal': return c.transversalShape === 'parallel_transversal'
      ? `two parallel lines cut by a transversal; one angle labeled ${c.givenAngle}°, another x°`
      : `a triangle; angles labeled ${c.givenAngle}° and ${c.givenAngle2}°, and x°`;
    default: return 'a fixed ray from a vertex, pointing right, and a second ray the learner turns';
  }
}

/** What is drawn and asked. make_angle publishes the opening as a number so `workHistory` records how it moved. */
export function workspaceScene(c: AngleWorkshopChallenge, view: AngleView): WorkspaceScene {
  const facts: Record<string, string | number> = { kind: c.type, figure: figure(c) };
  if (c.type === 'measure') facts.protractor = view.protractorShown ? 'placed' : 'not placed';
  if (c.type === 'classify_pairs') facts.choices = (c.choices ?? RELATIONS).join(' | ');
  if (c.type === 'make_angle') facts.openingDegrees = view.opening;
  facts.learnerWork = describeAngleWork(c, view);
  facts.constraints = c.type === 'make_angle'
    ? 'The learner turns the second ray (drag it, or press Open wider / Close in) and presses I\'m done!; the activity '
      + 'checks the angle itself. The opening is not shown on screen. You cannot move the ray for the learner.'
    : 'The learner answers on the screen (types a number or taps a relationship, then presses Check); the activity '
      + 'checks it itself. You cannot type or tap for the learner.';
  return { objects: [], facts };
}

// ── The journey's inputs (liveJourneySpec row, tests) ───────────────────────

export type AngleHarnessInput = { type: 'choose'; label: string } | { type: 'write'; label: string; text: string } | { type: 'check' };

/** An opening reachable with the step buttons that passes the item. */
export function passingOpening(c: AngleWorkshopChallenge): number {
  switch (c.targetKind) {
    case 'acute': case 'smaller_than_right': return 45;
    case 'right': return 90;
    case 'straight': return 180;
    case 'range': return Math.round(((c.targetMin ?? 0) + (c.targetMax ?? 0)) / 2 / STEP_DEG) * STEP_DEG;
    default: return 135;
  }
}

/** A step-reachable opening that misses the item from a real angle (never `not_opened`). */
export function missingOpening(c: AngleWorkshopChallenge): number {
  if (c.targetKind === 'range') return (c.targetMin ?? 0) >= 30 ? (c.targetMin ?? 0) - 20 : (c.targetMax ?? 0) + 20;
  return c.targetKind === 'acute' || c.targetKind === 'smaller_than_right' || c.targetKind === 'straight' ? 135 : 45;
}

const RELATIONS: AnglePairRelationship[] = ['complementary', 'supplementary', 'vertical', 'adjacent'];
const RELATION_LABEL: Record<AnglePairRelationship, string> =
  { complementary: 'Complementary', supplementary: 'Supplementary', vertical: 'Vertical', adjacent: 'Adjacent' };
export const relationshipLabel = (r: AnglePairRelationship) => RELATION_LABEL[r];

/**
 * Every mode through its real controls. make_angle starts over first (Try again keeps the build), turns the ray with
 * the step buttons and presses I'm done!. Measure places the protractor while the scene says it is not placed.
 */
export function angleWorkshopHarnessInputs(c: AngleWorkshopChallenge, wrong: boolean,
  demand?: Record<string, unknown> | null): AngleHarnessInput[] {
  if (c.type === 'make_angle') {
    const deg = wrong ? missingOpening(c) : passingOpening(c);
    return [{ type: 'choose', label: RESET_LABEL },
      ...Array.from({ length: deg / STEP_DEG }, () => ({ type: 'choose' as const, label: WIDER_LABEL })),
      { type: 'choose', label: DONE_LABEL }];
  }
  if (c.type === 'classify_pairs') {
    const key = c.expectedRelationship ?? 'adjacent';
    const pick = wrong ? (c.choices ?? RELATIONS).find(r => r !== key)! : key;
    return [{ type: 'choose', label: RELATION_LABEL[pick] }, { type: 'check' }];
  }
  const off = c.answerKind === 'x_value' ? 3 : c.expectedAnswer + 20 <= 180 ? 20 : -20;
  const value = wrong ? c.expectedAnswer + off : c.expectedAnswer;
  const place: AngleHarnessInput[] = c.type === 'measure' && demand?.protractor !== 'placed'
    ? [{ type: 'choose', label: PROTRACTOR_LABEL }] : [];
  return [...place, { type: 'write', label: ANSWER_LABEL, text: String(value) }, { type: 'check' }];
}
