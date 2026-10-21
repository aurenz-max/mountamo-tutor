/**
 * distribution-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `distributionExplorer.boss.ts`.
 * Every mode is answered on the workbench and checked by the activity itself: explore by a slider moved or the family
 * changed before Got it, the other modes by one choice tapped and Check. A bespoke boss: explore is a manipulation
 * beside three tapped modes.
 */
import type { DistributionEvalMode } from './types';
import { defineCard } from '../../components/live-activity/boss';

/**
 * What a wrong check shows (`distributionMiss`, `TeachingAttempt.miss`, handoff 20), from the choice picked, drawn from
 * the old catalog's commonStruggles (rate vs mean, discrete vs continuous, complements and boundary terms, skew
 * direction):
 * - explore: `not_explored` (Got it with no slider moved and no family changed);
 * - identify: `discrete_continuous` (a family of the other kind: exponential for a count, or a count for a waiting
 *   time), `binomial_poisson` (the two counting families swapped);
 * - compute: `complement` (1 − the answer), `reciprocal` (1 ÷ the answer: the rate for the mean), `near_value` (within
 *   15%: a boundary term in or out, ≤ for <), `wrong_value`;
 * - predict shape (compute_advanced): `reversed_skew` (left for right or right for left), `said_symmetric`,
 *   `wrong_shape`.
 */
export type DistributionMiss = 'not_explored' | 'discrete_continuous' | 'binomial_poisson'
  | 'complement' | 'reciprocal' | 'near_value' | 'wrong_value'
  | 'reversed_skew' | 'said_symmetric' | 'wrong_shape';

const COMPUTE_MISSES: readonly DistributionMiss[] = ['complement', 'reciprocal', 'near_value', 'wrong_value'];
export const DISTRIBUTION_MISSES_BY_MODE: Record<DistributionEvalMode, readonly DistributionMiss[]> = {
  explore: ['not_explored'],
  identify: ['discrete_continuous', 'binomial_poisson'],
  compute_basic: COMPUTE_MISSES,
  compute_advanced: [...COMPUTE_MISSES, 'reversed_skew', 'said_symmetric', 'wrong_shape'],
};

const TAPPED = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time' } as const;

export const distributionExplorerCard = defineCard<DistributionMiss>({
  id: 'distribution-explorer',
  grades: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`distributionExplorerLevers.ts`); every miss is answered by a lever in its mode.
  modes: {
    explore: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: DISTRIBUTION_MISSES_BY_MODE.explore,
      moves: 'moves a slider or changes the family, then presses Got it; Got it is credited only after the workbench moved' },
    identify: { ...TAPPED, misses: DISTRIBUTION_MISSES_BY_MODE.identify, moves: 'taps one family and presses Check' },
    compute_basic: { ...TAPPED, misses: DISTRIBUTION_MISSES_BY_MODE.compute_basic, moves: 'taps one value and presses Check' },
    compute_advanced: { ...TAPPED, misses: DISTRIBUTION_MISSES_BY_MODE.compute_advanced,
      moves: 'taps one value or shape word and presses Check' },
  },
  words: {
    job: 'work with probability distributions (binomial, Poisson, exponential) on a live workbench: try what a slider '
      + 'does to the chart, name the family a scenario describes, pick the probability, mean or variance a scenario '
      + 'asks for, or pick the shape of a distribution',
    answer: 'the family, value or shape they tap (on explore, a move of the workbench)',
    question: 'the scenario, the question, the choices on the buttons, and what the workbench shows',
  },
  levers: true,
});
