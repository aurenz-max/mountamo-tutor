/**
 * The in-item levers on the fraction-bar three-step item, which identify, build, compare and add_subtract share (pick
 * the numerator, pick the denominator, shade the bar; `/add-support-tiers`, report
 * qa/eval-reports/fraction-bar-levers-2026-10-08.md). No real-learner evidence: the misses are what `fractionBarMiss`
 * observes. build_equal's levers stay in `fractionBarWorkspace.ts`.
 *
 * - `model_fraction` (help, every step): a different fraction drawn beside the item, the word numerator beside its top
 *   number and denominator beside its bottom number, and a bar of its parts with its parts shaded. Leak rule
 *   (`modelLeaks`): the model shares no number with the item and is not its value, so nothing on it can be copied as
 *   the pick or the count.
 * - `running_count` (help, shade step): how many parts the learner has shaded, above the bar. Never the verdict: no
 *   colour or mark changes when the count reaches the numerator.
 * - `number_parts` (help, shade step): the place number of every part, 1 to N from the left.
 *   Both start pulled where the generator's tier shows them (easy, medium, no tier); a starting position is not a pull.
 * - `smaller_fraction` (simplify): an ungraded practice item of the same mode with fewer parts (the fewest the mode's
 *   window allows) and two choices per pick, the practice fraction's own numerator and denominator. Never the item's
 *   value or denominator (`practiceLeaks`). None on the mode's plainest items (identify 1/2, build x/3, compare x/4,
 *   add_subtract x/3).
 * Every builder is deterministic, so the live journey rebuilds the practice item from its parent.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FractionBarChallenge, FractionBarChallengeType } from './FractionBar';
import { smallerBarTarget, type FractionBarPhase } from './fractionBarWorkspace';

export const MODEL_LEVER = 'model_fraction';
export const STEP_COUNT_LEVER = 'running_count';
export const NUMBER_PARTS_LEVER = 'number_parts';
export const SMALLER_FRACTION_LEVER = 'smaller_fraction';
/** The practice item's id suffix (shared with build_equal's `smallerBarTarget`). */
export const PRACTICE_SUFFIX = '~smaller';

type StepType = Exclude<FractionBarChallengeType, 'build_equal'>;
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

/** The generator's fraction window per mode (`gemini-fraction-bar.ts` *Operands): the practice item stays inside it. */
const WINDOW: Record<StepType, { denominators: readonly number[]; numerators: (d: number) => number[] }> = {
  identify: { denominators: [2, 3, 4, 6, 8], numerators: () => [1] },
  build: { denominators: range(3, 6), numerators: d => range(2, d - 1) },
  compare: { denominators: range(4, 12), numerators: d => range(1, d - 1) },
  add_subtract: { denominators: range(3, 10), numerators: d => range(1, d - 1) },
};

interface Fraction { numerator: number; denominator: number }
const sameValue = (a: Fraction, b: Fraction) => a.numerator * b.denominator === b.numerator * a.denominator;

// ── model_fraction ──

const MODEL_POOL: readonly Fraction[] = [[3, 5], [2, 5], [3, 4], [4, 5], [2, 3], [5, 6], [3, 8], [5, 8], [4, 7], [7, 10]]
  .map(([numerator, denominator]) => ({ numerator, denominator }));

/** The leak rule: a model that shares a number with the item, or is its value, can be copied as the pick or the count. */
export function modelLeaks(item: Fraction, model: Fraction): boolean {
  const own = [item.numerator, item.denominator];
  return own.includes(model.numerator) || own.includes(model.denominator) || sameValue(item, model);
}

/** The first model fraction that passes the leak rule. */
export function modelFraction(ch: Fraction): Fraction | null {
  return MODEL_POOL.find(m => !modelLeaks(ch, m)) ?? null;
}

// ── smaller_fraction ──

/** The leak rule: the practice item is never the item's own value or its own bar. */
export function practiceLeaks(item: Fraction, practice: Fraction): boolean {
  return practice.denominator === item.denominator || sameValue(item, practice);
}

/**
 * The simpler item: the fewest parts the mode's window has below the item's, the first numerator that passes the leak
 * rule, and two choices per pick (its numerator and its denominator, in an order taken from the parent so neither
 * position always holds the answer). Null on the mode's plainest item.
 */
