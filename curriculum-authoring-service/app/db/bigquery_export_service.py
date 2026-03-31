"""
BigQuery export service — writes published curriculum to BQ on publish.

This is the ONLY place BigQuery writes happen after the Firestore-native migration.
Called as a non-blocking step after Firestore publish completes.
BQ export failure does NOT fail the publish operation.

Tables written:
  curriculum_subjects, curriculum_units, curriculum_skills, curriculum_subskills,
  curriculum_prerequisites, curriculum_edges, curriculum_versions
"""

import logging
from typing import Dict, List, Any, Optional

from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.db.firestore_curriculum_reader import firestore_reader

logger = logging.getLogger(__name__)


class BigQueryExportService:
    """Exports published Firestore curriculum data to BigQuery for analytics."""

    async def export_published_subject(
        self,
        subject_id: str,
        version_id: str,
    ) -> Dict[str, Any]:
        """Export all published entities for a subject to BigQuery.

        Reads from Firestore (source of truth), MERGEs into BQ tables.
        Non-blocking — failures are logged but do not propagate.

        Returns summary of what was exported.
        """
        summary = {
            "subject_id": subject_id,
            "version_id": version_id,
            "exported": {},
            "errors": [],
        }

        try:
            # Load all entities from Firestore
            subject = await firestore_reader.get_subject(subject_id, include_drafts=True)
            if not subject:
                summary["errors"].append(f"Subject {subject_id} not found")
                return summary

            units = await firestore_reader.get_units_by_subject(subject_id, include_drafts=True)
            unit_ids = [u["unit_id"] for u in units]
            skills = await firestore_reader.get_skills_by_unit_ids(unit_ids, include_drafts=True)
            skill_ids = [s["skill_id"] for s in skills]
            subskills = await firestore_reader.get_subskills_by_skill_ids(skill_ids, include_drafts=True)
            edges = await firestore_reader.get_edges_for_subject(subject_id, include_drafts=True)
            prereqs = await firestore_reader.get_prerequisites_for_subject(subject_id, include_drafts=True)
            versions = await firestore_reader.get_versions(subject_id)

            # Export each entity type (MERGE = upsert)
            await self._export_subjects([subject], summary)
            await self._export_units(units, summary)
            await self._export_skills(skills, summary)
            await self._export_subskills(subskills, summary)
            await self._export_edges(edges, summary)
            await self._export_prerequisites(prereqs, summary)
            await self._export_versions(versions, summary)

            logger.info(
                f"BQ export complete for {subject_id}: {summary['exported']}"
            )

        except Exception as e:
            logger.error(f"BQ export failed for {subject_id}: {e}")
            summary["errors"].append(str(e))

        return summary

    # ==================== Per-entity export methods ====================

    async def _export_subjects(self, subjects: List[Dict], summary: Dict) -> None:
        """Export subjects to BQ via MERGE."""
        if not subjects:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_SUBJECTS)
            for s in subjects:
                # Map model field 'grade' to BQ column 'grade_level'
                bq_row = dict(s)
                if "grade" in bq_row and "grade_level" not in bq_row:
                    bq_row["grade_level"] = bq_row.pop("grade")

                await self._upsert_row(
                    table_id, "subject_id", bq_row,
                    type_map={"is_active": "BOOL", "is_draft": "BOOL"},
                )
            summary["exported"]["subjects"] = len(subjects)
        except Exception as e:
            logger.error(f"BQ subject export failed: {e}")
            summary["errors"].append(f"subjects: {e}")

    async def _export_units(self, units: List[Dict], summary: Dict) -> None:
        if not units:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_UNITS)
            for u in units:
                await self._upsert_row(
                    table_id, "unit_id", u,
                    type_map={"unit_order": "INT64", "is_draft": "BOOL"},
                )
            summary["exported"]["units"] = len(units)
        except Exception as e:
            logger.error(f"BQ unit export failed: {e}")
            summary["errors"].append(f"units: {e}")

    async def _export_skills(self, skills: List[Dict], summary: Dict) -> None:
        if not skills:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_SKILLS)
            for s in skills:
                await self._upsert_row(
                    table_id, "skill_id", s,
                    type_map={"skill_order": "INT64", "is_draft": "BOOL"},
                )
            summary["exported"]["skills"] = len(skills)
        except Exception as e:
            logger.error(f"BQ skill export failed: {e}")
            summary["errors"].append(f"skills: {e}")

    async def _export_subskills(self, subskills: List[Dict], summary: Dict) -> None:
        if not subskills:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_SUBSKILLS)
            for ss in subskills:
                await self._upsert_row(
                    table_id, "subskill_id", ss,
                    type_map={
                        "subskill_order": "INT64",
                        "difficulty_start": "FLOAT64",
                        "difficulty_end": "FLOAT64",
                        "target_difficulty": "FLOAT64",
                        "is_draft": "BOOL",
                    },
                )
            summary["exported"]["subskills"] = len(subskills)
        except Exception as e:
            logger.error(f"BQ subskill export failed: {e}")
            summary["errors"].append(f"subskills: {e}")

    async def _export_edges(self, edges: List[Dict], summary: Dict) -> None:
        if not edges:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_EDGES)
            for e in edges:
                await self._upsert_row(
                    table_id, "edge_id", e,
                    type_map={
                        "strength": "FLOAT64",
                        "is_prerequisite": "BOOL",
                        "min_proficiency_threshold": "FLOAT64",
                        "confidence": "FLOAT64",
                        "is_draft": "BOOL",
                    },
                )
            summary["exported"]["edges"] = len(edges)
        except Exception as e:
            logger.error(f"BQ edge export failed: {e}")
            summary["errors"].append(f"edges: {e}")

    async def _export_prerequisites(self, prereqs: List[Dict], summary: Dict) -> None:
        if not prereqs:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_PREREQUISITES)
            for p in prereqs:
                await self._upsert_row(
                    table_id, "prerequisite_id", p,
                    type_map={"min_proficiency_threshold": "FLOAT64", "is_draft": "BOOL"},
                )
            summary["exported"]["prerequisites"] = len(prereqs)
        except Exception as e:
            logger.error(f"BQ prerequisite export failed: {e}")
            summary["errors"].append(f"prerequisites: {e}")

    async def _export_versions(self, versions: List[Dict], summary: Dict) -> None:
        if not versions:
            return
        try:
            table_id = settings.get_table_id(settings.TABLE_VERSIONS)
            for v in versions:
                await self._upsert_row(
                    table_id, "version_id", v,
                    type_map={"version_number": "INT64", "is_active": "BOOL"},
                )
            summary["exported"]["versions"] = len(versions)
        except Exception as e:
            logger.error(f"BQ version export failed: {e}")
            summary["errors"].append(f"versions: {e}")

    # ==================== Generic upsert helper ====================

    async def _upsert_row(
        self,
        table_id: str,
        pk_column: str,
        row: Dict[str, Any],
        type_map: Dict[str, str],
    ) -> None:
        """MERGE a single row into a BQ table (upsert by primary key)."""
        # Filter to only columns BQ expects (remove extra Firestore metadata)
        bq_row = {k: v for k, v in row.items() if not k.startswith("_")}

        update_clauses = ", ".join(f"T.{k} = @{k}" for k in bq_row.keys())
        fields = ", ".join(bq_row.keys())
        values = ", ".join(f"@{k}" for k in bq_row.keys())

        query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @{pk_column} AS pk) AS S
        ON T.{pk_column} = S.pk
        WHEN MATCHED THEN
          UPDATE SET {update_clauses}
        WHEN NOT MATCHED THEN
          INSERT ({fields}) VALUES ({values})
        """

        params = []
        for key, value in bq_row.items():
            bq_type = type_map.get(key, "STRING")
            params.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(query, params)


# Global instance
bigquery_export = BigQueryExportService()
