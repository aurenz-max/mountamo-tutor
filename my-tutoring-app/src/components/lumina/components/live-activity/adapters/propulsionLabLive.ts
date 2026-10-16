import type { PropulsionLabData } from '../../../primitives/visual-primitives/engineering/PropulsionLab';
import { askOf, propulsionItems, resolvePropulsionModes, validPropulsionItem } from '../../../primitives/visual-primitives/engineering/propulsionWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's engines, place or question, so nothing else is trusted), or a requested mode with no item.
 */
export function validatePropulsionLabData(value: unknown): PropulsionLabData {
  const d = value as PropulsionLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated propulsion lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validPropulsionItem(i))) throw new Error('A generated propulsion item is not one code can key.');
  const items = propulsionItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated propulsion items repeat an id.');
  for (const mode of resolvePropulsionModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The propulsion-lab ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the propulsion lab; the catalog's `teachingWorkspace` declares the rest. */
export const propulsionLabLiveDomain: WorkspaceDomain<PropulsionLabData> = {
  validate: validatePropulsionLabData,
  initialState: d => {
    const items = propulsionItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
