/**
 * hundreds-chart's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `hundredsChart.boss.ts`.
 * Highlighting and completing a pattern are boards: the learner taps a set of numbers and presses Check, and the
 * chart checks the whole set. Identifying the shape and finding the skip value ask for one sayable answer: the learner
 * says it (the tutor judges the words against the key) or taps the choice and presses Check (the chart checks the
 * tap), so they are SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the chart's check reads
 * (`hundredsChartMiss`), and for spoken answers `hundredsChartSpokenMisses`, with the same ids:
 * - cells: `stopped_early` (only pattern numbers, the last ones left untapped), `gaps_left` (only pattern numbers,
 *   some in the middle left), `extra_cells` (the whole pattern and more), `other_step` (a run that counts by another
 *   amount), `stray_cells` (numbers outside the pattern in place of some in it);
 * - a skip value: `twice_the_step`, `half_the_step`, then `one_short` / `one_over` / `short_by_more` / `over_by_more`;
 * - a description (identify_pattern), by what the chosen sentence describes: `chose_diagonal` (a diagonal, zigzag or
 *   shifting shape), `chose_columns`, `chose_rows`, else `chose_scattered` (no shape: scattered, checkerboard, whole grid).
 */
export type HundredsChartMiss = 'stopped_early' | 'gaps_left' | 'extra_cells' | 'other_step' | 'stray_cells'
  | 'twice_the_step' | 'half_the_step' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more'
  | 'chose_diagonal' | 'chose_columns' | 'chose_rows' | 'chose_scattered';

const CELL_MISSES = ['stopped_early', 'gaps_left', 'extra_cells', 'other_step', 'stray_cells'] as const;

/** Each mode's misses, by the chart's check and the spoken-miss observer alike. */
export const HUNDREDS_MISSES = {
  highlight_sequence: CELL_MISSES,
  complete_sequence: CELL_MISSES,
  identify_pattern: ['chose_rows', 'chose_columns', 'chose_diagonal', 'chose_scattered'],
  find_skip_value: ['twice_the_step', 'half_the_step', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
} as const satisfies Record<string, readonly HundredsChartMiss[]>;

export type HundredsMode = keyof typeof HUNDREDS_MISSES;

const BOARD = { answer: 'tap', judge: 'activity', flow: 'board' } as const;

export const hundredsChartCard = defineCard<HundredsChartMiss>({
  id: 'hundreds-chart',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  modes: {
    highlight_sequence: { ...BOARD, moves: 'taps (or drags across) every number in the pattern, then presses Check',
      misses: HUNDREDS_MISSES.highlight_sequence },
    complete_sequence: { ...BOARD, moves: 'taps the rest of the pattern after the highlighted numbers, then presses Check',
      misses: HUNDREDS_MISSES.complete_sequence },
    identify_pattern: { ...SAY_OR_SHOW, moves: 'may instead tap a description, then press Check',
      misses: HUNDREDS_MISSES.identify_pattern },
    find_skip_value: { ...SAY_OR_SHOW, moves: 'may instead tap a number, then press Check',
      misses: HUNDREDS_MISSES.find_skip_value },
  },
  words: {
    job: 'find skip-counting patterns on a hundreds chart: tap the numbers in a count, or say or tap the shape the '
      + 'highlighted numbers make or how much is added each step',
    answer: 'their answer',
    question: 'the instruction, the highlighted numbers and the printed choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
