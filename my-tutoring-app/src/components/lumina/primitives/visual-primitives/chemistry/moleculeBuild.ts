/**
 * molecule-constructor's open build, `make_molecule` (/add-eval-modes references/build-mode.md): the learner makes ANY
 * molecule with the asked property ("a double bond", "exactly 2 carbon atoms", "an oxygen atom") on an empty board,
 * and this code judges it at "I'm done!". A molecule passes when it is one piece, every atom's bonds equal its
 * valence, and it has every asked property. Many molecules pass every ask (the oracle searches for two itself).
 *
 * Pure: the board, the workspace scene, the journey row, the generator and the oracle all read this module.
 */

export type BondOrder = 1 | 2 | 3;
export interface BuildAtom { id: string; element: string; slot: number }
export interface BuildBond { a: string; b: string; order: BondOrder }
export interface MoleculeBuild { atoms: BuildAtom[]; bonds: BuildBond[] }
export const EMPTY_BUILD: MoleculeBuild = { atoms: [], bonds: [] };

/** How many bonds each element makes (the board's valence model, the same as the classic canvas). */
export const VALENCE: Readonly<Record<string, number>> = { H: 1, C: 4, N: 3, O: 2, F: 1, S: 2, P: 3, Cl: 1 };
export const ELEMENT_NAME: Readonly<Record<string, string>> = {
  H: 'hydrogen', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', S: 'sulfur', P: 'phosphorus', Cl: 'chlorine',
};
/** The elements a make_molecule board offers, per grade band. */
export const BUILD_PALETTE: Readonly<Record<'3-5' | '6-8', readonly string[]>> = {
  '3-5': ['H', 'C', 'N', 'O'],
  '6-8': ['H', 'C', 'N', 'O', 'S', 'Cl'],
};

/** Where atoms sit on the board (viewBox 560 x 380), centre first, so a small molecule gathers in the middle. */
export const BOARD = { width: 560, height: 380 };
export const SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 280, y: 190 }, { x: 160, y: 190 }, { x: 400, y: 190 }, { x: 280, y: 80 }, { x: 280, y: 300 },
  { x: 160, y: 80 }, { x: 400, y: 80 }, { x: 160, y: 300 }, { x: 400, y: 300 }, { x: 40, y: 190 },
  { x: 520, y: 190 }, { x: 40, y: 80 }, { x: 520, y: 80 }, { x: 40, y: 300 }, { x: 520, y: 300 },
];
export const MAX_BUILD_ATOMS = SLOTS.length;

// ── Building (the board's moves) ────────────────────────────────────────────

const valence = (element: string) => VALENCE[element] ?? 1;
const touches = (bond: BuildBond, id: string) => bond.a === id || bond.b === id;
const pairOf = (bond: BuildBond, x: string, y: string) => (bond.a === x && bond.b === y) || (bond.a === y && bond.b === x);

/** Bonds an atom has made, a double bond counting two. */
export function bondsUsed(build: MoleculeBuild, id: string): number {
  return build.bonds.filter(b => touches(b, id)).reduce((s, b) => s + b.order, 0);
}
/** Bonds the atom can still make (negative only on a build the board would never make). */
export function bondsFree(build: MoleculeBuild, atom: BuildAtom): number {
  return valence(atom.element) - bondsUsed(build, atom.id);
}

/** A new atom in the first empty slot; null when the board is full. */
export function addAtom(build: MoleculeBuild, element: string): MoleculeBuild | null {
  const taken = new Set(build.atoms.map(a => a.slot));
  const slot = SLOTS.findIndex((_, i) => !taken.has(i));
  if (slot < 0) return null;
  return { ...build, atoms: [...build.atoms, { id: `atom-${slot}`, element, slot }] };
}

/**
 * Two atoms tapped one after the other: a new single bond, or the existing bond raised one step (single → double →
 * triple). Refused, unchanged, when either atom has no bond left to make or the bond is already triple.
 */
