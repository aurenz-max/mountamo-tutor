/**
 * tape-diagram solve_comparison from the compare-20 / compare-100 item spaces (skill /add-item-space).
 *
 * The LLM chose the numbers and every run converged ("Liam found 15 shells, Zoe found 9" at easy and
 * at no tier; "8 + 6 more" at every hard item; "within 100" never above 20, 10-14 probe). The tier
 * forced the unknown (difference, then smaller, then larger), which put the consistent "larger
 * unknown, more" problem at hard and the inconsistent "smaller unknown, more" form nowhere. With a
 * tier and an objective the resolver fits to a strand, the space picks each problem at the tier's
 * beta; the LLM writes only the story and the two bar labels, and code checks them.
 *
 * Which items the mode draws: every compare item. The larger amount is bar 1, the smaller bar 2; the
 * unknown maps to the diagram's `unknownPart` (difference, quantity1 = larger, quantity2 = smaller).
 */
import type { BarSegment, TapeDiagramChallenge } from '../../primitives/visual-primitives/math/TapeDiagram';
import { comparePlainQuestion, solveCompare, type CompareItem } from '../itemSpace/compareStories';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

export interface ComparisonShape {
  q1: number;
  q2: number;
  unknownPart: 'difference' | 'quantity1' | 'quantity2';
  comparisonWord: string;
}

export const comparisonShapeOf = (it: CompareItem): ComparisonShape => ({
  q1: it.larger,
  q2: it.smaller,
  unknownPart: it.unknown === 'difference' ? 'difference' : it.unknown === 'larger' ? 'quantity1' : 'quantity2',
  comparisonWord: it.wording,
});

/** The two bars of a comparison: bar 1 the larger amount, bar 2 the smaller; the unknown carries `isUnknown`. */
export function comparisonBars(
  s: ComparisonShape, labels: { larger: string; smaller: string },
): TapeDiagramChallenge['bars'] {
  const diff = s.q1 - s.q2;
  let bar1: BarSegment[];
  let bar2: BarSegment[];
  if (s.unknownPart === 'difference') {
    bar1 = [{ value: s.q2, label: `matching ${labels.smaller}` }, { value: diff, label: 'difference', isUnknown: true }];
    bar2 = [{ value: s.q2, label: labels.smaller }];
  } else if (s.unknownPart === 'quantity2') {
    bar1 = [{ value: s.q1, label: labels.larger }];
    bar2 = [{ value: s.q2, label: labels.smaller, isUnknown: true }];
  } else {
    bar1 = [{ value: s.q1, label: labels.larger, isUnknown: true }];
    bar2 = [{ value: s.q2, label: labels.smaller }];
  }
  return [
    { segments: bar1, totalLabel: labels.larger, color: 'from-blue-500 to-blue-600' },
    { segments: bar2, totalLabel: labels.smaller, color: 'from-purple-500 to-purple-600' },
  ];
}

export interface WrittenComparison { story: string; largerLabel: string; smallerLabel: string }

const nameOf = (label: string) => label.trim().split(/[\s']/)[0] ?? '';

/**
 * The story keeps every number the problem gives, adds none, never states the answer, uses the item's
 * relational word, asks, and names both bar owners; the labels carry no number.
 */
export function comparisonStoryFits(it: CompareItem, w: WrittenComparison): boolean {
  const { answer, shown } = solveCompare(it);
  if (!w.story || !w.largerLabel || !w.smallerLabel) return false;
  if (/\d/.test(w.largerLabel + w.smallerLabel)) return false;
  if (!questionFitsSpec(w.story, shown.map(String), String(answer))) return false;
  if (!new RegExp(`\\b${it.wording}\\b`, 'i').test(w.story)) return false;
  const a = nameOf(w.largerLabel);
  const b = nameOf(w.smallerLabel);
  return !!a && !!b && a.toLowerCase() !== b.toLowerCase() && w.story.includes(a) && w.story.includes(b);
}

/** The code-built story and labels, used when the written one misses its spec. */
export const plainComparison = (it: CompareItem): WrittenComparison => ({
  story: comparePlainQuestion(it), largerLabel: "Ana's stickers", smallerLabel: "Ben's stickers",
});

export function comparisonChallengeFromItem(
  it: CompareItem, w: WrittenComparison, space: string,
): TapeDiagramChallenge {
  const shape = comparisonShapeOf(it);
  return {
    id: 'td-pending',
    challengeType: 'solve_comparison',
    wordProblem: w.story,
    bars: comparisonBars(shape, { larger: w.largerLabel, smaller: w.smallerLabel }),
    comparisonMode: true,
    showBrackets: true,
    comparisonData: { quantity1: shape.q1, quantity2: shape.q2, difference: shape.q1 - shape.q2, comparisonWord: shape.comparisonWord, unknownPart: shape.unknownPart },
    itemSpace: { space, structure: it.structure, beta: it.beta },
  };
}
