"""
In-Memory FirestoreService
==========================

Drop-in replacement for FirestoreService that stores everything in Python dicts.
Zero network calls — a 15-item Pulse session completes in <100ms instead of 10-30s.

Usage:
    from tests.pulse_agent.in_memory_firestore import InMemoryFirestoreService

    fs = InMemoryFirestoreService()
    # Pre-load curriculum graphs (one per subject, required for Pulse):
    fs.load_curriculum_graph("MATHEMATICS", math_graph)
    fs.load_curriculum_graph("SCIENCE", science_graph)
    # Then wire into PulseEngine via build_engine_in_memory()

All methods are async to match FirestoreService's interface, but execute
synchronously in-memory. This means PulseEngine, CalibrationEngine,
MasteryLifecycleEngine, and LearningPathsService work unmodified.
"""

from __future__ import annotations

import copy
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class InMemoryFirestoreService:
    """
    In-memory implementation of the FirestoreService interface used by Pulse.

    Data model mirrors Firestore's document/subcollection structure:
      students/{student_id}/mastery_lifecycle/{subskill_id}
      students/{student_id}/ability/{skill_id}
      students/{student_id}/competencies/{doc_id}
      students/{student_id}/pulse_state/primitive_history
      students/{student_id}  (top-level student doc with global_practice_* fields)
      pulse_sessions/{session_id}
      item_calibration/{item_key}
      curriculum_graphs  (keyed by subject_id:version_type)
      curriculum_published/{grade}/subjects/{subject_id}
    """

    def __init__(self):
        # students/{student_id} → top-level doc fields
        self._students: Dict[int, Dict[str, Any]] = {}

        # students/{student_id}/mastery_lifecycle/{subskill_id} → lifecycle dict
        self._mastery_lifecycles: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(dict)

        # students/{student_id}/ability/{skill_id} → ability dict
        self._abilities: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(dict)

        # students/{student_id}/competencies/{doc_id} → competency dict
        self._competencies: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(dict)

        # students/{student_id}/learning_paths/{subject_id} → cached unlock state
        self._learning_paths: Dict[str, Dict[str, Any]] = {}

        # students/{student_id}/pulse_state/primitive_history → dict
        self._primitive_history: Dict[int, Dict[str, Any]] = {}

        # pulse_sessions/{session_id} → session dict
        self._pulse_sessions: Dict[str, Dict[str, Any]] = {}

        # item_calibration/{item_key} → calibration dict
        self._item_calibrations: Dict[str, Dict[str, Any]] = {}

        # curriculum_graphs keyed by "SUBJECT:version_type" → graph data dict
        self._curriculum_graphs: Dict[str, Dict[str, Any]] = {}

        # curriculum_published/{grade}/subjects → list of subject dicts
        self._published_subjects: List[Dict[str, Any]] = []

        # Counters for debugging/testing
        self._read_count = 0
        self._write_count = 0

    # ------------------------------------------------------------------
    # Graph pre-loading (call before running Pulse)
    # ------------------------------------------------------------------

    def load_curriculum_graph(
        self,
        subject_id: str,
        graph_data: Dict[str, Any],
        version_type: str = "published",
    ) -> None:
        """Pre-load a curriculum graph for use by LearningPathsService.

        Args:
            subject_id: e.g. "MATHEMATICS" (already uppercased)
            graph_data: Full graph dict with structure:
                {"graph": {"nodes": [...], "edges": [...]}, ...}
            version_type: "published" or "draft"
        """
        key = f"{subject_id}:{version_type}"
        self._curriculum_graphs[key] = graph_data
        logger.info(
            f"[InMemory] Loaded graph {key}: "
            f"{len(graph_data.get('graph', {}).get('nodes', []))} nodes, "
            f"{len(graph_data.get('graph', {}).get('edges', []))} edges"
        )

    def load_published_subjects(self, subjects: List[Dict[str, Any]]) -> None:
        """Pre-load published subject list."""
        self._published_subjects = subjects

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    @property
    def stats(self) -> Dict[str, int]:
        """Return read/write counts for performance analysis."""
        return {"reads": self._read_count, "writes": self._write_count}

    def reset_stats(self) -> None:
        self._read_count = 0
        self._write_count = 0

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _ensure_student(self, student_id: int) -> None:
        if student_id not in self._students:
            self._students[student_id] = {
                "student_id": student_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

    @staticmethod
    def _deep_merge(base: Dict, update: Dict) -> Dict:
        """Merge update into base (simulates Firestore merge=True)."""
        result = dict(base)
        for k, v in update.items():
            if isinstance(v, dict) and isinstance(result.get(k), dict):
                result[k] = InMemoryFirestoreService._deep_merge(result[k], v)
            else:
                result[k] = v
        return result

    # ==================================================================
    # MASTERY LIFECYCLE
    # ==================================================================

    async def get_mastery_lifecycle(
        self, student_id: int, subskill_id: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._mastery_lifecycles.get(student_id, {}).get(subskill_id)
        return copy.deepcopy(doc) if doc else None

    async def get_mastery_lifecycles_batch(
        self, student_id: int, subskill_ids: List[str]
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        self._read_count += 1
        store = self._mastery_lifecycles.get(student_id, {})
        return {
            sid: copy.deepcopy(store.get(sid))
            for sid in subskill_ids
        }

    async def get_all_mastery_lifecycles(
        self, student_id: int, subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        store = self._mastery_lifecycles.get(student_id, {})
        results = []
        for doc in store.values():
            if subject and doc.get("subject") != subject:
                continue
            results.append(copy.deepcopy(doc))
        return results

    async def upsert_mastery_lifecycle(
        self, student_id: int, subskill_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        self._write_count += 1
        self._ensure_student(student_id)
        existing = self._mastery_lifecycles[student_id].get(subskill_id, {})
        merged = self._deep_merge(existing, data)
        self._mastery_lifecycles[student_id][subskill_id] = merged
        return merged

    async def batch_write_mastery_lifecycles(
        self, student_id: int, lifecycles: List[Dict[str, Any]]
    ) -> bool:
        self._write_count += 1
        self._ensure_student(student_id)
        for lc in lifecycles:
            subskill_id = lc.get("subskill_id", "")
            if subskill_id:
                existing = self._mastery_lifecycles[student_id].get(subskill_id, {})
                self._mastery_lifecycles[student_id][subskill_id] = self._deep_merge(existing, lc)
        return True

    # ==================================================================
    # GLOBAL PRACTICE PASS RATE (stored on student doc)
    # ==================================================================

    async def get_global_practice_pass_rate(
        self, student_id: int
    ) -> Dict[str, Any]:
        self._read_count += 1
        doc = self._students.get(student_id, {})
        return {
            "global_practice_passes": doc.get("global_practice_passes", 0),
            "global_practice_fails": doc.get("global_practice_fails", 0),
            "global_practice_pass_rate": doc.get("global_practice_pass_rate", 0.8),
        }

    async def update_global_practice_pass_rate(
        self, student_id: int, passes: int, fails: int
    ) -> None:
        self._write_count += 1
        self._ensure_student(student_id)
        total = passes + fails
        self._students[student_id].update({
            "global_practice_passes": passes,
            "global_practice_fails": fails,
            "global_practice_pass_rate": round(passes / total, 4) if total > 0 else 0.0,
        })

    # ==================================================================
    # STUDENT ABILITY (θ/σ per skill)
    # ==================================================================

    async def get_student_ability(
        self, student_id: int, skill_id: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._abilities.get(student_id, {}).get(skill_id)
        return copy.deepcopy(doc) if doc else None

    async def get_all_student_abilities(
        self, student_id: int
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        return [
            copy.deepcopy(doc)
            for doc in self._abilities.get(student_id, {}).values()
        ]

    async def upsert_student_ability(
        self, student_id: int, skill_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        self._write_count += 1
        self._ensure_student(student_id)
        existing = self._abilities[student_id].get(skill_id, {})
        merged = self._deep_merge(existing, data)
        self._abilities[student_id][skill_id] = merged
        return merged

    async def batch_write_student_abilities(
        self, student_id: int, abilities: List[Dict[str, Any]]
    ) -> bool:
        self._write_count += 1
        self._ensure_student(student_id)
        for ab in abilities:
            skill_id = ab.get("skill_id", "")
            if skill_id:
                existing = self._abilities[student_id].get(skill_id, {})
                self._abilities[student_id][skill_id] = self._deep_merge(existing, ab)
        return True

    # ==================================================================
    # ITEM CALIBRATION (shared across students)
    # ==================================================================

    async def get_item_calibration(
        self, item_key: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._item_calibrations.get(item_key)
        return copy.deepcopy(doc) if doc else None

    async def upsert_item_calibration(
        self, item_key: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        self._write_count += 1
        existing = self._item_calibrations.get(item_key, {})
        merged = self._deep_merge(existing, data)
        self._item_calibrations[item_key] = merged
        return merged

    # ==================================================================
    # COMPETENCY (for prerequisite unlock propagation)
    # ==================================================================

    async def update_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        credibility: float,
        total_attempts: int,
        firebase_uid: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._write_count += 1
        self._ensure_student(student_id)
        doc_id = f"{subject}_{skill_id}_{subskill_id}"
        timestamp = datetime.now(timezone.utc).isoformat()

        existing = self._competencies[student_id].get(doc_id, {})
        created_at = existing.get("created_at", timestamp)

        data = {
            "id": f"{student_id}_{subject}_{skill_id}_{subskill_id}",
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "current_score": float(score),
            "credibility": float(credibility),
            "total_attempts": int(total_attempts),
            "last_updated": timestamp,
            "created_at": created_at,
            "firebase_uid": firebase_uid,
        }
        self._competencies[student_id][doc_id] = data
        return data

    async def get_student_proficiency_map(
        self, student_id: int, subject: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        self._read_count += 1
        prof_map = {}
        for doc_id, data in self._competencies.get(student_id, {}).items():
            if subject and data.get("subject") != subject:
                continue
            entity_id = data.get("subskill_id")
            if not entity_id:
                continue
            raw_score = float(data.get("current_score", 0))
            proficiency = raw_score / 10.0 if raw_score > 1.0 else raw_score
            prof_map[entity_id] = {
                "proficiency": proficiency,
                "attempt_count": int(data.get("total_attempts", 0)),
                "last_updated": data.get("last_updated"),
            }
        return prof_map

    # ==================================================================
    # PULSE SESSIONS
    # ==================================================================

    async def save_pulse_session(
        self, session_id: str, data: Dict[str, Any]
    ) -> None:
        self._write_count += 1
        existing = self._pulse_sessions.get(session_id, {})
        self._pulse_sessions[session_id] = self._deep_merge(existing, data)

    async def get_pulse_session(
        self, session_id: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._pulse_sessions.get(session_id)
        return copy.deepcopy(doc) if doc else None

    async def get_student_pulse_sessions(
        self, student_id: int, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        results = []
        for session in self._pulse_sessions.values():
            if session.get("student_id") != student_id:
                continue
            if status and session.get("status") != status:
                continue
            results.append(copy.deepcopy(session))
        return results

    # ==================================================================
    # PULSE PRIMITIVE HISTORY
    # ==================================================================

    async def get_pulse_primitive_history(
        self, student_id: int
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._primitive_history.get(student_id)
        return copy.deepcopy(doc) if doc else None

    async def save_pulse_primitive_history(
        self, student_id: int, data: Dict[str, Any]
    ) -> None:
        self._write_count += 1
        existing = self._primitive_history.get(student_id, {})
        self._primitive_history[student_id] = self._deep_merge(existing, data)

    # ==================================================================
    # LEARNING PATHS (cached unlock state per student+subject)
    # ==================================================================

    async def get_learning_path(
        self, student_id: int, subject_id: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        key = f"{student_id}:{subject_id}"
        doc = self._learning_paths.get(key)
        return copy.deepcopy(doc) if doc else None

    async def save_learning_path(
        self, student_id: int, subject_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        self._write_count += 1
        key = f"{student_id}:{subject_id}"
        timestamp = datetime.now(timezone.utc).isoformat()
        path_data = {
            "subject_id": subject_id,
            "unlocked_entities": data.get("unlocked_entities", []),
            "entity_statuses": data.get("entity_statuses", {}),
            "newly_unlocked": data.get("newly_unlocked", []),
            "last_computed": timestamp,
        }
        self._learning_paths[key] = path_data
        return path_data

    # ==================================================================
    # CURRICULUM GRAPH
    # ==================================================================

    async def get_curriculum_graph(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        key = f"{subject_id}:{version_type}"
        doc = self._curriculum_graphs.get(key)
        if doc:
            return copy.deepcopy(doc)
        # Try case-insensitive fallback
        for k, v in self._curriculum_graphs.items():
            if k.upper() == key.upper():
                return copy.deepcopy(v)
        # Try base_subject_id fallback (grade-prefixed cache docs)
        for k, v in self._curriculum_graphs.items():
            if v.get("base_subject_id", "").upper() == subject_id.upper() and \
               v.get("version_type", "") == version_type:
                return copy.deepcopy(v)
        return None

    async def get_all_published_subjects(
        self, grade: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        if grade:
            return [s for s in self._published_subjects if s.get("grade") == grade]
        return list(self._published_subjects)

    # ==================================================================
    # CLEANUP (for test isolation)
    # ==================================================================

    def clear_student(self, student_id: int) -> None:
        """Remove all data for a student (replaces Firestore subcollection cleanup)."""
        self._mastery_lifecycles.pop(student_id, None)
        self._abilities.pop(student_id, None)
        self._competencies.pop(student_id, None)
        self._primitive_history.pop(student_id, None)
        self._students.pop(student_id, None)
        # Remove learning paths for this student
        to_remove_lp = [k for k in self._learning_paths if k.startswith(f"{student_id}:")]
        for k in to_remove_lp:
            del self._learning_paths[k]
        # Remove pulse sessions for this student
        to_remove = [
            sid for sid, s in self._pulse_sessions.items()
            if s.get("student_id") == student_id
        ]
        for sid in to_remove:
            del self._pulse_sessions[sid]

    def clear_all(self) -> None:
        """Reset all data (fresh slate for a new test run)."""
        self._students.clear()
        self._mastery_lifecycles.clear()
        self._abilities.clear()
        self._competencies.clear()
        self._learning_paths.clear()
        self._primitive_history.clear()
        self._pulse_sessions.clear()
        self._item_calibrations.clear()
        # Keep curriculum graphs — they're test fixtures, not student data
        self.reset_stats()
