"""
Graph Flattening Service — reads hierarchical curriculum graph from Firestore
and produces the flat {nodes, edges} format that Pulse/LearningPaths expect.

Firestore hierarchy (written by curriculum-authoring-service):
  curriculum_graphs/{grade}/subjects/{subject_id}          — subject shell doc
  curriculum_graphs/{grade}/subjects/{subject_id}/edges/   — edge documents

Flat cache (consumed by backend):
  curriculum_graphs/{subject_id}_latest_published          — {graph: {nodes, edges}}

This service lives in the authoring service so flattening can be triggered
automatically after publish/deploy without requiring the backend to be running.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.firestore_graph_service import firestore_graph_service

logger = logging.getLogger(__name__)


class GraphFlatteningService:
    """Reads hierarchical graph subcollections and flattens for backend use."""

    @property
    def client(self):
        """Lazy access — Firestore client is initialized after app startup."""
        return firestore_graph_service.client

    # ------------------------------------------------------------------
    # Grade resolution and prefixing
    # ------------------------------------------------------------------

    # Map Firestore grade doc IDs to short prefixes for flat cache keys.
    # Examples: "Kindergarten" → "GK", "1" → "G1", "2" → "G2"
    GRADE_PREFIX_MAP: Dict[str, str] = {
        "Kindergarten": "GK",
        "K": "GK",
    }

    @classmethod
    def _grade_prefix(cls, grade: str) -> str:
        """Convert a grade doc ID to a short prefix for flat cache keys.

        Kindergarten → GK, 1 → G1, 2 → G2, etc.
        """
        return cls.GRADE_PREFIX_MAP.get(grade, f"G{grade}")

    def _resolve_grade(self, subject_id: str) -> Optional[str]:
        """Find which grade document contains this subject."""
        graphs_coll = self.client.collection("curriculum_graphs")

        for grade_doc in graphs_coll.stream():
            grade_id = grade_doc.id
            # Skip flat cache documents (e.g. "MATH_latest_published")
            if "_" in grade_id and len(grade_id) > 5:
                continue

            subj_ref = (
                graphs_coll.document(grade_id)
                .collection("subjects")
                .document(subject_id)
            )
            subj_doc = subj_ref.get()
            if subj_doc.exists:
                return grade_id

        # Fallback: check curriculum_published for grade mapping
        for coll_name in ("curriculum_published", "curriculum_drafts"):
            for grade_doc in self.client.collection(coll_name).stream():
                subj_ref = (
                    grade_doc.reference.collection("subjects").document(subject_id)
                )
                subj_doc = subj_ref.get()
                if subj_doc.exists:
                    doc_data = subj_doc.to_dict()
                    return doc_data.get("grade", grade_doc.id)

        return None

    # ------------------------------------------------------------------
    # Read edges from hierarchical subcollection
    # ------------------------------------------------------------------

    def _read_hierarchical_edges(
        self, grade: str, subject_id: str, published_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Read edges from curriculum_graphs/{grade}/subjects/{subject_id}/edges/."""
        edges_coll = (
            self.client.collection("curriculum_graphs")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
            .collection("edges")
        )

        if published_only:
            query = edges_coll.where("is_draft", "==", False)
        else:
            query = edges_coll

        raw_edges = []
        for doc in query.stream():
            raw_edges.append(doc.to_dict())

        return raw_edges

    # ------------------------------------------------------------------
    # Read nodes from curriculum_published
    # ------------------------------------------------------------------

    def _read_nodes_from_published(
        self, grade: str, subject_id: str
    ) -> List[Dict[str, Any]]:
        """Build node list from curriculum_published/{grade}/subjects/{subject_id}."""
        doc_ref = (
            self.client.collection("curriculum_published")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            logger.warning(f"No published curriculum for {subject_id} (grade={grade})")
            return []

        data = doc.to_dict()
        nodes = []

        # The authoring service stores units under "curriculum", not "units"
        units = data.get("curriculum", data.get("units", []))
        for unit in units:
            unit_id = unit.get("unit_id", "")
            for skill in unit.get("skills", []):
                skill_id = skill.get("skill_id", "")
                nodes.append({
                    "id": skill_id,
                    "type": "skill",
                    "entity_type": "skill",
                    "label": skill.get("skill_description", skill_id),
                    "unit_id": unit_id,
                    "unit_title": unit.get("unit_title", ""),
                    "skill_order": skill.get("skill_order", 0),
                })

                for sub in skill.get("subskills", []):
                    sub_id = sub.get("subskill_id", "")
                    nodes.append({
                        "id": sub_id,
                        "type": "subskill",
                        "entity_type": "subskill",
                        "label": sub.get("subskill_description", sub_id),
                        "skill_id": skill_id,
                        "unit_id": unit_id,
                        "subskill_order": sub.get("subskill_order", 0),
                        "primitives": sub.get("primitives", []),
                    })

        return nodes

    def _read_nodes_from_graph_doc(
        self, grade: str, subject_id: str
    ) -> List[Dict[str, Any]]:
        """Fallback: read nodes from the graph subject shell doc if it has them."""
        doc_ref = (
            self.client.collection("curriculum_graphs")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            return []

        data = doc.to_dict()
        return data.get("nodes", [])

    # ------------------------------------------------------------------
    # Flatten: hierarchical → flat {nodes, edges}
    # ------------------------------------------------------------------

    def flatten_graph(
        self, subject_id: str, published_only: bool = True,
        grade: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Read the hierarchical graph and return flat {nodes, edges} format.

        This is the format expected by LearningPathsService and PulseEngine.

        The flat cache doc ID always includes a grade prefix so each
        grade+subject combination has its own cache document:
          MATHEMATICS_GK_latest_published   (Kindergarten)
          MATHEMATICS_G1_latest_published   (Grade 1)
          SCIENCE_G1_latest_published       (Grade 1)

        Args:
            subject_id: e.g. "MATHEMATICS" or "LANGUAGE_ARTS"
            published_only: True for published, False for draft
            grade: Grade doc ID (e.g. "Kindergarten", "1"). If None,
                   resolved automatically via _resolve_grade().
        """
        subject_id = subject_id.upper().replace(" ", "_")

        if not grade:
            grade = self._resolve_grade(subject_id)
        if not grade:
            logger.warning(f"[FLATTEN] Cannot resolve grade for {subject_id}")
            return None

        grade_pfx = self._grade_prefix(grade)
        # Avoid doubling the grade suffix (e.g. LANGUAGE_ARTS_G1 + _G1)
        if subject_id.endswith(f"_{grade_pfx}"):
            cache_subject_id = subject_id
        else:
            cache_subject_id = f"{subject_id}_{grade_pfx}"

        logger.info(
            f"[FLATTEN] Reading hierarchical graph for {subject_id} "
            f"(grade={grade}, cache_id={cache_subject_id})"
        )

        # Read edges from hierarchical subcollection
        raw_edges = self._read_hierarchical_edges(grade, subject_id, published_only)

        # Enrich edges into the flat format pulse/learning_paths expect
        edges = []
        for e in raw_edges:
            edges.append({
                "id": e.get("edge_id", ""),
                "source": e.get("source_entity_id", ""),
                "source_type": e.get("source_entity_type", ""),
                "target": e.get("target_entity_id", ""),
                "target_type": e.get("target_entity_type", ""),
                "threshold": e.get("min_proficiency_threshold", 0.8),
                "relationship": e.get("relationship", "prerequisite"),
                "strength": e.get("strength", 1.0),
                "is_prerequisite": e.get("is_prerequisite", True),
                "rationale": e.get("rationale"),
                "authored_by": e.get("authored_by", "human"),
                "confidence": e.get("confidence"),
                "version_id": e.get("version_id"),
            })

        # Read nodes from curriculum_published
        nodes = self._read_nodes_from_published(grade, subject_id)

        # If no nodes from published, try reading from the graph subject doc
        if not nodes:
            nodes = self._read_nodes_from_graph_doc(grade, subject_id)

        version_type = "published" if published_only else "draft"
        now = datetime.now(timezone.utc).isoformat()

        # Compute metadata
        skill_count = sum(1 for n in nodes if n.get("type") == "skill")
        subskill_count = sum(1 for n in nodes if n.get("type") == "subskill")
        rel_counts = Counter(e.get("relationship", "prerequisite") for e in edges)

        result = {
            "id": f"{cache_subject_id}_latest_{version_type}",
            "subject_id": cache_subject_id,
            "grade": grade,
            "grade_prefix": grade_pfx,
            "base_subject_id": subject_id,
            "version_id": "latest",
            "version_type": version_type,
            "graph": {
                "nodes": nodes,
                "edges": edges,
            },
            "metadata": {
                "entity_counts": {
                    "skills": skill_count,
                    "subskills": subskill_count,
                    "total": len(nodes),
                },
                "edge_count": len(edges),
                "edge_counts": {
                    "total": len(edges),
                    "prerequisite": rel_counts.get("prerequisite", 0),
                    "builds_on": rel_counts.get("builds_on", 0),
                    "reinforces": rel_counts.get("reinforces", 0),
                    "parallel": rel_counts.get("parallel", 0),
                    "applies": rel_counts.get("applies", 0),
                },
            },
            "generated_at": now,
            "last_accessed": now,
            "source": "graph_flattening_service",
        }

        logger.info(
            f"[FLATTEN] Produced flat graph for {cache_subject_id}: "
            f"{len(nodes)} nodes, {len(edges)} edges"
        )
        return result

    # ------------------------------------------------------------------
    # Write flattened graph back to the cache collection
    # ------------------------------------------------------------------

    def rebuild_cache(
        self, subject_id: str, published_only: bool = True,
        grade: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Flatten the graph and write it to the cache collection.

        Writes to curriculum_graphs/{SUBJECT}_{GRADE_PREFIX}_latest_{type}
        (e.g. MATHEMATICS_GK_latest_published) so each grade+subject has
        its own cache document.

        Args:
            subject_id: e.g. "MATHEMATICS"
            published_only: True for published, False for draft
            grade: Grade doc ID (e.g. "Kindergarten", "1"). Auto-resolved if None.
        """
        flat = self.flatten_graph(subject_id, published_only, grade=grade)
        if not flat:
            return None

        doc_id = flat["id"]
        doc_ref = self.client.collection("curriculum_graphs").document(doc_id)
        doc_ref.set(flat)

        logger.info(f"[FLATTEN] Rebuilt cache: curriculum_graphs/{doc_id}")
        return flat

    # ------------------------------------------------------------------
    # Convenience: flatten + cache all subjects for a grade
    # ------------------------------------------------------------------

    def rebuild_all_for_grade(self, grade: str) -> List[str]:
        """Rebuild caches for all subjects under a grade.

        Passes ``grade`` explicitly so each subject gets the correct
        grade-prefixed cache key (e.g. MATHEMATICS_G1_latest_published).
        """
        subjects_coll = (
            self.client.collection("curriculum_graphs")
            .document(grade)
            .collection("subjects")
        )

        rebuilt = []
        for doc in subjects_coll.stream():
            subject_id = doc.id
            try:
                self.rebuild_cache(subject_id, grade=grade)
                rebuilt.append(subject_id)
            except Exception as e:
                logger.error(f"[FLATTEN] Failed to rebuild {subject_id}: {e}")

        return rebuilt


# Module-level singleton
graph_flattening_service = GraphFlatteningService()
