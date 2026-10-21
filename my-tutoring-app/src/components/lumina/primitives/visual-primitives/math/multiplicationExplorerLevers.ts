/**
 * multiplication-explorer's in-item levers (/add-support-tiers; report qa/eval-reports/multiplication-explorer-levers-2026-10-09.md).
 * The misses are what `multiplicationMiss` observes; the failure evidence is documented (catalog commonStruggles) and
 * synthetic (the journey's wrong answers), none real.
 *
 * Declared once as a lever set (`MULTIPLICATION_LEVERS`, `bossLevers.ts`).
 * Product modes (build, connect, commutative, distributive, fluency): the typed product is the answer, so no lever may
 * print it.
 * - `skip_strip` (layout): under the fact, one box per group holding the group size, with the running total under every
 *   box but the last, which shows `?`. The count stops one group short of the answer.
 * - `show_model` (layout, fluency only): the fact's array under the bare fact, rows and columns, no total.
 * - `break_apart` (layout, distributive only; not while the Strategy break-apart is open): the break-apart with both
 *   partial products and the sum as `?`.
 * - `smaller_fact` (easier): the same mode on a smaller fact (one factor halved), ungraded, then the full item back blank.
 * missing_factor: the hidden factor is the answer.
 * - `skip_line` (layout): a number line with jumps of the known factor from 0, running two jumps past the product; only 0
 *   and the product are labelled. The learner counts the jumps to the product.
 * - `smaller_fact` (easier): the same known factor, a smaller hidden one.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { MultiplicationExplorerChallenge } from './MultiplicationExplorer';
import {
  MULTIPLICATION_MISSES_BY_MODE, NO_FACT, askedSlot, codeAsk, distributiveSplit, expectedAnswer, numbersIn,
  resolveChallengeFact, type ExplorerFactValue,
} from './multiplicationExplorerWorkspace';

export const SKIP_STRIP_LEVER = 'skip_strip';
export const SHOW_MODEL_LEVER = 'show_model';
export const BREAK_APART_LEVER = 'break_apart';
export const SKIP_LINE_LEVER = 'skip_line';
export const SMALLER_FACT_LEVER = 'smaller_fact';

const SMALLER = '~smaller';
export const isPracticeFact = (c: Pick<MultiplicationExplorerChallenge, 'id'>) => c.id.endsWith(SMALLER);
/** The session challenge a practice id was built from. */
export const practiceParent = (id: string | undefined, challenges: readonly MultiplicationExplorerChallenge[]) =>
  id?.endsWith(SMALLER) ? challenges.find(c => `${c.id}${SMALLER}` === id) : undefined;

/** The running totals the skip strip prints: every group's but the last (`b, 2b, … (a-1)b`). */
export const skipStripTotals = (fact: ExplorerFactValue) =>
  Array.from({ length: Math.max(0, fact.factor1 - 1) }, (_, i) => (i + 1) * fact.factor2);

/** The skip line's jumps: the known factor, and how many jumps it draws (two past the product). */
export function skipLine(c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, fact: ExplorerFactValue) {
  const slot = askedSlot(c);
  const step = slot === 'factor1' ? fact.factor2 : fact.factor1;
  return { step, jumps: expectedAnswer(c, fact) + 2, product: fact.product };
}

/** Leak rule: the numbers a pulled lever prints, never the answer unless the item already prints it as a given. */
export function leverNumbers(c: MultiplicationExplorerChallenge, fact: ExplorerFactValue, id: string): number[] {
  if (id === SKIP_STRIP_LEVER) return [fact.factor2, ...skipStripTotals(fact)];
  if (id === SHOW_MODEL_LEVER) return [fact.factor1, fact.factor2];
  if (id === BREAK_APART_LEVER) {
    const [x, y] = distributiveSplit(fact);
    return [fact.factor1, fact.factor2, x, y, x * fact.factor2, y * fact.factor2];
  }
  if (id === SKIP_LINE_LEVER) { const l = skipLine(c, fact); return [0, l.step, l.product]; }
  return [];
}

/**
 * The easier ask, in the item's own mode: one factor about halved (the hidden one on a missing factor, keeping the
 * known factor and its skip count). Never the item, its turnaround, its product or its answer; no square on a missing
 * factor. Null on a 2 × 2 item and on a practice item.
 */
export function smallerFact(c: MultiplicationExplorerChallenge, sessionFact: ExplorerFactValue = NO_FACT): MultiplicationExplorerChallenge | null {
  if (isPracticeFact(c)) return null;
  const f = resolveChallengeFact(c, sessionFact), slot = askedSlot(c);
  const halve = (n: number, avoid?: number) => {
    for (const m of [Math.max(2, Math.floor(n / 2)), ...Array.from({ length: Math.max(0, n - 2) }, (_, i) => n - 1 - i)])
      if (m >= 2 && m < n && m !== avoid) return m;
    return null;
  };
  let next: { factor1: number; factor2: number } | null = null;
  if (slot === 'product') {
    const a = halve(f.factor1);
    const b = a === null ? halve(f.factor2) : null;
    next = a !== null ? { factor1: a, factor2: f.factor2 } : b !== null ? { factor1: f.factor1, factor2: b } : null;
  } else {
    const known = slot === 'factor1' ? f.factor2 : f.factor1, hidden = halve(f[slot], known);
    if (hidden !== null) next = slot === 'factor1' ? { factor1: hidden, factor2: known } : { factor1: known, factor2: hidden };
  }
  if (!next) return null;
  const nf: ExplorerFactValue = { ...next, product: next.factor1 * next.factor2 };
  const simpler: MultiplicationExplorerChallenge = {
    ...c, id: `${c.id}${SMALLER}`, fact: next, targetFact: `${nf.factor1} × ${nf.factor2} = ${nf.product}`,
    instruction: codeAsk(c.type, slot, nf), hint: '', narration: '',
  };
  return practiceLeaks(c, simpler, sessionFact) ? null : simpler;
}

