import type { PipPose } from './PipSurfaceStore';

/** The activity's phase, read-only. Pip never writes any of it back. */
export interface PipPhaseGate {
  running: boolean;
  preparing: boolean;
  currentSolved: boolean;
  revealHeld: boolean;
  judging: boolean;
  tutorSpeaking: boolean;
  cueMatchesItem: boolean;
}

/** What a primitive's own policy decided Pip may attend to on this item. */
export interface PipAttention {
  visibleIds: string[];
  /** Pointed at while this item's cue or correction plays. Must name WHERE the
   *  child works, never which answer is right. Omit when no cue is legal. */
  cueId?: string;
  /** Watched while the child works and while the attempt is judged. */
  attendId?: string;
  /** The judged attempt is something the child built and handed over. */
  handover?: boolean;
}

/** Shared phase gate. Celebrates only a confirmed item, stays neutral over the
 * previous item's audio tail, and drops any target that is not currently visible.
 * Judged primitives feed it from useJudgedScriptRunner; classic ones from their
 * own check state plus useSpeechScope.
 */
export function pipPhasePose(gate: PipPhaseGate, attention: PipAttention): PipPose {
  if (gate.currentSolved || gate.revealHeld) return { phase: 'celebrating', gesture: 'none' };
  if (!gate.running) return { phase: gate.preparing ? 'introducing' : 'idle', gesture: 'none' };
  if (!gate.cueMatchesItem) return { phase: 'idle', gesture: 'none' };
  const visible = (id?: string) => (id && attention.visibleIds.includes(id) ? id : undefined);
  const attend = visible(attention.attendId);
  if (gate.judging) {
    return { phase: 'checking', gesture: attention.handover ? 'receive' : attend ? 'look' : 'none', targetId: attend };
  }
  if (gate.tutorSpeaking) {
    const cue = visible(attention.cueId);
    return { phase: 'introducing', gesture: cue ? 'point' : 'none', targetId: cue };
  }
  return { phase: 'working', gesture: attend ? 'look' : 'none', targetId: attend };
}
