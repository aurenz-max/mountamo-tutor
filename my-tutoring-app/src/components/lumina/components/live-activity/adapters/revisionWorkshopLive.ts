import type { RevisionWorkshopData } from '../../../primitives/visual-primitives/literacy/RevisionWorkshop';
import { revisionAssignment, revisionItems } from '../../../primitives/visual-primitives/literacy/revisionSteps';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Every target must sit in the draft (it is marked there), and reorganize needs 3+ sentences to order. */
export function validateRevisionWorkshopData(value: unknown): RevisionWorkshopData {
  const d = value as RevisionWorkshopData;
  if (!d || typeof d.title !== 'string' || typeof d.draft !== 'string' || !Array.isArray(d.targets))
    throw new Error('Generated revision workshop has invalid lesson content.');
  const items = revisionItems(d);
  if (!items.length) throw new Error('A revision lesson needs sentences to revise.');
  if (d.targets.some(t => !d.draft.includes(t.originalText.trim()))) throw new Error('A revision target is not in the draft.');
  return d;
}

/** What the live adapter needs from the revision workshop; the catalog's `teachingWorkspace` declares the rest. */
export const revisionWorkshopLiveDomain: WorkspaceDomain<RevisionWorkshopData> = {
  validate: validateRevisionWorkshopData,
  initialState: data => {
    const items = revisionItems(data);
    return workspaceOpening({ title: data.title, task: revisionAssignment(items[0]).task, total: items.length });
  },
};
