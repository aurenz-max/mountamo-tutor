/**
 * sound-swap's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `soundSwap.boss.ts`.
 * addition, deletion and substitution are one spoken answer: the learner hears a starting word and one named sound to
 * add, take away or change, and says the new word; the tutor judges it against the key. swap_build is the shared
 * letter build (`LetterBuildSurface.tsx`): the learner changes one letter of the word in the boxes, code checks one
 * letter changed and the shape, and the shared word judge checks the word is real; the tutor is never told a word that
 * passes.
 */
import type { LetterBuildMiss } from './letterBuild';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken change shows (`swapSpokenMisses`), most specific first. */
export const SWAP_MISSES = ['echo_start', 'other_position', 'nonword', 'sounds_no_word'] as const;
export type SwapMiss = typeof SWAP_MISSES[number];
export type SwapBuildMiss = Extract<LetterBuildMiss, 'not_cvc' | 'same_as_given' | 'changed_more' | 'same_word' | 'pick_another' | 'not_a_word'>;
export type SoundSwapMiss = SwapMiss | SwapBuildMiss;

/** The build's own checks (`letterShapeMiss` on a swap ask), then the word judge. */
export const SWAP_BUILD_MISSES = ['not_cvc', 'same_as_given', 'changed_more', 'same_word', 'pick_another', 'not_a_word'] as const satisfies readonly SwapBuildMiss[];

/** The three spoken modes, one per operation. */
export const SWAP_OPERATIONS = ['addition', 'deletion', 'substitution'] as const;
export type SwapOperation = typeof SWAP_OPERATIONS[number];

const spoken = { ...SPOKEN, moves: 'may tap a sound of the starting word to hear it first', misses: SWAP_MISSES };

export const soundSwapCard = defineCard<SoundSwapMiss>({
  id: 'sound-swap',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    addition: spoken,
    deletion: spoken,
    substitution: spoken,
    // The board says what it is (LetterBuildSurface's scene: how to place and press I'm done). `same_word` and
    // `pick_another` have no lever: the word already made stays on screen, and another word is the whole fix.
    swap_build: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: SWAP_BUILD_MISSES,
      unanswered: ['same_word', 'pick_another'] },
  },
  words: {
    job: 'hear a word and one named sound to add, take away or change, and say the new word, or change one letter of a '
      + 'word in the boxes to make a new real word',
    answer: 'the new word',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
