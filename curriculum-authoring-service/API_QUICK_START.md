# API Quick Start Guide - Problem Generation & Prompt Management

**🎉 NOW LIVE!** The backend APIs are ready to use.

## Base URL
```
http://localhost:8000/api
```

## 📚 API Documentation
Once the service is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🎯 Problem Generation APIs

### 1. Generate Problems
Generate 5-10 practice problems for a subskill using AI.

```bash
POST /api/subskills/{subskill_id}/problems/generate
```

**Request Body:**
```json
{
  "version_id": "v1",
  "count": 5,
  "problem_types": ["multiple_choice", "true_false"],
  "temperature": 0.7,
  "auto_evaluate": true,
  "custom_prompt": null
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/api/subskills/LA006-03-A/problems/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "version_id": "v1",
    "count": 5,
    "problem_types": ["multiple_choice"],
    "temperature": 0.7,
    "auto_evaluate": false
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "problem_id": "abc-123-def",
      "subskill_id": "LA006-03-A",
      "version_id": "v1",
      "problem_type": "multiple_choice",
      "problem_json": {
        "question_text": "Which letter comes after B?",
        "options": ["A", "C", "D", "E"],
        "correct_answer_index": 1,
        "explanation": "C comes after B in the alphabet.",
        "difficulty": "easy"
      },
      "generation_prompt": "You are an expert educational content creator...",
      "generation_model": "gemini-2.0-flash-exp",
      "generation_temperature": 0.7,
      "generation_timestamp": "2025-01-20T10:30:00Z",
      "generation_duration_ms": 2500,
      "is_draft": true,
      "is_active": false,
      "created_at": "2025-01-20T10:30:00Z",
      "updated_at": "2025-01-20T10:30:00Z"
    }
  ],
  "message": "Generated 5 problems successfully"
}
```

---

### 2. List Problems
Get all problems for a subskill.

```bash
GET /api/subskills/{subskill_id}/problems?version_id=v1&active_only=false
```

**Example:**
```bash
curl "http://localhost:8000/api/subskills/LA006-03-A/problems?version_id=v1"
```

---

### 3. Get Single Problem
Retrieve a specific problem by ID.

```bash
GET /api/problems/{problem_id}
```

**Example:**
```bash
curl "http://localhost:8000/api/problems/abc-123-def"
```

---

### 4. Update Problem
Manually edit a problem.

```bash
PUT /api/problems/{problem_id}
```

**Request Body:**
```json
{
  "problem_json": {
    "question_text": "Updated question text...",
    "options": ["A", "B", "C", "D"],
    "correct_answer_index": 1,
    "explanation": "Updated explanation...",
    "difficulty": "medium"
  },
  "is_draft": false,
  "is_active": true
}
```

**Example:**
```bash
curl -X PUT "http://localhost:8000/api/problems/abc-123-def" \
  -H "Content-Type: application/json" \
  -d '{
    "is_draft": false,
    "is_active": true
  }'
```

---

### 5. Regenerate Problem
Generate a new problem to replace an existing one.

```bash
POST /api/problems/{problem_id}/regenerate
```

**Request Body (optional):**
```json
{
  "modified_prompt": "Generate a harder problem about...",
  "temperature": 0.8
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/api/problems/abc-123-def/regenerate" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 6. Delete Problem
Permanently remove a problem.

```bash
DELETE /api/problems/{problem_id}
```

**Example:**
```bash
curl -X DELETE "http://localhost:8000/api/problems/abc-123-def"
```

---

## 📝 Prompt Management APIs

### 1. Create Prompt Template
Create a new prompt template (auto-versioning).

```bash
POST /api/prompts
```

**Request Body:**
```json
{
  "template_name": "kindergarten_alphabet_problems",
  "template_type": "problem_generation",
  "template_text": "Generate {count} {problem_types} problems for {subskill_description}. Target grade level: {grade_level}. Focus on: {core_concepts}",
  "template_variables": ["count", "problem_types", "subskill_description", "grade_level", "core_concepts"],
  "is_active": true,
  "change_notes": "Initial version"
}
```

**Template Types:**
- `problem_generation`
- `content_generation`
- `problem_evaluation`
- `content_evaluation`

**Example:**
```bash
curl -X POST "http://localhost:8000/api/prompts" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "default_problem_generation",
    "template_type": "problem_generation",
    "template_text": "You are an expert educator. Generate {count} problems...",
    "template_variables": ["count", "subskill_description"],
    "is_active": true
  }'
