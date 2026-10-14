/**
 * Item spaces: multi-digit addition and subtraction, within 100 (1.NBT.4, 2.NBT.5) and within 1000
 * (2.NBT.7, 3.NBT.2). Two strands from one builder, so a within-100 lesson never draws a 3-digit item.
 *
 * The task is one column computation with the result unknown. What makes it harder is the column
 * work, not the digits: how many columns regroup, a borrow that has to cross a zero (403 − 127), a
 * carry that makes the next column carry again (158 + 47), and how many columns there are. Digits
 * that leave the regrouping pattern unchanged (23 + 45 vs 32 + 54) are incidental.
 *
 * Sampled, not listed: `pick` draws random problems in scope, keys each by its structure (operation,
 * columns, regroupings, zero, chain) and keeps the pick-across-structures rule of the listed spaces.
 *
 * Beta is in logits for a typical learner at the strand's grade who was taught it. Priors:
 *   - regroup: each regrouped column (Fuson 1990, multidigit addition and subtraction; regrouping is
 *     the main source of error in Brown & Burton's and VanLehn's subtraction bug catalogues).
 *   - acrossZero: a borrow from a zero, the most persistent subtraction bug family (VanLehn 1990).
 *   - chain: a carry or borrow that forces the next column to regroup too.
 *   - subtraction, columns (a 3-digit item over a 2-digit one), oneDigit (adding or taking a
 *     one-digit number, 1.NBT.4: the easiest form).
 * Refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';

export interface MultiDigitFeatures {
  subtraction: number;
  regroups: number;
  /** A subtraction that borrows: decrementing the next column is the step most often skipped. */
  borrow: number;
  acrossZero: number;
  chain: number;
  threeDigit: number;
  oneDigit: number;
  /** A two-digit number with a three-digit one: one column has a single digit to bring down. */
  shortColumn: number;
}
export interface MultiDigitItem {
  a: number;
  b: number;
  op: '+' | '-';
  features: MultiDigitFeatures;
  beta: number;
  structure: string;
}

/**
 * Weights shared by both strands; the base differs, because each strand's beta is for a typical learner
 * at its own grade (within 100: a grade-2 learner meeting regrouping; within 1000: a grade-3 learner).
 */
export const MULTI_DIGIT_WEIGHTS: Record<keyof MultiDigitFeatures, number> = {
  subtraction: 0.4, regroups: 0.7, borrow: 0.4, acrossZero: 0.9, chain: 0.3, threeDigit: 0.4, oneDigit: -0.7, shortColumn: -0.3,
};
export const MULTI_DIGIT_BASE = { 100: -0.8, 1000: -1.5 } as const;

const digitsOf = (n: number): number[] => String(n).split('').reverse().map(Number);

/** Column work for a ± b: which columns regroup, whether a borrow crossed a zero, whether regroups chain. */
export function multiDigitFeatures(a: number, b: number, op: '+' | '-'): MultiDigitFeatures {
  const da = digitsOf(a);
  const db = digitsOf(b);
  const cols = Math.max(da.length, db.length);
  const regrouped: boolean[] = [];
  let carry = 0;
  let acrossZero = 0;
  for (let i = 0; i < cols; i++) {
    const x = da[i] ?? 0;
    const y = db[i] ?? 0;
    if (op === '+') {
      const s = x + y + carry;
      regrouped.push(s >= 10);
      carry = s >= 10 ? 1 : 0;
    } else {
      const top = x - carry;
      const need = top < y;
      regrouped.push(need);
      // The column lent to is a zero (or became one): the borrow has to go one column further.
      if (need && i + 1 < da.length && (da[i + 1] ?? 0) === 0) acrossZero = 1;
      carry = need ? 1 : 0;
    }
  }
  const regroups = regrouped.filter(Boolean).length;
  const chain = regrouped.some((r, i) => r && regrouped[i + 1]) ? 1 : 0;
  return {
    subtraction: op === '-' ? 1 : 0,
    regroups,
    borrow: op === '-' && regroups > 0 ? 1 : 0,
    acrossZero,
    chain,
    threeDigit: Math.max(a, b) >= 100 ? 1 : 0,
    oneDigit: Math.min(a, b) < 10 ? 1 : 0,
    shortColumn: Math.max(a, b) >= 100 && Math.min(a, b) >= 10 && Math.min(a, b) < 100 ? 1 : 0,
  };
}

