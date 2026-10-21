/**
 * The in-item levers on molecule-constructor, as one lever set (`bossLevers.ts`).
 *
 * The open build, `make_molecule` (/add-eval-modes references/build-mode.md). The learner makes any molecule with the
 * asked property on an empty board. Using up every atom's bonds IS the task, so the item starts bare. Designed from
 * why learners fail:
 * - `open_bonds` (marks): a hollow dot beside each atom for every bond it can still make. Learners stop with an atom
 *   that still has bonds to make (a hydrogen short, a single bond where a double fits) and cannot see where.
 * - `bond_tally` (custom, shown): under each atom, how many bonds it has made and how many it makes ("2 of 4").
 *   Learners count a double bond as one bond, so a carbon with a double bond looks full at three lines.
 * - `piece_colors` (marks): each separate piece of the build tinted its own colour. Learners make two small molecules
 *   side by side and call it one.
 * - `fewer_atoms` (easier): an ungraded smaller ask first (fewer atoms, or one property fewer), on an empty board.
 * `too_many_bonds` has no lever: the board refuses a bond past an atom's valence, so it cannot be built.
 *
 * The classic canvas (build_target: build the named formula; free_build: join any atoms). The generator's showOptions
 * (valence dots, the satisfied dot, the formula) are the item's presentation.
 * - `atom_tally` (custom, shown; build_target): under the asked formula, one empty circle per atom it names, filled as
 *   the learner places that element; an atom past the formula's count, or of an element it does not name, ringed red.
 *   Learners misread the subscripts (H2O as one H, or as H and 2 O) and stop an atom short or over (`atoms_off`).
 *   Offered only when the formula is on screen and the item's atom list agrees with it (`atomTallyLeaks`).
 * - `bond_tally` (build_target): the same "made of makes" count under each atom of the classic canvas, for
 *   `open_valence`. Offered once an atom is on the canvas (before that there is nothing to count).
 * - `join_rings` (marks; free_build): a green ring on every atom that can still make a bond, for `no_bonds`. Offered
 *   once two atoms on the canvas can still bond (before that there is nothing to ring).
 * - `fewer_atoms` (easier; build_target): an ungraded smaller target from `SIMPLE_TARGETS`, then the full item comes
 *   back. free_build has none: it asks for any one bond, and nothing simpler is still a build.
 *
 * Typed items on a drawn molecule (identify: name it; formula_write: write its formula). Nothing on screen names it.
 * - `show_formula` (clue; identify): writes the drawn molecule's formula beside it, for `name_off`. The name is the
 *   answer; the formula is one step toward it. Offered only when the formula agrees with what is drawn.
 * - `formula_model` (model; formula_write): beside the item, a different small molecule drawn with its formula under
 *   it, for `formula_off`. Never the item's molecule or another session item's (`formulaModelLeaks`). When it comes is
 *   the item's support tier (`supportTier`, stamped by the generator; 'medium' when absent: after a miss).
 * - `fewer_atoms` (easier): a smaller molecule from `SIMPLE_TARGETS` to name or write first, ungraded.
 * predict_bonds and shape_predict items have no lever: their check passes any build with one bond and checks no
 * prediction, so there is no checked miss a lever could answer (EVAL_TRACKER MC-2).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { MoleculeConstructorChallenge, MoleculeConstructorData } from './MoleculeConstructor';
import { VALENCE, askText, simplerAskFor } from './moleculeBuild';
import { askOf, specForAtoms } from './moleculeConstructorWorkspace';
import { MOLECULE_MISSES_BY_MODE, type MoleculeMode } from './moleculeConstructor.card';

export const OPEN_BONDS_LEVER = 'open_bonds';
export const BOND_TALLY_LEVER = 'bond_tally';
export const PIECE_COLORS_LEVER = 'piece_colors';
export const FEWER_ATOMS_LEVER = 'fewer_atoms';
export const ATOM_TALLY_LEVER = 'atom_tally';
export const JOIN_RINGS_LEVER = 'join_rings';
export const SHOW_FORMULA_LEVER = 'show_formula';
export const FORMULA_MODEL_LEVER = 'formula_model';

const SIMPLER = '~simpler';
export const isPracticeMolecule = (c: Pick<MoleculeConstructorChallenge, 'id'>) => c.id.endsWith(SIMPLER);

/** What a simpler build_target avoids and draws from: the session's other items, and the palette. */
export type SimplerContext = Partial<Pick<MoleculeConstructorData, 'challenges' | 'palette'>>;

