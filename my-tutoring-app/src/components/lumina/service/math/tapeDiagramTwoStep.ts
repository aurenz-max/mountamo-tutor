/**
 * tape-diagram two-step patterns (curriculum design review math-g2-2026-10-27, brief 1).
 *
 * Grade 2 asks for two kinds of two-step story the own path could not make: both steps add
 * (OPS002-03-a, "only addition") and combine-then-compare (OPS002-03-c, "(20+5) - x = 10" with the
 * unknown in different places). `lessonStepPattern` reads which chain a lesson allows; the
 * `two_step_compare` builders below own every number, the bars, the plain story and the check of a
 * written one. Pure: the generator and the tests read the same shapes.
 */
import type { BarSegment, TapeDiagramChallenge } from '../../primitives/visual-primitives/math/TapeDiagram';

/** Which operations a lesson's two-step chain may use. */
export type StepPattern = 'mixed' | 'add' | 'subtract';

/** "involving only addition" → add; "only subtraction" → subtract; anything else mixes. */
export function lessonStepPattern(lesson: string): StepPattern {
  if (/\b(only|just) (addition|adding)\b|\baddition only\b|\bboth steps add\b/i.test(lesson)) return 'add';
  if (/\b(only|just) (subtraction|subtracting)\b|\bsubtraction only\b/i.test(lesson)) return 'subtract';
  return 'mixed';
}

/** Whether a chain's operations fit the pattern. */
export const opsFitPattern = (ops: readonly ('+' | '-')[], pattern: StepPattern): boolean =>
  pattern === 'add' ? ops.every((o) => o === '+')
    : pattern === 'subtract' ? ops.every((o) => o === '-')
    : ops.includes('+') && ops.includes('-');

// ---------------------------------------------------------------------------
// two_step_compare: put two amounts together, then compare the total with a third person's amount.
// ---------------------------------------------------------------------------

/**
 * The structural difficulty of step 2:
 * - `consistent`: the other person's amount is unknown and the relational word points at the operation
 *   ("Sam has 10 fewer than Tia" → subtract);
 * - `difference`: both amounts are known after step 1; the question asks how many more;
 * - `inconsistent`: the other amount is unknown and the word points the wrong way ("Tia has 10 more than
 *   Sam" → subtract). The hard case the curriculum names.
 */
export type CompareShape = 'consistent' | 'difference' | 'inconsistent';

export interface TwoStepCompareSpec {
  /** The two amounts that make the first person's total (step 1). */
  a: number;
  b: number;
  /** How many more the larger person has. */
  d: number;
  /** The first person (who owns a + b) has more than the other. */
  ownerLarger: boolean;
  shape: CompareShape;
}

export interface CompareWords {
  personA: string;
  personB: string;
  /** What is counted, plural ("beads"). */
  thing: string;
  /** The two kinds the first person has ("red beads", "blue beads"). */
  part1: string;
  part2: string;
}

export const totalOf = (s: TwoStepCompareSpec) => s.a + s.b;
export const otherOf = (s: TwoStepCompareSpec) => (s.ownerLarger ? totalOf(s) - s.d : totalOf(s) + s.d);
export const answerOf = (s: TwoStepCompareSpec) => (s.shape === 'difference' ? s.d : otherOf(s));

const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** A spec inside `range` with every amount at least 2; null when the range has no room. */
export function rollTwoStepCompare(
  range: { min: number; max: number }, shape: CompareShape, rand: () => number = Math.random,
): TwoStepCompareSpec | null {
  for (let guard = 0; guard < 200; guard++) {
    const ownerLarger = rand() < 0.5;
    const total = randInt(Math.max(8, range.min), range.max - (ownerLarger ? 0 : 4), rand);
    if (total < 8) continue;
    const a = randInt(Math.max(2, Math.ceil(total / 4)), total - 2, rand);
    const b = total - a;
    const dMax = ownerLarger ? total - 2 : range.max - total;
    if (dMax < 2) continue;
    const d = randInt(2, dMax, rand);
    // Distinct numbers keep the story unambiguous for the check (a repeated value reads as one number).
    const spec: TwoStepCompareSpec = { a, b, d, ownerLarger, shape };
    const shown = new Set(shownOf(spec));
    if (shown.size < 3 || shown.has(answerOf(spec)) || shown.has(total) || answerOf(spec) === total) continue;
    return spec;
  }
  return null;
}

/** The relational sentence, by shape: who is said to have more or fewer. */
export function relationSentence(s: TwoStepCompareSpec, w: CompareWords): string {
  const { personA: A, personB: B, thing } = w;
  if (s.shape === 'difference') {
    return `${B} has ${otherOf(s)} ${thing}.`;
  }
  const consistent = s.shape === 'consistent';
  // Subject and word: consistent puts the unknown person as the subject with the word that matches the
  // operation; inconsistent puts the known person as the subject.
  if (s.ownerLarger) return consistent ? `${B} has ${s.d} fewer ${thing} than ${A}.` : `${A} has ${s.d} more ${thing} than ${B}.`;
  return consistent ? `${B} has ${s.d} more ${thing} than ${A}.` : `${A} has ${s.d} fewer ${thing} than ${B}.`;
}

/** The comparison word the story must keep. */
export const compareWordOf = (s: TwoStepCompareSpec): 'more' | 'fewer' =>
  s.shape === 'difference' ? 'more'
    : (s.shape === 'consistent') === s.ownerLarger ? 'fewer' : 'more';

export function questionOf(s: TwoStepCompareSpec, w: CompareWords): string {
  if (s.shape !== 'difference') return `How many ${w.thing} does ${w.personB} have?`;
  const [larger, smaller] = s.ownerLarger ? [w.personA, w.personB] : [w.personB, w.personA];
  return `How many more ${w.thing} does ${larger} have than ${smaller}?`;
}

