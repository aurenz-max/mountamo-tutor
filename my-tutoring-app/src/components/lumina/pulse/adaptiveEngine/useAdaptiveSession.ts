'use client';

import { useCallback, useRef, useReducer } from 'react';
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
  AdaptiveSessionState,
  SessionDecision,
  TransitionType,
  ManifestLatencyEntry,
} from './types';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG = '[AdaptivePulse]';

// ---------------------------------------------------------------------------
// Reducer actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'START_SESSION'; topic: string; gradeLevel: GradeLevel; subject: string }
  | { type: 'SET_LOADING_MESSAGE'; message: string }
  | { type: 'INITIAL_ITEMS_READY'; items: HydratedPracticeItem[] }
  | { type: 'PREFETCH_READY'; items: HydratedPracticeItem[] }
  | { type: 'ITEM_COMPLETE'; result: AdaptiveItemResult; decision: SessionDecision }
  | { type: 'TRANSITION_START'; transitionType: TransitionType; decision: SessionDecision }
  | { type: 'TRANSITION_END' }
  | { type: 'ADVANCE_TO_NEXT' }
  | { type: 'ADVANCE_TO_ITEM'; item: HydratedPracticeItem; scaffoldingMode: number }
  | { type: 'SHOW_EXTEND_OFFER'; decision: SessionDecision }
  | { type: 'ACCEPT_EXTENSION' }
  | { type: 'DECLINE_EXTENSION' }
  | { type: 'END_SESSION'; decision: SessionDecision }
  | { type: 'SET_HYDRATING'; hydrating: boolean }
  | { type: 'SET_SCAFFOLDING_MODE'; mode: number }
  | { type: 'INCREMENT_BATCH_INDEX' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

function initialState(): AdaptiveSessionState {
  return {
    phase: 'setup',
    topic: '',
    gradeLevel: 'elementary',
    subject: '',
    currentItem: null,
    prefetchedItems: [],
    itemIndex: 0,
    results: [],
    decisions: [],
    currentScaffoldingMode: ADAPTIVE.INITIAL_SCAFFOLDING_MODE,
    workedExamplesInserted: 0,
    manifestBatchIndex: 0,
    transitionType: null,
    pendingDecision: null,
    isHydrating: false,
    streamingMessage: '',
    sessionStartedAt: null,
    error: null,
  };
}

function reducer(state: AdaptiveSessionState, action: Action): AdaptiveSessionState {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...initialState(),
        phase: 'loading',
        topic: action.topic,
        gradeLevel: action.gradeLevel,
        subject: action.subject,
        sessionStartedAt: Date.now(),
        isHydrating: true,
      };

    case 'SET_LOADING_MESSAGE':
      return { ...state, streamingMessage: action.message };

    case 'INITIAL_ITEMS_READY':
      return {
        ...state,
        phase: 'practicing',
        currentItem: action.items[0] ?? null,
        prefetchedItems: action.items.slice(1),
        isHydrating: false,
        streamingMessage: '',
      };

    case 'PREFETCH_READY':
      return {
        ...state,
        prefetchedItems: [...state.prefetchedItems, ...action.items],
        isHydrating: false,
      };

    case 'ITEM_COMPLETE':
      return {
        ...state,
        results: [...state.results, action.result],
        decisions: [...state.decisions, action.decision],
      };

    case 'TRANSITION_START':
      return {
        ...state,
        phase: 'transitioning',
        transitionType: action.transitionType,
        pendingDecision: action.decision,
        decisions: [...state.decisions, action.decision],
      };

    case 'TRANSITION_END':
      return {
        ...state,
        transitionType: null,
        pendingDecision: null,
      };

    case 'ADVANCE_TO_NEXT': {
      const [next, ...rest] = state.prefetchedItems;
      if (!next) {
        return { ...state, phase: 'error', error: 'No items available' };
      }
      return {
        ...state,
        phase: 'practicing',
        currentItem: next,
        prefetchedItems: rest,
        itemIndex: state.itemIndex + 1,
      };
    }

    case 'ADVANCE_TO_ITEM':
      return {
        ...state,
        phase: 'practicing',
        currentItem: action.item,
        itemIndex: state.itemIndex + 1,
        currentScaffoldingMode: action.scaffoldingMode,
      };

    case 'SHOW_EXTEND_OFFER':
      return {
        ...state,
        phase: 'extending',
        decisions: [...state.decisions, action.decision],
      };

    case 'ACCEPT_EXTENSION':
      return {
        ...state,
        phase: 'loading',
        isHydrating: true,
        streamingMessage: 'Generating more challenges...',
      };

    case 'DECLINE_EXTENSION':
      return { ...state, phase: 'summary' };

    case 'END_SESSION':
      return {
        ...state,
        phase: action.decision.action === 'early-exit' ? 'transitioning' : 'summary',
        transitionType: action.decision.action === 'early-exit' ? 'celebration' : null,
        decisions: [...state.decisions, action.decision],
      };

    case 'SET_HYDRATING':
      return { ...state, isHydrating: action.hydrating };

    case 'SET_SCAFFOLDING_MODE':
      return { ...state, currentScaffoldingMode: action.mode };

    case 'INCREMENT_BATCH_INDEX':
      return { ...state, manifestBatchIndex: state.manifestBatchIndex + 1 };

    case 'ERROR':
      return { ...state, phase: 'error', error: action.error, isHydrating: false };

    case 'RESET':
      return initialState();

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAdaptiveSessionReturn {
  // State
  phase: AdaptivePhase;
  currentItem: HydratedPracticeItem | null;
  itemIndex: number;
  results: AdaptiveItemResult[];
  decisions: SessionDecision[];
  currentScaffoldingMode: number;
  workedExamplesInserted: number;
  streamingMessage: string;
  isHydrating: boolean;
  transitionType: TransitionType | null;
  error: string | null;
  topic: string;
  subject: string;
  gradeLevel: GradeLevel;
  sessionStartedAt: number | null;
  latencyLog: ManifestLatencyEntry[];

  // Actions
  startSession: (topic: string, gradeLevel: GradeLevel, subject: string) => void;
  handleItemComplete: (result: PracticeItemResult) => void;
  handleTransitionEnd: () => void;
  acceptExtension: () => void;
  declineExtension: () => void;
  reset: () => void;
}

export function useAdaptiveSession(): UseAdaptiveSessionReturn {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const latencyLogRef = useRef<ManifestLatencyEntry[]>([]);
  // Refs for values needed inside async callbacks without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // -----------------------------------------------------------------------
  // Manifest call helper
  // -----------------------------------------------------------------------

  const hydrateItems = useCallback(
    async (
      topic: string,
      gradeLevel: string,
      count: number,
      targetMode: number,
      trigger: ManifestLatencyEntry['trigger'],
      sessionHistory: Array<{ componentId: string; difficulty: string; score?: number }>,
    ): Promise<HydratedPracticeItem[]> => {
      const startedAt = Date.now();
      const batchIndex = stateRef.current.manifestBatchIndex;

      const callbacks: PracticeStreamCallbacks = {
        onProgress: (msg) => dispatch({ type: 'SET_LOADING_MESSAGE', message: msg }),
        onItemReady: (_item, index, total) => {
          dispatch({
            type: 'SET_LOADING_MESSAGE',
            message: `Generating item ${index + 1} of ${total}...`,
          });
        },
      };

      const items = await generatePracticeManifestAndHydrateStreaming(
        topic,
        gradeLevel,
        count,
        callbacks,
        {
          enforceDiversity: true,
          sessionHistory,
          targetMode,
        },
      );

      latencyLogRef.current.push({
        batchIndex,
        startedAt,
        completedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        itemCount: items.length,
        trigger,
      });

      dispatch({ type: 'INCREMENT_BATCH_INDEX' });
      return items;
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Build session history from results
  // -----------------------------------------------------------------------

  const buildSessionHistory = useCallback(() => {
    return stateRef.current.results.map((r) => ({
      componentId: r.primitiveId ?? 'standard',
      difficulty: `mode-${r.scaffoldingMode}`,
      score: r.score,
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Prefetch next item(s) in background
  // -----------------------------------------------------------------------

  const prefetch = useCallback(
    async (topic: string, gradeLevel: string, targetMode: number) => {
      if (stateRef.current.isHydrating) return;
      dispatch({ type: 'SET_HYDRATING', hydrating: true });
      try {
        const items = await hydrateItems(
          topic,
          gradeLevel,
          ADAPTIVE.PREFETCH_SIZE,
          targetMode,
          'prefetch',
          buildSessionHistory(),
        );
        dispatch({ type: 'PREFETCH_READY', items });
      } catch (err) {
        console.warn(`${LOG} Prefetch failed (non-fatal):`, err);
        dispatch({ type: 'SET_HYDRATING', hydrating: false });
      }
    },
    [hydrateItems, buildSessionHistory],
  );

  // -----------------------------------------------------------------------
  // Start session
  // -----------------------------------------------------------------------

  const startSession = useCallback(
    async (topic: string, gradeLevel: GradeLevel, subject: string) => {
      dispatch({ type: 'START_SESSION', topic, gradeLevel, subject });
      console.log(`${LOG} Starting session: topic="${topic}" grade="${gradeLevel}" subject="${subject}"`);

      try {
        const items = await hydrateItems(
          topic,
          gradeLevel,
          ADAPTIVE.INITIAL_BATCH_SIZE,
          ADAPTIVE.INITIAL_SCAFFOLDING_MODE,
          'initial',
          [],
        );

        if (items.length === 0) {
          throw new Error('No items generated');
        }

        dispatch({ type: 'INITIAL_ITEMS_READY', items });
        console.log(`${LOG} Session started with ${items.length} items`);

        // Start prefetching next batch while student works on item 1
        prefetch(topic, gradeLevel, ADAPTIVE.INITIAL_SCAFFOLDING_MODE);
      } catch (err) {
        console.error(`${LOG} Failed to start session:`, err);
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Failed to start session',
        });
      }
    },
    [hydrateItems, prefetch],
  );

  // -----------------------------------------------------------------------
  // Handle item completion — the core adaptive loop
  // -----------------------------------------------------------------------

  const handleItemComplete = useCallback(
    async (rawResult: PracticeItemResult) => {
      const s = stateRef.current;
      const isWorkedExample = false; // TODO: track from decision context

      // Build AdaptiveItemResult
      const adaptiveResult: AdaptiveItemResult = {
        instanceId: rawResult.instanceId,
        topic: s.topic,
        score: rawResult.score,
        success: rawResult.success,
        durationMs: rawResult.durationMs,
        primitiveId: (rawResult.visualComponentId as string) ?? null,
        scaffoldingMode: s.currentScaffoldingMode,
        isWorkedExample,
        manifestBatchIndex: s.manifestBatchIndex,
        rawResult,
      };

      // Adapt scaffolding for next items
      const newMode = adaptScaffoldingMode(s.currentScaffoldingMode, rawResult.score);
      if (newMode !== s.currentScaffoldingMode) {
        dispatch({ type: 'SET_SCAFFOLDING_MODE', mode: newMode });
      }

      // Run decision engine
      const scoredCount = s.results.filter((r) => !r.isWorkedExample).length + 1;
      const hasMorePrefetched = s.prefetchedItems.length > 0;
      const decision = decideNext(
        [...s.results, adaptiveResult],
        s.workedExamplesInserted,
        hasMorePrefetched,
      );

      console.log(
        `${LOG} Item ${s.itemIndex + 1} complete: score=${rawResult.score} → decision=${decision.action} (${decision.reason})`,
      );

      // Record result + execute decision
      dispatch({ type: 'ITEM_COMPLETE', result: adaptiveResult, decision });

      switch (decision.action) {
        case 'continue': {
          if (hasMorePrefetched) {
            dispatch({ type: 'ADVANCE_TO_NEXT' });
            // Prefetch another while student works
            prefetch(s.topic, s.gradeLevel, newMode);
          } else if (s.isHydrating) {
            // Prefetch in progress — wait for it (rare edge case)
            dispatch({ type: 'SET_LOADING_MESSAGE', message: 'Preparing next challenge...' });
          } else {
            // No items and no prefetch — generate one now
            dispatch({ type: 'SET_HYDRATING', hydrating: true });
            dispatch({ type: 'SET_LOADING_MESSAGE', message: 'Preparing next challenge...' });
            try {
              const items = await hydrateItems(
                s.topic, s.gradeLevel, 1, newMode, 'prefetch', buildSessionHistory(),
              );
              dispatch({ type: 'ADVANCE_TO_ITEM', item: items[0], scaffoldingMode: newMode });
              prefetch(s.topic, s.gradeLevel, newMode);
            } catch (err) {
              dispatch({ type: 'ERROR', error: 'Failed to generate next item' });
            }
          }
          break;
        }

        case 'switch-representation': {
          dispatch({ type: 'TRANSITION_START', transitionType: 'switch', decision });
          // Generate replacement with excluded primitives during transition animation
          try {
            const mode = decision.newTargetMode ?? newMode;
            const history = buildSessionHistory();
            // Add excluded primitives as negative history entries
            const excludeHistory = (decision.excludePrimitives ?? []).map((id) => ({
              componentId: id,
              difficulty: 'excluded',
              score: 0,
            }));
            const items = await hydrateItems(
              s.topic, s.gradeLevel, 1, mode, 'switch', [...history, ...excludeHistory],
            );
            // Item will be presented when transition animation ends (via handleTransitionEnd)
            dispatch({ type: 'PREFETCH_READY', items });
          } catch (err) {
            dispatch({ type: 'ERROR', error: 'Failed to switch representation' });
          }
          break;
        }

        case 'insert-example': {
          dispatch({ type: 'TRANSITION_START', transitionType: 'example', decision });
          try {
            const mode = decision.newTargetMode ?? Math.max(1, newMode - 1);
            const items = await hydrateItems(
              decision.exampleTopic ?? s.topic, s.gradeLevel, 1, mode, 'example',
              buildSessionHistory(),
            );
            dispatch({ type: 'PREFETCH_READY', items });
          } catch (err) {
            dispatch({ type: 'ERROR', error: 'Failed to generate worked example' });
          }
          break;
        }

        case 'early-exit':
        case 'end-session': {
          dispatch({ type: 'END_SESSION', decision });
          break;
        }

        case 'extend-offer': {
          dispatch({ type: 'SHOW_EXTEND_OFFER', decision });
          break;
        }
      }
    },
    [hydrateItems, prefetch, buildSessionHistory],
  );

  // -----------------------------------------------------------------------
  // Transition end — advance to the item that was hydrated during animation
  // -----------------------------------------------------------------------

  const handleTransitionEnd = useCallback(() => {
    const s = stateRef.current;

    if (s.transitionType === 'celebration') {
      // Early-exit celebration done → go to summary
      dispatch({ type: 'TRANSITION_END' });
      dispatch({ type: 'DECLINE_EXTENSION' }); // reuse to go to summary
      return;
    }

    dispatch({ type: 'TRANSITION_END' });

    if (s.prefetchedItems.length > 0) {
      dispatch({ type: 'ADVANCE_TO_NEXT' });
      // Start prefetch for after this item
      prefetch(s.topic, s.gradeLevel, s.currentScaffoldingMode);
    } else {
      // Edge case: hydration not ready yet, show loading
      dispatch({ type: 'SET_LOADING_MESSAGE', message: 'Almost ready...' });
    }
  }, [prefetch]);

  // -----------------------------------------------------------------------
  // Extension handlers
  // -----------------------------------------------------------------------

  const acceptExtension = useCallback(async () => {
    const s = stateRef.current;
    dispatch({ type: 'ACCEPT_EXTENSION' });

    try {
      const items = await hydrateItems(
        s.topic,
        s.gradeLevel,
        ADAPTIVE.INITIAL_BATCH_SIZE,
        s.currentScaffoldingMode,
        'extension',
        buildSessionHistory(),
      );
      dispatch({ type: 'INITIAL_ITEMS_READY', items });
    } catch (err) {
      dispatch({ type: 'ERROR', error: 'Failed to generate extension items' });
    }
  }, [hydrateItems, buildSessionHistory]);

  const declineExtension = useCallback(() => {
    dispatch({ type: 'DECLINE_EXTENSION' });
  }, []);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    latencyLogRef.current = [];
    dispatch({ type: 'RESET' });
  }, []);

  return {
    phase: state.phase,
    currentItem: state.currentItem,
    itemIndex: state.itemIndex,
    results: state.results,
    decisions: state.decisions,
    currentScaffoldingMode: state.currentScaffoldingMode,
    workedExamplesInserted: state.workedExamplesInserted,
    streamingMessage: state.streamingMessage,
    isHydrating: state.isHydrating,
    transitionType: state.transitionType,
    error: state.error,
    topic: state.topic,
    subject: state.subject,
    gradeLevel: state.gradeLevel,
    sessionStartedAt: state.sessionStartedAt,
    latencyLog: latencyLogRef.current,

    startSession,
    handleItemComplete,
    handleTransitionEnd,
    acceptExtension,
    declineExtension,
    reset,
  };
}
