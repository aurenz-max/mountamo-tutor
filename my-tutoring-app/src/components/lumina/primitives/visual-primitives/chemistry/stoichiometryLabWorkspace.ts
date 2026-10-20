/**
 * stoichiometry-lab's items, keys, misses and scene: the pure half of its boss (`stoichiometryLab.boss.ts`, a spoken
 * preset with a conversion-chain board and two SAY_OR_SHOW modes).
 *
 * Every item is built and keyed by code from one balanced reaction (a code library; the generator only picks which
 * reaction fits the topic and writes the title). Molar masses come from the formulas, never from the model.
 * - convert: build the chain of conversion-factor cards that turns a given mass of one substance into the asked
 *   amount. Key: the card sequence (grams -> moles -> mole ratio -> moles or grams). Tapped only.
 * - limiting: two reactant masses; say which runs out first, or that both run out together. Key: the smaller
 *   moles / coefficient. Tapped or said.
 * - yield: two reactant masses; how many grams of a product can form. Key: the smaller moles / coefficient times the
 *   product's coefficient and molar mass, a whole number. Typed or said.
 *
 * Difficulty is structural (config.difficulty): convert adds steps (1, 2, 3 cards); limiting and yield add traps (the
 * limiting reactant has the larger mass; then it has more moles too, so only dividing by the coefficient finds it;
 * yield also asks for a product whose coefficient differs from the limiting reactant's).
 *
 * Pure: the component, the boss, the levers, the generator and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { STOICH_MISSES } from './stoichiometryLab.card';
import type { StoichChallenge, StoichiometryLabData, StoichReaction } from './StoichiometryLab';

export type StoichMode = 'convert' | 'limiting' | 'yield';
export const STOICH_MODES: StoichMode[] = ['convert', 'limiting', 'yield'];
export type StoichTier = 'easy' | 'medium' | 'hard';
export const STOICH_TIERS: StoichTier[] = ['easy', 'medium', 'hard'];
export type GradeBand = '8' | '9-10' | '11-12';

// ── Formulas and molar masses (code-owned) ───────────────────────────────────────────────

const ATOMIC: Record<string, number> = {
  H: 1, He: 4, Li: 7, C: 12, N: 14, O: 16, F: 19, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, K: 39,
  Ca: 40, Mn: 55, Fe: 56, Cu: 63.5, Zn: 65, Br: 80, Ag: 108, I: 127, Ba: 137, Pb: 207,
};

/** Atoms per element of a formula ("Ca(OH)2" -> Ca 1, O 2, H 2), or null when it does not parse. */
export function atomsOf(formula: string): Record<string, number> | null {
  const stack: Array<Record<string, number>> = [{}];
  let i = 0;
  const num = () => { const m = /^\d+/.exec(formula.slice(i)); if (!m) return 1; i += m[0].length; return Number(m[0]); };
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '(') { stack.push({}); i++; continue; }
    if (ch === ')') {
      i++;
      const n = num(), group = stack.pop();
      if (!group || !stack.length) return null;
      const into = stack[stack.length - 1];
      for (const [el, k] of Object.entries(group)) into[el] = (into[el] ?? 0) + k * n;
      continue;
    }
    const m = /^[A-Z][a-z]?/.exec(formula.slice(i));
    if (!m || ATOMIC[m[0]] === undefined) return null;
    i += m[0].length;
    const top = stack[stack.length - 1];
    top[m[0]] = (top[m[0]] ?? 0) + num();
  }
  return stack.length === 1 && Object.keys(stack[0]).length ? stack[0] : null;
}

export function molarMassOf(formula: string): number | null {
  const atoms = atomsOf(formula);
  if (!atoms) return null;
  return round2(Object.entries(atoms).reduce((s, [el, k]) => s + ATOMIC[el] * k, 0));
}

const NAMES: Record<string, string> = {
  H2: 'hydrogen', O2: 'oxygen', H2O: 'water', CH4: 'methane', CO2: 'carbon dioxide', N2: 'nitrogen', NH3: 'ammonia',
  Mg: 'magnesium', MgO: 'magnesium oxide', C: 'carbon', Al: 'aluminum', Al2O3: 'aluminum oxide', Na: 'sodium',
  Cl2: 'chlorine', NaCl: 'sodium chloride', C3H8: 'propane', Fe2O3: 'iron(III) oxide', CO: 'carbon monoxide',
  Fe: 'iron', C2H6: 'ethane', C6H12O6: 'glucose', H2O2: 'hydrogen peroxide', CaCO3: 'calcium carbonate',
  CaO: 'calcium oxide', Zn: 'zinc', HCl: 'hydrogen chloride', ZnCl2: 'zinc chloride', Cu: 'copper', S: 'sulfur',
  SO2: 'sulfur dioxide', CuO: 'copper(II) oxide',
};

// ── The reaction library: every reaction the generator may pick, balanced (a test checks the atoms) ──

export interface LibraryReaction {
  id: string;
  label: string;
  /** Words that tie the reaction to a lesson topic (the fallback when no model picks). */
  topics: string[];
  reactants: Array<[string, number]>;
  products: Array<[string, number]>;
  /** Grade 8 may use it (simple formulas, small coefficients). */
  intro?: boolean;
}

