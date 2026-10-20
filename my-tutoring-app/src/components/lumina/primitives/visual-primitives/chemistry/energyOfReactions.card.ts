/**
 * energy-of-reactions' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `energyOfReactions.boss.ts`.
 * Every item is one closed choice keyed by code (releases or absorbs energy from a thermometer; a value read off an
 * energy diagram; ΔH from a bond table): the learner says it (the tutor judges the words against the key) or taps it
 * and presses Check Answer (the activity judges the tap), so every mode is SAY_OR_SHOW. A classify item's reaction is
 * run on screen first.
 */
import type { EnergyMiss, EnergyMode } from './energyOfReactionsWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong choice shows (`energyMiss`), by mode; the same ids name each spoken item's known misses. */
export const ENERGY_MISSES: Record<EnergyMode, readonly EnergyMiss[]> = {
  classify: ['cooling_called_release', 'warming_called_absorb'],
  diagram: ['direction_reversed', 'sign_flipped', 'read_level', 'read_activation', 'read_peak_height', 'read_delta_h',
    'from_products', 'catalysed_ea', 'full_ea'],
  bond_energy: ['subtracted_backwards', 'ignored_counts', 'added_totals'],
};

const TAP = 'may instead tap a choice and press Check Answer';

export const energyOfReactionsCard = defineCard<EnergyMiss>({
  id: 'energy-of-reactions',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    classify: { ...SAY_OR_SHOW, moves: `presses Run the reaction to see the thermometer change, and ${TAP}`,
      misses: ENERGY_MISSES.classify },
    diagram: { ...SAY_OR_SHOW, moves: TAP, misses: ENERGY_MISSES.diagram },
    bond_energy: { ...SAY_OR_SHOW, moves: TAP, misses: ENERGY_MISSES.bond_energy },
  },
  words: {
    job: 'work out whether a reaction releases or absorbs energy, and how much, one question at a time: from a '
      + 'thermometer in the water around it, from an energy diagram on a kJ grid, or from a table of the bonds broken and formed',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
