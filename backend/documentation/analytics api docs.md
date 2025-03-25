# Student Learning Analytics API Documentation

## Overview

The Student Learning Analytics API provides comprehensive metrics and insights into student performance across the curriculum hierarchy. The API calculates four primary metrics:

1. **Mastery** - The average score achieved across attempted curriculum items
2. **Proficiency** - The average score achieved across curriculum items that a student is ready for
3. **Avg_Score** - The true average score calculated across all individual attempts
4. **Completion** - The percentage of curriculum items that have been attempted

The API also provides recommendations for what a student should work on next based on their current performance and readiness status.

## Base URL

```
https://api.example.com/v1/analytics
```

## Authentication

All API endpoints require authentication. Include an authorization token in the request header:

```
Authorization: Bearer YOUR_API_TOKEN
```

## API Endpoints

### 1. Hierarchical Metrics

Get comprehensive hierarchical metrics for a student, optionally filtered by subject and date range.

**Endpoint:** `GET /student/{student_id}/metrics`

**Parameters:**

| Parameter   | Type     | Required | Description                          |
|-------------|----------|----------|--------------------------------------|
| student_id  | integer  | Yes      | ID of the student                    |
| subject     | string   | No       | Filter by subject                    |
| start_date  | datetime | No       | Start date for metrics calculation   |
| end_date    | datetime | No       | End date for metrics calculation     |

**Response:**

```json
{
  "student_id": 1234,
  "subject": "Mathematics",
  "date_range": {
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-03-01T00:00:00Z"
  },
  "summary": {
    "mastery": 0.75,
    "proficiency": 0.82,
    "avg_score": 0.76,
    "completion": 25.5,
    "attempted_items": 51,
    "total_items": 200,
    "attempt_count": 125,
    "ready_items": 42,
    "recommended_items": 10
  },
  "hierarchical_data": [
    {
      "unit_id": "unit-1",
      "unit_title": "Numbers and Operations",
      "mastery": 0.82,
      "proficiency": 0.85,
      "avg_score": 0.78,
      "completion": 45.2,
      "attempted_skills": 12,
      "total_skills": 25,
      "attempt_count": 85,
      "skills": [
        {
          "skill_id": "skill-1-1",
          "skill_description": "Addition and Subtraction",
          "mastery": 0.91,
          "proficiency": 0.91,
          "avg_score": 0.88,
          "completion": 75.0,
          "attempted_subskills": 9,
          "total_subskills": 12,
          "attempt_count": 45,
          "subskills": [
            {
              "subskill_id": "subskill-1-1-1",
              "subskill_description": "Single-digit Addition",
              "mastery": 0.95,
              "avg_score": 0.92,
              "proficiency": 0.95,
              "completion": 100.0,
              "is_attempted": true,
              "readiness_status": "Ready",
              "priority_level": "Mastered",
              "priority_order": 4,
              "next_subskill": "subskill-1-1-2",
              "recommended_next": null,
              "attempt_count": 15,
              "individual_attempts": [
                {
                  "timestamp": "2025-01-15T10:30:00Z",
                  "score": "0.90000000000000000000"
                },
                {
                  "timestamp": "2025-01-16T11:45:00Z",
                  "score": "0.95000000000000000000"
                }
                // Additional attempts...
              ]
            },
            // More subskills...
          ]
        },
        // More skills...
      ]
    },
    // More units...
  ]
}
```

### 2. Metrics Time Series

Get metrics over time for a student at any level of the curriculum hierarchy, grouped by a specified interval.

**Endpoint:** `GET /student/{student_id}/metrics/timeseries`

**Parameters:**

| Parameter        | Type     | Required | Description                                                |
|------------------|----------|----------|------------------------------------------------------------|
| student_id       | integer  | Yes      | ID of the student                                          |
| subject          | string   | No       | Filter by subject                                          |
| interval         | string   | No       | Time interval for grouping (day, week, month, quarter, year). Default: month |
| level            | string   | No       | Hierarchy level (subject, unit, skill, subskill). Default: subject |
| start_date       | datetime | No       | Start date for metrics calculation                         |
| end_date         | datetime | No       | End date for metrics calculation                           |
| unit_id          | string   | No       | Filter by unit (required for skill and subskill levels)    |
| skill_id         | string   | No       | Filter by skill (required for subskill level)              |
| include_hierarchy| boolean  | No       | Whether to include hierarchical data for each interval (default: false) |

**Response:**

```json
{
  "student_id": 1234,
  "subject": "Mathematics",
  "date_range": {
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-03-01T00:00:00Z"
  },
  "interval": "month",
  "level": "subject",
  "intervals": [
    {
      "interval_date": "2025-01-01T00:00:00Z",
      "summary": {
        "mastery": 0.72,
        "proficiency": 0.80,
        "avg_score": 0.70,
        "completion": 15.5,
        "attempted_items": 31,
        "total_items": 200,
        "attempt_count": 75,
        "ready_items": 42,
        "recommended_items": 10
      },
      "hierarchical_data": [] // Present only if include_hierarchy=true
    },
    {
      "interval_date": "2025-02-01T00:00:00Z",
      "summary": {
        "mastery": 0.75,
        "proficiency": 0.82,
        "avg_score": 0.74,
        "completion": 20.5,
        "attempted_items": 41,
        "total_items": 200,
        "attempt_count": 95,
        "ready_items": 42,
        "recommended_items": 10
      },
      "hierarchical_data": [] // Present only if include_hierarchy=true
    }
  ]
}
```

When `include_hierarchy=true`, the `hierarchical_data` field in each interval will contain filtered hierarchical data based on the specified level:

