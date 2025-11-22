// TypeScript types for problems and prompts
// Based on curriculum-authoring-service backend models

// ============================================================================
// Problem Types
// ============================================================================

export type ProblemType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_blanks'
  | 'matching_activity'
  | 'sequencing_activity'
  | 'categorization_activity'
  | 'scenario_question'
  | 'short_answer'
  | 'live_interaction';

export type Difficulty = 'easy' | 'medium' | 'hard';

// ============================================================================
// Visual Intent & Live Interaction Support
// ============================================================================

export interface VisualIntent {
  needs_visual: boolean;
  visual_type?: string;
  visual_purpose?: string;
  visual_id?: string;
}

export interface LiveInteractionConfig {
  prompt?: {
    system: string;
    instruction: string;
    voice?: string;
  };
  interaction_mode?: 'click' | 'speech' | 'drag' | 'trace';
  targets?: Array<{
    id: string;
    is_correct: boolean;
    description?: string;
  }>;
  evaluation?: {
    mode?: string;
    success_criteria?: string[];
  };
}

// ============================================================================
// Individual problem structures (matching backend schemas)
// ============================================================================

export interface MultipleChoiceProblem {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  question: string;
  question_visual_intent?: VisualIntent;
  options: Array<{
    id: string;
    text: string;
  }>;
  correct_option_id: string;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface TrueFalseProblem {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  statement: string;
  statement_visual_intent?: VisualIntent;
  correct: boolean;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface FillInBlanksProblem {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  text_with_blanks: string;
  blanks: Array<{
    id: string;
    correct_answers: string[];
    case_sensitive: boolean;
  }>;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface ShortAnswerProblem {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  question: string;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface MatchingActivity {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  prompt: string;
  left_items: Array<{
    id: string;
    text: string;
  }>;
  right_items: Array<{
    id: string;
    text: string;
  }>;
  mappings: Array<{
    left_id: string;
    right_ids: string[];
  }>;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface SequencingActivity {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  instruction: string;
  items: string[];
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface CategorizationActivity {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  instruction: string;
  categories: string[];
  categorization_items: Array<{
    item_text: string;
    correct_category: string;
  }>;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface ScenarioQuestion {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  scenario: string;
  scenario_question: string;
  scenario_answer: string;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
  live_interaction_config?: LiveInteractionConfig;
}

export interface LiveInteractionProblem {
  id?: string;
  difficulty: Difficulty;
  grade_level?: string;
  display_visual_intent?: VisualIntent;
  interaction_config: LiveInteractionConfig;
  rationale: string;
  teaching_note?: string;
  success_criteria?: string[];
}

export type ProblemJson =
  | MultipleChoiceProblem
  | TrueFalseProblem
  | FillInBlanksProblem
  | ShortAnswerProblem
  | MatchingActivity
  | SequencingActivity
  | CategorizationActivity
  | ScenarioQuestion
  | LiveInteractionProblem;

// ============================================================================
// Problem Database Model
// ============================================================================

export interface EditHistoryEntry {
  timestamp: string;
  user: string;
  changes: Record<string, any>;
}

// Extended generation metadata for problem generation phase tracking
export interface ContextPrimitivesUsed {
  objects: string[];
  characters: string[];
  scenarios: string[];
  locations: string[];
}

export interface AICoachConfig {
  enabled: boolean;
  mode?: string;
  guidance_level?: string;
  interaction_pattern?: string;
  rationale?: string;
  hints_enabled?: boolean;
  verbal_explanation_enabled?: boolean;
  encouragement_phrases?: string[];
}

export interface GenerationMetadata {
  generation_id?: string;
  enable_ai_coach?: boolean;
  ai_coach_rationale?: string;
  type_selection_reasoning?: string;
  model?: string;
  context_primitives?: ContextPrimitivesUsed;
  complexity?: string;
}

export interface ProblemInDB {
  problem_id: string;
  subskill_id: string;
  version_id: string;
  problem_type: ProblemType;
  problem_json: ProblemJson;

  // Generation metadata (for replicability)
  generation_prompt?: string;
  generation_model?: string;
  generation_temperature?: number;
  generation_timestamp?: string;
  generation_duration_ms?: number;

  // Extended metadata (from generation phases)
  generation_metadata?: GenerationMetadata;

  // Status
  is_draft: boolean;
  is_active: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
  edit_history?: EditHistoryEntry[];
}

// ============================================================================
// Problem API Request/Response Models
// ============================================================================

export interface GenerateProblemsRequest {
  version_id: string;
  count?: number; // Default 5, range 1-20
  problem_types?: ProblemType[];
  temperature?: number; // 0.0-1.0, default 0.7
  auto_evaluate?: boolean; // Default true
  custom_prompt?: string; // Override default prompt
}

export interface RegenerateProblemRequest {
  modified_prompt?: string;
  temperature?: number;
}

export interface UpdateProblemRequest {
  problem_json?: ProblemJson;
  is_draft?: boolean;
  is_active?: boolean;
}

// ============================================================================
// Problem Evaluation Models
// ============================================================================

export type EvaluationQuality = 'excellent' | 'good' | 'needs_revision' | 'unacceptable';
export type EvaluationRecommendation = 'approve' | 'approve_with_suggestions' | 'revise' | 'reject';
export type FinalRecommendation = 'approve' | 'revise' | 'reject';

export interface ProblemEvaluation {
  evaluation_id: string;
  problem_id: string;
  evaluation_timestamp: string;

  // Tier 1: Structural Validation
  tier1_passed: boolean;
  tier1_issues: string[];

  // Tier 2: Heuristic Validation
  tier2_passed: boolean;
  readability_score?: number | null;
  visual_coherence_passed: boolean;
  tier2_issues: string[];

  // Tier 3: LLM Judge (all optional - only present if LLM evaluation was run)
  pedagogical_approach_score?: number | null; // 1-10
  alignment_score?: number | null;
  clarity_score?: number | null;
  correctness_score?: number | null;
  bias_score?: number | null;
  llm_reasoning?: string | null;
  llm_suggestions?: string[] | null;

  // Final
  final_recommendation: FinalRecommendation;
  overall_score: number; // 0-10

  // Full nested objects (optional, for detailed views)
  structural_result?: any;
  heuristic_result?: any;
  llm_judgment?: any;
}

// ============================================================================
// Prompt Template Models
// ============================================================================

export type PromptTemplateType =
  | 'problem_generation'
  | 'content_generation'
  | 'problem_evaluation'
  | 'content_evaluation';

export interface PerformanceMetrics {
  avg_evaluation_score?: number;
  approval_rate?: number;
  avg_pedagogical_score?: number;
  avg_alignment_score?: number;
  avg_clarity_score?: number;
  avg_correctness_score?: number;
  avg_bias_score?: number;
  total_generations: number;
  total_approvals: number;
  total_revisions: number;
  total_rejections: number;
}

export interface PromptTemplate {
  template_id: string;
  template_name: string;
  template_type: PromptTemplateType;
  template_text: string;
  template_variables: string[];
  version: number;
  is_active: boolean;
  usage_count: number;
  performance_metrics?: PerformanceMetrics;
  created_at: string;
  updated_at: string;
  created_by?: string;
  change_notes?: string;
}

export interface CreatePromptTemplateRequest {
  template_name: string;
  template_type: PromptTemplateType;
  template_text: string;
  template_variables: string[];
  is_active?: boolean;
  change_notes?: string;
}

export interface UpdatePromptTemplateRequest {
  template_text?: string;
  template_variables?: string[];
  is_active?: boolean;
  change_notes?: string;
}

// ============================================================================
// UI Helper Types
// ============================================================================

export interface ProblemWithEvaluation extends ProblemInDB {
  evaluation?: ProblemEvaluation;
}

export interface GenerationStatus {
  isGenerating: boolean;
  progress?: number;
  message?: string;
}
