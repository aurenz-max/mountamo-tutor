import { useEffect } from 'react';
// Keep this exact specifier: `scripts/primitive-runtime-driver.mjs` aliases it.
import { useEvaluationContext, usePrimitiveEvaluation, type PrimitiveEvaluationResult, type PrimitiveMetrics } from '../../../evaluation';
import type { ComponentId } from '../../../types';
import { teachingEvaluation } from './teachingEvaluation';
import type { TeachingItem, useTeachingWorkspace } from './useTeachingWorkspace';

export type TeachingEvaluationResult = ReturnType<typeof teachingEvaluation>;

interface TeachingEvaluationOptions<M extends PrimitiveMetrics> {
  primitiveType: ComponentId;
  instanceId: string;
  data: { skillId?: string; subskillId?: string; objectiveId?: string; exhibitId?: string; onEvaluationSubmit?: unknown };
  assignments: readonly TeachingItem[];
  lesson: Pick<ReturnType<typeof useTeachingWorkspace>, 'state' | 'summary'>;
  evalMode: string;
  /** The only per-primitive part: this family's metrics from the shared result. */
  metrics: (result: TeachingEvaluationResult) => M;
}

/** Submits a completed teaching workspace through the ordinary evaluation provider, once.
 *  Every workspace binding sends the same evidence channel; only `metrics` differs. */
export function useTeachingEvaluation<M extends PrimitiveMetrics>({ primitiveType, instanceId, data, assignments,
  lesson, evalMode, metrics }: TeachingEvaluationOptions<M>) {
  const evaluationContext = useEvaluationContext();
  const evaluation = usePrimitiveEvaluation<M>({ primitiveType, instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined });
  useEffect(() => {
    if (!evaluationContext || !lesson.summary || evaluation.hasSubmitted) return;
    const result = teachingEvaluation(assignments, lesson.state, lesson.summary, evalMode);
    evaluation.submitResult(result.passed, result.accuracy, metrics(result),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
    // `metrics` is a fresh closure each render; the submit is gated by `hasSubmitted`, not by its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationContext, lesson.summary, lesson.state, evaluation, assignments, evalMode]);
  return evaluation;
}
