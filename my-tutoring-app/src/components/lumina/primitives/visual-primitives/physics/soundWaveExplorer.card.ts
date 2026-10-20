/**
 * sound-wave-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `soundWaveExplorer.boss.ts`.
 * Every item is one closed choice keyed by code from a sound maker, its drawn waves and one change: the learner says it
 * (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges the tap), so
 * every mode is SAY_OR_SHOW.
 */
import type { SoundMode, SoundWaveMiss } from './soundWaveWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`soundMiss`), by mode, most telling first; the same ids name each spoken item's known misses. */
export const SOUND_MISSES: Record<SoundMode, readonly SoundWaveMiss[]> = {
  observe: ['start_stop_swapped', 'said_no_change'],
  predict: ['mixed_up_features', 'opposite_direction', 'said_same'],
  classify: ['read_other_feature', 'opposite_end', 'missed_same', 'said_same'],
  apply: ['wrong_feature', 'opposite_change', 'loudness_misread', 'pitch_misread', 'both_misread'],
};

const TAP = 'may instead tap a choice and press Check Answer';

export const soundWaveExplorerCard = defineCard<SoundWaveMiss>({
  id: 'sound-wave-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  modes: {
    observe: { ...SAY_OR_SHOW, moves: TAP, misses: SOUND_MISSES.observe },
    predict: { ...SAY_OR_SHOW, moves: TAP, misses: SOUND_MISSES.predict },
    classify: { ...SAY_OR_SHOW, moves: TAP, misses: SOUND_MISSES.classify },
    apply: { ...SAY_OR_SHOW, moves: TAP, misses: SOUND_MISSES.apply },
  },
  words: {
    job: 'connect a sound to the shaking that makes it, predict how one change to a sound maker changes its loudness or '
      + 'pitch, and read drawn sound waves to compare sounds or to tell what was changed',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
