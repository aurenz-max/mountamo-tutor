'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  HydratedPracticeItem,
  PracticeItemResult,
  SessionBrief,
} from '../types';
import { generatePracticeManifestAndHydrateStreaming } from '../service/geminiClient-api';
import { pulseApi } from './pulseApi';
import type {
  PulsePhase,
  PulseItemSpec,
  PulseSessionResponse,
  PulseResultResponse,
  PulseSessionSummary,
  LeapfrogEvent,
} from './types';

import type { GradeLevel } from '../components/GradeLevelSelector';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULSE_STORAGE_KEY = 'lumina-pulse-session';

// Items to pre-generate ahead of the current item
const PREGEN_LOOKAHEAD = 2;

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

interface UsePulseSessionOptions {
  gradeLevel: GradeLevel;
}

export interface UsePulseSessionReturn {
  // State
  phase: PulsePhase;
  sessionId: string | null;
  subject: string | null;
  isColdStart: boolean;
  items: PulseItemSpec[];
  currentItemIndex: number;
  currentItem: PulseItemSpec | null;
  hydratedItem: HydratedPracticeItem | null;
  results: PulseResultResponse[];
  leapfrogs: LeapfrogEvent[];
  summary: PulseSessionSummary | null;
  error: string | null;
  streamingMessage: string;
  currentBrief: SessionBrief | null;
  progress: {
    completed: number;
    total: number;
    bandsSummary: Record<string, { total: number; completed: number; avg_score: number }>;
  };

