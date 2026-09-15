import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface SyllableClapperPipState extends PipPhaseGate {
  /** Rendered targets: `stimulus`, the hear-it-again button. */
  visibleIds: string[];
}

/** The word is heard, never printed, and every answer (a count, a blended word,
 * what is left) is spoken. Pip points at the hear-it-again button while the
 * tutor asks and watches it while the child answers. The reveal bar appears only
 * on the held affirmation, which is when Pip celebrates; it is never a target.
 */
export function syllableClapperPipPose(state: SyllableClapperPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'stimulus', attendId: 'stimulus' });
}
