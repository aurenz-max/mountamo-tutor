# Curriculum Authoring Service

FastAPI microservice (port 8001) that owns curriculum structure and the knowledge graph. Defines **what** students learn; [Lumina](../my-tutoring-app/src/components/lumina/) handles **how**.

4-level hierarchy (Subject > Unit > Skill > Subskill), typed knowledge graph (5 relationship types), AI-powered authoring via Gemini, and draft/publish version control.

---

## Quick Reference

| Item | Value |
|------|-------|
| Port | `8001` |
| Base URL | `http://localhost:8001` |
| Framework | FastAPI 0.109.0 |
| Auth | Firebase Auth (Bearer token), disable with `DISABLE_AUTH=true` |
| Storage | Firestore (hierarchical documents + graph subcollections) |
| AI | Gemini (content generation, graph suggestions) |
| Grade codes | `PK`, `K`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12` |

### Subject ID Format

Subject IDs are bare enums scoped to grade via the Firestore collection path:

```
curriculum_drafts/{grade}/subjects/{subject_id}
```

Examples: `MATHEMATICS`, `LANGUAGE_ARTS`, `SCIENCE`, `SOCIAL_STUDIES`, `ABC123`, `ARTS`

The `grade` field (e.g. `"K"`, `"1"`) is stored on the subject and used as the Firestore partition key. Subject IDs do NOT embed the grade — the same ID could theoretically exist across grades.

### Entity ID Conventions

```
Unit:     {ABBREV}{NNN}          e.g. LA001, SCI003, OPS002
Skill:    {UNIT_ID}-{NN}        e.g. LA001-01, SCI003-02
Subskill: {SKILL_ID}-{LETTER}   e.g. LA001-01-A, SCI003-02-C
```

Subskill IDs always end with a letter suffix. Skill IDs never do. This matters when filtering graph anomalies — skill-level nodes are containers and will appear as orphans (expected).

---

## Curriculum Hierarchy

```
Subject  (e.g. "Language Arts", grade "1")
  +-- Unit  (e.g. LA001 "Phonological & Phonemic Awareness")
       +-- Skill  (e.g. LA001-01 "Phoneme Blending & Segmentation")
            +-- Subskill  (e.g. LA001-01-A "Segment a CVC word into three phonemes")
                 |-- difficulty_start / difficulty_end / target_difficulty (0-10 scale)
                 |-- target_primitive (Lumina primitive ID or "ai-tutor-session")
                 |-- target_eval_modes[] (curriculum-assigned eval modes, e.g. ["subitize", "build"])
                 |-- primitive_ids[] (assigned Lumina primitives)
                 |-- standards_alignment (e.g. "1.OA.1")
                 +-- knowledge graph edges
```

---

## Knowledge Graph

Subskills and skills are connected by typed directed edges. Only `is_prerequisite: true` edges enforce mastery gates; all types are traversable by Pulse BFS for discovery.

| Type | Meaning | Gate? | Pulse Use |
|------|---------|-------|-----------|
| `prerequisite` | Must master A before B | Yes (when `is_prerequisite: true`) | BFS discovery + unlock gating |
| `builds_on` | A extends into B conceptually | No | BFS discovery, affinity grouping |
| `reinforces` | Practicing A strengthens B | No | Review pairing, session variety |
| `parallel` | Peer concepts at similar difficulty | No | Cold-start breadth, subject interleaving |
| `applies` | Abstract A used in applied context B | No | Transfer assessment, contextual practice |

**Parallel edges** auto-create bidirectional pairs (A->B + B->A) linked by `pair_id`. Do not manually create reverse edges.

### Edge Data Model

```json
{
  "source_entity_id": "LA001-01-A",
  "source_entity_type": "subskill",
  "target_entity_id": "LA001-02-B",
  "target_entity_type": "subskill",
  "relationship": "builds_on",
  "strength": 0.8,
  "is_prerequisite": false,
  "min_proficiency_threshold": 0.8,
  "rationale": "Blending extends into segmentation fluency",
  "authored_by": "human",
  "confidence": null,
  "pair_id": null
}
```

- `strength` (0.0-1.0): Affinity signal for Pulse ranking. Higher = preferred in tiebreaking.
- `is_prerequisite` (bool): Only these enforce mastery gates. A `prerequisite` relationship defaults to `true`, all others default to `false`.
- `confidence` (float|null): Agent confidence score. Null for human-authored edges.
- `pair_id` (string|null): Links bidirectional parallel edges.

---

## Firestore Collections

### Hierarchical (source of truth)

```
curriculum_drafts/{grade}/subjects/{subject_id}
  -> Full hierarchical document: { curriculum[], subskill_index, stats }
  -> Unit entries may include authoring metadata: status, preview_id, lumina_coverage

