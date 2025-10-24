/**
 * TypeScript types for Curriculum Authoring Service
 * Matches the backend Pydantic models from curriculum-authoring-service
 */

// ==================== BASE ENTITY TYPES ====================

export type EntityType = 'subject' | 'unit' | 'skill' | 'subskill';

export interface SubjectBase {
  subject_id: string;
  subject_name: string;
  description?: string;
  grade_level?: string;
}

export interface SubjectCreate extends SubjectBase {}

export interface SubjectUpdate {
  subject_name?: string;
  description?: string;
  grade_level?: string;
}

export interface Subject extends SubjectBase {
  version_id: string;
  is_active: boolean;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface UnitBase {
  unit_id: string;
  subject_id: string;
  unit_title: string;
  unit_order?: number;
  description?: string;
}

export interface UnitCreate extends UnitBase {}

export interface UnitUpdate {
  unit_title?: string;
  unit_order?: number;
  description?: string;
}

export interface Unit extends UnitBase {
  version_id: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface SkillBase {
  skill_id: string;
  unit_id: string;
  skill_description: string;
  skill_order?: number;
}

export interface SkillCreate extends SkillBase {}

export interface SkillUpdate {
  skill_description?: string;
  skill_order?: number;
}

export interface Skill extends SkillBase {
  version_id: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubskillBase {
  subskill_id: string;
  skill_id: string;
  subskill_description: string;
  subskill_order?: number;
  difficulty_start?: number;
  difficulty_end?: number;
  target_difficulty?: number;
}

export interface SubskillCreate extends SubskillBase {}

export interface SubskillUpdate {
  subskill_description?: string;
  subskill_order?: number;
  difficulty_start?: number;
  difficulty_end?: number;
  target_difficulty?: number;
}

export interface Subskill extends SubskillBase {
  version_id: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== TREE VIEW TYPES ====================

export interface SubskillNode {
  id: string;
  description: string;
  order?: number;
  difficulty_range?: {
    start?: number;
    end?: number;
    target?: number;
  };
  is_draft: boolean;
}

export interface SkillNode {
  id: string;
  description: string;
  order?: number;
  is_draft: boolean;
  subskills: SubskillNode[];
}

export interface UnitNode {
  id: string;
  title: string;
  order?: number;
  description?: string;
  is_draft: boolean;
  skills: SkillNode[];
}

export interface CurriculumTree {
  subject_id: string;
  subject_name: string;
  grade_level?: string;
  version_id: string;
  units: UnitNode[];
}

// ==================== PREREQUISITE TYPES ====================

export interface PrerequisiteBase {
  prerequisite_entity_id: string;
  prerequisite_entity_type: EntityType;
  unlocks_entity_id: string;
  unlocks_entity_type: EntityType;
  min_proficiency_threshold?: number;
}

export interface PrerequisiteCreate extends PrerequisiteBase {}

export interface Prerequisite extends PrerequisiteBase {
  prerequisite_id: string;
  version_id: string;
  is_draft: boolean;
  created_at: string;
}

export interface EntityPrerequisites {
  entity_id: string;
  entity_type: EntityType;
  prerequisites: Prerequisite[];
  unlocks: Prerequisite[];
}

export interface PrerequisiteGraphNode {
  id: string;
  type: EntityType;
  label: string;
  is_draft?: boolean;
  // Enriched metadata from build_enriched_graph
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

export interface PrerequisiteGraphEdge {
  id?: string;
  source: string;
  target: string;
  threshold?: number;
  is_draft?: boolean;
  // Additional metadata
  source_type?: string;
  target_type?: string;
  version_id?: string;
}

export interface PrerequisiteGraph {
  subject_id: string;
  nodes: PrerequisiteGraphNode[];
  edges: PrerequisiteGraphEdge[];
}

// ==================== AI GENERATION TYPES ====================

export interface GenerateUnitRequest {
  subject: string;
  grade_level: string;
  topic_prompt: string;
  context?: string;
}

export interface GenerateSkillRequest {
  subject: string;
  unit_title: string;
  skill_prompt: string;
}

export interface SuggestPrerequisitesRequest {
  subject: string;
  entity_id: string;
  entity_description: string;
  available_prerequisites: Array<{
    id: string;
    description: string;
  }>;
}

export interface ImproveDescriptionRequest {
  original_description: string;
  entity_type: 'unit' | 'skill' | 'subskill';
  subject: string;
}

export interface AIGeneratedUnit {
  unit: UnitCreate;
  skills: Array<{
    skill: SkillCreate;
    subskills: SubskillCreate[];
  }>;
}

// ==================== PUBLISHING TYPES ====================

export interface DraftChange {
  entity_id: string;
  entity_type: EntityType;
  change_type: 'create' | 'update' | 'delete';
  entity_data: any;
  is_prerequisite?: boolean;
}

export interface DraftSummary {
  subject_id: string;
  draft_version_id: string;
  changes: DraftChange[];
  total_changes: number;
  created_count: number;
  updated_count: number;
  deleted_count: number;
  prerequisite_changes: number;
}

export interface PublishRequest {
  subject_id: string;
  version_description: string;
  change_summary: string;
}

export interface PublishResponse {
  success: boolean;
  version_id: string;
  subject_id: string;
  published_at: string;
  changes_count: number;
  message: string;
}

export interface Version {
  version_id: string;
  subject_id: string;
  version_number: number;
  description: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  activated_at?: string;
  change_summary?: string;
}

// ==================== UI STATE TYPES ====================

export interface SelectedEntity {
  type: EntityType;
  id: string;
  data: Subject | Unit | Skill | Subskill;
}

export interface EditorState {
  selectedEntity?: SelectedEntity;
  isEditing: boolean;
  isDirty: boolean;
  showAIGenerator: boolean;
  showPrerequisitePanel: boolean;
  showVersionHistory: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiError {
  detail: string;
  status?: number;
}

export interface ValidationResponse {
  valid: boolean;
  error?: string;
}
