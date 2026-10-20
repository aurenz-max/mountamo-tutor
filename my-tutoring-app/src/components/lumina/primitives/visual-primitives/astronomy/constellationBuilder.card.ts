/**
 * constellation-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `constellationBuilder.boss.ts`.
 * Guided trace and free connect draw a constellation by tapping stars, and the activity checks every tap as it lands
 * (a wrong star is a checked miss at once; the finished picture is the right answer), so they are builds checked one
 * tap at a time, not a board checked together. Identify and seasonal ask for one constellation name: the learner says
 * it (the tutor judges the words against the key) or taps it (the activity checks the tap), so they are SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20):
 * - guided_trace: `later_star` (a star further along the order than the ringed one), `traced_star` (one already
 *   joined), `other_star` (a star not in the order);
 * - free_connect: `background_star` (a star that is not in the pattern), `wrong_pair` (two pattern stars the
 *   pattern does not join);
 * - identify: `wrong_name` (another name on screen);
 * - seasonal: `other_name` (one name, not the answer), `several_names` (more than one name chosen).
 */
export type ConstellationMiss = 'later_star' | 'traced_star' | 'other_star' | 'background_star' | 'wrong_pair'
  | 'wrong_name' | 'other_name' | 'several_names';

/** The activity's own checks (`guidedMiss`, `freeMiss`, `nameMiss`), by mode; identify and seasonal also list them spoken. */
export const CONSTELLATION_MISSES = {
  guided_trace: ['later_star', 'traced_star', 'other_star'],
  free_connect: ['background_star', 'wrong_pair'],
  identify: ['wrong_name'],
  seasonal: ['other_name', 'several_names'],
} as const satisfies Record<string, readonly ConstellationMiss[]>;

/** A star picture the learner draws; the activity checks each tap. */
const DRAW = { answer: 'build', judge: 'activity', flow: 'one-at-a-time' } as const;

export const constellationBuilderCard = defineCard<ConstellationMiss>({
  id: 'constellation-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    guided_trace: { ...DRAW, moves: 'taps the star with the pulsing ring, then each next ringed star, until the picture is drawn',
      misses: CONSTELLATION_MISSES.guided_trace },
    free_connect: { ...DRAW, moves: 'taps one star, then the star it joins to, for each line of the picture',
      misses: CONSTELLATION_MISSES.free_connect },
    identify: { ...SAY_OR_SHOW, moves: 'may instead tap a name', misses: CONSTELLATION_MISSES.identify },
    seasonal: { ...SAY_OR_SHOW, moves: 'may instead tap a name, then press Check Answer', misses: CONSTELLATION_MISSES.seasonal },
  },
  words: {
    job: 'draw a constellation by joining its stars, or name a constellation from its lines or its season',
    answer: 'their answer',
    question: 'the ask and the names on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
