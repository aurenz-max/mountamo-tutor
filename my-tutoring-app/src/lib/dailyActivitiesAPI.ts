// lib/dailyActivitiesAPI.ts - FIXED VERSION WITH PROPER AUTH

export interface DailyActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  estimated_time: string;
  points: number;
  priority: string;
  time_slot: string;
  action: string;
  endpoint: string;
  icon_type: string;
  is_completed: boolean;
  metadata: Record<string, any>;
}

export interface DailyProgress {
  completed_activities: number;
  total_activities: number;
  points_earned_today: number;
  daily_goal: number;
  current_streak: number;
  progress_percentage: number;
}

export interface DailyGoals {
  daily_points_target: number;
  activities_target: number;
  streak_goal: number;
  focus_areas: string[];
}

export interface DailyPlan {
  student_id: number;
  date: string;
  activities: DailyActivity[];
  progress: DailyProgress;
  goals: DailyGoals;
  personalization_factors: Record<string, any>;
}

export interface ActivityCompletionRequest {
  activity_id: string;
  completion_time_seconds?: number;
  points_earned?: number;
  accuracy_percentage?: number;
  metadata?: Record<string, any>;
}

export interface ActivityCompletionResponse {
  success: boolean;
  activity_id: string;
  points_awarded: number;
  new_total_points: number;
  achievements: string[];
  level_up: boolean;
  message: string;
}

export interface DailyStats {
  student_id: number;
  date: string;
  activities_completed: number;
  total_activities: number;
  points_earned_today: number;
  daily_goal_progress: number;
  current_streak: number;
  completion_rate: number;
}

export interface ActivitySuggestion {
  student_id: number;
  context: string;
  suggestions: DailyActivity[];
  total_available: number;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  api_endpoints: Record<string, string>;
  authentication: string;
  user_context: Record<string, any>;
  timestamp: string;
}

// FIXED: Main API Class with proper auth integration
export class DailyActivitiesAPI {
  private baseURL: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(baseURL: string = '/api/daily-activities', getAuthToken: () => Promise<string | null>) {
    this.baseURL = baseURL;
    this.getAuthToken = getAuthToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    
    // Check if we have a valid token
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Main API Methods
  async getDailyPlan(studentId: number, date?: string, refresh?: boolean): Promise<DailyPlan> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (refresh) params.append('refresh', 'true');
    
    const queryString = params.toString();
    const endpoint = `/student/${studentId}/daily-plan${queryString ? `?${queryString}` : ''}`;
    
    return this.request<DailyPlan>(endpoint);
  }

  async completeActivity(
    studentId: number, 
    completionData: ActivityCompletionRequest
  ): Promise<ActivityCompletionResponse> {
    return this.request<ActivityCompletionResponse>(
      `/student/${studentId}/complete-activity`,
      {
        method: 'POST',
        body: JSON.stringify(completionData),
      }
    );
  }

  async getDailyStats(studentId: number, date?: string): Promise<DailyStats> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    const endpoint = `/student/${studentId}/daily-stats${queryString ? `?${queryString}` : ''}`;
    
    return this.request<DailyStats>(endpoint);
  }

  async getActivitySuggestions(
    studentId: number, 
    context: string = 'general', 
    limit: number = 3
  ): Promise<ActivitySuggestion> {
    const params = new URLSearchParams({
      context,
      limit: limit.toString(),
    });
    
    return this.request(`/student/${studentId}/activity-suggestions?${params}`);
  }

  async refreshDailyPlan(studentId: number, date?: string): Promise<{ success: boolean, plan: DailyPlan }> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    const endpoint = `/student/${studentId}/refresh-plan${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint, { method: 'POST' });
  }

  // Utility Methods
  async getActivityTypes(): Promise<Record<string, any>> {
    return this.request('/activities/types');
  }

  async getTimeSlots(): Promise<Record<string, any>> {
    return this.request('/time-slots');
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request('/health');
  }

  // Test Methods (for development)
  async generateSamplePlan(studentId?: number): Promise<Record<string, any>> {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId.toString());
    
    const queryString = params.toString();
    const endpoint = `/test/generate-sample-plan${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint, { method: 'POST' });
  }
}

// FIXED: Remove the pre-configured instance that uses localStorage
// Instead, provide a factory function that requires auth token getter

