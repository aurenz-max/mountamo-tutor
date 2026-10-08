import type { OpenBuilderData } from '../../../primitives/visual-primitives/creation/OpenBuilder';
import { openBuilderAssignment } from '../../../primitives/visual-primitives/creation/openBuilderWorkspace';
import { SCENES } from '../../../primitives/visual-primitives/creation/openBuilderModel';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a studio the workspace cannot run: every project needs an id, a goal and a scene the board can draw. */
export function validateOpenBuilderData(value: unknown): OpenBuilderData {
  const d = value as OpenBuilderData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated open builder has no title.');
  const projects = Array.isArray(d.challenges) ? d.challenges : [];
  if (!projects.length || projects.length > 12 || new Set(projects.map(c => c?.id)).size !== projects.length
      || projects.some(c => !c || typeof c.id !== 'string' || !c.id || c.type !== 'build_to_goal'
        || typeof c.goal !== 'string' || !c.goal.trim()
        || typeof c.sceneId !== 'string' || !Object.prototype.hasOwnProperty.call(SCENES, c.sceneId)))
    throw new Error('Generated open builder has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the open builder; the catalog's `teachingWorkspace` declares the rest. */
export const openBuilderLiveDomain: WorkspaceDomain<OpenBuilderData> = {
  validate: validateOpenBuilderData,
  initialState: data => workspaceOpening({
    title: data.title, task: openBuilderAssignment(data.challenges[0]).task, total: data.challenges.length,
  }),
};
