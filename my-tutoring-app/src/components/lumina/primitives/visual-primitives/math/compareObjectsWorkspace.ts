/**
 * Compare objects on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure and React-free: the component and any probe read the same assignment and
 * scene from here. The items still come from `buildCompareItems` in
 * `compareObjectsScript.ts`. W1 publishes no demonstration targets, so the scene
 * carries facts only, and never the measurements behind the drawing.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, type CompareObjectsItem } from './compareObjectsScript';

/** The spoken key the observer judges the tutor's feedback against. */
function spokenAnswer(item: CompareObjectsItem): string {
  if (item.kind === 'identify_attribute') return item.attribute;
  if (item.kind === 'non_standard') return String(item.unitCount);
  return item.answerNames[0];
}

export function workspaceAssignment(item: CompareObjectsItem): TeachingAssignment {
  // An arrangement is checked by the board, so the tutor is not handed its key.
  if (item.answerKind === 'gesture') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: spokenAnswer(item) };
}

/** Does the committed arrangement name every object, in the asked order? */
export const orderMatches = (item: CompareObjectsItem, placed: readonly string[]) =>
  placed.length === item.answerNames.length && placed.every((name, i) => name === item.answerNames[i]);

/**
 * What a wrong arrangement shows (`TeachingAttempt.miss`, handoff 20): `not_all_placed` (some objects not
 * touched), `reversed` (the whole order from the other end), `two_swapped` (only two out of place),
 * `other_order`. Undefined for a right arrangement and for the spoken kinds.
 */
export type CompareOrderMiss = 'not_all_placed' | 'reversed' | 'two_swapped' | 'other_order';

export function compareOrderMiss(item: CompareObjectsItem | null, placed: readonly string[]): CompareOrderMiss | undefined {
  if (!item || item.kind !== 'order_three' || orderMatches(item, placed)) return undefined;
  const want = item.answerNames;
  if (placed.length < want.length) return 'not_all_placed';
  if (want.every((name, i) => placed[i] === want[want.length - 1 - i])) return 'reversed';
  return want.filter((name, i) => placed[i] !== name).length === 2 ? 'two_swapped' : 'other_order';
}

/** The committed arrangement in the learner's terms, as the tutor and the observer read it. */
export const describeOrder = (item: CompareObjectsItem, placed: readonly string[]) =>
  placed.length ? `Touched ${placed.length} of ${item.objectNames.length} in this order: ${placed.join(', ')}` : 'Touched none of the objects';

export function workspaceScene(item: CompareObjectsItem, view: { placedOrder: readonly string[] }): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: item.kind, attribute: item.attribute,
      pictured: `${item.objectNames.join(', ')} (left to right)`,
      ...(item.kind === 'non_standard' ? { unit: item.unitName } : {}),
      ...(item.kind === 'order_three' ? { touchedOrder: view.placedOrder.length ? view.placedOrder.join(', ') : 'none yet' } : {}),
      constraints: item.kind === 'order_three'
        ? 'The learner touches the objects in order. The board checks the arrangement once the learner stops.'
        : item.kind === 'non_standard'
          ? 'The learner counts the unit boxes and says the number. The boxes are unnumbered until the answer is credited.'
          : 'The learner says the answer. The picture is the only measuring tool; nothing on screen can be tapped.',
    },
  };
}
