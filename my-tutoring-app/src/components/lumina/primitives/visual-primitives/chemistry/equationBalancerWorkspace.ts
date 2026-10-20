/**
 * equation-balancer's items, keys, misses and scene: the pure half of its boss (`equationBalancer.boss.ts`, a spoken
 * preset with a SAY_OR_SHOW count mode and two balance boards).
 *
 * Every equation comes from a code bank (`EQUATION_BANK`); code parses each formula into atoms, solves the smallest
 * whole-number coefficients, and builds every item and key. The generator only picks bank equations for the topic and
 * writes a title and a real-world line per equation. Three modes, each a different task:
 * - simple (count atoms): the equation is printed with its numbers in front; how many atoms of one element are on one
 *   side? Coefficient times subscript, summed over the compounds that hold it. A closed number choice, tapped or said.
 * - guided (balance): set the number in front of each formula so every element matches, where each element sits in
 *   one compound on each side, so it can be balanced one element at a time.
 * - complex (balance, shared element): an element sits in two compounds on one side (oxygen in a combustion), so
 *   fixing one element moves another.
 * A balance check is correct only at the smallest whole numbers (`balanceCorrect`); nothing on screen counts atoms or
 * marks a match until the learner checks or a lever draws it.
 *
 * Pure: the component, the boss, the levers and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { BALANCER_MISSES } from './equationBalancer.card';

export type BalancerMode = 'simple' | 'guided' | 'complex';
export const BALANCER_MODES: BalancerMode[] = ['simple', 'guided', 'complex'];
export type BalanceMode = Exclude<BalancerMode, 'simple'>;
export const MAX_COEFFICIENT = 10;

// ── Formulas ─────────────────────────────────────────────────────────────────────────────

export type Atoms = Record<string, number>;
const SUBSCRIPTS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
export const plainFormula = (f: string) => f.replace(/[₀-₉]/g, c => SUBSCRIPTS[c]).replace(/\s+/g, '');

/**
 * The atoms in one molecule of a formula, parentheses included ("Ca(OH)2" is Ca 1, O 2, H 2). With `ignoreGroups`, a
 * group's multiplier is dropped (the ignored_parentheses miss). Throws on a formula it cannot read.
 */
export function parseFormula(formula: string, ignoreGroups = false): Atoms {
  const f = plainFormula(formula);
  let i = 0;
  const num = () => { const m = /^\d+/.exec(f.slice(i)); if (!m) return 1; i += m[0].length; return Number(m[0]); };
  const group = (): Atoms => {
    const out: Atoms = {};
    const add = (a: Atoms, k: number) => { for (const [e, n] of Object.entries(a)) out[e] = (out[e] ?? 0) + n * k; };
    while (i < f.length && f[i] !== ')') {
      if (f[i] === '(') {
        i++; const inner = group();
        if (f[i] !== ')') throw new Error(`Unclosed group in ${formula}`);
        i++; const k = num(); add(inner, ignoreGroups ? 1 : k);
      } else {
        const m = /^[A-Z][a-z]?/.exec(f.slice(i));
        if (!m) throw new Error(`Cannot read ${formula}`);
        i += m[0].length; add({ [m[0]]: 1 }, num());
      }
    }
    return out;
  };
  const atoms = group();
  if (i !== f.length || !Object.keys(atoms).length) throw new Error(`Cannot read ${formula}`);
  return atoms;
}

export const ELEMENT_NAMES: Record<string, string> = {
  H: 'hydrogen', O: 'oxygen', N: 'nitrogen', C: 'carbon', Na: 'sodium', Cl: 'chlorine', Mg: 'magnesium', Fe: 'iron',
  Al: 'aluminum', K: 'potassium', Zn: 'zinc', Cu: 'copper', Ag: 'silver', Li: 'lithium', Ca: 'calcium', S: 'sulfur', P: 'phosphorus',
};
export const elementName = (el: string) => ELEMENT_NAMES[el] ?? el;

// ── The bank ─────────────────────────────────────────────────────────────────────────────

export interface BankEquation { id: string; name: string; reactants: string[]; products: string[] }

