/**
 * molecule-constructor `build` mode levers (`moleculeConstructorLevers.ts`): the atom tally's leak rule, the
 * simpler build_target builder, the refusals, and which lever follows each named miss.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { MoleculeConstructorChallenge } from './MoleculeConstructor';
import {
  ATOM_TALLY_LEVER, BOND_TALLY_LEVER, FEWER_ATOMS_LEVER, JOIN_RINGS_LEVER, atomTally, atomTallyLeaks,
  classicRefusal, formulaCounts, leverFacts, moleculeLevers, simplerMolecule, simplerTarget,
  FORMULA_MODEL_LEVER, SHOW_FORMULA_LEVER, drawnMolecule, formulaModel, formulaModelLeaks, showFormulaLeaks, simplerTyped,
} from './moleculeConstructorLevers';
import { specForAtoms } from './moleculeConstructorWorkspace';
import { buildOf, readMolecule } from './moleculeBuild';

const target = (id: string, formula: string, name = formula, instruction = `Build ${name} (${formula}).`): MoleculeConstructorChallenge => ({
  id, type: 'build_target', instruction, targetFormula: formula, targetName: name,
  targetAtoms: Object.entries(formulaCounts(formula)).map(([element, count]) => ({ element, count })), hint: '', narration: '' });
const FREE: MoleculeConstructorChallenge = { id: 'f', type: 'free_build', instruction: 'Build any molecule.', targetFormula: null,
  targetName: null, targetAtoms: [], hint: '', narration: '' };
const SMALL = { availableElements: ['H', 'C', 'N', 'O'], showValence: true, showElectronDots: false };
const BIG = { availableElements: ['H', 'C', 'N', 'O', 'S', 'Cl'], showValence: true, showElectronDots: false };
/** Targets a generator writes for the build mode (the w1 payload's and the prompt's examples). */
const SOURCES = ['H2O', 'O2', 'CO2', 'CH4', 'NH3', 'C2H6', 'C2H4', 'C2H5OH', 'CH3OH', 'H2', 'N2', 'HCN', 'H2S', 'HCl', 'C3H8', 'CH2O', 'C2H2'];
const total = (f: string) => Object.values(formulaCounts(f)).reduce((s, n) => s + n, 0);

describe('the atom tally', () => {
  it('reads subscripts, including unicode ones', () => {
    expect(formulaCounts('C2H5OH')).toEqual({ C: 2, H: 6, O: 1 });
    expect(formulaCounts('H₂O')).toEqual({ H: 2, O: 1 });
    expect(formulaCounts('HCl')).toEqual({ H: 1, Cl: 1 });
  });
  it('leaks (and is not declared) unless the formula is on screen and the atom list agrees with it', () => {
    expect(atomTallyLeaks(target('w', 'H2O', 'Water'), false)).toBe(false);
    // The formula is not in the words and the Target panel is off: the tally would turn a name into counts.
    expect(atomTallyLeaks(target('w', 'H2O', 'Water', 'Build water.'), false)).toBe(true);
    expect(atomTallyLeaks(target('w', 'H2O', 'Water', 'Build water.'), true)).toBe(false);
    // The atom list the check reads disagrees with the formula on screen.
    expect(atomTallyLeaks({ ...target('w', 'H2O'), targetAtoms: [{ element: 'H', count: 1 }, { element: 'O', count: 1 }] }, true)).toBe(true);
    expect(atomTallyLeaks(FREE, true)).toBe(true);
    expect(moleculeLevers(target('w', 'H2O', 'Water', 'Build water.'), []).map(l => l.id)).not.toContain(ATOM_TALLY_LEVER);
  });
  it('shows the formula\'s counts against the learner\'s atoms, overflow and strangers apart', () => {
    expect(atomTally(target('w', 'H2O'), ['O', 'H', 'H', 'H', 'C'])).toEqual({
      rows: [{ element: 'H', need: 2, have: 3 }, { element: 'O', need: 1, have: 1 }], extra: { C: 1 } });
    expect(atomTally(target('w', 'H2O'), [])).toEqual({ rows: [{ element: 'H', need: 2, have: 0 }, { element: 'O', need: 1, have: 0 }], extra: {} });
  });
});

