/**
 * Evaluation API Client
 *
 * Handles submission of primitive evaluation results to the backend.
 * Converts Lumina PrimitiveEvaluationResult → ProblemSubmission format
 * and submits via the universal /api/problems/submit endpoint.
 */

import { authApi } from '@/lib/authApiClient';
import { getComponentById, getDomainById } from '../../service/manifest/catalog';
import type {
  PrimitiveEvaluationResult,
  SessionEvaluationSummary,
  CompetencyUpdateSuggestion,
  DemonstratedSkill,
} from '../types';

// =============================================================================
// Response Types
// =============================================================================

/** Engagement reward the backend awarded for this submission (XP, level, streak).
 *  The decorator flattens these onto the /api/problems/submit response; we promote
 *  them so the lesson summary can show real session totals instead of guessing. */
export interface SubmissionEngagement {
  /** XP awarded for this single submission. */
  xpEarned: number;
  /** Student's running XP total after this award (if reported). */
  totalXp: number;
  /** Whether this submission crossed a level boundary. */
  levelUp: boolean;
  /** Student's level after this submission. */
  newLevel: number;
  /** Current day-streak after this submission. */
  currentStreak: number;
}

export interface EvaluationSubmitResponse {
  success: boolean;
  evaluationId: string;
  competencyUpdates?: CompetencyUpdateSuggestion[];
  /** The curriculum skill the backend resolved this attempt to, when confident. */
  demonstratedSkill?: DemonstratedSkill;
  /** XP / level / streak awarded for this submission, when the backend reported it. */
  engagement?: SubmissionEngagement;
  message?: string;
}

/** The curriculum-bearing fields the backend promotes onto the submission review. */
interface BackendReview {
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  skill_description?: string;
  subskill_description?: string;
  /** Parent curriculum unit (Subject > Unit > Skill > Subskill). Present on
   *  retrieval-resolved mappings; blank on the generation/fallback path. */
  unit_id?: string;
  unit_title?: string;
  mapping_confidence?: number | null;
  [key: string]: unknown;
}

/** Backend SubmissionResult shape from /api/problems/submit */
interface BackendSubmissionResult {
  review: BackendReview;
  competency: Record<string, unknown>;
  points_earned: number;
  encouraging_message: string;
  student_id?: number;
  user_id?: string;
  xp_earned?: number;
  total_xp?: number;
  streak_bonus_xp?: number;
  level_up?: boolean;
  new_level?: number;
  current_streak?: number;
}

/**
 * Build a DemonstratedSkill from the backend review — but only when the backend
 * actually resolved a real curriculum skill (a named subskill, not a sentinel
 * like `*_subskill` / `unknown`). On a low-confidence or failed mapping there's
 * nothing honest to claim, so we return undefined and the lesson summary simply
 * omits it.
 */
