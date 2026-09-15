import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';

/** DiLetterSounds runs `useJudgedSpeechLoop` directly and keeps its own phase word. */
export type DiLetterSoundsPhase = 'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done';

export interface DiLetterSoundsPipInput {
  running: boolean;
  preparing: boolean;
  phase: DiLetterSoundsPhase;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the item now on the stage. */
  cueOnItem: boolean;
  /** Rendered targets: `stage`, absent while the stall card replaces it. */
  visibleIds: string[];
}

/** The answer is a sound, said aloud. The stage shows the picture with the
 * letter, or with the whole word on first-sound items. Pip points at the stage
 * as a whole — never at the word's first letter, which would mark the onset the
 * child is meant to hear. The pack opens the next item on the affirming verdict,
 * so the praise is held as the confirmed result until that item's cue is sent.
 */
export function diLetterSoundsPipPose(input: DiLetterSoundsPipInput): PipPose {
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.phase === 'affirmed' && !input.cueOnItem,
    judging: input.phase === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnItem,
  }, { visibleIds: input.visibleIds, cueId: 'stage', attendId: 'stage' });
}
