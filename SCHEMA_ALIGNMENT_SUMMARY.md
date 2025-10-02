# Schema Alignment & Type Safety Implementation

## Summary

Fixed the schema misalignment issues between frontend and backend that were causing incorrect API requests when navigating from daily activities to practice sessions.

## Problem Identified

The root cause was **mixing routing identifiers with curriculum identifiers**:

1. **Backend** returns activities with:
   - Activity ID: `"weekly-ACT-Social Studies-0-1"` (for tracking/routing)
   - Curriculum Metadata: `{skill: {id: "SS001-04"}, subskill: {id: "SS001-04-E"}, ...}` (actual curriculum IDs)

2. **Frontend** was incorrectly:
   - Using the activity ID as if it were a curriculum ID
   - Trying to parse `"weekly-ACT-Social Studies-0-1"` with `parseActivityId()`
   - Resulting in mangled API requests: `skill_id="weekly-ACT"`, `unit_id="weekly"`

3. **Backend /api/problems/generate** expected properly formatted curriculum IDs

## Solution Implemented

Created an end-to-end typed system that eliminates all string parsing:

### 1. Shared Type Definitions

**Frontend**: `/my-tutoring-app/src/types/curriculum.ts`
- `CurriculumUnit`, `CurriculumSkill`, `CurriculumSubskill`
- `CurriculumMetadata` - The source of truth for curriculum IDs
- `DailyActivity` - Separates activity.id (routing) from curriculum_metadata (API calls)
- `ProblemGenerationRequest` - Typed API request matching backend exactly
- Helper functions: `activityToTopicSelection()`, `activityToProblemRequest()`

**Backend**: `/backend/app/schemas/curriculum.py`
- Mirror schemas in Pydantic
- `CurriculumMetadata` matches frontend exactly
- Helper: `create_curriculum_metadata()`

### 2. Updated Components

#### ActivityCard (`/src/components/dashboard/ActivityCard.tsx`)
**BEFORE**: Passed minimal URL params
**AFTER**: Passes complete curriculum metadata via URL
```typescript
const buildPracticeRoute = () => {
  const params = new URLSearchParams();
  params.append('subject', subject);
  params.append('unit_id', curriculum_metadata.unit.id);
  params.append('skill_id', curriculum_metadata.skill.id);
  params.append('subskill_id', curriculum_metadata.subskill.id);
  // ... descriptions for display
  return `/practice/${activityData.id}?${params}`;
};
```

#### Practice Page (`/src/app/practice/[subskillId]/page.tsx`)
**BEFORE**: Used `createTopicFromSubskillId()` which tried to parse the activity ID
**AFTER**: Uses `createTopicFromCurriculumMetadata()` which reads from URL params or activity data
```typescript
const createTopicFromCurriculumMetadata = (activityId: string, activity: any): TopicSelection | null => {
  // Get curriculum IDs from URL parameters (passed from ActivityCard)
  const skillIdFromUrl = searchParams?.get('skill_id');
  const subskillIdFromUrl = searchParams?.get('subskill_id');

  // Use curriculum metadata from activity if available, otherwise URL params
  const actualSkillId = activity?.curriculum_metadata?.skill?.id || skillIdFromUrl;
  // NO PARSING - use the IDs as-is

  return {
    subject: detectedSubject,
    selection: {
      unit: actualUnitId,
      skill: actualSkillId,  // Direct from curriculum_metadata
      subskill: actualSubskillId  // Direct from curriculum_metadata
    },
    // ...
  };
};
```

#### ProblemSet (`/src/components/practice/ProblemSet.tsx`)
**BEFORE**: Had `parseActivityId()` function that tried to extract curriculum IDs from activity IDs
**AFTER**: Removed parseActivityId entirely - uses curriculum IDs directly
```typescript
const generateProblemSet = async () => {
  // IMPORTANT: Use curriculum IDs directly from currentTopic.selection
  // NO PARSING - these are the actual curriculum IDs from the backend
  const skillId = currentTopic.selection?.skill;
  const subskillId = currentTopic.selection?.subskill;
  const unitId = currentTopic.selection?.unit;

  const practiceSetRequest = {
    subject: currentTopic.subject,
    unit_id: unitId,
    skill_id: skillId,  // Direct curriculum ID: "SS001-04"
    subskill_id: subskillId,  // Direct curriculum ID: "SS001-04-E"
    count: numProblems
  };

  const problemsArray = await authApi.generatePracticeSet(practiceSetRequest);
};
```

