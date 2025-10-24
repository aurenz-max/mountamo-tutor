# Curriculum Integration Testing Checklist

## Status: Ready for Testing ✅

All backend code is complete. Follow this checklist to validate the integration works end-to-end.

---

## Phase 1: Database Setup & Validation (5 minutes)

### ✅ Step 1: Run SQL Script
**What:** Create compatibility views in BigQuery

**How:**
1. Open [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Select project: `mountamo-tutor-h7wnta`
3. Open query editor
4. Copy entire contents of `backend/scripts/create_curriculum_views.sql`
5. Click "Run"

**Expected Output:**
```
✅ Table dropped: analytics.curriculum
✅ View created: analytics.curriculum
✅ Table created: analytics.learning_paths
✅ View created: analytics.v_subskill_prerequisites
```

**Verification Queries:** (Run these in BigQuery)
```sql
-- 1. Check curriculum view has data
SELECT COUNT(*) as total_subskills, COUNT(DISTINCT subject) as subjects
FROM `mountamo-tutor-h7wnta.analytics.curriculum`;
-- Expected: Should show count of subskills and subjects (e.g., 100+ subskills, 4 subjects)

-- 2. Check learning paths has data
SELECT COUNT(*) as total_relationships
FROM `mountamo-tutor-h7wnta.analytics.learning_paths`;
-- Expected: Should show count of skill relationships (e.g., 20+ relationships)

-- 3. Verify curriculum view structure
SELECT * FROM `mountamo-tutor-h7wnta.analytics.curriculum` LIMIT 5;
-- Expected: Should show subject, grade, unit_id, skill_id, subskill_id, descriptions, difficulties
```

**Status:** [ ] Complete

---

## Phase 2: Backend ETL Testing (10 minutes)

### ✅ Step 2: Run ETL Script
**What:** Test the ETL refresh logic

**How:**
```bash
cd backend/scripts
python cosmos_to_bigquery_etl.py
```

**Expected Output:**
```
🚀 Starting Full ETL Data Load
...
📚 Refreshing curriculum views from analytics.curriculum_* tables...
✅ Learning paths table refreshed from analytics.curriculum_prerequisites
✅ Curriculum view validated: XXX subskills, XXX skills, X subjects
...
🎉 Full data load completed successfully!
```

**Look for these specific messages:**
- ✅ `Skipping legacy curriculum load - using analytics.curriculum_* tables instead`
- ✅ `Skipping legacy learning paths load - using analytics.curriculum_prerequisites instead`
- ✅ `Curriculum view validated: [count] subskills`

**Status:** [ ] Complete

---

## Phase 3: Backend API Testing (15 minutes)

### ✅ Step 3: Start Backend Server
```bash
cd backend
uvicorn app.main:app --reload
```

**Status:** [ ] Server running on http://localhost:8000

---

### ✅ Step 4: Test Curriculum Endpoints

#### Test 1: Get All Subjects
```bash
curl http://localhost:8000/curriculum/subjects
```

**Expected Response:**
```json
[
  {
    "subject": "Mathematics",
    "grade": "K",
    "units": [...],
    "skills": [...],
    "subskills": [...]
  },
  ...
]
```

**Verify:**
- [ ] Returns array of subjects
- [ ] Each subject has units, skills, subskills
- [ ] Data matches what's in your new curriculum tables

**Status:** [ ] Pass / [ ] Fail

---

#### Test 2: Get Subject Details
```bash
curl http://localhost:8000/curriculum/subjects/Mathematics
```

**Expected Response:**
```json
{
  "subject": "Mathematics",
  "grade": "K",
  "units": [
    {
      "unit_id": "...",
      "unit_title": "...",
      "skills": [...]
    }
  ]
}
```

**Verify:**
- [ ] Returns specific subject details
- [ ] Units are properly structured
- [ ] Skills and subskills are nested correctly

**Status:** [ ] Pass / [ ] Fail

---

### ✅ Step 5: Test Learning Paths Endpoints

#### Test 3: Get Learning Paths
```bash
curl http://localhost:8000/learning-paths/learning-paths
```

**Expected Response:**
```json
{
  "learning_path_decision_tree": {
    "skill_1": ["skill_2", "skill_3"],
    "skill_2": ["skill_4"],
    ...
  },
  "skill_count": 20
}
```

**Verify:**
- [ ] Returns decision tree structure
- [ ] Shows skill prerequisites/relationships
- [ ] Skill count matches expected number

**Status:** [ ] Pass / [ ] Fail

---

#### Test 4: Get Learning Paths Analytics
```bash
curl http://localhost:8000/learning-paths/analytics
```

**Expected Response:**
```json
{
  "metadata": {...},
  "structure_analytics": {
    "total_skills": 20,
    "total_connections": 35,
    "starting_skills": [...],
    ...
  }
}
```

**Verify:**
- [ ] Returns analytics about learning paths
- [ ] Shows skill groups and connections
- [ ] Starting skills identified

**Status:** [ ] Pass / [ ] Fail

---

#### Test 5: Get Skill Prerequisites
```bash
curl http://localhost:8000/learning-paths/prerequisites/SKILL_ID_HERE
```
(Replace SKILL_ID_HERE with an actual skill ID from your curriculum)

**Expected Response:**
```json
{
  "skill_id": "SKILL_ID_HERE",
  "prerequisites": ["prerequisite_skill_1", "prerequisite_skill_2"]
}
```

**Verify:**
- [ ] Returns prerequisites for specific skill
- [ ] Prerequisites are from new curriculum_prerequisites table

**Status:** [ ] Pass / [ ] Fail

---

### ✅ Step 6: Test Analytics Endpoints

#### Test 6: Get Student Focus Areas
```bash
curl http://localhost:8000/analytics/student/YOUR_STUDENT_ID/focus-areas
```
(Replace YOUR_STUDENT_ID with an actual student ID)

**Expected Response:**
```json
[
  {
    "subject": "Mathematics",
    "priority_level": "High Priority",
    "unit_title": "...",
    "skill_description": "...",
    "subskill_description": "...",
    "proficiency_pct": 0.65,
    ...
  },
  ...
]
```

**Verify:**
- [ ] Returns focus areas for student
- [ ] Uses new curriculum view data
- [ ] Shows correct hierarchy (subject → unit → skill → subskill)

**Status:** [ ] Pass / [ ] Fail

---

#### Test 7: Get Daily Activities
```bash
curl http://localhost:8000/daily-activities/student/YOUR_STUDENT_ID
```

**Expected Response:**
```json
{
  "student_id": 123,
  "activities": [
    {
      "subskill_id": "...",
      "subskill_description": "...",
      "subject": "Mathematics",
      ...
    }
  ]
}
```

**Verify:**
- [ ] Returns daily activity recommendations
- [ ] Activities reference correct curriculum data
- [ ] Subskill descriptions match new schema

**Status:** [ ] Pass / [ ] Fail

---

## Phase 4: Frontend Testing (20 minutes)

### ✅ Step 8: Start Frontend Development Server
```bash
cd my-tutoring-app
npm run dev
```

**Status:** [ ] Frontend running on http://localhost:3000

---

### ✅ Step 9: Test Curriculum Features in UI

#### Test 8: Curriculum Selector/Explorer
**Where:** Navigate to curriculum browsing page

**Actions:**
1. [ ] Browse subjects (Mathematics, Science, etc.)
2. [ ] Expand units within a subject
3. [ ] Expand skills within a unit
4. [ ] View subskills within a skill

**Verify:**
- [ ] All subjects load correctly
- [ ] Unit/skill/subskill hierarchy displays properly
- [ ] Descriptions show correctly
- [ ] No missing data or "undefined" values
- [ ] Difficulty levels display if shown in UI

**Issues Found:**
```
[Note any issues here]
```

**Status:** [ ] Pass / [ ] Fail

---

#### Test 9: Practice/Problem Selection
**Where:** Navigate to practice/problem workspace

**Actions:**
1. [ ] Select a subject to practice
2. [ ] Select a specific skill or subskill
3. [ ] Start a practice session
4. [ ] Verify problem metadata shows correct curriculum info

**Verify:**
- [ ] Subject/skill/subskill selection works
- [ ] Problem workspace loads correctly
- [ ] Curriculum metadata displays in practice UI
- [ ] No errors in browser console related to curriculum

**Issues Found:**
```
[Note any issues here]
```

**Status:** [ ] Pass / [ ] Fail

---

#### Test 10: Student Dashboard - Focus Areas
**Where:** Student dashboard showing focus areas

**Actions:**
1. [ ] Log in as a test student
2. [ ] Navigate to dashboard/focus areas view
3. [ ] Check if focus areas display correctly
4. [ ] Verify subject/unit/skill/subskill hierarchy

**Verify:**
- [ ] Focus areas widget loads
- [ ] Shows correct subjects and priority levels
- [ ] Curriculum descriptions are readable
- [ ] Clicking on items navigates correctly
- [ ] No "undefined" or missing curriculum data

**Issues Found:**
```
[Note any issues here]
```

**Status:** [ ] Pass / [ ] Fail

---

#### Test 11: Learning Path Visualization
**Where:** Learning paths or curriculum map page (if you have one)

**Actions:**
1. [ ] Navigate to learning paths view
2. [ ] Check if skill progression/prerequisite visualization loads
3. [ ] Verify connections between skills are shown

**Verify:**
- [ ] Learning paths display correctly
- [ ] Prerequisite relationships are accurate
- [ ] No broken connections or orphaned skills
- [ ] Interactive elements work (if applicable)

**Issues Found:**
```
[Note any issues here]
```

**Status:** [ ] Pass / [ ] Fail / [ ] N/A (if no learning path visualization)

---

#### Test 12: Daily Activities Widget
**Where:** Dashboard or daily activities page

**Actions:**
1. [ ] Log in as test student
2. [ ] View daily activity recommendations
3. [ ] Check if activities reference correct curriculum

**Verify:**
- [ ] Daily activities load
- [ ] Show correct subject/skill/subskill info
- [ ] Clicking on activity navigates to practice
- [ ] Recommended activities make sense based on student progress

**Issues Found:**
```
[Note any issues here]
```

**Status:** [ ] Pass / [ ] Fail

---

### ✅ Step 10: Browser Console Checks

**Open browser console (F12) and check for:**

**Red Flags (Should NOT see):**
- [ ] ❌ Errors about missing curriculum data
- [ ] ❌ 404 errors for curriculum endpoints
- [ ] ❌ "Cannot read property of undefined" related to curriculum
- [ ] ❌ Network errors for `/curriculum/*` or `/learning-paths/*`

**Good Signs (Should see):**
- [ ] ✅ Successful 200 responses for curriculum API calls
- [ ] ✅ No console errors when loading curriculum
- [ ] ✅ Data structures match expected format

**Console Screenshot:**
```
[Take screenshot if issues found]
```

**Status:** [ ] Pass / [ ] Fail

---

## Phase 5: Data Validation (10 minutes)

### ✅ Step 11: Compare Old vs New Data

#### Validation Query 1: Subskill Count
```sql
-- Run in BigQuery
-- Count subskills in new view
SELECT COUNT(*) as new_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum`;

-- If you backed up old table:
SELECT COUNT(*) as old_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_legacy_backup`;
```

**Expected:** Counts should be similar (within 10% unless you added/removed curriculum)

**Status:** [ ] Pass / [ ] Fail

---

#### Validation Query 2: Subject Coverage
```sql
-- Check all subjects are present
SELECT DISTINCT subject
FROM `mountamo-tutor-h7wnta.analytics.curriculum`
ORDER BY subject;
```

**Expected Subjects:** (Check all your subjects appear)
- [ ] Mathematics
- [ ] Science
- [ ] Language Arts
- [ ] Social Studies
- [ ] [Other subjects...]

**Status:** [ ] Pass / [ ] Fail

---

#### Validation Query 3: Prerequisite Relationships
```sql
-- Check learning paths has reasonable data
SELECT
  prerequisite_skill_id,
  COUNT(*) as unlocks_count
FROM `mountamo-tutor-h7wnta.analytics.learning_paths`
GROUP BY prerequisite_skill_id
ORDER BY unlocks_count DESC
LIMIT 10;
```

**Expected:** Should show skills and how many other skills they unlock

**Status:** [ ] Pass / [ ] Fail

---

## Phase 6: End-to-End Student Flow (15 minutes)

### ✅ Step 12: Complete Student Journey Test

**Scenario:** Simulate a student using the platform

**Actions:**
1. [ ] **Login** as test student
2. [ ] **View Dashboard** - Check curriculum data displays
3. [ ] **Browse Curriculum** - Navigate subject → unit → skill → subskill
4. [ ] **Start Practice** - Select a subskill and practice it
5. [ ] **Complete Problems** - Submit answers
6. [ ] **Check Progress** - View updated analytics/focus areas
7. [ ] **Follow Recommendations** - Click on recommended next skill

**Verify at Each Step:**
- [ ] Curriculum data loads correctly
- [ ] No errors or missing data
- [ ] Navigation works smoothly
- [ ] User experience is unchanged from before
- [ ] All features that worked before still work

**Issues Found:**
```
[Document any issues in the student flow]
```

**Status:** [ ] Pass / [ ] Fail

---

## Summary & Sign-Off

### Test Results Summary

| Phase | Status | Issues |
|-------|--------|--------|
| Database Setup | [ ] Pass / [ ] Fail | |
| Backend ETL | [ ] Pass / [ ] Fail | |
| Backend API | [ ] Pass / [ ] Fail | |
| Frontend UI | [ ] Pass / [ ] Fail | |
| Data Validation | [ ] Pass / [ ] Fail | |
| End-to-End Flow | [ ] Pass / [ ] Fail | |

### Critical Issues Found:
```
1.
2.
3.
```

### Non-Critical Issues:
```
1.
2.
```

### Performance Notes:
```
- Page load times:
- API response times:
- Any slowdowns noticed:
```

### Overall Status:
- [ ] ✅ **PASS** - Integration successful, ready for production
- [ ] ⚠️ **PARTIAL** - Minor issues found, can proceed with fixes
- [ ] ❌ **FAIL** - Critical issues found, need investigation

---

## Rollback Plan (If Needed)

If critical issues are found:

### Option 1: Restore Old Curriculum Table
```sql
-- Restore from backup (if you created one)
DROP VIEW IF EXISTS `mountamo-tutor-h7wnta.analytics.curriculum`;
CREATE TABLE `mountamo-tutor-h7wnta.analytics.curriculum` AS
SELECT * FROM `mountamo-tutor-h7wnta.analytics.curriculum_legacy_backup`;
```

### Option 2: Revert ETL Script
```bash
git checkout HEAD~1 backend/scripts/cosmos_to_bigquery_etl.py
```

### Option 3: Re-enable Blob Storage
Update ETL to load from blob storage again (temporary fallback)

---

## Next Steps After Testing

### If All Tests Pass ✅
1. [ ] Document any configuration changes
2. [ ] Update team on new curriculum schema
3. [ ] Monitor production for 24-48 hours
4. [ ] Consider adding prerequisite-aware features (optional enhancements)

### If Issues Found ⚠️
1. [ ] Document issues in detail
2. [ ] Determine if blocker or can be fixed
3. [ ] Create fix plan
4. [ ] Re-test after fixes

---

**Tester:** ___________________
**Date:** ___________________
**Environment:** Development / Staging / Production
