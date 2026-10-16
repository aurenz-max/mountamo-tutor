import type { OrbitMechanicsLabData } from '../../../primitives/visual-primitives/astronomy/OrbitMechanicsLab';
import { askOf, orbitItems, resolveOrbitModes, validOrbitItem } from '../../../primitives/visual-primitives/astronomy/orbitWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's pushes, tracks or burn by the physics, so nothing else is trusted), or a requested mode with no item.
 */
export function validateOrbitMechanicsLabData(value: unknown): OrbitMechanicsLabData {
  const d = value as OrbitMechanicsLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated orbit lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validOrbitItem(i))) throw new Error('A generated orbit item is not one code can key.');
  const items = orbitItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated orbit items repeat an id.');
  for (const mode of resolveOrbitModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The orbit-mechanics-lab ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the orbit lab; the catalog's `teachingWorkspace` declares the rest. */
export const orbitMechanicsLabLiveDomain: WorkspaceDomain<OrbitMechanicsLabData> = {
  validate: validateOrbitMechanicsLabData,
  initialState: d => {
    const items = orbitItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
