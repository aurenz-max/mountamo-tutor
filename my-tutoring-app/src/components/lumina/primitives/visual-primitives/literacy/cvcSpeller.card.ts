/**
 * cvc-speller's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `cvcSpeller.boss.ts`.
 * fill_vowel and word_sort are one spoken answer: the learner hears a short word and says the sound in its middle, and
 * the tutor judges it against the key. spell_word is a board the activity checks: a letter from the bank into each of
 * three boxes, the third letter is the answer. make_word is the shared letter build (`LetterBuildSurface.tsx`): code
 * checks what the ask states and the shared word judge checks the word is real; the tutor is never told a word that
 * passes.
 */
import type { LetterBuildMiss } from './letterBuild';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken middle sound shows (`cvcSpokenMisses`), most specific first. */
export const SPOKEN_CVC_MISSES = ['whole_word', 'letter_name', 'first_sound', 'last_sound', 'other_vowel'] as const;
export type SpokenCvcMiss = typeof SPOKEN_CVC_MISSES[number];

/** What a checked wrong spelling shows (`cvcMiss`), box by box. */
export const CVC_MISSES = ['first_letter', 'middle_letter', 'last_letter', 'letters_out_of_order', 'two_or_more_letters'] as const;
export type CvcMiss = typeof CVC_MISSES[number];

/** The open build's own checks (`letterShapeMiss` on a vowel or rhyme ask), then the word judge. */
export const MAKE_WORD_MISSES = ['not_cvc', 'wrong_vowel', 'same_as_given', 'wrong_family', 'same_word', 'pick_another', 'not_a_word'] as const satisfies readonly LetterBuildMiss[];
export type MakeWordMiss = typeof MAKE_WORD_MISSES[number];

export type CvcSpellerMiss = SpokenCvcMiss | CvcMiss | MakeWordMiss;

// `other_vowel` has no lever by decision: any cue that separates short vowels names the item's vowel, or teaches on
// a practice word a vowel that answers a session item (`cvcSpellerLevers.ts`).
const spoken = { ...SPOKEN, moves: 'may tap Hear It to hear the word again', misses: SPOKEN_CVC_MISSES,
  unanswered: ['other_vowel'] as const };

export const cvcSpellerCard = defineCard<CvcSpellerMiss>({
  id: 'cvc-speller',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    fill_vowel: spoken,
    spell_word: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps a letter from the bank into each of three boxes, and may tap a filled box to empty it; the third '
        + 'letter placed is the answer', misses: CVC_MISSES },
    // The board says what it is (LetterBuildSurface's scene: how to place and press I'm done). `same_word` and
    // `pick_another` have no lever: the word already made stays on screen, and another word is the whole fix.
    make_word: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: MAKE_WORD_MISSES,
      unanswered: ['same_word', 'pick_another'] },
    word_sort: spoken,
  },
  words: {
    job: 'hear a short word and say the sound in its middle, or spell it with a letter in each of three boxes, or '
      + 'make any real word in three boxes that fits the ask',
    answer: 'the middle sound, the spelling or the word made',
    question: 'the word and the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
