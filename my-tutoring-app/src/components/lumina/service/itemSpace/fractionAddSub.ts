/**
 * Item space: adding and subtracting fractions (4.NF.3a, like denominators; 5.NF.1, unlike).
 *
 * The task is one sum or difference of two fractions, answered in simplest form (a whole number or a
 * mixed number when the result is one or more). What makes it harder:
 *   - unlike: the denominators differ. When one divides the other (1/2 + 1/4) only one fraction is
 *     renamed; when neither does (1/3 + 1/4) both are, over a new common denominator.
 *   - simplify: the raw result is not in simplest form (1/6 + 1/3 = 3/6 = 1/2).
 *   - improper: the sum is one or more, so it is written as a whole or mixed number.
 *   - subtraction; unit (both numerators 1, the easiest form).
 * The denominator itself (sixths vs eighths) is incidental once its relation to the other is fixed.
 *
 * Beta is in logits for a typical learner at the strand's grade who was taught it. Priors: the
 * add-the-denominators error dominates unlike-denominator items (Siegler et al. 2011; Braithwaite,
 * Pyke & Siegler 2017), and renaming both fractions is harder than renaming one (Mack 1990). Refit from
 * first-try results when attempts exist.
 */
import type { ItemSpace } from './types';

export interface FractionFeatures {
  subtraction: number;
  unlikeMultiple: number;
  unlikeBoth: number;
  simplify: number;
  improper: number;
  unit: number;
}
export interface FractionItem {
  /** a/b op c/d */
  a: number; b: number; c: number; d: number;
  op: '+' | '-';
  features: FractionFeatures;
  beta: number;
  structure: string;
}

export const FRACTION_WEIGHTS: Record<keyof FractionFeatures | 'base', number> = {
  base: -1.6, subtraction: 0.3, unlikeMultiple: 1.0, unlikeBoth: 1.8, simplify: 0.5, improper: 0.5, unit: -0.4,
};

const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];
const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));
const lcm = (x: number, y: number): number => (x * y) / gcd(x, y);

/** The exact result as numerator/denominator over lcm(b, d), before simplifying. */
function raw(it: Pick<FractionItem, 'a' | 'b' | 'c' | 'd' | 'op'>): [number, number] {
  const den = lcm(it.b, it.d);
  const num = it.a * (den / it.b) + (it.op === '+' ? 1 : -1) * it.c * (den / it.d);
  return [num, den];
}

/** A fraction in simplest form, as a learner writes it: "3/4", "2", "1 1/4". */
export function fractionText(num: number, den: number): string {
  const g = gcd(num, den) || 1;
  const n = num / g;
  const m = den / g;
  if (m === 1) return String(n);
  if (n > m) return `${Math.floor(n / m)} ${n % m}/${m}`;
  return `${n}/${m}`;
}

export function fractionFeatures(a: number, b: number, c: number, d: number, op: '+' | '-'): FractionFeatures {
  const [num, den] = raw({ a, b, c, d, op });
  const multiple = b !== d && (b % d === 0 || d % b === 0);
  return {
    subtraction: op === '-' ? 1 : 0,
    unlikeMultiple: multiple ? 1 : 0,
    unlikeBoth: b !== d && !multiple ? 1 : 0,
    simplify: gcd(num, den) > 1 ? 1 : 0,
    improper: num >= den ? 1 : 0,
    unit: a === 1 && c === 1 ? 1 : 0,
  };
}

const predictBeta = (f: FractionFeatures): number => Math.round(
  (Object.keys(f) as (keyof FractionFeatures)[]).reduce((s, k) => s + FRACTION_WEIGHTS[k] * f[k], FRACTION_WEIGHTS.base) * 100,
) / 100;

function build(): FractionItem[] {
  const out: FractionItem[] = [];
  for (const b of DENOMINATORS) for (const d of DENOMINATORS) {
    // A common denominator past 24 (5 and 12, 8 and 12 is 24: kept) is not grade-5 work.
    if (lcm(b, d) > 24) continue;
    for (let a = 1; a < b; a++) for (let c = 1; c < d; c++) {
      for (const op of ['+', '-'] as const) {
        const [num] = raw({ a, b, c, d, op });
        // Positive differences only; sums stay below 2 (one whole and a part at most).
        if (num <= 0 || (op === '+' && num >= 2 * lcm(b, d))) continue;
        const features = fractionFeatures(a, b, c, d, op);
        const structure = `${op}|${features.unlikeBoth ? 'unlike-both' : features.unlikeMultiple ? 'unlike-one' : 'like'}`
          + `${features.simplify ? '|simplify' : ''}${features.improper ? '|mixed' : ''}${features.unit ? '|unit' : ''}`;
        out.push({ a, b, c, d, op, features, beta: predictBeta(features), structure });
      }
    }
  }
  return out;
}

let cache: FractionItem[] | null = null;
export const fractionItems = (): FractionItem[] => (cache ??= build());

export const fractionAnswer = (it: FractionItem): string => fractionText(...raw(it));

