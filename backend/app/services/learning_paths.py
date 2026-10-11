# app/services/learning_paths.py

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timezone

from .curriculum_scope import (
    GradeUnresolved,
    grade_key,
    scoped_subject_id,
    split_scoped,
    student_scoped_subject,
    subject_key,
)

logger = logging.getLogger(__name__)

GRAPH_CACHE_TTL_S = 600


class LearningPathsService:
    """
    Learning paths service using Firestore-native prerequisite graph system.

    All data is read from Firestore in real-time:
    - curriculum_graphs: Nodes + edges (prerequisite relationships with thresholds)
    - students/{id}/competencies: Real-time proficiency scores
    - students/{id}/learning_paths: Cached unlock state per subject
    - curriculum_published: Curriculum hierarchy (units/skills/subskills)

    Supports:
    - Subskill -> Subskill unlocks
    - Skill -> Skill unlocks
    - Multiple AND prerequisites for a single unlock
    - Proficiency thresholds per prerequisite (0.8, 0.9, etc.)
    """

    def __init__(
        self,
        firestore_service: Any,  # FirestoreService
        project_id: str,
    ):
        """
        Initialize learning paths service.

        Args:
            firestore_service: FirestoreService for all data access
            project_id: Google Cloud project ID
        """
        self.firestore = firestore_service
        self.project_id = project_id

        # Default threshold for mastery
        self.DEFAULT_MASTERY_THRESHOLD = 0.8

        # In-memory cache for curriculum graphs, keyed by grade-scoped subject.
        # Entries expire after GRAPH_CACHE_TTL_S so a publish reaches a running
        # backend without a restart (there was no invalidation path at all).
        self._graph_cache: Dict[str, Dict[str, Any]] = {}
        self._graph_cache_at: Dict[str, float] = {}

        logger.info(f"Initialized LearningPathsService (Firestore-native) for {project_id}")

    # ==================== Graph Cache Helper ====================

    async def _get_graph(
        self,
        subject_id: str,
        version_type: str = "published",
        grade: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get one grade's curriculum graph, using in-memory cache.

        ``subject_id`` is scoped ("MATHEMATICS_GK") or bare with ``grade``.
        A bare subject with no grade raises GradeUnresolved (a ValueError):
        every grade holds every subject, so there is nothing to guess.

        Returns:
            {"nodes": [...], "edges": [...], "version_id": ..., ...}
        """
        subject_id = scoped_subject_id(subject_id, grade)
        cache_key = f"{subject_id}:{version_type}"

        loaded_at = self._graph_cache_at.get(cache_key)
        stale = loaded_at is not None and time.monotonic() - loaded_at > GRAPH_CACHE_TTL_S
        if cache_key not in self._graph_cache or stale:
            graph_data = await self.firestore.get_curriculum_graph(
                subject_id=subject_id,
                version_type=version_type
            )
            if graph_data and graph_data.get("graph"):
                self._graph_cache[cache_key] = graph_data
                self._graph_cache_at[cache_key] = time.monotonic()
            else:
                raise ValueError(f"No curriculum graph found for {subject_id} ({version_type})")

        return self._graph_cache[cache_key]

    async def _student_graph(
        self, student_id: int, subject: str, version_type: str = "published"
    ) -> Dict[str, Any]:
        """The graph of `subject` at the grade this student studies it."""
        scoped = await student_scoped_subject(self.firestore, student_id, subject)
        return await self._get_graph(scoped, version_type)

    async def _scope_graphs(
        self,
        *,
        student_id: Optional[int] = None,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """The graphs a request is about: one subject, or every published
        subject at one grade. The grade comes from ``grade``, else the
        student's grade (per-subject override first), else GradeUnresolved."""
        if subject:
            if grade or split_scoped(subject)[1] or student_id is None:
                return [await self._get_graph(subject, grade=grade)]
            return [await self._student_graph(student_id, subject)]
        if not grade and student_id is not None:
            fields = await self.firestore.get_student_planning_fields(student_id)
            grade = fields.get("grade_level")
        g = grade_key(grade)
        if not g:
            raise GradeUnresolved(f"No grade to scope graphs (student {student_id}, grade {grade!r})")
        graphs = []
        for subj in await self._get_available_subjects(grade=g):
            try:
                if student_id is not None:
                    graphs.append(await self._student_graph(student_id, subj))
                else:
                    graphs.append(await self._get_graph(subj, grade=g))
            except ValueError:
                continue
        return graphs

    def _invalidate_graph_cache(self, subject_id: Optional[str] = None):
        """Clear graph cache (call when curriculum is updated)."""
        if subject_id:
            for key in list(self._graph_cache.keys()):
                if key.startswith(f"{subject_id}:"):
                    del self._graph_cache[key]
        else:
            self._graph_cache.clear()

    # ==================== Core Prerequisite Methods ====================

    async def get_entity_proficiency(
        self,
        student_id: int,
        entity_id: str,
        entity_type: str,
        graphs: Optional[List[Dict[str, Any]]] = None,
    ) -> float:
        """
        Get student proficiency for a skill or subskill from Firestore competencies.

        Args:
            student_id: Student ID
            entity_id: Skill or subskill ID
            entity_type: "skill" or "subskill"

        Returns:
            Proficiency score (0.0 to 1.0)
        """
        try:
            if entity_type == "subskill":
                # Direct lookup from competencies subcollection
                prof_map = await self.firestore.get_student_proficiency_map(student_id)
                prof_data = prof_map.get(entity_id, {})
                return prof_data.get("proficiency", 0.0)

            elif entity_type == "skill":
                # Average proficiency across all subskills in this skill
                prof_map = await self.firestore.get_student_proficiency_map(student_id)

                if graphs is None:
                    graphs = await self._scope_graphs(student_id=student_id)
                skill_subskills = self._get_subskills_for_skill(entity_id, graphs)

                if not skill_subskills:
                    return 0.0

                total = sum(
                    prof_map.get(sub_id, {}).get("proficiency", 0.0)
                    for sub_id in skill_subskills
                )
                return total / len(skill_subskills)

            else:
                raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'skill' or 'subskill'")

        except Exception as e:
            logger.error(f"Error getting proficiency for {entity_type} {entity_id}: {e}")
            return 0.0

    def _get_subskills_for_skill(self, skill_id: str, graphs: List[Dict[str, Any]]) -> List[str]:
        """Subskill IDs belonging to a skill, from the given graphs (skill IDs
        repeat across grades, so the caller scopes the graphs)."""
        for graph_data in graphs:
            nodes = graph_data.get("graph", {}).get("nodes", [])
            subskills = []
            for node in nodes:
                # Check if node is a subskill that belongs to this skill
                node_id = node.get("id", "")
                node_type = node.get("type", node.get("entity_type", ""))
                parent_skill = node.get("skill_id", "")

                if parent_skill == skill_id:
                    subskills.append(node_id)
                elif node_type == "subskill" and node_id.startswith(skill_id):
                    subskills.append(node_id)

            if subskills:
                return subskills

        # Fallback: ID prefix matching (SKILL-01 → SKILL-01-A, SKILL-01-B)
        return []

    async def check_prerequisites_met(
        self,
        student_id: int,
        target_entity_id: str,
        target_entity_type: str
    ) -> Dict[str, Any]:
        """
        Check if ALL prerequisites are met for a target entity.

        Reads prerequisite edges from Firestore curriculum graph and
        student proficiency from Firestore competencies.

        Args:
            student_id: Student ID
            target_entity_id: Target skill or subskill ID
            target_entity_type: "skill" or "subskill"

        Returns:
            {
                "unlocked": bool,
                "prerequisites": [
                    {
                        "prerequisite_id": str,
                        "prerequisite_type": str,
                        "required_threshold": float,
                        "current_proficiency": float,
                        "met": bool
                    }
                ]
            }
        """
        try:
            graphs = await self._scope_graphs(student_id=student_id)
            prerequisite_edges = self._get_prerequisite_edges_for(target_entity_id, graphs)

            # If no prerequisites, entity is unlocked by default
            if not prerequisite_edges:
                return {
                    "unlocked": True,
                    "prerequisites": []
                }

            # Get student proficiency map
            prof_map = await self.firestore.get_student_proficiency_map(student_id)

            # Check each prerequisite
            prerequisite_checks = []
            all_met = True

            for source_id, threshold in prerequisite_edges:
                # Get proficiency - try direct lookup first, then check as skill
                current_proficiency = prof_map.get(source_id, {}).get("proficiency", 0.0)

                # If not found as subskill, try computing as skill average
                if current_proficiency == 0.0 and self._detect_entity_type(source_id) == "skill":
                    current_proficiency = await self.get_entity_proficiency(
                        student_id, source_id, "skill", graphs
                    )

                met = current_proficiency >= threshold
                if not met:
                    all_met = False

                prerequisite_checks.append({
                    "prerequisite_id": source_id,
                    "prerequisite_type": self._detect_entity_type(source_id),
                    "required_threshold": threshold,
                    "current_proficiency": current_proficiency,
                    "met": met
                })

            return {
                "unlocked": all_met,
                "prerequisites": prerequisite_checks
            }

        except Exception as e:
            logger.error(f"Error checking prerequisites for {target_entity_type} {target_entity_id}: {e}")
            raise

    def _get_prerequisite_edges_for(
        self,
        target_entity_id: str,
        graphs: List[Dict[str, Any]],
    ) -> List[Tuple[str, float]]:
        """
        Get all prerequisite edges pointing to a target entity.

        Only considers edges where ``is_prerequisite`` is true (or absent,
        for backward compatibility with caches written before the knowledge-
        graph migration).

        Returns:
            [(source_id, threshold), ...]
        """
        edges = []
        for graph_data in graphs:
            for edge in graph_data.get("graph", {}).get("edges", []):
                if edge["target"] == target_entity_id and edge.get("is_prerequisite", True):
                    edges.append((
                        edge["source"],
                        edge.get("threshold") or self.DEFAULT_MASTERY_THRESHOLD,
                    ))
        return edges

    async def get_related_entities(
        self,
        entity_id: str,
        subject: str,
        grade: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all entities connected to ``entity_id`` via any edge type.

        Returns edge metadata (relationship, strength, is_prerequisite) for
        each connection — used by Pulse for discovery and by frontend for
        "related skills" display.
        """
        graph = await self._get_graph(subject, grade=grade)
        graph_edges = graph.get("graph", {}).get("edges", [])
        related = []
        for edge in graph_edges:
            if edge["source"] == entity_id:
                related.append({
                    "entity_id": edge["target"],
                    "direction": "outgoing",
                    "relationship": edge.get("relationship", "prerequisite"),
                    "strength": edge.get("strength", 1.0),
                    "is_prerequisite": edge.get("is_prerequisite", True),
                })
            elif edge["target"] == entity_id:
                related.append({
                    "entity_id": edge["source"],
                    "direction": "incoming",
                    "relationship": edge.get("relationship", "prerequisite"),
                    "strength": edge.get("strength", 1.0),
                    "is_prerequisite": edge.get("is_prerequisite", True),
                })
        return related

    async def get_unlocked_entities(
        self,
        student_id: int,
        entity_type: Optional[str] = None,
        subject: Optional[str] = None
    ) -> Set[str]:
        """
        Get all entities (skills/subskills) currently unlocked for student.

        Reads from Firestore curriculum graph + competencies in real-time.

        This handles:
        - Entities with no prerequisites (always unlocked)
        - Entities where ALL prerequisites meet thresholds

        Args:
            student_id: Student ID
            entity_type: Filter by "skill" or "subskill" (None = both)
            subject: Filter by subject

        Returns:
            Set of unlocked entity IDs
        """
        try:
            graphs = await self._scope_graphs(student_id=student_id, subject=subject)

            # Get student proficiency map (all subjects)
            prof_map = await self.firestore.get_student_proficiency_map(student_id)

            unlocked = set()

            for graph_data in graphs:
                graph = graph_data["graph"]
                nodes = graph["nodes"]
                edges = graph["edges"]

                # Build prerequisites map and determine unlocked nodes
                prereqs_map = self._build_prerequisites_map(edges)
                unlocked_ids = self._determine_unlocked_nodes(
                    nodes=nodes,
                    edges=edges,
                    prereqs_map=prereqs_map,
                    student_prof_map=prof_map
                )

                # Filter by entity_type if specified
                if entity_type:
                    node_types = {
                        n["id"]: n.get("type", n.get("entity_type", self._detect_entity_type(n["id"])))
                        for n in nodes
                    }
                    unlocked_ids = {
                        nid for nid in unlocked_ids
                        if node_types.get(nid, self._detect_entity_type(nid)) == entity_type
                    }

                unlocked.update(unlocked_ids)

            logger.info(
                f"Student {student_id} has {len(unlocked)} unlocked entities "
                f"(type={entity_type}, subject={subject})"
            )
            return unlocked

        except Exception as e:
            logger.error(f"Error getting unlocked entities for student {student_id}: {e}")
            raise

    async def _get_available_subjects(
        self, grade: Optional[str] = None,
    ) -> List[str]:
        """Get list of subjects with published curriculum, optionally scoped by grade."""
        try:
            subjects_data = await self.firestore.get_all_published_subjects(
                grade=grade,
            )
            return list({s["subject_id"] for s in subjects_data})
        except Exception:
            # Fallback to common subjects
            return ["MATHEMATICS"]

    # ==================== Graph Structure Methods ====================

    async def get_learning_graph(
        self,
        subject: Optional[str] = None,
        entity_type: Optional[str] = None,
        include_metadata: bool = True,
        grade: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get complete learning prerequisite graph from Firestore.

        Args:
            subject: Filter by subject
            entity_type: Filter by "skill" or "subskill"
            include_metadata: Include metadata about graph structure

        Returns:
            {
                "graph": {
                    "nodes": [{entity_id, entity_type, subject, description}],
                    "edges": [{from_id, from_type, to_id, to_type, threshold}]
                },
                "metadata": {total_nodes, total_edges, subjects}
            }
        """
        try:
            graphs = await self._scope_graphs(subject=subject, grade=grade)

            all_nodes = {}
            all_edges = []
            all_subjects = set()

            for graph_data in graphs:
                graph = graph_data["graph"]
                subj = graph_data.get("base_subject_id") or graph_data.get("subject_id")

                for node in graph["nodes"]:
                    node_id = node["id"]
                    node_type = node.get("type", node.get("entity_type", self._detect_entity_type(node_id)))

                    # Apply entity_type filter
                    if entity_type and node_type != entity_type:
                        continue

                    if node_id not in all_nodes:
                        all_nodes[node_id] = {
                            "entity_id": node_id,
                            "entity_type": node_type,
                            "subject": node.get("subject", subj),
                            "description": node.get("description", node.get("label", ""))
                        }
                        if node.get("subject", subj):
                            all_subjects.add(node.get("subject", subj))

                for edge in graph["edges"]:
                    # Apply entity_type filter to edges
                    if entity_type:
                        target_type = self._detect_entity_type(edge["target"])
                        if target_type != entity_type:
                            continue

                    all_edges.append({
                        "from_id": edge["source"],
                        "from_type": self._detect_entity_type(edge["source"]),
                        "to_id": edge["target"],
                        "to_type": self._detect_entity_type(edge["target"]),
                        "threshold": edge.get("threshold") or self.DEFAULT_MASTERY_THRESHOLD
                    })

            response = {
                "graph": {
                    "nodes": list(all_nodes.values()),
                    "edges": all_edges
                }
            }

            if include_metadata:
                response["metadata"] = {
                    "total_nodes": len(all_nodes),
                    "total_edges": len(all_edges),
                    "subjects": sorted(list(all_subjects))
                }

            return response

        except Exception as e:
            logger.error(f"Error getting learning graph: {e}")
            raise

    async def get_entity_prerequisites(
        self,
        entity_id: str,
        entity_type: Optional[str] = None,
        graphs: Optional[List[Dict[str, Any]]] = None,
        *,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get prerequisites for a specific entity from Firestore graph edges.

        Args:
            entity_id: Entity ID
            entity_type: "skill" or "subskill" (auto-detect if None)

        Returns:
            List of prerequisite dictionaries
        """
        try:
            if entity_type is None:
                entity_type = self._detect_entity_type(entity_id)

            if graphs is None:
                graphs = await self._scope_graphs(subject=subject, grade=grade)
            prerequisite_edges = self._get_prerequisite_edges_for(entity_id, graphs)

            results = []
            for source_id, threshold in prerequisite_edges:
                node_info = self._get_node_info(source_id, graphs)

                results.append({
                    "prerequisite_id": source_id,
                    "prerequisite_type": self._detect_entity_type(source_id),
                    "min_proficiency_threshold": threshold,
                    "subject": node_info.get("subject"),
                    "description": node_info.get("description")
                })

            return results

        except Exception as e:
            logger.error(f"Error getting prerequisites for {entity_id}: {e}")
            raise

    async def get_entity_unlocks(
        self,
        entity_id: str,
        entity_type: Optional[str] = None,
        graphs: Optional[List[Dict[str, Any]]] = None,
        *,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get what entities this entity unlocks (reverse direction).

        Args:
            entity_id: Entity ID
            entity_type: "skill" or "subskill" (auto-detect if None)

        Returns:
            List of unlocked entity dictionaries
        """
        try:
            if entity_type is None:
                entity_type = self._detect_entity_type(entity_id)

            if graphs is None:
                graphs = await self._scope_graphs(subject=subject, grade=grade)
            results = []

            for graph_data in graphs:
                graph_edges = graph_data.get("graph", {}).get("edges", [])
                for edge in graph_edges:
                    if edge["source"] == entity_id:
                        target_id = edge["target"]
                        node_info = self._get_node_info(target_id, graphs)

                        results.append({
                            "unlocks_id": target_id,
                            "unlocks_type": self._detect_entity_type(target_id),
                            "threshold": edge.get("threshold") or self.DEFAULT_MASTERY_THRESHOLD,
                            "subject": node_info.get("subject"),
                            "description": node_info.get("description")
                        })

            return results

        except Exception as e:
            logger.error(f"Error getting unlocks for {entity_id}: {e}")
            raise

    def _get_node_info(self, node_id: str, graphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Look up node info (subject, description) in the given graphs."""
        for graph_data in graphs:
            for node in graph_data.get("graph", {}).get("nodes", []):
                if node["id"] == node_id:
                    return {
                        "subject": node.get("subject"),
                        "description": node.get("description", node.get("label", ""))
                    }
        return {}

    # ==================== Skill/Subskill Details ====================

    async def get_skill_with_subskills(
        self,
        skill_id: str,
        student_id: Optional[int] = None,
        grade: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get detailed view of a specific skill with subskills and sequencing.
        Skill IDs repeat across grades: the grade is ``grade``, else the student's.

        Reads from curriculum_published for hierarchy data, and Firestore
        competencies for student progress.

        Args:
            skill_id: Skill ID
            student_id: Optional student ID for progress data

        Returns:
            {
                "skill_id": str,
                "skill_description": str,
                "subject": str,
                "subskills": [{subskill_id, description, sequence, prerequisites, student_data}],
                "prerequisites": [...],
                "unlocks": [...]
            }
        """
        try:
            if not grade and student_id is not None:
                grade = (await self.firestore.get_student_planning_fields(student_id)).get("grade_level")
            g = grade_key(grade)
            if not g:
                raise GradeUnresolved(f"Skill {skill_id}: no grade (skill IDs repeat across grades)")
            skill_data = await self._find_skill_in_published(skill_id, g)

            if not skill_data:
                raise ValueError(f"Skill {skill_id} not found in grade {g}")
            graphs = await self._scope_graphs(subject=skill_data["subject"], grade=g)

            result = {
                "skill_id": skill_id,
                "skill_description": skill_data["skill_description"],
                "subject": skill_data["subject"],
                "subskills": []
            }

            # Get student data if needed
            prof_map = {}
            unlocked_set = set()
            if student_id:
                prof_map = await self.firestore.get_student_proficiency_map(student_id)
                unlocked_set = await self.get_unlocked_entities(
                    student_id, entity_type="subskill",
                    subject=skill_data["subject"]
                )

            # Build subskill entries
            for idx, subskill in enumerate(skill_data.get("subskills", [])):
                subskill_id = subskill["subskill_id"]

                # Get prerequisites for this subskill
                subskill_prerequisites = await self.get_entity_prerequisites(
                    subskill_id, "subskill", graphs
                )

                subskill_entry = {
                    "subskill_id": subskill_id,
                    "description": subskill.get("subskill_description", ""),
                    "sequence_order": idx + 1,
                    "difficulty_start": subskill.get("difficulty_start"),
                    "difficulty_end": subskill.get("difficulty_end"),
                    "prerequisites": subskill_prerequisites
                }

                if student_id:
                    proficiency = prof_map.get(subskill_id, {}).get("proficiency", 0.0)
                    subskill_entry["student_data"] = {
                        "unlocked": subskill_id in unlocked_set,
                        "proficiency": proficiency,
                        "attempts": prof_map.get(subskill_id, {}).get("attempt_count", 0)
                    }

                result["subskills"].append(subskill_entry)

            # Get prerequisites and unlocks for the skill itself
            result["prerequisites"] = await self.get_entity_prerequisites(skill_id, "skill", graphs)
            result["unlocks"] = await self.get_entity_unlocks(skill_id, "skill", graphs)

            return result

        except Exception as e:
            logger.error(f"Error getting skill details for {skill_id}: {e}")
            raise

    async def _find_skill_in_published(self, skill_id: str, grade: str) -> Optional[Dict[str, Any]]:
        """
        Find a skill in one grade of curriculum_published.

        Returns skill data with its subskills, or None if not found.
        """
        try:
            subjects = await self.firestore.get_all_published_subjects(grade=grade)

            for subj_info in subjects:
                curriculum = await self.firestore.get_published_curriculum(
                    subject_id=subj_info["subject_id"],
                    grade=subj_info["grade_doc"]
                )
                if not curriculum:
                    continue

                # Search through hierarchy
                for unit in curriculum.get("curriculum", []):
                    for skill in unit.get("skills", []):
                        if skill.get("skill_id") == skill_id:
                            return {
                                "skill_id": skill_id,
                                "skill_description": skill.get("skill_description", ""),
                                "subject": subj_info["subject_id"],
                                "unit_id": unit.get("unit_id"),
                                "unit_title": unit.get("unit_title"),
                                "subskills": skill.get("subskills", [])
                            }

                # Also check subskill_index for quick lookup
                subskill_index = curriculum.get("subskill_index", {})
                for sub_id, sub_data in subskill_index.items():
                    if sub_data.get("skill_id") == skill_id:
                        # Found via index, but need to get full skill data
                        # Re-walk the hierarchy for complete subskills list
                        for unit in curriculum.get("curriculum", []):
                            for skill in unit.get("skills", []):
                                if skill.get("skill_id") == skill_id:
                                    return {
                                        "skill_id": skill_id,
                                        "skill_description": skill.get("skill_description", ""),
                                        "subject": subj_info["subject_id"],
                                        "unit_id": unit.get("unit_id"),
                                        "unit_title": unit.get("unit_title"),
                                        "subskills": skill.get("subskills", [])
                                    }

            return None

        except Exception as e:
            logger.error(f"Error finding skill {skill_id} in published curriculum: {e}")
            return None

    # ==================== Student-Specific Queries ====================

    async def get_recommendations(
        self,
        student_id: int,
        subject: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations based on prerequisites.

        Logic:
        1. Get all unlocked subskills
        2. Filter out mastered ones (proficiency >= 0.8)
        3. Prioritize:
           - Ready but not started (coverage gap) - priority 1
           - Ready but low proficiency (performance gap) - priority 2
           - Newly unlocked - priority 3

        Args:
            student_id: Student ID
            subject: Filter by subject
            limit: Number of recommendations

        Returns:
            List of recommendation dictionaries
        """
        try:
            # Get student proficiency and unlock data in parallel
            prof_map = await self.firestore.get_student_proficiency_map(student_id)
            unlocked = await self.get_unlocked_entities(
                student_id, entity_type="subskill", subject=subject
            )

            if not unlocked:
                logger.info(f"No unlocked subskills for student {student_id}")
                return []

            graphs = await self._scope_graphs(student_id=student_id, subject=subject)
            student_grade = (await self.firestore.get_student_planning_fields(student_id)).get("grade_level")
            curriculum_index = await self._build_subskill_index(
                subject_key(subject) if subject else None, grade_key(student_grade)
            )

            recommendations = []

            for entity_id in unlocked:
                proficiency = prof_map.get(entity_id, {}).get("proficiency", 0.0)

                # Skip already mastered
                if proficiency >= self.DEFAULT_MASTERY_THRESHOLD:
                    continue

                # Determine priority and reason
                if proficiency == 0.0:
                    priority = 1
                    priority_label = "high"
                    reason = "coverage_gap"
                    message = "Ready to start"
                elif proficiency < 0.6:
                    priority = 2
                    priority_label = "high"
                    reason = "performance_gap"
                    message = f"Continue practicing (current: {proficiency:.0%})"
                else:
                    priority = 3
                    priority_label = "medium"
                    reason = "nearly_mastered"
                    message = f"Almost there! (current: {proficiency:.0%})"

                # Get metadata from curriculum index
                meta = curriculum_index.get(entity_id, {})

                # Get prerequisite info
                prereq_edges = self._get_prerequisite_edges_for(entity_id, graphs)
                prerequisites_met = []
                for source_id, threshold in prereq_edges:
                    current = prof_map.get(source_id, {}).get("proficiency", 0.0)
                    prerequisites_met.append({
                        "prerequisite_id": source_id,
                        "prerequisite_type": self._detect_entity_type(source_id),
                        "required_threshold": threshold,
                        "current_proficiency": current,
                        "met": current >= threshold
                    })

                recommendations.append({
                    "entity_id": entity_id,
                    "entity_type": "subskill",
                    "description": meta.get("subskill_description", ""),
                    "subject": meta.get("subject", subject or ""),
                    "skill_id": meta.get("skill_id", ""),
                    "skill_description": meta.get("skill_description", ""),
                    "priority": priority_label,
                    "priority_order": priority,
                    "reason": reason,
                    "message": message,
                    "current_proficiency": proficiency,
                    "unlocked": True,
                    "prerequisites_met": prerequisites_met
                })

            # Sort by priority, then by proficiency (lowest first for coverage gaps)
            recommendations.sort(key=lambda r: (r["priority_order"], r["current_proficiency"]))

            logger.info(f"Found {len(recommendations)} recommendations for student {student_id}")
            return recommendations[:limit]

        except Exception as e:
            logger.error(f"Error getting recommendations for student {student_id}: {e}")
            raise

    async def _build_subskill_index(
        self, subject: Optional[str], grade: Optional[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Build a flat lookup index of subskill metadata for ONE grade of
        curriculum_published (subskill IDs repeat across grades).

        Returns: {subskill_id: {subject, skill_id, skill_description, subskill_description, ...}}
        """
        index = {}
        if not grade:
            logger.error(f"_build_subskill_index({subject!r}): no grade; returning empty index")
            return index
        try:
            subjects = await self.firestore.get_all_published_subjects(grade=grade)

            for subj_info in subjects:
                if subject and subj_info["subject_id"] != subject:
                    continue

                curriculum = await self.firestore.get_published_curriculum(
                    subject_id=subj_info["subject_id"],
                    grade=subj_info["grade_doc"]
                )
                if not curriculum:
                    continue

                # Use the built-in subskill_index if available
                subskill_idx = curriculum.get("subskill_index", {})
                if subskill_idx:
                    index.update(subskill_idx)
                else:
                    # Build from hierarchy
                    for unit in curriculum.get("curriculum", []):
                        for skill in unit.get("skills", []):
                            for subskill in skill.get("subskills", []):
                                index[subskill["subskill_id"]] = {
                                    "subject": subj_info["subject_id"],
                                    "unit_id": unit.get("unit_id"),
                                    "unit_title": unit.get("unit_title"),
                                    "skill_id": skill.get("skill_id"),
                                    "skill_description": skill.get("skill_description", ""),
                                    "subskill_id": subskill["subskill_id"],
                                    "subskill_description": subskill.get("subskill_description", ""),
                                    "difficulty_start": subskill.get("difficulty_start"),
                                    "difficulty_end": subskill.get("difficulty_end"),
                                }

        except Exception as e:
            logger.error(f"Error building subskill index: {e}")

        return index

    # ==================== Visualization ====================

    async def get_graph_for_visualization(
        self,
        subject: Optional[str] = None,
        student_id: Optional[int] = None,
        grade: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get graph structure optimized for frontend visualization, for ONE
        grade: ``grade``, else the student's grade of record.

        Returns units with nested skills and subskills, prerequisites, unlocks, and
        optional student progress data.

        Args:
            subject: Filter by subject
            student_id: Optional student ID for progress data

        Returns:
            {"units": [{unit_id, unit_title, subject, skills: [{...}]}]}
        """
        try:
            if not grade and student_id is not None:
                grade = (await self.firestore.get_student_planning_fields(student_id)).get("grade_level")
            g = grade_key(grade)
            if not g:
                raise GradeUnresolved("Graph visualization needs a grade or a student with grade_level")
            subjects = await self.firestore.get_all_published_subjects(grade=g)
            if subject:
                subjects = [s for s in subjects if s["subject_id"] == subject_key(subject)]

            # Get student data if needed
            prof_map = {}
            unlocked_set = set()
            if student_id:
                prof_map = await self.firestore.get_student_proficiency_map(student_id)
                unlocked_set = await self.get_unlocked_entities(
                    student_id, subject=subject
                )

            units_dict = {}

            for subj_info in subjects:
                curriculum = await self.firestore.get_published_curriculum(
                    subject_id=subj_info["subject_id"],
                    grade=subj_info["grade_doc"]
                )
                if not curriculum:
                    continue

                try:
                    graphs = [await self._get_graph(subj_info["subject_id"], grade=g)]
                except ValueError:
                    graphs = []

                for unit in curriculum.get("curriculum", []):
                    unit_id = unit.get("unit_id")
                    if unit_id not in units_dict:
                        units_dict[unit_id] = {
                            "unit_id": unit_id,
                            "unit_title": unit.get("unit_title", ""),
                            "subject": subj_info["subject_id"],
                            "skills": {}
                        }

                    for skill in unit.get("skills", []):
                        skill_id = skill.get("skill_id")
                        if skill_id not in units_dict[unit_id]["skills"]:
                            # Get skill-level prerequisites and unlocks
                            skill_prereqs = await self.get_entity_prerequisites(skill_id, "skill", graphs)
                            skill_unlocks = await self.get_entity_unlocks(skill_id, "skill", graphs)

                            units_dict[unit_id]["skills"][skill_id] = {
                                "skill_id": skill_id,
                                "skill_description": skill.get("skill_description", ""),
                                "subject": subj_info["subject_id"],
                                "subskills": [],
                                "prerequisites": skill_prereqs,
                                "unlocks": skill_unlocks
                            }

                        for idx, subskill in enumerate(skill.get("subskills", [])):
                            subskill_id = subskill.get("subskill_id")

                            # Get subskill prerequisites
                            sub_prereqs = await self.get_entity_prerequisites(subskill_id, "subskill", graphs)

                            subskill_data = {
                                "subskill_id": subskill_id,
                                "description": subskill.get("subskill_description", ""),
                                "sequence_order": idx + 1,
                                "difficulty_start": subskill.get("difficulty_start"),
                                "difficulty_end": subskill.get("difficulty_end"),
                                "prerequisites": sub_prereqs
                            }

                            if student_id:
                                proficiency = prof_map.get(subskill_id, {}).get("proficiency", 0.0)
                                attempts = prof_map.get(subskill_id, {}).get("attempt_count", 0)
                                subskill_data["student_data"] = {
                                    "unlocked": subskill_id in unlocked_set,
                                    "proficiency": proficiency,
                                    "attempts": attempts
                                }

                            units_dict[unit_id]["skills"][skill_id]["subskills"].append(subskill_data)

            # Convert nested dict to list format
            units_list = []
            for unit in units_dict.values():
                unit["skills"] = list(unit["skills"].values())
                units_list.append(unit)

            return {"units": units_list}

        except Exception as e:
            logger.error(f"Error getting graph for visualization: {e}")
            raise

    # ==================== Student State Engine ====================

    async def get_student_graph(
        self,
        student_id: int,
        subject_id: str,
        include_drafts: bool = False,
        grade: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get curriculum graph decorated with student progress data.

        This is the "Student State Engine" that merges:
        - Static curriculum structure (from Firestore curriculum_graphs)
        - Dynamic student progress (from Firestore competencies)

        Returns graph where each node includes:
        - student_proficiency: float (0.0-1.0)
        - status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "MASTERED"
        - last_attempt_at: datetime (optional)
        - attempt_count: int (optional)

        Args:
            student_id: Student ID
            subject_id: Subject identifier (e.g., "MATHEMATICS")
            include_drafts: Include draft curriculum (default: False)
            grade: Student grade_level (e.g., "K", "1st"). When provided, scopes
                the curriculum-graph lookup to that grade so grade resolution
                never falls into first-doc-wins scanning (a Kindergarten student
                must not be handed a Grade 1 graph).

        Returns:
            {
                "nodes": [...],  # Decorated with student data
                "edges": [...],  # Original edges
                "student_id": int,
                "subject_id": str,
                "version_id": str,
                "generated_at": str
            }
        """
        try:
            logger.info(f"Building student graph for student {student_id}, subject {subject_id}")

            # Step 1: Fetch graph and proficiency from Firestore in parallel
            version_type = "draft" if include_drafts else "published"

            # Proficiency stays keyed on the bare display subject; the graph
            # is the explicit grade, else the grade the student studies it at.
            graph_coro = (
                self._get_graph(subject_id, version_type, grade=grade) if grade
                else self._student_graph(student_id, subject_id, version_type)
            )
            graph_data, student_prof_map = await asyncio.gather(
                graph_coro,
                self.firestore.get_student_proficiency_map(student_id, subject=subject_id)
            )

            graph = graph_data["graph"]
            nodes = graph["nodes"]
            edges = graph["edges"]

            logger.info(f"Retrieved graph with {len(nodes)} nodes, {len(edges)} edges")
            logger.info(f"Student has proficiency data for {len(student_prof_map)} entities")

            # Step 2: Initialize node states (all LOCKED by default)
            student_node_states = {}

            for node in nodes:
                student_node_states[node["id"]] = {
                    **node,
                    "student_proficiency": 0.0,
                    "status": "LOCKED",
                    "attempt_count": 0,
                    "last_attempt_at": None
                }

            # Step 3: Determine UNLOCKED status
            prereqs_map = self._build_prerequisites_map(edges)
            unlocked_node_ids = self._determine_unlocked_nodes(
                nodes=nodes,
                edges=edges,
                prereqs_map=prereqs_map,
                student_prof_map=student_prof_map
            )

            for node_id in unlocked_node_ids:
                student_node_states[node_id]["status"] = "UNLOCKED"

            logger.info(f"Determined {len(unlocked_node_ids)} unlocked nodes")

            # Step 4: Overlay student proficiency and determine final status
            mastered_count = 0
            in_progress_count = 0

            for node_id, prof_data in student_prof_map.items():
                if node_id in student_node_states:
                    node = student_node_states[node_id]
                    proficiency = prof_data["proficiency"]

                    node["student_proficiency"] = proficiency
                    node["attempt_count"] = prof_data.get("attempt_count", 0)
                    node["last_attempt_at"] = prof_data.get("last_updated")

                    if proficiency >= self.DEFAULT_MASTERY_THRESHOLD:
                        node["status"] = "MASTERED"
                        mastered_count += 1
                    elif proficiency > 0:
                        node["status"] = "IN_PROGRESS"
                        in_progress_count += 1

            logger.info(
                f"Student state: {mastered_count} mastered, "
                f"{in_progress_count} in progress, "
                f"{len(unlocked_node_ids)} unlocked, "
                f"{len(nodes) - len(unlocked_node_ids)} locked"
            )

            # Step 5: Return decorated graph
            return {
                "nodes": list(student_node_states.values()),
                "edges": edges,
                "student_id": student_id,
                "subject_id": subject_id,
                "version_id": graph_data.get("version_id"),
                "generated_at": graph_data.get("generated_at")
            }

        except ValueError as e:
            logger.error(f"Graph not found: {e}")
            raise
        except Exception as e:
            logger.error(f"Error building student graph: {e}")
            raise

    # ==================== Live Unlock Recalculation ====================

    async def recalculate_unlocks(
        self,
        student_id: int,
        subject_id: str
    ) -> Dict[str, Any]:
        """
        Recalculate and cache unlock state for a student+subject.

        Call this after every competency update for instant unlock propagation.

        Args:
            student_id: Student ID
            subject_id: Subject identifier

        Returns:
            {
                "unlocked_entities": [str],
                "entity_statuses": {entity_id: status},
                "newly_unlocked": [str],  # Entities unlocked since last computation
                "last_computed": str
            }
        """
        try:
            logger.info(f"Recalculating unlocks for student {student_id}, subject {subject_id}")

            # Get previous state + proficiency map in parallel (independent reads)
            graph_data = await self._student_graph(student_id, subject_id)  # cached in-memory
            previous, prof_map = await asyncio.gather(
                self.firestore.get_learning_path(student_id, subject_id),
                self.firestore.get_student_proficiency_map(student_id, subject=subject_id),
            )
            previous_unlocked = set(previous.get("unlocked_entities", [])) if previous else set()

            graph = graph_data["graph"]
            nodes = graph["nodes"]
            edges = graph["edges"]

            # Compute unlocked set
            prereqs_map = self._build_prerequisites_map(edges)
            unlocked_ids = self._determine_unlocked_nodes(
                nodes=nodes,
                edges=edges,
                prereqs_map=prereqs_map,
                student_prof_map=prof_map
            )

            # Compute entity statuses
            entity_statuses = {}
            for node in nodes:
                node_id = node["id"]
                proficiency = prof_map.get(node_id, {}).get("proficiency", 0.0)

                if proficiency >= self.DEFAULT_MASTERY_THRESHOLD:
                    entity_statuses[node_id] = "MASTERED"
                elif proficiency > 0:
                    entity_statuses[node_id] = "IN_PROGRESS"
                elif node_id in unlocked_ids:
                    entity_statuses[node_id] = "UNLOCKED"
                else:
                    entity_statuses[node_id] = "LOCKED"

            # Determine newly unlocked
            newly_unlocked = list(unlocked_ids - previous_unlocked)

            # Save to Firestore
            result = {
                "unlocked_entities": sorted(list(unlocked_ids)),
                "entity_statuses": entity_statuses,
                "version_id": graph_data.get("version_id"),
            }

            await self.firestore.save_learning_path(student_id, subject_id, result)

            result["newly_unlocked"] = newly_unlocked
            result["last_computed"] = datetime.now(timezone.utc).isoformat()

            if newly_unlocked:
                logger.info(
                    f"Student {student_id} newly unlocked {len(newly_unlocked)} entities: "
                    f"{newly_unlocked[:5]}{'...' if len(newly_unlocked) > 5 else ''}"
                )

            return result

        except Exception as e:
            logger.error(f"Error recalculating unlocks for student {student_id}: {e}")
            raise

    # ==================== Graph Helper Methods ====================

    def _build_prerequisites_map(
        self,
        edges: List[Dict[str, Any]]
    ) -> Dict[str, List[Tuple[str, float]]]:
        """
        Build map of node_id -> [(prerequisite_node_id, threshold), ...]

        Only considers edges where ``is_prerequisite`` is true.  Edges without
        the field (pre-migration caches) default to True for backward compat.
        """
        prereqs_map = {}

        for edge in edges:
            # Knowledge-graph filter: only prerequisite edges gate unlock
            if not edge.get("is_prerequisite", True):
                continue

            target_id = edge["target"]
            source_id = edge["source"]
            threshold = edge.get("threshold") or self.DEFAULT_MASTERY_THRESHOLD

            if target_id not in prereqs_map:
                prereqs_map[target_id] = []

            prereqs_map[target_id].append((source_id, threshold))

        return prereqs_map

    def _determine_unlocked_nodes(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        prereqs_map: Dict[str, List[Tuple[str, float]]],
        student_prof_map: Dict[str, Dict[str, Any]]
    ) -> Set[str]:
        """
        Determine which nodes are unlocked for the student.

        A node is unlocked if:
        - It has no prerequisites (entry point), OR
        - ALL prerequisites meet required proficiency thresholds
        """
        unlocked = set()

        for node in nodes:
            node_id = node["id"]
            prerequisites = prereqs_map.get(node_id, [])

            if not prerequisites:
                # No prerequisites = entry point = always unlocked
                unlocked.add(node_id)
                continue

            # Check if ALL prerequisites are met
            all_met = True

            for prereq_id, required_threshold in prerequisites:
                prof_data = student_prof_map.get(prereq_id, {})
                current_proficiency = prof_data.get("proficiency", 0.0)

                if current_proficiency < required_threshold:
                    all_met = False
                    break

            if all_met:
                unlocked.add(node_id)

        return unlocked

    # ==================== Utility Methods ====================

    def _detect_entity_type(self, entity_id: str) -> str:
        """
        Auto-detect entity type from ID pattern.

        Skill IDs typically: COUNT001-01, OPS001-02
        Subskill IDs typically: COUNT001-01-A, OPS001-02-B
        """
        parts = entity_id.split('-')

        if len(parts) >= 3 and len(parts[-1]) == 1 and parts[-1].isalpha():
            return "subskill"
        else:
            return "skill"

    async def health_check(self) -> Dict[str, Any]:
        """Check learning paths service health via Firestore connectivity."""
        try:
            # Test Firestore connectivity by checking curriculum_graphs
            graph_status = await self.firestore.get_graph_status("MATHEMATICS")

            return {
                "status": "healthy",
                "project_id": self.project_id,
                "backend": "firestore",
                "curriculum_graphs": graph_status.get("total_cached", 0),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
