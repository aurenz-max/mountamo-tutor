/**
 * The in-item levers on stoichiometry-lab (`/add-support-tiers`; report qa/eval-reports/stoichiometry-lab-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what the domain checks observe; the failures behind them come from the old
 * catalog commonStruggles (grams used as if they were moles, the smaller mass picked as limiting, the ratio step
 * skipped, the excess reactant used). Every lever starts released; the tier sets the item's structure, not the levers.
 *
 * - `unit_track` (help; convert): under each chain card, the unit the chain has reached, or "does not cancel" at the
 *   first card whose bottom does not match. It never names a card to place next.
 * - `mole_map` (help; convert): the road grams -> moles -> moles -> grams with the start and goal stations marked.
 *   Stations only: no card, no factor, no number.
 * - `mole_counts` (help; limiting, yield): each jar's moles under it. Never the moles over the coefficient, never
 *   which runs out.
 * - `recipe_card` (help; limiting, yield): one run of the equation drawn as particle dots (the coefficients). Never
 *   how many runs the jars allow.
 * - `easier_item` (simplify; every mode, medium and hard items): a different item of the same mode one tier simpler
 *   (one card fewer; one trap fewer), ungraded, then the full item back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  buildConvert, buildPair, extentOf, fmt, hashOf, itemOf, molesOf, seeded, STOICH_MISSES, STOICH_TIERS, subOf,
  yieldOf, limitingOf, type Amount, type Rx, type StoichItem,
} from './stoichiometryLabWorkspace';

export const UNITS_LEVER = 'unit_track';
export const MAP_LEVER = 'mole_map';
export const MOLES_LEVER = 'mole_counts';
export const RECIPE_LEVER = 'recipe_card';
export const EASIER_LEVER = 'easier_item';

const EASIER = '~easier';
export const isPractice = (item: Pick<StoichItem, 'id'>) => item.id.endsWith(EASIER);
export const practiceParent = (id: string) => (id.endsWith(EASIER) ? id.slice(0, -EASIER.length) : null);

/** The mole-map stations the mole_map lever draws, with the start and the goal. */
export function mapStations(item: StoichItem): Array<{ label: string; mark: 'start' | 'goal' | null }> {
  if (item.mode !== 'convert') return [];
  const A = item.given.formula, B = item.target.formula;
  const goal = `${item.target.unit === 'mol' ? 'moles' : 'grams'} of ${B}`;
  const stations = B === A ? [`grams of ${A}`, `moles of ${A}`] : [`grams of ${A}`, `moles of ${A}`, `moles of ${B}`, `grams of ${B}`];
  return stations.map(label => ({ label, mark: label === `grams of ${A}` ? 'start' : label === goal ? 'goal' : null }));
}

/** The jar lines the mole_counts lever draws: moles only. */
export const moleLine = (rx: Rx, a: Amount) => `${fmt(a.grams)} g ${a.formula} = ${fmt(molesOf(rx, a))} mol ${a.formula}`;

/** One run of the equation, as the recipe card draws it. */
export function recipeLine(rx: Rx): string {
  const side = (s: 'reactant' | 'product') => rx.subs.filter(x => x.side === s).map(x => `${x.c} ${x.formula}`).join(' + ');
  return `One run of the reaction: ${side('reactant')} make ${side('product')} (in moles).`;
}

/** Leak rule, mole_counts and recipe_card: no "runs out", no count of runs the jars allow, no product amount. */
export function amountLeverLeaks(item: StoichItem, text: string): boolean {
  if (item.mode === 'convert') return false;
  if (/runs? out|limiting|left over|excess|enough for|batches|runs of/i.test(text)) return true;
  return item.mode === 'yield' && new RegExp(`(?<![\\d.])${fmt(yieldOf(item)).replace('.', '\\.')}(?![\\d.])`).test(text);
}
/** Leak rule, mole_map: stations only, no number and no card. */
export const mapLeaks = (labels: readonly string[]) => labels.some(l => /\d|per\b|÷|×/.test(l.replace(/[A-Z][a-z]?\d*/g, m => m.replace(/\d/g, ''))));