const predictBeta = (f: MultiDigitFeatures, max: 100 | 1000): number => Math.round(
  (Object.keys(f) as (keyof MultiDigitFeatures)[]).reduce((s: number, k) => s + MULTI_DIGIT_WEIGHTS[k] * f[k], MULTI_DIGIT_BASE[max]) * 100,
) / 100;

const structureOf = (op: string, f: MultiDigitFeatures): string =>
  `${op}|${f.threeDigit ? '3d' : '2d'}${f.oneDigit ? '+1d' : f.shortColumn ? '+2d' : ''}|r${f.regroups}${f.acrossZero ? '|zero' : ''}${f.chain ? '|chain' : ''}`;

export function multiDigitItem(a: number, b: number, op: '+' | '-', max: 100 | 1000 = a + b > 100 || a >= 100 ? 1000 : 100): MultiDigitItem {
  const features = multiDigitFeatures(a, b, op);
  return { a, b, op, features, beta: predictBeta(features, max), structure: structureOf(op, features) };
}

const answerOf = (it: MultiDigitItem): number => (it.op === '+' ? it.a + it.b : it.a - it.b);

/** A random problem in scope: within 100, two-digit and one- or two-digit; within 1000, at least one three-digit. */
function sampleOne(max: 100 | 1000, rand: () => number): MultiDigitItem | null {
  const r = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const op = rand() < 0.5 ? '+' : '-';
  let a: number;
  let b: number;
  if (max === 100) {
    a = r(10, 99);
    b = rand() < 0.25 ? r(2, 9) : r(10, 99);
  } else {
    a = r(100, 999);
    b = rand() < 0.3 ? r(10, 99) : r(100, 999);
  }
  if (op === '-' && b > a) [a, b] = [b, a];
  const result = op === '+' ? a + b : a - b;
  // Within the strand's range; a difference of 0 and multiples-of-ten-only items test other rules.
  if (result > max || result < 1 || a % 10 === 0 && b % 10 === 0) return null;
  if (max === 1000 && Math.max(a, b) < 100) return null;
  return multiDigitItem(a, b, op, max);
}

function pickMultiDigit(max: 100 | 1000) {
  return (n: number, lo: number, hi: number, rand: () => number = Math.random, accept?: (it: MultiDigitItem) => boolean): MultiDigitItem[] => {
    const byStructure = new Map<string, MultiDigitItem[]>();
    for (let i = 0; i < 6000; i++) {
      const it = sampleOne(max, rand);
      if (!it || it.beta < lo || it.beta > hi || (accept && !accept(it))) continue;
      const pool = byStructure.get(it.structure) ?? [];
      if (pool.length < 40) pool.push(it);
      byStructure.set(it.structure, pool);
    }
    const structures = Array.from(byStructure.keys());
    if (!structures.length) return [];
    const used = new Map<string, number>();
    const seen = new Set<string>();
    const picks: MultiDigitItem[] = [];
    for (let guard = 0; picks.length < n && guard < n * 30; guard++) {
      const least = Math.min(...structures.map((s) => used.get(s) ?? 0));
      const open = structures.filter((s) => (used.get(s) ?? 0) === least);
      const key = open[Math.floor(rand() * open.length)];
      const pool = byStructure.get(key)!;
      const it = pool[Math.floor(rand() * pool.length)];
      used.set(key, (used.get(key) ?? 0) + 1);
      const id = it.op === '+' ? `${Math.min(it.a, it.b)}+${Math.max(it.a, it.b)}` : `${it.a}-${it.b}`;
      if (seen.has(id)) continue;
      seen.add(id);
      picks.push(it);
    }
    return picks;
  };
}

/**
 * Three wrong answers inside 0..max. Near: no regrouping (each column's digit sum or smaller-from-larger
 * difference, carries dropped), regrouped but did not decrement (a borrow never taken from the next
 * column: the answer plus ten), a dropped carry (the answer less ten), the one-digit number added to the
 * tens. Far: off by a hundred or by fifty. Easier items carry one near option, harder ones two.
 */
