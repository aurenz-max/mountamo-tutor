# Curriculum Authoring Service — Simplification Handoff

**Date:** 2026-03-31
**Context:** Implementing `SIMPLIFICATION_PLAN.md` Phase -1 (grade ambiguity fix)

---

## What Was Done

### 1. Startup fix — `extra="ignore"` in config
**File:** `app/core/config.py`
- Added `extra="ignore"` to `SettingsConfigDict` so removed env vars (like `bigquery_dataset_id`) don't crash startup.

### 2. Firestore migration — dropped `_G1` suffix from Grade 1 subject_ids
**Script:** `scripts/migrate_g1_subjects.py`
**Backup:** `backup_g1_migration_2026-03-31.json`

Renamed all Grade 1 subject docs across 3 collections:

| Before | After |
|--------|-------|
| `curriculum_drafts/1/subjects/MATHEMATICS_G1` | `curriculum_drafts/1/subjects/MATHEMATICS` |
| `curriculum_drafts/1/subjects/LANGUAGE_ARTS_G1` | `curriculum_drafts/1/subjects/LANGUAGE_ARTS` |
| `curriculum_drafts/1/subjects/SCIENCE_G1` | `curriculum_drafts/1/subjects/SCIENCE` |
| `curriculum_drafts/1/subjects/SOCIAL_STUDIES_G1` | `curriculum_drafts/1/subjects/SOCIAL_STUDIES` |

Same for `curriculum_published` and `curriculum_graphs` (including all edge/suggestion subcollections — ~2,200 docs copied).

Old `_G1` docs and stale flat graph cache docs (`MATHEMATICS_G1_latest_published`, etc.) were deleted. The `subject_id` field inside each doc was updated to the bare name.

**Design principle:** `(grade, subject_id)` is the compound key. Grade comes from the Firestore path segment (e.g. `1`, `Kindergarten`). Subject_id is grade-agnostic (e.g. `MATHEMATICS`). The grade field inside the doc should match the path segment.

### 3. Reader rewrite — `firestore_curriculum_reader.py`
**File:** `app/db/firestore_curriculum_reader.py` — **COMPLETE**

Fully rewritten. All public methods now require `(grade, subject_id)` as the first two params. Removed:
- `_grade_cache` dict
- `resolve_grade()` scanner
- `set_grade_cache()`
- All scan-all-grades fallback paths

### 4. API routers — grade added to all endpoints
**Files updated (ALL COMPLETE):**
- `app/api/curriculum.py` — all 9 read endpoints now require `grade` query param
- `app/api/publishing.py` — all 8 endpoints now require `grade` query param
- `app/api/graph.py` — all 5 subject endpoints now require `grade` query param
- `app/api/edges.py` — all 6 endpoints now require `grade` and `subject_id`
- `app/api/lineage.py` — `GET /check/{subject_id}` now requires `grade`

### 5. Graph flattening — stopped constructing `_G1` subject_ids
**File:** `app/services/graph_flattening.py`
- Strips legacy `_G1`/`_GK` suffix if present on incoming subject_id
- `subject_id` field in flat cache docs is now the bare name (e.g. `MATHEMATICS`)
- Doc ID still includes grade prefix for uniqueness (e.g. `MATHEMATICS_GK_latest_published`)

---

## What Still Needs to Be Done

### A. Thread `grade` through `curriculum_manager.py` (BLOCKING — service won't compile)

**File:** `app/services/curriculum_manager.py`

The API routers now call `curriculum_manager.get_subject(grade, subject_id)` etc., but the manager methods still have the old signatures (just `subject_id`). Every method that calls `firestore_reader` needs `grade` added as the first param and passed through.

Methods to update (match new reader signatures):
```python
# These all need grade as first param:
get_subject(grade, subject_id)
get_curriculum_tree(grade, subject_id, include_drafts)
get_units_by_subject(grade, subject_id, include_drafts)
get_unit(grade, subject_id, unit_id)
get_skills_by_unit(grade, subject_id, unit_id, include_drafts)
get_skill(grade, subject_id, skill_id)
get_subskills_by_skill(grade, subject_id, skill_id, include_drafts)
get_subskill(grade, subject_id, subskill_id)
get_flattened_curriculum_view(grade, subject_id, version_id=None)
get_subskill_primitives(grade, subject_id, subskill_id)
update_subskill_primitives(grade, subject_id, subskill_id, primitive_ids)
deploy_curriculum_to_firestore(grade, subject_id, ...)
```

