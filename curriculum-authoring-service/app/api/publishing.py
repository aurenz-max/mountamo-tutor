"""
Publishing and version control API endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from app.core.security import require_admin
from app.services.version_control import version_control
from app.services.graph_cache_manager import graph_cache_manager
from app.services.curriculum_manager import curriculum_manager
from app.services.graph_flattening import graph_flattening_service
from app.models.versioning import (
    Version, DraftSummary,
    PublishRequest, PublishResponse
)
from app.models.curriculum import FlattenedCurriculumRow

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/subjects/{subject_id}/draft-changes", response_model=DraftSummary)
async def get_draft_changes(
    subject_id: str
):
    """Get summary of all draft changes for a subject"""
    return await version_control.get_draft_changes(subject_id)


@router.post("/subjects/{subject_id}/publish", response_model=PublishResponse)
async def publish_subject(
    subject_id: str,
    publish_request: PublishRequest = None
):
    """Publish all draft changes for a subject.

    subject_id from the URL path is authoritative.  The request body is
    optional — an empty POST (or ``{}``) is fine.  If the body contains
    a ``subject_id`` it is overridden by the path parameter.
    """
    if publish_request is None:
        publish_request = PublishRequest()
    # Path param is authoritative — always override body
    publish_request.subject_id = subject_id
    try:
        # Publish the curriculum changes
        result = await version_control.publish(
            publish_request,
            "local-dev-user"
        )

        # Regenerate both draft and published graph caches
        logger.info(f"🔄 Triggering graph regeneration after publish for {subject_id}")
        try:
            await graph_cache_manager.regenerate_all_versions(subject_id)
            logger.info(f"✅ Graph regeneration complete")
        except Exception as e:
            # Log error but don't fail the publish operation
            logger.error(f"⚠️ Graph regeneration failed (non-critical): {e}")

        # Auto-deploy to Firestore for backend consumption
        try:
            await curriculum_manager.deploy_curriculum_to_firestore(
                subject_id=subject_id,
                deployed_by="auto-publish"
            )
            logger.info(f"✅ Auto-deployed curriculum to Firestore for {subject_id}")
        except Exception as e:
            logger.error(f"⚠️ Auto-deploy to Firestore failed (non-critical): {e}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/versions", response_model=List[Version])
async def get_version_history(
    subject_id: str
):
    """Get version history for a subject"""
    return await version_control.get_version_history(subject_id)


@router.get("/subjects/{subject_id}/active-version", response_model=Version)
async def get_active_version(
    subject_id: str
):
    """Get currently active version for a subject"""
    version = await version_control.get_active_version(subject_id)
    if not version:
        raise HTTPException(status_code=404, detail="No active version found")
    return version


@router.post("/subjects/{subject_id}/rollback/{version_id}", response_model=PublishResponse)
async def rollback_version(
    subject_id: str,
    version_id: str
):
    """Rollback to a previous version"""
    try:
        # Rollback to the specified version
        result = await version_control.rollback_to_version(
            subject_id,
            version_id,
            "local-dev-user"
        )

        # Regenerate graph caches after rollback
        logger.info(f"🔄 Triggering graph regeneration after rollback for {subject_id}")
        try:
            await graph_cache_manager.regenerate_all_versions(subject_id)
            logger.info(f"✅ Graph regeneration complete")
        except Exception as e:
            # Log error but don't fail the rollback operation
            logger.error(f"⚠️ Graph regeneration failed (non-critical): {e}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/flattened-view", response_model=List[FlattenedCurriculumRow])
async def get_flattened_curriculum_view(
    subject_id: str,
    version_id: Optional[str] = None
):
    """
    Get flattened curriculum view matching BigQuery analytics view structure.

    This endpoint returns the curriculum in a flattened format that matches
    the structure used by the analytics view in the tutoring application.

    - Returns only published content (is_draft=false, is_active=true)
    - If version_id is not provided, returns the active version
    - Each row represents one subskill with its complete hierarchy path
    - Ordered by unit_order, skill_order, subskill_order

    This view is useful for:
    - Validating published curriculum structure
    - Previewing what the tutoring app will consume
    - Exporting curriculum data for documentation
    - Comparing different published versions
    """
    try:
        rows = await curriculum_manager.get_flattened_curriculum_view(
            subject_id=subject_id,
            version_id=version_id
        )

        if not rows:
            logger.warning(f"No flattened curriculum data found for subject {subject_id}")

        return rows

    except Exception as e:
        logger.error(f"Error fetching flattened curriculum view: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch flattened view: {str(e)}")


@router.post("/subjects/{subject_id}/deploy")
async def deploy_curriculum(
    subject_id: str,
    version_id: Optional[str] = None
):
    """
    Deploy published curriculum to Firestore for backend consumption.

    Builds a hierarchical document from the published curriculum and writes
    it to the curriculum_published Firestore collection. The backend tutoring
    service reads from this collection instead of querying BigQuery.

    - If version_id is not provided, deploys the active published version
    - Includes a subskill_index for fast reverse lookups
    - Includes pre-computed stats
    - Idempotent: re-deploying overwrites the previous deployment
    """
    try:
        result = await curriculum_manager.deploy_curriculum_to_firestore(
            subject_id=subject_id,
            version_id=version_id,
            deployed_by="manual"
        )

        # Auto-flatten graph after deploy so Pulse/LearningPaths have fresh data
        flatten_result = None
        try:
            flat = graph_flattening_service.rebuild_cache(subject_id, published_only=True)
            if flat:
                meta = flat.get("metadata", {})
                flatten_result = {
                    "cache_doc_id": flat["id"],
                    "nodes": meta.get("entity_counts", {}),
                    "edges": meta.get("edge_counts", {}),
                }
                logger.info(f"[FLATTEN] Auto-flattened after deploy: {flat['id']}")
            # Also rebuild draft cache
            graph_flattening_service.rebuild_cache(subject_id, published_only=False)
        except Exception as e:
            logger.error(f"[FLATTEN] Auto-flatten failed (non-critical): {e}")

        if flatten_result:
            result["flatten"] = flatten_result

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Deploy failed for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to deploy curriculum: {str(e)}")


@router.post("/subjects/{subject_id}/deploy-to-bigquery")
async def deploy_to_bigquery(subject_id: str):
    """
    Export published curriculum to BigQuery for analytics.

    This is separate from publish/deploy (which are Firestore-only).
    Run this when you want to sync the published curriculum to BQ
    for analytics dashboards and reporting.
    """
    from app.db.bigquery_export_service import bigquery_export

    try:
        active_version = await version_control.get_active_version(subject_id)
        if not active_version:
            raise HTTPException(status_code=404, detail=f"No active version for {subject_id}")

        export_result = await bigquery_export.export_published_subject(
            subject_id, active_version.version_id
        )

        return {
            "success": True,
            "subject_id": subject_id,
            "version_id": active_version.version_id,
            "export_result": export_result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ BQ export failed for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=f"BigQuery export failed: {str(e)}")


@router.get("/subjects/{subject_id}/deploy/status")
async def get_deploy_status(subject_id: str):
    """Get the deployment status for a subject"""
    from app.db.firestore_graph_service import firestore_graph_service
    try:
        status = await firestore_graph_service.get_deployment_status(subject_id)
        return status
    except Exception as e:
        logger.error(f"❌ Failed to get deploy status for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects/{subject_id}/deploy/diagnostics")
async def get_deploy_diagnostics(subject_id: str):
    """
    Diagnose why units/skills/subskills might be missing from deployment.

    Checks each level of the hierarchy independently to identify where
    the INNER JOIN chain breaks (version_id mismatch, is_draft=true, etc).
    """
    from app.core.config import settings
    from app.core.database import db
    from google.cloud import bigquery

    try:
        # 1. Get the active version
        active_version = await version_control.get_active_version(subject_id)
        if not active_version:
            return {"error": "No active version found", "subject_id": subject_id}

        active_vid = active_version.version_id

        # 2. Check subject record
        subject_query = f"""
        SELECT subject_id, version_id, is_draft, is_active,
               (version_id = @active_vid) as version_matches
        FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        WHERE subject_id = @subject_id
        """
        params = [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("active_vid", "STRING", active_vid),
        ]
        subject_rows = await db.execute_query(subject_query, params)

        # 3. Check all units for this subject
        units_query = f"""
        SELECT unit_id, unit_title, unit_order, version_id, is_draft,
               (version_id = @active_vid) as version_matches
        FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
        WHERE subject_id = @subject_id
        ORDER BY unit_order
        """
        unit_rows = await db.execute_query(units_query, params)

        # 4. Check skills for all units of this subject
        skills_query = f"""
        SELECT sk.skill_id, sk.skill_description, sk.unit_id, sk.version_id, sk.is_draft,
               (sk.version_id = @active_vid) as version_matches,
               u.unit_title
        FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` sk
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON sk.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
        ORDER BY u.unit_order, sk.skill_order
        """
        skill_rows = await db.execute_query(skills_query, params)

        # 5. Check subskills
        subskills_query = f"""
        SELECT sub.subskill_id, sub.subskill_description, sub.skill_id, sub.version_id, sub.is_draft,
               (sub.version_id = @active_vid) as version_matches,
               u.unit_title, sk.skill_description
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` sub
        JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` sk ON sub.skill_id = sk.skill_id
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON sk.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
        ORDER BY u.unit_order, sk.skill_order, sub.subskill_order
        """
        subskill_rows = await db.execute_query(subskills_query, params)

        # Build diagnostic report
        units_report = []
        for u in unit_rows:
            unit_id = u["unit_id"]
            unit_skills = [s for s in skill_rows if s["unit_id"] == unit_id]
            unit_subskills = [s for s in subskill_rows if s["unit_title"] == u["unit_title"]]

            # Determine why this unit would be excluded from deploy
            issues = []
            if u["is_draft"]:
                issues.append("unit is_draft=true")
            if not u["version_matches"]:
                issues.append(f"unit version_id mismatch ({u['version_id'][:8]}... != {active_vid[:8]}...)")
            if not unit_skills:
                issues.append("no skills found")
            else:
                draft_skills = [s for s in unit_skills if s["is_draft"]]
                mismatched_skills = [s for s in unit_skills if not s["version_matches"]]
                if draft_skills:
                    issues.append(f"{len(draft_skills)}/{len(unit_skills)} skills are drafts")
                if mismatched_skills:
                    issues.append(f"{len(mismatched_skills)}/{len(unit_skills)} skills have version_id mismatch")

            if not unit_subskills:
                issues.append("no subskills found")
            else:
                draft_subs = [s for s in unit_subskills if s["is_draft"]]
                mismatched_subs = [s for s in unit_subskills if not s["version_matches"]]
                if draft_subs:
                    issues.append(f"{len(draft_subs)}/{len(unit_subskills)} subskills are drafts")
                if mismatched_subs:
                    issues.append(f"{len(mismatched_subs)}/{len(unit_subskills)} subskills have version_id mismatch")

            would_deploy = len(issues) == 0
            units_report.append({
                "unit_id": unit_id,
                "unit_title": u["unit_title"],
                "unit_order": u["unit_order"],
                "version_id": u["version_id"],
                "is_draft": u["is_draft"],
                "version_matches": u["version_matches"],
                "skill_count": len(unit_skills),
                "subskill_count": len(unit_subskills),
                "would_deploy": would_deploy,
                "issues": issues if issues else None,
            })

        deployable = [u for u in units_report if u["would_deploy"]]
        excluded = [u for u in units_report if not u["would_deploy"]]

        return {
            "subject_id": subject_id,
            "active_version_id": active_vid,
            "active_version_number": active_version.version_number,
            "total_units": len(unit_rows),
            "deployable_units": len(deployable),
            "excluded_units": len(excluded),
            "units": units_report,
        }

    except Exception as e:
        logger.error(f"❌ Diagnostics failed for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backfill-drafts")
async def backfill_drafts(grade: Optional[str] = None):
    """Seed curriculum_drafts from existing curriculum_published docs.

    Run once after migration to populate the drafts collection for subjects
    that were published before the drafts collection existed.
    """
    from app.db.draft_curriculum_service import draft_curriculum

    try:
        result = await draft_curriculum.backfill_from_published(grade=grade)
        return {
            "success": True,
            **result,
            "message": f"Backfilled {result['backfilled']} subjects into curriculum_drafts",
        }
    except Exception as e:
        logger.error(f"Backfill failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Graph Flattening / Cache Rebuild ====================


@router.post("/subjects/{subject_id}/flatten")
async def flatten_and_cache_graph(
    subject_id: str,
    published_only: bool = True,
):
    """
    Rebuild the flat graph cache from the hierarchical Firestore graph.

    Reads edges from curriculum_graphs/{grade}/subjects/{subject_id}/edges/
    and nodes from curriculum_published, then writes a grade-prefixed flat
    cache document, e.g.:
      curriculum_graphs/MATHEMATICS_GK_latest_published  (Kindergarten)
      curriculum_graphs/SCIENCE_G1_latest_published      (Grade 1)

    This is automatically called after deploy, but can be triggered manually
    if you need to refresh the cache without redeploying.
    """
    try:
        result = graph_flattening_service.rebuild_cache(subject_id, published_only)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not resolve graph for {subject_id} — check that edges exist in the hierarchical collection"
            )

        metadata = result.get("metadata", {})
        return {
            "success": True,
            "subject_id": subject_id,
            "cache_doc_id": result["id"],
            "nodes": metadata.get("entity_counts", {}),
            "edges": metadata.get("edge_counts", {}),
            "generated_at": result["generated_at"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rebuilding graph cache for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/flatten-all/{grade}")
async def flatten_all_for_grade(grade: str):
    """
    Rebuild flat graph caches for ALL subjects under a grade.

    Useful after bulk curriculum changes or migration.
    """
    try:
        rebuilt = graph_flattening_service.rebuild_all_for_grade(grade)

        return {
            "success": True,
            "grade": grade,
            "rebuilt_subjects": rebuilt,
            "count": len(rebuilt),
        }

    except Exception as e:
        logger.error(f"Error rebuilding all graph caches for grade {grade}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects/{subject_id}/flatten/preview")
async def preview_flattened_graph(
    subject_id: str,
    published_only: bool = True,
):
    """
    Preview the flattened graph without writing to cache.

    Useful for debugging — shows what Pulse/LearningPaths would see.
    """
    try:
        result = graph_flattening_service.flatten_graph(subject_id, published_only)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not resolve graph for {subject_id}"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing flattened graph for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subjects/{subject_id}/deploy/repair")
async def repair_version_ids(subject_id: str):
    """
    Repair version_id mismatches across all entities for a subject.

    Forces all units, skills, subskills, prerequisites, and subskill_primitives
    to the active version_id using direct UPDATE (not MERGE through joins).
    This bypasses the join-chain issue where duplicate rows cause MERGE failures.
    """
    from app.core.config import settings
    from app.core.database import db
    from google.cloud import bigquery

    try:
        active_version = await version_control.get_active_version(subject_id)
        if not active_version:
            raise HTTPException(status_code=404, detail="No active version found")

        active_vid = active_version.version_id
        results = {}

        # 1. Fix subjects - direct update by subject_id
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        SET version_id = @version_id, is_draft = false
        WHERE subject_id = @subject_id AND version_id != @version_id
        """
        params = [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", active_vid),
        ]
        await db.execute_query(q, params)
        results["subjects"] = "updated"

        # 2. Fix units - direct update by subject_id
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_UNITS)}`
        SET version_id = @version_id, is_draft = false
        WHERE subject_id = @subject_id AND version_id != @version_id
        """
        await db.execute_query(q, params)
        results["units"] = "updated"

        # 3. Fix skills - need to go through units, but use IN subquery instead of JOIN
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SKILLS)}`
        SET version_id = @version_id, is_draft = false
        WHERE unit_id IN (
            SELECT unit_id FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
            WHERE subject_id = @subject_id
        ) AND version_id != @version_id
        """
        await db.execute_query(q, params)
        results["skills"] = "updated"

        # 4. Fix subskills - through skills → units
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SUBSKILLS)}`
        SET version_id = @version_id, is_draft = false
        WHERE skill_id IN (
            SELECT sk.skill_id FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` sk
            WHERE sk.unit_id IN (
                SELECT unit_id FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
                WHERE subject_id = @subject_id
            )
        ) AND version_id != @version_id
        """
        await db.execute_query(q, params)
        results["subskills"] = "updated"

        # 5. Fix prerequisites
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        SET version_id = @version_id, is_draft = false
        WHERE subject_id = @subject_id AND version_id != @version_id
        """
        await db.execute_query(q, params)
        results["prerequisites"] = "updated"

        # 6. Fix subskill_primitives
        q = f"""
        UPDATE `{settings.get_table_id(settings.TABLE_SUBSKILL_PRIMITIVES)}`
        SET version_id = @version_id, is_draft = false
        WHERE subskill_id IN (
            SELECT sub.subskill_id FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` sub
            WHERE sub.skill_id IN (
                SELECT sk.skill_id FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` sk
                WHERE sk.unit_id IN (
                    SELECT unit_id FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
                    WHERE subject_id = @subject_id
                )
            )
        ) AND version_id != @version_id
        """
        await db.execute_query(q, params)
        results["subskill_primitives"] = "updated"

        logger.info(f"✅ Repaired version_ids for {subject_id} to {active_vid}")

        return {
            "success": True,
            "subject_id": subject_id,
            "version_id": active_vid,
            "version_number": active_version.version_number,
            "tables_updated": results,
            "message": f"All entities updated to version {active_version.version_number}. Run deploy to push to Firestore."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Repair failed for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
