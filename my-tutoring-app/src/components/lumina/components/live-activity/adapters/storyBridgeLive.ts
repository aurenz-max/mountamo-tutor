import type { StoryBridgeData } from '../../../primitives/visual-primitives/literacy/StoryBridge';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/storyBridgeScript';
import { storyBridgeAssignment } from '../../../primitives/visual-primitives/literacy/storyBridgeWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a comparison the pack would drop: stories it cannot find, a pair that is one story, a behaviour
 *  that names a friend, a Venn detail or event pairing its gates refuse. */
export function validateStoryBridgeData(value: unknown): StoryBridgeData {
  const d = value as StoryBridgeData;
  if (!d || !Array.isArray(d.stories) || d.stories.length < 2) throw new Error('Generated story bridge has no story pair.');
  return validateChallengePool<StoryBridgeData>(value, c => !!c && itemsFromChallenges([c], d.stories).length === 1,
    { pool: 'Generated story bridge has invalid lesson content.', item: 'A story bridge comparison cannot be asked.' });
}

/** What the live adapter needs from the bridge; the catalog's `teachingWorkspace` declares the rest. */
export const storyBridgeLiveDomain: WorkspaceDomain<StoryBridgeData> = {
  validate: validateStoryBridgeData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges, data.stories);
    return workspaceOpening({ title: data.title, task: storyBridgeAssignment(items[0]).task, total: items.length });
  },
};
