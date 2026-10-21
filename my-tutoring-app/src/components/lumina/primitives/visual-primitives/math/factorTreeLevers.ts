/**
 * factor-tree's in-item levers (/add-support-tiers; report qa/eval-reports/factor-tree-levers-2026-10-09.md).
 * The misses are what `factorMiss` observes in a wrong split; there is no real-learner evidence.
 *
 * Declared once as a lever set (`FACTOR_LEVERS`, `bossLevers.ts`). Every mode has the same levers (the modes differ
 * in number size, listed pairs and reset, not in the split):
 * - `divisibility_rules` (legend) the rules panel: even means two is a factor, ending in zero or five means five is,
 *   digits adding to a multiple of three means three is, and no small factor means it may be prime. Written in words,
 *   every small prime alike. The easy guided tier already draws it (a starting position, declared pulled).
 * - `partner_frame` (layout) a frame under the tree: the selected number ÷ the learner's Factor 1 = its partner, with
 *   the result left as "?"; multiply back to check.
 * - `product_check` (custom) a readout of what the learner's two typed factors multiply to, beside the number they
 *   must make.
 * - `smaller_tree` (easier) a practice tree on a nearby composite with one prime factor fewer, built here.
 *
 * Leak rules (code): the rules panel, the lever words and the scene facts carry no digit; the frame prints only the
 * selected number and the learner's own Factor 1, never the quotient; the readout prints only the learner's typed
 * factors, their product and the number; a practice tree is not the item, a factor of it or a multiple of it.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { FactorTreeChallenge } from './FactorTree';
import { FACTOR_TREE_MISSES_BY_MODE, isPrime, primeFactors } from './factorTreeWorkspace';

export const RULES_LEVER = 'divisibility_rules';
export const PARTNER_LEVER = 'partner_frame';
export const PRODUCT_LEVER = 'product_check';
export const SMALLER_LEVER = 'smaller_tree';

const SIMPLER = '~simpler';
export const isPracticeTree = (c: Pick<FactorTreeChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

/** The rules panel, in words: it names a rule for each small prime, never a number on the tree. */
export const DIVISIBILITY_RULES: readonly string[] = [
  'Even number? Then two is a factor: split off a two.',
  'Ends in zero or five? Then five is a factor: split off a five.',
  'Digits add up to a multiple of three? Then three is a factor: split off a three.',
  'No small factor divides it? It may be prime: a leaf.',
];

/** The partner frame's line: the selected number ÷ the learner's Factor 1 = ?, words where either is missing. */
export function partnerFrame(value: number | null, factor1: number | null): string {
  const n = value ?? 'the number', f = factor1 !== null && factor1 > 1 ? factor1 : 'your first factor';
  return `${n} ÷ ${f} = ?`;
}

/** The product readout: what the learner's typed factors make, beside the number. Null until both are typed. */
export function productReadout(value: number | null, factor1: number | null, factor2: number | null): string | null {
  if (factor1 === null || factor2 === null) return null;
  const made = factor1 * factor2;
  return `${factor1} × ${factor2} = ${made}${value === null ? '' : made === value ? `, which is ${value}` : `, not ${value}`}`;
}

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
/** Leak rule for the frame: no number but the selected one and the learner's own Factor 1. */
export const frameLeaks = (text: string, value: number | null, factor1: number | null) =>
  numbersIn(text).some(n => n !== value && n !== factor1);
/** Leak rule for the readout: no number but the learner's factors, their product and the selected one. */
export const readoutLeaks = (text: string, value: number | null, factor1: number | null, factor2: number | null) =>
  numbersIn(text).some(n => n !== value && n !== factor1 && n !== factor2 && n !== (factor1 ?? 0) * (factor2 ?? 0));
/** Leak rule for the lever words, the rules panel and the scene facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/**
 * The practice tree for `c`: the largest composite between six tenths of the item's number and one below it with
 * one prime factor fewer, that is not a factor or a multiple of the item's number. Null when the item already
 * needs only one split, or no number fits.
 */
