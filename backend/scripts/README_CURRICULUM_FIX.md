# Language Arts Curriculum Fix - Execution Guide

## Overview

This guide provides step-by-step instructions to fix the Language Arts curriculum version_id mismatch that prevented the 3 new units from appearing in the `analytics.curriculum` view.

## Problem Summary

- **Issue**: 3 new Language Arts units used `version_id = 1fd72ad8-347e-45d5-9b4c-3d1c01f3d211`
- **Expected**: Should use `version_id = 1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32` (same as the 7 original units)
- **Impact**: New units invisible in curriculum view, prerequisites couldn't reference them
- **Root Cause**: Curriculum authoring service lacks automatic version management

## Files Created

### 1. Migration Scripts
- **[fix_language_arts_versions.sql](./fix_language_arts_versions.sql)** - Migrates all 3 new units to correct version_id
- **[verify_curriculum_fixes.sql](./verify_curriculum_fixes.sql)** - Comprehensive verification tests

### 2. Updated Documentation
- **[CURRICULUM_INTEGRATION_GUIDE.md](./CURRICULUM_INTEGRATION_GUIDE.md)** - Fixed dataset references (analytics vs curriculum_authoring)
- **[create_curriculum_views.sql](./create_curriculum_views.sql)** - Updated comments for learning_paths

### 3. Developer Guidance
- **[VERSION_CONTROL_IMPLEMENTATION_GUIDE.md](../../curriculum-authoring-service/VERSION_CONTROL_IMPLEMENTATION_GUIDE.md)** - Complete implementation guide for curriculum service programmer

---

## Execution Steps

### Step 1: Backup Current State (Optional but Recommended)

```bash
# Export current state to JSON for rollback if needed
bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  mountamo-tutor-h7wnta:analytics.curriculum_units \
  gs://your-backup-bucket/curriculum_units_backup_$(date +%Y%m%d).json

bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  mountamo-tutor-h7wnta:analytics.curriculum_skills \
  gs://your-backup-bucket/curriculum_skills_backup_$(date +%Y%m%d).json

bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  mountamo-tutor-h7wnta:analytics.curriculum_subskills \
  gs://your-backup-bucket/curriculum_subskills_backup_$(date +%Y%m%d).json

bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  mountamo-tutor-h7wnta:analytics.curriculum_prerequisites \
  gs://your-backup-bucket/curriculum_prerequisites_backup_$(date +%Y%m%d).json
```

### Step 2: Run the Migration Script

**Option A: BigQuery Console (Recommended)**

