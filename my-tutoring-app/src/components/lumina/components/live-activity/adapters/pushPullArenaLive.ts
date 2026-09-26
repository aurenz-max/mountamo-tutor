import type { PushPullArenaData } from '../../../primitives/visual-primitives/physics/PushPullArena';
import { itemsFromChallenges, type ArenaChallengeLike } from '../../../primitives/visual-primitives/physics/pushPullArenaScript';
import { pushPullArenaAssignment } from '../../../primitives/visual-primitives/physics/pushPullArenaWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject an arena with nothing decisive to ask: the build gates drop a predict on the friction
 *  boundary, a compare of equal weights, a design inside the murky band. What they drop stays dropped. */
export function validatePushPullArenaData(value: unknown): PushPullArenaData {
  const d = value as PushPullArenaData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated push-pull arena has invalid lesson content.');
  if (!itemsFromChallenges(d.challenges as ArenaChallengeLike[]).length) throw new Error('No push-pull arena challenge can be asked.');
  return d;
}

/** What the live adapter needs from the arena; the catalog's `teachingWorkspace` declares the rest. */
export const pushPullArenaLiveDomain: WorkspaceDomain<PushPullArenaData> = {
  validate: validatePushPullArenaData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges as ArenaChallengeLike[]);
    return workspaceOpening({ title: data.title, task: pushPullArenaAssignment(items[0]).task, total: items.length });
  },
};