#### Auth API Client (`/src/lib/authApiClient.ts`)
**BEFORE**: Untyped problem generation methods
**AFTER**: Uses typed `ProblemGenerationRequest`
```typescript
async generateProblem(data: ProblemGenerationRequest): Promise<Problem | Problem[]> {
  return this.post('/api/problems/generate', data);
}

async getDailyPlan(studentId: number, date?: string) {
  // ...
}
```

## Data Flow (Before vs After)

### BEFORE (Broken)
```
Backend Daily Activity:
  id: "weekly-ACT-Social Studies-0-1"
  curriculum_metadata: {
    skill: {id: "SS001-04"},
    subskill: {id: "SS001-04-E"}
  }
    ↓
ActivityCard:
  route: `/practice/weekly-ACT-Social Studies-0-1?subject=Social Studies`
    ↓
Practice Page:
  parseActivityId("weekly-ACT-Social Studies-0-1")
    → skill_id: "weekly-ACT"  ❌ WRONG
    → unit_id: "weekly"       ❌ WRONG
    → subskill_id: "weekly-ACT-Social%20Studies-0-1"  ❌ WRONG
    ↓
API Request:
  POST /api/problems/generate {
    subject: "Social Studies",
    skill_id: "weekly-ACT",      ❌ 404 NOT FOUND
    subskill_id: "weekly-ACT-Social%20Studies-0-1"
  }
```

### AFTER (Fixed)
```
Backend Daily Activity:
  id: "weekly-ACT-Social Studies-0-1"  (for routing only)
  curriculum_metadata: {
    skill: {id: "SS001-04"},           ← SOURCE OF TRUTH
    subskill: {id: "SS001-04-E"}       ← SOURCE OF TRUTH
  }
    ↓
ActivityCard:
  route: `/practice/weekly-ACT-Social Studies-0-1?
          subject=Social Studies&
          skill_id=SS001-04&
          subskill_id=SS001-04-E&
          unit_id=SS001`  ✅ CORRECT
    ↓
Practice Page:
  createTopicFromCurriculumMetadata()
    → skill_id: "SS001-04"      ✅ from URL param
    → unit_id: "SS001"          ✅ from URL param
    → subskill_id: "SS001-04-E" ✅ from URL param
  (NO PARSING - direct use)
    ↓
API Request:
  POST /api/problems/generate {
    subject: "Social Studies",
    skill_id: "SS001-04",           ✅ CORRECT
    subskill_id: "SS001-04-E",      ✅ CORRECT
    unit_id: "SS001",               ✅ CORRECT
    count: 5
  }  ✅ 200 OK - Problems generated
```

## Key Principles

1. **Activity ID ≠ Curriculum ID**
   - Activity ID is for routing/tracking (e.g., "weekly-ACT-Social Studies-0-1")
   - Curriculum IDs are for API calls (e.g., "SS001-04", "SS001-04-E")
   - Never parse or derive curriculum IDs from activity IDs

2. **curriculum_metadata is the Source of Truth**
   - Always use IDs from `curriculum_metadata`
   - Never transform, parse, or manipulate these IDs
   - Pass them through exactly as received from backend

3. **End-to-End Type Safety**
   - TypeScript types on frontend match Pydantic schemas on backend
   - API requests use typed request objects
   - Compiler catches mismatches

4. **No String Munging**
   - Removed all `parseActivityId()`, string splitting, regex matching
   - Use structured data directly

## Files Changed

### Frontend
- `my-tutoring-app/src/types/curriculum.ts` - NEW: Shared type definitions
- `my-tutoring-app/src/lib/authApiClient.ts` - Updated with typed methods
- `my-tutoring-app/src/components/dashboard/ActivityCard.tsx` - Pass full curriculum metadata
- `my-tutoring-app/src/app/practice/[subskillId]/page.tsx` - Use curriculum metadata directly
- `my-tutoring-app/src/components/practice/ProblemSet.tsx` - Removed parsing, use IDs directly

### Backend
- `backend/app/schemas/curriculum.py` - NEW: Pydantic curriculum schemas

## Testing

To test the fix:
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd my-tutoring-app && npm run dev`
3. Navigate to http://localhost:3000/
4. Click on a daily activity
5. Click "Practice" button
6. Verify:
   - No 404 error
   - Problems load correctly
   - Console logs show correct curriculum IDs:
     ```
     🎯 [PROBLEM_SET] Generating problems with curriculum IDs:
       Subject: Social Studies
       Unit ID: SS001
       Skill ID: SS001-04
       Subskill ID: SS001-04-E
     ```

## Benefits

✅ Type-safe end-to-end data flow
✅ No string parsing or manipulation
✅ Clear separation of concerns (routing vs curriculum)
✅ Frontend/backend schema alignment
✅ Better error messages and debugging
✅ Easier to maintain and extend
