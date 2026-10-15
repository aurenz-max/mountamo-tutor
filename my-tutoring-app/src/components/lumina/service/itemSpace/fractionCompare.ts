/**
 * Item space: comparing two fractions (3.NF.3d, 4.NF.2): decide which of a/b and c/d is greater, or that
 * they are equal.
 *
 * Scope: proper fractions with denominators 2, 3, 4, 5, 6, 8, 10, 12 (listed: every ordered pair). A
 * consumer bounds it with `accept`: grade 3 compares pairs with the same numerator or the same denominator
 * (3.NF.3d) and equal pairs (3.NF.3b) over 2, 3, 4, 6, 8; grade 4 adds every other pair (4.NF.2).
 *
 * The strategy the pair allows is the main difficulty feature (Clarke & Roche 2009; Behr, Wachsmuth, Post &
 * Lesh 1984; Fazio et al. 2016 on whole-number bias):
 *   - sameDen: compare the numerators (2/6 vs 5/6) (-1.2): whole-number reasoning gives the right answer.
 *   - sameNum: more parts means smaller parts (1/3 vs 1/8) (-0.5): whole-number reasoning gives the wrong one.
 *   - benchmark: one fraction is 1/2, or one is below 1/2 and the other above it (2/5 vs 5/8) (-0.2).
 *   - residual: both are one part short of a whole (3/4 vs 5/6) (+0.3): compare the missing parts.
 *   - general: none of these; a common denominator or a careful estimate is needed (2/3 vs 5/8) (+0.6).
 *   - equal: the two are the same amount (2/4 vs 1/2) (+0.8): learners expect a difference and pick a side.
 * And:
 *   - closeness: (1/2 - gap) / (1/2), 0 for a gap of 1/2 or more, 1 for equal values (+0.8): the distance
 *     effect, graded so a tier third is never one tied beta.
 *   - incongruent: the fraction with the larger numerator and the larger denominator is the smaller
 *     amount (3/5 vs 5/9 kind: 2/3 vs 5/8) (+0.4): whole-number bias points the wrong way.
 *   - bigDen: a denominator of 10 or 12 (+0.2), parts too small to picture.
 * Which side the larger fraction sits on is incidental: it is in the structure key so the spread
 * alternates it, and it carries no weight.
 *
 * Beta is in logits for a typical grade-4 learner taught fraction comparison with area and bar models.
 * Priors; refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

export type CompareStrategy = 'sameDen' | 'sameNum' | 'benchmark' | 'residual' | 'general' | 'equal';
export interface FractionCompareFeatures {
  sameDen: number; sameNum: number; benchmark: number; residual: number; general: number; equal: number;
  closeness: number; incongruent: number; bigDen: number;
}
export interface FractionCompareItem {
  a: number; b: number; c: number; d: number;
  strategy: CompareStrategy;
  features: FractionCompareFeatures;
  beta: number;
  structure: string;
}

export const FRACTION_COMPARE_WEIGHTS: Record<keyof FractionCompareFeatures | 'base', number> = {
  base: -0.6, sameDen: -1.2, sameNum: -0.5, benchmark: -0.2, residual: 0.3, general: 0.6, equal: 0.8,
  closeness: 0.8, incongruent: 0.4, bigDen: 0.2,
};

export const COMPARE_DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

export function compareStrategy(a: number, b: number, c: number, d: number): CompareStrategy {
  if (a * d === b * c) return 'equal';
  if (b === d) return 'sameDen';
  if (a === c) return 'sameNum';
  // One of them is a half, or they sit on two sides of a half: compare each with 1/2.
  const below = (n: number, m: number) => 2 * n < m;
  if (2 * a === b || 2 * c === d || below(a, b) !== below(c, d)) return 'benchmark';
  if (b - a === 1 && d - c === 1) return 'residual';
  return 'general';
}

export function fractionCompareFeatures(a: number, b: number, c: number, d: number): FractionCompareFeatures {
  const s = compareStrategy(a, b, c, d);
  const gap = Math.abs(a / b - c / d);
  const bigger = a / b > c / d ? [a, b] : [c, d];
  const smaller = a / b > c / d ? [c, d] : [a, b];
  return {
    sameDen: s === 'sameDen' ? 1 : 0, sameNum: s === 'sameNum' ? 1 : 0, benchmark: s === 'benchmark' ? 1 : 0,
    residual: s === 'residual' ? 1 : 0, general: s === 'general' ? 1 : 0, equal: s === 'equal' ? 1 : 0,
    closeness: Math.round(Math.max(0, (0.5 - gap) / 0.5) * 100) / 100,
    incongruent: s === 'general' || s === 'benchmark' || s === 'residual'
      ? (smaller[0] > bigger[0] && smaller[1] > bigger[1] ? 1 : 0) : 0,
    bigDen: Math.max(b, d) >= 10 ? 1 : 0,
  };
}

export const compareSymbol = (it: Pick<FractionCompareItem, 'a' | 'b' | 'c' | 'd'>): '<' | '>' | '=' =>
  it.a * it.d > it.b * it.c ? '>' : it.a * it.d < it.b * it.c ? '<' : '=';

let cache: FractionCompareItem[] | null = null;
export function fractionCompareItems(): FractionCompareItem[] {
  if (cache) return cache;
  const out: FractionCompareItem[] = [];
  for (const b of COMPARE_DENOMINATORS) for (let a = 1; a < b; a++) for (const d of COMPARE_DENOMINATORS) for (let c = 1; c < d; c++) {
    if (a === c && b === d) continue;
    // An equal pair in lowest terms on both sides (1/2 vs 1/2) is one fraction twice; equal pairs keep different digits.
    const features = fractionCompareFeatures(a, b, c, d);
    const strategy = compareStrategy(a, b, c, d);
    const gap = Math.abs(a / b - c / d);
    const near = strategy === 'equal' ? '' : gap < 0.1 ? '|near' : gap < 0.25 ? '|mid' : '|far';
    const unit = strategy === 'sameNum' && a === 1 ? '|unit' : '';
    const structure = `${compareSymbol({ a, b, c, d })}|${strategy}${unit}${near}${features.incongruent ? '|inc' : ''}`;
    out.push({ a, b, c, d, strategy, features, beta: linearBeta(features, FRACTION_COMPARE_WEIGHTS), structure });
  }
  return (cache = out);
}

const statement = (it: FractionCompareItem, s: string) => `${it.a}/${it.b} ${s} ${it.c}/${it.d}`;

/**
 * As a text problem the answer is the true statement. Near: the symbol read backwards (whole-number bias
 * on a same-numerator pair gives exactly this), and "=" for a close pair or a side for an equal pair.
 * Far: the pair swapped with the symbol kept.
 */
