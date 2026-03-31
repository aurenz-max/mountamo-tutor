"""
Curriculum Lineage API endpoints.

CRUD operations for the curriculum_lineage Firestore collection which maps
deprecated subskill/skill IDs to their canonical successors, enabling
student data migration when curriculum iterates.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models (self-contained — avoids cross-service import)
# ---------------------------------------------------------------------------

class DataPolicyModel(BaseModel):
    competency: str = "transfer"
    mastery_lifecycle: str = "transfer"
    ability: str = "transfer"
    attempts_reviews: str = "retag"


class LineageCreateRequest(BaseModel):
    old_id: str
    canonical_id: Optional[str] = None
    canonical_ids: List[str] = Field(default_factory=list)
    operation: str  # rename | merge | split | retire
    level: str = "subskill"  # subskill | skill
    old_skill_id: Optional[str] = None
    canonical_skill_id: Optional[str] = None
    subject_id: str
    grade: str = ""
    description: str = ""
    merge_sources: List[str] = Field(default_factory=list)
    split_targets: List[str] = Field(default_factory=list)
    data_policy: DataPolicyModel = Field(default_factory=DataPolicyModel)


class LineageResponse(BaseModel):
    old_id: str
    canonical_id: Optional[str] = None
    canonical_ids: List[str] = Field(default_factory=list)
    operation: str
    level: str = "subskill"
    subject_id: str
    grade: str = ""
    version_id: str = ""
    description: str = ""
    created_at: str = ""
    created_by: str = ""


class LineageCheckResponse(BaseModel):
    subject_id: str
    total_removed: int = 0
    total_added: int = 0
    covered: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    is_valid: bool = True


# ---------------------------------------------------------------------------
# Helper — get Firestore client from the curriculum service singleton
# ---------------------------------------------------------------------------

def _get_firestore_client():
    from app.db.firestore_curriculum_service import firestore_curriculum_sync
    if not firestore_curriculum_sync.client:
        raise HTTPException(status_code=503, detail="Firestore not initialized")
    return firestore_curriculum_sync.client


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=LineageResponse, status_code=201)
async def create_lineage_record(body: LineageCreateRequest):
    """
    Create a lineage record mapping an old subskill/skill ID to its canonical successor.

    Must be created BEFORE modifying the draft — student data depends on this mapping.
    """
    client = _get_firestore_client()

    # Validate operation
    if body.operation not in ("rename", "merge", "split", "retire"):
        raise HTTPException(status_code=400, detail=f"Invalid operation: {body.operation}")

    # Check for existing record
    doc_ref = client.collection("curriculum_lineage").document(body.old_id)
    existing = doc_ref.get()
    if existing.exists:
        raise HTTPException(
            status_code=409,
            detail=f"Lineage record for '{body.old_id}' already exists. Use PUT to update.",
        )

    # Normalise canonical_ids
    canonical_ids = body.canonical_ids or []
    if body.canonical_id and body.canonical_id not in canonical_ids:
        canonical_ids = [body.canonical_id] + canonical_ids

    now = datetime.now(timezone.utc).isoformat()
    data = {
        "old_id": body.old_id,
        "canonical_id": body.canonical_id,
        "canonical_ids": canonical_ids,
        "operation": body.operation,
        "level": body.level,
        "old_skill_id": body.old_skill_id,
        "canonical_skill_id": body.canonical_skill_id,
        "subject_id": body.subject_id,
        "grade": body.grade,
        "version_id": "",  # filled at publish time
        "description": body.description,
        "merge_sources": body.merge_sources,
        "split_targets": body.split_targets,
        "data_policy": body.data_policy.model_dump(),
        "created_at": now,
        "created_by": "api",
    }

    doc_ref.set(data)
    logger.info(f"[LINEAGE] {body.old_id} → {body.canonical_id} ({body.operation}) — created")

    return LineageResponse(**data)


@router.put("/{old_id}", response_model=LineageResponse)
async def update_lineage_record(old_id: str, body: LineageCreateRequest):
    """Update an existing lineage record."""
    client = _get_firestore_client()

    doc_ref = client.collection("curriculum_lineage").document(old_id)
    existing = doc_ref.get()
    if not existing.exists:
        raise HTTPException(status_code=404, detail=f"No lineage record for '{old_id}'")

    canonical_ids = body.canonical_ids or []
    if body.canonical_id and body.canonical_id not in canonical_ids:
        canonical_ids = [body.canonical_id] + canonical_ids

    data = existing.to_dict()
    data.update({
        "canonical_id": body.canonical_id,
        "canonical_ids": canonical_ids,
        "operation": body.operation,
        "level": body.level,
        "old_skill_id": body.old_skill_id,
        "canonical_skill_id": body.canonical_skill_id,
        "subject_id": body.subject_id,
        "grade": body.grade,
        "description": body.description,
        "merge_sources": body.merge_sources,
        "split_targets": body.split_targets,
        "data_policy": body.data_policy.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    doc_ref.set(data)
    logger.info(f"[LINEAGE] {old_id} — updated")

    return LineageResponse(**data)


@router.get("/{old_id}", response_model=LineageResponse)
async def get_lineage_record(old_id: str):
    """Get a single lineage record by old ID."""
    client = _get_firestore_client()

    doc = client.collection("curriculum_lineage").document(old_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"No lineage record for '{old_id}'")

    return LineageResponse(**doc.to_dict())


@router.delete("/{old_id}", status_code=204)
async def delete_lineage_record(old_id: str):
    """Delete a lineage record."""
    client = _get_firestore_client()

    doc_ref = client.collection("curriculum_lineage").document(old_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail=f"No lineage record for '{old_id}'")

    doc_ref.delete()
    logger.info(f"[LINEAGE] {old_id} — deleted")


@router.get("/", response_model=List[LineageResponse])
async def list_lineage_records(
    subject_id: Optional[str] = Query(default=None, description="Filter by subject"),
    operation: Optional[str] = Query(default=None, description="Filter by operation type"),
):
    """List all lineage records, optionally filtered by subject or operation."""
    client = _get_firestore_client()

    query = client.collection("curriculum_lineage")
    if subject_id:
        query = query.where("subject_id", "==", subject_id)
    if operation:
        query = query.where("operation", "==", operation)

    results = []
    for doc in query.stream():
        data = doc.to_dict()
        results.append(LineageResponse(**data))

    return results


@router.get("/check/{subject_id}", response_model=LineageCheckResponse)
async def check_lineage_coverage(subject_id: str):
    """
    Pre-publish validation: diff published vs draft subskill_index and verify
    every removed subskill_id has a lineage record.

    Returns is_valid=False with the list of missing IDs if any are untracked.
    """
    from app.db.firestore_graph_service import firestore_graph_service
    from app.db.draft_curriculum_service import draft_curriculum

    client = _get_firestore_client()

    # Get published subskill_index
    published = await firestore_graph_service.get_published_curriculum(subject_id)
    published_index = set((published or {}).get("subskill_index", {}).keys())

    # Get draft subskill_index
    grade = (published or {}).get("grade", "K")
    draft = await draft_curriculum.get_draft(grade, subject_id)
    draft_index = set((draft or {}).get("subskill_index", {}).keys())

    removed = published_index - draft_index
    added = draft_index - published_index

    # Check lineage coverage for removed IDs
    covered = []
    missing = []
    for old_id in removed:
        doc = client.collection("curriculum_lineage").document(old_id).get()
        if doc.exists:
            covered.append(old_id)
        else:
            missing.append(old_id)

    return LineageCheckResponse(
        subject_id=subject_id,
        total_removed=len(removed),
        total_added=len(added),
        covered=covered,
        missing=missing,
        is_valid=len(missing) == 0,
    )
