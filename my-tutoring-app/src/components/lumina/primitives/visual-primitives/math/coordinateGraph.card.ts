/**
 * coordinate-graph's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `coordinateGraph.boss.ts`.
 * Every mode is answered on the plane and checked by the activity itself, one item at a time: plot_point places a
 * point by tapping a grid crossing (a placement, like shape-tracer's corners), the other three tap one of four choices.
 * A bespoke boss: the modes mix a placement and a choice.
 */
import type { CoordinateGraphChallenge } from './CoordinateGraph';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

export type CoordinateGraphMode = CoordinateGraphChallenge['type'];

/**
 * What a wrong check shows (`coordinateMiss`, `TeachingAttempt.miss`, handoff 20), from the point placed or the
 * choice's value, drawn from the old catalog's commonStruggles (x and y swapped, negative directions, slope upside
 * down, slope and intercept confused):
 * - plot and read: `swapped` (y, x); `both_signs` (-x, -y); `x_sign` (-x, y); `y_sign` (x, -y); `one_axis` a point on
 *   an axis at one of the two numbers (only one direction moved); `off_by_one` one grid step from the point;
 *   `wrong_point` anything else;
 * - slope: `opposite_sign` -m; `reciprocal` run over rise; `negative_reciprocal` -run over rise; `rise_only` the rise
 *   alone; `run_only` the run alone; `wrong_slope` anything else;
 * - intercept: `opposite_sign` -b; `slope_instead` the slope m; `x_intercept` where the line crosses the x-axis;
 *   `point_y` the y of a marked point (read at the point, not at the crossing); `off_by_one` b plus or minus one;
 *   `wrong_intercept` anything else.
 */
export type CoordinateMiss = 'swapped' | 'both_signs' | 'x_sign' | 'y_sign' | 'one_axis' | 'off_by_one' | 'wrong_point'
  | 'opposite_sign' | 'reciprocal' | 'negative_reciprocal' | 'rise_only' | 'run_only' | 'wrong_slope'
  | 'slope_instead' | 'x_intercept' | 'point_y' | 'wrong_intercept';

const POINT_MISSES: readonly CoordinateMiss[] = ['swapped', 'both_signs', 'x_sign', 'y_sign', 'one_axis', 'off_by_one', 'wrong_point'];
export const COORDINATE_MISSES_BY_MODE: Record<CoordinateGraphMode, readonly CoordinateMiss[]> = {
  plot_point: POINT_MISSES,
  read_point: POINT_MISSES,
  find_slope: ['opposite_sign', 'reciprocal', 'negative_reciprocal', 'rise_only', 'run_only', 'wrong_slope'],
  find_intercept: ['opposite_sign', 'slope_instead', 'x_intercept', 'point_y', 'off_by_one', 'wrong_intercept'],
};

const CHOICE = { ...TAP_ONE, moves: 'taps one of the four choices under the plane; the tap is the check' } as const;

export const coordinateGraphCard = defineCard<CoordinateMiss>({
  id: 'coordinate-graph',
  grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
  // Every mode publishes levers (`coordinateGraphLevers.ts`); every miss is answered by a lever on every item.
  modes: {
    plot_point: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: COORDINATE_MISSES_BY_MODE.plot_point,
      moves: 'taps the grid crossing on the plane where the point goes; placing it is the check' },
    read_point: { ...CHOICE, misses: COORDINATE_MISSES_BY_MODE.read_point },
    find_slope: { ...CHOICE, misses: COORDINATE_MISSES_BY_MODE.find_slope },
    find_intercept: { ...CHOICE, misses: COORDINATE_MISSES_BY_MODE.find_intercept },
  },
  words: {
    job: 'work on the coordinate plane: plot the point an ordered pair names, read the ordered pair of a highlighted '
      + 'point, find the slope of a line through two points, or find where a line crosses the y-axis',
    answer: 'the point they place or the choice they tap',
    question: 'the instruction, the four choices, and every pair or number the plane itself labels',
  },
  levers: true,
});
