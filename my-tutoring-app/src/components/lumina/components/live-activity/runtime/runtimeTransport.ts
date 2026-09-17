import { parseTutorCommand, type RuntimeSnapshot } from './contract';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import { waitForVisible } from './waitForVisible';

export function runtimePacket(state: RuntimeSnapshot) {
  const { affordances, ...semantic } = state;
  return { ...semantic, choices: affordances.map((a, index) => ({ ...a,
    actionId: `${state.sessionEpoch}/${state.revision}/${index}` })) };
}

/** Used by the actual browser host AND the headless live drive (only paint is simulated there). */
export class RuntimeTransport {
  private pending = new Map<string, AbortController>();
  private releaseTurn: ((settled?: boolean) => void) | null = null;
  private turnEnded = false;
  private closed = false;
  private unsubscribe: () => void;

  constructor(private runtime: LiveLessonRuntime, private send: (message: Record<string, unknown>) => void) {
    this.unsubscribe = runtime.subscribe(() => this.publish());
  }
  publish() {
    if (!this.closed) this.send({ type: 'runtime_state', state: runtimePacket(this.runtime.getSnapshot()) });
  }
  beginTurn() {
    if (this.closed) return;
    this.runtime.speech.output();
    this.turnEnded = false;
    this.releaseTurn ??= this.runtime.holdTeachingTurn({ allowTutorActions: true });
  }
  endTurn(audioPending: boolean) {
    this.runtime.speech.end(audioPending);
    this.turnEnded = true;
    this.audioChanged(audioPending);
  }
  audioChanged(audioPending: boolean) {
    this.runtime.speech.audio(audioPending);
    if (!this.turnEnded || audioPending) return;
    const release = this.releaseTurn;
    this.releaseTurn = null;
    release?.();
  }
  async command(input: unknown) {
    const command = parseTutorCommand(input);
    if (this.closed || (command && this.pending.has(command.commandId))) return;
    const abort = new AbortController();
    if (command) this.pending.set(command.commandId, abort);
    const receipt = this.runtime.dispatch(input);
    const rendered = receipt.status === 'committed'
      ? await waitForVisible(this.runtime, receipt.state.revision, { signal: abort.signal }) : null;
    if (command) this.pending.delete(command.commandId);
    if (this.closed || abort.signal.aborted) return;
    this.send({ type: 'runtime_result', commandId: receipt.commandId,
      status: rendered?.status ?? receipt.status, reason: receipt.reason,
      state: runtimePacket(rendered?.state ?? receipt.state), elapsedMs: rendered?.elapsedMs });
    if (rendered?.status === 'visible' && receipt.commandId) this.runtime.confirmVisibleResponse(receipt.commandId);
  }
  cancel(commandId: string) { this.pending.get(commandId)?.abort(); }
  close() {
    this.closed = true;
    this.pending.forEach(abort => abort.abort());
    this.pending.clear();
    this.unsubscribe();
    const release = this.releaseTurn;
    this.releaseTurn = null;
    release?.(false);
  }
}
