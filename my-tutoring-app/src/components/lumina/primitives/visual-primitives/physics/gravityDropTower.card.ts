/**
 * gravity-drop-tower's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `gravityDropTower.boss.ts`.
 * Observe, predict, measure and calculate each ask for one choice keyed by code from the physics model: the learner says
 * it (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges the tap), so
 * they are SAY_OR_SHOW. Observe first needs a drop: there is nothing to answer from before it. Compare puts three drops
 * in landing order, a board the activity checks.
 */
import type { DropMode, GravityDropMiss } from './gravityDropWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`dropMiss`), by mode, most telling first; the same ids name each spoken item's known misses. */
export const DROP_MISSES: Record<DropMode, readonly GravityDropMiss[]> = {
  observe: ['heavier_first', 'lighter_first', 'said_together', 'slowed_first', 'said_steady', 'said_slowed'],
  predict: ['heavier_first', 'lighter_first', 'shape_first', 'ignored_air', 'slowed_first', 'heavier_reason', 'air_when_none'],
  compare: ['ranked_by_mass', 'ignored_air', 'reversed', 'other_order'],
  measure: ['linear_scaling', 'kept_value', 'added_step'],
  calculate: ['forgot_half', 'no_root', 'not_squared', 'gave_time'],
};

const TAP = 'may instead tap a choice and press Check Answer';

export const gravityDropTowerCard = defineCard<GravityDropMiss>({
  id: 'gravity-drop-tower',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    observe: { ...SAY_OR_SHOW, moves: `presses Drop (and Slow motion if they like) before there is anything to answer from, and ${TAP}`,
      misses: DROP_MISSES.observe },
    predict: { ...SAY_OR_SHOW, moves: TAP, misses: DROP_MISSES.predict },
    compare: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'taps the three objects in the order they will land (Start over clears them), then presses Check Answer',
      misses: DROP_MISSES.compare },
    measure: { ...SAY_OR_SHOW, moves: `may replay a measured drop, and ${TAP}`, misses: DROP_MISSES.measure },
    calculate: { ...SAY_OR_SHOW, moves: TAP, misses: DROP_MISSES.calculate },
  },
  words: {
    job: 'reason about objects dropped from a tower, with or without air: which lands first and why, the order three '
      + 'drops land in, or a fall time, height or speed',
    answer: 'their answer',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
