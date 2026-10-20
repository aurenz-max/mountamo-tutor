/**
 * planetary-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `planetaryExplorer.boss.ts`.
 * Every item is one question with a code-held key (a choice, or true or false): the learner says it (the tutor judges
 * the words against the key) or taps it and presses Check Answer (the activity judges the tap), so every mode is
 * SAY_OR_SHOW. A planet's card is on screen before its first question, until the learner presses Ready for Questions.
 */
import type { PlanetMiss, PlanetMode } from './planetaryExplorerWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong choice shows (`planetMiss`), by mode; the same ids name each spoken item's known misses. The quiz's
 * planet misses are identify's only; true-false statements are explore's only (the modes' schema enums).
 */
export const PLANET_MISSES: Record<PlanetMode, readonly PlanetMiss[]> = {
  explore: ['true_false_flipped', 'other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
  identify: ['neighbour_planet', 'same_family_planet', 'other_family_planet', 'other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
  compare: ['other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
  apply: ['other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
};

const MOVES = 'presses Ready for Questions when a planet\'s card is on screen, and may instead tap a choice and press Check Answer';

export const planetaryExplorerCard = defineCard<PlanetMiss>({
  id: 'planetary-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    explore: { ...SAY_OR_SHOW, moves: MOVES, misses: PLANET_MISSES.explore,
      // A true-false statement is already the smallest judgement and its truth is read off the cards (`planetaryExplorerLevers.ts`).
      unanswered: ['true_false_flipped'] },
    identify: { ...SAY_OR_SHOW, moves: MOVES, misses: PLANET_MISSES.identify },
    compare: { ...SAY_OR_SHOW, moves: MOVES, misses: PLANET_MISSES.compare },
    apply: { ...SAY_OR_SHOW, moves: MOVES, misses: PLANET_MISSES.apply },
  },
  words: {
    job: 'visit a few planets, reading each planet\'s card, then answer one question at a time about what the cards said, '
      + 'and in the quiz name a planet from a description',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
