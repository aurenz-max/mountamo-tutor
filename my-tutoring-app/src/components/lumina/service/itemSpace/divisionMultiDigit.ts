/**
 * Item space: multi-digit division of whole numbers (4.NBT.6, 5.NBT.6): find the quotient and the
 * remainder.
 *
 * Two scopes of one strand, as mult-multi-digit and mult-multi-digit-5 are: grade 4 divides a two- to
 * four-digit number by a one-digit number (2 to 9); grade 5 divides a three- or four-digit number by a
 * two-digit number (11 to 99). ÷1 and ÷10 are rules, not this strand. Quotients of one digit are the facts
 * (mult-div-facts), so every quotient here has two digits or more.
 *
 * Listed by divisor × quotient × remainder (each quotient once with no remainder and once with one fixed
 * remainder), about 17,000 items in grade 4 and 15,000 in grade 5. Difficulty features, from the work a
 * learner does by partial quotients or long division (Fuson 2003; the zero-in-quotient and
 * remainder-too-large bugs in Brown & Burton 1978 and Cox 1975):
 *   - digits3, digits4: a three- or four-digit dividend (+0.4, +0.8): one more step each.
 *   - steps: the steps whose remainder carries into the next digit (+0.2 each).
 *   - quotientZero: a zero inside or at the end of the quotient (408, 230) (+0.7): the step whose
 *     partial quotient is zero is skipped and the zero dropped.
 *   - leadSmall: the dividend's first digit is less than the divisor (+0.3): the first step uses two digits.
 *   - remainder: the division does not come out even (+0.4).
 *   - anchor: a divisor of 2 or 5 (-0.4); hardDivisor: 6 to 9 (+0.3).
 *   - grade 5: estimateUp, a divisor whose ones digit is 5 to 9, so rounding it to tens overshoots and the
 *     first trial quotient is too big (+0.5); tensDivisor, a multiple of ten (-0.5).
 * Base -1.2 for both grades (grade 5 at -0.9 held only tens divisors in its easy band, 10-14 probe), logits for a typical learner at that grade taught the method.
 * Priors; refit from first-try results when attempts exist.
 */
import type { ItemSpace, SpaceDistractor } from './types';
import { linearBeta, pickSpread } from './spread';

export interface DivisionFeatures {
  digits3: number; digits4: number; steps: number; quotientZero: number; leadSmall: number;
  remainder: number; anchor: number; hardDivisor: number; estimateUp: number; tensDivisor: number;
}
export interface DivisionItem {
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  features: DivisionFeatures;
  beta: number;
  structure: string;
}

const WEIGHTS_4: Record<keyof DivisionFeatures | 'base', number> = {
  base: -1.2, digits3: 0.4, digits4: 0.8, steps: 0.2, quotientZero: 0.7, leadSmall: 0.3,
  remainder: 0.4, anchor: -0.4, hardDivisor: 0.3, estimateUp: 0.5, tensDivisor: -0.5,
};
const WEIGHTS_5: typeof WEIGHTS_4 = { ...WEIGHTS_4, base: -1.2 };
export const DIVISION_WEIGHTS = { grade4: WEIGHTS_4, grade5: WEIGHTS_5 };

/** The long-division steps: each partial dividend, its digit of the quotient, and what carries on. */
function longDivision(dividend: number, divisor: number): { digits: number[]; carries: number } {
  const ds = String(dividend).split('').map(Number);
  const digits: number[] = [];
  let carry = 0, carries = 0, started = false;
  for (let i = 0; i < ds.length; i++) {
    const part = carry * 10 + ds[i];
    const q = Math.floor(part / divisor);
    carry = part - q * divisor;
    if (q > 0) started = true;
    if (started) {
      digits.push(q);
      if (carry > 0 && i < ds.length - 1) carries++;
    }
  }
  return { digits, carries };
}

export function divisionFeatures(dividend: number, divisor: number): DivisionFeatures {
  const len = String(dividend).length;
  const { digits, carries } = longDivision(dividend, divisor);
  const lead = Number(String(dividend)[0]);
  const twoDigit = divisor >= 10;
  return {
    digits3: len === 3 ? 1 : 0,
    digits4: len === 4 ? 1 : 0,
    steps: carries,
    quotientZero: digits.slice(1).includes(0) ? 1 : 0,
    leadSmall: !twoDigit && lead < divisor ? 1 : 0,
    remainder: dividend % divisor ? 1 : 0,
    anchor: divisor === 2 || divisor === 5 ? 1 : 0,
    hardDivisor: divisor >= 6 && divisor <= 9 ? 1 : 0,
    estimateUp: twoDigit && divisor % 10 >= 5 ? 1 : 0,
    tensDivisor: twoDigit && divisor % 10 === 0 ? 1 : 0,
  };
}

function item(dividend: number, divisor: number, grade5: boolean): DivisionItem {
  const features = divisionFeatures(dividend, divisor);
  const structure = `${String(dividend).length}d÷${grade5 ? 2 : 1}d|s${features.steps}`
    + `${features.quotientZero ? '|q0' : ''}${features.remainder ? '|r' : ''}${features.leadSmall ? '|lead' : ''}`
    + `${features.estimateUp ? '|up' : features.tensDivisor ? '|tens' : ''}`;
  return {
    dividend, divisor, quotient: Math.floor(dividend / divisor), remainder: dividend % divisor,
    features, beta: linearBeta(features, grade5 ? WEIGHTS_5 : WEIGHTS_4), structure,
  };
}

