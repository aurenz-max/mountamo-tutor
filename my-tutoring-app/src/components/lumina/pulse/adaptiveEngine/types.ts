import type { HydratedPracticeItem, PracticeItemResult, ComponentId } from '../../types';
import type { GradeLevel } from '../../components/GradeLevelSelector';

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export type AdaptivePhase =
  | 'setup'         // choosing topic/grade
  | 'loading'       // first manifest batch generating
  | 'practicing'    // student working on an item
  | 'transitioning' // interstitial (switch-rep, worked example, celebration)
  | 'extending'     // "keep going?" prompt
  | 'summary'       // end-of-session
  | 'error';

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

export type DecisionAction =
  | 'continue'
  | 'switch-representation'
  | 'insert-example'
  | 'early-exit'
  | 'extend-offer'
  | 'end-session';

export interface SessionDecision {
  action: DecisionAction;
  reason: string;
  timestamp: number;
  inputScores: number[];
  /** Primitives to exclude when switching representation */
  excludePrimitives?: string[];
  /** New scaffolding mode after adaptation */
  newTargetMode?: number;
  /** Topic for worked example generation */
  exampleTopic?: string;
}

// ---------------------------------------------------------------------------
// Per-item result (local, no backend)
// ---------------------------------------------------------------------------

export interface AdaptiveItemResult {
  instanceId: string;
  topic: string;
  score: number;                // 0-100
  success: boolean;
  durationMs: number;
  primitiveId: string | null;   // componentId of the visual primitive used
  scaffoldingMode: number;      // 1-6
  isWorkedExample: boolean;     // true = teaching moment, not scored
  manifestBatchIndex: number;   // which batch this came from (proxy for "different skills")
  /** The raw PracticeItemResult from PracticeManifestRenderer */
  rawResult: PracticeItemResult;
}

// ---------------------------------------------------------------------------
// Transition types
// ---------------------------------------------------------------------------

export type TransitionType = 'switch' | 'example' | 'celebration';

// ---------------------------------------------------------------------------
// Session state (owned by useAdaptiveSession)
// ---------------------------------------------------------------------------

export interface AdaptiveSessionState {
  phase: AdaptivePhase;
  topic: string;
  gradeLevel: GradeLevel;
  subject: string;

  // Item pipeline
  currentItem: HydratedPracticeItem | null;
  prefetchedItems: HydratedPracticeItem[];
  itemIndex: number;

  // Results & decisions
  results: AdaptiveItemResult[];
  decisions: SessionDecision[];

  // Adaptive state
  currentScaffoldingMode: number;
  workedExamplesInserted: number;
  manifestBatchIndex: number;

  // Transition
  transitionType: TransitionType | null;
  pendingDecision: SessionDecision | null;

  // Streaming
  isHydrating: boolean;
  streamingMessage: string;

  // Timing
  sessionStartedAt: number | null;

  // Error
  error: string | null;
}

// ---------------------------------------------------------------------------
// Manifest call context (what we pass to each streaming call)
// ---------------------------------------------------------------------------

export interface ManifestCallContext {
  topic: string;
  gradeLevel: string;
  count: number;
  targetMode: number;
  sessionHistory: Array<{ componentId: string; difficulty: string; score?: number }>;
  enforceDiversity: boolean;
}

// ---------------------------------------------------------------------------
// Debug panel types
// ---------------------------------------------------------------------------

export interface ManifestLatencyEntry {
  batchIndex: number;
  startedAt: number;
  completedAt: number;
  latencyMs: number;
  itemCount: number;
  trigger: 'initial' | 'prefetch' | 'switch' | 'example' | 'extension';
}
