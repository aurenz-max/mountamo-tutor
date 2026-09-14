import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { CompareObjectsKind } from '../primitives/visual-primitives/math/compareObjectsScript';

export interface CompareObjectsPipState extends PipPhaseGate {
  kind: CompareObjectsKind;
  /** Rendered targets: `drawing`, `pick-<name>`. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every answer is one of the drawn objects (or their order), so Pip points at
 * the drawing as a whole and never at an object or a name button. On an order
 * it follows the child's own taps and receives the finished order.
 */
export function compareObjectsPipPose(state: CompareObjectsPipState): PipPose {
  if (state.kind === 'order_three') {
    return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'drawing', attendId: state.lastTouchedId, handover: true });
  }
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'drawing', attendId: 'drawing' });
}
