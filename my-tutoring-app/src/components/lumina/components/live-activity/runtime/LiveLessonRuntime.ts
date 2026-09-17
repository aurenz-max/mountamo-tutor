import { TutorSpeechClock } from './TutorSpeechClock';
import {
  actionKey, parseTutorCommand, validateCounterSupport,
  type Affordance, type AssistanceEvent, type ExecutableAffordance, type RuntimeMount,
  type RuntimeSnapshot, type TeachingOwner, type TransitionReceipt, type TutorCommand,
} from './contract';

function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (v: unknown) => {
    if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  };
  freeze(copy);
  return copy;
}

/**
 * Session-local authority. No generation, transport, scoring or learning writes.
 * Adapters mutate synchronously; asynchronous preparation must finish BEFORE
 * dispatch and retain the original command scope (never retarget a late result).
 */
export class LiveLessonRuntime {
  readonly speech = new TutorSpeechClock();
  private mount: RuntimeMount | null = null;
  private registration: symbol | null = null;
  private revision = 0;
  private visibleRevision: number | null = null;
  private owner: TeachingOwner = 'none';
  private savedOwner: TeachingOwner = 'tutor';
  private status: RuntimeSnapshot['status'] = 'empty';
  private support: RuntimeSnapshot['supportArtifact'] = null;
  private assistance: AssistanceEvent[] = [];
  private detours = new Set<string>();
  private commands = new Map<string, string>();
  private turns = new Map<symbol, boolean>();
  private listeners = new Set<() => void>();
  private completionListeners = new Set<(state: RuntimeSnapshot) => void>();
  private busy = false;
  private dispatchingCommandId: string | null = null;
  private responseWaiters = new Map<string, Set<() => void>>();
  private snapshot: RuntimeSnapshot;

