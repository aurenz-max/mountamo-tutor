/**
 * fast-fact's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `fastFact.boss.ts`.
 * Every item is one closed choice. When every choice can be said, the learner says one (the tutor judges the words
 * against the key) or taps it (the activity checks the tap), so every mode is SAY_OR_SHOW; an item whose choices are
 * pictures or symbols, or whose question names its own answer, has no key and is only tapped. The drill is untimed.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the tapped choice or the spoken one, the same
 * ids in every mode (the drill is subject-agnostic):
 * - `wrong_operation`: the stem is a two-number expression and the answer is another operation's result;
 * - `one_less` / `one_more` / `other_number`: a number against a numeric key (a counting or fact slip);
 * - `other_choice`: any other wrong choice.
 */
export type FastFactMiss = 'wrong_operation' | 'one_less' | 'one_more' | 'other_number' | 'other_choice';
export const FAST_FACT_MISSES = ['wrong_operation', 'one_less', 'one_more', 'other_number', 'other_choice'] as const satisfies readonly FastFactMiss[];

const MOVES = 'may instead tap a choice; when the choices are pictures, only taps one';

export const fastFactCard = defineCard<FastFactMiss>({
  id: 'fast-fact',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
    'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  modes: {
    recognize: { ...SAY_OR_SHOW, moves: MOVES, misses: FAST_FACT_MISSES },
    recall: { ...SAY_OR_SHOW, moves: MOVES, misses: FAST_FACT_MISSES },
    apply: { ...SAY_OR_SHOW, moves: MOVES, misses: FAST_FACT_MISSES },
  },
  words: {
    job: 'answer fact questions one at a time by choosing one of the choices shown',
    answer: 'their choice',
    question: 'the printed question and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
