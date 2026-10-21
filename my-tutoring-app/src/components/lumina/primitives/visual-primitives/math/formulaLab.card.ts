/**
 * formula-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `formulaLab.boss.ts`.
 * Every mode is answered on the screen and checked by the activity itself: a slider moved to its target, a prediction
 * placed on the track and locked, a formula built from tokens, or an output typed. One item at a time: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`formulaMiss`, `TeachingAttempt.miss`, handoff 20), named for the pattern on screen, drawn
 * from the old catalog's commonStruggles (the same direction every time, arithmetic before structure, tokens in an
 * invalid order):
 * - `opposite_direction`: predicted the output moves the other way;
 * - `missed_change`: predicted it stays about the same when it changes; `invented_change`: predicted a change when it
 *   stays about the same;
 * - `too_strong` / `too_weak` (magnitude): the right way, or near the centre, but too far from the observed marker;
 * - `incomplete`: fewer tokens than the formula has; `not_an_expression`: every token, in an order that is not a
 *   formula; `inverted`: every token, giving the reciprocal of the output (a divisor and a multiplier swapped);
 *   `operation_order`: every token, a valid formula, a different relationship;
 * - `used_starting_inputs` (transfer): the output at the starting values the scene still shows, not the new ones;
 *   `power_as_multiply`: a power worked as a multiplication; `near_miss`: within 5%; `too_high` / `too_low`.
 */
export type FormulaLabMiss = 'opposite_direction' | 'missed_change' | 'invented_change' | 'too_strong' | 'too_weak'
  | 'incomplete' | 'not_an_expression' | 'inverted' | 'operation_order'
  | 'used_starting_inputs' | 'power_as_multiply' | 'near_miss' | 'too_high' | 'too_low';

/** free-explore credits every finished move, so it names none. */
export const FORMULA_MISSES_BY_MODE = {
  'free-explore': [],
  'predict-direction': ['opposite_direction', 'missed_change', 'invented_change'],
  'predict-magnitude': ['opposite_direction', 'too_strong', 'too_weak'],
  'construct-formula': ['incomplete', 'not_an_expression', 'inverted', 'operation_order'],
  'transfer-apply': ['used_starting_inputs', 'power_as_multiply', 'near_miss', 'too_high', 'too_low'],
} as const satisfies Record<string, readonly FormulaLabMiss[]>;

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const PREDICT = 'drags the prediction along the track and presses Lock prediction (writing a short reason first when the item asks)';

export const formulaLabCard = defineCard<FormulaLabMiss>({
  id: 'formula-lab',
  grades: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every checked mode publishes levers (`formulaLabLevers.ts`); free-explore has none, since nothing in it can miss.
  modes: {
    'free-explore': { ...CHECKED, answer: 'manipulate', misses: FORMULA_MISSES_BY_MODE['free-explore'],
      moves: 'drags the changed quantity\'s slider to its target; reaching the target finishes the experiment' },
    'predict-direction': { ...CHECKED, answer: 'manipulate', misses: FORMULA_MISSES_BY_MODE['predict-direction'], moves: PREDICT },
    'predict-magnitude': { ...CHECKED, answer: 'manipulate', misses: FORMULA_MISSES_BY_MODE['predict-magnitude'], moves: PREDICT },
    'construct-formula': { ...CHECKED, answer: 'build', misses: FORMULA_MISSES_BY_MODE['construct-formula'],
      moves: 'taps tokens in order to build the hidden right-hand side (Undo token takes the last one back) and presses Check formula' },
    'transfer-apply': { ...CHECKED, answer: 'type', misses: FORMULA_MISSES_BY_MODE['transfer-apply'],
      moves: 'types the output for the new inputs and presses Check transferred output' },
  },
  words: {
    job: 'reason about how one quantity in a formula changes the output while every other quantity stays fixed: move it '
      + 'and watch, predict which way or how strongly the output changes, build the hidden formula from its tokens, or '
      + 'work out the output for new inputs',
    answer: 'the prediction they lock, the formula they build, or the output they type',
    question: 'the instruction, the formula when it is shown, every quantity\'s name and unit, the changed quantity\'s '
      + 'starting and target values, and the new inputs in transfer',
  },
  levers: true,
});
