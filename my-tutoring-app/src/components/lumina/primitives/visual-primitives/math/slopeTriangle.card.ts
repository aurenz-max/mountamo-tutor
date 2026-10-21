/**
 * slope-triangle's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `slopeTriangle.boss.ts`.
 * Reading a triangle the learner types its rise and run; calculating, the slope; building, the learner moves the
 * triangle's corners until its top corner lands back on the line. Every mode is checked by the activity, one item at a
 * time, with a typed answer in two modes and a built triangle in the third: a bespoke boss.
 */
import type { SlopeTriangleChallengeType } from './SlopeTriangle';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`slopeTriangleMiss`, `TeachingAttempt.miss`, handoff 20), drawn from the old catalog's
 * commonStruggles (rise and run confused, the sign of a falling line, slope versus one triangle's legs, the ratio
 * turned over):
 * - identify_slope: `swapped` rise and run exchanged; `rise_sign` the rise's sign lost (a falling line's rise typed
 *   positive, or the reverse); `run_sign` the run typed negative; `same_ratio` a pair with the line's slope but not this
 *   triangle's legs (the slope read as rise over one); `rise_off` the run right and the rise one off; `run_off` the
 *   rise right and the run one off; `wrong_legs` anything else;
 * - calculate: `opposite_sign` -m; `reciprocal` run over rise; `negative_reciprocal` -run over rise; `rise_only` the
 *   rise alone; `run_only` the run alone; `wrong_slope` anything else;
 * - draw_triangle: `flat` checked with the top corner never raised or lowered; `wrong_sign` the rise the line needs
 *   for that run, the other way; `swapped` the run over the rise (rise/run is the slope turned over); `rise_off` one
 *   step from the rise the run needs; `wrong_ratio` anything else.
 */
export type SlopeTriangleMiss = 'swapped' | 'rise_sign' | 'run_sign' | 'same_ratio' | 'rise_off' | 'run_off' | 'wrong_legs'
  | 'opposite_sign' | 'reciprocal' | 'negative_reciprocal' | 'rise_only' | 'run_only' | 'wrong_slope'
  | 'flat' | 'wrong_sign' | 'wrong_ratio';

export const SLOPE_TRIANGLE_MISSES_BY_MODE: Record<SlopeTriangleChallengeType, readonly SlopeTriangleMiss[]> = {
  identify_slope: ['swapped', 'rise_sign', 'run_sign', 'same_ratio', 'rise_off', 'run_off', 'wrong_legs'],
  calculate: ['opposite_sign', 'reciprocal', 'negative_reciprocal', 'rise_only', 'run_only', 'wrong_slope'],
  draw_triangle: ['flat', 'wrong_sign', 'swapped', 'rise_off', 'wrong_ratio'],
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const slopeTriangleCard = defineCard<SlopeTriangleMiss>({
  id: 'slope-triangle',
  grades: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11'],
  // Every mode publishes levers (`slopeTriangleLevers.ts`); every miss is answered by a lever in its mode.
  modes: {
    identify_slope: { ...CHECKED, answer: 'type', moves: 'types the rise in the rise box and the run in the run box, then '
      + 'presses Check', misses: SLOPE_TRIANGLE_MISSES_BY_MODE.identify_slope },
    calculate: { ...CHECKED, answer: 'type', moves: 'types the slope in the m box as a whole number, a decimal or a '
      + 'fraction like a/b, then presses Check', misses: SLOPE_TRIANGLE_MISSES_BY_MODE.calculate },
    draw_triangle: { ...CHECKED, answer: 'manipulate', moves: 'drags the triangle\'s corners on the grid, or presses '
      + '← Move and Move → to slide it along the line, Run − and Run + to change the run, Rise − and Rise + to move the '
      + 'top corner, then presses Check', misses: SLOPE_TRIANGLE_MISSES_BY_MODE.draw_triangle },
  },
  words: {
    job: 'find a line\'s slope with a slope triangle: read the rise and the run of a triangle drawn on the line, '
      + 'calculate the slope as the rise divided by the run, or build a triangle whose top corner lands back on the line',
    answer: 'the rise and run they type, the slope they type, or the triangle they build',
    question: 'the instruction, the line\'s label (its slope shown as ?x where the item asks for it), the grid, any leg '
      + 'label the card draws and a build\'s current run and rise',
  },
  levers: true,
});
