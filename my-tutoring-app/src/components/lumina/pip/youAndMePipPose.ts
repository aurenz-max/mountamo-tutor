import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface YouAndMePipState extends PipPhaseGate {
  /** Rendered targets: `scene`, both partners and the scene sentence together. */
  visibleIds: string[];
}

/** The answer is a spoken sentence whose pronoun depends on who is speaking and
 * who did the action. The speaker highlight and the actor marker are scaffolds
 * the tiers withdraw, so Pip never singles out one partner: it outlines the
 * scene as a whole during the ask or a correction, and watches it while the
 * child speaks.
 */
export function youAndMePipPose(state: YouAndMePipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'scene', attendId: 'scene' });
}
