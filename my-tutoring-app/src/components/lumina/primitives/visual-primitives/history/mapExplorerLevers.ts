/**
 * The in-item levers on a map-explorer ask, as one lever set (`MAP_LEVERS`, `bossLevers.ts`). No real-learner
 * evidence yet: the misses are what `mapMiss` and `mapSpokenMisses` observe.
 *
 * Help:
 * - `compass_glow` (marks) the compass rose glows, so the learner reads it before choosing a way. It draws what the
 *   easy tier starts with (`compassGlow`), so it is not offered on an ask that already glows, nor on find_on_globe
 *   (no direction is asked there).
 *
 * The misses no lever answers are listed on the card (`unanswered`): any help that names a region, a place or where
 * a trip ends would name the answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { MapChallenge } from './map/mapModel';
import { MAP_MODE_MISSES } from './mapExplorer.card';

export const COMPASS_LEVER = 'compass_glow';

export const MAP_LEVERS = leverSet<MapChallenge, unknown>({
  modeOf: c => c.type,
  missesOf: mode => MAP_MODE_MISSES[mode as keyof typeof MAP_MODE_MISSES] ?? [],
  specs: [{
    id: COMPASS_LEVER, type: 'marks', modes: ['find_by_direction', 'name_direction', 'world_direction', 'build_route'],
    answers: ['screen_direction', 'opposite_way', 'turned_way', 'route_mirrored'],
    when: 'the learner goes by up, down, left or right on the screen, or picks the opposite way or a quarter turn off',
    does: 'the compass rose glows, so the learner reads it before choosing a way',
    content: c => (c.compassGlow ? null : true),
    fact: 'The compass rose is glowing: read N on it first.',
  }],
});
