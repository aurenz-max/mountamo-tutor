// lib/authApiClient.ts - Enhanced with Analytics Methods
import { auth } from './firebase';
import type { ProblemGenerationRequest } from '@/types/curriculum';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface AuthApiError extends Error {
  status?: number;
  message: string;
}

// Engagement Response Types (matching your backend)
export interface EngagementResponse {
  activity_id: string;
  xp_earned: number;
  points_earned: number; // Backward compatibility
  total_xp: number;
  level_up: boolean;
  new_level?: number;
  badges_earned: string[];
}

export interface ActivityCompletionResponse {
  success: boolean;
  activity_id?: string;
  student_id?: number;
  xp_earned: number;
  points_earned: number; // Backward compatibility
  level_up: boolean;
  new_level?: number;
  message: string;
}

// Analytics Response Types (matching your backend)
export interface AnalyticsMetricsResponse {
  student_id: number;
  subject?: string;
  date_range: {
    start_date?: string;
    end_date?: string;
  };
  summary: {
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    attempted_items: number;
    total_items: number;
    attempt_count: number;
    ready_items: number;
    recommended_items: number;
  };
  hierarchical_data: Array<{
      unit_id: string;
      unit_title: string;
      mastery: number;
      proficiency: number;
      avg_score: number;
      completion: number;
      attempted_skills: number;
      total_skills: number;
      skills: Array<{
        skill_id: string;
        skill_description: string;
        mastery: number;
        proficiency: number;
        subskills: Array<{
          subskill_id: string;
          subskill_description: string;
          mastery: number;
          avg_score: number;
          proficiency: number;
          completion: number;
          is_attempted: boolean;
          readiness_status: string;
          priority_level: string;
          priority_order: number;
      }>;
    }>;
  }>;
  cached: boolean;
  generated_at: string;
}

export interface AnalyticsTimeseriesResponse {
  student_id: number;
  subject?: string;
  interval: 'day' | 'week' | 'month' | 'quarter' | 'year';
  level: 'subject' | 'unit' | 'skill' | 'subskill';
  intervals: Array<{
    period: string;
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    attempt_count: number;
  }>;
  cached: boolean;
  generated_at: string;
}

// Assessment History Types
export interface AssessmentHistoryItem {
  assessment_id: string;
  subject: string;
  completed_at: string;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
}

export interface AssessmentHistoryResponse {
  assessments: AssessmentHistoryItem[];
  total_count: number;
  page: number;
  limit: number;
}

export interface AnalyticsRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  unit_id: string;
  unit_title: string;
  skill_id: string;
  skill_description: string;
  subskill_id: string;
  subskill_description: string;
  proficiency: number;
  mastery: number;
  avg_score: number;
  priority_level: string;
  priority_order: number;
  readiness_status: string;
  is_ready: boolean;
  completion: number;
  attempt_count: number;
  is_attempted: boolean;
  message: string;
}

// Define a type for a single problem for better type safety
export interface Problem {
  id?: string;
  problem_id?: string;
  problem_type: string;
  question?: string;
  statement?: string;
  prompt?: string;
  student_id?: number;
  user_id?: string;
  generated_at?: string;
  // Allow for flexible structure with all the specific problem type fields
  [key: string]: any;
}

class AuthenticatedApiClient {
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
      let errorDetails = null;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorDetails = errorData;
        
