/**
 * molecule-constructor's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `moleculeConstructor.boss.ts`.
 * Every item is answered on screen and checked by the activity, one at a time: a build on the canvas (build, predict),
 * a typed name or formula for a drawn molecule (identify), or an open build on an empty board (make_molecule). The
 * generator does not pin the classic modes, so a build, identify or predict session can hold any classic item type;
 * the scene's `kind` names the item's type, and the moves of every mode are in the guidance.
 */
import type { MakeMoleculeMiss } from './moleculeBuild';
import { defineCard } from '../../../components/live-activity/boss';

export type MoleculeMode = 'build' | 'identify' | 'predict' | 'make_molecule';

/**
 * What a wrong answer on a classic item shows (`moleculeConstructorMiss`):
 * - `atoms_off` (build_target): the atom counts are not the target's;
 * - `open_valence` (build_target): the right atoms, but some still have bonds to make;
 * - `name_off` (identify), `formula_off` (formula_write): the typed answer is not the key;
 * - `no_bonds` (free_build, predict_bonds, shape_predict): no atoms joined yet.
 * make_molecule's misses are `MakeMoleculeMiss` (moleculeBuild.ts).
 */
export type ClassicMoleculeMiss = 'atoms_off' | 'open_valence' | 'name_off' | 'formula_off' | 'no_bonds';
export type MoleculeMiss = ClassicMoleculeMiss | MakeMoleculeMiss;

const CLASSIC: readonly ClassicMoleculeMiss[] = ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'no_bonds'];
export const MOLECULE_MISSES_BY_MODE: Record<MoleculeMode, readonly MoleculeMiss[]> = {
  build: CLASSIC,
  identify: CLASSIC,
  predict: CLASSIC,
  make_molecule: ['not_connected', 'too_many_bonds', 'bond_order_short', 'open_valence', 'no_triple_bond', 'no_double_bond',
    'carbon_count_off', 'element_missing', 'too_many_atoms'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const CANVAS = { ...CHECKED, answer: 'build',
  moves: 'taps an element to add an atom and taps two atoms to join them (again for a double or triple bond), then presses '
    + 'Check Answer' } as const;
const M = MOLECULE_MISSES_BY_MODE;

export const moleculeConstructorCard = defineCard<MoleculeMiss>({
  id: 'molecule-constructor',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // build_target, free_build, identify, formula_write and make_molecule items publish levers
  // (`moleculeConstructorLevers.ts`); predict_bonds and shape_predict items have none.
  modes: {
    // `name_off` and `formula_off` come only from identify and formula_write items, which an unpinned build session can
    // hold; their levers answer them there, but the saved build payload holds none, so the sweep cannot see it.
    build: { ...CANVAS, misses: M.build, unanswered: ['name_off', 'formula_off'] },
    // predict_bonds and shape_predict pass any build with one bond and check no prediction (EVAL_TRACKER MC-2), so their
    // `no_bonds` has no lever on those items; identify and predict sessions hold them.
    identify: { ...CHECKED, answer: 'type', moves: 'reads the molecule drawn on the canvas and types its name or its formula, '
      + 'then presses Check Answer', misses: M.identify, unanswered: ['no_bonds'] },
    predict: { ...CANVAS, misses: M.predict, unanswered: ['no_bonds'] },
    // The board refuses a bond past an atom's valence, so `too_many_bonds` cannot be built: no lever answers it.
    make_molecule: { ...CHECKED, answer: 'build', moves: 'taps an element to add an atom, taps two atoms to join them (again '
      + 'for a double or triple bond) and taps a bond to take one step of it away, then presses I\'m done! to hand it in',
    misses: M.make_molecule, unanswered: ['too_many_bonds'] },
  },
  words: {
    job: 'make molecules from atoms in which every atom uses all its bonds: build a named molecule or any molecule, name a '
      + 'drawn molecule or write its formula, or make any molecule that has the property asked (many molecules pass)',
    answer: 'the molecule they built or what they typed',
    question: 'the instruction and the elements they can add',
  },
  levers: true,
});
