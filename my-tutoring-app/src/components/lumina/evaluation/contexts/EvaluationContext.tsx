'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  PrimitiveEvaluationResult,
  SessionEvaluationSummary,
  QueuedEvaluation,
  EvaluationStatus,
  CompetencyUpdateSuggestion,
} from '../types';
import { submitEvaluationToBackend, submitBatchEvaluations } from '../api/evaluationApi';

// =============================================================================
// Context Types
// =============================================================================

export interface EvaluationContextType {
  // Session info
  sessionId: string;
  exhibitId?: string;
  studentId?: string;

  // Submission
  submitEvaluation: (result: PrimitiveEvaluationResult) => Promise<void>;

  // State
  pendingSubmissions: QueuedEvaluation[];
  submittedResults: PrimitiveEvaluationResult[];
  failedSubmissions: QueuedEvaluation[];

  // Status
  isOnline: boolean;
  isSyncing: boolean;

  // Batch operations
  getSessionSummary: () => SessionEvaluationSummary;
  flushToBackend: () => Promise<void>;
  retryFailed: () => Promise<void>;

  // Competency suggestions (populated after backend response)
  competencyUpdates: CompetencyUpdateSuggestion[];
}

const EvaluationContext = createContext<EvaluationContextType | null>(null);

// =============================================================================
// Local Storage Keys
// =============================================================================

const STORAGE_KEY_PENDING = 'lumina_evaluation_pending';
const STORAGE_KEY_FAILED = 'lumina_evaluation_failed';

// =============================================================================
// Provider Props
// =============================================================================

export interface EvaluationProviderProps {
  children: ReactNode;
  sessionId?: string;
  exhibitId?: string;
  studentId?: string;

  /** Maximum retries for failed submissions */
  maxRetries?: number;

  /** Delay between retry attempts (ms) */
  retryDelay?: number;

  /** Auto-flush interval (ms). Set to 0 to disable. */
  autoFlushInterval?: number;

  /** Whether to persist pending evaluations to localStorage */
  persistToStorage?: boolean;

  /** Callback when competency updates are received */
  onCompetencyUpdate?: (updates: CompetencyUpdateSuggestion[]) => void;

  /** If true, skip backend submission and keep results local only */
  localOnly?: boolean;
}

// =============================================================================
// Provider Implementation
// =============================================================================

