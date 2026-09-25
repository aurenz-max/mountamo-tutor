import type { RuntimeSnapshot } from './contract';
import { abstainIntent, learnerIntentFlags, type LearnerIntentDecision, type LearnerIntentFlags,
  type LearnerIntentRequest, type LearnerObservation } from './learnerIntentContract';
import { OBSERVATION_TIMEOUT_MS, postObservation, sameItemScope } from './observationContract';

export type LearnerIntentClassifier = (request: LearnerIntentRequest, signal: AbortSignal) => Promise<LearnerIntentDecision>;
export const classifyLearnerIntent: LearnerIntentClassifier = postObservation('/api/lumina/observe-learner', abstainIntent);

export interface LearnerIntentReport {
  status: 'observing' | 'observed' | 'abstained' | 'stale' | 'cancelled';
  request: LearnerIntentRequest;
  decision?: LearnerIntentDecision;
  observation?: LearnerObservation;
  flags?: LearnerIntentFlags;
}

/**
 * Observes a finished LEARNER turn, before and independently of the tutor's reply.
 * DialogueObserver is post-turn and may commit an outcome; this one is pre-turn and
 * may not commit anything. It never delays the tutor: the tutor owns the clock, and a
 * result that lands after the reply informs the following turn.
 *
 * New learner words supersede an unfinished observation. A tutor reply does not,
 * because the tutor replying to the turn is the expected course of events. A result
 * is dropped when the item changed; a revision bump on the same item does not drop
 * it, since the tutor's own help action is one of the things this is meant to inform.
 */
export class LearnerObserver {
  private generation = 0;
  private abort: AbortController | null = null;
  private learner = '';
  private learnerFinished = true;
  private tutor = '';
  private tutorOpen = false;
  private turns = 0;
  private closed = false;
  constructor(private snapshot: () => RuntimeSnapshot, private classify: LearnerIntentClassifier,
    private report: (event: LearnerIntentReport) => void) {}

  /** The latest tutor turn, kept as the context the learner is answering. */
  output(text = '') {
    if (!this.tutorOpen) { this.tutor = ''; this.tutorOpen = true; }
    this.tutor += text;
  }
  /** Returns true when a learner turn with words in it just finished, observed or not. */
  learnerText(text: string, finished: boolean): boolean {
    if (this.closed) return false;
    this.tutorOpen = false;
    this.cancel();
    this.learner = this.learnerFinished ? text : this.learner + text;
    this.learnerFinished = finished;
    const s = this.snapshot(), learner = this.learner.trim();
    if (!finished || !learner) return false;
    // Every shared-workspace binding. A legacy runner owns its own judge and clock, and gets no model call here.
    if (s.status !== 'active' || !s.task || !s.instanceId || !s.task.workspace?.progression) return true;
    void this.observe({ scope: { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task.itemId },
      turnId: `learner-turn-${++this.turns}`, task: s.task.task, learner: learner.slice(-2000),
      ...(this.tutor.trim() ? { priorTutor: this.tutor.slice(-4000) } : {}) });
    return true;
  }
  close() { this.closed = true; this.cancel(); }
  private cancel() { this.generation++; this.abort?.abort(); this.abort = null; }

  private async observe(request: LearnerIntentRequest) {
    const generation = this.generation, abort = new AbortController();
    this.abort = abort;
    this.report({ status: 'observing', request });
    const timer = setTimeout(() => abort.abort(), OBSERVATION_TIMEOUT_MS);
    try {
      const decision = await this.classify(request, abort.signal);
      if (this.closed) return;
      if (generation !== this.generation || abort.signal.aborted) { this.report({ status: 'cancelled', request }); return; }
      if (!sameItemScope(this.snapshot(), request.scope)) { this.report({ status: 'stale', request, decision }); return; }
      const flags = learnerIntentFlags(decision);
      if (!flags) { this.report({ status: 'abstained', request, decision }); return; }
      this.report({ status: 'observed', request, decision, flags, observation: { kind: 'learner_intent', turnId: request.turnId,
        itemId: request.scope.itemId, ...flags, probabilities: { asksForHelp: decision.asksForHelp!,
          wantsToStop: decision.wantsToStop!, attemptsAnswer: decision.attemptsAnswer! } } });
    } catch {
      if (!this.closed) this.report(generation === this.generation
        ? { status: 'abstained', request, decision: abstainIntent(abort.signal.aborted ? 'timeout' : 'unavailable') }
        : { status: 'cancelled', request });
    } finally { clearTimeout(timer); if (generation === this.generation) this.abort = null; }
  }
}
