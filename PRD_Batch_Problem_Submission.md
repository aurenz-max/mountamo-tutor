# PRD: Batch Problem Submission for Assessment Harmonization

## Overview
Create a new batch submission endpoint that processes multiple problems using the same logic as individual problem submissions. This will harmonize assessment and practice problem feedback, eliminating the need for custom assessment result parsing.

## Background
Currently, practice problems and assessments use different submission flows:
- **Practice**: Submit 1 problem → Get immediate structured feedback
- **Assessments**: Submit all answers → Complex custom scoring → Rebuild feedback

This creates duplicate problem rendering logic and inconsistent user experiences.

## Requirements

### 1. New Backend Endpoint: `/api/problems/submit-batch`

#### Input Schema
```typescript
{
  assessment_context?: {
    assessment_id: string;
    subject: string;
    student_id: number;
  };
  submissions: Array<{
    subject: string;
    problem: any;  // Same format as single problem submission
    solution_image?: string;
    skill_id: string;
    student_answer?: string;
    canvas_used?: boolean;
    subskill_id?: string;
    primitive_response?: any;
  }>
}
```

#### Processing Logic
1. **Iterate** through each submission in the array
2. **Call existing** `SubmissionService.handle_submission()` for each problem
3. **Collect** all submission results in same format as single submissions
4. **Process engagement** once at the end (total XP for batch)
5. **Store batch results** if assessment_context provided

#### Output Schema
```typescript
{
  batch_id: string;
  assessment_id?: string;  // If assessment context provided
  total_problems: number;
  submission_results: Array<{
    // Same format as individual /api/problems/submit response
    problem_id: string;
    review: {
      observation: { selected_answer: string, work_shown: string };
      analysis: { understanding: string, approach: string };
      evaluation: { score: number, justification: string };
      feedback: { praise: string, guidance: string, encouragement: string };
    };
    score: number;
    correct: boolean;
    // ... all other fields from single submission
  }>;
  engagement_summary: {
    total_xp_earned: number;
    streak_bonus: number;
    level_up: boolean;
    // ... engagement totals
  };
  batch_submitted_at: string;
}
```

### 2. Assessment Service Integration

#### New Field in Assessment Documents
Add `batch_submission` field to existing assessment storage:

```typescript
// In AssessmentService.store_assessment_submission()
{
  // ... existing assessment fields
  batch_submission?: {
    batch_id: string;
    submission_results: Array<SubmissionResult>;
    engagement_summary: EngagementSummary;
    batch_submitted_at: string;
  }
}
```

#### Implementation Steps
1. **Keep existing** `AssessmentService.score_assessment()` intact
2. **Add new method** `AssessmentService.store_batch_submission()`
3. **Call both methods** during assessment submission for transition period
4. **Frontend can choose** which data source to use

### 3. Backend Implementation Details

#### New Route in `problems.py`
```python
@router.post("/submit-batch")
async def submit_problem_batch(
    request: BatchSubmissionRequest,
    user_context: dict = Depends(get_user_context),
    submission_service: SubmissionService = Depends(get_submission_service)
) -> BatchSubmissionResponse:
```

#### Processing Logic
- **Reuse existing** `SubmissionService.handle_submission()`
- **No custom assessment logic** - just iterate through problems
- **Engagement**: Calculate totals across all submissions
- **Storage**: Store batch results if assessment context provided

## Frontend Implementation Plan

### Phase 1: Add Batch Submission to Assessments
1. **Modify assessment submission** to call `/api/problems/submit-batch`
2. **Store batch results** alongside existing assessment flow
3. **Keep existing results page** unchanged initially

### Phase 2: Update Results Display
1. **Create new results component** that reads from `batch_submission` field
2. **Reuse problem feedback components** from `ProblemSet.tsx`
3. **Add toggle** to switch between old and new display
4. **A/B test** the experience

### Phase 3: Deprecation (Future)
1. **Default to batch submission** display
2. **Remove old assessment scoring** logic
3. **Clean up redundant code**

## Success Criteria

