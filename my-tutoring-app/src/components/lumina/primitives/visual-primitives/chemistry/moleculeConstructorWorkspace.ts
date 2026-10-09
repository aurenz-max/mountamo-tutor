/**
 * molecule-constructor on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md), plus the open build `make_molecule` (/add-eval-modes references/build-mode.md).
 *
 * Pure: the component, the journey row and any probe read the same assignment, scene, check and misses. Every
 * challenge is answered on the screen and checked by the activity, so the tutor is never handed a key.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { MoleculeConstructorChallenge } from './MoleculeConstructor';
import {
  askText, buildOf, formulaOf, moleculeMiss, passingSpec, readMolecule, VALENCE,
  type MakeMoleculeMiss, type MoleculeAsk, type MoleculeBuild, type MoleculeSpec,
} from './moleculeBuild';

/** The ask a make_molecule item carries (code-owned; an item without one asks for a double bond). */
export const askOf = (c: Pick<MoleculeConstructorChallenge, 'ask'>): MoleculeAsk => c.ask ?? { doubleBonds: 1 };

/** What the component reads off the screen for the check, the description and the scene. */
export interface MoleculeView {
  /** make_molecule: the learner's molecule. */
  build: MoleculeBuild;
  /** Every other type: the classic canvas. */
  elements: readonly string[];
  bondsFormed: number;
  allSatisfied: boolean;
  formulaInput: string;
  identifyInput: string;
}

export function workspaceAssignment(c: MoleculeConstructorChallenge): TeachingAssignment {
  const task = c.type === 'make_molecule' ? c.instruction || askText(askOf(c)) : c.instruction;
  return { id: c.id, task, response: 'gesture' };
}

/** The learner's molecule in words: what is on the board, never what it should be. */
export function describeBuild(build: MoleculeBuild): string {
  const r = readMolecule(build);
  if (!r.atoms) return 'No atoms on the board yet';
  const orders = [r.doubleBonds && `${r.doubleBonds} double`, r.tripleBonds && `${r.tripleBonds} triple`].filter(Boolean);
  const bonds = `${r.bonds} bond${r.bonds === 1 ? '' : 's'}${orders.length ? ` (${orders.join(', ')})` : ''}`;
  const pieces = r.pieces > 1 ? `in ${r.pieces} separate pieces` : 'in one piece';
  const open = r.openBonds ? `${r.openBonds} bond${r.openBonds === 1 ? '' : 's'} still open` : 'no bonds left open';
  return `Made ${r.formula}: ${r.atoms} atom${r.atoms === 1 ? '' : 's'} ${pieces}, ${bonds}; ${open}`;
}

/** The learner's work in their own terms, never the key. */
export function describeWork(c: MoleculeConstructorChallenge, view: MoleculeView): string {
  switch (c.type) {
    case 'make_molecule': return describeBuild(view.build);
    case 'identify': return view.identifyInput.trim() ? `Typed "${view.identifyInput.trim()}" as the name` : 'No name typed yet';
    case 'formula_write': return view.formulaInput.trim() ? `Typed "${view.formulaInput.trim()}" as the formula` : 'No formula typed yet';
    default: {
      if (!view.elements.length) return 'No atoms placed yet';
      return `Built ${formulaOf(view.elements)} with ${view.bondsFormed} bond${view.bondsFormed === 1 ? '' : 's'}; `
        + (view.allSatisfied ? 'every atom uses all its bonds' : 'some atoms still have bonds to make');
    }
  }
}

/**
 * What a wrong answer on a classic challenge shows:
 * - `atoms_off` (build_target): the atom counts are not the target's;
 * - `open_valence` (build_target): the right atoms, but some still have bonds to make;
 * - `name_off` (identify), `formula_off` (formula_write): the typed answer is not the key;
 * - `no_bonds` (free_build, predict_bonds, shape_predict): no atoms joined yet.
 * make_molecule's misses are `MakeMoleculeMiss` (moleculeBuild.ts).
 */
export type ClassicMoleculeMiss = 'atoms_off' | 'open_valence' | 'name_off' | 'formula_off' | 'no_bonds';
export type MoleculeMiss = ClassicMoleculeMiss | MakeMoleculeMiss;
export const CLASSIC_MOLECULE_MISSES: readonly ClassicMoleculeMiss[] = ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'no_bonds'];

