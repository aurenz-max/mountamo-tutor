/**
 * propulsion-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `propulsionLab.boss.ts`.
 * predict and observe ask what a craft does (moves left, moves right or stays still), a closed choice keyed by code
 * from its engines and place: the learner says it (the tutor judges the words against the key) or taps it and presses
 * Check Answer (the activity judges the tap), so both are SAY_OR_SHOW. experiment sets Test A and Test B and runs them;
 * the activity checks whether the two tests can answer the question.
 */
import type { PropulsionMiss, PropulsionMode } from './propulsionWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`propulsionMiss`), by mode; the same ids name a spoken item's known misses. */
export const PROPULSION_MISSES: Record<PropulsionMode, readonly PropulsionMiss[]> = {
  predict: ['missed_cancel', 'said_moves', 'said_still', 'wrong_way'],
  observe: ['missed_cancel', 'said_moves', 'said_still', 'wrong_way'],
  experiment: ['same_tests', 'changed_more_than_one', 'changed_other', 'wrong_subject', 'cannot_show'],
};

export const propulsionLabCard = defineCard<PropulsionMiss>({
  id: 'propulsion-lab',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    predict: { ...SAY_OR_SHOW, moves: 'may instead tap a choice and press Check Answer', misses: PROPULSION_MISSES.predict },
    observe: { ...SAY_OR_SHOW, moves: 'may instead tap a choice and press Check Answer', misses: PROPULSION_MISSES.observe },
    experiment: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'sets Test A and Test B with their engine, place and throttle buttons, then presses Run and check',
      misses: PROPULSION_MISSES.experiment },
  },
  words: {
    job: 'work out how engines move a craft: predict what it does when they start, read what streams out of a clamped '
      + 'craft, or set up two tests that can answer a question',
    answer: 'their answer',
    question: 'the ask, the choices and the two tests',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
