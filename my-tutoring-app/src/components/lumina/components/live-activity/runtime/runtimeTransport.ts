import { DialogueObserver, classifyDialogue, type DialogueClassifier } from './DialogueObserver';
import { LearnerObserver, classifyLearnerIntent, type LearnerIntentClassifier } from './LearnerObserver';
import { helpBeforeLastWrong, leverTrigger, type LeverEvent } from './observerLever';
import { LEARNER_FACTS_NOTE, type LearnerSignals } from './learnerSignals';
import type { LearnerObservation } from './learnerIntentContract';
import { itemScopeKey } from './observationContract';
import { parseTutorCommand, type RuntimeSnapshot } from './contract';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import type { ComposedMove } from './moveContract';
import type { Demonstration } from '../demo/demoContract';

/**
 * What the tutor sends with `request_demonstration`: a trigger and an optional note. The
 * diagnosis comes from the primitive's own evidence (`demo/demonstrationEvidence.ts`).
 */
export interface DemonstrationNeed { note?: string }

/** The author's answer: a demonstration to show, or a refusal; either way what the evidence shows. */
export type ComposedDemonstration = { demonstration: Demonstration; diagnosis: string } | { refused: string; diagnosis?: string };
import { waitForVisible } from './waitForVisible';

/** Why the observer pulled a lever, as the tutor is told it. */
export const LEVER_CAUSES = {
  stuck: 'The learner said they were stuck',
  second_wrong: 'The learner answered this item wrong a second time',
  wrong_with_help: 'The learner answered wrong with the help already on screen',
} as const;
export type LeverCause = keyof typeof LEVER_CAUSES;

/** What the tutor is told after the observer pulls a lever. Exported so tutor replay sends the same words. */
export function leverPulledMessage(lever: { id: string; kind: string; does: string }, cause: LeverCause = 'stuck'): string {
  return `${LEVER_CAUSES[cause]}, so the host pulled ${lever.id} `
    + `(${lever.kind}). It is on screen now: ${lever.does} First point the learner to it: say what is now drawn and where to look, `
    + 'as a change to the picture; never call it a lever or a tool. '
    + (lever.kind === 'simplify' ? 'Then let them try the easier item on screen.' : 'Then let them try the same question again; do not work it through for them.');
}

/**
 * `learner` rides beside the snapshot, never inside it: elapsed seconds differ on every
 * read, and a value that changes by the clock must not look like a scene change.
 */
export function runtimePacket(state: RuntimeSnapshot,
    learner?: { about: string; signals: LearnerSignals | null; observations: readonly LearnerObservation[] }) {
  const { affordances, ...semantic } = state;
  return { ...semantic, choices: affordances.filter(a => a.controller !== 'observer').map((a, index) => ({ ...a,
    actionId: `${state.sessionEpoch}/${state.revision}/${index}` })), ...(learner ? { learner } : {}) };
}

/** How long a held host message waits for a tutor reply to begin before it is sent anyway. */
export const AFTER_TURN_FALLBACK_MS = 3000;

/** Used by the actual browser host AND the headless live drive (only paint is simulated there). */
export class RuntimeTransport {
  private pending = new Map<string, AbortController>();
  private releaseTurn: ((settled?: boolean) => void) | null = null;
  private turnEnded = false;
  /** A host message held until the tutor's current reply settles, so it opens the next turn (LB-8). */
  private afterTurn: { itemId: string; content: string } | null = null;
  private afterTurnFallback: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private unsubscribe: () => void;
  /** Wrong attempts already answered by the ladder (`<item>#<attempt>`), so a republish never pulls twice. */
  private seenWrong = new Set<string>();

  readonly dialogue: DialogueObserver;
  readonly learnerObserver: LearnerObserver;