/** The classic check's verdict on a build_target: counts first, then every bond used (the component's own rule). */
export function buildTargetMiss(c: MoleculeConstructorChallenge, view: MoleculeView): ClassicMoleculeMiss | undefined {
  const target = c.targetAtoms ?? [];
  const counts: Record<string, number> = {};
  view.elements.forEach(e => { counts[e] = (counts[e] ?? 0) + 1; });
  const total = target.reduce((s, a) => s + a.count, 0);
  if (target.some(a => (counts[a.element] ?? 0) !== a.count) || view.elements.length !== total) return 'atoms_off';
  return view.allSatisfied ? undefined : 'open_valence';
}

export function moleculeConstructorMiss(c: MoleculeConstructorChallenge | null, view: MoleculeView): MoleculeMiss | undefined {
  if (!c) return undefined;
  switch (c.type) {
    case 'make_molecule': return moleculeMiss(askOf(c), view.build);
    case 'build_target': return buildTargetMiss(c, view);
    case 'identify': return 'name_off';
    case 'formula_write': return 'formula_off';
    default: return view.elements.length && view.bondsFormed ? undefined : 'no_bonds';
  }
}

const CONSTRAINTS = 'The learner answers on the screen and presses Check Answer; the activity checks the work itself. '
  + 'You cannot place, join or type for the learner.';

/** What is drawn and asked. No target name or formula of an identify or formula item is ever published. */
export function workspaceScene(c: MoleculeConstructorChallenge, view: MoleculeView): WorkspaceScene {
  if (c.type === 'make_molecule') {
    const r = readMolecule(view.build);
    return { objects: [], facts: {
      kind: 'make_molecule',
      board: 'an empty board; the learner taps an element to add an atom, taps two atoms to join them (again for a double '
        + 'or triple bond), taps a bond to take one step of it away',
      // The made molecule as numbers, so the shared work history records a revision (`openBonds 2 → 0`).
      atomsPlaced: r.atoms, bondsMade: r.bonds, doubleBonds: r.doubleBonds, tripleBonds: r.tripleBonds,
      openBonds: r.openBonds, pieces: r.pieces,
      learnerWork: describeBuild(view.build),
      constraints: 'The learner builds on the board and presses "I\'m done!"; the activity checks the molecule itself. '
        + 'You cannot place or join atoms for the learner.',
    } };
  }
  const facts: Record<string, string | number> = { kind: c.type, atomsPlaced: view.elements.length, bondsFormed: view.bondsFormed };
  // A build item's target is on screen in its instruction; an identify or formula item's key is not given to the tutor.
  if (c.type === 'build_target' && c.targetFormula) facts.asked = c.targetFormula;
  if (c.type === 'identify' || c.type === 'formula_write') {
    facts.board = `a molecule drawn on the canvas, its atoms joined; the learner reads it and types its ${c.type === 'identify' ? 'name' : 'formula'}`;
  }
  return { objects: [], facts: { ...facts, learnerWork: describeWork(c, view), constraints: CONSTRAINTS } };
}

// ── The journey row's learner (liveJourneySpec.ts) ──────────────────────────

type Input = { type: 'choose'; label: string } | { type: 'touch'; target: string } | { type: 'write'; label: string; text: string } | { type: 'check' };

/** Real board moves that build a spec: add each atom, then tap each bonded pair once per bond step. */
export function inputsForSpec(s: MoleculeSpec, atomTarget: (i: number) => string): Input[] {
  return [
    ...s.atoms.map((e): Input => ({ type: 'choose', label: `Add ${e}` })),
    ...s.bonds.flatMap(([i, j, order]) => Array.from({ length: order }, () =>
      [{ type: 'touch', target: atomTarget(i) }, { type: 'touch', target: atomTarget(j) }] as Input[]).flat()),
  ];
}

/** The spec with its last atom (a hydrogen) left off, so one bond stays open: a complete wrong answer. */
export function shortOneAtom(s: MoleculeSpec): MoleculeSpec {
  const last = s.atoms.length - 1;
  return { atoms: s.atoms.slice(0, last), bonds: s.bonds.filter(([i, j]) => i !== last && j !== last) };
}

/**
 * Bonds that make the target's atoms into one valid molecule (heavy atoms in a chain, hydrogens and chlorines
 * filling what is left), for the classic build_target item. Null when none is found.
 */
