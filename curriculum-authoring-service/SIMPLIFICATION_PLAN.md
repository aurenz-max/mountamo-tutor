# Curriculum Authoring Service — Simplification Plan

## The Problem

~15,000 lines of code, 51 files, 4 data layers (hierarchical Firestore, flat Firestore collections, BigQuery, graph cache) with no transactions keeping them in sync. Every mutation partially updates some subset of layers, and failures silently leave them diverged. Repair endpoints exist because the normal write path routinely breaks data integrity.

## The Insight

**The backend tutoring service reads exactly 3 Firestore collections:**

| Collection | Purpose | Written By |
|------------|---------|-----------|
| `curriculum_published/{grade}/subjects/{id}` | Full curriculum hierarchy | `publish()` |
| `curriculum_graphs` | Flattened prerequisite DAG | `graph_cache_manager` |
| `curriculum_lineage` | Deprecated ID → canonical ID | `lineage_detector` + manual |

**Nothing reads:**
- Flat Firestore collections (`curriculum_subjects`, `curriculum_units`, `curriculum_skills`, `curriculum_subskills`, `curriculum_prerequisites`, `curriculum_edges`)
- BigQuery curriculum tables (`curriculum_subjects`, `curriculum_units`, `curriculum_skills`, `curriculum_subskills`, `curriculum_edges`, `curriculum_prerequisites`, `curriculum_versions`)
- The `curriculum_versions` flat collection (only the authoring service itself reads it)

These layers exist to sync data that nothing consumes. They are the source of every brittleness issue.

## The Raw Capabilities (What Actually Matters)

Strip away the accidental complexity, and the service does 6 things:

1. **Draft CRUD** — Read/write a single hierarchical Firestore doc per subject (`curriculum_drafts`)
2. **AI Authoring** — Gemini generates units/skills from PRD context → pending → accept/reject lifecycle
3. **Graph Editing** — Create/delete edges in `curriculum_graphs/{grade}/subjects/{id}/edges/` subcollection
4. **Publish** — Copy accepted units from draft → `curriculum_published`, strip authoring metadata, rebuild index
5. **Graph Caching** — Flatten edges into `curriculum_graphs` cache docs for backend consumption
6. **Lineage Tracking** — Detect removed subskill IDs at publish time, write mappings to `curriculum_lineage`

Everything else is sync scaffolding, repair tooling, or dead code.

---

## Phase -1: Fix the Grade Ambiguity (Do Before Everything Else)

### The Problem

When the system only had Kindergarten, `subject_id` alone was globally unique (`MATHEMATICS` = Kindergarten math). When Grade 1 was added, `MATHEMATICS` now exists under both `curriculum_published/K/subjects/` and `curriculum_published/1/subjects/`. But half the codebase still treats `subject_id` as globally unique.

This creates three problems:
1. **Scanning**: `resolve_grade(subject_id)` must scan every grade folder to find where a subject lives — O(n grades), cached in `_grade_cache` which is never invalidated
2. **Ambiguity**: If `MATHEMATICS` exists in grades K and 1, the scanner returns whichever it finds first
3. **Three conventions**: Firestore path uses grade as path segment, internal APIs sometimes pass grade and sometimes don't, flat graph cache encodes grade in doc ID (`MATHEMATICS_GK_latest_published`)

### The Fix

**`(grade, subject_id)` is always a required pair. No exceptions.**

#### Rule 1: Every endpoint takes `grade` as a required path or query parameter
```
# Before (ambiguous):
GET  /api/curriculum/subjects/{subject_id}/tree
POST /api/publishing/subjects/{subject_id}/publish

# After (explicit):
GET  /api/curriculum/{grade}/subjects/{subject_id}/tree
POST /api/publishing/{grade}/subjects/{subject_id}/publish
```

#### Rule 2: Every internal function takes `(grade, subject_id)` — never just `subject_id`
```python
# Before:
async def get_curriculum_tree(self, subject_id: str) -> dict:
    grade = await self.resolve_grade(subject_id)  # scan all grades!
    ...

# After:
async def get_curriculum_tree(self, grade: str, subject_id: str) -> dict:
    doc = self._client.collection("curriculum_drafts").document(grade) \
                      .collection("subjects").document(subject_id).get()
    ...
```

