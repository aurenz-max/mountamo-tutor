/**
 * Curriculum Graph API Client
 *
 * Client for accessing cached curriculum prerequisite graphs from Firestore
 */

import type {
  PrerequisiteGraph,
  ApiError
} from '@/types/curriculum-authoring';

const AUTHORING_API_BASE_URL = process.env.NEXT_PUBLIC_AUTHORING_API_URL || 'http://localhost:8001';

interface GraphStatus {
  subject_id: string;
  cached_versions: Array<{
    version_type: string;
    version_id: string;
    generated_at: string;
    last_accessed: string;
    metadata: {
      entity_counts: {
        skills: number;
        subskills: number;
        total: number;
      };
      edge_count: number;
      include_drafts: boolean;
    };
  }>;
  has_published: boolean;
  has_draft: boolean;
  total_cached: number;
}

interface CachedSubjectsList {
  cached_subjects: string[];
  count: number;
}

interface CachedGraphDocument {
  id: string;
  subject_id: string;
  version_id: string;
  version_type: string;
  generated_at: string;
  last_accessed: string;
  metadata: {
    entity_counts: {
      skills: number;
      subskills: number;
      total: number;
    };
    edge_count: number;
    include_drafts: boolean;
  };
}

interface CachedGraphsList {
  cached_graphs: CachedGraphDocument[];
  count: number;
}

interface DeleteGraphsResponse {
  message: string;
  deleted_count: number;
  requested_ids?: string[];
}

class CurriculumGraphAPI {
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

      const error = new Error(errorMessage) as ApiError & Error;
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
   * Get cached curriculum graph for a subject
   *
   * Returns cached version if available (fast ~50ms),
   * otherwise generates and caches (2-5s depending on curriculum size).
   *
   * @param subjectId - Subject identifier
   * @param includeDrafts - Include draft entities in graph
   * @param forceRefresh - Force regeneration bypassing cache
   */
  async getCachedGraph(
    subjectId: string,
    includeDrafts: boolean = false,
    forceRefresh: boolean = false
  ): Promise<PrerequisiteGraph> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');
    if (forceRefresh) params.append('force_refresh', 'true');

    return this.request<PrerequisiteGraph>(
      `/api/graph/${subjectId}${params.toString() ? `?${params}` : ''}`
    );
  }

  /**
   * Force regeneration of curriculum graph
   *
   * Invalidates cache and rebuilds graph from BigQuery.
   * Use after making significant curriculum changes.
   *
   * @param subjectId - Subject identifier
   * @param includeDrafts - Include draft entities
   */
  async regenerateGraph(
    subjectId: string,
    includeDrafts: boolean = false
  ): Promise<{
    message: string;
    subject_id: string;
    include_drafts: boolean;
    node_count: number;
    edge_count: number;
  }> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request(
      `/api/graph/${subjectId}/regenerate${params.toString() ? `?${params}` : ''}`,
      { method: 'POST' }
    );
  }

  /**
   * Regenerate both draft and published graph versions
   *
   * Use after publishing curriculum changes to ensure both caches are up to date.
   *
   * @param subjectId - Subject identifier
   */
  async regenerateAllVersions(
    subjectId: string
  ): Promise<{
    message: string;
    subject_id: string;
    published: {
      node_count: number;
      edge_count: number;
    };
    draft: {
      node_count: number;
      edge_count: number;
    };
  }> {
    return this.request(
      `/api/graph/${subjectId}/regenerate-all`,
      { method: 'POST' }
    );
  }

  /**
   * Invalidate cached graphs for a subject
   *
   * Removes cached graph documents from Firestore.
   * Next request will trigger fresh generation.
   *
   * @param subjectId - Subject identifier
   * @param versionType - 'draft', 'published', or undefined for both
   */
  async invalidateCache(
    subjectId: string,
    versionType?: 'draft' | 'published'
  ): Promise<{
    message: string;
    subject_id: string;
    version_type: string | null;
    deleted_count: number;
  }> {
    const params = new URLSearchParams();
    if (versionType) params.append('version_type', versionType);

    return this.request(
      `/api/graph/${subjectId}/cache${params.toString() ? `?${params}` : ''}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Get cache status information for a subject
   *
   * Returns information about cached versions, timestamps, and metadata.
   *
   * @param subjectId - Subject identifier
   */
  async getGraphStatus(
    subjectId: string
  ): Promise<GraphStatus> {
    return this.request<GraphStatus>(
      `/api/graph/${subjectId}/status`
    );
  }

  /**
   * List all subjects that have cached graphs
   *
   * Useful for cache management and monitoring.
   */
  async listCachedSubjects(): Promise<CachedSubjectsList> {
    return this.request<CachedSubjectsList>(
      '/api/graph/cache/list'
    );
  }

  /**
   * List all cached graph documents with metadata
   *
   * Returns detailed information about all cached graphs including:
   * - Document IDs
   * - Subject IDs
   * - Version types (draft/published)
   * - Generation and access timestamps
   * - Metadata (node counts, edge counts)
   */
  async listAllCachedGraphs(): Promise<CachedGraphsList> {
    return this.request<CachedGraphsList>(
      '/api/graph/cache/list-all'
    );
  }

  /**
   * Delete ALL cached graph documents (use with caution!)
   *
   * This is useful for cleaning up accumulated cache documents.
   * After deletion, graphs will be regenerated on next request.
   */
  async deleteAllCachedGraphs(): Promise<DeleteGraphsResponse> {
    return this.request<DeleteGraphsResponse>(
      '/api/graph/cache/delete-all',
      { method: 'DELETE' }
    );
  }

  /**
   * Delete specific cached graphs by their document IDs
   *
   * @param documentIds - Array of document IDs to delete
   * @example
   * deleteGraphsByIds(['SCIENCE_latest_20251025_114839_draft'])
   */
  async deleteGraphsByIds(documentIds: string[]): Promise<DeleteGraphsResponse> {
    return this.request<DeleteGraphsResponse>(
      '/api/graph/cache/delete-by-ids',
      {
        method: 'DELETE',
        body: JSON.stringify(documentIds)
      }
    );
  }
}

export const curriculumGraphAPI = new CurriculumGraphAPI(AUTHORING_API_BASE_URL);
export default curriculumGraphAPI;
export type { GraphStatus, CachedSubjectsList, CachedGraphDocument, CachedGraphsList, DeleteGraphsResponse };