export const REACTIONS: LibraryReaction[] = [
  { id: 'water', label: 'Hydrogen burns in oxygen to make water', topics: ['hydrogen', 'water', 'fuel cell', 'synthesis'], reactants: [['H2', 2], ['O2', 1]], products: [['H2O', 2]], intro: true },
  { id: 'methane', label: 'Methane (natural gas) burns', topics: ['methane', 'natural gas', 'combustion', 'stove', 'burn'], reactants: [['CH4', 1], ['O2', 2]], products: [['CO2', 1], ['H2O', 2]], intro: true },
  { id: 'ammonia', label: 'The Haber process makes ammonia', topics: ['ammonia', 'haber', 'fertilizer', 'nitrogen'], reactants: [['N2', 1], ['H2', 3]], products: [['NH3', 2]], intro: true },
  { id: 'magnesium', label: 'Magnesium burns in oxygen', topics: ['magnesium', 'metal oxide', 'flare'], reactants: [['Mg', 2], ['O2', 1]], products: [['MgO', 2]], intro: true },
  { id: 'carbon', label: 'Carbon (charcoal) burns', topics: ['carbon', 'charcoal', 'coal'], reactants: [['C', 1], ['O2', 1]], products: [['CO2', 1]], intro: true },
  { id: 'salt', label: 'Sodium and chlorine make table salt', topics: ['sodium', 'chlorine', 'salt', 'ionic'], reactants: [['Na', 2], ['Cl2', 1]], products: [['NaCl', 2]], intro: true },
  { id: 'zinc', label: 'Zinc reacts with hydrochloric acid', topics: ['zinc', 'hydrochloric', 'acid', 'metal and acid', 'single replacement'], reactants: [['Zn', 1], ['HCl', 2]], products: [['ZnCl2', 1], ['H2', 1]], intro: true },
  { id: 'sulfur', label: 'Sulfur burns to sulfur dioxide', topics: ['sulfur', 'acid rain'], reactants: [['S', 1], ['O2', 1]], products: [['SO2', 1]], intro: true },
  { id: 'aluminum', label: 'Aluminum reacts with oxygen', topics: ['aluminum', 'aluminium', 'corrosion', 'oxide'], reactants: [['Al', 4], ['O2', 3]], products: [['Al2O3', 2]] },
  { id: 'rust', label: 'Iron rusts', topics: ['rust', 'iron oxide', 'corrosion'], reactants: [['Fe', 4], ['O2', 3]], products: [['Fe2O3', 2]] },
  { id: 'propane', label: 'Propane burns in a grill', topics: ['propane', 'grill', 'combustion', 'fuel'], reactants: [['C3H8', 1], ['O2', 5]], products: [['CO2', 3], ['H2O', 4]] },
  { id: 'ethane', label: 'Ethane burns', topics: ['ethane', 'combustion', 'hydrocarbon'], reactants: [['C2H6', 2], ['O2', 7]], products: [['CO2', 4], ['H2O', 6]] },
  { id: 'iron', label: 'A blast furnace makes iron from iron ore', topics: ['iron', 'blast furnace', 'ore', 'smelting', 'steel'], reactants: [['Fe2O3', 1], ['CO', 3]], products: [['Fe', 2], ['CO2', 3]] },
  { id: 'respiration', label: 'Cellular respiration burns glucose', topics: ['respiration', 'glucose', 'cell', 'energy'], reactants: [['C6H12O6', 1], ['O2', 6]], products: [['CO2', 6], ['H2O', 6]] },
  { id: 'copper', label: 'Copper oxide is reduced by hydrogen', topics: ['copper', 'reduction', 'copper oxide'], reactants: [['CuO', 1], ['H2', 1]], products: [['Cu', 1], ['H2O', 1]] },
  { id: 'peroxide', label: 'Hydrogen peroxide breaks down', topics: ['peroxide', 'decomposition', 'catalyst'], reactants: [['H2O2', 2]], products: [['H2O', 2], ['O2', 1]], intro: true },
  { id: 'limestone', label: 'Limestone is heated to make lime', topics: ['limestone', 'calcium carbonate', 'lime', 'decomposition'], reactants: [['CaCO3', 1]], products: [['CaO', 1], ['CO2', 1]] },
];

export const libraryReaction = (id: string) => REACTIONS.find(r => r.id === id);

/** The reaction as the component's data carries it: formulas, coefficients, names, molar masses from the formulas. */
export function reactionFromLibrary(r: LibraryReaction): StoichReaction {
  const sub = ([formula, c]: [string, number]) => ({ formula, coefficient: c, molarMass: molarMassOf(formula) ?? 0, name: NAMES[formula] ?? formula });
  const reactants = r.reactants.map(sub), products = r.products.map(sub);
  return { id: r.id, equation: equationText(reactants, products), reactants, products };
}

// ── The normalized reaction every item carries ───────────────────────────────────────────

export interface RxSub { formula: string; name: string; M: number; c: number; side: 'reactant' | 'product' }
export interface Rx { id: string; equation: string; subs: RxSub[] }

const equationText = (reactants: Array<{ formula: string; coefficient: number }>, products: Array<{ formula: string; coefficient: number }>) => {
  const side = (xs: Array<{ formula: string; coefficient: number }>) => xs.map(s => `${s.coefficient > 1 ? s.coefficient : ''}${s.formula}`).join(' + ');
  return `${side(reactants)} -> ${side(products)}`;
};

/** The reaction with molar masses from the formulas (the model's are kept only for a formula code cannot read). */
export function normalizeReaction(r: StoichReaction | undefined | null): Rx | null {
  if (!r || !Array.isArray(r.reactants) || !Array.isArray(r.products) || !r.reactants.length || !r.products.length) return null;
  const sub = (side: RxSub['side']) => (s: StoichReaction['reactants'][number]): RxSub | null => {
    if (!s || typeof s.formula !== 'string' || !s.formula.trim()) return null;
    const M = molarMassOf(s.formula) ?? (Number.isFinite(s.molarMass) && s.molarMass > 0 ? s.molarMass : null);
    const c = Math.round(Number(s.coefficient));
    if (!M || !Number.isFinite(c) || c < 1) return null;
    return { formula: s.formula, name: s.name ?? NAMES[s.formula] ?? s.formula, M, c, side };
  };
  const reactants = r.reactants.map(sub('reactant')), products = r.products.map(sub('product'));
  if (reactants.some(s => !s) || products.some(s => !s)) return null;
  const subs = [...reactants, ...products] as RxSub[];
  if (new Set(subs.map(s => s.formula)).size !== subs.length) return null;
  const toEq = (xs: RxSub[]) => xs.map(s => ({ formula: s.formula, coefficient: s.c }));
  return { id: r.id ?? 'reaction', equation: equationText(toEq(reactants as RxSub[]), toEq(products as RxSub[])), subs };
}

