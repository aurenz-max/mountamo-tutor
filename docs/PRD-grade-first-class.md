# PRD: Grade as a First-Class Curriculum Dimension

## Problem Statement

Grade is currently a string property buried inside subjects (`grade_level: "Kindergarten"`), not part of the curriculum's structural identity. This means:

- **No multi-grade support per subject**: `curriculum_published/MATHEMATICS` can only hold one grade. Adding 3rd Grade Math would overwrite Kindergarten Math.
- **No grade-based discovery**: No API can answer "what subjects are available for Kindergarten?" without loading every document.
- **Student-to-content mismatch**: A student's `grade_level` profile field exists but isn't used to filter which curriculum they see.
- **Inconsistent formats**: Authoring uses `"1st Grade"`, student profiles use `"1"`, BigQuery uses whatever the source provides.

## Goal

Make grade a structural dimension of the curriculum hierarchy so that:

1. Multiple grades of the same subject can coexist
2. Students see content scoped to their grade
3. APIs support grade-based filtering and discovery
4. A single canonical grade format is used everywhere

## Current State

```
curriculum_published/
  MATHEMATICS          → grade_level: "Kindergarten" (field, not key)
  LANGUAGE_ARTS        → grade_level: "Kindergarten" (field, not key)
```

**Hierarchy**: Subject → Unit → Skill → Subskill (grade is a property of Subject)

**Key files involved**:
- Authoring models: `curriculum-authoring-service/app/models/curriculum.py`
- Authoring deploy: `curriculum-authoring-service/app/services/curriculum_manager.py`
- Authoring Firestore: `curriculum-authoring-service/app/db/firestore_graph_service.py`
- Backend reader: `backend/app/services/curriculum_service.py`
- Backend Firestore: `backend/app/db/firestore_service.py`
- Backend endpoints: `backend/app/api/endpoints/curriculum.py`
- Backend problems: `backend/app/services/problems.py` (hardcoded "Kindergarten" in ~6 places)
- Backend Cosmos cache: `backend/app/db/cosmos_db.py` (grade in cache key: `subject:grade:subskill`)
- Authoring frontend: `curriculum-designer-app/` (subject selector, subject form, constants)
- Tutoring frontend: `my-tutoring-app/` (user preferences, dashboard)

## Proposed Design

### Core Change: Grade-Scoped Subject Identity

The Firestore document key and BigQuery subject identity become a composite of grade + subject:

```
curriculum_published/
  K_MATHEMATICS        → grade: "K", subject_name: "Mathematics"
  K_LANGUAGE_ARTS      → grade: "K", subject_name: "Language Arts"
  3_MATHEMATICS        → grade: "3", subject_name: "Mathematics"
```

This is **Option A from earlier discussion** — encode grade into the subject_id at authoring time. No Firestore structural changes needed (no subcollections), all existing read paths work with the new IDs.

### Canonical Grade Format

Standardize on short codes everywhere. One enum, used across all services:

| Code | Display Label |
|------|--------------|
| `PK` | Pre-K |
| `K`  | Kindergarten |
| `1`  | 1st Grade |
| `2`  | 2nd Grade |
| `3`  | 3rd Grade |
| ... | ... |
| `12` | 12th Grade |

**Storage**: Always store the short code (`K`, `3`, `PK`).
**Display**: Map to label at the UI layer only.

---

## Changes by Layer

### Phase 1: Schema & Authoring Service

#### 1.1 Canonical Grade Enum

Create a shared grade constants file used by both authoring and backend.

**Authoring service** — `curriculum-authoring-service/app/models/grades.py` (new):
```python
GRADE_CODES = ["PK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]
GRADE_LABELS = {
    "PK": "Pre-K", "K": "Kindergarten",
    "1": "1st Grade", "2": "2nd Grade", "3": "3rd Grade",
    # ...
}
```

**Backend** — `backend/app/models/grades.py` (new, same content).

**Frontend constants** — update `curriculum-designer-app/lib/curriculum-authoring/constants.ts` and `my-tutoring-app` to use same codes.

