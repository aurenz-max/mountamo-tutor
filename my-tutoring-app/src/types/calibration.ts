/**
 * Calibration Display Types (Difficulty Calibration PRD — Phase 2)
 *
 * TypeScript interfaces matching the backend calibration_api.py response models.
 */

// ---------------------------------------------------------------------------
// Student Ability
// ---------------------------------------------------------------------------

export interface ThetaHistoryPoint {
  theta: number;
  earned_level: number;
  timestamp: string;
  primitive_type?: string;
  eval_mode?: string;
  score?: number;
}

export type ContextualPhase =
  | "first_assessment"
  | "early_growth"
  | "steady_climb"
  | "plateau"
  | "near_target"
  | "mastery_achieved";

export interface ContextualMessage {
  phase: ContextualPhase;
  message: string;
  previous_el?: number;
  current_el: number;
  mastery_threshold: number;
}

export interface SkillAbility {
  skill_id: string;
  theta: number;
  sigma: number;
  earned_level: number;
  total_items_seen: number;
  prior_source: string;
  theta_history: ThetaHistoryPoint[];
  contextual_message?: ContextualMessage;
  created_at: string;
  updated_at: string;
}

export interface StudentAbilitySummary {
  student_id: number;
  abilities: SkillAbility[];
  count: number;
  queried_at: string;
}

// ---------------------------------------------------------------------------
// Item Calibration (admin)
// ---------------------------------------------------------------------------

export interface ItemCalibration {
  item_key: string;
  primitive_type: string;
  eval_mode: string;
  prior_beta: number;
  empirical_beta?: number;
  calibrated_beta: number;
  total_observations: number;
  total_correct: number;
  credibility_z: number;
  convergence_delta?: number;
  created_at: string;
  updated_at: string;
}

export interface ItemCalibrationList {
  items: ItemCalibration[];
  count: number;
  queried_at: string;
}
