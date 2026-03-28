# Curriculum Skill Context

Additional context for the `/curriculum` and `/curriculum-graph` Claude Code skills. This document captures domain knowledge, conventions, and architectural decisions that are not obvious from reading code alone.

---

## 1. Curriculum Data Model

The curriculum follows a strict 4-level hierarchy:

```
Subject > Unit > Skill > Subskill
```

Each level has a corresponding Pydantic model in `app/models/curriculum.py` and a BigQuery table.

### ID Conventions

IDs encode the hierarchy position using a prefix-number-suffix pattern:

| Level    | Format          | Example        |
|----------|-----------------|----------------|
| Unit     | `PREFIX###`     | `COUNT001`     |
| Skill    | `PREFIX###-##`  | `COUNT001-01`  |
| Subskill | `PREFIX###-##-X`| `COUNT001-01-A`|

The prefix encodes the subject/domain (see Section 9 for the full prefix table). The numeric suffix is zero-padded. Subskill suffixes use uppercase letters (A-Z).

### Difficulty Ranges

Every subskill carries three difficulty fields on a 1-10 scale:

- `difficulty_start` -- the lowest difficulty at which this subskill can be assessed
- `difficulty_end` -- the highest difficulty
- `target_difficulty` -- the sweet spot for initial instruction

Typical ranges by grade band: K-2 uses 1-5, grades 3-5 use 1-7, grades 6-12 use 1-10.

### Subject Naming

Display names and Firestore/BigQuery IDs differ:

| Display Name     | Firestore/BQ ID   |
|------------------|--------------------|
| Mathematics      | MATHEMATICS        |
| Language Arts    | LANGUAGE_ARTS      |
| Science          | SCIENCE            |
| Social Studies   | SOCIAL_STUDIES     |
| Arts             | ARTS               |
| ABC123           | ABC123             |

The `subject_id` field in models uses the uppercase form. The `subject_name` field holds the display name. API endpoints accept either form where sensible.

---

## 2. Current Curriculum Inventory

### Kindergarten -- 805 subskills across 6 subjects

| Subject        | Subskills | Units                                                                          |
|----------------|-----------|--------------------------------------------------------------------------------|
| ABC123         | 35        | ALPHA001 (Alphabet Recognition), NUM001 (Number Recognition)                   |
| Language Arts  | 222       | LA001-LA007 (Reading Foundations, Writing, Speaking/Listening, Grammar, Vocabulary, Reading Comprehension, Creative Expression) |
| Mathematics    | 166       | COUNT001, GEOM001, MEAS001, OPS001, PTRN001, TIME001                          |
| Arts           | 134       | ART001-ART003 (Visual Arts, Music, Drama)                                      |
| Science        | 88        | SCI001-SCI004 (Physical, Life, Earth/Space, Engineering)                       |
| Social Studies | 159       | SS001-SS005 (Civics, Economics, Geography, History, Culture)                   |

### First Grade -- ~496 subskills across 4 subjects

| Subject        | Subskills | Units                                                    |
|----------------|-----------|----------------------------------------------------------|
| Language Arts  | 150       | LA001-LA007                                              |
| Mathematics    | 115       | OPS001, NBT001, MEAS001, GEOM001, PTRN001               |
| Science        | 119       | SCI001-SCI004                                            |
| Social Studies | 112       | SS001-SS005                                              |

### Grades 2-12

Not yet authored. The authoring service and data model support arbitrary grades; no code changes are needed to add them.

---

## 3. Knowledge Graph Structure

The knowledge graph connects skills and subskills with typed, weighted edges. Edge definitions live in `app/models/edges.py`.

### Edge Types

| Relationship  | Purpose                                        | Gates? |
|---------------|------------------------------------------------|--------|
| `prerequisite`| A must be mastered before B                    | Yes (if `is_prerequisite=True`) |
| `builds_on`   | B extends A's concepts                         | No (unless `is_prerequisite=True`) |
| `reinforces`  | Practicing A strengthens B (review pairing)    | No     |
| `parallel`    | A and B are peers at similar difficulty         | No     |
| `applies`     | A is abstract, B is applied context (transfer) | No     |

### Edge Model Fields

```
source_entity_id      -- ID of the source skill or subskill
source_entity_type    -- "skill" or "subskill"
target_entity_id      -- ID of the target skill or subskill
target_entity_type    -- "skill" or "subskill"
relationship          -- one of the 5 types above
strength              -- float 0-1, influences Pulse item ranking
is_prerequisite       -- bool, only True edges enforce mastery gates
min_proficiency_threshold -- float 0-1, proficiency required to pass gate (default 0.8)
rationale             -- human-readable justification
authored_by           -- "human" or "agent"
confidence            -- float 0-1, agent confidence (null for human-authored)
pair_id               -- links reverse edges for parallel relationships
```

### Key Rules

