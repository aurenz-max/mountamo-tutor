"""
Firestore-native read layer for curriculum entities.

All methods require (grade, subject_id) — no scanning, no caching.

Reads from hierarchical draft documents:
  curriculum_drafts/{grade}/subjects/{subject_id}

Falls back to curriculum_published if no draft exists.

Graph data (edges, suggestions) lives in:
  curriculum_graphs/{grade}/subjects/{subject_id}/edges/{edge_id}
  curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/{suggestion_id}
"""

import logging
from typing import List, Optional, Dict, Any

from app.db.firestore_curriculum_service import firestore_curriculum_sync

logger = logging.getLogger(__name__)


class FirestoreCurriculumReader:
    """Read-only queries against curriculum draft/published docs and graph subcollections.

    Every method that accesses a subject requires (grade, subject_id).
    No scanning, no grade cache, no ambiguity.
    """

    @property
    def _client(self):
        return firestore_curriculum_sync.client

    @property
    def _c(self) -> Dict[str, Any]:
        """Flat collection references (versions, primitives, etc.)."""
        return firestore_curriculum_sync._collections

    # ==================== Graph Collection Refs ====================

    def _graph_ref(self, grade: str, subject_id: str):
        """Get the graph subject document reference."""
        return (
            self._client.collection("curriculum_graphs")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )

    def _edges_collection(self, grade: str, subject_id: str):
        """Get the edges subcollection for a (grade, subject) pair."""
        return self._graph_ref(grade, subject_id).collection("edges")

    def _suggestions_collection(self, grade: str, subject_id: str):
        """Get the suggestions subcollection for a (grade, subject) pair."""
        return self._graph_ref(grade, subject_id).collection("suggestions")

    # ==================== Draft doc access ====================

    async def _get_draft_doc(self, grade: str, subject_id: str) -> Optional[Dict[str, Any]]:
        """Get the hierarchical draft doc for a subject."""
        doc = (
            self._client.collection("curriculum_drafts")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None

    async def _get_published_doc(self, grade: str, subject_id: str) -> Optional[Dict[str, Any]]:
        """Get the hierarchical published doc for a subject."""
        doc = (
            self._client.collection("curriculum_published")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None

    async def _get_subject_doc(self, grade: str, subject_id: str) -> Optional[Dict[str, Any]]:
        """Get draft doc, falling back to published. Grade is required."""
        doc = await self._get_draft_doc(grade, subject_id)
        if doc:
            return doc
        return await self._get_published_doc(grade, subject_id)

    # ==================== SUBJECT READS ====================

    async def get_all_subjects(self, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """List all subjects from drafts (and published as fallback).

        Keys by (grade, subject_id) so the same subject_id in different
        grades (e.g. MATHEMATICS in Kindergarten and Grade 1) both appear.
        """
        subjects = {}  # (grade_doc_id, subject_doc_id) -> data

        # Drafts first
        for grade_doc in self._client.collection("curriculum_drafts").stream():
            for doc in grade_doc.reference.collection("subjects").stream():
                d = doc.to_dict()
                grade = d.get("grade", grade_doc.id)
                key = (grade_doc.id, doc.id)
                subjects[key] = {
                    "subject_id": doc.id,
                    "subject_name": d.get("subject_name", ""),
                    "description": d.get("description"),
                    "grade": grade,
                    "version_id": d.get("version_id", ""),
                    "is_active": True,
                    "is_draft": True,
                    "created_at": d.get("created_at", ""),
                    "updated_at": d.get("updated_at", d.get("created_at", "")),
                    "created_by": d.get("created_by"),
                }

        # Fill in from published for any subjects not in drafts
        for grade_doc in self._client.collection("curriculum_published").stream():
            for doc in grade_doc.reference.collection("subjects").stream():
                key = (grade_doc.id, doc.id)
                if key not in subjects:
                    d = doc.to_dict()
                    grade = d.get("grade", grade_doc.id)
                    subjects[key] = {
                        "subject_id": doc.id,
                        "subject_name": d.get("subject_name", ""),
                        "description": d.get("description"),
                        "grade": grade,
                        "version_id": d.get("version_id", ""),
                        "is_active": True,
                        "is_draft": False,
                        "created_at": d.get("deployed_at", ""),
                        "updated_at": d.get("deployed_at", ""),
                    }

        result = sorted(subjects.values(), key=lambda s: (s.get("grade", ""), s.get("subject_name", "")))
        return result

    async def get_subject(
        self, grade: str, subject_id: str, version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get subject metadata from the hierarchical doc."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return None
        return {
            "subject_id": doc.get("subject_id", subject_id),
            "subject_name": doc.get("subject_name", ""),
            "grade": doc.get("grade", grade),
            "version_id": doc.get("version_id", ""),
            "is_active": True,
            "is_draft": True,
            "created_at": doc.get("created_at", doc.get("deployed_at", "")),
            "updated_at": doc.get("updated_at", doc.get("deployed_at", "")),
            "created_by": doc.get("created_by", doc.get("deployed_by")),
        }

    # ==================== UNIT READS ====================

    async def get_units_by_subject(self, grade: str, subject_id: str, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """Get all units from the hierarchical doc."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return []

        now = doc.get("updated_at", doc.get("deployed_at", ""))
        units = []
        seen_unit_ids: set = set()
        for u in doc.get("curriculum", []):
            uid = u["unit_id"]
            if uid in seen_unit_ids:
                continue
            seen_unit_ids.add(uid)
            units.append({
                "unit_id": uid,
                "subject_id": subject_id,
                "unit_title": u.get("unit_title", ""),
                "unit_order": u.get("unit_order"),
                "description": u.get("description"),
                "version_id": doc.get("version_id", ""),
                "is_draft": False,
                "created_at": now,
                "updated_at": now,
            })

        units.sort(key=lambda x: (x.get("unit_order") or 0, x["unit_id"]))
        return units

    async def get_unit(self, grade: str, subject_id: str, unit_id: str) -> Optional[Dict[str, Any]]:
        """Find a unit by (grade, subject_id, unit_id)."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return None
        for u in doc.get("curriculum", []):
            if u["unit_id"] == unit_id:
                return {
                    **u,
                    "subject_id": subject_id,
                    "version_id": doc.get("version_id", ""),
                    "is_draft": False,
                    "created_at": doc.get("updated_at", ""),
                    "updated_at": doc.get("updated_at", ""),
                }
        return None

    # ==================== SKILL READS ====================

    async def get_skills_by_unit(self, grade: str, subject_id: str, unit_id: str, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """Get skills for a unit."""
        unit_doc = await self.get_unit(grade, subject_id, unit_id)
        if not unit_doc:
            return []

        now = unit_doc.get("updated_at", "")
        version_id = unit_doc.get("version_id", "")
        skills = []
        for sk in unit_doc.get("skills", []):
            skills.append({
                "skill_id": sk["skill_id"],
                "unit_id": unit_id,
                "skill_description": sk.get("skill_description", ""),
                "skill_order": sk.get("skill_order"),
                "version_id": version_id,
                "is_draft": False,
                "created_at": now,
                "updated_at": now,
            })
        skills.sort(key=lambda x: (x.get("skill_order") or 0, x["skill_id"]))
        return skills

    async def get_skill(self, grade: str, subject_id: str, skill_id: str) -> Optional[Dict[str, Any]]:
        """Find a skill by (grade, subject_id, skill_id)."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return None
        for u in doc.get("curriculum", []):
            for sk in u.get("skills", []):
                if sk["skill_id"] == skill_id:
                    return {
                        **sk,
                        "unit_id": u["unit_id"],
                        "version_id": doc.get("version_id", ""),
                        "is_draft": False,
                        "created_at": doc.get("updated_at", ""),
                        "updated_at": doc.get("updated_at", ""),
                    }
        return None

    # ==================== SUBSKILL READS ====================

    async def get_subskills_by_skill(self, grade: str, subject_id: str, skill_id: str, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """Get subskills for a skill."""
        skill_doc = await self.get_skill(grade, subject_id, skill_id)
        if not skill_doc:
            return []

        now = skill_doc.get("updated_at", "")
        version_id = skill_doc.get("version_id", "")
        result = []
        for ss in skill_doc.get("subskills", []):
            result.append({
                **ss,
                "skill_id": skill_id,
                "version_id": version_id,
                "is_draft": False,
                "created_at": now,
                "updated_at": now,
            })
        result.sort(key=lambda x: (x.get("subskill_order") or 0, x.get("subskill_id", "")))
        return result

    def _subskill_from_index(self, entry: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
        """Build a subskill response from a subskill_index entry + parent doc metadata."""
        return {
            **entry,
            "version_id": doc.get("version_id", ""),
            "is_draft": False,
            "created_at": doc.get("updated_at", ""),
            "updated_at": doc.get("updated_at", ""),
        }

    async def get_subskill(self, grade: str, subject_id: str, subskill_id: str) -> Optional[Dict[str, Any]]:
        """Find a subskill using the subskill_index for O(1) lookup."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return None
        idx = doc.get("subskill_index", {})
        if subskill_id in idx:
            return self._subskill_from_index(idx[subskill_id], doc)
        return None

    # ==================== HIERARCHICAL TREE ====================

    async def get_curriculum_tree(self, grade: str, subject_id: str, include_drafts: bool = False) -> Optional[Dict[str, Any]]:
        """Return the hierarchical tree directly from the doc (no joins needed)."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return None

        tree_units = []
        for u in doc.get("curriculum", []):
            unit_skills = []
            for sk in u.get("skills", []):
                skill_subskills = [
                    {
                        "id": ss["subskill_id"],
                        "description": ss.get("subskill_description", ""),
                        "order": ss.get("subskill_order"),
                        "difficulty_range": {
                            "start": ss.get("difficulty_start"),
                            "end": ss.get("difficulty_end"),
                            "target": ss.get("target_difficulty"),
                        },
                        "is_draft": False,
                        "target_primitive": ss.get("target_primitive"),
                        "target_eval_modes": ss.get("target_eval_modes"),
                    }
                    for ss in sk.get("subskills", [])
                ]
                unit_skills.append({
                    "id": sk["skill_id"],
                    "description": sk.get("skill_description", ""),
                    "order": sk.get("skill_order"),
                    "is_draft": False,
                    "subskills": skill_subskills,
                })
            tree_units.append({
                "id": u["unit_id"],
                "title": u.get("unit_title", ""),
                "order": u.get("unit_order"),
                "description": u.get("description"),
                "is_draft": False,
                "skills": unit_skills,
            })

        return {
            "subject_id": doc.get("subject_id", subject_id),
            "subject_name": doc.get("subject_name", ""),
            "grade": doc.get("grade", grade),
            "version_id": doc.get("version_id", ""),
            "units": tree_units,
        }

    # ==================== FLATTENED VIEW ====================

    async def get_flattened_view(self, grade: str, subject_id: str, version_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Flatten the hierarchical doc into rows (one per subskill)."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return []

        subject_name = doc.get("subject_name", "")
        doc_grade = doc.get("grade", grade)
        vid = version_id or doc.get("version_id", "")
        vnum = doc.get("version_number", 1)

        rows = []
        for u in doc.get("curriculum", []):
            for sk in u.get("skills", []):
                for ss in sk.get("subskills", []):
                    rows.append({
                        "subject": subject_name,
                        "grade": doc_grade,
                        "subject_id": subject_id,
                        "unit_id": u["unit_id"],
                        "unit_title": u.get("unit_title", ""),
                        "unit_order": u.get("unit_order"),
                        "skill_id": sk["skill_id"],
                        "skill_description": sk.get("skill_description", ""),
                        "skill_order": sk.get("skill_order"),
                        **ss,
                        "version_id": vid,
                        "version_number": vnum,
                    })

        rows.sort(key=lambda r: (
            r.get("unit_order") or 0,
            r.get("skill_order") or 0,
            r.get("skill_id", ""),
            r.get("subskill_order") or 0,
        ))
        return rows

    # ==================== EDGE READS (hierarchical graph subcollection) ====================

    async def get_edges_for_subject(self, grade: str, subject_id: str, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """Get all edges from curriculum_graphs/{grade}/subjects/{subject_id}/edges/."""
        coll = self._edges_collection(grade, subject_id)
        if not include_drafts:
            query = coll.where("is_draft", "==", False)
            return [doc.to_dict() for doc in query.stream()]
        return [doc.to_dict() for doc in coll.stream()]

    async def get_entity_edges(self, grade: str, subject_id: str, entity_id: str, entity_type: str, include_drafts: bool = False) -> Dict[str, List[Dict[str, Any]]]:
        """Get edges where entity is source or target."""
        return await self._entity_edges_from_collection(
            self._edges_collection(grade, subject_id),
            entity_id, include_drafts,
        )

    async def _entity_edges_from_collection(
        self, edges_coll, entity_id: str, include_drafts: bool
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Query a single edges subcollection for entity edges."""
        out_query = edges_coll.where("source_entity_id", "==", entity_id)
        if not include_drafts:
            out_query = out_query.where("is_draft", "==", False)
        outgoing = [doc.to_dict() for doc in out_query.stream()]

        in_query = edges_coll.where("target_entity_id", "==", entity_id)
        if not include_drafts:
            in_query = in_query.where("is_draft", "==", False)
        incoming = [doc.to_dict() for doc in in_query.stream()]

        return {"outgoing": outgoing, "incoming": incoming}

    async def get_prerequisite_edges(self, grade: str, subject_id: str) -> List[Dict[str, Any]]:
        """Get all prerequisite edges for a subject."""
        coll = self._edges_collection(grade, subject_id)
        query = coll.where("is_prerequisite", "==", True)
        return [doc.to_dict() for doc in query.stream()]

    async def get_edge(self, grade: str, subject_id: str, edge_id: str) -> Optional[Dict[str, Any]]:
        """Get a single edge by ID."""
        doc = self._edges_collection(grade, subject_id).document(edge_id).get()
        return doc.to_dict() if doc.exists else None

    # ==================== SUGGESTION READS (hierarchical graph subcollection) ====================

    async def get_suggestions_for_subject(
        self, grade: str, subject_id: str, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get suggestions from curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/."""
        coll = self._suggestions_collection(grade, subject_id)
        if status:
            query = coll.where("status", "==", status)
            return [doc.to_dict() for doc in query.stream()]
        return [doc.to_dict() for doc in coll.stream()]

    async def get_suggestion(self, grade: str, subject_id: str, suggestion_id: str) -> Optional[Dict[str, Any]]:
        """Get a single suggestion."""
        doc = self._suggestions_collection(grade, subject_id).document(suggestion_id).get()
        return doc.to_dict() if doc.exists else None

    # ==================== VERSION READS (flat) ====================

    async def get_versions(self, subject_id: str) -> List[Dict[str, Any]]:
        query = self._c["versions"].where("subject_id", "==", subject_id)
        docs = [doc.to_dict() for doc in query.stream()]
        docs.sort(key=lambda d: d.get("version_number", 0), reverse=True)
        return docs

    async def get_active_version(self, subject_id: str) -> Optional[Dict[str, Any]]:
        query = self._c["versions"].where("subject_id", "==", subject_id).where("is_active", "==", True).limit(1)
        docs = list(query.stream())
        return docs[0].to_dict() if docs else None

    async def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        doc = self._c["versions"].document(version_id).get()
        return doc.to_dict() if doc.exists else None

    async def get_max_version_number(self, subject_id: str) -> int:
        versions = await self.get_versions(subject_id)
        return max((v.get("version_number", 0) for v in versions), default=0)

    # ==================== PRIMITIVE READS (flat) ====================

    async def get_all_primitives(self) -> List[Dict[str, Any]]:
        docs = [doc.to_dict() for doc in self._c["primitives"].stream()]
        docs.sort(key=lambda d: (d.get("category", ""), d.get("primitive_name", "")))
        return docs

    async def get_primitives_by_category(self, category: str) -> List[Dict[str, Any]]:
        query = self._c["primitives"].where("category", "==", category)
        docs = [doc.to_dict() for doc in query.stream()]
        docs.sort(key=lambda d: d.get("primitive_name", ""))
        return docs

    # ==================== DRAFT ENTITY HELPERS ====================

    async def get_draft_entities(self, grade: str, subject_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get draft entities from the hierarchical doc."""
        result: Dict[str, List[Dict[str, Any]]] = {
            "subjects": [], "units": [], "skills": [],
            "subskills": [], "prerequisites": [], "edges": [],
        }

        doc = await self._get_subject_doc(grade, subject_id)
        if doc:
            result["subjects"].append({
                "subject_id": subject_id,
                "subject_name": doc.get("subject_name", ""),
            })
            for u in doc.get("curriculum", []):
                result["units"].append({"unit_id": u["unit_id"], "unit_title": u.get("unit_title", "")})
                for sk in u.get("skills", []):
                    result["skills"].append({"skill_id": sk["skill_id"], "skill_description": sk.get("skill_description", "")})
                    for ss in sk.get("subskills", []):
                        result["subskills"].append({"subskill_id": ss["subskill_id"], "subskill_description": ss.get("subskill_description", "")})

        # Edges from graph subcollection
        for doc in self._edges_collection(grade, subject_id).where("is_draft", "==", True).stream():
            result["edges"].append(doc.to_dict())

        return result

    # ==================== GRAPH NODES (for EdgeManager/ScopedSuggestions) ====================

    async def get_subject_graph_nodes(self, grade: str, subject_id: str, include_drafts: bool = False) -> List[Dict[str, Any]]:
        """Get skill and subskill nodes with hierarchy context from the draft doc."""
        doc = await self._get_subject_doc(grade, subject_id)
        if not doc:
            return []

        nodes = []
        for u in doc.get("curriculum", []):
            for sk in u.get("skills", []):
                nodes.append({
                    "id": sk["skill_id"],
                    "type": "skill",
                    "label": sk.get("skill_description", ""),
                    "unit_id": u["unit_id"],
                    "unit_title": u.get("unit_title", ""),
                    "subject_id": subject_id,
                })
                for ss in sk.get("subskills", []):
                    nodes.append({
                        "id": ss["subskill_id"],
                        "type": "subskill",
                        "label": ss.get("subskill_description", ""),
                        "skill_id": sk["skill_id"],
                        "skill_description": sk.get("skill_description", ""),
                        "unit_id": u["unit_id"],
                        "unit_title": u.get("unit_title", ""),
                        "subject_id": subject_id,
                        "difficulty_start": ss.get("difficulty_start"),
                        "difficulty_end": ss.get("difficulty_end"),
                        "target_difficulty": ss.get("target_difficulty"),
                    })
        return nodes


# Global instance
firestore_reader = FirestoreCurriculumReader()
