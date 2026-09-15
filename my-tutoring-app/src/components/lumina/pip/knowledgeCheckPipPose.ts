import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface KnowledgeCheckPipState extends PipPhaseGate {
  /** The item is answered by a tap (choice_tap, point_to). */
  gesture: boolean;
  /** Rendered targets: `question` (the question card with its stimulus) and
   *  `option-<id>` (tappable choices on choice_tap). */
  visibleIds: string[];
  /** The choice the child tapped, or `question` for a token tapped inside it. */
  lastTouchedId?: string;
}

/** Pip points only at the question card as a whole — its prompt, picture or
 * number sentence. It never singles out a choice card, a True/False card, a sort
 * group, a word-bank word, or a token of a point-to sentence, since each could be
 * the answer. On a tapped item it watches what the child touched, without
 * receiving it.
 */
export function knowledgeCheckPipPose(state: KnowledgeCheckPipState): PipPose {
  const attendId = state.gesture ? state.lastTouchedId ?? 'question' : 'question';
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'question', attendId });
}
