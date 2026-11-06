/**
 * wave-tank's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `waveTank.boss.ts`.
 * knock_it_down is an experiment in a 3D wave tank the activity checks: one item at a time, no key reaches the tutor.
 * The guess before each wave is said to the tutor and never graded.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `knockMiss` in `waveModel.ts`: `no_change` (the same
 * settings as the first wave), `changed_both` (size and speed both changed: not a fair test), `weaker` (one setting
 * turned down), `too_small` (one setting turned up, not far enough).
 */
export const WAVE_MISSES_BY_MODE = {
  knock_it_down: ['no_change', 'changed_both', 'weaker', 'too_small'],
} as const;
export type WaveMiss = typeof WAVE_MISSES_BY_MODE[keyof typeof WAVE_MISSES_BY_MODE][number];

export const waveTankCard = defineCard<WaveMiss>({
  id: 'wave-tank',
  grades: ['Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    knock_it_down: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: WAVE_MISSES_BY_MODE.knock_it_down,
      moves: 'taps a push-size or push-speed knob on the paddle\'s box, says aloud whether the wave will knock the tower '
        + 'down (never judged), taps the paddle to send three pushes, sends as many waves as it likes, and presses '
        + '"I\'m done!" with the paddle set the way it chooses' },
  },
  levers: true,
  words: {
    job: 'change one thing about a wave paddle so its waves knock down a block tower at the beach: a bigger push makes '
      + 'taller waves, a faster push makes crests closer together, and both carry more energy',
    answer: 'the paddle\'s push size and push speed',
    question: 'the paddle\'s settings, the first wave\'s settings, and what each wave did',
  },
});
