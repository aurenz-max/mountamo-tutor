import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface TenFramePipState extends PipPhaseGate {
  /** Subitize hides its counters; Pip never follows a box on a hidden frame. */
  subitize: boolean;
  /** The answer is the child's placement or flip, judged as a handover. */
  gesture: boolean;
  /** Rendered targets: `frame`, plus `cell-<n>` except on subitize. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Every box on the frame is where an answer goes, so the cue is the frame as a
 * whole, never a box. On subitize the frame is where the flash will appear and
 * its boxes are not published. A placement or flip handed over is received;
 * a spoken answer is waited on while Pip keeps the child's last box in view.
 */
export function tenFramePipPose(state: TenFramePipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds,
    cueId: 'frame',
    attendId: state.subitize ? undefined : state.lastTouchedId,
    handover: state.gesture,
  });
}