export const subOf = (rx: Rx, formula: string) => rx.subs.find(s => s.formula === formula);
export const reactantsOf = (rx: Rx) => rx.subs.filter(s => s.side === 'reactant');
export const productsOf = (rx: Rx) => rx.subs.filter(s => s.side === 'product');

// ── Numbers ──────────────────────────────────────────────────────────────────────────────

export const round2 = (n: number) => Math.round(n * 100) / 100;
/** A number as the screen prints it: whole, or at most two decimals. */
export const fmt = (n: number) => String(round2(n));
const isWhole = (n: number) => Math.abs(n - Math.round(n)) < 1e-9;
const isHalf = (n: number) => isWhole(n * 2);

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface Amount { formula: string; grams: number }
interface ItemBase { id: string; mode: StoichMode; tier: StoichTier; rx: Rx }
export interface ConvertItem extends ItemBase { mode: 'convert'; given: Amount; target: { formula: string; unit: 'g' | 'mol' }; tray: string[] }
export interface LimitingItem extends ItemBase { mode: 'limiting'; a: Amount; b: Amount; choices: string[] }
export interface YieldItem extends ItemBase { mode: 'yield'; a: Amount; b: Amount; product: string }
export type StoichItem = ConvertItem | LimitingItem | YieldItem;

export const BOTH = 'Both together';

// ── Conversion-factor cards (convert) ────────────────────────────────────────────────────

export interface Qty { n: number; unit: 'g' | 'mol'; formula: string }
export interface Factor { id: string; kind: 'mass' | 'ratio'; top: Qty; bottom: Qty }

/** `X|g>mol` is 1 mol X over M g X; `X|mol>g` is M g X over 1 mol X; `B|per|A` is cB mol B over cA mol A. */
export function factorOf(rx: Rx, id: string): Factor | null {
  const [f, op, g] = id.split('|');
  const s = subOf(rx, f);
  if (!s) return null;
  if (op === 'g>mol') return { id, kind: 'mass', top: { n: 1, unit: 'mol', formula: f }, bottom: { n: s.M, unit: 'g', formula: f } };
  if (op === 'mol>g') return { id, kind: 'mass', top: { n: s.M, unit: 'g', formula: f }, bottom: { n: 1, unit: 'mol', formula: f } };
  const o = op === 'per' ? subOf(rx, g) : undefined;
  if (!o) return null;
  return { id, kind: 'ratio', top: { n: s.c, unit: 'mol', formula: f }, bottom: { n: o.c, unit: 'mol', formula: g } };
}
export const qtyText = (q: Qty) => `${fmt(q.n)} ${q.unit} ${q.formula}`;
/** The card's name for the tutor, the scene and the driver (its aria-label). The card itself draws a fraction. */
export const factorLabel = (f: Factor) => `${qtyText(f.top)} per ${qtyText(f.bottom)}`;
export const cardLabel = (item: ConvertItem, id: string) => { const f = factorOf(item.rx, id); return f ? factorLabel(f) : id; };

export function convertKey(item: ConvertItem): string[] {
  const A = item.given.formula, B = item.target.formula;
  if (B === A) return [`${A}|g>mol`];
  return item.target.unit === 'mol' ? [`${A}|g>mol`, `${B}|per|${A}`] : [`${A}|g>mol`, `${B}|per|${A}`, `${B}|mol>g`];
}
export const chainMatches = (item: ConvertItem, chain: readonly string[]) => {
  const key = convertKey(item);
  return chain.length === key.length && chain.every((c, i) => c === key[i]);
};

/** What the chain amounts to, card by card: the unit after each card, or the first card whose bottom does not cancel. */
export function runningUnits(item: ConvertItem, chain: readonly string[]): Array<{ id: string; after: Qty | null }> {
  let cur: { unit: 'g' | 'mol'; formula: string } | null = { unit: 'g', formula: item.given.formula };
  let n = item.given.grams;
  return chain.map(id => {
    const f = factorOf(item.rx, id);
    if (!f || !cur || f.bottom.unit !== cur.unit || f.bottom.formula !== cur.formula) { cur = null; return { id, after: null }; }
    n = (n * f.top.n) / f.bottom.n;
    cur = { unit: f.top.unit, formula: f.top.formula };
    return { id, after: { n, unit: cur.unit, formula: cur.formula } };
  });
}
/** The amount the key chain computes (shown after credit). */
export const convertValue = (item: ConvertItem) => runningUnits(item, convertKey(item)).at(-1)!.after!.n;

// ── Moles, extents, keys ─────────────────────────────────────────────────────────────────

export const molesOf = (rx: Rx, a: Amount) => a.grams / subOf(rx, a.formula)!.M;
/** Moles over the coefficient: how many times the equation's recipe this amount can run. */
export const extentOf = (rx: Rx, a: Amount) => molesOf(rx, a) / subOf(rx, a.formula)!.c;
const sameExtent = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(x, y);

