import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';

/** DiWordReading runs `useJudgedSpeechLoop` directly and keeps its own phase word. */
export type DiWordReadingPhase = 'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done';

export interface DiWordReadingPipInput {
  running: boolean;
  preparing: boolean;
  phase: DiWordReadingPhase;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the word now printed. */
  cueOnWord: boolean;
  /** Rendered targets: `word`, absent while the stall card replaces the stage. */
  visibleIds: string[];
}

/** The printed word is the stimulus: reading it is the task, and the tutor
 * models it aloud by design. Pip points at the whole word during a model, test
 * or correction and watches it while the reading is judged — never at one
 * letter, since a sight word is recalled whole and never sounded out.
 * The pack prints the next word on the affirming verdict, before the praise is
 * spoken, so the praise is held as the confirmed result until the next word's
 * cue is sent; no speech before that cue is a cue for the new word.
 */
export function diWordReadingPipPose(input: DiWordReadingPipInput): PipPose {
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.phase === 'affirmed' && !input.cueOnWord,
    judging: input.phase === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnWord,
  }, { visibleIds: input.visibleIds, cueId: 'word', attendId: 'word' });
}
