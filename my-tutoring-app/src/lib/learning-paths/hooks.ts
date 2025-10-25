/**
 * React Query hooks for Learning Paths
 *
 * These hooks provide access to the BigQuery-backed prerequisite graph system
 * with intelligent caching and automatic refetching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/authApiClient';
import type {
  StudentGraphResponse,
  VisualizationResponse,
  RecommendationsResponse,
  UnlockedEntitiesResponse,
  SkillDetailsResponse,
  PrerequisiteCheckResponse
} from '@/types/learning-paths';

// ==================== QUERY KEYS ====================
// Centralized query keys for cache management

export const LEARNING_PATHS_KEYS = {
  /**
   * Key for Student State Engine graph
   * This is the PRIMARY data source for learning paths
   */
  studentGraph: (subjectId: string, studentId: number, includeDrafts: boolean = false) =>
    ['learning-paths', 'student-graph', subjectId, studentId, includeDrafts] as const,

  /**
   * Key for graph visualization (alternative view)
   */
  visualization: (subject: string, studentId: number) =>
    ['learning-paths', 'visualization', subject, studentId] as const,

  /**
   * Key for personalized recommendations
   */
  recommendations: (studentId: number, subject?: string) =>
    ['learning-paths', 'recommendations', studentId, subject] as const,

  /**
   * Key for unlocked entities list
   */
  unlocked: (studentId: number, subject?: string, entityType?: string) =>
    ['learning-paths', 'unlocked', studentId, subject, entityType] as const,

  /**
   * Key for detailed skill information
   */
  skillDetails: (skillId: string, studentId?: number) =>
    ['learning-paths', 'skill-details', skillId, studentId] as const,

  /**
   * Key for prerequisite check
   */
  prerequisiteCheck: (studentId: number, entityId: string) =>
    ['learning-paths', 'prerequisite-check', studentId, entityId] as const,
};

// ==================== QUERY HOOKS ====================

/**
 * Hook for Student State Engine - PRIMARY hook for learning paths
 *
 * Returns a complete curriculum graph where each node includes:
 * - student_proficiency: Current proficiency (0.0-1.0)
 * - status: LOCKED | UNLOCKED | IN_PROGRESS | MASTERED
 * - attempt_count: Number of practice attempts
 * - last_attempt_at: Timestamp of last attempt
 *
 * Uses Firestore cache for ~50ms loads (vs 2-5s generation)
 *
 * @param subjectId - Subject identifier (e.g., "MATHEMATICS")
 * @param studentId - Student ID
 * @param includeDrafts - Include draft curriculum (default: false)
 *
 * @example
 * ```typescript
 * const { data: graph, isLoading } = useStudentGraph('MATHEMATICS', studentId);
 *
 * const lockedNodes = graph?.nodes.filter(n => n.status === 'LOCKED');
 * const readyToLearn = graph?.nodes.filter(n => n.status === 'UNLOCKED');
 * ```
 */
export function useStudentGraph(
  subjectId: string | undefined,
  studentId: number | undefined,
  includeDrafts: boolean = false
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.studentGraph(subjectId!, studentId!, includeDrafts),
    queryFn: () => authApi.getStudentGraph(subjectId!, studentId!, includeDrafts) as Promise<StudentGraphResponse>,
    enabled: !!subjectId && !!studentId,
    staleTime: 5 * 60 * 1000, // 5 minutes - graph changes slowly
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
  });
}

/**
 * Hook for graph visualization with nested skills/subskills
 *
 * Alternative to useStudentGraph with a hierarchical structure.
 * Better for displaying skills grouped with their subskills.
 *
 * @param subject - Subject filter (optional)
 * @param studentId - Student ID
 *
 * @example
 * ```typescript
 * const { data } = useGraphVisualization('Mathematics', studentId);
 *
 * data?.skills.forEach(skill => {
 *   skill.subskills.forEach(subskill => {
 *     if (subskill.student_data?.unlocked) {
 *       // Show as available
 *     }
 *   });
 * });
 * ```
 */
export function useGraphVisualization(
  subject: string | undefined,
  studentId: number | undefined
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.visualization(subject!, studentId!),
    queryFn: () => authApi.getLearningGraphVisualization(subject, studentId) as Promise<VisualizationResponse>,
    enabled: !!subject && !!studentId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for personalized learning recommendations
 *
 * Returns recommended subskills based on:
 * - Prerequisites met (unlocked)
 * - Current proficiency (not yet mastered)
 * - Priority (coverage gaps > performance gaps > nearly mastered)
 *
 * @param studentId - Student ID
 * @param subject - Subject filter (optional)
 * @param limit - Number of recommendations (default: 5)
 *
 * @example
 * ```typescript
 * const { data } = useRecommendations(studentId, 'Mathematics', 5);
 *
 * data?.recommendations.forEach(rec => {
 *   console.log(rec.message); // "Ready to start" or "Continue practicing"
 *   console.log(rec.priority); // "high" or "medium"
 * });
 * ```
 */
export function useRecommendations(
  studentId: number | undefined,
  subject?: string,
  limit: number = 5
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.recommendations(studentId!, subject),
    queryFn: () => authApi.getLearningRecommendations(studentId!, subject, limit) as Promise<RecommendationsResponse>,
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000, // 2 minutes - recommendations change more frequently
    refetchOnWindowFocus: true, // Refetch when user returns to see latest
  });
}

