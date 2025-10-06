# Curriculum Authoring Service

A standalone microservice for managing educational curriculum with AI-assisted authoring, prerequisite graphs, and version control.

## Overview

This service replaces the fragmented file-based curriculum management system with a unified, database-driven platform that enables curriculum designers to create, edit, and publish educational content without engineering intervention.

## Key Features

- **Visual Curriculum Editor**: Hierarchical tree view (Subject → Unit → Skill → Subskill)
- **Prerequisite Graph Management**: Define and visualize learning paths
- **AI-Assisted Content Generation**: LLM-powered curriculum drafting
- **Version Control**: Draft/publish workflow with rollback capabilities
- **RESTful API**: Complete CRUD operations for all curriculum entities

## Architecture

### Backend (FastAPI)
- **Database**: BigQuery (shared relational schema)
- **Authentication**: Firebase (role-based access for designers)
- **AI Integration**: Gemini API for content generation

### Frontend (Next.js) - Coming Soon
- Web-based admin interface for curriculum designers

## Database Schema

### Core Tables
- `curriculum_subjects` - Subject-level metadata
- `curriculum_units` - Unit structure
- `curriculum_skills` - Skill definitions
- `curriculum_subskills` - Subskill details with difficulty ranges
- `curriculum_prerequisites` - Universal prerequisite relationships
- `curriculum_versions` - Version tracking and history

## API Endpoints

### Curriculum Management
- `GET /api/curriculum/subjects` - List all subjects
- `GET /api/curriculum/subjects/{subject_id}/tree` - Full hierarchy
- `POST /api/curriculum/units` - Create new unit
- `PUT /api/curriculum/skills/{skill_id}` - Update skill
- `DELETE /api/curriculum/subskills/{subskill_id}` - Delete subskill

### Prerequisite Graph
- `GET /api/prerequisites/{entity_id}` - Get prerequisites & unlocks
- `POST /api/prerequisites` - Create prerequisite link
- `DELETE /api/prerequisites/{prerequisite_id}` - Remove link

### AI Assistance
- `POST /api/ai/generate-unit` - Generate curriculum unit from prompt

### Publishing & Versioning
- `GET /api/curriculum/subjects/{subject_id}/draft-changes` - View draft changes
- `POST /api/curriculum/subjects/{subject_id}/publish` - Publish new version
- `GET /api/curriculum/versions/{subject_id}` - Version history
- `POST /api/curriculum/versions/{version_id}/rollback` - Rollback to previous version

## Getting Started

### Prerequisites
- Python 3.9+
- Google Cloud credentials with BigQuery access
- Firebase project for authentication

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
python scripts/setup_database.py

# Start the service
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

## Migration from Legacy System

The service includes a migration script to import data from existing CSV files and JSON decision trees:

```bash
python scripts/migrate_from_legacy.py --source ../backend/data
```

## Development

### Running Tests
```bash
pytest tests/
```

### Code Structure
```
app/
├── core/          # Configuration, database, security
├── models/        # Pydantic models
├── services/      # Business logic
└── api/           # API endpoints
```

## Contributing

This service is designed to be the single source of truth for curriculum management. All curriculum changes should flow through this service's API.

## License

Proprietary - Internal Use Only
