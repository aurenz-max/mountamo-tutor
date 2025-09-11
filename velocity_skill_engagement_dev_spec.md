# Velocity-Driven Skill Engagement Feature - Development Specification

## Overview
This document provides complete technical specifications for implementing enhanced student engagement with velocity metrics by offering multiple skill recommendations for underperforming subjects.

## Problem Statement
Students currently see velocity status like "Arts - Significantly Behind" with only one generic learning activity. This creates a missed opportunity for engagement and doesn't leverage our existing AI recommendation capabilities.

## Solution
When students have poor velocity in a subject, provide **3-5 AI-generated skill recommendations** they can choose from, giving them agency while maintaining pedagogical structure.

## Technical Architecture

### Backend Implementation

#### 1. New API Endpoint
**File:** `backend/app/api/endpoints/analytics.py`

Add new endpoint:
```python
@router.get("/student/{student_id}/subject-recommendations")
async def get_subject_recommendations(
    student_id: int,
    subject: str,
    count: Optional[int] = 5,
    user_context: dict = Depends(get_user_context),
    ai_service: AIRecommendationService = Depends(get_ai_service)
):
    """Get AI-powered skill recommendations for a specific subject"""
    
    # Validate student access
    if user_context["role"] == "student" and user_context["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        recommendations = await ai_service.get_subject_skill_recommendations(
            student_id=student_id,
            subject=subject,
            count=count
        )
        return {
            "student_id": student_id,
            "subject": subject,
            "recommendations": recommendations,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting subject recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")
```

#### 2. Enhanced AI Recommendations Service
**File:** `backend/app/services/ai_recommendations.py`

Add new method to existing `AIRecommendationService` class:

