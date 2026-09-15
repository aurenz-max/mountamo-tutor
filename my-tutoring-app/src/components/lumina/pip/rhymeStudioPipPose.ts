import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { RhymeMode } from '../primitives/visual-primitives/literacy/rhymeStudioScript';

export interface RhymeStudioPipState extends PipPhaseGate {
  mode: RhymeMode;
  /** Rendered targets: `pair` (recognition's two cards) or `target` (the word card). */
  visibleIds: string[];
}

/** Every mode is answered aloud. The ask names the target word ("What rhymes
 * with cat?"), so Pip points at that card; on recognition the question is the
 * pair itself, so Pip outlines both cards together. It never singles out a
 * choice card on identification or a rhyme slot on collection — each could be
 * the answer — and it watches the same card while the child answers.
 */
export function rhymeStudioPipPose(state: RhymeStudioPipState): PipPose {
  const cueId = state.mode === 'recognition' ? 'pair' : 'target';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId: cueId });
}
