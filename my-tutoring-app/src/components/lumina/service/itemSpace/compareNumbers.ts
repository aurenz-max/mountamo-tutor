/**
 * Comparing two whole numbers within 100 with >, < or = (compare-numbers).
 *
 * The task: decide which of two numbers is greater, or that they are equal, and name it with a symbol.
 * Scope: 1 to 100; a consumer bounds it further with `accept` (K within 10, a "numbers to 20" lesson).
 * Listed: 10,000 ordered pairs.
 *
 * Features and their priors (logits for a typical grade-1 learner who was taught to compare two-digit
 * numbers, 1.NBT.3; a kindergartner comparing within 10 sits near the easy end):
 *   - fewerDigits: one number has fewer digits (7 vs 23) (-0.7): the digit count decides.
 *   - sameTens: two two-digit numbers share a tens digit, so the ones decide (34 vs 38) (+0.6).
 *   - reversal: the same two digits swapped (47 vs 74, 12 vs 21) (+0.6): a learner who reads the ones
 *     digit, or the digits as separate numbers, gets it backwards (Fuson 1990, Kamii 1986).
 *   - closeness: 1 − log10(gap) / 2 (1 for a gap of 1, 0.5 for 10, 0 for 100) (+0.8), the numerical
 *     distance effect, which grows smoothly with the log of the gap (Moyer and Landauer 1967; Sekuler and
 *     Mierkiewicz 1977 found it largest in young children). A gap of 1-2 flag alone left 7,794 of the
 *     8,100 two-digit pairs on one beta, so the easy and medium thirds drew the same pairs (10-14 probe).
 *   - equal: the two are the same (+0.3): young learners expect a difference and pick a side.
 *   - The symbol (<, >) is incidental: weighting "<" split each tier's third by symbol, and every easy
 *     card of a two-digit session came out ">" (10-14 probe), an answer a learner could tap blind. The
 *     symbol is in the structure key instead, so the spread alternates it.
 *   - hundred: one number is 100 (+0.2), three digits beside two.
 * Refit from first-try results when attempts exist.
 *
 * As a text problem (knowledge-check) the answer is the true statement ("47 < 74"); the wrong options
 * are the other two symbols and the pair swapped with the same symbol (the reversed-symbol misread).
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';
import { namedNumberRange } from './numberScope';

export type CompareSymbol = '<' | '>' | '=';
export interface CompareNumbersFeatures {
  fewerDigits: number;
  sameTens: number;
  reversal: number;
  closeness: number;
  equal: number;
  hundred: number;
}
export interface CompareNumbersItem {
  left: number;
  right: number;
  features: CompareNumbersFeatures;
  beta: number;
  structure: string;
}

export const COMPARE_NUMBERS_WEIGHTS: Record<keyof CompareNumbersFeatures | 'base', number> = {
  base: -1.2, fewerDigits: -0.7, sameTens: 0.6, reversal: 0.6, closeness: 0.8, equal: 0.3, hundred: 0.2,
};

export const symbolOf = (left: number, right: number): CompareSymbol => (left > right ? '>' : left < right ? '<' : '=');
const digits = (n: number) => String(n).length;

export function compareNumbersFeatures(left: number, right: number): CompareNumbersFeatures {
  const two = (n: number) => n >= 10 && n <= 99;
  const d = Math.abs(left - right);
  return {
    fewerDigits: digits(left) !== digits(right) ? 1 : 0,
    sameTens: two(left) && two(right) && Math.floor(left / 10) === Math.floor(right / 10) && left !== right ? 1 : 0,
    reversal: two(left) && two(right) && left !== right && left % 10 === Math.floor(right / 10) && right % 10 === Math.floor(left / 10) ? 1 : 0,
    closeness: d === 0 ? 0 : Math.max(0, 1 - Math.log10(d) / 2),
    equal: d === 0 ? 1 : 0,
    hundred: left === 100 || right === 100 ? 1 : 0,
  };
}

let cache: CompareNumbersItem[] | null = null;
export function compareNumbersItems(): CompareNumbersItem[] {
  if (cache) return cache;
  const out: CompareNumbersItem[] = [];
  for (let left = 1; left <= 100; left++) for (let right = 1; right <= 100; right++) {
    const f = compareNumbersFeatures(left, right);
    const width = f.fewerDigits ? 'mixed' : `${digits(left)}d`;
    const d = Math.abs(left - right);
    const gap = d === 0 ? '' : d <= 2 ? '|near' : d <= 9 ? '|close' : '|far';
    const structure = `${symbolOf(left, right)}|${width}${f.sameTens ? '|sameTens' : ''}${f.reversal ? '|rev' : ''}${gap}`;
    out.push({ left, right, features: f, beta: linearBeta(f, COMPARE_NUMBERS_WEIGHTS), structure });
  }
  return (cache = out);
}

const statement = (l: number, s: CompareSymbol, r: number) => `${l} ${s} ${r}`;

function distractors(it: CompareNumbersItem): { value: string; distance: 'near' | 'far' }[] {
  const s = symbolOf(it.left, it.right);
  const others = (['<', '>', '='] as const).filter((x) => x !== s);
  if (s === '=') {
    return [
      { value: statement(it.left, '<', it.right), distance: 'near' },
      { value: statement(it.left, '>', it.right), distance: 'near' },
      { value: statement(it.right + 1, '=', it.left), distance: 'far' },
    ];
  }
  const flipped = s === '<' ? '>' : '<';
  return [
    { value: statement(it.left, flipped, it.right), distance: 'near' }, // the symbol read backwards
    { value: statement(it.right, s, it.left), distance: 'near' }, // the pair swapped, the symbol kept
    { value: statement(it.left, others.includes('=') ? '=' : flipped, it.right), distance: 'far' },
  ];
}

export const COMPARE_NUMBERS: ItemSpace<CompareNumbersItem> = {
  id: 'compare-numbers',
  describe: 'comparing: decide which of two whole numbers up to 100 is greater, less, or whether they are equal, '
    + 'using the symbols >, < and = (one pair of numbers at a time). Not ordering three or more numbers',
  grades: ['K', '1', '2'],
  criterion: 'Compare two numbers with >, < and =',
  wordingGrade: 'grade 1',
  // One equal pair per session at most: a tier third holds few structures, and medium drew two "=" of five.
  pick: (n, lo, hi, rand, accept) => pickSpread(compareNumbersItems(), n, lo, hi, rand, accept,
    (it) => `${Math.min(it.left, it.right)}|${Math.max(it.left, it.right)}`,
    (it) => (it.left === it.right ? 'equal' : `${it.left}|${it.right}`)),
  items: compareNumbersItems,
  solve: (it) => ({
    answer: statement(it.left, symbolOf(it.left, it.right), it.right),
    shown: [String(it.left), String(it.right)],
    spec: `compare ${it.left} (left) and ${it.right} (right); ask which statement with >, < or = is true, keeping ${it.left} on the left`,
  }),
  distractors: (it) => distractors(it),
  plainQuestion: (it) => `Compare ${it.left} and ${it.right}. Which is true?`,
  // "Compare two-digit numbers" draws two two-digit numbers, "within 20" stays within 20 (8.1c).
  scopeOf: (objective) => {
    const r = namedNumberRange(objective);
    return r && ((it) => Math.min(it.left, it.right) >= r.min && Math.max(it.left, it.right) <= r.max);
  },
};
