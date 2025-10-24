# Version Control Fix - Implementation Summary

## Problem Fixed

The curriculum authoring service was creating a **new version_id** for every unit, skill, or subskill created, leading to version_id mismatches. This caused:
- New curriculum entities to be invisible in the `analytics.curriculum` view
- Prerequisites unable to reference entities across different versions
- Manual SQL migrations required to fix data inconsistencies

## Root Cause

The API endpoints were calling `version_control.create_version()` for **every** CRUD operation, creating new draft versions instead of reusing the existing active version.

### Before (Problematic Code):
```python
# curriculum.py:139-142
draft_version = await version_control.create_version(
    VersionCreate(subject_id=unit.subject_id, description="Add unit"),
    "local-dev-user"
)
```

This created a NEW version_id each time, causing mismatches.

## Solution Implemented

### 1. Added `get_or_create_active_version()` Method

**File**: [version_control.py:87-119](curriculum-authoring-service/app/services/version_control.py#L87-L119)

```python
async def get_or_create_active_version(self, subject_id: str, user_id: str) -> str:
    """
    Get active version_id for a subject, or create one if none exists.
    This ensures all new entities use the same version_id.
    """
    active_version = await self.get_active_version(subject_id)

    if active_version:
        return active_version.version_id

    # Create initial version 1 if none exists
    # ... (see implementation)
```

### 2. Updated All CREATE Endpoints

Updated the following endpoints to use `get_or_create_active_version()`:

- [curriculum.py:64-67](curriculum-authoring-service/app/api/curriculum.py#L64-L67) - `create_subject()`
- [curriculum.py:139-142](curriculum-authoring-service/app/api/curriculum.py#L139-L142) - `create_unit()`
- [curriculum.py:209-212](curriculum-authoring-service/app/api/curriculum.py#L209-L212) - `create_skill()`
- [curriculum.py:322-325](curriculum-authoring-service/app/api/curriculum.py#L322-L325) - `create_subskill()`
- [prerequisites.py:122-125](curriculum-authoring-service/app/api/prerequisites.py#L122-L125) - `create_prerequisite()`

### After (Fixed Code):
```python
# curriculum.py:139-142 (updated)
version_id = await version_control.get_or_create_active_version(
    unit.subject_id,
    "local-dev-user"
)
```

Now all entities within a subject **reuse the same active version_id**.

## How It Works

### First Entity Creation (Subject)
1. User creates a new subject (e.g., "LANGUAGE_ARTS")
2. `get_or_create_active_version()` is called
3. No active version exists → Creates version 1 with `is_active=true`
4. Subject is created with this version_id

### Subsequent Entity Creations (Units, Skills, Subskills)
1. User creates a unit under "LANGUAGE_ARTS"
2. `get_or_create_active_version()` is called
3. Active version already exists → **Returns existing version_id**
4. Unit is created with the **same version_id** as the subject

### Result
✅ All entities for a subject now share the **same active version_id**
✅ Entities are visible in the `analytics.curriculum` view
✅ Prerequisites can properly reference entities
✅ No more manual SQL migrations needed

## Version Lifecycle

```
Subject Created → Version 1 (active)
   ↓
Unit Created → Uses Version 1 (same version_id)
   ↓
Skills Created → Uses Version 1 (same version_id)
   ↓
Subskills Created → Uses Version 1 (same version_id)
   ↓
Prerequisites Created → Uses Version 1 (same version_id)
```

All entities in draft mode share the same version_id until published.

## Publishing Workflow (Unchanged)

When you publish changes:
1. Call `/api/publishing/subjects/{subject_id}/publish`
2. All draft entities (`is_draft=true`) are marked as published (`is_draft=false`)
3. The version becomes active and visible in analytics views

## Testing the Fix

### 1. Start the Service

```bash
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

### 2. Test Version Consistency

#### Create a New Subject
```bash
curl -X POST http://localhost:8001/api/curriculum/subjects \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "TEST_SUBJECT",
    "subject_name": "Test Subject",
    "description": "Testing version control",
    "grade_level": "K"
  }'
```

**Expected**: Response includes a `version_id` field.

#### Create Multiple Units
```bash
# Unit 1
curl -X POST http://localhost:8001/api/curriculum/units \
  -H "Content-Type: application/json" \
  -d '{
    "unit_id": "TEST_UNIT_1",
    "unit_title": "Test Unit 1",
    "subject_id": "TEST_SUBJECT",
    "unit_order": 1,
    "description": "First test unit"
  }'

# Unit 2
curl -X POST http://localhost:8001/api/curriculum/units \
  -H "Content-Type: application/json" \
  -d '{
    "unit_id": "TEST_UNIT_2",
    "unit_title": "Test Unit 2",
    "subject_id": "TEST_SUBJECT",
    "unit_order": 2,
    "description": "Second test unit"
  }'

# Unit 3
curl -X POST http://localhost:8001/api/curriculum/units \
  -H "Content-Type: application/json" \
  -d '{
    "unit_id": "TEST_UNIT_3",
    "unit_title": "Test Unit 3",
    "subject_id": "TEST_SUBJECT",
    "unit_order": 3,
    "description": "Third test unit"
  }'
```

#### Verify Version Consistency
```bash
curl http://localhost:8001/api/curriculum/subjects/TEST_SUBJECT/units?include_drafts=true
```

**Expected Result**: All 3 units have the **same version_id** value.

### 3. Verify in BigQuery

```sql
-- Check that all entities have the same version_id
SELECT
  'subjects' as table_name,
  version_id,
  COUNT(*) as count
FROM `your-project.curriculum_authoring.curriculum_subjects`
WHERE subject_id = 'TEST_SUBJECT'
GROUP BY version_id

UNION ALL

SELECT
  'units' as table_name,
  version_id,
  COUNT(*) as count
FROM `your-project.curriculum_authoring.curriculum_units`
WHERE subject_id = 'TEST_SUBJECT'
GROUP BY version_id;
```

**Expected**: Both queries return the **same version_id**.

### 4. Test Publishing

```bash
# Publish the subject
curl -X POST http://localhost:8001/api/publishing/subjects/TEST_SUBJECT/publish \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "TEST_SUBJECT",
    "version_description": "Initial test version",
    "change_summary": "Created test subject with 3 units"
  }'
```

**Expected**: All entities are marked as `is_draft=false` and visible in analytics views.

## Verification Checklist

After implementing this fix:

- [x] Added `get_or_create_active_version()` to version_control.py
- [x] Updated `create_subject()` endpoint
- [x] Updated `create_unit()` endpoint
- [x] Updated `create_skill()` endpoint
- [x] Updated `create_subskill()` endpoint
- [x] Updated `create_prerequisite()` endpoint
- [ ] Tested creating multiple entities in same subject
- [ ] Verified all entities share same version_id
- [ ] Tested publishing workflow
- [ ] Verified entities appear in analytics views after publish

## Impact

### Before Fix
- ❌ Each entity creation created a new version_id
- ❌ Entities scattered across multiple versions
- ❌ New entities invisible in analytics views
- ❌ Manual SQL migrations required

### After Fix
- ✅ All entities share the same active version_id
- ✅ Version consistency maintained automatically
- ✅ Entities visible in analytics views
- ✅ No manual interventions needed

## Next Steps

1. **Test the fix** with the provided test cases
2. **Run the migration script** (if you have existing data with version mismatches):
   - Follow instructions in [README_CURRICULUM_FIX.md](../../backend/scripts/README_CURRICULUM_FIX.md)
3. **Monitor version consistency** with the verification queries
4. **Update frontend** (optional) to display active version info to users

## Files Modified

1. `curriculum-authoring-service/app/services/version_control.py` - Added `get_or_create_active_version()`
2. `curriculum-authoring-service/app/api/curriculum.py` - Updated all create endpoints
3. `curriculum-authoring-service/app/api/prerequisites.py` - Updated prerequisite creation

## Related Documentation

- [VERSION_CONTROL_IMPLEMENTATION_GUIDE.md](VERSION_CONTROL_IMPLEMENTATION_GUIDE.md) - Full implementation guide
- [README_CURRICULUM_FIX.md](../../backend/scripts/README_CURRICULUM_FIX.md) - Migration guide for existing data
- [CURRICULUM_INTEGRATION_GUIDE.md](../../backend/scripts/CURRICULUM_INTEGRATION_GUIDE.md) - Integration guide
