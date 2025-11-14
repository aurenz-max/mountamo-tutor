/**
 * Content Generation API Client
 * Handles API communication for the reading content generation system
 */

import type {
  ReadingContent,
  ReadingSection,
  VisualSnippet,
  GenerateContentRequest,
  RegenerateSectionRequest,
  UpdateSectionRequest,
  GenerateVisualRequest,
  UpdateVisualRequest,
  ApiResponse,
} from '@/types/content';

const AUTHORING_API_BASE_URL = process.env.NEXT_PUBLIC_AUTHORING_API_URL || 'http://localhost:8001';

class ContentAPI {
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

      const error = new Error(errorMessage) as Error & { status: number };
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

  // ==================== CONTENT GENERATION ====================

  /**
   * Generate complete reading content for a subskill
   * Takes 30-60 seconds to complete
   * @param subskillId - Subskill identifier
   * @param versionId - Version identifier (default: 'v1')
   * @param useFoundations - Whether to use saved AI foundations (default: true)
   */
  async generateContent(
    subskillId: string,
    versionId: string = 'v1',
    useFoundations: boolean = true
  ): Promise<ApiResponse<ReadingContent>> {
    return this.request<ApiResponse<ReadingContent>>(
      `/api/subskills/${subskillId}/content/generate?version_id=${versionId}&use_foundations=${useFoundations}`,
      { method: 'POST' }
    );
  }

  /**
   * Get existing reading content for a subskill
   * @param subskillId - Subskill identifier
   * @param versionId - Version identifier (default: 'v1')
   */
  async getContent(
    subskillId: string,
    versionId: string = 'v1'
  ): Promise<ApiResponse<ReadingContent>> {
    return this.request<ApiResponse<ReadingContent>>(
      `/api/subskills/${subskillId}/content?version_id=${versionId}`
    );
  }

  /**
   * Delete all reading content for a subskill
   * This action cannot be undone
   * @param subskillId - Subskill identifier
   * @param versionId - Version identifier (default: 'v1')
   * @param cascadeDeleteVisuals - Also delete associated visual snippets (default: true)
   */
  async deleteContent(
    subskillId: string,
    versionId: string = 'v1',
    cascadeDeleteVisuals: boolean = true
  ): Promise<ApiResponse<null>> {
    return this.request<ApiResponse<null>>(
      `/api/subskills/${subskillId}/content?version_id=${versionId}&cascade_delete_visuals=${cascadeDeleteVisuals}`,
      { method: 'DELETE' }
    );
  }

  // ==================== SECTION OPERATIONS ====================

  /**
   * Regenerate a single section with optional custom prompt
   * Takes 10-20 seconds to complete
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   * @param versionId - Version identifier (default: 'v1')
   * @param customPrompt - Optional custom instructions for regeneration
   */
  async regenerateSection(
    subskillId: string,
    sectionId: string,
    versionId: string = 'v1',
    customPrompt?: string
  ): Promise<ApiResponse<ReadingSection>> {
    const params = new URLSearchParams({
      version_id: versionId,
      ...(customPrompt && { custom_prompt: customPrompt }),
    });

    return this.request<ApiResponse<ReadingSection>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/regenerate?${params}`,
      { method: 'POST' }
    );
  }

  /**
   * Manually update a section's content
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   * @param data - Fields to update (all optional)
   * @param versionId - Version identifier (default: 'v1')
   */
  async updateSection(
    subskillId: string,
    sectionId: string,
    data: UpdateSectionRequest,
    versionId: string = 'v1'
  ): Promise<ApiResponse<ReadingSection>> {
    return this.request<ApiResponse<ReadingSection>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}?version_id=${versionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  // ==================== VISUAL SNIPPETS ====================

  /**
   * Generate visual HTML snippet for a section
   * Takes 20-40 seconds to complete
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   * @param request - Generation request with optional custom prompt
   */
  async generateVisual(
    subskillId: string,
    sectionId: string,
    request: GenerateVisualRequest
  ): Promise<ApiResponse<VisualSnippet>> {
    return this.request<ApiResponse<VisualSnippet>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual/generate`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get visual snippet for a section
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   */
  async getVisual(
    subskillId: string,
    sectionId: string
  ): Promise<ApiResponse<VisualSnippet>> {
    return this.request<ApiResponse<VisualSnippet>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual`
    );
  }

  /**
   * Update visual snippet HTML content
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   * @param htmlContent - Updated HTML content
   */
  async updateVisual(
    subskillId: string,
    sectionId: string,
    htmlContent: string
  ): Promise<ApiResponse<VisualSnippet>> {
    return this.request<ApiResponse<VisualSnippet>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual`,
      {
        method: 'PUT',
        body: JSON.stringify({ html_content: htmlContent }),
      }
    );
  }

  /**
   * Delete visual snippet for a section
   * @param subskillId - Subskill identifier
   * @param sectionId - Section identifier
   */
  async deleteVisual(
    subskillId: string,
    sectionId: string
  ): Promise<ApiResponse<null>> {
    return this.request<ApiResponse<null>>(
      `/api/subskills/${subskillId}/content/sections/${sectionId}/visual`,
      { method: 'DELETE' }
    );
  }
}

// Export singleton instance
export const contentAPI = new ContentAPI(AUTHORING_API_BASE_URL);