/** A fixed, spread remainder for the quotient's second item (1..divisor-1), so the list is deterministic. */
const fixedRemainder = (q: number, d: number) => 1 + ((q * 7 + d * 3) % (d - 1));

function build(grade5: boolean): DivisionItem[] {
  const out: DivisionItem[] = [];
  const divisors = grade5 ? Array.from({ length: 89 }, (_, i) => i + 11) : [2, 3, 4, 5, 6, 7, 8, 9];
  for (const d of divisors) {
    for (let q = 10; q * d < 10000; q++) {
      for (const r of [0, fixedRemainder(q, d)]) {
        const dividend = q * d + r;
        if (dividend >= 10000) continue;
        if (grade5 && dividend < 100) continue;
        // Grade 5: two-digit quotients and the three-digit quotients of a four-digit dividend, every
        // fourth one (the list stays near 15,000 and keeps every structure).
        if (grade5 && q >= 100 && q % 4 !== 0) continue;
        out.push(item(dividend, d, grade5));
      }
    }
  }
  return out;
}

let cache4: DivisionItem[] | null = null;
let cache5: DivisionItem[] | null = null;
export const division4Items = (): DivisionItem[] => (cache4 ??= build(false));
export const division5Items = (): DivisionItem[] => (cache5 ??= build(true));

export const divisionAnswer = (it: DivisionItem): string =>
  it.remainder ? `${it.quotient} R ${it.remainder}` : String(it.quotient);

/**
 * Three wrong answers. Near: the quotient's zero dropped (408 -> 48), the remainder left off, a trial
 * quotient one too small with the remainder as large as the divisor or more (52 R 3 by 7 -> 51 R 10), the
 * quotient one too big. Far: the quotient off by a place (a digit written in the wrong column).
 */
export function divisionDistractors(it: DivisionItem, rand: () => number = Math.random): SpaceDistractor[] {
  const fmt = (q: number, r: number) => (r ? `${q} R ${r}` : String(q));
  const near: string[] = [];
  const qs = String(it.quotient);
  if (it.features.quotientZero && /0/.test(qs.slice(1))) near.push(fmt(Number(qs[0] + qs.slice(1).replace(/0/g, '')), it.remainder));
  if (it.remainder) near.push(String(it.quotient));
  near.push(fmt(it.quotient - 1, it.remainder + it.divisor));
  near.push(fmt(it.quotient + 1, it.remainder));
  const answer = divisionAnswer(it);
  const nearList = Array.from(new Set(near)).filter((v) => v !== answer && !v.startsWith('0') && !v.startsWith('-'));
  const ordered = [...nearList.slice(0, 1), ...nearList.slice(1).sort(() => rand() - 0.5)];
  const picked: SpaceDistractor[] = ordered.slice(0, it.beta < -0.6 ? 1 : 2).map((value) => ({ value, distance: 'near' }));
  const taken = new Set([answer, ...picked.map((p) => p.value)]);
  const lead = 10 ** (qs.length - 1);
  for (const q of [it.quotient * 10, it.quotient + lead, it.quotient - lead, it.quotient + 2 * lead, Math.floor(it.quotient / 10)]) {
    if (picked.length === 3) break;
    const v = fmt(q, it.remainder);
    if (q > 0 && !taken.has(v)) { picked.push({ value: v, distance: 'far' }); taken.add(v); }
  }
  return picked;
}

const shared = {
  criterion: 'Divide multi-digit whole numbers',
  distractors: divisionDistractors,
  solve: (it: DivisionItem) => ({
    answer: divisionAnswer(it),
    shown: [String(it.dividend), String(it.divisor)],
    spec: `${it.dividend} ÷ ${it.divisor} (the quotient is unknown${it.remainder
      ? '; there is a remainder, so the question asks both how many in each group and how many are left over' : ''})`,
    ...(it.remainder ? { asks: /left\s*over|leftover|remain/i } : {}),
  }),
  plainQuestion: (it: DivisionItem) => `What is ${it.dividend} ÷ ${it.divisor}${it.remainder ? ', and what is left over' : ''}?`,
  // One dividend per session, and one divisor where the band allows (÷2 is a third of the grade-4 list and
  // filled the easy and medium sessions of the 10-14 probe).
  pickFrom: (items: () => DivisionItem[]) => (n: number, lo: number, hi: number, rand?: () => number, accept?: (it: DivisionItem) => boolean) =>
    pickSpread(items(), n, lo, hi, rand, accept, (it) => String(it.dividend), (it) => String(it.divisor)),
};

export const DIV_MULTI_DIGIT: ItemSpace<DivisionItem> = {
  id: 'div-multi-digit',
  describe: 'dividing a two-, three- or four-digit number by a one-digit number, with or without a remainder (grade 4), '
    + 'by partial quotients, an area model or long division; not the basic division facts within 100',
  grades: ['4', '5'],
  wordingGrade: 'grade 4',
  criterion: shared.criterion,
  pick: shared.pickFrom(division4Items),
  items: division4Items,
  solve: shared.solve,
  distractors: shared.distractors,
  plainQuestion: shared.plainQuestion,
};

export const DIV_MULTI_DIGIT_5: ItemSpace<DivisionItem> = {
  id: 'div-multi-digit-5',
  describe: 'dividing a three- or four-digit number by a two-digit number (grade 5 and up), with or without a remainder, '
    + 'by partial quotients, estimation or long division',
  grades: ['5', '6'],
  wordingGrade: 'grade 5',
  criterion: shared.criterion,
  pick: shared.pickFrom(division5Items),
  items: division5Items,
  solve: shared.solve,
  distractors: shared.distractors,
  plainQuestion: shared.plainQuestion,
};