  constructor(readonly sessionEpoch: string, private policy = { maxSupportLevel: 3, allowAnswerExposure: false, allowSupportArtifacts: false }) {
    if (!sessionEpoch.trim()) throw new Error('A session epoch is required');
    this.snapshot = this.buildSnapshot();
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onCompletion = (listener: (state: RuntimeSnapshot) => void) => {
    this.completionListeners.add(listener);
    return () => { this.completionListeners.delete(listener); };
  };

  /** A returning runner must not speak before its visible tool receipt is sent. */
  afterVisibleResponse(callback: () => void) {
    const id = this.dispatchingCommandId;
    if (!id) throw new Error('A response handoff requires a dispatched command');
    const waiters = this.responseWaiters.get(id) ?? new Set<() => void>();
    waiters.add(callback); this.responseWaiters.set(id, waiters);
    return () => { waiters.delete(callback); if (!waiters.size) this.responseWaiters.delete(id); };
  }
  confirmVisibleResponse(commandId: string) {
    const waiters = this.responseWaiters.get(commandId); this.responseWaiters.delete(commandId);
    waiters?.forEach(callback => callback());
  }

  /** One mounted adapter. Replacements require settled completion, never a catalog claim. */
  register(mount: RuntimeMount) {
    if (!this.snapshot.canStartNext) throw new Error('The current owner has not released the activity');
    const artifacts = mount.adapter.supportArtifacts ?? [];
    artifacts.forEach(validateCounterSupport);
    if (new Set(artifacts.map(a => a.id)).size !== artifacts.length) throw new Error('Duplicate support artifact IDs');
    const token = Symbol(mount.instanceId);
    this.mount = mount;
    this.registration = token;
    this.owner = 'tutor';
    this.status = 'active';
    this.support = null;
    this.publish();
    return {
      /** Call synchronously on every meaningful learner/runner transition, before late callbacks can run. */
      changed: (options: { ifDifferent?: boolean } = {}) => {
        if (this.registration !== token || this.busy || this.status !== 'active') return false;
        // React may acknowledge a command whose ref-backed semantic state was
        // already published by dispatch. Do not supersede that receipt merely
        // because the matching render committed.
        const next = this.buildSnapshot();
        if (options.ifDifferent && JSON.stringify(next.task) === JSON.stringify(this.snapshot.task)
            && JSON.stringify(next.affordances) === JSON.stringify(this.snapshot.affordances)) return false;
        this.publish();
        return true;
      },
      dispose: () => {
        if (this.registration !== token) return;
        this.mount = null;
        this.registration = null;
        this.support = null;
        this.owner = 'none';
        this.status = 'empty';
        this.publish();
      },
    };
  }

  /** Acquire BEFORE enqueueing speech; release only after turn-end AND audible tail (or confirmed cancellation). */
  holdTeachingTurn(options: { allowTutorActions?: boolean } = {}) {
    const token = Symbol('teaching-turn');
    this.turns.set(token, options.allowTutorActions === true);
    // A tutor's own tool call belongs to its turn. A speech-only hold gates
    // handoff/completion without invalidating the task scope used by that call.
    this.publish(!options.allowTutorActions);
    return (settled = true) => {
      if (!this.turns.delete(token)) return;
      if (!settled && this.status === 'closing') { this.status = 'active'; this.publish(); }
      else if (this.status === 'closing' && this.turns.size === 0) this.complete();
      else this.publish(!options.allowTutorActions);
    };
  }

  /** Called by host only after the prior turn settles; model commands cannot grant ownership. */
  grantOwnership(owner: 'tutor' | 'runner'): boolean {
    if (this.status !== 'active' || this.turns.size || this.busy) return false;
    this.owner = owner;
    this.publish();
    return true;
  }

  /** Adapter supplies terminal evidence; host emits the single completion event after its closing cue settles. */
  requestCompletion(): boolean {
    if (this.status !== 'active' || this.busy || !this.mount?.adapter.getTutorState().completed) return false;
    if (this.turns.size) { this.status = 'closing'; this.publish(); }
    else this.complete();
    return true;
  }

  private complete() {
    this.status = 'completed';
    this.owner = 'none';
    this.publish();
    const completed = this.snapshot;
    this.completionListeners.forEach(listener => listener(completed));
  }

  /** Learner stop remains available even while a runner owns a pending judgment. Not successful completion. */
  stop() {
    if (this.status === 'stopped') return;
    const wasSupport = this.status === 'support';
    this.status = 'stopped';
    try { if (!wasSupport) this.mount?.adapter.suspension?.suspend(); }
    finally { this.speech.clear(); this.responseWaiters.clear(); this.status = 'stopped'; this.owner = 'none'; this.support = null; this.publish(); }
  }

  /** The rendering host acknowledges only the exact revision it has actually committed to the DOM. */
  acknowledgeVisible(revision: number): boolean {
    if (revision !== this.revision || !this.mount || this.visibleRevision === revision) return false;
    this.visibleRevision = revision;
    this.publish(false);
    return true;
  }

  dispatch = (input: unknown): TransitionReceipt => {
    const command = parseTutorCommand(input);
    const receipt = (status: TransitionReceipt['status'], reason?: string): TransitionReceipt =>
      ({ commandId: command?.commandId ?? null, status, ...(reason ? { reason } : {}), state: this.snapshot });
    if (!command) return receipt('invalid', 'Malformed command or unsupported action schema');
    if (command.sessionEpoch !== this.sessionEpoch) return receipt('stale', 'Session changed');
    const signature = JSON.stringify([command.instanceId, command.itemId, command.expectedRevision, actionKey(command.action)]);
    const previous = this.commands.get(command.commandId);
    if (previous !== undefined) return receipt(previous === signature ? 'duplicate' : 'conflict', 'Command ID was already used');
    // Bound memory without evicting IDs and making an old command executable again.
    if (this.commands.size >= 4096) return receipt('blocked', 'Session command budget exhausted');
    this.commands.set(command.commandId, signature);
    if (!this.matches(command)) return receipt('stale', 'Instance, item or revision changed');
    if (this.busy) return receipt('conflict', 'Another transition is committing');
    const blocked = this.blockedReason();
    if (blocked) return receipt('blocked', blocked);
    const offer = this.offers().find(a => actionKey(a.action) === actionKey(command.action));
    if (!offer) return receipt('unsupported', 'Action is not currently executable; use refreshed affordances');
    this.busy = true;
    this.dispatchingCommandId = command.commandId;
    try {
      if (command.action.type === 'request_support') {
        const artifactId = command.action.artifactId;
        const artifact = this.mount!.adapter.supportArtifacts!.find(a => a.id === artifactId)!;
        // Revalidate at use time: the host may have replaced its prepared content.
        validateCounterSupport(artifact);
        this.mount!.adapter.suspension!.suspend();
        this.savedOwner = this.owner;
        this.support = immutable(artifact);
        this.detours.add(this.itemKey());
        this.owner = 'support';
        this.status = 'support';
      } else if (command.action.type === 'return') {
        this.mount!.adapter.suspension!.resume();
        this.support = null;
        this.owner = this.savedOwner;
        this.status = 'active';
      } else {
        const applied = (offer as ExecutableAffordance).execute();
        if (applied === false) {
          this.publish();
          return receipt('blocked', 'Adapter refused the transition; use refreshed affordances');
        }
        if (applied !== true) throw new Error('Adapter did not acknowledge a synchronous commit');
      }
      if (offer.assistance) this.assistance.push({ instanceId: command.instanceId, itemId: command.itemId,
        revision: this.revision + 1, action: command.action, ...offer.assistance });
      this.publish();
      return receipt('committed');
    } catch {
      // A throwing adapter may already have mutated. Quarantine; never certify rollback or success.
      this.status = 'faulted';
      this.owner = 'none';
      this.publish();
      return receipt('failed', 'Adapter transition failed; activity requires recovery');
    } finally { this.busy = false; this.dispatchingCommandId = null; }
  };

  private matches(c: TutorCommand) {
    return c.instanceId === this.mount?.instanceId && c.itemId === this.mount.adapter.getTutorState().itemId
      && c.expectedRevision === this.revision;
  }
  private itemKey() { return JSON.stringify([this.mount?.instanceId, this.mount?.adapter.getTutorState().itemId]); }
  private blockedReason(): string | null {
    if (!this.mount) return 'No mounted adapter';
    if (!['active', 'support'].includes(this.status)) return `Activity is ${this.status}`;
    if (Array.from(this.turns.values()).some(allowTutorActions => !allowTutorActions)) return 'Teaching turn has not settled';
    if (this.owner === 'runner' && !this.mount.adapter.canYieldForHelp?.()) return 'Runner owns the teaching turn';
    return null;
  }
  private offers(): Affordance[] {
    if (this.blockedReason()) return [];
    if (this.status === 'support') return [{ action: { type: 'return' }, description: 'Return to the same unfinished task',
      ...(this.savedOwner === 'runner' ? { responseSpeech: 'runner' as const } : {}) }];
    const offers: Affordance[] = this.mount!.adapter.getAffordances().filter(a => {
      if (typeof a.execute !== 'function') return false;
      const help = a.assistance;
      if (a.action.type === 'scaffold' && !help) return false;
      return !help || (Number.isInteger(help.level) && help.level >= 0 && help.level <= this.policy.maxSupportLevel
        && (help.answerExposure === 'none' || this.policy.allowAnswerExposure));
    });
    if (this.policy.allowSupportArtifacts && this.mount!.adapter.suspension && !this.detours.has(this.itemKey())) {
      for (const a of this.mount!.adapter.supportArtifacts ?? []) {
        if (a.answerExposure !== 'none' && !this.policy.allowAnswerExposure) continue;
        offers.push({ action: { type: 'request_support', artifactId: a.id }, description: a.title,
          assistance: { level: 6, answerExposure: a.answerExposure } });
      }
    }
    return offers;
  }
  private buildSnapshot(): RuntimeSnapshot {
    const m = this.mount;
    return immutable({ sessionEpoch: this.sessionEpoch, revision: this.revision, visibleRevision: this.visibleRevision,
      instanceId: m?.instanceId ?? null, planItemId: m?.planItemId ?? null, primitiveId: m?.primitiveId ?? null,
      objectiveId: m?.objectiveId ?? null, evalMode: m?.evalMode ?? null, owner: this.owner, status: this.status,
      task: m?.adapter.getTutorState() ?? null, supportArtifact: this.support,
      affordances: this.offers().map(({ action, description, assistance, responseSpeech }) => ({ action, description,
        ...(responseSpeech ? { responseSpeech } : {}), ...(assistance ? { assistance } : {}) })),
      blockedReason: this.blockedReason(), canStartNext: !this.turns.size && ['empty', 'completed'].includes(this.status),
      assistance: this.assistance });
  }
  private publish(increment = true) {
    // A speech/audio event may run between a ref-backed learner transition
    // and React's commit effect. Never publish new task semantics under an old
    // revision merely because that event itself normally leaves scope intact.
    if (!increment && this.mount && this.snapshot.instanceId === this.mount.instanceId
        && JSON.stringify(this.mount.adapter.getTutorState()) !== JSON.stringify(this.snapshot.task)) increment = true;
    if (increment) { this.revision += 1; this.visibleRevision = null; }
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach(listener => listener());
  }
}