```

---

### 2. List Prompt Templates
Get all templates with optional filtering.

```bash
GET /api/prompts?template_type=problem_generation&active_only=true
```

**Query Parameters:**
- `template_type` (optional): Filter by type
- `template_name` (optional): Filter by name
- `active_only` (optional): Only active versions

**Example:**
```bash
curl "http://localhost:8000/api/prompts?template_type=problem_generation"
```

---

### 3. Get Single Template
Retrieve a specific template by ID.

```bash
GET /api/prompts/{template_id}
```

**Example:**
```bash
curl "http://localhost:8000/api/prompts/xyz-456-abc"
```

---

### 4. Get Active Template
Get the currently active version of a template.

```bash
GET /api/prompts/active/{template_name}/{template_type}
```

**Example:**
```bash
curl "http://localhost:8000/api/prompts/active/default_problem_generation/problem_generation"
```

---

### 5. Update Template
Modify an existing template version.

```bash
PUT /api/prompts/{template_id}
```

**Request Body:**
```json
{
  "template_text": "Updated prompt text...",
  "change_notes": "Fixed typo in instructions"
}
```

**Example:**
```bash
curl -X PUT "http://localhost:8000/api/prompts/xyz-456-abc" \
  -H "Content-Type: application/json" \
  -d '{
    "template_text": "New prompt text...",
    "change_notes": "Improved clarity"
  }'
```

---

### 6. Activate Template Version
Switch to a different template version.

```bash
POST /api/prompts/{template_id}/activate
```

**Example:**
```bash
curl -X POST "http://localhost:8000/api/prompts/xyz-456-abc/activate"
```

---

### 7. Get Performance Metrics
Calculate metrics for a template based on evaluation results.

```bash
GET /api/prompts/{template_id}/performance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "avg_evaluation_score": 8.5,
    "approval_rate": 0.78,
    "avg_pedagogical_score": 8.8,
    "avg_alignment_score": 8.2,
    "avg_clarity_score": 9.0,
    "avg_correctness_score": 9.5,
    "avg_bias_score": 8.0,
    "total_generations": 142,
    "total_approvals": 111,
    "total_revisions": 24,
    "total_rejections": 7
  },
  "message": "Performance metrics calculated successfully"
}
```

**Example:**
```bash
curl "http://localhost:8000/api/prompts/xyz-456-abc/performance"
```

---

### 8. Get Template Types
List all available template types and their descriptions.

```bash
GET /api/prompts/types
```

**Example:**
```bash
curl "http://localhost:8000/api/prompts/types"
```

---

## 🚀 Starting the Service

1. **Install dependencies:**
```bash
cd curriculum-authoring-service
pip install -r requirements.txt
```

2. **Set environment variables:**
```bash
# .env file
GOOGLE_CLOUD_PROJECT=mountamo-tutor-h7wnta
BIGQUERY_DATASET_ID=analytics
GEMINI_API_KEY=your_api_key_here
SERVICE_PORT=8000
DEBUG=true
LOG_LEVEL=INFO
```

3. **Run the service:**
```bash
python -m app.main
```

Or with uvicorn directly:
```bash
uvicorn app.main:app --reload --port 8000
```

4. **Verify it's running:**
```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "service": "Curriculum Authoring Service",
  "version": "1.0.0",
  "status": "operational",
  "docs": "/docs"
}
```

---

## 📊 API Features

### Problem Generation
- ✅ Generate 5-10 problems per batch
- ✅ 4 problem types supported (multiple choice, true/false, fill-in-blanks, short answer)
- ✅ Custom prompt support
- ✅ Adjustable temperature (0.0-1.0)
- ✅ Auto-evaluation trigger (when evaluation service is ready)
- ✅ Full metadata tracking (prompt, model, temperature, timestamp)
- ✅ Manual editing with history
- ✅ Regeneration with modified prompts

### Prompt Management
- ✅ Automatic versioning
- ✅ Only one active version per template
- ✅ Performance metrics from evaluation data
- ✅ Template rendering with variables
- ✅ Audit trail (created_by, change_notes)
- ✅ A/B testing support (switch versions easily)

---

## 🔜 Coming Soon

### Evaluation APIs (Week 2)
```bash
# Evaluate a problem
POST /api/problems/{problem_id}/evaluate

# Get evaluation results
GET /api/problems/{problem_id}/evaluation

# Batch evaluate
POST /api/subskills/{subskill_id}/problems/batch-evaluate
```

### Content Evaluation APIs (Week 2)
```bash
# Evaluate content package
POST /api/subskills/{subskill_id}/content/evaluate

# Get content evaluation
GET /api/subskills/{subskill_id}/content/evaluation
```

### Dashboard API (Week 3)
```bash
# Get unified quality dashboard
GET /api/content-quality-dashboard?status=ready_to_publish
```

---

## 🐛 Troubleshooting

### Common Issues

**1. ImportError: No module named 'google.genai'**
```bash
pip install google-generativeai
```

**2. GEMINI_API_KEY not set**
```bash
export GEMINI_API_KEY=your_key_here
```

**3. BigQuery permission denied**
- Ensure your service account has BigQuery Data Editor role
- Check `GOOGLE_APPLICATION_CREDENTIALS` environment variable

**4. "Template not found" when generating**
- First time: No problem! System uses fallback prompt
- To use custom templates: Create one with POST /api/prompts

---

## 📞 Support

- **Backend Team:** Slack #curriculum-authoring
- **API Docs:** http://localhost:8000/docs
- **Issues:** GitHub issues repository

---

**Last Updated:** 2025-01-20
**API Version:** 1.0.0
**Status:** ✅ Ready for frontend integration