/** Real reactions, written unbalanced. Keys, atoms and modes are computed, never stored. */
export const EQUATION_BANK: BankEquation[] = [
  { id: 'water', name: 'Hydrogen burns in oxygen to make water', reactants: ['H2', 'O2'], products: ['H2O'] },
  { id: 'ammonia', name: 'Nitrogen and hydrogen make ammonia', reactants: ['N2', 'H2'], products: ['NH3'] },
  { id: 'table_salt', name: 'Sodium and chlorine make table salt', reactants: ['Na', 'Cl2'], products: ['NaCl'] },
  { id: 'magnesium_burns', name: 'Magnesium burns with a bright white flame', reactants: ['Mg', 'O2'], products: ['MgO'] },
  { id: 'copper_oxide', name: 'Copper turns black when heated in air', reactants: ['Cu', 'O2'], products: ['CuO'] },
  { id: 'lithium_oxide', name: 'Lithium reacts with oxygen', reactants: ['Li', 'O2'], products: ['Li2O'] },
  { id: 'rust', name: 'Iron rusts in oxygen', reactants: ['Fe', 'O2'], products: ['Fe2O3'] },
  { id: 'aluminum_oxide', name: 'Aluminum forms a protective oxide coat', reactants: ['Al', 'O2'], products: ['Al2O3'] },
  { id: 'aluminum_chloride', name: 'Aluminum reacts with chlorine', reactants: ['Al', 'Cl2'], products: ['AlCl3'] },
  { id: 'iron_chloride', name: 'Hot iron burns in chlorine', reactants: ['Fe', 'Cl2'], products: ['FeCl3'] },
  { id: 'nitrogen_dioxide', name: 'Nitrogen and oxygen make a brown smog gas', reactants: ['N2', 'O2'], products: ['NO2'] },
  { id: 'electrolysis', name: 'Electricity splits water into two gases', reactants: ['H2O'], products: ['H2', 'O2'] },
  { id: 'salt_split', name: 'Melted salt splits into sodium and chlorine', reactants: ['NaCl'], products: ['Na', 'Cl2'] },
  { id: 'oxygen_candle', name: 'Heating potassium chlorate releases oxygen', reactants: ['KClO3'], products: ['KCl', 'O2'] },
  { id: 'zinc_acid', name: 'Zinc fizzes in hydrochloric acid', reactants: ['Zn', 'HCl'], products: ['ZnCl2', 'H2'] },
  { id: 'magnesium_acid', name: 'Magnesium fizzes in hydrochloric acid', reactants: ['Mg', 'HCl'], products: ['MgCl2', 'H2'] },
  { id: 'silver_tree', name: 'Copper wire grows silver crystals', reactants: ['Cu', 'AgNO3'], products: ['Cu(NO3)2', 'Ag'] },
  { id: 'phosphorus_burns', name: 'Phosphorus burns in air', reactants: ['P4', 'O2'], products: ['P4O10'] },
  { id: 'methane', name: 'Natural gas burns on a stove', reactants: ['CH4', 'O2'], products: ['CO2', 'H2O'] },
  { id: 'ethene', name: 'Ethylene gas burns', reactants: ['C2H4', 'O2'], products: ['CO2', 'H2O'] },
  { id: 'propane', name: 'Propane burns in a gas grill', reactants: ['C3H8', 'O2'], products: ['CO2', 'H2O'] },
  { id: 'ethane', name: 'Ethane burns', reactants: ['C2H6', 'O2'], products: ['CO2', 'H2O'] },
  { id: 'peroxide', name: 'Hydrogen peroxide breaks down into water and oxygen', reactants: ['H2O2'], products: ['H2O', 'O2'] },
  { id: 'sulfur_trioxide', name: 'Sulfur dioxide reacts with oxygen in polluted air', reactants: ['SO2', 'O2'], products: ['SO3'] },
  { id: 'sodium_water', name: 'Sodium reacts with water', reactants: ['Na', 'H2O'], products: ['NaOH', 'H2'] },
  { id: 'potassium_water', name: 'Potassium reacts with water', reactants: ['K', 'H2O'], products: ['KOH', 'H2'] },
  { id: 'respiration', name: 'Cells burn sugar for energy (respiration)', reactants: ['C6H12O6', 'O2'], products: ['CO2', 'H2O'] },
  { id: 'photosynthesis', name: 'Plants make sugar from light (photosynthesis)', reactants: ['CO2', 'H2O'], products: ['C6H12O6', 'O2'] },
  { id: 'iron_ore', name: 'A blast furnace makes iron from iron ore', reactants: ['Fe2O3', 'CO'], products: ['Fe', 'CO2'] },
  { id: 'baking_soda', name: 'Heating baking soda makes a cake rise', reactants: ['NaHCO3'], products: ['Na2CO3', 'H2O', 'CO2'] },
  { id: 'lime_acid', name: 'Slaked lime neutralizes hydrochloric acid', reactants: ['Ca(OH)2', 'HCl'], products: ['CaCl2', 'H2O'] },
  { id: 'battery_acid', name: 'Sulfuric acid neutralizes sodium hydroxide', reactants: ['H2SO4', 'NaOH'], products: ['Na2SO4', 'H2O'] },
];