- Only edges with `is_prerequisite=True` enforce mastery gates in the backend.
- All five edge types are traversable by Pulse for BFS discovery.
- `parallel` edges auto-create a reverse edge (linked by `pair_id`) so the relationship is bidirectional.
- Edges are polymorphic: they connect skills AND subskills (not entity-type-specific).
- Cycle detection runs only on the prerequisite subgraph. Non-prerequisite edges may form cycles.

---

## 4. Data Storage Architecture

### BigQuery (source of truth)

All authored content -- subjects, units, skills, subskills, edges, versions, primitives, and associations -- is stored in BigQuery tables. The authoring service writes here first.

### Firestore (read cache)

Firestore is a dual-write cache. Every BigQuery write is followed by a Firestore sync call. Firestore failures are logged but never propagated -- BigQuery remains authoritative.

**Entity collections** (from `FirestoreCurriculumSync`):
```
curriculum_subjects/{subject_id}
curriculum_units/{unit_id}
curriculum_skills/{skill_id}
curriculum_subskills/{subskill_id}
curriculum_prerequisites/{prerequisite_id}
curriculum_versions/{version_id}
curriculum_primitives/{primitive_id}
curriculum_subskill_primitives/{subskill_id}_{primitive_id}
```

**Published curriculum** (from `CurriculumFirestore`):
```
curriculum_published/{grade}/subjects/{subject_id}    -- denormalized published tree
curriculum_graphs/{subject_id}/versions/{version_id}  -- cached graph snapshot
```

**Suggestion pipeline state:**
```
suggestion_runs/{subject_id}  -- checkpoint data for resumable pipeline
```

### Local CSV Files

Source CSVs used for initial data seeding:

- `backend/data/kindergarten/syllabus.csv` -- combined kindergarten syllabus
- `backend/data/first-grade/*.csv` -- per-subject first grade syllabi
- Individual subject CSVs in `backend/data/` (e.g., `math_refactored-syllabus.csv`)

### Decision Trees

- `backend/data/*_decision_tree.json` -- skill-to-skill progression maps
- `backend/data/subskill-paths.json` -- subskill-level prerequisite paths

---

## 5. Data Flow

### Write Path (authoring)

```
Author action
  -> CurriculumManager / EdgeManager (validation + BQ write)
  -> FirestoreCurriculumSync (dual-write cache)
```

### Publish Path

```
Publish command
  -> Version record created in BQ
  -> Denormalized tree written to Firestore curriculum_published
  -> Graph snapshot cached to Firestore curriculum_graphs
```

### Read Path (backend services)

```
CurriculumService     -- reads from Firestore (BigQuery fallback)
LearningPathsService  -- reads graph for prerequisite gating
PulseEngine           -- reads graph for adaptive session assembly
DAGAnalysisEngine     -- pure graph algorithms (topo sort, BFS reach, chain analysis)
```

### Frontend Read Path

```
Frontend -> Backend /api/curriculum/* endpoints (public router, no auth required) -> Firestore
```

---

## 6. Key Services Reference

### Authoring Service (this repo)

| Service                         | Role                                                    |
|---------------------------------|---------------------------------------------------------|
| `CurriculumManager`            | CRUD operations for subjects, units, skills, subskills  |
| `EdgeManager`                  | Knowledge graph edge CRUD, cycle detection, parallel edge handling |
| `GraphAnalysisEngine`          | Pure graph algorithms: health metrics, anomaly detection, impact projection |
| `SuggestionEngine`             | 5-phase Gemini-powered suggestion pipeline              |
| `CurriculumGraphAgentService`  | Agent orchestrator: ties analysis, suggestions, and approval workflow together |
| `GraphCacheManager`            | Manages graph snapshots in Firestore                    |
| `VersionControlService`        | Version tracking for published curriculum               |

### Backend (main app)

| Service                | Role                                                      |
|------------------------|-----------------------------------------------------------|
| `CurriculumService`   | Read-only hierarchy queries, Firestore-primary            |
| `LearningPathsService`| Prerequisite gating, unlock logic, decision tree traversal|
| `DAGAnalysisEngine`   | Pure graph algorithms for Pulse (topo sort, BFS reach, chain analysis) |
| `PulseEngine`         | Unified session assembly + adaptive learning loop         |

---

## 7. Graph Health Metrics (for /curriculum-graph diagnose)

The `GraphAnalysisEngine.compute_health_metrics()` method produces these metrics:

| Metric             | Interpretation                                        |
|--------------------|-------------------------------------------------------|
| Edge density       | edges / nodes. Below 1.0 = sparse. Above 1.5 = good. |
| Connected components | Number of disconnected subgraphs. Above 5 = fragmented. |
| Cross-unit ratio   | Fraction of edges connecting different units. Below 10% = isolated units. Above 30% = well-integrated. |
| Avg BFS reach (5 hops) | Average nodes reachable from prerequisite roots. Below 6 = limited. Above 20 = rich. |
| Dead-end ratio     | Fraction of nodes with no outgoing edges. Above 30% = many terminal nodes. |
| Orphan count       | Nodes with zero edges in either direction. Invisible to Pulse BFS. |
| Bottleneck nodes   | Nodes that are sole prerequisite for 3+ dependents (single points of failure). |