curriculum_published/{grade}/subjects/{subject_id}
  -> Published snapshot (same schema as drafts, authoring metadata stripped)
  -> Read by: backend CurriculumService, LearningPathsService, PulseEngine, frontend

curriculum_graphs/{grade}/subjects/{subject_id}
  -> Graph metadata document
  |-- edges/{edge_id}              -- Individual edge documents
  +-- suggestions/{suggestion_id}  -- AI-generated edge suggestions (pending/accepted/rejected)

curriculum_lineage/{old_subskill_id}
  -> Maps deprecated subskill IDs to canonical successors
```

### Flat collections (legacy, read-only)

```
curriculum_versions    -- Version history (still written by version_control)
curriculum_primitives  -- Primitive catalog (read-only)
```

> The flat entity collections (`curriculum_subjects`, `curriculum_units`, `curriculum_skills`, `curriculum_subskills`, `curriculum_edges`, `curriculum_prerequisites`) are no longer written to. Existing data is preserved but may be stale.

### Grade Resolution

Write endpoints (POST/PUT/DELETE) require both `grade` and `subject_id` as explicit query parameters. This maps directly to the Firestore path `curriculum_drafts/{grade}/subjects/{subject_id}` and avoids silent misrouting.

Read endpoints resolve grade automatically by scanning `curriculum_drafts` and `curriculum_published` collections, then cache the mapping.

If grade and subject_id don't match, the API returns a 400 with a helpful hint: *"Grade mismatch: subject 'MATHEMATICS_G1' is grade '1', not grade 'K'. Did you mean: MATHEMATICS?"*

---

## Data Flow

```
Authoring Service (port 8001)
    |-- writes -> Firestore curriculum_drafts (source of truth)
    |   +-- subskills carry: target_primitive, target_eval_modes[], difficulty, etc.
    |-- on publish -> Firestore curriculum_published (snapshot)
    +-- on edge mutation -> Firestore curriculum_graphs/edges subcollection

Backend (port 8000) — JIT graph flattening
    |-- reads curriculum_published/{grade}/subjects/{subject_id} for nodes
    |-- reads curriculum_graphs/{grade}/subjects/{subject_id}/edges/ for edges
    |-- assembles flat {nodes, edges} format on first request (cached in-memory)
    +-- consumed by: LearningPathsService, PulseEngine, CurriculumService, Frontend
```

---

## API Reference

### 1. Curriculum CRUD -- `/api/curriculum`

#### Grades

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/curriculum/grades` | List all valid grade codes |

#### Subjects

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/curriculum/subjects` | `include_drafts?` | -- | List all subjects |
| `GET` | `/api/curriculum/subjects/{subject_id}` | -- | -- | Get one subject |
| `GET` | `/api/curriculum/subjects/{subject_id}/tree` | `include_drafts?` | -- | Full hierarchical tree |
| `POST` | `/api/curriculum/subjects` | -- | `SubjectCreate` | Create subject |
| `PUT` | `/api/curriculum/subjects/{subject_id}` | -- | `SubjectUpdate` | Update subject |

#### Units

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/curriculum/subjects/{subject_id}/units` | `include_drafts?` | -- | List units by subject |
| `GET` | `/api/curriculum/units/{unit_id}` | -- | -- | Get one unit |
| `POST` | `/api/curriculum/units` | **`grade`**, `subject_id` (in body) | `UnitCreate` | Create unit |
| `PUT` | `/api/curriculum/units/{unit_id}` | **`grade`**, **`subject_id`** | `UnitUpdate` | Update unit |
| `DELETE` | `/api/curriculum/units/{unit_id}` | **`grade`**, **`subject_id`** | -- | Delete unit |