        // For validation errors (422), try to provide more specific error information
        if (response.status === 422 && errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map((err: any) => 
              `${err.loc?.join('.')}: ${err.msg}`
            ).join(', ');
            errorMessage = `Validation error: ${validationErrors}`;
          }
        }
      } catch {
        // If we can't parse error as JSON, use default message
      }
      
      console.error('API Error:', {
        status: response.status,
        message: errorMessage,
        details: errorDetails,
        url: response.url
      });
      
      const error = new Error(errorMessage) as AuthApiError;
      error.status = response.status;
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as unknown as T;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit & { requireAuth?: boolean } = {}
  ): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;
    
    const url = `${this.baseURL}${endpoint}`;
    
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      const authHeaders = await this.getAuthHeaders();
      headers = { ...headers, ...authHeaders };
    }

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
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

  // Basic HTTP methods
  async get<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', requireAuth });
  }

  async post<T>(endpoint: string, data?: any, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      requireAuth,
    });
  }

  async put<T>(endpoint: string, data?: any, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      requireAuth,
    });
  }

  async delete<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', requireAuth });
  }

  // ============================================================================
  // AUTHENTICATION ENDPOINTS
  // ============================================================================

  async registerUser(userData: {
    email: string;
    password: string;
    display_name: string;
    grade_level?: string;
  }) {
    return this.post('/api/auth/register', userData, false);
  }

  async verifyToken() {
    return this.post('/api/auth/verify-token');
  }

  async getUserProfile() {
    return this.get('/api/user-profiles/profile');
  }

  async updateUserProfile(profileData: any) {
    return this.put('/api/user-profiles/profile', profileData);
  }

  async getUserDashboard() {
    return this.get('/api/user-profiles/dashboard');
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS - Enhanced to match your backend API
  // ============================================================================

  /**
   * Get comprehensive hierarchical metrics for a student
   */
  async getStudentMetrics(
    studentId: number, 
    params?: {
      subject?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<AnalyticsMetricsResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.subject) queryParams.append('subject', params.subject);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    
    const queryString = queryParams.toString();
    return this.get(`/api/analytics/student/${studentId}/metrics${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get metrics over time for a student
   */
  async getStudentTimeseries(
    studentId: number,
    params?: {
      subject?: string;
      interval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
      level?: 'subject' | 'unit' | 'skill' | 'subskill';
      start_date?: string;
      end_date?: string;
      unit_id?: string;
      skill_id?: string;
      include_hierarchy?: boolean;
    }
  ): Promise<AnalyticsTimeseriesResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.subject) queryParams.append('subject', params.subject);
    if (params?.interval) queryParams.append('interval', params.interval);
    if (params?.level) queryParams.append('level', params.level);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.unit_id) queryParams.append('unit_id', params.unit_id);
    if (params?.skill_id) queryParams.append('skill_id', params.skill_id);
    if (params?.include_hierarchy !== undefined) {
      queryParams.append('include_hierarchy', params.include_hierarchy.toString());
    }
    
    const queryString = queryParams.toString();
    return this.get(`/api/analytics/student/${studentId}/metrics/timeseries${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get recommended next steps for a student
   */
  async getStudentRecommendations(
    studentId: number,
    params?: {
      subject?: string;
      limit?: number;
    }
  ): Promise<AnalyticsRecommendation[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.subject) queryParams.append('subject', params.subject);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    return this.get(`/api/analytics/student/${studentId}/recommendations${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get problem reviews for a student (existing method, kept for compatibility)
   */
  async getProblemReviews(studentId: number, params: {
    subject?: string;
    skill_id?: string;
    limit?: number;
  } = {}) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get(`/api/analytics/student/${studentId}/problem-reviews${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Trigger ETL sync (admin function)
   */
  async triggerAnalyticsSync(syncType: 'incremental' | 'full' = 'incremental') {
    return this.post(`/api/analytics/etl/sync?sync_type=${syncType}`);
  }

  /**
   * Clear analytics cache (admin function)
   */
  async clearAnalyticsCache() {
    return this.post('/api/analytics/cache/clear');
  }

  /**
   * Get analytics health check
   */
  async getAnalyticsHealth() {
    return this.get('/api/analytics/health');
  }

  // ============================================================================
  // ASSESSMENT ENDPOINTS
  // ============================================================================

  /**
   * Get available subjects for assessment
   */
  async getAssessmentSubjects() {
    return this.get('/api/assessments/subjects');
  }

  /**
   * Create a new assessment for a subject
   */
  async createAssessment(subject: string, request: {
    student_id: number;
    question_count: number;
  }) {
    return this.post(`/api/assessments/${subject}`, request);
  }

  /**
   * Submit assessment answers
   */
  async submitAssessment(subject: string, request: {
    assessment_id: string;
    answers: { [key: string]: any };
    time_taken_minutes?: number;
  }) {
    return this.post(`/api/assessments/${subject}/submit`, request);
  }

  /**
   * Get assessment data for taking the assessment
   */
  async getAssessment(assessmentId: string) {
    return this.get(`/api/assessments/assessment/${assessmentId}`);
  }

  /**
   * Get assessment summary/results
   */
  async getAssessmentSummary(assessmentId: string) {
    return this.get(`/api/assessments/${assessmentId}/summary`);
  }

  /**
   * Get detailed assessment results with AI insights
   */
  async getAssessmentResults(assessmentId: string) {
    return this.get(`/api/assessments/${assessmentId}/summary`);
  }

  /**
   * Get assessment history for the authenticated student
   */
  async getAssessmentHistory(page: number = 1, limit: number = 10) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    return this.get(`/api/assessments/history?${params.toString()}`);
  }

  // ============================================================================
  // PACKAGE ENDPOINTS
  // ============================================================================

/**
 * Get content packages with filtering
 */
async getContentPackages(filters: {
  status?: string;
  subject?: string;
  skill?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ packages: any[]; total_count: number }> {
  const queryParams = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
  });
  
  const queryString = queryParams.toString();
  return this.get(`/api/packages/content-packages${queryString ? `?${queryString}` : ''}`);
}

async findPackageByCurriculumId(curriculumId: string): Promise<{
  status: string;
  package_id: string;
  package: any;
  curriculum_mapping: any;
}> {
  return this.get(`/api/education/packages/find-by-curriculum/${curriculumId}`);
}

/**
 * Get individual package details
 */
async getContentPackageDetail(packageId: string): Promise<any> {
  const result = await this.get(`/api/packages/content-packages/${packageId}`);
  
  // Handle different response formats from your backend
  if (result.package) {
    return result.package;
  } else if (result.status === "success" && result.data) {
    return result.data;
  }
  return result;
}

/**
 * Create WebSocket connection for practice tutor sessions
 */
async createPracticeTutorWebSocket(topicContext: any): Promise<WebSocket> {
  const token = await this.getAuthToken();
  if (!token) {
    throw new Error('Authentication required for Practice Tutor WebSocket connection');
  }

  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const wsUrl = `${wsBaseUrl}/api/practice-tutor`;
  
  console.log('🎯 Creating Practice Tutor WebSocket connection to:', wsUrl);
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let authSent = false;
    
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        reject(new Error('Practice Tutor WebSocket connection timeout'));
      }
    }, 8000);
    
    ws.onopen = () => {
      console.log('🎯 Practice Tutor WebSocket opened, sending authentication with topic context');
      clearTimeout(connectionTimeout);
      
      try {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: token,
          topic_context: topicContext
        }));
        authSent = true;
        console.log('✅ Practice Tutor authentication message sent');
      } catch (error) {
        console.error('❌ Failed to send Practice Tutor authentication:', error);
        reject(error);
        return;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_success') {
          console.log('✅ Practice Tutor authentication successful');
          resolve(ws);
          return;
        }
      } catch (error) {
        console.error('Error parsing Practice Tutor auth response:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('🎯 Practice Tutor WebSocket error:', error);
      clearTimeout(connectionTimeout);
      reject(error);
    };
    
    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      if (!authSent) {
        reject(new Error(`Practice Tutor WebSocket closed before authentication: ${event.code} ${event.reason}`));
      }
    };
  });
}

