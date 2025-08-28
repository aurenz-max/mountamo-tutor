// lib/dailyActivitiesAPI.ts - Fixed API configuration

export interface DailyActivity {
  id: string;
  type: string; // 'practice', 'tutoring', 'pathway', 'visual', 'review'
  title: string;
  description: string;
  category: string;
  estimated_time: string;
  points: number;
  priority: string; // 'high', 'medium', 'low'
  time_slot: string; // 'morning', 'midday', 'afternoon', 'evening'
  action: string;
  endpoint: string;
  icon_type: string;
  metadata: Record<string, any>;
  source_type?: 'ai_recommendations' | 'bigquery_recommendations' | 'fallback';
  source_details?: {
    ai_reason?: string;
    priority_rank?: number;
    estimated_time_minutes?: number;
    readiness_status?: string;
    mastery_level?: number;
    reason?: string;
  };
  curriculum_transparency?: {
    subject: string;
    unit: string;
    skill: string;
    subskill: string;
  };
  curriculum_metadata?: {
    subject: string;
    unit: { id: string; title: string; description?: string };
    skill: { id: string; description: string };
    subskill: { id: string; description: string };
  };
  // New AI recommendation fields
  activity_type?: 'warm_up' | 'core_challenge' | 'practice' | 'cool_down';
  reason?: string;
}

export interface DailyProgress {
  completed_activities: number;
  total_activities: number;
  points_earned_today: number;
  daily_goal: number;
  current_streak: number;
  progress_percentage: number;
}

export interface DailyPlan {
  student_id: number;
  date: string;
  activities: DailyActivity[];
  progress: DailyProgress;
  personalization_source: string; // 'ai_recommendations' | 'bigquery_recommendations' | 'fallback'
  total_points: number;
  summary?: {
    total_activities: number;
    total_points: number;
    personalization_source: string;
    source_breakdown: {
      ai_recommendations: number;
      bigquery_recommendations: number;
      fallback: number;
    };
  };
  transparency?: {
    recommendation_engine: string;
    generation_timestamp: string;
    ai_enabled: boolean;
    bigquery_enabled: boolean;
    session_plan?: {
      daily_theme?: string;
      learning_objectives?: string[];
      session_structure?: any;
      total_estimated_time?: number;
    };
  };
}

export interface ActivityCompletionResponse {
  success: boolean;
  activity_id: string;
  student_id: number;
  points_earned: number;
  message: string;
}

