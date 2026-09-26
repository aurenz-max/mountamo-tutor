import type { HabitatDioramaData } from '../../../primitives/visual-primitives/biology/HabitatDiorama';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/biology/habitatDioramaScript';
import { habitatAssignment } from '../../../primitives/visual-primitives/biology/habitatDioramaWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a habitat with nothing askable: the build gates drop a leaked prompt, an inverted predation
 *  edge, choices the ear cannot tell apart. A payload with no challenges is the ungraded exploration
 *  diorama, which the workspace does not run. */
export function validateHabitatDioramaData(value: unknown): HabitatDioramaData {
  const d = value as HabitatDioramaData;
  if (!d || !d.habitat || typeof d.habitat.name !== 'string' || !Array.isArray(d.organisms) || !Array.isArray(d.relationships))
    throw new Error('Generated habitat diorama has invalid lesson content.');
  if (!itemsFromChallenges(d.challenges ?? [], d).items.length) throw new Error('No habitat diorama challenge can be asked.');
  return d;
}

/** What the live adapter needs from the habitat; the catalog's `teachingWorkspace` declares the rest. */
export const habitatDioramaLiveDomain: WorkspaceDomain<HabitatDioramaData> = {
  validate: validateHabitatDioramaData,
  initialState: data => {
    const { items } = itemsFromChallenges(data.challenges ?? [], data);
    return workspaceOpening({ title: data.habitat.name, task: habitatAssignment(items[0]).task, total: items.length });
  },
};