### Health Score

Weighted composite score on a 0-10 scale:

| Component            | Weight |
|----------------------|--------|
| Connectedness        | 30%    |
| Cross-unit connectivity | 25% |
| BFS reach            | 25%    |
| Low dead-end ratio   | 10%    |
| Low orphan ratio     | 10%    |

### Anomaly Types

| Type              | Severity  | Description                                            |
|-------------------|-----------|--------------------------------------------------------|
| `orphan`          | warning/critical | Nodes with no edges (invisible to Pulse)         |
| `isolated_unit`   | critical  | Units with no cross-unit edges (unreachable by BFS from other units) |
| `bottleneck`      | warning   | Sole prerequisite for 3+ dependents                   |
| `dead_end_cluster`| warning   | High ratio of terminal nodes (Pulse can't progress past these) |

---

## 8. Pulse Integration Details

The knowledge graph is consumed by Pulse (the adaptive learning engine in the main backend) through these mechanisms:

### Cold Start

Topological sort on the prerequisite subgraph produces a linear ordering. Pulse probes at midpoints to efficiently calibrate a new student.

### Warm Start Session Assembly

- 20% frontier (just-unlocked skills at the edge of mastery)
- 65% current (active learning targets)
- 15% spaced review (previously mastered skills due for retention checks)

### Leapfrog

DAG ancestor walk infers intermediate skill mastery. If a student demonstrates competence on a downstream skill, Pulse can infer mastery of prerequisites without explicit testing.

### Gate Unlocking

Only edges with `is_prerequisite=True` block progression. A student must reach `min_proficiency_threshold` (default 0.8) on the source skill before the target skill unlocks.

### Edge Strength

The `strength` field (0-1) influences Pulse item ranking. Higher-strength edges carry more weight when selecting which skills to present next.

---

## 9. Authoring Conventions

### CSV Format

The canonical CSV column order:

```
Subject,Grade,UnitID,UnitTitle,SkillID,SkillDescription,SubskillID,SubskillDescription,DifficultyStart,DifficultyEnd,TargetDifficulty
```

### Unit ID Prefixes by Subject

| Subject        | Prefixes                                          |
|----------------|---------------------------------------------------|
| Mathematics    | COUNT, OPS, GEOM, MEAS, PTRN, TIME, NBT          |
| Language Arts  | LA                                                |
| Science        | SCI                                               |
| Social Studies | SS                                                |
| Arts           | ART                                               |
| ABC123         | ALPHA, NUM                                        |

### Difficulty Guidelines

| Grade Band | Typical Range |
|------------|---------------|
| K-2        | 1-5           |
| 3-5        | 1-7           |
| 6-12       | 1-10          |

### Content Quality Rules

- Each subskill should be a single, assessable learning objective.
- Subskill descriptions should be specific enough that a problem generator can create targeted practice items.
- Decision trees in `backend/data/` map skill-to-skill progression (prerequisite graph at the skill level).

---

## 10. Key Architectural Decisions

### BigQuery as Source of Truth

Firestore is a read cache only. If BigQuery and Firestore diverge, BigQuery wins. The dual-write pattern in `FirestoreCurriculumSync` is fire-and-forget: Firestore write failures are logged but never block the authoring operation.

### Agent Suggests, Humans Approve

The `CurriculumGraphAgentService` orchestrates AI-powered graph suggestions but never auto-commits edges. The flow is: generate suggestions, store in Firestore, author reviews, accept/reject/modify, then the accepted suggestion creates a draft edge that must be published.

### Checkpointing for Resumable Pipelines

The 5-phase suggestion pipeline (`SuggestionEngine`) saves intermediate results to Firestore after each phase via `PipelineCheckpoint`. If a phase fails mid-run, the pipeline resumes from the last completed phase rather than starting over.

### Polymorphic Edges

Edges connect skills and subskills interchangeably. The `source_entity_type` and `target_entity_type` fields distinguish what each endpoint is. This avoids maintaining separate edge tables for skill-to-skill, skill-to-subskill, and subskill-to-subskill relationships.

### Non-Blocking Agent Services

Agent service failures (suggestion generation, graph analysis) never crash the application. All agent operations are isolated and their errors are caught and logged. The authoring CRUD operations continue to work even if the AI layer is completely down.

### Opportunity Identification Targets Subskills Only

The `GraphAnalysisEngine.identify_opportunities()` method only produces subskill-to-subskill edge candidates. Skill-level nodes are containers in the hierarchy and should not be direct edge endpoints in the knowledge graph.
