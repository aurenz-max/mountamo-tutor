import type { RocketBuilderData } from '../../../primitives/visual-primitives/astronomy/RocketBuilder';
import { askOf, resolveRocketModes, rocketItems, validRocketItem } from '../../../primitives/visual-primitives/astronomy/rocketWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's parts by the flight model, so nothing else is trusted), or a requested mode with no item.
 */
export function validateRocketBuilderData(value: unknown): RocketBuilderData {
  const d = value as RocketBuilderData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated rocket builder has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validRocketItem(i))) throw new Error('A generated rocket item is not one code can key.');
  const items = rocketItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated rocket items repeat an id.');
  for (const mode of resolveRocketModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The rocket-builder ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the rocket builder; the catalog's `teachingWorkspace` declares the rest. */
export const rocketBuilderLiveDomain: WorkspaceDomain<RocketBuilderData> = {
  validate: validateRocketBuilderData,
  initialState: d => {
    const items = rocketItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