#### Skills

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/curriculum/units/{unit_id}/skills` | `include_drafts?`, `subject_id?` | -- | List skills by unit |
| `GET` | `/api/curriculum/skills/{skill_id}` | -- | -- | Get one skill |
| `POST` | `/api/curriculum/skills` | **`grade`**, **`subject_id`** | `SkillCreate` | Create skill |
| `PUT` | `/api/curriculum/skills/{skill_id}` | **`grade`**, **`subject_id`** | `SkillUpdate` | Update skill |
| `DELETE` | `/api/curriculum/skills/{skill_id}` | **`grade`**, **`subject_id`** | -- | Delete skill |

#### Subskills

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/curriculum/skills/{skill_id}/subskills` | `include_drafts?`, `subject_id?` | -- | List subskills by skill |
| `GET` | `/api/curriculum/subskills/{subskill_id}` | -- | -- | Get one subskill |
| `POST` | `/api/curriculum/subskills` | **`grade`**, **`subject_id`** | `SubskillCreate` | Create subskill |
| `PUT` | `/api/curriculum/subskills/{subskill_id}` | **`grade`**, **`subject_id`** | `SubskillUpdate` | Update subskill |
| `DELETE` | `/api/curriculum/subskills/{subskill_id}` | **`grade`**, **`subject_id`** | -- | Delete subskill |

**SubskillUpdate body** (all fields optional):
```json
{
  "subskill_description": "...",
  "subskill_order": 1,
  "difficulty_start": 1.0,
  "difficulty_end": 5.0,
  "target_difficulty": 3.0,
  "target_primitive": "number-line",
  "target_eval_modes": ["plot", "jump"],
  "primitive_ids": ["number-line", "ten-frame"]
}
```

> **Required:** All write endpoints (POST/PUT/DELETE) require both `?grade=` and `?subject_id=`. The service validates the pair and returns a helpful error on mismatch. Example: `PUT /api/curriculum/subskills/{id}?grade=1&subject_id=MATHEMATICS_G1`

#### Primitives

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/curriculum/primitives` | -- | -- | List all primitives |
| `GET` | `/api/curriculum/primitives/categories/{category}` | -- | -- | Filter by category |
| `GET` | `/api/curriculum/subskills/{subskill_id}/primitives` | `subject_id` | -- | Get assigned primitives |
| `PUT` | `/api/curriculum/subskills/{subskill_id}/primitives` | **`grade`**, **`subject_id`** | `["prim-1", "prim-2"]` | Assign primitives |

---

### 2. AI Authoring -- `/api/ai`

#### PRD-Driven Unit Authoring

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/ai/author-subject` | `AuthorSubjectRequest` | Create/retrieve subject shell |
| `POST` | `/api/ai/author-unit` | `AuthorUnitRequest` | Generate unit from PRD -> pending in drafts |
| `POST` | `/api/ai/author-unit/accept` | `AcceptUnitRequest` | Accept pending -> accepted |
| `POST` | `/api/ai/author-unit/reject` | `RejectUnitRequest` | Reject with feedback |
| `POST` | `/api/ai/author-unit/regenerate` | `RegenerateUnitRequest` | Regenerate from rejection feedback |
| `GET` | `/api/ai/author-previews/{subject_id}` | query: `grade` (required) | List previews with status counts |

**AuthorSubjectRequest:**
```json
{
  "subject_id": "LANGUAGE_ARTS",
  "subject_name": "Language Arts",
  "grade": "1",
  "description": "First grade language arts curriculum"
}
```

**AuthorUnitRequest:**
```json
{
  "subject_id": "LANGUAGE_ARTS",
  "grade": "1",
  "unit_id": "LA001",
  "unit_title": "Phonological & Phonemic Awareness",
  "unit_description": "Foundation phonics skills for early readers",
  "unit_order": 1,
  "prd_context": "The unit MUST contain exactly these 3 skills:\n\n1. LA001-01: Rhyming (3 subskills) -- rhyme-builder\n...",
  "custom_instructions": "Skill descriptions = SHORT UI TITLES (1-4 words). Subskill descriptions use Focus/Examples/Constraints format.",
  "num_skills": 3,
  "num_subskills_per_skill": 4
}
```

> **Critical:** `prd_context` must explicitly list EVERY skill with subskill counts and primitive assignments. Do NOT let Gemini infer -- it will hallucinate primitives and invent IDs. Include valid primitive IDs from the Lumina catalog.

#### Skill-Level Generation

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/ai/generate-skill` | `GenerateSkillRequest` | Generate subskills for a single skill |

#### Scoped Edge Suggestions (Lightweight Graph Building)

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/ai/suggest-edges` | `ScopedSuggestionRequest` | 1-2 Gemini calls, scoped to specific skills |
| `POST` | `/api/ai/connect-skills` | `ConnectSkillsRequest` | Pairwise subskill connections (cross-grade OK) |
| `POST` | `/api/ai/suggest-edges/accept` | `AcceptScopedSuggestionsRequest` | Accept suggestions -> create draft edges |

