// src/lib/studentAnalyticsAPI.ts - FIXED VERSION WITH AUTHENTICATION
import { authApi } from './authApiClient';

// Keep all your existing types (they're correct)
export interface StudentMetrics {
  student_id: number;
  subject?: string;
  date_range?: {
    start_date: string;
    end_date: string;
  };
  summary: {
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    ready_items: number;
    recommended_items: number;
    total_items: number;
    attempted_items: number;
    attempt_count: number;
    raw_attempt_count?: number;
  };
  hierarchical_data: Array<UnitData>;
}

export interface UnitData {
  unit_id: string;
  unit_title: string;
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempted_skills: number;
  total_skills: number;
  attempt_count: number;
  attempted?: number;
  total?: number;
  skills: Array<SkillData>;
}

export interface SkillData {
  skill_id: string;
  skill_description: string;
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempted_subskills: number;
  total_subskills: number;
  attempt_count: number;
  attempted?: number;
  total?: number;
  subskills: Array<SubskillData>;
}

export interface SubskillData {
  subskill_id: string;
  subskill_description: string;
  mastery: number;
  avg_score: number;
  proficiency: number;
  completion: number;
  is_attempted: boolean;
  readiness_status: string;
  priority_level: string;
  priority_order: number;
  next_subskill: string | null;
  recommended_next: string | null;
  attempt_count: number;
  individual_attempts?: Array<{
    timestamp: string;
    score: string;
  }>;
  // Mastery lifecycle fields
  current_gate?: number;
  completion_pct?: number;
  passes?: number;
  fails?: number;
  lesson_eval_count?: number;
  next_retest_eligible?: string | null;
  estimated_remaining_attempts?: number;
}

export interface TimeSeriesMetrics {
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempts: number;
  attempt_count: number;
  unique_subskills: number;
  attempted_items: number;
  total_items: number;
  ready_items: number;
  total_curriculum_items?: number;
  total_ready_items?: number;
}

export interface TimeSeriesInterval {
  interval_date: string;
  summary: {
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    attempted_items: number;
    total_items: number;
    attempt_count: number;
    ready_items: number;
    recommended_items: number;
  };
  hierarchical_data?: any[];
}

export interface TimeSeriesData {
  student_id: number;
  subject?: string;
  date_range?: {
    start_date: string | null;
    end_date: string | null;
  };
  level: string;
  interval: string;
  intervals?: TimeSeriesInterval[];
  data?: Array<{
    interval_date: string;
    metrics: TimeSeriesMetrics;
    subject?: string;
    unit_id?: string;
    unit_title?: string;
    skill_id?: string;
    skill_description?: string;
    subskill_id?: string;
    subskill_description?: string;
  }>;
}

export interface Recommendation {
  type: string;
  priority: string;
  unit_id: string;
  unit_title: string;
  skill_id: string;
  skill_description: string;
  subskill_id: string;
  subskill_description: string;
  proficiency: number;
  mastery: number;
  avg_score: number;
  priority_level: string;
  priority_order: number;
  readiness_status: string;
  is_ready: boolean;
  completion: number;
  attempt_count: number;
  is_attempted: boolean;
  next_subskill: string | null;
  message: string;
}

export interface VelocityMetric {
  subject: string;
  actual_progress: number;
  expected_progress: number;
  total_subskills: number;
  velocity_percentage: number;
  days_ahead_behind: number;
  velocity_status: string;
  last_updated: string;
}

export interface VelocityMetricsResponse {
  student_id: number;
  student_name: string;
  subject?: string;
  metrics: VelocityMetric[];
  last_updated: string;
  generated_at: string;
  cached?: boolean;
}

// Score Trends types
export interface TrendPeriod {
  period_key: string;
  period_label: string;
  start_date: string;
  end_date: string;
  avg_score: number;
  avg_score_pct: number;
  total_reviews: number;
  score_sum: number;
}

export interface SubjectTrend {
  subject: string;
  periods: TrendPeriod[];
}

export interface ScoreTrendsResponse {
  student_id: number;
  granularity: string;
  date_range: { start_date: string; end_date: string };
  trends: SubjectTrend[];
  cached?: boolean;
  generated_at?: string;
}

// Engagement Metrics types
export interface DailyBreakdown {
  date: string;
  attempts: number;
  avg_score: number;
  subjects: string[];
}

export interface EngagementSummary {
  total_active_days: number;
  avg_daily_attempts: number;
  streak_current: number;
  streak_longest: number;
  total_attempts: number;
}

