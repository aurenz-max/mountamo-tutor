# Curriculum Authoring Service - Quick Start Guide

## 📋 Prerequisites

- Python 3.9+
- Google Cloud Project with BigQuery enabled
- Firebase project for authentication
- Gemini API key

## 🚀 Setup

### 1. Install Dependencies

```bash
cd curriculum-authoring-service
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
# Required variables:
# - GOOGLE_CLOUD_PROJECT
# - BIGQUERY_DATASET_ID
# - GOOGLE_APPLICATION_CREDENTIALS
# - FIREBASE_PROJECT_ID
# - GEMINI_API_KEY
```

### 3. Setup Database

```bash
# Create BigQuery tables
python scripts/setup_database.py
```

### 4. Migrate Legacy Data (Optional)

```bash
# Import existing curriculum from CSV/JSON files
python scripts/migrate_from_legacy.py --source ../backend/data
```

### 5. Start the Service

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --port 8001

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## 📚 API Documentation

Once running, access interactive API docs at:
- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## 🔑 Authentication

All endpoints (except `/health` and `/`) require Firebase authentication.

### Getting a Token

1. Authenticate through your Firebase app
2. Get the ID token
3. Include in requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8001/api/curriculum/subjects
```

### Setting Designer Role

Grant curriculum designer role to a user:

```python
from app.core.security import grant_designer_role
grant_designer_role("user_firebase_uid")
```

## 🎯 Core Workflows

### 1. View Curriculum Tree

```bash
GET /api/curriculum/subjects/{subject_id}/tree?include_drafts=true
```

### 2. Create a New Unit (with AI)

```bash
POST /api/ai/generate-unit
{
  "subject": "Mathematics",
  "grade_level": "1st Grade",
  "topic_prompt": "Addition within 20"
}
```

### 3. Add Prerequisites

```bash
POST /api/prerequisites/prerequisites
{
  "prerequisite_entity_id": "COUNT001-01",
  "prerequisite_entity_type": "subskill",
  "unlocks_entity_id": "COUNT001-02",
  "unlocks_entity_type": "subskill",
  "min_proficiency_threshold": 0.8
}
```

### 4. View Draft Changes

```bash
GET /api/publishing/subjects/{subject_id}/draft-changes
```

### 5. Publish Changes

```bash
POST /api/publishing/subjects/{subject_id}/publish
{
  "subject_id": "MATHEMATICS",
  "version_description": "Added new counting units",
  "change_summary": "5 new units, 20 new skills"
}
```

## 📊 Key Endpoints

### Curriculum Management
- `GET /api/curriculum/subjects` - List all subjects
- `GET /api/curriculum/subjects/{id}/tree` - Get full curriculum tree
- `POST /api/curriculum/units` - Create unit
- `POST /api/curriculum/skills` - Create skill
- `POST /api/curriculum/subskills` - Create subskill

### Prerequisites
- `GET /api/prerequisites/subjects/{id}/graph` - Get prerequisite graph
- `POST /api/prerequisites/prerequisites` - Add prerequisite
- `GET /api/prerequisites/subjects/{id}/base-skills` - Get starting skills

### AI Assistant
- `POST /api/ai/generate-unit` - Generate unit from prompt
- `POST /api/ai/suggest-prerequisites` - Get prerequisite suggestions
- `POST /api/ai/improve-description` - Improve descriptions

### Publishing
- `GET /api/publishing/subjects/{id}/draft-changes` - View drafts
- `POST /api/publishing/subjects/{id}/publish` - Publish version
- `POST /api/publishing/subjects/{id}/rollback/{version_id}` - Rollback

## 🔍 Troubleshooting

### BigQuery Connection Issues
```bash
# Verify credentials
echo $GOOGLE_APPLICATION_CREDENTIALS

# Test connection
python -c "from google.cloud import bigquery; client = bigquery.Client(); print('Connected!')"
```

### Firebase Authentication Issues
```bash
# Verify Firebase credentials
firebase auth:export users.json --project YOUR_PROJECT
```

### Service Not Starting
```bash
# Check logs
python app/main.py

# Verify all environment variables
python -c "from app.core.config import settings; print(settings)"
```

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:8001/health
```

### View Logs
```bash
# Service uses Python logging
# Configure LOG_LEVEL in .env (DEBUG, INFO, WARNING, ERROR)
```

## 🔐 Security Notes

1. **Never commit `.env` file** - It contains secrets
2. **Use Firebase custom claims** for role-based access
3. **Admin role required** for publishing/rollback
4. **All changes tracked** with user_id and timestamps

## 📞 Support

- **API Docs**: http://localhost:8001/docs
- **Service Info**: http://localhost:8001/
- **Health Check**: http://localhost:8001/health

## 🎉 Success Metrics

Track these KPIs in production:
- Median time to publish (target: < 1 business day)
- Data integrity incidents (target: 0)
- Designer adoption rate (target: 100%)
- Designer satisfaction (target: > 8/10)
