// lib/authApiClient.ts - Enhanced with Analytics Methods
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface AuthApiError extends Error {
  status?: number;
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
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If we can't parse error as JSON, use default message
      }
      
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
// PACKAGE ENDPOINTS - Add to your AuthenticatedApiClient class
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
 * Create WebSocket connection for learning sessions with proper authentication flow
 */
async createLearningSessionWebSocket(packageId: string, studentId?: number): Promise<WebSocket> {
  const token = await this.getAuthToken();
  if (!token) {
    throw new Error('Authentication required for WebSocket connection');
  }

  const params = new URLSearchParams();
  if (studentId) params.append('student_id', studentId.toString());
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//localhost:8000/api/packages/${packageId}/learn?${params}`;
  
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

  // Problem endpoints
  async getProblems(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/api/problems${queryString}`);
  }

  async generateProblem(data: {
    subject: string;
    unit_id?: string;
    skill_id?: string;
    subskill_id?: string;
    difficulty?: number;
  }) {
    return this.post('/api/problems/generate', data);
  }

  async submitProblem(data: {
    subject: string;
    problem: any;
    solution_image: string;
    skill_id: string;
    student_answer?: string;
    canvas_used?: boolean;
    subskill_id?: string;
  }) {
    return this.post('/api/problems/submit', data);
  }

  async getSkillProblems(params: {
    subject: string;
    skill_id: string;
    subskill_id: string;
    count?: number;
  }) {
    const queryParams = new URLSearchParams();
    queryParams.append('subject', params.subject);
    queryParams.append('skill_id', params.skill_id);
    queryParams.append('subskill_id', params.subskill_id);
    if (params.count) queryParams.append('count', params.count.toString());
    
    return this.get(`/api/problems/skill-problems?${queryParams.toString()}`);
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
  // MCQ ENDPOINTS
  // ============================================================================

  async generateMCQ(data: {
    subject: string;
    unit_id?: string;
    skill_id?: string;
    subskill_id?: string;
    difficulty?: string;
    distractor_style?: string;
  }) {
    return this.post('/api/problems/mcq/generate', data);
  }

  async submitMCQ(data: {
    mcq: any; // Complete MCQ object
    selected_option_id: string;
  }) {
    return this.post('/api/problems/mcq/submit', data);
  }

  // ============================================================================
  // FILL-IN-THE-BLANK ENDPOINTS
  // ============================================================================

  async generateFillInBlank(data: {
    subject: string;
    unit_id?: string;
    skill_id?: string;
    subskill_id?: string;
    difficulty?: string;
    blank_style?: string;
  }) {
    return this.post('/api/problems/fill-in-blank/generate', data);
  }

  async submitFillInBlank(data: {
    fill_in_blank: any; // Complete fill-in-the-blank object
    student_answers: Array<{
      blank_id: string;
      answer: string;
    }>;
  }) {
    return this.post('/api/problems/fill-in-blank/submit', data);
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