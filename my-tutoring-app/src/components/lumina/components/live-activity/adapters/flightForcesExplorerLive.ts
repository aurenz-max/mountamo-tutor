import type { FlightForcesExplorerData } from '../../../primitives/visual-primitives/engineering/FlightForcesExplorer';
import { askOf, flightItems, resolveFlightModes, validFlightItem } from '../../../primitives/visual-primitives/engineering/flightForcesWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's force sizes, change or goal, so nothing else is trusted), or a requested mode with no item.
 */
export function validateFlightForcesData(value: unknown): FlightForcesExplorerData {
  const d = value as FlightForcesExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated flight lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validFlightItem(i))) throw new Error('A generated flight item is not one code can key.');
  const items = flightItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated flight items repeat an id.');
  for (const mode of resolveFlightModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The flight-forces ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the flight lab; the catalog's `teachingWorkspace` declares the rest. */
export const flightForcesExplorerLiveDomain: WorkspaceDomain<FlightForcesExplorerData> = {
  validate: validateFlightForcesData,
  initialState: d => {
    const items = flightItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
