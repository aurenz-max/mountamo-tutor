/**
 * map-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `mapExplorer.boss.ts`.
 * Finding a place, a continent or an ocean is one tap on the map that the activity checks. "Which way?" is one
 * sayable word: the learner says the direction (the tutor judges it against the key) or taps that compass arm (the
 * activity checks it), SAY_OR_SHOW. A trip is a plan of arrow presses checked together when the learner presses Land.
 */
import type { MapMiss } from './map/mapModel';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`mapMiss`, and on name_direction the spoken misses), by mode, same ids. */
export const MAP_MODE_MISSES = {
  find_on_globe: ['other_continent', 'water_not_land', 'land_not_water', 'other_ocean', 'sea_not_ocean'],
  find_by_direction: ['screen_direction', 'opposite_way', 'turned_way', 'reference_place', 'other_place'],
  name_direction: ['screen_direction', 'opposite_way', 'turned_way'],
  world_direction: ['reference_place', 'opposite_way', 'turned_way', 'other_continent', 'water_not_land',
    'land_not_water', 'other_ocean', 'sea_not_ocean'],
  build_route: ['route_mirrored', 'route_wrong_end'],
} as const satisfies Record<string, readonly MapMiss[]>;

/** Misses no lever answers, by decision: naming a region, a place or the end of a trip would name the answer. */
const GLOBE_UNANSWERED = ['other_continent', 'water_not_land', 'land_not_water', 'other_ocean', 'sea_not_ocean'] as const;

export const mapExplorerCard = defineCard<MapMiss>({
  id: 'map-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  modes: {
    find_on_globe: { ...TAP_ONE, moves: 'spins the globe and taps land or water', misses: MAP_MODE_MISSES.find_on_globe,
      unanswered: GLOBE_UNANSWERED },
    find_by_direction: { ...TAP_ONE, moves: 'taps a place pin on the map', misses: MAP_MODE_MISSES.find_by_direction,
      unanswered: ['reference_place', 'other_place'] },
    name_direction: { ...SAY_OR_SHOW, moves: 'may instead tap the compass arm that points that way', misses: MAP_MODE_MISSES.name_direction },
    world_direction: { ...TAP_ONE, moves: 'taps land or water on the world map', misses: MAP_MODE_MISSES.world_direction,
      unanswered: ['reference_place', ...GLOBE_UNANSWERED] },
    build_route: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'presses the arrow buttons, one hop of the helicopter each (Undo and Clear take hops off), then presses Land',
      misses: MAP_MODE_MISSES.build_route, unanswered: ['route_wrong_end'] },
  },
  words: {
    job: 'find places, continents and oceans on a real map, say which way one place is from another, and plan a trip with compass directions',
    answer: 'the place, region or direction that answers the ask',
    question: 'the ask, the named places and the compass rose',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
