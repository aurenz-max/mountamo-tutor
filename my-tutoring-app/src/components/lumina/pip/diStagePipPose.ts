import type { PipPose } from './PipSurfaceStore';
import { stimulusPipPose } from './stimulusPipPose';

export interface DiStagePipState {
  /** The session has items left. */
  running: boolean;
  /** The observer credited the current item and held it on screen. */
  heldSolved: boolean;
  /** The latest committed attempt credited the PREVIOUS item and advanced; the current item
   *  has no attempt yet. */
  creditedOnAdvance: boolean;
  /** The tutor's audio is playing and belongs to this block. */
  tutorSpeaking: boolean;
  /** The tutor has begun an utterance while the current item was on screen. */
  cuedCurrentItem: boolean;
  /** The utterance now playing began on the current item. */
  speechOnItem: boolean;
  visibleIds: string[];
}

/** Every spoken DI pack on `DiTeachingStage` draws one stimulus (a letter, word, fact,
 * sentence or shape) and takes the answer aloud, so Pip points at the stimulus as a whole
 * during this item's ask or correction and watches it otherwise — never at one letter, word,
 * side or corner, which could mark the answer.
 *
 * Celebration keys on the COMMITTED attempt, never on a local phase. The observer credits and
 * advances in one commit, so the credited item is already gone when its praise plays: that
 * credit is held as the confirmed result until the tutor's first utterance on the new item.
 * Praise that began on the previous item is never a cue for the new one.
 */
export function diStagePipPose(state: DiStagePipState): PipPose {
  return stimulusPipPose({
    running: state.running, preparing: false, currentSolved: state.heldSolved,
    revealHeld: state.creditedOnAdvance && !state.cuedCurrentItem,
    judging: false, tutorSpeaking: state.tutorSpeaking,
    cueMatchesItem: !state.tutorSpeaking || state.speechOnItem, visibleIds: state.visibleIds,
  });
}