export interface EngagementMetricsResponse {
  student_id: number;
  subject_filter: string | null;
  days_analyzed: number;
  summary: EngagementSummary;
  daily_breakdown: DailyBreakdown[];
  generated_at?: string;
}

// Knowledge Graph types (Pulse-native)
export interface KnowledgeGraphNode {
  subskill_id: string;
  skill_id: string;
  description: string;
  depth: number;
  status: 'mastered' | 'inferred' | 'in_review' | 'in_progress' | 'frontier' | 'not_started' | 'locked';
  current_gate: number;
  theta?: number;
  earned_level?: number;
  inferred_from?: string;
  prerequisite_ids: string[];
  dependent_ids: string[];
}

export interface KnowledgeGraphProgressResponse {
  student_id: number;
  subject: string;
  generated_at: string;
  total_nodes: number;
  mastered_direct: number;
  mastered_inferred: number;
  in_progress: number;
  in_review: number;
  not_started: number;
  locked: number;
  frontier_node_ids: string[];
  frontier_depth: number;
  max_depth: number;
  total_leapfrogs: number;
  total_skills_inferred: number;
  leapfrog_retest_pass_rate: number | null;
  nodes?: KnowledgeGraphNode[];
  cached?: boolean;
}

// Pulse Session History types
export interface PulseSessionBandBreakdown {
  frontier_items: number;
  current_items: number;
  review_items: number;
  frontier_success_rate: number | null;
  current_success_rate: number | null;
  review_success_rate: number | null;
}

export interface PulseSessionLeapfrogSummary {
  lesson_group_id: string;
  probed_skills: string[];
  inferred_skills: string[];
  aggregate_score: number;
}

