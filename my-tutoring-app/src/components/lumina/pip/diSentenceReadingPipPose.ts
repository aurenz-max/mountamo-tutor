import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

/** DiSentenceReading runs `useJudgedSpeechLoop` directly and keeps its own phase word. */
export type DiSentenceReadingPhase = 'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done';

export interface DiSentenceReadingPipInput {
  running: boolean;
  preparing: boolean;
  phase: DiSentenceReadingPhase;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The utterance began on the sentence now printed (`useSpeechScope`). */
  speechOnSentence: boolean;
  /** Rendered targets: `sentence`, absent while the stall card replaces the stage. */
  visibleIds: string[];
}

/** Reading the printed sentence is the task, so Pip points at the whole
 * sentence during a model or correction and watches it while the read is judged
 * — never one word. The pack holds the read sentence on screen for a reward
 * beat (`affirmed`) and only then shows the next one, so the beat is the
 * confirmed result, and speech that began on the previous sentence is not a cue.
 */
export function diSentenceReadingPipPose(input: DiSentenceReadingPipInput): PipPose {
  const gate: PipPhaseGate = {
    running: input.running,
    preparing: input.preparing,
    currentSolved: input.phase === 'affirmed',
    revealHeld: false,
    judging: input.phase === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: !input.tutorSpeaking || input.speechOnSentence,
  };
  return pipPhasePose(gate, { visibleIds: input.visibleIds, cueId: 'sentence', attendId: 'sentence' });
}
