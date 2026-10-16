/**
 * The in-item levers on energy-of-reactions (`/add-support-tiers`; report qa/eval-reports/energy-of-reactions-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `energyMiss` observes; the failures behind them come from the catalog's
 * old commonStruggles (exothermic and endothermic confused, diagram direction misread, activation energy confused with
 * the energy change, bond-energy arithmetic). Every lever starts released; no lever comes from the tier.
 *
 * - `start_mark` (help; classify): after the run, a marker stays at the starting reading on the thermometer, beside the
 *   end reading. Refused before the run.
 * - `heat_flow_card` (help; classify): a card with what a warmer or colder beaker means about energy. The same card on
 *   every item; it marks no row.
 * - `level_values` (help; diagram): each drawn level gets its kJ value written beside it. No arrow, no difference.
 * - `start_line` (help; diagram except direction): a dashed line carries the Reactants level across the diagram, so a
 *   climb or drop is measured from it. No arrow, no number.
 * - `row_totals` (help; bond_energy): each row shows count × energy per bond = its subtotal. No column totals.
 * - `in_out_totals` (help; bond_energy): the two column totals, named energy in and energy out, and the rule
 *   ΔH = energy in − energy out. Never the difference, its sign or the words exothermic and endothermic.
 * - `fewer_choices` (simplify; diagram except direction): a different diagram of the same question with three choices,
 *   ungraded, then the full item back.
 * - `simpler_reaction` (simplify; bond_energy): a reaction with fewer bond rows, ungraded, then the full item back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  BOND_ENERGY, BOND_REACTIONS, bondItem, bondSize, diagramItem, energyIn, energyOut, ENERGY_MISSES, keyChoice, PRACTICE_DIAGRAM,
  type BondRow, type EnergyItem,
} from './energyOfReactionsWorkspace';

export const MARK_LEVER = 'start_mark';
export const FLOW_LEVER = 'heat_flow_card';
export const VALUES_LEVER = 'level_values';
export const LINE_LEVER = 'start_line';
export const ROWS_LEVER = 'row_totals';
export const TOTALS_LEVER = 'in_out_totals';
export const FEWER_LEVER = 'fewer_choices';
export const SIMPLER_LEVER = 'simpler_reaction';

export const HEAT_FLOW_CARD = [
  'The thermometer measures the water around the reaction.',
  'Water gets warmer: energy moved out of the reaction into the water.',
  'Water gets colder: energy moved out of the water into the reaction.',
] as const;

export const rowLine = (b: BondRow) => `${b.count} × ${BOND_ENERGY[b.bond]} = ${b.count * BOND_ENERGY[b.bond]} kJ`;
/** The two totals and the rule. Never the difference. */
export function totalsLines(item: EnergyItem): string[] {
  if (item.mode !== 'bond_energy') return [];
  return [`Energy in, to break bonds: ${energyIn(item.reaction)} kJ`, `Energy out, from forming bonds: ${energyOut(item.reaction)} kJ`,
    'ΔH = energy in − energy out'];
}
/** Leak rule, in_out_totals and row_totals: no difference, no sign of the answer, no kind word. */
export const totalsLeak = (item: EnergyItem, line: string) =>
  /exo|endo|releas|absorb/i.test(line) || (item.mode === 'bond_energy' && new RegExp(`\\b${Math.abs(energyIn(item.reaction) - energyOut(item.reaction))}\\b`).test(line));

