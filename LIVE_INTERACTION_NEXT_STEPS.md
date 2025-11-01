# Live Interaction Generalization - Next Steps

## Executive Summary

We've successfully transformed **live interaction** from a dedicated problem type into a **cross-cutting add-on feature** that can enhance ANY problem type with real-time AI tutoring. This is a significant architectural improvement that enables:

- **Multiple Choice with AI Coach**: AI reads questions aloud, provides instant voice feedback
- **True/False with AI Coach**: Natural conversation around T/F reasoning
- **Fill-in-Blanks with AI Coach**: Step-by-step guidance through each blank
- **Any problem type + AI tutoring**: The infrastructure is now generic

## What We've Accomplished

### Backend Infrastructure ✅

1. **Created Shared Schema** (`backend/app/generators/content_schemas.py:670-797`)
   - `LIVE_INTERACTION_CONFIG_SCHEMA` - reusable across all problem types
   - Includes: AI prompt, target mapping, feedback (audio + visual effects)

2. **Updated All Problem Type Schemas** (`backend/app/generators/problem_type_schemas.py`)
   - Added optional `live_interaction_config` to all 8 problem types
   - Backward compatible with legacy `live_interaction` problem type

3. **Refactored WebSocket Handler** (`backend/app/api/endpoints/practice_tutor.py`)
   - `evaluate_target_interaction()`: Works with ANY problem type
   - `build_topic_tutor_instruction()`: Detects live config generically
   - Session initialization: Problem-type agnostic

### Frontend Infrastructure ✅

1. **Updated Type System** (`my-tutoring-app/src/components/practice/primitives/types.ts`)
   - Added `aiCoachRef` to base `ProblemPrimitiveProps`
   - All primitives now support AI coach integration

2. **Enhanced Problem Renderer** (`my-tutoring-app/src/components/practice/ProblemRenderer.tsx`)
   - Passes `aiCoachRef` to all primitives automatically
   - Generic - no special casing per problem type

3. **Implemented in Key Primitives**
   - ✅ MCQPrimitive: Sends target selection on option click
   - ✅ TrueFalsePrimitive: Sends target selection on T/F choice
   - ⏳ Other primitives: Have access via base props, need implementation

4. **Updated ProblemSet Controller** (`my-tutoring-app/src/components/practice/ProblemSet.tsx`)
   - Detects `live_interaction_config` on ANY problem type
   - Shows AI Coach conditionally based on config presence

## Remaining Work

### 1. Problem Generation Logic (High Priority)

**File**: `backend/app/services/problems.py`

**Objective**: Update problem generation to conditionally add `live_interaction_config`

**Tasks**:

#### A. Phase 1: Type Selection Enhancement
**Location**: `_generate_problem_type_selection()` function (lines ~450-577)

**What to add**:
```python
# In the type selection prompt, add decision logic:
"""
For each problem type you select, also decide whether to enable AI tutoring:
- Consider: Is this for early learners (K-2)? → Strongly favor AI coach
- Consider: Is this phonics/ABC/rhyming content? → Strongly favor AI coach
- Consider: Problem complexity - simple problems benefit more from AI guidance
- Consider: Skill type - concepts requiring verbal explanation benefit most

Output format:
{
  "selected_types": [
    {
      "type": "multiple_choice",
      "enable_ai_coach": true,
      "ai_coach_rationale": "Phonics content for K-1, benefits from voice guidance"
    },
    {
      "type": "true_false",
      "enable_ai_coach": false,
      "ai_coach_rationale": "Advanced logic problem, student should work independently"
    }
  ]
}
"""
```

**Schema Update Needed**:
```python
# Update TYPE_SELECTION_SCHEMA in problem_type_schemas.py
selected_types = Schema(
    type="array",
    items=Schema(
        type="object",
        properties={
            "type": Schema(type="string", enum=[problem types]),
            "enable_ai_coach": Schema(type="boolean", description="Whether to add live_interaction_config"),
            "ai_coach_rationale": Schema(type="string", description="Why AI coach was enabled/disabled")
        }
    )
)
```

#### B. Phase 2: Problem Generation Enhancement
**Location**: `_generate_single_type()` function (lines ~579-712)

