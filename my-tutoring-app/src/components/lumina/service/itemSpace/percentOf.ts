/**
 * Percent of a quantity (percent-of), grade 6 (6.RP.3c): find a percent of a whole (15% of $60), or find the whole
 * when a part and its percent are given ($12 is 20% of what?).
 *
 * Scope: percents 2-90 (every multiple of 5 to 90 and 2, 4, 6, 8, 12, 16, 24); wholes 10-200 in steps of 5, never 100
 * (p% of 100 is p, so the percent would read as the answer); the part a whole number of at least 1. Listed: about
 * 1,500 items.
 *
 * Features and their priors (logits for a typical grade-6 learner taught percents on a bar or a double number line):
 *   - tenth (10%) -0.4 and half (50%) -0.5: one step, divide by 10 or by 2 (Parker and Leinhardt 1995: 10% and 50%
 *     are the first benchmarks learners own).
 *   - threeQuarters (75%) +0.3: a quarter, then three of them.
 *   - tens (20%-90% by tens) +0.7: a tenth, then that many tenths.
 *   - fives (5%, 15%, 35%, 45%... an odd multiple of 5) +1.9: a tenth, then half a tenth, then combine.
 *   - other (not a multiple of 5) +2.2: through 1%, or a decimal multiplication.
 *   - findWhole +0.6: the inverse step, from a part up to the whole (Dole, Cooper, Baturo and Conoplia 1997).
 *   - wholeNotTen: the whole (find_part) or the part (find_whole) is not a multiple of 10, so its tenth is not a whole
 *     number (+0.3). big: a whole over 100 (+0.3), load.
 * Refit from first-try results when attempts exist.
 *
 * Wrong options: the rest of the whole instead of the part, the percent read as the amount, the tenth alone (find a
 * part); the percent taken of the part, the part times ten, the rest of the whole (find the whole).
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

export interface PercentFeatures {
  tenth: number;
  half: number;
  threeQuarters: number;
  tens: number;
  fives: number;
  other: number;
  findWhole: number;
  wholeNotTen: number;
  big: number;
}

export interface PercentItem {
  percent: number;
  whole: number;
  part: number;
  /** Which quantity the learner finds. */
  unknown: 'part' | 'whole';
  features: PercentFeatures;
  beta: number;
  structure: string;
}

export const PERCENT_WEIGHTS: Record<keyof PercentFeatures | 'base', number> = {
  base: -1.2, tenth: -0.4, half: -0.5, threeQuarters: 0.3, tens: 0.7, fives: 1.9, other: 2.2, findWhole: 0.6, wholeNotTen: 0.3, big: 0.3,
};

export const PERCENTS = [2, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90] as const;

/** The percent's route, for the structure key and the tests. */
export function percentKind(p: number): 'tenth' | 'half' | 'quarter' | 'threeQuarters' | 'tens' | 'fives' | 'other' {
  if (p === 10) return 'tenth';
  if (p === 50) return 'half';
  if (p === 25) return 'quarter';
  if (p === 75) return 'threeQuarters';
  if (p % 10 === 0) return 'tens';
  if (p % 5 === 0) return 'fives';
  return 'other';
}

function features(percent: number, whole: number, part: number, unknown: 'part' | 'whole'): PercentFeatures {
  const kind = percentKind(percent);
  const given = unknown === 'part' ? whole : part;
  return {
    tenth: kind === 'tenth' ? 1 : 0,
    half: kind === 'half' ? 1 : 0,
    threeQuarters: kind === 'threeQuarters' ? 1 : 0,
    tens: kind === 'tens' ? 1 : 0,
    fives: kind === 'fives' ? 1 : 0,
    other: kind === 'other' ? 1 : 0,
    findWhole: unknown === 'whole' ? 1 : 0,
    wholeNotTen: given % 10 === 0 ? 0 : 1,
    big: whole > 100 ? 1 : 0,
  };
}

let cache: PercentItem[] | null = null;
export function percentItems(): PercentItem[] {
  if (cache) return cache;
  const out: PercentItem[] = [];
  for (const percent of PERCENTS) for (let whole = 10; whole <= 200; whole += 5) {
    if (whole === 100 || (percent * whole) % 100 !== 0) continue;
    const part = (percent * whole) / 100;
    if (part < 1 || part === percent) continue;
    for (const unknown of ['part', 'whole'] as const) {
      // A whole equal to the percent would make the percent typed as dollars the right answer.
      if (unknown === 'whole' && whole === percent) continue;
      const f = features(percent, whole, part, unknown);
      out.push({ percent, whole, part, unknown, features: f, beta: linearBeta(f, PERCENT_WEIGHTS),
        structure: `${unknown}|${percentKind(percent)}${f.wholeNotTen ? '|odd' : ''}${f.big ? '|big' : ''}` });
    }
  }
  return (cache = out);
}