export function EvaluationProvider({
  children,
  sessionId: providedSessionId,
  exhibitId,
  studentId,
  maxRetries = 3,
  retryDelay = 2000,
  autoFlushInterval = 30000, // 30 seconds
  persistToStorage = true,
  onCompetencyUpdate,
  localOnly = false,
}: EvaluationProviderProps) {
  // Generate session ID if not provided
  const [sessionId] = useState(() => {
    if (providedSessionId) return providedSessionId;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  });

  // State
  const [pendingSubmissions, setPendingSubmissions] = useState<QueuedEvaluation[]>([]);
  const [submittedResults, setSubmittedResults] = useState<PrimitiveEvaluationResult[]>([]);
  const [failedSubmissions, setFailedSubmissions] = useState<QueuedEvaluation[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [competencyUpdates, setCompetencyUpdates] = useState<CompetencyUpdateSuggestion[]>([]);

  // Refs
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<string>(new Date().toISOString());

  // =============================================================================
  // Online/Offline Detection
  // =============================================================================

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsOnline(navigator.onLine);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // =============================================================================
  // Local Storage Persistence
  // =============================================================================

  // Load from storage on mount
  useEffect(() => {
    if (!persistToStorage || typeof window === 'undefined') return;

    try {
      const pendingData = localStorage.getItem(STORAGE_KEY_PENDING);
      const failedData = localStorage.getItem(STORAGE_KEY_FAILED);

      if (pendingData) {
        const parsed = JSON.parse(pendingData) as QueuedEvaluation[];
        setPendingSubmissions(parsed);
      }

      if (failedData) {
        const parsed = JSON.parse(failedData) as QueuedEvaluation[];
        setFailedSubmissions(parsed);
      }
    } catch (error) {
      console.error('[EvaluationContext] Failed to load from storage:', error);
    }
  }, [persistToStorage]);

  // Save to storage on change
  useEffect(() => {
    if (!persistToStorage || typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(pendingSubmissions));
      localStorage.setItem(STORAGE_KEY_FAILED, JSON.stringify(failedSubmissions));
    } catch (error) {
      console.error('[EvaluationContext] Failed to save to storage:', error);
    }
  }, [pendingSubmissions, failedSubmissions, persistToStorage]);

  // =============================================================================
  // Submit Single Evaluation
  // =============================================================================

  const submitEvaluation = useCallback(async (result: PrimitiveEvaluationResult): Promise<void> => {
    // LOCAL-ONLY MODE: Skip backend and immediately add to submitted results
    if (localOnly) {
      console.log('[EvaluationContext] Local-only mode - adding result directly to submitted');
      setSubmittedResults(prev => [...prev, result]);
      return;
    }

    const queuedEval: QueuedEvaluation = {
      result,
      status: 'pending',
      retryCount: 0,
      queuedAt: new Date().toISOString(),
    };

    // Add to pending queue
    setPendingSubmissions(prev => [...prev, queuedEval]);

    // If offline, just queue it
    if (!isOnline) {
      console.log('[EvaluationContext] Offline - queued evaluation for later');
      return;
    }

    // Attempt immediate submission
    try {
      setPendingSubmissions(prev =>
        prev.map(e =>
          e.result.attemptId === result.attemptId
            ? { ...e, status: 'submitting' as EvaluationStatus }
            : e
        )
      );

      const response = await submitEvaluationToBackend(result, studentId);

      // Success - move to submitted
      setPendingSubmissions(prev =>
        prev.filter(e => e.result.attemptId !== result.attemptId)
      );
      setSubmittedResults(prev => [...prev, result]);

      // Handle competency updates from backend
      if (response?.competencyUpdates && response.competencyUpdates.length > 0) {
        setCompetencyUpdates(prev => [...prev, ...response.competencyUpdates]);
        onCompetencyUpdate?.(response.competencyUpdates);
      }
    } catch (error) {
      console.error('[EvaluationContext] Submission failed:', error);

      // Move to failed if max retries exceeded
      setPendingSubmissions(prev => {
        const updated = prev.map(e => {
          if (e.result.attemptId !== result.attemptId) return e;

          const newRetryCount = e.retryCount + 1;
          if (newRetryCount >= maxRetries) {
            // Will be moved to failed
            return { ...e, status: 'failed' as EvaluationStatus, retryCount: newRetryCount };
          }
          return {
            ...e,
            status: 'pending' as EvaluationStatus,
            retryCount: newRetryCount,
            lastError: error instanceof Error ? error.message : 'Unknown error',
          };
        });

        // Separate failed from pending
        const failed = updated.filter(e => e.status === 'failed');
        const stillPending = updated.filter(e => e.status !== 'failed');

        if (failed.length > 0) {
          setFailedSubmissions(prev => [...prev, ...failed]);
        }

        return stillPending;
      });

      throw error;
    }
  }, [localOnly, isOnline, studentId, maxRetries, onCompetencyUpdate]);

  // =============================================================================
  // Flush All Pending to Backend
  // =============================================================================

  const flushToBackend = useCallback(async (): Promise<void> => {
    if (pendingSubmissions.length === 0 || !isOnline || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      const results = pendingSubmissions.map(e => e.result);
      const response = await submitBatchEvaluations(results, studentId);

      // Mark all as submitted
      setSubmittedResults(prev => [...prev, ...results]);
      setPendingSubmissions([]);

      // Handle competency updates
      if (response?.competencyUpdates && response.competencyUpdates.length > 0) {
        setCompetencyUpdates(prev => [...prev, ...response.competencyUpdates]);
        onCompetencyUpdate?.(response.competencyUpdates);
      }
    } catch (error) {
      console.error('[EvaluationContext] Batch flush failed:', error);
      // Keep in pending for retry
    } finally {
      setIsSyncing(false);
    }
  }, [pendingSubmissions, isOnline, isSyncing, studentId, onCompetencyUpdate]);

  // =============================================================================
  // Retry Failed Submissions
  // =============================================================================

  const retryFailed = useCallback(async (): Promise<void> => {
    if (failedSubmissions.length === 0 || !isOnline) {
      return;
    }

    // Reset retry counts and move back to pending
    const toRetry = failedSubmissions.map(e => ({
      ...e,
      status: 'pending' as EvaluationStatus,
      retryCount: 0,
      lastError: undefined,
    }));

    setFailedSubmissions([]);
    setPendingSubmissions(prev => [...prev, ...toRetry]);

    // Trigger flush
    await flushToBackend();
  }, [failedSubmissions, isOnline, flushToBackend]);

  // =============================================================================
  // Auto-Flush Timer
  // =============================================================================

  useEffect(() => {
    if (autoFlushInterval <= 0) return;

    flushTimeoutRef.current = setInterval(() => {
      if (pendingSubmissions.length > 0 && isOnline && !isSyncing) {
        flushToBackend();
      }
    }, autoFlushInterval);

    return () => {
      if (flushTimeoutRef.current) {
        clearInterval(flushTimeoutRef.current);
      }
    };
  }, [autoFlushInterval, pendingSubmissions.length, isOnline, isSyncing, flushToBackend]);

  // Flush on online reconnection
  useEffect(() => {
    if (isOnline && pendingSubmissions.length > 0) {
      // Delay slightly to ensure connection is stable
      const timeout = setTimeout(() => {
        flushToBackend();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [isOnline, pendingSubmissions.length, flushToBackend]);

  // =============================================================================
  // Session Summary
  // =============================================================================

  const getSessionSummary = useCallback((): SessionEvaluationSummary => {
    const allEvaluations = [...submittedResults, ...pendingSubmissions.map(e => e.result)];

    const successfulAttempts = allEvaluations.filter(e => e.success).length;
    const totalScore = allEvaluations.reduce((sum, e) => sum + e.score, 0);

    // Group by primitive type
    const byPrimitiveType: Record<string, { attempts: number; successes: number; averageScore: number }> = {};
    allEvaluations.forEach(e => {
      const type = e.primitiveType;
      if (!byPrimitiveType[type]) {
        byPrimitiveType[type] = { attempts: 0, successes: 0, averageScore: 0 };
      }
      byPrimitiveType[type].attempts++;
      if (e.success) byPrimitiveType[type].successes++;
      byPrimitiveType[type].averageScore += e.score;
    });
    // Calculate averages
    Object.keys(byPrimitiveType).forEach(type => {
      const group = byPrimitiveType[type];
      group.averageScore = group.attempts > 0 ? group.averageScore / group.attempts : 0;
    });

    // Group by skill
    const bySkill: Record<string, { attempts: number; successes: number; averageScore: number }> = {};
    allEvaluations.forEach(e => {
      if (!e.skillId) return;
      if (!bySkill[e.skillId]) {
        bySkill[e.skillId] = { attempts: 0, successes: 0, averageScore: 0 };
      }
      bySkill[e.skillId].attempts++;
      if (e.success) bySkill[e.skillId].successes++;
      bySkill[e.skillId].averageScore += e.score;
    });
    Object.keys(bySkill).forEach(skillId => {
      const group = bySkill[skillId];
      group.averageScore = group.attempts > 0 ? group.averageScore / group.attempts : 0;
    });

    return {
      sessionId,
      exhibitId,
      studentId,
      startedAt: sessionStartRef.current,
      completedAt: allEvaluations.length > 0 ? new Date().toISOString() : undefined,
      totalDurationMs: Date.now() - new Date(sessionStartRef.current).getTime(),
      totalAttempts: allEvaluations.length,
      successfulAttempts,
      averageScore: allEvaluations.length > 0 ? totalScore / allEvaluations.length : 0,
      byPrimitiveType,
      bySkill,
      evaluations: allEvaluations,
    };
  }, [sessionId, exhibitId, studentId, submittedResults, pendingSubmissions]);

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue: EvaluationContextType = {
    sessionId,
    exhibitId,
    studentId,
    submitEvaluation,
    pendingSubmissions,
    submittedResults,
    failedSubmissions,
    isOnline,
    isSyncing,
    getSessionSummary,
    flushToBackend,
    retryFailed,
    competencyUpdates,
  };

  return (
    <EvaluationContext.Provider value={contextValue}>
      {children}
    </EvaluationContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the EvaluationContext.
 * Returns null if used outside of an EvaluationProvider.
 */
export function useEvaluationContext(): EvaluationContextType | null {
  return useContext(EvaluationContext);
}

/**
 * Access the EvaluationContext, throwing if not available.
 * Use this when the context is required.
 */
export function useRequiredEvaluationContext(): EvaluationContextType {
  const context = useContext(EvaluationContext);
  if (!context) {
    throw new Error('useRequiredEvaluationContext must be used within an EvaluationProvider');
  }
  return context;
}

export default EvaluationContext;
