/**
 * Ordinal line on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The items
 * still come from `itemsFromChallenges` in `ordinalLineScript.ts`. Four modes are
 * spoken against `answerText`; `build_sequence` is arranged by hand and checked by
 * code (`placementMatches`), so the tutor is not handed the answer line as a key.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, frontOf, placementMatches, type OrdinalLineItem } from './ordinalLineScript';

export function workspaceAssignment(item: OrdinalLineItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: item.answerText };
}

/** Does the committed line put every picture in its clued place? Empty places are ''. */
export const lineMatches = placementMatches;

/** The committed line in the learner's terms, place 1 first, as the tutor and the observer read it. */
export const describeLine = (item: OrdinalLineItem, placed: readonly string[]) => {
  const filled = placed.filter(Boolean).length;
  if (!filled) return 'Placed none of the pictures';
  const places = Array.from({ length: item.answerOrder.length }, (_, i) => placed[i] || 'empty');
  return `Placed ${filled} of ${item.answerOrder.length}, from the first place: ${places.join(', ')}`;
};

export function workspaceScene(item: OrdinalLineItem, view: { placedOrder: readonly string[]; markedPlace?: number }): WorkspaceScene {
  const front = frontOf(item.context);
  const line = `${item.lineNames.join(', ')} (from ${front})`;
  const facts = ((): Record<string, string | number> => {
    switch (item.kind) {
      case 'match':
        return { printedCard: item.symbol,
          constraints: 'The learner reads the printed card aloud. Only the symbol is printed, never the word.' };
      case 'sequence_story':
        return { pictured: `${item.clues.map(c => c.name).join(', ')} (shuffled, not in story order)`,
          constraints: 'The story is never printed: the learner hears it only from you, then says the place.' };
      case 'build_sequence':
        return { places: item.answerOrder.length, line: describeLine(item, view.placedOrder),
          constraints: 'The clues are never printed: the learner hears them only from you. The learner touches a picture, '
            + 'then its place. The line checks the arrangement once the learner stops, whether or not every place is filled.' };
      default:
        return { pictured: line, ...(view.markedPlace ? { markedPlace: view.markedPlace } : {}),
          constraints: 'The learner says the answer. Nothing on the line can be tapped, and its place labels stay hidden '
            + 'until the answer is credited.' };
    }
  })();
  return { objects: [], facts: { kind: item.kind, front, ...facts } };
}