**What to add**:
```python
def _generate_single_type(
    problem_type: str,
    count: int,
    topic_context: dict,
    enable_ai_coach: bool = False,  # NEW PARAMETER
    # ... other params
):
    # Generate base problem using existing schema
    problems = await generate_problems_for_type(...)

    # NEW: If AI coach enabled, add live_interaction_config
    if enable_ai_coach:
        for problem in problems:
            problem['live_interaction_config'] = generate_ai_coach_config(
                problem_type=problem_type,
                problem_data=problem,
                topic_context=topic_context
            )

    return problems
```

**Helper Function Needed**:
```python
def generate_ai_coach_config(problem_type: str, problem_data: dict, topic_context: dict) -> dict:
    """
    Generate live_interaction_config for a given problem.

    Returns:
        {
            "prompt": {
                "system": "You are a patient AI tutor for [skill]...",
                "instruction": "Let's work on this [problem_type] together!",
                "voice": "Leda"
            },
            "targets": [
                {"id": "option_0", "is_correct": True},
                {"id": "option_1", "is_correct": False},
                # ... auto-generated from problem structure
            ],
            "evaluation": {
                "feedback": {
                    "correct": {
                        "audio": "Excellent! You got it right!",
                        "visual_effect": "celebrate"
                    },
                    "incorrect": {
                        "audio": "Not quite, let's think about this together.",
                        "visual_effect": "shake",
                        "hint": "Think about..."
                    }
                }
            }
        }
    """

    # Build system prompt based on topic context
    skill_desc = topic_context.get('skill_description', 'this skill')
    grade = topic_context.get('grade_level', 'Kindergarten')

    system_prompt = f"""You are a patient, encouraging AI tutor helping a {grade} student learn {skill_desc}.
Your role is to:
- Provide gentle guidance without giving away answers
- Celebrate correct responses enthusiastically
- Offer hints for incorrect responses
- Use age-appropriate language for {grade}
- Keep responses brief and conversational"""

    # Build instruction based on problem type
    instruction = generate_initial_instruction(problem_type, problem_data)

    # Build targets based on problem structure
    targets = extract_targets_from_problem(problem_type, problem_data)

    # Build feedback messages
    feedback = generate_feedback_messages(problem_type, topic_context)

    return {
        "prompt": {
            "system": system_prompt,
            "instruction": instruction,
            "voice": "Leda"
        },
        "targets": targets,
        "evaluation": {
            "mode": "real_time",
            "feedback": feedback
        }
    }
```

**Target Extraction Logic** (critical for each problem type):
```python
def extract_targets_from_problem(problem_type: str, problem_data: dict) -> list[dict]:
    """Extract answer targets from problem structure."""

    if problem_type == "multiple_choice":
        return [
            {
                "id": option["id"],
                "is_correct": option["id"] == problem_data["correct_option_id"],
                "description": option["text"]
            }
            for option in problem_data["options"]
        ]

    elif problem_type == "true_false":
        return [
            {"id": "true", "is_correct": problem_data["correct"] == True},
            {"id": "false", "is_correct": problem_data["correct"] == False}
        ]

    elif problem_type == "fill_in_blanks":
        # Each blank becomes a target with its correct answers
        return [
            {
                "id": blank["id"],
                "is_correct": True,  # Evaluated differently (text matching)
                "description": f"Blank {i+1}",
                "correct_answers": blank["correct_answers"]
            }
            for i, blank in enumerate(problem_data["blanks"])
        ]

    # Add other problem types as needed...

    return []
```

#### C. Update Main Generation Flow
**Location**: `generate_problem_set()` function (lines ~860-986)

**What to modify**:
```python
# Phase 1: Type selection
type_selection_result = await _generate_problem_type_selection(...)
selected_types_with_ai = type_selection_result["selected_types"]  # Now includes enable_ai_coach

# Phase 2: Generate problems (parallel)
generation_tasks = []
for type_config in selected_types_with_ai:
    task = _generate_single_type(
        problem_type=type_config["type"],
        count=type_config.get("count", 2),
        enable_ai_coach=type_config.get("enable_ai_coach", False),  # NEW
        topic_context=topic_context,
        # ... other params
    )
    generation_tasks.append(task)
```