export function joinAtoms(build: MoleculeBuild, x: string, y: string): { build: MoleculeBuild; refused: boolean } {
  const ax = build.atoms.find(a => a.id === x), ay = build.atoms.find(a => a.id === y);
  if (!ax || !ay || x === y) return { build, refused: true };
  if (bondsFree(build, ax) < 1 || bondsFree(build, ay) < 1) return { build, refused: true };
  const existing = build.bonds.find(b => pairOf(b, x, y));
  if (!existing) return { build: { ...build, bonds: [...build.bonds, { a: x, b: y, order: 1 }] }, refused: false };
  if (existing.order === 3) return { build, refused: true };
  return { build: { ...build, bonds: build.bonds.map(b => b === existing ? { ...b, order: (b.order + 1) as BondOrder } : b) }, refused: false };
}

/** A bond tapped: one step lower (triple → double → single), a single bond taken away. */
export function lowerBond(build: MoleculeBuild, x: string, y: string): MoleculeBuild {
  const existing = build.bonds.find(b => pairOf(b, x, y));
  if (!existing) return build;
  if (existing.order === 1) return { ...build, bonds: build.bonds.filter(b => b !== existing) };
  return { ...build, bonds: build.bonds.map(b => b === existing ? { ...b, order: (b.order - 1) as BondOrder } : b) };
}

/** An atom taken away, with its bonds. */
export function removeAtom(build: MoleculeBuild, id: string): MoleculeBuild {
  return { atoms: build.atoms.filter(a => a.id !== id), bonds: build.bonds.filter(b => !touches(b, id)) };
}

// ── Reading the build ───────────────────────────────────────────────────────