function distractors(it: FractionCompareItem): { value: string; distance: 'near' | 'far' }[] {
  const s = compareSymbol(it);
  const swapped = `${it.c}/${it.d} ${s} ${it.a}/${it.b}`;
  if (s === '=') {
    return [
      { value: statement(it, '<'), distance: 'near' },
      { value: statement(it, '>'), distance: 'near' },
      { value: `${it.c}/${it.d} = ${it.a + 1 < it.b ? it.a + 1 : it.a - 1}/${it.b}`, distance: 'far' },
    ];
  }
  const flipped = s === '<' ? '>' : '<';
  return [
    { value: statement(it, flipped), distance: 'near' },
    { value: statement(it, '='), distance: it.features.closeness > 0.6 ? 'near' : 'far' },
    { value: swapped, distance: 'far' },
  ];
}

export const FRACTION_COMPARE: ItemSpace<FractionCompareItem> = {
  id: 'fraction-compare',
  describe: 'comparing two fractions: decide which of exactly two fractions is greater, or whether they are equal '
    + '(same numerator, same denominator, or different numerators and denominators, using >, < or =), one pair at a '
    + 'time. Ordering or arranging three or more fractions is NOT this; nor is renaming a fraction or adding',
  grades: ['3', '4', '5'],
  criterion: 'Compare two fractions',
  wordingGrade: 'grade 4',
  // One pair once per session in either order, and one equal pair at most.
  pick: (n, lo, hi, rand, accept) => pickSpread(fractionCompareItems(), n, lo, hi, rand, accept,
    (it) => [`${it.a}/${it.b}`, `${it.c}/${it.d}`].sort().join('|'),
    (it) => (it.strategy === 'equal' ? 'equal' : `${it.a}/${it.b}|${it.c}/${it.d}`)),
  items: fractionCompareItems,
  solve: (it) => ({
    answer: statement(it, compareSymbol(it)),
    shown: [`${it.a}/${it.b}`, `${it.c}/${it.d}`],
    spec: `compare ${it.a}/${it.b} (left) and ${it.c}/${it.d} (right) of the same whole; ask which statement with >, < or = `
      + `is true, keeping ${it.a}/${it.b} on the left`,
  }),
  distractors: (it) => distractors(it),
  plainQuestion: (it) => `Compare ${it.a}/${it.b} and ${it.c}/${it.d}. Which is true?`,
};
