/**
 * mixing-and-dissolving's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `mixingAndDissolving.boss.ts`.
 * Every item is one closed choice keyed by code (`correctOptionIndex`): the learner may test substances in the beaker
 * first, then says the choice (the tutor judges the words against the key) or taps it and presses Submit Answer (the
 * activity judges the tap), so every mode is SAY_OR_SHOW.
 */
import type { DissolvingMiss, DissolvingMode } from './mixingAndDissolvingWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`dissolvingMiss`), by mode; the same ids name each spoken item's known misses.
 *  Dissolve also carries the particle question. */
export const DISSOLVING_MISSES: Record<DissolvingMode, readonly DissolvingMiss[]> = {
  dissolve: ['chose_dissolves', 'chose_does_not_dissolve', 'chose_disappeared', 'chose_sank', 'other_choice'],
  classify: ['called_solution', 'called_suspension', 'called_layers'],
  separate: ['filter_for_dissolved', 'evaporate_for_undissolved', 'other_method', 'other_choice'],
};

const MOVES = 'may add substances to the beaker, stir and open the particle view to test them, and may instead tap a '
  + 'choice and press Submit Answer';

export const mixingAndDissolvingCard = defineCard<DissolvingMiss>({
  id: 'mixing-and-dissolving',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
  modes: {
    dissolve: { ...SAY_OR_SHOW, moves: MOVES, misses: DISSOLVING_MISSES.dissolve },
    classify: { ...SAY_OR_SHOW, moves: MOVES, misses: DISSOLVING_MISSES.classify },
    separate: { ...SAY_OR_SHOW, moves: MOVES, misses: DISSOLVING_MISSES.separate },
  },
  words: {
    job: 'test substances in a beaker of liquid and answer one question at a time: whether a substance dissolves, '
      + 'what kind of mixture it makes, or how to get it back out',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
