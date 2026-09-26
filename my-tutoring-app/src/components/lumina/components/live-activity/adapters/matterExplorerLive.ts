import type { MatterExplorerData } from '../../../primitives/visual-primitives/chemistry/MatterExplorer';
import { itemsFromChallenges, type MatterExplorerItem } from '../../../primitives/visual-primitives/chemistry/matterExplorerScript';
import { matterAssignment } from '../../../primitives/visual-primitives/chemistry/matterExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The judged items, built exactly as the component builds them. */
export function matterItems(data: MatterExplorerData): MatterExplorerItem[] {
  return itemsFromChallenges(
    (data.challenges ?? []).map(c => ({ id: c.id, challengeType: c.type, objectId: c.objectId })),
    data.objects ?? [],
    { band: data.gradeBand === '1-2' ? '1-2' : 'K-1', tier: data.supportTier },
  );
}

/** Reject a lesson with nothing askable: the build gates drop an object whose name carries its state, a
 *  change that does not fit its object, a mystery with no safe clue. A payload with no challenges is the
 *  ungraded exploration shelf, which the workspace does not run. */
export function validateMatterExplorerData(value: unknown): MatterExplorerData {
  const d = value as MatterExplorerData;
  if (!d || !Array.isArray(d.objects) || !Array.isArray(d.challenges))
    throw new Error('Generated matter explorer has invalid lesson content.');
  if (!matterItems(d).length) throw new Error('No matter explorer challenge can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const matterExplorerLiveDomain: WorkspaceDomain<MatterExplorerData> = {
  validate: validateMatterExplorerData,
  initialState: data => {
    const items = matterItems(data);
    return workspaceOpening({ title: data.title || 'Matter Explorer', task: matterAssignment(items[0]).task, total: items.length });
  },
};
