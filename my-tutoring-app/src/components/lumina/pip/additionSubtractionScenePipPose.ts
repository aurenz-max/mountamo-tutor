import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface AddSubScenePipState extends PipPhaseGate {
  kind: 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
  /** The answer is the scene or number sentence the child built, handed over. */
  gesture: boolean;
  /** Rendered targets: `scene`, `tray` (build-equation), `object-<slot>` for each object in the picture. */
  visibleIds: string[];
  lastTouchedId?: string;
}

/** The cue is where the child works: the picture, or the empty equation tray on
 * build-equation. Never a single object, since which objects make the answer is
 * what the child has to work out, and never a tile. A touched object that was
 * sent away leaves Pip watching the picture it left.
 */
export function additionSubtractionScenePipPose(state: AddSubScenePipState): PipPose {
  const { visibleIds, lastTouchedId } = state;
  const cueId = state.kind === 'build-equation' && visibleIds.includes('tray') ? 'tray' : 'scene';
  const attendId = lastTouchedId && !visibleIds.includes(lastTouchedId) && lastTouchedId.startsWith('object-')
    ? 'scene' : lastTouchedId;
  return pipPhasePose(state, { visibleIds, cueId, attendId, handover: state.gesture });
}