export interface PulseSessionHistoryItem {
  session_id: string;
  subject: string;
  status: string;
  is_cold_start: boolean;
  items_completed: number;
  items_total: number;
  band_breakdown: PulseSessionBandBreakdown;
  leapfrogs: PulseSessionLeapfrogSummary[];
  skills_inferred: number;
  avg_score: number | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface PulseSessionThetaPoint {
  session_id: string;
  skill_id: string;
  theta_before: number;
  theta_after: number;
  delta: number;
  timestamp: string;
}

export interface PulseSessionHistoryResponse {
  student_id: number;
  subject: string | null;
  generated_at: string;
  total_sessions: number;
  completed_sessions: number;
  total_items_completed: number;
  total_leapfrogs: number;
  total_skills_inferred: number;
  overall_frontier_success_rate: number | null;
  avg_session_score: number | null;
  sessions: PulseSessionHistoryItem[];
  theta_trajectory: PulseSessionThetaPoint[];
  cached?: boolean;
}

// UPDATED API OBJECT - Now uses authApiClient for authentication
export const analyticsApi = {
  // Get hierarchical metrics for a student
  async getStudentMetrics(
    studentId: number,
    options: {
      subject?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<StudentMetrics> {
    const { subject, startDate, endDate } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/metrics${queryString ? `?${queryString}` : ''}`;
    
    // Use authApiClient instead of raw fetch
    return authApi.get<StudentMetrics>(endpoint);
  },

  // Get metrics time series for a student
  async getTimeSeriesMetrics(
    studentId: number,
    options: {
      subject?: string;
      interval?: string;
      level?: string;
      startDate?: string;
      endDate?: string;
      unitId?: string;
      skillId?: string;
      includeHierarchy?: boolean;
    } = {}
  ): Promise<TimeSeriesData> {
    const { subject, interval, level, startDate, endDate, unitId, skillId, includeHierarchy } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (interval) params.append('interval', interval);
    if (level) params.append('level', level);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (unitId) params.append('unit_id', unitId);
    if (skillId) params.append('skill_id', skillId);
    if (includeHierarchy !== undefined) params.append('include_hierarchy', includeHierarchy.toString());
    
    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/metrics/timeseries${queryString ? `?${queryString}` : ''}`;
    
    // Use authApiClient with authentication
    const data = await authApi.get<TimeSeriesData>(endpoint);
    
    // Transform new format to old format for backward compatibility
    if (data.intervals && !data.data && Array.isArray(data.intervals)) {
      data.data = data.intervals.map(interval => ({
        interval_date: interval.interval_date,
        metrics: {
          mastery: interval.summary.mastery,
          proficiency: interval.summary.proficiency,
          avg_score: interval.summary.avg_score,
          completion: interval.summary.completion,
          attempts: interval.summary.attempt_count,
          attempt_count: interval.summary.attempt_count,
          unique_subskills: interval.summary.attempted_items,
          attempted_items: interval.summary.attempted_items,
          total_items: interval.summary.total_items,
          ready_items: interval.summary.ready_items,
          total_curriculum_items: interval.summary.total_items,
          total_ready_items: interval.summary.ready_items
        }
      }));
    }
    
    return data;
  },

  // Get recommendations for a student
  async getRecommendations(
    studentId: number,
    options: {
      subject?: string;
      limit?: number;
    } = {}
  ): Promise<Array<Recommendation>> {
    const { subject, limit } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/recommendations${queryString ? `?${queryString}` : ''}`;
    
    // Use authApiClient with authentication
    return authApi.get<Array<Recommendation>>(endpoint);
  },

  // Get velocity metrics for a student
  async getVelocityMetrics(
    studentId: number,
    options: {
      subject?: string;
    } = {}
  ): Promise<VelocityMetricsResponse> {
    const { subject } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    
    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/velocity-metrics${queryString ? `?${queryString}` : ''}`;
    
    // Use authApiClient with authentication
    return authApi.get<VelocityMetricsResponse>(endpoint);
  },

  // Get score trends over time
  async getScoreTrends(
    studentId: number,
    options: {
      granularity: 'weekly' | 'monthly';
      lookbackWeeks?: number;
      lookbackMonths?: number;
      subjects?: string;
    }
  ): Promise<ScoreTrendsResponse> {
    const { granularity, lookbackWeeks, lookbackMonths, subjects } = options;

    const params = new URLSearchParams();
    params.append('granularity', granularity);
    if (lookbackWeeks) params.append('lookback_weeks', lookbackWeeks.toString());
    if (lookbackMonths) params.append('lookback_months', lookbackMonths.toString());
    if (subjects) params.append('subjects', subjects);

    const endpoint = `/api/analytics/student/${studentId}/score-trends?${params.toString()}`;
    return authApi.get<ScoreTrendsResponse>(endpoint);
  },

  // Get knowledge graph progress for a student
  async getKnowledgeGraphProgress(
    studentId: number,
    options: {
      subject: string;
      includeNodes?: boolean;
    }
  ): Promise<KnowledgeGraphProgressResponse> {
    const { subject, includeNodes } = options;

    const params = new URLSearchParams();
    params.append('subject', subject);
    if (includeNodes !== undefined) params.append('include_nodes', includeNodes.toString());

    const endpoint = `/api/analytics/student/${studentId}/knowledge-graph?${params.toString()}`;
    return authApi.get<KnowledgeGraphProgressResponse>(endpoint);
  },

  // Get pulse session history for a student
  async getPulseSessionHistory(
    studentId: number,
    options: {
      subject?: string;
      limit?: number;
      includeTheta?: boolean;
    } = {}
  ): Promise<PulseSessionHistoryResponse> {
    const { subject, limit, includeTheta } = options;

    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (limit) params.append('limit', limit.toString());
    if (includeTheta !== undefined) params.append('include_theta', includeTheta.toString());

    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/pulse-sessions${queryString ? `?${queryString}` : ''}`;
    return authApi.get<PulseSessionHistoryResponse>(endpoint);
  },

  // Get engagement metrics (streaks, active days, daily breakdown)
  async getEngagementMetrics(
    studentId: number,
    options: {
      subject?: string;
      days?: number;
    } = {}
  ): Promise<EngagementMetricsResponse> {
    const { subject, days } = options;

    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (days) params.append('days', days.toString());

    const queryString = params.toString();
    const endpoint = `/api/analytics/student/${studentId}/engagement-metrics${queryString ? `?${queryString}` : ''}`;
    return authApi.get<EngagementMetricsResponse>(endpoint);
  }
};

// For backward compatibility, also export individual functions
export const getStudentMetrics = analyticsApi.getStudentMetrics;
export const getTimeSeriesMetrics = analyticsApi.getTimeSeriesMetrics;
export const getRecommendations = analyticsApi.getRecommendations;
export const getVelocityMetrics = analyticsApi.getVelocityMetrics;
export const getScoreTrends = analyticsApi.getScoreTrends;
export const getEngagementMetrics = analyticsApi.getEngagementMetrics;
export const getKnowledgeGraphProgress = analyticsApi.getKnowledgeGraphProgress;
export const getPulseSessionHistory = analyticsApi.getPulseSessionHistory;