// hooks/useParentPortal.ts - React hooks for Parent Portal data fetching
import useSWR from 'swr';
import { parentPortalApi } from '@/lib/parentPortalApi';
import type {
  ParentAccount,
  ParentDashboard,
  TodaysPlanSummary,
  WeeklySummaryMetrics,
  WeeklyExplorerResponse,
  SessionHistoryResponse,
} from '@/lib/parentPortalApi';

// ============================================================================
// PARENT ACCOUNT HOOKS
// ============================================================================

export function useParentAccount() {
  const { data, error, mutate, isLoading } = useSWR<ParentAccount>(
    'parent-account',
    async () => {
      try {
        return await parentPortalApi.getParentAccount();
      } catch (error: any) {
        // If account doesn't exist (404), try to create it
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          console.log('Parent account not found, creating new account...');
          const response = await parentPortalApi.createParentAccount();
          return response.parent_account;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    parentAccount: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

export function useLinkedStudents() {
  const { data, error, mutate, isLoading, isValidating } = useSWR<{ students: number[]; total: number }>(
    'linked-students',
    () => parentPortalApi.getLinkedStudents(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  const linkStudent = async (studentId: number, relationship: string = 'parent') => {
    try {
      const response = await parentPortalApi.linkStudent(studentId, relationship);
      // Revalidate linked students list
      await mutate();
      return response;
    } catch (error) {
      console.error('Failed to link student:', error);
      throw error;
    }
  };

  return {
    students: data?.students || [],
    totalStudents: data?.total || 0,
    // Only show loading during initial load, not during background revalidation
    loading: isLoading,
    error,
    linkStudent,
    refetch: mutate,
  };
}

export function useParentOnboarding() {
  const completeOnboarding = async (notificationPreferences?: {
    weekly_digest?: boolean;
    daily_summary?: boolean;
    milestone_alerts?: boolean;
    struggle_alerts?: boolean;
  }) => {
    try {
      const response = await parentPortalApi.completeOnboarding(notificationPreferences);
      return response;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    }
  };

  const updateNotificationPreferences = async (preferences: {
    weekly_digest?: boolean;
    daily_summary?: boolean;
    milestone_alerts?: boolean;
    struggle_alerts?: boolean;
  }) => {
    try {
      const response = await parentPortalApi.updateNotificationPreferences(preferences);
      return response;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  };

  return {
    completeOnboarding,
    updateNotificationPreferences,
  };
}

// ============================================================================
// DASHBOARD HOOKS (Phase 1)
// ============================================================================

export function useParentDashboard(studentId: number | null) {
  const { data, error, mutate, isLoading } = useSWR<ParentDashboard>(
    studentId ? `parent-dashboard-${studentId}` : null,
    () => studentId ? parentPortalApi.getParentDashboard(studentId) : null,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000, // 1 minute
      refreshInterval: 300000, // Auto-refresh every 5 minutes
    }
  );

  return {
    dashboard: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

export function useTodaysPlan(studentId: number | null) {
  const { data, error, mutate, isLoading } = useSWR<TodaysPlanSummary>(
    studentId ? `todays-plan-${studentId}` : null,
    () => studentId ? parentPortalApi.getTodaysPlan(studentId) : null,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    todaysPlan: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

export function useWeeklySummary(studentId: number | null) {
  const { data, error, mutate, isLoading } = useSWR<WeeklySummaryMetrics>(
    studentId ? `weekly-summary-${studentId}` : null,
    () => studentId ? parentPortalApi.getWeeklySummary(studentId) : null,
    {
      revalidateOnFocus: true,
      dedupingInterval: 300000, // 5 minutes (weekly data changes slowly)
    }
  );

  return {
    weeklySummary: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

// ============================================================================
// ANALYTICS HOOKS (Phase 2)
// ============================================================================

export function useParentStudentMetrics(studentId: number | null, subject?: string) {
  const { data, error, mutate, isLoading } = useSWR(
    studentId ? `parent-metrics-${studentId}-${subject || 'all'}` : null,
    () => studentId ? parentPortalApi.getStudentMetrics(studentId, subject) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  return {
    metrics: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

export function useParentStudentTimeseries(
  studentId: number | null,
  params?: { subject?: string; interval?: 'day' | 'week' | 'month' }
) {
  const cacheKey = studentId
    ? `parent-timeseries-${studentId}-${params?.subject || 'all'}-${params?.interval || 'week'}`
    : null;

  const { data, error, mutate, isLoading } = useSWR(
    cacheKey,
    () => studentId ? parentPortalApi.getStudentTimeseries(studentId, params) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  return {
    timeseries: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

// ============================================================================
// WEEKLY EXPLORER HOOKS (Phase 3)
// ============================================================================

export function useWeeklyExplorer(studentId: number | null) {
  const { data, error, mutate, isLoading } = useSWR<WeeklyExplorerResponse>(
    studentId ? `weekly-explorer-${studentId}` : null,
    () => studentId ? parentPortalApi.getWeeklyExplorer(studentId) : null,
    {
      revalidateOnFocus: true,
      dedupingInterval: 3600000, // 1 hour (weekly view updates slowly)
    }
  );

  const prioritizeSubskills = async (subskillIds: string[]) => {
    if (!studentId) return;
    try {
      await parentPortalApi.prioritizeSubskill(studentId, subskillIds);
      // Revalidate explorer data after prioritization
      await mutate();
    } catch (error) {
      console.error('Failed to prioritize subskills:', error);
      throw error;
    }
  };

  const completeProject = async (
    projectId: string,
    data: {
      photo_url?: string;
      parent_notes?: string;
      student_enjoyed?: boolean;
    }
  ) => {
    if (!studentId) return;
    try {
      const response = await parentPortalApi.completeExplorerProject(studentId, projectId, data);
      // Revalidate explorer data after completion
      await mutate();
      return response;
    } catch (error) {
      console.error('Failed to complete project:', error);
      throw error;
    }
  };

  return {
    explorer: data,
    loading: isLoading,
    error,
    refetch: mutate,
    prioritizeSubskills,
    completeProject,
  };
}

// ============================================================================
// SESSION HISTORY HOOKS (Phase 4)
// ============================================================================

export function useSessionHistory(studentId: number | null, limit: number = 20) {
  const { data, error, mutate, isLoading } = useSWR<SessionHistoryResponse>(
    studentId ? `session-history-${studentId}-${limit}` : null,
    () => studentId ? parentPortalApi.getSessionHistory(studentId, limit) : null,
    {
      revalidateOnFocus: true,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  return {
    sessionHistory: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

export function useParentPortalHealth() {
  const { data, error, isLoading } = useSWR(
    'parent-portal-health',
    () => parentPortalApi.getHealth(),
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
