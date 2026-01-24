/**
 * Evaluation API Client
 *
 * Handles submission of primitive evaluation results to the backend.
 * Uses the existing authApi client for authentication.
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
// API Functions
// =============================================================================

/**
 * Submit a single evaluation result to the backend.
 *
 * @param result - The evaluation result to submit
 * @param studentId - Optional student ID (uses authenticated user if not provided)
 * @returns Response with evaluation ID and any competency updates
 */
export async function submitEvaluationToBackend(
  result: PrimitiveEvaluationResult,
  studentId?: string
): Promise<EvaluationSubmitResponse> {
  try {
    const payload = {
      ...result,
      studentId,
    };

    const response = await authApi.post<EvaluationSubmitResponse>(
      '/api/evaluations/submit',
      payload
    );

    return response;
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