/** Molecular formula in Hill order: C, then H, then alphabetical (H first with no carbon too, as "H2O"). */
export function formulaOf(elements: readonly string[]): string {
  if (!elements.length) return '';
  const counts: Record<string, number> = {};
  elements.forEach(e => { counts[e] = (counts[e] ?? 0) + 1; });
  const hasC = !!counts.C;
  const order = Object.keys(counts).sort((a, b) => {
    const rank = (e: string) => hasC ? (e === 'C' ? 0 : e === 'H' ? 1 : 2) : (e === 'H' ? 0 : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return order.map(e => e + (counts[e] > 1 ? counts[e] : '')).join('');
}

export interface MoleculeReading {
  atoms: number;
  /** Bond lines drawn (a double bond is one line pair, counted once). */
  bonds: number;
  doubleBonds: number;
  tripleBonds: number;
  /** Bonds still free, summed over every atom. */
  openBonds: number;
  /** Some atom has more bonds than its valence (the board refuses this; a guard). */
  overBonded: boolean;
  /** Separate pieces (0 on an empty board). */
  pieces: number;
  carbons: number;
  counts: Record<string, number>;
  formula: string;
}

/** Which piece each atom is in, by atom id, numbered from 0 in board order. */
export function piecesOf(build: MoleculeBuild): Map<string, number> {
  const piece = new Map<string, number>();
  let next = 0;
  for (const start of build.atoms) {
    if (piece.has(start.id)) continue;
    const stack = [start.id];
    piece.set(start.id, next);
    while (stack.length) {
      const id = stack.pop()!;
      for (const b of build.bonds) {
        if (!touches(b, id)) continue;
        const other = b.a === id ? b.b : b.a;
        if (!piece.has(other)) { piece.set(other, next); stack.push(other); }
      }
    }
    next++;
  }
  return piece;
}

export function readMolecule(build: MoleculeBuild): MoleculeReading {
  const counts: Record<string, number> = {};
  build.atoms.forEach(a => { counts[a.element] = (counts[a.element] ?? 0) + 1; });
  const free = build.atoms.map(a => bondsFree(build, a));
  return {
    atoms: build.atoms.length,
    bonds: build.bonds.length,
    doubleBonds: build.bonds.filter(b => b.order === 2).length,
    tripleBonds: build.bonds.filter(b => b.order === 3).length,
    openBonds: free.reduce((s, f) => s + Math.max(0, f), 0),
    overBonded: free.some(f => f < 0),
    pieces: new Set(piecesOf(build).values()).size,
    carbons: counts.C ?? 0,
    counts,
    formula: formulaOf(build.atoms.map(a => a.element)),
  };
}

// ── The ask and the judge ───────────────────────────────────────────────────

/** What the molecule must have. Every property is checked; the ask names each one. */
export interface MoleculeAsk {
  /** At least this many double bonds. */
  doubleBonds?: number;
  /** At least one triple bond. */
  tripleBond?: boolean;
  /** Exactly this many carbon atoms. */
  carbons?: number;
  /** At least one atom of this element. */
  contains?: string;
  /** No more than this many atoms (the simplify lever's smaller ask). */
  maxAtoms?: number;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four'];

/** The ask's properties in words, in a fixed order. */
export function askParts(ask: MoleculeAsk): string[] {
  const parts: string[] = [];
  if (ask.tripleBond) parts.push('a triple bond');
  if (ask.doubleBonds) parts.push(ask.doubleBonds === 1 ? 'a double bond' : `${NUMBER_WORD[ask.doubleBonds] ?? ask.doubleBonds} double bonds`);
  if (ask.carbons !== undefined) parts.push(`exactly ${ask.carbons} carbon atom${ask.carbons === 1 ? '' : 's'}`);
  if (ask.contains) { const name = ELEMENT_NAME[ask.contains] ?? ask.contains; parts.push(`${article(name)} ${name} atom`); }
  if (ask.maxAtoms !== undefined) parts.push(`no more than ${ask.maxAtoms} atoms`);
  return parts;
}

/** The ask, written by code: it states the target (it is the task, not a leak). */
export function askText(ask: MoleculeAsk): string {
  const parts = askParts(ask);
  const list = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Make a molecule with ${list}.`;
}

/** The elements an ask needs on the palette, beyond hydrogen. */
export const askNeeds = (ask: MoleculeAsk): string[] =>
  [...(ask.carbons ? ['C'] : []), ...(ask.contains ? [ask.contains] : [])];

/**
 * What a wrong molecule shows (`TeachingAttempt.miss`), most basic first:
 * - `not_connected`: the atoms make more than one piece;
 * - `too_many_bonds`: an atom has more bonds than it makes (the board refuses this move; a guard);
 * - `bond_order_short`: atoms still have bonds to make, and two of them are already joined (raising that bond is one fix);
 * - `open_valence`: atoms still have bonds to make, none of them joined to another that does;
 * - `no_triple_bond` / `no_double_bond`: every bond used, but the asked bond is not there;
 * - `carbon_count_off`, `element_missing`, `too_many_atoms`: every bond used, another asked property is not met.
 */
export type MakeMoleculeMiss = 'not_connected' | 'too_many_bonds' | 'bond_order_short' | 'open_valence'
  | 'no_triple_bond' | 'no_double_bond' | 'carbon_count_off' | 'element_missing' | 'too_many_atoms';
export const MAKE_MOLECULE_MISSES: readonly MakeMoleculeMiss[] = ['not_connected', 'too_many_bonds', 'bond_order_short',
  'open_valence', 'no_triple_bond', 'no_double_bond', 'carbon_count_off', 'element_missing', 'too_many_atoms'];

export function moleculeMiss(ask: MoleculeAsk, build: MoleculeBuild): MakeMoleculeMiss | undefined {
  const r = readMolecule(build);
  if (!r.atoms) return 'open_valence';
  if (r.pieces > 1) return 'not_connected';
  if (r.overBonded) return 'too_many_bonds';
  if (r.openBonds > 0) {
    const free = (id: string) => { const a = build.atoms.find(x => x.id === id); return a ? bondsFree(build, a) : 0; };
    return build.bonds.some(b => b.order < 3 && free(b.a) > 0 && free(b.b) > 0) ? 'bond_order_short' : 'open_valence';
  }
  if (ask.tripleBond && r.tripleBonds < 1) return 'no_triple_bond';
  if (ask.doubleBonds && r.doubleBonds < ask.doubleBonds) return 'no_double_bond';
  if (ask.carbons !== undefined && r.carbons !== ask.carbons) return 'carbon_count_off';
  if (ask.contains && !r.counts[ask.contains]) return 'element_missing';
  if (ask.maxAtoms !== undefined && r.atoms > ask.maxAtoms) return 'too_many_atoms';
  return undefined;
}

export const makesMolecule = (ask: MoleculeAsk, build: MoleculeBuild) => moleculeMiss(ask, build) === undefined;

/** The words under the board after a check: never which atom, never what to make. */
export const MAKE_FEEDBACK: Record<MakeMoleculeMiss, string> = {
  not_connected: 'Your atoms make more than one piece. A molecule is one piece, held together by bonds.',
  too_many_bonds: 'An atom has more bonds than it can make.',
  bond_order_short: 'Not yet. Some atoms can still make more bonds. Look at how your atoms are joined.',
  open_valence: 'Not yet. Some atoms can still make more bonds.',
  no_triple_bond: 'Every atom uses all its bonds, but the molecule has no triple bond.',
  no_double_bond: 'Every atom uses all its bonds, but the molecule does not have the double bonds the task asks for.',
  carbon_count_off: 'Every atom uses all its bonds. Read the task again: how many carbon atoms does it ask for?',
  element_missing: 'Every atom uses all its bonds. Read the task again: which atom does it ask for?',
  too_many_atoms: 'Every atom uses all its bonds. Read the task again: how many atoms can it have?',
};

// ── Molecules as data (the menu's proofs, the harness, the oracle) ──────────

/** A molecule written compactly: its elements in order, and its bonds as [atom index, atom index, order]. */
export interface MoleculeSpec { atoms: string[]; bonds: Array<[number, number, BondOrder]> }

/** A spec placed on an empty board, atom i in slot i. */
export function buildOf(spec: MoleculeSpec): MoleculeBuild {
  return {
    atoms: spec.atoms.map((element, slot) => ({ id: `atom-${slot}`, element, slot })),
    bonds: spec.bonds.map(([i, j, order]) => ({ a: `atom-${i}`, b: `atom-${j}`, order })),
  };
}

const spec = (atoms: string, bonds: Array<[number, number, BondOrder]>): MoleculeSpec =>
  ({ atoms: atoms.match(/Cl|[A-Z]/g) ?? [], bonds });

/** Hydrogens on atom i, numbered from `from`. */
const hs = (i: number, from: number, n: number): Array<[number, number, BondOrder]> =>
  Array.from({ length: n }, (_, k) => [i, from + k, 1]);

export const MOLECULES = {
  O2: spec('OO', [[0, 1, 2]]),
  CO2: spec('COO', [[0, 1, 2], [0, 2, 2]]),
  HNO: spec('NOH', [[0, 1, 2], [0, 2, 1]]),
  ethene: spec('CCHHHH', [[0, 1, 2], ...hs(0, 2, 2), ...hs(1, 4, 2)]),
  formaldehyde: spec('COHH', [[0, 1, 2], ...hs(0, 2, 2)]),
  acetaldehyde: spec('CCOHHHH', [[0, 1, 1], [1, 2, 2], ...hs(0, 3, 3), [1, 6, 1]]),
  ketene: spec('CCOHH', [[0, 1, 2], [1, 2, 2], ...hs(0, 3, 2)]),
  allene: spec('CCCHHHH', [[0, 1, 2], [1, 2, 2], ...hs(0, 3, 2), ...hs(2, 5, 2)]),
  propene: spec('CCCHHHHHH', [[0, 1, 2], [1, 2, 1], ...hs(0, 3, 2), [1, 5, 1], ...hs(2, 6, 3)]),
  diazene: spec('NNHH', [[0, 1, 2], [0, 2, 1], [1, 3, 1]]),
  methanimine: spec('CNHHH', [[0, 1, 2], ...hs(0, 2, 2), [1, 4, 1]]),
  methane: spec('CHHHH', hs(0, 1, 4)),
  methanol: spec('COHHHH', [[0, 1, 1], ...hs(0, 2, 3), [1, 5, 1]]),
  water: spec('OHH', hs(0, 1, 2)),
  ethane: spec('CCHHHHHH', [[0, 1, 1], ...hs(0, 2, 3), ...hs(1, 5, 3)]),
  ethanol: spec('CCOHHHHHH', [[0, 1, 1], [1, 2, 1], ...hs(0, 3, 3), ...hs(1, 6, 2), [2, 8, 1]]),
  N2: spec('NN', [[0, 1, 3]]),
  HCN: spec('CNH', [[0, 1, 3], [0, 2, 1]]),
  ethyne: spec('CCHH', [[0, 1, 3], [0, 2, 1], [1, 3, 1]]),
  acetonitrile: spec('CCNHHH', [[0, 1, 1], [1, 2, 3], ...hs(0, 3, 3)]),
  cyanogen: spec('NCCN', [[0, 1, 3], [1, 2, 1], [2, 3, 3]]),
  vinylChloride: spec('CCClHHH', [[0, 1, 2], [1, 2, 1], ...hs(0, 3, 2), [1, 5, 1]]),
  nitrosylChloride: spec('NOCl', [[0, 1, 2], [0, 2, 1]]),
  thioformaldehyde: spec('CSHH', [[0, 1, 2], ...hs(0, 2, 2)]),
  CS2: spec('CSS', [[0, 1, 2], [0, 2, 2]]),
  COS: spec('COS', [[0, 1, 2], [0, 2, 2]]),
} satisfies Record<string, MoleculeSpec>;
type MoleculeKey = keyof typeof MOLECULES;

/** One ask on the menu: the ask, its smaller practice ask, and molecules that pass each (proof it is buildable and open). */
export interface MenuAsk { key: string; ask: MoleculeAsk; simpler: MoleculeAsk; passes: MoleculeKey[]; simplerPasses: MoleculeKey[]; band: '3-5' | 'both' | '6-8' }

const DOUBLE: MoleculeAsk = { doubleBonds: 1 };
/** The asks code chooses from. `doubleBond` is the mode's headline item and every session opens with it. */
export const ASK_MENU: readonly MenuAsk[] = [
  { key: 'doubleBond', ask: DOUBLE, simpler: { doubleBonds: 1, maxAtoms: 3 }, band: 'both',
    passes: ['ethene', 'formaldehyde', 'CO2', 'O2'], simplerPasses: ['O2', 'CO2', 'HNO'] },
  { key: 'doubleTwoCarbons', ask: { doubleBonds: 1, carbons: 2 }, simpler: DOUBLE, band: 'both',
    passes: ['ethene', 'acetaldehyde', 'ketene'], simplerPasses: ['O2', 'ethene'] },
  { key: 'doubleOxygen', ask: { doubleBonds: 1, contains: 'O' }, simpler: DOUBLE, band: 'both',
    passes: ['formaldehyde', 'CO2', 'acetaldehyde'], simplerPasses: ['O2', 'ethene'] },
  { key: 'doubleNitrogen', ask: { doubleBonds: 1, contains: 'N' }, simpler: DOUBLE, band: 'both',
    passes: ['methanimine', 'diazene', 'HNO'], simplerPasses: ['O2', 'ethene'] },
  { key: 'twoDoubles', ask: { doubleBonds: 2 }, simpler: DOUBLE, band: 'both',
    passes: ['CO2', 'allene', 'ketene'], simplerPasses: ['O2', 'ethene'] },
  { key: 'twoCarbons', ask: { carbons: 2 }, simpler: { carbons: 1 }, band: '3-5',
    passes: ['ethane', 'ethene', 'ethanol'], simplerPasses: ['methane', 'methanol', 'formaldehyde'] },
  { key: 'oneCarbonOxygen', ask: { carbons: 1, contains: 'O' }, simpler: { contains: 'O', maxAtoms: 3 }, band: '3-5',
    passes: ['methanol', 'formaldehyde', 'CO2'], simplerPasses: ['water', 'O2', 'CO2'] },
  { key: 'doubleThreeCarbons', ask: { doubleBonds: 1, carbons: 3 }, simpler: DOUBLE, band: '6-8',
    passes: ['propene', 'allene'], simplerPasses: ['O2', 'ethene'] },
  { key: 'tripleBond', ask: { tripleBond: true }, simpler: { tripleBond: true, maxAtoms: 3 }, band: '6-8',
    passes: ['N2', 'HCN', 'ethyne'], simplerPasses: ['N2', 'HCN'] },
  { key: 'tripleTwoCarbons', ask: { tripleBond: true, carbons: 2 }, simpler: { tripleBond: true }, band: '6-8',
    passes: ['ethyne', 'acetonitrile', 'cyanogen'], simplerPasses: ['N2', 'HCN'] },
  { key: 'doubleChlorine', ask: { doubleBonds: 1, contains: 'Cl' }, simpler: DOUBLE, band: '6-8',
    passes: ['vinylChloride', 'nitrosylChloride'], simplerPasses: ['O2', 'ethene'] },
  { key: 'doubleSulfur', ask: { doubleBonds: 1, contains: 'S' }, simpler: DOUBLE, band: '6-8',
    passes: ['thioformaldehyde', 'CS2', 'COS'], simplerPasses: ['O2', 'ethene'] },
];

export const menuFor = (band: '3-5' | '6-8') => ASK_MENU.filter(m => m.band === 'both' || m.band === band);

const sameAsk = (a: MoleculeAsk, b: MoleculeAsk) => askText(a) === askText(b);
/** The menu entry an ask came from (by its words), if any. */
export const menuEntryFor = (ask: MoleculeAsk) => ASK_MENU.find(m => sameAsk(m.ask, ask));

/** The smaller practice ask for an item (the simplify lever): fewer atoms or one property fewer. */
export function simplerAskFor(ask: MoleculeAsk): MoleculeAsk | null {
  const entry = menuEntryFor(ask);
  if (entry) return entry.simpler;
  // Off the menu: keep the bond property and drop the rest, or cap the atoms.
  if (ask.maxAtoms !== undefined) return null;
  const bond: MoleculeAsk = ask.tripleBond ? { tripleBond: true } : ask.doubleBonds ? { doubleBonds: 1 } : {};
  const parts = askParts(ask).length;
  if (parts > 1 && Object.keys(bond).length) return bond;
  return { ...ask, maxAtoms: 3 };
}

/** A molecule from the menu that passes the ask and has a hydrogen (the harness's pick: removing one H makes a miss). */
export function passingSpec(ask: MoleculeAsk): MoleculeSpec | null {
  const entry = ASK_MENU.find(m => sameAsk(m.ask, ask)) ?? ASK_MENU.find(m => sameAsk(m.simpler, ask));
  const keys = entry ? (sameAsk(entry.ask, ask) ? entry.passes : entry.simplerPasses) : (Object.keys(MOLECULES) as MoleculeKey[]);
  const fits = keys.map(k => MOLECULES[k]).filter(s => makesMolecule(ask, buildOf(s)));
  return fits.find(s => s.atoms.includes('H')) ?? fits[0] ?? null;
}
