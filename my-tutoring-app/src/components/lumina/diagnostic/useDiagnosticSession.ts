'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { HydratedPracticeItem, PracticeItemResult } from '../types';
import {
  generatePracticeManifestAndHydrateStreaming,
} from '../service/geminiClient-api';
import { diagnosticApi } from './diagnosticApi';
import { authApi } from '@/lib/authApiClient';
import type {
  ProbeRequest,
  ProbeResultResponse,
  CompletionResponse,
  KnowledgeProfileResponse,
  DiagnosticPhase,
  ProbeProgress,
  DiagnosticSessionStorage,
  StoredDiagnosticProfile,
} from './types';
import { DIAGNOSTIC_STORAGE_KEY, DIAGNOSTIC_PROFILE_STORAGE_KEY } from './types';

import type { GradeLevel } from '../components/GradeLevelSelector';

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

interface UseDiagnosticSessionOptions {
  subjects?: string[];
  gradeLevel: GradeLevel;
}

/** Resolved curriculum metadata for a subskill */
export interface SkillMeta {
  skillDescription: string;
  subskillDescription: string;
}

export interface UseDiagnosticSessionReturn {
  // State
  phase: DiagnosticPhase;
  sessionId: string | null;
  probeQueue: ProbeRequest[];
  currentProbe: ProbeRequest | null;
  hydratedItems: HydratedPracticeItem[];
  currentItemIndex: number;
  itemResults: PracticeItemResult[];
  progress: ProbeProgress;
  knowledgeProfile: KnowledgeProfileResponse | null;
  completionResponse: CompletionResponse | null;
  error: string | null;
  streamingMessage: string;
  hasResumableSession: boolean;
  /** Resolved skill/subskill descriptions keyed by subskill_id */
  skillLookup: Map<string, SkillMeta>;