  constructor(private runtime: LiveLessonRuntime, private send: (message: Record<string, unknown>) => void, classify: DialogueClassifier = classifyDialogue,
      classifyLearner: LearnerIntentClassifier = classifyLearnerIntent) {
    this.learnerObserver = new LearnerObserver(runtime.getSnapshot, classifyLearner, report => {
      runtime.trace.record({ stage: 'learner_intent', status: report.status, reason: report.decision?.reason,
        input: report.request, result: report.decision ? { ...report.decision, flags: report.flags } : undefined });
      // Only a newly raised request is worth a packet of its own. Everything else rides the next publish.
      if (report.status === 'observed' && runtime.learner.intent(itemScopeKey(report.request.scope), report.observation!, report.flags!))
        this.publish();
      if (report.status === 'observed' && report.flags!.helpRequested) void this.pullLever('help');
    });
    this.dialogue = new DialogueObserver(runtime.getSnapshot, classify, command => this.dispatch(command, true), message => {
      if (message.type === 'dialogue_observation') runtime.trace.record({ stage: 'dialogue', status: String(message.status),
        reason: String(message.reason), input: message.input, result: message });
      send(message);
    });
    this.unsubscribe = runtime.subscribe(() => { this.publish(); this.dialogue.stateChanged(); this.wrongCommitted(); });
  }
  /** The packet the tutor receives. Every shared-workspace binding carries learner facts; nothing is wired per primitive. */
  private packet(state: RuntimeSnapshot = this.runtime.getSnapshot()) {
    return runtimePacket(state, state.task?.workspace?.progression
      ? { about: LEARNER_FACTS_NOTE, signals: this.runtime.learner.read(state), observations: this.runtime.learner.observations() } : undefined);
  }
  publish() {
    if (!this.closed) this.send({ type: 'runtime_state', state: this.packet() });
  }
  /** One entry for learner words: the outcome observer's context, and the advisory learner-turn observation. */
  learnerText(text: string, finished: boolean) {
    if (this.closed) return;
    this.dialogue.learnerText(text, finished);
    if (this.learnerObserver.learnerText(text, finished)) this.runtime.learner.learnerFinished();
  }
  /** The host sent the tutor a message it wrote itself. A new exchange begins; nobody spoke. */
  hostText() {
    if (!this.closed) this.dialogue.hostTurn();
  }
  beginTurn(text = '') {
    if (this.closed) return;
    this.dialogue.output(text);
    this.learnerObserver.output(text);
    this.runtime.speech.output();
    this.turnEnded = false;
    this.releaseTurn ??= this.runtime.holdTeachingTurn({ allowTutorActions: true });
    // The reply the held message was waiting for has begun; it goes out when that reply settles.
    if (this.afterTurnFallback) { clearTimeout(this.afterTurnFallback); this.afterTurnFallback = null; }
  }
  endTurn(audioPending: boolean) {
    this.runtime.speech.end(audioPending);
    this.turnEnded = true;
    this.audioChanged(audioPending);
    this.dialogue.end(audioPending);
  }
  audioChanged(audioPending: boolean) {
    this.runtime.speech.audio(audioPending);
    if (!this.turnEnded || audioPending) return;
    const release = this.releaseTurn;
    this.releaseTurn = null;
    // Once per held turn: audio-idle events repeat after a turn has already settled. Counted
    // before the release, whose publish then carries the settled turn.
    if (release) this.runtime.learner.tutorSettled();
    release?.();
    this.dialogue.audio(audioPending);
    if (release) this.sendAfterTurn();
  }
  private sendAfterTurn() {
    if (this.afterTurnFallback) { clearTimeout(this.afterTurnFallback); this.afterTurnFallback = null; }
    const held = this.afterTurn;
    this.afterTurn = null;
    if (held && !this.closed && this.runtime.getSnapshot().task?.itemId === held.itemId)
      this.send({ type: 'text', scripted: false, content: held.content });
  }
  async command(input: unknown): Promise<void> { await this.dispatch(input); }
  /** Explicit learner recovery uses the same scoped capability and visible receipt. */
  async learnerProgress(type: 'advance' | 'retry') {
    const s = this.runtime.getSnapshot();
    if (this.closed || !s.instanceId || !s.task || !s.affordances.some(a => a.controller === 'observer' && a.action.type === type)) return;
    this.dialogue.learnerStart();
    const status = await this.dispatch({ sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task.itemId,
      expectedRevision: s.revision, commandId: `learner:${crypto.randomUUID()}`, action: { type } }, true);
    if (status !== 'visible' || this.closed) return;
    const next = this.runtime.getSnapshot();
    if (next.status === 'active' && next.task?.phase === 'working') this.send({ type: 'text', scripted: false,
      content: type === 'advance' ? 'The learner opened the next task. Introduce the visible task naturally.'
        : 'The learner chose to try this task again. Invite their new attempt.' });
  }
  /**
   * A newly committed wrong attempt on a session item is a rung of the ladder (`leverTrigger`): the second
   * one pulls help, one after help pulls simplify. Once per attempt; a republish of the same attempt is not
   * a new one. After the notification, never inside it: the pull is a dispatch of its own.
   */
  private wrongCommitted() {
    const s = this.runtime.getSnapshot(), task = s.task, last = task?.workspace?.attempts.at(-1);
    if (this.closed || !task || !last || last.correct || last.practice || last.itemId !== task.itemId) return;
    const key = `${task.itemId}#${task.evidence.attemptNumber}`;
    if (this.seenWrong.has(key)) return;
    this.seenWrong.add(key);
    queueMicrotask(() => { void this.pullLever('wrong'); });
  }
  /**
   * The observer pulls the lever the ladder names (`leverTrigger`) when the learner says they are stuck or
   * commits a wrong answer. The tutor is told what changed once it is on screen, as facts.
   *
   * The pull is immediate; the message is not. With audio the tutor is usually already answering
   * "I'm stuck" when the pull lands (lever bench LB-8: cue 29.1s, reply 29.8s), and a message sent
   * into that reply goes unanswered. Or the reply has not begun yet, and the message cuts it off
   * (ten-frame: pull 30.05s, reply cut to "Let's add one counter"). Learner words always get a reply,
   * so the message waits for it to settle and opens the next turn. If no reply begins within
   * AFTER_TURN_FALLBACK_MS, the message goes out anyway: a silent tutor must not strand it.
   */
  private async pullLever(event: LeverEvent) {
    const s = this.runtime.getSnapshot(), lever = leverTrigger(s, event);
    if (this.closed || !lever || !s.instanceId || !s.task) return;
    const declared = s.task.workspace!.levers!.find(l => l.id === lever)!;
    const cause: LeverCause = event === 'help' ? 'stuck'
      : helpBeforeLastWrong(s.task.workspace!, s.task.itemId) ? 'wrong_with_help' : 'second_wrong';
    const status = await this.dispatch({ sessionEpoch: s.sessionEpoch, instanceId: s.instanceId, itemId: s.task.itemId,
      expectedRevision: s.revision, commandId: `observer:${crypto.randomUUID()}`,
      action: { type: 'workspace', operation: 'pull_lever', input: { lever } } }, true);
    this.runtime.trace.record({ stage: 'observer_lever', status: status ?? 'dropped', reason: `${LEVER_CAUSES[cause]}; pulled ${lever}`,
      input: { itemId: s.task.itemId, lever } });
    if (status !== 'visible' || this.closed) return;
    const itemId = this.runtime.getSnapshot().task?.itemId ?? s.task.itemId;
    this.afterTurn = { itemId, content: leverPulledMessage(declared, cause) };
    if (!this.releaseTurn) this.afterTurnFallback = setTimeout(() => this.sendAfterTurn(), AFTER_TURN_FALLBACK_MS);
  }
  private async dispatch(input: unknown, observed = false): Promise<string | undefined> {
    const command = parseTutorCommand(input);
    if (this.closed || (command && this.pending.has(command.commandId))) return;
    const abort = new AbortController();
    if (command) this.pending.set(command.commandId, abort);
    const receipt = this.runtime.dispatch(input);
    const rendered = receipt.status === 'committed'
      ? await waitForVisible(this.runtime, receipt.state.revision, { signal: abort.signal }) : null;
    if (command) this.pending.delete(command.commandId);
    if (this.closed || abort.signal.aborted) return;
    if (!observed) this.send({ type: 'runtime_result', commandId: receipt.commandId,
      status: rendered?.status ?? receipt.status, reason: receipt.reason,
      state: this.packet(rendered?.state ?? receipt.state), elapsedMs: rendered?.elapsedMs });
    if (rendered?.status === 'visible' && receipt.commandId) {
      this.runtime.confirmVisibleResponse(receipt.commandId);
    }
    return rendered?.status ?? receipt.status;
  }
  /**
   * The tutor composed a teaching move. Refuse before paying for any slow work, draw only
   * what needs drawing, then commit only if the task is still the one the tutor was looking at.
   *
   * Every carrier but `illustrate` is built from the tutor's own numbers and commits at once,
   * which is the point: a composed shape is under a second, so the expensive move stays rare.
   */
  async composeMove(commandId: string, scope: { instanceId: string; itemId: string }, move: ComposedMove,
      draw: (move: ComposedMove, signal: AbortSignal) => Promise<{ imageUrl: string } | { refused: string }>) {
    if (this.closed || this.pending.has(commandId)) return null;
    const abort = new AbortController();
    this.pending.set(commandId, abort);
    const reply = (status: string, reason?: string, extra: Record<string, unknown> = {}) => {
      this.pending.delete(commandId);
      if (!this.closed && !abort.signal.aborted) this.send({ type: 'runtime_result', commandId, status, reason,
        state: this.packet(), ...extra });
      return { status, reason };
    };
    const refusal = this.runtime.composeMoveRefusal(scope, move);
    if (refusal) return reply('blocked', refusal);
    let imageUrl: string | undefined;
    if (move.delta === 'illustrate') {
      let drawn: Awaited<ReturnType<typeof draw>>;
      try { drawn = await draw(move, abort.signal); }
      catch { return reply('failed', 'The picture could not be drawn. Use a composed shape or words.'); }
      if (abort.signal.aborted) return null;
      if ('refused' in drawn) return reply('failed', drawn.refused);
      imageUrl = drawn.imageUrl;
    }
    const receipt = this.runtime.openComposedMove(scope, move, imageUrl);
    if (receipt.status !== 'committed') return reply(receipt.status, receipt.reason);
    const rendered = await waitForVisible(this.runtime, receipt.state.revision, { signal: abort.signal });
    return reply(rendered.status, undefined, { elapsedMs: rendered.elapsedMs });
  }
  /**
   * The tutor asked for a demonstration of the step the child is missing (LA-15). Refuse
   * before paying for authoring, author off the main thread, then commit only if the task is
   * still the one the tutor was looking at. `none` from the author is a refusal, not a fault:
   * no piece draws this obstacle, so the tutor teaches in words.
   */
  async requestDemonstration(commandId: string, scope: { instanceId: string; itemId: string }, need: DemonstrationNeed,
      compose: (need: DemonstrationNeed, signal: AbortSignal) => Promise<ComposedDemonstration>) {
    if (this.closed || this.pending.has(commandId)) return null;
    const abort = new AbortController();
    this.pending.set(commandId, abort);
    const reply = (status: string, reason?: string, extra: Record<string, unknown> = {}) => {
      this.pending.delete(commandId);
      if (!this.closed && !abort.signal.aborted) this.send({ type: 'runtime_result', commandId, status, reason,
        state: this.packet(), ...extra });
      return { status, reason };
    };
    const refusal = this.runtime.demonstrationRefusal(scope);
    if (refusal) return reply('blocked', refusal);
    let composed: Awaited<ReturnType<typeof compose>>;
    try { composed = await compose(need, abort.signal); }
    catch { return abort.signal.aborted ? null : reply('failed', 'The demonstration could not be prepared. Teach this step in words.'); }
    if (abort.signal.aborted) return null;
    this.runtime.trace.record({ stage: 'demonstration', status: 'refused' in composed ? 'none' : 'drawn',
      reason: composed.diagnosis, input: need, result: 'refused' in composed ? composed.refused : composed.demonstration.title });
    if ('refused' in composed) return reply('unsupported', composed.diagnosis
      ? `${composed.refused} What the learner's answers show: ${composed.diagnosis}` : composed.refused);
    const receipt = this.runtime.openDemonstration(scope, composed.demonstration, composed.diagnosis);
    if (receipt.status !== 'committed') return reply(receipt.status, receipt.reason);
    const rendered = await waitForVisible(this.runtime, receipt.state.revision, { signal: abort.signal });
    return reply(rendered.status, undefined, { elapsedMs: rendered.elapsedMs });
  }
  cancel(commandId: string) { this.pending.get(commandId)?.abort(); }
  close() {
    this.closed = true;
    if (this.afterTurnFallback) clearTimeout(this.afterTurnFallback);
    this.dialogue.close();
    this.learnerObserver.close();
    this.pending.forEach(abort => abort.abort());
    this.pending.clear();
    this.unsubscribe();
    const release = this.releaseTurn;
    this.releaseTurn = null;
    release?.(false);
  }
}
