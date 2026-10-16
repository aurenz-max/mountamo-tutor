import type { TelescopeSimulatorData } from '../../../primitives/visual-primitives/astronomy/TelescopeSimulator';
import { askOf, resolveTelescopeModes, telescopeItems, validTelescopeItem } from '../../../primitives/visual-primitives/astronomy/telescopeWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's objects, clues or detail, so nothing else is trusted), or a requested mode with no item.
 */
export function validateTelescopeSimulatorData(value: unknown): TelescopeSimulatorData {
  const d = value as TelescopeSimulatorData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated telescope session has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validTelescopeItem(i))) throw new Error('A generated telescope item is not one code can key.');
  const items = telescopeItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated telescope items repeat an id.');
  for (const mode of resolveTelescopeModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The telescope-simulator ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the telescope simulator; the catalog's `teachingWorkspace` declares the rest. */
export const telescopeSimulatorLiveDomain: WorkspaceDomain<TelescopeSimulatorData> = {
  validate: validateTelescopeSimulatorData,
  initialState: d => {
    const items = telescopeItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
