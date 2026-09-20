import { TutorSpeechClock } from './TutorSpeechClock';
import { TeachingTrace } from './TeachingTrace';
import {
  actionKey, attentionRefusal, parseTutorCommand, spokenLine, supportLabel, validateSupportArtifact, SUPPORT_PURPOSE,
  type Affordance, type AssistanceEvent, type ExecutableAffordance, type MoveOptions, type RuntimeMount,
  type RuntimeSnapshot, type TeachingOwner, type TransitionReceipt, type TutorAction, type TutorCommand,
} from './contract';
import {
  buildMoveArtifact, moveCarrier, movePayloadRefusal, representationRefusal, IN_PLACE_DELTAS,
  type ComposedMove, type MoveDelta,
} from './moveContract';

function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (v: unknown) => {
    if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  };
  freeze(copy);
  return copy;
}

/** Pending speech is conversational context, not a mutation of the teaching surface.
 * DialogueObserver cancels on new words and verdict commits also check responseId.
 * Keeping this out of action scope lets an audio tool selected just before the
 * provider's final transcript operate on the same scene, without retargeting it.
 */
function actionScopeTask(task: RuntimeSnapshot['task']) {
  if (task?.workspace?.progression !== 'observer') return task;
  const { pendingResponse: _pending, ...workspace } = task.workspace;
  return { ...task, workspace };
}

function sameActionScope(a: RuntimeSnapshot, b: RuntimeSnapshot) {
  return JSON.stringify(actionScopeTask(a.task)) === JSON.stringify(actionScopeTask(b.task))
    && JSON.stringify(a.affordances.filter(o => o.controller !== 'observer'))
      === JSON.stringify(b.affordances.filter(o => o.controller !== 'observer'));
}

/**
 * Session-local authority. No generation, transport, scoring or learning writes.
 * Adapters mutate synchronously; asynchronous preparation must finish BEFORE
 * dispatch and retain the original command scope (never retarget a late result).
 */
export class LiveLessonRuntime {
  readonly speech = new TutorSpeechClock();
  readonly trace = new TeachingTrace();
  private mount: RuntimeMount | null = null;
  private registration: symbol | null = null;
  private revision = 0;
  private visibleRevision: number | null = null;
  private owner: TeachingOwner = 'none';
  private savedOwner: TeachingOwner = 'tutor';
  private status: RuntimeSnapshot['status'] = 'empty';
  private support: RuntimeSnapshot['supportArtifact'] = null;
  /** The targets an attention move is ringing. Scoped to one item, like the aid it is. */
  private marked: { itemKey: string; targetIds: string[] } | null = null;
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

  private images = new Map<string, string>();

