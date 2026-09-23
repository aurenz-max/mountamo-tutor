import type { CountingBoardData } from '../../../primitives/visual-primitives/math/CountingBoard';
import { askFor, itemsFromChallenges as countingItemsFromChallenges, objectWordFor }
  from '../../../primitives/visual-primitives/math/countingBoardDomain';
import { type WorkspaceDomain } from './adapterContract';


/**
 * The board's spoken noun, resolved exactly as the component resolves it: a
 * themed board carries its own plural, an enum board falls back to the map, and
 * `custom` without a triple lands on "objects" (R12). Both sides of the wire
 * must agree on this word, so it is derived here rather than restated.
 */
const countingObjectWord = (board: CountingBoardData) => board.objects?.word || objectWordFor(board.objects?.type ?? 'custom');

/** Reject a board whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateCountingBoardData(value: unknown): CountingBoardData {
  const d = value as CountingBoardData;
  if (!d || typeof d.title !== 'string' || !d.objects || typeof d.objects.type !== 'string'
      || !['K', '1'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.type !== 'string'
        || !Number.isInteger(c.count) || !Number.isInteger(c.targetAnswer)))
    throw new Error('Generated counting board has invalid lesson content.');
  const items = countingItemsFromChallenges(d.challenges, { objectWord: countingObjectWord(d), objectSingular: d.objects.wordSingular });
  if (items.length !== d.challenges.length) throw new Error('A counting-board challenge cannot run in the live lesson.');
  return d;
}

function countingBoardState(board: CountingBoardData) {
  const items = countingItemsFromChallenges(board.challenges, { objectWord: countingObjectWord(board), objectSingular: board.objects.wordSingular });
  return { title: board.title, instruction: askFor(items[0]), teachingOwner: 'tutor', totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. Judge spoken answers naturally; the host records your completed feedback and handles retry/advance. The board checks gestures.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const countingBoardLiveDomain: WorkspaceDomain<CountingBoardData> = { validate: validateCountingBoardData, initialState: countingBoardState };