### Technical
- [ ] Batch endpoint processes multiple problems correctly
- [ ] Individual submission logic completely reused (no duplication)
- [ ] Engagement XP calculated correctly for batch
- [ ] Assessment storage includes batch_submission field

### User Experience
- [ ] Assessment results show same feedback format as practice problems
- [ ] All existing AI summary and engagement features preserved
- [ ] No regression in assessment functionality
- [ ] Consistent problem display across practice and assessments

## Migration Strategy

### Week 1: Backend Implementation
- Create `/api/problems/submit-batch` endpoint
- Add `batch_submission` storage to AssessmentService
- Maintain parallel data storage (old + new)

### Week 2: Frontend Integration
- Update assessment submission to use batch endpoint
- Store both old and new result formats
- Create feature flag for display mode

### Week 3: Results Page Migration
- Build new results display using batch submission data
- Reuse existing problem display components
- Test feature flag toggle between old/new views

### Week 4: Validation & Cleanup
- Validate data consistency between old/new approaches
- Performance testing with batch submissions
- Plan deprecation of old assessment scoring

## Technical Benefits

1. **Code Reuse**: Assessment results use same components as practice problems
2. **Consistency**: Identical problem feedback across all contexts
3. **Maintainability**: Single problem submission logic to maintain
4. **Performance**: Batch processing instead of complex assessment parsing
5. **Flexibility**: Easy to extend batch submission to other contexts

## Risk Mitigation

- **Parallel Storage**: Keep old assessment scoring during transition
- **Feature Flags**: Toggle between old/new result display
- **Gradual Migration**: Phase rollout with validation at each step
- **Rollback Plan**: Can revert to old assessment flow if needed

---

## Frontend Explanation

### What We're Building

Instead of assessment results looking like this complex parsing:
```typescript
// Current: Parse complex Cosmos assessment document
const review_items = assessment.ai_summary.review_items.map(item => ({
  // Custom parsing logic
  question_text: item.problem_content.question,
  your_answer: extractAnswerFromSomewhere(item),
  // ... lots of custom extraction
}))
```

We'll have assessment results that look like practice problems:
```typescript
// New: Direct use of batch submission results
const submission_results = assessment.batch_submission.submission_results;
// Each item has same format as practice problem feedback
// Can reuse ProblemRenderer, feedback components, etc.
```

### Implementation Approach

1. **Assessment Submission**: Instead of calling `/api/assessments/submit`, call `/api/problems/submit-batch` with all problems
2. **Results Storage**: Store the batch results alongside existing assessment data
3. **Results Display**: Read from `batch_submission` array instead of parsing complex AI summary
4. **Component Reuse**: Use same problem display components as `ProblemSet.tsx`

This gives you the "just works" experience of practice problems, but for assessments with multiple problems at once.

## Detailed Technical Specifications

### Backend Models

#### BatchSubmissionRequest (Pydantic Model)
```python
class BatchSubmissionRequest(BaseModel):
    assessment_context: Optional[AssessmentContext] = None
    submissions: List[ProblemSubmission]

class AssessmentContext(BaseModel):
    assessment_id: str
    subject: str
    student_id: int

# Reuse existing ProblemSubmission model
```

#### BatchSubmissionResponse (Pydantic Model)
```python
class BatchSubmissionResponse(BaseModel):
    batch_id: str
    assessment_id: Optional[str] = None
    total_problems: int
    submission_results: List[SubmissionResult]
    engagement_summary: EngagementSummary
    batch_submitted_at: str
```

### Database Schema Changes

#### Assessment Document (CosmosDB)
```json
{
  "id": "assess_1004_Arts_1758311743",
  "assessment_id": "assess_1004_Arts_1758311743",
  "student_id": 1004,
  "subject": "Arts",

  // Existing fields (keep intact)
  "problems": [...],
  "answers": {...},
  "score_data": {...},
  "ai_summary": "...",

  // NEW: Batch submission results
  "batch_submission": {
    "batch_id": "batch_1758311743_assess_1004_Arts",
    "submission_results": [
      {
        "problem_id": "problem_1",
        "review": {
          "observation": {...},
          "analysis": {...},
          "evaluation": {...},
          "feedback": {...}
        },
        "score": 8,
        "correct": true,
        "xp_earned": 10
      }
      // ... more results
    ],
    "engagement_summary": {
      "total_xp_earned": 95,
      "streak_bonus": 15,
      "level_up": false,
      "current_level": 3
    },
    "batch_submitted_at": "2025-01-19T20:15:30Z"
  }
}
```

