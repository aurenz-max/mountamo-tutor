import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface LetterWorkshopPipState extends PipPhaseGate {
  /** Rendered targets: `paper`, the writing surface. */
  visibleIds: string[];
  /** The child has put ink on this item's paper. */
  hasInk: boolean;
}

/** Trace, copy and write all put the answer in the child's own strokes, so Pip
 * points only at the writing paper as a whole — never at a start dot or an
 * arrow (the tiers withdraw them), never at the copy model, and never at the
 * model write reveals after a check. It watches the paper once the child has
 * drawn on it. The check is synchronous, so there is no handover to receive.
 */
export function letterWorkshopPipPose(state: LetterWorkshopPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: 'paper', attendId: state.hasInk ? 'paper' : undefined,
  });
}
