import type { GravityDropTowerData } from '../../../primitives/visual-primitives/physics/GravityDropTower';
import { askOf, dropItems, resolveDropModes, validDropItem } from '../../../primitives/visual-primitives/physics/gravityDropWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a tower a mode cannot be asked on: no title, a stored item code could not have built (its key is computed
 * from the objects, the heights and the air, so nothing else is trusted), or a requested mode with no item.
 */
export function validateGravityDropData(value: unknown): GravityDropTowerData {
  const d = value as GravityDropTowerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated gravity drop tower has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validDropItem(i))) throw new Error('A generated gravity-drop item is not one code can key.');
  const items = dropItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated gravity-drop items repeat an id.');
  for (const mode of resolveDropModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The gravity-drop ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the drop tower; the catalog's `teachingWorkspace` declares the rest. */
export const gravityDropTowerLiveDomain: WorkspaceDomain<GravityDropTowerData> = {
  validate: validateGravityDropData,
  initialState: d => {
    const items = dropItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