  // Actions
  startSession: (subject: string, itemCount?: number) => Promise<void>;
  handleItemComplete: (result: PracticeItemResult) => void;
  handleNextItem: () => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

interface PulseSessionStorage {
  sessionId: string;
  subject: string;
  startedAt: string;
}

function saveToStorage(data: PulseSessionStorage) {
  try {
    localStorage.setItem(PULSE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(PULSE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePulseSession({
  gradeLevel,
}: UsePulseSessionOptions): UsePulseSessionReturn {
  // Core state
  const [phase, setPhase] = useState<PulsePhase>('ready');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [isColdStart, setIsColdStart] = useState(false);
  const [items, setItems] = useState<PulseItemSpec[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [results, setResults] = useState<PulseResultResponse[]>([]);
  const [leapfrogs, setLeapfrogs] = useState<LeapfrogEvent[]>([]);
  const [summary, setSummary] = useState<PulseSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentBrief, setCurrentBrief] = useState<SessionBrief | null>(null);

  // Progress tracking
  const [progress, setProgress] = useState<UsePulseSessionReturn['progress']>({
    completed: 0,
    total: 0,
    bandsSummary: {},
  });

  // Pending item result (from PracticeManifestRenderer, before submitting to backend)
  const pendingResult = useRef<PracticeItemResult | null>(null);

  // Pre-generation cache: item_id → hydrated items
  const hydratedCache = useRef<Map<string, HydratedPracticeItem>>(new Map());
  const briefCache = useRef<Map<string, SessionBrief>>(new Map());
  const pregenInFlight = useRef<Set<string>>(new Set());

  // Current hydrated item for rendering
  const [hydratedItem, setHydratedItem] = useState<HydratedPracticeItem | null>(null);

  // -------------------------------------------------------------------------
  // Pre-generation: hydrate item content via Gemini streaming
  // -------------------------------------------------------------------------

  const hydrateItem = useCallback(
    async (item: PulseItemSpec): Promise<HydratedPracticeItem | null> => {
      const key = item.item_id;

      // Check cache
      const cached = hydratedCache.current.get(key);
      if (cached) {
        hydratedCache.current.delete(key);
        const cachedBrief = briefCache.current.get(key);
        if (cachedBrief) {
          setCurrentBrief(cachedBrief);
          briefCache.current.delete(key);
        }
        return cached;
      }

      // Wait for in-flight pre-gen
      if (pregenInFlight.current.has(key)) {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const result = hydratedCache.current.get(key);
          if (result) {
            hydratedCache.current.delete(key);
            const cachedBrief = briefCache.current.get(key);
            if (cachedBrief) {
              setCurrentBrief(cachedBrief);
              briefCache.current.delete(key);
            }
            return result;
          }
        }
      }

      // Generate fresh — single item
      const hydratedItems = await generatePracticeManifestAndHydrateStreaming(
        item.description,
        gradeLevel,
        1,
        {
          onProgress: (msg) => setStreamingMessage(msg),
          onSessionBrief: (brief) => setCurrentBrief(brief),
        },
        { enforceDiversity: false },
      );

      if (hydratedItems.length === 0) return null;

      // Stamp curriculum IDs from the Pulse item spec
      const hydrated = hydratedItems[0];
      hydrated.curriculumIds = {
        subject: item.subject,
        skillId: item.skill_id,
        subskillId: item.subskill_id,
        source: 'curriculum',
      };

      return hydrated;
    },
    [gradeLevel],
  );

  const pregenerate = useCallback(
    (item: PulseItemSpec) => {
      const key = item.item_id;
      if (hydratedCache.current.has(key) || pregenInFlight.current.has(key)) return;
      pregenInFlight.current.add(key);

      generatePracticeManifestAndHydrateStreaming(
        item.description,
        gradeLevel,
        1,
        {
          onSessionBrief: (brief) => {
            briefCache.current.set(key, brief);
          },
        },
        { enforceDiversity: false },
      )
        .then((hydratedItems) => {
          if (hydratedItems.length > 0) {
            const hydrated = hydratedItems[0];
            hydrated.curriculumIds = {
              subject: item.subject,
              skillId: item.skill_id,
              subskillId: item.subskill_id,
              source: 'curriculum',
            };
            hydratedCache.current.set(key, hydrated);
          }
        })
        .catch((err) => {
          console.warn('[Pulse] Pre-generation failed for', key, err);
        })
        .finally(() => {
          pregenInFlight.current.delete(key);
        });
    },
    [gradeLevel],
  );

  // -------------------------------------------------------------------------
  // Load and hydrate a specific item by index
  // -------------------------------------------------------------------------

  const loadItem = useCallback(
    async (itemList: PulseItemSpec[], index: number) => {
      const item = itemList[index];
      if (!item) return;

      setPhase('loading');
      setStreamingMessage('Preparing your activity...');

      try {
        const hydrated = await hydrateItem(item);
        if (!hydrated) {
          throw new Error('Failed to generate activity content');
        }
        setHydratedItem(hydrated);
        setPhase('practicing');

        // Pre-generate upcoming items
        for (let i = 1; i <= PREGEN_LOOKAHEAD; i++) {
          const nextItem = itemList[index + i];
          if (nextItem) {
            pregenerate(nextItem);
          }
        }
      } catch (err) {
        console.error('[Pulse] Failed to hydrate item:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to prepare activity',
        );
        setPhase('error');
      } finally {
        setStreamingMessage('');
      }
    },
    [hydrateItem, pregenerate],
  );

  // -------------------------------------------------------------------------
  // Start a new Pulse session
  // -------------------------------------------------------------------------

  const startSession = useCallback(
    async (subj: string, itemCount?: number) => {
      setPhase('loading');
      setError(null);
      setStreamingMessage('Setting up your session...');

      try {
        const response: PulseSessionResponse = await pulseApi.createSession(
          subj,
          itemCount,
        );

        const {
          session_id,
          subject: sessionSubject,
          is_cold_start,
          items: sessionItems,
        } = response;

        setSessionId(session_id);
        setSubject(sessionSubject);
        setIsColdStart(is_cold_start);
        setItems(sessionItems);
        setCurrentItemIndex(0);
        setResults([]);
        setLeapfrogs([]);
        setSummary(null);
        setProgress({
          completed: 0,
          total: sessionItems.length,
          bandsSummary: {},
        });

        // Save to localStorage for resume
        saveToStorage({
          sessionId: session_id,
          subject: sessionSubject,
          startedAt: new Date().toISOString(),
        });

        if (sessionItems.length === 0) {
          throw new Error('No items returned from Pulse engine');
        }

        // Load first item
        await loadItem(sessionItems, 0);
      } catch (err) {
        console.error('[Pulse] Failed to create session:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to start session',
        );
        setPhase('error');
        setStreamingMessage('');
      }
    },
    [loadItem],
  );

  // -------------------------------------------------------------------------
  // Handle a single item completion (from PracticeManifestRenderer)
  // -------------------------------------------------------------------------

  const handleItemComplete = useCallback((result: PracticeItemResult) => {
    pendingResult.current = result;
  }, []);

  // -------------------------------------------------------------------------
  // Handle "Next" — submit result to backend and advance
  // -------------------------------------------------------------------------

  const handleNextItem = useCallback(async () => {
    const result = pendingResult.current;
    if (!result || !sessionId) return;

    const currentItem = items[currentItemIndex];
    if (!currentItem) return;

    pendingResult.current = null;

    try {
      // Determine primitive_type and eval_mode from the result
      const primitiveType = result.visualComponentId || result.problemType || 'unknown';
      const evalMode = result.mode === 'visual-primitive' ? 'visual' : 'standard';

      // Score conversion: PracticeItemResult score is 0-100, backend expects 0-10
      const scoreOn10 = result.score / 10;

      const response: PulseResultResponse = await pulseApi.submitResult(
        sessionId,
        {
          item_id: currentItem.item_id,
          score: scoreOn10,
          primitive_type: String(primitiveType),
          eval_mode: evalMode,
          duration_ms: result.durationMs,
        },
      );

      // Track results
      setResults((prev) => [...prev, response]);

      // Track leapfrogs
      if (response.leapfrog) {
        setLeapfrogs((prev) => [...prev, response.leapfrog!]);
      }

      // Update progress
      setProgress({
        completed: response.session_progress.items_completed,
        total: response.session_progress.items_total,
        bandsSummary: response.session_progress.bands_summary,
      });

      // Check if session is complete
      if (response.session_progress.is_complete) {
        // Show leapfrog celebration if one just happened
        if (response.leapfrog) {
          setPhase('leapfrog');
          // Auto-advance to summary after a moment
          setTimeout(async () => {
            try {
              const summaryData = await pulseApi.getSummary(sessionId);
              setSummary(summaryData);
              clearStorage();
              setPhase('summary');
            } catch {
              clearStorage();
              setPhase('summary');
            }
          }, 3000);
        } else {
          // Fetch summary
          try {
            const summaryData = await pulseApi.getSummary(sessionId);
            setSummary(summaryData);
          } catch {
            // Continue to summary even if fetch fails
          }
          clearStorage();
          setPhase('summary');
        }
      } else if (response.leapfrog) {
        // Mid-session leapfrog — brief celebration, then continue
        setPhase('leapfrog');
        const nextIndex = currentItemIndex + 1;
        setTimeout(async () => {
          setCurrentItemIndex(nextIndex);
          await loadItem(items, nextIndex);
        }, 3000);
      } else {
        // Normal advance to next item
        const nextIndex = currentItemIndex + 1;
        setCurrentItemIndex(nextIndex);
        await loadItem(items, nextIndex);
      }
    } catch (err) {
      console.error('[Pulse] Failed to submit result:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to submit result',
      );
      setPhase('error');
    }
  }, [sessionId, items, currentItemIndex, loadItem]);

  // -------------------------------------------------------------------------
  // Reset everything
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    setPhase('ready');
    setSessionId(null);
    setSubject(null);
    setIsColdStart(false);
    setItems([]);
    setCurrentItemIndex(0);
    setHydratedItem(null);
    setResults([]);
    setLeapfrogs([]);
    setSummary(null);
    setError(null);
    setStreamingMessage('');
    setCurrentBrief(null);
    setProgress({ completed: 0, total: 0, bandsSummary: {} });
    pendingResult.current = null;
    hydratedCache.current.clear();
    briefCache.current.clear();
    pregenInFlight.current.clear();
  }, []);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    phase,
    sessionId,
    subject,
    isColdStart,
    items,
    currentItemIndex,
    currentItem: items[currentItemIndex] ?? null,
    hydratedItem,
    results,
    leapfrogs,
    summary,
    error,
    streamingMessage,
    currentBrief,
    progress,

    startSession,
    handleItemComplete,
    handleNextItem,
    reset,
  };
}