1. Open [BigQuery Console](https://console.cloud.google.com/bigquery?project=mountamo-tutor-h7wnta)
2. Click "Compose new query"
3. Copy the entire contents of `fix_language_arts_versions.sql`
4. Paste into the query editor
5. Click "Run"
6. Wait for completion (should take ~10-30 seconds)

**Option B: bq CLI**

```bash
cd backend/scripts
bq query --use_legacy_sql=false < fix_language_arts_versions.sql
```

**Expected Output:**
```
Statement 1: X rows affected (Update units)
Statement 2: Y rows affected (Update skills)
Statement 3: Z rows affected (Update subskills)
Statement 4: W rows affected (Update prerequisites)
Statement 5: 1 row inserted (Create version entry)
Verification queries...
```

### Step 3: Verify the Fixes

**Run Verification Script:**

1. Open BigQuery Console
2. Copy contents of `verify_curriculum_fixes.sql`
3. Paste and run
4. Review all 10 test results

**Expected Results:**

✅ **TEST 1**: All entities show only version `1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32`
✅ **TEST 2**: Language Arts version 2 exists with `is_active = true`
✅ **TEST 3**: Curriculum view shows 10 units (7 old + 3 new)
✅ **TEST 4**: All 10 units are visible with their skills and subskills
✅ **TEST 5**: Language Arts prerequisites appear in learning_paths
✅ **TEST 6**: Mathematics curriculum unchanged
✅ **TEST 7**: No orphaned prerequisites (count = 0)
✅ **TEST 8**: Both MATHEMATICS and LANGUAGE_ARTS have active versions
✅ **TEST 9**: All subjects show 'MATCH ✓'
✅ **TEST 10**: Old version_id has 0 rows in all tables

### Step 4: Re-run ETL to Refresh Learning Paths

```bash
cd backend/scripts
python cosmos_to_bigquery_etl.py
```

This will refresh the `analytics.learning_paths` table with all prerequisites.

### Step 5: Test the Application

**Test Queries:**

```sql
-- Should return all 10 Language Arts units
SELECT * FROM `mountamo-tutor-h7wnta.analytics.curriculum`
WHERE subject = 'Language Arts'
ORDER BY unit_id;

-- Should include Language Arts prerequisites
SELECT * FROM `mountamo-tutor-h7wnta.analytics.learning_paths`
WHERE prerequisite_skill_id LIKE 'LANGUAGE_ARTS%'
   OR unlocks_skill_id LIKE 'LANGUAGE_ARTS%';
```

**Test Endpoints:**

```bash
# Test curriculum endpoint
curl http://localhost:8000/curriculum/subjects

# Test learning paths endpoint
curl http://localhost:8000/learning-paths/analytics
```

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback using the backups:

```bash
# Restore from backup
bq load --source_format=NEWLINE_DELIMITED_JSON \
  mountamo-tutor-h7wnta:analytics.curriculum_units \
  gs://your-backup-bucket/curriculum_units_backup_YYYYMMDD.json

# Repeat for other tables...
```

Or manually revert the changes:

```sql
-- Revert version_id changes
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_units`
SET version_id = '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211'
WHERE subject_id = 'LANGUAGE_ARTS'
  AND unit_id IN ('NEW_UNIT_1', 'NEW_UNIT_2', 'NEW_UNIT_3');  -- Replace with actual unit IDs

-- Delete version entry
DELETE FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
WHERE version_id = '1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32'
  AND subject_id = 'LANGUAGE_ARTS';
```

---

## Next Steps for Curriculum Service Developer

After fixing the immediate issue, implement proper version control to prevent this from happening again:

1. **Read the Implementation Guide**: [VERSION_CONTROL_IMPLEMENTATION_GUIDE.md](../../curriculum-authoring-service/VERSION_CONTROL_IMPLEMENTATION_GUIDE.md)

2. **Implement Version Control Service**:
   - Create `app/services/version_control.py`
   - Add version management methods
   - Integrate with existing curriculum manager

3. **Add API Endpoints**:
   - Create `app/api/versions.py`
   - Add routes for version CRUD operations
   - Enable publish/draft workflow

4. **Update Frontend**:
   - Add version selector component
   - Show active version in UI
   - Add publish/draft controls

5. **Test Thoroughly**:
   - Verify new entities inherit correct version_id
   - Test draft → publish workflow
   - Ensure prerequisites validate version_id matches

---

## Monitoring & Maintenance

### Daily Checks

Run this query to ensure version consistency:

```sql
-- Check for version mismatches
SELECT
  s.subject_id,
  COUNT(DISTINCT u.version_id) as unique_versions,
  CASE
    WHEN COUNT(DISTINCT u.version_id) = 1 THEN '✓ Consistent'
    ELSE '✗ MISMATCH - Needs attention!'
  END as status
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON s.subject_id = u.subject_id
WHERE s.is_active = true
GROUP BY s.subject_id;
```

### Weekly Checks

Verify curriculum view completeness:

```sql
-- Compare entity counts across tables vs view
SELECT
  'Direct Tables' as source,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
WHERE is_draft = false

UNION ALL

SELECT
  'Curriculum View' as source,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum`;

-- Counts should match
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Table not found" error
- **Fix**: Ensure you're connected to the `mountamo-tutor-h7wnta` project

**Issue**: "UPDATE/INSERT failed"
- **Fix**: Check you have write permissions on the `analytics` dataset

**Issue**: Verification tests show mismatches
- **Fix**: Review the migration script output for errors, check if all statements executed

**Issue**: Curriculum view still shows 7 units instead of 10
- **Fix**:
  1. Re-run the migration script
  2. Check that units table has correct version_id
  3. Verify subject's version_id matches units

### Getting Help

If issues persist:

1. Check BigQuery job history for error details
2. Review the verification test results to identify which step failed
3. Share the specific error message and test results
4. Consider running rollback and trying again

---

## Summary

✅ **Migration Script**: `fix_language_arts_versions.sql` - Fixes version_id mismatches
✅ **Verification Script**: `verify_curriculum_fixes.sql` - Validates fixes
✅ **Documentation Updates**: CURRICULUM_INTEGRATION_GUIDE.md, create_curriculum_views.sql
✅ **Developer Guide**: VERSION_CONTROL_IMPLEMENTATION_GUIDE.md - Prevents future issues

**Estimated Time**: 10-15 minutes to execute migration and verify
**Complexity**: Low - mostly automated SQL scripts
**Risk**: Low - includes verification and rollback plan

Good luck! The curriculum should be fully functional after running these scripts.
