/**
 * equation-workspace's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `equationWorkspace.boss.ts`.
 * Every mode is one equation to solve for a variable by choosing operations from a menu, and the activity checks each
 * choice against the solution path. In guided-solve, solve and multi-step the learner works the equation down step by
 * step (each right operation is applied to both sides); under identify-operation they choose one operation and press
 * Check. Bespoke: the stepped solving modes are not one tap.
 */
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong operation shows (`equationMiss`, `TeachingAttempt.miss`, handoff 20), from the old catalog's
 * commonStruggles (wrong order, not the operation that undoes) and the menu's distractors:
 * - `later_step`: an operation the solution does later (undoing an inner layer before the outer one);
 * - `not_inverse`: the same operation as the right step's opposite on the same number (adds 15 where 15 must be
 *   subtracted): it does again what is attached instead of undoing it;
 * - `wrong_number`: the right kind of operation on a number that is not the one attached to the variable;
 * - `other_operation`: any other operation.
 */
export type EquationMiss = 'later_step' | 'not_inverse' | 'wrong_number' | 'other_operation';

const MISSES: readonly EquationMiss[] = ['later_step', 'not_inverse', 'wrong_number', 'other_operation'];
export const EQUATION_MISSES_BY_MODE: Record<string, readonly EquationMiss[]> = {
  'guided-solve': MISSES, 'identify-operation': MISSES, solve: MISSES, 'multi-step': MISSES,
};

/** The solving modes: the learner manipulates the equation one operation at a time until the variable is alone. */
const STEPS = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: MISSES,
  moves: 'taps operations in the menu one at a time: the right next step is applied to both sides and its new line '
    + 'appears, any other operation is not applied, and the item is finished when the variable is alone' } as const;

export const equationWorkspaceCard = defineCard<EquationMiss>({
  id: 'equation-workspace',
  grades: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`equationWorkspaceLevers.ts`); every miss is answered by a help lever in every mode.
  modes: {
    'guided-solve': STEPS,
    'identify-operation': { ...TAP_ONE, misses: MISSES, moves: 'taps the one operation to apply next, then presses Check' },
    solve: STEPS,
    'multi-step': STEPS,
  },
  words: {
    job: 'solve an equation for its variable by choosing operations: an operation done to both sides keeps the '
      + 'equation equal, the inverse undoes what is attached to the variable, and layers come off in reverse order, '
      + 'the last thing done to the variable first',
    answer: 'each operation they choose',
    question: 'the equation, the variable to solve for, the lines reached so far and the operations in the menu',
  },
  levers: true,
});
