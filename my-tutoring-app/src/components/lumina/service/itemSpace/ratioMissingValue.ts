/**
 * Equivalent ratios: find a missing value (ratio-missing-value), grade 6 (6.RP.3a, 6.RP.3b).
 *
 * The task: given a ratio a : b and one quantity of an equivalent ratio, find the other quantity. A
 * unit-rate item is the same task scaled to 1 ("4 packs cost $12; how much for 1?").
 * Scope: a and b from 2 to 12; the given first quantity k from 1 to 60 with every value a whole number
 * (the second, k·b/a, at most 150). Listed: about 4,000 items.
 *
 * Features and their priors (logits for a typical grade-6 learner who was taught ratio tables):
 *   - nonWhole: the scale factor k/a is not a whole number (4 : 6 to 10 : ?) (+1.0). Karplus, Pulos and
 *     Stage (1983), Lamon (1993): integer-multiple items are solved far more often; non-integer ones draw
 *     the additive error and need a unit rate or a common factor first.
 *   - notHalf: a non-whole factor that is not a half (×5/3 rather than ×2.5) (+0.4): halving and doubling
 *     are the first non-integer strategies learners build (Tourniaire and Pulos 1985).
 *   - down: the factor is less than 1 (12 : 18 to 2 : ?) (+0.5), division rather than multiplication
 *     (Hart 1981).
 *   - findFirst: the given value is in the second row and the first is unknown (+0.3), the inverse step.
 *   - wholeRate: b is a whole multiple of a (3 : 12, "4 for each 1") (-0.4): the within-ratio
 *     relation is a whole number, so a learner scales across by it instead (Vergnaud 1983). A learner
 *     takes the easier route, so on a whole-rate item the factor's features (nonWhole, notHalf, down) do
 *     not apply: 3 : 6 to 7 : ? is "double it", whatever 7/3 is (a 3:6 base ranked hard without this).
 *     A rate of 1/n (4 : 2, "half as many") is the same route by division: it scores as `down` only.
 *   - unitRate: the target is 1 (find the amount for one) (+0.3). Scored on its one division b ÷ a, not on
 *     the factor 1/a (which made "3 packs cost $12" a hard item).
 *   - decimalAnswer: a unit rate that is not whole ("4 packs cost $14": $3.50) (+0.8); belowOne: the rate is
 *     less than 1, the smaller amount shared over the larger (+0.5); notHalf again for a rate that is not a
 *     half (+0.4). Only rates with at most two decimal places are listed; a unit rate's second amount runs to 120.
 *   - big: a value over 60 (+0.2), load.
 * Refit from first-try results when attempts exist.
 *
 * Wrong options: the additive error (b + (k − a), "add the same amount"), the given value itself, the
 * factor applied the wrong way (b·a/k), the factor used as the answer; far ones off by about a half.
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

export interface RatioFeatures {
  nonWhole: number;
  notHalf: number;
  down: number;
  findFirst: number;
  wholeRate: number;
  unitRate: number;
  decimalAnswer: number;
  belowOne: number;
  big: number;
}
export interface RatioItem {
  a: number;
  b: number;
  /** The first quantity of the equivalent ratio (1 for a unit-rate item). */
  k: number;
  /** Which quantity of the equivalent ratio is unknown. */
  hidden: 'first' | 'second';
  features: RatioFeatures;
  beta: number;
  structure: string;
}

export const RATIO_WEIGHTS: Record<keyof RatioFeatures | 'base', number> = {
  base: -1.0, nonWhole: 1.0, notHalf: 0.4, down: 0.5, findFirst: 0.3, wholeRate: -0.4, unitRate: 0.3, decimalAnswer: 0.8, belowOne: 0.5, big: 0.2,
};

export const scaledSecond = (it: Pick<RatioItem, 'a' | 'b' | 'k'>): number => (it.k * it.b) / it.a;
export const ratioAnswer = (it: RatioItem): number => (it.hidden === 'first' ? it.k : scaledSecond(it));
export const ratioGiven = (it: RatioItem): number => (it.hidden === 'first' ? scaledSecond(it) : it.k);
/** The scale factor from the base ratio to the equivalent one. */
export const ratioFactor = (it: Pick<RatioItem, 'a' | 'k'>): number => it.k / it.a;

function features(a: number, b: number, k: number, hidden: 'first' | 'second'): RatioFeatures {
  const m = k / a;
  if (k === 1) {
    const rate = b / a;
    return { nonWhole: 0, notHalf: Number.isInteger(rate * 2) ? 0 : 1, down: 0, findFirst: 0, wholeRate: 0, unitRate: 1,
      decimalAnswer: Number.isInteger(rate) ? 0 : 1, belowOne: rate < 1 ? 1 : 0, big: b > 60 ? 1 : 0 };
  }
  const acrossByRate = b % a === 0;
  const acrossByDivision = a % b === 0;
  const across = acrossByRate || acrossByDivision;
  return {
    nonWhole: across || Number.isInteger(m) ? 0 : 1,
    notHalf: !across && !Number.isInteger(m) && !Number.isInteger(m * 2) ? 1 : 0,
    down: acrossByDivision || (!across && m < 1) ? 1 : 0,
    findFirst: hidden === 'first' ? 1 : 0,
    wholeRate: b % a === 0 ? 1 : 0,
    unitRate: 0,
    decimalAnswer: 0,
    belowOne: 0,
    big: Math.max(a, b, k, (k * b) / a) > 60 ? 1 : 0,
  };
}

