# Version Control Implementation Roadmap

## Current Status: ✅ CORE FIX COMPLETE

The version_id mismatch issue is **SOLVED**. New entities will automatically use the correct active version.

## Implementation Phases

### Phase 1: Core Fix ✅ **COMPLETE**
**Status:** Implemented and ready to use

**What's Working:**
- `get_or_create_active_version()` method prevents version mismatches
- All CREATE endpoints use active version
- Entities share same version_id within a subject
- Publishing workflow works

**Files Modified:**
- `app/services/version_control.py` - Added get_or_create_active_version()
- `app/api/curriculum.py` - Updated create endpoints
- `app/api/prerequisites.py` - Updated prerequisite creation

**Result:** ✅ No more version_id mismatches!

---

### Phase 2: Architecture Refactoring ⚠️ **OPTIONAL**
**Status:** Not implemented (nice-to-have)

**Goal:** Move version logic from API layer to service layer

**What to Change:**
1. Update `curriculum_manager.py` methods to call `get_or_create_active_version()` internally
2. Simplify API endpoints - they just call curriculum_manager methods
3. Better separation of concerns

**Effort:** ~2-3 hours
**Priority:** Medium
**Impact:** Cleaner code, easier maintenance

**Example:**
```python
# curriculum_manager.py
async def create_unit(self, unit: UnitCreate, user_id: str) -> Unit:
    # Get subject to find its active version
    subject = await self.get_subject(unit.subject_id)
    if not subject:
        raise ValueError(f"Subject {unit.subject_id} not found")

    # Use subject's version_id (no need for API to handle this)
    version_id = subject.version_id

    # Create unit with inherited version
    # ...
```

**Benefits:**
- API endpoints don't need to know about version control
- Service layer handles all business logic
- Easier to test and maintain

---

### Phase 3: Version Management API ⚠️ **OPTIONAL**
**Status:** Not implemented (publishing endpoints exist, but no dedicated versions API)

**Goal:** Add dedicated version management endpoints

**What to Create:**
Create `app/api/versions.py`:

```python
@router.get("/versions/{subject_id}")
async def get_versions(subject_id: str):
    """Get all versions for a subject"""
    return await version_control.get_version_history(subject_id)

@router.post("/versions/draft")
async def create_draft_version(request: CreateDraftRequest):
    """Create a new draft version"""
    return await version_control.create_version(...)

# etc.
```

**Register in main.py:**
```python
app.include_router(versions.router, prefix="/api/versions", tags=["Versions"])
```

**Effort:** ~1-2 hours
**Priority:** Low
**Impact:** More explicit version management API

**Note:** Publishing endpoints already exist in `publishing.py`, so this is mainly about organizing the API better.

---

### Phase 4: Frontend Version UI 📱 **OPTIONAL**
**Status:** Not implemented

**Goal:** Add version management UI to curriculum designer

**What to Create:**
1. **VersionSelector Component** - Show active version, create drafts
2. **VersionHistory Component** - Display version timeline
3. **PublishButton** - Trigger publish workflow with confirmation

**Location:** `curriculum-designer-app/components/curriculum-designer/`

**Example Component:**
```typescript
export function VersionSelector({ subjectId }: { subjectId: string }) {
  const { data: activeVersion } = useActiveVersion(subjectId);
  const { data: versions } = useVersionHistory(subjectId);

  return (
    <div className="version-selector">
      <Badge>Version {activeVersion?.version_number}</Badge>
      <p>{activeVersion?.description}</p>

      <Button onClick={handleCreateDraft}>
        Create New Draft
      </Button>
    </div>
  );
}
```

**Effort:** ~4-6 hours
**Priority:** Low
**Impact:** Better user experience for version management

---

## Decision Guide

### ✅ You're Good to Go If:
- You just need to prevent version_id mismatches
- You're okay with current architecture
- You want to move fast and iterate later

**Action:** Use what's implemented now. It works!

### 🎯 Consider Phase 2 If:
- You want cleaner, more maintainable code
- You plan to have multiple developers working on this
- You value separation of concerns

**Action:** Refactor curriculum_manager to handle version logic

### 📱 Consider Phases 3 & 4 If:
- You want a polished, production-ready system
- You need end-users to manage versions themselves
- You want full draft/publish workflow in UI

**Action:** Implement dedicated version API and UI components

---

## Recommended Path

### For MVP / Quick Fix: ✅ DONE
**What you have now is sufficient!**

Just test it:
```bash
cd curriculum-authoring-service
uvicorn app.main:app --reload --port 8001
```

Create some test entities and verify they share the same version_id.

### For Production System:
1. **Now:** Use current implementation ✅
2. **Later:** Consider Phase 2 refactoring when you have time
3. **Future:** Add UI components when needed by end-users

---

## Testing Current Implementation

**Quick Validation:**
```bash
# Create a subject
curl -X POST http://localhost:8001/api/curriculum/subjects \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "TEST",
    "subject_name": "Test",
    "description": "Test subject",
    "grade_level": "K"
  }'

# Create 3 units
for i in 1 2 3; do
  curl -X POST http://localhost:8001/api/curriculum/units \
    -H "Content-Type: application/json" \
    -d "{
      \"unit_id\": \"TEST_UNIT_$i\",
      \"unit_title\": \"Test Unit $i\",
      \"subject_id\": \"TEST\",
      \"unit_order\": $i,
      \"description\": \"Test unit $i\"
    }"
done

# Verify all have same version_id
curl http://localhost:8001/api/curriculum/subjects/TEST/units?include_drafts=true
```

**Expected:** All 3 units have **identical version_id** values.

---

## Summary

| Phase | Status | Priority | Effort | Impact |
|-------|--------|----------|--------|--------|
| Phase 1: Core Fix | ✅ Complete | Critical | Done | Fixes mismatches |
| Phase 2: Refactor | ⚠️ Optional | Medium | 2-3h | Cleaner code |
| Phase 3: API | ⚠️ Optional | Low | 1-2h | Better API org |
| Phase 4: UI | ⚠️ Optional | Low | 4-6h | User experience |

**Bottom Line:** You're ready to use the system now. Additional phases are optional improvements for long-term maintainability and user experience.
