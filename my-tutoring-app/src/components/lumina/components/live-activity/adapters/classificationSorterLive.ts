import type { ClassificationSorterData } from '../../../primitives/visual-primitives/biology/ClassificationSorter';
import { sortAsk } from '../../../primitives/visual-primitives/biology/classificationSorterWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Reject a sort whose items cannot be placed: each item is one challenge and needs a group that exists. */
export function validateClassificationSorterData(value: unknown): ClassificationSorterData {
  const d = value as ClassificationSorterData;
  if (!d || !text(d.title) || !text(d.sortingRule) || !Array.isArray(d.categories) || d.categories.length < 2
      || !Array.isArray(d.items) || !d.items.length || d.items.length > 12)
    throw new Error('Generated classification sorter has invalid lesson content.');
  const groups = new Set(d.categories.map(c => c?.id));
  if (groups.size !== d.categories.length || d.categories.some(c => !text(c?.id) || !text(c?.label))
      || new Set(d.items.map(i => i?.id)).size !== d.items.length
      || d.items.some(i => !i || !text(i.id) || !text(i.label) || !groups.has(i.correctCategoryId)))
    throw new Error('A classification-sorter item cannot be placed as generated.');
  return d;
}

/** What the live adapter needs from the classification sorter; the catalog's `teachingWorkspace` declares the rest. */
export const classificationSorterLiveDomain: WorkspaceDomain<ClassificationSorterData> = {
  validate: validateClassificationSorterData,
  initialState: d => workspaceOpening({ title: d.title, task: sortAsk(d.items[0]), total: d.items.length }),
};
