import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { NumberLineChallenge } from '../primitives/visual-primitives/math/NumberLine';

export interface NumberLinePipState extends PipPhaseGate {
  type: NumberLineChallenge['type'];
  /** Rendered targets: `line` (the whole number line), `start` (the jump's
   *  marked start point), `values` (the chips to order) and `value-*`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every position on the line could be the answer, so Pip never points at a
 * tick, a label, or a place on it. Plot and find-between: the line as a whole.
 * Jump: the start point, which the screen marks and the instruction names —
 * never where a hop lands. Order: the chips to place, as a row. Otherwise Pip
 * follows the child's last touch; checking is synchronous, so nothing is received.
 */
export function numberLinePipPose(state: NumberLinePipState): PipPose {
  const cueId = state.type === 'show_jump' && state.visibleIds.includes('start') ? 'start'
    : state.type === 'order_values' ? 'values'
      : 'line';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: state.lastTouchedId });
}
