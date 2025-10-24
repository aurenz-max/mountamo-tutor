// types/learning-paths.ts
// TypeScript interfaces for the BigQuery-backed prerequisite graph API

export interface VisualizationResponse {
  skills: Skill[];
}

export interface Skill {
  skill_id: string;
  title: string;
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