#### 1.2 Subject Model Changes

**`curriculum-authoring-service/app/models/curriculum.py`**:

```python
class SubjectBase(BaseModel):
    subject_id: str          # Now includes grade: "K_MATHEMATICS"
    subject_name: str        # Human-readable: "Mathematics"
    grade: str               # Canonical code: "K"
    description: Optional[str] = None
    # Remove grade_level, replace with grade
```

**Migration**: Rename `grade_level` → `grade` across all models. Update BigQuery `subjects` table to use canonical codes.

#### 1.3 Subject ID Generation

When creating a subject, auto-generate the ID as `{grade}_{SUBJECT_NAME_UPPER}`:

```python
# curriculum-authoring-service/app/services/curriculum_manager.py
async def create_subject(self, subject: SubjectCreate, ...):
    subject_id = f"{subject.grade}_{subject.subject_name.upper().replace(' ', '_')}"
    # ...
```

This replaces the current free-form subject_id input.

#### 1.4 Deploy Document Key

**`curriculum_manager.py` → `deploy_curriculum_to_firestore()`**: Already uses `subject_id` as the doc key. Since `subject_id` now includes grade, the Firestore key becomes `K_MATHEMATICS` automatically. No deploy code changes needed beyond the new ID format.

---

### Phase 2: Backend Service Changes

#### 2.1 Curriculum Service — Grade-Aware Lookups

**`backend/app/services/curriculum_service.py`**:

```python
async def get_available_subjects(self, grade: Optional[str] = None) -> List[Dict]:
    """Get subjects, optionally filtered by grade."""
    if self._use_firestore and self.firestore_service:
        published = await self.firestore_service.get_all_published_subjects()
        if grade:
            published = [s for s in published if s.get("grade") == grade]
        return published
    # BigQuery fallback with WHERE grade = @grade

async def get_curriculum(self, subject_id: str) -> List[Dict]:
    """Get curriculum by subject_id (which now includes grade)."""
    # No change needed — subject_id is already the document key
    ...
```

#### 2.2 Curriculum Endpoints — Add Grade Filter

**`backend/app/api/endpoints/curriculum.py`**:

```python
@router.get("/subjects")
async def get_available_subjects(
    grade: Optional[str] = None,  # NEW: optional grade filter
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    subjects = await curriculum_service.get_available_subjects(grade=grade)
    return {"subjects": subjects}
```

#### 2.3 Remove Hardcoded Grade Defaults

**`backend/app/services/problems.py`** — Replace all hardcoded `"Kindergarten"` with grade from curriculum metadata or student profile:

- Line 698: `grade_level` should come from `topic_context` or `subskill_metadata`
- Line 731: Same
- Line 1380: Same
- Line 1473, 1636: Read from student profile

**`backend/app/api/endpoints/packages.py`** — Replace `"Elementary"` fallbacks (lines 636, 648, 740) with grade from curriculum metadata.

#### 2.4 Firestore Service — Published Curriculum Reader

**`backend/app/db/firestore_service.py`**:

```python
async def get_all_published_subjects(self) -> List[Dict[str, Any]]:
    """Get all deployed subjects with grade info."""
    docs = self.client.collection('curriculum_published').stream()
    subjects = []
    for doc in docs:
        doc_data = doc.to_dict()
        subjects.append({
            "subject_id": doc.id,
            "subject_name": doc_data.get("subject_name", doc.id),
            "grade": doc_data.get("grade"),  # NEW: include grade
        })
    return subjects
```

#### 2.5 Student Profile Validation

**`backend/app/models/user_profiles.py`** — Update validator (lines 100-110) to use canonical codes from shared grades module instead of hardcoded list.

---

### Phase 3: Authoring Frontend

#### 3.1 Subject Selector — Group by Grade

**`curriculum-designer-app/components/curriculum-designer/`**:

Current: Flat dropdown of subjects.
Proposed: Grouped dropdown or two-level selector:

```
Grade: [Kindergarten ▼]
Subject: [Mathematics ▼] [Language Arts ▼]
```

