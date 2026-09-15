import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';
import type { PictureVocabChallengeType } from '../primitives/visual-primitives/literacy/PictureVocabulary';

export interface PictureVocabularyPipState extends PipPhaseGate {
  kind: PictureVocabChallengeType;
  /** Rendered targets: `stimulus` (the picture, word pair, scale or frame card),
   *  `cards` and `card-<i>` (receptive match). */
  visibleIds: string[];
  /** The picture card the child tapped on this attempt (receptive match). */
  lastTouchedId?: string;
}

/** Receptive match is the one hands mode, and every card is an answer choice,
 * so Pip outlines the cards only as a group and watches the one the child taps
 * (a single committed choice, watched while judged, not received). Every spoken
 * mode points at its stimulus card — the picture, the base word, the scale with
 * its marked blank, or the sentence frame — never the "?" answer slot's content.
 */
export function pictureVocabularyPipPose(state: PictureVocabularyPipState): PipPose {
  const receptive = state.kind === 'receptive_match';
  const cueId = receptive ? 'cards' : 'stimulus';
  const attendId = receptive ? state.lastTouchedId ?? cueId : cueId;
  return pipPhasePose(state, { visibleIds: state.visibleIds, cueId, attendId });
}
