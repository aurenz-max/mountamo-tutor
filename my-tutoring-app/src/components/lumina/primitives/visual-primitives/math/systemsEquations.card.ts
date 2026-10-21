/**
 * systems-equations-visualizer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `systemsEquations.boss.ts`.
 * Every mode asks for the one (x, y) that solves two linear equations: the learner types x and y and presses Check,
 * and the activity checks the pair within 0.01. One item at a time, typed, activity-judged: a bespoke boss.
 */
import type { SystemsEquationsChallengeType } from './SystemsEquationsVisualizer';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`systemsMiss`, `TeachingAttempt.miss`, handoff 20), from the pair entered against the key
 * and the two lines, drawn from the old catalog's commonStruggles (reading the crossing wrong, forgetting to
 * back-substitute, signs not lined up), most specific first:
 * - `swapped` (y, x); `both_signs` (-x, -y); `x_sign` (-x, y); `y_sign` (x, -y);
 * - `intercept_point` a line's y-axis crossing (0, b): the start of one line, not where the two meet (graph and
 *   substitution, whose equations print b);
 * - `one_line_only` a point on one line and not the other: it solves one equation only;
 * - `off_by_one` one grid step from the solution;
 * - `x_only` x right, y wrong (the back-substitution); `y_only` y right, x wrong;
 * - `wrong_point` anything else.
 */
export type SystemsMiss = 'swapped' | 'both_signs' | 'x_sign' | 'y_sign' | 'intercept_point' | 'one_line_only'
  | 'off_by_one' | 'x_only' | 'y_only' | 'wrong_point';

const ALL: readonly SystemsMiss[] = ['swapped', 'both_signs', 'x_sign', 'y_sign', 'intercept_point', 'one_line_only',
  'off_by_one', 'x_only', 'y_only', 'wrong_point'];
export const SYSTEMS_MISSES_BY_MODE: Record<SystemsEquationsChallengeType, readonly SystemsMiss[]> = {
  graph: ALL,
  substitution: ALL,
  elimination: ALL.filter(m => m !== 'intercept_point'),
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'types x and y into the two boxes, then presses Check' } as const;

export const systemsEquationsCard = defineCard<SystemsMiss>({
  id: 'systems-equations-visualizer',
  grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  // Every mode publishes levers (`systemsEquationsLevers.ts`); every miss is answered by a help lever in every mode.
  modes: {
    graph: { ...TYPED, misses: SYSTEMS_MISSES_BY_MODE.graph },
    substitution: { ...TYPED, misses: SYSTEMS_MISSES_BY_MODE.substitution },
    elimination: { ...TYPED, misses: SYSTEMS_MISSES_BY_MODE.elimination },
  },
  words: {
    job: 'find the one point (x, y) that makes two linear equations true at once: where the two drawn lines cross, or '
      + 'by substitution or elimination',
    answer: 'the x and y they type',
    question: 'the two equations, the instruction, and on graph items the two drawn lines and the axes',
  },
  levers: true,
});
