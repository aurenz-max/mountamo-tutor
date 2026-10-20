/**
 * bar-model's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `barModel.boss.ts`.
 * Eight modes are one tap on the graph that the graph checks (a number under it, or a row); say_what_it_shows and
 * compare_two_graphs are said and the tutor judges the comparison; the sticker chart, the built graph and the made
 * graph are boards the graph checks at their button.
 */
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads (`barModelMiss`,
 * `makeGraphMiss`) or, on the spoken modes, the known wrong comparisons (`barModelSpokenMisses`):
 * - a number chosen: `picked_icon_count` (a picture graph's icon count), `another_row`, `one_step_off`, then off-by;
 * - a row tapped: `reversed` (the other extreme), `other_row`; match_to_bar: the tapped row's count, off-by;
 * - a sticker chart or built graph: `rows_swapped`, `several_rows_off`, one row off-by; `wrong_step`;
 * - a made graph: `reversed`, `tied`, `other_row`, `not_same`, `left_empty`, off-by on "N more";
 * - spoken: `reversed_comparison`, `same_for_different`, `rows_not_graphs`, `no_comparison`.
 */
export type BarModelMiss = 'picked_icon_count' | 'another_row' | 'one_step_off' | 'one_short' | 'one_over' | 'short_by_more'
  | 'over_by_more' | 'reversed' | 'other_row' | 'rows_swapped' | 'several_rows_off' | 'wrong_step'
  | 'tied' | 'not_same' | 'left_empty';
/** What a wrong spoken comparison shows (handoff 20 Part B). */
export type SpokenGraphMiss = 'reversed_comparison' | 'same_for_different' | 'rows_not_graphs' | 'no_comparison';

const SCALED = ['another_row', 'one_step_off', ...OFF_BY] as const;
const ROWS = ['rows_swapped', 'several_rows_off', ...OFF_BY] as const;

/** By mode. A scaled bar graph has no picture key, so `picked_icon_count` is picture_graph's only; two bars have no
 *  middle row, so compare_bars names only `reversed`. */
export const BAR_MODEL_MISSES = {
  read_one_to_one: ['another_row', ...OFF_BY],
  most_least: ['reversed', 'other_row'],
  compare_bars: ['reversed'],
  match_to_bar: OFF_BY,
  build_one_to_one: ROWS,
  make_graph: ['reversed', 'tied', 'other_row', 'not_same', 'left_empty', ...OFF_BY],
  say_what_it_shows: ['reversed_comparison', 'same_for_different', 'no_comparison'],
  compare_two_graphs: ['reversed_comparison', 'same_for_different', 'rows_not_graphs', 'no_comparison'],
  read_scale: SCALED,
  picture_graph: ['picked_icon_count', ...SCALED],
  scaled_bar_graph: SCALED,
  graph_word_problem: SCALED,
  build_graph: [...ROWS, 'wrong_step'],
} as const satisfies Record<string, readonly (BarModelMiss | SpokenGraphMiss)[]>;

const board = { answer: 'build', judge: 'activity', flow: 'board' } as const;

export const barModelCard = defineCard<BarModelMiss | SpokenGraphMiss>({
  id: 'bar-model',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    read_one_to_one: { ...TAP_ONE, misses: BAR_MODEL_MISSES.read_one_to_one },
    most_least: { ...TAP_ONE, misses: BAR_MODEL_MISSES.most_least },
    compare_bars: { ...TAP_ONE, misses: BAR_MODEL_MISSES.compare_bars },
    match_to_bar: { ...TAP_ONE, misses: BAR_MODEL_MISSES.match_to_bar },
    build_one_to_one: { ...board, moves: 'taps a row to add a sticker (Take one off removes one), then presses Check my chart',
      misses: BAR_MODEL_MISSES.build_one_to_one },
    make_graph: { ...board, moves: 'taps a column to add a picture (a tap on a picture takes it out), then presses I\'m done',
      misses: BAR_MODEL_MISSES.make_graph },
    say_what_it_shows: { ...SPOKEN, misses: BAR_MODEL_MISSES.say_what_it_shows },
    compare_two_graphs: { ...SPOKEN, misses: BAR_MODEL_MISSES.compare_two_graphs },
    read_scale: { ...TAP_ONE, misses: BAR_MODEL_MISSES.read_scale },
    picture_graph: { ...TAP_ONE, misses: BAR_MODEL_MISSES.picture_graph },
    scaled_bar_graph: { ...TAP_ONE, misses: BAR_MODEL_MISSES.scaled_bar_graph },
    graph_word_problem: { ...TAP_ONE, misses: BAR_MODEL_MISSES.graph_word_problem },
    build_graph: { ...board, moves: 'sets each bar with + and −, picks a scale step, then presses Submit graph',
      misses: BAR_MODEL_MISSES.build_graph },
  },
  words: {
    job: 'read a graph, compare its rows, or make one',
    answer: 'their answer',
    question: 'the ask and the row names',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
