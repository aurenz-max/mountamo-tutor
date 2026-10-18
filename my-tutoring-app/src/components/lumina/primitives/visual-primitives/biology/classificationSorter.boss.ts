/**
 * The classification sorter's boss, on the tap preset (`components/live-activity/boss.ts`): the card is
 * `classificationSorter.card.ts`; this file is what the preset cannot know — the content check, the ask, the
 * levers and the harness's taps. The live adapter and the journey row are built from it.
 */
import type { ClassificationItem, ClassificationSorterData } from './ClassificationSorter';
import { hasText as text, tapBoss } from '../../../components/live-activity/boss';
import { classificationSorterCard } from './classificationSorter.card';
import { sortAsk, sortHarnessTargets, type SortMiss } from './classificationSorterWorkspace';
import { SORT_LEVERS } from './classificationSorterLevers';

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

export const classificationSorterBoss = tapBoss<ClassificationSorterData, ClassificationItem, SortMiss>({
  card: classificationSorterCard,
  validate: validateClassificationSorterData,
  items: data => data.items,
  levers: SORT_LEVERS,
  // Each item is staged alone: tap its group card (wrong: the first other group).
  choice: { ask: sortAsk, targets: (item, data) => sortHarnessTargets(data.categories ?? [], item) },
  drive: {
    component: 'primitives/visual-primitives/biology/ClassificationSorter.tsx',
    instanceId: 'sorter-bio',
    defaults: { grade: 'Kindergarten', mode: 'sort', topic: 'Animals with wings and animals without wings' },
    mounted: '[data-pip-object="card"]',
  },
});
