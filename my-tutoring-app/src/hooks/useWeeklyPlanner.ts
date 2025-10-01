// hooks/useWeeklyPlanner.ts - React hooks for Weekly Planner data fetching
import useSWR from 'swr';
import { weeklyPlannerApi, getCurrentWeekMonday } from '@/lib/weeklyPlannerApi';
import type {
  WeeklyPlan,
  WeeklyPlanStatus,
  DayActivitiesResponse,
  ActivityStatus,
} from '@/lib/weeklyPlannerApi';

// ============================================================================
// WEEKLY PLAN HOOKS
// ============================================================================

/**
 * Hook to fetch the current week's learning plan
 */
export function useWeeklyPlan(studentId: number | null) {
  const { data, error, mutate, isLoading } = useSWR<WeeklyPlan>(
    studentId ? `weekly-plan-current-${studentId}` : null,
    async () => {
      if (!studentId) return null;
      try {
        return await weeklyPlannerApi.getCurrentWeeklyPlan(studentId);
      } catch (error: any) {
        // If no plan exists (404), return null instead of throwing
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          console.log('No weekly plan found for student', studentId);
          return null;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000, // 1 minute
      refreshInterval: 300000, // Auto-refresh every 5 minutes
    }
  );

  return {
    weeklyPlan: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

/**
 * Hook to fetch a specific week's learning plan
 */
export function useWeeklyPlanByDate(studentId: number | null, weekStartDate: string | null) {
  const { data, error, mutate, isLoading } = useSWR<WeeklyPlan>(
    studentId && weekStartDate ? `weekly-plan-${studentId}-${weekStartDate}` : null,
    async () => {
      if (!studentId || !weekStartDate) return null;
      try {
        return await weeklyPlannerApi.getWeeklyPlanByDate(studentId, weekStartDate);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000,
    }
  );

  return {
    weeklyPlan: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

/**
 * Hook to fetch weekly plan status summary
 */
export function useWeeklyPlanStatus(studentId: number | null, weekStartDate?: string) {
  const { data, error, mutate, isLoading } = useSWR<WeeklyPlanStatus>(
    studentId ? `weekly-plan-status-${studentId}-${weekStartDate || 'current'}` : null,
    async () => {
      if (!studentId) return null;
      try {
        return await weeklyPlannerApi.getWeeklyPlanStatus(studentId, weekStartDate);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000,
    }
  );

  return {
    status: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

/**
 * Hook to fetch activities for a specific day
 */
export function useDayActivities(
  studentId: number | null,
  dayIndex: number | null,
  weekStartDate?: string
) {
  const { data, error, mutate, isLoading } = useSWR<DayActivitiesResponse>(
    studentId !== null && dayIndex !== null
      ? `day-activities-${studentId}-${dayIndex}-${weekStartDate || 'current'}`
      : null,
    async () => {
      if (studentId === null || dayIndex === null) return null;
      try {
        return await weeklyPlannerApi.getActivitiesForDay(studentId, dayIndex, weekStartDate);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  return {
    dayActivities: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

// ============================================================================
// ACTIVITY MUTATION HOOKS
// ============================================================================

/**
 * Hook to provide activity mutation functions
 */
export function useActivityMutations(studentId: number | null) {
  const { refetch: refetchPlan } = useWeeklyPlan(studentId);

  /**
   * Mark an activity as complete
   */
  const markActivityComplete = async (activityUid: string, weekStartDate?: string) => {
    if (!studentId) {
      throw new Error('Student ID is required');
    }

    try {
      const response = await weeklyPlannerApi.markActivityComplete(
        studentId,
        activityUid,
        weekStartDate
      );

      // Revalidate the weekly plan after completion
      await refetchPlan();

      return response;
    } catch (error) {
      console.error('Failed to mark activity complete:', error);
      throw error;
    }
  };

  /**
   * Toggle star/prioritization on an activity
   */
  const toggleStarActivity = async (
    activityUid: string,
    isStarred: boolean,
    weekStartDate?: string
  ) => {
    if (!studentId) {
      throw new Error('Student ID is required');
    }

    try {
      const response = await weeklyPlannerApi.toggleStarActivity(
        studentId,
        activityUid,
        isStarred,
        weekStartDate
      );

      // Revalidate the weekly plan after starring
      await refetchPlan();

      return response;
    } catch (error) {
      console.error('Failed to toggle star activity:', error);
      throw error;
    }
  };

  return {
    markActivityComplete,
    toggleStarActivity,
  };
}

// ============================================================================
// PLAN GENERATION HOOKS (Admin/Testing)
// ============================================================================

/**
 * Hook to provide plan generation functions for testing
 */
export function useWeeklyPlanGeneration(studentId: number | null) {
  const { refetch: refetchPlan } = useWeeklyPlan(studentId);

  /**
   * Generate a new weekly plan (manual trigger)
   */
  const generatePlan = async (params?: {
    week_start_date?: string;
    target_activities?: number;
    force_regenerate?: boolean;
  }) => {
    if (!studentId) {
      throw new Error('Student ID is required');
    }

    try {
      const response = await weeklyPlannerApi.generateWeeklyPlan(studentId, params);

      // Revalidate after generation
      await refetchPlan();

      return response;
    } catch (error) {
      console.error('Failed to generate weekly plan:', error);
      throw error;
    }
  };

  /**
   * Delete a weekly plan
   */
  const deletePlan = async (weekStartDate: string) => {
    if (!studentId) {
      throw new Error('Student ID is required');
    }

    try {
      const response = await weeklyPlannerApi.deleteWeeklyPlan(studentId, weekStartDate);

      // Revalidate after deletion
      await refetchPlan();

      return response;
    } catch (error) {
      console.error('Failed to delete weekly plan:', error);
      throw error;
    }
  };

  return {
    generatePlan,
    deletePlan,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to check if weekly planner service is healthy
 */
export function useWeeklyPlannerHealth() {
  const { data, error, isLoading } = useSWR(
    'weekly-planner-health',
    () => weeklyPlannerApi.getHealth(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    health: data,
    loading: isLoading,
    error,
  };
}

/**
 * Hook to get the current week's Monday date
 */
export function useCurrentWeekMonday(): string {
  return getCurrentWeekMonday();
}

/**
 * Hook to compute weekly plan progress metrics
 */
export function useWeeklyPlanProgress(weeklyPlan: WeeklyPlan | null | undefined) {
  if (!weeklyPlan) {
    return {
      totalActivities: 0,
      completedActivities: 0,
      assignedActivities: 0,
      pendingActivities: 0,
      progressPercentage: 0,
      activitiesByDay: [],
      activitiesByStatus: {
        pending: 0,
        assigned: 0,
        completed: 0,
        skipped: 0,
      },
      activitiesBySubject: {},
    };
  }

  const totalActivities = weeklyPlan.total_activities;
  const completedActivities = weeklyPlan.completed_activities;
  const assignedActivities = weeklyPlan.assigned_activities;
  const pendingActivities = weeklyPlan.planned_activities.filter(
    (a) => a.status === 'pending'
  ).length;
  const progressPercentage =
    totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

  // Group by day
  const activitiesByDay = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    activities: weeklyPlan.planned_activities.filter((a) => a.planned_day === i),
  }));

  // Group by status
  const activitiesByStatus = weeklyPlan.planned_activities.reduce(
    (acc, activity) => {
      acc[activity.status] = (acc[activity.status] || 0) + 1;
      return acc;
    },
    { pending: 0, assigned: 0, completed: 0, skipped: 0 } as Record<ActivityStatus, number>
  );

  // Group by subject
  const activitiesBySubject = weeklyPlan.planned_activities.reduce(
    (acc, activity) => {
      acc[activity.subject] = (acc[activity.subject] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalActivities,
    completedActivities,
    assignedActivities,
    pendingActivities,
    progressPercentage,
    activitiesByDay,
    activitiesByStatus,
    activitiesBySubject,
  };
}
