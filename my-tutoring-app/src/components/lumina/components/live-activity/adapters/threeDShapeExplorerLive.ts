import type { ThreeDShapeExplorerData } from '../../../primitives/visual-primitives/math/ThreeDShapeExplorer';
import { buildThreeDShapeItems } from '../../../primitives/visual-primitives/math/threeDShapeExplorerScript';
import { threeDShapeAssignment } from '../../../primitives/visual-primitives/math/threeDShapeExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lab the pack would drop whole: no challenges, or none its truth-table gates can ask. A challenge
 *  the gates drop is dropped, as it always was; the lab runs if anything is left to ask. */
export function validateThreeDShapeExplorerData(value: unknown): ThreeDShapeExplorerData {
  const d = value as ThreeDShapeExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated 3D shape explorer has invalid lesson content.');
  if (!buildThreeDShapeItems(d.challenges).items.length) throw new Error('No 3D shape challenge can be asked.');
  return d;
}

/** What the live adapter needs from the lab; the catalog's `teachingWorkspace` declares the rest. */
export const threeDShapeExplorerLiveDomain: WorkspaceDomain<ThreeDShapeExplorerData> = {
  validate: validateThreeDShapeExplorerData,
  initialState: data => {
    const { items } = buildThreeDShapeItems(data.challenges);
    return workspaceOpening({ title: data.title, task: threeDShapeAssignment(items[0]).task, total: items.length });
  },
};
