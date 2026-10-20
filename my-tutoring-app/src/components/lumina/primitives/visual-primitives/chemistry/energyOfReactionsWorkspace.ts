/**
 * energy-of-reactions' items, keys, misses and scene: the pure half of its boss (`energyOfReactions.boss.ts`, a
 * SAY_OR_SHOW card on the spoken preset).
 *
 * Every item is built and keyed by code; the generator only picks which library reactions the lesson runs and writes
 * the title. Each mode is one closed choice the learner taps and checks, or says (J14):
 * - classify: a named reaction is run in a beaker of water with a thermometer; from the temperature change, say whether
 *   it releases or absorbs energy. Key: the sign of the temperature change (warmer water: released).
 * - diagram: an unlabelled energy diagram on a kJ grid (no arrows, no values); read the direction, the energy change,
 *   the activation energy, or how much a catalyst lowers it. Key: arithmetic on the drawn levels.
 * - bond_energy: a table of the bonds broken and formed (count and energy per bond, no totals); choose the energy change.
 *   Key: energy in (breaking) minus energy out (forming), from a code table of average bond energies.
 *
 * Pure: the component, the boss, the levers and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { ENERGY_MISSES } from './energyOfReactions.card';

export type EnergyMode = 'classify' | 'diagram' | 'bond_energy';
export const ENERGY_MODES: EnergyMode[] = ['classify', 'diagram', 'bond_energy'];
export type EnergyBand = '5-6' | '7-8';

/** What the session data needs (the component's `EnergyOfReactionsData` is a superset). */
export interface EnergySource {
  reactionIds?: string[];
  challengeTypes?: string[];
  gradeBand?: EnergyBand;
}

// ── The thermometer reactions (classify) ────────────────────────────────────────────────

export interface ThermoReaction {
  id: string;
  /** Names never say heat, cold, burning or what the reaction is used for. */
  name: string;
  words: string;
  formula: string;
  /** Classroom readings (°C) of the water the reaction runs in. */
  start: number;
  end: number;
  /** Shown only after credit. */
  fact: string;
}

export const THERMO_REACTIONS: readonly ThermoReaction[] = [
  { id: 'baking_soda_vinegar', name: 'Baking soda and vinegar', words: 'baking soda + vinegar → sodium acetate + water + carbon dioxide',
    formula: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂', start: 21, end: 16,
    fact: 'The fizzing feels cool: the reaction takes energy from the water, so it is endothermic.' },
  { id: 'citric_acid_baking_soda', name: 'Citric acid and baking soda', words: 'citric acid + baking soda → sodium citrate + water + carbon dioxide',
    formula: 'C₆H₈O₇ + 3NaHCO₃ → Na₃C₆H₅O₇ + 3H₂O + 3CO₂', start: 21, end: 13,
    fact: 'This is the fizz in a bath bomb or sherbet; it takes in energy, so it is endothermic.' },
  { id: 'barium_hydroxide_ammonium_chloride', name: 'Barium hydroxide and ammonium chloride', words: 'barium hydroxide + ammonium chloride → barium chloride + ammonia + water',
    formula: 'Ba(OH)₂ + 2NH₄Cl → BaCl₂ + 2NH₃ + 2H₂O', start: 20, end: -8,
    fact: 'This one gets cold enough to freeze a wet board to the flask: strongly endothermic.' },
  { id: 'sodium_bicarbonate_hcl', name: 'Sodium bicarbonate and hydrochloric acid', words: 'sodium bicarbonate + hydrochloric acid → sodium chloride + water + carbon dioxide',
    formula: 'NaHCO₃ + HCl → NaCl + H₂O + CO₂', start: 21, end: 18,
    fact: 'A small drop in temperature, but a drop: it takes in energy, so it is endothermic.' },
  { id: 'magnesium_hcl', name: 'Magnesium and hydrochloric acid', words: 'magnesium + hydrochloric acid → magnesium chloride + hydrogen',
    formula: 'Mg + 2HCl → MgCl₂ + H₂', start: 21, end: 38,
    fact: 'The metal fizzes away and the tube gets warm: it gives energy to the water, so it is exothermic.' },
  { id: 'hcl_naoh', name: 'Hydrochloric acid and sodium hydroxide', words: 'hydrochloric acid + sodium hydroxide → sodium chloride + water',
    formula: 'HCl + NaOH → NaCl + H₂O', start: 21, end: 28,
    fact: 'Every acid and base that neutralize each other give off energy: exothermic.' },
  { id: 'peroxide_yeast', name: 'Hydrogen peroxide and yeast', words: 'hydrogen peroxide → water + oxygen (yeast speeds it up)',
    formula: '2H₂O₂ → 2H₂O + O₂', start: 21, end: 32,
    fact: 'The foam is oxygen, and the bottle warms up: exothermic.' },
  { id: 'quicklime_water', name: 'Calcium oxide and water', words: 'calcium oxide + water → calcium hydroxide',
    formula: 'CaO + H₂O → Ca(OH)₂', start: 21, end: 55,
    fact: 'Calcium oxide is quicklime; this is how some ready meals heat themselves: exothermic.' },
  { id: 'zinc_copper_sulfate', name: 'Zinc and copper sulfate', words: 'zinc + copper sulfate → zinc sulfate + copper',
    formula: 'Zn + CuSO₄ → ZnSO₄ + Cu', start: 21, end: 34,
    fact: 'Copper metal appears and the solution warms: exothermic.' },
  { id: 'iron_oxygen', name: 'Steel wool and oxygen', words: 'iron + oxygen → iron oxide (rust)',
    formula: '4Fe + 3O₂ → 2Fe₂O₃', start: 21, end: 25,
    fact: 'Rusting is slow, but wet steel wool rusts fast enough to warm up: exothermic.' },
];
export const thermoReaction = (id: string) => THERMO_REACTIONS.find(r => r.id === id);
/** A reaction name that says how it feels or what it is for answers the item. */
export const NAME_LEAKS = /\b(heat|hot|warm\w*|cold|cool\w*|burn\w*|combust\w*|fire|flame|ice|freez\w*|exo\w*|endo\w*)\b/i;
export const releases = (r: Pick<ThermoReaction, 'start' | 'end'>) => r.end > r.start;

