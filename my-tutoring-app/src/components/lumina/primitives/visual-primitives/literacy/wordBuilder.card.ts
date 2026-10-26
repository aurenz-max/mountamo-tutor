/**
 * word-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `wordBuilder.boss.ts`.
 * The four spoken tiers are one spoken answer: the tutor says what a word means, and the learner says the whole word,
 * built from the board of parts (each printed with its meaning); nothing on the board is tapped. build_affix is the
 * shared word-part build (`WordBuildAffix.tsx` with `affixBuild.ts`): the learner taps part cards into a row to make a
 * word for a meaning and presses "I'm done!"; code checks the row's shape and the shared word judge the word, and the
 * tutor is never told a word that passes.
 */
import type { SpokenWordBuilderMiss } from './wordBuilderWorkspace';
import type { AffixBuildMiss } from './affixBuild';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export type WordBuilderMiss = SpokenWordBuilderMiss | AffixBuildMiss;

/** The spoken tiers. A 2-part simple_affix word cannot show part_missing. */
export const SPOKEN_BUILDER_MODES = ['simple_affix', 'compound_affix', 'greek_latin', 'multi_morpheme'] as const;
export type SpokenBuilderMode = typeof SPOKEN_BUILDER_MODES[number];

const SIMPLE_MISSES = ['root_only', 'other_part_only', 'parts_not_joined', 'parts_out_of_order', 'swapped_part',
  'meaning_word'] as const satisfies readonly SpokenWordBuilderMiss[];
const LONG_MISSES = ['root_only', 'other_part_only', 'part_missing', 'parts_not_joined', 'parts_out_of_order',
  'swapped_part', 'meaning_word'] as const satisfies readonly SpokenWordBuilderMiss[];

/** Each spoken tier's misses (`wordBuilderSpokenMisses`). */
export const BUILDER_MISSES: Record<SpokenBuilderMode, readonly SpokenWordBuilderMiss[]> = {
  simple_affix: SIMPLE_MISSES, compound_affix: LONG_MISSES, greek_latin: LONG_MISSES, multi_morpheme: LONG_MISSES,
};

/** The open build: the row's shape (code), then the shared word judge (`not_a_word`, `wrong_meaning`). */
export const AFFIX_MISSES = ['root_only', 'affix_only', 'parts_out_of_order', 'same_word', 'not_a_word',
  'wrong_meaning'] as const satisfies readonly AffixBuildMiss[];

const spoken = (misses: readonly SpokenWordBuilderMiss[]) => ({ ...SPOKEN, misses });

export const wordBuilderCard = defineCard<WordBuilderMiss>({
  id: 'word-builder',
  // Grade 1-2 opens for build_affix (user ruling R11, 10-07: no heavy grade floors); the spoken tiers keep their own
  // floors in the generator (contract R6).
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    simple_affix: spoken(BUILDER_MISSES.simple_affix),
    compound_affix: spoken(BUILDER_MISSES.compound_affix),
    greek_latin: spoken(BUILDER_MISSES.greek_latin),
    multi_morpheme: spoken(BUILDER_MISSES.multi_morpheme),
    // The board says what it is (`affixBuildScene`). `same_word` has no lever: the word already made stays on screen.
    build_affix: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps part cards into a row to make a word for the meaning, then presses "I\'m done!"; many words can fit',
      misses: AFFIX_MISSES, unanswered: ['same_word'] },
  },
  words: {
    job: 'say the whole word that a meaning describes, built from the board of word parts, or tap part cards into a row '
      + 'to make such a word',
    answer: 'the whole word',
    question: 'the meaning (the clue) and the board of parts with their meanings',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
