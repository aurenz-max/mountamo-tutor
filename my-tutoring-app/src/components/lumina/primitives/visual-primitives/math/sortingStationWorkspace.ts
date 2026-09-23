/**
 * Sorting station on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The items
 * still come from `itemsFromChallenges` in `sortingStationScript.ts`. Every item is
 * spoken, judged by the observer against the pack's own `answer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, type SortingStationItem } from './sortingStationScript';

export function workspaceAssignment(item: SortingStationItem): TeachingAssignment {
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: item.answer };
}

export function workspaceScene(item: SortingStationItem): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: item.kind,
      // The card or group the ask is about; on odd_one, a description of the whole set.
      about: item.stimulus,
      ...(item.choices.length ? { options: item.choices.join(', ') } : {}),
      // On pick_rule the sorting rule is the answer.
      ...(item.ruleName && item.kind !== 'pick_rule' ? { sortingBy: item.ruleName } : {}),
      constraints: item.hidesCounts
        ? 'The learner says the answer. The group counts are hidden until the answer is credited.'
        : 'The learner says the answer. Nothing on screen is tapped or moved.',
    },
  };
}
