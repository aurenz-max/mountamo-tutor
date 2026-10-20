/**
 * gas-laws-simulator's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `gasLawsSimulator.boss.ts`.
 * Every item is one closed choice keyed by code from PV/(nT) held constant (a direction, or a new value): the learner
 * says it (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges the
 * tap), so every mode is SAY_OR_SHOW.
 */
import type { GasLawsMiss, GasMode } from './gasLawsWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`gasMiss`), by mode; the same ids name each spoken item's known misses. */
export const GAS_MISSES: Record<GasMode, readonly GasLawsMiss[]> = {
  observe: ['opposite_direction', 'said_unchanged', 'missed_unchanged'],
  predict: ['inverse_factor', 'kept_value', 'celsius_ratio'],
  calculate: ['first_change_only', 'second_change_only', 'ratio_inverted', 'celsius_ratio'],
};

const MOVES = 'may instead tap a choice and press Check Answer';

export const gasLawsSimulatorCard = defineCard<GasLawsMiss>({
  id: 'gas-laws-simulator',
  grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  modes: {
    observe: { ...SAY_OR_SHOW, moves: MOVES, misses: GAS_MISSES.observe },
    predict: { ...SAY_OR_SHOW, moves: MOVES, misses: GAS_MISSES.predict },
    calculate: { ...SAY_OR_SHOW, moves: MOVES, misses: GAS_MISSES.calculate },
  },
  words: {
    job: 'predict what a container of gas does when it is heated, squeezed or given more gas, one question at a time: '
      + 'which way a quantity moves, or its new value after one change or two changes at once',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
