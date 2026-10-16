/**
 * The in-item levers on equation-balancer (`/add-support-tiers`; report qa/eval-reports/equation-balancer-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `countMiss` / `balanceMiss` observe; the failures behind them come from
 * the old catalog's commonStruggles (subscripts and coefficients confused, fixing one element unbalances another, numbers
 * that are balanced but not the smallest). Every lever starts released.
 *
 * - `molecule_view` (help; every mode): each formula drawn as its molecules, one cluster per copy, each atom a lettered
 *   ball. It follows the printed numbers (simple) or the learner's numbers (balance). No totals, no match marks.
 * - `atom_tally` (help; guided, complex): a table of each element's atoms on each side for the learner's current
 *   numbers. It never marks which elements match and never shows a target.
 * - `simpler_equation` (simplify; every mode): a different bank equation of the same mode, one structural step smaller,
 *   ungraded; then the full item comes back. Never the learner's equation or one in the session.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  BALANCER_MISSES, balanceItem, countKey, balanceModeOf, balanceRank, compounds, counts, countItem, countRank, elementsOf, EQUATION_BANK,
  equationText, toEquation, type BalancerItem, type CountItem,
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

/** The levers on the current session item. A practice item has none. */
export function balancerLevers(item: BalancerItem | undefined, pulled: readonly string[], items: readonly BalancerItem[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const all = BALANCER_MISSES[item.mode];
  const out: WorkspaceLever[] = [];
  if (item.mode === 'simple') {
    out.push(lever(MOLECULES_LEVER, 'help', all, 'The learner reads the formula wrong: leaves out the number in front or the small number after a symbol.',
      'Draws each formula as its molecules: one cluster for each copy the number in front asks for, each atom a ball with its letter. '
      + 'It prints no total; the learner counts.'));
  } else {
    out.push(lever(MOLECULES_LEVER, 'help', all.filter(m => m !== 'not_lowest'), 'The learner cannot see what the numbers do to the atoms, or fixes one element and breaks another.',
      'Draws each formula as its molecules for the numbers the learner has set: one cluster per copy, each atom a lettered ball. '
      + 'It prints no total and marks no match.'));
    out.push(lever(TALLY_LEVER, 'help', all, 'The learner loses count of the atoms, or cannot tell which element is still off.',
      'Shows a table of how many atoms of each element are on each side for the numbers now set; it changes as the learner '
      + 'changes a number. It marks no match and shows no target.'));
  }
  if (simplerItem(item, items)) {
    out.push(lever(SIMPLER_LEVER, 'simplify', all, 'The learner cannot manage this many formulas or atoms at once.',
      'Opens a smaller equation of the same kind first. It is not graded; this equation comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: BalancerItem | undefined, pulled: readonly string[], coefficients: number[]): string {
  if (!item || isPractice(item)) return '';
  const ks = item.mode === 'simple' ? item.coefficients : coefficients;
  const parts: string[] = [];
  if (pulled.includes(MOLECULES_LEVER)) {
    parts.push(`Under each formula its molecules are drawn as lettered balls: ${compounds(item.equation).map((c, i) => `${ks[i]} of ${c.formula}`).join(', ')}.`);
  }
  if (pulled.includes(TALLY_LEVER) && item.mode !== 'simple') parts.push(`An atom tally for the numbers now set: ${tallyLine(item, coefficients)}.`);
  return parts.join(' ');
}
