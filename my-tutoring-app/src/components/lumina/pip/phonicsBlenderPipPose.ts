import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';

export interface PhonicsBlenderPipInput {
  running: boolean;
  preparing: boolean;
  /** The pack's stage word. `affirmed` outlives the praise: it stays set on the next word. */
  stage: 'idle' | 'reading' | 'affirmed' | 'done';
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the word now on screen. */
  cueOnWord: boolean;
  /** Rendered targets: `letters` (the row) and `letter-<phonemeId>` (each card). */
  visibleIds: string[];
  /** The letter card the child last tapped to hear on this word. */
  lastTouchedId?: string;
}

/** The answer is the blended word, said aloud. Pip points at the letter row as
 * a whole during a model or correction — never one card, because a ring on a
 * single card draws the segmentation the hard tier takes off the screen. It
 * watches the card the child tapped to hear (the screen already lights that
 * card), otherwise the row. The next word opens on the affirming verdict, so
 * the praise is held as the confirmed result until that word's cue is sent.
 */
export function phonicsBlenderPipPose(input: PhonicsBlenderPipInput): PipPose {
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.stage === 'affirmed' && !input.cueOnWord,
    judging: false,
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnWord,
  }, { visibleIds: input.visibleIds, cueId: 'letters', attendId: input.lastTouchedId ?? 'letters' });
}
