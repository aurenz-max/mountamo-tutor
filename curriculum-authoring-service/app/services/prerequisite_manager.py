"""
Prerequisite and learning path graph management service

Reads: Firestore-native via firestore_reader
Writes: Firestore-first (source of truth)
"""

import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.db.firestore_curriculum_reader import firestore_reader
from app.models.prerequisites import (
    Prerequisite, PrerequisiteCreate,
    EntityPrerequisites, PrerequisiteGraph,
    EntityType
)

logger = logging.getLogger(__name__)


class PrerequisiteManager:
    """Manages prerequisite relationships and learning path graphs"""

    async def create_prerequisite(
        self,
        prerequisite: PrerequisiteCreate,
        version_id: str,
        subject_id: str
    ) -> Prerequisite:
        """Create a new prerequisite relationship (Firestore-first)."""
        now = datetime.utcnow()
        prerequisite_id = str(uuid.uuid4())

        prerequisite_data = {
            "prerequisite_id": prerequisite_id,
            "subject_id": subject_id,
            **prerequisite.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
        }

        # Firestore is source of truth
        await firestore_curriculum_sync.sync_prerequisite(prerequisite_data)

        return Prerequisite(**prerequisite_data)

    async def delete_prerequisite(self, prerequisite_id: str) -> bool:
        """Delete a prerequisite relationship (Firestore-first)."""
        try:
            await firestore_curriculum_sync.delete_prerequisite(prerequisite_id)
            logger.info(f"Deleted prerequisite {prerequisite_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete prerequisite {prerequisite_id}: {e}")
            return False

    async def get_entity_prerequisites(
        self,
        entity_id: str,
        entity_type: EntityType,
        include_drafts: bool = False
    ) -> EntityPrerequisites:
        """Get all prerequisites and unlocks for an entity (Firestore-native read)."""
        result = await firestore_reader.get_entity_prerequisites(entity_id, entity_type)

        prerequisites = [Prerequisite(**r) for r in result["prerequisites"]]
        unlocks = [Prerequisite(**r) for r in result["unlocks"]]

        # Apply draft filter if needed
        if not include_drafts:
            prerequisites = [p for p in prerequisites if not p.is_draft]
            unlocks = [u for u in unlocks if not u.is_draft]

        return EntityPrerequisites(
            entity_id=entity_id,
            entity_type=entity_type,
            prerequisites=prerequisites,
            unlocks=unlocks,
        )

    async def get_subject_graph(
        self,
        subject_id: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """Build complete prerequisite graph for a subject (Firestore-native)."""
        nodes_raw = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=include_drafts)
        prereqs = await firestore_reader.get_prerequisites_for_subject(subject_id, include_drafts=include_drafts)

        nodes = [
            {"id": n["id"], "type": n["type"], "label": n["label"]}
            for n in nodes_raw
        ]
        edges = [
            {
                "source": p["prerequisite_entity_id"],
                "target": p["unlocks_entity_id"],
                "threshold": p.get("min_proficiency_threshold", 0.8),
            }
            for p in prereqs
        ]

        return PrerequisiteGraph(nodes=nodes, edges=edges)

    async def validate_prerequisite(
        self,
        prerequisite: PrerequisiteCreate
    ) -> tuple[bool, Optional[str]]:
        """Validate that a prerequisite doesn't create a circular dependency (in-memory DFS)."""
        logger.info(f"Cycle check: {prerequisite.unlocks_entity_id} -> {prerequisite.prerequisite_entity_id}")

        # Load all prerequisites into memory and build adjacency list
        # We need to find the subject first via the entity
        all_prereqs = await firestore_reader.get_entity_prerequisites(
            prerequisite.prerequisite_entity_id, prerequisite.prerequisite_entity_type
        )
        # Get a broader set by loading from subject if we can determine it
        # For now, load all prereqs reachable from the entities
        adj: Dict[str, List[str]] = {}

        # Build adjacency from both entity's prereqs and unlocks
        for p in all_prereqs["prerequisites"] + all_prereqs["unlocks"]:
            src = p.get("prerequisite_entity_id", "")
            tgt = p.get("unlocks_entity_id", "")
            adj.setdefault(src, []).append(tgt)

        target_prereqs = await firestore_reader.get_entity_prerequisites(
            prerequisite.unlocks_entity_id, prerequisite.unlocks_entity_type
        )
        for p in target_prereqs["prerequisites"] + target_prereqs["unlocks"]:
            src = p.get("prerequisite_entity_id", "")
            tgt = p.get("unlocks_entity_id", "")
            adj.setdefault(src, []).append(tgt)

        # DFS: check if there's a path from unlocks_entity → prerequisite_entity
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

        has_cycle = has_path(prerequisite.unlocks_entity_id, prerequisite.prerequisite_entity_id)

        if has_cycle:
            logger.warning(f"Circular dependency detected! Visited {len(visited)} nodes")
            return False, "Creating this prerequisite would create a circular dependency"

        logger.info(f"No circular dependency found. Visited {len(visited)} nodes")
        return True, None

    async def get_base_skills(self, subject_id: str) -> List[Dict[str, Any]]:
        """Get base skills/subskills with no prerequisites (Firestore-native)."""
        nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=False)
        prereqs = await firestore_reader.get_prerequisites_for_subject(subject_id, include_drafts=False)

        has_prereqs = {p["unlocks_entity_id"] for p in prereqs}

        return [
            {"entity_id": n["id"], "entity_type": n["type"]}
            for n in nodes
            if n["id"] not in has_prereqs
        ]

    async def build_enriched_graph(
        self,
        subject_id: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """Build enriched prerequisite graph with full hierarchical metadata (Firestore-native)."""
        logger.info(f"Building enriched graph for subject {subject_id} (include_drafts={include_drafts})")

        # Nodes with full hierarchy context
        nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=include_drafts)

        # Prerequisites
        prereqs = await firestore_reader.get_prerequisites_for_subject(subject_id, include_drafts=include_drafts)

        # Build edges
        edges = []
        for p in prereqs:
            edges.append({
                "id": p["prerequisite_id"],
                "source": p["prerequisite_entity_id"],
                "source_type": p["prerequisite_entity_type"],
                "target": p["unlocks_entity_id"],
                "target_type": p["unlocks_entity_type"],
                "threshold": p.get("min_proficiency_threshold", 0.8),
                "version_id": p["version_id"],
            })

        skill_count = sum(1 for n in nodes if n["type"] == "skill")
        subskill_count = sum(1 for n in nodes if n["type"] == "subskill")

        graph = PrerequisiteGraph(nodes=nodes, edges=edges)
        logger.info(f"Built enriched graph: {skill_count} skills, {subskill_count} subskills, {len(edges)} edges")

        return graph


# Global instance
prerequisite_manager = PrerequisiteManager()
