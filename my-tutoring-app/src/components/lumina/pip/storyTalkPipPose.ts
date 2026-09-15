import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface StoryTalkPipState extends PipPhaseGate {
  /** Rendered targets: `card`, the listening card. */
  visibleIds: string[];
}

/** A listening task: the story is heard, never printed, and every answer is one
 * spoken word. Pip points at the listening card while the tutor reads and asks,
 * and watches it while the child answers. Nothing on screen could be the answer
 * before the affirm, so there is nothing else to single out.
 */
export function storyTalkPipPose(state: StoryTalkPipState): PipPose {
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId: 'card', attendId: 'card' });
}