export interface Compound { formula: string; atoms: Atoms }
export interface Equation { id: string; name: string; reactants: Compound[]; products: Compound[]; realWorld?: string; for?: BalancerMode }

/** A lesson's equation: a bank id (or its own formulas), the mode it was picked for, and the generator's real-world line. */
export interface LessonEquation { id: string; name?: string; reactants?: string[]; products?: string[]; realWorld?: string; for?: BalancerMode }

export const compounds = (eq: Equation) => [...eq.reactants, ...eq.products];
export const elementsOf = (eq: Equation) => Array.from(new Set(compounds(eq).flatMap(c => Object.keys(c.atoms))));

export function toEquation(e: LessonEquation): Equation | null {
  const bank = EQUATION_BANK.find(b => b.id === e.id);
  const reactants = e.reactants?.length ? e.reactants : bank?.reactants;
  const products = e.products?.length ? e.products : bank?.products;
  if (!reactants?.length || !products?.length) return null;
  try {
    const c = (f: string): Compound => ({ formula: plainFormula(f), atoms: parseFormula(f) });
    return { id: e.id, name: e.name || bank?.name || '', reactants: reactants.map(c), products: products.map(c), realWorld: e.realWorld,
      ...(e.for ? { for: e.for } : {}) };
  } catch { return null; }
}

/** Atom totals on one side for the given numbers in front. */
export function sideCounts(side: Compound[], coefficients: number[]): Atoms {
  const out: Atoms = {};
  side.forEach((c, i) => { for (const [e, n] of Object.entries(c.atoms)) out[e] = (out[e] ?? 0) + n * (coefficients[i] ?? 1); });
  return out;
}
const split = (eq: Equation, coefficients: number[]) =>
  [coefficients.slice(0, eq.reactants.length), coefficients.slice(eq.reactants.length)] as const;