export type PercentQuantities = Pick<PercentItem, 'percent' | 'whole' | 'part' | 'unknown'>;
export const percentAnswer = (it: PercentQuantities): number => (it.unknown === 'part' ? it.part : it.whole);
/** The amount the problem states besides the percent. */
export const percentGiven = (it: PercentItem): number => (it.unknown === 'part' ? it.whole : it.part);

/** Two-decimal amounts only, and never the key. */
const cents = (v: number) => Math.round(v * 100) / 100;
const isMoney = (v: number) => v > 0 && Math.abs(cents(v) - v) < 1e-9;

/** The misconception values, keyed by the miss each one shows (the bar's typed step reads them the same way). */
export function percentMissValues(it: PercentQuantities): Record<string, number> {
  const { percent: p, whole, part } = it;
  const out: Record<string, number> = {};
  const put = (miss: string, v: number) => { if (isMoney(v) && cents(v) !== percentAnswer(it)) out[miss] = cents(v); };
  if (it.unknown === 'part') {
    put('rest_not_part', whole - part);
    put('percent_as_amount', p);
    if (p !== 10) put('tenth_only', whole / 10);
  } else {
    put('percent_of_part', (p / 100) * part);
    if (p !== 10) put('part_times_ten', part * 10);
    put('rest_not_whole', whole - part);
    put('part_as_whole', part);
    put('percent_as_amount', p);
  }
  return out;
}

export function percentDistractors(it: PercentItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const answer = percentAnswer(it);
  const near = Object.values(percentMissValues(it)).filter((v, i, a) => a.indexOf(v) === i).sort(() => rand() - 0.5);
  const picked: { value: number; distance: 'near' | 'far' }[] = near.slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  const step = Math.max(2, Math.round(answer / 2));
  for (const v of [answer + step, answer * 2, answer - step, answer + 2 * step, answer + 1, answer + 3]) {
    if (picked.length === 3) break;
    if (isMoney(v) && Number.isInteger(v) && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  }
  for (let v = 1; picked.length < 3; v++) if (!taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  return picked;
}

export const percentSpec = (it: PercentItem): string => (it.unknown === 'part'
  ? `find ${it.percent}% of ${it.whole}; ask for the part`
  : `${it.part} is ${it.percent}% of an unknown whole; ask for the whole`);

export const percentPlainQuestion = (it: PercentItem): string => (it.unknown === 'part'
  ? `A jacket costs $${it.whole}. What is ${it.percent}% of the price, in dollars?`
  : `Maya has saved $${it.part}. That is ${it.percent}% of the money she needs. How much money does she need in all?`);

export const PERCENT_OF: ItemSpace<PercentItem> = {
  id: 'percent-of',
  describe: 'percents of a quantity: find a percent of a number (15% of 60) or find the whole when a part and its '
    + 'percent are given (12 is 20% of what number?), percents as a rate per 100',
  grades: ['6', '7'],
  criterion: 'Find a percent of a quantity, or the whole from a part and its percent',
  wordingGrade: 'grade 6',
  pick: (n, lo, hi, rand, accept) => pickSpread(percentItems(), n, lo, hi, rand, accept,
    (it) => `${it.percent}|${it.whole}|${it.unknown}`, (it) => String(it.percent)),
  items: percentItems,
  solve: (it) => ({
    answer: String(percentAnswer(it)),
    shown: [String(it.percent), String(percentGiven(it))],
    spec: percentSpec(it),
  }),
  distractors: (it, rand) => percentDistractors(it, rand).map((d) => ({ value: String(d.value), distance: d.distance })),
  plainQuestion: percentPlainQuestion,
  scopeOf: (objective) => {
    const o = objective.toLowerCase();
    const whole = /\bwhole\b|of what|original (amount|price|number)|total (amount|number)/.test(o);
    const part = /percent of (a|an|the)? ?(number|quantity|amount)|\d+\s*% of \$?\d/.test(o);
    if (whole && !part) return (it) => it.unknown === 'whole';
    if (part && !whole) return (it) => it.unknown === 'part';
    return undefined;
  },
};