/** The limiting reactant's formula, or BOTH when the two run out together. */
export function limitingOf(rx: Rx, a: Amount, b: Amount): string {
  const ea = extentOf(rx, a), eb = extentOf(rx, b);
  return sameExtent(ea, eb) ? BOTH : ea < eb ? a.formula : b.formula;
}
export const yieldOf = (item: Pick<YieldItem, 'rx' | 'a' | 'b' | 'product'>) => {
  const p = subOf(item.rx, item.product)!;
  return round2(Math.min(extentOf(item.rx, item.a), extentOf(item.rx, item.b)) * p.c * p.M);
};
/** Typed grams within 1% of the key (molar masses are whole or halves, so the key is exact). */
export const yieldTolerance = (key: number) => Math.max(0.01 * key, 0.05);
export const parseGrams = (text: string): number | null => {
  const n = Number(String(text).trim().replace(/\s*g(rams?)?$/i, ''));
  return String(text).trim() && Number.isFinite(n) ? n : null;
};

export function stoichCorrect(item: StoichItem | undefined, work: StoichWork): boolean {
  if (!item) return false;
  if (item.mode === 'convert') return chainMatches(item, work.chain);
  if (item.mode === 'limiting') return work.choice !== null && work.choice === limitingOf(item.rx, item.a, item.b);
  const n = parseGrams(work.typed);
  const key = yieldOf(item);
  return n !== null && Math.abs(n - key) <= yieldTolerance(key);
}

/** The learner's work on the current item. */
export interface StoichWork { chain: string[]; choice: string | null; typed: string }
export const NO_WORK: StoichWork = { chain: [], choice: null, typed: '' };

// ── Misses: the pattern of the wrong answer, never a guessed cause ───────────────────────

/**
 * convert: the chain stopped before the goal; went past it; a molar-mass card upside down; the ratio card upside
 * down; a molar-mass card of the goal substance where the ratio goes; the right cards in the wrong order; a molar-mass
 * card of another substance; any other card.
 */
export type ConvertMiss = 'stopped_short' | 'extra_step' | 'upside_down_molar_mass' | 'upside_down_ratio' | 'skipped_ratio'
  | 'out_of_order' | 'other_substance' | 'wrong_card';
/** limiting: chose the reactant with fewer moles (not fewer per its coefficient); the one with the smaller mass; one
 *  reactant when both run out together; both when one runs out first; the other reactant. */
export type LimitingMiss = 'fewer_moles' | 'smaller_mass' | 'missed_both' | 'said_both' | 'other_reactant';
/** yield: the grams the excess reactant would make; the limiting reactant's moles times the product's molar mass (no
 *  ratio); the ratio upside down; the two reactant masses added; any other amount. */
export type YieldMiss = 'from_excess' | 'skipped_ratio' | 'upside_down_ratio' | 'mass_sum' | 'other_amount';
export type StoichiometryMiss = ConvertMiss | LimitingMiss | YieldMiss;

export function convertMiss(item: ConvertItem, chain: readonly string[]): ConvertMiss | undefined {
  if (!chain.length || chainMatches(item, chain)) return undefined;
  const key = convertKey(item);
  const at = chain.findIndex((c, i) => c !== key[i]);
  // Every placed card matches the key so far: the chain is a prefix of it.
  if (at < 0) return 'stopped_short';
  if (at >= key.length) return 'extra_step';
  const [pf, pop, pg] = chain[at].split('|'), [ef, eop, eg] = key[at].split('|');
  const mass = (op: string) => op === 'g>mol' || op === 'mol>g';
  if (mass(pop) && mass(eop) && pf === ef) return 'upside_down_molar_mass';
  if (pop === 'per' && eop === 'per' && pf === eg && pg === ef) return 'upside_down_ratio';
  if (eop === 'per' && mass(pop) && pf === item.target.formula) return 'skipped_ratio';
  if (key.includes(chain[at])) return 'out_of_order';
  if (mass(pop)) return 'other_substance';
  return 'wrong_card';
}

export function limitingMiss(item: LimitingItem, choice: string | null): LimitingMiss | undefined {
  if (choice === null || !item.choices.includes(choice)) return undefined;
  const key = limitingOf(item.rx, item.a, item.b);
  if (choice === key) return undefined;
  if (key === BOTH) return 'missed_both';
  if (choice === BOTH) return 'said_both';
  const chosen = choice === item.a.formula ? item.a : item.b, right = choice === item.a.formula ? item.b : item.a;
  if (molesOf(item.rx, chosen) < molesOf(item.rx, right)) return 'fewer_moles';
  if (chosen.grams < right.grams) return 'smaller_mass';
  return 'other_reactant';
}

/** The wrong totals a yield answer is read against, most specific first; each differs from the key and the others. */
export function yieldDistractors(item: YieldItem): Array<{ id: YieldMiss; grams: number }> {
  const rx = item.rx, p = subOf(rx, item.product)!, key = yieldOf(item);
  const lim = limitingOf(rx, item.a, item.b);
  const L = lim === item.b.formula ? item.b : item.a, X = L === item.a ? item.b : item.a;
  const cL = subOf(rx, L.formula)!.c;
  const raw: Array<{ id: YieldMiss; grams: number }> = [
    ...(lim === BOTH ? [] : [{ id: 'from_excess' as const, grams: extentOf(rx, X) * p.c * p.M }]),
    { id: 'skipped_ratio', grams: molesOf(rx, L) * p.M },
    { id: 'upside_down_ratio', grams: molesOf(rx, L) * (cL / p.c) * p.M },
    { id: 'mass_sum', grams: item.a.grams + item.b.grams },
  ];
  const out: Array<{ id: YieldMiss; grams: number }> = [];
  for (const d of raw) {
    const g = round2(d.grams);
    const far = (x: number) => Math.abs(g - x) > Math.max(0.02 * Math.max(g, x), 0.1);
    if (g > 0 && far(key) && out.every(o => far(o.grams))) out.push({ id: d.id, grams: g });
  }
  return out;
}