- For `level=subject`: All units, skills, and subskills (same format as hierarchical metrics endpoint)
- For `level=unit` with `unit_id`: Only the specified unit's data
- For `level=skill` with `unit_id` and `skill_id`: Only the specified skill's data within the unit
- For `level=subskill` with `unit_id` and `skill_id`: All subskills for the specified skill

### 3. Recommendations

Get recommended next steps for a student based on priority and readiness.

**Endpoint:** `GET /student/{student_id}/recommendations`

**Parameters:**

| Parameter   | Type     | Required | Description                          |
|-------------|----------|----------|--------------------------------------|
| student_id  | integer  | Yes      | ID of the student                    |
| subject     | string   | No       | Filter by subject                    |
| limit       | integer  | No       | Maximum number of recommendations (default: 5, max: 20) |

**Response:**

```json
[
  {
    "type": "performance_gap",
    "priority": "high",
    "unit_id": "unit-2",
    "unit_title": "Fractions and Decimals",
    "skill_id": "skill-2-3",
    "skill_description": "Mixed Numbers",
    "subskill_id": "subskill-2-3-1",
    "subskill_description": "Converting Mixed Numbers to Improper Fractions",
    "proficiency": 0.45,
    "mastery": 0.45,
    "avg_score": 0.48,
    "priority_level": "High Priority",
    "priority_order": 1,
    "readiness_status": "Ready",
    "is_ready": true,
    "completion": 100.0,
    "attempt_count": 3,
    "is_attempted": true,
    "next_subskill": "subskill-2-3-2",
    "message": "Focus on improving your performance on Converting Mixed Numbers to Improper Fractions"
  },
  // More recommendations...
]
```

## Key Concepts

### Metrics Calculation

- **Mastery**: Calculated as the average proficiency value for all attempted curriculum items, regardless of readiness status. This metric focuses on depth of understanding for content the student has engaged with.

- **Proficiency**: Calculated as the average score achieved across items where the student meets the readiness criteria. This metric helps identify whether a student is succeeding at their current appropriate learning level.

- **Avg_Score**: Calculated as the true average of all individual attempt scores, providing a direct measure of raw performance across all attempts. Unlike mastery and proficiency, this metric considers every single attempt rather than averaging at the subskill level first.

- **Completion**: Calculated as the percentage of curriculum items that have been attempted at least once.

### Readiness Status

Readiness status indicates whether a student is prepared to attempt a specific subskill:

- **Ready** - The student is ready for both the skill and subskill
- **Ready for Subskill** - The student is ready for the subskill but not the entire skill
- **Ready for Skill** - The student is ready for the skill but not this specific subskill
- **Not Ready** - The student is not ready for either the skill or subskill

A student is considered ready for a subskill if:
1. It's the first subskill in a learning path (no prerequisites), or
2. They have achieved at least 60% proficiency in the prerequisite subskill

### Priority Levels

Priority levels help determine which items a student should focus on:

- **Mastered** - The student has achieved 80% or higher proficiency
- **High Priority** - The student has achieved between 40-79% proficiency
- **Medium Priority** - The student has achieved below 40% proficiency but has attempted the item
- **Not Started** - The student has not attempted the item
- **Not Assessed** - The item cannot be assessed

### Recommendation Types

- **performance_gap** - Items where the student is ready but has low proficiency
- **coverage_gap** - Items where the student is ready but has not attempted
- **future_item** - Items the student is not yet ready for

## Time Series Analysis

The time series endpoint allows tracking of metrics over time at different levels of the curriculum hierarchy:

1. **Subject Level** - Track overall progress in a subject over time
2. **Unit Level** - Compare progress across different units in a subject
3. **Skill Level** - Monitor development of specific skills
4. **Subskill Level** - Track mastery of individual subskills

This supports various analytics use cases:

- **Progress Tracking** - Monitor how mastery and completion improve over time
- **Comparison Analysis** - Compare performance across different curriculum areas
- **Intervention Planning** - Identify periods of slow progress for targeted support
- **Goal Setting** - Set and track progress toward specific mastery or completion targets

## Example Usages

### Fetching Mastery by Subject

```
GET /student/1234/metrics?subject=Mathematics
```

### Tracking Progress Over Time at the Subject Level

```
GET /student/1234/metrics/timeseries?interval=month&start_date=2025-01-01&end_date=2025-03-01
```

### Tracking Progress Over Time at the Unit Level with Hierarchical Data

```
GET /student/1234/metrics/timeseries?level=unit&unit_id=unit-1&interval=month&include_hierarchy=true
```

### Tracking Specific Skill Development

```
GET /student/1234/metrics/timeseries?level=skill&unit_id=unit-1&skill_id=skill-1-2
```

### Getting Top Recommendations

```
GET /student/1234/recommendations?limit=10
```

## Troubleshooting

### Common Issues

#### No Data Returned

If no data is returned for a timeseries query:

1. **Check Subject Spelling and Case**: Ensure the subject name exactly matches what's in the database (e.g., "Mathematics" vs "Math")
2. **Verify Date Range**: Confirm that the date range contains student attempts
3. **Check Student ID**: Verify that the student ID exists and has attempt data
4. **Curriculum Existence**: Ensure that curriculum items exist for the specified subject

#### Incorrect Metrics Calculation

If metrics appear incorrect:

1. **Check Raw Attempt Scores**: Review individual attempts to verify the raw data is correct
2. **Readiness Status**: Verify that readiness is properly determined based on prerequisites
3. **Priority Calculation**: Ensure priority levels are assigned correctly based on proficiency

## Error Responses

The API uses standard HTTP status codes to indicate success or failure:

- `200 OK` - Request succeeded
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication failure
- `404 Not Found` - Requested resource not found
- `500 Internal Server Error` - Server-side error

Error responses include a detail message:

```json
{
  "detail": "Error retrieving metrics: Database connection error"
}
```
