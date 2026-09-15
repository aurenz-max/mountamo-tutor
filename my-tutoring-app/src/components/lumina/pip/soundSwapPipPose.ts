import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';

export interface SoundSwapPipInput {
  running: boolean;
  preparing: boolean;
  /** The pack's stage word. `affirmed` outlives the praise: it stays set on the next item. */
  stage: 'idle' | 'asking' | 'affirmed' | 'done';
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the item now on screen. */
  cueOnItem: boolean;
  /** Rendered targets: `word` (the printed starting word) and `sound-<i>` (each sound tile). */
  visibleIds: string[];
  /** The sound tile the child last tapped to hear on this item. */
  lastTouchedId?: string;
}

/** The answer is the new word, said aloud, and it is never on screen. The ask
 * names the starting word ("Listen: an. Add /p/ …"), so Pip points at that
 * printed word — never at one sound tile, because on substitution a ring on a
 * tile is the sound-to-change highlight the hard tier removes. It watches the
 * tile the child tapped to hear (the screen already lights it), otherwise the
 * word. The next item opens on the affirming verdict, so the praise is held as
 * the confirmed result until that item's cue is sent.
 */
export function soundSwapPipPose(input: SoundSwapPipInput): PipPose {
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.stage === 'affirmed' && !input.cueOnItem,
    judging: false,
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnItem,
  }, { visibleIds: input.visibleIds, cueId: 'word', attendId: input.lastTouchedId ?? 'word' });
}
