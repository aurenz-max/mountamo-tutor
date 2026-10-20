/**
 * The in-item levers on stoichiometry-lab, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/stoichiometry-lab-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what the domain checks observe; the failures behind them come from the old
 * catalog commonStruggles (grams used as if they were moles, the smaller mass picked as limiting, the ratio step
 * skipped, the excess reactant used). Every lever starts released; the tier sets the item's structure, not the levers,
 * and no lever shows a different item solved, so there is no model lever and no `support`.
 *
 * - `unit_track` (custom, shown; convert): under each chain card, the unit the chain has reached, or "does not cancel" at the
 *   first card whose bottom does not match. It never names a card to place next.
 * - `mole_map` (clue, shown; convert): the road grams -> moles -> moles -> grams with the start and goal stations marked.
 *   Stations only: no card, no factor, no number.
 * - `mole_counts` (clue, shown; limiting, yield): each jar's moles under it. Never the moles over the coefficient, never
 *   which runs out.
 * - `recipe_card` (clue, shown; limiting, yield): one run of the equation drawn as particle dots (the coefficients). Never
 *   how many runs the jars allow.
 * - `easier_item` (easier; every mode, medium and hard items): a different item of the same mode one tier simpler
 *   (one card fewer; one trap fewer), ungraded, then the full item back.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { STOICH_MISSES } from './stoichiometryLab.card';
import {
  BOTH, buildConvert, buildPair, cardLabel, convertKey, extentOf, fmt, hashOf, itemOf, molesOf, seeded, STOICH_TIERS, subOf,
  yieldOf, limitingOf, type Amount, type Rx, type StoichItem, type StoichMode,
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

/** What the levers read beside the item: the session's items (the easier item avoids them). */
export interface StoichLeverContext { items: readonly StoichItem[] }

/** The answer as a reply would say it, which a clue's words must never name. Not a formula alone: every jar names both. */
function answersOf(item: StoichItem): string[] {
  if (item.mode === 'convert') return convertKey(item).map(id => cardLabel(item, id));
  if (item.mode === 'yield') return [fmt(yieldOf(item))];
  const key = limitingOf(item.rx, item.a, item.b);
  if (key === BOTH) return ['both run out together', 'run out at the same time'];
  const name = subOf(item.rx, key)?.name ?? key;
  return [`${key} runs out`, `${name} runs out`, `${key} is the limiting`, `${name} is the limiting`];
}

const MOLES = { id: MOLES_LEVER, type: 'clue' as const, carrier: 'shown' as const,
  when: 'The learner compares the masses instead of the amounts of particles.',
  does: 'Shows under each jar how many moles it holds. It does not divide by the coefficients or say which runs out.',
  fact: (_c: unknown, item: StoichItem) => (item.mode === 'convert' ? ''
    : `Under the jars: ${moleLine(item.rx, item.a)}; ${moleLine(item.rx, item.b)}.`) };
const RECIPE = { id: RECIPE_LEVER, type: 'clue' as const, carrier: 'shown' as const,
  when: "The learner compares the moles without the equation's coefficients, or skips the mole ratio to the product.",
  does: 'Draws one run of the reaction as particle dots, one dot per mole of each coefficient. It does not say how many runs the jars allow.',
  fact: (_c: unknown, item: StoichItem) => `A recipe card: ${recipeLine(item.rx)}` };

export const STOICH_LEVERS = leverSet<StoichItem, StoichLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => STOICH_MISSES[mode as StoichMode] ?? [],
  answersOf: item => answersOf(item),
  specs: [
    { id: UNITS_LEVER, type: 'custom', carrier: 'shown', modes: ['convert'], answers: 'all',
      why: "It reads back the unit the learner's own chain has reached, card by card, and changes as the chain changes; no "
        + "stock type reads back the learner's own work.",
      when: "The learner places a card upside down, uses the wrong substance's card, or cannot tell whether the chain is finished.",
      does: 'Shows, under each card in the chain, the unit the chain has reached after it, or "does not cancel" at the first '
        + 'card whose bottom does not match. It names no card to place next.',
      fact: 'Under each card in the chain, the unit the chain has reached after it, or "does not cancel".' },
    { id: MAP_LEVER, type: 'clue', carrier: 'shown', modes: ['convert'],
      answers: ['skipped_ratio', 'stopped_short', 'extra_step', 'out_of_order', 'wrong_card'],
      when: 'The learner does not know the route: skips the mole ratio, stops early, or goes past the goal.',
      does: 'Draws the mole map above the chain (grams, moles, moles, grams) with the start and the goal stations marked. It shows no card and no number.',
      fact: (_c, item) => `Above the chain, the mole map: ${mapStations(item).map(st => st.label + (st.mark ? ` (${st.mark})` : '')).join(' → ')}.` },
    { ...MOLES, modes: ['limiting'], answers: ['smaller_mass', 'other_reactant', 'said_both', 'missed_both'] },
    { ...MOLES, modes: ['yield'], answers: ['from_excess', 'mass_sum', 'other_amount'] },
    { ...RECIPE, modes: ['limiting'], answers: ['fewer_moles', 'said_both', 'missed_both', 'other_reactant'] },
    { ...RECIPE, modes: ['yield'], answers: ['skipped_ratio', 'upside_down_ratio', 'from_excess', 'other_amount'] },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner is stuck on the whole item even with the help on screen.',
      does: item => (item.mode === 'convert'
        ? 'Opens a different chain first, one card shorter. It is not graded; this item comes back after it.'
        : 'Opens a different mix first, with one trap fewer. It is not graded; this item comes back after it.'),
      content: (item, ctx) => easierItem(item, ctx.items) },
  ],
});

/** The answer line shown after credit (or the scripted reveal): the worked result. */
export function revealLine(item: StoichItem): string {
  const rx = item.rx;
  if (item.mode === 'convert') return '';
  const lim = limitingOf(rx, item.a, item.b);
  const per = (a: Amount) => `${fmt(a.grams)} g ${a.formula} is ${fmt(molesOf(rx, a))} mol, enough for ${fmt(extentOf(rx, a))} run${extentOf(rx, a) === 1 ? '' : 's'} of the recipe`;
  const head = `${per(item.a)}; ${per(item.b)}. `;
  const which = lim === BOTH ? 'Both run out together.' : `${lim} runs out first.`;
  if (item.mode === 'limiting') return head + which;
  const p = subOf(rx, item.product)!;
  return `${head}${which} ${fmt(Math.min(extentOf(rx, item.a), extentOf(rx, item.b)) * p.c)} mol ${p.formula} forms, which is ${fmt(yieldOf(item))} g.`;
}
