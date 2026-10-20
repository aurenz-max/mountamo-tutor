/**
 * The in-item levers on equation-balancer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/equation-balancer-levers-2026-10-15.md). No real-learner evidence: the misses are what `countMiss` /
 * `balanceMiss` observe; the failures behind them come from the old catalog's commonStruggles (subscripts and
 * coefficients confused, fixing one element unbalances another, numbers that are balanced but not the smallest). Every
 * lever starts released; no lever comes from the tier, so there is no model lever and no `support`.
 *
 * - `molecule_view` (layout, shown; every mode): each formula drawn as its molecules, one cluster per copy, each atom a
 *   lettered ball. It follows the printed numbers (simple) or the learner's numbers (balance). No totals, no match marks.
 * - `atom_tally` (custom, shown; guided, complex): a table of each element's atoms on each side for the learner's
 *   current numbers. It never marks which elements match and never shows a target.
 * - `simpler_equation` (easier; every mode): a different bank equation of the same mode, one structural step smaller,
 *   ungraded; then the full item comes back. Never the learner's equation or one in the session.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { BALANCER_MISSES } from './equationBalancer.card';
import {
  balanceItem, countKey, balanceModeOf, balanceRank, compounds, counts, countItem, countRank, elementsOf, EQUATION_BANK,
  equationText, toEquation, type BalancerItem, type BalancerMode, type CountItem,
} from './equationBalancerWorkspace';

export const MOLECULES_LEVER = 'molecule_view';
export const TALLY_LEVER = 'atom_tally';
export const SIMPLER_LEVER = 'simpler_equation';

const SIMPLER = '~simpler';
export const isPractice = (item: Pick<BalancerItem, 'id'>) => item.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => (id.endsWith(SIMPLER) ? id.slice(0, -SIMPLER.length) : null);

const bankEquations = () => EQUATION_BANK.map(b => toEquation({ id: b.id })!).filter(Boolean);

/**
 * The simpler item: the same mode, the largest structure below the current one, on a bank equation that is neither the
 * learner's nor in the session. Null when nothing smaller exists.
 */
export function simplerItem(item: BalancerItem, items: readonly BalancerItem[] = []): BalancerItem | null {
  if (isPractice(item)) return null;
  const used = new Set([item.equation.id, ...items.map(i => i.equation.id)]);
  const sigOf = (i: BalancerItem) => equationText(i.equation);
  const usedSigs = new Set([sigOf(item), ...items.map(sigOf)]);
  const fresh = bankEquations().filter(e => !used.has(e.id) && !usedSigs.has(equationText(e)));
  if (item.mode === 'simple') {
    const here = countRank(item), hereKey = Number(countKey(item));
    const pool = fresh.map(e => countItem(e, SIMPLER, 3)).filter((c): c is CountItem => !!c)
      .filter(c => countRank(c) < here || (countRank(c) === here && Number(countKey(c)) < hereKey))
      .sort((a, b) => countRank(b) - countRank(a) || Number(countKey(b)) - Number(countKey(a)));
    return pool[0] ? { ...pool[0], id: `${item.id}${SIMPLER}` } : null;
  }
  const here = balanceRank(item.equation);
  const pool = fresh.filter(e => balanceModeOf(e) === item.mode && balanceRank(e) < here)
    .sort((a, b) => balanceRank(b) - balanceRank(a));
  const built = pool[0] ? balanceItem(pool[0]) : null;
  return built ? { ...built, id: `${item.id}${SIMPLER}` } : null;
}

/** The tally rows the atom_tally lever draws for the learner's numbers. Never a match mark, never a target. */
export function tallyRows(item: BalancerItem, coefficients: number[]): Array<{ element: string; left: number; right: number }> {
  const { left, right } = counts(item.equation, coefficients);
  return elementsOf(item.equation).map(e => ({ element: e, left: left[e] ?? 0, right: right[e] ?? 0 }));
}
export const tallyLine = (item: BalancerItem, coefficients: number[]) =>
  tallyRows(item, coefficients).map(r => `${r.element}: ${r.left} on the left, ${r.right} on the right`).join('; ');
/** Leak rule, atom_tally: no match mark or verdict word. */
export const tallyLeak = (text: string) => /✓|✗|\bmatch|\bbalanced\b|\bequal|\bsame\b|\bcorrect\b|\bright answer/i.test(text);

/** What the levers read beside the item: the session's items, and the numbers now on screen. */
export interface BalancerLeverContext {
  items: readonly BalancerItem[];
  /** guided, complex: the learner's numbers, all reactants then all products. Unused on a count item. */
  coefficients: number[];
}

/** The molecule_view fact: the molecules drawn under each formula for the numbers shown. Never a total. */
const moleculesFact = (item: BalancerItem, ks: number[]) =>
  `Under each formula its molecules are drawn as lettered balls: ${compounds(item.equation).map((c, i) => `${ks[i] ?? 1} of ${c.formula}`).join(', ')}.`;

const MATCH_RULE = 'Never say which rows or sides match; ask the learner to compare them.';

/** molecule_view on a balance item: it follows the learner's numbers. Every miss but not_lowest (the molecules show
 *  nothing about a common factor). */
const BALANCE_MOLECULES = { id: MOLECULES_LEVER, type: 'layout' as const,
  when: 'The learner cannot see what the numbers do to the atoms, or fixes one element and breaks another.',
  does: 'Draws each formula as its molecules for the numbers the learner has set: one cluster per copy, each atom a '
    + `lettered ball. It prints no total and marks no match. ${MATCH_RULE}`,
  fact: (_c: unknown, item: BalancerItem, ctx: BalancerLeverContext) => moleculesFact(item, ctx.coefficients) };

export const BALANCER_LEVERS = leverSet<BalancerItem, BalancerLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => BALANCER_MISSES[mode as BalancerMode] ?? [],
  specs: [
    { id: MOLECULES_LEVER, type: 'layout', modes: ['simple'], answers: 'all',
      when: 'The learner reads the formula wrong: leaves out the number in front or the small number after a symbol.',
      does: 'Draws each formula as its molecules: one cluster for each copy the number in front asks for, each atom a ball '
        + 'with its letter. It prints no total; the learner counts.',
      fact: (_c, item) => moleculesFact(item, item.mode === 'simple' ? item.coefficients : []) },
    { ...BALANCE_MOLECULES, modes: ['guided'], answers: ['one_element_off', 'several_off'] },
    { ...BALANCE_MOLECULES, modes: ['complex'], answers: ['shared_element_off', 'one_element_off', 'several_off'] },
    { id: TALLY_LEVER, type: 'custom', carrier: 'shown', modes: ['guided', 'complex'], answers: 'all',
      why: 'It counts the atoms for the numbers the learner has set and changes as they change; no stock type reads back '
        + "the learner's own work.",
      when: 'The learner loses count of the atoms, or cannot tell which element is still off.',
      does: 'Shows a table of how many atoms of each element are on each side for the numbers now set; it changes as the '
        + `learner changes a number. It marks no match and shows no target. ${MATCH_RULE}`,
      fact: (_c, item, ctx) => `An atom tally for the numbers now set: ${tallyLine(item, ctx.coefficients)}.` },
    { id: SIMPLER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot manage this many formulas or atoms at once.',
      does: 'Opens a smaller equation of the same kind first. It is not graded; this equation comes back after it.',
      content: (item, ctx) => simplerItem(item, ctx.items) },
  ],
});

