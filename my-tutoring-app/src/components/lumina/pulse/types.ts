/**
 * Lumina Pulse — TypeScript Types
 *
 * Mirrors backend models from backend/app/models/pulse.py
 * See: Lumina_PRD_Pulse.md §7.3
 */

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export type PulseBand = 'frontier' | 'current' | 'review';

export type PulsePhase = 'ready' | 'loading' | 'practicing' | 'leapfrog' | 'summary' | 'error';

export const BAND_LABELS: Record<PulseBand, string> = {
  frontier: 'Exploring new territory',
  current: 'Building skills',
  review: 'Quick review',
};

export const BAND_COLORS: Record<PulseBand, string> = {
  frontier: 'text-violet-400',
  current: 'text-blue-400',
  review: 'text-emerald-400',
};

export const BAND_BG_COLORS: Record<PulseBand, string> = {
  frontier: 'bg-violet-500/20 border-violet-500/30',
  current: 'bg-blue-500/20 border-blue-500/30',
  review: 'bg-emerald-500/20 border-emerald-500/30',
};

// ---------------------------------------------------------------------------
// Session Assembly (from backend)
// ---------------------------------------------------------------------------

export interface ItemFrontierContext {
  dag_distance: number;
  ancestors_if_passed: number;
  ancestor_skill_names: string[];
  unit_name: string;
  unit_mastered: number;
  unit_total: number;
  next_skill_name: string;
  last_tested_ago: string;
}

export interface UnitProgress {
  unit_name: string;
  skill_id: string;
  mastered: number;
  total: number;
  branches_remaining: number;
}

export interface SessionFrontierContext {
  frontier_depth: number;
  max_depth: number;
  total_mastered: number;
  total_nodes: number;
  units_in_progress: UnitProgress[];
}

export interface PulseItemSpec {
  item_id: string;
  band: PulseBand;
  subskill_id: string;
  skill_id: string;
  subject: string;
  description: string;
  target_mode: number;          // 1-6
  target_beta: number;
  eval_mode_name?: string;      // e.g. 'recall', 'apply', 'analyze', 'evaluate'
  lesson_group_id: string;
  primitive_affinity?: string;
  eval_mode_hint?: string;  // curriculum-assigned eval mode (e.g. 'subitize', 'plot')
  frontier_context?: ItemFrontierContext;
}

export interface RecentPrimitive {
  primitive_type: string;
  eval_mode: string;
  score: number;
  subskill_id: string;
}

export interface PulseSessionResponse {
  session_id: string;
  student_id: number;
  subject: string;
  is_cold_start: boolean;
  items: PulseItemSpec[];
  recent_primitives: RecentPrimitive[];
  session_meta: Record<string, unknown>;
  frontier_context?: SessionFrontierContext;
}

// ---------------------------------------------------------------------------
// Result Processing
// ---------------------------------------------------------------------------

export interface PulseResultRequest {
  item_id: string;
  score: number;                // 0-10
  primitive_type: string;
  eval_mode: string;
  duration_ms: number;
}

export interface ThetaUpdate {
  skill_id: string;
  old_theta: number;
  new_theta: number;
  sigma?: number;
  earned_level: number;
}

export interface SkillDetail {
  subskill_id: string;
  skill_id: string;
  skill_description: string;
}

export interface GateUpdate {
  subskill_id: string;
  old_gate: number;
  new_gate: number;
  skill_id?: string;
  skill_description?: string;
}

export interface LeapfrogEvent {
  lesson_group_id: string;
  probed_skills: string[];
  inferred_skills: string[];
  aggregate_score: number;
  probed_details?: SkillDetail[];
  inferred_details?: SkillDetail[];
}

export interface SkillUnlockProgress {
  skill_id: string;
  skill_description: string;
  total_subskills: number;
  unlocked_subskills: number;
}

export interface GateThresholds {
  g1: number;
  g2: number;
  g3: number;
  g4: number;
}

export interface GateProgress {
  primitive_type: string;
  current_gate: number;   // 0-4
  thresholds: GateThresholds;
  theta: number;
  next_gate: number | null;
  next_gate_theta: number | null;
  min_beta: number;
  max_beta: number;
}

/** IRT probability data returned with each result */
export interface IrtProbabilityData {
  p_correct: number;         // P(correct) at current theta
  item_information: number;  // Fisher information at current theta
  discrimination_a: number;  // Item discrimination parameter
  guessing_c: number;        // Guessing floor (0 for constructed response)
}

export interface PulseResultResponse {
  item_id: string;
  theta_update: ThetaUpdate;
  gate_update?: GateUpdate;
  leapfrog?: LeapfrogEvent;
  gate_progress?: GateProgress;
  irt?: IrtProbabilityData;
  session_progress: {
    items_completed: number;
    items_total: number;
    is_complete: boolean;
    bands_summary: Record<string, { total: number; completed: number; avg_score: number }>;
  };
}

// ---------------------------------------------------------------------------
// Session Summary
// ---------------------------------------------------------------------------

export interface PulseBandSummary {
  band: PulseBand;
  items_total: number;
  items_completed: number;
  avg_score: number;
}

/** Session-level IRT summary — sigma reduction, accuracy vs predicted */
export interface SessionIrtSummary {
  start_sigma: number;
  end_sigma: number;
  sigma_reduction: number;
  predicted_correct: number;  // sum of P(correct) for all items
  actual_correct: number;     // count of items scored >= 9.0
  total_items: number;
  avg_information: number;    // mean item information across session
}

export interface PulseSessionSummary {
  session_id: string;
  subject: string;
  is_cold_start: boolean;
  items_completed: number;
  items_total: number;
  duration_ms: number;
  bands: Record<string, PulseBandSummary>;
  skills_advanced: GateUpdate[];
  theta_changes: ThetaUpdate[];
  leapfrogs: LeapfrogEvent[];
  frontier_expanded: boolean;
  celebration_message: string;
  skill_progress?: SkillUnlockProgress[];
  irt_summary?: SessionIrtSummary;
}
