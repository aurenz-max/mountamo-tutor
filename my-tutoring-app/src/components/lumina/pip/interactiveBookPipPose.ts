import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { InteractiveBookChallengeType } from '../primitives/visual-primitives/literacy/InteractiveBook';

export interface InteractiveBookPipState extends PipPhaseGate {
  mode: InteractiveBookChallengeType;
  /** Rendered targets: `page` (the cover or page as a whole), `glow` (the word
   *  the screen makes glow on a read item), `part-<hotspotId>` (printed book parts). */
  visibleIds: string[];
  /** The printed part the child tapped on this attempt (find a feature). */
  lastTouchedId?: string;
}

/** Read the glowing word: the screen already marks the word, so Pip points at
 * it. Find a feature: every printed part (title, author, heading, caption, page
 * number) is an answer choice, so Pip outlines only the whole page and watches
 * the part the child taps — one committed tap, watched while judged, not received.
 */
export function interactiveBookPipPose(state: InteractiveBookPipState): PipPose {
  const reading = state.mode === 'read-focus-word';
  const cueId = reading && state.visibleIds.includes('glow') ? 'glow' : 'page';
  const attendId = reading ? cueId : state.lastTouchedId ?? cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
