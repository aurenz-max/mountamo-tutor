# Curriculum — Hierarchical Content Explorer & Authoring Tool

Explore the curriculum hierarchy and author new content via the AI-powered authoring service. Use this when you need to understand what content exists, drill into a subject, look up a specific subskill, or **author new curriculum units**.

**Arguments:** `/curriculum [command] [target]`
- `/curriculum` — list all published subjects with stats
- `/curriculum Mathematics` — full tree for a subject
- `/curriculum Mathematics --unit COUNT001` — expand one unit
- `/curriculum lookup ARITH001-03-B` — find a subskill's position in the hierarchy
- `/curriculum stats` — aggregate stats across all subjects
- `/curriculum stats Mathematics` — stats for one subject
- `/curriculum author GRADE_01.md Language Arts` — author units for a subject using AI

---

## Architecture Context

### Read Path (Published Curriculum)

**Data source:** Firestore `curriculum_published/{grade}/subjects/{subject_id}` (primary), BigQuery fallback.

**Service:** `backend/app/services/curriculum_service.py` — `CurriculumService`
- `get_available_subjects(grade?)` → list of `{subject_id, subject_name, grade}`
- `get_curriculum(subject)` → hierarchical list of units → skills → subskills
- `get_subskill_types(subject)` → flat list of all subskill IDs
- `get_subskill_metadata(subskill_id, subject?)` → unit/skill/subskill context for one subskill
- `get_curriculum_stats(subject?)` → counts and difficulty stats

**API:** Read-only endpoints are **public** (no auth). Port `8000`.

### Write Path (Authoring Service)

**Service:** `curriculum-authoring-service/` — separate FastAPI app on port `8001`.

**Authoring workflow:** `ensure-subject` → `author-unit` (writes pending unit to drafts) → review → `accept` / `reject` / `regenerate`

**Storage:** All authoring state lives in `curriculum_drafts`. No separate `authoring_previews` collection. Generated units are written directly to the draft document with `status: "pending"`. Accept flips to `"accepted"` (1 write). Publish filters to accepted units only.

