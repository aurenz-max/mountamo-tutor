import type { MissionPlannerData } from '../../../primitives/visual-primitives/astronomy/MissionPlanner';
import { askOf, isStoryGrade, missionItems, resolveMissionModes, validMissionItem }
  from '../../../primitives/visual-primitives/astronomy/missionWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a session a mode cannot be asked on: no title, the K-1 story (ungraded by user ruling 10-16; it renders
 * outside the workspace, as solar-system-explorer's exploration orrery does), a stored item code could not have built
 * (every key is computed from the item by code, so nothing else is trusted), or a requested mode with no item.
 */
export function validateMissionPlannerData(value: unknown): MissionPlannerData {
  const d = value as MissionPlannerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated mission planner has invalid lesson content.');
  if (isStoryGrade(d.gradeLevel)) throw new Error('The K-1 mission story is ungraded; the workspace does not run it.');
  if (Array.isArray(d.items) && d.items.some(i => !validMissionItem(i))) throw new Error('A generated mission item is not one code can key.');
  const items = missionItems(d);
  if (!items.length) throw new Error('The mission planner has no item.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated mission items repeat an id.');
  for (const mode of resolveMissionModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The mission-planner ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the mission planner; the catalog's `teachingWorkspace` declares the rest. */
export const missionPlannerLiveDomain: WorkspaceDomain<MissionPlannerData> = {
  validate: validateMissionPlannerData,
  initialState: d => {
    const items = missionItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