/** Leak rule for an easier item: never the learner's item, its turnaround, its product or its answer. */
export function practiceLeaks(parent: MultiplicationExplorerChallenge, simpler: MultiplicationExplorerChallenge, sessionFact: ExplorerFactValue = NO_FACT): boolean {
  const p = resolveChallengeFact(parent, sessionFact), s = resolveChallengeFact(simpler, sessionFact);
  return simpler.id === parent.id || s.product === p.product
    || (s.factor1 === p.factor1 && s.factor2 === p.factor2) || (s.factor1 === p.factor2 && s.factor2 === p.factor1)
    || expectedAnswer(simpler, s) === expectedAnswer(parent, p)
    || numbersIn(simpler.instruction).includes(expectedAnswer(parent, p))
    || (askedSlot(simpler) !== 'product' && s.factor1 === s.factor2);
}

// ── the lever set ────────────────────────────────────────────────────────

/** What the session already shows: the break-apart open on screen takes that lever away. */
export interface ExplorerLeverContext { breakdownShown: boolean }

const PRODUCT_MODES = ['build', 'connect', 'commutative', 'distributive', 'fluency'];
const notPractice = (c: MultiplicationExplorerChallenge) => !isPracticeFact(c);
/** The item's own fact: items are stamped with it (`explorerItems`), and an easier item carries its own. */
const factOf = (c: MultiplicationExplorerChallenge) => resolveChallengeFact(c, NO_FACT);

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on an easier item: the component declares nothing
 * while one is on screen, and every spec refuses a practice item besides.
 */
export const MULTIPLICATION_LEVERS = leverSet<MultiplicationExplorerChallenge, ExplorerLeverContext>({
  modeOf: c => c.type,
  missesOf: mode => MULTIPLICATION_MISSES_BY_MODE[mode as MultiplicationExplorerChallenge['type']] ?? [],
  specs: [
    { id: SKIP_STRIP_LEVER, type: 'layout', modes: PRODUCT_MODES, answers: 'all', offer: notPractice,
      when: 'The learner adds the factors, loses a group, or miscounts the total.',
      does: 'Puts a row of boxes under the fact, one box per group, each holding the group size, with the running total under '
        + 'every box except the last, which shows a question mark. The learner adds the last group.',
      fact: (_c: unknown, c) => { const f = factOf(c);
        return `Under the fact: ${f.factor1} boxes of ${f.factor2}, with the running total under every box except the last, which shows ?.`; } },
    { id: SHOW_MODEL_LEVER, type: 'layout', modes: ['fluency'], answers: 'all', offer: notPractice,
      when: 'The learner cannot recall the fact and has nothing to count.',
      does: 'Draws the fact as an array of rows and columns under the bare fact. No total is shown.',
      fact: (_c: unknown, c) => { const f = factOf(c);
        return `Under the fact: an array of ${f.factor1} rows and ${f.factor2} columns, with no total.`; } },
    { id: BREAK_APART_LEVER, type: 'layout', modes: ['distributive'],
      answers: ['one_part_only', 'added_factors', 'off_by_one', 'other_product'],
      offer: (c, ctx) => notPractice(c) && !ctx.breakdownShown,
      when: 'The learner gives one part, or cannot break the fact into easier ones.',
      does: 'Opens the break-apart under the picture: the fact split into two easier facts with each part worked out, and the '
        + 'total left as a question mark.',
      fact: (_c: unknown, c) => { const f = factOf(c), [x, y] = distributiveSplit(f);
        return `The break-apart is open: ${x} × ${f.factor2} + ${y} × ${f.factor2} = ${x * f.factor2} + ${y * f.factor2} = ?.`; } },
    { id: SKIP_LINE_LEVER, type: 'layout', modes: ['missing_factor'], answers: 'all', offer: notPractice,
      when: 'The learner types the product or the factor already shown, or subtracts, or is one off.',
      does: 'Draws a number line under the equation with equal jumps of the factor that is shown, starting at zero and running past '
        + 'the product. Only zero and the product are labelled; the learner counts the jumps it takes to reach the product.',
      fact: (_c: unknown, c) => { const l = skipLine(c, factOf(c));
        return `Under the equation: a number line with jumps of ${l.step} from 0 running past ${l.product}; only 0 and ${l.product} are labelled.`; } },
    { id: SMALLER_FACT_LEVER, type: 'easier', modes: PRODUCT_MODES,
      answers: ['other_product', 'added_factors', 'one_group_short', 'one_group_over'],
      when: 'The learner cannot work out a fact this big yet.',
      does: 'Opens a smaller fact of the same kind first, one factor about half as big. It is not graded; the full item comes '
        + 'back after it, blank.',
      content: c => smallerFact(c) },
    { id: SMALLER_FACT_LEVER, type: 'easier', modes: ['missing_factor'], answers: ['other_factor', 'gave_product', 'subtracted'],
      when: 'The learner cannot find a missing factor this big yet.',
      does: 'Opens an easier missing factor first, with the same factor shown and a smaller product. It is not graded; the '
        + 'full item comes back after it, blank.',
      content: c => smallerFact(c) },
  ],
});