```python
async def get_subject_skill_recommendations(
    self,
    student_id: int,
    subject: str,
    count: int = 5
) -> List[Dict[str, Any]]:
    """
    Get targeted skill recommendations for a specific subject.
    Leverages existing student summary data but focuses on single subject.
    """
    
    logger.info(f"Generating {count} skill recommendations for student {student_id}, subject {subject}")
    
    try:
        # Get focused student data for this subject
        subject_data = await self._get_subject_focused_summary(student_id, subject)
        
        if not subject_data:
            logger.warning(f"No data found for student {student_id}, subject {subject}")
            return []
        
        # Generate recommendations using existing LLM infrastructure
        recommendations = await self._generate_subject_recommendations(
            subject_data, count
        )
        
        # Enrich with curriculum data
        enriched_recommendations = await self._enrich_skill_recommendations(recommendations)
        
        logger.info(f"Generated {len(enriched_recommendations)} recommendations for {subject}")
        return enriched_recommendations
        
    except Exception as e:
        logger.error(f"Error generating subject recommendations: {e}")
        raise

async def _get_subject_focused_summary(self, student_id: int, subject: str) -> Dict[str, Any]:
    """Get optimized subject-specific summary"""
    
    query = f"""
    WITH subject_velocity AS (
      SELECT 
        subject,
        velocity_status,
        velocity_percentage,
        days_ahead_behind,
        actual_progress,
        expected_progress,
        total_subskills_in_subject
      FROM `{self.project_id}.{self.dataset_id}.student_velocity_metrics`
      WHERE student_id = @student_id AND subject = @subject
    ),
    available_skills AS (
      SELECT 
        subskill_id,
        subskill_description,
        skill_description,
        subskill_mastery_pct,
        unlock_score,
        difficulty_start,
        readiness_status,
        grade,
        unit_title
      FROM `{self.project_id}.{self.dataset_id}.student_available_subskills`
      WHERE student_id = @student_id 
        AND subject = @subject 
        AND is_available = TRUE
      ORDER BY 
        CASE readiness_status 
          WHEN 'Ready' THEN 1
          WHEN 'Nearly Ready' THEN 2 
          ELSE 3
        END,
        unlock_score DESC
      LIMIT 10  -- Get top 10 available skills
    ),
    mastery_context AS (
      SELECT 
        subject,
        AVG(skill_mastery_pct) as avg_mastery,
        COUNT(*) as total_skills,
        COUNT(CASE WHEN skill_mastery_pct >= 80 THEN 1 END) as mastered_skills
      FROM `{self.project_id}.{self.dataset_id}.v_student_skill_mastery`
      WHERE student_id = @student_id AND subject = @subject
      GROUP BY subject
    )
    SELECT 
      v.subject,
      v.velocity_status,
      v.velocity_percentage,
      v.days_ahead_behind,
      v.actual_progress,
      v.expected_progress,
      v.total_subskills_in_subject,
      m.avg_mastery,
      m.total_skills,
      m.mastered_skills,
      ARRAY_AGG(
        STRUCT(
          a.subskill_id,
          a.subskill_description,
          a.skill_description,
          a.subskill_mastery_pct,
          a.unlock_score,
          a.difficulty_start,
          a.readiness_status,
          a.grade,
          a.unit_title
        )
        ORDER BY 
          CASE a.readiness_status 
            WHEN 'Ready' THEN 1
            WHEN 'Nearly Ready' THEN 2 
            ELSE 3
          END,
          a.unlock_score DESC
      ) as available_subskills
    FROM subject_velocity v
    LEFT JOIN mastery_context m ON v.subject = m.subject
    LEFT JOIN available_skills a ON TRUE
    GROUP BY v.subject, v.velocity_status, v.velocity_percentage, 
             v.days_ahead_behind, v.actual_progress, v.expected_progress,
             v.total_subskills_in_subject, m.avg_mastery, m.total_skills, m.mastered_skills
    """
    
    results = await self._run_query_async(query, [
        bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
        bigquery.ScalarQueryParameter("subject", "STRING", subject)
    ])
    
    return results[0] if results else None

async def _generate_subject_recommendations(
    self,
    subject_data: Dict[str, Any],
    count: int
) -> List[Dict[str, Any]]:
    """Generate skill recommendations using LLM for specific subject"""
    
    # Minimal schema for efficiency
    recommendations_schema = {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "subskill_id": {"type": "string"},
                        "priority_rank": {"type": "integer"},
                        "student_friendly_reason": {"type": "string"},
                        "engagement_hook": {"type": "string"},
                        "estimated_time_minutes": {"type": "integer"},
                        "difficulty_level": {"type": "string"}
                    },
                    "required": ["subskill_id", "priority_rank", "student_friendly_reason", "engagement_hook"]
                }
            }
        },
        "required": ["recommendations"]
    }
    
    # Build context
    velocity_context = {
        "subject": subject_data["subject"],
        "velocity_status": subject_data["velocity_status"],
        "days_behind": subject_data.get("days_ahead_behind", 0),
        "progress": f"{subject_data.get('actual_progress', 0)}/{subject_data.get('total_subskills_in_subject', 0)} skills completed",
        "avg_mastery": f"{subject_data.get('avg_mastery', 0):.1f}%"
    }
    
    available_skills = subject_data.get("available_subskills", [])[:8]  # Limit context size
    
    prompt = f"""You are recommending specific skills for a K-5 student who is struggling in {subject_data['subject']}.

Student Context:
- Subject: {velocity_context['subject']}
- Status: {velocity_context['velocity_status']} ({velocity_context['days_behind']} days behind)
- Progress: {velocity_context['progress']}
- Current mastery level: {velocity_context['avg_mastery']}

Available Skills to Choose From:
{json.dumps([{
    "subskill_id": skill["subskill_id"],
    "description": skill["subskill_description"], 
    "skill_area": skill["skill_description"],
    "readiness": skill["readiness_status"],
    "current_mastery": f"{skill.get('subskill_mastery_pct', 0):.0f}%"
} for skill in available_skills], indent=2)}

Select {count} skills that would be most engaging and helpful for this student to catch up. 
Focus on:
1. Skills they're ready for (readiness status)
2. Building confidence with achievable challenges
3. Variety in skill areas within the subject
4. Student-friendly explanations and engaging hooks

Rank by priority (1 = highest priority). Provide engaging, age-appropriate reasons why each skill would help them catch up."""

    response = await self.gemini_client.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=GenerateContentConfig(
            response_mime_type='application/json',
            response_schema=recommendations_schema,
            temperature=0.6,  # Slightly more creative for engagement
            max_output_tokens=3000
        )
    )
    
    if not response or not response.text:
        raise Exception("Empty response from Gemini")
    
    result = json.loads(response.text)
    return result.get("recommendations", [])

async def _enrich_skill_recommendations(
    self, 
    recommendations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Add curriculum data to recommendations"""
    
    subskill_ids = [rec["subskill_id"] for rec in recommendations]
    
    if not subskill_ids:
        return recommendations
    
    # Get curriculum data
    placeholders = ",".join([f"@id_{i}" for i in range(len(subskill_ids))])
    curriculum_query = f"""
    SELECT
      subject, subskill_id, subskill_description, skill_description,
      difficulty_start, target_difficulty, grade, unit_title
    FROM `{self.project_id}.{self.dataset_id}.curriculum`
    WHERE subskill_id IN ({placeholders})
    """
    
    params = [bigquery.ScalarQueryParameter(f"id_{i}", "STRING", sid) 
             for i, sid in enumerate(subskill_ids)]
    
    curriculum_data = await self._run_query_async(curriculum_query, params)
    curriculum_lookup = {row["subskill_id"]: row for row in curriculum_data}
    
    # Enrich recommendations
    enriched = []
    for rec in recommendations:
        subskill_id = rec["subskill_id"]
        curriculum = curriculum_lookup.get(subskill_id, {})
        
        enriched_rec = {
            **rec,
            "subject": curriculum.get("subject", ""),
            "skill_description": curriculum.get("skill_description", ""),
            "subskill_description": curriculum.get("subskill_description", ""),
            "difficulty_start": curriculum.get("difficulty_start"),
            "target_difficulty": curriculum.get("target_difficulty"),
            "grade": curriculum.get("grade"),
            "unit_title": curriculum.get("unit_title"),
            "estimated_time_minutes": rec.get("estimated_time_minutes", 4)
        }
        enriched.append(enriched_rec)
    
    return sorted(enriched, key=lambda x: x.get("priority_rank", 999))
```

