# Assessment Analytics API Documentation

This document provides comprehensive documentation for the 6 new assessment analytics endpoints that power student assessment insights and performance tracking.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints Reference](#endpoints-reference)
4. [Response Models](#response-models)
5. [Usage Examples](#usage-examples)
6. [Frontend Integration Patterns](#frontend-integration-patterns)
7. [Error Handling](#error-handling)

---

## Overview

The Assessment Analytics API provides deep insights into student assessment performance, including:

- **Overview metrics** - Summary stats, trends, and recent assessments
- **Performance analysis** - High/low performance areas by skills, types, and categories
- **Assessment history** - Filterable list of all past assessments
- **Detailed drill-down** - Complete breakdown of individual assessments
- **Next steps** - AI-powered recommendations based on assessment results
- **Trends over time** - Weekly/monthly performance tracking

**Base URL**: `/analytics/student/{student_id}/assessments`

**Key Features**:
- ✅ Caching (10-20 min TTL based on data volatility)
- ✅ User context validation
- ✅ Subject filtering
- ✅ Date range filtering
- ✅ Pagination support

---

## Authentication

All endpoints require authentication via Firebase Auth. Include the Firebase ID token in the `Authorization` header:

```typescript
const headers = {
  'Authorization': `Bearer ${firebaseIdToken}`,
  'Content-Type': 'application/json'
};
```

**Access Control**: Students can only access their own assessment data unless `ALLOW_ANY_STUDENT_ANALYTICS` is enabled.

---

## Endpoints Reference

### 1. Assessment Overview

Get summary statistics, trend analysis, and recent assessments.

**Endpoint**: `GET /analytics/student/{student_id}/assessments/overview`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `subject` | string | No | Filter by subject (e.g., "Mathematics") |
| `start_date` | datetime | No | Filter assessments after this date (ISO 8601) |
| `end_date` | datetime | No | Filter assessments before this date (ISO 8601) |

**Response**: `AssessmentOverviewResponse`

```typescript
interface AssessmentOverviewResponse {
  student_id: number;
  subject?: string;
  date_range: {
    start_date?: string;
    end_date?: string;
  };
  total_assessments_by_subject: { [subject: string]: number };
  avg_score_by_subject: { [subject: string]: number };
  total_time_minutes_by_subject: { [subject: string]: number };
  trend_status_by_subject: { [subject: string]: 'Improving' | 'Declining' | 'Stable' };
  recent_assessments: RecentAssessmentItem[];
  cached: boolean;
  generated_at: string;
}

interface RecentAssessmentItem {
  assessment_id: string;
  subject: string;
  score_percentage: number;
  correct_count: number;
  total_questions: number;
  completed_at: string;
  time_taken_minutes?: number;
}
```

**Use Case**: Dashboard header showing overall assessment stats and recent activity.

---

### 2. Assessment Performance

Analyze high and low performance areas across skills, problem types, and categories.

**Endpoint**: `GET /analytics/student/{student_id}/assessments/performance`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `subject` | string | No | Filter by subject |
| `start_date` | datetime | No | Filter assessments after this date |
| `end_date` | datetime | No | Filter assessments before this date |

**Response**: `AssessmentPerformanceResponse`

```typescript
interface AssessmentPerformanceResponse {
  student_id: number;
  subject?: string;
  date_range: {
    start_date?: string;
    end_date?: string;
  };
  high_performance_areas: PerformanceZone[];  // ≥80%
  low_performance_areas: PerformanceZone[];   // <60%
  all_performance_zones: PerformanceZone[];
  cached: boolean;
  generated_at: string;
}

interface PerformanceZone {
  metric_type: 'skill' | 'problem_type' | 'category';
  subject: string;
  identifier: string;  // skill_id, problem type, or category name
  name: string;
  context: string;  // Human-readable description
  percentage: number;
  consistency_score?: number;  // Standard deviation (for skills)
  sample_size: number;
  performance_zone: 'Mastered' | 'Proficient' | 'Developing' | 'Needs Review';
  category?: string;
}
```

**Use Case**: Strengths & weaknesses visualization, skill-level insights.

---

### 3. Assessment History

Get a filterable, paginated list of all assessments.

**Endpoint**: `GET /analytics/student/{student_id}/assessments/history`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `subject` | string | No | Filter by subject |
| `start_date` | datetime | No | Filter assessments after this date |
| `end_date` | datetime | No | Filter assessments before this date |
| `limit` | integer | No | Max results (default: 20, max: 100) |

**Response**: `AssessmentHistoryItem[]`

```typescript
interface AssessmentHistoryItem {
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
  performance_vs_average: 'above_average' | 'average' | 'below_average';
}
```

**Use Case**: Assessment history table with sorting, filtering, and pagination.

---

### 4. Assessment Details

Get complete drill-down data for a single assessment.

**Endpoint**: `GET /analytics/student/{student_id}/assessments/{assessment_id}`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `assessment_id` | string | Yes | Assessment ID (path parameter) |

**Response**: `AssessmentDetailsResponse`

```typescript
interface AssessmentDetailsResponse {
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

interface SkillInsightDetail {
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

interface ProblemReviewDetail {
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
```

**Use Case**: Detailed assessment review page with skill breakdown and problem-by-problem analysis.

---

### 5. Assessment Next Steps

Get AI-powered recommendations for what to study next based on assessment results.

**Endpoint**: `GET /analytics/student/{student_id}/assessments/next-steps`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `subject` | string | No | Filter by subject |
| `limit` | integer | No | Max recommendations (default: 10, max: 50) |

**Response**: `AssessmentNextStepsResponse`

```typescript
interface AssessmentNextStepsResponse {
  student_id: number;
  subject?: string;
  limit: number;
  recommendations: NextStepRecommendation[];
  cached: boolean;
  generated_at: string;
}

interface NextStepRecommendation {
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
```

**Use Case**: "What to study next" recommendations panel prioritized by need.

---

### 6. Assessment Trends

Get performance trends over time (weekly or monthly).

**Endpoint**: `GET /analytics/student/{student_id}/assessments/trends`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | integer | Yes | Student ID (path parameter) |
| `granularity` | string | No | "weekly" or "monthly" (default: "weekly") |
| `subject` | string | No | Filter by subject |
| `lookback_weeks` | integer | No | Weeks to look back (1-52, default: 12 for weekly) |
| `lookback_months` | integer | No | Months to look back (1-24, default: 6 for monthly) |

**Response**: `AssessmentTrendsResponse`

```typescript
interface AssessmentTrendsResponse {
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

interface AssessmentSubjectTrend {
  subject: string;
  periods: AssessmentTrendPeriod[];
}

interface AssessmentTrendPeriod {
  period_key: string;        // e.g., "2025-W03" or "2025-01"
  period_label: string;       // e.g., "Week 3, 2025" or "January 2025"
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
```

**Use Case**: Time-series charts showing progress over weeks/months.

---

## Usage Examples

### Example 1: Fetch Overview for Dashboard

```typescript
async function fetchAssessmentOverview(studentId: number, subject?: string) {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);

  const response = await fetch(
    `/analytics/student/${studentId}/assessments/overview?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  if (!response.ok) throw new Error('Failed to fetch overview');

  const data: AssessmentOverviewResponse = await response.json();
  return data;
}

// Usage
const overview = await fetchAssessmentOverview(1004, 'Mathematics');
console.log(`Average score: ${overview.avg_score_by_subject['Mathematics']}%`);
console.log(`Trend: ${overview.trend_status_by_subject['Mathematics']}`);
```

### Example 2: Display Performance Zones

```typescript
async function getPerformanceAreas(studentId: number) {
  const response = await fetch(
    `/analytics/student/${studentId}/assessments/performance`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  const data: AssessmentPerformanceResponse = await response.json();

  // Separate by type for UI
  const skillAreas = data.all_performance_zones.filter(z => z.metric_type === 'skill');
  const problemTypes = data.all_performance_zones.filter(z => z.metric_type === 'problem_type');

  return {
    strengths: data.high_performance_areas,
    weaknesses: data.low_performance_areas,
    skills: skillAreas,
    problemTypes: problemTypes
  };
}
```

### Example 3: Assessment History Table

```typescript
async function fetchAssessmentHistory(
  studentId: number,
  filters: {
    subject?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  const params = new URLSearchParams();
  if (filters.subject) params.append('subject', filters.subject);
  if (filters.startDate) params.append('start_date', filters.startDate.toISOString());
  if (filters.endDate) params.append('end_date', filters.endDate.toISOString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(
    `/analytics/student/${studentId}/assessments/history?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  const assessments: AssessmentHistoryItem[] = await response.json();
  return assessments;
}

// Usage in React component
const assessments = await fetchAssessmentHistory(1004, {
  subject: 'Mathematics',
  limit: 50
});
```

### Example 4: Assessment Details Modal

```typescript
async function fetchAssessmentDetails(studentId: number, assessmentId: string) {
  const response = await fetch(
    `/analytics/student/${studentId}/assessments/${assessmentId}`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  if (response.status === 404) {
    throw new Error('Assessment not found');
  }

  const details: AssessmentDetailsResponse = await response.json();
  return details;
}

// Usage
const details = await fetchAssessmentDetails(1004, 'assess_20250115_abc123');

// Display skill insights
details.skill_insights.forEach(insight => {
  console.log(`${insight.skill_name}: ${insight.percentage}% (${insight.performance_label})`);
  console.log(`Recommendation: ${insight.insight_text}`);
});
```

### Example 5: Next Steps Panel

```typescript
async function getNextSteps(studentId: number, subject?: string) {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  params.append('limit', '5');

  const response = await fetch(
    `/analytics/student/${studentId}/assessments/next-steps?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  const data: AssessmentNextStepsResponse = await response.json();

  // Sort by priority (already sorted by API, but for clarity)
  const highPriority = data.recommendations.filter(r => r.priority_level === 'high');

  return {
    topRecommendations: highPriority,
    allRecommendations: data.recommendations
  };
}
```

### Example 6: Trends Chart

```typescript
async function fetchTrendsForChart(
  studentId: number,
  granularity: 'weekly' | 'monthly',
  subject?: string
) {
  const params = new URLSearchParams();
  params.append('granularity', granularity);
  if (subject) params.append('subject', subject);

  const response = await fetch(
    `/analytics/student/${studentId}/assessments/trends?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${firebaseIdToken}`
      }
    }
  );

  const data: AssessmentTrendsResponse = await response.json();

  // Transform for chart library (e.g., Chart.js, Recharts)
  const chartData = data.trends.flatMap(subjectTrend =>
    subjectTrend.periods.map(period => ({
      date: period.period_label,
      subject: subjectTrend.subject,
      avgScore: period.avg_score,
      assessmentCount: period.assessment_count,
      skillsMastered: period.total_skills_mastered
    }))
  );

  return chartData;
}

// Usage with Recharts
const trendsData = await fetchTrendsForChart(1004, 'weekly', 'Mathematics');

<LineChart data={trendsData}>
  <XAxis dataKey="date" />
  <YAxis />
  <Line dataKey="avgScore" stroke="#8884d8" />
  <Line dataKey="skillsMastered" stroke="#82ca9d" />
</LineChart>
```

---

## Frontend Integration Patterns

### React Hook Pattern

```typescript
// hooks/useAssessmentAnalytics.ts
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth'; // Your auth hook

export function useAssessmentOverview(studentId: number, subject?: string) {
  const [data, setData] = useState<AssessmentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getIdToken } = useAuth();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const token = await getIdToken();
        const params = new URLSearchParams();
        if (subject) params.append('subject', subject);

        const response = await fetch(
          `/analytics/student/${studentId}/assessments/overview?${params}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [studentId, subject]);

  return { data, loading, error };
}

// Usage in component
function AssessmentDashboard() {
  const { studentId } = useStudentContext();
  const { data, loading, error } = useAssessmentOverview(studentId, 'Mathematics');

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h2>Assessment Overview</h2>
      <p>Total Assessments: {data.total_assessments_by_subject['Mathematics']}</p>
      <p>Average Score: {data.avg_score_by_subject['Mathematics']}%</p>
      <p>Trend: {data.trend_status_by_subject['Mathematics']}</p>
    </div>
  );
}
```

### API Client Class

```typescript
// lib/assessmentAnalyticsAPI.ts
export class AssessmentAnalyticsAPI {
  constructor(
    private baseUrl: string,
    private getToken: () => Promise<string>
  ) {}

  private async fetch<T>(path: string, params?: Record<string, any>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(path, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getOverview(
    studentId: number,
    options?: { subject?: string; startDate?: Date; endDate?: Date }
  ): Promise<AssessmentOverviewResponse> {
    return this.fetch(`/analytics/student/${studentId}/assessments/overview`, {
      subject: options?.subject,
      start_date: options?.startDate?.toISOString(),
      end_date: options?.endDate?.toISOString()
    });
  }

  async getPerformance(
    studentId: number,
    options?: { subject?: string; startDate?: Date; endDate?: Date }
  ): Promise<AssessmentPerformanceResponse> {
    return this.fetch(`/analytics/student/${studentId}/assessments/performance`, {
      subject: options?.subject,
      start_date: options?.startDate?.toISOString(),
      end_date: options?.endDate?.toISOString()
    });
  }

  async getHistory(
    studentId: number,
    options?: { subject?: string; startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<AssessmentHistoryItem[]> {
    return this.fetch(`/analytics/student/${studentId}/assessments/history`, {
      subject: options?.subject,
      start_date: options?.startDate?.toISOString(),
      end_date: options?.endDate?.toISOString(),
      limit: options?.limit
    });
  }

  async getDetails(
    studentId: number,
    assessmentId: string
  ): Promise<AssessmentDetailsResponse> {
    return this.fetch(`/analytics/student/${studentId}/assessments/${assessmentId}`);
  }

  async getNextSteps(
    studentId: number,
    options?: { subject?: string; limit?: number }
  ): Promise<AssessmentNextStepsResponse> {
    return this.fetch(`/analytics/student/${studentId}/assessments/next-steps`, {
      subject: options?.subject,
      limit: options?.limit
    });
  }

  async getTrends(
    studentId: number,
    options?: {
      granularity?: 'weekly' | 'monthly';
      subject?: string;
      lookbackWeeks?: number;
      lookbackMonths?: number;
    }
  ): Promise<AssessmentTrendsResponse> {
    return this.fetch(`/analytics/student/${studentId}/assessments/trends`, {
      granularity: options?.granularity || 'weekly',
      subject: options?.subject,
      lookback_weeks: options?.lookbackWeeks,
      lookback_months: options?.lookbackMonths
    });
  }
}

// Usage
const api = new AssessmentAnalyticsAPI(
  'https://your-backend.com',
  () => auth.currentUser.getIdToken()
);

const overview = await api.getOverview(1004, { subject: 'Mathematics' });
```

---

## Error Handling

### Common HTTP Status Codes

| Status Code | Meaning | Common Cause |
|-------------|---------|--------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid parameters (e.g., invalid granularity) |
| 403 | Forbidden | Student trying to access another student's data |
| 404 | Not Found | Assessment ID doesn't exist (details endpoint only) |
| 500 | Internal Server Error | Database or server error |

### Error Response Format

```typescript
interface ErrorResponse {
  detail: string;
}

// Example error handling
try {
  const data = await api.getDetails(1004, 'invalid_id');
} catch (error) {
  if (error.response?.status === 404) {
    console.error('Assessment not found');
  } else if (error.response?.status === 403) {
    console.error('Access denied');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Recommended Error Handling Pattern

```typescript
async function safelyFetchAssessmentData<T>(
  fetchFn: () => Promise<T>,
  fallback: T
): Promise<{ data: T; error: Error | null }> {
  try {
    const data = await fetchFn();
    return { data, error: null };
  } catch (error) {
    console.error('Assessment API error:', error);
    return { data: fallback, error: error as Error };
  }
}

// Usage
const { data, error } = await safelyFetchAssessmentData(
  () => api.getOverview(1004),
  {
    student_id: 1004,
    total_assessments_by_subject: {},
    avg_score_by_subject: {},
    total_time_minutes_by_subject: {},
    trend_status_by_subject: {},
    recent_assessments: [],
    date_range: {},
    cached: false,
    generated_at: new Date().toISOString()
  }
);

if (error) {
  // Show error UI
  return <ErrorBanner message="Failed to load assessment data" />;
}

// Render with data
```

---

## Performance & Caching Tips

1. **Use the cached flag**: Check `response.cached` to show "live" vs "cached" indicators
2. **Minimize re-fetches**: The API caches responses for 10-20 minutes - avoid unnecessary refetches
3. **Filter on the backend**: Use query parameters instead of filtering client-side
4. **Paginate history**: Use the `limit` parameter (max 100) to avoid loading all assessments
5. **Subject filtering**: Always filter by subject when displaying subject-specific views
6. **Date ranges**: Use date filters for large datasets to reduce response size

---

## Testing with Student 1004

Based on your ETL sync, student 1004 has assessment data available. Test endpoints with:

```bash
# Overview
GET /analytics/student/1004/assessments/overview

# Performance (Mathematics only)
GET /analytics/student/1004/assessments/performance?subject=Mathematics

# History (last 20)
GET /analytics/student/1004/assessments/history?limit=20

# Details (use actual assessment_id from history response)
GET /analytics/student/1004/assessments/{assessment_id}

# Next Steps
GET /analytics/student/1004/assessments/next-steps?limit=10

# Trends (weekly, last 12 weeks)
GET /analytics/student/1004/assessments/trends?granularity=weekly
```

---

## Questions or Issues?

If you encounter any issues or need additional endpoints:
1. Check the backend logs for detailed error messages
2. Verify your Firebase token is valid
3. Ensure student_id 1004 has assessment data synced via ETL
4. Test queries directly in BigQuery first using the validated SQL

Happy coding! 🚀
