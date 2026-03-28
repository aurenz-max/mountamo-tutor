# Curriculum Authoring Service

The single source of truth for curriculum structure and the knowledge graph. Defines **what** students learn; [Lumina](../my-tutoring-app/src/components/lumina/) handles **how** they learn it.

A standalone FastAPI microservice (port 8001) managing the 4-level curriculum taxonomy, a typed knowledge graph with 5 relationship types, an AI-powered graph analysis agent, and a draft/publish version control workflow.

## Current State

- **Kindergarten**: 805 subskills across 6 subjects (ABC123, Language Arts, Mathematics, Science, Social Studies, Arts)
- **First Grade**: ~496 subskills across 4 subjects (Language Arts, Mathematics, Science, Social Studies)
- **Grades 2-12**: Not yet authored
- **Grade codes**: PK, K, 1, 2, 3, ... 12

---

## Core Concepts

### Curriculum Hierarchy

```
Subject  (e.g. "Language Arts -- Kindergarten")
  |-- Unit  (e.g. "Phonological & Phonemic Awareness")
       |-- Skill  (e.g. "Phoneme Blending & Segmentation")
            |-- Subskill  (e.g. "Segment a CVC word into three phonemes")
                 |-- difficulty range (0-10 scale)
                 |-- knowledge graph edges (relationships to other nodes)
                 |-- Lumina primitives (interactive exercises that teach it)
                 |-- AI foundations (master context, visual schemas)
```

### Knowledge Graph

Subskills and skills are connected by typed edges that form a directed graph. Only `prerequisite` edges enforce mastery gates; all other types are informational and used by the adaptive engine for session assembly.

| Type | Meaning | Gate Effect |
|------|---------|-------------|
| `prerequisite` | Must master A before B | Enforces mastery gates |
| `builds_on` | A extends into B conceptually | No gate |
| `reinforces` | Practicing A strengthens B | No gate |
| `parallel` | Peer concepts at similar difficulty | No gate, auto-creates reverse edge |
| `applies` | Abstract A used in applied context B | No gate |

### Version Control

All curriculum changes go through a draft/publish workflow. Published versions are immutable snapshots. Rollback restores a previous published version as the new draft.

---

## Architecture

| Layer | Technology | Purpose |
|-------|------------|---------|
| API | FastAPI 0.109.0 | REST endpoints (7 route groups) |
| Database | BigQuery | Source of truth for all curriculum data |
| Cache / Deploy | Firestore | Dual-write cache and published curriculum store |
| Auth | Firebase Auth | Role-based access control |
| AI | Gemini | Content generation, embeddings, graph suggestions |

### Data Flow

```
Authoring Service
    |-- writes --> BigQuery (source of truth)
    |-- dual-writes --> Firestore (cache + published deployment)
                            |
                            |-- reads --> Backend CurriculumService (platform API)
                            |-- reads --> LearningPathsService (prerequisite gating)
                            |-- reads --> PulseEngine (adaptive session assembly)
                            |-- reads --> Frontend (renders curriculum)
```

---

## API Reference

### 1. Curriculum (`/api/curriculum`)

CRUD operations for the 4-level hierarchy: subjects, units, skills, subskills.

- `GET /subjects` -- list all subjects
- `GET /subjects/{id}/tree` -- full hierarchical tree
- `POST /units` -- create unit
- `PUT /skills/{id}` -- update skill
- `DELETE /subskills/{id}` -- delete subskill

### 2. Edges (`/api/edges`)

Typed knowledge graph edge management. Supports all 5 relationship types with validation to prevent cycles in prerequisite edges.

### 3. Agent (`/api/agent`)

Graph health analysis, AI-powered suggestion engine, and approval workflow for suggested connections.

### 4. AI (`/api/ai`)

Gemini-powered content generation.

- `POST /generate-unit` -- generate unit structure from a topic prompt
- `POST /generate-skill` -- generate skill with subskills
- `POST /suggest-prerequisites` -- AI-suggested learning paths
- `POST /improve-description` -- refine entity descriptions

### 5. Publishing (`/api/publishing`)

Draft/publish/rollback version control.

- `GET /subjects/{id}/draft-changes` -- view pending changes
- `POST /subjects/{id}/publish` -- publish new version
- `GET /subjects/{id}/versions` -- version history
- `POST /subjects/{id}/rollback/{version_id}` -- rollback to a previous version

### 6. Graph (`/api/graph`)

Graph caching and invalidation endpoints for Firestore-backed prerequisite graph cache.

