/**
 * Curriculum Authoring Service API Client (Standalone Version)
 * No authentication required for local development
 */

import type {
  Subject, SubjectCreate, SubjectUpdate,
  Unit, UnitCreate, UnitUpdate,
  Skill, SkillCreate, SkillUpdate,
  Subskill, SubskillCreate, SubskillUpdate,
  CurriculumTree,
  Prerequisite, PrerequisiteCreate, EntityPrerequisites, PrerequisiteGraph,
  EntityType,
  GenerateUnitRequest, GenerateSkillRequest,
  SuggestPrerequisitesRequest, ImproveDescriptionRequest,
  AIGeneratedUnit,
  DraftSummary, PublishRequest, PublishResponse, Version,
  ValidationResponse,
  ApiError
} from '@/types/curriculum-authoring';

const AUTHORING_API_BASE_URL = process.env.NEXT_PUBLIC_AUTHORING_API_URL || 'http://localhost:8001';

class CurriculumAuthoringAPI {
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

  // ==================== CURRICULUM CRUD OPERATIONS ====================

  async getSubjects(includeDrafts: boolean = false): Promise<Subject[]> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Subject[]>(
      `/api/curriculum/subjects${params.toString() ? `?${params}` : ''}`
    );
  }

  async getSubject(subjectId: string): Promise<Subject> {
    return this.request<Subject>(`/api/curriculum/subjects/${subjectId}`);
  }

  async getCurriculumTree(subjectId: string, includeDrafts: boolean = false): Promise<CurriculumTree> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<CurriculumTree>(
      `/api/curriculum/subjects/${subjectId}/tree${params.toString() ? `?${params}` : ''}`
    );
  }

  async createSubject(data: SubjectCreate): Promise<Subject> {
    return this.request<Subject>('/api/curriculum/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubject(subjectId: string, data: SubjectUpdate): Promise<Subject> {
    return this.request<Subject>(`/api/curriculum/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Units
  async getUnits(subjectId: string, includeDrafts: boolean = false): Promise<Unit[]> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Unit[]>(
      `/api/curriculum/subjects/${subjectId}/units${params.toString() ? `?${params}` : ''}`
    );
  }

  async getUnit(unitId: string): Promise<Unit> {
    return this.request<Unit>(`/api/curriculum/units/${unitId}`);
  }

  async createUnit(data: UnitCreate): Promise<Unit> {
    return this.request<Unit>('/api/curriculum/units', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUnit(unitId: string, data: UnitUpdate): Promise<Unit> {
    return this.request<Unit>(`/api/curriculum/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUnit(unitId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/curriculum/units/${unitId}`, {
      method: 'DELETE',
    });
  }

  // Skills
  async getSkills(unitId: string, includeDrafts: boolean = false): Promise<Skill[]> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Skill[]>(
      `/api/curriculum/units/${unitId}/skills${params.toString() ? `?${params}` : ''}`
    );
  }

  async createSkill(data: SkillCreate): Promise<Skill> {
    return this.request<Skill>('/api/curriculum/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSkill(skillId: string, data: SkillUpdate): Promise<Skill> {
    return this.request<Skill>(`/api/curriculum/skills/${skillId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSkill(skillId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/curriculum/skills/${skillId}`, {
      method: 'DELETE',
    });
  }

  // Subskills
  async getSubskills(skillId: string, includeDrafts: boolean = false): Promise<Subskill[]> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Subskill[]>(
      `/api/curriculum/skills/${skillId}/subskills${params.toString() ? `?${params}` : ''}`
    );
  }

  async createSubskill(data: SubskillCreate): Promise<Subskill> {
    return this.request<Subskill>('/api/curriculum/subskills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubskill(subskillId: string, data: SubskillUpdate): Promise<Subskill> {
    return this.request<Subskill>(`/api/curriculum/subskills/${subskillId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubskill(subskillId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/curriculum/subskills/${subskillId}`, {
      method: 'DELETE',
    });
  }

  // ==================== PREREQUISITE OPERATIONS ====================

  async getEntityPrerequisites(
    entityId: string,
    entityType: EntityType,
    includeDrafts: boolean = false
  ): Promise<EntityPrerequisites> {
    const params = new URLSearchParams({
      entity_type: entityType,
    });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<EntityPrerequisites>(
      `/api/prerequisites/prerequisites/${entityId}?${params}`
    );
  }

  async getSubjectGraph(subjectId: string, includeDrafts: boolean = false): Promise<PrerequisiteGraph> {
    const params = new URLSearchParams();
    if (includeDrafts) params.append('include_drafts', 'true');

    // Use new cached graph endpoint for better performance
    return this.request<PrerequisiteGraph>(
      `/api/graph/${subjectId}${params.toString() ? `?${params}` : ''}`
    );
  }

  async getBaseSkills(subjectId: string): Promise<{ subject_id: string; base_skills: string[] }> {
    return this.request<{ subject_id: string; base_skills: string[] }>(
      `/api/prerequisites/subjects/${subjectId}/base-skills`
    );
  }

  async createPrerequisite(data: PrerequisiteCreate): Promise<Prerequisite> {
    return this.request<Prerequisite>('/api/prerequisites/prerequisites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePrerequisite(prerequisiteId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/prerequisites/prerequisites/${prerequisiteId}`,
      { method: 'DELETE' }
    );
  }

  async validatePrerequisite(data: PrerequisiteCreate): Promise<ValidationResponse> {
    return this.request<ValidationResponse>('/api/prerequisites/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== AI GENERATION OPERATIONS ====================

  async generateUnit(request: GenerateUnitRequest): Promise<AIGeneratedUnit> {
    return this.request<AIGeneratedUnit>('/api/ai/generate-unit', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async generateSkill(request: GenerateSkillRequest): Promise<{
    skill: SkillCreate;
    subskills: SubskillCreate[];
  }> {
    return this.request<{
      skill: SkillCreate;
      subskills: SubskillCreate[];
    }>('/api/ai/generate-skill', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async suggestPrerequisites(request: SuggestPrerequisitesRequest): Promise<{
    suggestions: Array<{
      prerequisite_id: string;
      prerequisite_description: string;
      confidence: number;
      reasoning: string;
    }>;
  }> {
    return this.request<{
      suggestions: Array<{
        prerequisite_id: string;
        prerequisite_description: string;
        confidence: number;
        reasoning: string;
      }>;
    }>('/api/ai/suggest-prerequisites', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async improveDescription(request: ImproveDescriptionRequest): Promise<{
    original: string;
    improved: string;
  }> {
    return this.request<{
      original: string;
      improved: string;
    }>('/api/ai/improve-description', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==================== PUBLISHING & VERSIONING ====================

  async getDraftChanges(subjectId: string): Promise<DraftSummary> {
    return this.request<DraftSummary>(`/api/publishing/subjects/${subjectId}/draft-changes`);
  }

  async publishSubject(subjectId: string, request: PublishRequest): Promise<PublishResponse> {
    return this.request<PublishResponse>(`/api/publishing/subjects/${subjectId}/publish`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getVersionHistory(subjectId: string): Promise<Version[]> {
    return this.request<Version[]>(`/api/publishing/subjects/${subjectId}/versions`);
  }

  async getActiveVersion(subjectId: string): Promise<Version> {
    return this.request<Version>(`/api/publishing/subjects/${subjectId}/active-version`);
  }

  async rollbackVersion(subjectId: string, versionId: string): Promise<PublishResponse> {
    return this.request<PublishResponse>(
      `/api/publishing/subjects/${subjectId}/rollback/${versionId}`,
      { method: 'POST' }
    );
  }
}

export const curriculumAuthoringAPI = new CurriculumAuthoringAPI(AUTHORING_API_BASE_URL);
export default curriculumAuthoringAPI;