export function smallerTree(c: FactorTreeChallenge): FactorTreeChallenge | null {
  if (isPracticeTree(c)) return null;
  const root = c.rootValue, want = primeFactors(root).length - 1;
  if (want < 2) return null;
  for (let n = root - 1; n >= Math.max(4, Math.ceil(root * 0.6)); n--) {
    if (isPrime(n) || primeFactors(n).length !== want) continue;
    const practice = { id: `${c.id}${SIMPLER}`, rootValue: n };
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice tree: never the item's number, a factor of it or a multiple of it; fewer prime factors. */
export function practiceLeaks(parent: FactorTreeChallenge, practice: FactorTreeChallenge): boolean {
  const a = parent.rootValue, b = practice.rootValue;
  return practice.id === parent.id || b === a || a % b === 0 || b % a === 0 || isPrime(b)
    || primeFactors(b).length >= primeFactors(a).length;
}

// ── the lever set ────────────────────────────────────────────────────────

export interface FactorLeverContext {
  /** The easy guided tier already draws the rules panel: a starting position, declared pulled. */
  rulesShown: boolean;
}

/** The levers a mount declares pulled: its runtime pulls, plus the rules panel the tier already draws. */
export const pulledWith = (pulled: readonly string[], ctx: FactorLeverContext): string[] =>
  (ctx.rulesShown && !pulled.includes(RULES_LEVER) ? [RULES_LEVER, ...pulled] : [...pulled]);

/** None is offered on a practice tree: the component declares nothing while one is on screen. */
const notPractice = (c: FactorTreeChallenge) => !isPracticeTree(c);

/** The levers, declared once (`bossLevers.ts`). Every miss is answered by a help lever offered on every tree. */
export const FACTOR_LEVERS = leverSet<FactorTreeChallenge, FactorLeverContext>({
  missesOf: () => FACTOR_TREE_MISSES_BY_MODE.unguided,
  specs: [
    { id: RULES_LEVER, type: 'legend', answers: ['used_one', 'not_a_factor'], offer: notPractice,
      when: 'The learner splits off one, or tries a number that does not divide the one they are splitting.',
      does: 'Shows the divisibility rules under the tree, in words: even means two is a factor, ending in zero or five '
        + 'means five is, digits adding to a multiple of three means three is, and no small factor means it may be '
        + 'prime. It names no number on the tree.',
      fact: 'Under the tree are the divisibility rules in words (two, three, five, and "may be prime").' },
    { id: PARTNER_LEVER, type: 'layout', answers: ['wrong_partner'], offer: notPractice,
      when: 'The learner has a factor that divides the number but pairs it with the wrong partner.',
      does: 'Shows a frame under the tree: the selected number divided by the learner\'s Factor one equals a question '
        + 'mark, and "multiply back to check". It never works out the division.',
      fact: 'Under the tree is a frame: the selected number divided by the learner\'s Factor one equals a question mark. '
        + 'Until the learner taps a number and types Factor one, it reads the number divided by your first factor, in '
        + 'words. It never shows the result.' },
    { id: PRODUCT_LEVER, type: 'custom', carrier: 'shown', answers: ['added', 'wrong_partner', 'not_a_factor'],
      offer: notPractice,
      why: 'a live readout computed from the learner\'s own typed factors as they type; no stock type works from the '
        + 'learner\'s input',
      when: 'The learner adds instead of multiplying, or gives two numbers whose product is not the number.',
      does: 'Shows what the learner\'s two typed factors multiply to, beside the number they must make, as they type. It '
        + 'shows nothing until both are typed and never suggests a factor.',
      fact: 'Under the tree is a readout of what the learner\'s two typed factors multiply to, beside the number; it is '
        + 'blank until both are typed.' },
    { id: SMALLER_LEVER, type: 'easier', answers: 'all',
      when: 'This number needs too many splits to hold at once.',
      does: 'Opens a practice tree first, on a nearby number that needs one split fewer and is not a factor or a multiple '
        + 'of this one. It is not graded; the full item comes back after it, blank.',
      content: c => smallerTree(c) },
  ],
});
