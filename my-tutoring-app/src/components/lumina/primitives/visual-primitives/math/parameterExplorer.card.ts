/**
 * parameter-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `parameterExplorer.boss.ts`.
 * Every mode is answered on the screen and checked by the activity itself: a slider moved (explore), a direction
 * tapped, a value typed, or a parameter tapped. Every item starts from the parameters' starting values. A bespoke boss:
 * the modes mix sliders, taps and a typed number.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`parameterMiss`, `TeachingAttempt.miss`, handoff 20), named for the pattern on screen, drawn
 * from the old catalog's commonStruggles (a divisor read as a multiplier, all sliders moved at once) and the formula's
 * structure:
 * - `opposite_direction`: predicted the output moves the other way (a value typed on the wrong side of the start too);
 * - `missed_change`: Stay Same when the output changes; `invented_change`: a change when it stays the same;
 * - `unchanged_output`: typed the output at the starting values; `assumed_proportional`: typed the start scaled by the
 *   parameter's own ratio (new ÷ start) where the formula does not scale that way; `near_miss` within 5%;
 *   `too_high` / `too_low`;
 * - `no_effect`: chose a parameter whose doubling leaves the output where it is; `largest_value`: chose the parameter
 *   with the largest starting number; `weaker_effect`: another parameter that moves it less.
 */
export type ParameterExplorerMiss = 'opposite_direction' | 'missed_change' | 'invented_change'
  | 'unchanged_output' | 'assumed_proportional' | 'near_miss' | 'too_high' | 'too_low'
  | 'no_effect' | 'largest_value' | 'weaker_effect';

/** explore credits every move, so it names none. */
export const PARAMETER_MISSES_BY_MODE = {
  explore: [],
  'predict-direction': ['opposite_direction', 'missed_change', 'invented_change'],
  'predict-value': ['unchanged_output', 'assumed_proportional', 'near_miss', 'opposite_direction', 'too_high', 'too_low'],
  'identify-relationship': ['no_effect', 'largest_value', 'weaker_effect'],
} as const satisfies Record<string, readonly ParameterExplorerMiss[]>;

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const parameterExplorerCard = defineCard<ParameterExplorerMiss>({
  id: 'parameter-explorer',
  grades: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every checked mode publishes levers (`parameterExplorerLevers.ts`); explore has none, since nothing in it can miss.
  modes: {
    explore: { ...CHECKED, answer: 'manipulate', misses: PARAMETER_MISSES_BY_MODE.explore,
      moves: 'moves the sliders (a lock holds one parameter) and presses Done Exploring; any move is credited' },
    'predict-direction': { ...CHECKED, answer: 'tap', misses: PARAMETER_MISSES_BY_MODE['predict-direction'],
      moves: 'taps Increase, Decrease or Stay Same and presses Check Answer' },
    'predict-value': { ...CHECKED, answer: 'type', misses: PARAMETER_MISSES_BY_MODE['predict-value'],
      moves: 'types the output at the new setting and presses Check Answer' },
    'identify-relationship': { ...CHECKED, answer: 'tap', misses: PARAMETER_MISSES_BY_MODE['identify-relationship'],
      moves: 'taps one parameter and presses Check Answer' },
  },
  words: {
    job: 'reason about how each parameter of a formula drives its output: move the sliders and watch, predict which way '
      + 'or to what value the output moves when one parameter changes and the others are held, or find the parameter '
      + 'whose doubling changes the output the most',
    answer: 'the direction they choose, the value they type, or the parameter they choose',
    question: 'the formula, each parameter\'s name, slider range and starting value, the parameter that changes and its '
      + 'new setting, and the output\'s name and unit',
  },
  levers: true,
});
