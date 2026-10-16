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
import { ADD_SUB_20, solveAddSub20, type AddSub20Item } from '../itemSpace/addSub20';
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

// ---------------------------------------------------------------------------
// multi_step: one part-whole bar per step
// ---------------------------------------------------------------------------
//
// The old diagram drew start, change, intermediate and answer as four parts of one bar under
// "Total = N" (8 + 6 - 5 read "Total = 37"). A step is a part-whole of its own: adding puts the
// start and the change side by side with the result as the whole below; taking away puts the start
// as the whole, the part taken and the part left above it. The next step's bar starts from the
// previous result, shown only once that step is solved (`carriedFromStep`).

export interface ChainStep { op: '+' | '-'; value: number; label: string; resultLabel: string }

/** The bars and solve order of a chain `start op1 v1 op2 v2 ...`; null when a result leaves 1..∞. */
export function multiStepBars(start: number, startLabel: string, chain: ChainStep[]): {
  bars: TapeDiagramChallenge['bars']; steps: { bar: number; segment: number }[]; results: number[];
} | null {
  const bars: TapeDiagramChallenge['bars'] = [];
  const steps: { bar: number; segment: number }[] = [];
  const results: number[] = [];
  let from: BarSegment = { value: start, label: startLabel };
  let current = start;
  for (let i = 0; i < chain.length; i++) {
    const s = chain[i];
    const next = s.op === '+' ? current + s.value : current - s.value;
    if (!Number.isInteger(next) || next < 1 || !Number.isInteger(s.value) || s.value < 1) return null;
    const result: BarSegment = { value: next, label: s.resultLabel, isUnknown: true };
    if (s.op === '+') {
      bars.push({ segments: [from, { value: s.value, label: s.label }], whole: result });
      steps.push({ bar: i, segment: -1 });
    } else {
      bars.push({ segments: [{ value: s.value, label: s.label }, result], whole: from });
      steps.push({ bar: i, segment: 1 });
    }
    results.push(next);
    from = { value: next, label: s.resultLabel, carriedFromStep: i };
    current = next;
  }
  return { bars, steps, results };
}

/** Step hints at a tier: easy names the operation and both numbers, medium only the operation, hard asks. */
export function multiStepHint(op: '+' | '-', a: number | 'previous', b: number, tier: 'easy' | 'medium' | 'hard' | null): string {
  const first = a === 'previous' ? 'your last answer' : String(a);
  if (tier === 'hard') return 'What do you need to know before you can answer the question?';
  if (tier === 'medium') return op === '+' ? 'This step joins two amounts. Add.' : 'This step takes some away. Subtract.';
  return op === '+' ? `Add ${first} and ${b}.` : `Take ${b} away from ${first}.`;
}

export interface WrittenMultiStep { story: string; thing: string; change1: string; change2: string }

/** The story keeps every number, adds none (no intermediate), never states the answer, and asks. */
export function multiStepStoryFits(it: AddSub20Item, w: WrittenMultiStep): boolean {
  const sol = solveAddSub20(it);
  if (!w.story || !w.thing || !w.change1 || !w.change2) return false;
  if (/\d/.test(w.thing + w.change1 + w.change2)) return false;
  return questionFitsSpec(w.story, sol.shown.map(String), String(sol.answer));
}

export const plainMultiStep = (it: AddSub20Item): WrittenMultiStep => ({
  story: ADD_SUB_20.plainQuestion(it),
  thing: 'stickers',
  change1: it.steps[0].op === '+' ? 'more stickers' : 'given away',
  change2: it.steps[1].op === '+' ? 'more stickers' : 'given away',
});

export function multiStepChallengeFromItem(
  it: AddSub20Item, w: WrittenMultiStep, space: string, tier: 'easy' | 'medium' | 'hard' | null,
): TapeDiagramChallenge {
  const [s1, s2] = it.steps;
  const built = multiStepBars(s1.a, `${w.thing} at first`, [
    { op: s1.op, value: s1.b, label: w.change1, resultLabel: `${w.thing} after step 1` },
    { op: s2.op, value: s2.b, label: w.change2, resultLabel: `${w.thing} at the end` },
  ]);
  if (!built) throw new Error(`add-sub-20 item ${solveAddSub20(it).expr} leaves 1..20`);
  return {
    id: 'td-pending',
    challengeType: 'multi_step',
    wordProblem: w.story,
    bars: built.bars,
    comparisonMode: false,
    showBrackets: false,
    multiStepData: {
      step1Hint: multiStepHint(s1.op, s1.a, s1.b, tier),
      step2Hint: multiStepHint(s2.op, 'previous', s2.b, tier),
      solveOrder: [],
      steps: built.steps,
    },
    itemSpace: { space, structure: it.structure, beta: it.beta },
  };
}