// Fixed API class with proper endpoint configuration
export class DailyActivitiesAPI {
  private baseURL: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(baseURL: string = 'http://localhost:8000/api/daily-activities', getAuthToken: () => Promise<string | null>) {
    this.baseURL = baseURL;
    this.getAuthToken = getAuthToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const fullUrl = `${this.baseURL}${endpoint}`;
    console.log('Making request to:', fullUrl); // Debug logging
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', response.status, errorData); // Debug logging
      throw new Error(errorData.detail || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Main endpoints - aligned with backend
  async getDailyPlan(studentId: number, date?: string): Promise<DailyPlan> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    const endpoint = `/daily-plan/${studentId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<DailyPlan>(endpoint);
  }

  async getDailyActivities(studentId: number, date?: string) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    const endpoint = `/daily-plan/${studentId}/activities${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async refreshDailyPlan(studentId: number): Promise<{ success: boolean; plan: DailyPlan }> {
    return this.request(`/daily-plan/${studentId}/refresh`, { method: 'POST' });
  }

  async markActivityCompleted(
    studentId: number, 
    activityId: string,
    pointsEarned?: number
  ): Promise<ActivityCompletionResponse> {
    const params = new URLSearchParams();
    if (pointsEarned) params.append('points_earned', pointsEarned.toString());
    
    const queryString = params.toString();
    const endpoint = `/daily-plan/${studentId}/activities/${activityId}/complete${queryString ? `?${queryString}` : ''}`;
    
    return this.request<ActivityCompletionResponse>(endpoint, { method: 'POST' });
  }

  // Health and testing endpoints
  async healthCheck() {
    return this.request('/daily-activities/health');
  }

  async testRecommendations(studentId: number) {
    return this.request(`/daily-activities/recommendations-test/${studentId}`);
  }
}

// Factory function for creating API instance with environment-aware URL
export const createDailyActivitiesApi = (getAuthToken: () => Promise<string | null>) => {
  // Try multiple possible backend URLs
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                    process.env.NEXT_PUBLIC_BACKEND_URL || 
                    'http://localhost:8000';
  
  const baseURL = `${backendUrl}/api/daily-activities`;
  
  console.log('Daily Activities API initialized with baseURL:', baseURL); // Debug logging
  
  return new DailyActivitiesAPI(baseURL, getAuthToken);
};

// Rest of the file remains the same...
import { useState, useEffect, useCallback } from 'react';

export interface UseDailyActivitiesOptions {
  studentId: number;
  getAuthToken: () => Promise<string | null>;
  autoRefresh?: boolean;
  date?: string;
}

export interface UseDailyActivitiesReturn {
  dailyPlan: DailyPlan | null;
  loading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  completeActivity: (activityId: string, pointsEarned?: number) => Promise<void>;
  isCompleting: string | null;
}

export function useDailyActivities({
  studentId,
  getAuthToken,
  autoRefresh = false,
  date
}: UseDailyActivitiesOptions): UseDailyActivitiesReturn {
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const [api, setApi] = useState<DailyActivitiesAPI | null>(null);

  // Initialize API
  useEffect(() => {
    if (getAuthToken) {
      const apiInstance = createDailyActivitiesApi(getAuthToken);
      setApi(apiInstance);
    }
  }, [getAuthToken]);

  // Fetch daily plan with enhanced transparency data
  const fetchDailyPlan = useCallback(async () => {
    if (!api) return;
    
    try {
      setError(null);
      // Use the enhanced activities endpoint that includes transparency metadata
      const enhancedPlan = await api.getDailyActivities(studentId, date);
      
      // Convert the enhanced response to the expected DailyPlan format
      const plan: DailyPlan = {
        student_id: enhancedPlan.student_id,
        date: enhancedPlan.date,
        activities: enhancedPlan.activities,
        progress: {
          completed_activities: enhancedPlan.summary?.total_activities || 0,
          total_activities: enhancedPlan.summary?.total_activities || 0,
          points_earned_today: 0, // Would need to track this separately
          daily_goal: 60,
          current_streak: 1,
          progress_percentage: 0.0
        },
        personalization_source: enhancedPlan.summary?.personalization_source || 'unknown',
        total_points: enhancedPlan.summary?.total_points || 0,
        summary: enhancedPlan.summary,
        transparency: enhancedPlan.transparency
      };
      
      setDailyPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily plan');
    }
  }, [api, studentId, date]);

  // Refresh plan
  const refreshPlan = useCallback(async () => {
    if (!api) return;
    
    setLoading(true);
    await fetchDailyPlan();
    setLoading(false);
  }, [fetchDailyPlan]);

  // Complete activity
  const completeActivity = useCallback(async (activityId: string, pointsEarned?: number) => {
    if (!api || !dailyPlan) return;
    
    setIsCompleting(activityId);
    
    try {
      await api.markActivityCompleted(studentId, activityId, pointsEarned);
      
      // Find the activity to get the points
      const activity = dailyPlan.activities.find(a => a.id === activityId);
      const points = pointsEarned || activity?.points || 0;
      
      // Update local state immediately
      setDailyPlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          activities: prev.activities.map(activity =>
            activity.id === activityId 
              ? { ...activity, metadata: { ...activity.metadata, completed: true } }
              : activity
          ),
          progress: {
            ...prev.progress,
            completed_activities: prev.progress.completed_activities + 1,
            points_earned_today: prev.progress.points_earned_today + points
          }
        };
      });
      
      // Refresh from server
      await fetchDailyPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete activity');
    } finally {
      setIsCompleting(null);
    }
  }, [api, studentId, fetchDailyPlan, dailyPlan]);

  // Initial load
  useEffect(() => {
    if (api && studentId) {
      refreshPlan();
    }
  }, [api, studentId, refreshPlan]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && api && studentId) {
      const interval = setInterval(refreshPlan, 5 * 60 * 1000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh, api, studentId, refreshPlan]);

  return {
    dailyPlan,
    loading,
    error,
    refreshPlan,
    completeActivity,
    isCompleting,
  };
}

// Utility functions
export const ActivityUtils = {
  getActivityIcon: (iconType: string): string => {
    const icons: Record<string, string> = {
      zap: '⚡',
      headphones: '🎧',
      target: '🎯',
      eye: '👁️',
      brain: '🧠',
      book: '📖',
      star: '⭐'
    };
    return icons[iconType] || '📚';
  },

  getActivityColor: (type: string): string => {
    const colors: Record<string, string> = {
      practice: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      tutoring: 'bg-blue-100 text-blue-800 border-blue-200',
      pathway: 'bg-green-100 text-green-800 border-green-200',
      visual: 'bg-purple-100 text-purple-800 border-purple-200',
      review: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  },

  getPriorityColor: (priority: string): string => {
    const colors: Record<string, string> = {
      high: 'border-l-red-500 bg-red-50',
      medium: 'border-l-yellow-500 bg-yellow-50', 
      low: 'border-l-green-500 bg-green-50'
    };
    return colors[priority] || 'border-l-gray-500 bg-gray-50';
  },

  getCurrentTimeSlot: (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 15) return 'midday';
    if (hour < 18) return 'afternoon';
    return 'evening';
  },

  groupActivitiesByTimeSlot: (activities: DailyActivity[]) => {
    return activities.reduce((acc, activity) => {
      if (!acc[activity.time_slot]) {
        acc[activity.time_slot] = [];
      }
      acc[activity.time_slot].push(activity);
      return acc;
    }, {} as Record<string, DailyActivity[]>);
  },

  calculateProgress: (completed: number, total: number): number => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
};

export default DailyActivitiesAPI;