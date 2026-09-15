import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface SpatialScenePipState extends PipPhaseGate {
  /** Rendered targets: `scene` (the grid or the perspective scene), and `touched`
   *  while the child's last touch on this challenge is still on screen. */
  visibleIds: string[];
  hasTouch: boolean;
}

/** The answer is always a relation: a position word to choose or say, or a cell
 * to tap. Every cell and every word button could be that answer, and the target
 * cell is the relation's anchor, so Pip points only at the scene as a whole and
 * otherwise watches what the child touched. Checking is synchronous (the spoken
 * scene is judged inside its own beat), so there is no handover to receive.
 */
export function spatialScenePipPose(state: SpatialScenePipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: 'scene', attendId: state.hasTouch ? 'touched' : 'scene',
  });
}
