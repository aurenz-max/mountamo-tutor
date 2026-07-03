// src/lib/sessionPlanAPI.ts
/**
 * API client for the structured daily session plan.
 * PRD Daily Learning Experience §3 — Planning Engine.
 *
 * Endpoint: GET /api/daily-activities/daily-plan/{studentId}/session
 * Returns: DailySessionPlan with 4–5 lesson blocks.
 */

import { authApi } from './authApiClient';

// ---------------------------------------------------------------------------
// TypeScript types (mirrors backend/app/models/lesson_plan.py)
// ---------------------------------------------------------------------------

export type BloomLevel = 'identify' | 'explain' | 'apply';
export type BlockType  = 'lesson' | 'practice' | 'retest';
export type SkillStatus = 'new' | 'review' | 'retest' | 'mastered';

export interface BlockSubskill {
  subskill_id:   string;
  // Parent skill id resolved from the curriculum hierarchy. Optional because
  // plans generated before this field existed won't carry it.
  skill_id?:     string;
  subskill_name: string;
  bloom_phase:   BloomLevel;
  gate:          number;
  status:        SkillStatus;
}

export interface BloomPhase {
  phase:              BloomLevel;
  subskill_id:        string;
  subskill_name:      string;
  estimated_minutes:  number;
}

export interface LessonBlock {
  block_id:             string;
  block_index:          number;
  type:                 BlockType;
  lesson_group_id:      string;
  title:                string;
  subject:              string;
  unit_title?:          string;
  estimated_minutes:    number;
  subskills:            BlockSubskill[];
  bloom_phases:         BloomPhase[];
  priority_score:       number;
  insert_break_after:   boolean;
  celebration_message:  string;
}

export interface DailySessionPlan {
  student_id:               string;
  date:                     string;   // YYYY-MM-DD
  day_of_week:              string;
  budget_minutes:           number;
  review_budget_minutes:    number;
  intro_budget_minutes:     number;
  estimated_total_minutes:  number;
  blocks:                   LessonBlock[];
  /** Block ids finished today — persisted server-side on the day's plan doc. */
  completed_block_ids?:     string[];
  total_subskills:          number;
  new_subskills:            number;
  review_subskills:         number;
  warnings:                 string[];
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

export async function fetchDailySessionPlan(
  studentId: string | number,
  options?: { refresh?: boolean },
): Promise<DailySessionPlan> {
  const query = options?.refresh ? '?refresh=true' : '';
  return authApi.get<DailySessionPlan>(
    `/api/daily-activities/daily-plan/${studentId}/session${query}`,
  );
}

/**
 * Persist a finished block onto today's plan doc so progress survives
 * navigation, reloads, and device switches. Idempotent server-side.
 */
export async function markSessionBlockComplete(
  studentId: string | number,
  blockId: string,
  planDate?: string,
): Promise<{ success: boolean }> {
  const query = planDate ? `?plan_date=${encodeURIComponent(planDate)}` : '';
  return authApi.post<{ success: boolean }>(
    `/api/daily-activities/daily-plan/${studentId}/session/blocks/${encodeURIComponent(blockId)}/complete${query}`,
  );
}