**ScopedSuggestionRequest:**
```json
{
  "subject_id": "MATHEMATICS",
  "scope": {
    "skill_ids": ["OPS002-01", "OPS002-02"],
    "subskill_ids": [],
    "include_existing_graph": true,
    "cross_grade_subject_ids": []
  },
  "options": {
    "relationship_types": ["prerequisite", "builds_on", "reinforces", "parallel", "applies"],
    "max_suggestions": 10,
    "depth": "subskill"
  }
}
```

> **Gotcha:** Avoid passing >6 skill IDs at once -- too many subskills overflows Gemini context and causes truncated/missed suggestions. Use pairwise `connect-skills` instead.

**ConnectSkillsRequest:**
```json
{
  "source_skill_id": "OPS001-01",
  "source_subject_id": "MATHEMATICS",
  "target_skill_id": "OPS002-01",
  "target_subject_id": "MATHEMATICS",
  "relationship_types": ["prerequisite", "builds_on", "reinforces", "parallel", "applies"]
}
```

> **Important:** `connect-skills` creates PENDING SUGGESTIONS, not edges. You must accept them via `/api/ai/suggest-edges/accept` or `/api/agent/{subject_id}/suggestions/accept-all`.

---

### 3. Knowledge Graph Edges -- `/api/edges` and `/api/subjects`

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `POST` | `/api/edges` | `subject_id?` | `CurriculumEdgeCreate` | Create edge |
| `DELETE` | `/api/edges/{edge_id}` | `subject_id?` | -- | Delete edge |
| `GET` | `/api/edges/{entity_id}` | `entity_type`, `subject_id?`, `include_drafts?` | -- | Get edges for entity |
| `POST` | `/api/edges/validate` | `subject_id?` | `CurriculumEdgeCreate` | Validate without creating |
| `GET` | `/api/subjects/{subject_id}/knowledge-graph` | `include_drafts?` | -- | Full subject knowledge graph |
| `GET` | `/api/subjects/{subject_id}/base-skills` | -- | -- | Entry-point skills (no prerequisites) |

**Validation rules:**
- Prerequisite edges: cycle detection on prerequisite subgraph only
- Non-prerequisite edges: always valid (cycles OK in discovery graph)
- All edges: self-loop check, duplicate check
- Parallel edges auto-create bidirectional pair

---

