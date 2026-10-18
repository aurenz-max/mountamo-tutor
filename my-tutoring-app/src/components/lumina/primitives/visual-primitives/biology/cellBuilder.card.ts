/**
 * The cell builder's card: how each mission mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `cellBuilder.boss.ts`. A bespoke
 * boss: every mode is a board the activity checks, so no preset fits.
 */
import type { CellBuilderMiss, CellMissionPhase } from './cellBuilderWorkspace';
import { defineCard } from '../../../components/live-activity/boss';

/** What a wrong board shows, per mission (`cellMiss`). */
export const CELL_MISSES: Record<CellMissionPhase, readonly CellBuilderMiss[]> = {
  cell_inventory: ['kept_impostor', 'rejected_needed', 'kept_and_rejected'],
  organelle_placement: ['cytoplasm_distributed_swap', 'core_network_swap', 'one_misplaced', 'several_misplaced'],
  structure_function: ['two_swapped', 'several_wrong'],
  cell_specialization: ['too_little', 'too_much', 'both_ways'],
};

const board = { judge: 'activity', flow: 'board' } as const;

export const cellBuilderCard = defineCard<CellBuilderMiss>({
  id: 'cell-builder',
  grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`cellBuilderLevers.ts`); every miss is answered by a help lever and fewer_structures.
  modes: {
    cell_inventory: { ...board, answer: 'tap', misses: CELL_MISSES.cell_inventory,
      moves: 'taps Keep or Reject on every structure' },
    organelle_placement: { ...board, answer: 'build', misses: CELL_MISSES.organelle_placement,
      moves: 'taps a structure in the bay, then a region' },
    structure_function: { ...board, answer: 'tap', misses: CELL_MISSES.structure_function,
      moves: 'taps a structure, then the job card it does' },
    cell_specialization: { ...board, answer: 'manipulate', misses: CELL_MISSES.cell_specialization,
      moves: 'picks Few, Some, Many or Abundant for every structure' },
  },
  words: {
    job: 'answer every card of one mission board over the lesson’s cell, then press Check mission',
    answer: 'whether a structure belongs in this cell, which region or job card goes with it, or how much of it this cell needs',
    question: 'the mission, the cell and its job, the structure names, the region names, the job cards and what each level means',
    // The board rules (no pointing at one card, no swap, no count before the check) are FLOW.board's, for every board.
  },
  levers: true,
});
