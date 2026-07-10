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
import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class _FakeDoc:
    """Minimal stand-in for a Firestore DocumentSnapshot."""

    def __init__(self, data: Dict[str, Any]):
        self._data = data

    def to_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(self._data)


class _FakeQuery:
    """Minimal chainable query over a list of dicts (==, >=, <= only)."""

    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def where(self, field: str, op: str, value: Any) -> "_FakeQuery":
        if op == "==":
            keep = [d for d in self._docs if d.get(field) == value]
        elif op == ">=":
            keep = [d for d in self._docs if d.get(field) is not None and d.get(field) >= value]
        elif op == "<=":
            keep = [d for d in self._docs if d.get(field) is not None and d.get(field) <= value]
        else:
            raise NotImplementedError(f"_FakeQuery op {op!r}")
        return _FakeQuery(keep)

    def get(self) -> List[_FakeDoc]:
        return [_FakeDoc(d) for d in self._docs]

    def stream(self):
        return iter(self.get())


class _FakeClient:
    """Raw-client facade for the few analytics paths that bypass the
    FirestoreService method surface (e.g. pulse_sessions leapfrog counts)."""

    def __init__(self, service: "InMemoryFirestoreService"):
        self._service = service

    def collection(self, name: str) -> _FakeQuery:
        if name == "pulse_sessions":
            return _FakeQuery(list(self._service._pulse_sessions.values()))
        raise NotImplementedError(
            f"[InMemory] raw client access to collection {name!r} is not supported"
        )


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

        # curriculum_published full docs keyed by subject_id → LIST of grade
        # docs in load order (hierarchy + subskill_index). Production stores
        # one doc per (grade, subject); cross-grade promotion needs several
        # grades of the same subject resident at once.
        self._published_curricula: Dict[str, List[Dict[str, Any]]] = {}

        # subskill_id → {subject, subject_id, grade} (built from
        # subskill_index at load time; mirrors _ensure_subskill_loc_cache)
        self._subskill_loc: Dict[str, Dict[str, Any]] = {}

        # students/{sid}/attempts — L0 append-only ground truth
        self._attempts: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

        # students/{sid}/daily_rollups/{YYYY-MM-DD} — L2 per-day counters
        self._daily_rollups: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(dict)

        # students/{sid}/profile/summary — L2 lifetime totals
        self._profile_summary: Dict[int, Dict[str, Any]] = {}

        # students/{sid}/dailySessionPlans/{YYYY-MM-DD}
        self._session_plans: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(dict)

        # Virtual clock: when set, save_attempt/rollups stamp THIS time
        # instead of wall time so simulated days land in the right rollup
        # buckets. The sim advances it; None = wall clock (v1 behavior).
        self.virtual_now: Optional[datetime] = None

        # Raw-client facade (pulse_sessions leapfrog stats in analytics)
        self.client = _FakeClient(self)

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

    def load_published_curriculum(
        self, subject_id: str, curriculum_doc: Dict[str, Any]
    ) -> None:
        """Pre-load a full published curriculum doc (hierarchy + subskill_index).

        Also registers the subject in the published-subjects list and builds
        the subskill → {subject, subject_id, grade} location index that
        apply_attempt_rollup uses for canonical subject/grade resolution.

        A subject may be loaded once per grade (production keeps one doc per
        (grade, subject)); same-grade reloads replace the earlier doc.
        """
        from app.db.firestore_service import FirestoreService as _FS

        grade = curriculum_doc.get("grade", "")
        grade_code = _FS.normalize_grade_code(grade)
        docs = self._published_curricula.setdefault(subject_id, [])
        for i, d in enumerate(docs):
            if _FS.normalize_grade_code(d.get("grade")) == grade_code:
                docs[i] = curriculum_doc
                break
        else:
            docs.append(curriculum_doc)

        subject_name = curriculum_doc.get("subject_name", subject_id)
        entry = {
            "subject_id": subject_id,
            "subject_name": subject_name,
            "grade": grade,
        }
        if not any(
            s.get("subject_id") == subject_id
            and _FS.normalize_grade_code(s.get("grade")) == grade_code
            for s in self._published_subjects
        ):
            self._published_subjects.append(entry)

        index = curriculum_doc.get("subskill_index") or {}
        for ss_id, loc in index.items():
            self._subskill_loc[ss_id] = {
                "subject": (loc or {}).get("subject") or subject_name,
                "subject_id": subject_id,
                "grade": (loc or {}).get("grade") or grade,
            }
        logger.info(
            f"[InMemory] Loaded published curriculum {subject_id} "
            f"(grade {grade_code}): {len(index)} subskills indexed"
        )

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

    # Shared scoring semantics — mirror FirestoreService constants exactly.
    COMPETENCY_FULL_CREDIBILITY_N = 15
    COMPETENCY_DEFAULT_SCORE = 5.0

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
        raw_average: Optional[float] = None,
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
        if raw_average is not None:
            data["raw_average"] = float(raw_average)
        self._competencies[student_id][doc_id] = data
        return data

    async def apply_competency_eval(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        firebase_uid: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Apply one eval result (0-10) to a competency doc.

        Mirrors FirestoreService.apply_competency_eval: incremental raw
        running average + credibility blend sqrt(n/15) toward 5.0. No
        lineage resolution — in-memory IDs are canonical by construction.
        """
        self._read_count += 1
        doc_id = f"{subject}_{skill_id}_{subskill_id}"
        existing = self._competencies.get(student_id, {}).get(doc_id, {})

        prev_n = int(existing.get("total_attempts", 0) or 0)
        prev_avg = existing.get("raw_average")
        if prev_avg is None and prev_n > 0:
            prev_score = existing.get("current_score")
            prev_cred = float(existing.get("credibility", 0) or 0)
            if prev_score is not None and prev_cred > 0.05:
                prev_avg = (
                    float(prev_score)
                    - self.COMPETENCY_DEFAULT_SCORE * (1 - prev_cred)
                ) / prev_cred
                prev_avg = max(0.0, min(10.0, prev_avg))
            elif prev_score is not None:
                prev_avg = float(prev_score)

        n = prev_n + 1
        if prev_avg is None:
            raw_average = float(score)
        else:
            raw_average = (float(prev_avg) * prev_n + float(score)) / n

        credibility = min(1.0, math.sqrt(n / self.COMPETENCY_FULL_CREDIBILITY_N))
        blended = (raw_average * credibility) + (
            self.COMPETENCY_DEFAULT_SCORE * (1 - credibility)
        )

        return await self.update_competency(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            score=blended,
            credibility=credibility,
            total_attempts=n,
            firebase_uid=firebase_uid,
            raw_average=raw_average,
        )

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
    # L0 ATTEMPTS + L2 READ MODEL (daily_rollups, profile/summary)
    # Mirrors FirestoreService save_attempt/apply_attempt_rollup exactly
    # (dict arithmetic replaces Increment/ArrayUnion sentinels).
    # ==================================================================

    def _now_iso(self) -> str:
        """Virtual clock when set (sim day loop), wall clock otherwise."""
        now = self.virtual_now or datetime.now(timezone.utc)
        return now.isoformat()

    # Key-normalization parity: delegate to the REAL implementations so the
    # in-memory rollups (and the backfill replay oracle, which calls these on
    # the service instance) can never drift from production semantics.
    @staticmethod
    def rollup_subject_key(subject: Optional[str]) -> str:
        from app.db.firestore_service import FirestoreService as _FS
        return _FS.rollup_subject_key(subject)

    @staticmethod
    def normalize_grade_code(grade: Optional[str]) -> str:
        from app.db.firestore_service import FirestoreService as _FS
        return _FS.normalize_grade_code(grade)

    def grade_to_subject_suffix(self, grade_level: Optional[str]) -> str:
        from app.db.firestore_service import FirestoreService as _FS
        # Unbound call — the real method reads no instance state.
        return _FS.grade_to_subject_suffix(self, grade_level)

    def _attempts_subcollection(self, student_id: int) -> _FakeQuery:
        """Private-accessor shim so scripts/backfill_daily_rollups.py's
        aggregate_student() (the L0→L2 replay oracle) runs against this
        service unmodified."""
        return _FakeQuery(list(self._attempts.get(student_id, [])))

    async def save_attempt(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        analysis: str,
        feedback: str,
        firebase_uid: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None,
        attempt_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._write_count += 1
        self._ensure_student(student_id)
        import uuid as _uuid
        attempt_id = attempt_id or str(_uuid.uuid4())
        timestamp = self._now_iso()

        attempt_data = {
            "id": attempt_id,
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "score": float(score),
            "analysis": analysis,
            "feedback": feedback,
            "timestamp": timestamp,
            "firebase_uid": firebase_uid,
            "created_at": timestamp,
        }
        if additional_data:
            attempt_data.update(additional_data)

        self._attempts[student_id].append(attempt_data)

        # L2 read model — best-effort, same as production
        try:
            await self.apply_attempt_rollup(
                student_id=student_id,
                subject=subject,
                subskill_id=subskill_id,
                score=score,
                timestamp=timestamp,
            )
        except Exception as e:
            logger.warning(f"[InMemory] Rollup update failed for {student_id}: {e}")

        return copy.deepcopy(attempt_data)

    async def get_student_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        results = [
            a for a in self._attempts.get(student_id, [])
            if (not subject or a.get("subject") == subject)
            and (not skill_id or a.get("skill_id") == skill_id)
            and (not subskill_id or a.get("subskill_id") == subskill_id)
        ]
        results.sort(key=lambda a: a.get("timestamp", ""), reverse=True)
        return copy.deepcopy(results[:limit])

    async def get_student_attempts_date_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        results = [
            a for a in self._attempts.get(student_id, [])
            if (not subject or a.get("subject") == subject)
            and (not start_date or a.get("timestamp", "") >= start_date)
            and (not end_date or a.get("timestamp", "") <= end_date)
        ]
        results.sort(key=lambda a: a.get("timestamp", ""), reverse=True)
        return copy.deepcopy(results[:limit])

    async def resolve_subskill_location(
        self, subskill_id: str
    ) -> Optional[Dict[str, Any]]:
        """Canonical {subject, subject_id, grade} from the loaded curriculum
        index. No lineage hop — in-memory ids are canonical by construction."""
        if not subskill_id:
            return None
        loc = self._subskill_loc.get(subskill_id)
        return dict(loc) if loc else None

    async def apply_attempt_rollup(
        self,
        student_id: int,
        subject: str,
        subskill_id: str,
        score: float,
        timestamp: Optional[str] = None,
    ) -> None:
        """Dict-arithmetic mirror of FirestoreService.apply_attempt_rollup.

        Doc shapes match production exactly so FirestoreAnalyticsService
        reads them unmodified; Increment → +=, ArrayUnion → set-add.
        """
        # Delegate key normalization to the REAL implementations so the
        # in-memory rollups can never drift from production semantics.
        from app.db.firestore_service import FirestoreService as _FS

        ts = timestamp or self._now_iso()
        day = ts[:10]
        score = float(score)

        loc = await self.resolve_subskill_location(subskill_id)
        if loc:
            canonical_subject = loc["subject"]
            grade = loc.get("grade")
            unresolved = False
        else:
            canonical_subject = subject
            grade = None
            unresolved = True
        subj_key = _FS.rollup_subject_key(canonical_subject)
        grade_key = _FS.normalize_grade_code(grade)

        def _bump(entry: Dict[str, Any], with_subskills: bool) -> None:
            entry["name"] = canonical_subject
            entry["unresolved"] = unresolved
            entry["attempts"] = entry.get("attempts", 0) + 1
            entry["sum_score"] = entry.get("sum_score", 0.0) + score
            entry["last_activity_at"] = ts
            grades = entry.setdefault("grades", {})
            bucket = grades.setdefault(grade_key, {})
            bucket["attempts"] = bucket.get("attempts", 0) + 1
            bucket["sum_score"] = bucket.get("sum_score", 0.0) + score
            bucket["last_activity_at"] = ts
            if with_subskills:
                subs = bucket.setdefault("subskills", [])
                if subskill_id not in subs:
                    subs.append(subskill_id)

        # daily_rollups/{day}
        rollup = self._daily_rollups[student_id].setdefault(day, {})
        rollup["date"] = day
        rollup["student_id"] = student_id
        rollup["attempts"] = rollup.get("attempts", 0) + 1
        rollup["sum_score"] = rollup.get("sum_score", 0.0) + score
        day_subs = rollup.setdefault("subskills", [])
        if subskill_id not in day_subs:
            day_subs.append(subskill_id)
        subj_entry = rollup.setdefault("subjects", {}).setdefault(subj_key, {})
        _bump(subj_entry, with_subskills=True)
        subj_subs = subj_entry.setdefault("subskills", [])
        if subskill_id not in subj_subs:
            subj_subs.append(subskill_id)
        rollup["updated_at"] = ts

        # profile/summary
        summary = self._profile_summary.setdefault(student_id, {})
        summary["student_id"] = student_id
        summary["total_attempts"] = summary.get("total_attempts", 0) + 1
        summary["sum_score"] = summary.get("sum_score", 0.0) + score
        summary["last_activity_at"] = ts
        summary["last_subject"] = canonical_subject
        summary["last_subskill_id"] = subskill_id
        prof_entry = summary.setdefault("subjects", {}).setdefault(subj_key, {})
        _bump(prof_entry, with_subskills=False)
        summary["updated_at"] = ts

    async def get_daily_rollups(
        self,
        student_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        docs = [
            doc for day, doc in self._daily_rollups.get(student_id, {}).items()
            if (not start_date or day >= start_date[:10])
            and (not end_date or day <= end_date[:10])
        ]
        docs.sort(key=lambda d: d.get("date", ""))
        return copy.deepcopy(docs)

    async def get_profile_summary(self, student_id: int) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._profile_summary.get(student_id)
        return copy.deepcopy(doc) if doc else None

    async def get_all_competencies(
        self, student_id: int, subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self._read_count += 1
        return copy.deepcopy([
            c for c in self._competencies.get(student_id, {}).values()
            if not subject or c.get("subject") == subject
        ])

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc_id = f"{subject}_{skill_id}_{subskill_id}"
        doc = self._competencies.get(student_id, {}).get(doc_id)
        return copy.deepcopy(doc) if doc else None

    # ==================================================================
    # PLANNING (student planning fields + daily session plan docs)
    # ==================================================================

    async def get_student_planning_fields(self, student_id: int) -> Dict[str, Any]:
        self._read_count += 1
        data = self._students.get(student_id)
        if not data:
            return {}
        fields = {
            "daily_session_capacity": data.get("daily_session_capacity", 25),
            "development_patterns": data.get("development_patterns", {}),
            "aggregate_metrics": data.get("aggregate_metrics", {}),
            "grade_level": data.get("grade_level"),
            "subject_grade_overrides": data.get("subject_grade_overrides", {}),
            "promotion_ready": data.get("promotion_ready", {}),
        }
        if data.get("daily_budget_minutes") is not None:
            fields["daily_budget_minutes"] = data["daily_budget_minutes"]
        return fields

    async def set_student_grade_level(self, student_id: int, grade_level: str) -> bool:
        self._write_count += 1
        self._ensure_student(student_id)
        self._students[student_id]["grade_level"] = grade_level
        return True

    async def update_student_planning_fields(
        self, student_id: int, data: Dict[str, Any]
    ) -> None:
        self._write_count += 1
        self._ensure_student(student_id)
        self._students[student_id] = self._deep_merge(self._students[student_id], data)

    async def get_daily_session_plan_doc(
        self, student_id: int, plan_date: str
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        doc = self._session_plans.get(student_id, {}).get(plan_date)
        return copy.deepcopy(doc) if doc else None

    async def save_daily_session_plan_doc(
        self, student_id: int, plan_date: str, plan_data: Dict[str, Any]
    ) -> bool:
        self._write_count += 1
        self._ensure_student(student_id)
        self._session_plans[student_id][plan_date] = {
            **copy.deepcopy(plan_data),
            "updated_at": self._now_iso(),
        }
        return True

    async def add_completed_session_block(
        self, student_id: int, plan_date: str, block_id: str
    ) -> bool:
        self._write_count += 1
        plan = self._session_plans.get(student_id, {}).get(plan_date)
        if not plan:
            return False
        completed = plan.setdefault("completed_block_ids", [])
        if block_id not in completed:
            completed.append(block_id)
        return True

    async def get_mastery_retests_due(
        self, student_id: int, before_date: str
    ) -> List[Dict[str, Any]]:
        """Mirror of FirestoreService.get_mastery_retests_due: lifecycles with
        next_retest_eligible <= before_date and gate in [1, 4)."""
        self._read_count += 1
        results = []
        for data in self._mastery_lifecycles.get(student_id, {}).values():
            eligible = data.get("next_retest_eligible")
            if not eligible or str(eligible) > before_date:
                continue
            gate = data.get("current_gate", 0)
            if 1 <= gate < 4:
                results.append(copy.deepcopy(data))
        return results

    async def get_school_year_config(self) -> Optional[Dict[str, Any]]:
        """School-year window for the planner's pacing math.

        Default: a year positioned so 'today' (virtual or wall) sits
        mid-year — otherwise the velocity allocator sees 0 weeks remaining
        and plans nothing. Override with set_school_year_config.
        """
        self._read_count += 1
        if getattr(self, "_school_year_config", None):
            return copy.deepcopy(self._school_year_config)
        now = (self.virtual_now or datetime.now(timezone.utc)).date()
        from datetime import timedelta as _td
        return {
            "start_date": (now - _td(days=120)).isoformat(),
            "end_date": (now + _td(days=240)).isoformat(),
            "breaks": [],
            "school_days_per_week": 5,
        }

    async def set_school_year_config(self, data: Dict[str, Any]) -> None:
        self._write_count += 1
        self._school_year_config = copy.deepcopy(data)

    async def get_published_curriculum(
        self, subject_id: str, grade: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        self._read_count += 1
        docs = self._published_curricula.get(subject_id)
        if docs is None:
            # Case-insensitive fallback
            for k, v in self._published_curricula.items():
                if k.upper() == subject_id.upper():
                    docs = v
                    break
        if not docs:
            return None
        if grade:
            from app.db.firestore_service import FirestoreService as _FS
            want = _FS.normalize_grade_code(grade)
            if want != "UNKNOWN":
                for d in docs:
                    if _FS.normalize_grade_code(d.get("grade")) == want:
                        return copy.deepcopy(d)
                # Lenient fallback (pre-multi-grade behavior): a doc with no
                # resolvable grade satisfies any grade request.
                for d in docs:
                    if _FS.normalize_grade_code(d.get("grade")) == "UNKNOWN":
                        return copy.deepcopy(d)
                return None
        # No grade requested → first loaded doc wins (mirrors production's
        # first-doc-wins scan when callers omit the grade).
        return copy.deepcopy(docs[0])

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
        self._attempts.pop(student_id, None)
        self._daily_rollups.pop(student_id, None)
        self._profile_summary.pop(student_id, None)
        self._session_plans.pop(student_id, None)
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
        self._attempts.clear()
        self._daily_rollups.clear()
        self._profile_summary.clear()
        self._session_plans.clear()
        # Keep curriculum graphs — they're test fixtures, not student data
        self.reset_stats()
