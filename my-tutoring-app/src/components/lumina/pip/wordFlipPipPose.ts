import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';

export interface WordFlipPipInput {
  running: boolean;
  preparing: boolean;
  /** The pack's stage word. `affirmed` outlives the praise: it stays set on the next item. */
  stage: 'idle' | 'asking' | 'affirmed' | 'done';
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the item now on screen. */
  cueOnItem: boolean;
  /** Rendered targets: `frame` (one side → many side) and `source` (the one-thing card). */
  visibleIds: string[];
  /** The source card, when the child tapped it to hear the word on this item. */
  lastTouchedId?: string;
}

/** The answer is the transformed word, said aloud, and the frame shows only a
 * blank where it goes. The ask walks the whole frame ("one dog … now there are
 * three … three what?"), so Pip outlines the frame as a whole and watches the
 * source card when the child taps it to hear the word. The next item opens on
 * the affirming verdict, so the praise is held as the confirmed result until
 * that item's cue is sent.
 */
export function wordFlipPipPose(input: WordFlipPipInput): PipPose {
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.stage === 'affirmed' && !input.cueOnItem,
    judging: false,
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnItem,
  }, { visibleIds: input.visibleIds, cueId: 'frame', attendId: input.lastTouchedId ?? 'frame' });
}
