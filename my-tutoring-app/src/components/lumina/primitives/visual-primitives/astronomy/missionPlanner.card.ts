/**
 * mission-planner's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `missionPlanner.boss.ts`.
 * Every item is one closed choice keyed by code (a place, a launch month, a number of food packs, a route): the learner
 * says it (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges the
 * tap), so every mode is SAY_OR_SHOW. Grades 2-5 only: the K-1 story is ungraded and never mounts the workspace.
 */
import type { MissionMiss, MissionMode } from './missionWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`optionMiss`), by mode; the same ids name each spoken item's known misses. */
export const MISSION_MISSES: Record<MissionMode, readonly MissionMiss[]> = {
  farther_closer: ['other_end', 'next_in_line', 'in_between'],
  pick_window: ['far_apart', 'close_together', 'in_between_window'],
  pack_days: ['forgot_home', 'stay_twice', 'forgot_stay', 'forgot_crew', 'added_crew'],
  assist_tradeoff: ['too_slow', 'picked_direct', 'fewer_flybys'],
};

export const missionPlannerCard = defineCard<MissionMiss>({
  id: 'mission-planner',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    farther_closer: { ...SAY_OR_SHOW, moves: 'may instead tap a place and press Check Answer',
      misses: MISSION_MISSES.farther_closer },
    pick_window: { ...SAY_OR_SHOW, moves: 'may instead tap a launch month and press Check Answer',
      misses: MISSION_MISSES.pick_window },
    pack_days: { ...SAY_OR_SHOW, moves: 'may instead tap a number of packs and press Check Answer',
      misses: MISSION_MISSES.pack_days },
    assist_tradeoff: { ...SAY_OR_SHOW, moves: 'may instead tap a route and press Check Answer',
      misses: MISSION_MISSES.assist_tradeoff },
  },
  words: {
    job: 'plan a space mission: which place is farthest or closest from Earth, which launch month needs the least or the '
      + 'most fuel from where the planets are, how many food packs a trip to the Moon needs, or which route to a giant '
      + 'planet uses the least fuel and still arrives in time',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
