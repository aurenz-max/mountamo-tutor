// ---------------------------------------------------------------------------
// Types (mirror backend response schemas)
// ---------------------------------------------------------------------------

export interface SubjectWeeklyStats {
  total_skills: number;
  closed: number;
  in_review: number;
  not_started: number;
  learning?: number;
  expected_by_now: number;
  behind_by: number;
  weekly_new_target: number;
  review_reserve: number;
}

export interface WeeklyPlan {
  student_id: string;
  week_of: string;
  school_year: {
    start: string;
    end: string;
    fractionElapsed: number;
    weeksRemaining: number;
  };
  daily_session_capacity: number;
  sustainable_new_per_day: number;
  subjects: Record<string, SubjectWeeklyStats>;
  warnings: string[];
}

export interface SessionItem {
  skill_id: string;
  subject: string;
  skill_name: string;
  type: 'review' | 'new';
  reason: string;
  priority: number;
  // interleaving category (PRD §8)
  session_category?: 'interleaved' | 'tail';
  // review fields
  completion_factor?: number;
  mastery_gate?: number;
  days_overdue?: number;
  // new skill fields
  prerequisites_met?: boolean;
  // enrichment fields (resolved from curriculum)
  unit_title?: string;
  skill_description?: string;
  subskill_description?: string;
}

export interface SubjectWeekProgress {
  new_target: number;
  new_completed: number;
  reviews_completed: number;
}

export interface DailyPlan {
  student_id: string;
  date: string;
  day_of_week: string;
  capacity: number;
  review_slots: number;
  new_slots: number;
  week_progress: Record<string, SubjectWeekProgress>;
  sessions: SessionItem[];
  warnings: string[];
}

// Monthly plan types (PRD Section 4.5)
export interface ConfidenceBand {
  optimistic: number;
  bestEstimate: number;
  pessimistic: number;
}

export interface WeekProjectionData {
  week: number;
  weekOf: string;
  projectedReviewsDue: number;
  projectedNewIntroductions: number;
  projectedClosures: number;
  projectedOpenInventory: number;
  cumulativeMastered: ConfidenceBand;
}

export interface SubjectCurrentState {
  total: number;
  closed: number;
  inReview: number;
  notStarted: number;
}

export interface EndOfYearProjection {
  closed: number;
  remainingGap: number;
}

export interface EndOfYearScenarios {
  optimistic: EndOfYearProjection;
  bestEstimate: EndOfYearProjection;
  pessimistic: EndOfYearProjection;
}

export interface MonthlyWarning {
  type: string;
  week: number;
  message: string;
}

export interface SubjectMonthlyProjection {
  currentState: SubjectCurrentState;
  weekByWeek: WeekProjectionData[];
  endOfYearProjection: EndOfYearScenarios;
  warnings: MonthlyWarning[];
}

export interface MonthlyPlan {
  studentId: string;
  generatedAt: string;
  schoolYear: {
    fractionElapsed: number;
    weeksRemaining: number;
  };
  projections: Record<string, SubjectMonthlyProjection>;
}

// Velocity types (PRD Section 15)
export interface VelocityDecomposition {
  introductionVelocity: number;
  passThroughVelocity: number;
  closureVelocity: number;
}

export interface PrimaryDriver {
  component: string; // "introduction" | "pass_through" | "closure" | "all_healthy"
  value: number | null;
  explanation: string;
}

export interface SubjectVelocity {
  totalSkills: number;
  closed: number;
  inReviewEarned: number;
  earnedMastery: number;
  adjustedExpectedMastery: number;
  velocity: number;
  trend: number[];
  decomposition: VelocityDecomposition;
  primaryDriver: PrimaryDriver;
}

export interface VelocityData {
  studentId: string;
  asOfDate: string;
  schoolYear: {
    fractionElapsed: number;
    weeksCompleted: number;
    weeksRemaining: number;
  };
  aggregate: {
    earnedMastery: number;
    adjustedExpectedMastery: number;
    velocity: number;
    trend: number[];
  };
  subjects: Record<string, SubjectVelocity>;
}

// Mastery lifecycle types (PRD Section 6.2)
export interface SubskillMasteryEntry {
  subskill_id: string;
  skill_id: string;
  current_gate: number;
  completion_pct: number;
  passes: number;
  fails: number;
}

export interface SubjectMasterySummary {
  total: number;
  fully_mastered: number;
  average_completion_pct: number;
  by_gate: Record<string, number>;
  subskills: SubskillMasteryEntry[];
}

export interface MasterySummary {
  student_id: number;
  total_subskills: number;
  by_gate: Record<string, number>;
  average_completion_pct: number;
  fully_mastered: number;
  global_practice_pass_rate: number;
  by_subject: Record<string, SubjectMasterySummary>;
  queried_at: string;
}

export interface SubskillForecast {
  subskill_id: string;
  skill_id: string;
  subject: string;
  current_gate?: number;
  completion_pct?: number;
  estimated_remaining_attempts?: number;
  estimated_days: number;
  status: 'mastered' | 'in_progress';
}

export interface UnitForecast {
  subject: string;
  max_eta_days: number;
  subskill_count: number;
  mastered_count: number;
}

export interface MasteryForecast {
  student_id: number;
  subskill_forecasts: SubskillForecast[];
  by_unit: Record<string, UnitForecast>;
  by_subject: Record<string, { estimated_days: number }>;
  queried_at: string;
}
