/**
 * histogram's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `histogram.boss.ts`.
 * Every mode is answered on the screen and checked by the activity itself: a shape word tapped, a bar tapped, or a
 * number typed, then Check. One graph at a time. A bespoke boss: the modes mix taps and a typed number.
 */
import type { HistogramChallengeType } from './Histogram';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`histogramMiss`, `TeachingAttempt.miss`, handoff 20), drawn from the old catalog's
 * commonStruggles (bin edges misread, skew direction misread) and the mode's task:
 * - identify shape: `skew_reversed` the other skew chosen; `missed_skew` a skewed graph called symmetric, bimodal or
 *   uniform; `called_skewed` a skew chosen for a graph that is not skewed; `peak_count` one peak and two confused;
 *   `flat_vs_peaked` symmetric and uniform confused;
 * - find modal bin: `neighbor_bar` a bar next to the tallest; `runner_up` the second-tallest height elsewhere;
 *   `shorter_bar` any other bar;
 * - read frequency: `bin_edge` an edge of the asked bin typed; `neighbor_bar` the count of a bar next to it;
 *   `total_count` the number of values in the whole graph; `off_by_one` one away; else `too_high` / `too_low`;
 * - estimate center: `off_axis` a number off the x-axis (a count, not a value); `tallest_bar` a value inside the
 *   tallest bar, when that is not within the tolerance; `axis_middle` the middle of the axis, ignoring the heights;
 *   else `too_high` / `too_low`.
 */
export type HistogramMiss =
  | 'skew_reversed' | 'missed_skew' | 'called_skewed' | 'peak_count' | 'flat_vs_peaked'
  | 'neighbor_bar' | 'runner_up' | 'shorter_bar'
  | 'bin_edge' | 'total_count' | 'off_by_one'
  | 'off_axis' | 'tallest_bar' | 'axis_middle'
  | 'too_high' | 'too_low';

export const HISTOGRAM_MISSES_BY_MODE: Record<HistogramChallengeType, readonly HistogramMiss[]> = {
  identify_shape: ['skew_reversed', 'missed_skew', 'called_skewed', 'peak_count', 'flat_vs_peaked'],
  find_modal_bin: ['neighbor_bar', 'runner_up', 'shorter_bar'],
  read_frequency: ['bin_edge', 'neighbor_bar', 'total_count', 'off_by_one', 'too_high', 'too_low'],
  estimate_center: ['off_axis', 'tallest_bar', 'axis_middle', 'too_high', 'too_low'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const TYPE_IT = 'types a number in the answer box and presses Check Answer';

export const histogramCard = defineCard<HistogramMiss>({
  id: 'histogram',
  grades: ['Grade 6', 'Grade 7', 'Grade 8'],
  // Every mode publishes levers (`histogramLevers.ts`); every miss is answered by a help lever on every item.
  modes: {
    identify_shape: { ...CHECKED, answer: 'tap', misses: HISTOGRAM_MISSES_BY_MODE.identify_shape,
      moves: 'taps one shape word and presses Check Answer' },
    find_modal_bin: { ...CHECKED, answer: 'tap', misses: HISTOGRAM_MISSES_BY_MODE.find_modal_bin,
      moves: 'taps one bar of the graph and presses Check Answer' },
    read_frequency: { ...CHECKED, answer: 'type', misses: HISTOGRAM_MISSES_BY_MODE.read_frequency, moves: TYPE_IT },
    estimate_center: { ...CHECKED, answer: 'type', misses: HISTOGRAM_MISSES_BY_MODE.estimate_center, moves: TYPE_IT },
  },
  words: {
    job: 'read a histogram, where each bar covers a range of values and its height is how many values fall in it: name '
      + 'the shape of the whole distribution, find the tallest bar, read how many values one outlined bar holds, or '
      + 'estimate the mean or median from the bars',
    answer: 'the shape they choose, the bar they tap, or the number they type',
    question: 'the context, the question, the axis names, the bar edges along the bottom and, on an identify item, the '
      + 'shape words on the buttons',
  },
  levers: true,
});
