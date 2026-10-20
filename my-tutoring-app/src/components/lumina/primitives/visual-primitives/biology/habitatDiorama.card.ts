/**
 * habitat-diorama's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `habitatDiorama.boss.ts`.
 * Observe, predict and defend are one choice on screen the learner says, judged by the tutor against the key.
 * Connect (tap the living thing a relationship leads to) and restore (tap the zone) are one tap the activity checks;
 * build_habitat is a whole habitat put together on an empty scene and checked at "I'm done!".
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`):
 * - connect (`habitatMiss`): `other_kind_link` (the start leads to it by another kind of relationship), `leads_to_start`
 *   (its relationship points at the start: the reverse direction), `unconnected` (no relationship either way);
 * - restore (`habitatMiss`): `water_for_land` (put in open water; its zone is on land or the shoreline),
 *   `land_for_water` (its zone is open water), `other_land_zone` (neither zone is water);
 * - build_habitat (`readHabitatBuild`): `harmful_piece`, `several_needs_unmet`, `other_animals_piece`, `one_need_unmet`;
 * - observe, predict, defend (`habitatSpokenMisses`): `other_choice`, another choice on screen.
 */
export type HabitatMiss = 'other_kind_link' | 'leads_to_start' | 'unconnected'
  | 'water_for_land' | 'land_for_water' | 'other_land_zone';
export type HabitatBuildMiss = 'harmful_piece' | 'several_needs_unmet' | 'other_animals_piece' | 'one_need_unmet';
export type HabitatDioramaMiss = HabitatMiss | HabitatBuildMiss | 'other_choice';

export const HABITAT_MISSES = {
  observe: ['other_choice'],
  connect: ['other_kind_link', 'leads_to_start', 'unconnected'],
  predict: ['other_choice'],
  restore: ['water_for_land', 'land_for_water', 'other_land_zone'],
  defend: ['other_choice'],
  build_habitat: ['harmful_piece', 'several_needs_unmet', 'other_animals_piece', 'one_need_unmet'],
} as const satisfies Record<string, readonly HabitatDioramaMiss[]>;

export const habitatDioramaCard = defineCard<HabitatDioramaMiss>({
  id: 'habitat-diorama',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    observe: { ...SPOKEN, misses: HABITAT_MISSES.observe },
    connect: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps the living thing the relationship from the lit start leads to', misses: HABITAT_MISSES.connect },
    predict: { ...SPOKEN, misses: HABITAT_MISSES.predict },
    restore: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps the zone button where the missing living thing can meet its needs', misses: HABITAT_MISSES.restore },
    defend: { ...SPOKEN, misses: HABITAT_MISSES.defend },
    build_habitat: { answer: 'build', judge: 'activity', flow: 'board',
      moves: 'taps pieces into the empty habitat (a tap on a placed piece takes it out), then presses the I\'m done! button',
      misses: HABITAT_MISSES.build_habitat },
  },
  words: {
    job: 'name a living thing from a clue, connect two by their relationship, say which population a change moves, '
      + 'put a missing one back in its zone, pick the evidence for a claim, or build a habitat an animal can live in',
    answer: 'their answer',
    question: 'the ask, the change and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
