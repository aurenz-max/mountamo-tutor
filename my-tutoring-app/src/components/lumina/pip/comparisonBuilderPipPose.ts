import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface ComparisonPipState extends PipPhaseGate {
  /** Rendered targets: `workspace`, and `touched` while the child's last touch is still on screen. */
  visibleIds: string[];
  hasTouch: boolean;
}

/** Every tappable thing here is an answer choice (a group, a numeral, a symbol,
 * a card, a number cell), so Pip points only at the workspace as a whole and
 * otherwise follows what the child touched. Checking is synchronous, so there
 * is no handover phase to receive.
 */
export function comparisonBuilderPipPose(state: ComparisonPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: 'workspace', attendId: state.hasTouch ? 'touched' : undefined,
  });
}
