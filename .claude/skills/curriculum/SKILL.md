# Curriculum — Hierarchical Content Explorer

Explore the curriculum hierarchy stored in Firestore via the backend's `CurriculumService`. Shows subjects, units, skills, and subskills in an intuitive tree format. Use this when you need to understand what content exists, drill into a subject, or look up a specific subskill.

**Arguments:** `/curriculum [command] [target]`
- `/curriculum` — list all published subjects with stats
- `/curriculum Mathematics` — full tree for a subject
- `/curriculum Mathematics --unit COUNT001` — expand one unit
- `/curriculum lookup ARITH001-03-B` — find a subskill's position in the hierarchy
- `/curriculum stats` — aggregate stats across all subjects
- `/curriculum stats Mathematics` — stats for one subject

---

## Architecture Context

**Data source:** Firestore `curriculum_published/{grade}/subjects/{subject_id}` (primary), BigQuery fallback.

**Service:** `backend/app/services/curriculum_service.py` — `CurriculumService`
- `get_available_subjects(grade?)` → list of `{subject_id, subject_name, grade}`
- `get_curriculum(subject)` → hierarchical list of units → skills → subskills
- `get_subskill_types(subject)` → flat list of all subskill IDs
- `get_subskill_metadata(subskill_id, subject?)` → unit/skill/subskill context for one subskill
- `get_curriculum_stats(subject?)` → counts and difficulty stats

**Firestore doc shape** (per subject):
```
{
  subject_name, grade,
  curriculum: [
    { unit_id, unit_title, skills: [
      { skill_id, skill_description, subskills: [
        { subskill_id, subskill_description, difficulty_start, difficulty_end, target_difficulty }
      ]}
    ]}
  ],
  subskill_index: { [subskill_id]: { unit_id, unit_title, skill_id, skill_description, subskill_description, ... } },
  stats: { total_units, total_skills, total_subskills, avg_target_difficulty, ... }
}
```

**Backend hierarchy format** (returned by `get_curriculum()`):
```
[{ id, title, grade, subject, skills: [{ id, description, subskills: [{ id, description, difficulty_range: {start, end, target} }] }] }]
```

**API access:** Read-only curriculum endpoints are **public** (no auth required). The `public_router` in `curriculum.py` serves subjects, hierarchy, subskills, objectives, stats, and health without Firebase tokens. Admin/write endpoints (upload, refresh-cache, files, preview) remain behind `get_user_context` auth.

**Key files:**
| File | Purpose |
|------|---------|
| `backend/app/services/curriculum_service.py` | `CurriculumService` — all curriculum queries |
| `backend/app/api/endpoints/curriculum.py` | `public_router` (reads, no auth) + `router` (writes, auth required) |
| `backend/app/db/firestore_service.py` | `FirestoreService.get_published_curriculum()`, `get_all_published_subjects()` |

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

---

## Command: `list` (default, no arguments)

List all published subjects with summary counts.

### Step 1: Call the backend endpoint

```bash
curl -s http://localhost:8000/api/curriculum/subjects | python -m json.tool
```

**Fallback:** Read the service code and Firestore directly if the server isn't running. Use `CurriculumService.get_available_subjects()` logic — iterate `curriculum_published` collection.

### Step 2: For each subject, get stats

```bash
curl -s http://localhost:8000/api/curriculum/stats | python -m json.tool
```

Or per-subject: `curl -s http://localhost:8000/api/curriculum/stats?subject=Mathematics`

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

**Fallback:** Read Firestore doc directly — `curriculum_published/{grade}/subjects/{SUBJECT_ID}`, parse the `curriculum` array.

### Step 2: Present as indented tree