#### Rule 3: Kill `resolve_grade()` and `_grade_cache` entirely
These exist because some callers don't have `grade`. Once every caller passes `grade`, the scanner is dead code.

#### Rule 4: Graph cache doc IDs use `{subject_id}_{grade_prefix}` consistently
Already happening in `graph_flattening.py` — just make it the only pattern. No more bare `MATHEMATICS` cache keys.

#### Migration
- The Firestore data structure (`curriculum_published/{grade}/subjects/{subject_id}`) is already correct — no data migration needed
- Only code changes: add `grade` parameter to ~20 functions and ~15 endpoints
- Frontend callers already know the grade (it's in the URL or state) — just pass it through

---

## Phase 0: Data Safety (Do First, Before Any Code Changes)

### 0.1 — Snapshot current published data
```bash
# Export all curriculum_published docs as backup
python -c "
from firebase_admin import credentials, firestore, initialize_app
cred = credentials.Certificate('credentials/firebase-admin.json')
app = initialize_app(cred, name='backup')
db = firestore.client(app=app)
import json, datetime

class Encoder(json.JSONEncoder):
    def default(self, o):
        if hasattr(o, 'isoformat'): return o.isoformat()
        if hasattr(o, '__dict__'): return str(o)
        return super().default(o)

backup = {}
for grade_doc in db.collection('curriculum_published').stream():
    grade = grade_doc.id
    backup[grade] = {}
    for subj_doc in db.collection('curriculum_published').document(grade).collection('subjects').stream():
        backup[grade][subj_doc.id] = subj_doc.to_dict()
        print(f'  backed up {grade}/{subj_doc.id}')

with open(f'backup_published_{datetime.date.today()}.json', 'w') as f:
    json.dump(backup, f, cls=Encoder, indent=2)
print(f'Saved {sum(len(v) for v in backup.values())} subject docs')
"
```

### 0.2 — Snapshot current drafts
Same pattern for `curriculum_drafts`. These are your gold data — everything else is derived.

### 0.3 — Snapshot graph edges
Export `curriculum_graphs/{grade}/subjects/{id}/edges/` subcollections. These are hand-curated and hard to recreate.

**Rule: No code changes until backups are verified.**

---

## Phase 1: Kill Dead Layers (~2,500 lines removed)

### 1.1 — Remove BigQuery export pipeline

**Delete files:**
- `app/db/bigquery_export_service.py` (243 lines)
- `app/core/database.py` (231 lines)

**Remove from files:**
- `app/main.py` — remove BQ initialization (`db.initialize()`, `db.setup_all_tables()`)
- `app/api/publishing.py` — remove `/deploy-to-bigquery` endpoint, remove `/deploy/diagnostics` endpoint (reads BQ), remove `/deploy/repair` endpoint (fixes BQ)
- `app/services/curriculum_manager.py` — remove any BQ export calls
- `app/core/config.py` — remove BQ config vars (`BQ_PROJECT_ID`, `BQ_DATASET_ID`, all `TABLE_*`)

**Why safe:** Backend reads curriculum from Firestore, not BQ. BQ curriculum tables are write-only with no consumers. The `detailed_objectives`, `curriculum_subskill_foundations`, etc. tables in the *backend's* BQ are separate and unaffected.

**Lines removed: ~700**

### 1.2 — Deprecate flat Firestore collection sync (stop writing, keep data)

**The flat collections (`curriculum_subjects`, `curriculum_units`, `curriculum_skills`, `curriculum_subskills`, `curriculum_prerequisites`, `curriculum_edges`) may be used by downstream consumers outside this service.** We stop *writing* to them from the authoring service but do NOT delete the existing data from Firestore.

**Delete file:**
- `app/db/firestore_curriculum_service.py` (541 lines) — this writes to flat collections

**Remove from files:**
- `app/main.py` — remove `firestore_curriculum_sync` initialization
- `app/services/version_control.py` — remove `firestore_curriculum_sync.sync_publish()` and `sync_rollback()` calls. Publish just writes to the hierarchical doc (already done by `draft_curriculum_service.publish()`)
- `app/services/edge_manager.py` — change edge writes to go directly to subcollection via `firestore_reader` or a thin helper, not through `firestore_curriculum_sync`

**Why safe:** The backend tutoring service reads `curriculum_published` (hierarchical doc) and `curriculum_graphs` (cache docs), not flat collections. If other downstream consumers exist, the existing data in Firestore remains untouched — we just stop updating it. If a downstream consumer is later identified, we can add a lightweight post-publish hook to sync only the collections it needs.

**Migration note:** Add a `_deprecated` or `last_synced_at` field to flat collection docs so downstream consumers know the data may be stale. Log a deprecation warning if any reads hit these collections.

**Lines removed: ~600**

### 1.3 — Remove prerequisite flat collection + manager

**Delete file:**
- `app/services/prerequisite_manager.py` (212 lines) — reads/writes flat `curriculum_prerequisites` collection
- `app/api/prerequisites.py` (161 lines) — prerequisite endpoints that hit the flat collection

**Merge into edge system:**
- Prerequisites are just edges with `is_prerequisite: true`. The `edge_manager` already handles this. The flat `curriculum_prerequisites` collection is a second copy of what's in `curriculum_graphs/.../edges/`.

**Lines removed: ~370**

### 1.4 — Remove version_control flat collection

**Simplify:** Version info lives on the draft/published doc itself (`version_id`, `version_number`). Kill the separate `curriculum_versions` flat collection.

**Simplify `app/services/version_control.py`:**
- `create_version()` → just increment `version_number` on the draft doc
- `get_active_version()` → read from published doc
- `get_version_history()` → optional: keep a `versions[]` array on the draft doc, or drop entirely

**Remove from `app/api/publishing.py`:** `/versions`, `/active-version` endpoints that query the flat collection.

**Lines removed: ~200**

### 1.5 — Remove repair and migration endpoints/scripts

**Delete files:**
- `scripts/migrate_from_bigquery.py` (340 lines) — one-time migration, done
- `scripts/migrate_from_legacy.py` (313 lines) — one-time migration, done
- `scripts/migrate_edges.py` (135 lines) — one-time migration, done
- `scripts/reclassify_suggestions.py` (352 lines) — one-time migration, done
- `scripts/setup_database.py` (72 lines) — BQ setup, no longer needed
- `scripts/seed_prompt_templates.py` (67 lines) — one-time seed, done
- `check_prereq_versions.py` (33 lines) — version mismatch checker (problem goes away)

**Remove endpoints from `app/api/publishing.py`:**
- `/deploy/repair` — fixes BQ version mismatches (BQ gone)
- `/backfill-drafts` — re-creates drafts from published (one-time migration, done)
- `/flatten-all/{grade}` — bulk cache rebuild (keep `/regenerate` per-subject)

**Remove from `app/api/curriculum.py`:**
- `/repair-duplicate-units` — fixes duplicate units (caused by flat collection sync, which is gone)

**Lines removed: ~1,300**

### Phase 1 Total: ~3,170 lines removed, 8 files deleted, 4 endpoints removed

---

## Phase 2: Simplify Remaining Code (~2,000 lines simplified)

### 2.1 — Simplify `firestore_curriculum_reader.py` (744 → ~400 lines)

Currently reads from hierarchical docs AND falls back to flat collections. With flat collections gone:
- Remove all flat collection read paths
- Remove fallback scan logic (searching all grades when subject_id doesn't have a grade hint)
- Keep: `_get_subject_doc()`, `get_curriculum_tree()`, `get_flattened_view()`, `get_edges_for_subject()`, `get_suggestions_for_subject()`, `get_all_primitives()`
- Remove: `get_units_by_subject()` separate from tree (redundant), individual entity getters that scan flat collections

### 2.2 — Simplify `curriculum_manager.py` (505 → ~150 lines)

Currently orchestrates deploy to Firestore + BQ export + graph flattening. With BQ gone:
- `deploy_curriculum_to_firestore()` is the only method that matters
- Inline the graph flattening call into publish
- Most of this file becomes a thin wrapper around `draft_curriculum_service.publish()`

### 2.3 — Merge `version_control.py` into `draft_curriculum_service.py`

Version control is just "increment version_number on the doc and copy draft → published." This doesn't need its own service. The `publish()` method in `draft_curriculum_service.py` already does most of this.

### 2.4 — Simplify `graph_cache_manager.py` (335 → ~150 lines)

Remove the "try edges, fall back to prerequisites" chain. There's one source: `curriculum_graphs/.../edges/` subcollection. Flatten it and write to cache. That's it.

### 2.5 — Remove `ai_assistant.py` (236 lines)

Legacy AI endpoints. `authoring_service.py` supersedes all of it. Remove the file and redirect any remaining callers to `authoring_service`.

### 2.6 — Consolidate suggestion engines

Currently two:
- `suggestion_engine.py` (861 lines) — bulk, scans all entity pairs
- `scoped_suggestion_service.py` (776 lines) — lightweight, scoped to 2 skills

The bulk engine is expensive and rarely used. Keep `scoped_suggestion_service.py` as the primary. Either delete `suggestion_engine.py` or mark it as batch-only (not called from any endpoint by default).

### 2.7 — Simplify `main.py` startup

With BQ gone and flat sync gone, startup becomes:
1. Initialize Firestore client (one client, not two)
2. Initialize graph service (reads/writes `curriculum_graphs`)
3. Initialize authoring service (Gemini)
4. Mount routers

No more "try to init X, if it fails set to None, later check if None before calling." If Firestore is down, the app doesn't start. Period.

---

## Phase 3: Simplify the Publish Pipeline

### Current (7 steps, 3 layers, partial failures everywhere):
```
publish()
  → version_control.publish()
    → create version in curriculum_versions collection
    → firestore_curriculum_sync.sync_publish() (batch update flat collections)
    → sync_publish_edges() (update flat edge collection)
  → graph_cache_manager.regenerate_all_versions() (non-blocking)
  → curriculum_manager.deploy_curriculum_to_firestore()
    → write to curriculum_published
    → graph_flattening.rebuild_cache() (optional)
```

### Target (3 steps, 1 layer, atomic):
```
publish(subject_id)
  → draft_curriculum_service.publish()
    1. Read draft doc
    2. Validate lineage coverage (block if missing)
    3. Strip authoring metadata, filter to accepted units
    4. Write to curriculum_published/{grade}/subjects/{id}  (single Firestore write)
    5. Rebuild graph cache from edges subcollection → write to curriculum_graphs
    6. Done.
```

- No flat collection sync
- No BQ export
- No separate "deploy" step (publish IS deploy)
- No version_control service (version_number incremented on the doc)
- Graph cache rebuild is the only post-publish step, and it's fast (reads edges, writes one cache doc)

---

## Phase 4: Clean Up API Surface

### Current: 8 routers, ~40 endpoints
### Target: 4 routers, ~20 endpoints

#### Keep: `/api/curriculum/` (CRUD)
- `GET /grades` — static list
- `GET /subjects` — list subjects (from drafts + published)
- `GET /subjects/{id}/tree` — full curriculum tree
- `POST /subjects` — create subject
- `POST /units`, `PUT /units/{id}`, `DELETE /units/{id}` — unit CRUD
- `POST /skills`, `PUT /skills/{id}`, `DELETE /skills/{id}` — skill CRUD
- `POST /subskills`, `PUT /subskills/{id}`, `DELETE /subskills/{id}` — subskill CRUD
- `GET /primitives` — Lumina primitive catalog

#### Keep: `/api/publishing/` (Publish + Graph)
- `GET /subjects/{id}/draft-changes` — what will publish
- `POST /subjects/{id}/publish` — THE publish action (draft → published + graph cache)
- `POST /subjects/{id}/rollback/{version_id}` — rollback (optional, could cut)
- `GET /subjects/{id}/flattened-view` — debugging

#### Keep: `/api/ai/` (Authoring + Suggestions)
- `POST /author-subject` — ensure subject shell
- `POST /author-unit` — generate unit from PRD
- `POST /author-unit/accept` — accept preview
- `POST /author-unit/reject` — reject preview
- `POST /author-unit/regenerate` — regenerate with feedback
- `GET /author-previews/{id}` — list previews
- `POST /suggest-edges` — scoped edge suggestions
- `POST /connect-skills` — cross-skill connections
- `POST /suggest-edges/accept` — accept suggestions → create edges

#### Keep: `/api/lineage/` (Lineage)
- `POST /` — create lineage record
- `GET /` — list lineage records
- `GET /check/{subject_id}` — validate coverage

#### Kill:
- `/api/prerequisites/` — merged into edge system
- `/api/edges/` — merged into `/api/publishing/` or `/api/ai/`
- `/api/graph/` — graph queries folded into `/api/publishing/`
- `/api/agent/` — bulk suggestion engine, rarely used

---

## Projected Final State

### Files (from 51 → ~25):

```
app/
  main.py                              (~100 lines, down from 252)

  core/
    config.py                          (~40 lines, down from 76)
    security.py                        (138 lines, unchanged)

  db/
    firestore_client.py                (~80 lines, single Firestore client)
    draft_curriculum_service.py         (~600 lines, absorbs version_control)
    firestore_curriculum_reader.py      (~400 lines, down from 744)
    firestore_graph_service.py          (~300 lines, down from 500)

  api/
    curriculum.py                      (~400 lines, down from 538)
    publishing.py                      (~250 lines, down from 626)
    ai.py                              (~350 lines, roughly same)
    lineage.py                         (~200 lines, roughly same)

  services/
    authoring_service.py               (947 lines, unchanged — this is real business logic)
    edge_manager.py                    (~250 lines, down from 318)
    graph_cache_manager.py             (~150 lines, down from 335)
    graph_flattening.py                (~300 lines, down from 372)
    graph_analysis.py                  (451 lines, unchanged — real algorithms)
    scoped_suggestion_service.py       (776 lines, unchanged — real business logic)
    lineage_detector.py                (257 lines, unchanged — real business logic)

  models/
    curriculum.py                      (~200 lines, down from 282)
    authoring.py                       (188 lines, unchanged)
    edges.py                           (76 lines, unchanged)
    versioning.py                      (~40 lines, down from 76)
    grades.py                          (32 lines, unchanged)

  utils/
    llm_logger.py                      (321 lines, unchanged)
```

### Lines: ~15,000 → ~6,000 (60% reduction)
### Data layers: 4 → 1 (Firestore hierarchical docs + subcollections)
### Endpoints: ~40 → ~20
### Services initialized at startup: 8+ → 4
### Repair endpoints: 5 → 0

---

## Execution Order

| Step | Risk | Effort | Impact |
|------|------|--------|--------|
| Phase 0: Backups | None | 30 min | Safety net |
| Phase 1.1: Kill BQ export | None (no readers) | 1 hour | -700 lines, simpler startup |
| Phase 1.2: Kill flat Firestore sync | Low (verify no readers) | 2 hours | -600 lines, eliminates #1 brittleness source |
| Phase 1.3: Kill prerequisite flat collection | Low | 1 hour | -370 lines |
| Phase 1.5: Kill repair/migration scripts | None | 30 min | -1,300 lines |
| Phase 1.4: Simplify version control | Medium | 2 hours | -200 lines, simpler publish |
| Phase 2.1-2.7: Simplify remaining | Medium | 4 hours | -2,000 lines, cleaner code |
| Phase 3: Simplify publish pipeline | Medium | 3 hours | Atomic publish, no partial failures |
| Phase 4: Clean API surface | Low | 2 hours | Fewer endpoints to break |

**Total estimated effort: 2-3 focused sessions**

---

## What This Fixes

| Current Problem | Root Cause | How Simplification Fixes It |
|----------------|------------|---------------------------|
| Endpoints return stale/empty data | Multiple read paths, cache divergence | One read path: hierarchical Firestore doc |
| Publish partially fails | 7-step pipeline across 3 layers | 1 Firestore write + 1 cache rebuild |
| `author-previews` returns 0 for backfilled data | Different code paths write different schemas | One write path, one schema |
| Need repair endpoints | Flat sync creates version mismatches | No flat sync, no mismatches |
| BQ diagnostics show "missing" data | BQ lags behind Firestore | No BQ |
| Service won't start if BQ is down | BQ initialized at startup | No BQ dependency |
| Graph queries return inconsistent results | 3 graph readers with fallback chains | 1 graph source: edges subcollection |