### 7. Prerequisites (`/api/prerequisites`) [Legacy]

Original prerequisite management endpoints. Superseded by the typed edges system (`/api/edges`). Retained for backward compatibility.

---

## Agent Suggestion Pipeline

The AI agent runs a 5-phase pipeline to discover missing or beneficial knowledge graph connections:

1. **Skill-level embedding comparison** -- Generates embeddings for up to 25 skills, producing ~300 candidate pairs by cosine similarity.
2. **Skill-pair LLM triage** -- Gemini evaluates each candidate pair for pedagogical relevance, filtering to high-confidence matches.
3. **Subskill drill-down** -- Embedding comparison within matched skill pairs to find specific subskill-level connections.
4. **Subskill LLM refinement** -- Gemini classifies each subskill pair into one of the 5 relationship types with confidence scores.
5. **Impact simulation and validation** -- Validates suggestions against existing graph structure, checks for cycles, and estimates impact.

Suggestions enter an approval queue where curriculum designers can accept, modify, or reject each one.

---

## Database

### BigQuery Tables

| Table | Purpose |
|-------|---------|
| `curriculum_subjects` | Subject metadata and grade level |
| `curriculum_units` | Unit structure and ordering |
| `curriculum_skills` | Skill definitions |
| `curriculum_subskills` | Subskill details with difficulty ranges |
| `curriculum_edges` | Knowledge graph (5 typed relationships) |
| `curriculum_versions` | Version history for draft/publish workflow |
| `curriculum_primitives` | Lumina primitive library |
| `curriculum_subskill_primitives` | Junction table: subskill to primitive mapping |
| `curriculum_subskill_foundations` | AI-generated content foundations |
| `curriculum_prerequisites` | Legacy prerequisite relationships (superseded by edges) |

### Firestore Collections

Published curriculum deploys to `curriculum_published/{grade}/subjects/{id}` for consumption by the main backend.

---

## How It Connects to the Platform

1. **Authoring service** defines WHAT students learn (hierarchy + knowledge graph).
2. **Published curriculum** deploys to Firestore at `curriculum_published/{grade}/subjects/{id}`.
3. **Backend `CurriculumService`** reads published data to serve the platform API.
4. **`LearningPathsService`** reads the graph for prerequisite gating (blocking students from skills they are not ready for).
5. **`PulseEngine`** reads the graph for adaptive session assembly -- BFS discovery of reachable skills, cold-start probes for new students, and leapfrog inference to skip mastered prerequisites.
6. **Lumina primitives** handle HOW students learn through interactive exercises linked to subskills.

---

## Getting Started

### Requirements

- Python 3.9+
- Google Cloud credentials (BigQuery + Firestore)
- Firebase project for authentication
- Gemini API key for AI features

### Installation

```bash
pip install -r requirements.txt
cp .env.example .env   # edit with your credentials
python scripts/setup_database.py
uvicorn app.main:app --reload --port 8001
```

### Environment Variables

**Required:**

```
GOOGLE_CLOUD_PROJECT=your-project-id
BIGQUERY_DATASET_ID=curriculum_authoring
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

## Code Structure

```
app/
|-- api/           # 7 route groups (curriculum, edges, agent, ai, publishing, graph, prerequisites)
|-- core/          # Config, database (BigQuery client), security (Firebase auth)
|-- db/            # Firestore sync services
|-- models/        # Pydantic models (curriculum, edges, grades, foundations, versioning)
|-- services/
|   |-- curriculum_manager.py    # Hierarchy CRUD operations
|   |-- edge_manager.py          # Knowledge graph edges (5 types)
|   |-- graph_analysis.py        # Structural health metrics
|   |-- suggestion_engine.py     # 5-phase Gemini suggestion pipeline
|   |-- graph_agent.py           # Agent orchestrator
|   |-- graph_cache_manager.py   # Firestore caching
|   |-- version_control.py       # Draft/publish workflow
|   |-- ai_assistant.py          # Gemini content generation
|   +-- foundations_service.py   # AI foundations (context, primitives, visual schemas)
|-- generators/    # Visual schema recommender (LLM-powered)
+-- utils/         # LLM logging
scripts/           # Database setup, migration utilities
docs/              # Architecture documentation and PRDs
```

---

## Archived Documentation

Historical implementation documents, handoff guides, and earlier PRDs are preserved in `docs/archive/` for reference. These reflect the evolution of the service and may reference patterns or systems that have since been superseded.
