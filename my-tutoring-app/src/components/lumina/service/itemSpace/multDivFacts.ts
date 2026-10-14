/**
 * Item space: multiplication and division facts within 100 (grade 3, factors 2 to 10).
 *
 * Code owns the problem. Every fact a × b with both factors in 2..10 is listed three ways: the product
 * unknown (a × b = ?), a factor unknown (? × b = p or a × ? = p), and the quotient unknown (p ÷ a = ?).
 * ×0 and ×1 are excluded: they test the rule for zero or one, not this strand's facts.
 *
 * Difficulty features (research behind the priors):
 *   - anchor: a factor of 2, 5 or 10. These facts are learned first and retrieved fastest, by rule
 *     or skip count (Campbell & Graham 1985; LeFevre et al. 1996).
 *   - tie: a × a. Ties are faster and more accurate than neighbours of the same size (the tie effect).
 *   - hard factors: how many of the factors are 6, 7, 8 or 9, the facts with no rule and the most
 *     errors in grade-3 data (Campbell 1997; Wood et al. 1978 error tables).
 *   - size: the product over 100. The problem-size effect holds after the families above.
 *   - division and missing factor: the inverse forms are slower and less accurate than the matching
 *     multiplication (Campbell 1999; LeFevre & Morris 1999), the missing factor slightly less so.
 * Revisions:
 *   - 2026-10-13: ×10 facts get their own weight (a place-value rule, easier than ×2 or ×5: 6 × 10
 *     sat in medium), and the tie weight doubles (9 × 9 sat in hard; squares are learned early).
 *     Read off the 10-13 probe tables.
 *
 * Beta = base + Σ weight × feature, logits for a typical grade-3 learner taught the facts. The weights
 * are priors to be refit from first-try results on real attempts.
 */
import type { ItemSpace, SpaceDistractor } from './types';

export type MultDivForm = 'product' | 'factor1' | 'factor2' | 'quotient';
export interface MultDivItem {
  a: number;
  b: number;
  form: MultDivForm;
  features: MultDivFeatures;
  beta: number;
  structure: string;
}
export interface MultDivFeatures {
  anchor: number;
  ten: number;
  tie: number;
  hardFactors: number;
  size: number;
  division: number;
  missingFactor: number;
}

export const MULT_DIV_WEIGHTS: Record<keyof MultDivFeatures | 'base', number> = {
  base: -1.0, anchor: -0.8, ten: -0.5, tie: -0.7, hardFactors: 0.55, size: 1.2, division: 0.6, missingFactor: 0.5,
};

const ANCHORS = new Set([2, 5, 10]);
const HARD = new Set([6, 7, 8, 9]);

export function multDivFeatures(a: number, b: number, form: MultDivForm): MultDivFeatures {
  return {
    anchor: ANCHORS.has(a) || ANCHORS.has(b) ? 1 : 0,
    ten: a === 10 || b === 10 ? 1 : 0,
    tie: a === b ? 1 : 0,
    hardFactors: (HARD.has(a) ? 1 : 0) + (HARD.has(b) ? 1 : 0),
    size: (a * b) / 100,
    division: form === 'quotient' ? 1 : 0,
    missingFactor: form === 'factor1' || form === 'factor2' ? 1 : 0,
  };
}

function predictBeta(f: MultDivFeatures): number {
  const w = MULT_DIV_WEIGHTS;
  return (Object.keys(f) as (keyof MultDivFeatures)[]).reduce((s, k) => s + w[k] * f[k], w.base);
}

function build(): MultDivItem[] {
  const out: MultDivItem[] = [];
  for (let a = 2; a <= 10; a++) for (let b = 2; b <= 10; b++) {
    for (const form of ['product', 'factor1', 'factor2', 'quotient'] as const) {
      const features = multDivFeatures(a, b, form);
      const structure = `${form}|a${features.anchor}${features.ten ? "x10" : ""}|t${features.tie}|h${features.hardFactors}`;
      out.push({ a, b, form, features, beta: predictBeta(features), structure });
    }
  }
  return out;
}

let cache: MultDivItem[] | null = null;
/** Every item in the strand (324), built once. */
export const multDivItems = (): MultDivItem[] => (cache ??= build());

export interface SolvedMultDiv { answer: number; shown: number[]; expr: string }

