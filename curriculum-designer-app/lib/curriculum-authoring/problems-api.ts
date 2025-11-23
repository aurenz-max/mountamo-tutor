/**
 * Problems and Prompts API Client
 * Handles problem generation, evaluation, and prompt template management
 */

import type {
  ProblemInDB,
  GenerateProblemsRequest,
  RegenerateProblemRequest,
  UpdateProblemRequest,
  ProblemEvaluation,
  PromptTemplate,
  CreatePromptTemplateRequest,
  UpdatePromptTemplateRequest,
  PromptTemplateType,
  FeedbackReport,
  PromptSuggestion,
  TemplateComparison,
  PerformanceDashboardData,
} from '@/types/problems';

const AUTHORING_API_BASE_URL = process.env.NEXT_PUBLIC_AUTHORING_API_URL || 'http://localhost:8001';

class ProblemsAPI {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
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

      const error = new Error(errorMessage);
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
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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

  // ==================== PROBLEM OPERATIONS ====================

  /**
   * Generate problems for a subskill using AI
   */
  async generateProblems(
    subskillId: string,
    request: GenerateProblemsRequest
  ): Promise<ProblemInDB[]> {
    const response = await this.request<{ success: boolean; data: ProblemInDB[]; message: string }>(
      `/api/subskills/${subskillId}/problems/generate`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * List all problems for a subskill
   */
  async listProblems(
    subskillId: string,
    versionId: string,
    activeOnly: boolean = false
  ): Promise<ProblemInDB[]> {
    const params = new URLSearchParams({
      version_id: versionId,
    });
    if (activeOnly) {
      params.append('active_only', 'true');
    }

    const response = await this.request<{ success: boolean; data: ProblemInDB[]; message: string }>(
      `/api/subskills/${subskillId}/problems?${params}`
    );
    return response.data;
  }

  /**
   * Get a specific problem by ID
   */
  async getProblem(problemId: string): Promise<ProblemInDB> {
    const response = await this.request<{ success: boolean; data: ProblemInDB; message: string }>(
      `/api/problems/${problemId}`
    );
    return response.data;
  }

  /**
   * Update a problem (manual edit)
   */
  async updateProblem(
    problemId: string,
    updates: UpdateProblemRequest
  ): Promise<ProblemInDB> {
    const response = await this.request<{ success: boolean; data: ProblemInDB; message: string }>(
      `/api/problems/${problemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    return response.data;
  }

  /**
   * Regenerate a single problem
   */
  async regenerateProblem(
    problemId: string,
    request?: RegenerateProblemRequest
  ): Promise<ProblemInDB> {
    const response = await this.request<{ success: boolean; data: ProblemInDB; message: string }>(
      `/api/problems/${problemId}/regenerate`,
      {
        method: 'POST',
        body: JSON.stringify(request || {}),
      }
    );
    return response.data;
  }

  /**
   * Delete a problem
   */
  async deleteProblem(problemId: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(
      `/api/problems/${problemId}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Batch regenerate rejected problems
   */
  async batchRegenerateProblems(
    subskillId: string,
    versionId: string,
    temperature?: number
  ): Promise<ProblemInDB[]> {
    const params: { version_id: string; temperature?: number } = {
      version_id: versionId,
    };
    if (temperature !== undefined) {
      params.temperature = temperature;
    }

    const response = await this.request<{ success: boolean; data: ProblemInDB[]; message: string }>(
      `/api/subskills/${subskillId}/problems/batch-regenerate`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.data;
  }

  // ==================== EVALUATION OPERATIONS ====================

  /**
   * Evaluate a problem (3-tier pipeline)
   */
  async evaluateProblem(
    problemId: string,
    skipLlm: boolean = false
  ): Promise<ProblemEvaluation> {
    const params = new URLSearchParams();
    if (skipLlm) {
      params.append('skip_llm', 'true');
    }

    const response = await this.request<{ success: boolean; data: ProblemEvaluation; message: string }>(
      `/api/problems/${problemId}/evaluation/evaluate${params.toString() ? `?${params}` : ''}`,
      {
        method: 'POST',
      }
    );
    return response.data;
  }

  /**
   * Get evaluation results for a problem
   */
  async getEvaluation(problemId: string): Promise<ProblemEvaluation> {
    const response = await this.request<{ success: boolean; data: ProblemEvaluation; message: string }>(
      `/api/problems/${problemId}/evaluation`
    );
    return response.data;
  }

  /**
   * Batch evaluate all problems for a subskill
   */
  async batchEvaluateProblems(
    subskillId: string,
    versionId: string,
    skipLlm: boolean = false
  ): Promise<ProblemEvaluation[]> {
    const params = new URLSearchParams({
      version_id: versionId,
    });
    if (skipLlm) {
      params.append('skip_llm', 'true');
    }

    const response = await this.request<{ success: boolean; data: ProblemEvaluation[]; message: string; count: number }>(
      `/api/subskills/${subskillId}/problems/batch-evaluate?${params}`,
      {
        method: 'POST',
      }
    );
    return response.data;
  }

  // ==================== PROMPT TEMPLATE OPERATIONS ====================

  /**
   * List all prompt templates
   */
  async listPrompts(filters?: {
    template_type?: PromptTemplateType;
    template_name?: string;
    active_only?: boolean;
  }): Promise<PromptTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.template_type) {
      params.append('template_type', filters.template_type);
    }
    if (filters?.template_name) {
      params.append('template_name', filters.template_name);
    }
    if (filters?.active_only) {
      params.append('active_only', 'true');
    }

    const queryString = params.toString();
    const response = await this.request<{ success: boolean; data: PromptTemplate[]; message: string }>(
      `/api/prompts${queryString ? `?${queryString}` : ''}`
    );
    return response.data;
  }

  /**
   * Get a specific prompt template
   */
  async getPrompt(templateId: string): Promise<PromptTemplate> {
    const response = await this.request<{ success: boolean; data: PromptTemplate; message: string }>(
      `/api/prompts/${templateId}`
    );
    return response.data;
  }

  /**
   * Get the active prompt template by name and type
   */
  async getActivePrompt(
    name: string,
    type: PromptTemplateType
  ): Promise<PromptTemplate> {
    const response = await this.request<{ success: boolean; data: PromptTemplate; message: string }>(
      `/api/prompts/active/${name}/${type}`
    );
    return response.data;
  }

  /**
   * Create a new prompt template (auto-increments version)
   */
  async createPrompt(
    request: CreatePromptTemplateRequest
  ): Promise<PromptTemplate> {
    const response = await this.request<{ success: boolean; data: PromptTemplate; message: string }>(
      `/api/prompts`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * Update a prompt template (creates new version)
   */
  async updatePrompt(
    templateId: string,
    updates: UpdatePromptTemplateRequest
  ): Promise<PromptTemplate> {
    const response = await this.request<{ success: boolean; data: PromptTemplate; message: string }>(
      `/api/prompts/${templateId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    return response.data;
  }

  /**
   * Activate a specific prompt template version
   */
  async activatePrompt(templateId: string): Promise<PromptTemplate> {
    const response = await this.request<{ success: boolean; data: PromptTemplate; message: string }>(
      `/api/prompts/${templateId}/activate`,
      {
        method: 'POST',
      }
    );
    return response.data;
  }

  /**
   * Get performance metrics for a prompt template
   */
  async getPromptPerformance(templateId: string): Promise<{
    template_id: string;
    template_name: string;
    performance_metrics: PromptTemplate['performance_metrics'];
  }> {
    return this.request<{
      template_id: string;
      template_name: string;
      performance_metrics: PromptTemplate['performance_metrics'];
    }>(`/api/prompts/${templateId}/performance`);
  }

  /**
   * Get available prompt template types
   */
  async getPromptTypes(): Promise<string[]> {
    return this.request<string[]>(`/api/prompts/types`);
  }

  // ==================== FEEDBACK LOOP OPERATIONS ====================

  /**
   * Get aggregated feedback report for a template
   */
  async getFeedbackReport(
    templateId: string,
    minEvaluations: number = 3
  ): Promise<FeedbackReport> {
    const params = new URLSearchParams({
      min_evaluations: minEvaluations.toString(),
    });
    const response = await this.request<{ success: boolean; data: FeedbackReport; message: string }>(
      `/api/prompts/${templateId}/feedback-report?${params}`
    );
    return response.data;
  }

  /**
   * Generate AI-powered improvement suggestions for a template
   */
  async suggestImprovements(
    templateId: string,
    focusAreas?: string[]
  ): Promise<PromptSuggestion> {
    const params = focusAreas?.length
      ? `?${focusAreas.map((a) => `focus_areas=${a}`).join('&')}`
      : '';
    const response = await this.request<{ success: boolean; data: PromptSuggestion; message: string }>(
      `/api/prompts/${templateId}/suggest-improvements${params}`,
      { method: 'POST' }
    );
    return response.data;
  }

  /**
   * Compare two template versions
   */
  async compareTemplateVersions(
    templateIdA: string,
    templateIdB: string
  ): Promise<TemplateComparison> {
    const response = await this.request<{ success: boolean; data: TemplateComparison; message: string }>(
      `/api/prompts/${templateIdA}/compare/${templateIdB}`
    );
    return response.data;
  }

  /**
   * Get performance dashboard for all templates
   */
  async getPerformanceDashboard(filters?: {
    template_type?: PromptTemplateType;
    min_approval_rate?: number;
    only_active?: boolean;
  }): Promise<PerformanceDashboardData> {
    const params = new URLSearchParams();
    if (filters?.template_type) {
      params.append('template_type', filters.template_type);
    }
    if (filters?.min_approval_rate !== undefined) {
      params.append('min_approval_rate', filters.min_approval_rate.toString());
    }
    if (filters?.only_active) {
      params.append('only_active', 'true');
    }

    const queryString = params.toString();
    const response = await this.request<{ success: boolean; data: PerformanceDashboardData; message: string }>(
      `/api/prompts/performance-dashboard${queryString ? `?${queryString}` : ''}`
    );
    return response.data;
  }

  /**
   * Trigger feedback aggregation job (admin feature)
   */
  async triggerFeedbackAggregation(options?: {
    template_id?: string;
    all_templates?: boolean;
    recent_only?: boolean;
    hours?: number;
  }): Promise<{
    total_templates: number;
    successful: number;
    skipped: number;
    failed: number;
    processed_templates: Array<{
      template_id: string;
      template_name: string;
      problem_count: number;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options?.template_id) {
      params.append('template_id', options.template_id);
    }
    if (options?.all_templates) {
      params.append('all_templates', 'true');
    }
    if (options?.recent_only) {
      params.append('recent_only', 'true');
    }
    if (options?.hours !== undefined) {
      params.append('hours', options.hours.toString());
    }

    const queryString = params.toString();
    const response = await this.request<{
      success: boolean;
      data: {
        total_templates: number;
        successful: number;
        skipped: number;
        failed: number;
        processed_templates: Array<{
          template_id: string;
          template_name: string;
          problem_count: number;
        }>;
      };
      message: string;
    }>(
      `/api/prompts/jobs/aggregate-feedback${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' }
    );
    return response.data;
  }

  // ==================== PRODUCTION OPERATIONS ====================

  /**
   * Get best-performing template for production use
   * Returns a template with high approval rate (weighted random selection)
   */
  async getBestPerformingTemplate(filters: {
    template_type: PromptTemplateType;
    subskill_id?: string;
    problem_type?: string;
    min_approval_rate?: number;
  }): Promise<PromptTemplate> {
    const params = new URLSearchParams({
      template_type: filters.template_type,
    });
    if (filters.subskill_id) {
      params.append('subskill_id', filters.subskill_id);
    }
    if (filters.problem_type) {
      params.append('problem_type', filters.problem_type);
    }
    if (filters.min_approval_rate !== undefined) {
      params.append('min_approval_rate', filters.min_approval_rate.toString());
    }

    const response = await this.request<{ success: boolean; data: { template: PromptTemplate }; message: string }>(
      `/api/production/prompts/best-performing?${params}`
    );
    return response.data.template;
  }
}

export const problemsAPI = new ProblemsAPI(AUTHORING_API_BASE_URL);
export default problemsAPI;