### Frontend Implementation

#### 1. New Hook for Subject Recommendations
**File:** `my-tutoring-app/src/hooks/useSubjectRecommendations.ts`

```typescript
import { useState, useEffect } from 'react';
import { authApiClient } from '@/lib/authApiClient';

interface SubjectRecommendation {
  subskill_id: string;
  priority_rank: number;
  student_friendly_reason: string;
  engagement_hook: string;
  estimated_time_minutes: number;
  difficulty_level: string;
  skill_description: string;
  subskill_description: string;
  grade: string;
  unit_title: string;
}

interface SubjectRecommendationsResponse {
  student_id: number;
  subject: string;
  recommendations: SubjectRecommendation[];
  generated_at: string;
}

export const useSubjectRecommendations = (studentId: number | null, subject: string | null) => {
  const [data, setData] = useState<SubjectRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    if (!studentId || !subject) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authApiClient.get(
        `/analytics/student/${studentId}/subject-recommendations?subject=${encodeURIComponent(subject)}&count=5`
      );
      setData(response.data);
    } catch (err: any) {
      console.error('Error fetching subject recommendations:', err);
      setError(err.response?.data?.detail || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && subject) {
      fetchRecommendations();
    }
  }, [studentId, subject]);

  return {
    data,
    loading,
    error,
    refetch: fetchRecommendations
  };
};
```

#### 2. Enhanced Activity Card Component
**File:** `my-tutoring-app/src/components/dashboard/EnhancedActivityCard.tsx`