**Testing Checklist**:
- [ ] Generate MCQ with `enable_ai_coach=True` → verify `live_interaction_config` present
- [ ] Generate MCQ with `enable_ai_coach=False` → verify no `live_interaction_config`
- [ ] Verify targets match problem structure (option IDs align)
- [ ] Test with different grade levels (K-2 vs 3-5) → AI coach frequency differs
- [ ] Test with phonics content → AI coach should be heavily favored

---

### 2. Frontend Primitive Integration (Medium Priority)

**Objective**: Add AI coach interaction to remaining problem primitives

#### A. Fill-in-Blanks Primitive
**File**: `my-tutoring-app/src/components/practice/primitives/FillInBlankPrimitive.tsx`

**What to add**:
```typescript
const FillInBlankPrimitive: React.FC<FillInBlankPrimitiveProps> = ({
  problem,
  aiCoachRef,  // Already available via base props
  // ... other props
}) => {
  const handleBlankChange = (blankId: string, value: string) => {
    // Existing logic...
    onUpdate({ student_answers: updatedAnswers });

    // NEW: Notify AI coach when student fills a blank
    if (aiCoachRef?.current && (problem as any).live_interaction_config && !isSubmitted) {
      // For fill-in-blanks, we can send each blank as it's completed
      aiCoachRef.current.sendTargetSelection(blankId);

      // Alternative: Only send when all blanks filled
      // if (allBlanksFilled(updatedAnswers)) {
      //   aiCoachRef.current.sendTargetSelection('all_blanks_complete');
      // }
    }
  };

  // ...
};
```

**Design Decision Needed**:
- Should AI coach provide feedback after EACH blank? (more interactive)
- Or only after ALL blanks filled? (less interruption)
- **Recommendation**: For K-2, feedback per blank; for 3+, feedback at end

#### B. Matching Primitive
**File**: `my-tutoring-app/src/components/practice/primitives/MatchingPrimitive.tsx`

**What to add**:
```typescript
const handleMatchComplete = (leftId: string, rightId: string) => {
  // Existing logic...
  onUpdate({ student_matches: updatedMatches });

  // NEW: Notify AI coach when student makes a match
  if (aiCoachRef?.current && (problem as any).live_interaction_config) {
    // Send the match pair as a stringified target
    aiCoachRef.current.sendTargetSelection(`${leftId}:${rightId}`);
  }
};
```

**Backend Update Needed**:
- Update `evaluate_target_interaction()` to handle match-pair format
- Check if `left:right` pairing exists in `targets` array

#### C. Sequencing Primitive
**File**: `my-tutoring-app/src/components/practice/primitives/SequencingPrimitive.tsx`

**Design Question**: When to trigger AI coach?
- After each item is placed?
- Only when sequence complete?
- **Recommendation**: Only when complete (avoid too many interruptions)

```typescript
const handleSequenceChange = (newSequence: string[]) => {
  onUpdate({ student_sequence: newSequence });

  // NEW: Notify AI coach when sequence is complete
  if (aiCoachRef?.current && (problem as any).live_interaction_config) {
    if (newSequence.length === problem.items.length) {
      // Send the full sequence for evaluation
      aiCoachRef.current.sendTargetSelection(JSON.stringify(newSequence));
    }
  }
};
```

#### D. Categorization Primitive
**File**: `my-tutoring-app/src/components/practice/primitives/CategorizationPrimitive.tsx`

Similar to matching - send target when item is categorized:
```typescript
const handleItemCategorized = (itemId: string, category: string) => {
  onUpdate({ student_categorization: updatedCategorization });

  if (aiCoachRef?.current && (problem as any).live_interaction_config) {
    aiCoachRef.current.sendTargetSelection(`${itemId}:${category}`);
  }
};
```

---

### 3. Backend Target Evaluation Enhancement (Medium Priority)

**File**: `backend/app/api/endpoints/practice_tutor.py`

**Objective**: Extend `evaluate_target_interaction()` to handle complex target formats

**Current Limitation**: Only handles simple target IDs (e.g., `"option_A"`)

**Need to Support**:
- Fill-in-blanks: Text answer matching
- Matching: Pair validation (`"left_1:right_3"`)
- Sequencing: Full sequence validation
- Categorization: Item-category pairs

