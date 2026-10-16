import type { ConstructionSequencePlannerData } from '../../../primitives/visual-primitives/engineering/ConstructionSequencePlanner';
import { askOf, cspItems, resolveCspModes, validCspItem } from '../../../primitives/visual-primitives/engineering/constructionSequenceWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a planner a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's jobs and needs, so nothing else is trusted), or a requested mode with no item.
 */
export function validateConstructionSequenceData(value: unknown): ConstructionSequencePlannerData {
  const d = value as ConstructionSequencePlannerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated construction planner has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validCspItem(i))) throw new Error('A generated construction item is not one code can key.');
  const items = cspItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated construction items repeat an id.');
  for (const mode of resolveCspModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The construction-sequence-planner ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the planner; the catalog's `teachingWorkspace` declares the rest. */
export const constructionSequencePlannerLiveDomain: WorkspaceDomain<ConstructionSequencePlannerData> = {
  validate: validateConstructionSequenceData,
  initialState: d => {
    const items = cspItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
