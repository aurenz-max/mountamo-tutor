/**
 * solar-system-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `solarSystem.boss.ts`.
 * Every item is one spoken planet name computed from the bodies on screen, judged by the tutor against the key, so the
 * boss is the spoken preset.
 */
import type { SpokenSolarMiss } from './solarSystemDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** The known wrong names of every mode but identify (`solarSpokenMisses`). */
const PLANET_MISSES: readonly SpokenSolarMiss[] = ['said_sun', 'signature_planet', 'other_planet'];

export const solarSystemCard = defineCard<SpokenSolarMiss>({
  id: 'solar-system-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Each item's known wrong answers (`solarSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    identify: { ...SPOKEN, misses: ['said_sun', 'neighbour_planet', 'other_planet'] },
    order_from_sun: { ...SPOKEN, misses: [...PLANET_MISSES] },
    classify: { ...SPOKEN, misses: [...PLANET_MISSES] },
    compare_attribute: { ...SPOKEN, misses: [...PLANET_MISSES] },
    orbital_reasoning: { ...SPOKEN, misses: [...PLANET_MISSES] },
  },
  words: {
    job: 'say the name of a planet in a live model of the Sun and planets: the one that glows, the one at a place out '
      + 'from the Sun, one of a named kind, the one that wins a comparison, or the one picked by its trip around the Sun',
    answer: 'the spoken planet name',
    question: 'the ask and the planet names it says',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