**Key endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/author-subject` | POST | Create or retrieve subject shell |
| `/api/ai/author-unit` | POST | Generate a unit → save as pending in drafts |
| `/api/ai/author-unit/accept` | POST | Flip pending → accepted (1 write) |
| `/api/ai/author-unit/reject` | POST | Flip pending → rejected with feedback |
| `/api/ai/author-unit/regenerate` | POST | Mark old rejected + generate new pending |
| `/api/ai/author-previews/{subject_id}?grade=X` | GET | List all previews with status counts |
| `/api/ai/generate-skill` | POST | Generate subskills for a skill (creates or appends to existing) |

**Accept/reject/regenerate requests require `subject_id` and `grade`** in addition to `preview_id`.

**Key files:**
| File | Purpose |
|------|---------|
| `curriculum-authoring-service/app/services/authoring_service.py` | `AuthoringService` — Gemini generation, lifecycle |
| `curriculum-authoring-service/app/db/draft_curriculum_service.py` | `DraftCurriculumService` — status-aware CRUD on draft docs |
| `curriculum-authoring-service/app/models/authoring.py` | Request/response models (`AuthorUnitRequest`, `UnitPreview`, etc.) |
| `curriculum-authoring-service/app/api/ai.py` | API endpoints for authoring workflow |
| `curriculum-authoring-service/docs/prds/GRADE_XX.md` | Per-grade PRDs with unit definitions and primitive mappings |

**Gemini integration:** Uses `google.genai` client (same as `suggestion_engine.py`):
```python
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.GEMINI_API_KEY)
response = client.models.generate_content(
    model="gemini-3.1-flash-lite-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=UNIT_RESPONSE_SCHEMA,  # types.Schema with types.Type enums
        temperature=1,
        max_output_tokens=65536,
    ),
)
```

**Response schema:** Defined as `UNIT_RESPONSE_SCHEMA` using `types.Schema(type=types.Type.OBJECT, ...)` with field-level descriptions. This enforces structured JSON output from Gemini. Every field needs a `description` that guides generation quality.

---

## Phase 0: Parse Arguments

| Pattern | Command | Target |
|---------|---------|--------|
| `/curriculum` | `list` | — |
| `/curriculum Mathematics` | `tree` | subject name or ID |
| `/curriculum Mathematics --unit COUNT001` | `tree` | subject, filtered to unit |
| `/curriculum lookup ARITH001-03-B` | `lookup` | subskill_id |
| `/curriculum stats` | `stats` | all |
| `/curriculum stats Mathematics` | `stats` | subject |
| `/curriculum author GRADE_01.md Language Arts` | `author` | PRD file + subject |

---

## Command: `author`

Author curriculum units for a subject using the AI-powered authoring service.

### Critical Authoring Rules

1. **PRD is the source of truth.** Read the grade PRD file (`curriculum-authoring-service/docs/prds/GRADE_XX.md`) first. It defines units, skill areas, target primitives, and subskill counts.

2. **Be prescriptive with Gemini.** The `prd_context` field in the request must spell out EXACTLY which skills and subskills to generate. Vague instructions produce thin results. Specify:
   - Exact skill IDs and their names (e.g., "LA001-01: Short Vowel CVC Decoding")
   - Exact subskill count per skill (e.g., "2 subskills")
   - Subskill letters and what each covers (e.g., "Subskill a: Blend phonemes to read CVC words")
   - Target primitive for each subskill

3. **Skill descriptions are UI titles, not paragraphs.** Skills appear in the curriculum browser as short labels like "Rhyme Recognition & Production" or "Consonant Blends". The `skill_description` must be a short, human-readable title — NOT an internal design note or paragraph explanation.

4. **Subskill descriptions are rich content instructions.** Unlike skills, subskill descriptions are the ONLY instruction Lumina has to generate practice content. Each must include:
   - A natural descriptive sentence (no label prefixes like "Title:" or "Name:")
   - **Focus:** — What specifically the student practices
   - **Examples:** — 8-10 concrete items (words, sentences, problems)
   - **Constraints:** — Scaffolding, isolation, progression notes

5. **Aggregate within existing skills before creating new ones.** When adding new subskills, first check whether they fit naturally under an existing skill. For example, soft c/g and silent letter patterns belong under "Digraphs" (or a broadened version of it), not as standalone skills. Only create a new skill when the concept is genuinely distinct from all existing skills in the unit. Use `POST /ai/generate-skill` with an existing `skill_id` to append subskills to an existing skill.

6. **One unit at a time.** Author each unit as a separate API call, review the preview, then accept/reject before moving to the next.

7. **`max_output_tokens` must be high enough.** Rich subskill descriptions are verbose — use 65536 to avoid JSON truncation.

### Step 1: Read the PRD

Read the grade PRD to get unit definitions, skill areas, primitive mappings, and target subskill counts.

```bash
# Example: Grade 1 Language Arts
cat curriculum-authoring-service/docs/prds/GRADE_01.md
```

### Step 2: Ensure subject exists

```bash
curl -s -X POST http://localhost:8001/api/ai/author-subject \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "LANGUAGE_ARTS_G1",
    "subject_name": "Language Arts",
    "grade": "1",
    "description": "Language Arts / ELA curriculum for Grade 1"
  }'
```

Response tells you which units already exist so you know where to pick up.

### Step 3: Author each unit

Build a **prescriptive** request from the PRD's primitive mapping table. Example for LA001:

```json
{
  "subject_id": "LANGUAGE_ARTS_G1",
  "grade": "1",
  "unit_id": "LA001",
  "unit_title": "Phonics and Decoding",
  "unit_description": "Short description of the unit scope",
  "unit_order": 1,
  "prd_context": "The unit MUST contain exactly these N skills:\n\n1. LA001-01: Short Vowel CVC Decoding (2 subskills) — phonics-blender, cvc-speller\n   - Subskill a: Blend phonemes to read CVC words\n   - Subskill b: Build/spell CVC words from letter tiles\n\n2. LA001-02: Consonant Blends (2 subskills) — phonics-blender\n   - Subskill a: Initial blends (bl, cl, fl, ...)\n   - Subskill b: Final blends (nd, nk, nt, ...)\n\n...(list ALL skills and subskills explicitly)",
  "custom_instructions": "Generate exactly N skills and exactly M subskills as specified. Skill descriptions must be SHORT UI TITLES. Each subskill description MUST include Title, Focus, Examples (8-10), and Constraints.",
  "num_skills": 9,
  "num_subskills_per_skill": 2
}
```

**Key:** The `prd_context` must explicitly list every skill with its subskills, primitive targets, and subskill count. Do NOT rely on Gemini to infer structure from a generic table.

### Step 4: Review preview

Check the response for:
- Correct skill/subskill count
- 100% Lumina coverage
- Skill descriptions are short UI titles (not paragraphs)
- Subskill descriptions have Title/Focus/Examples/Constraints
- Target primitives match the PRD
- Difficulty progression makes sense

### Step 5: Accept or reject

```bash
# Accept (requires subject_id and grade)
curl -s -X POST http://localhost:8001/api/ai/author-unit/accept \
  -H "Content-Type: application/json" \
  -d '{"preview_id": "...", "subject_id": "LANGUAGE_ARTS_G1", "grade": "1"}'

