/**
 * orbit-mechanics-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `orbitMechanicsLab.boss.ts`.
 * Every item is one closed choice keyed by code from the orbital physics: the learner says it (the tutor judges the
 * words against the key) or taps it and presses the check (the activity judges the tap), so every mode is SAY_OR_SHOW.
 */
import type { OrbitMiss, OrbitMode } from './orbitWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`orbitMiss`), by mode; the same ids name each spoken item's known misses. */
export const ORBIT_MISSES: Record<OrbitMode, readonly OrbitMiss[]> = {
  pick_speed: ['picked_slower', 'picked_faster'],
  orbit_speed: ['picked_biggest', 'picked_farther', 'picked_closer'],
  predict_burn: ['wrong_way', 'said_no_change', 'too_strong', 'too_weak'],
  circularize: ['other_circle', 'wrong_way', 'wrong_place'],
};

const TAP_CHOICE = 'may instead tap a choice and press Check Answer';

export const orbitMechanicsLabCard = defineCard<OrbitMiss>({
  id: 'orbit-mechanics-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    pick_speed: { ...SAY_OR_SHOW, moves: 'may instead tap a push and press Launch and check',
      misses: ORBIT_MISSES.pick_speed },
    orbit_speed: { ...SAY_OR_SHOW, moves: 'may instead tap a rocket and press Check Answer',
      misses: ORBIT_MISSES.orbit_speed },
    predict_burn: { ...SAY_OR_SHOW, moves: TAP_CHOICE, misses: ORBIT_MISSES.predict_burn },
    circularize: { ...SAY_OR_SHOW, moves: TAP_CHOICE, misses: ORBIT_MISSES.circularize },
  },
  words: {
    job: 'predict what gravity does with a rocket above Earth: which sideways push makes it fall back, circle, swing out '
      + 'or fly away, which rocket on its round track is fastest or slowest or goes around soonest, what a push forward or '
      + 'backward does to a circling rocket\'s path, or where and which way to fire once to make a stretched loop a circle',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