// ── build_target: the formula, the atom tally, the simpler target ──────────

type AtomCount = { element: string; count: number };

/** Element counts of a formula ("C2H6O" → C 2, H 6, O 1); subscript digits read as digits. */
export function formulaCounts(formula: string): Record<string, number> {
  const plain = formula.replace(/[₀-₉]/g, d => String(d.charCodeAt(0) - 0x2080)).replace(/\s/g, '');
  const counts: Record<string, number> = {};
  for (const m of Array.from(plain.matchAll(/([A-Z][a-z]?)(\d*)/g))) counts[m[1]] = (counts[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
  return counts;
}
const countsOf = (atoms: readonly AtomCount[]) => {
  const counts: Record<string, number> = {};
  atoms.forEach(a => { counts[a.element] = (counts[a.element] ?? 0) + a.count; });
  return counts;
};
const sameCounts = (a: Record<string, number>, b: Record<string, number>) =>
  Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).every(k => (a[k] ?? 0) === (b[k] ?? 0));
/** A formula's counts in one canonical string, so "OH2" and "H2O" compare equal. */
const canonical = (counts: Record<string, number>) => Object.keys(counts).sort().map(e => e + counts[e]).join('');
const atomsOf = (formula: string): AtomCount[] => Object.entries(formulaCounts(formula)).map(([element, count]) => ({ element, count }));
const size = (atoms: readonly AtomCount[]) => atoms.reduce((s, a) => s + a.count, 0);
/** The highest bond order in the bonding code finds for these atoms (0 when it finds none), cached: the levers
 * are rebuilt every render and a big molecule's search is not cheap. */
const HIGHEST = new Map<string, number>();
function highestBond(atoms: readonly AtomCount[]): number {
  const key = canonical(countsOf(atoms));
  if (!HIGHEST.has(key)) HIGHEST.set(key, Math.max(0, ...(specForAtoms(atoms)?.bonds.map(b => b[2]) ?? [])));
  return HIGHEST.get(key)!;
}

/** Small molecules a simpler build_target is drawn from, smallest first. */
export const SIMPLE_TARGETS: ReadonlyArray<{ name: string; formula: string }> = [
  { name: 'Hydrogen gas', formula: 'H2' }, { name: 'Oxygen gas', formula: 'O2' }, { name: 'Nitrogen gas', formula: 'N2' },
  { name: 'Hydrogen chloride', formula: 'HCl' }, { name: 'Water', formula: 'H2O' }, { name: 'Hydrogen sulfide', formula: 'H2S' },
  { name: 'Carbon dioxide', formula: 'CO2' }, { name: 'Hydrogen cyanide', formula: 'HCN' }, { name: 'Ammonia', formula: 'NH3' },
  { name: 'Methane', formula: 'CH4' },
];

/** The atoms a build_target asks for: its atom list, else its formula's (the check reads the same). */
export const askedAtoms = (c: MoleculeConstructorChallenge): AtomCount[] =>
  c.targetAtoms?.length ? c.targetAtoms : c.targetFormula ? atomsOf(c.targetFormula) : [];

/**
 * The simpler build_target: a molecule from `SIMPLE_TARGETS` with fewer atoms, no bond higher than the item's, only
 * the palette's elements, and never the item's own formula or another session item's. Among those, one sharing a
 * non-hydrogen element with the item first, then the largest (one step down, not the smallest). Null when none fits.
 */
export function simplerTarget(c: MoleculeConstructorChallenge, ctx: SimplerContext = {}): MoleculeConstructorChallenge | null {
  if (c.type !== 'build_target' || isPracticeMolecule(c)) return null;
  const source = askedAtoms(c);
  if (!source.length) return null;
  const sourceCounts = countsOf(source), sourceSize = size(source), top = highestBond(source) || 3;
  const palette = ctx.palette?.availableElements?.length ? ctx.palette.availableElements : null;
  const avoid = new Set([canonical(sourceCounts),
    ...[c, ...(ctx.challenges ?? [])].flatMap(x => x.targetFormula ? [canonical(formulaCounts(x.targetFormula))] : [])]);
  const shares = (f: string) => Object.keys(formulaCounts(f)).some(e => e !== 'H' && sourceCounts[e]);
  const pick = SIMPLE_TARGETS.filter(t => {
    const atoms = atomsOf(t.formula);
    return size(atoms) < sourceSize && !avoid.has(canonical(formulaCounts(t.formula))) && highestBond(atoms) <= top
      && (!palette || atoms.every(a => palette.includes(a.element)));
  }).sort((a, b) => Number(shares(b.formula)) - Number(shares(a.formula)) || size(atomsOf(b.formula)) - size(atomsOf(a.formula)))[0];
  if (!pick) return null;
  return { ...c, id: `${c.id}${SIMPLER}`, instruction: `Build ${pick.name.toLowerCase()}, ${pick.formula}.`,
    targetFormula: pick.formula, targetName: pick.name, targetAtoms: atomsOf(pick.formula), hint: '', narration: '' };
}

/**
 * The atom tally's leak rule: it may show only counts the screen already states. True (leaks) when the item's
 * formula is not on screen (in its instruction, or in the Target panel `showName` draws), or when the atom list the
 * check reads disagrees with that formula (the tally would show counts the learner was never given).
 */
export function atomTallyLeaks(c: MoleculeConstructorChallenge, showName: boolean): boolean {
  if (c.type !== 'build_target' || !c.targetFormula) return true;
  const squash = (s: string) => s.replace(/\s/g, '');
  if (!showName && !squash(c.instruction).includes(squash(c.targetFormula))) return true;
  return !sameCounts(countsOf(askedAtoms(c)), formulaCounts(c.targetFormula));
}

/** One row of the atom tally: an element the formula names, how many it names, how many the learner placed. */
export interface TallyRow { element: string; need: number; have: number }
/** The learner's placed elements against the formula; `extra` holds placed elements it does not name. */
export function atomTally(c: MoleculeConstructorChallenge, placed: readonly string[]): { rows: TallyRow[]; extra: Record<string, number> } {
  const need = c.targetFormula ? formulaCounts(c.targetFormula) : {};
  const have: Record<string, number> = {};
  placed.forEach(e => { have[e] = (have[e] ?? 0) + 1; });
  const extra: Record<string, number> = {};
  Object.entries(have).forEach(([e, n]) => { if (!need[e]) extra[e] = n; });
  return { rows: Object.entries(need).map(([element, n]) => ({ element, need: n, have: have[element] ?? 0 })), extra };
}

// ── identify / formula_write: the drawn molecule, its formula, the model, the simpler molecule ──

/** The item types that show a drawn molecule and take a typed answer. */
export const isTypedItem = (c: Pick<MoleculeConstructorChallenge, 'type'> | null): boolean =>
  c?.type === 'identify' || c?.type === 'formula_write';

export interface DrawnAtom { id: string; element: string; x: number; y: number }
export interface DrawnBond { id: string; atom1Id: string; atom2Id: string; type: 'single' | 'double' | 'triple' }
export interface DrawnMolecule { atoms: DrawnAtom[]; bonds: DrawnBond[] }
const BOND_TYPE = { 1: 'single', 2: 'double', 3: 'triple' } as const;

/**
 * A molecule laid out on the 500 x 350 canvas: the atoms that make more than one bond in a row across the middle, each
 * one-bond atom beside the atom it is joined to (left, right, above, below). Null when the bonding code finds no
 * structure, or the row is too long to draw without atoms touching.
 */
export function layoutMolecule(atoms: readonly AtomCount[], prefix = 'shown'): DrawnMolecule | null {
  const spec = specForAtoms(atoms);
  if (!spec) return null;
  const id = (i: number) => `${prefix}-${i + 1}`;
  const bonds: DrawnBond[] = spec.bonds.map(([a, b, o], k) => ({ id: `${prefix}-bond-${k}`, atom1Id: id(a), atom2Id: id(b), type: BOND_TYPE[o] }));
  const heavy = spec.atoms.filter(e => (VALENCE[e] ?? 1) > 1).length;
  if (!heavy) return { atoms: spec.atoms.map((element, i) => ({ id: id(i), element, x: 210 + 80 * i, y: 175 })), bonds };
  const gap = heavy > 1 ? Math.min(110, 330 / (heavy - 1)) : 0;
  if (heavy > 1 && gap < 52) return null;
  const pos: Array<{ x: number; y: number }> = spec.atoms.map((_, i) => ({ x: 250 + (i - (heavy - 1) / 2) * gap, y: 175 }));
  const used = new Map<number, number>();
  for (const [a, b] of spec.bonds) {
    const [chain, single] = a < heavy && b >= heavy ? [a, b] : b < heavy && a >= heavy ? [b, a] : [-1, -1];
    if (chain < 0) continue;
    const slots = heavy === 1 ? [[-75, 0], [75, 0], [0, -75], [0, 75]]
      : chain === 0 ? [[-75, 0], [0, -75], [0, 75]] : chain === heavy - 1 ? [[75, 0], [0, -75], [0, 75]] : [[0, -75], [0, 75]];
    const n = used.get(chain) ?? 0;
    used.set(chain, n + 1);
    const [dx, dy] = slots[n] ?? [0, 0];
    pos[single] = { x: pos[chain].x + dx, y: pos[chain].y + dy };
  }
  return { atoms: spec.atoms.map((element, i) => ({ id: id(i), element, ...pos[i] })), bonds };
}

/** The molecule an identify or formula_write item shows: its asked atoms, laid out (null for every other type). */
export function drawnMolecule(c: MoleculeConstructorChallenge | null): DrawnMolecule | null {
  if (!c || !isTypedItem(c)) return null;
  const atoms = askedAtoms(c);
  return atoms.length ? layoutMolecule(atoms) : null;
}

/** show_formula's leak rule: the formula it writes must be the drawn molecule's. True (not declared) when the item
 * has no formula, nothing is drawn, or the formula disagrees with the drawn atoms. */
export function showFormulaLeaks(c: MoleculeConstructorChallenge): boolean {
  if (c.type !== 'identify' || !c.targetFormula || !drawnMolecule(c)) return true;
  return !sameCounts(countsOf(askedAtoms(c)), formulaCounts(c.targetFormula));
}

/** The session's own answers, in canonical counts: no model or simpler molecule may show one. */
const sessionKeys = (c: MoleculeConstructorChallenge, ctx: SimplerContext) => new Set([
  ...(askedAtoms(c).length ? [canonical(countsOf(askedAtoms(c)))] : []),
  ...[c, ...(ctx.challenges ?? [])].flatMap(x => x.targetFormula ? [canonical(formulaCounts(x.targetFormula))] : []),
]);

/** A formula with a number written in it, so the model shows what a small number counts. */
const hasSubscript = (f: string) => Object.values(formulaCounts(f)).some(n => n > 1);

/** formula_model's leak rule: true when the model is the item's own molecule or any session item's. */
export function formulaModelLeaks(model: { formula: string }, c: MoleculeConstructorChallenge, ctx: SimplerContext = {}): boolean {
  return sessionKeys(c, ctx).has(canonical(formulaCounts(model.formula)));
}

/** The model formula_write shows: a molecule from `SIMPLE_TARGETS` of two elements or more with a number in its
 * formula, that is no session item's answer. Null when none fits. */
export function formulaModel(c: MoleculeConstructorChallenge, ctx: SimplerContext = {}): { name: string; formula: string; drawn: DrawnMolecule } | null {
  if (c.type !== 'formula_write') return null;
  for (const t of SIMPLE_TARGETS) {
    if (Object.keys(formulaCounts(t.formula)).length < 2 || !hasSubscript(t.formula) || formulaModelLeaks(t, c, ctx)) continue;
    const drawn = layoutMolecule(atomsOf(t.formula), 'model');
    if (drawn) return { ...t, drawn };
  }
  return null;
}

/**
 * The simpler identify or formula_write item: a molecule from `SIMPLE_TARGETS` with fewer atoms, never a session
 * item's answer, sharing a non-hydrogen element with the item first, then the largest. For identify, only molecules
 * whose name a learner would type as it is (not "Oxygen gas"). Null when none fits.
 */
export function simplerTyped(c: MoleculeConstructorChallenge, ctx: SimplerContext = {}): MoleculeConstructorChallenge | null {
  if (!isTypedItem(c) || isPracticeMolecule(c)) return null;
  const source = askedAtoms(c);
  if (!source.length) return null;
  const sourceCounts = countsOf(source), avoid = sessionKeys(c, ctx);
  const shares = (f: string) => Object.keys(formulaCounts(f)).some(e => e !== 'H' && sourceCounts[e]);
  const pick = SIMPLE_TARGETS.filter(t => size(atomsOf(t.formula)) < size(source) && !avoid.has(canonical(formulaCounts(t.formula)))
    && !(c.type === 'identify' && / gas$/i.test(t.name)) && layoutMolecule(atomsOf(t.formula)))
    .sort((a, b) => Number(shares(b.formula)) - Number(shares(a.formula)) || size(atomsOf(b.formula)) - size(atomsOf(a.formula)))[0];
  if (!pick) return null;
  return { ...c, id: `${c.id}${SIMPLER}`, targetFormula: pick.formula, targetName: pick.name, targetAtoms: atomsOf(pick.formula),
    instruction: c.type === 'identify' ? 'Name this molecule.' : 'Write the formula for this molecule.', hint: '', narration: '' };
}

// ── Both builds ────────────────────────────────────────────────────────────

/** The easier item: the menu's smaller ask (make_molecule) or a smaller target (build_target), ungraded. */
export function simplerMolecule(c: MoleculeConstructorChallenge, ctx: SimplerContext = {}): MoleculeConstructorChallenge | null {
  if (c.type === 'build_target') return simplerTarget(c, ctx);
  if (isTypedItem(c)) return simplerTyped(c, ctx);
  if (c.type !== 'make_molecule' || isPracticeMolecule(c)) return null;
  const ask = simplerAskFor(askOf(c));
  if (!ask) return null;
  return { ...c, id: `${c.id}${SIMPLER}`, ask, instruction: askText(ask) };
}

/** What the levers read beside the item: the Target panel, the session's items, and the classic canvas now. */
export interface LeverContext extends SimplerContext {
  showName?: boolean;
  /** Atoms on the classic canvas. */
  atoms?: number;
  /** Atoms on the classic canvas that can still make a bond. */
  joinable?: number;
}

/** The card mode an item's type belongs to (a classic session may hold any classic type: every classic lever is in
 *  all three classic modes, and its content picks the type). */
const MODE_OF: Record<MoleculeConstructorChallenge['type'], MoleculeMode> = {
  build_target: 'build', free_build: 'build', identify: 'identify', formula_write: 'identify',
  predict_bonds: 'predict', shape_predict: 'predict', make_molecule: 'make_molecule',
};
const CLASSIC: readonly MoleculeMode[] = ['build', 'identify', 'predict'];
const MAKE: readonly MoleculeMode[] = ['make_molecule'];
const board = (c: MoleculeConstructorChallenge) => (c.type === 'make_molecule' ? 'board' : 'canvas');

export const MOLECULE_LEVERS = leverSet<MoleculeConstructorChallenge, LeverContext>({
  modeOf: c => MODE_OF[c.type] ?? 'build',
  missesOf: mode => MOLECULE_MISSES_BY_MODE[mode as MoleculeMode] ?? [],
  // show_formula's words must never name the molecule it is the formula of.
  answersOf: c => (c.type === 'identify' && c.targetName ? [c.targetName] : []),
  support: { tier: c => c.supportTier ?? 'medium', different: 'a different molecule, drawn with its formula',
    own: 'this molecule\'s formula' },
  specs: [
    { id: OPEN_BONDS_LEVER, type: 'marks', modes: MAKE, answers: ['open_valence', 'bond_order_short'],
      when: 'The learner stops while some atoms can still make bonds, and cannot find which.',
      does: 'Puts a small hollow dot beside each atom on the board for every bond it can still make. It marks the learner\'s own atoms only.',
      fact: 'Beside each atom on the board is a hollow dot for every bond it can still make.' },
    { id: ATOM_TALLY_LEVER, type: 'custom', carrier: 'shown', modes: CLASSIC, answers: ['atoms_off'],
      why: 'It counts the atoms the learner has placed against the formula on screen and changes as they place them; no '
        + 'stock type reads back the learner\'s own work.',
      when: 'The learner places too few or too many of an atom, misreading the small numbers in the formula.',
      does: 'Under the asked formula, draws one empty circle for each atom it names; each atom the learner places fills one, '
        + 'and an atom past the count, or of an element the formula does not name, is ringed red.',
      content: (c, ctx) => (c.type === 'build_target' && !atomTallyLeaks(c, !!ctx.showName) ? true : null),
      fact: 'Under the asked formula is one circle for each atom it names, filled for each atom of that element placed; any atom past the count is ringed red.' },
    { id: BOND_TALLY_LEVER, type: 'custom', carrier: 'shown', answers: ['open_valence', 'bond_order_short', 'no_double_bond', 'no_triple_bond'],
      answersOn: c => (c.type === 'make_molecule' ? ['bond_order_short', 'no_double_bond', 'no_triple_bond', 'open_valence'] : ['open_valence']),
      why: 'It counts the bonds each atom has made against how many it makes and changes as the learner builds; no stock '
        + 'type reads back the learner\'s own work.',
      when: c => (c.type === 'make_molecule'
        ? 'The learner counts a double or triple bond as one bond, or loses track of how many bonds an atom has made.'
        : 'The learner has the right atoms but stops with bonds still to make, or counts a double bond as one bond.'),
      does: c => `Writes under each atom on the ${board(c)} how many bonds it has made and how many it makes in all, a double bond counting two.`,
      content: c => (c.type === 'make_molecule' || c.type === 'build_target' ? true : null),
      offer: (c, ctx) => c.type === 'make_molecule' || (ctx.atoms ?? 0) > 0,
      fact: (_on, c) => `Under each atom on the ${board(c)} is how many bonds it has made and how many it makes in all.` },
    { id: PIECE_COLORS_LEVER, type: 'marks', modes: MAKE, answers: ['not_connected'],
      when: 'The learner makes two or more separate pieces and calls them one molecule.',
      does: 'Tints each separate piece of the learner\'s build its own colour, so the pieces show.',
      fact: 'Each separate piece of the build is tinted its own colour.' },
    { id: SHOW_FORMULA_LEVER, type: 'clue', modes: CLASSIC, answers: ['name_off'],
      when: 'The learner cannot name the drawn molecule.',
      does: 'Writes the drawn molecule\'s formula beside it. It never shows the name.',
      content: c => (c.type === 'identify' && !showFormulaLeaks(c) ? c.targetFormula : null),
      fact: 'Beside the drawn molecule is its formula.' },
    { id: FORMULA_MODEL_LEVER, type: 'model', modes: CLASSIC, answers: ['formula_off'],
      when: 'The learner misreads what the small numbers in a formula count, or miscounts the atoms of an element.',
      does: 'Beside the item, draws a different small molecule with its formula written under it, so the learner sees how a '
        + 'drawing becomes a formula. It writes nothing about the item\'s own molecule.',
      content: (c, ctx) => formulaModel(c, ctx),
      fact: 'Beside the item is a different molecule, drawn with its formula written under it.' },
    { id: JOIN_RINGS_LEVER, type: 'marks', modes: CLASSIC, answers: ['no_bonds'],
      when: 'The learner places atoms but never joins two of them.',
      does: 'Rings in green every atom on the canvas that can still make a bond, so the learner sees which atoms can be joined.',
      content: c => (c.type === 'free_build' ? true : null),
      offer: (_c, ctx) => (ctx.joinable ?? 0) >= 2,
      fact: 'Every atom on the canvas that can still make a bond has a green ring.' },
    { id: FEWER_ATOMS_LEVER, type: 'easier',
      answers: ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'not_connected', 'bond_order_short', 'no_double_bond',
        'no_triple_bond', 'carbon_count_off', 'element_missing', 'too_many_atoms'],
      answersOn: c => ({
        build_target: ['atoms_off', 'open_valence'], identify: ['name_off'], formula_write: ['formula_off'],
        make_molecule: ['not_connected', 'open_valence', 'bond_order_short', 'no_double_bond', 'no_triple_bond', 'carbon_count_off',
          'element_missing', 'too_many_atoms'],
      } as Record<string, string[]>)[c.type] ?? [],
      when: c => ({
        build_target: 'The learner cannot build a molecule this big yet.',
        identify: 'The learner cannot name a molecule this big yet.',
        formula_write: 'The learner cannot write the formula of a molecule this big yet.',
      } as Record<string, string>)[c.type] ?? 'The learner cannot make a molecule this big or with this many properties yet.',
      does: c => ({
        build_target: 'Opens a smaller molecule to build first, with fewer atoms, on an empty canvas. It is not graded; the full item comes back after it.',
        identify: 'Opens a smaller molecule to name first. It is not graded; the full item comes back after it.',
        formula_write: 'Opens a smaller molecule to write the formula of first. It is not graded; the full item comes back after it.',
      } as Record<string, string>)[c.type] ?? 'Opens an easier ask first, a molecule with fewer atoms or one property fewer, on an empty board. It is not graded; the full item comes back after it.',
      content: (c, ctx) => simplerMolecule(c, ctx) },
  ],
});
