/**
 * rhyme-studio's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `rhymeStudio.boss.ts`.
 * recognition, identification, production and collection are one spoken answer each (yes or no, the rhyming choice,
 * any real rhyme, a new rhyme for the family), judged by the tutor against the key. pair_build is the shared pair board
 * (`RhymePairSurface.tsx`): the learner taps two pictures into the tray and presses "I'm done!", and code checks that
 * their names rhyme; the tutor is never told a pair that passes.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken answer shows, per mode (`rhymeSpokenMisses` names recognition's and identification's). */
export const RHYME_MISSES = {
  recognition: ['yes_same_start', 'yes_no_rhyme', 'no_to_rhyme'],
  identification: ['onset_foil', 'echo_target', 'off_menu'],
  production: ['echo_target', 'same_start', 'meaning_neighbour', 'nonword'],
  collection: ['echo_target', 'same_start', 'meaning_neighbour', 'nonword', 'already_collected'],
} as const;
export type RhymeMiss = typeof RHYME_MISSES[keyof typeof RHYME_MISSES][number];

/** The pair board's own check (`pairMiss` in `rhymePairBuild.ts`). */
export const RHYME_PAIR_MISSES = ['no_rhyme', 'same_start', 'same_pair'] as const;
export type RhymePairMiss = typeof RHYME_PAIR_MISSES[number];

export type RhymeStudioMiss = RhymeMiss | RhymePairMiss;

const moves = 'may tap the word card to hear the question again';

export const rhymeStudioCard = defineCard<RhymeStudioMiss>({
  id: 'rhyme-studio',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    recognition: { ...SPOKEN, moves, misses: RHYME_MISSES.recognition },
    identification: { ...SPOKEN, moves, misses: RHYME_MISSES.identification },
    production: { ...SPOKEN, moves, misses: RHYME_MISSES.production },
    collection: { ...SPOKEN, moves, misses: RHYME_MISSES.collection },
    // The board says what it is (`pairScene`: how to fill the tray and press I'm done). `same_pair` has no lever: the
    // pair already found stays on screen, and another pair is the whole fix.
    pair_build: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: RHYME_PAIR_MISSES,
      unanswered: ['same_pair'] },
  },
  words: {
    job: 'hear words and say whether two rhyme, which choice rhymes, or a new word that rhymes, or put two pictures '
      + 'whose names rhyme together',
    answer: 'the rhyme',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
