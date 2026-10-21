/**
 * Fraction bar on the shared tutor/JEV teaching workspace (`fractionBar.boss.ts`), plus the open build `build_equal`
 * (`/add-eval-modes` references/build-mode.md).
 *
 * identify / build / larger_denominators / add_subtract share one three-step item: pick the numerator, pick the
 * denominator, shade the bar, each with its own Check. A wrong check commits a miss (Try again keeps the
 * step reached); a right numerator or denominator moves to the next step without a commit, and the
 * right shading commits the item. build_equal: the learner splits the bar into equal parts of their
 * choosing, can cut one part in half, shades parts and presses "I'm done!"; any equal fraction passes.
 * Its judgment is fraction-circles' (`fractionEqualBuild.ts`): a part is a span [start, end) of the bar
 * exactly as it is an arc of the circle.
 *
 * compare: two fractions of the same whole, each drawn as a shaded bar, one above the other; the learner picks
 * <, = or > and presses Check. The pair and its relation come from the fraction-compare item space.
 *
 * Every item is a gesture checked by code, so no key reaches the tutor. Pure: the component, the
 * generator, the boss and the tests read the same functions.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { CompareRelation, FractionBarChallenge, FractionBarChallengeType, FractionBarData } from './FractionBar';
import type { FractionBarMiss, FractionCompareMiss } from './fractionBar.card';

export type FractionBarPhase = 'identify-numerator' | 'identify-denominator' | 'build-fraction' | 'compare';

/** One item on screen: a challenge with the lesson's mode and support tier stamped on it (the lesson keeps both). */
export type FractionBarItem = FractionBarChallenge & { type: FractionBarChallengeType; supportTier?: SupportTier };

/** The lesson's items, each carrying its mode and tier, so the boss, the levers and the component read one shape. */
export function barItems(data: Pick<FractionBarData, 'challenges' | 'challengeType' | 'supportTier'>): FractionBarItem[] {
  return (data.challenges ?? []).map(c => ({ ...c, type: data.challengeType,
    ...(data.supportTier ? { supportTier: data.supportTier } : {}) }));
}

/** The pair as printed: "3/8 and 1/2". */
const pairText = (ch: FractionBarChallenge) =>
  `${ch.numerator}/${ch.denominator} and ${ch.compareWith?.numerator}/${ch.compareWith?.denominator}`;

export const equalBarInstruction = (a: number, d: number) =>
  `Make a fraction equal to ${a}/${d} your own way: split the bar into equal parts, but not ${d}, then shade some.`;

/** The ask, as the tutor is told it. The fraction is printed on screen: it is the task, not a key. */
export function barTask(item: FractionBarItem): string {
  if (item.type === 'build_equal') return item.instruction ?? equalBarInstruction(item.numerator, item.denominator);
  if (item.type === 'compare') return `Compare ${pairText(item)}: pick <, = or > to make the statement true.`;
  return `Name the numerator and the denominator of ${item.numerator}/${item.denominator}, then shade ${item.numerator}/${item.denominator} on the bar.`;
}

/** What the learner has done on the current step. */
export interface FractionBarView {
  phase: FractionBarPhase;
  /** The number picked on a numerator or denominator step. */
  picked: number | null;
  /** compare: the symbol picked. */
  relation?: CompareRelation | null;
  /** Parts shaded (build step), or shaded parts of the learner's own bar (build_equal). */
  shaded: number;
  /** build_equal: how many parts the learner split the bar into, and whether they are all the same size. */
  parts?: number;
  equalParts?: boolean;
  /** The learner's count of shaded parts is on screen (the tier's readout or the running_count lever). */
  readout?: boolean;
  /** An easier practice item stands in for the item (a simplify lever). */
  practice?: boolean;
}

/** The learner's checked work, in their terms. Never the key. */
export function describeWork(type: FractionBarChallengeType, ch: FractionBarChallenge, view: FractionBarView): string {
  if (type === 'build_equal') {
    const parts = view.parts ?? 1;
    return `Split the bar into ${parts} ${view.equalParts === false ? 'parts, not all the same size,' : 'equal parts'} and shaded ${view.shaded}`;
  }
  if (type === 'compare') return `Picked ${view.relation ?? 'nothing'}: ${ch.numerator}/${ch.denominator} ${view.relation ?? '?'} `
    + `${ch.compareWith?.numerator}/${ch.compareWith?.denominator}`;
  switch (view.phase) {
    case 'identify-numerator': return `Chose ${view.picked ?? 'nothing'} as the numerator`;
    case 'identify-denominator': return `Chose ${view.picked ?? 'nothing'} as the denominator`;
    default: return `Shaded ${view.shaded} of ${ch.denominator} parts`;
  }
}

export function fractionCompareMiss(ch: FractionBarChallenge, picked: CompareRelation | null | undefined): FractionCompareMiss | undefined {
  if (!picked || picked === ch.relation) return undefined;
  if (ch.relation === '=') return 'said_unequal';
  if (picked === '=') return 'said_equal';
  return ch.numerator === ch.compareWith?.numerator ? 'more_parts_bigger' : 'flipped';
}

/** The miss a wrong check shows (the patterns are listed on the card). Undefined for a right answer. */
export function fractionBarMiss(ch: FractionBarChallenge, view: FractionBarView): FractionBarMiss | FractionCompareMiss | undefined {
  if (view.phase === 'compare') return fractionCompareMiss(ch, view.relation);
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

/**
 * What the tutor and the observer are shown: the printed fraction, the step reached and the learner's own work. How
 * the steps are done is the card's `moves`; what a pulled lever drew is the lever set's `onScreen`.
 */
export function workspaceScene(item: FractionBarItem, view: FractionBarView): SceneOf {
  const { type } = item;
  const facts: Record<string, string | number> = { kind: type, printedFraction: `${item.numerator}/${item.denominator}` };
  if (type === 'build_equal') {
    // An open build: the made quantity is published as numbers, so the shared work history can name a revision.
    // No verdict before "I'm done!": nothing here says whether the bar is equal to the target.
    facts.partsCut = view.parts ?? 1;
    facts.partsShaded = view.shaded;
    facts.partSizes = view.equalParts === false ? 'not all the same size' : 'all the same size';
    facts.learnerWork = describeWork(type, item, view);
  } else if (type === 'compare') {
    facts.secondFraction = `${item.compareWith?.numerator}/${item.compareWith?.denominator}`;
    facts.bars = `Top bar: ${item.denominator} equal parts, ${item.numerator} shaded. Bottom bar, the same length: `
      + `${item.compareWith?.denominator} equal parts, ${item.compareWith?.numerator} shaded.`;
    if (view.relation) facts.learnerPick = view.relation;
  } else {
    facts.step = view.phase === 'identify-numerator' ? 'numerator' : view.phase === 'identify-denominator' ? 'denominator' : 'shade';
    if (view.phase === 'build-fraction') {
      facts.barParts = item.denominator;
      // The learner's own tally reaches the tutor only while the readout shows it on screen.
      if (view.readout) facts.partsShaded = view.shaded;
    }
  }
  if (view.practice) facts.practice = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';
  return { objects: [], facts };
}
