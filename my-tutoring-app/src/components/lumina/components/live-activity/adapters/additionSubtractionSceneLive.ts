import type { AdditionSubtractionSceneData } from '../../../primitives/visual-primitives/math/AdditionSubtractionScene';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/math/additionSubtractionSceneScript';
import { additionSubtractionAssignment } from '../../../primitives/visual-primitives/math/additionSubtractionSceneWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a story the pack would drop: inconsistent arithmetic, an answer of zero or past twenty, or a story
 *  that states the number the child must find. */
export function validateAdditionSubtractionSceneData(value: unknown): AdditionSubtractionSceneData {
  const band = (value as AdditionSubtractionSceneData)?.gradeBand ?? 'K';
  return validateChallengePool<AdditionSubtractionSceneData>(value, c => !!c && itemsFromChallenges([c], { band }).length === 1,
    { pool: 'Generated addition-subtraction scene has invalid lesson content.', item: 'A story in this scene cannot be asked.' });
}

/** What the live adapter needs from the scene; the catalog's `teachingWorkspace` declares the rest. */
export const additionSubtractionSceneLiveDomain: WorkspaceDomain<AdditionSubtractionSceneData> = {
  validate: validateAdditionSubtractionSceneData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges, { band: data.gradeBand ?? 'K' });
    return workspaceOpening({ title: data.title, task: additionSubtractionAssignment(items[0]).task, total: items.length });
  },
};
