import type { CountingBoardData } from '../../../primitives/visual-primitives/math/CountingBoard';
import { askFor, itemsFromChallenges as countingItemsFromChallenges, objectWordFor }
  from '../../../primitives/visual-primitives/math/countingBoardDomain';
import { type LiveActivityAdapter } from './adapterContract';

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
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Counting Board', checkbox: 'Counting board', title: 'Learn with the Counting Board',
    lessons: [['count', 'Count all'], ['count_on', 'Count on'], ['take_away', 'Take away'], ['add_more', 'Add more'],
      ['give_me_n', 'Give me this many'], ['recount_moved', 'Same after they move'], ['compare', 'Which group has more'],
      ['group', 'Count by groups'], ['subitize', 'Quick look'], ['subitize_perceptual', 'Match the hand']],
  },
  lessonStart: (grade, mode) => `[LESSON_START] Begin a counting-board lesson for ${grade}, mode ${mode}. `
    + 'Call request_activity with primitiveId counting-board and the requested mode. After mounting, teach from the current workspace.',
  guidance: 'You own the teaching conversation. Read the task and observe the workspace, respond to the learner, '
    + 'and choose useful actions. Begin help with begin_help; use demonstrate to show a selection on the actual board '
    + 'without changing learner work. Use one step at a time and wait for the learner to try. '
    + 'For spoken answers, judge what you hear against the visible assignment and communicate your verdict naturally. The transcript may be noisy or multilingual; it is supporting context. The host records your completed feedback, so do not wait for workspace.lastResponse or call a recording tool. '
    + 'Handovers and hand choices are checked directly by the board. A question or help request is not an answer. '
    + 'After a mistake, invite another attempt; after success, acknowledge it. The host observes your completed reply and handles retry/advance. Do not call progression tools or request a replacement activity. A readiness question waits for the learner. No correction cap or scripted wording. '
    + 'Respect the current task constraints, including hidden quick-look objects and pre-numeric hand matching.',
  validate: validateCountingBoardData,
  initialState: countingBoardState,
};