/** The library reactions a session runs: the generator's picks, at least one of each kind, at most `cap`. */
export function classifyReactions(ids: readonly string[] | undefined, cap: number): ThermoReaction[] {
  const picked = Array.from(new Set(ids ?? [])).map(thermoReaction).filter((r): r is ThermoReaction => !!r);
  const pool = alternate(picked.length ? picked : [...THERMO_REACTIONS]);
  let out = pool.slice(0, cap);
  for (const wantRelease of [true, false]) {
    if (out.some(r => releases(r) === wantRelease)) continue;
    const add = pool.find(r => releases(r) === wantRelease && !out.includes(r))
      ?? THERMO_REACTIONS.find(r => releases(r) === wantRelease && !out.includes(r))!;
    out = out.length >= cap ? [...out.slice(0, cap - 1), add] : [...out, add];
  }
  // The kinds alternate as far as the picks allow, so the order of the items carries no pattern to copy.
  return alternate(out);
}
function alternate(rs: ThermoReaction[]): ThermoReaction[] {
  const a = rs.filter(releases), b = rs.filter(r => !releases(r)), out: ThermoReaction[] = [];
  const first = rs[0] && releases(rs[0]) ? [a, b] : [b, a];
  while (first[0].length || first[1].length) {
    if (first[0].length) out.push(first[0].shift()!);
    if (first[1].length) out.push(first[1].shift()!);
  }
  return out;
}

// ── Energy diagrams (diagram) ───────────────────────────────────────────────────────────

export type DiagramKind = 'direction' | 'amount' | 'delta_h' | 'activation' | 'catalyst';
/** Levels in kJ on a 50 kJ grid, axis 0-600. `catalyst` is the peak with a catalyst. */
export interface DiagramLevels { reactants: number; products: number; peak: number; catalyst?: number }
export const AXIS_MAX = 600;
export const GRID = 50;

