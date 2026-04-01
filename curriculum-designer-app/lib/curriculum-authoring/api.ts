/**
 * Curriculum Authoring Service API Client (Standalone Version)
 * No authentication required for local development
 *
 * All subject-scoped endpoints require both grade and subject_id as query
 * parameters so the caller always explicitly chooses which curriculum
 * partition to access.
 */

import type {
  Subject, SubjectCreate, SubjectUpdate,
  Unit, UnitCreate, UnitUpdate,
  Skill, SkillCreate, SkillUpdate,
  Subskill, SubskillCreate, SubskillUpdate,
  CurriculumTree,
  Prerequisite, PrerequisiteCreate, EntityPrerequisites, PrerequisiteGraph,
  EntityType,
  Primitive, PrimitiveCategory,
  GenerateUnitRequest, GenerateSkillRequest,
  SuggestPrerequisitesRequest, ImproveDescriptionRequest,
  AIGeneratedUnit,
  DraftSummary, PublishRequest, PublishResponse, DeployResponse, DeployStatus, Version,
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

  async getSubject(subjectId: string, grade: string): Promise<Subject> {
    const params = new URLSearchParams({ grade });
    return this.request<Subject>(`/api/curriculum/subjects/${subjectId}?${params}`);
  }

  async getCurriculumTree(subjectId: string, grade: string, includeDrafts: boolean = false): Promise<CurriculumTree> {
    const params = new URLSearchParams({ grade });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<CurriculumTree>(
      `/api/curriculum/subjects/${subjectId}/tree?${params}`
    );
  }

  async createSubject(data: SubjectCreate): Promise<Subject> {
    return this.request<Subject>('/api/curriculum/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubject(subjectId: string, data: SubjectUpdate, grade: string): Promise<Subject> {
    const params = new URLSearchParams({ grade });
    return this.request<Subject>(`/api/curriculum/subjects/${subjectId}?${params}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Units
  async getUnits(subjectId: string, grade: string, includeDrafts: boolean = false): Promise<Unit[]> {
    const params = new URLSearchParams({ grade });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Unit[]>(
      `/api/curriculum/subjects/${subjectId}/units?${params}`
    );
  }

  async getUnit(unitId: string, grade: string, subjectId: string): Promise<Unit> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Unit>(`/api/curriculum/units/${unitId}?${params}`);
  }

  async createUnit(data: UnitCreate, grade: string): Promise<Unit> {
    const params = new URLSearchParams({ grade });
    return this.request<Unit>(`/api/curriculum/units?${params}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUnit(unitId: string, data: UnitUpdate, grade: string, subjectId: string): Promise<Unit> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Unit>(`/api/curriculum/units/${unitId}?${params}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUnit(unitId: string, grade: string, subjectId: string): Promise<{ message: string }> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<{ message: string }>(`/api/curriculum/units/${unitId}?${params}`, {
      method: 'DELETE',
    });
  }

  // Skills
  async getSkills(unitId: string, grade: string, subjectId: string, includeDrafts: boolean = false): Promise<Skill[]> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Skill[]>(
      `/api/curriculum/units/${unitId}/skills?${params}`
    );
  }

  async createSkill(data: SkillCreate, grade: string, subjectId: string): Promise<Skill> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Skill>(`/api/curriculum/skills?${params}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSkill(skillId: string, data: SkillUpdate, grade: string, subjectId: string): Promise<Skill> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Skill>(`/api/curriculum/skills/${skillId}?${params}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSkill(skillId: string, grade: string, subjectId: string): Promise<{ message: string }> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<{ message: string }>(`/api/curriculum/skills/${skillId}?${params}`, {
      method: 'DELETE',
    });
  }

  // Subskills
  async getSubskills(skillId: string, grade: string, subjectId: string, includeDrafts: boolean = false): Promise<Subskill[]> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<Subskill[]>(
      `/api/curriculum/skills/${skillId}/subskills?${params}`
    );
  }

  async createSubskill(data: SubskillCreate, grade: string, subjectId: string): Promise<Subskill> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Subskill>(`/api/curriculum/subskills?${params}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubskill(subskillId: string, data: SubskillUpdate, grade: string, subjectId: string): Promise<Subskill> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<Subskill>(`/api/curriculum/subskills/${subskillId}?${params}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubskill(subskillId: string, grade: string, subjectId: string): Promise<{ message: string }> {
    const params = new URLSearchParams({ grade, subject_id: subjectId });
    return this.request<{ message: string }>(`/api/curriculum/subskills/${subskillId}?${params}`, {
      method: 'DELETE',
    });
  }

  // ==================== EDGE/GRAPH OPERATIONS ====================

  async getEntityPrerequisites(
    entityId: string,
    entityType: EntityType,
    grade: string,
    subjectId: string,
    includeDrafts: boolean = false
  ): Promise<EntityPrerequisites> {
    const params = new URLSearchParams({
      entity_type: entityType,
      grade,
      subject_id: subjectId,
    });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<EntityPrerequisites>(
      `/api/edges/${entityId}?${params}`
    );
  }

  async getSubjectGraph(subjectId: string, grade: string, includeDrafts: boolean = false): Promise<PrerequisiteGraph> {
    const params = new URLSearchParams({ grade });
    if (includeDrafts) params.append('include_drafts', 'true');

    return this.request<PrerequisiteGraph>(
      `/api/graph/${subjectId}?${params}`
    );
  }

  async getBaseSkills(subjectId: string, grade: string): Promise<{ subject_id: string; base_skills: string[] }> {
    const params = new URLSearchParams({ grade });
    return this.request<{ subject_id: string; base_skills: string[] }>(
      `/api/edges/subjects/${subjectId}/base-skills?${params}`
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

  async suggestPrimitives(request: {
    subskill_description: string;
    difficulty_start?: number;
    difficulty_end?: number;
    target_difficulty?: number;
    grade?: string;
    subject_id?: string;
    catalog: Array<{
      id: string;
      domain: string;
      description: string;
      supportsEvaluation: boolean;
      evalModes: Array<{
        evalMode: string;
        label: string;
        beta: number;
        scaffoldingMode: number;
        challengeTypes: string[];
        description: string;
      }>;
    }>;
  }): Promise<{
    suggestions: Array<{
      primitive_id: string;
      rationale: string;
      recommended_eval_modes: string[];
      eval_mode_rationale?: string;
      confidence: number;
    }>;
    reasoning: string;
  }> {
    return this.request('/api/ai/suggest-primitives', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

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

  async getDraftChanges(subjectId: string, grade: string): Promise<DraftSummary> {
    const params = new URLSearchParams({ grade });
    return this.request<DraftSummary>(`/api/publishing/subjects/${subjectId}/draft-changes?${params}`);
  }

  async publishSubject(subjectId: string, request: PublishRequest, grade: string): Promise<PublishResponse> {
    const params = new URLSearchParams({ grade });
    return this.request<PublishResponse>(`/api/publishing/subjects/${subjectId}/publish?${params}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getVersionHistory(subjectId: string, grade: string): Promise<Version[]> {
    const params = new URLSearchParams({ grade });
    return this.request<Version[]>(`/api/publishing/subjects/${subjectId}/versions?${params}`);
  }

  async getActiveVersion(subjectId: string, grade: string): Promise<Version> {
    const params = new URLSearchParams({ grade });
    return this.request<Version>(`/api/publishing/subjects/${subjectId}/active-version?${params}`);
  }

  async rollbackVersion(subjectId: string, versionId: string, grade: string): Promise<PublishResponse> {
    const params = new URLSearchParams({ grade });
    return this.request<PublishResponse>(
      `/api/publishing/subjects/${subjectId}/rollback/${versionId}?${params}`,
      { method: 'POST' }
    );
  }

  async deployCurriculum(subjectId: string, versionId?: string): Promise<DeployResponse> {
    const params = versionId ? `?version_id=${versionId}` : '';
    return this.request<DeployResponse>(
      `/api/publishing/subjects/${subjectId}/deploy${params}`,
      { method: 'POST' }
    );
  }

  async getDeployStatus(subjectId: string): Promise<DeployStatus> {
    return this.request<DeployStatus>(
      `/api/publishing/subjects/${subjectId}/deploy/status`
    );
  }

  // ==================== PRIMITIVE ENDPOINTS ====================

  async getPrimitives(): Promise<Primitive[]> {
    return this.request<Primitive[]>('/api/curriculum/primitives');
  }

  async getPrimitivesByCategory(category: PrimitiveCategory): Promise<Primitive[]> {
    return this.request<Primitive[]>(`/api/curriculum/primitives/categories/${category}`);
  }

}

export const curriculumAuthoringAPI = new CurriculumAuthoringAPI(AUTHORING_API_BASE_URL);
export default curriculumAuthoringAPI;