export function counts(eq: Equation, coefficients: number[]) {
  const [l, r] = split(eq, coefficients);
  return { left: sideCounts(eq.reactants, l), right: sideCounts(eq.products, r) };
}
export function unbalancedElements(eq: Equation, coefficients: number[]): string[] {
  const { left, right } = counts(eq, coefficients);
  return elementsOf(eq).filter(e => (left[e] ?? 0) !== (right[e] ?? 0));
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const gcdAll = (xs: number[]) => xs.reduce((g, x) => gcd(g, x), 0);

const keyCache = new Map<string, number[] | null>();
/** The smallest whole-number coefficients, all reactants then all products, searched up to MAX_COEFFICIENT. */
export function solveKey(eq: Equation): number[] | null {
  const sig = `${eq.reactants.map(c => c.formula).join('+')}>${eq.products.map(c => c.formula).join('+')}`;
  if (keyCache.has(sig)) return keyCache.get(sig)!;
  const n = compounds(eq).length;
  const cur = Array(n).fill(1);
  let found: number[] | null = null;
  // Lexicographic from all ones: with one-dimensional solutions the first balanced set is the smallest.
  for (;;) {
    if (!unbalancedElements(eq, cur).length) { const g = gcdAll(cur); found = cur.map(x => x / g); break; }
    let k = n - 1;
    while (k >= 0 && cur[k] === MAX_COEFFICIENT) { cur[k] = 1; k--; }
    if (k < 0) break;
    cur[k]++;
  }
  keyCache.set(sig, found);
  return found;
}

/** An element in two or more compounds on one side: fixing one element moves another. */
export function sharedElements(eq: Equation): string[] {
  const inTwo = (side: Compound[]) => elementsOf(eq).filter(e => side.filter(c => c.atoms[e]).length > 1);
  return Array.from(new Set([...inTwo(eq.reactants), ...inTwo(eq.products)]));
}
export const hasGroups = (eq: Equation) => compounds(eq).some(c => c.formula.includes('('));

/** The balance mode an equation belongs to, or null when it cannot be asked (already balanced at all ones, no key). */
export function balanceModeOf(eq: Equation): BalanceMode | null {
  const key = solveKey(eq);
  if (!key || key.every(k => k === 1)) return null;
  return sharedElements(eq).length ? 'complex' : 'guided';
}

/** Structural size of a balance task: compounds, elements, big numbers, groups, shared elements. */
export function balanceRank(eq: Equation): number {
  const key = solveKey(eq) ?? [];
  const max = Math.max(1, ...key);
  return compounds(eq).length + elementsOf(eq).length + (max >= 4 ? 1 : 0) + (max >= 6 ? 1 : 0)
    + (hasGroups(eq) ? 1 : 0) + 2 * sharedElements(eq).length;
}

// ── Items ────────────────────────────────────────────────────────────────────────────────

export type Side = 'left' | 'right';
export interface CountItem { id: string; mode: 'simple'; equation: Equation; coefficients: number[]; side: Side; element: string; choices: string[] }
export interface BalanceItem { id: string; mode: BalanceMode; equation: Equation; key: number[] }
export type BalancerItem = CountItem | BalanceItem;

/** The count misses, as values a learner could reach on this target. */
export type CountMiss = 'ignored_coefficient' | 'ignored_subscript' | 'ignored_parentheses' | 'one_compound_only'
  | 'added_not_multiplied' | 'miscounted';
/** The balance misses: balanced but not the smallest numbers; the one element off is a shared one; one off; several. */
export type BalanceMiss = 'not_lowest' | 'shared_element_off' | 'one_element_off' | 'several_off';
export type EquationBalancerMiss = CountMiss | BalanceMiss;

const sideOf = (eq: Equation, side: Side) => (side === 'left' ? eq.reactants : eq.products);
const coefsOf = (eq: Equation, coefficients: number[], side: Side) => split(eq, coefficients)[side === 'left' ? 0 : 1];

/** The wrong totals a count target allows, by miss, in priority order (never equal to the key). */
export function countValues(eq: Equation, coefficients: number[], side: Side, element: string) {
  const comps = sideOf(eq, side), coefs = coefsOf(eq, coefficients, side);
  const holding = comps.map((c, i) => ({ c, k: coefs[i] })).filter(x => x.c.atoms[element]);
  const key = holding.reduce((s, x) => s + x.k * x.c.atoms[element], 0);
  const raw: Array<[CountMiss, number]> = [
    ['ignored_coefficient', holding.reduce((s, x) => s + x.c.atoms[element], 0)],
    ['ignored_subscript', holding.reduce((s, x) => s + x.k, 0)],
    ['ignored_parentheses', holding.reduce((s, x) => s + x.k * (parseFormula(x.c.formula, true)[element] ?? 0), 0)],
    ['one_compound_only', holding.length > 1 ? holding[0].k * holding[0].c.atoms[element] : key],
    ['added_not_multiplied', holding.reduce((s, x) => s + x.k + x.c.atoms[element], 0)],
  ];
  const wrongs: Array<[CountMiss, number]> = [];
  for (const [m, v] of raw) if (v > 0 && v !== key && !wrongs.some(([, w]) => w === v)) wrongs.push([m, v]);
  return { key, wrongs, holding: holding.length };
}

/**
 * Structural size of a count target: one compound holds the element (1) or two or more (3); plus one when one
 * compound needs both its numbers (a number in front and a small number above 1); plus one when a group multiplies it.
 */
export function countRank(item: Pick<CountItem, 'equation' | 'side' | 'element' | 'coefficients'>): number {
  const comps = sideOf(item.equation, item.side), ks = coefsOf(item.equation, item.coefficients, item.side);
  const holding = comps.map((c, i) => ({ c, k: ks[i] })).filter(x => x.c.atoms[item.element]);
  const both = holding.some(x => x.k > 1 && x.c.atoms[item.element] > 1);
  const grouped = holding.some(x => (parseFormula(x.c.formula, true)[item.element] ?? 0) !== x.c.atoms[item.element]);
  return (holding.length > 1 ? 3 : 1) + (both ? 1 : 0) + (grouped ? 1 : 0);
}

/** The count target on an equation printed at its key: the side and element with the most telling wrong totals. */
export function countItem(eq: Equation, suffix = '', nChoices = 4): CountItem | null {
  const key = solveKey(eq);
  if (!key) return null;
  let best: CountItem | null = null, bestScore = -1;
  for (const side of ['right', 'left'] as Side[]) {
    for (const element of elementsOf(eq)) {
      const v = countValues(eq, key, side, element);
      if (!v.key || !v.wrongs.some(([m]) => m === 'ignored_coefficient')) continue;
      // Prefer a target where both numbers matter (the number in front and the small number), then more wrong totals.
      const both = v.wrongs.some(([m]) => m === 'ignored_subscript');
      const score = (both ? 100 : 0) + v.wrongs.length * 10 + v.holding;
      if (score <= bestScore) continue;
      const fill = [v.key + 1, v.key - 1, v.key + 2, v.key + 3].filter(x => x > 0 && x !== v.key && !v.wrongs.some(([, w]) => w === x));
      const values = [v.key, ...v.wrongs.map(([, w]) => w), ...fill].slice(0, nChoices).sort((a, b) => a - b);
      best = { id: `simple-${eq.id}${suffix}`, mode: 'simple', equation: eq, coefficients: key, side, element, choices: values.map(String) };
      bestScore = score;
    }
  }
  return best;
}

export function balanceItem(eq: Equation, suffix = ''): BalanceItem | null {
  const mode = balanceModeOf(eq), key = solveKey(eq);
  if (!mode || !key) return null;
  return { id: `${mode}-${eq.id}${suffix}`, mode, equation: eq, key };
}

/** The data the items are built from. Legacy content (per-challenge formulas) is read the same way. */
export interface BalancerSource {
  equations?: LessonEquation[];
  challengeTypes?: BalancerMode[];
  gradeBand?: '6-7' | '7-8';
  challenges?: Array<{ equationData?: { reactants?: Array<{ formula: string }>; products?: Array<{ formula: string }> } }>;
}

export function lessonEquations(data: BalancerSource): Equation[] {
  const given: LessonEquation[] = data.equations?.length ? data.equations
    : (data.challenges ?? []).flatMap((c, i) => c.equationData?.reactants?.length && c.equationData.products?.length
      ? [{ id: `eq${i + 1}`, reactants: c.equationData.reactants.map(r => r.formula), products: c.equationData.products.map(p => p.formula) }] : []);
  const seen = new Set<string>();
  return given.map(toEquation).filter((e): e is Equation => {
    if (!e) return false;
    const sig = `${e.reactants.map(c => c.formula).join('+')}>${e.products.map(c => c.formula).join('+')}`;
    if (seen.has(sig)) return false;
    seen.add(sig); return true;
  });
}

/** The modes a payload asks for: its pin, else count and balance, with shared-element balancing at grades 7-8. */
export function resolveBalancerModes(data: Pick<BalancerSource, 'challengeTypes' | 'gradeBand'>): BalancerMode[] {
  const asked = (data.challengeTypes ?? []).filter((m): m is BalancerMode => (BALANCER_MODES as string[]).includes(m));
  if (asked.length) return BALANCER_MODES.filter(m => asked.includes(m));
  return data.gradeBand === '7-8' ? BALANCER_MODES : ['simple', 'guided'];
}

const CAP: Record<BalancerMode, [number, number]> = { simple: [4, 2], guided: [3, 2], complex: [3, 2] };

/**
 * Every item of the session, in mode order, each mode smallest structure first. An equation serves one mode only: a
 * count item prints an equation at its key, so it is never also a balance item in the same session. Balance items are
 * chosen first; an equation tagged `for` a mode serves only that mode.
 */
export function balancerItems(data: BalancerSource): BalancerItem[] {
  const modes = resolveBalancerModes(data);
  const eqs = lessonEquations(data);
  const cap = (m: BalancerMode) => CAP[m][modes.length === 1 ? 0 : 1];
  const fits = (e: Equation, m: BalancerMode) => !e.for || e.for === m;
  const used = new Set<string>();
  const byMode = new Map<BalancerMode, BalancerItem[]>();
  for (const mode of modes.filter(m => m !== 'simple') as BalanceMode[]) {
    const picked = eqs.filter(e => fits(e, mode) && !used.has(e.id) && balanceModeOf(e) === mode)
      .sort((a, b) => balanceRank(a) - balanceRank(b)).slice(0, cap(mode));
    picked.forEach(e => used.add(e.id));
    byMode.set(mode, picked.map(e => balanceItem(e)!));
  }
  if (modes.includes('simple')) {
    byMode.set('simple', eqs.filter(e => fits(e, 'simple') && !used.has(e.id)).map(e => countItem(e)).filter((i): i is CountItem => !!i)
      .sort((a, b) => countRank(a) - countRank(b)).slice(0, cap('simple')));
  }
  return modes.flatMap(m => byMode.get(m) ?? []);
}

// ── Keys and checks (never published to the tutor) ───────────────────────────────────────

export const countKey = (item: CountItem) => String(countValues(item.equation, item.coefficients, item.side, item.element).key);
export const countCorrect = (item: CountItem | undefined, choice: string | null) => !!item && choice !== null && choice === countKey(item);

/** Balanced at the smallest whole numbers (with one-dimensional solutions, exactly the key). */
export const balanceCorrect = (item: BalanceItem, coefficients: number[]) =>
  !unbalancedElements(item.equation, coefficients).length && gcdAll(coefficients) === 1;

export function countMiss(item: CountItem | undefined, choice: string | null): CountMiss | undefined {
  if (!item || choice === null || countCorrect(item, choice) || !item.choices.includes(choice)) return undefined;
  const v = countValues(item.equation, item.coefficients, item.side, item.element);
  return v.wrongs.find(([, w]) => String(w) === choice)?.[0] ?? 'miscounted';
}

export function balanceMiss(item: BalanceItem, coefficients: number[]): BalanceMiss | undefined {
  if (balanceCorrect(item, coefficients)) return undefined;
  const off = unbalancedElements(item.equation, coefficients);
  if (!off.length) return 'not_lowest';
  if (off.length > 1) return 'several_off';
  return item.mode === 'complex' && sharedElements(item.equation).includes(off[0]) ? 'shared_element_off' : 'one_element_off';
}

// ── The ask and the spoken key ────────────────────────────────────────────────────────────────────────────────

const ARROW = '→';
/** The equation as text, with the numbers in front when given ("4 Fe + 3 O2 → 2 Fe2O3"). */
export function equationText(eq: Equation, coefficients?: number[]): string {
  const part = (side: Compound[], ks?: number[]) => side.map((c, i) => (ks ? `${ks[i]} ${c.formula}` : c.formula)).join(' + ');
  const [l, r] = coefficients ? split(eq, coefficients) : [undefined, undefined];
  return `${part(eq.reactants, l)} ${ARROW} ${part(eq.products, r)}`;
}
const sideWords = (side: Side) => (side === 'left' ? 'the reactant side, left of the arrow' : 'the product side, right of the arrow');

export function askOf(item: BalancerItem): string {
  if (item.mode === 'simple') {
    return `In ${equationText(item.equation, item.coefficients)}, how many ${elementName(item.element)} (${item.element}) atoms are on ${sideWords(item.side)}?`;
  }
  return `Balance ${equationText(item.equation)}: set the number in front of each formula so each kind of atom has the same count on both sides, with the smallest whole numbers.`;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const said = (n: string) => NUMBER_WORDS[Number(n)] ?? n;
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

export const balancerMode = (item: BalancerItem): BalancerMode => item.mode;

/** What the ask says by design: a count ask prints the equation with its numbers, one of which can be the count. */
export const balancerGiven = (item: BalancerItem): string[] =>
  (item.mode === 'simple' ? [equationText(item.equation, item.coefficients)] : []);

/**
 * The key a spoken count is judged against: the number said any way, with "atoms" or by its place in the list. A
 * balance item has no key: the learner sets the numbers on screen and the activity checks them.
 */
export function balancerKey(item: BalancerItem): SpokenKey | null {
  if (item.mode !== 'simple') return null;
  const key = countKey(item), at = item.choices.indexOf(key);
  const others = item.choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  return { answer: key, alsoAccept: [said(key), `${key} atoms`, `the ${ORDINAL[at] ?? 'last'} one`].filter(a => a !== key),
    acceptRule: 'The number said any way counts.',
    signatureError: `${others} are wrong, and so is naming two numbers or hedging between them.` };
}

const quoted = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(', ');

/** A spoken count's known wrong answers, most specific first, with the tap's miss ids. */
export function countSpokenMisses(item: CountItem): KnownMiss[] {
  const fact = `There are ${countKey(item)} ${elementName(item.element)} atoms on ${sideWords(item.side)}.`;
  const what: Record<CountMiss, string> = {
    ignored_coefficient: 'counts one molecule of each formula, leaving out the number in front',
    ignored_subscript: 'counts the molecules, leaving out the small number after the symbol',
    ignored_parentheses: 'leaves out the small number after the brackets',
    one_compound_only: 'counts only one of the formulas that hold this element',
    added_not_multiplied: 'adds the number in front to the small number instead of multiplying',
    miscounted: 'is a near miss',
  };
  return BALANCER_MISSES.simple.flatMap(m => {
    const hits = item.choices.filter(c => countMiss(item, c) === m);
    return hits.length ? [{ id: m, pattern: `${fact} The learner's answer ${what[m as CountMiss]}: ${quoted(hits)}.`, examples: hits.flatMap(h => [h, said(h)]) }] : [];
  });
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface BalancerView {
  /** simple: the number chosen. */
  choice: string | null;
  /** guided, complex: the numbers in front now on screen, all reactants then all products. */
  coefficients: number[];
}

export function describeBalancerWork(item: BalancerItem | undefined, view: BalancerView): string {
  if (!item) return 'Nothing yet';
  if (item.mode === 'simple') return view.choice ? `Chose ${view.choice}` : 'Nothing chosen yet';
  return view.coefficients.every(k => k === 1) ? `Every number is still 1: ${equationText(item.equation, view.coefficients)}`
    : `Set ${equationText(item.equation, view.coefficients)}`;
}

/** What the learner works out is the question: never said for them. How they answer is the card's `moves`. */
const BALANCE_RULE = 'Never say a number to set, an atom total, or which formula to change, and never name the element '
  + 'that is off or the element to start with: ask which element the learner will count first, then to count it on each '
  + 'side and say what they find.';
const CONSTRAINTS: Record<BalancerMode, string> = {
  simple: 'Never say an atom total or multiply the numbers for the learner; ask what the number in front and the small '
    + 'number after the symbol each mean.',
  guided: BALANCE_RULE,
  complex: BALANCE_RULE,
};

/** What is drawn and asked. Never a count the learner has not been shown, never the key. */
export function workspaceScene(item: BalancerItem, view: BalancerView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'simple') {
    facts.choices = item.choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    facts.shown = `The equation ${equationText(item.equation, item.coefficients)}, printed with its numbers in front. No atoms are drawn and no totals are shown.`;
  } else {
    facts.shown = 'Each formula with a number in front of it; the numbers start at 1. No atoms are drawn, no atom totals '
      + 'are shown and nothing marks which elements match.';
    facts.onScreenNow = equationText(item.equation, view.coefficients);
  }
  facts.learnerWork = describeBalancerWork(item, view);
  facts.constraints = CONSTRAINTS[item.mode];
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

export const addLabel = (formula: string) => `Add one ${formula}`;
export const removeLabel = (formula: string) => `Remove one ${formula}`;

/**
 * The journey's answers. simple: the key and the wrong number with the most telling miss. Balance: the + presses that
 * take every number from 1 to the key, and a wrong set (only the first formula raised, which leaves an element off).
 */
export function balancerHarnessAnswers(item: BalancerItem): { correct: string[]; plainWrong: string[] } {
  if (item.mode === 'simple') {
    const rank = BALANCER_MISSES.simple;
    const wrong = item.choices.filter(c => !countCorrect(item, c)).sort((a, b) => rank.indexOf(countMiss(item, a)!) - rank.indexOf(countMiss(item, b)!));
    return { correct: [countKey(item)], plainWrong: [wrong[0] ?? ''] };
  }
  const all = compounds(item.equation);
  const correct = all.flatMap((c, i) => Array(item.key[i] - 1).fill(addLabel(c.formula)) as string[]);
  // A wrong set: raise the compound whose key is largest to its key and leave the rest at 1 (never balanced).
  const at = item.key.indexOf(Math.max(...item.key));
  const wrongSet = all.map((_, i) => (i === at ? item.key[i] : 1));
  const plainWrong = balanceCorrect(item, wrongSet) ? [] : Array(item.key[at] - 1).fill(addLabel(all[at].formula)) as string[];
  return { correct, plainWrong };
}
