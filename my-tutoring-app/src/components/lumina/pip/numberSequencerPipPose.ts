import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface SequencerPipState extends PipPhaseGate {
  challengeType: 'fill-missing' | 'before-after' | 'order-cards' | 'count-from' | 'spot-error' | 'decade-fill';
  /** Target id of the gap the child is asked to fill (already highlighted on the train). */
  gapId?: string;
  visibleIds: string[];
  lastTouchedId?: string;
}

/** Spot-error: any car Pip singles out could be the wrong one, so Pip stays neutral.
 * Order-cards: a pointed card would say which goes first; Pip only follows the
 * child's own placements and receives the finished train.
 * Gap modes: Pip may point at the highlighted gap — where to answer, not what.
 */
export function numberSequencerPipPose(state: SequencerPipState): PipPose {
  if (state.challengeType === 'spot-error') return pipPhasePose(state, { visibleIds: [] });
  if (state.challengeType === 'order-cards') {
    return pipPhasePose(state, { visibleIds: state.visibleIds, attendId: state.lastTouchedId, handover: true });
  }
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: state.gapId, attendId: state.gapId });
}
