import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { LetterSoundMode } from '../primitives/visual-primitives/literacy/letterSoundLinkScript';

export interface LetterSoundLinkPipState extends PipPhaseGate {
  mode: LetterSoundMode;
  /** Rendered targets: `letter` (the big letter card), `options` and
   *  `option-<i>` (hear-see letter buttons). */
  visibleIds: string[];
  /** The letter button the child tapped on this attempt (hear-see). */
  lastTouchedId?: string;
}

/** See-hear and keyword match print one letter as the question and take a
 * spoken answer, so Pip points at that letter card — never a keyword picture,
 * which could be the answer. Hear-see gives a sound and every letter button is
 * an answer choice, so Pip outlines the buttons only as a group and watches the
 * one the child taps (a single committed choice, not a handover).
 */
export function letterSoundLinkPipPose(state: LetterSoundLinkPipState): PipPose {
  const tap = state.mode === 'hear-see';
  const cueId = tap ? 'options' : 'letter';
  const attendId = tap ? state.lastTouchedId ?? cueId : cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