/** Templates, chosen so that every distractor of every kind is a different number from the key. */
export const DIAGRAMS: Record<string, DiagramLevels> = {
  A: { reactants: 350, products: 100, peak: 500 },
  B: { reactants: 100, products: 300, peak: 450 },
  C: { reactants: 450, products: 250, peak: 550 },
  D: { reactants: 150, products: 400, peak: 500 },
  E: { reactants: 300, products: 50, peak: 500 },
  CAT1: { reactants: 400, products: 150, peak: 550, catalyst: 450 },
  CAT2: { reactants: 150, products: 350, peak: 550, catalyst: 400 },
};
const DIAGRAM_PLAN: Record<EnergyBand, Array<[DiagramKind, string]>> = {
  '5-6': [['direction', 'B'], ['amount', 'A'], ['activation', 'D']],
  '7-8': [['direction', 'C'], ['delta_h', 'B'], ['activation', 'A'], ['catalyst', 'CAT1']],
};
/** The other template of the same kind, for the simpler practice item. */
export const PRACTICE_DIAGRAM: Record<string, string> = { A: 'E', B: 'D', C: 'A', D: 'B', E: 'A', CAT1: 'CAT2', CAT2: 'CAT1' };

export const deltaH = (l: DiagramLevels) => l.products - l.reactants;
export const activation = (l: DiagramLevels) => l.peak - l.reactants;

// ── Bond-energy reactions (bond_energy) ─────────────────────────────────────────────────

/** Average bond energies, kJ per mole of bonds. */
export const BOND_ENERGY: Record<string, number> = {
  'H–H': 436, 'Cl–Cl': 243, 'H–Cl': 432, 'Br–Br': 193, 'H–Br': 366, 'I–I': 151, 'H–I': 299,
  'O=O': 498, 'O–H': 463, 'C–H': 413, 'C=O': 799, 'N≡N': 945, 'N–H': 391, 'C=C': 614, 'C–C': 348,
};
export interface BondRow { bond: string; count: number }
export interface BondReaction { id: string; name: string; equation: string; broken: BondRow[]; formed: BondRow[] }

export const BOND_REACTIONS: readonly BondReaction[] = [
  { id: 'h2_cl2', name: 'Hydrogen and chlorine', equation: 'H₂ + Cl₂ → 2HCl',
    broken: [{ bond: 'H–H', count: 1 }, { bond: 'Cl–Cl', count: 1 }], formed: [{ bond: 'H–Cl', count: 2 }] },
  { id: 'h2_br2', name: 'Hydrogen and bromine', equation: 'H₂ + Br₂ → 2HBr',
    broken: [{ bond: 'H–H', count: 1 }, { bond: 'Br–Br', count: 1 }], formed: [{ bond: 'H–Br', count: 2 }] },
  { id: 'hi_split', name: 'Hydrogen iodide splitting', equation: '2HI → H₂ + I₂',
    broken: [{ bond: 'H–I', count: 2 }], formed: [{ bond: 'H–H', count: 1 }, { bond: 'I–I', count: 1 }] },
  { id: 'water_split', name: 'Splitting water', equation: '2H₂O → 2H₂ + O₂',
    broken: [{ bond: 'O–H', count: 4 }], formed: [{ bond: 'H–H', count: 2 }, { bond: 'O=O', count: 1 }] },
  { id: 'ammonia', name: 'Making ammonia', equation: 'N₂ + 3H₂ → 2NH₃',
    broken: [{ bond: 'N≡N', count: 1 }, { bond: 'H–H', count: 3 }], formed: [{ bond: 'N–H', count: 6 }] },
  { id: 'ethene_h2', name: 'Adding hydrogen to ethene', equation: 'C₂H₄ + H₂ → C₂H₆',
    broken: [{ bond: 'C=C', count: 1 }, { bond: 'C–H', count: 4 }, { bond: 'H–H', count: 1 }], formed: [{ bond: 'C–C', count: 1 }, { bond: 'C–H', count: 6 }] },
  { id: 'methane_o2', name: 'Methane and oxygen', equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
    broken: [{ bond: 'C–H', count: 4 }, { bond: 'O=O', count: 2 }], formed: [{ bond: 'C=O', count: 2 }, { bond: 'O–H', count: 4 }] },
];
export const bondReaction = (id: string) => BOND_REACTIONS.find(r => r.id === id);
/** Structural size: bond rows, then bonds counted. */
export const bondSize = (r: BondReaction) => [r.broken.length + r.formed.length, [...r.broken, ...r.formed].reduce((s, b) => s + b.count, 0)] as const;
const total = (rows: BondRow[]) => rows.reduce((s, b) => s + BOND_ENERGY[b.bond] * b.count, 0);
const once = (rows: BondRow[]) => rows.reduce((s, b) => s + BOND_ENERGY[b.bond], 0);
export const energyIn = (r: BondReaction) => total(r.broken);
export const energyOut = (r: BondReaction) => total(r.formed);
export const bondDeltaH = (r: BondReaction) => energyIn(r) - energyOut(r);
/** A pinned session: small, medium, large, with both signs. */
const BOND_PLAN: Record<'pinned' | 'blended', string[]> = { pinned: ['h2_cl2', 'water_split', 'methane_o2'], blended: ['h2_cl2', 'water_split'] };

