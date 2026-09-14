import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface CountingPipState extends PipPhaseGate {
  perceptual: boolean;
  giving: boolean;
  visibleIds: string[];
  lastTouchedId?: string;
}

/** A phase never advances because Pip moved. Never single out objects during
 * subitizing (or a rearranged conservation board); the shared gate keeps Pip from
 * pointing at a new board over the previous item's audio tail.
 */
export function countingBoardPipPose(state: CountingPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds,
    cueId: state.perceptual ? undefined : state.visibleIds[0],
    attendId: state.perceptual ? undefined : state.lastTouchedId,
    handover: state.giving,
  });
}
