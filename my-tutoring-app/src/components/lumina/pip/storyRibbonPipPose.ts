import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

export interface StoryRibbonPipState extends PipPhaseGate {
  /** Rendered targets: `ribbon` (the three picture cards) and `card-<eventId>`. */
  visibleIds: string[];
  /** The picture card the child last tapped on this item. */
  lastTouchedId?: string;
}

/** The judged answer is the child's spoken story; the ribbon is a planning aid.
 * Pip outlines the ribbon as a whole during the ask or a correction — a ring on
 * one card would suggest which moment comes first — and watches the card the
 * child last tapped to move or choose. The spoken story is not a handover, so
 * Pip waits rather than opening its hands while it is judged.
 */
export function storyRibbonPipPose(state: StoryRibbonPipState): PipPose {
  return pipPhasePose(state, {
    visibleIds: state.visibleIds, cueId: 'ribbon', attendId: state.lastTouchedId ?? 'ribbon',
  });
}
