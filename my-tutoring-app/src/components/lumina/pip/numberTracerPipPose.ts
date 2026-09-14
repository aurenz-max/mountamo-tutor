import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface TracerPipState extends PipPhaseGate {
  challengeType: 'trace' | 'copy' | 'write' | 'sequence';
  /** Rendered targets: `canvas`, plus `model` (copy with model) or `gap` (sequence). */
  visibleIds: string[];
  /** The child has put ink on the canvas for this item. */
  hasInk: boolean;
}

/** Pip shows WHERE to work — the canvas, the copy model, or the sequence gap. It
 * never traces the numeral's path (hard tier withdraws that guide) and its target
 * never carries the missing number. The drawing handed to Check is received.
 */
export function numberTracerPipPose(state: TracerPipState): PipPose {
  const cueId = state.challengeType === 'sequence' ? 'gap'
    : state.challengeType === 'copy' && state.visibleIds.includes('model') ? 'model' : 'canvas';
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId, attendId: state.hasInk ? 'canvas' : undefined, handover: true,
  });
}
