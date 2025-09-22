# Categorization Problems Missing from Assessment Review Items

## Problem Statement
Categorization problems are being processed and scored correctly, but they're not appearing in the `review_items` section of assessment results. Instead, categorization answer data is incorrectly bleeding into other problem types (MCQ, True/False).

## What We Fixed Successfully
✅ **Frontend Issue**: Student categorization selections now properly flow from frontend to backend
- Added categorization data extraction in `AssessmentPlayer.tsx`
- Categorization answers now appear correctly in `primitive_response` field

✅ **Backend Processing**: Categorization problems are correctly scored and saved
- Submission service properly handles categorization logic
- Student answers are correctly evaluated (all 6 items matched = score 10)
- Review data includes proper `question_text`, `your_answer_text`, `correct_answer_text`

## Remaining Issue: Data Corruption in Review Items

### Root Cause
The `observation.selected_answer` field is being shared/corrupted across different problem reviews.

### Evidence from Logs
```
problem_id: mc_004 (Multiple Choice)
observation: {
  'selected_answer': "{'Bird': 'Feathers', 'Cat': 'Fur', ...}" // <- This is categorization data!
}
```

## Key Files Involved
1. **`backend/app/services/ai_assessment_service.py`** - `_extract_student_answer()` method
2. **`backend/app/services/assessment_service.py`** - Problem review creation/storage
3. **`backend/app/services/submission_service.py`** - Review object structure (lines 501-533)

## Technical Details

### What Should Happen
- Each problem type should have its own isolated review data
- `cat_001` should appear in review_items list with proper categorization display
- MCQ problems should only have MCQ answer data

### What's Actually Happening
- `cat_001` missing from review_items entirely (only 6 items instead of 7+)
- Categorization data appearing in `observation.selected_answer` for wrong problems
- MCQ problems showing categorization answers instead of selected options

## Investigation Areas for Dev Team

### 1. Review Data Storage
Check how individual problem reviews are stored and retrieved
- Are reviews being overwritten?
- Is there shared state between problem submissions?

### 2. Observation Object Creation
In `submission_service.py` lines 501-533
- The categorization handler creates `observation.selected_answer`
- This data may be persisting to wrong problems

### 3. Assessment Service Review Collection
In `assessment_service.py`
- How are individual problem reviews collected into `problem_reviews` list?
- Why is `cat_001` missing from the final list?

## Expected Fix
- Categorization problems should appear in review_items with proper formatting
- Each problem type should have isolated, correct answer data
- No cross-contamination between different problem submissions

## Testing
Submit an assessment with mixed problem types (MCQ + True/False + Categorization) and verify:
1. All problems appear in review_items
2. Each problem shows correct question and answer data
3. No data bleeding between problem types

---

**Priority**: High - affects assessment result accuracy and user experience
**Impact**: Data corruption causing incorrect answer display in assessment reviews