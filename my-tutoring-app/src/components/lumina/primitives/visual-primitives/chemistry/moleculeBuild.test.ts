/**
 * The make_molecule judge (moleculeBuild.ts): one piece, every atom's bonds used, every asked property; the board's
 * moves; the menu's proof molecules; the oracle on code-built sessions.
 */
import { describe, expect, it } from 'vitest';
import {
  ASK_MENU, EMPTY_BUILD, MOLECULES, addAtom, askText, buildOf, joinAtoms, lowerBond, moleculeMiss, readMolecule,
  removeAtom, simplerAskFor, type MoleculeBuild,
} from './moleculeBuild';
import { moleculeConstructorOracle, searchMolecules } from '../../../service/qa/oracles/molecule-constructor';
import { makeMoleculeChallenges, pickMakeAsks } from '../../../service/chemistry/gemini-molecule-constructor';
import { describeBuild, moleculeHarnessInputs, specForAtoms } from './moleculeConstructorWorkspace';
import { keepWatchLine } from '../../../service/build-layer/gemini-build-watch';

const DOUBLE = { doubleBonds: 1 };

describe('the board', () => {
  it('adds atoms into the first empty slot, joins and raises a bond, refuses a bond past valence, lowers and removes', () => {
    let b: MoleculeBuild = EMPTY_BUILD;
    for (const e of ['O', 'O', 'H']) b = addAtom(b, e)!;
    expect(b.atoms.map(a => a.id)).toEqual(['atom-0', 'atom-1', 'atom-2']);
    b = joinAtoms(b, 'atom-0', 'atom-1').build;
    b = joinAtoms(b, 'atom-1', 'atom-0').build;
    expect(b.bonds).toEqual([{ a: 'atom-0', b: 'atom-1', order: 2 }]);
    // Each oxygen makes two bonds and has made them: a third is refused.
    expect(joinAtoms(b, 'atom-0', 'atom-2').refused).toBe(true);
    expect(joinAtoms(b, 'atom-0', 'atom-1').refused).toBe(true);
    b = lowerBond(b, 'atom-1', 'atom-0');
    expect(b.bonds[0].order).toBe(1);
    b = removeAtom(b, 'atom-1');
    expect(b.bonds).toEqual([]);
    expect(addAtom(b, 'C')!.atoms.at(-1)!.slot).toBe(1);
  });
});

describe('the judge', () => {
  it('passes many molecules for "a double bond" and fails a single-bonded one', () => {
    for (const k of ['O2', 'CO2', 'ethene', 'formaldehyde', 'HNO', 'diazene'] as const) expect(moleculeMiss(DOUBLE, buildOf(MOLECULES[k]))).toBeUndefined();
    expect(moleculeMiss(DOUBLE, buildOf(MOLECULES.ethane))).toBe('no_double_bond');
    expect(moleculeMiss({ tripleBond: true }, buildOf(MOLECULES.ethene))).toBe('no_triple_bond');
  });

  it('names a bond that should be raised apart from an atom that needs another partner', () => {
    // C=C drawn as C-C with four hydrogens: both carbons still have a bond to make and they are joined.
    const singleWhereDouble = buildOf({ ...MOLECULES.ethene, bonds: MOLECULES.ethene.bonds.map(([i, j, o]) => [i, j, i === 0 && j === 1 ? 1 : o]) });
    expect(moleculeMiss(DOUBLE, singleWhereDouble)).toBe('bond_order_short');
    // Ethene one hydrogen short: one carbon has a bond left and no joined partner with one.
    const short = buildOf({ atoms: MOLECULES.ethene.atoms.slice(0, 5), bonds: MOLECULES.ethene.bonds.filter(([, j]) => j !== 5) });
    expect(moleculeMiss(DOUBLE, short)).toBe('open_valence');
    expect(readMolecule(short).openBonds).toBe(1);
  });

  it('a split build, the asked carbons, the asked atom and the atom limit are each named', () => {
    const two: MoleculeBuild = { atoms: [...buildOf(MOLECULES.O2).atoms, { id: 'atom-5', element: 'H', slot: 5 }, { id: 'atom-6', element: 'H', slot: 6 }],
      bonds: [...buildOf(MOLECULES.O2).bonds, { a: 'atom-5', b: 'atom-6', order: 1 }] };
    expect(moleculeMiss(DOUBLE, two)).toBe('not_connected');
    expect(moleculeMiss({ doubleBonds: 1, carbons: 2 }, buildOf(MOLECULES.formaldehyde))).toBe('carbon_count_off');
    expect(moleculeMiss({ doubleBonds: 1, contains: 'N' }, buildOf(MOLECULES.ethene))).toBe('element_missing');
    expect(moleculeMiss({ doubleBonds: 1, maxAtoms: 3 }, buildOf(MOLECULES.ethene))).toBe('too_many_atoms');
  });

  it('every menu ask and its practice ask pass their proof molecules, and the oracle finds two of its own', () => {
    for (const m of ASK_MENU) {
      expect(simplerAskFor(m.ask)).toEqual(m.simpler);
      for (const k of m.passes) expect(moleculeMiss(m.ask, buildOf(MOLECULES[k])), `${m.key} ${k}`).toBeUndefined();
      for (const k of m.simplerPasses) expect(moleculeMiss(m.simpler, buildOf(MOLECULES[k])), `${m.key} simpler ${k}`).toBeUndefined();
      const palette = m.band === '6-8' ? ['H', 'C', 'N', 'O', 'S', 'Cl'] : ['H', 'C', 'N', 'O'];
      expect(searchMolecules(m.ask, palette), m.key).toBe(2);
    }
  });

  it('the ask states the target; the description names no atom that is short', () => {
    expect(askText({ doubleBonds: 1, carbons: 2 })).toBe('Make a molecule with a double bond and exactly 2 carbon atoms.');
    expect(askText({ doubleBonds: 1, contains: 'O' })).toBe('Make a molecule with a double bond and an oxygen atom.');
    expect(describeBuild(buildOf(MOLECULES.ethene))).toBe('Made C2H4: 6 atoms in one piece, 5 bonds (1 double); no bonds left open');
  });
});

