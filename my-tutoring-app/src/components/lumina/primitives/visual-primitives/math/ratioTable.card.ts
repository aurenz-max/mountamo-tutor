/**
 * ratio-table's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `ratioTable.boss.ts`.
 * Three modes ask for a typed number (a missing value, a multiplier, a unit rate) and build_ratio for the multiplier set
 * on a slider; the learner presses Check and the activity checks it within the item's band. Typed and slider modes
 * side by side, activity-judged: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`ratioMiss`, `TeachingAttempt.miss`, handoff 20), from the number typed or the slider, drawn
 * from the old catalog's commonStruggles (scaling one value only, adding instead of multiplying, no unit rate,
 * multiplier and unit rate confused):
 * - missing value: `added_difference` the known row's change added, not multiplied; `unscaled` the hidden row's base
 *   value copied; `copied_known` the other row's scaled value copied; `unit_rate` the per-1 rate typed;
 *   `multiplier` the multiplier typed;
 * - find multiplier: `difference` a row's scaled value minus its base (adding thinking); `scaled_value` a scaled value
 *   typed; `unit_rate` the per-1 rate typed; `inverse` base ÷ scaled, the multiplier upside down;
 * - unit rate: `inverse_rate` the first quantity ÷ the second; `difference` second minus first; `typed_quantity`
 *   one of the two quantities typed;
 * - build ratio: `one_step_off` the slider one whole step from the multiplier;
 * - every mode: `near_miss` within 10%, else `too_high` / `too_low`.
 */
export type RatioMiss = 'added_difference' | 'unscaled' | 'copied_known' | 'unit_rate' | 'multiplier'
  | 'difference' | 'scaled_value' | 'inverse' | 'inverse_rate' | 'typed_quantity' | 'one_step_off'
  | 'near_miss' | 'too_high' | 'too_low';

const SIZE: readonly RatioMiss[] = ['near_miss', 'too_high', 'too_low'];
export const RATIO_MISSES_BY_MODE: Record<string, readonly RatioMiss[]> = {
  build_ratio: ['one_step_off', ...SIZE],
  missing_value: ['added_difference', 'unscaled', 'copied_known', 'unit_rate', 'multiplier', ...SIZE],
  find_multiplier: ['difference', 'scaled_value', 'unit_rate', 'inverse', ...SIZE],
  unit_rate: ['inverse_rate', 'difference', 'typed_quantity', ...SIZE],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types a number in the answer box, then presses Check Answer' } as const;

export const ratioTableCard = defineCard<RatioMiss>({
  id: 'ratio-table',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`ratioTableLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    build_ratio: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'moves the Multiplier slider (or uses the arrow keys), then presses Check Answer',
      misses: RATIO_MISSES_BY_MODE.build_ratio },
    missing_value: { ...TYPED, misses: RATIO_MISSES_BY_MODE.missing_value },
    find_multiplier: { ...TYPED, misses: RATIO_MISSES_BY_MODE.find_multiplier },
    unit_rate: { ...TYPED, misses: RATIO_MISSES_BY_MODE.unit_rate },
  },
  words: {
    job: 'scale a ratio by multiplying both rows by the same number: find a hidden value in the scaled column, find the '
      + 'multiplier from the base column to the scaled one, find how many of the second quantity go with one of the first, '
      + 'or set the slider to the multiplier that builds an equivalent ratio',
    answer: 'the number they type or the multiplier they set',
    question: 'the question, the row labels and every number the table draws',
  },
  levers: true,
});