/** The simpler item: the same mode one tier lower, on other amounts. Null on an easy item or a practice item. */
export function easierItem(item: StoichItem, items: readonly StoichItem[] = []): StoichItem | null {
  if (isPractice(item) || item.tier === 'easy') return null;
  const lower = STOICH_TIERS[STOICH_TIERS.indexOf(item.tier) - 1];
  const rand = seeded(hashOf(item.id));
  const avoid = new Set<string>();
  for (const i of [...items, item]) {
    if (i.mode === 'convert') { avoid.add(`given:${i.given.formula}:${i.given.grams}`); }
    else avoid.add(`${i.a.grams}+${i.b.grams}`);
  }
  const c = item.mode === 'convert' ? buildConvert(item.rx, lower, rand, avoid) : buildPair(item.rx, item.mode, lower, rand, avoid);
  if (!c) return null;
  const built = itemOf(item.rx, { ...c, id: `${item.id}${EASIER}` }, 0);
  if (!built || built.tier === item.tier) return null;
  // Never the learner's own item: other amounts, and for limiting not the same answer pattern.
  if (built.mode !== 'convert' && item.mode !== 'convert' && built.a.grams === item.a.grams && built.b.grams === item.b.grams) return null;
  return built;
}

/** The levers on the current session item. A practice item has none. */
export function stoichLevers(item: StoichItem | undefined, pulled: readonly string[], items: readonly StoichItem[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const all = STOICH_MISSES[item.mode];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (item.mode === 'convert') {
    out.push(lever(UNITS_LEVER, 'help', all,
      'The learner places a card upside down, uses the wrong substance\'s card, or cannot tell whether the chain is finished.',
      'Shows, under each card in the chain, the unit the chain has reached after it, or "does not cancel" at the first card whose bottom does not match. It names no card to place next.'));
    out.push(lever(MAP_LEVER, 'help', ['skipped_ratio', 'stopped_short', 'extra_step', 'out_of_order', 'wrong_card'],
      'The learner does not know the route: skips the mole ratio, stops early, or goes past the goal.',
      'Draws the mole map above the chain (grams, moles, moles, grams) with the start and the goal stations marked. It shows no card and no number.'));
  } else {
    const moleMisses = item.mode === 'limiting' ? ['smaller_mass', 'other_reactant', 'said_both', 'missed_both'] : ['from_excess', 'mass_sum', 'other_amount'];
    const recipeMisses = item.mode === 'limiting' ? ['fewer_moles', 'said_both', 'missed_both', 'other_reactant'] : ['skipped_ratio', 'upside_down_ratio', 'from_excess', 'other_amount'];
    out.push(lever(MOLES_LEVER, 'help', moleMisses,
      'The learner compares the masses instead of the amounts of particles.',
      'Shows under each jar how many moles it holds. It does not divide by the coefficients or say which runs out.'));
    out.push(lever(RECIPE_LEVER, 'help', recipeMisses,
      'The learner compares the moles without the equation\'s coefficients, or skips the mole ratio to the product.',
      'Draws one run of the reaction as particle dots, one dot per mole of each coefficient. It does not say how many runs the jars allow.'));
  }
  if (easierItem(item, items)) {
    out.push(lever(EASIER_LEVER, 'simplify', all, 'The learner is stuck on the whole item even with the help on screen.',
      item.mode === 'convert'
        ? 'Opens a different chain first, one card shorter. It is not graded; this item comes back after it.'
        : 'Opens a different mix first, with one trap fewer. It is not graded; this item comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: StoichItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (item.mode === 'convert') {
    if (pulled.includes(UNITS_LEVER)) parts.push('Under each card in the chain, the unit the chain has reached after it, or "does not cancel".');
    if (pulled.includes(MAP_LEVER)) {
      const st = mapStations(item);
      parts.push(`Above the chain, the mole map: ${st.map(s => s.label + (s.mark ? ` (${s.mark})` : '')).join(' → ')}.`);
    }
  } else {
    if (pulled.includes(MOLES_LEVER)) parts.push(`Under the jars: ${moleLine(item.rx, item.a)}; ${moleLine(item.rx, item.b)}.`);
    if (pulled.includes(RECIPE_LEVER)) parts.push(`A recipe card: ${recipeLine(item.rx)}`);
  }
  return parts.join(' ');
}

/** The answer line shown after credit (or the scripted reveal): the worked result. */
export function revealLine(item: StoichItem): string {
  const rx = item.rx;
  if (item.mode === 'convert') return '';
  const lim = limitingOf(rx, item.a, item.b);
  const per = (a: Amount) => `${fmt(a.grams)} g ${a.formula} is ${fmt(molesOf(rx, a))} mol, enough for ${fmt(extentOf(rx, a))} run${extentOf(rx, a) === 1 ? '' : 's'} of the recipe`;
  const head = `${per(item.a)}; ${per(item.b)}. `;
  const which = lim === 'Both together' ? 'Both run out together.' : `${lim} runs out first.`;
  if (item.mode === 'limiting') return head + which;
  const p = subOf(rx, item.product)!;
  return `${head}${which} ${fmt(Math.min(extentOf(rx, item.a), extentOf(rx, item.b)) * p.c)} mol ${p.formula} forms, which is ${fmt(yieldOf(item))} g.`;
}