export function specForAtoms(target: ReadonlyArray<{ element: string; count: number }>): MoleculeSpec | null {
  const all = target.flatMap(t => Array.from({ length: t.count }, () => t.element));
  const heavy = all.filter(e => (VALENCE[e] ?? 1) > 1), single = all.filter(e => (VALENCE[e] ?? 1) <= 1);
  if (!heavy.length) return single.length === 2 ? { atoms: single, bonds: [[0, 1, 1]] } : null;
  const perms = (xs: string[]): string[][] => xs.length <= 1 ? [xs]
    : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));
  const orders: Array<Array<1 | 2 | 3>> = [];
  const walk = (acc: Array<1 | 2 | 3>) => { if (acc.length === heavy.length - 1) { orders.push(acc); return; } ([1, 2, 3] as const).forEach(o => walk([...acc, o])); };
  walk([]);
  const seen = new Set<string>();
  for (const chain of heavy.length <= 5 ? perms(heavy) : [heavy]) {
    if (seen.has(chain.join())) continue;
    seen.add(chain.join());
    for (const ord of orders) {
      const free = chain.map(e => VALENCE[e] ?? 1);
      let ok = true;
      ord.forEach((o, i) => { free[i] -= o; free[i + 1] -= o; if (free[i] < 0 || free[i + 1] < 0) ok = false; });
      if (!ok || free.reduce((s, f) => s + f, 0) !== single.length) continue;
      const bonds: Array<[number, number, 1 | 2 | 3]> = ord.map((o, i) => [i, i + 1, o]);
      let next = chain.length;
      free.forEach((f, i) => { for (let k = 0; k < f; k++) bonds.push([i, next++, 1]); });
      return { atoms: [...chain, ...single], bonds };
    }
  }
  return null;
}

/**
 * The journey's inputs for one item. make_molecule clears a kept board, builds a molecule the menu proves passes (wrong:
 * the same molecule one hydrogen short, `open_valence`), then presses "I'm done!"; a second wrong on the kept board just
 * presses it again. build_target builds the target with every bond used (wrong: one atom short, `atoms_off`); identify
 * and formula_write type the key (wrong: another word); the free types join two hydrogens (wrong: two unjoined).
 */
export function moleculeHarnessInputs(c: MoleculeConstructorChallenge, wrong: boolean, demand?: Record<string, unknown> | null): Input[] {
  const kept = Number(demand?.atomsPlaced ?? 0) > 0;
  if (c.type === 'make_molecule') {
    const done: Input = { type: 'choose', label: "I'm done!" };
    if (wrong && kept) return [done];
    const s = passingSpec(askOf(c));
    if (!s) throw new Error(`molecule-constructor make_molecule: no passing molecule for "${c.instruction}"`);
    const made = wrong ? shortOneAtom(s) : s;
    if (!wrong && !makesBuild(c, buildOf(made))) throw new Error(`molecule-constructor make_molecule: the menu molecule fails "${c.instruction}"`);
    return [...(kept ? [{ type: 'choose', label: 'Start over' } as Input] : []), ...inputsForSpec(made, i => `atom-${i}`), done];
  }
  const check: Input = { type: 'check' };
  // The classic canvas numbers atoms from 1 in the order they are added.
  const classic = (i: number) => `atom-${i + 1}`;
  const clear: Input[] = kept ? [{ type: 'choose', label: 'Clear All' }] : [];
  if (c.type === 'identify') return [{ type: 'write', label: 'Name this molecule', text: wrong ? 'not this one' : c.targetName ?? '' }, check];
  if (c.type === 'formula_write') return [{ type: 'write', label: 'Write the formula', text: wrong ? 'X9' : c.targetFormula ?? '' }, check];
  if (c.type === 'build_target') {
    const s = specForAtoms(c.targetAtoms ?? []);
    if (!s) throw new Error(`molecule-constructor build_target: no bonding found for ${c.targetFormula}`);
    return [...clear, ...inputsForSpec(wrong ? shortOneAtom(s) : s, classic), check];
  }
  // Wrong: two atoms placed and never joined (`no_bonds`, the documented "places atoms but does not form bonds").
  if (wrong) return [...clear, { type: 'choose', label: 'Add H' }, { type: 'choose', label: 'Add H' }, check];
  return [...clear, ...inputsForSpec({ atoms: ['H', 'H'], bonds: [[0, 1, 1]] }, classic), check];
}

const makesBuild = (c: MoleculeConstructorChallenge, b: MoleculeBuild) => moleculeMiss(askOf(c), b) === undefined;
