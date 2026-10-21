/**
 * The in-item levers on fraction-bar (`/add-support-tiers`, report qa/eval-reports/fraction-bar-levers-2026-10-08.md),
 * declared once as a lever set (`FRACTION_BAR_LEVERS`, `bossLevers.ts`); the component draws a pulled lever and calls
 * `declare`/`onScreen`/`simpler`. No real-learner evidence: the misses are what `fractionBarMiss` and `equalBuildMiss`
 * observe.
 *
 * The three-step item (identify, build, larger_denominators, add_subtract):
 * - `model_fraction` (model, every step): a different fraction drawn beside the item, the word numerator beside its top
 *   number and denominator beside its bottom number, and a bar of its parts with its parts shaded. Leak rule
 *   (`modelLeaks`): the model shares no number with the item and is not its value, so nothing on it can be copied as
 *   the pick or the count.
 * - `running_count` (marks, shade step): how many parts the learner has shaded, above the bar. Never the verdict: no
 *   colour or mark changes when the count reaches the numerator.
 * - `number_parts` (marks, shade step): the place number of every part, 1 to N from the left.
 *   Both start pulled where the generator's tier shows them (easy, medium, no tier); a starting position is not a pull.
 * - `smaller_fraction` (easier): an ungraded practice item of the same mode with fewer parts (the fewest the mode's
 *   window allows) and two choices per pick, the practice fraction's own numerator and denominator. Never the item's
 *   value or denominator (`practiceLeaks`). None on the mode's plainest items (identify 1/2, build x/3,
 *   larger_denominators x/4, add_subtract x/3).
 * The open build (build_equal), which starts bare (choosing the split and keeping count of it IS the task):
 * - `running_count` (marks): how many parts the learner split the bar into and how many they shaded.
 * - `show_reference` (layout): the target drawn as a second bar under the learner's, which it never touches.
 * - `smaller_target` (easier): another target with fewer parts, halves first, never the item's value.
 * compare has no lever yet (the card lists its misses as unanswered).
 * Every builder is deterministic, so the live journey rebuilds the practice item from its parent.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { FractionBarChallengeType } from './FractionBar';
import { equalBarInstruction, type FractionBarItem, type FractionBarPhase } from './fractionBarWorkspace';
import { equalWays } from './fractionEqualBuild';
import { FRACTION_BAR_MISSES_BY_MODE, type FractionBarAnyMiss, type FractionBarMode } from './fractionBar.card';

export const MODEL_LEVER = 'model_fraction';
export const STEP_COUNT_LEVER = 'running_count';
export const NUMBER_PARTS_LEVER = 'number_parts';
export const SMALLER_FRACTION_LEVER = 'smaller_fraction';
export const REFERENCE_LEVER = 'show_reference';
export const SMALLER_TARGET_LEVER = 'smaller_target';
/** The practice item's id suffix (both easier levers). */
export const PRACTICE_SUFFIX = '~smaller';

/** The lesson context the levers read: the grade band's splits, and the step the three-step item has reached. */
export interface FractionBarCtx { band?: string; phase: FractionBarPhase }

type StepType = Exclude<FractionBarChallengeType, 'build_equal' | 'compare'>;
const STEP_MODES: readonly StepType[] = ['identify', 'build', 'larger_denominators', 'add_subtract'];
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