describe('the watcher filter on the board', () => {
  it('drops a line that counts bonds ("twin"), names a molecule, or points at an atom still short', () => {
    const never = ['ethene', 'water', 'open', 'lonely', 'parallel'];
    expect(keepWatchLine('Ooh, the yellow circles are linked by twin white bridges!', 'never', never)).toBe('');
    expect(keepWatchLine('Ooh, yellow circles are glowing connected by parallel lines!', 'never', never)).toBe('');
    expect(keepWatchLine('Wow, that looks like ethene!', 'never', never)).toBe('');
    expect(keepWatchLine('A lonely blue circle sits by the edge!', 'never', never)).toBe('');
    expect(keepWatchLine('Ooh, bright blue circles are linking to the yellow circle!', 'never', never)).not.toBe('');
  });
});

describe('sessions', () => {
  it('code-built sessions open with the double-bond ask, never repeat, and pass the oracle', () => {
    for (const band of ['3-5', '6-8'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        let s = seed;
        const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
        const challenges = makeMoleculeChallenges(pickMakeAsks(band, 4, undefined, rand));
        expect(challenges[0].instruction).toBe('Make a molecule with a double bond.');
        const data = { title: 'Make Molecules', description: 'Make your own.', challenges,
          palette: { availableElements: band === '6-8' ? ['H', 'C', 'N', 'O', 'S', 'Cl'] : ['H', 'C', 'N', 'O'] } };
        const r = moleculeConstructorOracle.verify(data, { componentId: 'molecule-constructor', evalMode: 'make_molecule', topic: 'Bonds', gradeLevel: 'grade 5' });
        expect(r.violations).toEqual([]);
        expect(r.checkedChallenges).toBe(4);
      }
    }
  });

  it('the harness builds a passing molecule, and one hydrogen short is a miss', () => {
    const [c] = makeMoleculeChallenges(pickMakeAsks('3-5', 1));
    const right = moleculeHarnessInputs(c, false);
    expect(right.at(-1)).toEqual({ type: 'choose', label: "I'm done!" });
    expect(moleculeHarnessInputs(c, true).filter(i => i.type === 'choose').length).toBe(right.filter(i => i.type === 'choose').length - 1);
    expect(specForAtoms([{ element: 'C', count: 2 }, { element: 'H', count: 6 }, { element: 'O', count: 1 }])).not.toBeNull();
    expect(specForAtoms([{ element: 'O', count: 2 }])).toEqual({ atoms: ['O', 'O'], bonds: [[0, 1, 2]] });
  });
});