/**
 * Create WebSocket connection for learning sessions with proper authentication flow
 */
async createLearningSessionWebSocket(packageId: string, studentId?: number): Promise<WebSocket> {
  const token = await this.getAuthToken();
  if (!token) {
    throw new Error('Authentication required for WebSocket connection');
  }

  const params = new URLSearchParams();
  if (studentId) params.append('student_id', studentId.toString());

  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const wsUrl = `${wsBaseUrl}/api/packages/${packageId}/learn?${params}`;
  
  console.log('🔌 Creating WebSocket connection to:', wsUrl);
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let authSent = false;
    
    // Set a timeout for the entire connection process
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 8000); // 8 seconds, less than backend's 10 second timeout
    
    ws.onopen = () => {
      console.log('🔌 WebSocket opened, sending authentication immediately');
      clearTimeout(connectionTimeout);
      
      // Send authentication immediately
      try {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: token
        }));
        authSent = true;
        console.log('✅ Authentication message sent');
      } catch (error) {
        console.error('❌ Failed to send authentication:', error);
        reject(error);
        return;
      }
    };
    
    // Wait for auth success response
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_success') {
          console.log('✅ Authentication successful, WebSocket ready');
          // Restore original message handler or clear it
          ws.onmessage = originalOnMessage;
          resolve(ws);
          return;
        }
      } catch (error) {
        console.error('Error parsing auth response:', error);
      }
      
      // Call original handler if it exists
      if (originalOnMessage) {
        originalOnMessage(event);
      }
    };
    
    ws.onerror = (error) => {
      console.error('🔌 WebSocket error:', error);
      clearTimeout(connectionTimeout);
      reject(error);
    };
    
    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      if (!authSent) {
        reject(new Error(`WebSocket closed before authentication: ${event.code} ${event.reason}`));
      }
    };
  });
}