function extractDemonstratedSkill(
  review: BackendReview,
  result: PrimitiveEvaluationResult
): DemonstratedSkill | undefined {
  const subskillId = review.subskill_id || result.subskillId || '';
  const skillDescription = review.skill_description || '';
  const isSentinel =
    !subskillId ||
    subskillId === 'unknown' ||
    subskillId === 'free-form' ||
    subskillId.endsWith('_subskill');

  if (isSentinel || !skillDescription) return undefined;

  // Last-line display guard: never tell a student they demonstrated a skill on a
  // low-confidence mapping. The backend already abstains on weak/diffuse retrieval
  // matches (so accepted ones clear ~0.6 cosine); this also catches a low-confidence
  // mapping from the legacy generation path. Mappings with no confidence reported
  // (null) are treated as the older trusted path and allowed through.
  const DISPLAY_CONFIDENCE_FLOOR = 0.6;
  const mappingConfidence = review.mapping_confidence ?? null;
  if (mappingConfidence !== null && mappingConfidence < DISPLAY_CONFIDENCE_FLOOR) {
    return undefined;
  }

  return {
    attemptId: result.attemptId,
    primitiveType: result.primitiveType,
    subject: review.subject || 'general',
    skillId: review.skill_id || result.skillId || result.primitiveType,
    subskillId,
    skillDescription,
    subskillDescription: review.subskill_description || '',
    unitId: review.unit_id || '',
    unitTitle: review.unit_title || '',
    score: result.score,
    success: result.success,
    mappingConfidence: review.mapping_confidence ?? null,
  };
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
    curriculum_subject?: string;
    primitive_domain?: string;
    primitive_description?: string;
    id_source?: string;
  };
  source?: 'lesson' | 'practice';
} {
  const idSource = result.lessonContext?.idSource;
  const hasRealIds = !!result.skillId && !!result.subskillId && idSource !== 'free-form';

  // Catalog identity for the primitive — lets the backend scope curriculum
  // retrieval to the right subject and use the rich description as the embedding
  // signal (QA_curriculum_mapping_misattribution §8).
  const primitiveComponent = getComponentById(result.primitiveType);
  const primitiveDomain = getDomainById(result.primitiveType);
  const primitiveDescription = primitiveComponent?.description;

  // Per-challenge curriculum signal: the catalog description of the eval mode the
  // student actually exercised (e.g. 'plot' -> "Place value on number line with full
  // guidance."). This is what lets retrieval pin the right curriculum unit+skill for a
  // cross-cutting primitive — without it the backend embeds the omnibus K-12 blurb,
  // which dilutes to the range-average and abstains. Keyed by evalMode, so it's exact
  // for single-mode sessions; in auto/mixed it reflects the session's primary mode.
  const activeEvalMode = result.metrics?.evalMode;
  const evalModeDescription = activeEvalMode
    ? primitiveComponent?.evalModes?.find((m) => m.evalMode === activeEvalMode)?.description
    : undefined;

  // Subject resolution:
  // - Authoritative IDs with curriculum subject → use it directly
  // - Free-form (no canonical IDs) → 'auto' triggers CurriculumMappingService
  // - No context at all → 'auto' (safer than guessing 'language_arts')
  const resolvedSubject = hasRealIds && result.lessonContext?.curriculumSubject
    ? result.lessonContext.curriculumSubject
    : 'auto';

  // Skill/subskill resolution:
  // - With real IDs → send them
  // - Free-form → send 'free-form' sentinel (not fake _skill/_subskill patterns)
  const resolvedSkillId = hasRealIds ? result.skillId! : 'free-form';
  const resolvedSubskillId = hasRealIds ? result.subskillId! : 'free-form';

  return {
    subject: resolvedSubject,
    problem: {
      problem_type: 'lumina_primitive',
      id: result.attemptId,
      primitive_type: result.primitiveType,
      skill_id: resolvedSkillId,
      subskill_id: resolvedSubskillId,
    },
    skill_id: resolvedSkillId,
    subskill_id: resolvedSubskillId,
    student_answer: `${result.primitiveType} — ${result.score}%`,
    canvas_used: false,
    primitive_response: {
      pre_evaluated: true,
      success: result.success,
      score: result.score,
      metrics: evalModeDescription
        ? { ...result.metrics, evalModeDescription }
        : result.metrics,
      eval_mode: result.metrics?.evalMode || 'default',
      duration_ms: result.durationMs,
      started_at: result.startedAt,
      completed_at: result.completedAt,
      student_work: result.studentWork,
    },
    // Lesson context — always include for curriculum mapping (even free-form needs topic/grade)
    lesson_context: {
      topic: result.lessonContext?.topic,
      grade_level: result.lessonContext?.gradeLevel,
      component_intent: result.lessonContext?.componentIntent,
      primitive_type: result.lessonContext?.primitiveType || (result.primitiveType as string),
      objective_text: result.lessonContext?.objectiveText,
      curriculum_subject: result.lessonContext?.curriculumSubject,
      primitive_domain: primitiveDomain,
      primitive_description: primitiveDescription,
      id_source: idSource || (hasRealIds ? 'curriculum' : 'free-form'),
    },
    // Eval source tagging (PRD 6.1): explicit from result, or derived from lessonContext
    source: result.source ?? (result.lessonContext ? 'lesson' : 'practice'),
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

    // Un-discard the backend's curriculum verdict: the resolved subskill +
    // human-readable names ride back on `response.review`. This is the data the
    // client cannot self-source on a free-typed lesson.
    const demonstratedSkill = extractDemonstratedSkill(response.review || {}, result);

    // Promote the engagement reward (flattened onto the response by the backend
    // decorator) so the lesson summary can show real session XP/level/streak.
    const engagement: SubmissionEngagement | undefined =
      response.xp_earned !== undefined || response.new_level !== undefined
        ? {
            xpEarned: response.xp_earned ?? 0,
            totalXp: response.total_xp ?? 0,
            levelUp: response.level_up ?? false,
            newLevel: response.new_level ?? 0,
            currentStreak: response.current_streak ?? 0,
          }
        : undefined;

    return {
      success: true,
      evaluationId: result.attemptId,
      competencyUpdates,
      demonstratedSkill,
      engagement,
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
  // DEFERRED: the backend /api/evaluations/submit-batch route is intentionally
  // not registered (see backend/app/api/endpoints/evaluations.py — the slice is
  // history+stats only). Callers should drain evaluations one-by-one through
  // submitEvaluationToBackend (/api/problems/submit), which is the live pipeline.
  // This stub fails loudly instead of silently 404-spamming the dead route.
  void results;
  void studentId;
  throw new Error(
    '[evaluationApi] submitBatchEvaluations is disabled: /api/evaluations/submit-batch ' +
      'is deferred. Submit evaluations individually via submitEvaluationToBackend.'
  );
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
 * A single row of durable student activity history, as served by
 * GET /api/evaluations/student/{id}/history. This is a lean projection of the
 * stored attempt log — not the full client-side PrimitiveEvaluationResult.
 */
export interface ActivityHistoryRow {
  attemptId: string | null;
  primitiveType: string;
  evalMode: string;
  skillId: string | null;
  subskillId: string | null;
  subject: string | null;
  score: number;          // 0-100
  success: boolean;
  source: string | null;  // 'lesson' | 'practice'
  completedAt: string | null;  // ISO timestamp
}

export interface ActivityHistoryResponse {
  evaluations: ActivityHistoryRow[];
  total: number;
  hasMore: boolean;
}

/** Per-group aggregate used in ActivityStatsResponse. */
export interface ActivityGroupStats {
  attempts: number;
  successRate: number;   // 0-1
  averageScore: number;  // 0-100
}

export interface ActivityStatsResponse {
  totalAttempts: number;
  successRate: number;   // 0-1
  averageScore: number;  // 0-100
  byPrimitiveType: Record<string, ActivityGroupStats>;
  bySkill: Record<string, ActivityGroupStats>;
  recentTrend: 'improving' | 'stable' | 'declining';
  engagement: {
    totalXp: number;
    currentLevel: number;
    currentStreak: number;
  } | null;
}

/**
 * Get evaluation/activity history for a student.
 *
 * @param studentId - Student ID
 * @param options - Query options
 * @returns Paginated rows of past activity (newest first)
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
): Promise<ActivityHistoryResponse> {
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
): Promise<ActivityStatsResponse> {
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
 * Full captured metadata for one attempt, resolved from its review — the rich
 * `metrics` blob plus analysis/feedback/student-work. Backs the drill-down viewer.
 */
export interface ActivityDetail {
  reviewId: string | null;
  problemId: string | null;
  primitiveType: string;
  evalMode: string;
  score: number;          // 0-100
  success: boolean;
  source: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  skillId: string | null;
  subskillId: string | null;
  subject: string | null;
  /** Per-primitive measurements + cross-cutting aiAssistance. The main attraction. */
  metrics: Record<string, unknown> | null;
  analysis: unknown;
  feedback: unknown;
  observation: unknown;
  studentWork: unknown;
}

/**
 * Fetch the full captured metadata for one attempt. Reviews carry the shared
 * attempt_id stamped at submission, so pass attemptId for a direct join; the
 * subskill + nearest-timestamp fields remain as a fallback for legacy rows.
 */
export async function getActivityDetail(
  studentId: number,
  opts: {
    attemptId?: string | null;
    subskillId?: string | null;
    timestamp?: string | null;
    primitiveType?: string | null;
  }
): Promise<ActivityDetail> {
  const params = new URLSearchParams();
  if (opts.attemptId) params.append('attempt_id', opts.attemptId);
  if (opts.subskillId) params.append('subskill_id', opts.subskillId);
  if (opts.timestamp) params.append('timestamp', opts.timestamp);
  if (opts.primitiveType) params.append('primitive_type', opts.primitiveType);
  const queryString = params.toString();
  const endpoint = `/api/evaluations/student/${studentId}/attempt-detail${queryString ? `?${queryString}` : ''}`;
  return authApi.get(endpoint);
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
