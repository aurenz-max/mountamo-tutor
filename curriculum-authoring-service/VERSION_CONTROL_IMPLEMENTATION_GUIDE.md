# Version Control Implementation Guide
## For Curriculum Authoring Service Developer

This guide provides specifications for implementing proper version control in the curriculum-authoring-service to prevent version_id mismatches and enable smooth curriculum evolution.

---

## Problem We're Solving

### What Happened
When adding 3 new Language Arts units through the curriculum authoring UI:
- The new units were created with a different `version_id` than the existing 7 units
- This caused the new units to be invisible in the `analytics.curriculum` view
- Prerequisites couldn't properly reference entities across different versions
- Required manual SQL migration to fix

### Root Cause
The curriculum authoring service doesn't currently have:
1. Automatic version management when creating new entities
2. UI to view and manage versions
3. Workflow to ensure all entities in a subject use the same active version
4. Validation to prevent version_id mismatches

---

## Version Control Architecture

### Core Principles

1. **One Active Version Per Subject**: Each subject (MATHEMATICS, LANGUAGE_ARTS, etc.) should have exactly ONE active version at any time
2. **Version Inheritance**: All new entities (units, skills, subskills, prerequisites) should automatically inherit the active version_id
3. **Draft → Publish Workflow**: Changes are made in draft mode, then published as a new version
4. **Immutable Published Versions**: Once a version is published, it cannot be modified (create a new version instead)

### Version Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  DRAFT MODE (version.is_active = false)                     │
│  - Create/edit units, skills, subskills                     │
│  - Add/modify prerequisites                                 │
│  - Preview changes                                          │
│  - Multiple drafts can exist simultaneously                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [PUBLISH ACTION]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PUBLISHED (version.is_active = true, entities.is_draft=false)│
│  - Version becomes active                                   │
│  - Previous active version is deactivated                   │
│  - All entities marked as is_draft = false                  │
│  - Visible in analytics.curriculum view                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Implementation

### 1. Version Management Service

Create `curriculum-authoring-service/app/services/version_control.py`:

```python
"""
Version control service for curriculum authoring
"""

import logging
import uuid
from typing import Optional, List
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db

logger = logging.getLogger(__name__)


class VersionControlService:
    """Manages curriculum versions and ensures consistency"""

    async def get_active_version(self, subject_id: str) -> Optional[dict]:
        """Get the currently active version for a subject"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id
          AND is_active = true
        LIMIT 1
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)
        return results[0] if results else None

    async def get_or_create_active_version(self, subject_id: str, user_id: str) -> str:
        """
        Get active version_id for a subject, or create one if none exists.
        This ensures all new entities use the same version_id.
        """
        active_version = await self.get_active_version(subject_id)

        if active_version:
            return active_version['version_id']

        # No active version exists - create version 1
        version_id = str(uuid.uuid4())

        query = f"""
        INSERT INTO `{settings.get_table_id(settings.TABLE_VERSIONS)}`
          (version_id, subject_id, version_number, description, is_active,
           created_at, activated_at, created_by, change_summary)
        VALUES
          (@version_id, @subject_id, 1, @description, true,
           @created_at, @activated_at, @user_id, @change_summary)
        """

        now = datetime.utcnow().isoformat()
        parameters = [
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("description", "STRING", f"Initial {subject_id} curriculum"),
            bigquery.ScalarQueryParameter("created_at", "STRING", now),
            bigquery.ScalarQueryParameter("activated_at", "STRING", now),
            bigquery.ScalarQueryParameter("user_id", "STRING", user_id),
            bigquery.ScalarQueryParameter("change_summary", "STRING", "Initial version")
        ]

        await db.execute_query(query, parameters)
        logger.info(f"✅ Created initial version for {subject_id}: {version_id}")

        return version_id

    async def create_draft_version(
        self,
        subject_id: str,
        description: str,
        user_id: str,
        change_summary: str = ""
    ) -> str:
        """
        Create a new draft version for making changes.
        This version is NOT active until published.
        """
        # Get current active version to increment version number
        active_version = await self.get_active_version(subject_id)
        next_version_number = (active_version['version_number'] + 1) if active_version else 1

        version_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        query = f"""
        INSERT INTO `{settings.get_table_id(settings.TABLE_VERSIONS)}`
          (version_id, subject_id, version_number, description, is_active,
           created_at, created_by, change_summary)
        VALUES
          (@version_id, @subject_id, @version_number, @description, false,
           @created_at, @user_id, @change_summary)
        """

        parameters = [
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("version_number", "INT64", next_version_number),
            bigquery.ScalarQueryParameter("description", "STRING", description),
            bigquery.ScalarQueryParameter("created_at", "STRING", now),
            bigquery.ScalarQueryParameter("user_id", "STRING", user_id),
            bigquery.ScalarQueryParameter("change_summary", "STRING", change_summary)
        ]

        await db.execute_query(query, parameters)
        logger.info(f"✅ Created draft version {next_version_number} for {subject_id}: {version_id}")

        return version_id

    async def publish_version(self, version_id: str, user_id: str) -> bool:
        """
        Publish a draft version, making it active and deactivating previous version.
        This is an atomic operation.
        """
        # Get the version to publish
        query = f"""
        SELECT subject_id, is_active
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE version_id = @version_id
        """

        parameters = [bigquery.ScalarQueryParameter("version_id", "STRING", version_id)]
        results = await db.execute_query(query, parameters)

        if not results:
            logger.error(f"❌ Version {version_id} not found")
            return False

        subject_id = results[0]['subject_id']

        if results[0]['is_active']:
            logger.warning(f"⚠️ Version {version_id} is already active")
            return True

        # ATOMIC TRANSACTION: Deactivate old, activate new, mark entities as published
        # BigQuery doesn't support transactions, so we use a multi-statement approach

        now = datetime.utcnow().isoformat()

        # Step 1: Deactivate all other versions for this subject
        deactivate_query = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        SET is_active = false
        WHERE subject_id = @subject_id
          AND version_id != @version_id
        """

        await db.execute_query(deactivate_query, [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
        ])

        # Step 2: Activate the new version
        activate_query = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        SET is_active = true,
            activated_at = @activated_at
        WHERE version_id = @version_id
        """

        await db.execute_query(activate_query, [
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("activated_at", "STRING", now)
        ])

        # Step 3: Mark all entities in this version as published (is_draft = false)

        # Update subjects
        await db.execute_query(f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        SET is_draft = false, is_active = true
        WHERE version_id = @version_id
        """, parameters)

        # Update units
        await db.execute_query(f"""
        UPDATE `{settings.get_table_id(settings.TABLE_UNITS)}`
        SET is_draft = false
        WHERE version_id = @version_id
        """, parameters)

        # Update skills
        await db.execute_query(f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SKILLS)}`
        SET is_draft = false
        WHERE version_id = @version_id
        """, parameters)

        # Update subskills
        await db.execute_query(f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SUBSKILLS)}`
        SET is_draft = false
        WHERE version_id = @version_id
        """, parameters)

        # Update prerequisites
        await db.execute_query(f"""
        UPDATE `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        SET is_draft = false
        WHERE version_id = @version_id
        """, parameters)

        logger.info(f"✅ Published version {version_id} for {subject_id}")
        return True

    async def get_all_versions(self, subject_id: str) -> List[dict]:
        """Get all versions for a subject, ordered by version number"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id
        ORDER BY version_number DESC
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        return await db.execute_query(query, parameters)


# Global instance
version_control = VersionControlService()
```

---

### 2. Update Curriculum Manager

Modify `curriculum-authoring-service/app/services/curriculum_manager.py` to use version control:

```python
from app.services.version_control import version_control

class CurriculumManager:

    async def create_subject(self, subject: SubjectCreate, user_id: str) -> Subject:
        """Create a new subject - automatically gets or creates active version"""

        # Get or create active version for this subject
        version_id = await version_control.get_or_create_active_version(
            subject.subject_id,
            user_id
        )

        # Rest of the create logic...
        subject_data = {
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "description": subject.description,
            "grade_level": subject.grade_level,
            "version_id": version_id,  # Use the active version
            "is_active": True,          # Mark as active since we're using active version
            "is_draft": False,          # Published by default
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": user_id
        }

        # ... rest of create logic

    async def create_unit(self, unit: UnitCreate, user_id: str) -> Unit:
        """Create a new unit - automatically uses subject's active version"""

        # Get the subject to find its version_id
        subject = await self.get_subject(unit.subject_id)
        if not subject:
            raise ValueError(f"Subject {unit.subject_id} not found")

        # Use the subject's version_id to ensure consistency
        version_id = subject.version_id

        # Rest of create logic...
        unit_data = {
            **unit.dict(),
            "version_id": version_id,  # Inherit from subject
            "is_draft": False,          # Match subject's draft status
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        # ... rest of create logic

    # Similar updates for create_skill, create_subskill, etc.
```

---

### 3. Add Version Control API Endpoints

Create `curriculum-authoring-service/app/api/versions.py`:

```python
"""
Version control API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel

from app.services.version_control import version_control
from app.api.auth import get_current_user

router = APIRouter(prefix="/versions", tags=["versions"])


class VersionInfo(BaseModel):
    version_id: str
    subject_id: str
    version_number: int
    description: str
    is_active: bool
    created_at: str
    activated_at: str | None
    created_by: str
    change_summary: str


class CreateDraftRequest(BaseModel):
    subject_id: str
    description: str
    change_summary: str = ""


@router.get("/{subject_id}", response_model=List[VersionInfo])
async def get_versions(
    subject_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all versions for a subject"""
    versions = await version_control.get_all_versions(subject_id)
    return versions


@router.get("/{subject_id}/active", response_model=VersionInfo)
async def get_active_version(
    subject_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the active version for a subject"""
    version = await version_control.get_active_version(subject_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"No active version for {subject_id}")
    return version


@router.post("/draft", response_model=dict)
async def create_draft_version(
    request: CreateDraftRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new draft version for making changes"""
    version_id = await version_control.create_draft_version(
        subject_id=request.subject_id,
        description=request.description,
        user_id=current_user['uid'],
        change_summary=request.change_summary
    )

    return {
        "version_id": version_id,
        "message": f"Draft version created for {request.subject_id}"
    }


@router.post("/{version_id}/publish", response_model=dict)
async def publish_version(
    version_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Publish a draft version, making it active"""
    success = await version_control.publish_version(version_id, current_user['uid'])

    if not success:
        raise HTTPException(status_code=400, detail="Failed to publish version")

    return {
        "version_id": version_id,
        "message": "Version published successfully"
    }
```

Register the router in `curriculum-authoring-service/app/main.py`:

```python
from app.api import versions

app.include_router(versions.router)
```

---

### 4. UI Enhancements

Add version management UI to the curriculum authoring frontend:

#### Version Selector Component

```typescript
// curriculum-authoring-service/frontend/components/VersionSelector.tsx

interface Version {
  version_id: string;
  version_number: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export function VersionSelector({ subjectId }: { subjectId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersion, setActiveVersion] = useState<Version | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [subjectId]);

  const fetchVersions = async () => {
    const response = await fetch(`/api/versions/${subjectId}`);
    const data = await response.json();
    setVersions(data);
    setActiveVersion(data.find(v => v.is_active) || null);
  };

  return (
    <div className="version-selector">
      <h3>Version: {activeVersion?.version_number || 'None'}</h3>
      <p>{activeVersion?.description}</p>

      {activeVersion?.is_active && (
        <Badge variant="success">Active</Badge>
      )}

      <button onClick={() => createDraftVersion()}>
        Create New Draft Version
      </button>
    </div>
  );
}
```

---

## Best Practices for Developers

### ✅ DO:

1. **Always use `version_control.get_or_create_active_version()`** when creating new curriculum entities
2. **Inherit version_id from parent entities** (units from subjects, skills from units, etc.)
3. **Validate version_id matches** before creating cross-entity relationships (prerequisites)
4. **Use draft workflow** for making changes - never modify published versions directly
5. **Test version consistency** after any CRUD operation

### ❌ DON'T:

1. **Never hardcode version_id** values in the application
2. **Don't allow creating entities without checking active version** first
3. **Don't mix entities from different versions** in prerequisites
4. **Don't modify `is_draft` or `is_active` flags** manually - use publish workflow
5. **Don't create prerequisite relationships** across different version_ids

---

## Testing Checklist

After implementing version control, verify:

- [ ] Creating a new subject automatically creates a version entry
- [ ] Creating units/skills/subskills inherits the subject's active version_id
- [ ] All entities for a subject have the same version_id
- [ ] Publishing a draft version marks all entities as `is_draft = false`
- [ ] Only one version per subject is active at a time
- [ ] Prerequisites can only be created between entities in the same version
- [ ] The `analytics.curriculum` view shows all entities correctly
- [ ] The `analytics.learning_paths` table includes all prerequisites

---

## Migration Strategy for Existing Data

If you need to fix version mismatches in the future:

```sql
-- Template for migrating entities to correct version

-- Step 1: Identify the active version for the subject
DECLARE active_version_id STRING;
SET active_version_id = (
  SELECT version_id
  FROM `analytics.curriculum_versions`
  WHERE subject_id = 'SUBJECT_ID' AND is_active = true
);

-- Step 2: Update mismatched entities
UPDATE `analytics.curriculum_units`
SET version_id = active_version_id
WHERE subject_id = 'SUBJECT_ID' AND version_id != active_version_id;

-- Step 3: Cascade to children...
```

---

## Summary

Implementing this version control system will:

✅ Prevent version_id mismatches automatically
✅ Enable proper curriculum evolution with draft/publish workflow
✅ Ensure consistency across all curriculum entities
✅ Provide clear audit trail of curriculum changes
✅ Make the curriculum authoring service production-ready

The curriculum authoring service should now handle versions automatically, preventing the need for manual SQL migrations.
