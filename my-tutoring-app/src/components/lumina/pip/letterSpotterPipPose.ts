import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { LetterSpotterMode } from '../primitives/visual-primitives/literacy/letterSpotterScript';

export interface LetterSpotterPipState extends PipPhaseGate {
  mode: LetterSpotterMode;
  /** Rendered targets: `marker` (name-it), `grid` and `cell-<n>` (find-it),
   *  `letter` and `option-<letter>` (match-it). */
  visibleIds: string[];
  /** The cell or little letter the child tapped on this attempt. */
  lastTouchedId?: string;
}

/** Every letter the child can tap is an answer choice, so Pip never singles
 * one out:
 *  - name-it: the star, which the screen already draws over the hidden letter.
 *  - find-it: the grid as a whole; a pointed cell would be the position asked for.
 *  - match-it: the big letter, the question side the ask tells the child to look
 *    at; never a little letter.
 * On find-it and match-it Pip watches the tap the child committed while it is
 * judged. One tap is a choice, not a build, so Pip does not receive it.
 */
export function letterSpotterPipPose(state: LetterSpotterPipState): PipPose {
  const cueId = state.mode === 'name-it' ? 'marker' : state.mode === 'find-it' ? 'grid' : 'letter';
  const attendId = state.mode === 'name-it' ? cueId : state.lastTouchedId ?? cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