### API Integration

#### Frontend Assessment Submission
```typescript
// Current assessment submission
const submitAssessment = async (answers) => {
  return await authApi.submitAssessment(subject, {
    assessment_id,
    answers,
    time_taken_minutes
  });
};

// NEW: Batch submission approach
const submitAssessmentBatch = async (assessment, answers) => {
  const submissions = assessment.problems.map(problem => ({
    subject: assessment.subject,
    problem: problem,
    skill_id: problem.skill_id,
    subskill_id: problem.subskill_id,
    student_answer: answers[problem.id]?.student_answer,
    primitive_response: answers[problem.id]?.primitive_response
  }));

  return await authApi.submitProblemBatch({
    assessment_context: {
      assessment_id: assessment.assessment_id,
      subject: assessment.subject,
      student_id: userProfile.student_id
    },
    submissions
  });
};
```

#### Frontend Results Display
```typescript
// Current: Complex parsing
const ReviewItemsCard = ({ reviewItems }) => {
  return reviewItems.map(item => (
    <div key={item.problem_id}>
      <h3>{item.question_text}</h3>
      <p>Your answer: {item.your_answer_text}</p>
      <p>Correct: {item.correct_answer_text}</p>
    </div>
  ));
};

// NEW: Reuse practice problem components
const BatchResultsDisplay = ({ batchSubmission }) => {
  return batchSubmission.submission_results.map(result => (
    <ProblemRenderer
      key={result.problem_id}
      problem={result.problem}
      feedback={result.review}
      isSubmitted={true}
      showCorrectAnswer={true}
    />
  ));
};
```

### Performance Considerations

1. **Batch Size**: Assessments typically 10-25 problems (reasonable batch size)
2. **Processing Time**: Each problem submission ~100-200ms, batch ~2-5 seconds total
3. **Memory Usage**: Store results in memory during batch processing
4. **Database**: Single CosmosDB write for batch results vs 15+ writes for individual
5. **Network**: 1 API call vs 15 for individual submissions

### Error Handling

#### Partial Batch Failures
```python
async def submit_problem_batch(request: BatchSubmissionRequest):
    successful_results = []
    failed_results = []

    for submission in request.submissions:
        try:
            result = await submission_service.handle_submission(submission)
            successful_results.append(result)
        except Exception as e:
            failed_results.append({
                "problem_id": submission.problem.get("id"),
                "error": str(e)
            })

    # Return partial success with error details
    return BatchSubmissionResponse(
        submission_results=successful_results,
        failed_submissions=failed_results,
        # ... other fields
    )
```

#### Frontend Error Recovery
```typescript
const handleBatchSubmission = async () => {
  try {
    const result = await submitAssessmentBatch(assessment, answers);

    if (result.failed_submissions?.length > 0) {
      // Handle partial failures
      showPartialErrorMessage(result.failed_submissions);
    }

    // Process successful submissions
    processEngagementRewards(result.engagement_summary);

  } catch (error) {
    // Fallback to original assessment submission
    console.warn("Batch submission failed, falling back to original flow");
    return await submitAssessmentOriginal(answers);
  }
};
```

## Testing Strategy

### Unit Tests
- Test batch endpoint with various submission arrays
- Verify individual submission logic is reused correctly
- Test engagement calculation across multiple problems
- Validate error handling for partial failures

### Integration Tests
- End-to-end assessment submission using batch endpoint
- Verify assessment storage includes batch_submission field
- Test frontend display using batch results
- Performance testing with maximum batch sizes

### A/B Testing
- Feature flag to toggle between old/new results display
- Compare user engagement with new vs old results format
- Measure performance improvements
- Validate data consistency between approaches

This PRD provides a comprehensive roadmap for implementing batch problem submission while maintaining backwards compatibility and enabling a smooth migration path.