describe('the simpler build_target', () => {
  it.each(SOURCES.flatMap(f => [[f, SMALL], [f, BIG]] as const))('%s: fewer atoms, palette only, bonds no higher, solvable, never the item', (f, palette) => {
    const c = target('c', f);
    const easier = simplerTarget(c, { palette, challenges: [c] });
    if (!easier) {
      // Only a two-atom item has nothing smaller (H2 is in every palette and has the lowest bond).
      expect(total(f)).toBeLessThanOrEqual(2);
      return;
    }
    expect(easier).toMatchObject({ id: 'c~simpler', type: 'build_target' });
    expect(total(easier.targetFormula!)).toBeLessThan(total(f));
    expect(easier.targetFormula).not.toBe(f);
    expect(easier.targetAtoms.every(a => palette.availableElements.includes(a.element))).toBe(true);
    expect(easier.instruction).toContain(easier.targetFormula!);
    const spec = specForAtoms(easier.targetAtoms)!;
    expect(spec).toBeTruthy();
    expect(readMolecule(buildOf(spec))).toMatchObject({ openBonds: 0, pieces: 1, overBonded: false });
    const top = (atoms: MoleculeConstructorChallenge['targetAtoms']) => Math.max(0, ...(specForAtoms(atoms)?.bonds.map(b => b[2]) ?? [0]));
    expect(top(easier.targetAtoms)).toBeLessThanOrEqual(top(c.targetAtoms) || 3);
    expect(simplerTarget(easier, { palette })).toBeNull();
  });
  it('one step down, sharing an element: CO2 gives O2, H2O gives H2, CH4 gives NH3; O2 has none', () => {
    expect(simplerTarget(target('c', 'CO2'), { palette: SMALL })?.targetFormula).toBe('O2');
    expect(simplerTarget(target('c', 'H2O'), { palette: SMALL })?.targetFormula).toBe('H2');
    expect(simplerTarget(target('c', 'CH4'), { palette: SMALL })?.targetFormula).toBe('NH3');
    expect(simplerTarget(target('c', 'O2'), { palette: SMALL })).toBeNull();
    expect(moleculeLevers(target('c', 'O2'), [], { palette: SMALL }).map(l => l.id)).not.toContain(FEWER_ATOMS_LEVER);
  });
  it('never another item of the session', () => {
    const co2 = target('c', 'CO2'), o2 = target('o', 'O2');
    expect(simplerTarget(co2, { palette: SMALL, challenges: [co2, o2] })?.targetFormula).toBe('H2');
    expect(simplerMolecule(co2, { palette: SMALL, challenges: [co2, o2] })?.targetFormula).toBe('H2');
  });
});

