import type { RuntimeSnapshot, TutorCommand } from './contract';
import { abstain, type DialogueDecision, type DialogueRequest } from './dialogueContract';
import { OBSERVATION_TIMEOUT_MS, postObservation, sameItemScope, snapshotScopeKey } from './observationContract';

export type DialogueClassifier = (request: DialogueRequest, signal: AbortSignal) => Promise<DialogueDecision>;
export const classifyDialogue: DialogueClassifier = postObservation('/api/lumina/observe-dialogue', abstain);

/** Whether a tutor transcript holds any spoken word. The provider can transcribe a silent turn
 *  as markup such as `<no speech>{pause}`; judged as feedback, that turn once reopened a
 *  correctly read item. Markup is not speech, so it is not an exchange to observe. */
const hasSpokenWords = (text: string) => /[^\s!-/:-@[-`{-~]/.test(text.replace(/<[^>]*>|\{[^}]*\}/g, ''));

/** Observes tutor feedback and commits only the mounted observer capabilities. */
export class DialogueObserver {
  private generation = 0;
  private text = '';
  private priorTutor = '';
  private priorTutorScope = '';
  private learner = '';
  private learnerFinished = true;
  private scope = '';
  private ended = false;
  private consumed = false;
  private closed = false;
  private waitingForAudio = false;
  private audioPending = false;
  /** The item (scope key) the host has asked the tutor to give a plain verdict on, until a verdict records. Keyed to
   *  the item, not one utterance: the learner talking over the request must not turn the confirmation into a fresh answer. */
  private cuedItem = '';
  /** Readings in flight. New input does not cancel them; only close() does. */
  private readings = new Set<AbortController>();
  get pending() { return this.readings.size > 0; }
  constructor(private snapshot: () => RuntimeSnapshot, private classify: DialogueClassifier,
    private execute: (command: TutorCommand) => Promise<string | undefined>,
    private report: (event: Record<string, unknown>) => void,
    private acceptsMissFromWords: (responseId: string) => boolean = () => false) {}
  private key() { return snapshotScopeKey(this.snapshot()); }
  private cancel() {
    if (!this.closed && this.waitingForAudio) this.status('cancelled', 'new_input_or_interruption');
    this.generation++; this.waitingForAudio = false;
  }
  private status(status: string, reason: string) {
    const s = this.snapshot();
    this.report({ type: 'dialogue_observation', ...abstain(reason), status,
      scope: { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task?.itemId, revision: s.revision } });
  }
  learnerStart() {
    if (this.ended && hasSpokenWords(this.text)) { this.priorTutor = this.text; this.priorTutorScope = this.scope; }
    this.cancel(); this.text = ''; this.consumed = true;
  }
  learnerText(text: string, finished: boolean) {
    this.learnerStart();
    this.learner = this.learnerFinished ? text : this.learner + text;
    this.learnerFinished = finished;
  }
  /** A host-written message opens the next exchange. Its text is not learner words, and a gesture's evidence is `lastResponse`. */
  hostTurn() {
    this.learnerStart();
    this.learner = '';
    this.learnerFinished = true;
  }
  output(text = '') {
    if (this.closed) return;
    if (this.ended || this.consumed || !this.scope || this.scope !== this.key()) {
      this.cancel(); this.text = ''; this.scope = this.key(); this.consumed = false;
    }
    this.ended = false;
    this.text += text;
  }
  end(audioPending: boolean) { this.ended = true; this.audio(audioPending); }
  stateChanged() { if (this.ended && !this.consumed) this.audio(this.audioPending); }
  audio(pending: boolean) {
    this.audioPending = pending;
    if (this.closed || !this.ended || this.consumed) return;
    if (pending) {
      if (!this.waitingForAudio && this.snapshot().task?.workspace?.progression === 'observer') this.status('waiting', 'audio_playing');
      this.waitingForAudio = true;
      return;
    }
    this.waitingForAudio = false;
    const s = this.snapshot(), w = s.task?.workspace;
    if (s.status !== 'active' || this.scope !== this.key() || w?.progression !== 'observer'
        || !s.task || (!w.pendingResponse && (s.task.phase !== 'checked' || !w.lastResponse)) || !hasSpokenWords(this.text) || !this.learnerFinished) {
      if (s.task?.phase === 'checked') this.status('skipped', this.scope !== this.key() ? 'item_changed'
        : !hasSpokenWords(this.text) ? 'no_tutor_transcript' : !this.learnerFinished ? 'input_unfinished' : 'workspace_unavailable');
      return;
    }
    this.consumed = true;
    const request: DialogueRequest = { scope: { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId!,
      itemId: s.task.itemId, revision: s.revision }, task: s.task.task, phase: s.task.phase,
      learner: (w.pendingResponse?.text ?? this.learner).slice(-2000),
      ...(w.expectedAnswer !== undefined ? { expectedAnswer: w.expectedAnswer } : {}),
      ...(this.priorTutorScope === this.key() ? { priorTutor: this.priorTutor.slice(-4000) } : {}),
      ...(w.pendingResponse ? { pendingResponse: w.pendingResponse } : {}),
      // A reply after the host's plain-verdict request for this item.
      ...(w.pendingResponse && this.cuedItem === this.key() ? { confirming: true } : {}),
      tutor: this.text.slice(-4000), lastResponse: w.lastResponse,
      activity: { responseSource: s.task.evidence.recentResponses.at(-1)?.source ?? null,
        attemptNumber: s.task.evidence.attemptNumber, objects: w.objects, demonstration: w.demonstration,
        facts: s.task.demand, assistance: { level: s.task.support.level, answerExposure: s.task.support.answerExposure } } };
    // Every reading of a finished reply is durable (2026-10-17 knowledge-check): what the tutor said stays said, so
    // learner speech, a new tutor turn or a revision after it does not discard the reading. Only the item moving on,
    // or close(), does.
    void this.observe(request);
  }
  /** A barge-in stops playback; it does not unsay the words the tutor already spoke. The cut reply is
   *  judged as it stands (JEV decides whether the feedback finished), and the input that cut it, often
   *  echo or noise transcribed as "¿Qué?", does not discard that judgement. 2026-10-11 di-shapes: three
   *  affirmed answers were never credited because a barge-in landed after "That's exactly right". */
  interrupt() {
    if (!this.closed && !this.consumed && hasSpokenWords(this.text)) { this.ended = true; this.audio(false); }
    this.learnerStart(); this.ended = false;
  }
  close() { this.closed = true; this.readings.forEach(a => a.abort()); this.readings.clear(); this.interrupt(); }
  private async observe(request: DialogueRequest, retried = false) {
    const generation = this.generation, abort = new AbortController();
    let timedOut = false;
    this.readings.add(abort);
    this.report({ type: 'dialogue_observation', ...abstain('completed_exchange'), status: 'observing', scope: request.scope, input: request });
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, OBSERVATION_TIMEOUT_MS);
    try {
      const decision = await this.classify(request, abort.signal);
      if (this.closed || abort.signal.aborted) return;
      const state = this.snapshot(), itemKey = snapshotScopeKey(state);
      // Same item, still active. The revision is not compared: learner speech and re-renders move it without
      // changing what is being judged.
      const current = sameItemScope(state, request.scope) && state.status === 'active';
      let status: string | undefined = current ? 'abstained' : 'stale';
      const spoken = !!request.pendingResponse && request.activity?.facts.response === 'speech';
      // A below-gate "not credited" resolution may only ever reopen the item, never credit it.
      const notCredited = decision.resolution === 'not_credited' && decision.verdict === 'incorrect' && decision.transition === 'retry';
      // A tutor's plain confirmation, asked for by the host, may advance below the gate: the record is re-graded.
      const confirmed = decision.resolution === 'confirmed_by_tutor' && request.confirming === true
        && decision.verdict === 'correct' && decision.transition === 'advance';
      const verdictValid = notCredited || confirmed || ['correct', 'incorrect'].includes(decision.verdict) && Number.isFinite(decision.verdictConfidence)
        && decision.verdictConfidence! >= .9 && decision.verdictConfidence! <= 1;
      const transitionValid = notCredited || confirmed || ['advance', 'retry'].includes(decision.transition) && Number.isFinite(decision.confidence)
        && decision.confidence >= .9 && decision.confidence <= 1;
      const transition = transitionValid ? decision.transition : 'none';
      const action = spoken ? { type: 'workspace' as const, operation: 'apply_tutor_verdict', input: { dialogue: {
        responseId: request.pendingResponse!.id, responseText: request.pendingResponse!.text,
        verdict: decision.verdict as 'correct' | 'incorrect', transition, tutor: request.tutor,
      } } } : { type: decision.transition as 'advance' | 'retry' };
      let runtimeReason = !current ? 'Activity scope or revision changed.'
        : decision.accepted !== true ? `JEV abstained: ${decision.reason}`
        : !Number.isFinite(decision.grounded) || decision.grounded < .9 || decision.grounded > 1 ? 'Grounding below threshold or invalid.'
        : spoken && !verdictValid ? 'No confident tutor verdict on the current answer.'
        : !spoken && !transitionValid ? 'No confident executable transition selected.'
        : !spoken && decision.verdict !== 'none' && decision.verdict !== (request.lastResponse?.correct ? 'correct' : 'incorrect') ? 'Tutor verdict contradicts the activity check.'
        : transition === 'advance' && !(spoken ? decision.verdict === 'correct' : request.lastResponse?.correct) ? 'Advancement requires a correct verdict.'
        : !state.affordances.some(a => a.controller === 'observer' && (spoken
          ? a.action.type === 'workspace' && a.action.operation === 'apply_tutor_verdict'
          : a.action.type === decision.transition)) ? 'Requested action is unavailable.'
        : null;
      // Recheck verdict authority and thresholds at the client boundary.
      if (runtimeReason === null) {
        status = await this.execute({ sessionEpoch: request.scope.sessionEpoch, instanceId: request.scope.instanceId,
          itemId: request.scope.itemId, expectedRevision: state.revision,
          commandId: `dialogue:${request.scope.sessionEpoch}:${generation}:${request.scope.revision}`,
          action });
        runtimeReason = status === 'visible' ? 'Action applied and visible.' : `Action receipt: ${status ?? 'unavailable'}.`;
        if (status === 'visible' && transition === 'advance' && !this.closed) {
          // Words the learner began after a barge-in belong to the next exchange.
          if (generation === this.generation) this.learner = '';
          const next = this.snapshot();
          if (next.status === 'active' && next.task?.phase === 'working' && next.instanceId === request.scope.instanceId
              && next.task.itemId !== request.scope.itemId)
            this.report({ type: 'text', scripted: false, source: 'dialogue_progression',
              content: 'The next task is on screen.' });
        }
      }
      // RP-2 (user ruling 09-28): the reply credited nothing, so nothing above committed.
      // A wrong spoken answer is known from the learner's words: the workspace records it as not credited when the
      // lesson's mode allows it and `spoken_miss` named a miss for this very response (asked first, read-only, so
      // nothing is offered that would be refused). The tutor never has to say "not yet"; its affirmation still credits.
      if (status === 'abstained' && spoken && decision.creditsNothing === true && !this.closed
          && this.acceptsMissFromWords(request.pendingResponse!.id)) {
        const words = await this.execute({ sessionEpoch: request.scope.sessionEpoch, instanceId: request.scope.instanceId,
          itemId: request.scope.itemId, expectedRevision: this.snapshot().revision,
          commandId: `dialogue:${request.scope.sessionEpoch}:${generation}:${request.scope.revision}:words`,
          action: { type: 'workspace', operation: 'apply_tutor_verdict', input: { dialogue: {
            responseId: request.pendingResponse!.id, verdict: 'incorrect', transition: 'retry', tutor: request.tutor, fromWords: true } } } });
        if (words === 'visible') {
          status = words;
          runtimeReason = "Not credited from the learner's words: the reply credited nothing and spoken_miss named a miss.";
        }
      }
      if (status === 'visible' && this.cuedItem === itemKey) this.cuedItem = '';
      // A settled tutor turn that recorded nothing leaves the assignment open with nobody holding the
      // conversation: the tutor believes it finished, and the runtime knows it did not. USER RULING 09-24:
      // no answered item waits in silence. Once per open request on this item, ask the tutor to say plainly whether
      // the answer is right; every reply after it is read as that confirmation until a verdict records.
      // This grants no credit and prescribes no wording.
      if (current && spoken && (decision.replyFinished ?? decision.feedbackComplete) === true && status !== 'visible'
          && this.snapshot().task?.workspace?.pendingResponse && this.cuedItem !== itemKey && !this.closed) {
        this.cuedItem = itemKey;
        this.report({ type: 'text', scripted: false, source: 'dialogue_open_assignment',
          content: "liveRuntime did not record your last reply as a verdict on the learner's answer, so the current task is "
            + "still open. Tell the learner plainly, in your own words, whether they have solved the current task." });
      }
      if (!this.closed) this.report({ type: 'dialogue_observation', scope: request.scope, input: request, ...decision, status, runtimeReason });
    } catch {
      if (this.closed) return;
      this.report({ type: 'dialogue_observation', scope: request.scope, ...abstain(timedOut ? 'timeout' : 'unavailable'), status: 'abstained' });
      // The exchange is consumed, so nothing else would judge it: a timed-out reading is asked once more (2026-10-13
      // pulse check: the first reading of a session timed out on a cold route and a credited answer sat open).
      if (timedOut && !retried) void this.observe(request, true);
    }
    finally { clearTimeout(timer); this.readings.delete(abort); }
  }
}
