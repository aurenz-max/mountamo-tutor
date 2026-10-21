/**
 * practice-problem's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `practiceProblem.boss.ts`.
 * Every mode is one problem the learner solves by writing the worked solution by hand on the whiteboard; Done sends
 * the lines to the primitive's own checker (a transcription and a judge against the generated worked solution). The
 * modes differ only by step count. One written solution the activity checks: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a not-correct verdict shows (`practiceMiss`, `TeachingAttempt.miss`, handoff 20), read from the judge's
 * verdict and the learner's own lines, never a guessed cause:
 * - `nothing_read`: the checker read no line of the writing;
 * - `unfinished`: the work reaches no final answer;
 * - `answer_without_work`: the final answer matches, but the steps were not credited (skipped or not shown);
 * - `step_error`: the checker flagged a line of the learner's work as an error;
 * - `wrong_answer`: a different final answer, with no line flagged.
 */
export type PracticeMiss = 'nothing_read' | 'unfinished' | 'answer_without_work' | 'step_error' | 'wrong_answer';
export const PRACTICE_MISSES: readonly PracticeMiss[] = ['nothing_read', 'unfinished', 'answer_without_work', 'step_error', 'wrong_answer'];
/** The checker could not read the writing: no scaffold changes that. */
export const PRACTICE_UNANSWERED: readonly PracticeMiss[] = ['nothing_read'];

const WRITE = { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: PRACTICE_MISSES,
  unanswered: PRACTICE_UNANSWERED,
  moves: 'writes the solution by hand on the whiteboard, one step per line, then presses Done' } as const;

export const practiceProblemCard = defineCard<PracticeMiss>({
  id: 'practice-problem',
  grades: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`practiceProblemLevers.ts`): the tier's three scaffolds and, after a check that
  // flagged a line, `mark_lines`.
  modes: { derive_easy: WRITE, derive_medium: WRITE, derive_hard: WRITE },
  words: {
    job: 'solve a multi-step math problem by writing out the worked solution, each step on its own line, down to a '
      + 'final answer',
    answer: 'the written solution and its final answer',
    question: 'the problem statement, its given equations, and any step titles, start-here box or strategy line on screen',
  },
  levers: true,
});
