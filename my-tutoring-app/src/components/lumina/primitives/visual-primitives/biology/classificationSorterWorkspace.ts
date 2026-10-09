/**
 * Classification sorter on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md). One mode, `sort`: each item of the lesson is one challenge, staged alone,
 * and the learner taps the group it belongs in.
 *
 * Pure: the component, the adapter, the journey row and the tests read the same assignment, scene, check and
 * miss. The group an item belongs in (`correctCategoryId`) is checked by code and never reaches the tutor.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ClassificationCategory, ClassificationItem, ClassificationSorterData } from './ClassificationSorter';

/** The ask for one item. Names the item and the rule; never a group. */
export const sortAsk = (item: ClassificationItem) => `Which group does "${item.label}" go in?`;

export function workspaceAssignment(item: ClassificationItem): TeachingAssignment {
  return { id: item.id, task: sortAsk(item), response: 'gesture' };
}

/** The activity's own check. */
export const sortMatches = (item: ClassificationItem, categoryId: string) => item.correctCategoryId === categoryId;

const labelOf = (categories: readonly ClassificationCategory[], id: string | null) =>
  categories.find(c => c.id === id)?.label ?? id ?? '';

/** The learner's work in words: the group they put it in, never the key. */
export function describeSort(item: ClassificationItem, categories: readonly ClassificationCategory[], placedIn: string | null): string {
  return placedIn ? `Put "${item.label}" in "${labelOf(categories, placedIn)}"` : `"${item.label}" is not in a group yet`;
}

/**
 * What a wrong placement shows (`TeachingAttempt.miss`, handoff 20), from what the check reads:
 * - `repeated_group`: the same wrong group as the learner's last try on this item;
 * - `parent_group`: the group the right one sits under (a hierarchical sort);
 * - `sibling_group`: a group under the same parent as the right one (a hierarchical sort);
 * - `wrong_group`: any other group.
 */
export type SortMiss = 'repeated_group' | 'parent_group' | 'sibling_group' | 'wrong_group';
export const SORT_MISSES: readonly SortMiss[] = ['repeated_group', 'parent_group', 'sibling_group', 'wrong_group'];

export function sortMiss(item: ClassificationItem, categories: readonly ClassificationCategory[], placedIn: string,
  lastWrong: string | null = null): SortMiss | undefined {
  if (sortMatches(item, placedIn)) return undefined;
  if (lastWrong === placedIn) return 'repeated_group';
  const right = categories.find(c => c.id === item.correctCategoryId);
  const picked = categories.find(c => c.id === placedIn);
  if (right?.parentId && right.parentId === placedIn) return 'parent_group';
  if (right?.parentId && picked?.parentId === right.parentId) return 'sibling_group';
  return 'wrong_group';
}

export interface SortView {
  /** The group the learner put the item in on this try, if any. */
  placedIn: string | null;
  /** Items already credited, by the group they sit in (what the bins show). */
  sorted: ReadonlyArray<{ label: string; categoryId: string }>;
  /** Whether each group's description is on screen (hidden for pre-readers). */
  descriptionsShown: boolean;
  /** Help put on screen by a pulled lever, in words the tutor can say. */
  onScreen?: string;
  practice?: boolean;
}

/** What is drawn and asked: the rule, the groups and the one card on stage; no item's group. */
export function workspaceScene(data: Pick<ClassificationSorterData, 'sortingRule' | 'categories' | 'gradeBand'>,
  item: ClassificationItem, view: SortView): WorkspaceScene {
  const preReader = data.gradeBand === 'K-2';
  const bins = data.categories.map(c => {
    const inIt = view.sorted.filter(s => s.categoryId === c.id).map(s => s.label);
    return `${c.label}: ${inIt.length ? inIt.join(', ') : 'empty'}`;
  }).join('; ');
  return {
    objects: [],
    facts: {
      kind: 'sort',
      rule: data.sortingRule,
      groups: data.categories.map(c => c.label).join(', '),
      groupDescriptions: view.descriptionsShown
        ? data.categories.map(c => `${c.label}: ${c.description}`).join(' | ') : 'hidden (the learner may not read)',
      cardOnStage: item.label,
      alreadySorted: bins,
      ...(view.onScreen ? { onScreen: view.onScreen } : {}),
      ...(view.practice ? { practice: 'an easier practice card; it is not graded' } : {}),
      learnerWork: describeSort(item, data.categories, view.placedIn),
      constraints: `${preReader ? 'The learner may not read: say the card, the rule and the group names aloud. ' : ''}`
        + 'The learner answers on the screen by tapping a group card; the activity checks the placement itself. '
        + 'You cannot tap or place for the learner.',
    },
  };
}

/** The journey's group cards for an item: the right one, and a wrong one (the first other group). */
export function sortHarnessTargets(categories: readonly ClassificationCategory[], item: ClassificationItem) {
  const wrong = categories.find(c => c.id !== item.correctCategoryId);
  return { correct: `group-${item.correctCategoryId}`, wrong: wrong ? `group-${wrong.id}` : null };
}