export function yieldMiss(item: YieldItem, typed: string): YieldMiss | undefined {
  const n = parseGrams(typed);
  if (n === null) return undefined;
  const key = yieldOf(item);
  if (Math.abs(n - key) <= yieldTolerance(key)) return undefined;
  return yieldDistractors(item).find(d => Math.abs(n - d.grams) <= yieldTolerance(d.grams))?.id ?? 'other_amount';
}

export function stoichMiss(item: StoichItem | undefined, work: StoichWork): StoichiometryMiss | undefined {
  if (!item) return undefined;
  if (item.mode === 'convert') return convertMiss(item, work.chain);
  if (item.mode === 'limiting') return limitingMiss(item, work.choice);
  return yieldMiss(item, work.typed);
}

// ── Asks, assignment, spoken answers ─────────────────────────────────────────────────────

const amountText = (rx: Rx, a: Amount) => `${fmt(a.grams)} g of ${a.formula} (${subOf(rx, a.formula)?.name ?? a.formula})`;

export function askOf(item: StoichItem): string {
  const rx = item.rx;
  if (item.mode === 'convert') {
    const goal = `${item.target.unit === 'mol' ? 'moles' : 'grams'} of ${item.target.formula}`;
    return `You have ${amountText(rx, item.given)}. Build the chain of conversion factors that turns it into ${goal}.`;
  }
  const mix = `You mix ${amountText(rx, item.a)} with ${amountText(rx, item.b)}.`;
  if (item.mode === 'limiting') return `${mix} Which one runs out first, or do both run out together?`;
  return `${mix} How many grams of ${item.product} (${subOf(rx, item.product)?.name}) can form?`;
}

export const stoichMode = (item: StoichItem): StoichMode => item.mode;

/**
 * The key a spoken answer is judged against. limiting: a menu key, the two reactants and "both", all said in the ask.
 * yield: the grams, said any way. A convert item has no key: the learner places the cards and the activity checks them.
 */
export function stoichKey(item: StoichItem): SpokenKey | null {
  const rx = item.rx;
  if (item.mode === 'convert') return null;
  if (item.mode === 'limiting') {
    const key = limitingOf(rx, item.a, item.b), menu = [item.a.formula, item.b.formula, 'both'];
    if (key === BOTH) return { answer: 'both', menu, alsoAccept: ['both at the same time', 'they run out together', 'neither is left over'],
      signatureError: `Naming ${item.a.formula} or ${item.b.formula} alone is wrong.` };
    const s = subOf(rx, key)!, other = key === item.a.formula ? item.b.formula : item.a.formula;
    return { answer: key, menu,
      alsoAccept: [s.name, `the ${s.name}`, `${s.name} is the limiting reactant`].filter(a => a !== key),
      signatureError: `${other} (${subOf(rx, other)!.name}) is wrong, and so is "both together" or naming both.` };
  }
  const k = fmt(yieldOf(item));
  return { answer: k, alsoAccept: [`${k} grams`, `${k} g`],
    acceptRule: `A number within 1% of ${k}, from rounding, also counts.`,
    signatureError: 'Any other number is wrong, and so is giving two numbers or hedging between them.' };
}

