/**
 * Fraction bar on the shared tutor/JEV teaching workspace, W1 minimal binding, plus the open build
 * `build_equal` (`/add-eval-modes` references/build-mode.md).
 *
 * identify / build / compare / add_subtract share one three-step item: pick the numerator, pick the
 * denominator, shade the bar, each with its own Check. A wrong check commits a miss (Try again keeps the
 * step reached); a right numerator or denominator moves to the next step without a commit, and the
 * right shading commits the item. build_equal: the learner splits the bar into equal parts of their
 * choosing, can cut one part in half, shades parts and presses "I'm done!"; any equal fraction passes.
 * Its judgment is fraction-circles' (`fractionEqualBuild.ts`): a part is a span [start, end) of the bar
 * exactly as it is an arc of the circle.
 *
 * Every item is a gesture checked by code, so no key reaches the tutor. Pure: the component, the
 * generator, the live adapter and the tests read the same functions.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FractionBarChallenge, FractionBarChallengeType } from './FractionBar';
import { equalWays } from './fractionEqualBuild';

export type FractionBarPhase = 'identify-numerator' | 'identify-denominator' | 'build-fraction';

export const equalBarInstruction = (a: number, d: number) =>
  `Make a fraction equal to ${a}/${d} your own way: split the bar into equal parts, but not ${d}, then shade some.`;

/** The ask, as the tutor is told it. The fraction is printed on screen: it is the task, not a key. */
export function barTask(type: FractionBarChallengeType, ch: FractionBarChallenge): string {
  if (type === 'build_equal') return ch.instruction ?? equalBarInstruction(ch.numerator, ch.denominator);
  return `Name the numerator and the denominator of ${ch.numerator}/${ch.denominator}, then shade ${ch.numerator}/${ch.denominator} on the bar.`;
}

export function workspaceAssignment(ch: FractionBarChallenge, type: FractionBarChallengeType): TeachingAssignment {
  return { id: ch.id, task: barTask(type, ch), response: 'gesture' };
}

/** What the learner has done on the current step. */
export interface FractionBarView {
  phase: FractionBarPhase;
  /** The number picked on a numerator or denominator step. */
  picked: number | null;
  /** Parts shaded (build step), or shaded parts of the learner's own bar (build_equal). */
  shaded: number;
  /** build_equal: how many parts the learner split the bar into, and whether they are all the same size. */
  parts?: number;
  equalParts?: boolean;
  /** The "Shaded: X/N" readout is on screen (the support tier). */
  readout?: boolean;
  levers?: readonly string[];
  /** An easier practice item stands in for the item (a simplify lever). */
  practice?: boolean;
  /** The three-step item's pulled levers, as drawn (`stepLeverFacts` in `fractionBarLevers.ts`). */
  leverFacts?: readonly string[];
}

