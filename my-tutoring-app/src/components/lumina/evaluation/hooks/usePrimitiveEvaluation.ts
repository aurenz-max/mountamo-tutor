'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ComponentId } from '../../types';
import type {
  PrimitiveEvaluationResult,
  PrimitiveMetrics,
} from '../types';
import { useEvaluationContext } from '../contexts/EvaluationContext';

/**
 * Configuration options for the usePrimitiveEvaluation hook.
 */
export interface UsePrimitiveEvaluationOptions {
  /** The type of primitive component */
  primitiveType: ComponentId;

  /** Unique instance identifier within the exhibit */
  instanceId: string;

  /** Associated skill ID for competency tracking */
  skillId?: string;

  /** Associated subskill ID for granular tracking */
  subskillId?: string;

  /** Learning objective this primitive addresses */
  objectiveId?: string;

  /** Parent exhibit ID */
  exhibitId?: string;

  /** Callback fired when result is submitted */
  onSubmit?: (result: PrimitiveEvaluationResult) => void;

  /** Callback fired when submission succeeds */
  onSubmitSuccess?: (result: PrimitiveEvaluationResult) => void;

  /** Callback fired when submission fails */
  onSubmitError?: (error: Error, result: PrimitiveEvaluationResult) => void;

  /** Whether to auto-submit on component unmount if there's pending work */
  autoSubmitOnUnmount?: boolean;
}

/**
 * Return type for the usePrimitiveEvaluation hook.
 */
export interface UsePrimitiveEvaluationReturn<TMetrics extends PrimitiveMetrics> {
  /** Unique ID for this attempt */
  attemptId: string;

  /** When this attempt started */
  startedAt: string;

  /** Elapsed time in milliseconds */
  elapsedMs: number;

  /** Whether a submission is in progress */
  isSubmitting: boolean;

  /** Whether a result has been submitted for this attempt */
  hasSubmitted: boolean;

  /** The submitted result (if any) */
  submittedResult: PrimitiveEvaluationResult<TMetrics> | null;

  /** Submit the evaluation result */
  submitResult: (
    success: boolean,
    score: number,
    metrics: TMetrics,
    studentWork?: unknown,
    partialCredit?: number
  ) => PrimitiveEvaluationResult<TMetrics>;

  /** Reset to start a new attempt */
  resetAttempt: () => void;

  /** Mark a checkpoint (for multi-stage evaluations) */
  markCheckpoint: (checkpointName: string, data?: unknown) => void;

  /** Get all checkpoints */
  checkpoints: Array<{ name: string; timestamp: string; data?: unknown }>;
}

/**
 * Generate a unique attempt ID.
 */
function generateAttemptId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Hook for managing primitive evaluation state and submission.
 *
 * This hook provides:
 * - Automatic timing tracking
 * - Standardized result formatting
 * - Integration with EvaluationContext for backend submission
 * - Checkpoint support for multi-stage evaluations
 *
 * @example
 * ```tsx
 * const { submitResult, elapsedMs, hasSubmitted } = usePrimitiveEvaluation<TowerStackerMetrics>({
 *   primitiveType: 'tower-stacker',
 *   instanceId: 'tower-1',
 *   skillId: 'engineering-stability',
 * });
 *
 * const handleComplete = () => {
 *   submitResult(
 *     true,                    // success
 *     85,                      // score
 *     {                        // metrics
 *       type: 'tower-stacker',
 *       targetHeight: 10,
 *       achievedHeight: 12,
 *       // ... other metrics
 *     },
 *     { placedPieces }         // studentWork
 *   );
 * };
 * ```
 */
export function usePrimitiveEvaluation<TMetrics extends PrimitiveMetrics>(
  options: UsePrimitiveEvaluationOptions
): UsePrimitiveEvaluationReturn<TMetrics> {
  const {
    primitiveType,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit,
    onSubmitSuccess,
    onSubmitError,
    autoSubmitOnUnmount = false,
  } = options;

  // Get context (may be null if no provider)
  const evaluationContext = useEvaluationContext();

  // Attempt state
  const [attemptId, setAttemptId] = useState(() => generateAttemptId());
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<TMetrics> | null>(null);
  const [checkpoints, setCheckpoints] = useState<Array<{ name: string; timestamp: string; data?: unknown }>>([]);

  // Refs for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingResultRef = useRef<PrimitiveEvaluationResult<TMetrics> | null>(null);

  // Start elapsed time timer
  useEffect(() => {
    const startTime = new Date(startedAt).getTime();

    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startedAt]);

  // Handle unmount with pending work
  useEffect(() => {
    return () => {
      if (autoSubmitOnUnmount && pendingResultRef.current && !hasSubmitted) {
        // Attempt to submit pending result
        evaluationContext?.submitEvaluation(pendingResultRef.current);
      }
    };
  }, [autoSubmitOnUnmount, hasSubmitted, evaluationContext]);

  /**
   * Submit the evaluation result.
   */
  const submitResult = useCallback((
    success: boolean,
    score: number,
    metrics: TMetrics,
    studentWork?: unknown,
    partialCredit?: number
  ): PrimitiveEvaluationResult<TMetrics> => {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    const result: PrimitiveEvaluationResult<TMetrics> = {
      primitiveType,
      instanceId,
      attemptId,
      startedAt,
      completedAt,
      durationMs,
      success,
      score: Math.max(0, Math.min(100, score)), // Clamp to 0-100
      partialCredit: partialCredit !== undefined ? Math.max(0, Math.min(100, partialCredit)) : undefined,
      metrics,
      skillId,
      subskillId,
      objectiveId,
      exhibitId,
      studentWork,
    };

    // Store for potential unmount submission
    pendingResultRef.current = result;

    // Call local callback
    onSubmit?.(result);

    // Submit to context if available
    if (evaluationContext) {
      setIsSubmitting(true);

      evaluationContext
        .submitEvaluation(result)
        .then(() => {
          setHasSubmitted(true);
          setSubmittedResult(result);
          onSubmitSuccess?.(result);
        })
        .catch((error: Error) => {
          onSubmitError?.(error, result);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    } else {
      // No context, just mark as submitted locally
      setHasSubmitted(true);
      setSubmittedResult(result);
      console.warn(
        '[usePrimitiveEvaluation] No EvaluationContext found. Result not sent to backend:',
        result
      );
    }

    return result;
  }, [
    primitiveType,
    instanceId,
    attemptId,
    startedAt,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit,
    onSubmitSuccess,
    onSubmitError,
    evaluationContext,
  ]);

  /**
   * Reset to start a new attempt.
   */
  const resetAttempt = useCallback(() => {
    setAttemptId(generateAttemptId());
    setStartedAt(new Date().toISOString());
    setElapsedMs(0);
    setIsSubmitting(false);
    setHasSubmitted(false);
    setSubmittedResult(null);
    setCheckpoints([]);
    pendingResultRef.current = null;
  }, []);

  /**
   * Mark a checkpoint during the evaluation.
   */
  const markCheckpoint = useCallback((checkpointName: string, data?: unknown) => {
    setCheckpoints(prev => [
      ...prev,
      {
        name: checkpointName,
        timestamp: new Date().toISOString(),
        data,
      },
    ]);
  }, []);

  return {
    attemptId,
    startedAt,
    elapsedMs,
    isSubmitting,
    hasSubmitted,
    submittedResult,
    submitResult,
    resetAttempt,
    markCheckpoint,
    checkpoints,
  };
}

export default usePrimitiveEvaluation;
