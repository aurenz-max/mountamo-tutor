/**
 * measurement-tools' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `measurementTools.boss.ts`.
 * Every item is answered on the screen and checked by the activity: a shape put on the ruler and its length typed,
 * then on convert that length changed to the other unit, and on compare a last item that orders the measured shapes.
 * The tutor never sees a width, a converted length or the order.
 */
import type { MeasurementToolsChallengeType } from './MeasurementTools';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`measurementMiss`, `TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - reading the ruler (every mode's shapes): `one_over` / `one_short` (a whole unit off: the marks counted instead of
 *   the spaces, or a start at 1), `whole_not_half` (estimate only: a whole number half a unit off, the edge read to
 *   the nearest whole mark; no direction, so the miss and the answer do not give the length away), `too_long` /
 *   `too_short` (further off);
 * - converting: `same_number` (the measured number kept, not converted), `wrong_operation` (the other way: divided
 *   for multiply or multiplied for divide), `too_small` / `too_large` (the right way, wrong size);
 * - ordering (compare's last item): `longest_first` (the whole order reversed), `two_swapped` (two side by side
 *   swapped), `out_of_order`.
 */
export type MeasurementMiss = 'one_over' | 'one_short' | 'whole_not_half' | 'too_long' | 'too_short'
  | 'same_number' | 'wrong_operation' | 'too_small' | 'too_large'
  | 'longest_first' | 'two_swapped' | 'out_of_order';

const READING: readonly MeasurementMiss[] = ['one_over', 'one_short', 'too_long', 'too_short'];
export const MEASUREMENT_MISSES_BY_MODE: Record<MeasurementToolsChallengeType, readonly MeasurementMiss[]> = {
  measure: READING,
  compare: [...READING, 'longest_first', 'two_swapped', 'out_of_order'],
  estimate: ['whole_not_half', ...READING],
  convert: [...READING, 'same_number', 'wrong_operation', 'too_small', 'too_large'],
};

const PLACE_AND_READ = 'presses Put it on the ruler (or drags the shape onto it), then types the length or sets it with '
  + '− and +, and presses Check Answer';
const RULER = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;

export const measurementToolsCard = defineCard<MeasurementMiss>({
  id: 'measurement-tools',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`measurementToolsLevers.ts`); every miss is answered by a drawn lever.
  modes: {
    measure: { ...RULER, moves: PLACE_AND_READ, misses: MEASUREMENT_MISSES_BY_MODE.measure },
    compare: { ...RULER,
      moves: `${PLACE_AND_READ} for each shape; on the last item taps the shapes from shortest to longest and presses `
        + 'Check Order (Reset Order clears the taps)',
      misses: MEASUREMENT_MISSES_BY_MODE.compare },
    estimate: { ...RULER, moves: PLACE_AND_READ, misses: MEASUREMENT_MISSES_BY_MODE.estimate },
    convert: { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
      moves: `${PLACE_AND_READ}; once that is right, types the length in the new unit (or sets it with − and +) and `
        + 'presses Check Conversion',
      misses: MEASUREMENT_MISSES_BY_MODE.convert },
  },
  words: {
    job: 'measure each shape with the ruler, reading where its right edge lands; on convert, change that length to '
      + 'another unit; on compare, then put the measured shapes in order from shortest to longest',
    answer: 'the length, the converted length or the order',
    question: 'the instruction, the shape names and the units',
  },
  levers: true,
});