// ── Items ─────────────────────────────────────────────────────────────────────────────────

export const RELEASE = 'Releases energy (exothermic)';
export const ABSORB = 'Absorbs energy (endothermic)';
export const DIRECTION_CHOICES = [RELEASE, ABSORB] as const;

interface ItemBase { id: string; mode: EnergyMode; choices: readonly string[] }
export interface ClassifyItem extends ItemBase { mode: 'classify'; reaction: ThermoReaction; band: EnergyBand }
export interface DiagramItem extends ItemBase { mode: 'diagram'; kind: DiagramKind; template: string; levels: DiagramLevels; label: string }
export interface BondItem extends ItemBase { mode: 'bond_energy'; reaction: BondReaction }
export type EnergyItem = ClassifyItem | DiagramItem | BondItem;

const kj = (n: number, signed: boolean) => `${signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : ''}${Math.abs(n)} kJ`;
/** Parse a choice label back to its number ("−185 kJ" → -185). */
export const choiceValue = (label: string) => {
  const m = /^([+−-]?)(\d+) kJ$/.exec(label);
  return m ? (m[1] === '−' || m[1] === '-' ? -1 : 1) * Number(m[2]) : NaN;
};

/** Every candidate answer with the miss it would show (null for the key). Distinct values only, the key first. */
export function diagramCandidates(kind: DiagramKind, l: DiagramLevels): Array<[number, DiagramMiss | null]> {
  const dh = deltaH(l), ea = activation(l);
  const raw: Array<[number, DiagramMiss | null]> =
    kind === 'amount' ? [[Math.abs(dh), null], [l.products, 'read_level'], [ea, 'read_activation'], [l.peak, 'read_peak_height']]
      : kind === 'delta_h' ? [[dh, null], [-dh, 'sign_flipped'], [l.products, 'read_level'], [ea, 'read_activation']]
        : kind === 'activation' ? [[ea, null], [l.peak, 'read_peak_height'], [Math.abs(dh), 'read_delta_h'], [l.peak - l.products, 'from_products']]
          : kind === 'catalyst' ? [[l.peak - (l.catalyst ?? l.peak), null], [(l.catalyst ?? 0) - l.reactants, 'catalysed_ea'], [ea, 'full_ea'], [Math.abs(dh), 'read_delta_h']]
            : [];
  const seen = new Set<number>();
  return raw.filter(([v]) => !seen.has(v) && !!seen.add(v));
}
const signedKind = (kind: DiagramKind) => kind === 'delta_h';

const ASK_DIAGRAM: Record<DiagramKind, string> = {
  direction: 'Does this reaction release energy or absorb energy?',
  amount: 'How much energy does this reaction release or absorb?',
  delta_h: 'What is the energy change (ΔH) of this reaction?',
  activation: 'What is the activation energy of this reaction?',
  catalyst: 'By how much does the catalyst lower the activation energy?',
};

export function diagramItem(kind: DiagramKind, template: string, label: string, suffix = ''): DiagramItem {
  const levels = DIAGRAMS[template];
  const choices = kind === 'direction' ? DIRECTION_CHOICES
    : diagramCandidates(kind, levels).map(([v]) => v).sort((a, b) => a - b).map(v => kj(v, signedKind(kind)));
  return { id: `diagram-${kind}-${template}${suffix}`, mode: 'diagram', kind, template, levels, label, choices };
}

