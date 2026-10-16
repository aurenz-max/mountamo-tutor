import type { TransportChallengeData } from '../../../primitives/visual-primitives/engineering/TransportChallenge';
import { askOf, resolveTransportModes, transportItems, validTransportItem } from '../../../primitives/visual-primitives/engineering/transportWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a challenge a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's load, vehicles and limits, so nothing else is trusted), or a requested mode with no item.
 */
export function validateTransportData(value: unknown): TransportChallengeData {
  const d = value as TransportChallengeData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated transport challenge has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validTransportItem(i))) throw new Error('A generated transport job is not one code can key.');
  const items = transportItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated transport jobs repeat an id.');
  for (const mode of resolveTransportModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The transport-challenge ${mode} mode has no job.`);
  }
  return d;
}

/** What the live adapter needs from the challenge; the catalog's `teachingWorkspace` declares the rest. */
export const transportChallengeLiveDomain: WorkspaceDomain<TransportChallengeData> = {
  validate: validateTransportData,
  initialState: d => {
    const items = transportItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
