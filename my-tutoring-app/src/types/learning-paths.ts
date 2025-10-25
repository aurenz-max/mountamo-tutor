// types/learning-paths.ts
// TypeScript interfaces for the BigQuery-backed prerequisite graph API

export interface VisualizationResponse {
  units: Unit[];
}

export interface Unit {
  unit_id: string;
  unit_title: string;
  subject: string;
  skills: Skill[];
}

export interface Skill {
  skill_id: string;
  skill_description: string;
  subject: string;
  subskills: Subskill[];
  prerequisites: Prerequisite[];
  unlocks: Unlock[];
}

export interface Subskill {
  subskill_id: string;
  description: string;
  sequence_order: number;
  difficulty_start: number | null;
  difficulty_end: number | null;
  prerequisites: Prerequisite[];
  student_data?: StudentData;
}

export interface StudentData {
  unlocked: boolean;
  proficiency: number;
  attempts: number;
  unlock_data?: UnlockData[];
}

export interface UnlockData {
  id: string;
  description: string;
  required: number;
  current_proficiency: number;
}

export interface Prerequisite {
  prerequisite_id: string;
  prerequisite_type: 'skill' | 'subskill';
  min_proficiency_threshold: number;
  subject?: string;
  description?: string;
}

export interface Unlock {
  unlocks_id: string;
  unlocks_type: 'skill' | 'subskill';
  threshold: number;
  subject?: string;
  description?: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  count: number;
}

export interface Recommendation {
  entity_id: string;
  entity_type: 'subskill';
  description: string;
  subject: string;
  skill_id: string;
  skill_description: string;
  priority: 'high' | 'medium';
  priority_order: number;
  reason: 'coverage_gap' | 'performance_gap' | 'nearly_mastered';
  message: string;
  current_proficiency: number;
  unlocked: boolean;
  prerequisites_met: PrerequisiteCheck[];
}

export interface PrerequisiteCheck {
  prerequisite_id: string;
  prerequisite_type: 'skill' | 'subskill';
  required_threshold: number;
  current_proficiency: number;
  met: boolean;
}

export interface UnlockedEntitiesResponse {
  student_id: number;
  unlocked_entities: string[];
  count: number;
}

export interface SkillDetailsResponse {
  skill_id: string;
  skill_description: string;
  subject: string;
  subskills: Subskill[];
  prerequisites: Prerequisite[];
  unlocks: Unlock[];
}

export interface PrerequisiteCheckResponse {
  student_id: number;
  entity_id: string;
  entity_type: 'skill' | 'subskill';
  unlocked: boolean;
  prerequisites: PrerequisiteCheck[];
}

// ==================== Student State Engine Types ====================

/**
 * Node status calculated by Student State Engine
 */
export type NodeStatus = 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'MASTERED';

/**
 * Graph node decorated with student progress data
 */
export interface StudentGraphNode {
  // Core node identity
  id: string;
  type: 'skill' | 'subskill';
  label: string;
  is_draft?: boolean;

  // Student state (decorated by backend)
  student_proficiency: number;
  status: NodeStatus;
  attempt_count: number;
  last_attempt_at: string | null;

  // Enriched metadata from curriculum
  subject_id?: string;
  unit_id?: string;
  unit_title?: string;
  unit_order?: number;
  skill_id?: string;
  skill_description?: string;
  skill_order?: number;
  subskill_order?: number;
  difficulty_start?: number;
  difficulty_end?: number;
  target_difficulty?: number;
}

/**
 * Graph edge representing prerequisite relationship
 */
export interface StudentGraphEdge {
  id?: string;
  source: string;
  target: string;
  threshold?: number;
  is_draft?: boolean;
  source_type?: string;
  target_type?: string;
  version_id?: string;
}

/**
 * Complete student graph response from Student State Engine
 * Endpoint: GET /api/learning-paths/{subject_id}/student-graph/{student_id}
 */
export interface StudentGraphResponse {
  nodes: StudentGraphNode[];
  edges: StudentGraphEdge[];
  student_id: number;
  subject_id: string;
  version_id?: string;
  generated_at?: string;
}