**Implementation**:
```python
def evaluate_target_interaction(problem: Optional[dict], selected_target_id: str) -> dict:
    """Enhanced evaluation supporting multiple target formats."""

    # ... existing config extraction ...

    # Determine problem type and evaluation strategy
    problem_type = problem.get('problem_type')

    if problem_type == 'multiple_choice' or problem_type == 'true_false':
        # Simple ID matching (existing logic)
        return evaluate_simple_target(targets, selected_target_id, evaluation)

    elif problem_type == 'fill_in_blanks':
        # Text answer matching with case sensitivity
        return evaluate_fill_in_blank_target(problem, selected_target_id, evaluation)

    elif problem_type == 'matching_activity':
        # Pair validation (left:right format)
        return evaluate_matching_target(problem, selected_target_id, evaluation)

    elif problem_type == 'sequencing_activity':
        # Sequence validation
        return evaluate_sequencing_target(problem, selected_target_id, evaluation)

    elif problem_type == 'categorization_activity':
        # Category validation
        return evaluate_categorization_target(problem, selected_target_id, evaluation)

    # Fallback to simple matching
    return evaluate_simple_target(targets, selected_target_id, evaluation)


def evaluate_fill_in_blank_target(problem: dict, blank_id: str, evaluation: dict) -> dict:
    """Evaluate fill-in-blank answer."""
    blanks = problem.get('blanks', [])

    for blank in blanks:
        if blank['id'] == blank_id:
            # Get student's answer from... where?
            # ISSUE: We only receive blank_id, not the student's text answer
            # SOLUTION: Need to change frontend to send: "blank_1:student_answer"

            # For now, this needs frontend modification
            return {
                "error": "Fill-in-blank evaluation requires answer text"
            }


def evaluate_matching_target(problem: dict, match_pair: str, evaluation: dict) -> dict:
    """Evaluate matching pair in format 'left_id:right_id'."""
    try:
        left_id, right_id = match_pair.split(':')
    except ValueError:
        return {"error": "Invalid match pair format"}

    mappings = problem.get('mappings', [])

    for mapping in mappings:
        if mapping['left_id'] == left_id:
            is_correct = right_id in mapping['right_ids']
            feedback_key = "correct" if is_correct else "incorrect"
            feedback = evaluation.get('feedback', {}).get(feedback_key, {})

            return {
                "correct": is_correct,
                "feedback_audio": feedback.get('audio', 'Good try!'),
                "visual_effect": feedback.get('visual_effect', 'none'),
                "target_id": match_pair,
                "hint": feedback.get('hint') if not is_correct else None
            }

    return {"error": f"Mapping not found for {left_id}"}
```

**Action Items**:
- [ ] Implement `evaluate_fill_in_blank_target()` - needs frontend data format change
- [ ] Implement `evaluate_matching_target()`
- [ ] Implement `evaluate_sequencing_target()`
- [ ] Implement `evaluate_categorization_target()`
- [ ] Update frontend primitives to send data in expected format

---

### 4. Visual Feedback Enhancements (Low Priority)

**Objective**: Rich visual effects when AI coach provides feedback

**Current**: Basic `celebrate`, `shake`, `bounce` effects

**Ideas to Implement**:
- Confetti animation for correct answers
- Gentle pulsing for hints
- Progress indicators for multi-step problems
- Character animations (if AI tutor avatar is added)

**Files to Modify**:
- `my-tutoring-app/src/components/practice/primitives/*.tsx` - Add CSS animations
- Consider using Framer Motion for richer animations

---

### 5. Analytics & Tracking (Low Priority)

**Objective**: Track effectiveness of AI coach feature

**Metrics to Capture**:
- Problems with AI coach vs without: completion rate
- Problems with AI coach vs without: accuracy
- Time-to-completion with/without AI coach
- Student engagement: do they interact with AI coach?
- Hint usage frequency

**Implementation**:
- Add events to `PracticeAICoach.tsx` WebSocket handlers
- Log to BigQuery via `BigQueryAnalyticsService`
- Create dashboard to compare AI-coached vs non-coached sessions

---

## Testing Strategy

### Unit Tests
- [ ] Backend: `evaluate_target_interaction()` with all problem types
- [ ] Backend: `generate_ai_coach_config()` for each problem type
- [ ] Frontend: Primitive components call `sendTargetSelection()` correctly

