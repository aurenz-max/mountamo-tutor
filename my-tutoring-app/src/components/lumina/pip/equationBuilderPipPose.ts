import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { EquationBuilderChallenge } from '../primitives/visual-primitives/math/EquationBuilder';

export interface EquationBuilderPipState extends PipPhaseGate {
  type: EquationBuilderChallenge['type'];
  /** Rendered targets: `workspace` (the slot row), `pool`, `equation` (the printed
   *  equation), `gap` (its "?" tile), `entry` (the number box), and one id per
   *  choice: `option-*`, `truth-true`, `truth-false`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Tiles, number options and True/False are all answers, so Pip never points at
 * one. It points where the child works: the empty slot row on build and rewrite,
 * the "?" the equation already prints on missing value and balance, and the whole
 * printed equation on true-or-false. Checking is synchronous, so nothing is received.
 */
export function equationBuilderPipPose(state: EquationBuilderPipState): PipPose {
  const cueId = state.type === 'build' || state.type === 'rewrite' ? 'workspace'
    : state.type === 'true-false' ? 'equation' : 'gap';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId });
}
