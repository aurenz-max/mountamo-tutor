// lib/weeklyPlannerApi.ts - Weekly Planner API Client
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// ============================================================================
// TYPESCRIPT TYPES - Matching Backend Models
// ============================================================================

export type ActivityStatus = 'pending' | 'assigned' | 'completed' | 'skipped';
export type ActivityPriority = 'high' | 'medium' | 'low';
export type ActivityType = 'practice' | 'packages' | 'review' | 'tutoring' | 'assessment';

export interface PlannedActivity {
  activity_uid: string;
  subskill_id: string;
  subskill_description: string;
  subject: string;
  skill_description?: string;
  unit_title?: string;
  activity_type: ActivityType;
  planned_day: number; // 0=Monday, 1=Tuesday, etc.
  status: ActivityStatus;
  priority: ActivityPriority;
  llm_reasoning: string;
  estimated_time_minutes: number;
  difficulty_start?: number;
  target_difficulty?: number;
  grade?: string;
  assigned_date?: string;
  completed_date?: string;
}

export interface WeeklyPlan {
  student_id: number;
  week_start_date: string; // YYYY-MM-DD (Monday)
  plan_id: string;
  weekly_theme: string;
  weekly_objectives: string[];
  source_analytics_snapshot: Record<string, any>;
  planned_activities: PlannedActivity[];
  generated_at: string;
  last_updated_at: string;
  generation_model: string;
  parent_starred_activities: string[]; // activity UIDs
  total_activities: number;
  completed_activities: number;
  assigned_activities: number;
}

export interface WeeklyPlanStatus {
  student_id: number;
  week_start_date: string;
  total_activities: number;
  completed_activities: number;
  assigned_activities: number;
  pending_activities: number;
  skipped_activities: number;
  progress_percentage: number;
  completion_by_day: Array<{
    day_index: number;
    day_name: string;
    date: string;
    completed: number;
    total: number;
  }>;
  subjects_covered: string[];
  generated_at: string;
}

export interface DayActivitiesResponse {
  student_id: number;
  week_start_date: string;
  day: {
    index: number;
    name: string;
    date: string;
  };
  total_activities: number;
  activities: PlannedActivity[];
}

export interface WeeklyPlanGenerationResponse {
  success: boolean;
  message: string;
  plan_summary: {
    student_id: number;
    week_start_date: string;
    weekly_theme: string;
    total_activities: number;
    objectives: string[];
  };
  plan: WeeklyPlan;
}

export interface ActivityCompletionResponse {
  success: boolean;
  message: string;
  activity_uid: string;
  student_id: number;
}

// ============================================================================
// WEEKLY PLANNER API CLIENT
// ============================================================================

class WeeklyPlannerApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = await user.getIdToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication token unavailable');
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If we can't parse error as JSON, use default message
      }

      console.error('Weekly Planner API Error:', {
        status: response.status,
        message: errorMessage,
        url: response.url
      });

      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getAuthHeaders();

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // ============================================================================
  // WEEKLY PLAN RETRIEVAL
  // ============================================================================

  /**
   * Get the current week's learning plan for a student
   * Automatically calculates the current week's Monday
   */
  async getCurrentWeeklyPlan(studentId: number): Promise<WeeklyPlan> {
    return this.request(`/api/weekly-planner/${studentId}/current`);
  }

  /**
   * Get a specific week's learning plan for a student
   * @param weekStartDate - Week start date (Monday, YYYY-MM-DD)
   */
  async getWeeklyPlanByDate(studentId: number, weekStartDate: string): Promise<WeeklyPlan> {
    return this.request(`/api/weekly-planner/${studentId}/week/${weekStartDate}`);
  }

  /**
   * Get status summary of a weekly plan (progress, completion, etc.)
   */
  async getWeeklyPlanStatus(studentId: number, weekStartDate?: string): Promise<WeeklyPlanStatus> {
    const params = new URLSearchParams();
    if (weekStartDate) params.append('week_start_date', weekStartDate);

    const queryString = params.toString();
    return this.request(`/api/weekly-planner/${studentId}/status${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get all activities planned for a specific day of the week
   * @param dayIndex - Day of week (0=Monday, 6=Sunday)
   */
  async getActivitiesForDay(
    studentId: number,
    dayIndex: number,
    weekStartDate?: string
  ): Promise<DayActivitiesResponse> {
    const params = new URLSearchParams();
    if (weekStartDate) params.append('week_start_date', weekStartDate);

    const queryString = params.toString();
    return this.request(`/api/weekly-planner/${studentId}/day/${dayIndex}${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // ACTIVITY STATUS UPDATES
  // ============================================================================

  /**
   * Mark an activity as completed in the weekly plan
   */
  async markActivityComplete(
    studentId: number,
    activityUid: string,
    weekStartDate?: string
  ): Promise<ActivityCompletionResponse> {
    const params = new URLSearchParams();
    if (weekStartDate) params.append('week_start_date', weekStartDate);

    const queryString = params.toString();
    return this.request(
      `/api/weekly-planner/${studentId}/activity/${activityUid}/complete${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
  }

  /**
   * Star/unstar an activity for parent prioritization
   * This tells the AI to prioritize this activity in future planning
   */
  async toggleStarActivity(
    studentId: number,
    activityUid: string,
    isStarred: boolean,
    weekStartDate?: string
  ): Promise<{ success: boolean; message: string }> {
    // TODO: Implement when backend endpoint is ready (Phase 3.2)
    // For now, return success to enable UI development
    console.log(`Star activity ${activityUid}: ${isStarred}`);
    return {
      success: true,
      message: `Activity ${isStarred ? 'starred' : 'unstarred'} successfully`
    };
  }

  // ============================================================================
  // PLAN GENERATION (Admin/Testing)
  // ============================================================================

  /**
   * Generate a weekly learning plan for a student (manual trigger)
   * This is primarily for testing/admin use during shadow mode
   */
  async generateWeeklyPlan(
    studentId: number,
    params?: {
      week_start_date?: string;
      target_activities?: number;
      force_regenerate?: boolean;
    }
  ): Promise<WeeklyPlanGenerationResponse> {
    const queryParams = new URLSearchParams();
    if (params?.week_start_date) queryParams.append('week_start_date', params.week_start_date);
    if (params?.target_activities) queryParams.append('target_activities', params.target_activities.toString());
    if (params?.force_regenerate) queryParams.append('force_regenerate', 'true');

    const queryString = queryParams.toString();
    return this.request(
      `/api/weekly-planner/generate/${studentId}${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
  }

  /**
   * Delete a weekly plan (useful for regeneration testing)
   */
  async deleteWeeklyPlan(studentId: number, weekStartDate: string): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/api/weekly-planner/${studentId}/week/${weekStartDate}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Health check for weekly planner service
   */
  async getHealth(): Promise<any> {
    return this.request('/api/weekly-planner/health');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekMonday(): string {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  return monday.toISOString().split('T')[0];
}

/**
 * Get the Monday of a specific date's week
 */
export function getWeekMonday(date: Date): string {
  const monday = new Date(date);
  monday.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
  return monday.toISOString().split('T')[0];
}

/**
 * Get day name from index
 */
export function getDayName(dayIndex: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayIndex] || 'Unknown';
}

/**
 * Format week date range for display
 */
export function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

/**
 * Get activity status color class
 */
export function getActivityStatusColor(status: ActivityStatus): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'assigned':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'pending':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case 'skipped':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get activity priority color class
 */
export function getActivityPriorityColor(priority: ActivityPriority): string {
  switch (priority) {
    case 'high':
      return 'border-red-400 shadow-red-100';
    case 'medium':
      return 'border-yellow-400 shadow-yellow-100';
    case 'low':
      return 'border-gray-300 shadow-gray-100';
    default:
      return 'border-gray-300 shadow-gray-100';
  }
}

/**
 * Get activity type icon
 */
export function getActivityTypeIcon(type: ActivityType): string {
  switch (type) {
    case 'practice':
      return '📝';
    case 'packages':
      return '📦';
    case 'review':
      return '🔄';
    case 'tutoring':
      return '👨‍🏫';
    case 'assessment':
      return '📊';
    default:
      return '📚';
  }
}

export const weeklyPlannerApi = new WeeklyPlannerApiClient(API_BASE_URL);
export default weeklyPlannerApi;