const PRACTICE = '~practice';
export const isPractice = (item: Pick<EnergyItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** Three choices: the key, the one nearest it, and the farthest, in their order on screen. */
const threeChoices = (choices: readonly string[], key: string) => {
  const at = choices.indexOf(key), next = at + 1 < choices.length ? at + 1 : at - 1;
  const far = at < choices.length / 2 ? choices.length - 1 : 0;
  return choices.filter((_, i) => i === at || i === next || i === far);
};

/** The simpler item: same mode and question, built by code on something other than the learner's item. */
export function simplerItem(item: EnergyItem): EnergyItem | null {
  if (isPractice(item)) return null;
  if (item.mode === 'diagram') {
    if (item.kind === 'direction') return null;
    const full = diagramItem(item.kind, PRACTICE_DIAGRAM[item.template], 'Practice reaction', PRACTICE);
    return { ...full, id: `${item.id}${PRACTICE}`, choices: threeChoices(full.choices, keyChoice(full)) };
  }
  if (item.mode === 'bond_energy') {
    const [rows, bonds] = bondSize(item.reaction);
    const smaller = BOND_REACTIONS.filter(r => r.id !== item.reaction.id && (bondSize(r)[0] < rows || (bondSize(r)[0] === rows && bondSize(r)[1] < bonds)))
      .sort((a, b) => bondSize(a)[0] - bondSize(b)[0] || bondSize(a)[1] - bondSize(b)[1]);
    // The nearest smaller one, not always the smallest.
    const pick = smaller.at(-1);
    return pick ? { ...bondItem(pick), id: `${item.id}${PRACTICE}` } : null;
  }
  return null;
}

/** The levers on the current session item. A practice item has none. */
export function energyLevers(item: EnergyItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const answers = ENERGY_MISSES[item.mode];
  const lever = (id: string, kind: WorkspaceLever['kind'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (item.mode === 'classify') {
    out.push(lever(MARK_LEVER, 'help', 'The learner cannot tell whether the reading went up or down.',
      'Leaves a marker at the starting reading on the thermometer, beside the reading now, so the change is easy to see. Only after the reaction has run.'));
    out.push(lever(FLOW_LEVER, 'help', 'The learner thinks a colder beaker means the reaction gives out cold, or mixes up the two words.',
      'Shows a card under the beaker: the thermometer measures the water; warmer water means energy moved out of the reaction into the water; colder water means energy moved from the water into the reaction. It marks no choice.'));
  }
  if (item.mode === 'diagram') {
    out.push(lever(VALUES_LEVER, 'help', 'The learner cannot read the levels off the grid.',
      'Writes each level\'s value in kJ beside its line on the diagram. It draws no arrow and no difference.'));
    if (item.kind !== 'direction') {
      out.push(lever(LINE_LEVER, 'help', 'The learner measures from zero or from the products instead of from the reactants.',
        'Carries the Reactants level across the diagram as a dashed line, so a climb or a drop can be measured from it. No arrow, no number.'));
      out.push(lever(FEWER_LEVER, 'simplify', 'The learner cannot choose among four values.',
        'Opens a different practice diagram with the same question and only three values to choose from. It is not graded; this diagram comes back after it.'));
    }
  }
  if (item.mode === 'bond_energy') {
    out.push(lever(ROWS_LEVER, 'help', 'The learner uses each bond once and forgets how many there are.',
      'Shows each row\'s count times its energy per bond and the row\'s subtotal. No column totals.'));
    out.push(lever(TOTALS_LEVER, 'help', 'The learner subtracts the wrong way round or adds the two totals.',
      'Shows the two column totals, energy in to break bonds and energy out from forming bonds, and the rule ΔH = energy in − energy out. It does not do the subtraction.'));
    if (simplerItem(item)) {
      out.push(lever(SIMPLER_LEVER, 'simplify', 'The table is too big to keep track of.',
        'Opens a smaller reaction with fewer bonds first. It is not graded; this reaction comes back after it.'));
    }
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: EnergyItem | undefined, pulled: readonly string[], ran: boolean): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (item.mode === 'classify') {
    if (pulled.includes(MARK_LEVER) && ran) parts.push(`A marker on the thermometer shows the starting reading, ${item.reaction.start} °C, beside the reading now, ${item.reaction.end} °C.`);
    if (pulled.includes(FLOW_LEVER)) parts.push(`Under the beaker, a card: ${HEAT_FLOW_CARD.join(' ')}`);
  }
  if (item.mode === 'diagram') {
    const l = item.levels;
    if (pulled.includes(VALUES_LEVER)) parts.push(`Values are written beside the lines: Reactants ${l.reactants} kJ, top of the hill ${l.peak} kJ, Products ${l.products} kJ`
      + (l.catalyst !== undefined ? `, top of the catalyst path ${l.catalyst} kJ.` : '.'));
    if (pulled.includes(LINE_LEVER)) parts.push('A dashed line carries the Reactants level across the whole diagram.');
  }
  if (item.mode === 'bond_energy') {
    if (pulled.includes(ROWS_LEVER)) parts.push(`Each row shows its subtotal: broken ${item.reaction.broken.map(rowLine).join(', ')}; formed ${item.reaction.formed.map(rowLine).join(', ')}.`);
    if (pulled.includes(TOTALS_LEVER)) parts.push(`Under the table: ${totalsLines(item).join('. ')}.`);
  }
  return parts.join(' ');
}