/** The learner's checked work, in their terms. Never the key. */
export function describeWork(type: FractionBarChallengeType, ch: FractionBarChallenge, view: FractionBarView): string {
  if (type === 'build_equal') {
    const parts = view.parts ?? 1;
    return `Split the bar into ${parts} ${view.equalParts === false ? 'parts, not all the same size,' : 'equal parts'} and shaded ${view.shaded}`;
  }
  switch (view.phase) {
    case 'identify-numerator': return `Chose ${view.picked ?? 'nothing'} as the numerator`;
    case 'identify-denominator': return `Chose ${view.picked ?? 'nothing'} as the denominator`;
    default: return `Shaded ${view.shaded} of ${ch.denominator} parts`;
  }
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`) on the three-step item, from the learner's own work:
 * numerator step `chose_denominator` (the bottom number picked) / `other_numerator`; denominator step
 * `chose_numerator` / `other_denominator`; shading `shaded_all`, `shaded_the_rest` (the unshaded count
 * shaded instead), `one_short` / `one_over` / `short_by_more` / `over_by_more`. Undefined for a right answer.
 * build_equal names `EqualBuildMiss` (`fractionEqualBuild.ts`).
 */
export type FractionBarMiss = 'chose_denominator' | 'other_numerator' | 'chose_numerator' | 'other_denominator'
  | 'shaded_all' | 'shaded_the_rest' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';
export const FRACTION_BAR_MISSES: readonly FractionBarMiss[] = ['chose_denominator', 'other_numerator', 'chose_numerator',
  'other_denominator', 'shaded_all', 'shaded_the_rest', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

export function fractionBarMiss(ch: FractionBarChallenge, view: FractionBarView): FractionBarMiss | undefined {
  const { numerator: n, denominator: d } = ch;
  switch (view.phase) {
    case 'identify-numerator':
      if (view.picked === n) return undefined;
      return view.picked === d ? 'chose_denominator' : 'other_numerator';
    case 'identify-denominator':
      if (view.picked === d) return undefined;
      return view.picked === n ? 'chose_numerator' : 'other_denominator';
    default: {
      const s = view.shaded;
      if (s === n) return undefined;
      if (s === d) return 'shaded_all';
      if (s === d - n) return 'shaded_the_rest';
      const off = s - n;
      return off === -1 ? 'one_short' : off === 1 ? 'one_over' : off < 0 ? 'short_by_more' : 'over_by_more';
    }
  }
}

// ── build_equal levers (start bare: choosing the split and keeping count of it IS the task) ──

export const COUNT_LEVER = 'running_count';
export const REFERENCE_LEVER = 'show_reference';
export const SMALLER_TARGET_LEVER = 'smaller_target';

/**
 * `smaller_target` (simplify): another target with fewer parts, halves first, never the item's value. Null when
 * the item is already halves. Deterministic, so the live journey can rebuild it from its parent.
 */
export function smallerBarTarget(ch: FractionBarChallenge, band?: string): FractionBarChallenge | null {
  const pick = ([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]] as const).find(([n, d]) => d < ch.denominator
    && n * ch.denominator !== ch.numerator * d && equalWays(n, d, band).length > 0);
  if (!pick) return null;
  const [numerator, denominator] = pick;
  return { ...ch, id: `${ch.id}~smaller`, numerator, denominator, instruction: equalBarInstruction(numerator, denominator) };
}

const LEVER_ANSWERS: Record<string, readonly string[]> = {
  [COUNT_LEVER]: ['one_off'],
  [REFERENCE_LEVER]: ['shaded_the_rest', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'],
  [SMALLER_TARGET_LEVER]: ['same_pieces', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'],
};

/** The levers on a build_equal item; the three-step item's are `stepLevers` (`fractionBarLevers.ts`). */
export function barLevers(type: FractionBarChallengeType, ch: FractionBarChallenge | null, pulled: readonly string[],
  band?: string): WorkspaceLever[] {
  if (type !== 'build_equal' || !ch) return [];
  const lever = (id: string, kind: 'help' | 'simplify', carrier: WorkspaceLever['carrier'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier, when, does, pulled: pulled.includes(id), answers: LEVER_ANSWERS[id] });
  const levers = [
    lever(COUNT_LEVER, 'help', 'both', 'The learner splits the bar in a way that works but shades one part too many or too few.',
      'Shows under the bar how many parts the learner split it into and how many they shaded. Never the target, and never whether the two are equal.'),
    lever(REFERENCE_LEVER, 'help', 'shown',
      'The learner shades the wrong amount, shades the part that should stay empty, makes parts of different sizes, or picks a split that cannot make the fraction.',
      "Draws the target fraction as a second bar under the learner's bar, split into its own parts with its parts shaded. The learner's bar is untouched."),
  ];
  if (smallerBarTarget(ch, band)) levers.push(lever(SMALLER_TARGET_LEVER, 'simplify', 'shown', 'The learner cannot find another way to make this fraction yet.',
    'Opens an easier build first: make a fraction with fewer parts, halves if they fit, your own way. It is not graded; the full item comes back after it.'));
  return levers;
}

/** What a pulled help lever put on screen, as the tutor and the observer read it. Never the answer. */
export function barLeverFacts(type: FractionBarChallengeType, pulled: readonly string[]): string[] {
  if (type !== 'build_equal') return [];
  const facts: string[] = [];
  if (pulled.includes(COUNT_LEVER)) facts.push("Under the learner's bar: how many parts it is split into and how many are shaded.");
  if (pulled.includes(REFERENCE_LEVER)) facts.push("A reference bar under the learner's bar shows the target fraction, split into its own parts with its parts shaded.");
  return facts;
}

const STEP_CONSTRAINTS: Record<FractionBarPhase, string> = {
  'identify-numerator': 'Step 1 of 3. The fraction is printed. The learner picks which number is the numerator from four buttons and presses '
    + 'Check Answer; the activity checks it. Then they pick the denominator, then shade the bar. You cannot pick or shade.',
  'identify-denominator': 'Step 2 of 3. The learner picks which number is the denominator from four buttons and presses Check Answer; '
    + 'the activity checks it. Then they shade the bar. You cannot pick or shade.',
  'build-fraction': 'Step 3 of 3. The bar is split into equal parts. The learner taps parts to shade them and presses Submit Fraction; '
    + 'the bar checks it. You cannot shade.',
};

export function workspaceScene(type: FractionBarChallengeType, ch: FractionBarChallenge, view: FractionBarView): WorkspaceScene {
  const facts: Record<string, string | number> = { kind: type, printedFraction: `${ch.numerator}/${ch.denominator}` };
  if (type === 'build_equal') {
    // An open build: the made quantity is published as numbers, so the shared work history can name a revision.
    // No verdict before "I'm done!": nothing here says whether the bar is equal to the target.
    facts.partsCut = view.parts ?? 1;
    facts.partsShaded = view.shaded;
    facts.partSizes = view.equalParts === false ? 'not all the same size' : 'all the same size';
    facts.learnerWork = describeWork(type, ch, view);
    facts.constraints = `The learner chooses how many equal parts to split the bar into (any number but ${ch.denominator}), `
      + "can cut one part in half, shades parts, and presses I'm done; the bar checks it. Many answers are right. You cannot split or shade.";
  } else {
    facts.step = view.phase === 'identify-numerator' ? 'numerator' : view.phase === 'identify-denominator' ? 'denominator' : 'shade';
    if (view.phase === 'build-fraction') {
      facts.barParts = ch.denominator;
      // The learner's own tally reaches the tutor only while the readout shows it on screen.
      if (view.readout) facts.partsShaded = view.shaded;
    }
    facts.constraints = STEP_CONSTRAINTS[view.phase];
  }
  const onScreen = [...barLeverFacts(type, view.levers ?? []), ...(view.leverFacts ?? [])];
  if (onScreen.length) facts.onScreen = onScreen.join(' ');
  if (view.practice) facts.practice = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';
  return { objects: [], facts };
}
