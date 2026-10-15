/**
 * Comparison word problems (compare-20, compare-100): one quantity has some more or fewer than another.
 *
 * The task: read a comparison story and find the unknown one of three quantities: the difference ("how
 * many more"), the larger amount, or the smaller amount. Scope: the larger quantity within 20 (grade 1)
 * or from 20 to 100 (grade 2). Listed: about 900 items within 20, about 28,000 within 100.
 *
 * Features and their priors (logits for a typical learner at the strand's grade who was taught it):
 *   - compared: the larger or smaller amount is unknown, not the difference (+0.4). Riley, Greeno and
 *     Heller (1983) and Carpenter and Moser (1984): difference-unknown compare problems are solved more
 *     often than compared-quantity-unknown ones by first and second graders.
 *   - inconsistent: the relational word points the wrong way for the operation ("Ana has 13, 5 more than
 *     Ben; how many has Ben?" asks for a subtraction after "more") (+1.2). Lewis and Mayer (1987),
 *     Stern (1993): the consistency effect is the largest single effect on compare problems; students
 *     who translate keywords add after "more". A drawn tape diagram reduces it; this is a prior.
 *   - fewer: the story says "fewer" rather than "more" (+0.3); "less/fewer" is acquired later (Hudson 1983).
 *   - subtraction: the computation is a subtraction (+0.3).
 *   - Within 20: the computation crosses ten (+0.9), a number over ten (+0.3), the size of the smaller
 *     operand (+0.5 per ten), as in add-sub-20.
 *   - Within 100: each regrouping (+0.7), a borrow (+0.4), a one-digit operand (-0.5), as in add-sub-100.
 * Refit from first-try results when attempts exist.
 *
 * Wrong options: the keyword error (the other operation on the two numbers shown), a number shown in
 * the story, a counting slip of one; far ones by five or ten. Every option stays inside the strand's range.
 */
import type { ItemSpace } from './types';
import { crossesTen } from './addSub20';
import { multiDigitFeatures } from './multiDigit';
import { linearBeta, pickSpread } from './spread';

export type CompareUnknown = 'difference' | 'larger' | 'smaller';
export type CompareWording = 'more' | 'fewer';

export interface CompareFeatures {
  compared: number;
  inconsistent: number;
  fewer: number;
  subtraction: number;
  bridges: number;
  teen: number;
  size: number;
  regroups: number;
  borrow: number;
  oneDigit: number;
}
export interface CompareItem {
  /** The larger quantity, the smaller quantity; the difference is larger − smaller. */
  larger: number;
  smaller: number;
  unknown: CompareUnknown;
  wording: CompareWording;
  features: CompareFeatures;
  beta: number;
  structure: string;
}

export const COMPARE_WEIGHTS: Record<keyof CompareFeatures | 'base', number> = {
  base: -1.4, compared: 0.4, inconsistent: 1.2, fewer: 0.3, subtraction: 0.3,
  bridges: 0.9, teen: 0.3, size: 0.5, regroups: 0.7, borrow: 0.4, oneDigit: -0.5,
};

/** The one computation the item needs: difference = L − S; larger = S + D; smaller = L − D. */
export function compareComputation(it: Pick<CompareItem, 'larger' | 'smaller' | 'unknown'>): { a: number; b: number; op: '+' | '-' } {
  const d = it.larger - it.smaller;
  if (it.unknown === 'difference') return { a: it.larger, b: it.smaller, op: '-' };
  if (it.unknown === 'larger') return { a: it.smaller, b: d, op: '+' };
  return { a: it.larger, b: d, op: '-' };
}

/** "more" points to adding only when the larger amount is unknown; "fewer" to subtracting only when the smaller is. */
export const isConsistent = (unknown: CompareUnknown, wording: CompareWording): boolean =>
  unknown === 'difference' || (unknown === 'larger') === (wording === 'more');

export function compareFeatures(larger: number, smaller: number, unknown: CompareUnknown, wording: CompareWording, max: 20 | 100): CompareFeatures {
  const { a, b, op } = compareComputation({ larger, smaller, unknown });
  const base = {
    compared: unknown === 'difference' ? 0 : 1,
    inconsistent: isConsistent(unknown, wording) ? 0 : 1,
    fewer: wording === 'fewer' ? 1 : 0,
    subtraction: op === '-' ? 1 : 0,
  };
  if (max === 20) {
    const small = op === '+' ? Math.min(a, b) : Math.min(b, a - b);
    return {
      ...base, bridges: crossesTen({ a, b, op }, op === '+') ? 1 : 0, teen: Math.max(a, op === '+' ? a + b : a) > 10 ? 1 : 0,
      size: small / 10, regroups: 0, borrow: 0, oneDigit: 0,
    };
  }
  const md = multiDigitFeatures(a, b, op);
  return { ...base, bridges: 0, teen: 0, size: 0, regroups: md.regroups, borrow: md.borrow, oneDigit: md.oneDigit };
}

function build(max: 20 | 100): CompareItem[] {
  const out: CompareItem[] = [];
  // Within 100 starts where within 20 stops, so the two strands do not overlap.
  const lo = max === 20 ? 3 : 21;
  for (let larger = lo; larger <= max; larger++) {
    // A difference or an amount of one is a counting check ("one more"), not a comparison.
    for (let smaller = 2; smaller <= larger - 2; smaller++) {
      for (const unknown of ['difference', 'larger', 'smaller'] as const) {
        for (const wording of ['more', 'fewer'] as const) {
          const features = compareFeatures(larger, smaller, unknown, wording, max);
          const tag = max === 20 ? `b${features.bridges}|t${features.teen}` : `r${features.regroups}${features.oneDigit ? '|1d' : ''}`;
          const structure = `${unknown}|${wording}|${tag}`;
          out.push({ larger, smaller, unknown, wording, features, beta: linearBeta(features, COMPARE_WEIGHTS), structure });
        }
      }
    }
  }
  return out;
}