export function bondItem(reaction: BondReaction, suffix = ''): BondItem {
  const choices = bondCandidates(reaction).map(([v]) => v).sort((a, b) => a - b).map(v => kj(v, true));
  return { id: `bond-${reaction.id}${suffix}`, mode: 'bond_energy', reaction, choices };
}
export function bondCandidates(r: BondReaction): Array<[number, BondMiss | null]> {
  const dh = bondDeltaH(r);
  const raw: Array<[number, BondMiss | null]> = [[dh, null], [-dh, 'subtracted_backwards'],
    [once(r.broken) - once(r.formed), 'ignored_counts'], [energyIn(r) + energyOut(r), 'added_totals']];
  const seen = new Set<number>();
  return raw.filter(([v]) => !seen.has(v) && !!seen.add(v));
}

/** The modes a payload asks for: its pin, else classify and diagram, with bond_energy at grades 7-8. */
export function resolveEnergyModes(data: EnergySource): EnergyMode[] {
  const asked = (data.challengeTypes ?? []).filter((m): m is EnergyMode => (ENERGY_MODES as string[]).includes(m));
  if (asked.length) return ENERGY_MODES.filter(m => asked.includes(m));
  return data.gradeBand === '7-8' ? ENERGY_MODES : ['classify', 'diagram'];
}

const CAP: Record<EnergyMode, [number, number]> = { classify: [5, 3], diagram: [4, 2], bond_energy: [3, 2] };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Every item of the session, in mode order. A pinned mode gets more items than a blended one. */
export function energyItems(data: EnergySource): EnergyItem[] {
  const modes = resolveEnergyModes(data);
  const band: EnergyBand = data.gradeBand === '7-8' ? '7-8' : '5-6';
  const pinned = modes.length === 1;
  const cap = (m: EnergyMode) => CAP[m][pinned ? 0 : 1];
  const out: EnergyItem[] = [];
  for (const mode of modes) {
    if (mode === 'classify') {
      out.push(...classifyReactions(data.reactionIds, cap(mode)).map((reaction): ClassifyItem =>
        ({ id: `classify-${reaction.id}`, mode, reaction, band, choices: DIRECTION_CHOICES })));
    } else if (mode === 'diagram') {
      out.push(...DIAGRAM_PLAN[band].slice(0, cap(mode)).map(([kind, t], i) => diagramItem(kind, t, `Reaction ${LETTERS[i]}`)));
    } else {
      out.push(...BOND_PLAN[pinned ? 'pinned' : 'blended'].slice(0, cap(mode)).map(id => bondItem(bondReaction(id)!)));
    }
  }
  return out;
}

// ── Keys and checks (never published to the tutor) ───────────────────────────────────────

export function keyChoice(item: EnergyItem): string {
  if (item.mode === 'classify') return releases(item.reaction) ? RELEASE : ABSORB;
  if (item.mode === 'diagram') {
    if (item.kind === 'direction') return deltaH(item.levels) < 0 ? RELEASE : ABSORB;
    return kj(diagramCandidates(item.kind, item.levels)[0][0], signedKind(item.kind));
  }
  return kj(bondDeltaH(item.reaction), true);
}
export const energyCorrect = (item: EnergyItem | undefined, choice: string | null) => !!item && choice !== null && choice === keyChoice(item);

// ── Misses: the pattern of the wrong choice, never a guessed cause ───────────────────────

/** classify: the water cooled and the learner said it releases energy; the water warmed and they said it absorbs. */
export type ClassifyMiss = 'cooling_called_release' | 'warming_called_absorb';
/** diagram: the direction reversed; a level read as the change; the sign reversed; one quantity given for another. */
export type DiagramMiss = 'direction_reversed' | 'sign_flipped' | 'read_level' | 'read_activation' | 'read_peak_height'
  | 'read_delta_h' | 'from_products' | 'catalysed_ea' | 'full_ea';
/** bond_energy: forming minus breaking; each bond counted once; the two totals added. */
export type BondMiss = 'subtracted_backwards' | 'ignored_counts' | 'added_totals';
export type EnergyMiss = ClassifyMiss | DiagramMiss | BondMiss;

export function energyMiss(item: EnergyItem | undefined, choice: string | null): EnergyMiss | undefined {
  if (!item || choice === null || energyCorrect(item, choice) || !item.choices.includes(choice)) return undefined;
  if (item.mode === 'classify') return releases(item.reaction) ? 'warming_called_absorb' : 'cooling_called_release';
  if (item.mode === 'diagram') {
    if (item.kind === 'direction') return 'direction_reversed';
    return diagramCandidates(item.kind, item.levels).find(([v]) => v === choiceValue(choice))?.[1] ?? undefined;
  }
  return bondCandidates(item.reaction).find(([v]) => v === choiceValue(choice))?.[1] ?? undefined;
}

