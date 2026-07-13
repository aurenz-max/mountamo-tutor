'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ComponentId } from '../../types';
import type {
  PrimitiveEvaluationResult,
  PrimitiveMetrics,
  IdSource,
} from '../types';
import type { DiagnosisEvidence } from '../diagnosis/types';
import { useEvaluationContext } from '../contexts/EvaluationContext';
import { useExhibitContext } from '../../contexts/ExhibitContext';
import { resolveRemediationIdentity } from '../remediation/remediationTransport';

/**
 * Configuration options for the usePrimitiveEvaluation hook.
 */
export interface UsePrimitiveEvaluationOptions<TMetrics extends PrimitiveMetrics = PrimitiveMetrics> {
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

  /** Component intent from the manifest (for curriculum mapping) */
  componentIntent?: string;

  /** Objective text from the manifest (for curriculum mapping) */
  objectiveText?: string;

  /** The primitive's OWN best-guess curriculum subject_id (e.g. a KC's orchestrator
   *  subject stamped onto its problems). When present on a free-form submission it WINS
   *  over the lesson manifest's subject, so an interdisciplinary lesson's primitive
   *  attributes to its own subject. Authoritative (curriculum/planner) IDs are never
   *  overridden. See BaseProblemData.subject. */
  contentSubject?: string;

  /** Callback fired when result is submitted */
  onSubmit?: (result: PrimitiveEvaluationResult<TMetrics>) => void;

  /** Callback fired when submission succeeds */
  onSubmitSuccess?: (result: PrimitiveEvaluationResult<TMetrics>) => void;

  /** Callback fired when submission fails */
  onSubmitError?: (error: Error, result: PrimitiveEvaluationResult<TMetrics>) => void;

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
    partialCredit?: number,
    diagnosisEvidence?: DiagnosisEvidence
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
  options: UsePrimitiveEvaluationOptions<TMetrics>
): UsePrimitiveEvaluationReturn<TMetrics> {
  const {
    primitiveType,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    contentSubject,
    onSubmit,
    onSubmitSuccess,
    onSubmitError,
    autoSubmitOnUnmount = false,
  } = options;

  // Get context (may be null if no provider)
  const evaluationContext = useEvaluationContext();
  // Exhibit context maps this component instance → its manifest objective(s),
  // which carry per-objective curriculum IDs on multi-subskill lessons.
  const exhibitContext = useExhibitContext();

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
  // Synchronous submit-once latch, keyed by attemptId. `hasSubmitted` is React
  // state and only flips after the async backend round-trip resolves, so an
  // auto-submit effect gated on it can fire many times in the window before the
  // flag catches up — that produced the duplicate /api/problems/submit burst
  // (double-counted XP / competency / calibration). This ref is set
  // synchronously at call time, closing the window deterministically.
  const submittedAttemptRef = useRef<string | null>(null);

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
      // Use the synchronous latch (not the lagging `hasSubmitted` state) so the
      // unmount path can't re-submit an attempt submitResult already sent.
      if (
        autoSubmitOnUnmount &&
        pendingResultRef.current &&
        submittedAttemptRef.current !== pendingResultRef.current.attemptId
      ) {
        submittedAttemptRef.current = pendingResultRef.current.attemptId;
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
    partialCredit?: number,
    // Misconception Loop S1 — optional evidence packet for the shared
    // distiller. Primitives supply DATA on failures; they never diagnose.
    diagnosisEvidence?: DiagnosisEvidence
  ): PrimitiveEvaluationResult<TMetrics> => {
    // Submit-once latch: ignore repeat calls for the same attempt (re-firing
    // auto-submit effects, double-clicks). Return the already-built result so
    // callers relying on the return value still get the canonical payload.
    if (submittedAttemptRef.current === attemptId && pendingResultRef.current) {
      return pendingResultRef.current;
    }
    submittedAttemptRef.current = attemptId;

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    // Per-objective attribution: on multi-subskill lessons (group / recommended
    // / daily-plan) each objective IS a distinct subskill, so this component's
    // own objective must win over the lesson-level context (which only carries
    // the FIRST objective's subskill). Only trust the mapping when the
    // component belongs to exactly ONE objective — a cross-objective component
    // (e.g. the final knowledge-check) has no single honest subskill.
    const componentObjectives = exhibitContext.getObjectivesForComponent(instanceId);
    const objectiveOwn =
      componentObjectives.length === 1 && componentObjectives[0].subskillId
        ? componentObjectives[0]
        : undefined;

    // Use curriculum IDs from context as fallbacks when the component doesn't provide them
    // The structurally joined objective wins for a single-objective component.
    // Renderer-level props may carry the lesson's first objective on grouped
    // lessons; letting those win would tag and grade remediation against the
    // wrong subskill. Cross-objective components have no objectiveOwn and keep
    // their explicit/problem-level ids or lesson fallback.
    const resolvedSkillId = objectiveOwn?.skillId || skillId || evaluationContext?.curriculumSkillId;
    const resolvedSubskillId = objectiveOwn?.subskillId || subskillId || evaluationContext?.curriculumSubskillId;
    const remediationIdentity = resolveRemediationIdentity(
      exhibitContext.manifestItems,
      instanceId,
      primitiveType,
      resolvedSkillId,
      metrics.evalMode ?? ('challengeType' in metrics ? String(metrics.challengeType) : undefined),
    );

    // Determine provenance of the IDs so the backend knows whether to trust them
    // or route to CurriculumMappingService.
    let idSource: IdSource | undefined;
    if (resolvedSkillId && resolvedSubskillId) {
      // We have IDs — component prop / this component's objective / provider context
      idSource = skillId || objectiveOwn ? 'curriculum' : 'planner';
    } else {
      // No curriculum IDs available — explicitly mark as free-form
      idSource = 'free-form';
    }

    // Resolve the curriculum subject with primitive-first precedence:
    //   1. authoritative IDs (curriculum/planner/diagnostic) → keep the lesson's real
    //      subject untouched (it's also the top-level competency subject; mapping is skipped).
    //   2. free-form → the primitive's own content guess (contentSubject) wins over the
    //      lesson manifest's subject, so a 2-part lesson's primitive attributes to its own
    //      subject. Falls back to the manifest/provider subject when the primitive has none.
    const effectiveSubject = idSource === 'free-form'
      ? (contentSubject?.trim() || evaluationContext?.curriculumSubject)
      : evaluationContext?.curriculumSubject;

    // Build lesson context from EvaluationContext + component-level props.
    // Always include it so the backend has topic/grade for curriculum mapping.
    const lessonContext = {
      topic: evaluationContext?.topic,
      gradeLevel: evaluationContext?.gradeLevel,
      componentIntent,
      primitiveType: primitiveType as string,
      objectiveText,
      curriculumSubject: effectiveSubject,
      idSource,
      remediationForPrimitiveType: remediationIdentity?.primitiveType,
      remediationForSkillId: remediationIdentity?.skillId,
    };

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
      skillId: resolvedSkillId,
      subskillId: resolvedSubskillId,
      objectiveId: objectiveId || objectiveOwn?.id,
      exhibitId,
      lessonContext,
      studentWork,
      diagnosisEvidence,
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
    componentIntent,
    objectiveText,
    contentSubject,
    onSubmit,
    onSubmitSuccess,
    onSubmitError,
    evaluationContext,
    exhibitContext,
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
    submittedAttemptRef.current = null;
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
