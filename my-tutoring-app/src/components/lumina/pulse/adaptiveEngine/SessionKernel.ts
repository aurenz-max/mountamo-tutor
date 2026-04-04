/**
 * SessionKernel — The adaptive session state machine, decoupled from React.
 *
 * Design principle: works like infinite scroll.
 *   - A queue of hydrated items, consumed from the front.
 *   - Prefetch keeps the queue stocked in the background.
 *   - When the student completes an item and the queue has items → advance.
 *   - When the queue is empty → show a brief loading state, and the
 *     prefetch auto-advances when it delivers. No inline generation,
 *     no concurrent hydration calls, no race conditions.
 *
 * React subscribes via useSyncExternalStore. Decision routing uses a
 * handler map (not a switch). Adding a new DecisionAction = one handler
 * method + one map entry.
 */

import {
  generatePracticeManifestAndHydrateStreaming,
  type PracticeStreamCallbacks,
} from '../../service/geminiClient-api';
import type { HydratedPracticeItem, PracticeItemResult } from '../../types';
import type { GradeLevel } from '../../components/GradeLevelSelector';
import { ADAPTIVE } from './constants';
import { decideNext, adaptScaffoldingMode } from './decisionEngine';
import type {
  AdaptivePhase,
  AdaptiveItemResult,
  SessionDecision,
  DecisionAction,
  TransitionType,
  ManifestLatencyEntry,
  ViewSlice,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DecisionHandler = (decision: SessionDecision, newMode: number) => Promise<void> | void;

interface GeneratedPrimitive {
  componentId: string;
  difficulty: string;
  topic?: string;
}

// ---------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------

export class SessionKernel {
  // -- Session identity --
  private topic = '';
  private gradeLevel: GradeLevel = 'elementary';
  private subject = '';
  private sessionStartedAt: number | null = null;

  // -- Phase --
  private phase: AdaptivePhase = 'setup';
  private transitionType: TransitionType | null = null;

  // -- Item pipeline --
  private currentItem: HydratedPracticeItem | null = null;
  private itemQueue: HydratedPracticeItem[] = [];
  private itemIndex = 0;
  private hydrationInFlight = false;
  private batchIndex = 0;

  // -- "Waiting for delivery" flag --
  // When true, the next prefetch completion auto-advances to the delivered item.
  // This is the key to the infinite-scroll pattern: instead of generating inline
  // (which races with the in-flight prefetch), we just wait for delivery.
  private waitingForDelivery = false;
  private pendingMode = 0;
  private deliveryRetries = 0;
  private deliveryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // -- Adaptive state --
  private results: AdaptiveItemResult[] = [];
  private decisions: SessionDecision[] = [];
  private scaffoldingMode: number = ADAPTIVE.INITIAL_SCAFFOLDING_MODE;
  private workedExamplesInserted = 0;
  private extensionsAccepted = 0;

  // -- Tracking --
  private generatedPrimitives: GeneratedPrimitive[] = [];
  private latencyLog: ManifestLatencyEntry[] = [];

  // -- UI ephemera --
  private loadingMessage = '';
  private error: string | null = null;

  // -- Subscriptions (useSyncExternalStore) --
  private listeners = new Set<() => void>();
  private cachedSnapshot: ViewSlice | null = null;

  // -- Decision handler map --
  private actionHandlers: Map<DecisionAction, DecisionHandler>;

  constructor() {
    this.actionHandlers = new Map<DecisionAction, DecisionHandler>([
      ['continue', (_d, mode) => this.handleContinue(mode)],
      ['switch-representation', (d, mode) => this.handleSwitch(d, mode)],
      ['insert-example', (d, mode) => this.handleExample(d, mode)],
      ['early-exit', (d) => this.handleEnd(d)],
      ['end-session', (d) => this.handleEnd(d)],
      ['extend-offer', (d) => this.handleExtendOffer(d)],
    ]);
  }

  // =========================================================================
  // useSyncExternalStore interface
  // =========================================================================

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ViewSlice => {
    if (this.cachedSnapshot) return this.cachedSnapshot;

    const snapshot: ViewSlice = {
      phase: this.phase,
      currentItem: this.currentItem,
      itemIndex: this.itemIndex,
      results: this.results,
      decisions: this.decisions,
      currentScaffoldingMode: this.scaffoldingMode,
      workedExamplesInserted: this.workedExamplesInserted,
      transitionType: this.transitionType,
      isHydrating: this.hydrationInFlight,
      streamingMessage: this.loadingMessage,
      error: this.error,
      topic: this.topic,
      subject: this.subject,
      gradeLevel: this.gradeLevel,
      sessionStartedAt: this.sessionStartedAt,
      latencyLog: this.latencyLog,
      prefetchedCount: this.itemQueue.length,
    };

    this.cachedSnapshot = snapshot;
    return snapshot;
  };

  private notify(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((listener) => listener());
  }

  // =========================================================================
  // Public actions (called by the thin React hook)
  // =========================================================================

  async start(topic: string, gradeLevel: GradeLevel, subject: string): Promise<void> {
    this.topic = topic;
    this.gradeLevel = gradeLevel;
    this.subject = subject;
    this.sessionStartedAt = Date.now();
    this.phase = 'loading';
    this.loadingMessage = 'Preparing your session...';
    this.notify();

    console.log(`[Pulse] Starting: topic="${topic}" grade="${gradeLevel}" subject="${subject}"`);

    try {
      const items = await this.hydrate(ADAPTIVE.INITIAL_BATCH_SIZE, ADAPTIVE.INITIAL_SCAFFOLDING_MODE, 'initial');
      if (items.length === 0) throw new Error('No items generated');

      this.currentItem = items[0];
      this.itemQueue = items.slice(1);
      this.phase = 'practicing';
      this.loadingMessage = '';
      this.notify();

      console.log(`[Pulse] Started with ${items.length} item(s)`);

      // Prefetch while student works on item 1
      this.prefetch(this.scaffoldingMode);
    } catch (err) {
      this.phase = 'error';
      this.error = err instanceof Error ? err.message : 'Failed to start session';
      this.loadingMessage = '';
      this.notify();
    }
  }

  async completeItem(rawResult: PracticeItemResult): Promise<void> {
    // Guard: only process if we're in practicing phase
    if (this.phase !== 'practicing') {
      console.warn(`[Pulse] completeItem called in phase "${this.phase}" — ignoring`);
      return;
    }

    const adaptiveResult: AdaptiveItemResult = {
      instanceId: rawResult.instanceId,
      topic: this.topic,
      score: rawResult.score,
      success: rawResult.success,
      durationMs: rawResult.durationMs,
      primitiveId: (rawResult.visualComponentId as string) ?? null,
      scaffoldingMode: this.scaffoldingMode,
      isWorkedExample: false,
      manifestBatchIndex: this.batchIndex,
      rawResult,
    };

    // Adapt scaffolding
    const newMode = adaptScaffoldingMode(this.scaffoldingMode, rawResult.score);
    this.scaffoldingMode = newMode;

    // Run decision engine
    const decision = decideNext(
      [...this.results, adaptiveResult],
      this.workedExamplesInserted,
      this.itemQueue.length > 0,
      this.extensionsAccepted,
    );

    console.log(
      `[Pulse] Item ${this.itemIndex + 1}: score=${rawResult.score} → ${decision.action}` +
      ` (${decision.reason}) | queue=${this.itemQueue.length} inflight=${this.hydrationInFlight}`,
    );

    // Record
    this.results = [...this.results, adaptiveResult];
    this.decisions = [...this.decisions, decision];
    this.notify();

    // Route to handler
    const handler = this.actionHandlers.get(decision.action);
    if (handler) {
      try {
        await handler(decision, newMode);
      } catch (err) {
        console.error('[Pulse] Decision handler failed:', err);
        this.phase = 'error';
        this.error = 'Something went wrong advancing the session';
        this.notify();
      }
    }
  }

  endTransition(): void {
    if (this.transitionType === 'celebration') {
      this.transitionType = null;
      this.phase = 'summary';
      this.notify();
      return;
    }

    this.transitionType = null;

    if (this.itemQueue.length > 0) {
      this.advanceFromQueue();
      this.notify();
      this.prefetch(this.scaffoldingMode);
    } else {
      // Wait for delivery (same pattern as handleContinue)
      this.waitForDelivery(this.scaffoldingMode);
    }
  }

  async acceptExtension(): Promise<void> {
    this.extensionsAccepted++;
    this.phase = 'loading';
    this.loadingMessage = 'Generating more challenges...';
    this.notify();

    try {
      const items = await this.hydrate(ADAPTIVE.INITIAL_BATCH_SIZE, this.scaffoldingMode, 'extension');
      if (items.length === 0) throw new Error('No extension items generated');

      this.currentItem = items[0];
      this.itemQueue = items.slice(1);
      this.phase = 'practicing';
      this.loadingMessage = '';
      this.notify();

      this.prefetch(this.scaffoldingMode);
    } catch (err) {
      this.phase = 'error';
      this.error = 'Failed to generate extension items';
      this.loadingMessage = '';
      this.notify();
    }
  }

  declineExtension(): void {
    this.phase = 'summary';
    this.notify();
  }

  /** Skip the current item without scoring — just advance to the next one. */
  skipItem(): void {
    if (this.phase !== 'practicing') return;

    // Check session bounds — don't skip past MAX_ITEMS
    // (itemIndex is 0-based, so itemIndex+1 is the count of items seen)
    if (this.itemIndex + 1 >= ADAPTIVE.MAX_ITEMS) {
      this.phase = 'summary';
      this.notify();
      return;
    }

    if (this.itemQueue.length > 0) {
      // advanceFromQueue already increments itemIndex
      this.advanceFromQueue();
      this.notify();
      this.prefetch(this.scaffoldingMode);
    } else {
      // Queue empty — wait for prefetch delivery
      this.itemIndex++;
      this.waitForDelivery(this.scaffoldingMode);
    }
  }

  getSessionHistory(): Array<{ componentId: string; difficulty: string; score?: number; topic?: string; status: 'done' | 'active' | 'queued' }> {
    const completed = this.results.map((r) => ({
      componentId: r.primitiveId ?? 'standard',
      difficulty: `mode-${r.scaffoldingMode}`,
      score: r.score,
      topic: r.topic,
      status: 'done' as const,
    }));

    const completedIds = new Set(completed.map((c) => c.componentId + '|' + c.difficulty));
    const currentComponentId = this.currentItem?.manifestItem?.visualPrimitive?.componentId ?? null;

    const pending = this.generatedPrimitives
      .filter((g) => !completedIds.has(g.componentId + '|' + g.difficulty))
      .map((g) => ({
        componentId: g.componentId,
        difficulty: g.difficulty,
        topic: g.topic,
        status: (g.componentId === currentComponentId && this.phase === 'practicing' ? 'active' : 'queued') as 'active' | 'queued',
      }));

    return [...completed, ...pending];
  }

  reset(): void {
    this.topic = '';
    this.gradeLevel = 'elementary';
    this.subject = '';
    this.sessionStartedAt = null;
    this.phase = 'setup';
    this.transitionType = null;
    this.currentItem = null;
    this.itemQueue = [];
    this.itemIndex = 0;
    this.hydrationInFlight = false;
    this.waitingForDelivery = false;
    this.pendingMode = 0;
    this.deliveryRetries = 0;
    this.clearDeliveryTimeout();
    this.batchIndex = 0;
    this.results = [];
    this.decisions = [];
    this.scaffoldingMode = ADAPTIVE.INITIAL_SCAFFOLDING_MODE;
    this.workedExamplesInserted = 0;
    this.extensionsAccepted = 0;
    this.generatedPrimitives = [];
    this.latencyLog = [];
    this.loadingMessage = '';
    this.error = null;
    this.notify();
  }

  // =========================================================================
  // Decision handlers
  // =========================================================================

  private handleContinue(newMode: number): void {
    if (this.itemQueue.length > 0) {
      // Happy path: queue has items, advance immediately
      this.advanceFromQueue();
      this.notify();
      this.prefetch(newMode);
    } else {
      // Queue empty — wait for the in-flight prefetch to deliver.
      // If no prefetch is running, start one. Either way, the prefetch
      // completion will auto-advance via waitingForDelivery.
      console.log('[Pulse] Queue empty — waiting for prefetch delivery');
      this.waitForDelivery(newMode);
    }
  }

  private async handleSwitch(decision: SessionDecision, newMode: number): Promise<void> {
    this.phase = 'transitioning';
    this.transitionType = 'switch';
    this.notify();

    try {
      const mode = decision.newTargetMode ?? newMode;
      const history = this.getSessionHistory();
      const excludeHistory = (decision.excludePrimitives ?? []).map((id) => ({
        componentId: id,
        difficulty: 'excluded',
        score: 0,
      }));
      const items = await this.hydrateRaw(1, mode, 'switch', [...history, ...excludeHistory]);
      this.itemQueue = [...this.itemQueue, ...items];
      this.notify();
    } catch {
      this.phase = 'error';
      this.error = 'Failed to switch representation';
      this.notify();
    }
  }

  private async handleExample(decision: SessionDecision, newMode: number): Promise<void> {
    this.phase = 'transitioning';
    this.transitionType = 'example';
    this.notify();

    try {
      const mode = decision.newTargetMode ?? Math.max(1, newMode - 1);
      const topicOverride = decision.exampleTopic ?? this.topic;
      const saved = this.topic;
      this.topic = topicOverride;
      const items = await this.hydrate(1, mode, 'example');
      this.topic = saved;
      this.itemQueue = [...this.itemQueue, ...items];
      this.workedExamplesInserted++;
      this.notify();
    } catch {
      this.phase = 'error';
      this.error = 'Failed to generate worked example';
      this.notify();
    }
  }

  private handleEnd(decision: SessionDecision): void {
    if (decision.action === 'early-exit') {
      this.phase = 'transitioning';
      this.transitionType = 'celebration';
    } else {
      this.phase = 'summary';
    }
    this.notify();
  }

  private handleExtendOffer(_decision: SessionDecision): void {
    this.phase = 'extending';
    this.notify();
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  /**
   * Signal that we need the next item but the queue is empty.
   * Shows a loading state and ensures a prefetch is running.
   * When the prefetch delivers, it will auto-advance.
   * Includes a timeout: if nothing arrives within DELIVERY_TIMEOUT_MS,
   * retry the prefetch (up to MAX_DELIVERY_RETRIES).
   */
  private waitForDelivery(targetMode: number): void {
    this.waitingForDelivery = true;
    this.pendingMode = targetMode;
    this.loadingMessage = 'Preparing next challenge...';
    this.phase = 'loading';
    this.notify();

    this.startDeliveryTimeout();

    // Ensure a prefetch is running
    if (!this.hydrationInFlight) {
      this.prefetch(targetMode);
    }
  }

  private startDeliveryTimeout(): void {
    this.clearDeliveryTimeout();
    this.deliveryTimeoutId = setTimeout(() => {
      if (!this.waitingForDelivery) return;

      if (this.deliveryRetries < ADAPTIVE.MAX_DELIVERY_RETRIES) {
        console.warn(
          `[Pulse] Delivery timeout (${ADAPTIVE.DELIVERY_TIMEOUT_MS}ms) — ` +
          `retry ${this.deliveryRetries + 1}/${ADAPTIVE.MAX_DELIVERY_RETRIES}`,
        );
        this.deliveryRetries++;
        this.hydrationInFlight = false; // force-clear so prefetch can run
        this.loadingMessage = 'Taking a bit longer than usual...';
        this.notify();
        this.prefetch(this.pendingMode);
      } else {
        console.error('[Pulse] Delivery timeout — max retries exhausted');
        this.waitingForDelivery = false;
        this.clearDeliveryTimeout();
        this.phase = 'error';
        this.error = 'Could not load the next challenge. Please try again.';
        this.notify();
      }
    }, ADAPTIVE.DELIVERY_TIMEOUT_MS);
  }

  private clearDeliveryTimeout(): void {
    if (this.deliveryTimeoutId !== null) {
      clearTimeout(this.deliveryTimeoutId);
      this.deliveryTimeoutId = null;
    }
  }

  private advanceFromQueue(): void {
    const next = this.itemQueue[0];
    if (!next) {
      this.phase = 'error';
      this.error = 'No items available';
      return;
    }
    this.itemQueue = this.itemQueue.slice(1);
    this.currentItem = next;
    this.itemIndex++;
    this.phase = 'practicing';
    this.loadingMessage = '';

    console.log(
      `[Pulse] Advanced to item ${this.itemIndex}:` +
      ` ${next.manifestItem?.visualPrimitive?.componentId ?? 'standard'}` +
      ` | remaining queue=${this.itemQueue.length}`,
    );
  }

  /**
   * Hydrate items using session history from this kernel's state.
   */
  private async hydrate(
    count: number,
    targetMode: number,
    trigger: ManifestLatencyEntry['trigger'],
  ): Promise<HydratedPracticeItem[]> {
    return this.hydrateRaw(count, targetMode, trigger, this.getSessionHistory());
  }

  /**
   * Core hydration — calls the streaming API and records tracking data.
   */
  private async hydrateRaw(
    count: number,
    targetMode: number,
    trigger: ManifestLatencyEntry['trigger'],
    sessionHistory: Array<{ componentId: string; difficulty: string; score?: number }>,
  ): Promise<HydratedPracticeItem[]> {
    const startedAt = Date.now();
    const batch = this.batchIndex;

    const callbacks: PracticeStreamCallbacks = {
      onProgress: (msg) => {
        this.loadingMessage = msg;
        this.notify();
      },
      onItemReady: (_item, index, total) => {
        this.loadingMessage = `Generating item ${index + 1} of ${total}...`;
        this.notify();
      },
    };

    const items = await generatePracticeManifestAndHydrateStreaming(
      this.topic,
      this.gradeLevel,
      count,
      callbacks,
      {
        enforceDiversity: true,
        sessionHistory,
        targetMode,
      },
    );

    // Track generated primitives for diversity
    for (const item of items) {
      const cid = item.manifestItem?.visualPrimitive?.componentId;
      const itemTopic = item.manifestItem?.visualPrimitive?.intent
        || item.manifestItem?.problemText;
      if (cid) {
        this.generatedPrimitives.push({
          componentId: cid,
          difficulty: `mode-${targetMode}`,
          topic: itemTopic,
        });
      }
    }

    this.latencyLog = [...this.latencyLog, {
      batchIndex: batch,
      startedAt,
      completedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      itemCount: items.length,
      trigger,
    }];
    this.batchIndex++;

    return items;
  }

  /**
   * Background prefetch — skips if one is already in flight.
   * When items arrive and the session is waiting, auto-advances.
   * If hydration returns 0 items while waiting, retries immediately.
   */
  private async prefetch(targetMode: number): Promise<void> {
    if (this.hydrationInFlight) {
      console.log('[Pulse] Prefetch skipped — already in flight');
      return;
    }
    this.hydrationInFlight = true;
    this.notify();

    console.log(`[Pulse] Prefetch starting (mode=${targetMode})`);

    try {
      const items = await this.hydrate(ADAPTIVE.PREFETCH_SIZE, targetMode, 'prefetch');
      this.hydrationInFlight = false;
      this.itemQueue = [...this.itemQueue, ...items];

      // Auto-advance if the session was waiting for this delivery
      if (this.waitingForDelivery && this.itemQueue.length > 0) {
        console.log('[Pulse] Prefetch delivered — auto-advancing');
        this.waitingForDelivery = false;
        this.deliveryRetries = 0;
        this.clearDeliveryTimeout();
        this.advanceFromQueue();
        this.notify();
        // Start next prefetch to keep the queue stocked
        this.prefetch(this.pendingMode);
      } else if (this.waitingForDelivery && items.length === 0) {
        // Hydration succeeded but returned 0 items (e.g. generator produced
        // malformed JSON). Retry immediately instead of deadlocking.
        if (this.deliveryRetries < ADAPTIVE.MAX_DELIVERY_RETRIES) {
          this.deliveryRetries++;
          console.warn(
            `[Pulse] Prefetch returned 0 items while waiting — ` +
            `retry ${this.deliveryRetries}/${ADAPTIVE.MAX_DELIVERY_RETRIES}`,
          );
          this.loadingMessage = 'Trying a different challenge...';
          this.notify();
          this.prefetch(targetMode);
        } else {
          console.error('[Pulse] Prefetch returned 0 items — max retries exhausted');
          this.waitingForDelivery = false;
          this.clearDeliveryTimeout();
          this.phase = 'error';
          this.error = 'Could not load the next challenge. Please try again.';
          this.notify();
        }
      } else {
        this.notify();
      }
    } catch (err) {
      console.warn('[Pulse] Prefetch failed:', err);
      this.hydrationInFlight = false;

      if (this.waitingForDelivery) {
        if (this.deliveryRetries < ADAPTIVE.MAX_DELIVERY_RETRIES) {
          this.deliveryRetries++;
          console.warn(
            `[Pulse] Prefetch error while waiting — ` +
            `retry ${this.deliveryRetries}/${ADAPTIVE.MAX_DELIVERY_RETRIES}`,
          );
          this.loadingMessage = 'Trying a different challenge...';
          this.notify();
          this.prefetch(targetMode);
        } else {
          this.waitingForDelivery = false;
          this.clearDeliveryTimeout();
          this.phase = 'error';
          this.error = 'Failed to load next challenge';
          this.notify();
        }
      } else {
        this.notify();
      }
    }
  }
}
