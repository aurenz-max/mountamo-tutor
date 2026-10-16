import type { VehicleComparisonLabData } from '../../../primitives/visual-primitives/engineering/VehicleComparisonLab';
import { askOf, resolveVehicleModes, validVehicleItem, vehicleItems } from '../../../primitives/visual-primitives/engineering/vehicleComparisonWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the numbers in the item's own table, so nothing else is trusted), or a requested mode with no item.
 */
export function validateVehicleComparisonData(value: unknown): VehicleComparisonLabData {
  const d = value as VehicleComparisonLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated vehicle lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validVehicleItem(i))) throw new Error('A generated vehicle item is not one code can key.');
  const items = vehicleItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated vehicle items repeat an id.');
  for (const mode of resolveVehicleModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The vehicle-comparison ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the vehicle lab; the catalog's `teachingWorkspace` declares the rest. */
export const vehicleComparisonLabLiveDomain: WorkspaceDomain<VehicleComparisonLabData> = {
  validate: validateVehicleComparisonData,
  initialState: d => {
    const items = vehicleItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
