import type { GasLawsSimulatorData } from '../../../primitives/visual-primitives/chemistry/GasLawsSimulator';
import { askOf, gasItems, resolveGasModes, validGasItem } from '../../../primitives/visual-primitives/chemistry/gasLawsWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed from
 * the container, the state before and the changes, so nothing else is trusted), or a requested mode with no item.
 */
export function validateGasLawsData(value: unknown): GasLawsSimulatorData {
  const d = value as GasLawsSimulatorData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated gas laws lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validGasItem(i))) throw new Error('A generated gas-laws item is not one code can key.');
  const items = gasItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated gas-laws items repeat an id.');
  for (const mode of resolveGasModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The gas-laws ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the gas laws lab; the catalog's `teachingWorkspace` declares the rest. */
export const gasLawsSimulatorLiveDomain: WorkspaceDomain<GasLawsSimulatorData> = {
  validate: validateGasLawsData,
  initialState: d => {
    const items = gasItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
