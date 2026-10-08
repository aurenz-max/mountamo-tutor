/**
 * The in-item levers on molecule-constructor's open build, `make_molecule` (/add-eval-modes references/build-mode.md).
 * The learner makes any molecule with the asked property on an empty board. Using up every atom's bonds IS the task,
 * so the item starts bare and the levers come on a miss, never from the tier. Designed from why learners fail:
 * - `open_bonds` (help): a hollow dot beside each atom for every bond it can still make. Learners stop with an atom
 *   that still has bonds to make (a hydrogen short, a single bond where a double fits) and cannot see where.
 * - `bond_tally` (help): under each atom, how many bonds it has made and how many it makes ("2 of 4"). Learners count
 *   a double bond as one bond, so a carbon with a double bond looks full at three lines.
 * - `piece_colors` (help): each separate piece of the build tinted its own colour. Learners make two small molecules
 *   side by side and call it one.
 * - `fewer_atoms` (simplify): an ungraded smaller ask first (fewer atoms, or one property fewer), on an empty board.
 * `too_many_bonds` has no lever: the board refuses a bond past an atom's valence, so it cannot be built.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { MoleculeConstructorChallenge } from './MoleculeConstructor';
import { askText, simplerAskFor, type MakeMoleculeMiss } from './moleculeBuild';
import { askOf } from './moleculeConstructorWorkspace';

export const OPEN_BONDS_LEVER = 'open_bonds';
export const BOND_TALLY_LEVER = 'bond_tally';
export const PIECE_COLORS_LEVER = 'piece_colors';
export const FEWER_ATOMS_LEVER = 'fewer_atoms';

const SIMPLER = '~simpler';
export const isPracticeMolecule = (c: Pick<MoleculeConstructorChallenge, 'id'>) => c.id.endsWith(SIMPLER);

/** The easier ask: the menu's smaller ask for this item, ungraded, on an empty board. */
export function simplerMolecule(c: MoleculeConstructorChallenge): MoleculeConstructorChallenge | null {
  if (c.type !== 'make_molecule' || isPracticeMolecule(c)) return null;
  const ask = simplerAskFor(askOf(c));
  if (!ask) return null;
  return { ...c, id: `${c.id}${SIMPLER}`, ask, instruction: askText(ask) };
}

export function moleculeLevers(c: MoleculeConstructorChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.type !== 'make_molecule') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly MakeMoleculeMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(OPEN_BONDS_LEVER, 'help', ['open_valence', 'bond_order_short'],
      'The learner stops while some atoms can still make bonds, and cannot find which.',
      'Puts a small hollow dot beside each atom on the board for every bond it can still make. It marks the learner\'s own atoms only.'),
    lever(BOND_TALLY_LEVER, 'help', ['bond_order_short', 'no_double_bond', 'no_triple_bond', 'open_valence'],
      'The learner counts a double or triple bond as one bond, or loses track of how many bonds an atom has made.',
      'Writes under each atom on the board how many bonds it has made and how many it makes in all, a double bond counting two.'),
    lever(PIECE_COLORS_LEVER, 'help', ['not_connected'],
      'The learner makes two or more separate pieces and calls them one molecule.',
      'Tints each separate piece of the learner\'s build its own colour, so the pieces show.'),
    ...(simplerMolecule(c) ? [lever(FEWER_ATOMS_LEVER, 'simplify',
      ['not_connected', 'open_valence', 'bond_order_short', 'no_double_bond', 'no_triple_bond', 'carbon_count_off', 'element_missing', 'too_many_atoms'],
      'The learner cannot make a molecule this big or with this many properties yet.',
      'Opens an easier ask first, a molecule with fewer atoms or one property fewer, on an empty board. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. */
export function leverFacts(c: MoleculeConstructorChallenge | null, pulled: readonly string[]): string {
  if (c?.type !== 'make_molecule') return '';
  return [
    pulled.includes(OPEN_BONDS_LEVER) && 'Beside each atom on the board is a hollow dot for every bond it can still make.',
    pulled.includes(BOND_TALLY_LEVER) && 'Under each atom is how many bonds it has made and how many it makes in all.',
    pulled.includes(PIECE_COLORS_LEVER) && 'Each separate piece of the build is tinted its own colour.',
  ].filter((s): s is string => !!s).join(' ');
}
