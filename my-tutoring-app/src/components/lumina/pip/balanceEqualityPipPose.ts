import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { EqualityStep } from '../primitives/visual-primitives/math/balanceEqualityScript';

export interface BalanceEqualityPipState extends PipPhaseGate {
  step: EqualityStep;
  /** Rendered targets: `left` (the unnumbered left weight), `right` (the right pan),
   *  `sum` (the gathered right-side weights), `tray`, and one `weight-*` per tray button. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Build: Pip points at the right pan, where weights go — never a tray weight or a
 * placed block — and receives the settled pan while it is checked. Total: the
 * gathered right-side weights, whose sum is not printed. Infer: the left weight the
 * ask names, whose number stays hidden. On the spoken steps Pip keeps watching that
 * target while the answer is judged.
 */
export function balanceEqualityPipPose(state: BalanceEqualityPipState): PipPose {
  const cueId = state.step === 'build' ? 'right' : state.step === 'total' ? 'sum' : 'left';
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId,
    attendId: state.step === 'build' ? state.lastTouchedId : cueId,
    handover: state.step === 'build',
  });
}