  constructor(readonly sessionEpoch: string, private policy: { maxSupportLevel: number; allowAnswerExposure: boolean;
    allowSupportArtifacts: boolean; allowGeneratedSupport?: boolean } = { maxSupportLevel: 3, allowAnswerExposure: false, allowSupportArtifacts: false }) {
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
    // An empty workspace has no owner to release. The tutor's request_activity call, and any
    // greeting before it, sit inside an open turn; that turn must not block the first mount.
    if (this.status !== 'empty' && !this.snapshot.canStartNext) throw new Error('The current owner has not released the activity');
    const artifacts = mount.adapter.supportArtifacts ?? [];
    artifacts.forEach(validateSupportArtifact);
    if (new Set(artifacts.map(a => a.id)).size !== artifacts.length) throw new Error('Duplicate support artifact IDs');
    const token = Symbol(mount.instanceId);
    this.mount = mount;
    this.registration = token;
    this.owner = 'tutor';
    this.status = 'active';
    this.support = null; this.marked = null;
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
        this.publish(!(options.ifDifferent && sameActionScope(next, this.snapshot)));
        return true;
      },
      dispose: () => {
        if (this.registration !== token) return;
        this.mount = null;
        this.registration = null;
        this.support = null; this.marked = null;
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
  /**
   * What the support panel prints for an event, or nothing.
   *
   * A fade (`direction: -1`) withdraws an aid, so it announces nothing and the panel
   * clears — the panel shows what is on screen now, never a log of what has been.
   */
  private announcement(action: TutorAction, instruction: string, delta?: MoveDelta):
  { announce?: AssistanceEvent['announce'] } {
    if (action.type === 'scaffold' && action.direction === -1) return {};
    const label = supportLabel(action, delta);
    return label && instruction ? { announce: { label, instruction } } : {};
  }

  stop() {
    if (this.status === 'stopped') return;
    const wasSupport = this.status === 'support';
    this.status = 'stopped';
    try { if (!wasSupport) this.mount?.adapter.suspension?.suspend(); }
    finally { this.speech.clear(); this.responseWaiters.clear(); this.status = 'stopped'; this.owner = 'none'; this.support = null; this.marked = null; this.publish(); }
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
    const signature = JSON.stringify([command.instanceId, command.itemId, command.expectedRevision, command.action]);
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
        validateSupportArtifact(artifact);
        this.mount!.adapter.suspension!.suspend();
        this.savedOwner = this.owner;
        this.support = immutable(artifact);
        this.detours.add(this.itemKey());
        this.owner = 'support';
        this.status = 'support';
      } else if (command.action.type === 'return') {
        this.mount!.adapter.suspension!.resume();
        this.support = null; this.marked = null; this.images.clear();
        this.owner = this.savedOwner;
        this.status = 'active';
      } else {
        const applied = (offer as ExecutableAffordance).execute(command.action.type === 'workspace' ? command.action.input : undefined);
        if (applied === false) {
          this.publish();
          return receipt('blocked', 'Adapter refused the transition; use refreshed affordances');
        }
        if (applied !== true) throw new Error('Adapter did not acknowledge a synchronous commit');
      }
      if (offer.assistance) this.assistance.push({ instanceId: command.instanceId, itemId: command.itemId,
        revision: this.revision + 1, action: command.action, ...offer.assistance,
        ...this.announcement(command.action, spokenLine(offer)) });
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

  /** The bytes of the picture now showing. Kept out of the snapshot, which is a bounded wire packet. */
  getSupportImage = (artifactId: string) => this.images.get(artifactId) ?? null;

  /**
   * Why this teaching move may not be made now, or null. Asked BEFORE a slow draw is paid for,
   * and again when it lands, because drawing takes seconds and the child keeps working.
   *
   * The refusals are subject-agnostic on purpose: they are what lets a lesson of five to ten
   * primitives offer visual help with no per-primitive preparation. The one that answers the
   * 2026-09-18 failure is non-redundancy, which no amount of prompt wording had enforced.
   */
  composeMoveRefusal(scope: { instanceId: string; itemId: string }, move: ComposedMove): string | null {
    if (!this.policy.allowSupportArtifacts) return 'Teaching moves are not enabled';
    if (move.delta === 'illustrate' && !this.policy.allowGeneratedSupport) return 'Generated pictures are not enabled';
    if (!this.mount || scope.instanceId !== this.mount.instanceId
        || scope.itemId !== this.mount.adapter.getTutorState().itemId) return 'The task changed; use the refreshed state';
    if (this.status !== 'active') return `Activity is ${this.status}`;
    const blocked = this.blockedReason();
    if (blocked) return blocked;
    const options = this.moveOptions();
    if (!options) return 'This activity does not accept composed moves; use an advertised choice or words';
    if (!options.deltas.includes(move.delta)) return `A ${move.delta} move is not available here. Choose one of: ${options.deltas.join(', ')}`;
    const known = [options.representation, ...options.alternateRepresentations];
    if (!known.includes(move.representation)) return `Unknown representation. This activity offers: ${known.join(', ')}`;
    const redundant = representationRefusal(move, options.representation, options.alternateRepresentations);
    if (redundant) return redundant;
    const payload = movePayloadRefusal(move);
    if (payload) return payload;
    // After the payload check, so a missing `targets` reads as missing rather than unknown.
    // The advertised set is already filtered; this is the guarantee behind it, and it is the
    // one place the answer-disclosure invariant is enforced for every family.
    if (move.delta === 'attend') {
      const refusal = attentionRefusal(move.targets!, this.mount.adapter.attentionTargets?.() ?? [],
        this.mount.adapter.getTutorState().assessment);
      const offered = options.attentionTargets.map(t => `${t.id} (${t.label})`).join(', ') || 'none on this item';
      if (refusal?.code === 'ANSWER_REVEAL')
        return `ANSWER_REVEAL: \`${refusal.targetId}\` is a ${refusal.dimension}, which is exactly what this item `
          + `asks the child to supply. Attend to something else, or use another move. Available here: ${offered}`;
      if (refusal) return `UNKNOWN_TARGET: \`${refusal.targetId}\` is not part of this activity. Available here: ${offered}`;
    }
    if (!IN_PLACE_DELTAS.includes(move.delta)) {
      if (!this.mount.adapter.suspension) return 'This activity cannot pause for a detour; use an in-place move or words';
      if (this.detours.has(this.itemKey())) return 'This item already had its one detour';
    }
    if (this.mount.adapter.drawsTask!(move.values))
      return 'Those numbers are this task or its answer. Use different numbers; a support that draws the task teaches nothing';
    return null;
  }

  /**
   * Commits a validated move. A picture arrives already drawn and checked; every other carrier
   * is built here from the tutor's numbers, so no shape can state a relationship it does not draw.
   */
  openComposedMove(scope: { instanceId: string; itemId: string }, move: ComposedMove, imageUrl?: string): TransitionReceipt {
    const receipt = (status: TransitionReceipt['status'], reason?: string): TransitionReceipt =>
      ({ commandId: null, status, ...(reason ? { reason } : {}), state: this.snapshot });
    if (this.busy) return receipt('conflict', 'Another transition is committing');
    const refusal = this.composeMoveRefusal(scope, move);
    if (refusal) return receipt('blocked', refusal);
    const wantsImage = move.delta === 'illustrate';
    if (wantsImage && (!imageUrl || !/^data:image\/(png|jpeg|webp);base64,/.test(imageUrl) || imageUrl.length > 8_000_000))
      return receipt('invalid', 'Not a usable picture');
    if (!wantsImage && imageUrl) return receipt('invalid', 'Only a drawn picture carries an image');
    this.busy = true;
    try {
      /**
       * An `attend` never leaves the item. It builds no artifact, opens no detour, and does
       * not suspend: the child keeps working on the same screen with one part of their own
       * work ringed. So it spends NO detour — a family whose only visual move was the
       * detour could offer help once per item; ringing is not rationed that way.
       */
      if (move.delta === 'attend') {
        this.marked = { itemKey: this.itemKey(), targetIds: [...move.targets!] };
        this.assistance.push({ instanceId: scope.instanceId, itemId: scope.itemId, revision: this.revision + 1,
          action: { type: 'point', targetId: move.targets!.join(' ') }, level: 1, answerExposure: 'none',
          move: { obstacle: move.obstacle, delta: move.delta, representation: move.representation, nextAction: move.nextAction },
          ...this.announcement({ type: 'point', targetId: move.targets![0] }, move.nextAction, move.delta) });
        this.publish();
        return { ...receipt('committed'), state: this.snapshot };
      }
      const artifact = buildMoveArtifact(move, `move-${this.revision + 1}`);
      validateSupportArtifact(artifact);
      this.mount!.adapter.suspension!.suspend();
      this.savedOwner = this.owner;
      this.images.clear();
      if (wantsImage) this.images.set(artifact.id, imageUrl!);
      this.support = immutable(artifact);
      this.detours.add(this.itemKey());
      this.owner = 'support';
      this.status = 'support';
      this.assistance.push({ instanceId: scope.instanceId, itemId: scope.itemId, revision: this.revision + 1,
        action: { type: 'request_support', artifactId: artifact.id }, level: 6, answerExposure: artifact.answerExposure,
        move: { obstacle: move.obstacle, delta: move.delta, representation: move.representation, nextAction: move.nextAction },
        ...this.announcement({ type: 'request_support', artifactId: artifact.id }, move.nextAction, move.delta) });
      this.publish();
      return { ...receipt('committed'), state: this.snapshot };
    } catch {
      this.status = 'faulted'; this.owner = 'none'; this.publish();
      return receipt('failed', 'Adapter transition failed; activity requires recovery');
    } finally { this.busy = false; }
  }

  /**
   * What the tutor may compose right now. Null until an adapter declares what it draws and
   * can sweep its own answer, so a primitive opts into the open lane by publishing facts.
   */
  private moveOptions(): MoveOptions | null {
    const adapter = this.mount?.adapter;
    if (!adapter?.representation || !adapter.drawsTask || !this.policy.allowSupportArtifacts) return null;
    const alternates = [...(adapter.alternateRepresentations ?? [])].filter(r => r !== adapter.representation);
    // Only deltas whose carrier is built. `attend`, `reveal-aid` and `microstep` are their own
    // pieces (LIVE_TEACHING_MOVES M1, M2, M4) and stay unadvertised until each one lands.
    // Adapters describe affordances; policy grants actions. Everything the adapter can
    // address, minus whatever would disclose the dimension this item assesses.
    const assessment = adapter.getTutorState().assessment;
    const attentionTargets = [...(adapter.attentionTargets?.() ?? [])]
      .filter(t => !attentionRefusal([t.id], [t], assessment));
    const deltas = (['attend', 're-represent', 'contrast', 'model-process', 'illustrate'] as MoveDelta[])
      // `attend` is its own piece: it rings published work rather than drawing a carrier.
      // `reveal-aid` and `microstep` still have neither, and stay unadvertised (M2, M4).
      .filter(d => d === 'attend' ? attentionTargets.length > 0 : !!moveCarrier(d))
      .filter(d => d !== 'illustrate' || !!this.policy.allowGeneratedSupport)
      // A detour delta needs somewhere to go back to.
      .filter(d => IN_PLACE_DELTAS.includes(d) || !!adapter.suspension)
      // Advertise a delta only when SOME declared representation survives the redundancy rule,
      // so the tutor is never offered a move whose every form would be refused.
      .filter(d => d === 'attend' || [adapter.representation!, ...alternates].some(representation =>
        !representationRefusal({ obstacle: '', delta: d, representation, nextAction: '', values: [] },
          adapter.representation!, alternates)));
    return deltas.length
      ? { deltas, representation: adapter.representation, alternateRepresentations: alternates, attentionTargets }
      : null;
  }

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
        offers.push({ action: { type: 'request_support', artifactId: a.id }, description: a.title, purpose: SUPPORT_PURPOSE[a.kind],
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
      affordances: this.offers().map(({ action, description, assistance, responseSpeech, purpose, controller }) => ({ action, description,
        ...(controller ? { controller } : {}),
        ...(responseSpeech ? { responseSpeech } : {}), ...(assistance ? { assistance } : {}), ...(purpose ? { purpose } : {}) })),
      blockedReason: this.blockedReason(), canStartNext: !this.turns.size && ['empty', 'completed'].includes(this.status),
      canGenerateSupport: !!m && this.status === 'active' && !!this.policy.allowGeneratedSupport && this.policy.allowSupportArtifacts
        && !this.blockedReason() && !!m.adapter.suspension && !!m.adapter.drawsTask && !this.detours.has(this.itemKey()),
      moveOptions: this.status === 'active' && !this.blockedReason() && !this.detours.has(this.itemKey()) ? this.moveOptions() : null,
      markedTargetIds: this.marked?.itemKey === this.itemKey() ? [...this.marked.targetIds] : [],
      assistance: this.assistance });
  }
  private publish(increment = true) {
    // A speech/audio event may run between a ref-backed learner transition
    // and React's commit effect. Never publish new task semantics under an old
    // revision merely because that event itself normally leaves scope intact.
    if (!increment && this.mount && this.snapshot.instanceId === this.mount.instanceId
        && JSON.stringify(actionScopeTask(this.mount.adapter.getTutorState())) !== JSON.stringify(actionScopeTask(this.snapshot.task))) increment = true;
    if (increment) { this.revision += 1; this.visibleRevision = null; }
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach(listener => listener());
  }
}