```typescript
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Target } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubjectRecommendations } from '@/hooks/useSubjectRecommendations';

interface ActivityCardProps {
  studentId: number;
  subject: string;
  velocityStatus: string;
  daysAheadBehind: number;
  primaryActivity: {
    skill: string;
    description: string;
    estimatedTime?: number;
  };
  onActivitySelect?: (subskillId: string, activityType: 'primary' | 'alternative') => void;
}

const EnhancedActivityCard: React.FC<ActivityCardProps> = ({
  studentId,
  subject,
  velocityStatus,
  daysAheadBehind,
  primaryActivity,
  onActivitySelect
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  // Only fetch recommendations if student is behind
  const shouldShowAlternatives = velocityStatus.includes('Behind');
  const {
    data: recommendations,
    loading: recLoading,
    error: recError
  } = useSubjectRecommendations(
    shouldShowAlternatives ? studentId : null,
    shouldShowAlternatives ? subject : null
  );

  const getVelocityColor = (status: string) => {
    if (status.includes('Significantly Behind')) return 'text-red-600 bg-red-50';
    if (status.includes('Behind')) return 'text-orange-600 bg-orange-50';
    if (status.includes('Slightly Behind')) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const handlePrimaryActivityClick = () => {
    onActivitySelect?.('primary', 'primary');
  };

  const handleAlternativeClick = (subskillId: string) => {
    onActivitySelect?.(subskillId, 'alternative');
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        {/* Subject Header with Velocity Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">{subject}</h3>
            <Badge className={getVelocityColor(velocityStatus)}>
              {velocityStatus}
              {daysAheadBehind !== 0 && (
                <span className="ml-1">
                  {daysAheadBehind > 0 ? '+' : ''}{daysAheadBehind.toFixed(1)} days
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Primary Activity */}
        <div className="border rounded-lg p-4 mb-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">{primaryActivity.skill}</h4>
              <p className="text-blue-700 text-sm mb-2">{primaryActivity.description}</p>
              {primaryActivity.estimatedTime && (
                <div className="flex items-center text-blue-600 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {primaryActivity.estimatedTime} min
                </div>
              )}
            </div>
            <Button
              onClick={handlePrimaryActivityClick}
              className="ml-4 bg-blue-600 hover:bg-blue-700"
            >
              Start
            </Button>
          </div>
        </div>

        {/* Alternative Skills Section */}
        {shouldShowAlternatives && (
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="w-full flex items-center justify-center space-x-2 py-2 text-gray-600 hover:text-gray-800"
              disabled={recLoading}
            >
              <Target className="w-4 h-4" />
              <span>
                {recLoading 
                  ? 'Loading more skills...' 
                  : `Explore ${recommendations?.recommendations?.length || 4} more ${subject} skills`
                }
              </span>
              {!recLoading && (showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
            </Button>

            {/* Alternative Skills List */}
            {showAlternatives && (
              <div className="mt-3 space-y-2">
                {recError && (
                  <div className="text-red-600 text-sm text-center py-2">
                    Failed to load recommendations. Please try again.
                  </div>
                )}
                
                {recommendations?.recommendations?.map((rec, index) => (
                  <div
                    key={rec.subskill_id}
                    className="border rounded-lg p-3 bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-medium text-gray-900 text-sm">
                            {rec.skill_description}
                          </h5>
                          <Badge variant="outline" className="text-xs">
                            #{rec.priority_rank}
                          </Badge>
                        </div>
                        <p className="text-gray-700 text-xs mb-1">{rec.subskill_description}</p>
                        <p className="text-gray-600 text-xs italic mb-2">"{rec.engagement_hook}"</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {rec.estimated_time_minutes} min
                          </div>
                          {rec.difficulty_level && (
                            <Badge variant="secondary" className="text-xs">
                              {rec.difficulty_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAlternativeClick(rec.subskill_id)}
                        className="ml-3"
                      >
                        Try This
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedActivityCard;
```

#### 3. Integration with Daily Briefing Component
**File:** `my-tutoring-app/src/components/dashboard/DailyBriefingComponent.tsx`

Update the existing component to use the enhanced activity cards:

