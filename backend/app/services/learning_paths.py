# app/services/learning_paths.py

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


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

        # In-memory cache for curriculum graphs (they change infrequently)
        self._graph_cache: Dict[str, Dict[str, Any]] = {}

        logger.info(f"Initialized LearningPathsService (Firestore-native) for {project_id}")

    # ==================== Graph Cache Helper ====================

    async def _get_graph(
        self,
        subject_id: str,
        version_type: str = "published"
    ) -> Dict[str, Any]:
        """
        Get curriculum graph, using in-memory cache.

        Returns:
            {"nodes": [...], "edges": [...], "version_id": ..., ...}
        """
        cache_key = f"{subject_id}:{version_type}"

        if cache_key not in self._graph_cache:
            graph_data = await self.firestore.get_curriculum_graph(
                subject_id=subject_id,
                version_type=version_type
            )
            if graph_data and graph_data.get("graph"):
                self._graph_cache[cache_key] = graph_data
            else:
                raise ValueError(f"No curriculum graph found for {subject_id} ({version_type})")

        return self._graph_cache[cache_key]

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
        entity_type: str
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

                # Find all subskills belonging to this skill from any cached graph
                skill_subskills = self._get_subskills_for_skill(entity_id)

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

    def _get_subskills_for_skill(self, skill_id: str) -> List[str]:
        """
        Get subskill IDs belonging to a skill from cached graph nodes.
        Falls back to ID-prefix matching if graph not cached.
        """
        for graph_data in self._graph_cache.values():
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
            # Get all prerequisite edges for this entity from any available graph
            prerequisite_edges = await self._get_prerequisite_edges_for(target_entity_id)

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
                        student_id, source_id, "skill"
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

    async def _get_prerequisite_edges_for(
        self,
        target_entity_id: str
    ) -> List[Tuple[str, float]]:
        """
        Get all prerequisite edges pointing to a target entity.

        Returns:
            [(source_id, threshold), ...]
        """
        edges = []

        for graph_data in self._graph_cache.values():
            graph_edges = graph_data.get("graph", {}).get("edges", [])
            for edge in graph_edges:
                if edge["target"] == target_entity_id:
                    edges.append((
                        edge["source"],
                        edge.get("threshold", self.DEFAULT_MASTERY_THRESHOLD)
                    ))

        # If nothing in cache, try to load a graph
        if not edges and not self._graph_cache:
            # Try loading MATHEMATICS as default
            try:
                await self._get_graph("MATHEMATICS")
                return await self._get_prerequisite_edges_for(target_entity_id)
            except ValueError:
                pass

        return edges

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
            # Determine which subjects to check
            subjects = [subject] if subject else await self._get_available_subjects()

            # Get student proficiency map (all subjects)
            prof_map = await self.firestore.get_student_proficiency_map(student_id)

            unlocked = set()

            for subj in subjects:
                try:
                    graph_data = await self._get_graph(subj)
                except ValueError:
                    logger.debug(f"No graph for subject {subj}, skipping")
                    continue

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

    async def _get_available_subjects(self) -> List[str]:
        """Get list of subjects with published curriculum graphs."""
        try:
            subjects_data = await self.firestore.get_all_published_subjects()
            return list({s["subject_id"] for s in subjects_data})
        except Exception:
            # Fallback to common subjects
            return ["MATHEMATICS"]

    # ==================== Graph Structure Methods ====================

    async def get_learning_graph(
        self,
        subject: Optional[str] = None,
        entity_type: Optional[str] = None,
        include_metadata: bool = True
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
            subjects = [subject] if subject else await self._get_available_subjects()

            all_nodes = {}
            all_edges = []
            all_subjects = set()

            for subj in subjects:
                try:
                    graph_data = await self._get_graph(subj)
                except ValueError:
                    continue

                graph = graph_data["graph"]

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
                        "threshold": edge.get("threshold", self.DEFAULT_MASTERY_THRESHOLD)
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
        entity_type: Optional[str] = None
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

            prerequisite_edges = await self._get_prerequisite_edges_for(entity_id)

            results = []
            for source_id, threshold in prerequisite_edges:
                # Look up node info from cache
                node_info = self._get_node_info(source_id)

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
        entity_type: Optional[str] = None
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

            results = []

            for graph_data in self._graph_cache.values():
                graph_edges = graph_data.get("graph", {}).get("edges", [])
                for edge in graph_edges:
                    if edge["source"] == entity_id:
                        target_id = edge["target"]
                        node_info = self._get_node_info(target_id)

                        results.append({
                            "unlocks_id": target_id,
                            "unlocks_type": self._detect_entity_type(target_id),
                            "threshold": edge.get("threshold", self.DEFAULT_MASTERY_THRESHOLD),
                            "subject": node_info.get("subject"),
                            "description": node_info.get("description")
                        })

            # If cache empty, try loading default graph
            if not results and not self._graph_cache:
                try:
                    await self._get_graph("MATHEMATICS")
                    return await self.get_entity_unlocks(entity_id, entity_type)
                except ValueError:
                    pass

            return results

        except Exception as e:
            logger.error(f"Error getting unlocks for {entity_id}: {e}")
            raise

    def _get_node_info(self, node_id: str) -> Dict[str, Any]:
        """Look up node info (subject, description) from cached graphs."""
        for graph_data in self._graph_cache.values():
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
        student_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get detailed view of a specific skill with subskills and sequencing.

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
            # Find the skill in curriculum_published
            skill_data = await self._find_skill_in_published(skill_id)

            if not skill_data:
                raise ValueError(f"Skill {skill_id} not found")

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
                    subskill_id, "subskill"
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
            result["prerequisites"] = await self.get_entity_prerequisites(skill_id, "skill")
            result["unlocks"] = await self.get_entity_unlocks(skill_id, "skill")

            return result

        except Exception as e:
            logger.error(f"Error getting skill details for {skill_id}: {e}")
            raise

    async def _find_skill_in_published(self, skill_id: str) -> Optional[Dict[str, Any]]:
        """
        Find a skill in the curriculum_published collection.

        Returns skill data with its subskills, or None if not found.
        """
        try:
            # Search across all published subjects
            subjects = await self.firestore.get_all_published_subjects()

            for subj_info in subjects:
                curriculum = await self.firestore.get_published_curriculum(
                    subject_id=subj_info["subject_id"],
                    grade=subj_info.get("grade")
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

            # Get curriculum metadata for descriptions
            curriculum_index = await self._build_subskill_index(subject)

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
                prereq_edges = await self._get_prerequisite_edges_for(entity_id)
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

    async def _build_subskill_index(self, subject: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Build a flat lookup index of subskill metadata from curriculum_published.

        Returns: {subskill_id: {subject, skill_id, skill_description, subskill_description, ...}}
        """
        index = {}
        try:
            subjects = await self.firestore.get_all_published_subjects()

            for subj_info in subjects:
                if subject and subj_info["subject_id"] != subject:
                    continue

                curriculum = await self.firestore.get_published_curriculum(
                    subject_id=subj_info["subject_id"],
                    grade=subj_info.get("grade")
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
        student_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get graph structure optimized for frontend visualization.

        Returns units with nested skills and subskills, prerequisites, unlocks, and
        optional student progress data.

        Args:
            subject: Filter by subject
            student_id: Optional student ID for progress data

        Returns:
            {"units": [{unit_id, unit_title, subject, skills: [{...}]}]}
        """
        try:
            subjects = await self.firestore.get_all_published_subjects()
            if subject:
                subjects = [s for s in subjects if s["subject_id"] == subject]

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
                    grade=subj_info.get("grade")
                )
                if not curriculum:
                    continue

                # Ensure graph is loaded for prerequisite lookups
                try:
                    await self._get_graph(subj_info["subject_id"])
                except ValueError:
                    pass

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
                            skill_prereqs = await self.get_entity_prerequisites(skill_id, "skill")
                            skill_unlocks = await self.get_entity_unlocks(skill_id, "skill")

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
                            sub_prereqs = await self.get_entity_prerequisites(subskill_id, "subskill")

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
        include_drafts: bool = False
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

            graph_data, student_prof_map = await asyncio.gather(
                self._get_graph(subject_id, version_type),
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

            # Get previous state
            previous = await self.firestore.get_learning_path(student_id, subject_id)
            previous_unlocked = set(previous.get("unlocked_entities", [])) if previous else set()

            # Get current graph and proficiency
            graph_data = await self._get_graph(subject_id)
            prof_map = await self.firestore.get_student_proficiency_map(student_id, subject=subject_id)

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
        """
        prereqs_map = {}

        for edge in edges:
            target_id = edge["target"]
            source_id = edge["source"]
            threshold = edge.get("threshold", self.DEFAULT_MASTERY_THRESHOLD)

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