/** The generator's fraction window per mode (`gemini-fraction-bar.ts` *Operands): the practice item stays inside it. */
const WINDOW: Record<StepType, { denominators: readonly number[]; numerators: (d: number) => number[] }> = {
  identify: { denominators: [2, 3, 4, 6, 8], numerators: () => [1] },
  build: { denominators: range(3, 6), numerators: d => range(2, d - 1) },
  larger_denominators: { denominators: range(4, 12), numerators: d => range(1, d - 1) },
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

// ── the practice items ──

/** The leak rule: the practice item is never the item's own value or its own bar. */
export function practiceLeaks(item: Fraction, practice: Fraction): boolean {
  return practice.denominator === item.denominator || sameValue(item, practice);
}

/**
 * The simpler three-step item: the fewest parts the mode's window has below the item's, the first numerator that
 * passes the leak rule, and two choices per pick (its numerator and its denominator, in an order taken from the parent
 * so neither position always holds the answer). Null on the mode's plainest item, and on any other mode.
 */
export function smallerFraction(ch: FractionBarItem): FractionBarItem | null {
  if (ch.type === 'build_equal' || ch.type === 'compare') return null;
  const window = WINDOW[ch.type];
  for (const denominator of window.denominators.filter(d => d < ch.denominator)) {
    const numerator = window.numerators(denominator).find(n => !practiceLeaks(ch, { numerator: n, denominator }));
    if (numerator === undefined) continue;
    const pair = (ch.numerator + ch.denominator) % 2 ? [numerator, denominator] : [denominator, numerator];
    return { id: `${ch.id}${PRACTICE_SUFFIX}`, type: ch.type, ...(ch.supportTier ? { supportTier: ch.supportTier } : {}),
      numerator, denominator, numeratorChoices: pair, denominatorChoices: [...pair] };
  }
  return null;
}

/**
 * build_equal's simpler item: another target with fewer parts, halves first, never the item's value. Null when the
 * item is already halves or on any other mode.
 */
export function smallerBarTarget(ch: FractionBarItem, band?: string): FractionBarItem | null {
  if (ch.type !== 'build_equal') return null;
  const pick = ([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]] as const).find(([n, d]) => d < ch.denominator
    && n * ch.denominator !== ch.numerator * d && equalWays(n, d, band).length > 0);
  if (!pick) return null;
  const [numerator, denominator] = pick;
  return { ...ch, id: `${ch.id}${PRACTICE_SUFFIX}`, numerator, denominator, instruction: equalBarInstruction(numerator, denominator) };
}

/** The practice item a simplify lever opens on any mode, or null (the journey rebuilds practice items with it). */
export function barPractice(ch: FractionBarItem, band?: string): FractionBarItem | null {
  return ch.type === 'build_equal' ? smallerBarTarget(ch, band) : smallerFraction(ch);
}

/** The levers the generator's tier shows from the start on the three-step item: starting positions, not pulls. */
export function startLevers(type: FractionBarChallengeType, tier: { readout: boolean; numerals: boolean }): string[] {
  if (type === 'build_equal' || type === 'compare') return [];
  return [...(tier.readout ? [STEP_COUNT_LEVER] : []), ...(tier.numerals ? [NUMBER_PARTS_LEVER] : [])];
}

// ── the lever set ──

const COUNT_MISSES = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const;
/**
 * The misses each lever answers, per mode. The observer pulls the first open lever that lists the learner's miss
 * (`nextLever`): a count off gets the running count, then the part numbers; a mixed-up pick or a shaded complement gets
 * the model; then the easier item.
 */
