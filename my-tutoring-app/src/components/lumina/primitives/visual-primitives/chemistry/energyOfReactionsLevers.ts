/**
 * The in-item levers on energy-of-reactions, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/energy-of-reactions-levers-2026-10-15.md). No real-learner evidence: the misses are what `energyMiss`
 * observes; the failures behind them come from the documented struggles (exothermic and endothermic confused, diagram
 * direction misread, activation energy confused with the energy change, bond-energy arithmetic). Every lever starts
 * released; no lever comes from the tier, so there is no model lever and no `support`.
 *
 * - `start_mark` (marks; classify): after the run, a marker stays at the starting reading on the thermometer, beside the
 *   end reading. Offered only once the reaction has run.
 * - `heat_flow_card` (meaning; classify): a card with what a warmer or colder beaker means about energy. The same card on
 *   every item; it marks no row.
 * - `level_values` (marks; diagram): each drawn level gets its kJ value written beside it. No arrow, no difference.
 * - `start_line` (marks; diagram except direction): a dashed line carries the Reactants level across the diagram, so a
 *   climb or drop is measured from it. No arrow, no number.
 * - `row_totals` (marks; bond_energy): each row shows count × energy per bond = its subtotal. No column totals.
 * - `in_out_totals` (clue; bond_energy): the two column totals, named energy in and energy out, and the rule
 *   ΔH = energy in − energy out. Never the difference, its sign or the words exothermic and endothermic.
 * - `fewer_choices` (easier; diagram except direction): a different diagram of the same question with three choices,
 *   ungraded, then the full item back.
 * - `simpler_reaction` (easier; bond_energy): a reaction with fewer bond rows, ungraded, then the full item back.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import { ENERGY_MISSES } from './energyOfReactions.card';
import {
  BOND_ENERGY, BOND_REACTIONS, bondItem, bondSize, diagramItem, energyIn, energyKey, energyMode, energyOut, keyChoice,
  PRACTICE_DIAGRAM, type BondRow, type EnergyItem, type EnergyMode,
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

// ── The lever set ────────────────────────────────────────────────────────────────────────

/** What the levers read beside the item: whether the classify reaction has run. */
export interface EnergyLeverContext { ran: boolean }

export const ENERGY_LEVERS = leverSet<EnergyItem, EnergyLeverContext>({
  modeOf: energyMode,
  missesOf: mode => ENERGY_MISSES[mode as EnergyMode] ?? [],
  // No card names the key or a way of saying it.
  answersOf: item => keyAnswers(energyKey(item)),
  specs: [
    { id: MARK_LEVER, type: 'marks', modes: ['classify'], answers: 'all',
      when: 'The learner cannot tell whether the reading went up or down.',
      does: 'Leaves a marker at the starting reading on the thermometer, beside the reading now, so the change is easy to see.',
      // The marker shows the start beside the reading after the run, so there is nothing to mark before it.
      offer: (_item, ctx) => ctx.ran,
      fact: (_c: unknown, item: EnergyItem) => (item.mode === 'classify'
        ? `A marker on the thermometer shows the starting reading, ${item.reaction.start} °C, beside the reading now, ${item.reaction.end} °C.` : '') },
    { id: FLOW_LEVER, type: 'meaning', carrier: 'shown', modes: ['classify'], answers: 'all',
      when: 'The learner thinks a colder beaker means the reaction gives out cold, or mixes up the two words.',
      does: 'Shows a card under the beaker: the thermometer measures the water; warmer water means energy moved out of the '
        + 'reaction into the water; colder water means energy moved from the water into the reaction. It marks no choice. '
        + 'Never say which line of it matches this beaker; ask the learner to find it.',
      fact: `Under the beaker, a card: ${HEAT_FLOW_CARD.join(' ')}` },
    { id: VALUES_LEVER, type: 'marks', modes: ['diagram'], answers: 'all',
      when: 'The learner cannot read the levels off the grid.',
      does: 'Writes each level\'s value in kJ beside its line on the diagram. It draws no arrow and no difference.',
      fact: (_c: unknown, item: EnergyItem) => {
        if (item.mode !== 'diagram') return '';
        const l = item.levels;
        return `Values are written beside the lines: Reactants ${l.reactants} kJ, top of the hill ${l.peak} kJ, Products ${l.products} kJ`
          + (l.catalyst !== undefined ? `, top of the catalyst path ${l.catalyst} kJ.` : '.');
      } },
    { id: LINE_LEVER, type: 'marks', modes: ['diagram'], answers: 'all',
      when: 'The learner measures from zero or from the products instead of from the reactants.',
      does: 'Carries the Reactants level across the diagram as a dashed line, so a climb or a drop can be measured from it. No arrow, no number.',
      // A direction item asks for no measurement.
      content: item => (item.mode === 'diagram' && item.kind !== 'direction' ? true : null),
      fact: 'A dashed line carries the Reactants level across the whole diagram.' },
    { id: FEWER_LEVER, type: 'easier', modes: ['diagram'], answers: 'all',
      when: 'The learner cannot choose among four values.',
      does: 'Opens a different practice diagram with the same question and only three values to choose from. It is not '
        + 'graded; this diagram comes back after it.',
      content: item => simplerItem(item) },
    { id: ROWS_LEVER, type: 'marks', modes: ['bond_energy'], answers: 'all',
      when: 'The learner uses each bond once and forgets how many there are.',
      does: 'Shows each row\'s count times its energy per bond and the row\'s subtotal. No column totals.',
      fact: (_c: unknown, item: EnergyItem) => (item.mode === 'bond_energy'
        ? `Each row shows its subtotal: broken ${item.reaction.broken.map(rowLine).join(', ')}; formed ${item.reaction.formed.map(rowLine).join(', ')}.` : '') },
    { id: TOTALS_LEVER, type: 'clue', carrier: 'shown', modes: ['bond_energy'], answers: 'all',
      when: 'The learner subtracts the wrong way round or adds the two totals.',
      does: 'Shows the two column totals, energy in to break bonds and energy out from forming bonds, and the rule ΔH = '
        + 'energy in − energy out. It does not do the subtraction. Never say which total is larger, which sign the answer '
        + 'has, or which number to take from which; ask the learner to use what the card says.',
      content: item => { const lines = totalsLines(item); return lines.length && !lines.some(l => totalsLeak(item, l)) ? lines : null; },
      fact: (lines: string[]) => `Under the table: ${lines.join('. ')}.` },
    { id: SIMPLER_LEVER, type: 'easier', modes: ['bond_energy'], answers: 'all',
      when: 'The table is too big to keep track of.',
      does: 'Opens a smaller reaction with fewer bonds first. It is not graded; this reaction comes back after it.',
      content: item => simplerItem(item) },
  ],
});
