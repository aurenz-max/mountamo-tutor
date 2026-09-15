import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface StimulusPipState extends PipPhaseGate {
  /** Rendered targets: `stimulus` (the question side as a whole), optionally
   *  tappable answers the primitive registers for `look`. */
  visibleIds: string[];
  /** The answer the child tapped on this attempt, on a tapped item. */
  lastTouchedId?: string;
  /** The item is answered by a tap rather than aloud. */
  gesture?: boolean;
  /** A marked object the ask already names, pointed at instead of the whole
   *  stimulus (for example the idea card being placed). */
  cueId?: string;
  /** The tapped work is a hands answer the runner judges; Pip receives it while
   *  judging and never submits it. */
  handover?: boolean;
}

/** The shared policy for judged primitives whose question side is one stimulus
 * panel — a picture, a solid, a set of clues, a printed card — and whose answer
 * is spoken or tapped elsewhere. Pip points at the stimulus as a whole during
 * this item's cue or correction and watches it while the child answers; on a
 * tapped item it watches the committed choice, receiving it only when the
 * primitive marks the tapped work as a hands answer.
 */
export function stimulusPipPose(state: StimulusPipState): PipPose {
  const attendId = state.gesture ? state.lastTouchedId ?? 'stimulus' : 'stimulus';
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: state.cueId ?? 'stimulus', attendId, handover: state.handover,
  });
}