/**
 * Hook for getting all unlocked entities for a student
 *
 * @param studentId - Student ID
 * @param entityType - Filter by 'skill' or 'subskill' (optional)
 * @param subject - Subject filter (optional)
 *
 * @example
 * ```typescript
 * const { data } = useUnlockedEntities(studentId, 'subskill', 'Mathematics');
 *
 * console.log(data?.unlocked_entities); // ['COUNT001-01-A', 'COUNT001-01-B', ...]
 * console.log(data?.count); // 15
 * ```
 */
export function useUnlockedEntities(
  studentId: number | undefined,
  entityType?: 'skill' | 'subskill',
  subject?: string
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.unlocked(studentId!, subject, entityType),
    queryFn: () => authApi.getUnlockedEntities(studentId!, entityType, subject) as Promise<UnlockedEntitiesResponse>,
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for getting detailed skill information
 *
 * Returns comprehensive information about a skill including:
 * - All subskills with sequence order
 * - Prerequisites and unlocks
 * - Student progress data (if studentId provided)
 *
 * @param skillId - Skill ID to fetch details for
 * @param studentId - Student ID for progress data (optional)
 *
 * @example
 * ```typescript
 * const { data } = useSkillDetails('COUNT001-01', studentId);
 *
 * data?.subskills.forEach(subskill => {
 *   console.log(subskill.sequence_order);
 *   console.log(subskill.student_data?.proficiency);
 * });
 * ```
 */
export function useSkillDetails(
  skillId: string | undefined,
  studentId?: number
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.skillDetails(skillId!, studentId),
    queryFn: () => authApi.getSkillDetails(skillId!, studentId) as Promise<SkillDetailsResponse>,
    enabled: !!skillId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for checking if specific entity is unlocked for student
 *
 * Returns detailed prerequisite status for a single entity.
 *
 * @param studentId - Student ID
 * @param entityId - Entity ID to check
 * @param entityType - 'skill' or 'subskill' (optional, auto-detected if not provided)
 *
 * @example
 * ```typescript
 * const { data } = usePrerequisiteCheck(studentId, 'COUNT001-01-A');
 *
 * if (data?.unlocked) {
 *   // Show as available
 * } else {
 *   // Show prerequisites needed
 *   data?.prerequisites.forEach(prereq => {
 *     if (!prereq.met) {
 *       console.log(`Need ${prereq.prerequisite_id}: ${prereq.current_proficiency}/${prereq.required_threshold}`);
 *     }
 *   });
 * }
 * ```
 */
export function usePrerequisiteCheck(
  studentId: number | undefined,
  entityId: string | undefined,
  entityType?: 'skill' | 'subskill'
) {
  return useQuery({
    queryKey: LEARNING_PATHS_KEYS.prerequisiteCheck(studentId!, entityId!),
    queryFn: () => authApi.checkPrerequisites(studentId!, entityId!, entityType) as Promise<PrerequisiteCheckResponse>,
    enabled: !!studentId && !!entityId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ==================== MUTATION HOOKS ====================

/**
 * Mutation hook to invalidate learning paths data after practice
 *
 * Call this after completing a practice session to refresh all learning path data
 * for the student. This ensures the UI reflects the latest proficiency and unlock status.
 *
 * @example
 * ```typescript
 * const invalidate = useInvalidateLearningPaths();
 *
 * // After practice session
 * await invalidate.mutateAsync({
 *   studentId: 123,
 *   subject: 'MATHEMATICS'
 * });
 * ```
 */
export function useInvalidateLearningPaths() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, subject }: { studentId: number; subject: string }) => {
      // This doesn't call an API, just invalidates cache
      return { studentId, subject };
    },
    onSuccess: ({ studentId, subject }) => {
      // Invalidate all learning paths queries for this student
      queryClient.invalidateQueries({
        queryKey: ['learning-paths']
      });

      console.log(`✅ Invalidated learning paths cache for student ${studentId}, subject ${subject}`);
    },
  });
}

/**
 * Hook to manually refetch student graph
 *
 * Useful for "Refresh" buttons to get latest data
 *
 * @example
 * ```typescript
 * const { refetch, isRefetching } = useStudentGraph(subject, studentId);
 *
 * <Button onClick={() => refetch()} disabled={isRefetching}>
 *   Refresh
 * </Button>
 * ```
 */
export function useRefreshLearningPaths(
  subjectId: string | undefined,
  studentId: number | undefined
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!subjectId || !studentId) {
        throw new Error('Subject ID and Student ID required');
      }

      // Invalidate and refetch
      await queryClient.invalidateQueries({
        queryKey: LEARNING_PATHS_KEYS.studentGraph(subjectId, studentId),
      });

      return { subjectId, studentId };
    },
  });
}
