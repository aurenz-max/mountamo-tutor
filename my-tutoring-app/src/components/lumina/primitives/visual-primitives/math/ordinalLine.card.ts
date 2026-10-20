/**
 * ordinal-line's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `ordinalLine.boss.ts`.
 * Four modes are one spoken answer the tutor judges against the key (a name or a place word). build_sequence is
 * answered on the page: the learner puts pictures in their places, and the line checks the arrangement itself.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong line shows (`lineMiss`): not every place filled, the whole line reversed, two swapped, another order. */
export type LineMiss = 'place_left_empty' | 'reversed' | 'two_swapped' | 'other_order';
/** What a wrong spoken place or name shows (`ordinalSpokenMisses`). */
export type SpokenOrdinalMiss = 'cardinal_for_ordinal' | 'wrong_end' | 'next_to_place' | 'said_anchor' | 'wrong_side';
export type OrdinalLineMiss = LineMiss | SpokenOrdinalMiss;

/** The line's own check of a build, and the four spoken modes' known wrong answers, by mode. */
export const ORDINAL_MISSES = {
  identify: ['cardinal_for_ordinal', 'wrong_end', 'next_to_place'],
  match: ['cardinal_for_ordinal', 'next_to_place'],
  relative_position: ['said_anchor', 'wrong_side'],
  sequence_story: ['cardinal_for_ordinal', 'next_to_place'],
  build_sequence: ['place_left_empty', 'reversed', 'two_swapped', 'other_order'],
} as const satisfies Record<string, readonly OrdinalLineMiss[]>;

export const ordinalLineCard = defineCard<OrdinalLineMiss>({
  id: 'ordinal-line',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    identify: { ...SPOKEN, misses: ORDINAL_MISSES.identify },
    match: { ...SPOKEN, misses: ORDINAL_MISSES.match },
    relative_position: { ...SPOKEN, misses: ORDINAL_MISSES.relative_position },
    sequence_story: { ...SPOKEN, misses: ORDINAL_MISSES.sequence_story },
    build_sequence: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'touches a picture, then the place it goes; the line checks the arrangement once the learner stops touching, '
        + 'whether or not every place is filled',
      misses: ORDINAL_MISSES.build_sequence },
  },
  words: {
    job: 'say who is in a place in a line, the place someone has, or who is right before or after a place; read a place '
      + 'symbol aloud; say the place someone has in a story heard; or put pictures in their places from spoken clues',
    answer: 'the answer',
    question: 'the ask, the story and the clues',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
