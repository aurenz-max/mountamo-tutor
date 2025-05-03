# EdTech Competency API Documentation

This documentation covers the API endpoints for the competency measurement and assessment system, built on FastAPI. These endpoints represent the currently implemented functionality as defined in the router file.

## Table of Contents

- [Core Competency Endpoints](#core-competency-endpoints)
- [Curriculum and Content Endpoints](#curriculum-and-content-endpoints)
- [Analytics Endpoints](#analytics-endpoints)
- [Models and Data Structures](#models-and-data-structures)
- [Error Handling](#error-handling)

## Core Competency Endpoints

### Update Competency

```
POST /update
```

Updates a student's competency based on their performance in a learning session.

**Request Body:**
```json
{
  "student_id": 123,
  "subject": "Mathematics",
  "skill": "Algebra",
  "subskill": "Factoring",
  "session_evaluation": {
    "evaluation": 8.5,
    "feedback": "Good understanding of core concepts",
    "analysis": "Applied factoring techniques correctly"
  }
}
```

**Response:**
```json
{
  "student_id": 123,
  "subject": "Mathematics",
  "skill_id": "algebra",
  "subskill_id": "factoring",
  "current_score": 8.2,
  "credibility": 0.73,
  "total_attempts": 13
}
```

### Get Student Overview

```
GET /student/{student_id}
```

Returns a comprehensive overview of all competencies for a specific student across all subjects.

**Response:**
```json
{
  "student_id": 123,
  "subjects": {
    "Mathematics": {
      "current_score": 7.8,
      "credibility": 0.85,
      "total_attempts": 45,
      "skills": {
        "algebra": {
          "current_score": 8.2,
          "credibility": 0.92,
          "total_attempts": 28,
          "subskills": {
            "factoring": {
              "current_score": 8.5,
              "credibility": 0.73,
              "total_attempts": 13
            }
          }
        }
      }
    }
  }
}
```

### Get Competency (Subskill Level)

```
GET /student/{student_id}/subject/{subject}/skill/{skill_id}/subskill/{subskill_id}
```

Returns the competency level for a student at the subskill level.

**Response:**
```json
{
  "student_id": 123,
  "subject": "Mathematics",
  "skill_id": "algebra",
  "subskill_id": "factoring",
  "current_score": 8.5,
  "credibility": 0.73,
  "total_attempts": 13
}
```

### Get Skill Competency

```
GET /student/{student_id}/subject/{subject}/skill/{skill_id}
```

Returns the competency level for a student at the skill level.

**Response:**
```json
{
  "student_id": 123,
  "subject": "Mathematics",
  "skill_id": "algebra",
  "current_score": 8.2,
  "credibility": 0.92,
  "total_attempts": 28
}
```

## Curriculum and Content Endpoints

### Get Available Subjects

```
GET /subjects
```

Lists all available subjects with loaded curriculum.

**Response:**
```json
["Mathematics", "Science", "History", "Language Arts"]
```

### Get Subject Curriculum

```
GET /curriculum/{subject}
```

Returns the complete curriculum structure for a subject.

**Response:**
```json
{
  "subject": "Mathematics",
  "curriculum": [
    {
      "id": "unit1",
      "title": "Numbers and Operations",
      "skills": [
        {
          "id": "skill1",
          "description": "Basic Arithmetic",
          "subskills": [
            {
              "id": "subskill1",
              "description": "Addition",
              "difficulty_range": {
                "start": 1,
                "end": 5,
                "target": 3
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Get Detailed Objectives

```
GET /objectives/{subject}/{subskill_id}
```

Returns detailed learning objectives for a specific subskill.

**Response:**
```json
{
  "subject": "Mathematics",
  "subskill_id": "factoring",
  "objectives": {
    "ConceptGroup": "Polynomial Factoring",
    "DetailedObjective": "Factor quadratic expressions into binomial products",
    "SubskillDescription": "Factoring Polynomials"
  }
}
```

### Get Problem Types

```
GET /problem-types/{subject}
```

Returns all available problem types (subskills) for a subject.

**Response:**
```json
{
  "subject": "Mathematics",
  "problem_types": ["addition", "subtraction", "multiplication", "division", "fractions", "decimals"]
}
```

## Analytics Endpoints

### Get Student Problem Reviews

```
GET /student/{student_id}/problem-reviews
```

Returns detailed problem reviews with structured feedback for a student.

**Query Parameters:**
- `subject` (optional): Filter by subject
- `skill_id` (optional): Filter by skill
- `subskill_id` (optional): Filter by subskill
- `limit` (optional, default=100): Limit the number of reviews

**Response:**
```json
{
  "student_id": 123,
  "total_reviews": 45,
  "grouped_reviews": {
    "Mathematics": {
      "algebra": [
        {
          "id": "review1",
          "student_id": 123,
          "subject": "Mathematics",
          "skill_id": "algebra",
          "subskill_id": "factoring",
          "problem_id": "prob123",
          "timestamp": "2025-04-15T14:30:45",
          "score": 8.5,
          "problem_content": {
            "question": "Factor x² + 5x + 6",
            "student_answer": "(x + 2)(x + 3)",
            "correct_answer": "(x + 2)(x + 3)"
          },
          "feedback_components": {
            "observation": {
              "approach": "Student used factor pairs method",
              "work_shown": "Identified factor pairs of 6"
            },
            "analysis": {
              "understanding": "Shows clear understanding of factoring",
              "approach": "Methodical approach to finding factors",
              "accuracy": "Completely accurate solution"
            },
            "evaluation": {
              "score": 10,
              "justification": "Perfect factorization with complete work shown"
            },
            "feedback": {
              "praise": "Excellent factoring technique",
              "guidance": "",
              "encouragement": "Keep up the great work",
              "next_steps": "Ready for more complex factoring problems"
            }
          }
        }
      ]
    }
  },
  "reviews": [
    // Flat list of all reviews
  ]
}
```

## Models and Data Structures

### CompetencyUpdate Model
```python
class CompetencyUpdate(BaseModel):
    student_id: int
    subject: str
    skill: str
    subskill: str
    session_evaluation: Dict[str, Any]
```

### CompetencyQuery Model
```python
class CompetencyQuery(BaseModel):
    student_id: int
    subject: str
    skill: str
    subskill: str
```

### Competency Calculation
Competency scores are calculated using a blended approach:
- Actual average score from attempts
- Credibility factor based on number of attempts
- Default score weighting for new or low-credibility skills

Formula: `blended_score = (average_score * credibility) + (default_score * (1 - credibility))`

Credibility thresholds:
- Subskill: 15 attempts for full credibility
- Subject: 150 attempts for full credibility

## Error Handling

All endpoints are wrapped with try-except blocks to provide appropriate error responses:

```json
{
  "detail": "Error message describing the issue"
}
```

Possible HTTP status codes:
- 200: Successful operation
- 404: Resource not found (subject, skill, etc.)
- 500: Internal server error (with error details)

## Implementation Notes

- The API uses dependency injection for services like `CompetencyService` and `ProblemRecommender`
- Syllabus data is loaded from CSV files with a specific structure
- The system supports structured feedback with components for observation, analysis, evaluation, and feedback
