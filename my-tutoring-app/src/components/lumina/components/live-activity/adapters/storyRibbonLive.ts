import type { StoryRibbonData } from '../../../primitives/visual-primitives/literacy/StoryRibbon';
import { itemFromChallenge, itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/storyRibbonScript';
import { storyRibbonAssignment } from '../../../primitives/visual-primitives/literacy/storyRibbonWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a ribbon the pack would drop: not exactly three valid events, a time cue that does not match the
 *  mode, or a picture label that is a sentence. */
export function validateStoryRibbonData(value: unknown): StoryRibbonData {
  return validateChallengePool<StoryRibbonData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated story ribbon has invalid lesson content.', item: 'A story ribbon item cannot be asked.' });
}

/** What the live adapter needs from the ribbon; the catalog's `teachingWorkspace` declares the rest. */
export const storyRibbonLiveDomain: WorkspaceDomain<StoryRibbonData> = {
  validate: validateStoryRibbonData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: storyRibbonAssignment(items[0]).task, total: items.length });
  },
};