```
## Mathematics (Grade 1) — 8 units, 24 skills, 96 subskills

📦 COUNT001 · Counting and Cardinality
  ├─ COUNT001-01 · Count objects to 10
  │   ├─ COUNT001-01-A · One-to-one correspondence (1.0–2.0, target: 1.5)
  │   ├─ COUNT001-01-B · Counting sequence to 10 (1.0–2.0, target: 1.5)
  │   └─ COUNT001-01-C · Cardinality principle (1.5–2.5, target: 2.0)
  ├─ COUNT001-02 · Count objects to 20
  │   ├─ COUNT001-02-A · ...
  │   └─ COUNT001-02-B · ...
  └─ COUNT001-03 · Compare quantities
      └─ ...

📦 ARITH001 · Addition and Subtraction
  ├─ ARITH001-01 · Add within 10
  │   └─ ...
  └─ ...
```

**If `--unit UNIT_ID` is specified:** Only expand that unit, collapse others to one-line summaries:

```
## Mathematics (Grade 1)

  COUNT001 · Counting and Cardinality (3 skills, 9 subskills)
📦 ARITH001 · Addition and Subtraction
  ├─ ARITH001-01 · Add within 10
  │   ├─ ARITH001-01-A · Combine sets (1.0–2.0, target: 1.5)
  │   └─ ...
  └─ ...
  GEOM001 · Geometry (4 skills, 16 subskills)
  ...
```

### Step 3: Summary footer

```
Total: 8 units → 24 skills → 96 subskills
Difficulty range: 1.0–5.0 (avg target: 3.2)
```

---

## Command: `lookup`

Find where a subskill sits in the hierarchy.

### Step 1: Look up metadata

There is no dedicated subskill lookup endpoint. Instead:

1. **Infer subject from the subskill ID prefix** (e.g. `ARITH001-03-B` → look in Mathematics).
2. **Fetch the full curriculum** for that subject via `GET /api/curriculum/curriculum/{subject}`.
3. **Walk the hierarchy** to find the matching subskill and extract its unit/skill context.

**Alternative:** Read `CurriculumService.get_subskill_metadata(subskill_id)` logic — it searches the `subskill_index` map in the Firestore doc across all published subjects.

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

### Step 3: Show siblings (other subskills under the same skill)

Fetch the full curriculum for the subject, find the matching skill, list all its subskills with the current one highlighted:

```
Siblings under ARITH001-03:
  ARITH001-03-A · Subtract using number line
  ARITH001-03-B · Subtract by counting back  ← this one
  ARITH001-03-C · Subtract using ten frames
```

---

## Command: `stats`

Show curriculum statistics.

### Step 1: Fetch stats

```bash
# All subjects
curl -s http://localhost:8000/api/curriculum/stats | python -m json.tool

# One subject
curl -s "http://localhost:8000/api/curriculum/stats?subject=Mathematics" | python -m json.tool
```

### Step 2: Present

**All subjects:**
```
## Curriculum Stats

| Subject       | Grade | Units | Skills | Subskills | Avg Difficulty | Difficulty Range |
|---------------|-------|-------|--------|-----------|----------------|------------------|
| Mathematics   | 1     | 8     | 24     | 96        | 3.2            | 1.0–5.0          |
| Language Arts | 1     | 6     | 18     | 72        | 2.8            | 1.0–4.5          |
| Totals        | —     | 14    | 42     | 168       | 3.0            | 1.0–5.0          |
```

**Single subject:**
```
## Mathematics Stats

Units: 8
Skills: 24
Subskills: 96
Avg target difficulty: 3.2
Difficulty range: 1.0–5.0

Unit breakdown:
| Unit ID   | Unit Title                  | Skills | Subskills |
|-----------|-----------------------------|--------|-----------|
| COUNT001  | Counting and Cardinality    | 3      | 9         |
| ARITH001  | Addition and Subtraction    | 5      | 20        |
| ...       | ...                         | ...    | ...       |
```

---

## Checklist

- [ ] Parsed command and target from arguments
- [ ] For `list`: fetched all subjects and stats, presented as table
- [ ] For `tree`: fetched curriculum hierarchy, presented as indented tree
- [ ] For `tree --unit`: filtered to specified unit, collapsed others
- [ ] For `lookup`: found subskill metadata, showed hierarchy path and siblings
- [ ] For `stats`: fetched and presented curriculum statistics
- [ ] Used backend endpoints when server is running, Firestore/code fallback otherwise
