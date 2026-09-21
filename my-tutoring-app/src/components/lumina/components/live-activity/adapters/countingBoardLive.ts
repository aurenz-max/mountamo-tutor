import type { CountingBoardData } from '../../../primitives/visual-primitives/math/CountingBoard';
import { askFor, itemsFromChallenges as countingItemsFromChallenges, objectWordFor }
  from '../../../primitives/visual-primitives/math/countingBoardDomain';
import { workspaceGuidance, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** The CATALOG mode names, not the challenge types: `count_all` ships as `count` and `group_count` as `group` (CNB-3). */
export const COUNTING_BOARD_MODES = ['count', 'subitize', 'subitize_perceptual', 'count_on', 'group', 'compare',
  'give_me_n', 'recount_moved', 'take_away', 'add_more'] as const;

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

export const countingBoardLive: LiveActivityAdapter<CountingBoardData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  modes: COUNTING_BOARD_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Counting Board', checkbox: 'Counting board', title: 'Learn with the Counting Board',
    lessons: [['count', 'Count all'], ['count_on', 'Count on'], ['take_away', 'Take away'], ['add_more', 'Add more'],
      ['give_me_n', 'Give me this many'], ['recount_moved', 'Same after they move'], ['compare', 'Which group has more'],
      ['group', 'Count by groups'], ['subitize', 'Quick look'], ['subitize_perceptual', 'Match the hand']],
  },
  lessonStart: workspaceLessonStart('counting-board', 'counting-board'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the board's own facts.
  guidance: workspaceGuidance('Use demonstrate to show a selection on the actual board without changing learner work. '
    + 'Handovers and hand choices are checked directly by the board. '
    + 'Respect the current task constraints, including hidden quick-look objects and pre-numeric hand matching.'),
  validate: validateCountingBoardData,
  initialState: countingBoardState,
};
