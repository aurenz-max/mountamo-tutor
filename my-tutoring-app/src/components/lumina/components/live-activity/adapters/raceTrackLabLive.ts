import type { RaceTrackLabData } from '../../../primitives/visual-primitives/physics/RaceTrackLab';
import { askOf, raceItems, resolveRaceModes, validRaceItem } from '../../../primitives/visual-primitives/physics/raceTrackWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed from
 * the cars' speeds, starts and times, so nothing else is trusted), or a requested mode with no item.
 */
export function validateRaceTrackData(value: unknown): RaceTrackLabData {
  const d = value as RaceTrackLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated race track lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validRaceItem(i))) throw new Error('A generated race-track item is not one code can key.');
  const items = raceItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated race-track items repeat an id.');
  for (const mode of resolveRaceModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The race-track ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the race track lab; the catalog's `teachingWorkspace` declares the rest. */
export const raceTrackLabLiveDomain: WorkspaceDomain<RaceTrackLabData> = {
  validate: validateRaceTrackData,
  initialState: d => {
    const items = raceItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
