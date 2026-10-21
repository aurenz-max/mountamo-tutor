/**
 * percent-bar's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `percentBar.boss.ts`.
 * A challenge is one or more steps, each answered on the screen and checked by the activity: the bar set to a percent,
 * an amount typed (find_part, find_whole), or one option tapped (convert's last step). A right step opens the next step
 * of the same challenge; only the last step finishes it. The tutor never sees a step's percent, amount or right option.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong step shows (`percentMiss`, `TeachingAttempt.miss`, handoff 20), from where the bar was set, the amount
 * typed or the option tapped, drawn from the old catalog's commonStruggles (part and whole confused, the discount
 * placed instead of what is left, the added rate placed instead of the total, the bigger discount taken as the cheaper
 * price):
 * - `complement` (identify, and the place step of find_part / find_whole): the rest of the whole, 100 minus the percent;
 * - `placed_discount` (a discount step): the discount itself, not what is still paid;
 * - `rate_not_total` (a total step): only the added rate; `whole_only`: 100%, the rate not added;
 *   `took_off_rate`: the rate taken off 100 instead of added;
 * - `placed_value`: the bar set to the part's value (dollars, points) read as a percent;
 * - `near_miss`: within 5 points of the step's percent, outside the tolerance; `too_high` / `too_low`: any other;
 * - `bigger_discount` (compare): the option with the bigger % off, which is not the asked one; `other_price`: the
 *   other option when the bigger discount was the right one;
 * - a typed amount (`AmountMiss`): see below.
 */
export type PercentBarMiss = 'complement' | 'placed_discount' | 'rate_not_total' | 'whole_only' | 'took_off_rate'
  | 'placed_value' | 'near_miss' | 'too_high' | 'too_low' | 'bigger_discount' | 'other_price'
  | AmountMiss;

/**
 * A wrong typed amount (find_part, find_whole), from `percentMissValues` in the percent-of item space:
 * - find_part: `rest_not_part` the rest of the whole; `percent_as_amount` the percent typed as dollars; `tenth_only`
 *   a tenth of the whole when the percent is not 10;
 * - find_whole: `percent_of_part` the percent taken of the part; `part_times_ten` the part times ten when the percent is
 *   not 10; `rest_not_whole` the rest of the whole only; `part_as_whole` the part typed back; `percent_as_amount`;
 * - then `near_miss` (within a tenth of the amount), `too_high`, `too_low`.
 */
export type AmountMiss = 'rest_not_part' | 'percent_as_amount' | 'tenth_only' | 'percent_of_part' | 'part_times_ten'
  | 'rest_not_whole' | 'part_as_whole';

const PLACEMENT: readonly PercentBarMiss[] = ['placed_value', 'near_miss', 'too_high', 'too_low'];
export const PERCENT_MISSES_BY_MODE: Record<string, readonly PercentBarMiss[]> = {
  identify_percent: ['complement', ...PLACEMENT],
  convert: ['placed_discount', ...PLACEMENT, 'bigger_discount', 'other_price'],
  // Renamed 10-16 (8.1f): these two ask the percent still paid and the percent with a fee added.
  percent_remaining: ['placed_discount', ...PLACEMENT],
  percent_total: ['rate_not_total', 'whole_only', 'took_off_rate', ...PLACEMENT],
  find_part: ['complement', ...PLACEMENT, 'rest_not_part', 'percent_as_amount', 'tenth_only'],
  find_whole: ['complement', ...PLACEMENT, 'percent_of_part', 'part_times_ten', 'rest_not_whole', 'part_as_whole', 'percent_as_amount'],
};

const SET_BAR = 'sets the bar by tapping or dragging it (or with the arrow keys), then presses Check Answer';
const BAR = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;
const THEN_TYPE = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: `${SET_BAR} to mark the percent; then types the amount in dollars and presses Check Answer` } as const;

export const percentBarCard = defineCard<PercentBarMiss>({
  id: 'percent-bar',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`percentBarLevers.ts`); every miss is answered by a lever on every item.
  modes: {
    identify_percent: { ...BAR, moves: SET_BAR, misses: PERCENT_MISSES_BY_MODE.identify_percent },
    find_part: { ...THEN_TYPE, misses: PERCENT_MISSES_BY_MODE.find_part },
    percent_remaining: { ...BAR, moves: SET_BAR, misses: PERCENT_MISSES_BY_MODE.percent_remaining },
    percent_total: { ...BAR, moves: `${SET_BAR}, once for the added rate and once for the total`,
      misses: PERCENT_MISSES_BY_MODE.percent_total },
    find_whole: { ...THEN_TYPE, misses: PERCENT_MISSES_BY_MODE.find_whole },
    convert: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
      moves: `${SET_BAR}, once for each sale price; then taps one option and presses Check Answer`,
      misses: PERCENT_MISSES_BY_MODE.convert },
  },
  words: {
    job: 'show a percent of a whole on the bar, where the whole bar is one hundred percent: the percent a scenario states, '
      + 'what is still paid after a discount, or a total with a tax or tip added past the whole; on find-part and '
      + 'find-whole, mark the percent and then type the part or the whole in dollars; on compare, place each sale price '
      + 'and then choose an option',
    answer: 'the percent a step needs, the amount it makes, the whole, or which option is right',
    question: 'the scenario and each step\'s question',
  },
  levers: true,
});