# Reject with feedback
curl -s -X POST http://localhost:8001/api/ai/author-unit/reject \
  -H "Content-Type: application/json" \
  -d '{"preview_id": "...", "subject_id": "LANGUAGE_ARTS_G1", "grade": "1", "feedback": "Skill descriptions too verbose, need short titles"}'

# Regenerate (reject + retry with feedback)
curl -s -X POST http://localhost:8001/api/ai/author-unit/regenerate \
  -H "Content-Type: application/json" \
  -d '{"preview_id": "...", "subject_id": "LANGUAGE_ARTS_G1", "grade": "1", "additional_feedback": "...", "custom_instructions": "..."}'
```

### Step 6: Repeat for remaining units

After accepting a unit, move to the next one. Use `GET /api/ai/author-previews/{subject_id}?grade=1` to check progress.

---

## Command: `list` (default, no arguments)

List all published subjects with summary counts.

### Step 1: Call the backend endpoint

```bash
curl -s http://localhost:8000/api/curriculum/subjects | python -m json.tool
```

**Fallback:** Read the service code and Firestore directly if the server isn't running.

### Step 2: For each subject, get stats

```bash
curl -s http://localhost:8000/api/curriculum/stats | python -m json.tool
```

### Step 3: Present as table

```
## Published Subjects

| Subject       | Grade | Units | Skills | Subskills | Avg Difficulty |
|---------------|-------|-------|--------|-----------|----------------|
| Mathematics   | 1     | 8     | 24     | 96        | 3.2            |
| Language Arts | 1     | 6     | 18     | 72        | 2.8            |
```

---

## Command: `tree` (subject provided)

Show the full hierarchical tree for a subject.

### Step 1: Fetch curriculum hierarchy

```bash
curl -s "http://localhost:8000/api/curriculum/curriculum/Mathematics" | python -m json.tool
```

### Step 2: Present as indented tree

```
## Mathematics (Grade 1) — 8 units, 24 skills, 96 subskills

📦 COUNT001 · Counting and Cardinality
  ├─ COUNT001-01 · Count objects to 10
  │   ├─ COUNT001-01-A · One-to-one correspondence (1.0–2.0, target: 1.5)
  │   ├─ COUNT001-01-B · Counting sequence to 10 (1.0–2.0, target: 1.5)
  │   └─ COUNT001-01-C · Cardinality principle (1.5–2.5, target: 2.0)
  └─ ...
```

**If `--unit UNIT_ID` is specified:** Only expand that unit, collapse others to one-line summaries.

### Step 3: Summary footer

```
Total: 8 units → 24 skills → 96 subskills
Difficulty range: 1.0–5.0 (avg target: 3.2)
```

---

## Command: `lookup`

Find where a subskill sits in the hierarchy.

### Step 1: Look up metadata

1. **Infer subject from the subskill ID prefix** (e.g. `ARITH001-03-B` → Mathematics).
2. **Fetch the full curriculum** via `GET /api/curriculum/curriculum/{subject}`.
3. **Walk the hierarchy** to find the matching subskill.

### Step 2: Present context

```
## Subskill: ARITH001-03-B

Description: Subtract by counting back
Difficulty: 2.0–3.5 (target: 2.8)

Hierarchy:
  Subject:  Mathematics (Grade 1)
  Unit:     ARITH001 · Addition and Subtraction
  Skill:    ARITH001-03 · Subtract within 20
  Subskill: ARITH001-03-B · Subtract by counting back
```

### Step 3: Show siblings

```
Siblings under ARITH001-03:
  ARITH001-03-A · Subtract using number line
  ARITH001-03-B · Subtract by counting back  ← this one
  ARITH001-03-C · Subtract using ten frames
```

---

## Command: `stats`

Show curriculum statistics.

```bash
curl -s http://localhost:8000/api/curriculum/stats | python -m json.tool
curl -s "http://localhost:8000/api/curriculum/stats?subject=Mathematics" | python -m json.tool
```

---

## Checklist

- [ ] Parsed command and target from arguments
- [ ] For `list`: fetched all subjects and stats, presented as table
- [ ] For `tree`: fetched curriculum hierarchy, presented as indented tree
- [ ] For `tree --unit`: filtered to specified unit, collapsed others
- [ ] For `lookup`: found subskill metadata, showed hierarchy path and siblings
- [ ] For `stats`: fetched and presented curriculum statistics
- [ ] For `author`: read PRD, built prescriptive requests, authored unit-by-unit via authoring service
- [ ] Used backend endpoints when server is running, Firestore/code fallback otherwise
