/**
 * AI Foundations API Client
 * Handles API communication for the AI Foundations system
 */

import type {
  FoundationsData,
  FoundationStatus,
  VisualSchemasResponse,
  FoundationsApiResponse,
  SaveFoundationsRequest,
} from '@/types/foundations';

const AUTHORING_API_BASE_URL = process.env.NEXT_PUBLIC_AUTHORING_API_URL || 'http://localhost:8001';

class FoundationsAPI {
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

  /**
   * Get foundations for a subskill
   * Returns 404 if foundations don't exist yet
   */
  async getFoundations(
    subskillId: string,
    versionId: string = 'v1'
  ): Promise<FoundationsApiResponse<FoundationsData>> {
    return this.request<FoundationsApiResponse<FoundationsData>>(
      `/api/subskills/${subskillId}/foundations?version_id=${versionId}`
    );
  }

  /**
   * Generate fresh AI foundations for a subskill
   * Takes 10-30 seconds to complete
   */
  async generateFoundations(
    subskillId: string,
    versionId: string = 'v1'
  ): Promise<FoundationsApiResponse<FoundationsData>> {
    return this.request<FoundationsApiResponse<FoundationsData>>(
      `/api/subskills/${subskillId}/foundations/generate?version_id=${versionId}`,
      { method: 'POST' }
    );
  }

  /**
   * Save educator-edited foundations
   */
  async saveFoundations(
    subskillId: string,
    data: SaveFoundationsRequest,
    versionId: string = 'v1'
  ): Promise<FoundationsApiResponse<FoundationsData>> {
    return this.request<FoundationsApiResponse<FoundationsData>>(
      `/api/subskills/${subskillId}/foundations?version_id=${versionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete foundations for a subskill
   * Used to regenerate from scratch
   */
  async deleteFoundations(
    subskillId: string,
    versionId: string = 'v1'
  ): Promise<FoundationsApiResponse<null>> {
    return this.request<FoundationsApiResponse<null>>(
      `/api/subskills/${subskillId}/foundations?version_id=${versionId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Get quick status of foundations for a subskill
   * Lightweight endpoint for checking existence
   */
  async getFoundationStatus(
    subskillId: string,
    versionId: string = 'v1'
  ): Promise<FoundationStatus> {
    return this.request<FoundationStatus>(
      `/api/subskills/${subskillId}/foundations/status?version_id=${versionId}`
    );
  }

  /**
   * Get list of all available visual schema types
   * Grouped by category with descriptions
   */
  async getVisualSchemas(): Promise<VisualSchemasResponse> {
    return this.request<VisualSchemasResponse>('/api/visual-schemas');
  }
}

// Export singleton instance
export const foundationsAPI = new FoundationsAPI(AUTHORING_API_BASE_URL);
