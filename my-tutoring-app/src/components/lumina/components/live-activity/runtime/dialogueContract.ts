/** Shared assignment-grounded observer contract. No primitive-specific cue protocol.
 * See docs/TEACHING_WORKSPACE.md: completion belongs to the original assignment,
 * not an intermediate tutor question. The expected answer grounds that distinction.
 */
import { boundedText as text, validItemScope, type ItemScope, type ObservationAssessment } from './observationContract';

export interface DialogueRequest {
  scope: ItemScope & { revision: number };
  task: string;
  phase: string;
  learner: string;
  tutor: string;
  /** Success condition of the whole assignment, supplied by the primitive. */
  expectedAnswer?: string;
  /** Conversational context only; never replaces the original assignment. */
  priorTutor?: string;
  lastResponse: { response: string; correct: boolean; assisted: boolean } | null;
  pendingResponse?: { id: string; text: string };
  /** This reply answers the host's request to say plainly whether the learner solved the task
   *  (`confirm_credit`). The tutor's judgment then decides the flow; the scoring pass decides the record. */
  confirming?: boolean;
  activity?: {
    responseSource: 'speech' | 'gesture' | null;
    attemptNumber: number;
    objects: Array<{ id: string; label: string; selected: boolean; group?: string }>;
    demonstration: string[];
    facts: Record<string, string | number>;
    assistance: { level: number; answerExposure: 'none' | 'partial' | 'full' };
  };
}
export interface DialogueDecision {
  verdict: 'correct' | 'incorrect' | 'none';
  transition: 'advance' | 'retry' | 'none';
  confidence: number;
  verdictConfidence?: number;
  /** Feedback-completion classified on its own, so a stall can be attributed to
   * the layer that produced it: a finished reply that recorded nothing is a
   * settled turn the runtime left open, not an unfinished tutor turn. */
  feedbackComplete?: boolean;
  /** A finished reply to a spoken answer below the verdict gate whose likeliest reading is "not
   *  credited": it resolves to a retry rather than stranding the learner (user ruling 09-24). */
  resolution?: 'not_credited' | 'confirmed_by_tutor';
  /** The reply's likeliest reading is finished feedback (below the feedback gate too). A finished reply that
   *  records nothing gets one plain-verdict request, so no answered item is left waiting in silence. */
  replyFinished?: boolean;
  grounded: number;
  accepted: boolean;
  reason: string;
  ms: number;
  model?: string;
  assessment?: ObservationAssessment;
}
export function validDialogueRequest(v: any): v is DialogueRequest {
  return !!v && validItemScope(v.scope)
    && Number.isInteger(v.scope.revision) && v.scope.revision >= 0
    && text(v.task, 1500) && text(v.phase, 40) && text(v.learner, 2000) && text(v.tutor, 4000) && !!v.tutor.trim()
    && (v.expectedAnswer === undefined || text(v.expectedAnswer, 1500))
    && (v.priorTutor === undefined || text(v.priorTutor, 4000))
    && (v.confirming === undefined || typeof v.confirming === 'boolean')
    && (v.pendingResponse === undefined || !!v.pendingResponse && text(v.pendingResponse.id, 200)
      && !!v.pendingResponse.id && text(v.pendingResponse.text, 2000))
    && (v.activity === undefined || !!v.activity
      && ['speech', 'gesture', null].includes(v.activity.responseSource)
      && Number.isInteger(v.activity.attemptNumber) && v.activity.attemptNumber >= 0
      && Array.isArray(v.activity.objects) && v.activity.objects.length <= 100
      && v.activity.objects.every((o: any) => !!o && text(o.id, 200) && text(o.label, 200)
        && typeof o.selected === 'boolean' && (o.group === undefined || text(o.group, 200)))
      && Array.isArray(v.activity.demonstration) && v.activity.demonstration.length <= 100
      && v.activity.demonstration.every((id: any) => text(id, 200))
      && !!v.activity.facts && typeof v.activity.facts === 'object' && !Array.isArray(v.activity.facts)
      && Object.entries(v.activity.facts).length <= 40
      && Object.entries(v.activity.facts).every(([k, val]) => text(k, 200)
        && (text(val, 500) || typeof val === 'number' && Number.isFinite(val)))
      && !!v.activity.assistance && Number.isFinite(v.activity.assistance.level)
      && ['none', 'partial', 'full'].includes(v.activity.assistance.answerExposure))
    && (v.lastResponse === null || !!v.lastResponse && text(v.lastResponse.response, 1000)
      && typeof v.lastResponse.correct === 'boolean' && typeof v.lastResponse.assisted === 'boolean');
}
export const abstain = (reason: string, ms = 0): DialogueDecision => ({
  verdict: 'none', transition: 'none', confidence: 0, grounded: 0, accepted: false, reason, ms,
});
