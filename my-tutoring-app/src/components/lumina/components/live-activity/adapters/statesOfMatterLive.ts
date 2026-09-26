import type { StatesOfMatterData } from '../../../primitives/visual-primitives/chemistry/StatesOfMatter';
import { itemsFromChallenges, type StatesOfMatterItem } from '../../../primitives/visual-primitives/chemistry/statesOfMatterScript';
import { statesAssignment } from '../../../primitives/visual-primitives/chemistry/statesOfMatterWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** The judged items, built exactly as the component builds them. */
export function statesItems(data: StatesOfMatterData): StatesOfMatterItem[] {
  return itemsFromChallenges(data.challenges ?? [], { band: data.gradeBand ?? '3-5', tier: data.supportTier ?? 'medium' });
}

/** Reject a lesson with nothing askable: the build gates drop an unknown substance, a temperature on a
 *  threshold, a confusable pair. A payload with no challenges is the ungraded particle sim, which the
 *  workspace does not run. */
export function validateStatesOfMatterData(value: unknown): StatesOfMatterData {
  const d = value as StatesOfMatterData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated states of matter has invalid lesson content.');
  if (!statesItems(d).length) throw new Error('No states of matter challenge can be asked.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const statesOfMatterLiveDomain: WorkspaceDomain<StatesOfMatterData> = {
  validate: validateStatesOfMatterData,
  initialState: data => {
    const items = statesItems(data);
    return workspaceOpening({ title: data.title || 'States of Matter', task: statesAssignment(items[0]).task, total: items.length });
  },
};