### 4. Agentic Graph Analysis -- `/api/agent`

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/agent/{subject_id}/health` | -- | -- | Graph health report (authoritative) |
| `POST` | `/api/agent/{subject_id}/suggest` | `max_suggestions?` | -- | Gemini-powered bulk suggestions |
| `GET` | `/api/agent/{subject_id}/suggestions` | `status?` | -- | List suggestions |
| `POST` | `/api/agent/{subject_id}/suggestions/accept-all` | -- | -- | Bulk accept all pending |
| `POST` | `/api/agent/{subject_id}/suggestions/{id}/accept` | -- | -- | Accept one |
| `POST` | `/api/agent/{subject_id}/suggestions/{id}/reject` | -- | -- | Reject one |
| `POST` | `/api/agent/{subject_id}/reclassify` | `dry_run?` | -- | Reclassify suggestions |
| `GET` | `/api/agent/{subject_id}/impact-preview` | -- | -- | Cumulative impact of pending suggestions |

**Health metric thresholds:**
| Metric | Healthy | Warning |
|--------|---------|---------|
| Edge density (edges/node) | >= 1.5 | < 1.0 = sparse |
| Connected components | < 5 | > 5 = fragmented |
| Cross-unit edge ratio | >= 10% | < 10% = isolated units |
| Avg BFS reach (5 hops) | >= 6 | < 6 = limited discovery |
| Dead-end ratio | < 20% | > 30% = many dead ends |
| Orphan count | 0 | > 0 = invisible to Pulse |

> **Expected orphans:** Skill-level nodes (IDs without letter suffix, e.g. `OPS001-01`) are containers and will always appear as orphans because `connect-skills` creates subskill-to-subskill edges only. Filter these out when reviewing anomalies.

---

### 5. Publishing -- `/api/publishing`

| Method | Path | Query Params | Body | Purpose |
|--------|------|-------------|------|---------|
| `GET` | `/api/publishing/subjects/{subject_id}/draft-changes` | -- | -- | View pending changes |
| `POST` | `/api/publishing/subjects/{subject_id}/publish` | -- | `PublishRequest?` | Publish + deploy (single action) |
| `GET` | `/api/publishing/subjects/{subject_id}/versions` | -- | -- | Version history |
| `GET` | `/api/publishing/subjects/{subject_id}/active-version` | -- | -- | Current active version |
| `POST` | `/api/publishing/subjects/{subject_id}/rollback/{version_id}` | -- | -- | Rollback to prior version |
| `GET` | `/api/publishing/subjects/{subject_id}/flattened-view` | `version_id?` | -- | Get flattened curriculum |
| `POST` | `/api/publishing/subjects/{subject_id}/flatten` | `published_only?` | -- | Manually rebuild flat graph cache |
| `GET` | `/api/publishing/subjects/{subject_id}/flatten/preview` | `published_only?` | -- | Preview flattened graph |

**Publish** is a single atomic action that:
1. Creates a new version record
2. Publishes graph edges (sets `is_draft=false`)
3. Copies draft -> `curriculum_published` (lineage-validated, accepted units only)

No separate "deploy" step is needed. The backend JIT-flattens the graph on first read from the hierarchical collections.

**PublishRequest (optional body):**
```json
{
  "version_description": "Added geometry unit",
  "change_summary": "3 units, 12 skills, 48 subskills added"
}
```

---

### 6. Graph Cache -- `/api/graph`

| Method | Path | Query Params | Purpose |
|--------|------|-------------|---------|
| `GET` | `/api/graph/{subject_id}` | `include_drafts?`, `force_refresh?` | Get cached graph |
| `POST` | `/api/graph/{subject_id}/regenerate` | `include_drafts?` | Regenerate cache |
| `POST` | `/api/graph/{subject_id}/regenerate-all` | -- | Regenerate draft + published |
| `DELETE` | `/api/graph/{subject_id}/cache` | `version_type?` | Invalidate cache |
| `GET` | `/api/graph/{subject_id}/status` | -- | Cache freshness |
| `GET` | `/api/graph/cache/list` | -- | All cached subjects |
| `GET` | `/api/graph/cache/list-all` | -- | All cached graphs with metadata |

---

### 7. Curriculum Lineage -- `/api/lineage`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/lineage/` | `LineageRecord` | Create lineage mapping (old ID -> canonical IDs) |
| `GET` | `/api/lineage/` | -- | List all lineage records |
| `GET` | `/api/lineage/check/{subject_id}` | -- | Validate lineage coverage before publish |

---

## Common Workflows

### Workflow A: Author a New Subject

```
1. POST /api/ai/author-subject          -> Create subject shell
2. POST /api/ai/author-unit             -> Generate unit (pending in drafts)
3. GET  /api/ai/author-previews/{id}    -> Review what was generated
4. POST /api/ai/author-unit/accept      -> Accept unit (or reject + regenerate)
5. Repeat steps 2-4 for each unit
6. POST /api/publishing/.../publish     -> Publish, deploy, and flatten in one step
```

### Workflow B: Build Knowledge Graph

```
1. POST /api/ai/connect-skills          -> Pairwise subskill connections (repeat per skill pair)
2. POST /api/agent/{id}/suggestions/accept-all  -> Bulk-accept all pending -> draft edges
3. GET  /api/agent/{id}/health          -> Check health metrics
4. If density < 1.5, run more connect-skills pairs
5. POST /api/publishing/.../publish     -> Publish edges + flatten graph
```

> **Prefer pairwise `connect-skills` over bulk `suggest-edges`** -- bulk dumps too many subskills into one LLM call, causing output truncation and missed cross-unit connections. Use `connect-skills` between specific skill pairs for reliable results.

### Workflow C: Audit Primitive Coverage (used by `/curriculum-lumina-audit`)

```
1. GET  /api/ai/author-previews/{subject_id}?grade={grade}  -> Pull all subskills
2. Read Lumina catalog files from my-tutoring-app/.../catalog/
3. Classify each subskill (GREEN/YELLOW/RED/PURPLE/BLUE) + check eval mode coverage
4. PUT  /api/curriculum/subskills/{id}?grade={grade}&subject_id={subject_id}
   Body: {"target_primitive": "...", "target_eval_modes": ["mode1", "mode2"]}
5. POST /api/publishing/subjects/{subject_id}/publish
```

