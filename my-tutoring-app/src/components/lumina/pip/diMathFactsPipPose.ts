import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

/** DiMathFacts runs `useJudgedSpeechLoop` directly and keeps its own phase word. */
export type DiMathFactsPhase = 'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done';

export interface DiMathFactsPipInput {
  running: boolean;
  preparing: boolean;
  phase: DiMathFactsPhase;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The utterance began on the fact now printed (`useSpeechScope`). */
  speechOnFact: boolean;
  /** Rendered targets: `problem`, absent while the stall card replaces the stage. */
  visibleIds: string[];
}

/** Maps the pack's own phases onto the shared gate. The printed problem is the
 * stimulus, never the answer (the sum appears only on the reward beat), so Pip
 * points at it during a model, test or correction and watches it while the
 * spoken answer is judged. The reward beat (`affirmed`) is the confirmed
 * result. Speech that started on the previous fact — praise still playing when
 * a child's early answer or the beat's ceiling moves the stage — is not a cue.
 */
export function diMathFactsPipPose(input: DiMathFactsPipInput): PipPose {
  const gate: PipPhaseGate = {
    running: input.running,
    preparing: input.preparing,
    currentSolved: input.phase === 'affirmed',
    revealHeld: false,
    judging: input.phase === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: !input.tutorSpeaking || input.speechOnFact,
  };
  return pipPhasePose(gate, { visibleIds: input.visibleIds, cueId: 'problem', attendId: 'problem' });
}
