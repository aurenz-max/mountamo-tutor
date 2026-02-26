# Curriculum Knowledge Graph Service

Defines what students need to master. [Lumina](../my-tutoring-app/src/components/lumina/) handles how they learn it.

## Overview

A standalone microservice that manages the educational knowledge graph — the hierarchical taxonomy of subjects, skills, and prerequisites that defines complete mastery of a domain. This is the single source of truth for curriculum structure; all content delivery (primitives, interactive exercises, AI tutoring) lives in Lumina.

## Core Concepts

```
Subject  (e.g. "Language Arts — Kindergarten")
  └─ Unit  (e.g. "Phonological & Phonemic Awareness")
       └─ Skill  (e.g. "Phoneme Blending & Segmentation")
            └─ Subskill  (e.g. "Segment a CVC word into three phonemes")
                 ├─ difficulty range (0-10 scale)
                 ├─ prerequisites (what must be mastered first)
                 └─ Lumina primitives (how Lumina teaches it)
```

**Prerequisites** form a directed acyclic graph across skills and subskills, defining the learning path. A student achieves full mastery when every subskill in the graph is complete.

## Features

- **Hierarchical curriculum editor** — Subject / Unit / Skill / Subskill CRUD
- **Prerequisite graph** — define and visualize learning paths with proficiency thresholds
- **AI-assisted scaffolding** — generate unit structures from a topic prompt via Gemini
- **Lumina primitive assignment** — link subskills to the interactive primitives that teach them
- **Version control** — draft/publish workflow with rollback
- **Graph caching** — Firestore-backed prerequisite graph cache for performance

## Architecture

| Layer | Tech | Purpose |
|-------|------|---------|
| API | FastAPI | REST endpoints |
| Database | BigQuery | Curriculum entities, prerequisites, versions |
| Cache | Firestore | Prerequisite graph cache |
| Auth | Firebase | Role-based access for designers |
| AI | Gemini | Curriculum structure generation |

## Database Tables

| Table | Purpose |
|-------|---------|
| `curriculum_subjects` | Subject metadata (name, grade level, description) |
| `curriculum_units` | Unit structure |
| `curriculum_skills` | Skill definitions |
| `curriculum_subskills` | Subskill details with difficulty ranges |
| `curriculum_prerequisites` | Prerequisite relationships (polymorphic) |
| `curriculum_versions` | Version history |
| `curriculum_primitives` | Lumina primitive library |
| `curriculum_subskill_primitives` | Junction: subskill ↔ primitive |

## API Endpoints

### Curriculum (`/api/curriculum`)
- `GET /subjects` — list all subjects
- `GET /subjects/{id}/tree` — full hierarchical tree
- `POST /units` — create unit
- `PUT /skills/{id}` — update skill
- `DELETE /subskills/{id}` — delete subskill

### Prerequisites (`/api/prerequisites`)
- `GET /{entity_id}` — get prerequisites & unlocks for an entity
- `GET /subjects/{id}/graph` — full prerequisite graph
- `GET /subjects/{id}/base-skills` — entry points (no prerequisites)
- `POST /` — create prerequisite link
- `POST /validate` — validate before creating

### Publishing (`/api/publishing`)
- `GET /subjects/{id}/draft-changes` — view pending changes
- `POST /subjects/{id}/publish` — publish new version
- `GET /subjects/{id}/versions` — version history
- `POST /subjects/{id}/rollback/{version_id}` — rollback

### AI (`/api/ai`)
- `POST /generate-unit` — generate unit structure from prompt
- `POST /generate-skill` — generate skill with subskills
- `POST /suggest-prerequisites` — AI-suggested learning paths
- `POST /improve-description` — refine entity descriptions

### Graph Cache (`/api/graph`)
- Graph caching and invalidation endpoints

## Getting Started

### Prerequisites
- Python 3.9+
- Google Cloud credentials (BigQuery + Firestore)
- Firebase project for authentication

### Installation

```bash
pip install -r requirements.txt
cp .env.example .env   # edit with your credentials
python scripts/setup_database.py
uvicorn app.main:app --reload --port 8001
```

### Environment Variables

```
GOOGLE_CLOUD_PROJECT=your-project-id
BIGQUERY_DATASET_ID=curriculum_authoring
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
FIREBASE_PROJECT_ID=your-firebase-project
GEMINI_API_KEY=your-gemini-api-key
```

## Code Structure

```
app/
├── api/           # REST endpoints (curriculum, prerequisites, publishing, ai, graph)
├── core/          # Config, database, security
├── db/            # Firestore graph caching
├── models/        # Pydantic models (curriculum, prerequisites, versioning)
├── services/      # Business logic (curriculum_manager, prerequisite_manager, version_control, ai_assistant, graph_cache_manager)
└── utils/         # LLM logging
```

## How This Connects to Lumina

1. Curriculum designers build the knowledge graph here (subjects → subskills + prerequisites)
2. Designers assign Lumina primitives to each subskill
3. Lumina reads the graph to know *what* to teach and *which primitives* to use
4. Student progress is tracked against the knowledge graph to determine mastery