// Add this helper method to your AuthenticatedApiClient class
private async getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication token unavailable');
  }
}

  // ============================================================================
  // DAILY PLAN ENDPOINTS
  // ============================================================================

  /**
   * Get daily plan for a student
   */
  async getDailyPlan(studentId: number, date?: string) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const queryString = params.toString();
    return this.get(`/api/daily-plan/${studentId}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get enhanced daily activities with transparency metadata
   */
  async getDailyActivities(studentId: number, date?: string) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const queryString = params.toString();
    return this.get(`/api/daily-plan/${studentId}/activities${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // LEGACY ANALYTICS METHODS (for backwards compatibility)
  // ============================================================================

  async getAnalytics(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/api/analytics${queryString}`);
  }

  async getStudentAnalytics(params: {
    days?: number;
    subject?: string;
  } = {}) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get(`/api/analytics/student${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // OTHER EXISTING ENDPOINTS (unchanged)
  // ============================================================================

  // Competency endpoints
  async getStudentOverview() {
    return this.get('/api/competency/student');
  }

  async getSubjects() {
    return this.get('/api/competency/subjects');
  }

  async getSubjectCurriculum(subject: string) {
    return this.get(`/api/competency/curriculum/${encodeURIComponent(subject)}`);
  }

  async getSkillCompetency(params: {
    subject: string;
    skill: string;
  }) {
    const queryParams = new URLSearchParams();
    queryParams.append('subject', params.subject);
    queryParams.append('skill', params.skill);
    
    return this.get(`/api/competency/skill?${queryParams.toString()}`);
  }

  async getSubskillCompetency(params: {
    subject: string;
    skill: string;
    subskill: string;
  }) {
    const queryParams = new URLSearchParams();
    queryParams.append('subject', params.subject);
    queryParams.append('skill', params.skill);
    queryParams.append('subskill', params.subskill);
    
    return this.get(`/api/competency/subskill?${queryParams.toString()}`);
  }

  // Learning paths endpoints
  async getLearningPaths() {
    return this.get('/api/learning-paths');
  }

  async startLearningPath(pathId: string) {
    return this.post(`/api/learning-paths/${pathId}/start`);
  }

  // ============================================================================
  // NEW LEARNING PATHS GRAPH ENDPOINTS - BigQuery-backed prerequisite system
  // ============================================================================

  /**
   * Get curriculum graph decorated with student progress (Student State Engine)
   *
   * This is the PRIMARY endpoint for learning paths. It returns a complete graph
   * where each node includes a calculated status:
   * - LOCKED: Prerequisites not met, cannot practice
   * - UNLOCKED: Prerequisites met, ready to start (proficiency = 0)
   * - IN_PROGRESS: Started but not mastered (0 < proficiency < 0.8)
   * - MASTERED: Mastered (proficiency >= 0.8)
   *
   * Uses Firestore cache for fast loading (~50ms vs 2-5s generation)
   *
   * @param subjectId - Subject identifier (e.g., "MATHEMATICS")
   * @param studentId - Student ID
   * @param includeDrafts - Include draft curriculum (default: false)
   */
  async getStudentGraph(
    subjectId: string,
    studentId: number,
    includeDrafts: boolean = false
  ) {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    const queryString = params.toString();
    return this.get(
      `/api/learning-paths/${encodeURIComponent(subjectId)}/student-graph/${studentId}${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get learning graph visualization with student progress
   */
  async getLearningGraphVisualization(
    subject?: string,
    studentId?: number
  ) {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (studentId) params.append('student_id', studentId.toString());

    const queryString = params.toString();
    return this.get(`/api/learning-paths/graph/visualization${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get personalized recommendations for student
   */
  async getLearningRecommendations(
    studentId: number,
    subject?: string,
    limit: number = 5
  ) {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    params.append('limit', limit.toString());

    const queryString = params.toString();
    return this.get(`/api/learning-paths/student/${studentId}/recommendations${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get detailed skill information
   */
  async getSkillDetails(
    skillId: string,
    studentId?: number
  ) {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId.toString());

    const queryString = params.toString();
    return this.get(`/api/learning-paths/graph/skill/${skillId}/details${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get unlocked entities for student
   */
  async getUnlockedEntities(
    studentId: number,
    entityType?: 'skill' | 'subskill',
    subject?: string
  ) {
    const params = new URLSearchParams();
    if (entityType) params.append('entity_type', entityType);
    if (subject) params.append('subject', subject);

    const queryString = params.toString();
    return this.get(`/api/learning-paths/student/${studentId}/unlocked-entities${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Check if entity is unlocked for student
   */
  async checkPrerequisites(
    studentId: number,
    entityId: string,
    entityType?: 'skill' | 'subskill'
  ) {
    const params = new URLSearchParams();
    if (entityType) params.append('entity_type', entityType);

    const queryString = params.toString();
    return this.get(`/api/learning-paths/student/${studentId}/prerequisite-check/${entityId}${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // UNIVERSAL PROBLEM ENDPOINTS - Handles all problem types
  // ============================================================================

  async getProblems(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/api/problems${queryString}`);
  }

  /**
   * Universal problem generation for practice sets.
   * Generates one or more problems of various types.
   *
   * @param data - The request payload (use ProblemGenerationRequest type for type safety).
   * @param data.count - The number of problems to generate. Defaults to 1.
   * @returns A promise that resolves to a single problem object (if count=1) or an array of problem objects (if count>1).
   */
  async generateProblem(data: ProblemGenerationRequest): Promise<Problem | Problem[]> {
    return this.post('/api/problems/generate', data);
  }

  /**
   * Generate multiple problems for a practice session.
   * Convenience method that always returns an array.
   *
   * @param data - The request payload (use ProblemGenerationRequest type for type safety). Defaults to 5 problems if count not specified.
   * @returns A promise that resolves to an array of problem objects.
   */
  async generateProblemSet(data: ProblemGenerationRequest): Promise<Problem[]> {
    const count = data.count || 5; // Default to 5 problems for practice sets
    const result = await this.post('/api/problems/generate', { ...data, count });
    // Ensure we always return an array for problem sets
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Universal problem submission - handles all problem types:
   * - Auto-detects problem type and routes to appropriate handler
   * - Supports canvas images, structured data, and interactive responses
   * - Uses unified SubmissionService on backend
   */
  async submitProblem(data: {
    subject: string;
    problem: any;
    solution_image?: string;
    skill_id: string;
    student_answer?: string;
    canvas_used?: boolean;
    subskill_id?: string;
    primitive_response?: any; // For structured problem responses (MCQ, FIB, etc.)
  }) {
    return this.post('/api/problems/submit', data);
  }

  /**
   * Batch problem submission for assessments
   * - Submits multiple problems at once with assessment context
   * - Returns enhanced feedback with engagement data
   * - Supports all problem types in a single batch
   */
  async submitProblemBatch(request: {
    assessment_context?: {
      assessment_id: string;
      subject: string;
      student_id: number;
    };
    submissions: Array<{
      subject: string;
      problem: any;
      solution_image?: string;
      skill_id: string;
      student_answer?: string;
      canvas_used?: boolean;
      subskill_id?: string;
      primitive_response?: any;
    }>;
  }) {
    return this.post('/api/problems/submit-batch', request);
  }

  /**
   * DEPRECATED: Use generatePracticeSet instead
   * Kept for backward compatibility during migration
   */
  async getSkillProblems(params: {
    subject: string;
    skill_id: string;
    subskill_id: string;
    count?: number;
  }) {
    console.warn('getSkillProblems is deprecated. Use generatePracticeSet instead.');
    return this.generatePracticeSet({
      subject: params.subject,
      skill_id: params.skill_id,
      subskill_id: params.subskill_id,
      count: params.count
    });
  }

  async getRecommendedProblems(params?: {
    subject?: string;
    count?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.subject) queryParams.append('subject', params.subject);
    if (params?.count) queryParams.append('count', params.count.toString());

    const queryString = queryParams.toString();
    return this.get(`/api/problems/recommended-problems${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // UNIFIED PRACTICE SET ENDPOINT
  // ============================================================================

  async generatePracticeSet(data: {
    subject: string;
    unit_id: string;
    skill_id: string;
    subskill_id: string;
    count?: number;
    problem_types?: string[];
  }) {
    // Use the generate endpoint and pass the count parameter
    const problem = await this.post('/api/problems/generate', {
      subject: data.subject,
      unit_id: data.unit_id, // Use the provided unit_id directly
      skill_id: data.skill_id,
      subskill_id: data.subskill_id,
      count: data.count || 5, // Pass the count parameter, default to 5 if not provided
    });

    // The backend may return a single problem or multiple problems based on the schema
    // Wrap single problem in array for consistent frontend handling
    return Array.isArray(problem) ? problem : [problem];
  }

  // ============================================================================
  // ENGAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Complete a daily activity and earn XP
   */
  async completeDailyActivity(studentId: number, activityId: string, pointsEarned?: number): Promise<ActivityCompletionResponse> {
    const params = new URLSearchParams();
    if (pointsEarned) params.append('points_earned', pointsEarned.toString());
    
    return this.post(`/api/daily-plan/${studentId}/activities/${activityId}/complete${params.toString() ? `?${params.toString()}` : ''}`);
  }

  /**
   * Complete the entire daily plan and earn bonus XP
   */
  async completeDailyPlan(studentId: number): Promise<ActivityCompletionResponse> {
    return this.post(`/api/daily-plan/${studentId}/complete`);
  }

  /**
   * Complete a package section and earn XP
   */
  async completePackageSection(packageId: string, sectionTitle: string, timeSpentMinutes?: number): Promise<ActivityCompletionResponse> {
    return this.post(`/api/packages/${packageId}/sections/complete`, {
      section_title: sectionTitle,
      time_spent_minutes: timeSpentMinutes
    });
  }

  /**
   * Complete an entire package and earn bonus XP
   */
  async completePackage(packageId: string, sectionsCompleted: number, totalTimeMinutes?: number): Promise<ActivityCompletionResponse> {
    return this.post(`/api/packages/${packageId}/complete`, {
      sections_completed: sectionsCompleted,
      total_time_minutes: totalTimeMinutes
    });
  }

  /**
   * Complete an interactive primitive and earn XP
   */
  async completePrimitive(data: {
    package_id: string;
    section_title: string;
    primitive_type: string;
    primitive_index: number;
    score?: number;
  }): Promise<ActivityCompletionResponse> {
    return this.post('/api/packages/primitives/complete', data);
  }

  async getMyStudentInfo() {
    return this.get('/api/problems/my-student-info');
  }

  // ============================================================================
  // CONTENT PACKAGE FOR SUBSKILL ENDPOINTS (Product Spec Implementation)
  // ============================================================================

  /**
   * Get or generate content package for a specific subskill
   * Implements the product spec endpoint: GET /api/packages/content-package/for-subskill/{subskill_id}
   */
  async getContentPackageForSubskill(subskillId: string): Promise<{
    packageId: string;
  }> {
    return this.get(`/api/packages/content-package/for-subskill/${encodeURIComponent(subskillId)}`);
  }

  async getProblemsHealth() {
    return this.get('/api/problems/health');
  }

  // ============================================================================
  // COMPOSABLE PROBLEMS ENDPOINTS
  // ============================================================================

  async generateComposableProblem(data: {
    subject: string;
    unit_id?: string;
    skill_id?: string;
    subskill_id?: string;
    difficulty?: number;
  }) {
    return this.post('/api/problems/generate-composable', data);
  }

  // AI Tutor endpoints
  async sendTutorMessage(message: string, context?: any) {
    return this.post('/api/gemini/chat', { message, context });
  }

  async getTutorHistory() {
    return this.get('/api/gemini/history');
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  async waitForAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(!!user);
      });
    });
  }
}

export const authApi = new AuthenticatedApiClient(API_BASE_URL);
export default authApi;