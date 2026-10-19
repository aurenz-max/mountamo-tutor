/**
 * Worked procedure's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diWorkedProcedure.boss.ts`.
 * Every step of a subtraction is one spoken move or number the tutor judges against the key.
 */
import type { SpokenProcedureMiss } from './diWorkedProcedureWorkspace';
import { defineCard, SPOKEN, SPOKEN_AUDIO, OFF_BY } from '../../../components/live-activity/boss';


export const diWorkedProcedureCard = defineCard<SpokenProcedureMiss>({
  id: 'di-worked-procedure',
  grades: ['Grade 2', 'Grade 3', 'Grade 4'],
  // Every step's known wrong answers (`workedProcedureSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    // No lend ever happens in this mode, so `read_crossed_out` cannot be named.
    subtract_no_regroup: { ...SPOKEN, misses: ['regrouped_needlessly', ...OFF_BY] },
    subtract_regroup: { ...SPOKEN, misses: ['upside_down_column', 'no_decrement', 'said_no_regroup', 'regrouped_needlessly', 'read_crossed_out', ...OFF_BY] },
  },
  words: {
    job: 'work the printed subtraction out loud one step at a time: the move in the ringed column, then after a regroup the difference',
    answer: 'the spoken step',
    question: 'the ask',
    // What a regroup needs and the upside-down column are each step's key; the model lever is the shared doctrine's.
    special: 'One subtraction is printed in columns, the current column ringed. The page writes a step only once '
      + 'credited; the answer is never printed. After a lend the crossed-out digit is no longer the top. Never say a '
      + 'column\'s numbers before the learner tries. On a decide step never ask whether the top is enough ("can you '
      + 'take eight from three?"): that IS the decision.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
