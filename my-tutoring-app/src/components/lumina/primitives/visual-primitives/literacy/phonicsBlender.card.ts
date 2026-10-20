/**
 * phonics-blender's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `phonicsBlender.boss.ts`.
 * cvc, cvce_blend, digraph and advanced are one spoken answer: the learner reads a word's letters and says the whole
 * word, and the tutor judges it against the key. build_blend is the shared letter build (`LetterBuildSurface.tsx`):
 * the learner joins a start tile and an ending tile, code checks the order and the blend, and the shared word judge
 * checks the word is real; the tutor is never told a word that passes.
 */
import type { LetterBuildMiss } from './letterBuild';
import type { WordReadingMiss } from './spokenReadingMisses';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken blend shows (`blendSpokenMisses`). */
export type SpokenBlendMiss = Exclude<WordReadingMiss, 'similar_word'>;
export type BlendBuildMiss = Extract<LetterBuildMiss, 'wrong_order' | 'no_blend' | 'same_word' | 'pick_another' | 'not_a_word'>;
export type PhonicsBlenderMiss = SpokenBlendMiss | BlendBuildMiss;

/** The spoken blend's known wrong answers, and the build's own checks (`letterShapeMiss`, then the word judge). */
export const BLEND_MISSES = {
  spoken: ['letter_name', 'sounds_no_word', 'read_backwards', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'],
  build_blend: ['wrong_order', 'no_blend', 'same_word', 'pick_another', 'not_a_word'],
} as const satisfies { spoken: readonly SpokenBlendMiss[]; build_blend: readonly BlendBuildMiss[] };

/** The four spoken modes, one per pattern family. */
export const SPOKEN_BLEND_MODES = ['cvc', 'cvce_blend', 'digraph', 'advanced'] as const;
export type SpokenBlendMode = typeof SPOKEN_BLEND_MODES[number];

const spoken = { ...SPOKEN, moves: 'may tap a letter to hear its sound first', misses: BLEND_MISSES.spoken };

export const phonicsBlenderCard = defineCard<PhonicsBlenderMiss>({
  id: 'phonics-blender',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    cvc: spoken,
    cvce_blend: spoken,
    digraph: spoken,
    advanced: spoken,
    // The board says what it is (LetterBuildSurface's scene: how to place and press I'm done). `same_word` and
    // `pick_another` have no lever: the word already made stays on screen, and another word is the whole fix.
    build_blend: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: BLEND_MISSES.build_blend,
      unanswered: ['same_word', 'pick_another'] },
  },
  words: {
    job: 'read the letters of a word and say the whole word, blending their sounds, or join a start tile and an ending '
      + 'tile into a real word with a blend at the start or the end',
    answer: 'the word',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