export function solveMultDiv({ a, b, form }: MultDivItem): SolvedMultDiv {
  const p = a * b;
  switch (form) {
    case 'factor1': return { answer: a, shown: [b, p], expr: `? × ${b} = ${p}` };
    case 'factor2': return { answer: b, shown: [a, p], expr: `${a} × ? = ${p}` };
    case 'quotient': return { answer: b, shown: [p, a], expr: `${p} ÷ ${a} = ?` };
    default: return { answer: p, shown: [a, b], expr: `${a} × ${b} = ?` };
  }
}

/**
 * `n` items in [lo, hi], spread across structures (least used first). No two picks share a
 * computation, and none is the turnaround of another product pick (3 × 4 after 4 × 3).
 */
export function pickMultDiv(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (item: MultDivItem) => boolean,
): MultDivItem[] {
  const byStructure = new Map<string, MultDivItem[]>();
  for (const it of multDivItems()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: MultDivItem[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    // One fact per pick: the same pair of factors in any order or form is the same fact.
    const fact = `${Math.min(it.a, it.b)}x${Math.max(it.a, it.b)}`;
    if (seen.has(fact)) continue;
    seen.add(fact);
    picks.push(it);
  }
  return picks;
}

/**
 * Three wrong answers. Near: a neighbouring fact's product (7 × 8 → 48 or 63), the factors added, the
 * number shown, one off a factor, the product given instead of a factor. Far: ruled out by knowing
 * roughly how big the answer is. Easy items carry one near option, the rest two; every set keeps a far
 * option. Products stay in 1..100 and factors or quotients in 1..10, the strand's range.
 */
export function multDivDistractors(it: MultDivItem, rand: () => number = Math.random): SpaceDistractor[] {
  const { answer, shown } = solveMultDiv(it);
  const { a, b } = it;
  const productAsked = it.form === 'product';
  const max = productAsked ? 100 : 10;
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v <= max && v !== answer;
  const near = new Set<number>();
  if (productAsked) {
    near.add(a * (b - 1)); // one group short (a neighbouring fact)
    near.add(a * (b + 1)); // one group over
    near.add((a - 1) * b);
    near.add(a + b); // added the factors
  } else {
    near.add(answer + 1); // one jump off
    near.add(answer - 1);
    near.add(shown[0] === answer ? shown[1] : shown[0]); // the other number shown
  }
  const nearList = Array.from(near).filter(ok).sort(() => rand() - 0.5);
  const picked: SpaceDistractor[] = nearList.slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value: String(value), distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => Number(p.value))]);
  const far = productAsked
    ? [answer + 20, answer - 20, answer + 15, answer - 15, answer + 30, answer - 30, answer + 25]
    : [answer + 4, answer - 4, answer + 5, answer - 5, answer + 3, answer - 3, answer + 6, answer - 6];
  for (const v of far) {
    if (picked.length === 3) break;
    if (!ok(v) || taken.has(v)) continue;
    picked.push({ value: String(v), distance: 'far' });
    taken.add(v);
  }
  for (let v = 1; picked.length < 3 && v <= max; v++) if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  return picked;
}

function plainQuestion(it: MultDivItem): string {
  const { a, b } = it;
  const p = a * b;
  switch (it.form) {
    case 'factor1': return `Some bags each hold ${b} apples. There are ${p} apples in all. How many bags are there?`;
    case 'factor2': return `There are ${a} bags with the same number of apples in each. There are ${p} apples in all. How many apples are in each bag?`;
    case 'quotient': return `${p} apples are shared equally into ${a} bags. How many apples go in each bag?`;
    default: return `There are ${a} bags with ${b} apples in each bag. How many apples are there in all?`;
  }
}

const FORM_WORDS: Record<MultDivForm, string> = {
  product: 'equal groups; the total is unknown',
  factor1: 'equal groups; the number of groups is unknown (the group size and the total are given)',
  factor2: 'equal groups; the size of each group is unknown (the number of groups and the total are given)',
  quotient: 'sharing a total equally; the size of each share is unknown',
};

export const MULT_DIV_FACTS: ItemSpace<MultDivItem> = {
  id: 'mult-div-facts',
  describe: 'multiplying and dividing within 100: multiplication and division facts with factors up to 10, '
    + 'products, missing factors, quotients, equal-groups and sharing word problems',
  grades: ['2', '3', '4'],
  criterion: 'Multiply and divide within 100',
  wordingGrade: 'grade 3',
  pick: pickMultDiv,
  items: multDivItems,
  solve: (it) => {
    const sol = solveMultDiv(it);
    return { answer: String(sol.answer), shown: sol.shown.map(String), spec: `${sol.expr.replace(' = ?', '')} (${FORM_WORDS[it.form]})` };
  },
  distractors: multDivDistractors,
  plainQuestion,
};
