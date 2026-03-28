"""
Curriculum knowledge graph edge management service.

Manages typed edges (prerequisite, builds_on, reinforces, parallel, applies).

Reads: Firestore-native via firestore_reader
Writes: Firestore-first (source of truth)

For parallel relationships, auto-creates a reverse edge (A->B + B->A)
linked by pair_id for atomic creation/deletion.
"""

import logging
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.db.firestore_curriculum_reader import firestore_reader
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
        """Write edge to Firestore (source of truth)."""
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

        # Firestore is source of truth
        await firestore_curriculum_sync.sync_edge(row)

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
        reverse edge too. (Firestore-first)
        """
        # Look up pair_id and subject_id (Firestore-native read)
        edge_doc = await firestore_reader.get_edge(edge_id)
        if not edge_doc:
            logger.warning(f"Edge {edge_id} not found")
            return False

        pair_id = edge_doc.get("pair_id")
        resolved_subject = subject_id or edge_doc.get("subject_id")

        try:
            # Firestore is source of truth
            await firestore_curriculum_sync.delete_edge(edge_id)
            if pair_id:
                await firestore_curriculum_sync.delete_edge_by_pair(pair_id)

            logger.info(f"Deleted edge {edge_id}" + (f" (+ pair {pair_id})" if pair_id else ""))

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
        """Get all edges where entity is source or target (Firestore-native read)."""
        result = await firestore_reader.get_entity_edges(entity_id, entity_type, include_drafts=include_drafts)

        outgoing = [CurriculumEdge(**e) for e in result["outgoing"]]
        incoming = [CurriculumEdge(**e) for e in result["incoming"]]

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
        """Build the full knowledge graph for a subject (Firestore-native reads)."""
        logger.info(f"Building knowledge graph for {subject_id} (drafts={include_drafts})")

        # Nodes via the reader's enriched helper
        nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=include_drafts)

        # Edges
        raw_edges = await firestore_reader.get_edges_for_subject(subject_id, include_drafts=include_drafts)

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
        subject_id: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate an edge before creation.

        - Non-prerequisite edges: always valid (cycles OK in the full graph).
        - Prerequisite edges: in-memory DFS cycle detection on the prerequisite subgraph.
        """
        if not edge.is_prerequisite:
            return True, None

        logger.info(
            f"Cycle check: {edge.target_entity_id} -?-> {edge.source_entity_id} "
            f"on prerequisite subgraph"
        )

        # Load all prerequisite edges for the subject into memory
        # (typically <500 edges — fast enough for in-memory DFS)
        if subject_id:
            prereq_edges = await firestore_reader.get_prerequisite_edges(subject_id)
        else:
            # Fallback: load edges for the entity's subject by checking both directions
            prereq_edges = []
            for eid in (edge.source_entity_id, edge.target_entity_id):
                result = await firestore_reader.get_entity_edges(eid, edge.source_entity_type)
                for e in result["outgoing"] + result["incoming"]:
                    if e.get("is_prerequisite"):
                        prereq_edges.append(e)

        # Build adjacency list
        adj: Dict[str, List[str]] = {}
        for e in prereq_edges:
            src = e["source_entity_id"]
            tgt = e["target_entity_id"]
            adj.setdefault(src, []).append(tgt)

        # DFS: check if there's a path from target → source (which would form a cycle)
        visited: set = set()

        def has_path(from_id: str, to_id: str) -> bool:
            if from_id == to_id:
                return True
            if from_id in visited:
                return False
            visited.add(from_id)
            for neighbor in adj.get(from_id, []):
                if has_path(neighbor, to_id):
                    return True
            return False

        has_cycle = has_path(edge.target_entity_id, edge.source_entity_id)

        if has_cycle:
            return False, "Creating this prerequisite edge would create a cycle in the prerequisite subgraph"

        return True, None

    # ------------------------------------------------------------------ #
    #  BASE SKILLS
    # ------------------------------------------------------------------ #

    async def get_base_skills(self, subject_id: str) -> List[Dict[str, Any]]:
        """Get entry-point entities with no prerequisite edges targeting them (Firestore-native)."""
        # Load all nodes and prerequisite edges
        nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=False)
        prereq_edges = await firestore_reader.get_prerequisite_edges(subject_id)

        # Set of entity IDs that have incoming prerequisite edges
        has_prereqs = {e["target_entity_id"] for e in prereq_edges if not e.get("is_draft")}

        # Filter nodes to those without prerequisites
        return [
            {"entity_id": n["id"], "entity_type": n["type"]}
            for n in nodes
            if n["id"] not in has_prereqs
        ]


# Global instance
edge_manager = EdgeManager()
