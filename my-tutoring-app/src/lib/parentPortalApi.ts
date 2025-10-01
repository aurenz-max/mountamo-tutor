// lib/parentPortalApi.ts - Parent Portal API Client
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// ============================================================================
// PARENT PORTAL TYPE DEFINITIONS
// ============================================================================

export interface ParentAccount {
  parent_uid: string;
  email: string;
  display_name?: string;
  linked_student_ids: number[];
  preferences: Record<string, any>;
  created_at: string;
  last_login?: string;
  email_verified: boolean;
  onboarding_completed: boolean;
  notification_preferences: {
    weekly_digest: boolean;
    daily_summary: boolean;
    milestone_alerts: boolean;
    struggle_alerts: boolean;
  };
}

export interface ParentStudentLink {
  link_id: string;
  parent_uid: string;
  student_id: number;
  relationship: 'parent' | 'guardian' | 'tutor' | 'teacher' | 'mentor';
  access_level: 'full' | 'read_only' | 'limited';
  created_at: string;
  verified: boolean;
}

export interface TodaysPlanSummary {
  date: string;
  total_activities: number;
  completed_activities: number;
  estimated_total_time: number;
  subjects_covered: string[];
  activities_preview: Array<{
    activity_id: string;
    activity_type: string;
    subject: string;
    title: string;
    estimated_time: number;
    completed: boolean;
  }>;
}

export interface WeeklySummaryMetrics {
  week_start_date: string;
  week_end_date: string;
  total_time_spent_minutes: number;
  problems_completed: number;
  average_mastery: number;
  subjects_progress: Array<{
    subject: string;
    mastery: number;
    time_spent: number;
    problems_completed: number;
  }>;
  streak_days: number;
  top_skill?: string;
}

export interface KeyInsight {
  insight_type: 'progress' | 'struggle' | 'milestone' | 'recommendation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  subject?: string;
  action_items: string[];
}

export interface ParentDashboard {
  student_id: number;
  student_name: string;
  todays_plan: TodaysPlanSummary;
  weekly_summary: WeeklySummaryMetrics;
  key_insights: KeyInsight[];
  generated_at: string;
}

export interface FamilyActivity {
  activity_id: string;
  title: string;
  description: string;
  estimated_time: string;
  materials_needed: string[];
  instructions: string;
  learning_goal: string;
  subskill_id: string;
  subject: string;
}

export interface ConversationStarter {
  question: string;
  context: string;
  follow_up_ideas: string[];
  subskill_id: string;
}

export interface WaysToHelpResponse {
  student_id: number;
  catch_up_recommendations: Array<{
    subskill_id: string;
    subskill_description: string;
    subject: string;
    current_mastery: number;
    recommendation_reason: string;
  }>;
  family_activities: FamilyActivity[];
  conversation_starters: ConversationStarter[];
  generated_at: string;
}

export interface ReadyLearningItem {
  subskill_id: string;
  subskill_description: string;
  subject: string;
  unit_title: string;
  skill_description: string;
  readiness_status: string;
  priority_order: number;
  parent_starred: boolean;
}

export interface ExplorerProject {
  project_id: string;
  title: string;
  description: string;
  subject: string;
  skill_id?: string;
  subskill_id?: string;
  learning_goals: string[];
  materials_list: string[];
  instructions_pdf_url?: string;
  estimated_time: string;
  project_type: 'science_experiment' | 'writing_assignment' | 'creative_project' | 'field_trip' | 'math_activity' | 'reading_activity';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  age_range: string;
  created_at: string;
}

export interface WeeklyExplorerResponse {
  student_id: number;
  week_start_date: string;
  ready_items: ReadyLearningItem[];
  suggested_projects: ExplorerProject[];
  generated_at: string;
}

export interface SessionSummary {
  session_id: string;
  student_id: number;
  session_type: 'practice_tutor' | 'education_package' | 'read_along';
  topic_covered: string;
  subject: string;
  skill_description?: string;
  subskill_description?: string;
  duration_minutes: number;
  key_concepts: string[];
  student_engagement_score: 'low' | 'medium' | 'high';
  problems_attempted?: number;
  problems_correct?: number;
  tutor_feedback?: string;
  created_at: string;
}

export interface SessionHistoryResponse {
  student_id: number;
  sessions: SessionSummary[];
  total_sessions: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
  generated_at: string;
}

// ============================================================================
// PARENT PORTAL API CLIENT
// ============================================================================

class ParentPortalApiClient {
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

