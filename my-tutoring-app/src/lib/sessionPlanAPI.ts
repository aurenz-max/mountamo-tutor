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
// 'pulse' = the daily measurement beat: one ~4-min first block absorbing due
// mastery checks + IRT-confirmed targets (may span subjects).
export type BlockType  = 'lesson' | 'practice' | 'retest' | 'pulse';
export type SkillStatus = 'new' | 'review' | 'retest' | 'mastered';

export interface BlockSubskill {
  subskill_id:   string;
  // Parent skill id resolved from the curriculum hierarchy. Optional because
  // plans generated before this field existed won't carry it.
  skill_id?:     string;
  /** Own subject — pulse blocks may span subjects; fall back to block.subject. */
  subject?:      string;
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

/** Observed start/complete timestamps for one block (the time ledger). */
export interface BlockTimeEntry {
  /** Append-only ISO timestamps — a relaunch adds another entry. */
  starts?:       string[];
  completed_at?: string | null;
}

/** Per-subject pace state + the minute share it earned today. */
export interface SubjectPace {
  subject:             string;
  total_subskills:     number;
  remaining_subskills: number;
  weight:              number;
  allocated_minutes:   number;
  selector_count:      number;
}

/** How today's minute budget was split across subjects (pace-aware). */
export interface PlanAllocation {
  policy:                   string;   // "pace_proportional"
  weeks_remaining:          number;
  /** Assumed, not measured — see backend ASSUMED_MIN_PER_SUBSKILL. */
  assumed_min_per_subskill: number;
  required_minutes_per_day: number;
  subjects:                 SubjectPace[];
}

export interface DailySessionPlan {
  student_id:               string;
  date:                     string;   // YYYY-MM-DD
  day_of_week:              string;
  /** Grade of record ('K'|'1'..'12') — launch surfaces derive the generation
   *  grade from THIS, never from the home screen's UI band. Absent on plans
   *  persisted before the field existed. */
  grade_level?:             string | null;
  budget_minutes:           number;
  review_budget_minutes:    number;
  intro_budget_minutes:     number;
  estimated_total_minutes:  number;
  blocks:                   LessonBlock[];
  /** Block ids finished today — persisted server-side on the day's plan doc. */
  completed_block_ids?:     string[];
  /** Observed block timestamps keyed by block_id. */
  block_times?:             Record<string, BlockTimeEntry>;
  /** Pace-aware allocation that shaped this plan (absent on legacy plans). */
  allocation?:              PlanAllocation | null;
  total_subskills:          number;
  new_subskills:            number;
  review_subskills:         number;
  warnings:                 string[];
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Student-facing subject name: "SOCIAL_STUDIES" / "science" → "Social Studies"
 * / "Science". Plan blocks carry whatever spelling the backend graph or
 * lifecycle doc used — raw keys must never reach the student (or a Gemini
 * topic string).
 */
export function prettySubject(s: string): string {
  if (!s) return '';
  if (s.trim().toUpperCase() === 'ELA') return 'ELA';
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
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
 * Stamp a block-start timestamp on the day's time ledger. Append-only
 * server-side: relaunching an abandoned block records another start.
 * Fire-and-forget — the ledger is telemetry, never block the launch on it.
 */
export async function markSessionBlockStarted(
  studentId: string | number,
  blockId: string,
  planDate?: string,
): Promise<{ success: boolean }> {
  const query = planDate ? `?plan_date=${encodeURIComponent(planDate)}` : '';
  return authApi.post<{ success: boolean }>(
    `/api/daily-activities/daily-plan/${studentId}/session/blocks/${encodeURIComponent(blockId)}/start${query}`,
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