```typescript
// Add to imports
import EnhancedActivityCard from './EnhancedActivityCard';
import { useVelocityMetrics } from '@/hooks/useVelocityMetrics';

// Add inside component
const { data: velocityData } = useVelocityMetrics(studentId);

// Create velocity lookup
const velocityLookup = velocityData?.metrics?.reduce((acc, metric) => {
  acc[metric.subject] = {
    status: metric.velocity_status,
    daysAheadBehind: metric.days_ahead_behind
  };
  return acc;
}, {} as Record<string, { status: string; daysAheadBehind: number }>) || {};

// Replace existing activity rendering with:
{dailyPlan?.activities?.map((activity, index) => {
  const velocityInfo = velocityLookup[activity.subject] || {
    status: 'On Track',
    daysAheadBehind: 0
  };

  return (
    <EnhancedActivityCard
      key={`${activity.subject}-${index}`}
      studentId={studentId}
      subject={activity.subject}
      velocityStatus={velocityInfo.status}
      daysAheadBehind={velocityInfo.daysAheadBehind}
      primaryActivity={{
        skill: `${activity.skill_description} > ${activity.subskill_description}`,
        description: activity.reason,
        estimatedTime: activity.estimated_time
      }}
      onActivitySelect={handleActivitySelect}
    />
  );
})}

// Add activity selection handler
const handleActivitySelect = (subskillId: string, activityType: 'primary' | 'alternative') => {
  console.log('Activity selected:', { subskillId, activityType });
  // TODO: Navigate to practice session or track selection
  // router.push(`/practice?subskill=${subskillId}&source=${activityType}`);
};
```

## Testing Strategy

### Backend Testing
**File:** `backend/tests/test_subject_recommendations.py`

```python
import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai_recommendations import AIRecommendationService

@pytest.mark.asyncio
async def test_get_subject_skill_recommendations():
    # Mock BigQuery results
    mock_subject_data = {
        "subject": "Mathematics",
        "velocity_status": "Behind",
        "days_ahead_behind": -2.5,
        "available_subskills": [
            {
                "subskill_id": "MATH_001",
                "subskill_description": "Count to 10",
                "skill_description": "Basic Counting",
                "readiness_status": "Ready"
            }
        ]
    }
    
    service = AIRecommendationService("test-project")
    
    with patch.object(service, '_get_subject_focused_summary', return_value=mock_subject_data), \
         patch.object(service, '_generate_subject_recommendations', return_value=[
             {
                 "subskill_id": "MATH_001",
                 "priority_rank": 1,
                 "student_friendly_reason": "Great for building confidence",
                 "engagement_hook": "Count like a robot!",
                 "estimated_time_minutes": 3
             }
         ]), \
         patch.object(service, '_enrich_skill_recommendations', side_effect=lambda x: x):
        
        result = await service.get_subject_skill_recommendations(123, "Mathematics", 5)
        
        assert len(result) == 1
        assert result[0]["subskill_id"] == "MATH_001"
        assert result[0]["priority_rank"] == 1
```

### Frontend Testing
**File:** `my-tutoring-app/src/components/dashboard/__tests__/EnhancedActivityCard.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnhancedActivityCard from '../EnhancedActivityCard';

// Mock the hook
jest.mock('@/hooks/useSubjectRecommendations', () => ({
  useSubjectRecommendations: jest.fn()
}));

describe('EnhancedActivityCard', () => {
  const mockProps = {
    studentId: 123,
    subject: 'Mathematics',
    velocityStatus: 'Behind',
    daysAheadBehind: -2.5,
    primaryActivity: {
      skill: 'Basic Counting',
      description: 'Count to 10',
      estimatedTime: 3
    }
  };

  it('shows expand button for behind subjects', () => {
    require('@/hooks/useSubjectRecommendations').useSubjectRecommendations
      .mockReturnValue({ data: null, loading: false, error: null });

    render(<EnhancedActivityCard {...mockProps} />);
    
    expect(screen.getByText(/Explore.*more Mathematics skills/)).toBeInTheDocument();
  });

  it('does not show expand button for on-track subjects', () => {
    const onTrackProps = { ...mockProps, velocityStatus: 'On Track' };
    
    render(<EnhancedActivityCard {...onTrackProps} />);
    
    expect(screen.queryByText(/Explore.*more/)).not.toBeInTheDocument();
  });
});
```

