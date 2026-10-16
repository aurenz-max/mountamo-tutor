import type { StoichiometryLabData } from '../../../primitives/visual-primitives/chemistry/StoichiometryLab';
import {
  askOf, normalizeReaction, resolveStoichModes, stoichItems,
} from '../../../primitives/visual-primitives/chemistry/stoichiometryLabWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a reaction code cannot read (a formula with no molar mass, a
 * repeated formula, a coefficient below 1), or a requested mode with no item (limiting and yield need two reactants).
 * Every key is computed from the reaction and the givens, so nothing else is trusted from the generator.
 */
export function validateStoichiometryLabData(value: unknown): StoichiometryLabData {
  const d = value as StoichiometryLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || !normalizeReaction(d.reaction))
    throw new Error('Generated stoichiometry lab has no readable reaction.');
  const items = stoichItems(d);
  if (!items.length) throw new Error('Generated stoichiometry lab has no item to ask.');
  for (const mode of resolveStoichModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The stoichiometry-lab ${mode} mode has no item on this reaction.`);
  }
  return d;
}

/** What the live adapter needs from the stoichiometry lab; the catalog's `teachingWorkspace` declares the rest. */
export const stoichiometryLabLiveDomain: WorkspaceDomain<StoichiometryLabData> = {
  validate: validateStoichiometryLabData,
  initialState: d => {
    const items = stoichItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
