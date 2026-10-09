/**
 * multiplication-explorer's in-item levers (/add-support-tiers; report qa/eval-reports/multiplication-explorer-levers-2026-10-09.md).
 * The misses are what `multiplicationMiss` observes; the failure evidence is documented (catalog commonStruggles) and
 * synthetic (the journey's wrong answers), none real.
 *
 * Product modes (build, connect, commutative, distributive, fluency): the typed product is the answer, so no lever may
 * print it.
 * - `skip_strip` (help): under the fact, one box per group holding the group size, with the running total under every
 *   box but the last, which shows `?`. The count stops one group short of the answer.
 * - `show_model` (help, fluency only): the fact's array under the bare fact, rows and columns, no total.
 * - `break_apart` (help, distributive only): the break-apart with both partial products and the sum as `?`.
 * - `smaller_fact` (simplify): the same mode on a smaller fact (one factor halved), ungraded, then the full item back blank.
 * missing_factor: the hidden factor is the answer.
 * - `skip_line` (help): a number line with jumps of the known factor from 0, running two jumps past the product; only 0
 *   and the product are labelled. The learner counts the jumps to the product.
 * - `smaller_fact` (simplify): the same known factor, a smaller hidden one.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { MultiplicationExplorerChallenge } from './MultiplicationExplorer';
import {
  askedSlot, codeAsk, distributiveSplit, expectedAnswer, numbersIn, resolveChallengeFact,
  type ExplorerFactValue, type MultiplicationMiss,
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
export function smallerFact(c: MultiplicationExplorerChallenge, sessionFact: ExplorerFactValue): MultiplicationExplorerChallenge | null {
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
export function practiceLeaks(parent: MultiplicationExplorerChallenge, simpler: MultiplicationExplorerChallenge, sessionFact: ExplorerFactValue): boolean {
  const p = resolveChallengeFact(parent, sessionFact), s = resolveChallengeFact(simpler, sessionFact);
  return simpler.id === parent.id || s.product === p.product
    || (s.factor1 === p.factor1 && s.factor2 === p.factor2) || (s.factor1 === p.factor2 && s.factor2 === p.factor1)
    || expectedAnswer(simpler, s) === expectedAnswer(parent, p)
    || numbersIn(simpler.instruction).includes(expectedAnswer(parent, p))
    || (askedSlot(simpler) !== 'product' && s.factor1 === s.factor2);
}

/** What the session already shows: the break-apart open on screen takes that lever away. */
export interface ExplorerLeverContext { breakdownShown: boolean }

export function multiplicationLevers(c: MultiplicationExplorerChallenge | null, sessionFact: ExplorerFactValue, pulled: readonly string[],
  ctx: ExplorerLeverContext = { breakdownShown: false }): WorkspaceLever[] {
  if (!c || isPracticeFact(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly MultiplicationMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const simpler = smallerFact(c, sessionFact);
  if (askedSlot(c) !== 'product') {
    return [
      lever(SKIP_LINE_LEVER, 'help', ['gave_product', 'gave_known_factor', 'subtracted', 'one_jump_off', 'other_factor'],
        'The learner types the product or the factor already shown, or subtracts, or is one off.',
        'Draws a number line under the equation with equal jumps of the factor that is shown, starting at zero and running past '
          + 'the product. Only zero and the product are labelled; the learner counts the jumps it takes to reach the product.'),
      ...(simpler ? [lever(SMALLER_FACT_LEVER, 'simplify', ['other_factor', 'gave_product', 'subtracted'],
        'The learner cannot find a missing factor this big yet.',
        'Opens an easier missing factor first, with the same factor shown and a smaller product. It is not graded; the '
          + 'full item comes back after it, blank.')] : []),
    ];
  }
  const groupMisses: MultiplicationMiss[] = ['added_factors', 'one_group_short', 'one_group_over', 'off_by_one', 'other_product'];
  return [
    lever(SKIP_STRIP_LEVER, 'help', c.type === 'distributive' ? [...groupMisses, 'one_part_only'] : groupMisses,
      'The learner adds the factors, loses a group, or miscounts the total.',
      'Puts a row of boxes under the fact, one box per group, each holding the group size, with the running total under '
        + 'every box except the last, which shows a question mark. The learner adds the last group.'),
    ...(c.type === 'fluency' ? [lever(SHOW_MODEL_LEVER, 'help', groupMisses,
      'The learner cannot recall the fact and has nothing to count.',
      'Draws the fact as an array of rows and columns under the bare fact. No total is shown.')] : []),
    ...(c.type === 'distributive' && !ctx.breakdownShown ? [lever(BREAK_APART_LEVER, 'help',
      ['one_part_only', 'added_factors', 'off_by_one', 'other_product'],
      'The learner gives one part, or cannot break the fact into easier ones.',
      'Opens the break-apart under the picture: the fact split into two easier facts with each part worked out, and the '
        + 'total left as a question mark.')] : []),
    ...(simpler ? [lever(SMALLER_FACT_LEVER, 'simplify', ['other_product', 'added_factors', 'one_group_short', 'one_group_over'],
      'The learner cannot work out a fact this big yet.',
      'Opens a smaller fact of the same kind first, one factor about half as big. It is not graded; the full item comes '
        + 'back after it, blank.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Printed numbers only, never the answer. */
export function leverFacts(c: MultiplicationExplorerChallenge | null, fact: ExplorerFactValue, pulled: readonly string[]): string {
  if (!c) return '';
  const [x, y] = distributiveSplit(fact);
  const line = skipLine(c, fact);
  return [
    pulled.includes(SKIP_STRIP_LEVER) && `Under the fact: ${fact.factor1} boxes of ${fact.factor2}, with the running total under every box `
      + 'except the last, which shows ?.',
    pulled.includes(SHOW_MODEL_LEVER) && `Under the fact: an array of ${fact.factor1} rows and ${fact.factor2} columns, with no total.`,
    pulled.includes(BREAK_APART_LEVER) && `The break-apart is open: ${x} × ${fact.factor2} + ${y} × ${fact.factor2} = `
      + `${x * fact.factor2} + ${y * fact.factor2} = ?.`,
    pulled.includes(SKIP_LINE_LEVER) && `Under the equation: a number line with jumps of ${line.step} from 0 running past ${line.product}; `
      + `only 0 and ${line.product} are labelled.`,
  ].filter((s): s is string => !!s).join(' ');
}