---

## Gotchas & Known Issues

### 1. Write endpoints require `grade` + `subject_id` (long-form grade!)

All POST/PUT/DELETE endpoints on units, skills, and subskills require both `grade` and `subject_id` as query parameters. This maps directly to the Firestore path and prevents silent misrouting.

**IMPORTANT:** Write endpoints require the **long-form** grade stored in Firestore (e.g. `Kindergarten`, `1st Grade`), not short codes (`K`, `1`). Read endpoints accept both forms via alias resolution, but writes use the grade string directly as the Firestore document ID. Using a short code on a write **silently creates a new document** at the wrong path instead of updating the existing one.

```
# CORRECT — long-form grade matches Firestore doc ID
PUT /api/curriculum/subskills/{id}?grade=Kindergarten&subject_id=MATHEMATICS
PUT /api/curriculum/subskills/{id}?grade=1st%20Grade&subject_id=MATHEMATICS_G1

# WRONG — silently writes to curriculum_drafts/K/... instead of curriculum_drafts/Kindergarten/...
PUT /api/curriculum/subskills/{id}?grade=K&subject_id=MATHEMATICS
```

> **TODO:** Fix `draft_curriculum_service._ref()` to call `normalise_grade()` so writes accept short codes too. See the TODO in that method.

### 2. `connect-skills` creates suggestions, not edges

The `/api/ai/connect-skills` endpoint creates pending suggestions in Firestore. To convert them to draft edges, you must explicitly accept:

```
POST /api/agent/{subject_id}/suggestions/accept-all
```

### 3. Gemini output truncation

When `prd_context` is vague, Gemini will hallucinate primitive names ("phantom primitives"). Always include valid primitive IDs from the Lumina catalog in the `prd_context` field. Keep `num_skills * num_subskills_per_skill` reasonable -- very large units may hit output token limits.

### 4. Skill-level orphans are expected

`connect-skills` creates subskill-to-subskill edges. Skill-level nodes (e.g. `OPS001-01`) will always appear as orphans in health reports. Filter them out when assessing graph quality -- orphan subskills (IDs with letter suffix) are the real concern.

### 5. Cycle detection is prerequisite-only

Non-prerequisite edges (builds_on, reinforces, parallel, applies) may form cycles. This is by design -- only the prerequisite subgraph must be a DAG.

### 6. Grade is required on authoring endpoints

The `author-unit`, `accept`, `reject`, and `regenerate` endpoints all require `grade` in the request body (not just `subject_id`). Missing it causes a 422 validation error.

### 7. `target_eval_modes` constrains Pulse eval mode selection

`target_eval_modes` is an optional `List[str]` on each subskill. When set, the Pulse engine's `select_best_mode()` only considers modes in that list (IRT-optimal within the constrained set). When absent/null, Pulse searches all modes for the primitive (unconstrained IRT -- may pick a pedagogically wrong mode).

```
["subitize"]               -> locked to subitize mode
["subitize", "build"]      -> IRT picks best of those two per session
null / absent              -> IRT searches all modes (assessment use case)
```

---

## Services Architecture

| Service | File | Purpose |
|---------|------|---------|
| `CurriculumManager` | `services/curriculum_manager.py` | Hierarchy CRUD, tree/flatten views, primitive assignment |
| `EdgeManager` | `services/edge_manager.py` | Edge CRUD, validation (cycle check), parallel auto-reversal |
| `AuthoringService` | `services/authoring_service.py` | PRD-driven Gemini authoring, preview lifecycle |
| `ScopedSuggestionService` | `services/scoped_suggestion_service.py` | Lightweight scoped edge suggestions (1-2 Gemini calls) |
| `GraphAnalysisEngine` | `services/graph_analysis.py` | Pure structural analysis: health metrics, anomalies, impact |
| `SuggestionEngine` | `services/suggestion_engine.py` | Bulk Gemini pipeline: embeddings + LLM refinement |
| `CurriculumGraphAgentService` | `services/graph_agent.py` | Orchestrator: health reports, suggestion workflow, event hooks |
| `GraphCacheManager` | `services/graph_cache_manager.py` | Firestore caching of knowledge graphs |
| `GraphFlattening` | `services/graph_flattening.py` | Flatten hierarchical graph to flat cache for Pulse/LearningPaths |
| `VersionControl` | `services/version_control.py` | Draft/publish lifecycle, version history |

