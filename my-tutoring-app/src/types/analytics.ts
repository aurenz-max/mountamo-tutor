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

// Assessment Analytics Types

// Simplified Recent Assessment Types (new simplified endpoint)
export interface SimpleRecentAssessmentItem {
  assessment_id: string;
  subject: string;
  completed_at: string | null;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  time_taken_minutes: number | null;
  weak_spots_count: number;
  foundational_review_count: number;
  new_frontiers_count: number;
  skills_mastered: number;  // Count of mastered skills (not array)
  skills_struggling: number;  // Count of struggling skills (not array)
  total_skills_assessed: number;
}

// Assessment Overview Types
export interface RecentAssessmentItem {
  assessment_id: string;
  subject: string;
  score_percentage: number;
  correct_count: number;
  total_questions: number;
  completed_at: string;
  time_taken_minutes?: number;
}

export interface AssessmentOverviewResponse {
  student_id: number;
  subject?: string;
  date_range: DateRange;
  total_assessments_by_subject: { [subject: string]: number };
  avg_score_by_subject: { [subject: string]: number };
  total_time_minutes_by_subject: { [subject: string]: number };
  trend_status_by_subject: { [subject: string]: 'Improving' | 'Declining' | 'Stable' };
  recent_assessments: RecentAssessmentItem[];
  cached: boolean;
  generated_at: string;
}

// Assessment Performance Types
export interface PerformanceZone {
  metric_type: 'skill' | 'problem_type' | 'category';
  subject: string;
  identifier: string;
  name: string;
  context: string;
  percentage: number;
  consistency_score?: number;
  sample_size: number;
  performance_zone: 'Mastered' | 'Proficient' | 'Developing' | 'Needs Review';
  category?: string;
}

export interface AssessmentPerformanceResponse {
  student_id: number;
  subject?: string;
  date_range: DateRange;
  high_performance_areas: PerformanceZone[];
  low_performance_areas: PerformanceZone[];
  all_performance_zones: PerformanceZone[];
  cached: boolean;
  generated_at: string;
}

// Assessment History Types
export interface AssessmentHistoryItem {
  assessment_id: string;
  subject: string;
  status: string;
  created_at: string;
  completed_at?: string;
  time_taken_minutes?: number;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  weak_spots_count: number;
  foundational_review_count: number;
  new_frontiers_count: number;
  skills_mastered: number;
  skills_struggling: number;
  total_skills_assessed: number;
  average_score_per_skill: number;
  ai_summary?: string;
  performance_quote?: string;
  performance_by_type: Array<{
    problem_type: string;
    total: string | number;
    correct: string | number;
    percentage: string | number;
  }>;
  performance_by_category: Array<{
    category: string;
    total: string | number;
    correct: string | number;
    percentage: string | number;
    unique_skills: string | number;
  }>;
  common_misconceptions: string[];
  performance_vs_average: 'above_average' | 'average' | 'below_average';
}

export interface AssessmentHistoryResponse {
  student_id: number;
  subject?: string;
  date_range: DateRange;
  limit: number;
  assessments: AssessmentHistoryItem[];
  cached: boolean;
  generated_at: string;
}

// Assessment Details Types
export interface SkillInsightDetail {
  skill_id: string;
  skill_name: string;
  unit_title: string;
  category: string;
  total_questions: number;
  correct_count: number;
  percentage: number;
  assessment_focus_tag: string;
  performance_label: string;
  insight_text: string;
  next_step: {
    action: string;
    subskill_id?: string;
  };
  subskills: Array<{
    subskill_id: string;
    subskill_name: string;
    is_correct: boolean;
  }>;
}

export interface ProblemReviewDetail {
  problem_id: string;
  skill_name: string;
  subskill_name: string;
  problem_type: string;
  difficulty?: string;
  is_correct: boolean;
  score: number;
  student_answer_text: string;
  correct_answer_text: string;
  misconception?: string;
}

export interface AssessmentDetailsResponse {
  assessment_id: string;
  student_id: number;
  subject: string;
  created_at: string;
  completed_at?: string;
  time_taken_minutes?: number;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  performance_by_type: Array<{
    type: string;
    count: number;
    correct: number;
    percentage: number;
  }>;
  performance_by_category: Array<{
    category: string;
    count: number;
    correct: number;
    percentage: number;
  }>;
  average_score_per_skill: number;
  skills_mastered: number;
  skills_struggling: number;
  total_skills_assessed: number;
  ai_summary?: string;
  performance_quote?: string;
  common_misconceptions: string[];
  skill_insights: SkillInsightDetail[];
  problem_reviews: ProblemReviewDetail[];
  cached: boolean;
  generated_at: string;
}

// Assessment Next Steps Types
export interface NextStepRecommendation {
  skill_id: string;
  skill_name: string;
  unit_title: string;
  category: string;
  latest_performance_label: string;
  avg_percentage: number;
  assessment_count: number;
  last_assessed: string;
  recommendation_text: string;
  practice_link: string;
  action_type: string;
  subskills: Array<{
    subskill_id: string;
    subskill_name: string;
    needs_work: boolean;
  }>;
  recent_misconceptions?: string[];
  misconception_count?: number;
  priority_level: 'high' | 'medium' | 'low';
  priority_order: number;
}

export interface AssessmentNextStepsResponse {
  student_id: number;
  subject?: string;
  limit: number;
  recommendations: NextStepRecommendation[];
  cached: boolean;
  generated_at: string;
}

// Assessment Trends Types
export interface AssessmentTrendPeriod {
  period_key: string;
  period_label: string;
  start_date: string;
  end_date: string;
  assessment_count: number;
  avg_score: number;
  total_skills_mastered: number;
  total_correct: number;
  total_questions: number;
  moving_avg_score?: number;
  score_change_from_previous?: number;
}

export interface AssessmentSubjectTrend {
  subject: string;
  periods: AssessmentTrendPeriod[];
}

export interface AssessmentTrendsResponse {
  student_id: number;
  subject?: string;
  granularity: 'weekly' | 'monthly';
  date_range: {
    lookback: number;
    unit: 'weeks' | 'months';
  };
  trends: AssessmentSubjectTrend[];
  cached: boolean;
  generated_at: string;
}

// Assessment API Request Parameter Types
export interface AssessmentOverviewParams {
  subject?: string;
  start_date?: string;
  end_date?: string;
}

export interface AssessmentPerformanceParams {
  subject?: string;
  start_date?: string;
  end_date?: string;
}

export interface AssessmentHistoryParams {
  subject?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface AssessmentTrendsParams {
  granularity: 'weekly' | 'monthly';
  subject?: string;
  lookback_weeks?: number;
  lookback_months?: number;
}

export interface AssessmentNextStepsParams {
  subject?: string;
  limit?: number;
}
