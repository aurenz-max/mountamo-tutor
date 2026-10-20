/**
 * light-shadow-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `lightShadowLab.boss.ts`.
 * Every item is one tapped choice and Check Answer, judged by the activity against the shadow computed in code from the
 * item's sun, so every mode is TAP_ONE with the Check Answer press named in its moves.
 */
import type { ShadowMiss } from './lightShadowWorkspace';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong shadow choice shows (`shadowMiss`): observe, predict and measure. */
export const SHADOW_MISSES: readonly ShadowMiss[] = ['toward_sun', 'side_when_overhead', 'below_when_side', 'length_flipped', 'length_off', 'both_wrong'];
/** What a wrong time shows (`shadowMiss`): apply. */
export const APPLY_MISSES: readonly ShadowMiss[] = ['mirror_time', 'wrong_height', 'other_time'];

export const lightShadowLabCard = defineCard<ShadowMiss>({
  id: 'light-shadow-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    observe: { ...TAP_ONE, moves: 'may drag the sun along its path to look, then taps one choice and presses Check Answer',
      misses: SHADOW_MISSES },
    predict: { ...TAP_ONE, moves: 'taps the shadow they predict, then presses Check Answer', misses: SHADOW_MISSES },
    measure: { ...TAP_ONE, moves: 'taps the shadow that matches the picture, then presses Check Answer', misses: SHADOW_MISSES },
    apply: { ...TAP_ONE, moves: 'taps the time of day the shadow shows, then presses Check Answer', misses: APPLY_MISSES },
  },
  words: {
    job: 'work out a shadow from where the sun is (which way it points and how long it is), or the time of day from a shadow',
    answer: 'the chosen shadow or time',
    question: 'the instruction and the choices',
  },
  levers: true,
});