describe('the levers per miss', () => {
  const water = target('w', 'H2O', 'Water');
  it('build_target declares the tally, the bond count and the smaller molecule; free_build the rings', () => {
    expect(moleculeLevers(water, [], { palette: SMALL }).map(l => [l.id, l.kind])).toEqual([
      [ATOM_TALLY_LEVER, 'help'], [BOND_TALLY_LEVER, 'help'], [FEWER_ATOMS_LEVER, 'simplify']]);
    expect(moleculeLevers(FREE, []).map(l => [l.id, l.kind])).toEqual([[JOIN_RINGS_LEVER, 'help']]);
    expect(moleculeLevers({ ...water, type: 'predict_bonds' }, [])).toEqual([]);
    expect(moleculeLevers({ ...water, type: 'shape_predict' }, [])).toEqual([]);
  });
  it.each([
    ['atoms_off', [], ATOM_TALLY_LEVER], ['open_valence', [], BOND_TALLY_LEVER],
    ['atoms_off', [ATOM_TALLY_LEVER], FEWER_ATOMS_LEVER], ['open_valence', [BOND_TALLY_LEVER], FEWER_ATOMS_LEVER],
  ])('build_target: after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
    expect(nextLever(moleculeLevers(water, pulled as string[], { palette: SMALL }), miss)).toBe(want);
  });
  it('free_build: after no_bonds, the rings', () => {
    expect(nextLever(moleculeLevers(FREE, []), 'no_bonds')).toBe(JOIN_RINGS_LEVER);
  });
  it('refuses a pull that would draw nothing', () => {
    expect(classicRefusal(BOND_TALLY_LEVER, 0, 0)).toMatch(/no atoms/i);
    expect(classicRefusal(BOND_TALLY_LEVER, 1, 1)).toBeNull();
    expect(classicRefusal(JOIN_RINGS_LEVER, 1, 1)).toMatch(/fewer than two/i);
    expect(classicRefusal(JOIN_RINGS_LEVER, 3, 1)).toMatch(/fewer than two/i);
    expect(classicRefusal(JOIN_RINGS_LEVER, 2, 2)).toBeNull();
    expect(classicRefusal(ATOM_TALLY_LEVER, 0, 0)).toBeNull();
  });
  it('lever text and scene facts name no molecule and no count', () => {
    const all = [...moleculeLevers(water, [], { palette: SMALL }), ...moleculeLevers(FREE, [])];
    for (const l of all) expect(`${l.when} ${l.does}`).not.toMatch(/water|hydrogen|oxygen|\d/i);
    const facts = `${leverFacts(water, [ATOM_TALLY_LEVER, BOND_TALLY_LEVER])} ${leverFacts(FREE, [JOIN_RINGS_LEVER])}`;
    expect(facts).not.toMatch(/water|H2O|hydrogen|oxygen|\d/i);
  });
});

// ── The identify mode: identify (name the drawn molecule) and formula_write (write its formula) ──

const typed = (type: 'identify' | 'formula_write', id: string, formula: string, name = formula): MoleculeConstructorChallenge => ({
  ...target(id, formula, name, type === 'identify' ? 'Name this molecule.' : 'Write the formula for this molecule.'), type });

describe('the drawn molecule', () => {
  it.each(SOURCES)('%s: every asked atom drawn on the canvas, apart, every bond between drawn atoms', f => {
    const d = drawnMolecule(typed('formula_write', 'x', f))!;
    expect(d).toBeTruthy();
    expect(d.atoms).toHaveLength(total(f));
    expect(formulaCounts(d.atoms.map(a => a.element).join(''))).toEqual(formulaCounts(f));
    for (const a of d.atoms) {
      expect(a.x).toBeGreaterThanOrEqual(22); expect(a.x).toBeLessThanOrEqual(478);
      expect(a.y).toBeGreaterThanOrEqual(22); expect(a.y).toBeLessThanOrEqual(328);
      for (const b of d.atoms) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(44);
    }
    const ids = new Set(d.atoms.map(a => a.id));
    expect(d.bonds.every(b => ids.has(b.atom1Id) && ids.has(b.atom2Id))).toBe(true);
  });
  it('only identify and formula_write items are drawn', () => {
    expect(drawnMolecule(target('w', 'H2O'))).toBeNull();
    expect(drawnMolecule(FREE)).toBeNull();
    expect(drawnMolecule(typed('identify', 'w', 'H2O', 'Water'))).toBeTruthy();
  });
});

describe('identify: show_formula', () => {
  it('is declared only when the formula agrees with the drawing', () => {
    expect(showFormulaLeaks(typed('identify', 'm', 'CH4', 'Methane'))).toBe(false);
    expect(showFormulaLeaks({ ...typed('identify', 'm', 'CH4', 'Methane'), targetAtoms: [{ element: 'C', count: 1 }, { element: 'H', count: 3 }] })).toBe(true);
    expect(showFormulaLeaks({ ...typed('identify', 'm', 'CH4', 'Methane'), targetFormula: null })).toBe(true);
    expect(showFormulaLeaks(typed('formula_write', 'm', 'CH4'))).toBe(true);
  });
});

