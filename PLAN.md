# Plan: Make Learning Paths Firestore-Native

## Problem
`LearningPathsService.get_unlocked_entities` (and related prerequisite methods) query BigQuery tables (`curriculum_prerequisites`, `attempts`, `curriculum`) that are updated nightly via ETL. This means unlock status is stale by up to 24 hours — students can master a skill but not see new content unlocked until the next day.

## Solution
Replace the BigQuery-dependent unlock pipeline with Firestore reads. All the data already exists in Firestore:
- **Prerequisite edges** → `curriculum_graphs` collection (nodes + edges with thresholds)
- **Student proficiency** → `students/{student_id}/competencies/` subcollection (current_score, updated in real-time)
- **Curriculum structure** → `curriculum_published/{grade}/subjects/{subject_id}` (hierarchy + subskill_index)

Add a new `students/{student_id}/learning_paths/{subject_id}` subcollection to cache computed unlock state and enable live updates when competencies change.

## Changes

### 1. FirestoreService — Add learning_paths subcollection + proficiency map helper
**File:** `backend/app/db/firestore_service.py`

Add:
- `_learning_paths_subcollection(student_id)` — reference helper
- `save_learning_path(student_id, subject_id, data)` — write cached unlock state
- `get_learning_path(student_id, subject_id)` — read cached unlock state
- `get_student_proficiency_map(student_id, subject)` — build a `{entity_id: {proficiency, attempt_count, last_updated}}` map from the competencies subcollection (replaces the BigQuery `get_student_proficiency_map`)

Document structure for `students/{student_id}/learning_paths/{subject_id}`:
```json
{
  "subject_id": "MATHEMATICS",
  "unlocked_entities": ["SKILL-001", "SKILL-002", "SUB-001-A", ...],
  "entity_statuses": {
    "SKILL-001": "MASTERED",
    "SKILL-002": "IN_PROGRESS",
    "SUB-001-A": "UNLOCKED",
    "SUB-002-B": "LOCKED"
  },
  "last_computed": "2026-02-27T...",
  "version_id": "v1.0"
}
```

### 2. LearningPathsService — Refactor core methods to Firestore
**File:** `backend/app/services/learning_paths.py`

**Remove** BigQuery client dependency (`self.client`, `self.executor`, `_run_query_async`). The service will only need `self.firestore` now.

**Refactor these methods:**

| Method | Current (BigQuery) | New (Firestore) |
|--------|-------------------|-----------------|
| `get_entity_proficiency` | Queries `attempts` table | Reads from `competencies` subcollection |
| `check_prerequisites_met` | Queries `curriculum_prerequisites` | Reads edges from `curriculum_graphs` + competencies |
| `get_unlocked_entities` | Massive CTE joining 3 BQ tables | Reads graph edges + competencies, computes in Python using existing `_determine_unlocked_nodes` logic |
| `get_entity_prerequisites` | Queries `curriculum_prerequisites` | Filters edges from `curriculum_graphs` |
| `get_entity_unlocks` | Queries `curriculum_prerequisites` | Filters edges from `curriculum_graphs` (reverse direction) |
| `get_learning_graph` | Queries `curriculum_prerequisites` + `curriculum` | Reads `curriculum_graphs` directly |
| `get_skill_with_subskills` | Queries `curriculum` table | Reads from `curriculum_published` subskill_index |
| `get_recommendations` | Massive CTE joining 3 BQ tables | Uses Firestore graph + competencies + curriculum_published |
| `get_graph_for_visualization` | Massive CTE | Uses Firestore graph + curriculum_published + competencies |
| `get_student_graph` | Graph from Firestore, proficiency from BQ | Both from Firestore (swap `analytics.get_student_proficiency_map` → `firestore.get_student_proficiency_map`) |

**Add new method:**
- `recalculate_unlocks(student_id, subject_id)` — Computes current unlock state from graph + competencies, writes to `learning_paths` subcollection, returns list of newly unlocked entities (for potential notifications)

### 3. Constructor simplification
**File:** `backend/app/services/learning_paths.py`

```python
def __init__(self, firestore_service, project_id):
    self.firestore = firestore_service
    self.project_id = project_id
    self.DEFAULT_MASTERY_THRESHOLD = 0.8
```

Remove `analytics_service`, `dataset_id`, `bigquery.Client`, `ThreadPoolExecutor`.

### 4. Dependency injection update
**File:** `backend/app/dependencies.py`

Update `get_learning_paths_service()` to no longer require `BigQueryAnalyticsService`:
```python
async def get_learning_paths_service(
    firestore_service: FirestoreService = Depends(get_firestore_service)
) -> LearningPathsService:
    ...
    _learning_paths_service = LearningPathsService(
        firestore_service=firestore_service,
        project_id=settings.GCP_PROJECT_ID
    )
```

### 5. Health check update
**File:** `backend/app/services/learning_paths.py`

`health_check()` currently does a BigQuery dry-run query. Replace with a Firestore connectivity check (e.g., read a curriculum_graphs doc).

### 6. Test updates
**File:** `backend/tests/test_learning_paths.py`

Update mocks to match new Firestore-based implementation (no more `_run_query_async` mocks).

## Implementation Strategy
- Methods that already have pure-Python equivalents (`_build_prerequisites_map`, `_determine_unlocked_nodes`) are reused as-is
- Graph data is cached at the service level per-subject since curriculum graphs change infrequently
- The `recalculate_unlocks` method is the key new capability — call it after every competency update for instant unlock propagation

## Out of Scope (follow-up)
- Triggering `recalculate_unlocks` automatically from the competency update flow (can be wired in separately)
- Removing BigQuery `curriculum_prerequisites` table (keep for analytics/reporting)
- Frontend changes (API contract stays the same)
