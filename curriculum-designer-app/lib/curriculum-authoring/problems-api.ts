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
    return this.request<PromptTemplate[]>(
      `/api/prompts${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get a specific prompt template
   */
  async getPrompt(templateId: string): Promise<PromptTemplate> {
    return this.request<PromptTemplate>(`/api/prompts/${templateId}`);
  }

  /**
   * Get the active prompt template by name and type
   */
  async getActivePrompt(
    name: string,
    type: PromptTemplateType
  ): Promise<PromptTemplate> {
    return this.request<PromptTemplate>(`/api/prompts/active/${name}/${type}`);
  }

  /**
   * Create a new prompt template (auto-increments version)
   */
  async createPrompt(
    request: CreatePromptTemplateRequest
  ): Promise<PromptTemplate> {
    return this.request<PromptTemplate>(`/api/prompts`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Update a prompt template (creates new version)
   */
  async updatePrompt(
    templateId: string,
    updates: UpdatePromptTemplateRequest
  ): Promise<PromptTemplate> {
    return this.request<PromptTemplate>(`/api/prompts/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Activate a specific prompt template version
   */
  async activatePrompt(templateId: string): Promise<PromptTemplate> {
    return this.request<PromptTemplate>(`/api/prompts/${templateId}/activate`, {
      method: 'POST',
    });
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
}

export const problemsAPI = new ProblemsAPI(AUTHORING_API_BASE_URL);
export default problemsAPI;