const ANSWERS: Record<string, Partial<Record<FractionBarMode, readonly FractionBarAnyMiss[]>>> = {
  [STEP_COUNT_LEVER]: { ...Object.fromEntries(STEP_MODES.map(m => [m, COUNT_MISSES])), build_equal: ['one_off'] },
  [NUMBER_PARTS_LEVER]: Object.fromEntries(STEP_MODES.map(m => [m, COUNT_MISSES])),
  [MODEL_LEVER]: Object.fromEntries(STEP_MODES.map(m => [m, ['chose_denominator', 'other_numerator', 'chose_numerator',
    'other_denominator', 'shaded_all', 'shaded_the_rest']])),
  [REFERENCE_LEVER]: { build_equal: ['shaded_the_rest', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'] },
  [SMALLER_FRACTION_LEVER]: Object.fromEntries(STEP_MODES.map(m => [m, FRACTION_BAR_MISSES_BY_MODE[m]])),
  [SMALLER_TARGET_LEVER]: { build_equal: ['same_pieces', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'] },
};
const modesOf = (id: string) => Object.keys(ANSWERS[id]) as FractionBarMode[];
const everyMode = (id: string) => Array.from(new Set(Object.values(ANSWERS[id]).flat())) as string[];
const own = (id: string) => (item: FractionBarItem) => ANSWERS[id][item.type] ?? [];
/** A lever offered in the modes its answers list, answering each mode's own misses. */
const listed = (id: string) => ({ id, modes: modesOf(id), answers: everyMode(id), answersOn: own(id) });
const building = (item: FractionBarItem) => item.type === 'build_equal';
/** The shade-step levers draw on the bar, which is on screen only at the shade step. */
const atShade = (item: FractionBarItem, ctx: FractionBarCtx) => (building(item) || ctx.phase === 'build-fraction' ? true : null);
const UNGRADED = 'It is not graded; the full item comes back after it.';

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing
 * while one is on screen. Spec order is the observer's order within a mode (help first, then the easier item).
 */
export const FRACTION_BAR_LEVERS = leverSet<FractionBarItem, FractionBarCtx>({
  modeOf: item => item.type,
  missesOf: mode => FRACTION_BAR_MISSES_BY_MODE[mode as FractionBarMode] ?? [],
  support: { tier: item => item.supportTier ?? 'medium',
    different: 'a different fraction, its numerator and denominator named and its bar shaded',
    own: "this fraction's numerator, denominator or how many parts to shade" },
  specs: [
    { ...listed(STEP_COUNT_LEVER), type: 'marks', carrier: 'both', content: atShade,
      when: item => (building(item) ? 'The learner splits the bar in a way that works but shades one part too many or too few.'
        : 'The learner shades one or more parts too many or too few.'),
      does: item => (building(item)
        ? 'Shows under the bar how many parts the learner split it into and how many they shaded. Never the target, and never whether the two are equal.'
        : 'Shows above the bar how many parts the learner has shaded so far. Nothing changes colour when it is the right number.'),
      fact: (_content, item) => (building(item) ? "Under the learner's bar: how many parts it is split into and how many are shaded."
        : 'Above the bar: how many parts the learner has shaded.') },
    { ...listed(NUMBER_PARTS_LEVER), type: 'marks', content: atShade,
      when: 'The learner loses track of which parts they have counted.',
      does: 'Writes the place number of every part, 1 to the last, from the left, inside the bar.',
      fact: (_content, item) => `Every part of the bar shows its place number, 1 to ${item.denominator} from the left.` },
    { ...listed(MODEL_LEVER), type: 'model', content: item => modelFraction(item),
      when: 'The learner mixes up the numerator and the denominator, picks a number that is neither, shades every part, or shades the parts that should stay empty.',
      does: 'Draws a different fraction beside this one: the word numerator beside its top number, the word denominator beside its bottom '
        + 'number, and a small bar of its parts with its parts shaded. This fraction is untouched.',
      fact: (model: { numerator: number; denominator: number }) => `A different fraction, ${model.numerator}/${model.denominator}, is drawn `
        + `beside this one: the word numerator beside its top number ${model.numerator}, the word denominator beside its bottom number `
        + `${model.denominator}, and a bar of ${model.denominator} equal parts with ${model.numerator} shaded.` },
    { ...listed(REFERENCE_LEVER), type: 'layout',
      when: 'The learner shades the wrong amount, shades the part that should stay empty, makes parts of different sizes, or picks a split that cannot make the fraction.',
      does: "Draws the target fraction as a second bar under the learner's bar, split into its own parts with its parts shaded. The learner's bar is untouched.",
      fact: "A reference bar under the learner's bar shows the target fraction, split into its own parts with its parts shaded." },
    { ...listed(SMALLER_FRACTION_LEVER), type: 'easier', content: item => smallerFraction(item),
      when: 'The learner cannot do this fraction even with help: a fraction with fewer parts first.',
      does: 'Opens an easier practice fraction with fewer parts and only two numbers to choose from at each pick. It is not graded; '
        + 'this fraction comes back after it, from the first step.' },
    { ...listed(SMALLER_TARGET_LEVER), type: 'easier', content: (item, ctx) => smallerBarTarget(item, ctx.band),
      when: 'The learner cannot find another way to make this fraction yet.',
      does: `Opens an easier build first: make a fraction with fewer parts, halves if they fit, your own way. ${UNGRADED}` },
  ],
});
