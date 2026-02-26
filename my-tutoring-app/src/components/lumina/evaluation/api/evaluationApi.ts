/**
 * Evaluation API Client
 *
 * Handles submission of primitive evaluation results to the backend.
 * Converts Lumina PrimitiveEvaluationResult → ProblemSubmission format
 * and submits via the universal /api/problems/submit endpoint.
 */

import { authApi } from '@/lib/authApiClient';
import type {
  PrimitiveEvaluationResult,
  SessionEvaluationSummary,
  CompetencyUpdateSuggestion,
} from '../types';

// =============================================================================
// Response Types
// =============================================================================

export interface EvaluationSubmitResponse {
  success: boolean;
  evaluationId: string;
  competencyUpdates?: CompetencyUpdateSuggestion[];
  message?: string;
}

/** Backend SubmissionResult shape from /api/problems/submit */
interface BackendSubmissionResult {
  review: Record<string, unknown>;
  competency: Record<string, unknown>;
  points_earned: number;
  encouraging_message: string;
  student_id?: number;
  user_id?: string;
  xp_earned?: number;
  level_up?: boolean;
  new_level?: number;
}

export interface BatchEvaluationResponse {
  success: boolean;
  submitted: number;
  failed: number;
  evaluationIds: string[];
  competencyUpdates?: CompetencyUpdateSuggestion[];
  errors?: Array<{
    attemptId: string;
    error: string;
  }>;
}

export interface SessionSummaryResponse {
  success: boolean;
  summary: SessionEvaluationSummary;
  competencyUpdates?: CompetencyUpdateSuggestion[];
}

// =============================================================================
// Conversion: PrimitiveEvaluationResult → ProblemSubmission
// =============================================================================

/**
 * Convert a Lumina PrimitiveEvaluationResult into the ProblemSubmission shape
 * expected by the backend /api/problems/submit endpoint.
 */