### Integration Tests
- [ ] Generate MCQ with AI coach → verify schema structure
- [ ] Generate True/False with AI coach → verify targets align
- [ ] WebSocket flow: frontend selection → backend evaluation → audio feedback
- [ ] Mixed problem set: some with AI coach, some without

### User Acceptance Testing
- [ ] K-1 student: MCQ with AI coach (phonics content)
- [ ] K-1 student: True/False with AI coach
- [ ] Grade 3 student: MCQ without AI coach (should still work)
- [ ] Verify audio feedback is age-appropriate
- [ ] Verify visual effects don't distract

---

## Deployment Plan

### Phase 1: Soft Launch (Week 1)
- Deploy to staging environment
- Enable AI coach for 10% of K-1 phonics problems only
- Monitor for errors, audio quality, response times
- Gather teacher feedback

### Phase 2: Gradual Rollout (Week 2-3)
- Increase to 50% of K-2 problems across all subjects
- Add AI coach to True/False problems
- Expand to grades 3-5 selectively

### Phase 3: Full Deployment (Week 4+)
- AI coach available for all problem types
- Generation logic decides automatically when to enable
- Feature flag to disable if issues arise

---

## Open Questions for Team Discussion

1. **Fill-in-Blanks Interaction Model**:
   - Provide feedback after each blank, or only after all blanks filled?
   - For multi-blank problems, how do we avoid overwhelming students?

2. **Target ID Format Standardization**:
   - Should we standardize on `"type:value"` format? (e.g., `"match:left1:right3"`)
   - Or keep format specific to each problem type?

3. **AI Coach Personality**:
   - Should voice/personality vary by grade level?
   - K-1: Very enthusiastic and simple language
   - 3-5: More mature, Socratic questioning
   - Should this be configurable per problem?

4. **Performance Considerations**:
   - Audio generation latency - is sub-1s achievable?
   - WebSocket connection limits - how many concurrent sessions?
   - Gemini API rate limits - do we need fallback TTS?

5. **Accessibility**:
   - Closed captions for AI audio responses?
   - Visual-only mode for hearing-impaired students?
   - Keyboard navigation for AI coach UI?

---

## Success Metrics

**Within 2 Weeks of Full Deployment**:
- ✅ 80%+ of K-2 problems successfully enhanced with AI coach
- ✅ <1.5s average latency from selection to audio feedback
- ✅ No increase in problem submission errors
- ✅ Positive teacher feedback (survey)

**Within 1 Month**:
- ✅ 10%+ improvement in completion rate for AI-coached problems
- ✅ 5%+ improvement in accuracy for AI-coached problems
- ✅ 70%+ student engagement with AI coach (at least one interaction per problem)

---

## Resources & References

**Code Locations**:
- Backend schemas: `backend/app/generators/content_schemas.py`
- Problem generation: `backend/app/services/problems.py`
- WebSocket handler: `backend/app/api/endpoints/practice_tutor.py`
- Frontend primitives: `my-tutoring-app/src/components/practice/primitives/`
- AI Coach component: `my-tutoring-app/src/components/practice/PracticeAICoach.tsx`

**Related Documentation**:
- Gemini Live API: https://ai.google.dev/api/live
- Audio streaming best practices: (internal wiki link)
- Problem type schemas: `backend/app/generators/problem_type_schemas.py`

**Team Contacts**:
- Backend lead: [Name] - Problem generation logic
- Frontend lead: [Name] - Primitive components
- AI/ML lead: [Name] - Gemini integration, prompt engineering
- Product: [Name] - User testing, metrics definition

---

## Timeline Estimate

| Task | Estimated Time | Priority | Owner |
|------|---------------|----------|-------|
| Problem generation logic | 3-4 days | High | Backend team |
| Target extraction helpers | 2 days | High | Backend team |
| Fill-in-blanks integration | 1 day | Medium | Frontend team |
| Matching integration | 1 day | Medium | Frontend team |
| Enhanced target evaluation | 2 days | Medium | Backend team |
| Unit tests | 2 days | High | Both teams |
| Integration testing | 2 days | High | QA team |
| User acceptance testing | 3 days | High | Product + QA |
| **Total** | **2-3 weeks** | | |

---

## Questions or Blockers?

**Reach out to**: [Lead Developer] or post in #live-interaction-rollout Slack channel

**Weekly sync**: Fridays 2pm - review progress, address blockers, adjust priorities