      console.error('Parent Portal API Error:', {
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
  // PARENT ACCOUNT MANAGEMENT
  // ============================================================================

  async createParentAccount(): Promise<{ success: boolean; message: string; parent_account: ParentAccount }> {
    return this.request('/api/parent/account/create', {
      method: 'POST',
    });
  }

  async getParentAccount(): Promise<ParentAccount> {
    return this.request('/api/parent/account');
  }

  async linkStudent(studentId: number, relationship: string = 'parent'): Promise<{
    success: boolean;
    message: string;
    link: ParentStudentLink
  }> {
    return this.request(`/api/parent/link-student?student_id=${studentId}&relationship=${relationship}`, {
      method: 'POST',
    });
  }

  async getLinkedStudents(): Promise<{ students: number[]; total: number }> {
    return this.request('/api/parent/students');
  }

  async getOnboardingStatus(): Promise<{
    completed: boolean;
    account_exists: boolean;
    has_linked_students?: boolean;
  }> {
    return this.request('/api/parent/account/onboarding/status');
  }

  async completeOnboarding(notificationPreferences?: {
    weekly_digest?: boolean;
    daily_summary?: boolean;
    milestone_alerts?: boolean;
    struggle_alerts?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    parent_account: ParentAccount;
  }> {
    return this.request('/api/parent/account/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ notification_preferences: notificationPreferences }),
    });
  }

  async updateNotificationPreferences(preferences: {
    weekly_digest?: boolean;
    daily_summary?: boolean;
    milestone_alerts?: boolean;
    struggle_alerts?: boolean;
  }): Promise<ParentAccount> {
    return this.request('/api/parent/account/preferences/notifications', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // ============================================================================
  // DASHBOARD ENDPOINTS (Phase 1)
  // ============================================================================

  async getParentDashboard(studentId: number): Promise<ParentDashboard> {
    return this.request(`/api/parent/dashboard/${studentId}`);
  }

  async getTodaysPlan(studentId: number): Promise<TodaysPlanSummary> {
    return this.request(`/api/parent/student/${studentId}/today`);
  }

  async getWeeklySummary(studentId: number): Promise<WeeklySummaryMetrics> {
    return this.request(`/api/parent/student/${studentId}/weekly-summary`);
  }

  // ============================================================================
  // DEEP DIVE ANALYTICS (Phase 1)
  // ============================================================================

  async getStudentMetrics(studentId: number, subject?: string): Promise<any> {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);

    const queryString = params.toString();
    return this.request(`/api/parent/student/${studentId}/analytics/metrics${queryString ? `?${queryString}` : ''}`);
  }

  async getStudentTimeseries(
    studentId: number,
    params?: {
      subject?: string;
      interval?: 'day' | 'week' | 'month';
    }
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.subject) queryParams.append('subject', params.subject);
    if (params?.interval) queryParams.append('interval', params.interval);

    const queryString = queryParams.toString();
    return this.request(`/api/parent/student/${studentId}/analytics/timeseries${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // WAYS TO HELP (Phase 2 - Placeholder)
  // ============================================================================

  async getWaysToHelp(studentId: number): Promise<WaysToHelpResponse> {
    // TODO: Implement when backend endpoint is ready
    return this.request(`/api/parent/student/${studentId}/ways-to-help`);
  }

  // ============================================================================
  // WEEKLY EXPLORER (Phase 3)
  // ============================================================================

  async getWeeklyExplorer(studentId: number): Promise<WeeklyExplorerResponse> {
    return this.request(`/api/parent/student/${studentId}/weekly-explorer`);
  }

  async prioritizeSubskill(studentId: number, subskillIds: string[]): Promise<{ success: boolean }> {
    // TODO: Implement when backend endpoint is ready
    return this.request(`/api/daily-plan/${studentId}/prioritize`, {
      method: 'POST',
      body: JSON.stringify({ subskill_ids: subskillIds }),
    });
  }

  async completeExplorerProject(
    studentId: number,
    projectId: string,
    data: {
      photo_url?: string;
      parent_notes?: string;
      student_enjoyed?: boolean;
    }
  ): Promise<{ success: boolean; xp_awarded: number }> {
    // TODO: Implement when backend endpoint is ready
    return this.request(`/api/parent/student/${studentId}/projects/${projectId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // SESSION HISTORY (Phase 4 - Placeholder)
  // ============================================================================

  async getSessionHistory(studentId: number, limit: number = 20): Promise<SessionHistoryResponse> {
    // TODO: Implement when backend endpoint is ready
    return this.request(`/api/parent/student/${studentId}/sessions?limit=${limit}`);
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  async getHealth(): Promise<any> {
    return this.request('/api/parent/health');
  }
}

export const parentPortalApi = new ParentPortalApiClient(API_BASE_URL);
export default parentPortalApi;
