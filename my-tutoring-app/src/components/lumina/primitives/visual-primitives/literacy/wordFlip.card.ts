/**
 * word-flip's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `wordFlip.boss.ts`.
 * The six spoken modes are one spoken answer: the frame shows one thing and how many there are now (or an action
 * today), and the learner says the changed word; the tutor judges it against the key. build_inflect is the shared
 * word-part build (`WordBuildAffix.tsx` with `inflectBuild.ts`): the learner taps a word card and an ending card into
 * a row, code checks the ending, and the shared word judge checks the word is real; the tutor is never told a word
 * that passes.
 */
import type { InflectBuildMiss } from './inflectBuild';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken change shows (`flipSpokenMisses`; `wrong_ending` is the tutor's to name, never stated). */
export type FlipMiss = 'unchanged' | 'wrong_ending' | 'double_ending' | 'regularized';
export type WordFlipMiss = FlipMiss | InflectBuildMiss;

const REGULAR_MISSES = ['unchanged', 'wrong_ending', 'double_ending'] as const satisfies readonly FlipMiss[];
const IRREGULAR_MISSES = ['regularized', 'unchanged'] as const satisfies readonly FlipMiss[];

/** The spoken modes, by the kind of change. */
export const REGULAR_FLIP_MODES = ['plural_s', 'plural_es', 'plural_y', 'past_ed'] as const;
export const IRREGULAR_FLIP_MODES = ['irregulars', 'past_irregular'] as const;
export type SpokenFlipMode = typeof REGULAR_FLIP_MODES[number] | typeof IRREGULAR_FLIP_MODES[number];

/** Each spoken mode's misses. */
export const FLIP_MISSES: Record<SpokenFlipMode, readonly FlipMiss[]> = {
  plural_s: REGULAR_MISSES, plural_es: REGULAR_MISSES, plural_y: REGULAR_MISSES, past_ed: REGULAR_MISSES,
  irregulars: IRREGULAR_MISSES, past_irregular: IRREGULAR_MISSES,
};

/** The build's own checks (`inflectMiss`), then the word judge (`not_a_word`, `wrong_meaning`). */
export const INFLECT_BUILD_MISSES = ['base_only', 'ending_only', 'parts_out_of_order', 'double_ending', 'wrong_ending_kind',
  'other_base', 'wrong_ending', 'missed_y_change', 'same_word', 'not_a_word', 'wrong_meaning'] as const satisfies readonly InflectBuildMiss[];

const spoken = (misses: readonly FlipMiss[]) => ({ ...SPOKEN, moves: 'may tap the word card to hear its word first', misses });

export const wordFlipCard = defineCard<WordFlipMiss>({
  id: 'word-flip',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    plural_s: spoken(FLIP_MISSES.plural_s),
    plural_es: spoken(FLIP_MISSES.plural_es),
    plural_y: spoken(FLIP_MISSES.plural_y),
    irregulars: spoken(FLIP_MISSES.irregulars),
    past_ed: spoken(FLIP_MISSES.past_ed),
    past_irregular: spoken(FLIP_MISSES.past_irregular),
    // The board says what it is (`inflectBuildScene`: how to place cards and press I'm done). `same_word` has no
    // lever: the word already made stays on screen above the row.
    build_inflect: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: INFLECT_BUILD_MISSES,
      unanswered: ['same_word'] },
  },
  words: {
    job: 'say the changed form of a word for more than one thing or for an action that already happened, or tap a '
      + 'word card and an ending card into a row to make such a word',
    answer: 'the changed word',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