export const createDailyActivitiesApi = (getAuthToken: () => Promise<string | null>) => {
  return new DailyActivitiesAPI(
    process.env.NEXT_PUBLIC_API_BASE_URL ? 
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/daily-activities` : 
      '/api/daily-activities',
    getAuthToken
  );
};

// React Hook for Daily Activities - FIXED with proper auth integration
import { useState, useEffect, useCallback } from 'react';

export interface UseDailyActivitiesOptions {
  studentId: number;
  getAuthToken: () => Promise<string | null>; // FIXED: Require auth token getter
  autoRefresh?: boolean;
  refreshInterval?: number;
  date?: string;
}

export interface UseDailyActivitiesReturn {
  dailyPlan: DailyPlan | null;
  dailyStats: DailyStats | null;
  loading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  completeActivity: (activityId: string, completionData?: Partial<ActivityCompletionRequest>) => Promise<ActivityCompletionResponse>;
  markActivityCompleted: (activityId: string) => void;
  isCompleting: string | null;
}

export function useDailyActivities({
  studentId,
  getAuthToken,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  date
}: UseDailyActivitiesOptions): UseDailyActivitiesReturn {
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);

  // Create API instance with proper auth
  const [api, setApi] = useState<DailyActivitiesAPI | null>(null);

  useEffect(() => {
    if (getAuthToken) {
      const apiInstance = createDailyActivitiesApi(getAuthToken);
      setApi(apiInstance);
    }
  }, [getAuthToken]);

  const fetchDailyPlan = useCallback(async () => {
    if (!api) return;
    
    try {
      setError(null);
      const plan = await api.getDailyPlan(studentId, date);
      setDailyPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily plan');
    }
  }, [api, studentId, date]);

  const fetchDailyStats = useCallback(async () => {
    if (!api) return;
    
    try {
      const stats = await api.getDailyStats(studentId, date);
      setDailyStats(stats);
    } catch (err) {
      console.error('Failed to fetch daily stats:', err);
    }
  }, [api, studentId, date]);

  const refreshPlan = useCallback(async () => {
    if (!api) return;
    
    setLoading(true);
    await Promise.all([fetchDailyPlan(), fetchDailyStats()]);
    setLoading(false);
  }, [fetchDailyPlan, fetchDailyStats]);

  const completeActivity = useCallback(async (
    activityId: string, 
    additionalData: Partial<ActivityCompletionRequest> = {}
  ): Promise<ActivityCompletionResponse> => {
    if (!api) {
      throw new Error('API not initialized');
    }
    
    setIsCompleting(activityId);
    
    try {
      const completionData: ActivityCompletionRequest = {
        activity_id: activityId,
        completion_time_seconds: Math.floor(Date.now() / 1000),
        ...additionalData,
      };

      const response = await api.completeActivity(studentId, completionData);
      
      if (response.success) {
        // Update local state immediately for better UX
        setDailyPlan(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            activities: prev.activities.map(activity =>
              activity.id === activityId 
                ? { ...activity, is_completed: true }
                : activity
            ),
            progress: {
              ...prev.progress,
              completed_activities: prev.progress.completed_activities + 1,
              points_earned_today: prev.progress.points_earned_today + response.points_awarded
            }
          };
        });
        
        // Refresh data from server to ensure consistency
        await refreshPlan();
      }
      
      return response;
    } finally {
      setIsCompleting(null);
    }
  }, [api, studentId, refreshPlan]);

  const markActivityCompleted = useCallback((activityId: string) => {
    setDailyPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        activities: prev.activities.map(activity =>
          activity.id === activityId 
            ? { ...activity, is_completed: true }
            : activity
        ),
      };
    });
  }, []);

  useEffect(() => {
    if (api && studentId) {
      refreshPlan();
    }
  }, [api, studentId, refreshPlan]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && api && studentId) {
      const interval = setInterval(refreshPlan, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, api, studentId, refreshPlan]);

  return {
    dailyPlan,
    dailyStats,
    loading,
    error,
    refreshPlan,
    completeActivity,
    markActivityCompleted,
    isCompleting,
  };
}

// Icon mapping for activity types
export const ActivityIcons = {
  zap: '⚡',
  headphones: '🎧',
  target: '🎯',
  eye: '👁️',
  brain: '🧠',
  book: '📖',
  star: '⭐',
  coffee: '☕',
  timer: '⏱️',
  puzzle: '🧩',
  pen: '✏️'
};

// Activity type colors
export const ActivityColors = {
  practice: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  tutoring: 'bg-blue-100 text-blue-800 border-blue-200',
  pathway: 'bg-green-100 text-green-800 border-green-200',
  visual: 'bg-purple-100 text-purple-800 border-purple-200',
  review: 'bg-indigo-100 text-indigo-800 border-indigo-200'
};

// Priority colors
export const PriorityColors = {
  high: 'border-l-red-500 bg-red-50',
  medium: 'border-l-yellow-500 bg-yellow-50', 
  low: 'border-l-green-500 bg-green-50'
};

// Time slot icons and colors - FIXED: Import the actual Lucide React icons
import { Coffee, Star, Clock, Brain } from 'lucide-react';

export const TimeSlotConfig = {
  morning: {
    icon: Coffee,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    name: 'Morning'
  },
  midday: {
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    name: 'Midday'
  },
  afternoon: {
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    name: 'Afternoon'
  },
  evening: {
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    name: 'Evening'
  }
};

// Utility functions for the frontend
export const ActivityUtils = {
  getActivityIcon: (iconType: string): string => {
    return ActivityIcons[iconType as keyof typeof ActivityIcons] || '📚';
  },

  getActivityColor: (type: string): string => {
    return ActivityColors[type as keyof typeof ActivityColors] || 'bg-gray-100 text-gray-800 border-gray-200';
  },

  getPriorityColor: (priority: string): string => {
    return PriorityColors[priority as keyof typeof PriorityColors] || 'border-l-gray-500 bg-gray-50';
  },

  getTimeSlotConfig: (timeSlot: string) => {
    return TimeSlotConfig[timeSlot as keyof typeof TimeSlotConfig] || TimeSlotConfig.morning;
  },

  calculateProgress: (completed: number, total: number): number => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  },

  formatEstimatedTime: (timeString: string): string => {
    return timeString.replace(' min', 'm').replace(' minutes', 'm');
  },

  getActivityRoute: (activity: DailyActivity, studentId: number): string => {
    // Generate routes based on activity type and metadata
    switch (activity.type) {
      case 'practice':
        const targetSubskill = activity.metadata?.target_subskill;
        const difficulty = activity.metadata?.difficulty;
        return `/practice?subskill=${targetSubskill}&difficulty=${difficulty}&source=daily-board`;
      
      case 'tutoring':
        const packageId = activity.metadata?.package_id;
        return `/education/${packageId}`;
      
      case 'pathway':
        return `/learning-paths?source=daily-board`;
      
      case 'visual':
        const filter = activity.metadata?.filter || 'interactive';
        return `/library?filter=${filter}&source=daily-board`;
      
      case 'review':
        const reviewFocus = activity.metadata?.review_focus;
        return `/practice?mode=review&focus=${reviewFocus}&source=daily-board`;
      
      default:
        return activity.endpoint;
    }
  },

  shouldShowActivity: (activity: DailyActivity, currentTimeSlot?: string): boolean => {
    if (!currentTimeSlot) return true;
    
    const timeSlotOrder = ['morning', 'midday', 'afternoon', 'evening'];
    const currentIndex = timeSlotOrder.indexOf(currentTimeSlot);
    const activityIndex = timeSlotOrder.indexOf(activity.time_slot);
    
    return activityIndex >= currentIndex;
  },

  getCurrentTimeSlot: (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 15) return 'midday';
    if (hour < 18) return 'afternoon';
    return 'evening';
  },

  getNextActivities: (activities: DailyActivity[], limit = 3): DailyActivity[] => {
    return activities
      .filter(activity => !activity.is_completed)
      .sort((a, b) => {
        const timeSlotOrder = ['morning', 'midday', 'afternoon', 'evening'];
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        
        const timeSlotComparison = timeSlotOrder.indexOf(a.time_slot) - timeSlotOrder.indexOf(b.time_slot);
        if (timeSlotComparison !== 0) return timeSlotComparison;
        
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      })
      .slice(0, limit);
  },

  groupActivitiesByTimeSlot: (activities: DailyActivity[]): Record<string, DailyActivity[]> => {
    return activities.reduce((acc, activity) => {
      if (!acc[activity.time_slot]) {
        acc[activity.time_slot] = [];
      }
      acc[activity.time_slot].push(activity);
      return acc;
    }, {} as Record<string, DailyActivity[]>);
  }
};

// React hook for managing activity completion state
export function useActivityCompletion(initialActivities: DailyActivity[] = []) {
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(
    new Set(initialActivities.filter(a => a.is_completed).map(a => a.id))
  );

  const markCompleted = useCallback((activityId: string) => {
    setCompletedActivities(prev => new Set([...prev, activityId]));
  }, []);

  const markUncompleted = useCallback((activityId: string) => {
    setCompletedActivities(prev => {
      const newSet = new Set(prev);
      newSet.delete(activityId);
      return newSet;
    });
  }, []);

  const isCompleted = useCallback((activityId: string): boolean => {
    return completedActivities.has(activityId);
  }, [completedActivities]);

  const getCompletionCount = useCallback((): number => {
    return completedActivities.size;
  }, [completedActivities]);

  const resetAll = useCallback(() => {
    setCompletedActivities(new Set());
  }, []);

  const syncWithActivities = useCallback((activities: DailyActivity[]) => {
    setCompletedActivities(new Set(activities.filter(a => a.is_completed).map(a => a.id)));
  }, []);

  return {
    completedActivities,
    markCompleted,
    markUncompleted,
    isCompleted,
    getCompletionCount,
    resetAll,
    syncWithActivities
  };
}

// React hook for time-based activity filtering
export function useTimeBasedActivities(activities: DailyActivity[]) {
  const [currentTimeSlot, setCurrentTimeSlot] = useState(ActivityUtils.getCurrentTimeSlot());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeSlot(ActivityUtils.getCurrentTimeSlot());
    }, 60 * 60 * 1000); // Update every hour

    return () => clearInterval(interval);
  }, []);

  const visibleActivities = activities.filter(activity => 
    ActivityUtils.shouldShowActivity(activity, currentTimeSlot)
  );

  const activitiesByTimeSlot = ActivityUtils.groupActivitiesByTimeSlot(activities);

  return {
    currentTimeSlot,
    visibleActivities,
    activitiesByTimeSlot,
    allActivities: activities
  };
}

// Error handling helper
export class DailyActivitiesError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'DailyActivitiesError';
  }
}

export default DailyActivitiesAPI;