export function plainCompareStory(s: TwoStepCompareSpec, w: CompareWords): string {
  return `${w.personA} has ${s.a} ${w.part1} and ${s.b} ${w.part2}. ${relationSentence(s, w)} ${questionOf(s, w)}`;
}

/** The numbers the story must state, in order. */
export const shownOf = (s: TwoStepCompareSpec): number[] =>
  s.shape === 'difference' ? [s.a, s.b, otherOf(s)] : [s.a, s.b, s.d];

/** The model's words: a plural thing and two kinds of it, no digits, the kinds distinct. */
export function compareWordsFit(w: CompareWords): boolean {
  const all = [w.thing, w.part1, w.part2];
  return all.every((x) => x.trim().length > 1 && x.length <= 30 && !/\d/.test(x)) && w.part1 !== w.part2;
}

/** The scene sentence: short, no number, no comparison or total words, no question. */
export const settingFits = (setting: string): boolean =>
  setting.trim().length > 0 && setting.length <= 140 && !/\d/.test(setting)
  && !/\b(more|fewer|less|than|total|all|altogether|how many|left)\b|\?/i.test(setting);

/**
 * Two step bars. Step 1 joins the first person's two amounts (the whole is unknown). Step 2 is the
 * comparison as a part-whole: the larger person's amount is the whole, the smaller person's amount and
 * "how many more" are its parts; the first person's total is carried from step 1.
 */
export function twoStepCompareBars(s: TwoStepCompareSpec, w: CompareWords): {
  bars: TapeDiagramChallenge['bars']; steps: { bar: number; segment: number }[];
} {
  const total = totalOf(s), other = otherOf(s);
  const totalLabel = `${w.personA}'s ${w.thing}`;
  const otherLabel = `${w.personB}'s ${w.thing}`;
  const larger = s.ownerLarger ? w.personA : w.personB;
  const step1: TapeDiagramChallenge['bars'][number] = {
    segments: [{ value: s.a, label: w.part1 }, { value: s.b, label: w.part2 }],
    whole: { value: total, label: totalLabel, isUnknown: true },
  };
  const carried: BarSegment = { value: total, label: totalLabel, carriedFromStep: 0 };
  const otherSeg: BarSegment = { value: other, label: otherLabel, ...(s.shape === 'difference' ? {} : { isUnknown: true }) };
  const diffSeg: BarSegment = { value: s.d, label: `how many more ${larger} has`, ...(s.shape === 'difference' ? { isUnknown: true } : {}) };
  if (s.ownerLarger) {
    return {
      bars: [step1, { segments: [otherSeg, diffSeg], whole: carried }],
      steps: [{ bar: 0, segment: -1 }, { bar: 1, segment: s.shape === 'difference' ? 1 : 0 }],
    };
  }
  return {
    bars: [step1, { segments: [carried, diffSeg], whole: otherSeg }],
    steps: [{ bar: 0, segment: -1 }, { bar: 1, segment: s.shape === 'difference' ? 1 : -1 }],
  };
}

/**
 * The wrong model of a step bar, for the choice the learner makes before solving it: the whole and the
 * first part swapped. For a comparison that is the "more means add" bar (Sam = Tia's total + 10 when Tia
 * has 10 more than Sam).
 */
export function swappedBar(bar: TapeDiagramChallenge['bars'][number]): TapeDiagramChallenge['bars'][number] | null {
  if (!bar.whole || bar.segments.length < 2) return null;
  return { ...bar, whole: bar.segments[0], segments: [bar.whole, ...bar.segments.slice(1)] };
}

/** Step 2's hint at a tier: easy names who has more and the operation, medium who has more, hard asks. */
export function compareStepHint(s: TwoStepCompareSpec, w: CompareWords, tier: 'easy' | 'medium' | 'hard' | null): string {
  const [larger, smaller] = s.ownerLarger ? [w.personA, w.personB] : [w.personB, w.personA];
  if (tier === 'hard') return `Who has more, ${w.personA} or ${w.personB}? The one with more is the whole bar.`;
  if (tier === 'medium') return `${larger} has more ${w.thing} than ${smaller}. ${larger}'s ${w.thing} make the whole bar.`;
  if (s.shape === 'difference') return `${larger} has more. Take ${smaller}'s ${w.thing} away from ${larger}'s.`;
  return s.ownerLarger
    ? `${w.personA} has more. Take ${s.d} away from ${w.personA}'s total.`
    : `${w.personB} has more. Add ${s.d} to ${w.personA}'s total.`;
}

/** Code-owned words when the written story does not fit. */
const FALLBACK_WORDS: Omit<CompareWords, 'personA' | 'personB'>[] = [
  { thing: 'beads', part1: 'red beads', part2: 'blue beads' },
  { thing: 'stickers', part1: 'star stickers', part2: 'heart stickers' },
  { thing: 'shells', part1: 'big shells', part2: 'small shells' },
  { thing: 'cards', part1: 'animal cards', part2: 'car cards' },
  { thing: 'marbles', part1: 'green marbles', part2: 'yellow marbles' },
];
const NAMES = ['Tia', 'Sam', 'Maya', 'Leo', 'Ava', 'Ben', 'Zoe', 'Omar', 'Ivy', 'Raj'];

export function fallbackWords(rand: () => number = Math.random): CompareWords {
  const words = FALLBACK_WORDS[Math.floor(rand() * FALLBACK_WORDS.length)];
  const i = Math.floor(rand() * NAMES.length);
  const j = (i + 1 + Math.floor(rand() * (NAMES.length - 1))) % NAMES.length;
  return { ...words, personA: NAMES[i], personB: NAMES[j] };
}