## Database Schema Requirements

No database schema changes required. The feature leverages existing tables:
- `student_velocity_metrics` - for velocity status
- `student_available_subskills` - for skill options
- `curriculum` - for enrichment data

## Performance Considerations

### Caching Strategy
- Cache subject recommendations for 30 minutes per student-subject pair
- Cache key: `subject_recommendations_{student_id}_{subject}`
- Invalidate cache when student completes activities

### API Rate Limiting
- Limit subject recommendation calls to 10 per minute per student
- Implement exponential backoff for failed Gemini API calls

### Frontend Optimization
- Lazy load alternative skills (only fetch when expanded)
- Debounce expand/collapse actions
- Memoize recommendation data

## Monitoring & Analytics

### Metrics to Track
- **Expansion Rate**: % of behind subjects where students expand alternatives
- **Selection Rate**: % of alternative skills selected vs primary
- **Completion Rate**: % of selected alternative activities completed
- **Velocity Improvement**: Change in days behind after using feature

### Error Monitoring
- Failed recommendation generation calls
- Gemini API timeout/error rates
- Frontend component rendering errors

## Rollout Plan

### Phase 1 (Week 1): Backend Foundation
- [ ] Implement `get_subject_skill_recommendations` API endpoint
- [ ] Add new methods to `AIRecommendationService`
- [ ] Create comprehensive backend tests
- [ ] Deploy to staging environment

### Phase 2 (Week 2): Frontend Implementation  
- [ ] Create `useSubjectRecommendations` hook
- [ ] Build `EnhancedActivityCard` component
- [ ] Add frontend tests
- [ ] Integration testing

### Phase 3 (Week 3): Integration & Testing
- [ ] Update `DailyBriefingComponent` to use enhanced cards
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling improvements

### Phase 4 (Week 4): Deployment & Monitoring
- [ ] Feature flag rollout (25% → 50% → 100%)
- [ ] Monitor key metrics
- [ ] Bug fixes and optimizations
- [ ] Documentation updates

## Success Criteria

### Technical Success
- [ ] API response time < 2 seconds for subject recommendations
- [ ] Error rate < 1% for recommendation generation
- [ ] Frontend component renders without errors
- [ ] 95% uptime during rollout

### Product Success  
- [ ] >30% of "behind" subjects get expanded by students
- [ ] >20% of students select alternative skills
- [ ] >15% improvement in velocity for students using feature
- [ ] Positive feedback from initial user testing

## Risk Mitigation

### Technical Risks
- **Gemini API Rate Limits**: Implement exponential backoff and fallback to cached recommendations
- **BigQuery Cost**: Optimize queries and implement result caching
- **Frontend Performance**: Lazy loading and component optimization

### Product Risks
- **Feature Complexity**: Provide clear onboarding and help text
- **Choice Overload**: Limit to 3-5 options with clear prioritization
- **Low Adoption**: A/B testing and user feedback iteration

## Future Enhancements

### Short Term (Next Quarter)
- Add subject-specific icons and visual theming
- Implement activity selection tracking and analytics
- Add "Recently Selected" quick access

### Long Term (Next 6 Months)  
- ML-based recommendation personalization
- Peer comparison ("Students like you often choose...")
- Integration with learning path recommendations
- Mobile app optimization

---

## Questions for Product Team

1. Should we track which alternative skills students select for future personalization?
2. Do we want to limit the number of daily alternative skill expansions per student?
3. Should successful alternative skill completions affect velocity calculations?
4. Do we need admin controls for enabling/disabling this feature per student?
5. What should happen when a student completes an alternative skill vs the primary activity?

## Contact

For technical questions: [Dev Team Lead]  
For product questions: [Product Manager]  
For design review: [Design Team]

**Estimated Development Time: 3-4 weeks**  
**Priority: High**  
**Dependencies: Velocity metrics integration (already complete)**