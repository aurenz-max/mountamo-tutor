/**
 * place-value-chart's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `placeValueChart.boss.ts`.
 * Every mode is the same rotation of three steps, named by the scene's `kind`: a printed number with one digit glowing,
 * where the learner says the name of its place (`find_place`) and then what it is worth (`say_value`), which the tutor
 * judges against the key; and a number the ask says but never prints, which the learner types into the chart one digit
 * per column (`build_number`) and the chart checks. The modes differ only in how big the numbers are.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong chart shows (`placeValueMiss`), from the written digits:
 * - `zero_left_empty`: only columns whose digit is zero were left empty; `column_empty`: another column is empty;
 * - `digits_swapped`: the right digits, some in the wrong columns (406 written 046);
 * - `teen_ty_swap`: a teen written as its -ty or the reverse (13 as 30, 30 as 13), in the last two columns;
 * - `one_short` / `one_over` / `one_ten_off`: the written number is one or ten away;
 * - `short_by_more` / `over_by_more`: any other number.
 */
export type PlaceValueMiss = 'zero_left_empty' | 'column_empty' | 'digits_swapped' | 'teen_ty_swap'
  | 'one_short' | 'one_over' | 'one_ten_off' | 'short_by_more' | 'over_by_more';

/**
 * What a wrong spoken place or value shows (`placeValueSpokenMisses`, named by the `spoken_miss` observer): on
 * find_place the digit's worth or the digit said for its place, or a column next to it or further away; on say_value
 * the bare digit, the place name alone, the worth one column over, the whole number, or a digit one away.
 */
export type SpokenPlaceValueMiss = 'said_value' | 'said_digit' | 'next_place' | 'other_place' | 'said_place' | 'shifted_place'
  | 'said_number' | 'next_digit_value';

export type PlaceValueChartMiss = PlaceValueMiss | SpokenPlaceValueMiss;

/** Every mode alternates printed and dictated numbers, so every mode can show every miss. */
export const PLACE_VALUE_MISSES: readonly PlaceValueChartMiss[] = ['zero_left_empty', 'column_empty', 'digits_swapped',
  'teen_ty_swap', 'one_short', 'one_over', 'one_ten_off', 'short_by_more', 'over_by_more', 'said_value', 'said_digit',
  'next_place', 'other_place', 'said_place', 'shifted_place', 'said_number', 'next_digit_value'];

/** find_place has no lever: a place label anywhere (on the item or on a model) names its answer by column position. */
const UNANSWERED: readonly PlaceValueChartMiss[] = ['said_value', 'next_place', 'other_place'];

const WRITE = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types one digit in each labelled column of the chart; the chart checks once the learner stops, even with a '
    + 'column left empty' } as const;
const STEPS = { find_place: SPOKEN, say_value: SPOKEN, build_number: WRITE };
const MODE = { steps: STEPS, misses: PLACE_VALUE_MISSES, unanswered: UNANSWERED };

export const placeValueChartCard = defineCard<PlaceValueChartMiss>({
  id: 'place-value-chart',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: { identify: MODE, build: MODE, compare: MODE, expanded_form: MODE },
  words: {
    job: 'say which place a glowing digit of a printed number is in and what that digit is worth, or write a number '
      + 'they hear into a place-value chart, one digit in each column',
    answer: 'their answer',
    question: 'the ask and how to answer it',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