export function multiDigitDistractors(it: MultiDigitItem, max: number, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = answerOf(it);
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= max && v !== answer;
  const da = digitsOf(it.a);
  const db = digitsOf(it.b);
  const cols = Math.max(da.length, db.length);
  let noRegroup = 0;
  for (let i = 0; i < cols; i++) {
    const x = da[i] ?? 0;
    const y = db[i] ?? 0;
    noRegroup += (it.op === '+' ? (x + y) % 10 : Math.abs(x - y)) * 10 ** i;
  }
  const near = [noRegroup];
  if (it.features.regroups) near.push(it.op === '+' ? answer - 10 : answer + 10);
  if (it.b < 10 && it.op === '+') near.push(it.a + 10 * it.b);
  near.push(answer + 1, answer - 1);
  const nearList = Array.from(new Set(near.filter(ok))).sort(() => rand() - 0.5);
  const picked: { value: number; distance: 'near' | 'far' }[] = nearList
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  const steps = max === 100 ? [20, -20, 30, -30, 40, -40] : [100, -100, 200, -200, 50, -50];
  for (const d of steps) {
    if (picked.length === 3) break;
    if (ok(answer + d) && !taken.has(answer + d)) { picked.push({ value: answer + d, distance: 'far' }); taken.add(answer + d); }
  }
  for (let v = 0; picked.length < 3 && v <= max; v += max === 100 ? 7 : 37) if (ok(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

function regroupWords(it: MultiDigitItem): string {
  const f = it.features;
  const what = it.op === '+' ? 'carry' : 'borrow';
  if (!f.regroups) return `no column needs to ${what}`;
  return `${f.regroups} column${f.regroups > 1 ? 's' : ''} ${f.regroups > 1 ? 'need' : 'needs'} to ${what}`
    + `${f.acrossZero ? ', and the borrow crosses a zero' : ''}`;
}

/**
 * A fixed sample of the strand (seeded, distinct problems), so `tierPick` can rank what a consumer's scope
 * draws when a tier's band holds none of it (a no-regrouping mode has no hard items).
 */
const samples = new Map<number, MultiDigitItem[]>();
function sampleItems(max: 100 | 1000): MultiDigitItem[] {
  if (samples.has(max)) return samples.get(max)!;
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const seen = new Set<string>();
  const out: MultiDigitItem[] = [];
  for (let i = 0; i < 40000 && out.length < 6000; i++) {
    const it = sampleOne(max, rand);
    const key = it && `${it.a}${it.op}${it.b}`;
    if (!it || seen.has(key!)) continue;
    seen.add(key!);
    out.push(it);
  }
  samples.set(max, out);
  return out;
}

function space(max: 100 | 1000): ItemSpace<MultiDigitItem> {
  return {
    id: max === 100 ? 'add-sub-100' : 'add-sub-1000',
    describe: max === 100
      ? 'one sum or difference of two numbers within 100 (a two-digit number plus or minus a one- or two-digit number; '
        + 'regrouping, carrying, borrowing). Not three or more numbers'
      : 'one sum or difference of two numbers within 1000 (a three-digit number plus or minus a two- or three-digit number; '
        + 'regrouping, carrying, borrowing, across zeros). Not three or more numbers',
    grades: max === 100 ? ['1', '2', '3'] : ['2', '3', '4'],
    criterion: max === 100 ? 'Add and subtract within 100' : 'Add and subtract within 1000',
    wordingGrade: max === 100 ? 'grade 2' : 'grade 3',
    pick: pickMultiDigit(max),
    items: () => sampleItems(max),
    solve: (it) => ({
      answer: String(answerOf(it)),
      shown: [String(it.a), String(it.b)],
      operation: it.op,
      spec: `${it.a} ${it.op} ${it.b} = ? (${it.op === '+' ? 'add' : 'subtract'}; ${regroupWords(it)})`,
    }),
    distractors: (it, rand) => multiDigitDistractors(it, max, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
    plainQuestion: (it) => `What is ${it.a} ${it.op} ${it.b}?`,
  };
}

export const ADD_SUB_100 = space(100);
export const ADD_SUB_1000 = space(1000);
