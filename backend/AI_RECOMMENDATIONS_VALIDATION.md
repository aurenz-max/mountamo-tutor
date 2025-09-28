# AI Recommendations Validation Guide

This guide helps you validate and debug the AI recommendations functionality that was causing fallback to BigQuery recommendations.

## Problem Description

The system was falling back to BigQuery recommendations instead of using AI-powered recommendations. This happens when:

1. **AI Recommendation Service fails** - No student data, Gemini API issues, or service configuration problems
2. **Assessment feedback retrieval fails** - Cosmos DB issues or malformed assessment data
3. **LLM response parsing fails** - Invalid JSON or schema mismatches

## Enhanced Logging

The code now includes comprehensive logging with emoji prefixes for easy identification:

- `🎯 AI_RECOMMENDATIONS` - AI recommendation service flow
- `🤖 LLM_GENERATION` - Gemini API calls and response processing
- `📊 ASSESSMENT_FEEDBACK` - Assessment feedback context building
- `🤖 DAILY_ACTIVITIES` - Daily activities service flow
- `📄 ASSESSMENT_FEEDBACK` - Assessment feedback retrieval
- `🚀 RECOMMENDATION_FLOW` - Overall recommendation flow and fallbacks

## Quick Validation

### 1. Run the Validation Script

```bash
cd backend
python validate_ai_recommendations.py --student-id 123

# For debug logging:
python validate_ai_recommendations.py --student-id 123 --debug
```

### 2. Check Service Logs

Look for these log patterns to identify issues:

**Success Pattern:**
```
🎯 AI_RECOMMENDATIONS: SUCCESS - Generated playlist with 6 activities
🤖 DAILY_ACTIVITIES: SUCCESS - Using AI recommendations
🚀 RECOMMENDATION_FLOW: Final personalization source: ai_recommendations
```

**Fallback Pattern:**
```
🎯 AI_RECOMMENDATIONS: CRITICAL - No student data found for {student_id}
🤖 DAILY_ACTIVITIES: CRITICAL - No playlist activities returned from AI service
🚀 RECOMMENDATION_FLOW: FALLBACK - AI recommendations failed, trying BigQuery
⚠️ ATTENTION: Plan used BigQuery fallback instead of AI recommendations
```

### 3. Run the Test Suite

```bash
cd backend
python -m pytest tests/test_ai_recommendations_integration.py -v
python -m pytest tests/test_assessment_feedback_integration.py -v
```

## Common Issues and Solutions

### Issue 1: No Student Data in BigQuery
**Symptoms:**
```
🎯 AI_RECOMMENDATIONS: CRITICAL - No student data found for {student_id} in BigQuery
```

**Solutions:**
- Verify student exists in `student_velocity_metrics` table
- Check BigQuery connection and permissions
- Ensure analytics data is populated

### Issue 2: Gemini API Failures
**Symptoms:**
```
🤖 LLM_GENERATION: CRITICAL - Empty response from Gemini API
🤖 LLM_GENERATION: EXCEPTION - Error generating structured playlist
```

**Solutions:**
- Check `GEMINI_API_KEY` environment variable
- Verify API quota and rate limits
- Check prompt length and schema validity

### Issue 3: Assessment Feedback Issues
**Symptoms:**
```
📄 ASSESSMENT_FEEDBACK: No recent assessment data found
📊 ASSESSMENT_FEEDBACK: No actionable insights found despite having feedback map
```

**Solutions:**
- Verify assessment documents exist in Cosmos DB
- Check assessment document structure matches expected format
- Ensure assessment completion flow stores `ai_insights` properly

### Issue 4: Cosmos DB Connection Issues
**Symptoms:**
```
📄 ASSESSMENT_FEEDBACK: EXCEPTION - Error retrieving feedback
🤖 DAILY_ACTIVITIES: No Cosmos DB service configured
```

**Solutions:**
- Check Cosmos DB connection string and credentials
- Verify container names and permissions
- Ensure Cosmos DB service is properly injected

## Testing Individual Components

### Test AI Recommendation Service Directly

```python
from app.services.ai_recommendations import AIRecommendationService

ai_service = AIRecommendationService(
    project_id="your-project-id",
    dataset_id="analytics"
)

# Test health
health = await ai_service.health_check()
print(health)

# Test student summary
summary = await ai_service._get_student_summary(123)
print(summary)

# Test playlist generation
playlist = await ai_service.generate_daily_playlist(
    student_id=123,
    target_activities=6
)
print(playlist)
```

### Test Assessment Feedback Retrieval

```python
from app.services.daily_activities import DailyActivitiesService
from app.db.cosmos_db import CosmosDBService

cosmos_service = CosmosDBService()
daily_service = DailyActivitiesService(cosmos_db_service=cosmos_service)

feedback = await daily_service._get_recent_assessment_feedback_by_subject(123)
print(feedback)
```

### Test Complete Flow

```python
from app.services.ai_recommendations import AIRecommendationService
from app.services.daily_activities import DailyActivitiesService
from app.db.cosmos_db import CosmosDBService

ai_service = AIRecommendationService(project_id="your-project-id")
cosmos_service = CosmosDBService()
daily_service = DailyActivitiesService(
    ai_recommendation_service=ai_service,
    cosmos_db_service=cosmos_service
)

plan = await daily_service.get_or_generate_daily_plan(
    student_id=123,
    force_refresh=True
)

print(f"Source: {plan.personalization_source}")
print(f"Activities: {len(plan.activities)}")
```

## Expected Behavior

### Successful AI Recommendations Flow

1. **Student Data Retrieved** - From BigQuery `student_velocity_metrics`
2. **Assessment Feedback Retrieved** - From Cosmos DB recent assessments
3. **Session Structure Created** - Based on velocity and pedagogical rules
4. **LLM Context Built** - Including assessment feedback for synthesis
5. **Gemini API Called** - With structured prompt and schema
6. **Playlist Generated** - 6 activities with proper categorization
7. **Activities Enriched** - With curriculum metadata from BigQuery
8. **Plan Created** - With `personalization_source: 'ai_recommendations'`

### Assessment Feedback Integration

The system should:
1. Query recent assessments (30 days) from Cosmos DB
2. Extract `skill_insights` from `ai_insights` in assessment results
3. Categorize skills by `assessment_focus_tag` and `performance_label`
4. Build hierarchical context for LLM prompt
5. Generate activities that prioritize weak spots and developing skills
6. Mark activities as `assessment_informed: true`

## Monitoring in Production

Set up alerts for:
- High percentage of BigQuery fallbacks (should be < 10%)
- Gemini API errors or timeouts
- Missing student data in BigQuery
- Assessment feedback retrieval failures

Use log aggregation to track:
- Daily counts of each personalization source
- Average response times for AI playlist generation
- Assessment feedback usage rates by student