Or a single dropdown grouped by grade:
```
── Kindergarten ──
  Mathematics
  Language Arts
── 3rd Grade ──
  Mathematics
```

#### 3.2 Subject Creation — Grade Required

**`SubjectForm.tsx`**: Make grade a required field (currently optional). Use canonical grade codes from updated constants. Auto-generate subject_id from grade + name.

#### 3.3 Update Constants

**`curriculum-designer-app/lib/curriculum-authoring/constants.ts`**:
```typescript
export const GRADE_CODES = {
  PK: "Pre-K",
  K: "Kindergarten",
  "1": "1st Grade",
  // ...
} as const;

// Remove old GRADE_LEVELS array, replace with GRADE_CODES
```

---

### Phase 4: Tutoring Frontend

#### 4.1 Student Grade → Content Filtering

When a student with `grade_level: "K"` opens the dashboard, only show subjects where `grade === "K"`.

**`my-tutoring-app/src/components/dashboard/`**:

```typescript
// Fetch subjects filtered by student's grade
const { data: subjects } = useQuery(['subjects', userProfile.grade_level], () =>
  api.get(`/curriculum/subjects?grade=${userProfile.grade_level}`)
);
```

#### 4.2 Update Grade Preferences

**`UserPreferencesModule.tsx`**: Use canonical grade codes. When grade changes, refetch available subjects.

---

## Migration Plan

### Step 1: Add grade field alongside grade_level (non-breaking)

- Add `grade` column to BigQuery subjects table
- Backfill from `grade_level` using mapping (`"Kindergarten"` → `"K"`, `"1st Grade"` → `"1"`)
- Both fields coexist during migration

### Step 2: Generate new subject_ids

- For existing subjects, create new IDs: `MATHEMATICS` → `K_MATHEMATICS`
- Update all child records (units, skills, subskills) to reference new subject_id
- Re-deploy to Firestore with new doc keys

### Step 3: Update services to use new field

- Switch authoring service models from `grade_level` to `grade`
- Switch backend services
- Update frontends

### Step 4: Remove old field

- Drop `grade_level` column from BigQuery
- Remove old Firestore documents with legacy keys
- Remove all `grade_level` references from code

---

## Scope & Prioritization

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| Phase 1: Schema & Authoring | Medium | Foundation for everything | P0 |
| Phase 2: Backend Services | Medium | Enables grade filtering | P0 |
| Phase 3: Authoring Frontend | Small | Better authoring UX | P1 |
| Phase 4: Tutoring Frontend | Small | Student sees right content | P1 |
| Migration | Medium | Existing data compat | P0 (with Phase 1) |

## Risks

1. **Existing subskill IDs**: Current Math subskill IDs (`COUNT001-01-A`) don't encode grade. Language Arts IDs (`LANGUAGE_ARTS-U1759...`) encode subject but not grade. If two grades share the same subskill_id format, there could be collisions.
   - **Mitigation**: Subskill IDs are generated within a subject scope. Since subject_ids become grade-unique (`K_MATHEMATICS` vs `3_MATHEMATICS`), their child IDs will be generated independently.

2. **Cosmos DB cache keys**: Already use `subject:grade:subskill` format (lines 1511, 1582 in `cosmos_db.py`). These will continue to work since grade is already part of the key.

3. **BigQuery analytics views**: Any existing dashboards querying by `subject = 'Mathematics'` will need updating to handle `K_MATHEMATICS` vs `3_MATHEMATICS`, or query by `subject_name` instead.

## Success Criteria

- [ ] Can create "Kindergarten Mathematics" and "3rd Grade Mathematics" as separate subjects
- [ ] Firestore has distinct documents per grade+subject
- [ ] `/curriculum/subjects?grade=K` returns only Kindergarten subjects
- [ ] Student with `grade: "K"` only sees Kindergarten content in dashboard
- [ ] No hardcoded `"Kindergarten"` or `"Elementary"` anywhere in backend
- [ ] Single canonical grade format across all services
