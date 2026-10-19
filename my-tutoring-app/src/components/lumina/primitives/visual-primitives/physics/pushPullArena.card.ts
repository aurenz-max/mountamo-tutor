/**
 * push-pull-arena's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `pushPullArena.boss.ts`.
 * Every item is one spoken word computed from the sim's physics, judged by the tutor against the key, so the boss is
 * the spoken preset. observe and design have something to do in the arena before the answer (`moves`).
 */
import type { SpokenPushPullMiss } from './pushPullArenaDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

export const pushPullArenaCard = defineCard<SpokenPushPullMiss>({
  id: 'push-pull-arena',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Each item's known wrong answers (`pushPullSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    observe: { ...SPOKEN, moves: 'presses Go and watches the preset force before answering', misses: ['opposite_force', 'described_motion'] },
    predict: { ...SPOKEN, misses: ['opposite_outcome'] },
    compare: { ...SPOKEN, misses: ['other_object'] },
    design: { ...SPOKEN, moves: 'may set a direction and strength and press Go as often as they like before answering',
      misses: ['opposite_size'] },
  },
  words: {
    job: 'say whether the force they watched was a push or a pull, whether an object will move or stay under a coming '
      + 'push, which of two objects slides farther under the same push, or whether moving an object across needs a big '
      + 'or a little push',
    answer: 'the answer word',
    question: 'the arena and the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
