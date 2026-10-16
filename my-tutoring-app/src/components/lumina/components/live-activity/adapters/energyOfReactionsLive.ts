import type { EnergyOfReactionsData } from '../../../primitives/visual-primitives/chemistry/EnergyOfReactions';
import { askOf, energyItems, resolveEnergyModes, thermoReaction } from '../../../primitives/visual-primitives/chemistry/energyOfReactionsWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a reaction id the library does not have, or a requested mode with no
 * item. Every item and key is built by code from the library and the diagram and bond tables, so nothing else is
 * trusted from the generator.
 */
export function validateEnergyOfReactionsData(value: unknown): EnergyOfReactionsData {
  const d = value as EnergyOfReactionsData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated energy-of-reactions lab has no title.');
  if (d.reactionIds !== undefined && (!Array.isArray(d.reactionIds) || d.reactionIds.some(id => !thermoReaction(id))))
    throw new Error('A generated energy-of-reactions reaction id is not in the reaction library.');
  const items = energyItems(d);
  for (const mode of resolveEnergyModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The energy-of-reactions ${mode} mode has no item to ask.`);
  }
  return d;
}

/** What the live adapter needs from the energy lab; the catalog's `teachingWorkspace` declares the rest. */
export const energyOfReactionsLiveDomain: WorkspaceDomain<EnergyOfReactionsData> = {
  validate: validateEnergyOfReactionsData,
  initialState: d => {
    const items = energyItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
