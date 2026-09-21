/**
 * Pre-turn observation of what the LEARNER just said: did they ask for help, ask to
 * stop, offer an answer. It classifies a kind of turn and never a correct answer, so
 * the expected answer is not part of this contract and no verdict can come from it
 * (TW-3: the transcript is not a second speech judge).
 *
 * The result is advisory. It reaches the tutor as facts in the runtime packet and is
 * never awaited before the tutor replies; a late result informs the following turn.
 */
import { boundedText as text, probability, validItemScope, type ItemScope, type ObservationAssessment } from './observationContract';

export interface LearnerIntentRequest {
  scope: ItemScope;
  turnId: string;
  task: string;
  learner: string;
  /** What the learner was responding to. Context only. */
  priorTutor?: string;
}
export interface LearnerIntentDecision {
  /** P(yes) per question, null when the observation abstained. */
  asksForHelp: number | null;
  wantsToStop: number | null;
  attemptsAnswer: number | null;
  accepted: boolean;
  reason: string;
  ms: number;
  model?: string;
  assessment?: ObservationAssessment;
}
/** Code holds the policy; the model only reports probabilities. */
export const LEARNER_INTENT_YES = 0.8;
export const LEARNER_INTENT_NO = 0.2;
export interface LearnerIntentFlags {
  helpRequested: boolean;
  stopRequested: boolean;
  /** Null between the two thresholds: an unclear turn is reported as unclear. */
  attemptedAnswer: boolean | null;
}
export interface LearnerObservation extends LearnerIntentFlags {
  kind: 'learner_intent';
  turnId: string;
  itemId: string;
  probabilities: { asksForHelp: number; wantsToStop: number; attemptsAnswer: number };
}
/** Rechecked at the client boundary: a malformed or foreign response yields no flags, never false ones. */
export function learnerIntentFlags(d: LearnerIntentDecision): LearnerIntentFlags | null {
  if (d?.accepted !== true || !probability(d.asksForHelp) || !probability(d.wantsToStop) || !probability(d.attemptsAnswer)) return null;
  return { helpRequested: d.asksForHelp >= LEARNER_INTENT_YES, stopRequested: d.wantsToStop >= LEARNER_INTENT_YES,
    attemptedAnswer: d.attemptsAnswer >= LEARNER_INTENT_YES ? true : d.attemptsAnswer <= LEARNER_INTENT_NO ? false : null };
}
export function validLearnerIntentRequest(v: any): v is LearnerIntentRequest {
  return !!v && validItemScope(v.scope)
    && text(v.turnId, 200) && !!v.turnId && text(v.task, 1500) && text(v.learner, 2000) && !!v.learner.trim()
    && (v.priorTutor === undefined || text(v.priorTutor, 4000));
}
export const abstainIntent = (reason: string, ms = 0): LearnerIntentDecision => ({
  asksForHelp: null, wantsToStop: null, attemptsAnswer: null, accepted: false, reason, ms,
});