export function stoichSpokenMisses(item: StoichItem): KnownMiss[] {
  const rx = item.rx;
  if (item.mode === 'convert') return [];
  if (item.mode === 'limiting') {
    const key = limitingOf(rx, item.a, item.b);
    const fact = key === BOTH ? `${item.a.formula} and ${item.b.formula} run out together.` : `${key} runs out first.`;
    return STOICH_MISSES.limiting.flatMap(id => {
      const c = item.choices.find(ch => limitingMiss(item, ch) === id);
      if (!c) return [];
      const said = c === BOTH ? 'both run out together' : `${c} (${subOf(rx, c)!.name}) runs out first`;
      return [{ id, pattern: `${fact} The learner's answer is that ${said}.`, examples: c === BOTH ? ['both', 'both at the same time'] : [c, subOf(rx, c)!.name] }];
    });
  }
  const key = yieldOf(item);
  const what: Record<YieldMiss, string> = {
    from_excess: 'the grams the other reactant (the one left over) would make',
    skipped_ratio: 'the limiting reactant\'s moles times the product\'s molar mass, without the mole ratio',
    upside_down_ratio: 'what the mole ratio turned upside down gives',
    mass_sum: 'the two reactant masses added together',
    other_amount: '',
  };
  return yieldDistractors(item).map(d => ({ id: d.id,
    pattern: `${fmt(key)} grams of ${item.product} can form. The learner's answer is ${fmt(d.grams)} grams, ${what[d.id]}.`,
    examples: [fmt(d.grams), `${fmt(d.grams)} grams`] }));
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export function describeStoichWork(item: StoichItem | undefined, work: StoichWork): string {
  if (!item) return 'Nothing yet';
  if (item.mode === 'convert') return work.chain.length
    ? `Chain: ${work.chain.map(id => cardLabel(item, id)).join(', then ')}` : 'Nothing in the chain yet';
  if (item.mode === 'limiting') return work.choice ? `Chose "${work.choice}"` : 'Nothing chosen yet';
  return work.typed.trim() ? `Typed ${work.typed.trim()} g` : 'Nothing typed yet';
}

/** What the learner works out is the question: never said for them. How they answer is the card's `moves`. */
const PAIR_RULE = 'Never name the reactant that runs out first, say that one is in excess or left over, give a number of '
  + 'moles, runs or grams the screen does not show, or say that the lighter reactant runs out first; ask the learner to '
  + 'turn each mass into moles and compare them using the coefficients. With the mole counts or the recipe card on '
  + 'screen, never compare the two jars for the learner (which has more, which lasts longer); ask the learner to compare.';
const CONSTRAINTS: Record<StoichMode, string> = {
  convert: 'Never say or ask which unit belongs on the top or the bottom of a card (that is the step the item checks), '
    + 'which card goes next, that a card should be flipped or swapped, how many cards the chain needs, or what the chain '
    + 'has reached; ask what unit the start card is in and what unit the goal needs, and, with the unit tracker on '
    + 'screen, what it says under each card. The start card is one amount, with no top or bottom.',
  limiting: PAIR_RULE,
  yield: PAIR_RULE,
};

export const molarMassLine = (rx: Rx) => rx.subs.map(s => `${s.formula} (${s.name}) ${fmt(s.M)} g/mol`).join('; ');

/** What is drawn and asked. Never which card, reactant or amount is right. */
export function workspaceScene(item: StoichItem, work: StoichWork): WorkspaceScene {
  const rx = item.rx;
  const facts: Record<string, string> = {
    kind: item.mode, question: askOf(item), equation: rx.equation.replace('->', '→'),
    molarMasses: `Printed under the equation: ${molarMassLine(rx)}.`,
  };
  if (item.mode === 'convert') {
    facts.shown = `A start card "${fmt(item.given.grams)} g ${item.given.formula}", an empty chain, and a goal card "? ${item.target.unit} ${item.target.formula}". `
      + `A tray of ${item.tray.length} conversion-factor cards, each drawn as a fraction: ${item.tray.map(id => `"${cardLabel(item, id)}"`).join(', ')}. `
      + 'A placed card leaves the tray; tapping a chain card puts it back. No running units or values are shown.';
  } else {
    facts.shown = `Two jars, the same size: ${amountText(rx, item.a)} and ${amountText(rx, item.b)}. No mole counts are shown.`
      + (item.mode === 'limiting' ? ` Choices: ${item.choices.map(c => `"${c}"`).join(', ')}.` : ` A box for the grams of ${item.product}.`);
  }
  facts.learnerWork = describeStoichWork(item, work);
  facts.constraints = CONSTRAINTS[item.mode];
  return { objects: [], facts };
}

// ── Building items (the generator; the component rebuilds nothing it was given) ──────────

/** A small seeded generator, so a payload's items are reproducible from its seed. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashOf = (text: string) => { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const pick = <T,>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length) % xs.length];
const shuffle = <T,>(xs: T[], rand: () => number) => { const out = [...xs]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

const MOLES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
/** A both-run-out item needs the exact ratio (2 C2H6 : 7 O2), so it may use any half-mole up to 14. */
const HALF_MOLES = Array.from({ length: 28 }, (_, i) => (i + 1) / 2);
const WINDOW: Record<GradeBand, [number, number]> = { '8': [2, 80], '9-10': [4, 150], '11-12': [8, 400] };

/** Best group first: lower `rank` wins, then a random pick inside it. */
function best<T extends { rank: number }>(cands: T[], rand: () => number): T | null {
  if (!cands.length) return null;
  const top = Math.min(...cands.map(c => c.rank));
  return pick(cands.filter(c => c.rank === top), rand);
}

/** The six cards on a convert item's tray, in a seeded order: the given's two, the other substance's two, both ratios. */
export function trayFor(rx: Rx, given: string, target: string, rand: () => number): string[] {
  const other = target !== given ? target
    : (rx.subs.filter(s => s.formula !== given).sort((x, y) => Number(x.c === subOf(rx, given)!.c) - Number(y.c === subOf(rx, given)!.c))[0]?.formula ?? given);
  const ids = [`${given}|g>mol`, `${given}|mol>g`, `${other}|g>mol`, `${other}|mol>g`, `${other}|per|${given}`, `${given}|per|${other}`];
  return shuffle(Array.from(new Set(ids)), rand);
}

export function buildConvert(rx: Rx, tier: StoichTier, rand: () => number, avoid: Set<string>, band: GradeBand = '9-10'): StoichChallenge | null {
  const [lo, hi] = WINDOW[band];
  type C = { rank: number; A: RxSub; grams: number; B: RxSub; unit: 'g' | 'mol' };
  const cands: C[] = [];
  for (const A of rx.subs) for (const n of MOLES) {
    const grams = round2(n * A.M);
    if (!isHalf(grams)) continue;
    const out = grams < lo || grams > hi ? 2 : 0;
    // Variety inside a session: a substance already given counts against it.
    const side = (A.side === 'reactant' ? 0 : 1) + (avoid.has(`used:${A.formula}`) ? 1 : 0);
    if (tier === 'easy') { cands.push({ rank: out + side, A, grams, B: A, unit: 'mol' }); continue; }
    for (const B of rx.subs) {
      if (B === A) continue;
      const ratio = A.c !== B.c ? 0 : 4;
      cands.push({ rank: ratio + out + side, A, grams, B, unit: tier === 'medium' ? 'mol' : 'g' });
    }
  }
  const fresh = cands.filter(c => !avoid.has(`${c.A.formula}:${c.grams}>${c.B.formula}:${c.unit}`) && !avoid.has(`given:${c.A.formula}:${c.grams}`));
  const c = best(fresh, rand);
  if (!c) return null;
  avoid.add(`${c.A.formula}:${c.grams}>${c.B.formula}:${c.unit}`); avoid.add(`given:${c.A.formula}:${c.grams}`);
  avoid.add(`used:${c.A.formula}`);
  return { id: '', type: 'convert', tier, givenFormulaA: c.A.formula, givenMassA: c.grams, answerFormula: c.B.formula, answerUnit: c.unit,
    tray: trayFor(rx, c.A.formula, c.B.formula, rand) };
}

/** Every number printed on a two-reactant item before any answer: a key equal to one of them is not asked. */
const printedNumbers = (rx: Rx, mA: number, mB: number) => new Set([...rx.subs.flatMap(s => [round2(s.M), s.c]), round2(mA), round2(mB)]);

/**
 * A two-reactant item at a tier. limiting and yield share the traps: easy none (the limiting reactant has the smaller
 * mass and fewer moles), medium a mass trap (it has the larger mass), hard a mole trap (it has more moles, so only
 * moles / coefficient finds it; preferred with the larger mass too). yield also wants the product's coefficient to
 * differ from the limiting reactant's at medium and hard, and a whole-number key no printed number equals.
 * `both`: the two run out together (no trap). Saturates downward when the reaction cannot make the tier.
 */
export function buildPair(rx: Rx, mode: 'limiting' | 'yield', tier: StoichTier, rand: () => number, avoid: Set<string>,
  band: GradeBand = '9-10', both = false): StoichChallenge | null {
  const rs = reactantsOf(rx);
  if (rs.length < 2) return null;
  const [A, B] = rs;
  const [lo, hi] = WINDOW[band];
  const tiers = STOICH_TIERS.slice(0, STOICH_TIERS.indexOf(tier) + 1).reverse();
  for (const want of tiers) {
    type C = { rank: number; nA: number; nB: number; product?: string };
    const cands: C[] = [];
    const grid = both ? HALF_MOLES : MOLES;
    for (const nA of grid) for (const nB of grid) {
      const mA = round2(nA * A.M), mB = round2(nB * B.M);
      if (!isHalf(mA) || !isHalf(mB)) continue;
      if (avoid.has(`${mA}+${mB}`)) continue;
      const eA = nA / A.c, eB = nB / B.c;
      const tie = sameExtent(eA, eB);
      if (both !== tie) continue;
      if (!both && Math.abs(eA - eB) / Math.max(eA, eB) < 0.2) continue;
      let rank = (mA < lo || mA > hi ? 2 : 0) + (mB < lo || mB > hi ? 2 : 0);
      // Variety inside a session: a mass already given counts against it.
      rank += (avoid.has(`mass:${A.formula}:${mA}`) ? 1 : 0) + (avoid.has(`mass:${B.formula}:${mB}`) ? 1 : 0);
      const aLimits = both || eA < eB;
      const [nL, nO, mL, mO, cL] = aLimits ? [nA, nB, mA, mB, A.c] : [nB, nA, mB, mA, B.c];
      if (!both) {
        const massTrap = mL > mO, moleTrap = nL > nO;
        if (want === 'easy' && (massTrap || moleTrap || nL === nO || mL === mO)) continue;
        if (want === 'medium' && (!massTrap || moleTrap || nL === nO)) continue;
        if (want === 'hard' && !moleTrap) continue;
        if (want === 'hard' && !massTrap) rank += 1;
      }
      if (mode === 'limiting') { cands.push({ rank, nA, nB }); continue; }
      const printed = printedNumbers(rx, mA, mB);
      for (const P of productsOf(rx)) {
        const key = round2(Math.min(eA, eB) * P.c * P.M);
        if (key < 1 || !isWhole(key) || printed.has(key)) continue;
        const ratioRank = want === 'easy' ? (P.c === cL ? 0 : 3) : (P.c !== cL ? 0 : 3);
        const reuse = avoid.has(`product:${P.formula}`) ? 1 : 0;
        const item: YieldItem = { id: '', mode: 'yield', tier: want, rx, a: { formula: A.formula, grams: mA }, b: { formula: B.formula, grams: mB }, product: P.formula };
        if (!both && !yieldDistractors(item).some(d => d.id === 'from_excess')) continue;
        cands.push({ rank: rank + ratioRank + reuse, nA, nB, product: P.formula });
      }
    }
    const c = best(cands, rand);
    if (!c) continue;
    const mA = round2(c.nA * A.M), mB = round2(c.nB * B.M);
    avoid.add(`${mA}+${mB}`); avoid.add(`mass:${A.formula}:${mA}`); avoid.add(`mass:${B.formula}:${mB}`);
    if (c.product) avoid.add(`product:${c.product}`);
    return { id: '', type: mode, tier: want, givenFormulaA: A.formula, givenMassA: mA, givenFormulaB: B.formula, givenMassB: mB,
      ...(c.product ? { answerFormula: c.product, answerUnit: 'g' as const } : {}) };
  }
  return null;
}

/** The modes a reaction can be asked in: limiting and yield need two reactants. */
export const modesFor = (rx: Rx) => STOICH_MODES.filter(m => m === 'convert' || reactantsOf(rx).length >= 2);

/** The modes a payload asks for: its pin, else what its challenges are, else by band (grade 8: convert and limiting). */
export function resolveStoichModes(data: Pick<StoichiometryLabData, 'challengeTypes' | 'challenges' | 'gradeBand'>): StoichMode[] {
  const asked = (data.challengeTypes ?? []).filter((m): m is StoichMode => (STOICH_MODES as string[]).includes(m));
  if (asked.length) return STOICH_MODES.filter(m => asked.includes(m));
  const had = (data.challenges ?? []).map(c => c?.type).filter((m): m is StoichMode => (STOICH_MODES as string[]).includes(m as string));
  if (had.length) return STOICH_MODES.filter(m => had.includes(m));
  return data.gradeBand === '8' ? ['convert', 'limiting'] : STOICH_MODES;
}

/**
 * A session's challenges: 3 per mode when one mode is pinned (one tier each, easy to hard, or all at the requested
 * tier), 2 per mode when blended (medium, hard). A pinned limiting session asks one "both run out together" item.
 */
export function buildStoichChallenges(reaction: StoichReaction, modes: StoichMode[], tier: StoichTier | null, seed: number,
  band: GradeBand = '9-10'): StoichChallenge[] {
  const rx = normalizeReaction(reaction);
  if (!rx) return [];
  const rand = seeded(seed);
  const usable = modes.filter(m => modesFor(rx).includes(m));
  const pinned = usable.length === 1;
  const per = pinned ? 3 : 2;
  const tiers: StoichTier[] = tier ? Array(per).fill(tier) : pinned ? STOICH_TIERS : ['medium', 'hard'];
  const out: StoichChallenge[] = [];
  for (const mode of usable) {
    const avoid = new Set<string>();
    const bothAt = mode === 'limiting' && pinned ? 1 + Math.floor(rand() * (per - 1)) : -1;
    tiers.forEach((t, k) => {
      const c = mode === 'convert' ? buildConvert(rx, t, rand, avoid, band) : buildPair(rx, mode, t, rand, avoid, band, k === bothAt)
        ?? (k === bothAt ? buildPair(rx, mode, t, rand, avoid, band) : null);
      if (c) out.push({ ...c, id: `${mode}-${k + 1}` });
    });
  }
  return out;
}

/** One challenge as an item, or null when it does not fit the reaction. Legacy generations (keys written by the model)
 *  map onto the same items; every key is recomputed. */
export function itemOf(rx: Rx, c: StoichChallenge, index: number): StoichItem | null {
  if (!c || typeof c.id !== 'string' || !STOICH_MODES.includes(c.type as StoichMode)) return null;
  const A = subOf(rx, c.givenFormulaA);
  const grams = Number(c.givenMassA);
  if (!A || !Number.isFinite(grams) || grams <= 0) return null;
  const tier: StoichTier = STOICH_TIERS.includes(c.tier as StoichTier) ? c.tier as StoichTier : 'medium';
  const id = c.id || `${c.type}-${index + 1}`;
  if (c.type === 'convert') {
    const B = subOf(rx, c.answerFormula ?? '');
    const unit = c.answerUnit === 'g' ? 'g' : 'mol';
    if (!B || (B === A && unit === 'g')) return null;
    const tray = Array.isArray(c.tray) && c.tray.every(t => factorOf(rx, t)) ? c.tray : trayFor(rx, A.formula, B.formula, seeded(hashOf(id)));
    const item: ConvertItem = { id, mode: 'convert', tier, rx, given: { formula: A.formula, grams }, target: { formula: B.formula, unit }, tray };
    return convertKey(item).every(k => item.tray.includes(k)) ? item : null;
  }
  const Bs = subOf(rx, c.givenFormulaB ?? ''), gB = Number(c.givenMassB);
  if (!Bs || Bs === A || A.side !== 'reactant' || Bs.side !== 'reactant' || !Number.isFinite(gB) || gB <= 0) return null;
  const [a, b] = rx.subs.indexOf(A) < rx.subs.indexOf(Bs) ? [{ formula: A.formula, grams }, { formula: Bs.formula, grams: gB }]
    : [{ formula: Bs.formula, grams: gB }, { formula: A.formula, grams }];
  if (c.type === 'limiting') return { id, mode: 'limiting', tier, rx, a, b, choices: [a.formula, b.formula, BOTH] };
  const P = subOf(rx, c.answerFormula ?? '');
  if (!P || P.side !== 'product') return null;
  return { id, mode: 'yield', tier, rx, a, b, product: P.formula };
}

/** Every item of the session, in order. A payload with no usable challenge is built from its reaction (seeded by title). */
export function stoichItems(data: Pick<StoichiometryLabData, 'reaction' | 'challenges' | 'challengeTypes' | 'gradeBand' | 'supportTier' | 'title'>): StoichItem[] {
  const rx = normalizeReaction(data.reaction);
  if (!rx) return [];
  const own = (data.challenges ?? []).map((c, i) => itemOf(rx, c, i)).filter((i): i is StoichItem => !!i);
  const seen = new Set<string>();
  const unique = own.filter(i => !seen.has(i.id) && !!seen.add(i.id));
  if (unique.length) return unique;
  const built = buildStoichChallenges(data.reaction, resolveStoichModes(data), data.supportTier ?? null, hashOf(data.title ?? 'stoichiometry'),
    (data.gradeBand as GradeBand) ?? '9-10');
  return built.map((c, i) => itemOf(rx, c, i)).filter((i): i is StoichItem => !!i);
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers. convert: card labels in order; the wrong chain is the most telling miss for the item. */
export function stoichHarnessAnswers(item: StoichItem): { correct: string[]; plainWrong: string[] } {
  if (item.mode === 'convert') {
    const key = convertKey(item);
    const [A, , ] = key[0].split('|');
    const wrong = key.length === 1 ? [`${A}|mol>g`] : key.map(id => {
      const [f, op, g] = id.split('|');
      return op === 'per' ? `${g}|per|${f}` : id;
    });
    return { correct: key.map(id => cardLabel(item, id)), plainWrong: wrong.map(id => cardLabel(item, id)) };
  }
  if (item.mode === 'limiting') {
    const key = limitingOf(item.rx, item.a, item.b);
    const rank = STOICH_MISSES.limiting;
    const wrong = item.choices.filter(c => c !== key).sort((x, y) => rank.indexOf(limitingMiss(item, x)!) - rank.indexOf(limitingMiss(item, y)!));
    return { correct: [key], plainWrong: [wrong[0]] };
  }
  const key = yieldOf(item);
  const d = yieldDistractors(item)[0];
  return { correct: [fmt(key)], plainWrong: [fmt(d ? d.grams : key * 2)] };
}
