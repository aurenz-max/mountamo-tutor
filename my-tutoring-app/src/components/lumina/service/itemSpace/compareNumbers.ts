/**
 * Comparing two whole numbers within 1,000 with >, < or = (compare-numbers).
 *
 * The task: decide which of two numbers is greater, or that they are equal, and name it with a symbol.
 * Scope: every pair within 100, and three-digit pairs (2.NBT.4) chosen by structure; a consumer bounds it
 * with `accept` (K within 10, a "numbers to 20" lesson), and `scopeOf` keeps an objective that names no
 * range within 100, so three-digit pairs reach only an objective that asks for them (8.1j).
 * Listed: 10,000 pairs within 100, and for each three-digit number the partners that carry a structure
 * (ones differ, tens differ in one hundred, hundreds differ, digits swapped, equal), plus two-digit
 * against three-digit pairs.
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
 *   - threeDigit: both numbers have three digits (+0.6): a grade-2 task on this grade-1 scale.
 *   - sameHundreds: two three-digit numbers share the hundreds digit, so the tens decide (+0.6), as sameTens;
 *     sameHundredsTens: they share hundreds and tens, so the ones decide (+0.9). Reversal covers three-digit
 *     numbers with the same digits in another order (347 vs 374).
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
  threeDigit: number;
  sameHundreds: number;
  sameHundredsTens: number;
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
  threeDigit: 0.6, sameHundreds: 0.6, sameHundredsTens: 0.9,
};

export const symbolOf = (left: number, right: number): CompareSymbol => (left > right ? '>' : left < right ? '<' : '=');
const digits = (n: number) => String(n).length;

const sortedDigits = (n: number) => String(n).split('').sort().join('');

export function compareNumbersFeatures(left: number, right: number): CompareNumbersFeatures {
  const two = (n: number) => n >= 10 && n <= 99;
  const three = (n: number) => n >= 100 && n <= 999;
  const d = Math.abs(left - right);
  const bothThree = three(left) && three(right);
  const sameH = bothThree && Math.floor(left / 100) === Math.floor(right / 100);
  const sameHT = sameH && Math.floor(left / 10) === Math.floor(right / 10);
  return {
    fewerDigits: digits(left) !== digits(right) ? 1 : 0,
    sameTens: two(left) && two(right) && Math.floor(left / 10) === Math.floor(right / 10) && left !== right ? 1 : 0,
    reversal: left !== right && ((two(left) && two(right) && left % 10 === Math.floor(right / 10) && right % 10 === Math.floor(left / 10))
      || (bothThree && sortedDigits(left) === sortedDigits(right))) ? 1 : 0,
    closeness: d === 0 ? 0 : Math.max(0, 1 - Math.log10(d) / 2),
    equal: d === 0 ? 1 : 0,
    hundred: (left === 100 || right === 100) && !bothThree ? 1 : 0,
    threeDigit: bothThree ? 1 : 0,
    sameHundreds: sameH && !sameHT ? 1 : 0,
    sameHundredsTens: sameHT && left !== right ? 1 : 0,
  };
}

/** The three-digit partners of `n` that carry a structure: ones, tens in its hundred, hundreds, swapped digits, equal. */
function threeDigitPartners(n: number): number[] {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  const out = new Set<number>([n, n + 1, n - 1, n + 2, n - 2]);
  for (const dt of [1, 2, 4, -1, -3]) if (t + dt >= 0 && t + dt <= 9) out.add(h * 100 + (t + dt) * 10 + o);
  for (const dh of [1, 2, 5, -1, -3]) out.add(n + dh * 100);
  for (const swapped of [h * 100 + o * 10 + t, t * 100 + h * 10 + o, o * 100 + t * 10 + h]) out.add(swapped);
  return Array.from(out).filter((m) => m >= 100 && m <= 999);
}

let cache: CompareNumbersItem[] | null = null;
export function compareNumbersItems(): CompareNumbersItem[] {
  if (cache) return cache;
  const out: CompareNumbersItem[] = [];
  const seen = new Set<string>();
  const push = (left: number, right: number) => {
    const k = `${left}|${right}`;
    if (seen.has(k)) return;
    seen.add(k);
    const f = compareNumbersFeatures(left, right);
    const width = f.fewerDigits ? 'mixed' : `${digits(left)}d`;
    const d = Math.abs(left - right);
    const gap = d === 0 ? '' : d <= 2 ? '|near' : d <= 9 ? '|close' : d <= 99 ? '|far' : '|hundreds';
    const shared = f.sameTens ? '|sameTens' : f.sameHundredsTens ? '|sameHT' : f.sameHundreds ? '|sameH' : '';
    const structure = `${symbolOf(left, right)}|${width}${shared}${f.reversal ? '|rev' : ''}${gap}`;
    out.push({ left, right, features: f, beta: linearBeta(f, COMPARE_NUMBERS_WEIGHTS), structure });
  };
  for (let left = 1; left <= 100; left++) for (let right = 1; right <= 100; right++) push(left, right);
  // Three-digit pairs (2.NBT.4), both ways round.
  for (let n = 100; n <= 999; n++) for (const m of threeDigitPartners(n)) { push(n, m); push(m, n); }
  // A two-digit number against a three-digit one: the digit count decides.
  for (let a = 10; a <= 99; a += 3) for (let b = 101; b <= 999; b += 47) { push(a, b); push(b, a); }
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
  describe: 'comparing: decide which of two whole numbers up to 1,000 (one-, two- or three-digit) is greater, less, or '
    + 'whether they are equal, using the symbols >, < and = (one pair of numbers at a time). Not ordering three or more numbers',
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
  // "Compare two-digit numbers" draws two two-digit numbers, "within 20" stays within 20 (8.1c). An
  // objective that names no range stays within 100: three-digit pairs only where the objective asks for
  // them ("three-digit", "hundreds", "1,000"), 8.1j.
  scopeOf: (objective) => {
    const r = namedNumberRange(objective)
      ?? (/\bhundreds\b|\b1,?000\b/i.test(objective) ? { min: 1, max: 999 } : { min: 1, max: 100 });
    return (it) => Math.min(it.left, it.right) >= r.min && Math.max(it.left, it.right) <= r.max;
  },
};