let cache: RatioItem[] | null = null;
export function ratioItems(): RatioItem[] {
  if (cache) return cache;
  const out: RatioItem[] = [];
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 120; b++) {
    if (a === b) continue;
    // Beyond 12 the second amount serves unit rates only ("4 packs cost $14").
    if (b > 12) {
      if (!Number.isInteger(Math.round((b / a) * 1e6) / 1e4)) continue;
      const f = features(a, b, 1, 'second');
      out.push({ a, b, k: 1, hidden: 'second', features: f, beta: linearBeta(f, RATIO_WEIGHTS),
        structure: `unit|${f.decimalAnswer ? (f.notHalf ? 'decimal' : 'half') : 'whole'}${f.belowOne ? '|below1' : ''}` });
      continue;
    }
    for (let k = 1; k <= 60; k++) {
      if (k === a) continue;
      // Whole values, except a unit rate, which may have up to two decimal places ($3.50 a pack).
      if (k === 1 ? !Number.isInteger(Math.round((b / a) * 1e6) / 1e4) : (k * b) % a !== 0) continue;
      const second = (k * b) / a;
      if (second > 150 || second === b) continue;
      // A unit-rate item asks for the amount for one: the first quantity is the given 1.
      for (const hidden of (k === 1 ? ['second'] : ['first', 'second']) as ('first' | 'second')[]) {
        const f = features(a, b, k, hidden);
        const structure = f.unitRate ? `unit|${f.decimalAnswer ? (f.notHalf ? 'decimal' : 'half') : 'whole'}${f.belowOne ? '|below1' : ''}`
          : `${f.down ? 'down' : 'up'}|${f.notHalf ? 'frac' : f.nonWhole ? 'half' : 'whole'}|${hidden}${f.wholeRate ? '|rate' : ''}`;
        out.push({ a, b, k, hidden, features: f, beta: linearBeta(f, RATIO_WEIGHTS), structure });
      }
    }
  }
  return (cache = out);
}

export function ratioDistractors(it: RatioItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = ratioAnswer(it);
  const given = ratioGiven(it);
  const cents = (v: number) => Math.round(v * 100) / 100;
  const ok = (v: number) => v > 0 && Number.isInteger(Math.round(v * 1e6) / 1e4) && cents(v) !== cents(answer);
  const near: number[] = [];
  const add = (v: number) => { if (ok(v) && !near.includes(v)) near.push(v); };
  // The additive error: the gap between the known pair added to the other row.
  add(it.hidden === 'second' ? it.b + (it.k - it.a) : it.a + (given - it.b));
  add(given); // the given value copied
  add(it.hidden === 'second' ? (it.b * it.a) / it.k : (it.a * it.b) / given); // the factor applied the wrong way
  if (it.features.unitRate) add(cents(it.a / it.b)); // divided the wrong way round
  else add(Math.round(ratioFactor(it))); // the scale factor taken for the answer
  const nearCount = it.beta < -0.6 ? 1 : 2;
  const picked: { value: number; distance: 'near' | 'far' }[] = near.sort(() => rand() - 0.5).slice(0, nearCount)
    .map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  const step = it.features.decimalAnswer ? 1 : Math.max(2, Math.round(answer / 2));
  for (const v of [answer + step, answer - step, answer * 2, answer + 2 * step, answer + 1, answer - 1, answer + 3]) {
    if (picked.length === 3) break;
    if (ok(v) && !taken.has(cents(v))) { picked.push({ value: cents(v), distance: 'far' }); taken.add(cents(v)); }
  }
  for (let v = 1; picked.length < 3; v++) if (!taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

export function ratioSpec(it: RatioItem): string {
  const given = ratioGiven(it);
  return it.features.unitRate
    ? `ratio ${it.a} to ${it.b}; ask how much of the second quantity goes with 1 of the first`
    : it.hidden === 'second'
      ? `ratio ${it.a} to ${it.b}; the first quantity is now ${it.k}; ask for the second quantity`
      : `ratio ${it.a} to ${it.b}; the second quantity is now ${given}; ask for the first quantity`;
}

export function ratioPlainQuestion(it: RatioItem): string {
  if (it.features.unitRate) return `${it.a} packs cost $${it.b}. How much does 1 pack cost?`;
  return it.hidden === 'second'
    ? `A recipe uses ${it.a} cups of flour for every ${it.b} cookies. How many cookies can you make with ${it.k} cups of flour?`
    : `A recipe uses ${it.a} cups of flour for every ${it.b} cookies. How many cups of flour do you need for ${ratioGiven(it)} cookies?`;
}

export const RATIO_MISSING_VALUE: ItemSpace<RatioItem> = {
  id: 'ratio-missing-value',
  describe: 'equivalent ratios and rates: given a ratio such as 3 to 12 and one quantity of an equivalent ratio, find the '
    + 'missing quantity (ratio tables, double number lines, scaling a recipe, unit rates and unit prices)',
  grades: ['6', '7'],
  criterion: 'Find a missing value in equivalent ratios',
  wordingGrade: 'grade 6',
  pick: (n, lo, hi, rand, accept) => pickSpread(ratioItems(), n, lo, hi, rand, accept,
    (it) => `${it.a}|${it.b}|${it.k}`, (it) => `${it.a}:${it.b}`),
  items: ratioItems,
  solve: (it) => ({
    answer: it.features.decimalAnswer ? ratioAnswer(it).toFixed(2) : String(ratioAnswer(it)),
    shown: [String(it.a), String(it.b), String(ratioGiven(it))],
    spec: ratioSpec(it),
  }),
  distractors: (it, rand) => ratioDistractors(it, rand).map((d) => ({
    value: it.features.decimalAnswer ? d.value.toFixed(2) : String(d.value), distance: d.distance })),
  plainQuestion: ratioPlainQuestion,
};
