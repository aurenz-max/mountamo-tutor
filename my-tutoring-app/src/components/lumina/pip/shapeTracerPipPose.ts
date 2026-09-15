import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface ShapeTracerPipState extends PipPhaseGate {
  /** Rendered targets: `canvas`, plus one id per tappable dot (`vertex-*`,
   *  `remaining-*`, `grid-*`, `dot-*`). */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Which dot comes next is the answer on trace, complete and connect-the-dots once
 * a tier withdraws the order numbers and the next-dot ring, and every corner is the
 * child's own choice on draw-from-description. So Pip points only at the canvas as
 * a whole and otherwise watches the dot the child tapped. Every check here is
 * synchronous (the last correct dot, or Check Shape), so there is no handover to receive.
 */
export function shapeTracerPipPose(state: ShapeTracerPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'canvas', attendId: state.lastTouchedId });
}