export function smallerFraction(type: FractionBarChallengeType, ch: FractionBarChallenge): FractionBarChallenge | null {
  if (type === 'build_equal') return null;
  const window = WINDOW[type];
  for (const denominator of window.denominators.filter(d => d < ch.denominator)) {
    const numerator = window.numerators(denominator).find(n => !practiceLeaks(ch, { numerator: n, denominator }));
    if (numerator === undefined) continue;
    const pair = (ch.numerator + ch.denominator) % 2 ? [numerator, denominator] : [denominator, numerator];
    return { id: `${ch.id}${PRACTICE_SUFFIX}`, numerator, denominator, numeratorChoices: pair, denominatorChoices: [...pair] };
  }
  return null;
}

/** The practice item a simplify lever opens on any mode (build_equal: `smallerBarTarget`), or null. */
export function barPractice(type: FractionBarChallengeType, ch: FractionBarChallenge, band?: string): FractionBarChallenge | null {
  return type === 'build_equal' ? smallerBarTarget(ch, band) : smallerFraction(type, ch);
}

// ── the lever list ──

const ALL_MISSES = ['chose_denominator', 'other_numerator', 'chose_numerator', 'other_denominator', 'shaded_all',
  'shaded_the_rest', 'one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
const COUNT_MISSES = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
const LEVER_ANSWERS: Record<string, readonly string[]> = {
  [MODEL_LEVER]: ['chose_denominator', 'other_numerator', 'chose_numerator', 'other_denominator', 'shaded_all', 'shaded_the_rest'],
  [STEP_COUNT_LEVER]: COUNT_MISSES,
  [NUMBER_PARTS_LEVER]: COUNT_MISSES,
  [SMALLER_FRACTION_LEVER]: ALL_MISSES,
};

/** Which shade-step levers the generator's tier already shows. */
export interface StepLeverStart { readout: boolean; numerals: boolean }

/** The levers on a three-step session item at its current step. `pulled` holds this item's runtime pulls. */
export function stepLevers(type: FractionBarChallengeType, ch: FractionBarChallenge | null, phase: FractionBarPhase,
  pulled: readonly string[], start: StepLeverStart): WorkspaceLever[] {
  if (type === 'build_equal' || !ch) return [];
  const lever = (id: string, kind: 'help' | 'simplify', carrier: WorkspaceLever['carrier'], when: string, does: string,
    startsPulled = false): WorkspaceLever => ({ id, kind, carrier, when, does, pulled: startsPulled || pulled.includes(id),
    answers: LEVER_ANSWERS[id] });
  const levers: WorkspaceLever[] = [];
  if (phase === 'build-fraction') levers.push(
    lever(STEP_COUNT_LEVER, 'help', 'both', 'The learner shades one or more parts too many or too few.',
      'Shows above the bar how many parts the learner has shaded so far. Nothing changes colour when it is the right number.',
      start.readout),
    lever(NUMBER_PARTS_LEVER, 'help', 'shown', 'The learner loses track of which parts they have counted.',
      'Writes the place number of every part, 1 to the last, from the left, inside the bar.', start.numerals),
  );
  if (modelFraction(ch)) levers.push(lever(MODEL_LEVER, 'help', 'both',
    'The learner mixes up the numerator and the denominator, picks a number that is neither, shades every part, or shades the parts that should stay empty.',
    'Draws a different fraction beside this one: the word numerator beside its top number, the word denominator beside its bottom '
      + 'number, and a small bar of its parts with its parts shaded. This fraction is untouched.'));
  if (smallerFraction(type, ch)) levers.push(lever(SMALLER_FRACTION_LEVER, 'simplify', 'shown',
    'The learner cannot do this fraction even with help: a fraction with fewer parts first.',
    'Opens an easier practice fraction with fewer parts and only two numbers to choose from at each pick. It is not graded; '
      + 'this fraction comes back after it, from the first step.'));
  return levers;
}

/** What the pulled levers put on screen, as the tutor and the observer read it: what is drawn, never the key. */
export function stepLeverFacts(type: FractionBarChallengeType, ch: FractionBarChallenge, phase: FractionBarPhase,
  on: readonly string[]): string[] {
  if (type === 'build_equal') return [];
  const facts: string[] = [];
  const model = on.includes(MODEL_LEVER) ? modelFraction(ch) : null;
  if (model) facts.push(`A different fraction, ${model.numerator}/${model.denominator}, is drawn beside this one: the word numerator `
    + `beside its top number ${model.numerator}, the word denominator beside its bottom number ${model.denominator}, and a bar of `
    + `${model.denominator} equal parts with ${model.numerator} shaded.`);
  if (phase === 'build-fraction') {
    if (on.includes(STEP_COUNT_LEVER)) facts.push('Above the bar: how many parts the learner has shaded.');
    if (on.includes(NUMBER_PARTS_LEVER)) facts.push(`Every part of the bar shows its place number, 1 to ${ch.denominator} from the left.`);
  }
  return facts;
}
