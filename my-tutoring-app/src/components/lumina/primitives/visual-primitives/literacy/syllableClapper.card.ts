/**
 * syllable-clapper's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `syllableClapper.boss.ts`.
 * blend_syllables, count_parts and delete_compound are one spoken answer: the tutor says the word (in parts, joined,
 * or with a part taken away) and the learner says the whole word, how many parts, or the word left; nothing is printed
 * before credit. build_parts is the shared letter build (`LetterBuildSurface.tsx`, the `syllables` ask in
 * `syllableBuild.ts`): the learner taps word-part cards into a word with the number of parts the ask names, code
 * counts the parts and the shared word judge checks the word is real.
 */
import type { LetterBuildMiss } from './letterBuild';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken answer shows, per act (`syllableSpokenMisses` names the blend and count ones). */
export const SYLLABLE_MISSES = {
  blend_syllables: ['parts_back'],
  count_parts: ['count_one_over', 'counted_sounds', 'word_for_count'],
  delete_compound: ['whole_word', 'removed_part'],
} as const;
export type SyllableMiss = typeof SYLLABLE_MISSES[keyof typeof SYLLABLE_MISSES][number];

/** The build's own checks (`syllableShapeMiss`), then the word judge. */
export const SYLLABLE_BUILD_MISSES = ['too_few_parts', 'too_many_parts', 'counted_letters', 'same_word', 'pick_another',
  'not_a_word'] as const satisfies readonly LetterBuildMiss[];
export type SyllableBuildMiss = typeof SYLLABLE_BUILD_MISSES[number];

export type SyllableClapperMiss = SyllableMiss | SyllableBuildMiss;

const MOVES = 'claps the parts with their own hands (nothing on screen counts them) and may tap the speaker to hear '
  + 'the question again';

export const syllableClapperCard = defineCard<SyllableClapperMiss>({
  id: 'syllable-clapper',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    blend_syllables: { ...SPOKEN, moves: MOVES, misses: SYLLABLE_MISSES.blend_syllables },
    count_parts: { ...SPOKEN, moves: MOVES, misses: SYLLABLE_MISSES.count_parts },
    delete_compound: { ...SPOKEN, moves: MOVES, misses: SYLLABLE_MISSES.delete_compound },
    // `same_word` and `pick_another` have no lever: the word already made stays on screen, and another word is the
    // whole fix.
    build_parts: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps word-part cards into a row, one clap each, taps a placed card to take it back, and presses '
        + '"I\'m done!"; some items ask for a second, different word',
      misses: SYLLABLE_BUILD_MISSES, unanswered: ['same_word', 'pick_another'] },
  },
  words: {
    job: 'hear a word said in parts, joined, or with one part taken away, and say the whole word, how many parts it '
      + 'has, or the word left; or make a word with the number of parts the ask names from word-part cards',
    answer: 'the word or number they give',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
