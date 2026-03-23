"""
Curriculum knowledge graph edge management service.

Manages typed edges (prerequisite, builds_on, reinforces, parallel, applies)
with BigQuery as source of truth and Firestore dual-write for sync.
Replaces the prerequisite-only model with a richer knowledge graph model.

For parallel relationships, auto-creates a reverse edge (A->B + B->A)
linked by pair_id for atomic creation/deletion.
"""

import logging
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.models.edges import (
    CurriculumEdge, CurriculumEdgeCreate, EntityEdges,
    CurriculumGraph, EntityType, RelationshipType,
)

logger = logging.getLogger(__name__)


class EdgeManager:
    """Manages curriculum knowledge graph edges."""

    # ------------------------------------------------------------------ #
    #  CREATE
    # ------------------------------------------------------------------ #

    async def create_edge(
        self,
        edge: CurriculumEdgeCreate,
        version_id: str,
        subject_id: str,
        *,
        on_mutation: Any = None,
    ) -> CurriculumEdge:
        """
        Create a new edge. For ``relationship="parallel"`` a reverse edge
        is auto-created and both share a ``pair_id``.

        Args:
            on_mutation: Optional async callback ``fn(subject_id, event)``
                         invoked after successful write (used by the agent
                         service for event-driven re-analysis).
        """
        pair_id = str(uuid.uuid4()) if edge.relationship == "parallel" else None

        created = await self._insert_edge(edge, version_id, subject_id, pair_id=pair_id)

        # Auto-create reverse for parallel
        if edge.relationship == "parallel":
            reverse = CurriculumEdgeCreate(
                source_entity_id=edge.target_entity_id,
                source_entity_type=edge.target_entity_type,
                target_entity_id=edge.source_entity_id,
                target_entity_type=edge.source_entity_type,
                relationship=edge.relationship,
                strength=edge.strength,
                is_prerequisite=False,  # Parallel edges are never prerequisites
                min_proficiency_threshold=None,
                rationale=edge.rationale,
                authored_by=edge.authored_by,
                confidence=edge.confidence,
            )
            await self._insert_edge(reverse, version_id, subject_id, pair_id=pair_id)

        if on_mutation:
            try:
                await on_mutation(subject_id, "edge_created")
            except Exception as exc:
                logger.warning(f"on_mutation callback failed (non-blocking): {exc}")

        return created

    async def _insert_edge(
        self,
        edge: CurriculumEdgeCreate,
        version_id: str,
        subject_id: str,
        *,
        pair_id: Optional[str] = None,
    ) -> CurriculumEdge:
        """Low-level BigQuery INSERT + Firestore dual-write."""
        now = datetime.utcnow()
        edge_id = str(uuid.uuid4())

        row = {
            "edge_id": edge_id,
            "subject_id": subject_id,
            "source_entity_id": edge.source_entity_id,
            "source_entity_type": edge.source_entity_type,
            "target_entity_id": edge.target_entity_id,
            "target_entity_type": edge.target_entity_type,
            "relationship": edge.relationship,
            "strength": edge.strength,
            "is_prerequisite": edge.is_prerequisite,
            "min_proficiency_threshold": edge.min_proficiency_threshold,
            "rationale": edge.rationale,
            "authored_by": edge.authored_by,
            "confidence": edge.confidence,
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "pair_id": pair_id,
        }

        table_id = settings.get_table_id(settings.TABLE_EDGES)
        fields = ", ".join(row.keys())
        placeholders = ", ".join(f"@{k}" for k in row.keys())

        query = f"INSERT INTO `{table_id}` ({fields}) VALUES ({placeholders})"

        type_map = {
            "strength": "FLOAT64",
            "is_prerequisite": "BOOL",
            "min_proficiency_threshold": "FLOAT64",
            "confidence": "FLOAT64",
            "is_draft": "BOOL",
        }
        params = []
        for key, value in row.items():
            bq_type = type_map.get(key, "STRING")
            params.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(query, params)

        # Dual-write to Firestore (best-effort)
        try:
            await firestore_curriculum_sync.sync_edge(row)
        except Exception as exc:
            logger.warning(f"Firestore edge sync failed (non-blocking): {exc}")

        return CurriculumEdge(**row, created_at=now, updated_at=now)

    # ------------------------------------------------------------------ #
    #  DELETE
    # ------------------------------------------------------------------ #

    async def delete_edge(
        self,
        edge_id: str,
        *,
        on_mutation: Any = None,
        subject_id: Optional[str] = None,
    ) -> bool:
        """
        Delete an edge. If it has a pair_id (parallel), deletes the paired
        reverse edge too.
        """
        table_id = settings.get_table_id(settings.TABLE_EDGES)

        # Look up pair_id and subject_id
        lookup = f"SELECT pair_id, subject_id FROM `{table_id}` WHERE edge_id = @edge_id"
        params = [bigquery.ScalarQueryParameter("edge_id", "STRING", edge_id)]
        rows = await db.execute_query(lookup, params)

        if not rows:
            logger.warning(f"Edge {edge_id} not found")
            return False

        pair_id = rows[0].get("pair_id")
        resolved_subject = subject_id or rows[0].get("subject_id")

        if pair_id:
            # Delete both paired edges
            delete_q = f"DELETE FROM `{table_id}` WHERE pair_id = @pair_id"
            del_params = [bigquery.ScalarQueryParameter("pair_id", "STRING", pair_id)]
        else:
            delete_q = f"DELETE FROM `{table_id}` WHERE edge_id = @edge_id"
            del_params = params

        try:
            await db.execute_query(delete_q, del_params)
            logger.info(f"Deleted edge {edge_id}" + (f" (+ pair {pair_id})" if pair_id else ""))

            # Firestore cleanup (best-effort)
            try:
                await firestore_curriculum_sync.delete_edge(edge_id)
                if pair_id:
                    await firestore_curriculum_sync.delete_edge_by_pair(pair_id)
            except Exception:
                pass

            if on_mutation and resolved_subject:
                try:
                    await on_mutation(resolved_subject, "edge_deleted")
                except Exception as exc:
                    logger.warning(f"on_mutation callback failed: {exc}")

            return True
        except Exception as e:
            logger.error(f"Failed to delete edge {edge_id}: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  READ
    # ------------------------------------------------------------------ #

    async def get_entity_edges(
        self,
        entity_id: str,
        entity_type: EntityType,
        include_drafts: bool = False,
    ) -> EntityEdges:
        """Get all edges where entity is source or target."""
        table_id = settings.get_table_id(settings.TABLE_EDGES)

        query = f"""
        SELECT *, 'outgoing' AS direction
        FROM `{table_id}`
        WHERE source_entity_id = @entity_id
          AND source_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}

        UNION ALL

        SELECT *, 'incoming' AS direction
        FROM `{table_id}`
        WHERE target_entity_id = @entity_id
          AND target_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}
        """
        params = [
            bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id),
            bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type),
        ]
        rows = await db.execute_query(query, params)

        outgoing, incoming = [], []
        for row in rows:
            direction = row.pop("direction")
            edge = CurriculumEdge(**row)
            (outgoing if direction == "outgoing" else incoming).append(edge)

        return EntityEdges(
            entity_id=entity_id,
            entity_type=entity_type,
            outgoing=outgoing,
            incoming=incoming,
        )

    async def get_subject_graph(
        self,
        subject_id: str,
        include_drafts: bool = False,
    ) -> CurriculumGraph:
        """Build the full knowledge graph for a subject (nodes + enriched edges)."""
        logger.info(f"Building knowledge graph for {subject_id} (drafts={include_drafts})")

        params = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]

        # ---- Nodes (same queries as PrerequisiteManager.build_enriched_graph) ----
        skills_query = f"""
        SELECT
            s.skill_id, s.skill_description, s.skill_order,
            u.unit_id, u.unit_title, u.unit_order, u.subject_id
        FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` s
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
          {'' if include_drafts else 'AND s.is_draft = false AND u.is_draft = false'}
        """

        subskills_query = f"""
        SELECT
            ss.subskill_id, ss.subskill_description, ss.subskill_order,
            ss.difficulty_start, ss.difficulty_end, ss.target_difficulty,
            s.skill_id AS parent_skill_id, s.skill_description AS parent_skill_description,
            s.skill_order,
            u.unit_id, u.unit_title, u.unit_order, u.subject_id
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` ss
        JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` s ON ss.skill_id = s.skill_id
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
          {'' if include_drafts else 'AND ss.is_draft = false AND s.is_draft = false AND u.is_draft = false'}
        """

        # ---- Edges from curriculum_edges ----
        edges_query = f"""
        SELECT e.*
        FROM `{settings.get_table_id(settings.TABLE_EDGES)}` e
        WHERE e.subject_id = @subject_id
          {'' if include_drafts else 'AND e.is_draft = false'}
        """

        skills = await db.execute_query(skills_query, params)
        subskills = await db.execute_query(subskills_query, params)
        raw_edges = await db.execute_query(edges_query, params)

        # Build nodes
        nodes = []
        for sk in skills:
            nodes.append({
                "id": sk["skill_id"],
                "type": "skill",
                "label": sk["skill_description"],
                "subject_id": sk["subject_id"],
                "unit_id": sk["unit_id"],
                "unit_title": sk["unit_title"],
                "unit_order": sk["unit_order"],
                "skill_order": sk["skill_order"],
            })
        for ss in subskills:
            nodes.append({
                "id": ss["subskill_id"],
                "type": "subskill",
                "label": ss["subskill_description"],
                "subject_id": ss["subject_id"],
                "unit_id": ss["unit_id"],
                "unit_title": ss["unit_title"],
                "unit_order": ss["unit_order"],
                "skill_id": ss["parent_skill_id"],
                "skill_description": ss.get("parent_skill_description"),
                "skill_order": ss["skill_order"],
                "subskill_order": ss["subskill_order"],
                "difficulty_start": ss.get("difficulty_start"),
                "difficulty_end": ss.get("difficulty_end"),
                "target_difficulty": ss.get("target_difficulty"),
            })

        # Build enriched edges (superset of old format — includes source/target/threshold
        # for backward compat plus new knowledge-graph fields)
        edges = []
        for e in raw_edges:
            edges.append({
                "id": e["edge_id"],
                "source": e["source_entity_id"],
                "source_type": e["source_entity_type"],
                "target": e["target_entity_id"],
                "target_type": e["target_entity_type"],
                "threshold": e.get("min_proficiency_threshold", 0.8),
                # Knowledge-graph fields
                "relationship": e.get("relationship", "prerequisite"),
                "strength": e.get("strength", 1.0),
                "is_prerequisite": e.get("is_prerequisite", True),
                "rationale": e.get("rationale"),
                "authored_by": e.get("authored_by", "human"),
                "confidence": e.get("confidence"),
                "version_id": e.get("version_id"),
            })

        logger.info(
            f"Built knowledge graph: {len(nodes)} nodes, {len(edges)} edges "
            f"({sum(1 for e in edges if e['is_prerequisite'])} prerequisite, "
            f"{sum(1 for e in edges if not e['is_prerequisite'])} non-prerequisite)"
        )

        return CurriculumGraph(nodes=nodes, edges=edges)

    # ------------------------------------------------------------------ #
    #  VALIDATE
    # ------------------------------------------------------------------ #

    async def validate_edge(
        self,
        edge: CurriculumEdgeCreate,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate an edge before creation.

        - Non-prerequisite edges: always valid (cycles OK in the full graph).
        - Prerequisite edges: cycle detection on the prerequisite subgraph.
        """
        if not edge.is_prerequisite:
            return True, None

        logger.info(
            f"Cycle check: {edge.target_entity_id} -?-> {edge.source_entity_id} "
            f"on prerequisite subgraph"
        )

        visited: set[str] = set()
        table_id = settings.get_table_id(settings.TABLE_EDGES)

        async def has_path(from_id: str, to_id: str) -> bool:
            if from_id == to_id:
                return True
            if from_id in visited:
                return False
            visited.add(from_id)

            query = f"""
            SELECT target_entity_id
            FROM `{table_id}`
            WHERE source_entity_id = @from_id
              AND is_prerequisite = true
              AND is_draft = false
            """
            params = [bigquery.ScalarQueryParameter("from_id", "STRING", from_id)]
            rows = await db.execute_query(query, params)

            for row in rows:
                if await has_path(row["target_entity_id"], to_id):
                    return True
            return False

        has_cycle = await has_path(edge.target_entity_id, edge.source_entity_id)

        if has_cycle:
            return False, "Creating this prerequisite edge would create a cycle in the prerequisite subgraph"

        return True, None

    # ------------------------------------------------------------------ #
    #  BASE SKILLS
    # ------------------------------------------------------------------ #

    async def get_base_skills(self, subject_id: str) -> List[Dict[str, Any]]:
        """Get entry-point entities (no prerequisite edges targeting them)."""
        table_id = settings.get_table_id(settings.TABLE_EDGES)

        query = f"""
        WITH subject_entities AS (
          SELECT s.skill_id AS entity_id, 'skill' AS entity_type
          FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` s
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id AND s.is_draft = false

          UNION ALL

          SELECT ss.subskill_id AS entity_id, 'subskill' AS entity_type
          FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` ss
          JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` s ON ss.skill_id = s.skill_id
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id AND ss.is_draft = false
        ),
        entities_with_prereqs AS (
          SELECT DISTINCT target_entity_id AS entity_id
          FROM `{table_id}`
          WHERE is_prerequisite = true AND is_draft = false
        )

        SELECT se.*
        FROM subject_entities se
        LEFT JOIN entities_with_prereqs ewp ON se.entity_id = ewp.entity_id
        WHERE ewp.entity_id IS NULL
        """

        params = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, params)
        return [dict(row) for row in results]


# Global instance
edge_manager = EdgeManager()