const cache = new Map<number, CompareItem[]>();
export const compareItems = (max: 20 | 100): CompareItem[] => {
  if (!cache.has(max)) cache.set(max, build(max));
  return cache.get(max)!;
};

export function solveCompare(it: CompareItem): { answer: number; shown: number[] } {
  const d = it.larger - it.smaller;
  if (it.unknown === 'difference') return { answer: d, shown: [it.larger, it.smaller] };
  if (it.unknown === 'larger') return { answer: it.larger, shown: [it.smaller, d] };
  return { answer: it.smaller, shown: [it.larger, d] };
}

export function compareDistractors(it: CompareItem, max: number, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const { answer, shown } = solveCompare(it);
  const { a, b, op } = compareComputation(it);
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= max && v !== answer;
  const near: number[] = [];
  const addNear = (v: number) => { if (ok(v) && !near.includes(v)) near.push(v); };
  addNear(op === '+' ? Math.abs(a - b) : a + b); // the keyword error: the other operation
  addNear(shown[0]); // a number in the story
  for (const v of [answer + 1, answer - 1].sort(() => rand() - 0.5)) addNear(v);
  const nearCount = it.beta < -0.6 ? 1 : 2;
  const picked: { value: number; distance: 'near' | 'far' }[] = near.slice(0, nearCount).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  for (const v of [answer + 5, answer - 5, answer + 10, answer - 10, answer + 7, answer - 7, answer + 3, answer - 3]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  }
  for (let v = 0; picked.length < 3 && v <= max; v++) if (!taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

/** One line for the wording prompt: who has more, what is given, what is asked. */
export function compareSpec(it: CompareItem): string {
  const d = it.larger - it.smaller;
  const given = it.unknown === 'difference'
    ? `the first person has ${it.larger}, the second has ${it.smaller}; ask how many ${it.wording} ${it.wording === 'more' ? 'the first has than the second' : 'the second has than the first'}`
    : it.unknown === 'larger'
      ? (it.wording === 'more'
        ? `the second person has ${it.smaller}; the first has ${d} more than the second; ask how many the first has`
        : `the second person has ${it.smaller}; the second has ${d} fewer than the first; ask how many the first has`)
      : (it.wording === 'fewer'
        ? `the first person has ${it.larger}; the second has ${d} fewer than the first; ask how many the second has`
        : `the first person has ${it.larger}; the first has ${d} more than the second; ask how many the second has`);
  return `comparison: ${given} (use the word "${it.wording}"; the answer is ${solveCompare(it).answer} and must not appear)`;
}

/** A correct question built in code: Ana always has the larger amount. */
export function comparePlainQuestion(it: CompareItem, thing = 'stickers'): string {
  const d = it.larger - it.smaller;
  if (it.unknown === 'difference') {
    return it.wording === 'more'
      ? `Ana has ${it.larger} ${thing}. Ben has ${it.smaller} ${thing}. How many more ${thing} does Ana have than Ben?`
      : `Ana has ${it.larger} ${thing}. Ben has ${it.smaller} ${thing}. How many fewer ${thing} does Ben have than Ana?`;
  }
  if (it.unknown === 'larger') {
    return it.wording === 'more'
      ? `Ben has ${it.smaller} ${thing}. Ana has ${d} more ${thing} than Ben. How many ${thing} does Ana have?`
      : `Ben has ${it.smaller} ${thing}. Ben has ${d} fewer ${thing} than Ana. How many ${thing} does Ana have?`;
  }
  return it.wording === 'fewer'
    ? `Ana has ${it.larger} ${thing}. Ben has ${d} fewer ${thing} than Ana. How many ${thing} does Ben have?`
    : `Ana has ${it.larger} ${thing}. Ana has ${d} more ${thing} than Ben. How many ${thing} does Ben have?`;
}

function space(max: 20 | 100): ItemSpace<CompareItem> {
  return {
    id: max === 20 ? 'compare-20' : 'compare-100',
    describe: max === 20
      ? 'comparison word problems within 20: one amount is some more or fewer than another ("how many more", '
        + '"5 fewer than"); find the difference, the larger amount or the smaller amount'
      : 'comparison word problems within 100: one amount is some more or fewer than another ("how many more", '
        + '"15 fewer than"), with two-digit numbers; find the difference, the larger amount or the smaller amount',
    grades: max === 20 ? ['1', '2'] : ['2', '3'],
    criterion: 'Solve comparison word problems',
    wordingGrade: max === 20 ? 'grade 1' : 'grade 2',
    pick: (n, lo, hi, rand, accept) => pickSpread(compareItems(max), n, lo, hi, rand, accept,
      (it) => `${it.larger}|${it.smaller}`),
    items: () => compareItems(max),
    solve: (it) => {
      const { answer, shown } = solveCompare(it);
      // No `operation`: an inconsistent story reads as the other operation by design.
      return { answer: String(answer), shown: shown.map(String), spec: compareSpec(it) };
    },
    distractors: (it, rand) => compareDistractors(it, max, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
    plainQuestion: (it) => comparePlainQuestion(it),
  };
}

export const COMPARE_20 = space(20);
export const COMPARE_100 = space(100);