function convertToProblemSubmission(result: PrimitiveEvaluationResult): {
  subject: string;
  problem: Record<string, unknown>;
  skill_id: string;
  subskill_id?: string;
  student_answer: string;
  canvas_used: boolean;
  primitive_response: Record<string, unknown>;
  lesson_context?: {
    topic?: string;
    grade_level?: string;
    component_intent?: string;
    primitive_type?: string;
    objective_text?: string;
  };
} {
  return {
    // When lesson context is present the backend resolves the subject
    // via curriculum mapping; otherwise fall back to language_arts.
    subject: result.lessonContext?.topic ? 'auto' : 'language_arts',
    problem: {
      problem_type: 'lumina_primitive',
      id: result.attemptId,
      primitive_type: result.primitiveType,
      skill_id: result.skillId || `${result.primitiveType}_skill`,
      subskill_id: result.subskillId || `${result.primitiveType}_subskill`,
    },
    skill_id: result.skillId || `${result.primitiveType}_skill`,
    subskill_id: result.subskillId || `${result.primitiveType}_subskill`,
    student_answer: `${result.primitiveType} — ${result.score}%`,
    canvas_used: false,
    primitive_response: {
      pre_evaluated: true,
      success: result.success,
      score: result.score,
      metrics: result.metrics,
      duration_ms: result.durationMs,
      started_at: result.startedAt,
      completed_at: result.completedAt,
      student_work: result.studentWork,
    },
    // Lesson context for backend curriculum mapping
    lesson_context: result.lessonContext
      ? {
          topic: result.lessonContext.topic,
          grade_level: result.lessonContext.gradeLevel,
          component_intent: result.lessonContext.componentIntent,
          primitive_type: result.lessonContext.primitiveType,
          objective_text: result.lessonContext.objectiveText,
        }
      : undefined,
  };
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Submit a single evaluation result to the backend via /api/problems/submit.
 *
 * Converts the Lumina evaluation result to ProblemSubmission format and sends
 * it through the universal submission pipeline (competency update, CosmosDB, etc.)
 *
 * @param result - The evaluation result to submit
 * @param _studentId - Unused (auth middleware resolves student from token)
 * @returns Response with evaluation ID and any competency updates
 */
export async function submitEvaluationToBackend(
  result: PrimitiveEvaluationResult,
  _studentId?: string
): Promise<EvaluationSubmitResponse> {
  try {
    const payload = convertToProblemSubmission(result);

    console.log('[evaluationApi] Submitting Lumina eval via /api/problems/submit', {
      primitiveType: result.primitiveType,
      score: result.score,
      success: result.success,
    });

    const response = await authApi.post<BackendSubmissionResult>(
      '/api/problems/submit',
      payload
    );

    // Map backend SubmissionResult → EvaluationSubmitResponse
    const competencyUpdates: CompetencyUpdateSuggestion[] = [];
    if (response.competency && Object.keys(response.competency).length > 0) {
      competencyUpdates.push({
        skillId: result.skillId || result.primitiveType,
        subskillId: result.subskillId,
        currentScore: 0, // Backend doesn't return previous score
        suggestedScore: result.score,
        scoreDelta: result.score,
        basedOnAttempts: 1,
        successRate: result.success ? 100 : 0,
        averageScore: result.score,
        confidence: result.score >= 80 ? 'high' : result.score >= 50 ? 'medium' : 'low',
      });
    }

    return {
      success: true,
      evaluationId: result.attemptId,
      competencyUpdates,
      message: response.encouraging_message,
    };
  } catch (error) {
    console.error('[evaluationApi] Failed to submit evaluation:', error);
    throw error;
  }
}

/**
 * Submit multiple evaluation results in a single batch.
 *
 * @param results - Array of evaluation results to submit
 * @param studentId - Optional student ID (uses authenticated user if not provided)
 * @returns Response with submission status and competency updates
 */
export async function submitBatchEvaluations(
  results: PrimitiveEvaluationResult[],
  studentId?: string
): Promise<BatchEvaluationResponse> {
  try {
    const payload = {
      evaluations: results,
      studentId,
    };

    const response = await authApi.post<BatchEvaluationResponse>(
      '/api/evaluations/submit-batch',
      payload
    );

    return response;
  } catch (error) {
    console.error('[evaluationApi] Failed to submit batch evaluations:', error);
    throw error;
  }
}

/**
 * Submit a complete session summary to the backend.
 *
 * @param summary - The session evaluation summary
 * @param studentId - Optional student ID
 * @returns Response with competency updates
 */
export async function submitSessionSummary(
  summary: SessionEvaluationSummary,
  studentId?: string
): Promise<SessionSummaryResponse> {
  try {
    const payload = {
      ...summary,
      studentId,
    };

    const response = await authApi.post<SessionSummaryResponse>(
      '/api/evaluations/session-summary',
      payload
    );

    return response;
  } catch (error) {
    console.error('[evaluationApi] Failed to submit session summary:', error);
    throw error;
  }
}

/**
 * Get evaluation history for a student.
 *
 * @param studentId - Student ID
 * @param options - Query options
 * @returns Array of past evaluation results
 */
export async function getEvaluationHistory(
  studentId: number,
  options?: {
    primitiveType?: string;
    skillId?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<{
  evaluations: PrimitiveEvaluationResult[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const params = new URLSearchParams();

    if (options?.primitiveType) params.append('primitive_type', options.primitiveType);
    if (options?.skillId) params.append('skill_id', options.skillId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);

    const queryString = params.toString();
    const endpoint = `/api/evaluations/student/${studentId}/history${queryString ? `?${queryString}` : ''}`;

    return authApi.get(endpoint);
  } catch (error) {
    console.error('[evaluationApi] Failed to get evaluation history:', error);
    throw error;
  }
}

/**
 * Get aggregated evaluation statistics for a student.
 *
 * @param studentId - Student ID
 * @param options - Query options
 * @returns Aggregated statistics
 */
export async function getEvaluationStats(
  studentId: number,
  options?: {
    primitiveType?: string;
    skillId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{
  totalAttempts: number;
  successRate: number;
  averageScore: number;
  byPrimitiveType: Record<string, {
    attempts: number;
    successRate: number;
    averageScore: number;
  }>;
  bySkill: Record<string, {
    attempts: number;
    successRate: number;
    averageScore: number;
  }>;
  recentTrend: 'improving' | 'stable' | 'declining';
}> {
  try {
    const params = new URLSearchParams();

    if (options?.primitiveType) params.append('primitive_type', options.primitiveType);
    if (options?.skillId) params.append('skill_id', options.skillId);
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);

    const queryString = params.toString();
    const endpoint = `/api/evaluations/student/${studentId}/stats${queryString ? `?${queryString}` : ''}`;

    return authApi.get(endpoint);
  } catch (error) {
    console.error('[evaluationApi] Failed to get evaluation stats:', error);
    throw error;
  }
}

/**
 * Replay a past evaluation attempt (get the student work artifact).
 *
 * @param evaluationId - The evaluation ID to replay
 * @returns The evaluation result with student work
 */
export async function getEvaluationReplay(
  evaluationId: string
): Promise<PrimitiveEvaluationResult> {
  try {
    return authApi.get(`/api/evaluations/${evaluationId}/replay`);
  } catch (error) {
    console.error('[evaluationApi] Failed to get evaluation replay:', error);
    throw error;
  }
}

export default {
  submitEvaluationToBackend,
  submitBatchEvaluations,
  submitSessionSummary,
  getEvaluationHistory,
  getEvaluationStats,
  getEvaluationReplay,
};
