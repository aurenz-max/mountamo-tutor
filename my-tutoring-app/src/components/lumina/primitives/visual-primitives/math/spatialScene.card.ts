/**
 * spatial-scene's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `spatialScene.boss.ts`.
 * identify and describe ask for one position word: the learner says it (the tutor judges the words against the key) or
 * taps it and presses Check (the scene checks the tap), so they are SAY_OR_SHOW. Placing a thing (a cell, the thing it
 * goes in, the gap between two things, each step of the directions) is a tap the scene checks. describe_scene is said
 * aloud and judged by the tutor on the relation and the thing it compares with (contract R16).
 */
import { defineCard, SAY_OR_SHOW, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20 Part A), from the scene's own geometry
 * (`spatialMiss`, and for spoken words and descriptions `spatialSpokenMisses`, with the same ids):
 *   - identify / describe: `opposite_word` (points the other way on the same line), `same_axis_word` (same line, wrong
 *     distance: on for a gap), `other_axis_word` (an up-down word for a side-to-side arrangement, or the reverse);
 *   - place: `opposite_cell`, `same_axis_cell`, `other_axis_cell`, `off_line_cell`, from the reference;
 *   - place_in: `other_object`, `next_to_container`, `away_from_container`;
 *   - place_between: `next_to_one`, `touches_neither`;
 *   - follow_directions: `later_step_cell` (the cell a later direction asks for), `other_cell`;
 *   - describe_scene: `opposite_word` (the relation that points the other way).
 */
export type SpatialMiss = 'opposite_word' | 'same_axis_word' | 'other_axis_word' | 'other_object' | 'next_to_container'
  | 'away_from_container' | 'next_to_one' | 'touches_neither' | 'later_step_cell' | 'other_cell'
  | 'opposite_cell' | 'same_axis_cell' | 'other_axis_cell' | 'off_line_cell';

const WORD_MISSES = ['opposite_word', 'same_axis_word', 'other_axis_word'] as const;

/** Each mode's misses, by the scene's check and the spoken-miss observer alike. */
export const SPATIAL_MISSES = {
  identify: WORD_MISSES,
  describe: WORD_MISSES,
  place: ['opposite_cell', 'same_axis_cell', 'other_axis_cell', 'off_line_cell'],
  place_in: ['other_object', 'next_to_container', 'away_from_container'],
  place_between: ['next_to_one', 'touches_neither'],
  follow_directions: ['later_step_cell', 'other_cell'],
  describe_scene: ['opposite_word'],
} as const satisfies Record<string, readonly SpatialMiss[]>;

export type SpatialMode = keyof typeof SPATIAL_MISSES;

const TAP_WORD = 'may instead tap a word button, then press Check';
const PLACE = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;

export const spatialSceneCard = defineCard<SpatialMiss>({
  id: 'spatial-scene',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    identify: { ...SAY_OR_SHOW, moves: TAP_WORD, misses: SPATIAL_MISSES.identify },
    place_in: { ...PLACE, moves: 'taps the thing it goes in, then presses Check', misses: SPATIAL_MISSES.place_in },
    place: { ...PLACE, moves: 'taps an empty square, then presses Check', misses: SPATIAL_MISSES.place },
    describe: { ...SAY_OR_SHOW, moves: TAP_WORD, misses: SPATIAL_MISSES.describe },
    place_between: { ...PLACE, moves: 'taps an empty square, then presses Check', misses: SPATIAL_MISSES.place_between },
    follow_directions: { ...PLACE, moves: 'taps an empty square for each step in turn, and each step is checked as it is placed',
      misses: SPATIAL_MISSES.follow_directions },
    describe_scene: { ...SPOKEN, misses: SPATIAL_MISSES.describe_scene },
  },
  words: {
    job: 'say or tap the position word for where a thing is, put a thing where the instruction says, or say aloud '
      + 'where a thing is from the YOU arrow',
    answer: 'their answer',
    question: 'the instruction and the names of the things on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
