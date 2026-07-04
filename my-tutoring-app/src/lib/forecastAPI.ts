// src/lib/forecastAPI.ts
/**
 * API client for the skill-level forecast (ForecastService).
 *
 * Endpoint: GET /api/weekly-planner/{studentId}/forecast
 * Returns: StudentForecast — per-subject unit ETAs with optimistic/best/
 * pessimistic bands, per-subskill arrival weeks (selector- vs topology-
 * ordered), retention triage, and drift vs the prior materialized forecast.
 *
 * The forecast is a PROJECTION materialized once per day server-side — the
 * daily session plan remains the plan of record.
 */

import { authApi } from './authApiClient';

// ---------------------------------------------------------------------------
// Types (mirror backend/app/models/forecast.py)
// ---------------------------------------------------------------------------

export interface RateBand {
  optimistic:  number;
  best:        number;
  pessimistic: number;
}

export interface EtaBand {
  optimistic:  string;   // ISO date
  best:        string;
  pessimistic: string;
}

export interface SubskillEta {
  subskill_id: string;
  description: string;
  skill_id:    string;
  unit_title:  string;
  eta_week:    string;                    // ISO date of projected week start
  order_basis: 'selector' | 'topology';   // live IRT order vs prerequisite order
  reason:      string;                    // selector's reason when basis=selector
}

export interface UnitForecast {
  unit_title:    string;
  subskills:     number;
  eta_start:     string;
  eta_end:       EtaBand;
  order_basis:   'selector' | 'topology';
  past_year_end: boolean;
}

export interface ReviewLoad {
  due_per_week:     number;
  subsumed:         number;   // exercised by active dependents — free
  riders:           number;   // folded into nearby lessons at marginal cost
  dedicated_blocks: number;   // orphan leaves — real block cost
  graph_coverage:   number;
}

export interface SubjectForecast {
  subject:                   string;
  total_subskills:           number;
  remaining_subskills:       number;
  allocated_minutes_per_day: number;
  weekly_rate:               RateBand;
  review_load:               ReviewLoad;
  projected_finish:          EtaBand;
  units:                     UnitForecast[];
  subskill_etas:             SubskillEta[];
}

export interface UnitDrift {
  subject:      string;
  unit_title:   string;
  previous_eta: string;
  current_eta:  string;
  delta_days:   number;   // positive = slipped later
}

export interface ForecastDrift {
  compared_to: string;
  units:       UnitDrift[];
}

export interface StudentForecast {
  student_id:               string;
  date:                     string;
  generated_at:             string;
  /** Grade the graphs were scoped to; null = resolved by the ambiguous scan. */
  grade_level?:             string | null;
  policy:                   string;
  year_start:               string;
  year_end:                 string;
  weeks_remaining:          number;
  budget_minutes:           number;
  /** Assumed, not measured — null once the time ledger supplies observed costs. */
  assumed_min_per_subskill: number | null;
  required_minutes_per_day: number;
  subjects:                 SubjectForecast[];
  drift?:                   ForecastDrift | null;
  warnings:                 string[];
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchStudentForecast(
  studentId: string | number,
  options?: { refresh?: boolean },
): Promise<StudentForecast> {
  const query = options?.refresh ? '?refresh=true' : '';
  return authApi.get<StudentForecast>(
    `/api/weekly-planner/${studentId}/forecast${query}`,
  );
}
