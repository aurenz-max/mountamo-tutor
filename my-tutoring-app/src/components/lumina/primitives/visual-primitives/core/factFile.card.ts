/**
 * fact-file's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `factFile.boss.ts`.
 * Every self-check is one closed choice. When every choice can be said, the learner says one (the tutor judges the
 * words against the key) or taps it (the activity checks the tap), so every mode is SAY_OR_SHOW; a check with a choice
 * that cannot be said has no key and is only tapped. The modes differ in where the file is: open beside the question
 * (explore), or read first and closed while the questions are asked (recall, apply).
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong choice shows (`TeachingAttempt.miss`), from the choice and the file alone, the same ids in every mode:
 * - `other_file_fact`: the choice is something the file states (a fact from elsewhere in the file, mixed up);
 * - `not_in_file`: the file does not state the choice.
 */
export type FactFileMiss = 'other_file_fact' | 'not_in_file';
export const FACT_FILE_MISSES = ['other_file_fact', 'not_in_file'] as const satisfies readonly FactFileMiss[];

const MOVES = 'may instead tap a choice; when a choice cannot be said, only taps one';

export const factFileCard = defineCard<FactFileMiss>({
  id: 'fact-file',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    explore: { ...SAY_OR_SHOW, moves: MOVES, misses: FACT_FILE_MISSES },
    recall: { ...SAY_OR_SHOW, moves: MOVES, misses: FACT_FILE_MISSES },
    apply: { ...SAY_OR_SHOW, moves: MOVES, misses: FACT_FILE_MISSES },
  },
  words: {
    job: 'answer questions about a fact file one at a time by choosing one of the choices shown',
    answer: 'their choice',
    question: 'the printed question and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
