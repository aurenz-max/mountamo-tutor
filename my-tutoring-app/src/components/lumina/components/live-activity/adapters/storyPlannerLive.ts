import type { StoryPlannerData } from '../../../primitives/visual-primitives/literacy/StoryPlanner';
import { storyAssignment, storyItems } from '../../../primitives/visual-primitives/literacy/storySteps';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** A plan needs a story idea and cards to fill (or pictures to pick). */
export function validateStoryPlannerData(value: unknown): StoryPlannerData {
  const d = value as StoryPlannerData;
  if (!d || typeof d.title !== 'string' || typeof d.writingPrompt !== 'string' || !d.writingPrompt.trim())
    throw new Error('Generated story planner has invalid lesson content.');
  if (!storyItems(d).length) throw new Error('A story plan needs cards to fill.');
  return d;
}

/** What the live adapter needs from the planner; the catalog's `teachingWorkspace` declares the rest. */
export const storyPlannerLiveDomain: WorkspaceDomain<StoryPlannerData> = {
  validate: validateStoryPlannerData,
  initialState: data => {
    const items = storyItems(data);
    return workspaceOpening({ title: data.title, task: storyAssignment(items[0]).task, total: items.length });
  },
};
