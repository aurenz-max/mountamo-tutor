/**
 * vehicle-comparison-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `vehicleComparisonLab.boss.ts`.
 * Every item is one vehicle (and on evidence_choice the column that proves it), keyed by code from the table's numbers:
 * the learner says it (the tutor judges the words against the key) or taps it and presses Check (the activity judges
 * the tap), so every mode is SAY_OR_SHOW.
 */
import type { VehicleMiss, VehicleMode } from './vehicleComparisonWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** Each mode's misses (`comparisonMiss`), most specific first: an answer that fits two is named by the first. */
export const VEHICLE_MISSES: Record<VehicleMode, readonly VehicleMiss[]> = {
  metric_leader: ['leading_digit', 'other_column_leader', 'reversed', 'runner_up', 'not_leader'],
  evidence_choice: ['wrong_evidence', 'other_column_leader', 'misread_column', 'not_leader'],
  constraint_tradeoff: ['ignored_minimum', 'reversed', 'not_priority_leader'],
};

const TAP = 'may instead tap a vehicle and press Check';

export const vehicleComparisonLabCard = defineCard<VehicleMiss>({
  id: 'vehicle-comparison-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    metric_leader: { ...SAY_OR_SHOW, moves: TAP, misses: VEHICLE_MISSES.metric_leader },
    evidence_choice: { ...SAY_OR_SHOW, moves: 'may instead tap a vehicle and a column button and press Check',
      misses: VEHICLE_MISSES.evidence_choice },
    constraint_tradeoff: { ...SAY_OR_SHOW, moves: TAP, misses: VEHICLE_MISSES.constraint_tradeoff },
  },
  words: {
    job: 'read a table of vehicle numbers: find the vehicle that leads a named column, choose the vehicle for a job and '
      + 'the column whose numbers prove it, or rule out the vehicles that miss a job\'s minimums and choose among the rest',
    answer: 'their choice',
    question: 'the ask, the column headings and the vehicle names',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
