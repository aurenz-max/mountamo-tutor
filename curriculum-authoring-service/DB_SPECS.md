# Curriculum Authoring Service - Database Specifications

**Version:** 1.0
**Date:** 2025-10-18
**Database:** Google BigQuery
**Primary Goal:** Iterate on curriculum designs and improve prerequisite linking across units, skills, and subskills

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Schema Design](#schema-design)
4. [Data Model & Relationships](#data-model--relationships)
5. [Versioning & Draft System](#versioning--draft-system)
6. [Key Operations](#key-operations)
7. [Prerequisites & Learning Paths](#prerequisites--learning-paths)
8. [Performance & Best Practices](#performance--best-practices)
9. [Setup & Migration](#setup--migration)

---

## Overview

### Purpose

The Curriculum Authoring Service provides a structured, version-controlled system for creating and managing educational curricula. The database supports:

- **Hierarchical curriculum structure**: Subjects → Units → Skills → Subskills
- **Flexible prerequisite relationships**: Polymorphic links between skills and subskills
- **Version control**: Draft/publish workflow with complete version history
- **Iterative improvement**: Safe experimentation with curriculum changes before publishing
- **Learning path optimization**: Graph-based prerequisite tracking with cycle detection

### Technology Stack

- **Database**: Google BigQuery
- **Dataset**: `curriculum_authoring`
- **Access Pattern**: Primarily read-heavy with batch writes
- **Consistency Model**: Atomic operations using DML (INSERT, MERGE, DELETE)

---

## Architecture

### BigQuery Configuration

```yaml
Project ID: {GOOGLE_CLOUD_PROJECT}
Dataset ID: curriculum_authoring
Tables: 6 core tables
Write Pattern: DML operations (INSERT, MERGE, DELETE)
```

### Table Overview

| Table | Purpose | Primary Key | Relationships |
|-------|---------|-------------|---------------|
| `curriculum_subjects` | Top-level curriculum subjects | `subject_id` | Parent to units |
| `curriculum_units` | Learning units within subjects | `unit_id` | Child of subject, parent to skills |
| `curriculum_skills` | Skills within units | `skill_id` | Child of unit, parent to subskills |
| `curriculum_subskills` | Granular learning objectives | `subskill_id` | Child of skill |
| `curriculum_prerequisites` | Prerequisite relationships | `prerequisite_id` | Polymorphic (skills & subskills) |
| `curriculum_versions` | Version control records | `version_id` | Tracks subject versions |

---

## Schema Design

### 1. curriculum_subjects

Defines top-level curriculum subjects (e.g., "3rd Grade Math", "Algebra I").

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `subject_id` | STRING | REQUIRED | Unique identifier (UUID or semantic ID) |
| `subject_name` | STRING | REQUIRED | Human-readable subject name |
| `description` | STRING | NULLABLE | Detailed subject description |
| `grade_level` | STRING | NULLABLE | Target grade level (e.g., "3", "K", "9-12") |
| `version_id` | STRING | REQUIRED | FK to curriculum_versions |
| `is_active` | BOOLEAN | REQUIRED | Whether this is the active published version |
| `is_draft` | BOOLEAN | REQUIRED | Whether this is a draft (unpublished) record |
| `created_at` | TIMESTAMP | REQUIRED | Record creation timestamp (UTC) |
| `updated_at` | TIMESTAMP | REQUIRED | Last modification timestamp (UTC) |
| `created_by` | STRING | NULLABLE | User ID of creator |

**Business Rules:**
- Only one active version per `subject_id` at a time
- Draft records can coexist with active records during editing
- `is_active=true` implies `is_draft=false`

**Example:**
```json
{
  "subject_id": "math-grade-3",
  "subject_name": "3rd Grade Mathematics",
  "description": "Common Core aligned 3rd grade math curriculum",
  "grade_level": "3",
  "version_id": "v1-abc123",
  "is_active": true,
  "is_draft": false,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z",
  "created_by": "teacher-123"
}
```

---

### 2. curriculum_units

Organizational units within a subject (e.g., "Place Value", "Fractions").

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `unit_id` | STRING | REQUIRED | Unique identifier |
| `subject_id` | STRING | REQUIRED | FK to curriculum_subjects |
| `unit_title` | STRING | REQUIRED | Unit name/title |
| `unit_order` | INTEGER | NULLABLE | Display/sequence order (nullable for flexibility) |
| `description` | STRING | NULLABLE | Unit description or learning objectives |
| `version_id` | STRING | REQUIRED | FK to curriculum_versions |
| `is_draft` | BOOLEAN | REQUIRED | Draft status |
| `created_at` | TIMESTAMP | REQUIRED | Creation timestamp |
| `updated_at` | TIMESTAMP | REQUIRED | Last update timestamp |

**Business Rules:**
- All units must belong to a subject (`subject_id` FK constraint)
- `unit_order` can be NULL to allow flexible ordering
- Deleting a unit should cascade to dependent skills

**Example:**
```json
{
  "unit_id": "unit-fractions-intro",
  "subject_id": "math-grade-3",
  "unit_title": "Introduction to Fractions",
  "unit_order": 1,
  "description": "Understanding parts of a whole",
  "version_id": "v1-abc123",
  "is_draft": false,
  "created_at": "2025-01-15T10:05:00Z",
  "updated_at": "2025-01-15T10:05:00Z"
}
```

---

### 3. curriculum_skills

Skills or learning objectives within a unit.

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `skill_id` | STRING | REQUIRED | Unique identifier |
| `unit_id` | STRING | REQUIRED | FK to curriculum_units |
| `skill_description` | STRING | REQUIRED | Skill statement/description |
| `skill_order` | INTEGER | NULLABLE | Display order within unit |
| `version_id` | STRING | REQUIRED | FK to curriculum_versions |
| `is_draft` | BOOLEAN | REQUIRED | Draft status |
| `created_at` | TIMESTAMP | REQUIRED | Creation timestamp |
| `updated_at` | TIMESTAMP | REQUIRED | Last update timestamp |

**Business Rules:**
- Must belong to a unit (`unit_id` FK)
- Can have prerequisite relationships with other skills or subskills
- Deleting a skill should cascade to dependent subskills

**Example:**
```json
{
  "skill_id": "skill-identify-fractions",
  "unit_id": "unit-fractions-intro",
  "skill_description": "Identify and name fractions (halves, thirds, fourths)",
  "skill_order": 1,
  "version_id": "v1-abc123",
  "is_draft": false,
  "created_at": "2025-01-15T10:10:00Z",
  "updated_at": "2025-01-15T10:10:00Z"
}
```

---

### 4. curriculum_subskills

Granular, measurable learning objectives within a skill.

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `subskill_id` | STRING | REQUIRED | Unique identifier |
| `skill_id` | STRING | REQUIRED | FK to curriculum_skills |
| `subskill_description` | STRING | REQUIRED | Specific learning objective |
| `subskill_order` | INTEGER | NULLABLE | Display order within skill |
| `difficulty_start` | FLOAT | NULLABLE | Starting difficulty level (0.0-1.0) |
| `difficulty_end` | FLOAT | NULLABLE | Ending difficulty level (0.0-1.0) |
| `target_difficulty` | FLOAT | NULLABLE | Target mastery difficulty (0.0-1.0) |
| `version_id` | STRING | REQUIRED | FK to curriculum_versions |
| `is_draft` | BOOLEAN | REQUIRED | Draft status |
| `created_at` | TIMESTAMP | REQUIRED | Creation timestamp |
| `updated_at` | TIMESTAMP | REQUIRED | Last update timestamp |

**Business Rules:**
- Must belong to a skill (`skill_id` FK)
- Difficulty values represent progression within the subskill
- `difficulty_start` ≤ `target_difficulty` ≤ `difficulty_end`
- Can have prerequisite relationships with other subskills or skills

**Example:**
```json
{
  "subskill_id": "subskill-halves-visual",
  "skill_id": "skill-identify-fractions",
  "subskill_description": "Identify halves using visual models",
  "subskill_order": 1,
  "difficulty_start": 0.2,
  "difficulty_end": 0.5,
  "target_difficulty": 0.4,
  "version_id": "v1-abc123",
  "is_draft": false,
  "created_at": "2025-01-15T10:15:00Z",
  "updated_at": "2025-01-15T10:15:00Z"
}
```

---

### 5. curriculum_prerequisites

Defines prerequisite relationships between skills and subskills (polymorphic).

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `prerequisite_id` | STRING | REQUIRED | Unique identifier (UUID) |
| `prerequisite_entity_id` | STRING | REQUIRED | ID of prerequisite (skill_id or subskill_id) |
| `prerequisite_entity_type` | STRING | REQUIRED | Type: 'skill' or 'subskill' |
| `unlocks_entity_id` | STRING | REQUIRED | ID of unlocked entity (skill_id or subskill_id) |
| `unlocks_entity_type` | STRING | REQUIRED | Type: 'skill' or 'subskill' |
| `min_proficiency_threshold` | FLOAT | NULLABLE | Minimum proficiency required (0.0-1.0, default 0.8) |
| `version_id` | STRING | REQUIRED | FK to curriculum_versions |
| `is_draft` | BOOLEAN | REQUIRED | Draft status |
| `created_at` | TIMESTAMP | REQUIRED | Creation timestamp |

**Business Rules:**
- **Polymorphic relationship**: Both prerequisite and unlocked entities can be skills OR subskills
- **Cycle detection**: System must prevent circular dependencies
- **Valid combinations**:
  - Skill → Skill
  - Skill → Subskill
  - Subskill → Skill
  - Subskill → Subskill
- **Proficiency threshold**: Default 0.8 (80% mastery)

**Example:**
```json
{
  "prerequisite_id": "prereq-001",
  "prerequisite_entity_id": "subskill-halves-visual",
  "prerequisite_entity_type": "subskill",
  "unlocks_entity_id": "subskill-halves-numeric",
  "unlocks_entity_type": "subskill",
  "min_proficiency_threshold": 0.8,
  "version_id": "v1-abc123",
  "is_draft": false,
  "created_at": "2025-01-15T10:20:00Z"
}
```

**Prerequisite Graph Example:**

```
subskill-halves-visual (0.8) → subskill-halves-numeric
subskill-halves-numeric (0.8) → skill-compare-fractions
skill-compare-fractions (0.85) → skill-order-fractions
```

---

### 6. curriculum_versions

Version control tracking for curriculum changes.

| Field | Type | Mode | Description |
|-------|------|------|-------------|
| `version_id` | STRING | REQUIRED | Unique identifier (UUID) |
| `subject_id` | STRING | REQUIRED | FK to curriculum_subjects |
| `version_number` | INTEGER | REQUIRED | Sequential version number (1, 2, 3...) |
| `description` | STRING | NULLABLE | Version description |
| `is_active` | BOOLEAN | REQUIRED | Whether this is the active published version |
| `created_at` | TIMESTAMP | REQUIRED | Version creation timestamp |
| `activated_at` | TIMESTAMP | NULLABLE | When this version was activated |
| `created_by` | STRING | NULLABLE | User ID of version creator |
| `change_summary` | STRING | NULLABLE | Summary of changes in this version |

**Business Rules:**
- Only one active version per subject at a time
- `version_number` auto-increments per subject
- Cannot delete versions (audit trail)
- Rollback creates a new version with old data

**Example:**
```json
{
  "version_id": "v2-xyz789",
  "subject_id": "math-grade-3",
  "version_number": 2,
  "description": "Added fractions unit and prerequisite links",
  "is_active": true,
  "created_at": "2025-01-20T14:00:00Z",
  "activated_at": "2025-01-20T14:05:00Z",
  "created_by": "teacher-123",
  "change_summary": "15 changes: 1 unit added, 8 skills updated, 6 prerequisites added"
}
```

---

## Data Model & Relationships

### Entity Hierarchy

```
Subject (1)
  └─ Unit (N)
      └─ Skill (N)
          └─ Subskill (N)
```

### Entity-Relationship Diagram

```
┌─────────────────────┐
│  curriculum_subjects│
│  - subject_id (PK)  │
│  - version_id (FK)  │
│  - is_active        │
│  - is_draft         │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│  curriculum_units   │
│  - unit_id (PK)     │
│  - subject_id (FK)  │
│  - version_id (FK)  │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│  curriculum_skills  │
│  - skill_id (PK)    │
│  - unit_id (FK)     │
│  - version_id (FK)  │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐         ┌─────────────────────────┐
│curriculum_subskills │◄────────┤curriculum_prerequisites │
│  - subskill_id (PK) │  N:N    │  - prerequisite_id (PK) │
│  - skill_id (FK)    │         │  - prereq_entity_id     │
│  - version_id (FK)  │         │  - prereq_entity_type   │
└─────────────────────┘         │  - unlocks_entity_id    │
                                │  - unlocks_entity_type  │
                                │  - version_id (FK)      │
                                └─────────────────────────┘

┌─────────────────────┐
│curriculum_versions  │
│  - version_id (PK)  │
│  - subject_id (FK)  │
│  - version_number   │
│  - is_active        │
└─────────────────────┘
```

### Referential Integrity

**Foreign Key Relationships:**

1. `curriculum_units.subject_id` → `curriculum_subjects.subject_id`
2. `curriculum_skills.unit_id` → `curriculum_units.unit_id`
3. `curriculum_subskills.skill_id` → `curriculum_skills.skill_id`
4. All tables' `version_id` → `curriculum_versions.version_id`
5. `curriculum_prerequisites` (polymorphic):
   - `prerequisite_entity_id` → `curriculum_skills.skill_id` OR `curriculum_subskills.subskill_id`
   - `unlocks_entity_id` → `curriculum_skills.skill_id` OR `curriculum_subskills.subskill_id`

**Note:** BigQuery does not enforce FK constraints; application logic must maintain integrity.

---

## Versioning & Draft System

### Draft/Publish Workflow

The system uses a **dual-state model** to support iterative curriculum development:

#### States

1. **Draft** (`is_draft=true`): Work-in-progress changes, not visible to production
2. **Published** (`is_draft=false`): Active curriculum content

#### Workflow Steps

```
1. Create Draft
   ├─ Create new version record (is_active=false)
   ├─ Copy or create entities with is_draft=true
   └─ Associate all changes with new version_id

2. Edit Draft
   ├─ Modify draft entities (is_draft=true)
   ├─ Add/remove prerequisite relationships
   └─ Validate changes (no circular dependencies)

3. Publish Draft
   ├─ Validate all draft changes
   ├─ Deactivate current version (is_active=false)
   ├─ Mark new version as active (is_active=true)
   ├─ Set all draft entities to is_draft=false
   └─ Record activation timestamp

4. Rollback (if needed)
   ├─ Deactivate current version
   └─ Activate previous version
```

### Version Control Examples

#### Creating a Draft

```sql
-- 1. Create version record
INSERT INTO `curriculum_versions` (
  version_id, subject_id, version_number,
  is_active, created_at, created_by
)
VALUES (
  'v2-draft', 'math-grade-3', 2,
  false, CURRENT_TIMESTAMP(), 'teacher-123'
);

-- 2. Create draft entities
INSERT INTO `curriculum_units` (
  unit_id, subject_id, unit_title,
  version_id, is_draft, created_at, updated_at
)
VALUES (
  'unit-new', 'math-grade-3', 'New Unit',
  'v2-draft', true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
);
```

#### Publishing a Draft

```sql
-- 1. Deactivate current version (old records, safe to update)
MERGE `curriculum_versions` AS T
USING (
  SELECT version_id
  FROM `curriculum_versions`
  WHERE subject_id = 'math-grade-3' AND is_active = true
) AS S
ON T.version_id = S.version_id
WHEN MATCHED THEN
  UPDATE SET T.is_active = false;

-- 2. Activate new version (newly created, safe to update)
UPDATE `curriculum_versions`
SET is_active = true, activated_at = CURRENT_TIMESTAMP()
WHERE version_id = 'v2-draft';

-- 3. Publish draft entities
MERGE `curriculum_units` AS T
USING (
  SELECT * FROM `curriculum_units`
  WHERE is_draft = true AND version_id = 'v2-draft'
) AS S
ON T.unit_id = S.unit_id
WHEN MATCHED THEN
  UPDATE SET T.is_draft = false;
```

### Version History

All versions are preserved for audit and rollback:

```sql
SELECT
  version_number,
  description,
  is_active,
  created_at,
  activated_at,
  change_summary
FROM `curriculum_versions`
WHERE subject_id = 'math-grade-3'
ORDER BY version_number DESC;
```

**Result:**
```
version_number | description              | is_active | created_at  | activated_at
-----------------------------------------------------------------------------
3              | Added prerequisites      | true      | 2025-01-25  | 2025-01-25
2              | Added fractions unit     | false     | 2025-01-20  | 2025-01-20
1              | Initial curriculum       | false     | 2025-01-15  | 2025-01-15
```

---

## Key Operations

### CRUD Patterns

All operations use DML (INSERT, MERGE, DELETE) for consistency.

#### Create Operations

**Pattern:**
```sql
INSERT INTO `{table}` ({fields})
VALUES ({values})
```

**Example: Create Skill**
```sql
INSERT INTO `curriculum_skills` (
  skill_id, unit_id, skill_description, skill_order,
  version_id, is_draft, created_at, updated_at
)
VALUES (
  @skill_id, @unit_id, @skill_description, @skill_order,
  @version_id, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
);
```

#### Read Operations

**Get Curriculum Tree (Optimized Single Query):**
```sql
SELECT
  u.unit_id, u.unit_title, u.unit_order,
  sk.skill_id, sk.skill_description, sk.skill_order,
  sub.subskill_id, sub.subskill_description, sub.subskill_order,
  sub.difficulty_start, sub.difficulty_end
FROM `curriculum_units` u
LEFT JOIN `curriculum_skills` sk ON u.unit_id = sk.unit_id
LEFT JOIN `curriculum_subskills` sub ON sk.skill_id = sub.skill_id
WHERE u.subject_id = @subject_id
  AND u.is_draft = false
  AND (sk.is_draft = false OR sk.is_draft IS NULL)
  AND (sub.is_draft = false OR sub.is_draft IS NULL)
ORDER BY u.unit_order, sk.skill_order, sub.subskill_order;
```

**Get Entity Prerequisites (Optimized with UNION):**
```sql
-- Get both prerequisites and unlocks in one query
SELECT *, 'prerequisite' as relationship_type
FROM `curriculum_prerequisites`
WHERE unlocks_entity_id = @entity_id
  AND unlocks_entity_type = @entity_type
  AND is_draft = false

UNION ALL

SELECT *, 'unlocks' as relationship_type
FROM `curriculum_prerequisites`
WHERE prerequisite_entity_id = @entity_id
  AND prerequisite_entity_type = @entity_type
  AND is_draft = false;
```

#### Update Operations

**Pattern: Atomic MERGE (upsert)**
```sql
MERGE `{table}` AS T
USING (SELECT @id AS id_key) AS S
ON T.{id_field} = S.id_key
WHEN MATCHED THEN
  UPDATE SET {update_clauses}
WHEN NOT MATCHED THEN
  INSERT ({fields}) VALUES ({values});
```

**Example: Update Subskill**
```sql
MERGE `curriculum_subskills` AS T
USING (SELECT @subskill_id AS subskill_id_key) AS S
ON T.subskill_id = S.subskill_id_key
WHEN MATCHED THEN
  UPDATE SET
    T.subskill_description = @subskill_description,
    T.difficulty_start = @difficulty_start,
    T.difficulty_end = @difficulty_end,
    T.target_difficulty = @target_difficulty,
    T.updated_at = CURRENT_TIMESTAMP(),
    T.is_draft = true,
    T.version_id = @version_id
WHEN NOT MATCHED THEN
  INSERT (subskill_id, skill_id, subskill_description,
          difficulty_start, difficulty_end, target_difficulty,
          version_id, is_draft, created_at, updated_at)
  VALUES (@subskill_id, @skill_id, @subskill_description,
          @difficulty_start, @difficulty_end, @target_difficulty,
          @version_id, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
```

#### Delete Operations

**Pattern:**
```sql
DELETE FROM `{table}`
WHERE {id_field} = @id;
```

**Example: Delete Unit (cascading handled by application)**
```sql
-- 1. Delete subskills in this unit
DELETE FROM `curriculum_subskills`
WHERE skill_id IN (
  SELECT skill_id FROM `curriculum_skills`
  WHERE unit_id = @unit_id
);

-- 2. Delete skills in this unit
DELETE FROM `curriculum_skills`
WHERE unit_id = @unit_id;

-- 3. Delete unit
DELETE FROM `curriculum_units`
WHERE unit_id = @unit_id;
```

---

## Prerequisites & Learning Paths

### Polymorphic Prerequisite System

The prerequisite table supports flexible relationships between any curriculum entities.

#### Relationship Types

| Prerequisite Type | Unlocks Type | Use Case |
|-------------------|--------------|----------|
| Skill → Skill | Master one skill to unlock another |
| Skill → Subskill | Broad skill required for specific objective |
| Subskill → Skill | Specific foundation for broader skill |
| Subskill → Subskill | Granular skill progression |

#### Creating Prerequisites

```sql
INSERT INTO `curriculum_prerequisites` (
  prerequisite_id,
  prerequisite_entity_id, prerequisite_entity_type,
  unlocks_entity_id, unlocks_entity_type,
  min_proficiency_threshold,
  version_id, is_draft, created_at
)
VALUES (
  @prerequisite_id,
  'skill-add-fractions', 'skill',
  'skill-subtract-fractions', 'skill',
  0.8,
  @version_id, true, CURRENT_TIMESTAMP()
);
```

### Cycle Detection

**Problem:** Prevent circular dependencies (A requires B, B requires A).

**Solution:** Depth-first search validation before creating prerequisites.

#### Algorithm (Implemented in Application Layer)

```python
async def has_path(from_id: str, to_id: str, visited: set) -> bool:
    """Check if there's a path from from_id to to_id"""
    if from_id == to_id:
        return True  # Cycle detected!

    if from_id in visited:
        return False

    visited.add(from_id)

    # Get all entities that from_id unlocks
    query = """
    SELECT unlocks_entity_id
    FROM `curriculum_prerequisites`
    WHERE prerequisite_entity_id = @from_id
    """

    results = await execute_query(query, [from_id])

    for row in results:
        if await has_path(row['unlocks_entity_id'], to_id, visited):
            return True

    return False

# Before creating: A (prerequisite) → B (unlocks)
# Check if B has path to A (would create cycle)
has_cycle = await has_path(unlocks_entity_id, prerequisite_entity_id, set())
if has_cycle:
    raise ValueError("Circular dependency detected")
```

#### Validation Query

```sql
-- Find all entities with no prerequisites (base/starting skills)
WITH subject_entities AS (
  SELECT s.skill_id as entity_id, 'skill' as entity_type
  FROM `curriculum_skills` s
  JOIN `curriculum_units` u ON s.unit_id = u.unit_id
  WHERE u.subject_id = @subject_id AND s.is_draft = false

  UNION ALL

  SELECT ss.subskill_id as entity_id, 'subskill' as entity_type
  FROM `curriculum_subskills` ss
  JOIN `curriculum_skills` s ON ss.skill_id = s.skill_id
  JOIN `curriculum_units` u ON s.unit_id = u.unit_id
  WHERE u.subject_id = @subject_id AND ss.is_draft = false
),
entities_with_prereqs AS (
  SELECT DISTINCT unlocks_entity_id as entity_id
  FROM `curriculum_prerequisites`
  WHERE is_draft = false
)

SELECT se.*
FROM subject_entities se
LEFT JOIN entities_with_prereqs ewp ON se.entity_id = ewp.entity_id
WHERE ewp.entity_id IS NULL;  -- No prerequisites = base skills
```

### Prerequisite Graph

**Building Complete Graph:**

```sql
-- Get all entities
WITH skills AS (
  SELECT s.skill_id as id, 'skill' as type, s.skill_description as label
  FROM `curriculum_skills` s
  JOIN `curriculum_units` u ON s.unit_id = u.unit_id
  WHERE u.subject_id = @subject_id AND s.is_draft = false
),
subskills AS (
  SELECT ss.subskill_id as id, 'subskill' as type, ss.subskill_description as label
  FROM `curriculum_subskills` ss
  JOIN `curriculum_skills` s ON ss.skill_id = s.skill_id
  JOIN `curriculum_units` u ON s.unit_id = u.unit_id
  WHERE u.subject_id = @subject_id AND ss.is_draft = false
),
all_nodes AS (
  SELECT * FROM skills
  UNION ALL
  SELECT * FROM subskills
),
edges AS (
  SELECT
    prerequisite_entity_id as source,
    unlocks_entity_id as target,
    min_proficiency_threshold as threshold
  FROM `curriculum_prerequisites`
  WHERE is_draft = false
)

SELECT
  n.id, n.type, n.label,
  e.source, e.target, e.threshold
FROM all_nodes n
LEFT JOIN edges e ON n.id = e.source OR n.id = e.target;
```

**Graph Visualization Format:**

```json
{
  "nodes": [
    {"id": "skill-1", "type": "skill", "label": "Addition"},
    {"id": "skill-2", "type": "skill", "label": "Subtraction"}
  ],
  "edges": [
    {"source": "skill-1", "target": "skill-2", "threshold": 0.8}
  ]
}
```

---

## Performance & Best Practices

### BigQuery-Specific Patterns

#### 1. Streaming Buffer Handling

**Problem:** BigQuery's streaming buffer prevents immediate updates/deletes of recently inserted rows.

**Solution:** Use MERGE operations and avoid updating newly created records.

```sql
-- ✅ GOOD: Deactivate OLD versions first (not in buffer)
MERGE `curriculum_versions` AS T
USING (
  SELECT version_id FROM `curriculum_versions`
  WHERE subject_id = @subject_id AND is_active = true
) AS S
ON T.version_id = S.version_id
WHEN MATCHED THEN UPDATE SET T.is_active = false;

-- ✅ GOOD: Insert NEW version with final state (is_active=true)
INSERT INTO `curriculum_versions` (
  version_id, subject_id, is_active, created_at, activated_at
) VALUES (
  @new_version_id, @subject_id, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
);

-- ❌ BAD: Insert then immediately update (streaming buffer conflict)
INSERT INTO `curriculum_versions` (...) VALUES (...);
UPDATE `curriculum_versions` SET is_active = true WHERE version_id = @new_id;
```

#### 2. Batch Operations

**Prefer bulk inserts over individual row inserts:**

```python
# ✅ GOOD: Batch insert
rows = [
  {"skill_id": "1", "skill_description": "Skill 1", ...},
  {"skill_id": "2", "skill_description": "Skill 2", ...},
  # ... more rows
]
client.insert_rows_json(table_id, rows)

# ❌ BAD: Individual inserts
for skill in skills:
  client.insert_rows_json(table_id, [skill])
```

#### 3. Parameterized Queries

**Always use query parameters to prevent injection and enable query caching:**

```python
# ✅ GOOD
query = "SELECT * FROM curriculum_skills WHERE skill_id = @skill_id"
job_config = bigquery.QueryJobConfig(
    query_parameters=[
        bigquery.ScalarQueryParameter("skill_id", "STRING", "skill-123")
    ]
)
results = client.query(query, job_config=job_config)

# ❌ BAD: String interpolation
query = f"SELECT * FROM curriculum_skills WHERE skill_id = '{skill_id}'"
```

#### 4. Type Mapping

**BigQuery type parameter mapping:**

| Python Type | BigQuery Type | Parameter Type |
|-------------|---------------|----------------|
| `str` | `STRING` | `ScalarQueryParameter("key", "STRING", value)` |
| `int` | `INT64` | `ScalarQueryParameter("key", "INT64", value)` |
| `float` | `FLOAT64` | `ScalarQueryParameter("key", "FLOAT64", value)` |
| `bool` | `BOOL` | `ScalarQueryParameter("key", "BOOL", value)` |
| `datetime` | `TIMESTAMP` | `ScalarQueryParameter("key", "TIMESTAMP", value)` |

#### 5. JOIN Optimization

**Use LEFT JOINs for hierarchical queries (single query vs N+1):**

```sql
-- ✅ GOOD: Single query with JOINs
SELECT
  u.unit_id, u.unit_title,
  sk.skill_id, sk.skill_description,
  sub.subskill_id, sub.subskill_description
FROM curriculum_units u
LEFT JOIN curriculum_skills sk ON u.unit_id = sk.unit_id
LEFT JOIN curriculum_subskills sub ON sk.skill_id = sub.skill_id
WHERE u.subject_id = @subject_id;

-- ❌ BAD: N+1 queries
-- Query 1: Get units
-- Query 2: For each unit, get skills
-- Query 3: For each skill, get subskills
```

#### 6. Indexing (via Clustering/Partitioning)

**Recommended clustering:**

- `curriculum_subjects`: Cluster by `subject_id`
- `curriculum_units`: Cluster by `subject_id, unit_id`
- `curriculum_skills`: Cluster by `unit_id, skill_id`
- `curriculum_subskills`: Cluster by `skill_id, subskill_id`
- `curriculum_prerequisites`: Cluster by `version_id`
- `curriculum_versions`: Cluster by `subject_id, version_number`

**Implementation:**
```python
table = bigquery.Table(table_id, schema=schema)
table.clustering_fields = ["subject_id", "unit_id"]
table = client.create_table(table)
```

---

## Setup & Migration

### Initial Database Setup

#### 1. Environment Configuration

Create `.env` file:

```env
GOOGLE_CLOUD_PROJECT=your-project-id
BIGQUERY_DATASET_ID=curriculum_authoring
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

#### 2. Create Dataset

```bash
# Using gcloud CLI
gcloud config set project your-project-id
bq mk --dataset curriculum_authoring

# Or via Python
from google.cloud import bigquery

client = bigquery.Client(project="your-project-id")
dataset_id = f"{client.project}.curriculum_authoring"

dataset = bigquery.Dataset(dataset_id)
dataset.location = "US"
dataset = client.create_dataset(dataset, exists_ok=True)
```

#### 3. Create Tables

Run setup script:

```bash
cd curriculum-authoring-service
python scripts/setup_database.py
```

**Script creates all 6 tables with schemas defined in** `app/core/database.py`

#### 4. Verify Setup

```sql
-- Check dataset
SELECT * FROM `your-project.curriculum_authoring.__TABLES__`;

-- Check schema
SELECT column_name, data_type, is_nullable
FROM `your-project.curriculum_authoring.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'curriculum_subjects';
```

### Migration from Legacy Systems

If migrating from existing curriculum data:

#### Migration Script Pattern

```python
from app.core.database import db
from app.services.curriculum_manager import curriculum_manager
from app.services.version_control import version_control

async def migrate_legacy_curriculum():
    # 1. Create initial version
    version = await version_control.create_version(
        VersionCreate(
            subject_id="math-grade-3",
            description="Migration from legacy system"
        ),
        user_id="system-migration"
    )

    # 2. Migrate subjects
    for legacy_subject in legacy_subjects:
        subject = await curriculum_manager.create_subject(
            SubjectCreate(
                subject_id=legacy_subject['id'],
                subject_name=legacy_subject['name'],
                grade_level=legacy_subject['grade']
            ),
            user_id="system-migration",
            version_id=version.version_id
        )

    # 3. Migrate units, skills, subskills (similar pattern)
    # ...

    # 4. Publish initial version
    await version_control.publish(
        PublishRequest(
            subject_id="math-grade-3",
            version_description="Initial migration",
            change_summary="Migrated from legacy system"
        ),
        user_id="system-migration"
    )
```

### Data Validation Queries

#### Check Orphaned Records

```sql
-- Units without valid subjects
SELECT u.*
FROM `curriculum_units` u
LEFT JOIN `curriculum_subjects` s ON u.subject_id = s.subject_id
WHERE s.subject_id IS NULL;

-- Skills without valid units
SELECT sk.*
FROM `curriculum_skills` sk
LEFT JOIN `curriculum_units` u ON sk.unit_id = u.unit_id
WHERE u.unit_id IS NULL;

-- Prerequisites referencing non-existent entities
SELECT p.*
FROM `curriculum_prerequisites` p
LEFT JOIN `curriculum_skills` sk ON p.prerequisite_entity_id = sk.skill_id AND p.prerequisite_entity_type = 'skill'
LEFT JOIN `curriculum_subskills` ss ON p.prerequisite_entity_id = ss.subskill_id AND p.prerequisite_entity_type = 'subskill'
WHERE sk.skill_id IS NULL AND ss.subskill_id IS NULL;
```

#### Validate Version Consistency

```sql
-- Check for multiple active versions per subject
SELECT subject_id, COUNT(*) as active_count
FROM `curriculum_versions`
WHERE is_active = true
GROUP BY subject_id
HAVING COUNT(*) > 1;

-- Check for version_id mismatches
SELECT 'subjects' as table_name, COUNT(*) as orphaned
FROM `curriculum_subjects` cs
LEFT JOIN `curriculum_versions` cv ON cs.version_id = cv.version_id
WHERE cv.version_id IS NULL

UNION ALL

SELECT 'units', COUNT(*)
FROM `curriculum_units` cu
LEFT JOIN `curriculum_versions` cv ON cu.version_id = cv.version_id
WHERE cv.version_id IS NULL;
```

---

## Appendix: Common Queries

### Get All Subjects with Stats

```sql
SELECT
  s.subject_id,
  s.subject_name,
  s.grade_level,
  s.is_active,
  v.version_number,
  COUNT(DISTINCT u.unit_id) as unit_count,
  COUNT(DISTINCT sk.skill_id) as skill_count,
  COUNT(DISTINCT sub.subskill_id) as subskill_count
FROM `curriculum_subjects` s
LEFT JOIN `curriculum_versions` v ON s.version_id = v.version_id
LEFT JOIN `curriculum_units` u ON s.subject_id = u.subject_id AND u.is_draft = false
LEFT JOIN `curriculum_skills` sk ON u.unit_id = sk.unit_id AND sk.is_draft = false
LEFT JOIN `curriculum_subskills` sub ON sk.skill_id = sub.skill_id AND sub.is_draft = false
WHERE s.is_active = true
GROUP BY s.subject_id, s.subject_name, s.grade_level, s.is_active, v.version_number;
```

### Get Complete Skill Prerequisite Chain

```sql
-- Recursive CTE to get full prerequisite path for a skill
WITH RECURSIVE prereq_chain AS (
  -- Base case: direct prerequisites
  SELECT
    prerequisite_entity_id,
    prerequisite_entity_type,
    unlocks_entity_id,
    unlocks_entity_type,
    min_proficiency_threshold,
    1 as depth
  FROM `curriculum_prerequisites`
  WHERE unlocks_entity_id = @target_skill_id
    AND is_draft = false

  UNION ALL

  -- Recursive case: prerequisites of prerequisites
  SELECT
    p.prerequisite_entity_id,
    p.prerequisite_entity_type,
    p.unlocks_entity_id,
    p.unlocks_entity_type,
    p.min_proficiency_threshold,
    pc.depth + 1
  FROM `curriculum_prerequisites` p
  INNER JOIN prereq_chain pc
    ON p.unlocks_entity_id = pc.prerequisite_entity_id
  WHERE p.is_draft = false
    AND pc.depth < 10  -- Prevent infinite loops
)

SELECT * FROM prereq_chain
ORDER BY depth;
```

### Get Draft Change Summary

```sql
-- Summary of pending draft changes
SELECT
  'subjects' as entity_type,
  COUNT(*) as draft_count
FROM `curriculum_subjects`
WHERE is_draft = true AND subject_id = @subject_id

UNION ALL

SELECT 'units', COUNT(*)
FROM `curriculum_units`
WHERE is_draft = true AND subject_id = @subject_id

UNION ALL

SELECT 'skills', COUNT(*)
FROM `curriculum_skills` sk
JOIN `curriculum_units` u ON sk.unit_id = u.unit_id
WHERE sk.is_draft = true AND u.subject_id = @subject_id

UNION ALL

SELECT 'subskills', COUNT(*)
FROM `curriculum_subskills` ss
JOIN `curriculum_skills` sk ON ss.skill_id = sk.skill_id
JOIN `curriculum_units` u ON sk.unit_id = u.unit_id
WHERE ss.is_draft = true AND u.subject_id = @subject_id

UNION ALL

SELECT 'prerequisites', COUNT(*)
FROM `curriculum_prerequisites` p
WHERE p.is_draft = true
  AND p.version_id IN (
    SELECT version_id FROM `curriculum_subjects`
    WHERE subject_id = @subject_id
  );
```

---

## Contact & Support

**Service Owner:** Curriculum Development Team
**Database Location:** Google Cloud BigQuery
**Schema Version:** 1.0
**Last Updated:** 2025-10-18

For questions or issues, please contact your development lead or refer to the service documentation at `curriculum-authoring-service/README.md`.
