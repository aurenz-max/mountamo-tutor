import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface WorkspacePipState extends PipPhaseGate {
  /** Rendered targets: `workspace`, and `touched` while the child's last touch
   *  on this item is still on screen. */
  visibleIds: string[];
  /** What the child last touched on this item: nothing, the workspace itself
   *  (a canvas, a board), or one object inside it. */
  touch: 'none' | 'workspace' | 'object';
  /** The work being checked is something the child built, drew, or arranged. */
  handover?: boolean;
}

/** The shared policy for classic primitives whose interactive elements are the
 * child's answer surface. Pip points only at the workspace as a whole during
 * this item's cue or correction, so no single cell, tile, option, handle or
 * control is ever singled out. It watches what the child touches, opens its
 * hands only while built work is being checked, and celebrates only a
 * confirmed result.
 */
export function workspacePipPose(state: WorkspacePipState): PipPose {
  const attendId = state.touch === 'object' ? 'touched' : state.touch === 'workspace' ? 'workspace' : undefined;
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: 'workspace', attendId, handover: state.handover,
  });
}
