import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

/** DiShapes runs `useJudgedSpeechLoop` directly and keeps its own phase word. */
export type DiShapesPhase = 'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done';

export interface DiShapesPipInput {
  running: boolean;
  preparing: boolean;
  phase: DiShapesPhase;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The utterance began on the shape now drawn (`useSpeechScope`). */
  speechOnShape: boolean;
  /** Rendered targets: `shape`, the drawn shape or object, absent during the
   *  reward beat and while the stall card replaces the stage. */
  visibleIds: string[];
}

/** The stage draws one unnamed shape and every answer is spoken, and the ask
 * always says "this shape", so Pip points at the whole drawing during a model,
 * test or correction and watches it while the answer is judged — never at one
 * side or corner of a counting item. The reward beat (`affirmed`) is the
 * confirmed result. Speech that started on the previous shape — praise still
 * playing when an early answer or the beat's ceiling moves the stage — is not a cue.
 */
export function diShapesPipPose(input: DiShapesPipInput): PipPose {
  const gate: PipPhaseGate = {
    running: input.running,
    preparing: input.preparing,
    currentSolved: input.phase === 'affirmed',
    revealHeld: false,
    judging: input.phase === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: !input.tutorSpeaking || input.speechOnShape,
  };
  return pipPhasePose(gate, { visibleIds: input.visibleIds, cueId: 'shape', attendId: 'shape' });
}
