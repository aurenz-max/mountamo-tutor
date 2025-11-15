/**
 * TypeScript types for BigQuery Analytics API responses
 * Matches backend Pydantic models from backend/app/api/endpoints/analytics.py
 */

// Score Distribution Types
export interface ScoreHistogram {
  [score: string]: number; // score (0-10) -> count
}

export interface DateRange {
  start_date?: string;
  end_date?: string;
}

export interface ScoreDistributionItem {
  level: "subject" | "unit" | "skill";
  id: string;
  name: string;
  score_histogram: ScoreHistogram;
  total_reviews: number;
  avg_score?: number;
  avg_score_pct?: number;
  parent_unit_id?: string; // For skills, references parent unit
}

export interface ScoreDistributionResponse {
  student_id: number;
  subject: string;
  date_range: DateRange;
  distributions: ScoreDistributionItem[];
}

// Score Trends Types
export interface TrendPeriod {
  period_key: string; // e.g., "2025-W44" or "2025-10"
  period_label: string; // e.g., "Week 44, 2025" or "October 2025"
  start_date: string;
  end_date: string;
  avg_score: number;
  avg_score_pct: number;
  total_reviews: number;
}

export interface SubjectTrend {
  subject: string;
  periods: TrendPeriod[];
}

export interface TrendDateRange {
  lookback: number;
  granularity: "weekly" | "monthly";
}

export interface ScoreTrendsResponse {
  student_id: number;
  granularity: "weekly" | "monthly";
  date_range: TrendDateRange;
  trends: SubjectTrend[];
}

// API Request Parameter Types
export interface ScoreDistributionParams {
  subject: string;
  start_date?: string;
  end_date?: string;
}

export interface ScoreTrendsParams {
  granularity: "weekly" | "monthly";
  lookback_weeks?: number; // Default 52, max 104
  lookback_months?: number; // Default 12, max 24
  subjects?: string; // Comma-separated list
}