describe('formula_write: formula_model', () => {
  it.each(SOURCES)('%s: the model is never a session answer, has two elements and a number', f => {
    const c = typed('formula_write', 'c', f), other = target('o', 'H2O');
    const model = formulaModel(c, { challenges: [c, other] })!;
    expect(model).toBeTruthy();
    expect(formulaModelLeaks(model, c, { challenges: [c, other] })).toBe(false);
    expect(Object.keys(formulaCounts(model.formula)).length).toBeGreaterThanOrEqual(2);
    expect(Object.values(formulaCounts(model.formula)).some(n => n > 1)).toBe(true);
    expect(model.formula).not.toBe('H2O');
    expect(model.drawn.atoms).toHaveLength(total(model.formula));
  });
  it('the leak rule catches the item\'s own molecule written another way', () => {
    const c = typed('formula_write', 'c', 'H2O');
    expect(formulaModelLeaks({ formula: 'OH2' }, c)).toBe(true);
    expect(formulaModel(c)?.formula).toBe('H2S');
  });
});

describe('the simpler identify / formula_write item', () => {
  it.each(SOURCES.flatMap(f => [['identify', f], ['formula_write', f]] as const))('%s %s: same type, fewer atoms, drawn, never a session answer', (type, f) => {
    const c = typed(type, 'c', f), other = target('o', 'CH4');
    const easier = simplerTyped(c, { challenges: [c, other] });
    if (!easier) { expect(total(f)).toBeLessThanOrEqual(3); return; }
    expect(easier).toMatchObject({ id: 'c~simpler', type });
    expect(total(easier.targetFormula!)).toBeLessThan(total(f));
    expect(formulaCounts(easier.targetFormula!)).not.toEqual(formulaCounts(f));
    expect(easier.targetFormula).not.toBe('CH4');
    expect(drawnMolecule(easier)).toBeTruthy();
    expect(`${easier.instruction} ${easier.hint}`).not.toMatch(new RegExp(`${easier.targetName}|${easier.targetFormula}`, 'i'));
    if (type === 'identify') expect(easier.targetName).not.toMatch(/ gas$/i);
    expect(simplerMolecule(easier)).toBeNull();
    expect(simplerMolecule(c, { challenges: [c, other] })).toEqual(easier);
  });
});

describe('identify-mode levers per miss', () => {
  const name = typed('identify', 'm', 'CH4', 'Methane'), write = typed('formula_write', 'f', 'C2H6');
  it('identify declares the formula and the smaller molecule; formula_write the model and the smaller molecule', () => {
    expect(moleculeLevers(name, []).map(l => [l.id, l.kind])).toEqual([[SHOW_FORMULA_LEVER, 'help'], [FEWER_ATOMS_LEVER, 'simplify']]);
    expect(moleculeLevers(write, []).map(l => [l.id, l.kind])).toEqual([[FORMULA_MODEL_LEVER, 'help'], [FEWER_ATOMS_LEVER, 'simplify']]);
  });
  it('the smallest item keeps its help lever', () => {
    expect(moleculeLevers(typed('identify', 'h', 'HCl', 'Hydrogen chloride'), []).map(l => l.id)).toEqual([SHOW_FORMULA_LEVER]);
    expect(moleculeLevers(typed('formula_write', 'h', 'H2'), []).map(l => l.id)).toEqual([FORMULA_MODEL_LEVER]);
  });
  it.each([
    [name, 'name_off', [], SHOW_FORMULA_LEVER], [name, 'name_off', [SHOW_FORMULA_LEVER], FEWER_ATOMS_LEVER],
    [write, 'formula_off', [], FORMULA_MODEL_LEVER], [write, 'formula_off', [FORMULA_MODEL_LEVER], FEWER_ATOMS_LEVER],
  ])('after %#: the next lever', (c, miss, pulled, want) => {
    expect(nextLever(moleculeLevers(c as MoleculeConstructorChallenge, pulled as string[]), miss as string)).toBe(want);
  });
  it('lever text and scene facts name no molecule, formula or count', () => {
    for (const l of [...moleculeLevers(name, []), ...moleculeLevers(write, [])]) expect(`${l.when} ${l.does}`).not.toMatch(/methane|ethane|water|hydrogen|carbon|\d/i);
    const facts = `${leverFacts(name, [SHOW_FORMULA_LEVER])} ${leverFacts(write, [FORMULA_MODEL_LEVER])}`;
    expect(facts).toMatch(/formula/);
    expect(facts).not.toMatch(/methane|CH4|H2S|\d/i);
  });
});
