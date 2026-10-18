import type { MapExplorerData } from '../../../primitives/visual-primitives/history/MapExplorer';
import { mapAssignment } from '../../../primitives/visual-primitives/history/mapExplorerWorkspace';
import { MAP_TASKS, isTownTask, placeById } from '../../../primitives/visual-primitives/history/map/mapModel';
import { CONTINENTS, OCEANS } from '../../../primitives/visual-primitives/history/map/mapGeo';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const REGIONS: readonly string[] = [...CONTINENTS, ...OCEANS];

/**
 * Reject a map the workspace cannot run: every ask needs an id, a task, an instruction and a target that is on
 * the map (a place on the session's town map, or a continent or ocean).
 */
export function validateMapExplorerData(value: unknown): MapExplorerData {
  const d = value as MapExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated map has no title.');
  const asks = Array.isArray(d.challenges) ? d.challenges : [];
  const town = asks.some(c => (MAP_TASKS as readonly string[]).includes(c?.type) && isTownTask(c.type));
  if (town && (!d.townMap || !Array.isArray(d.townMap.places) || d.townMap.places.length < 3))
    throw new Error('Generated map has no town map.');
  if (!asks.length || asks.length > 12 || new Set(asks.map(c => c?.id)).size !== asks.length
      || asks.some(c => !c || typeof c.id !== 'string' || !c.id || !(MAP_TASKS as readonly string[]).includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || (isTownTask(c.type) ? !placeById(d.townMap, c.targetId) || !placeById(d.townMap, c.fromId) : !REGIONS.includes(c.targetId ?? ''))))
    throw new Error('Generated map has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the map; the catalog's `teachingWorkspace` declares the rest. */
export const mapExplorerLiveDomain: WorkspaceDomain<MapExplorerData> = {
  validate: validateMapExplorerData,
  initialState: data => workspaceOpening({
    title: data.title, task: mapAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