### B. Thread `grade` through `version_control.py`

**File:** `app/services/version_control.py`

`publishing.py` now passes `grade=grade` to version_control methods. Update signatures:
- `get_draft_changes(grade, subject_id)`
- `get_version_history(grade, subject_id)`
- `get_active_version(grade, subject_id)`
- `rollback_to_version(grade, subject_id, version_id)`

### C. Thread `grade` through `graph_cache_manager.py`

**File:** `app/services/graph_cache_manager.py`

`graph.py` now passes `grade` to graph_cache_manager methods. Update:
- `get_graph(grade, subject_id, ...)`
- `regenerate_graph(grade, subject_id, ...)`
- `regenerate_all_versions(grade, subject_id)`
- `invalidate_cache(grade, subject_id, ...)`
- `get_cache_status(grade, subject_id)`

### D. Thread `grade` through `edge_manager.py`

**File:** `app/services/edge_manager.py`

The edges agent partially updated this (added `grade` as optional kwarg). Make it required and remove any remaining `resolve_grade()` calls.

### E. Thread `grade` through remaining services

- `app/services/scoped_suggestion_service.py` — uses reader methods, needs grade
- `app/services/authoring_service.py` — already uses grade for most calls
- `app/services/lineage_detector.py` — may call reader

### F. Remove `firestore_curriculum_service.py` dependency

**File:** `app/db/firestore_curriculum_service.py`

The reader still imports `firestore_curriculum_sync` from this file to get the Firestore client. Per the simplification plan (Phase 1.2), this file should be deleted. The reader should get the client from a simpler source (e.g. a shared `firestore_client.py`).

### G. Rebuild graph caches

After all code changes compile, rebuild the flat graph caches for all subjects:
```bash
# For each (grade, subject):
POST /api/graph/MATHEMATICS/regenerate?grade=Kindergarten
POST /api/graph/MATHEMATICS/regenerate?grade=1
# ... etc for all subjects
```

---

## How to Verify

1. `cd curriculum-authoring-service && uvicorn app.main:app --reload` — should start without errors
2. `GET /api/curriculum/subjects` — should return 8 subjects (4 per grade), all with bare names
3. `GET /api/curriculum/subjects/MATHEMATICS/tree?grade=Kindergarten` — should return K math (6 units)
4. `GET /api/curriculum/subjects/MATHEMATICS/tree?grade=1` — should return G1 math (5 units)
5. `POST /api/ai/generate-skill` with `grade=Kindergarten` — should hit Gemini and return generated skill

---

## Key Files Reference

| File | Status | Notes |
|------|--------|-------|
| `app/core/config.py` | DONE | `extra="ignore"` |
| `app/db/firestore_curriculum_reader.py` | DONE | All methods require (grade, subject_id) |
| `app/api/curriculum.py` | DONE | All endpoints have grade param |
| `app/api/publishing.py` | DONE | All endpoints have grade param |
| `app/api/graph.py` | DONE | All endpoints have grade param |
| `app/api/edges.py` | DONE | All endpoints have grade param |
| `app/api/lineage.py` | DONE | check endpoint has grade param |
| `app/api/ai.py` | Already had grade | No changes needed |
| `app/services/graph_flattening.py` | DONE | Strips _G1 suffix, bare subject_id in cache |
| `app/services/curriculum_manager.py` | **TODO** | Thread grade through all methods |
| `app/services/version_control.py` | **TODO** | Thread grade through all methods |
| `app/services/graph_cache_manager.py` | **TODO** | Thread grade through all methods |
| `app/services/edge_manager.py` | **PARTIAL** | Grade added as optional kwarg, make required |
| `app/services/scoped_suggestion_service.py` | **TODO** | Thread grade through |
| `scripts/migrate_g1_subjects.py` | DONE | Migration script (already executed) |

---

## Backup & Rollback

- **Firestore backup:** `backup_g1_migration_2026-03-31.json` in the service root
- **To rollback Firestore:** Restore `_G1` docs from the backup JSON (read JSON, write each doc back to its original path, delete bare-name docs under grade `1`)
- **To rollback code:** `git checkout -- .` on the service directory