### Database Layer

| Service | File | Purpose |
|---------|------|---------|
| `DraftCurriculumService` | `db/draft_curriculum_service.py` | Hierarchical doc CRUD for `curriculum_drafts`, publish to `curriculum_published` |
| `FirestoreCurriculumSync` | `db/firestore_curriculum_service.py` | Firestore client + graph subcollection writes (edges, suggestions) |
| `FirestoreCurriculumReader` | `db/firestore_curriculum_reader.py` | Read from drafts/published, grade resolution cache |
| `FirestoreGraphService` | `db/firestore_graph_service.py` | Graph docs, edge subcollections, deploy to `curriculum_published` |

---

## Code Structure

```
app/
|-- api/
|   |-- curriculum.py       # Hierarchy CRUD (subjects, units, skills, subskills, primitives)
|   |-- ai.py               # AI authoring + scoped edge suggestions
|   |-- edges.py            # Knowledge graph edge CRUD
|   |-- agent.py            # Agentic graph analysis (health, suggest, accept/reject)
|   |-- publishing.py       # Publish + flatten
|   |-- graph.py            # Graph cache management
|   +-- lineage.py          # Curriculum lineage endpoints
|-- core/
|   |-- config.py           # Environment config
|   +-- security.py         # Firebase auth
|-- db/
|   |-- draft_curriculum_service.py      # Hierarchical Firestore CRUD + publish
|   |-- firestore_curriculum_service.py  # Firestore client + graph writes
|   |-- firestore_curriculum_reader.py   # Read + grade resolution
|   +-- firestore_graph_service.py       # Graph docs + deployment
|-- models/
|   |-- curriculum.py           # Subject, Unit, Skill, Subskill, CurriculumTree, FlattenedRow
|   |-- edges.py                # CurriculumEdge, EntityEdges, CurriculumGraph, enums
|   |-- authoring.py            # AuthorUnit/Skill requests, UnitPreview, LuminaCoverage
|   |-- scoped_suggestions.py   # ScopedSuggestion/ConnectSkills requests/responses
|   |-- suggestions.py          # GraphHealthReport, EdgeSuggestion, anomalies
|   |-- versioning.py           # Version, DraftSummary, PublishRequest/Response
|   |-- grades.py               # GRADE_CODES, GRADE_LABELS, validate_grade()
|   +-- prerequisites.py        # Legacy prerequisite models (used by graph cache)
|-- services/
|   |-- curriculum_manager.py          # Hierarchy CRUD
|   |-- edge_manager.py                # Edge CRUD + validation
|   |-- authoring_service.py           # PRD-driven Gemini authoring
|   |-- scoped_suggestion_service.py   # Lightweight edge suggestions
|   |-- graph_analysis.py              # Structural health analysis
|   |-- suggestion_engine.py           # Bulk Gemini suggestion pipeline
|   |-- graph_agent.py                 # Agent orchestrator
|   |-- graph_cache_manager.py         # Graph caching
|   |-- graph_flattening.py            # Graph flattening
|   |-- version_control.py             # Draft/publish lifecycle
|   +-- lineage_detector.py            # Auto-detect lineage changes at publish
+-- utils/         # LLM logging
docs/              # Architecture docs, PRDs
```

---

## Getting Started

### Requirements

- Python 3.9+
- Google Cloud credentials (Firestore)
- Firebase project for authentication
- Gemini API key for AI features

### Installation

```bash
pip install -r requirements.txt
cp .env.example .env   # edit with your credentials
uvicorn app.main:app --reload --port 8001
```

### Environment Variables

**Required:**
```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
FIREBASE_PROJECT_ID=your-firebase-project
GEMINI_API_KEY=your-gemini-api-key
```

**Optional:**
```
GEMINI_MODEL=gemini-3-flash-preview    # default model
GEMINI_TEMPERATURE=0.7                  # generation temperature
LOG_LEVEL=INFO                          # logging level
ALLOWED_ORIGINS=http://localhost:3000   # CORS origins
DISABLE_AUTH=false                      # disable Firebase auth (dev only)
```

---

## Current State

| Grade | Subjects | Status |
|-------|----------|--------|
| K (Kindergarten) | ABC123, Language Arts, Mathematics, Science, Social Studies, Arts | ~805 subskills |
| 1 (First Grade) | Language Arts, Mathematics, Science, Social Studies | ~496 subskills |
| 2-12 | -- | Not yet authored |
