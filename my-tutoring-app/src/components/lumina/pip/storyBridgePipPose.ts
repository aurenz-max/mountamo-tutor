import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { StoryBridgeChallengeType } from '../primitives/visual-primitives/literacy/StoryBridge';

export interface StoryBridgePipState extends PipPhaseGate {
  mode: StoryBridgeChallengeType;
  /** The item is answered by a tap (match, setting, Venn, sequence). */
  gesture: boolean;
  /** The ringed friend sits in the first story panel, the one nearest the dock. */
  anchorFirst: boolean;
  /** Rendered targets: `stories` (both story panels), `anchor` (the ringed friend
   *  to compare), `detail` (the Venn detail), `event` (story one's event),
   *  `choice-<id>` (tappable answers). */
  visibleIds: string[];
  /** The choice the child tapped on this attempt. */
  lastTouchedId?: string;
}

/** Pip points only at what the screen already marks as the question side: the
 * ringed friend on a character match, the detail bubble on a Venn sort, story
 * one's event on a sequence match. Everything else (settings, alike, different,
 * big ideas) gets both stories as one region. It never points at a choice; on a
 * tapped item it watches the choice the child committed, without receiving it.
 *
 * The ringed friend is pointed at only when it is in the first story. When it is
 * in the second, the choices sit between it and the dock on a narrow screen, and
 * a connector would run past them, so Pip outlines both stories instead.
 */
export function storyBridgePipPose(state: StoryBridgePipState): PipPose {
  const marked = state.mode === 'match_character' ? (state.anchorFirst ? 'anchor' : undefined)
    : state.mode === 'venn_place' ? 'detail'
      : state.mode === 'sequence_two' ? 'event' : undefined;
  const cueId = marked && state.visibleIds.includes(marked) ? marked : 'stories';
  const attendId = state.gesture ? state.lastTouchedId ?? cueId : cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
