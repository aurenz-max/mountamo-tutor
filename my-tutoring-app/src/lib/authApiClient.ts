// lib/authApiClient.ts
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
  timeout?: number;
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

class AuthenticatedApiClient {
  private baseURL: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Get authentication headers with current user's token
   */
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

  /**
   * Handle response parsing and error handling
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorCode = response.status.toString();
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        // If we can't parse the error as JSON, use the default message
      }
      
      const error: ApiError = {
        message: errorMessage,
        status: response.status,
        code: errorCode
      };
      
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as unknown as T;
  }

  /**
   * Main request method with authentication and retry logic
   */
  private async request<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<T> {
    const { requireAuth = true, timeout = this.defaultTimeout, ...fetchOptions } = options;
    
    const url = `${this.baseURL}${endpoint}`;
    
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      try {
        const authHeaders = await this.getAuthHeaders();
        headers = { ...headers, ...authHeaders };
      } catch (error) {
        throw new Error('Authentication required');
      }
    }

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
    };

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      // Handle authentication errors with retry logic
      if (response.status === 401 && requireAuth) {
        console.log('Token expired, attempting refresh...');
        
        // Try to refresh token and retry once
        if (auth.currentUser) {
          try {
            await auth.currentUser.getIdToken(true); // Force refresh
            const newAuthHeaders = await this.getAuthHeaders();
            const retryConfig = {
              ...config,
              headers: {
                ...config.headers,
                ...newAuthHeaders,
              },
            };
            
            const retryResponse = await fetch(url, retryConfig);
            if (retryResponse.status === 401) {
              throw new Error('Authentication failed after token refresh');
            }
            return this.handleResponse<T>(retryResponse);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            throw new Error('Authentication failed - please sign in again');
          }
        } else {
          throw new Error('No authenticated user found');
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
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

  async changePassword(passwordData: {
    current_password: string;
    new_password: string;
  }) {
    return this.post('/api/auth/change-password', passwordData);
  }

  async logout() {
    return this.post('/api/auth/logout');
  }

  async deleteAccount() {
    return this.delete('/api/auth/account');
  }

  async getFirebaseConfig() {
    return this.get('/api/auth/config', false);
  }

  // ============================================================================
  // USER PROFILE ENDPOINTS
  // ============================================================================

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
  // LEARNING ENDPOINTS (Enhanced versions of your existing ones)
  // ============================================================================

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

  async getRecommendedProblems(params: {
    subject?: string;
    count?: number;
  } = {}) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get(`/api/problems/recommended-problems${queryString ? `?${queryString}` : ''}`);
  }

  async getCurriculum(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/api/curriculum${queryString}`);
  }

  async getSyllabus() {
    return this.get('/api/curriculum/syllabus');
  }

  async getSubjectSyllabus(subject: string) {
    return this.get(`/api/curriculum/syllabus/${encodeURIComponent(subject)}`);
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
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
  // COMPETENCY ENDPOINTS
  // ============================================================================

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
    const { subject, skill } = params;
    return this.get(`/api/competency/subject/${encodeURIComponent(subject)}/skill/${skill}`);
  }

  async getSubskillCompetency(params: {
    subject: string;
    skill: string;
    subskill: string;
  }) {
    const { subject, skill, subskill } = params;
    return this.get(`/api/competency/subject/${encodeURIComponent(subject)}/skill/${skill}/subskill/${subskill}`);
  }

  async getProblemReviews(params: {
    subject?: string;
    skill_id?: string;
    subskill_id?: string;
    limit?: number;
  } = {}) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.get(`/api/competency/problem-reviews${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // AI TUTOR ENDPOINTS
  // ============================================================================

  async sendTutorMessage(message: string, context?: any) {
    return this.post('/api/gemini/chat', { message, context });
  }

  async getTutorHistory() {
    return this.get('/api/gemini/history');
  }

  async startTutoringSession(data: {
    subject: string;
    skill_description: string;
    subskill_description: string;
    competency_score: number;
  }) {
    return this.post('/api/gemini/session/start', data);
  }

  // ============================================================================
  // LEARNING PATHS ENDPOINTS
  // ============================================================================

  async getLearningPaths() {
    return this.get('/api/learning-paths');
  }

  async startLearningPath(pathId: string) {
    return this.post(`/api/learning-paths/${pathId}/start`);
  }

  async getNextRecommendations(params: {
    subject: string;
    current_skill_id?: string;
    current_subskill_id?: string;
  }) {
    const { subject } = params;
    const queryParams = new URLSearchParams();
    if (params.current_skill_id) {
      queryParams.append('current_skill_id', params.current_skill_id);
    }
    if (params.current_subskill_id) {
      queryParams.append('current_subskill_id', params.current_subskill_id);
    }
    
    const queryString = queryParams.toString();
    return this.get(`/api/subject/${encodeURIComponent(subject)}/recommendations${queryString ? `?${queryString}` : ''}`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return auth.currentUser;
  }

  /**
   * Wait for authentication state to be determined
   */
  async waitForAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(!!user);
      });
    });
  }

  /**
   * Make a custom authenticated request (for endpoints not covered above)
   */
  async customRequest<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, options);
  }
}

// Create and export the authenticated API client instance
export const authApi = new AuthenticatedApiClient(API_BASE_URL);

// Export types for use in components
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  student_id?: string;
  grade_level?: string;
  total_points?: number;
  current_streak?: number;
  badges?: any[];
  created_at?: string;
  last_activity?: string;
}

export interface AuthApiError extends ApiError {}

export default authApi;