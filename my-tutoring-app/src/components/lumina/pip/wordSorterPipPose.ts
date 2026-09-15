import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface WordSorterPipState extends PipPhaseGate {
  /** Rendered targets: `word`, the stimulus card. */
  visibleIds: string[];
}

/** Every mode is answered aloud with a group name or a bank word, and every mat
 * and bank entry could be that answer. The word card is the only thing the ask
 * names ("Listen: dog"), so Pip points at it during the ask or a correction and
 * watches it while the child answers — never at a mat, its picture, or a bank word.
 */
export function wordSorterPipPose(state: WordSorterPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'word', attendId: 'word' });
}
