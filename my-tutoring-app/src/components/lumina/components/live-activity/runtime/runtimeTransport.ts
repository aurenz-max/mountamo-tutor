import { DialogueObserver, classifyDialogue, type DialogueClassifier } from './DialogueObserver';
import { parseTutorCommand, type RuntimeSnapshot } from './contract';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import type { ComposedMove } from './moveContract';
import { waitForVisible } from './waitForVisible';

export function runtimePacket(state: RuntimeSnapshot) {
  const { affordances, ...semantic } = state;
  return { ...semantic, choices: affordances.filter(a => a.controller !== 'observer').map((a, index) => ({ ...a,
    actionId: `${state.sessionEpoch}/${state.revision}/${index}` })) };
}

/** Used by the actual browser host AND the headless live drive (only paint is simulated there). */
export class RuntimeTransport {
  private pending = new Map<string, AbortController>();
  private releaseTurn: ((settled?: boolean) => void) | null = null;
  private turnEnded = false;
  private closed = false;
  private unsubscribe: () => void;

  readonly dialogue: DialogueObserver;

  constructor(private runtime: LiveLessonRuntime, private send: (message: Record<string, unknown>) => void, classify: DialogueClassifier = classifyDialogue) {
    this.dialogue = new DialogueObserver(runtime.getSnapshot, classify, command => this.dispatch(command, true), message => {
      if (message.type === 'dialogue_observation') runtime.trace.record({ stage: 'dialogue', status: String(message.status),
        reason: String(message.reason), input: message.input, result: message });
      send(message);
    });
    this.unsubscribe = runtime.subscribe(() => { this.publish(); this.dialogue.stateChanged(); });
  }
  publish() {
    if (!this.closed) this.send({ type: 'runtime_state', state: runtimePacket(this.runtime.getSnapshot()) });
  }
  beginTurn(text = '') {
    if (this.closed) return;
    this.dialogue.output(text);
    this.runtime.speech.output();
    this.turnEnded = false;
    this.releaseTurn ??= this.runtime.holdTeachingTurn({ allowTutorActions: true });
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
    release?.();
    this.dialogue.audio(audioPending);
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
      state: runtimePacket(rendered?.state ?? receipt.state), elapsedMs: rendered?.elapsedMs });
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
        state: runtimePacket(this.runtime.getSnapshot()), ...extra });
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
  cancel(commandId: string) { this.pending.get(commandId)?.abort(); }
  close() {
    this.closed = true;
    this.dialogue.close();
    this.pending.forEach(abort => abort.abort());
    this.pending.clear();
    this.unsubscribe();
    const release = this.releaseTurn;
    this.releaseTurn = null;
    release?.(false);
  }
}