// ── The ask and the spoken key ───────────────────────────────────────────────────────────

export const energyMode = (item: EnergyItem): EnergyMode => item.mode;

export const equationOf = (item: ClassifyItem) => (item.band === '7-8' ? item.reaction.formula : item.reaction.words);

export function askOf(item: EnergyItem): string {
  if (item.mode === 'classify') return `Run the reaction of ${item.reaction.name.toLowerCase()} in the beaker of water. Does it release energy or absorb energy?`;
  if (item.mode === 'diagram') return `${item.label}: ${ASK_DIAGRAM[item.kind]}`;
  return `${item.reaction.equation}: use the bond energies to find the energy change (ΔH) of this reaction.`;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

const SAY_DIRECTION: Record<string, { word: string; said: string[] }> = {
  [RELEASE]: { word: 'release', said: ['releases energy', 'gives off energy', 'gives off heat', 'exothermic'] },
  [ABSORB]: { word: 'absorb', said: ['absorbs energy', 'takes in energy', 'takes in heat', 'endothermic'] },
};

/**
 * The key a spoken reply is judged against. A direction item is a menu key (its ask says "release energy or absorb
 * energy"); a value is the number said any way, with its sign where the sign is the question. Each also takes the
 * choice's place in the list. The bare number is a rule, not an accepted answer.
 */
export function energyKey(item: EnergyItem): SpokenKey {
  const key = keyChoice(item), at = item.choices.indexOf(key);
  const place = `the ${ORDINAL[at] ?? 'last'} one`;
  const others = item.choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  const direction = SAY_DIRECTION[key];
  if (direction) {
    return { answer: direction.word, menu: ['release', 'absorb'], alsoAccept: [...direction.said, place],
      signatureError: `${others} is wrong, and so is naming both or hedging between them.` };
  }
  const v = choiceValue(key), n = Math.abs(v);
  const signed = item.mode === 'bond_energy' || (item.mode === 'diagram' && item.kind === 'delta_h');
  const sign = !signed ? '' : v < 0
    ? ` The sign counts: "minus", "negative" or "released" with ${n}; ${n} with the other sign is wrong.`
    : ` The sign counts: "plus", "positive" or "absorbed" with ${n}; ${n} with the other sign is wrong.`;
  return { answer: key, alsoAccept: [place],
    acceptRule: `The number ${n} said any way, with or without "kJ" or "kilojoules", counts.${sign}`,
    signatureError: `${others} are wrong.` };
}

const quoted = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(', ');

const MISS_WORDS: Record<EnergyMiss, string> = {
  cooling_called_release: 'says it releases energy, though the water got colder',
  warming_called_absorb: 'says it absorbs energy, though the water got warmer',
  direction_reversed: 'reads the direction the wrong way round',
  sign_flipped: 'has the right size with the wrong sign',
  read_level: 'is the height of the products\' line, read from zero',
  read_activation: 'is the climb from the reactants to the top of the hill',
  read_peak_height: 'is the height of the top of the hill, read from zero',
  read_delta_h: 'is the gap between the reactants and the products',
  from_products: 'is the climb measured from the products instead of the reactants',
  catalysed_ea: 'is the climb on the catalyst path, not how much lower it is',
  full_ea: 'is the climb without the catalyst, not how much lower the catalyst path is',
  subtracted_backwards: 'is energy out minus energy in (the sign reversed)',
  ignored_counts: 'uses each bond once, ignoring how many of each there are',
  added_totals: 'adds the two totals instead of taking one from the other',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function energySpokenMisses(item: EnergyItem): KnownMiss[] {
  const groups = new Map<EnergyMiss, string[]>();
  for (const c of item.choices) {
    const m = energyMiss(item, c);
    if (m) groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const fact = `The right choice is "${keyChoice(item)}".`;
  return ENERGY_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${MISS_WORDS[m]}: ${quoted(groups.get(m)!)}.`, examples: groups.get(m)!.slice(0, 6) }));
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface EnergyView {
  choice: string | null;
  /** classify: the reaction has been run (the thermometer shows the end reading). */
  ran: boolean;
  /** The item is credited (its reveal is on screen). */
  solved: boolean;
}

export const describeEnergyWork = (item: EnergyItem | undefined, view: Pick<EnergyView, 'choice'>) =>
  item && view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';

/**
 * What the learner reads and works out is the question: never said for them. How they answer is the card's `moves`.
 * classify: the change in the reading and what it means; diagram and bond_energy: the comparison, the arithmetic,
 * and after a miss which part of the wrong value was right.
 */
const NO_CLOSENESS = 'Never say how close a choice is; after a wrong answer, never say that its number or its sign was right.';
function constraintsOf(item: EnergyItem): string {
  if (item.mode === 'classify') {
    return 'Never say the reading went up or down or that the water warmed or cooled, what that means (that colder water '
      + 'means the reaction took energy in), or whether the reaction releases or absorbs energy; ask what the thermometer '
      + 'read before and after and what that tells the learner. Never say which side is energy in or energy out unless the '
      + 'heat-flow card is on screen. Never call the reaction hot, cold, warming or cooling as a clue, and never mention '
      + 'what it is used for (a cold pack, a hand warmer).';
  }
  if (item.mode === 'diagram') {
    return 'Never say the products are higher or lower than the reactants or what that means, whether the reaction releases '
      + 'or absorbs energy, and never work out a climb, a drop or a change for the learner; ask which line they read from '
      + `and what it tells them. ${NO_CLOSENESS}`;
  }
  return 'Never say which total is larger or which sign the answer has, and never add up a row or the totals or take one '
    + 'from the other for the learner; ask which bonds are broken and which are formed, how many of each, and which side '
    + `costs energy. ${NO_CLOSENESS}`;
}

export const bondRowsText = (rows: BondRow[]) => rows.map(b => `${b.count} × ${b.bond} at ${BOND_ENERGY[b.bond]} kJ each`).join('; ');

/** What is drawn and asked. The choices are named, never which is right. */
export function workspaceScene(item: EnergyItem, view: EnergyView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item), choices: item.choices.map((c, i) => `${i + 1}) ${c}`).join('  ') };
  if (item.mode === 'classify') {
    const r = item.reaction;
    facts.shown = `A beaker of water with a thermometer, and the reaction ${r.name.toLowerCase()} (${equationOf(item)}).`;
    facts.thermometer = view.ran
      ? `After the reaction runs in the water, the thermometer reads ${r.end} °C; it read ${r.start} °C before.`
      : `The thermometer reads ${r.start} °C. Not run yet.`;
  } else if (item.mode === 'diagram') {
    const l = item.levels;
    facts.shown = `An energy diagram for ${item.label}: energy in kJ up the side, 0 to ${AXIS_MAX} with a line every ${GRID} kJ, `
      + `reaction progress along the bottom. A flat line labelled Reactants at ${l.reactants} kJ, a curve rising to the top of a hill at `
      + `${l.peak} kJ, then down to a flat line labelled Products at ${l.products} kJ.`
      + (l.catalyst !== undefined ? ` A dashed curve labelled "with catalyst" leaves the same Reactants line, tops out at ${l.catalyst} kJ, and ends at the same Products line.` : '')
      + ' No arrows and no values are written on the diagram; the learner reads the levels off the grid.';
  } else {
    const r = item.reaction;
    facts.shown = `The equation ${r.equation} and a bond table. Bonds broken: ${bondRowsText(r.broken)}. Bonds formed: ${bondRowsText(r.formed)}. `
      + 'No totals are shown.';
  }
  facts.learnerWork = describeEnergyWork(item, view);
  facts.constraints = constraintsOf(item);
  return { objects: [], facts };
}

// ── The journey's learner (the boss's harness, the dry sweep) ────────────────────────────

/** The journey's answers: the key, and the wrong choice that shows the most telling miss. */
export function energyHarnessAnswers(item: EnergyItem): { correct: string; plainWrong: string } {
  const rank = ENERGY_MISSES[item.mode];
  const wrong = item.choices.filter(c => !energyCorrect(item, c))
    .sort((a, b) => rank.indexOf(energyMiss(item, a)!) - rank.indexOf(energyMiss(item, b)!));
  return { correct: keyChoice(item), plainWrong: wrong[0] ?? '' };
}