  // Actions
  startSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  dismissResume: () => void;
  confirmProbeStart: () => void;
  handleItemComplete: (result: PracticeItemResult) => void;
  handleNextItem: () => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Score aggregation: PracticeItemResult[] → 0-1 float for backend
// ---------------------------------------------------------------------------

function aggregateProbeScore(results: PracticeItemResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.success).length / results.length;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function saveToStorage(data: DiagnosticSessionStorage) {
  try {
    localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (SSR, private browsing quota)
  }
}

function loadFromStorage(): DiagnosticSessionStorage | null {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DiagnosticSessionStorage) : null;
  } catch {
    return null;
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function saveCompletedProfile(sessionId: string, profile: KnowledgeProfileResponse) {
  try {
    const data: StoredDiagnosticProfile = {
      sessionId,
      profile,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(DIAGNOSTIC_PROFILE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDiagnosticSession({
  subjects,
  gradeLevel,
}: UseDiagnosticSessionOptions): UseDiagnosticSessionReturn {
  // Core state
  const [phase, setPhase] = useState<DiagnosticPhase>('welcome');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [probeQueue, setProbeQueue] = useState<ProbeRequest[]>([]);
  const [currentProbe, setCurrentProbe] = useState<ProbeRequest | null>(null);
  const [hydratedItems, setHydratedItems] = useState<HydratedPracticeItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [itemResults, setItemResults] = useState<PracticeItemResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Progress tracking
  const [probesCompleted, setProbesCompleted] = useState(0);
  const [coveragePct, setCoveragePct] = useState(0);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Completion
  const [knowledgeProfile, setKnowledgeProfile] =
    useState<KnowledgeProfileResponse | null>(null);
  const [completionResponse, setCompletionResponse] =
    useState<CompletionResponse | null>(null);

  // Curriculum skill lookup (resolved from API)
  const skillLookupRef = useRef<Map<string, SkillMeta>>(new Map());

  // Resume detection
  const [hasResumableSession, setHasResumableSession] = useState(false);

  // Pre-generation cache: subskill_id → hydrated items
  const pregenCache = useRef<Map<string, HydratedPracticeItem[]>>(new Map());
  const pregenInFlight = useRef<Set<string>>(new Set());

  // Check for resumable session on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored?.sessionId) {
      setHasResumableSession(true);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Curriculum skill lookup: resolve skill IDs → human descriptions
  // -------------------------------------------------------------------------

  const buildSkillLookup = useCallback(async (subjectList: string[]) => {
    interface CurrSubskill { id: string; description: string }
    interface CurrSkill { id: string; description: string; subskills: CurrSubskill[] }
    interface CurrUnit { skills: CurrSkill[] }

    for (const subject of subjectList) {
      try {
        const data = await authApi.getSubjectCurriculum(subject) as { curriculum: CurrUnit[] };
        for (const unit of data.curriculum) {
          for (const skill of unit.skills) {
            for (const subskill of skill.subskills) {
              skillLookupRef.current.set(subskill.id, {
                skillDescription: skill.description,
                subskillDescription: subskill.description,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Diagnostic] Failed to load curriculum for', subject, err);
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Pre-generation: start generating items for the next probe in background
  // -------------------------------------------------------------------------

  const pregenerate = useCallback(
    (probe: ProbeRequest) => {
      const key = probe.subskill_id;
      if (pregenCache.current.has(key) || pregenInFlight.current.has(key)) return;
      pregenInFlight.current.add(key);

      const topic = probe.description || probe.skill_id || probe.subskill_id;
      generatePracticeManifestAndHydrateStreaming(
        topic,
        gradeLevel,
        probe.items_needed || 3,
        undefined,
        { enforceDiversity: true },
      )
        .then((items) => {
          pregenCache.current.set(key, items);
        })
        .catch((err) => {
          console.warn('[Diagnostic] Pre-generation failed for', key, err);
        })
        .finally(() => {
          pregenInFlight.current.delete(key);
        });
    },
    [gradeLevel],
  );

  // -------------------------------------------------------------------------
  // Generate items for a probe (check cache first)
  // -------------------------------------------------------------------------

  const generateProbeItems = useCallback(
    async (probe: ProbeRequest): Promise<HydratedPracticeItem[]> => {
      const key = probe.subskill_id;

      // Check pre-gen cache
      const cached = pregenCache.current.get(key);
      if (cached) {
        pregenCache.current.delete(key);
        return cached;
      }

      // Wait for in-flight pre-gen if it exists
      if (pregenInFlight.current.has(key)) {
        // Poll for completion (max 30s)
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const result = pregenCache.current.get(key);
          if (result) {
            pregenCache.current.delete(key);
            return result;
          }
        }
      }

      // Generate fresh
      const topic = probe.description || probe.skill_id || probe.subskill_id;
      return generatePracticeManifestAndHydrateStreaming(
        topic,
        gradeLevel,
        probe.items_needed || 3,
        {
          onProgress: (msg) => setStreamingMessage(msg),
        },
        { enforceDiversity: true },
      );
    },
    [gradeLevel],
  );

  // -------------------------------------------------------------------------
  // Begin a probe: generate items and transition to probing phase
  // -------------------------------------------------------------------------

  const beginProbe = useCallback(
    async (probe: ProbeRequest, queue: ProbeRequest[]) => {
      setPhase('generating');
      setCurrentProbe(probe);
      setCurrentItemIndex(0);
      setItemResults([]);
      setStreamingMessage('Preparing activities...');

      try {
        const items = await generateProbeItems(probe);
        if (!items || items.length === 0) {
          throw new Error('No items generated for probe');
        }
        // Stamp canonical curriculum IDs from the probe onto each item
        // so the evaluation pipeline has authoritative IDs, not fallbacks.
        items.forEach(item => {
          item.curriculumIds = {
            subject: probe.subject,
            skillId: probe.skill_id,
            subskillId: probe.subskill_id,
            source: 'diagnostic',
          };
        });
        setHydratedItems(items);
        setPhase('probe-intro');

        // Pre-generate the next probe in queue
        if (queue.length > 0) {
          pregenerate(queue[0]);
        }
      } catch (err) {
        console.error('[Diagnostic] Failed to generate probe items:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate activities',
        );
        setPhase('error');
      } finally {
        setStreamingMessage('');
      }
    },
    [generateProbeItems, pregenerate],
  );

  // -------------------------------------------------------------------------
  // Start a new diagnostic session
  // -------------------------------------------------------------------------

  const startSession = useCallback(async () => {
    setPhase('generating');
    setError(null);
    setStreamingMessage('Setting up your skills exploration...');

    try {
      const response = await diagnosticApi.createSession(subjects);
      const { session_id, probes, total_nodes, subjects: sessionSubjects } = response;

      setSessionId(session_id);
      setTotalCount(total_nodes);
      setClassifiedCount(0);
      setCoveragePct(0);
      setProbesCompleted(0);

      if (!probes || probes.length === 0) {
        throw new Error('No probes returned from diagnostic engine');
      }

      const [first, ...rest] = probes;
      setProbeQueue(rest);

      // Save to localStorage for resume
      saveToStorage({
        sessionId: session_id,
        probeQueue: rest,
        probesCompleted: 0,
        coveragePct: 0,
        startedAt: new Date().toISOString(),
      });

      // Fetch curriculum descriptions in parallel with first probe generation
      buildSkillLookup(sessionSubjects).catch(() => {});

      await beginProbe(first, rest);
    } catch (err) {
      console.error('[Diagnostic] Failed to create session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to start diagnostic',
      );
      setPhase('error');
      setStreamingMessage('');
    }
  }, [subjects, beginProbe, buildSkillLookup]);

  // -------------------------------------------------------------------------
  // Resume an existing session
  // -------------------------------------------------------------------------

  const resumeSession = useCallback(async () => {
    const stored = loadFromStorage();
    if (!stored) {
      setHasResumableSession(false);
      return;
    }

    setPhase('generating');
    setError(null);
    setStreamingMessage('Resuming your session...');

    try {
      // Verify session still exists and is in progress
      const session = await diagnosticApi.getSession(stored.sessionId);
      if ((session as { state?: string }).state === 'completed') {
        clearStorage();
        setHasResumableSession(false);
        setPhase('welcome');
        setStreamingMessage('');
        return;
      }

      setSessionId(stored.sessionId);
      setProbesCompleted(stored.probesCompleted);
      setCoveragePct(stored.coveragePct);
      setTotalCount((session as { total_nodes?: number }).total_nodes || 0);
      setClassifiedCount(
        (session as { classified_count?: number }).classified_count || 0,
      );

      // Use stored probe queue or start fresh
      const queue = stored.probeQueue;
      if (!queue || queue.length === 0) {
        // No probes left — session might be complete
        setPhase('completing');
        const completion = await diagnosticApi.completeSession(stored.sessionId);
        setCompletionResponse(completion);
        setKnowledgeProfile(completion.knowledge_profile);
        saveCompletedProfile(stored.sessionId, completion.knowledge_profile);
        clearStorage();
        setPhase('profile');
        return;
      }

      const [first, ...rest] = queue;
      setProbeQueue(rest);
      await beginProbe(first, rest);
    } catch (err) {
      console.error('[Diagnostic] Failed to resume session:', err);
      clearStorage();
      setHasResumableSession(false);
      setError(
        err instanceof Error ? err.message : 'Failed to resume session',
      );
      setPhase('error');
      setStreamingMessage('');
    }
  }, [beginProbe]);

  // -------------------------------------------------------------------------
  // Handle a single item completion
  // -------------------------------------------------------------------------

  const handleItemComplete = useCallback((result: PracticeItemResult) => {
    setItemResults((prev) => {
      const existing = prev.findIndex(
        (r) => r.instanceId === result.instanceId,
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
  }, []);

  // -------------------------------------------------------------------------
  // Handle "Next" button — advance item or complete probe
  // -------------------------------------------------------------------------

  const handleNextItem = useCallback(async () => {
    // If not on the last item, advance
    if (currentItemIndex < hydratedItems.length - 1) {
      setCurrentItemIndex((i) => i + 1);
      return;
    }

    // Last item done — submit probe result to backend
    if (!sessionId || !currentProbe) return;

    const score = aggregateProbeScore(itemResults);
    const itemsCompleted = itemResults.length;

    try {
      const response: ProbeResultResponse =
        await diagnosticApi.submitProbeResult(
          sessionId,
          currentProbe.subskill_id,
          score,
          itemsCompleted,
        );

      const newProbesCompleted = probesCompleted + 1;
      setProbesCompleted(newProbesCompleted);
      setCoveragePct(response.coverage_pct);
      setClassifiedCount(response.classified_count);
      setTotalCount(response.total_count);

      // Merge new probes into queue
      const updatedQueue = [...probeQueue, ...response.probes];
      setProbeQueue(updatedQueue);

      // Save progress to localStorage
      saveToStorage({
        sessionId,
        probeQueue: updatedQueue,
        probesCompleted: newProbesCompleted,
        coveragePct: response.coverage_pct,
        startedAt: loadFromStorage()?.startedAt || new Date().toISOString(),
      });

      if (response.status === 'complete' || updatedQueue.length === 0) {
        // Diagnostic is done — complete the session
        setPhase('completing');
        const completion = await diagnosticApi.completeSession(sessionId);
        setCompletionResponse(completion);
        setKnowledgeProfile(completion.knowledge_profile);
        saveCompletedProfile(sessionId, completion.knowledge_profile);
        clearStorage();
        setPhase('profile');
      } else {
        // More probes to do — show transition screen
        setPhase('transition');

        // Auto-advance after a brief pause, then begin next probe
        const [next, ...rest] = updatedQueue;
        setTimeout(async () => {
          setProbeQueue(rest);
          await beginProbe(next, rest);
        }, 2000);
      }
    } catch (err) {
      console.error('[Diagnostic] Failed to submit probe result:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit activity results',
      );
      setPhase('error');
    }
  }, [
    currentItemIndex,
    hydratedItems.length,
    sessionId,
    currentProbe,
    itemResults,
    probesCompleted,
    probeQueue,
    beginProbe,
  ]);

  // -------------------------------------------------------------------------
  // Reset everything
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    setPhase('welcome');
    setSessionId(null);
    setProbeQueue([]);
    setCurrentProbe(null);
    setHydratedItems([]);
    setCurrentItemIndex(0);
    setItemResults([]);
    setError(null);
    setStreamingMessage('');
    setProbesCompleted(0);
    setCoveragePct(0);
    setClassifiedCount(0);
    setTotalCount(0);
    setKnowledgeProfile(null);
    setCompletionResponse(null);
    pregenCache.current.clear();
    pregenInFlight.current.clear();
    // Don't clear localStorage — user might want to resume a different session
  }, []);

  const dismissResume = useCallback(() => {
    clearStorage();
    setHasResumableSession(false);
  }, []);

  const confirmProbeStart = useCallback(() => {
    setPhase('probing');
  }, []);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  const progress: ProbeProgress = {
    probesCompleted,
    coveragePct,
    classifiedCount,
    totalCount,
    currentSubject: currentProbe?.subject || '',
  };

  return {
    phase,
    sessionId,
    probeQueue,
    currentProbe,
    hydratedItems,
    currentItemIndex,
    itemResults,
    progress,
    knowledgeProfile,
    completionResponse,
    error,
    streamingMessage,
    hasResumableSession,
    skillLookup: skillLookupRef.current,

    startSession,
    resumeSession,
    dismissResume,
    confirmProbeStart,
    handleItemComplete,
    handleNextItem,
    reset,
  };
}
