/**
 * function-sketch's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `functionSketch.boss.ts`.
 * Every mode is answered on screen and checked by the activity, one item at a time: classify-shape and
 * compare-functions tap one choice and press Check, identify-features taps the features on the curve, sketch-match
 * places points on an empty graph. A bespoke boss: the sketch is a placement, not a tap.
 */
import type { FunctionSketchChallenge } from './FunctionSketch';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

export type FunctionSketchMode = FunctionSketchChallenge['type'];

/**
 * What a wrong check shows (`functionSketchMiss`, `TeachingAttempt.miss`, handoff 20), drawn from the old catalog's
 * commonStruggles (roots and extrema confused, families confused, points that miss the key features):
 * - classify-shape: `line_for_curve` chose linear for a curve; `curve_for_line` a curved family for a line;
 *   `polynomial_degree` one polynomial for another (quadratic, cubic); `growth_family` exponential or logarithmic
 *   confused with each other or with a polynomial; `periodic_family` periodic confused with anything; `wrong_family`;
 * - compare-functions: `other_curve`;
 * - identify-features: the first feature not found, `missed_root`, `missed_extremum` (a maximum or minimum),
 *   `missed_intercept`, `missed_asymptote`;
 * - sketch-match: `upside_down` the sketch would pass upside down (every y flipped); else the heaviest key feature the
 *   sketch misses, `missed_peak`, `missed_zero`, `missed_intercept`, `missed_trend`.
 */
export type FunctionSketchMiss = 'line_for_curve' | 'curve_for_line' | 'polynomial_degree' | 'growth_family' | 'periodic_family'
  | 'wrong_family' | 'other_curve' | 'missed_root' | 'missed_extremum' | 'missed_intercept' | 'missed_asymptote'
  | 'upside_down' | 'missed_peak' | 'missed_zero' | 'missed_trend';

export const FUNCTION_SKETCH_MISSES_BY_MODE: Record<FunctionSketchMode, readonly FunctionSketchMiss[]> = {
  'classify-shape': ['line_for_curve', 'curve_for_line', 'polynomial_degree', 'growth_family', 'periodic_family', 'wrong_family'],
  'compare-functions': ['other_curve'],
  'identify-features': ['missed_root', 'missed_extremum', 'missed_intercept', 'missed_asymptote'],
  'sketch-match': ['upside_down', 'missed_peak', 'missed_zero', 'missed_intercept', 'missed_trend'],
};

export const functionSketchCard = defineCard<FunctionSketchMiss>({
  id: 'function-sketch',
  grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`functionSketchLevers.ts`); every miss is answered by a lever on every item.
  modes: {
    'classify-shape': { ...TAP_ONE, misses: FUNCTION_SKETCH_MISSES_BY_MODE['classify-shape'],
      moves: 'taps one family under the graph and presses Check Answer' },
    'compare-functions': { ...TAP_ONE, misses: FUNCTION_SKETCH_MISSES_BY_MODE['compare-functions'],
      moves: 'taps the button for one curve and presses Check Answer' },
    'identify-features': { ...TAP_ONE, misses: FUNCTION_SKETCH_MISSES_BY_MODE['identify-features'],
      moves: 'taps each key feature on the curve and presses Check Answer' },
    'sketch-match': { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      misses: FUNCTION_SKETCH_MISSES_BY_MODE['sketch-match'],
      moves: 'taps points on the empty graph, which a smooth curve joins, and presses Check Answer; Clear removes every point' },
  },
  words: {
    job: 'reason about the shape of a function\'s graph: name the family a curve belongs to, pick which of two curves '
      + 'a question describes, find the key features on a curve, or sketch a described function',
    answer: 'the family or curve they choose, the features they find, or the sketch they place',
    question: 'the instruction, the question, the expression or description shown, and the choices on the buttons',
  },
  levers: true,
});