/** `n` items in [lo, hi], spread across structures (least used first); one computation once. */
export function pickFractions(
  n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (it: FractionItem) => boolean,
): FractionItem[] {
  const byStructure = new Map<string, FractionItem[]>();
  for (const it of fractionItems()) {
    if (it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
    byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  }
  const structures = Array.from(byStructure.keys());
  if (!structures.length) return [];
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const picks: FractionItem[] = [];
  for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
    const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
    const open = structures.filter((s) => (used.get(s) ?? 0) === least);
    const key = open[Math.floor(rand() * open.length)];
    const pool = byStructure.get(key)!;
    const it = pool[Math.floor(rand() * pool.length)];
    used.set(key, (used.get(key) ?? 0) + 1);
    const id = it.op === '+' ? [`${it.a}/${it.b}`, `${it.c}/${it.d}`].sort().join('+') : `${it.a}/${it.b}-${it.c}/${it.d}`;
    if (seen.has(id)) continue;
    seen.add(id);
    picks.push(it);
  }
  return picks;
}

/**
 * Three wrong answers, each different in VALUE from the answer (an unsimplified form of the answer is
 * not wrong). Near: added (or subtracted) numerators and denominators; numerators combined over one of
 * the given denominators; the wrong operation. Far: the answer moved by a half.
 */
export function fractionDistractors(it: FractionItem, rand: () => number = Math.random): { value: string; distance: 'near' | 'far' }[] {
  const [an, ad] = raw(it);
  const value = (n: number, d: number) => n / d;
  const target = value(an, ad);
  const sign = it.op === '+' ? 1 : -1;
  const cand: [number, number, 'near' | 'far'][] = [
    [it.a + sign * it.c, it.b + sign * it.d, 'near'],
    [it.a + sign * it.c, Math.max(it.b, it.d), 'near'],
    [it.a + sign * it.c, it.b, 'near'],
    [...raw({ ...it, op: it.op === '+' ? '-' : '+' }), 'near'],
    [2 * an + ad, 2 * ad, 'far'],
    [2 * an - ad, 2 * ad, 'far'],
    [an + 2 * ad, 2 * ad, 'far'],
  ];
  const picked: { value: string; distance: 'near' | 'far' }[] = [];
  const seenValues = new Set([target]);
  const usable = (n: number, d: number) => d > 0 && n > 0 && !seenValues.has(value(n, d));
  const nearList = cand.filter(([n, d, k]) => k === 'near' && usable(n, d)).sort(() => rand() - 0.5);
  for (const [n, d] of nearList.slice(0, it.beta < -0.6 ? 1 : 2)) {
    if (!usable(n, d)) continue;
    picked.push({ value: fractionText(n, d), distance: 'near' });
    seenValues.add(value(n, d));
  }
  for (const [n, d, k] of [...cand.filter((x) => x[2] === 'far'), ...cand.filter((x) => x[2] === 'near')]) {
    if (picked.length === 3) break;
    if (!usable(n, d)) continue;
    picked.push({ value: fractionText(n, d), distance: k });
    seenValues.add(value(n, d));
  }
  for (let k = 1; picked.length < 3; k++) {
    const n = an + k * ad;
    if (usable(n, ad)) { picked.push({ value: fractionText(n, ad), distance: 'far' }); seenValues.add(value(n, ad)); }
  }
  if (!picked.some((p) => p.distance === 'far')) picked[2] = { ...picked[2], distance: 'far' };
  return picked;
}

function howWords(it: FractionItem): string {
  const f = it.features;
  const den = f.unlikeBoth ? 'rename both fractions over a common denominator' : f.unlikeMultiple ? 'rename one fraction' : 'the denominators match';
  return `${den}${f.simplify ? '; the result simplifies' : ''}${f.improper ? '; the result is one or more' : ''}; answer in simplest form`;
}

export const FRACTION_ADD_SUB: ItemSpace<FractionItem> = {
  id: 'fraction-add-sub',
  describe: 'adding and subtracting fractions with like or unlike denominators (sums and differences of two fractions, '
    + 'answers in simplest form or as mixed numbers)',
  grades: ['4', '5', '6'],
  criterion: 'Add and subtract fractions',
  wordingGrade: 'grade 5',
  pick: pickFractions,
  items: fractionItems,
  solve: (it) => ({
    answer: fractionAnswer(it),
    shown: [`${it.a}/${it.b}`, `${it.c}/${it.d}`],
    operation: it.op,
    spec: `${it.a}/${it.b} ${it.op} ${it.c}/${it.d} = ? (${howWords(it)})`,
  }),
  distractors: (it, rand) => fractionDistractors(it, rand),
  plainQuestion: (it) => `What is ${it.a}/${it.b} ${it.op} ${it.c}/${it.d}?`,
  // 4.NF.3a is like denominators, 5.NF.1 unlike: an objective that names one gets only that part.
  scopeOf: (objective) => {
    const o = objective.toLowerCase();
    if (/\b(unlike|different) denominators?\b/.test(o)) return (it) => it.b !== it.d;
    if (/\b(like|same|common) denominators?\b/.test(o)) return (it) => it.b === it.d;
    return undefined;
  },
};
