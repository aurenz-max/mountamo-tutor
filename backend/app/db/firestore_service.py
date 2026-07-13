# backend/app/db/firestore_service.py

from google.cloud import firestore
from google.cloud.firestore import Client
from google.oauth2 import service_account
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Union
import asyncio
import logging
import math
import re
import uuid
import os
from ..core.config import settings

logger = logging.getLogger(__name__)

class FirestoreService:
    """
    Firestore service for real-time analytics.

    Data lives under student-level subcollections:
        students/{student_id}/attempts/{attempt_id}
        students/{student_id}/reviews/{review_id}
        students/{student_id}/competencies/{subject}_{skill}_{subskill}

    Curriculum graphs are JIT-flattened from hierarchical Firestore
    (curriculum_published + curriculum_graphs edges subcollection).

    All student-data lookups by subskill_id or skill_id are transparently
    resolved through the SubskillIdResolver so that curriculum iteration
    never orphans student progress.
    """

    def __init__(self, project_id: Optional[str] = None):
        """Initialize Firestore client"""
        try:
            self.project_id = project_id or settings.FIREBASE_PROJECT_ID

            # Initialize Firestore client with Firebase Admin credentials
            # Use explicit credentials instead of overriding global environment
            if hasattr(settings, 'FIREBASE_ADMIN_CREDENTIALS_PATH'):
                firebase_creds_path = settings.firebase_admin_credentials_full_path

                # Load credentials explicitly for Firestore only
                if os.path.exists(firebase_creds_path):
                    credentials = service_account.Credentials.from_service_account_file(firebase_creds_path)
                    self.client = firestore.Client(project=self.project_id, credentials=credentials)
                else:
                    logger.warning(f"Firebase credentials file not found: {firebase_creds_path}")
                    self.client = firestore.Client(project=self.project_id)
            else:
                self.client = firestore.Client(project=self.project_id)

            # Collection reference for curriculum graphs (hierarchical edges)
            self.curriculum_graphs = self.client.collection('curriculum_graphs')

            # Initialize the lineage resolver with this Firestore client
            from ..services.subskill_id_resolver import subskill_id_resolver
            self._resolver = subskill_id_resolver
            self._resolver.set_client(self.client)

            # In-process subskill → {subject, subject_id, grade} location index,
            # built from every published subject's subskill_index. Lets the
            # write path stamp the CANONICAL subject + grade on each attempt
            # rollup instead of trusting the caller's passed subject string
            # (which is where phantom "General"/"Reading" labels leak in).
            self._subskill_loc_cache: Dict[str, Dict[str, Any]] = {}
            self._subskill_loc_refresh: Optional[datetime] = None
            self._subskill_loc_lock = asyncio.Lock()

            logger.info(f"Firestore service initialized for project: {self.project_id}")

        except Exception as e:
            logger.error(f"Failed to initialize Firestore service: {str(e)}")
            raise

    # ============================================================================
    # SUBCOLLECTION HELPERS
    # ============================================================================

    def _student_doc(self, student_id: int):
        """Get reference to a student document: students/{student_id}"""
        return self.client.collection('students').document(str(student_id))

    def _attempts_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/attempts"""
        return self._student_doc(student_id).collection('attempts')

    def _reviews_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/reviews"""
        return self._student_doc(student_id).collection('reviews')

    def _competencies_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/competencies"""
        return self._student_doc(student_id).collection('competencies')

    def _learning_paths_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/learning_paths"""
        return self._student_doc(student_id).collection('learning_paths')

    async def _ensure_student_document(self, student_id: int, firebase_uid: Optional[str] = None):
        """Ensure the student document exists with minimal metadata (merge=True)"""
        try:
            doc_ref = self._student_doc(student_id)
            data = {
                "student_id": student_id,
                "last_activity": datetime.now(timezone.utc).isoformat(),
            }
            if firebase_uid:
                data["firebase_uid"] = firebase_uid
            doc_ref.set(data, merge=True)
        except Exception as e:
            logger.warning(f"Failed to ensure student document for {student_id}: {e}")

    # ============================================================================
    # DATA HELPERS
    # ============================================================================

    def _add_migration_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add migration tracking metadata to documents"""
        data_copy = data.copy()
        data_copy.update({
            'source_system': 'cosmos_migration',
            'migration_timestamp': datetime.now(timezone.utc).isoformat(),
            'firestore_created_at': datetime.now(timezone.utc).isoformat()
        })
        return data_copy

    def _prepare_firestore_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare data for Firestore by handling unsupported types"""
        prepared_data = {}

        for key, value in data.items():
            if value is None:
                prepared_data[key] = None
            elif isinstance(value, (str, int, float, bool)):
                prepared_data[key] = value
            elif isinstance(value, dict):
                prepared_data[key] = self._prepare_firestore_data(value)
            elif isinstance(value, list):
                prepared_data[key] = [
                    self._prepare_firestore_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            elif isinstance(value, datetime):
                prepared_data[key] = value.isoformat()
            else:
                # Convert other types to string
                prepared_data[key] = str(value)

        return prepared_data

    # ============================================================================
    # ATTEMPTS METHODS
    # ============================================================================

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
        attempt_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save student attempt to Firestore under students/{student_id}/attempts/

        `attempt_id` is the shared submission id also stamped on the paired
        review doc — pass the one generated by the submission handler so the
        attempt and its review can be joined directly instead of by timestamp.
        """
        try:
            attempt_id = attempt_id or str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()

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
                "created_at": timestamp
            }

            # Add any additional data
            if additional_data:
                attempt_data.update(additional_data)

            # Add migration metadata
            attempt_data = self._add_migration_metadata(attempt_data)

            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(attempt_data)

            # Ensure student doc exists, then save to subcollection
            await self._ensure_student_document(student_id, firebase_uid)
            doc_ref = self._attempts_subcollection(student_id).document(attempt_id)
            doc_ref.set(firestore_data)

            # L2 read model: increment the day's rollup counters + profile
            # summary. Best-effort — rollups are rebuildable from attempts
            # (scripts/backfill_daily_rollups.py), so a failure here must
            # never fail the attempt write itself.
            try:
                await self.apply_attempt_rollup(
                    student_id=student_id,
                    subject=subject,
                    subskill_id=subskill_id,
                    score=score,
                    timestamp=timestamp,
                )
            except Exception as e:
                logger.warning(f"Rollup update failed for student {student_id} (attempt {attempt_id}): {e}")

            logger.info(f"Saved attempt {attempt_id} to Firestore for student {student_id}")
            return firestore_data

        except Exception as e:
            logger.error(f"Error saving attempt to Firestore: {str(e)}")
            raise

    async def get_student_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get student attempts from Firestore subcollection"""
        try:
            query = self._attempts_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if skill_id:
                query = query.where('skill_id', '==', skill_id)
            if subskill_id:
                query = query.where('subskill_id', '==', subskill_id)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} attempts for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting student attempts from Firestore: {str(e)}")
            return []

    async def get_student_attempts_date_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get student attempts filtered by date range (ISO string comparison)."""
        try:
            query = self._attempts_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if start_date:
                query = query.where('timestamp', '>=', start_date)
            if end_date:
                query = query.where('timestamp', '<=', end_date)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} attempts (date range) for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting attempts by date range from Firestore: {str(e)}")
            return []

    # ============================================================================
    # DAILY ROLLUPS + PROFILE SUMMARY (L2 read model)
    # ============================================================================
    # students/{sid}/daily_rollups/{YYYY-MM-DD} — per-day counter docs kept in
    # sync by apply_attempt_rollup on every attempt write. Purely derived from
    # the attempts subcollection (L0) and rebuildable at any time via
    # scripts/backfill_daily_rollups.py — that replay property is the contract.
    # students/{sid}/profile/summary — lifetime totals, same maintenance.

    def _daily_rollups_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/daily_rollups"""
        return self._student_doc(student_id).collection('daily_rollups')

    def _profile_summary_ref(self, student_id: int):
        """Get reference to students/{student_id}/profile/summary"""
        return self._student_doc(student_id).collection('profile').document('summary')

    @staticmethod
    def normalize_grade_code(grade: Optional[str]) -> str:
        """Canonical short grade code for keying + labeling.

        Curriculum grade fields arrive in many spellings ("Kindergarten", "K",
        "3rd Grade", "3", "Grade 3"). Collapse them to "K" or "1".."12" so
        per-grade rollup buckets don't fragment. "UNKNOWN" when unresolvable.
        """
        if grade is None or str(grade).strip() == "":
            return "UNKNOWN"
        g = str(grade).strip().upper()
        if g in ("K", "KINDERGARTEN", "GRADE K", "GRADE-K"):
            return "K"
        if g in ("PK", "PRE-K", "PREK"):
            return "PK"
        m = re.search(r"(\d{1,2})", g)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 12:
                return str(n)
        return "UNKNOWN"

    @staticmethod
    def rollup_subject_key(subject: Optional[str]) -> str:
        """Canonical map key for a subject inside rollup docs.

        Mirrors firestore_analytics._norm_subject: attempts carry the subject
        in every historical spelling ("Mathematics", "MATHEMATICS_G1", …);
        rollup counters must land on ONE key or per-subject sums fragment.
        """
        if not subject:
            return "UNKNOWN"
        s = re.sub(r"[\s\-]+", "_", subject.strip().upper())
        # _GK (kindergarten) too — \d+ alone left K docs unnormalized, so
        # every K student's subject keys fragmented from their base subject.
        return re.sub(r"_G(?:\d+|K)$", "", s) or "UNKNOWN"

    async def _ensure_subskill_loc_cache(self) -> None:
        """Load/refresh the subskill → {subject, subject_id, grade} index.

        Built once from every published subject's subskill_index (K–12 × a
        handful of subjects — small). Refreshed on the same 10-minute cadence
        as the lineage resolver; a load failure keeps the stale cache rather
        than blanking it, so the write path degrades to the passed subject.
        """
        now = datetime.now(timezone.utc)
        if (
            self._subskill_loc_refresh is not None
            and (now - self._subskill_loc_refresh) < timedelta(minutes=10)
        ):
            return
        async with self._subskill_loc_lock:
            if (
                self._subskill_loc_refresh is not None
                and (datetime.now(timezone.utc) - self._subskill_loc_refresh) < timedelta(minutes=10)
            ):
                return
            try:
                new_cache: Dict[str, Dict[str, Any]] = {}
                for grade_doc in self.client.collection('curriculum_published').stream():
                    grade_id = grade_doc.id
                    for doc in grade_doc.reference.collection('subjects').stream():
                        data = doc.to_dict() or {}
                        subject_name = data.get("subject_name", doc.id)
                        grade = data.get("grade", grade_id)
                        for ss_id, entry in (data.get("subskill_index") or {}).items():
                            new_cache[ss_id] = {
                                "subject": (entry or {}).get("subject") or subject_name,
                                "subject_id": doc.id,
                                "grade": (entry or {}).get("grade") or grade,
                            }
                self._subskill_loc_cache = new_cache
                self._subskill_loc_refresh = datetime.now(timezone.utc)
                if new_cache:
                    logger.info(f"Subskill location index loaded: {len(new_cache)} subskills")
            except Exception as e:
                logger.error(f"Failed to load subskill location index: {e}")
                if not self._subskill_loc_cache:
                    self._subskill_loc_refresh = datetime.now(timezone.utc)

    async def resolve_subskill_location(self, subskill_id: str) -> Optional[Dict[str, Any]]:
        """Resolve a subskill_id to its canonical {subject, subject_id, grade}.

        Routes the id through the lineage resolver first (so deprecated ids land
        on their successor) before the curriculum lookup. Returns None for a
        true orphan — an id that resolves to no published subskill — so the
        caller can flag it instead of inventing a subject.
        """
        await self._ensure_subskill_loc_cache()
        if not subskill_id:
            return None
        loc = self._subskill_loc_cache.get(subskill_id)
        if loc:
            return loc
        # Deprecated id? Follow lineage to the canonical successor, then retry.
        try:
            canonical = await self._resolver.resolve(subskill_id)
        except Exception:
            canonical = subskill_id
        if canonical and canonical != subskill_id:
            return self._subskill_loc_cache.get(canonical)
        return None

    async def apply_attempt_rollup(
        self,
        student_id: int,
        subject: str,
        subskill_id: str,
        score: float,
        timestamp: Optional[str] = None,
    ) -> None:
        """Increment the day's rollup doc and the profile summary for one attempt.

        Uses Firestore Increment/ArrayUnion sentinels so concurrent submissions
        compose without a read-modify-write. Called from save_attempt; only
        the backfill script should ever write these docs any other way.

        The subject the caller passes is UNTRUSTED — several submission paths
        default it to "General" (or spell it "Reading" vs "Language Arts").
        We resolve the CANONICAL subject + grade from the curriculum via the
        subskill_id (lineage-aware) and stamp those; the raw subject is only a
        fallback for a true orphan, flagged so the read model can drop it.
        """
        ts = timestamp or datetime.now(timezone.utc).isoformat()
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
        subj_key = self.rollup_subject_key(canonical_subject)
        grade_key = self.normalize_grade_code(grade)

        # Per-subject entry carries a nested per-grade breakdown so a subject
        # practiced across grades (e.g. K review + on-grade work) yields one
        # labeled row per grade instead of collapsing into a single bar.
        def _subject_entry(with_subskills: bool) -> Dict[str, Any]:
            grade_bucket = {
                "attempts": firestore.Increment(1),
                "sum_score": firestore.Increment(score),
                "last_activity_at": ts,
            }
            if with_subskills:
                grade_bucket["subskills"] = firestore.ArrayUnion([subskill_id])
            return {
                "name": canonical_subject,
                "unresolved": unresolved,
                "attempts": firestore.Increment(1),
                "sum_score": firestore.Increment(score),
                "last_activity_at": ts,
                "grades": {grade_key: grade_bucket},
            }

        rollup_entry = _subject_entry(with_subskills=True)
        rollup_entry["subskills"] = firestore.ArrayUnion([subskill_id])
        rollup_update = {
            "date": day,
            "student_id": student_id,
            "attempts": firestore.Increment(1),
            "sum_score": firestore.Increment(score),
            "subskills": firestore.ArrayUnion([subskill_id]),
            "subjects": {subj_key: rollup_entry},
            "updated_at": ts,
        }
        self._daily_rollups_subcollection(student_id).document(day).set(rollup_update, merge=True)

        profile_update = {
            "student_id": student_id,
            "total_attempts": firestore.Increment(1),
            "sum_score": firestore.Increment(score),
            "last_activity_at": ts,
            "last_subject": canonical_subject,
            "last_subskill_id": subskill_id,
            "subjects": {subj_key: _subject_entry(with_subskills=False)},
            "updated_at": ts,
        }
        self._profile_summary_ref(student_id).set(profile_update, merge=True)

    async def get_daily_rollups(
        self,
        student_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Read daily rollup docs, optionally bounded by YYYY-MM-DD strings (inclusive)."""
        try:
            query = self._daily_rollups_subcollection(student_id)
            if start_date:
                query = query.where('date', '>=', start_date[:10])
            if end_date:
                query = query.where('date', '<=', end_date[:10])
            query = query.order_by('date')
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error reading daily rollups for student {student_id}: {str(e)}")
            return []

    async def get_profile_summary(self, student_id: int) -> Optional[Dict[str, Any]]:
        """Read the profile summary doc; None if it has never been written."""
        try:
            doc = self._profile_summary_ref(student_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error reading profile summary for student {student_id}: {str(e)}")
            return None

    # ============================================================================
    # REVIEWS METHODS
    # ============================================================================

    async def save_problem_review(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        problem_id: str,
        review_data: Dict[str, Any],
        problem_content: Dict[str, Any] = None,
        firebase_uid: Optional[str] = None,
        attempt_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save problem review to Firestore under students/{student_id}/reviews/

        `attempt_id` links this review to the attempt doc written in the same
        submission (shared id generated by the submission handler).
        """
        try:
            review_id = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()

            review_item = {
                "id": review_id,
                "attempt_id": attempt_id,
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "problem_id": problem_id,
                "timestamp": timestamp,
                "problem_content": problem_content,
                "full_review": review_data,
                "observation": review_data.get("observation", {}),
                "analysis": review_data.get("analysis", {}),
                "evaluation": review_data.get("evaluation", {}),
                "feedback": review_data.get("feedback", {}),
                "score": float(review_data.get("evaluation", {}).get("score", 0))
                    if isinstance(review_data.get("evaluation"), dict)
                    else float(review_data.get("evaluation", 0)),
                "firebase_uid": firebase_uid,
                "created_at": timestamp
            }

            # Add migration metadata
            review_item = self._add_migration_metadata(review_item)

            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(review_item)

            # Ensure student doc exists, then save to subcollection
            await self._ensure_student_document(student_id, firebase_uid)
            doc_ref = self._reviews_subcollection(student_id).document(review_id)
            doc_ref.set(firestore_data)

            logger.info(f"Saved review {review_id} to Firestore for student {student_id}")
            return firestore_data

        except Exception as e:
            logger.error(f"Error saving review to Firestore: {str(e)}")
            raise

    async def get_problem_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get problem reviews from Firestore subcollection"""
        try:
            query = self._reviews_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if skill_id:
                query = query.where('skill_id', '==', skill_id)
            if subskill_id:
                query = query.where('subskill_id', '==', subskill_id)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} reviews for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting reviews from Firestore: {str(e)}")
            return []

    async def get_problem_reviews_date_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get problem reviews filtered by date range (ISO string comparison)."""
        try:
            query = self._reviews_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if start_date:
                query = query.where('timestamp', '>=', start_date)
            if end_date:
                query = query.where('timestamp', '<=', end_date)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} reviews (date range) for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting reviews by date range from Firestore: {str(e)}")
            return []

    async def get_review_by_attempt_id(
        self,
        student_id: int,
        attempt_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get the review written in the same submission as the given attempt.

        Direct lookup via the shared attempt_id field (single-field auto index).
        Returns None for legacy reviews written before the join key existed.
        """
        try:
            query = (
                self._reviews_subcollection(student_id)
                .where('attempt_id', '==', attempt_id)
                .limit(1)
            )
            for doc in query.stream():
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error getting review by attempt_id {attempt_id}: {str(e)}")
            return None

    # ============================================================================
    # COMPETENCIES METHODS
    # ============================================================================

    async def get_all_competencies(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all competency docs for a student, optionally filtered by subject."""
        try:
            query = self._competencies_subcollection(student_id)
            if subject:
                query = query.where('subject', '==', subject)
            results = [doc.to_dict() for doc in query.stream()]
            logger.info(f"Retrieved {len(results)} competencies for student {student_id}")
            return results
        except Exception as e:
            logger.error(f"Error getting all competencies from Firestore: {str(e)}")
            return []

    # Shared competency scoring semantics. Single source of truth — both the
    # practice path (CompetencyService) and PulseEngine route their eval writes
    # through apply_competency_eval below, so the two writers can no longer
    # fight with different credibility math (last-write-wins flip-flop).
    COMPETENCY_FULL_CREDIBILITY_N = 15
    COMPETENCY_DEFAULT_SCORE = 5.0

    async def apply_competency_eval(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        firebase_uid: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Apply one eval result (0-10 score) to a competency doc.

        Incremental: the attempt count and raw running average come from the
        existing doc, so practice and pulse evals compose regardless of which
        path fired last. Blend: credibility = sqrt(n/15) capped at 1,
        blended = raw_avg * cred + 5.0 * (1 - cred).
        """
        try:
            canonical_skill = await self._resolver.resolve_skill(skill_id)
            canonical_sub = await self._resolver.resolve(subskill_id)
            doc_id = f"{subject}_{canonical_skill}_{canonical_sub}"
            doc = self._competencies_subcollection(student_id).document(doc_id).get()
            existing = doc.to_dict() if doc.exists else {}

            prev_n = int(existing.get("total_attempts", 0) or 0)
            prev_avg = existing.get("raw_average")
            if prev_avg is None and prev_n > 0:
                # Legacy doc predating raw_average: recover the average by
                # inverting the stored blend where the credibility is
                # meaningful, else fall back to the blended score itself.
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
                skill_id=canonical_skill,
                subskill_id=canonical_sub,
                score=blended,
                credibility=credibility,
                total_attempts=n,
                firebase_uid=firebase_uid,
                raw_average=raw_average,
            )
        except Exception as e:
            logger.error(f"Error applying competency eval: {str(e)}")
            raise

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
        raw_average: Optional[float] = None
    ) -> Dict[str, Any]:
        """Update competency in Firestore under students/{student_id}/competencies/

        Prefer apply_competency_eval for per-eval updates — this method
        overwrites whatever score/credibility it is given (used directly only
        for seeding, e.g. pulse leapfrog inference).
        """
        try:
            # Resolve through lineage — always write to canonical ID
            skill_id = await self._resolver.resolve_skill(skill_id)
            subskill_id = await self._resolver.resolve(subskill_id)

            # Subcollection doc ID omits student_id (already scoped by parent)
            competency_doc_id = f"{subject}_{skill_id}_{subskill_id}"
            # Keep full composite ID in the data for backward compatibility
            competency_id = f"{student_id}_{subject}_{skill_id}_{subskill_id}"
            timestamp = datetime.now(timezone.utc).isoformat()

            competency_data = {
                "id": competency_id,
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": float(score),
                "credibility": float(credibility),
                "total_attempts": int(total_attempts),
                "last_updated": timestamp,
                "firebase_uid": firebase_uid
            }
            if raw_average is not None:
                # Running average of raw eval scores — lets apply_competency_eval
                # blend incrementally without rescanning attempts.
                competency_data["raw_average"] = float(raw_average)

            # Ensure student doc exists
            await self._ensure_student_document(student_id, firebase_uid)

            # Check if document exists to preserve created_at
            doc_ref = self._competencies_subcollection(student_id).document(competency_doc_id)
            existing_doc = doc_ref.get()

            if existing_doc.exists:
                # Preserve created_at from existing document
                existing_data = existing_doc.to_dict()
                competency_data["created_at"] = existing_data.get("created_at", timestamp)
            else:
                competency_data["created_at"] = timestamp

            # Add migration metadata
            competency_data = self._add_migration_metadata(competency_data)

            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(competency_data)

            # Save to Firestore
            doc_ref.set(firestore_data)

            logger.info(f"Updated competency {competency_id} in Firestore")
            return firestore_data

        except Exception as e:
            logger.error(f"Error updating competency in Firestore: {str(e)}")
            raise

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> Dict[str, Any]:
        """Get competency from Firestore subcollection.

        Resolves through curriculum lineage: tries canonical ID first,
        falls back to original ID if data hasn't been migrated yet,
        then triggers lazy migration.
        """
        try:
            # Resolve to canonical IDs
            canonical_skill = await self._resolver.resolve_skill(skill_id)
            canonical_subskill = await self._resolver.resolve(subskill_id)

            competency_doc_id = f"{subject}_{canonical_skill}_{canonical_subskill}"
            doc_ref = self._competencies_subcollection(student_id).document(competency_doc_id)
            doc = doc_ref.get()

            if doc.exists:
                return doc.to_dict()

            # Fallback: try the original (pre-lineage) ID if different
            if canonical_subskill != subskill_id or canonical_skill != skill_id:
                old_doc_id = f"{subject}_{skill_id}_{subskill_id}"
                old_ref = self._competencies_subcollection(student_id).document(old_doc_id)
                old_doc = old_ref.get()
                if old_doc.exists:
                    return old_doc.to_dict()

            # Return default competency structure
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": canonical_skill,
                "subskill_id": canonical_subskill,
                "current_score": 0,
                "credibility": 0,
                "total_attempts": 0,
                "last_updated": None
            }

        except Exception as e:
            logger.error(f"Error getting competency from Firestore: {str(e)}")
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": 0,
                "credibility": 0,
                "total_attempts": 0,
                "last_updated": None
            }

    async def get_subject_competencies(
        self,
        student_id: int,
        subject: str
    ) -> List[Dict[str, Any]]:
        """Get all competencies for a specific subject from Firestore subcollection"""
        try:
            query = self._competencies_subcollection(student_id).where('subject', '==', subject)
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} competencies for student {student_id}, subject {subject}")
            return results

        except Exception as e:
            logger.error(f"Error getting subject competencies from Firestore: {str(e)}")
            return []

    # ============================================================================
    # MISCONCEPTION METHODS (Misconception Loop PRD — S3 store)
    # ============================================================================
    # Firestore-native store: one doc per subskill at
    # students/{student_id}/misconceptions/{subskill_id}. Doc-id = the resolved
    # subskill gives the one-slot-per-subskill overwrite semantics for free, so
    # a retried/double-fired write is idempotent by construction. Field contract
    # mirrors the legacy Cosmos StudentMisconception shape (subskill_id,
    # misconception_text, source_attempt_id, last_detected_at, status,
    # resolved_at) so a later Cosmos backfill is trivial.

    def _misconceptions_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/misconceptions"""
        return self._student_doc(student_id).collection('misconceptions')

    async def add_or_update_misconception(
        self,
        student_id: int,
        primitive_type: str,
        scope: str,
        misconception_text: str,
        source_attempt_id: str,
        subskill_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        confidence: Optional[str] = None,
        evidence_tier: Optional[str] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Write (or overwrite) the active misconception for a subskill.

        One free-text slot per subskill; re-detection overwrites and resets
        status to 'active'. `.set()` on a subskill-keyed doc makes double-fires
        from the fire-and-forget frontend path safe.
        """
        try:
            # Resolve through lineage — always write to canonical ID
            if scope not in ("primitive", "skill"):
                raise ValueError(f"Invalid misconception scope: {scope}")
            if subskill_id:
                subskill_id = await self._resolver.resolve(subskill_id)
            if scope == "skill" and not skill_id:
                raise ValueError("skill_id is required for skill-scoped misconceptions")
            misconception_key = primitive_type if scope == "primitive" else f"{primitive_type}::{skill_id}"
            timestamp = datetime.now(timezone.utc).isoformat()

            misconception_data = {
                "student_id": student_id,
                "primitive_type": primitive_type,
                "scope": scope,
                "skill_id": skill_id if scope == "skill" else None,
                "subskill_id": subskill_id,
                "misconception_key": misconception_key,
                "misconception_text": misconception_text,
                "source_attempt_id": source_attempt_id,
                "confidence": confidence,
                "evidence_tier": evidence_tier,
                "last_detected_at": timestamp,
                "status": "active",
                "resolved_at": None,
                "firebase_uid": firebase_uid
            }

            await self._ensure_student_document(student_id, firebase_uid)

            doc_ref = self._misconceptions_subcollection(student_id).document(misconception_key)
            existing_doc = doc_ref.get()
            if existing_doc.exists:
                existing_data = existing_doc.to_dict()
                misconception_data["created_at"] = existing_data.get("created_at", timestamp)
            else:
                misconception_data["created_at"] = timestamp

            misconception_data = self._add_migration_metadata(misconception_data)
            firestore_data = self._prepare_firestore_data(misconception_data)
            doc_ref.set(firestore_data)

            logger.info(f"Stored misconception for student {student_id}, key {misconception_key}")
            return firestore_data

        except Exception as e:
            logger.error(f"Error storing misconception in Firestore: {str(e)}")
            raise

    async def resolve_misconception(
        self,
        student_id: int,
        primitive_type: str,
        skill_id: Optional[str] = None,
    ) -> bool:
        """Flip an active misconception to resolved. Returns False when none active."""
        try:
            misconception_key = primitive_type if not skill_id else f"{primitive_type}::{skill_id}"
            doc_ref = self._misconceptions_subcollection(student_id).document(misconception_key)
            doc = doc_ref.get()

            if not doc.exists or doc.to_dict().get("status") != "active":
                return False

            doc_ref.update({
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"Resolved misconception for student {student_id}, key {misconception_key}")
            return True

        except Exception as e:
            logger.error(f"Error resolving misconception in Firestore: {str(e)}")
            return False

    async def get_active_misconceptions(
        self,
        student_id: int,
        subskill_ids: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Batch-read active misconceptions, keyed by canonical subskill_id.

        When subskill_ids is given, only those (lineage-resolved) are returned —
        one read inside the existing generation-context request (S4), never a
        per-objective fan-out. Fail-soft: errors return {}.
        """
        try:
            query = self._misconceptions_subcollection(student_id).where('status', '==', 'active')
            active = {doc.id: doc.to_dict() for doc in query.stream()}

            return active

        except Exception as e:
            logger.error(f"Error reading misconceptions from Firestore: {str(e)}")
            return {}

    # ============================================================================
    # CURRICULUM GRAPH METHODS (READ-ONLY)
    # ============================================================================

    # ------------------------------------------------------------------
    # JIT graph flattening helpers
    # ------------------------------------------------------------------

    # Grade suffix → Firestore grade doc ID hints for fast resolution.
    _GRADE_SUFFIX_HINTS: Dict[str, List[str]] = {
        "_GK": ["Kindergarten", "K"],
        "_GPK": ["Pre-K", "PK"],
        **{f"_G{i}": [str(i), f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade"]
           for i in range(1, 13)},
    }

    def grade_to_subject_suffix(self, grade_level: Optional[str]) -> str:
        """Convert a student grade_level to the curriculum subject-id suffix.

        The inverse of the ``_GRADE_SUFFIX_HINTS`` table: turns a stored grade
        ("K", "Kindergarten", "1st", "1", "Pre-K") into the suffix used to
        grade-scope a subject id ("_GK", "_G1", "_GPK"). Returns "" when the
        grade can't be resolved, so callers fall back to the (ambiguous) scan.
        """
        if not grade_level:
            return ""
        g = str(grade_level).strip().upper()
        if g in ("PK", "PRE-K", "PREK", "PRE-KINDERGARTEN"):
            return "_GPK"
        if g in ("K", "KINDERGARTEN"):
            return "_GK"
        # Pull the leading number out of forms like "1", "1st", "12th".
        digits = ""
        for ch in g:
            if ch.isdigit():
                digits += ch
            else:
                break
        if digits:
            n = int(digits)
            if 1 <= n <= 12:
                return f"_G{n}"
        return ""

    @staticmethod
    def next_grade_level(grade_level: Optional[str]) -> Optional[str]:
        """The grade after `grade_level` in students/{id}.grade_level terms.

        "PK" → "K" → "1" → … → "12" → None (nowhere higher to promote to).
        Accepts any spelling normalize_grade_code understands.
        """
        code = FirestoreService.normalize_grade_code(grade_level)
        if code == "PK":
            return "K"
        if code == "K":
            return "1"
        if code.isdigit() and 1 <= int(code) < 12:
            return str(int(code) + 1)
        return None

    def _strip_grade_suffix(self, subject_id: str) -> tuple:
        """Strip grade suffix from subject_id, returning (bare_id, grade_hints).

        E.g. "MATHEMATICS_GK" → ("MATHEMATICS", ["Kindergarten", "K"])
             "MATHEMATICS"    → ("MATHEMATICS", [])
        """
        for suffix, hints in self._GRADE_SUFFIX_HINTS.items():
            if subject_id.endswith(suffix):
                return subject_id[:-len(suffix)], hints
        return subject_id, []

    def _resolve_grade_for_subject(
        self, subject_id: str, collection_name: str = "curriculum_published",
        grade_hints: Optional[List[str]] = None,
    ) -> Optional[str]:
        """Find which grade document contains this subject.

        If grade_hints are provided (from a grade suffix), try those first
        for an O(1) lookup before falling back to a full scan.
        """
        # Fast path: try grade hints first
        for hint in (grade_hints or []):
            doc_ref = (
                self.client.collection(collection_name)
                .document(hint)
                .collection("subjects")
                .document(subject_id)
            )
            if doc_ref.get().exists:
                return hint

        # Slow path: scan all grade documents. First match wins and doc ids
        # stream lexicographically ("1" < "Kindergarten"), so a subject that
        # is published in several grades resolves to Grade 1 — this scan is
        # a GUESS. Callers should pass a grade (students/{id}.grade_level).
        for grade_doc in self.client.collection(collection_name).stream():
            subj_ref = grade_doc.reference.collection("subjects").document(subject_id)
            if subj_ref.get().exists:
                logger.warning(
                    f"Grade-ambiguous resolution: {subject_id} matched grade doc "
                    f"'{grade_doc.id}' by first-doc-wins scan — pass a grade to "
                    f"avoid serving the wrong grade's curriculum"
                )
                return grade_doc.id
        return None

    def _read_nodes_from_curriculum(
        self, grade: str, subject_id: str, collection_name: str = "curriculum_published"
    ) -> List[Dict[str, Any]]:
        """Build flat node list from a hierarchical curriculum document."""
        doc_ref = (
            self.client.collection(collection_name)
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            return []

        data = doc.to_dict()
        nodes: List[Dict[str, Any]] = []

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
                    node: Dict[str, Any] = {
                        "id": sub_id,
                        "type": "subskill",
                        "entity_type": "subskill",
                        "label": sub.get("subskill_description", sub_id),
                        "skill_id": skill_id,
                        "unit_id": unit_id,
                        "subskill_order": sub.get("subskill_order", 0),
                    }
                    tp = sub.get("target_primitive")
                    if tp:
                        node["primitive_type"] = tp
                    eval_modes = sub.get("target_eval_modes")
                    if eval_modes:
                        node["eval_modes"] = eval_modes
                    nodes.append(node)

        return nodes

    def _read_edges_from_graph(
        self, grade: str, subject_id: str, published_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Read edges from curriculum_graphs/{grade}/subjects/{subject_id}/edges/."""
        edges_coll = (
            self.curriculum_graphs
            .document(grade)
            .collection("subjects")
            .document(subject_id)
            .collection("edges")
        )

        query = edges_coll.where("is_draft", "==", False) if published_only else edges_coll

        edges: List[Dict[str, Any]] = []
        for doc in query.stream():
            e = doc.to_dict()
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

        return edges

    # ------------------------------------------------------------------
    # Public graph accessor — JIT flattens from hierarchical Firestore
    # ------------------------------------------------------------------

    async def get_curriculum_graph(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get curriculum graph by JIT-flattening from hierarchical Firestore.

        Reads nodes from curriculum_published (or curriculum_drafts) and edges
        from curriculum_graphs/{grade}/subjects/{subject_id}/edges/, then
        assembles the flat {nodes, edges} format that Pulse/LearningPaths expect.

        Callers (LearningPathsService) cache the result in-memory, so this
        only runs once per subject per backend process.

        Args:
            subject_id: Subject identifier (e.g., "MATHEMATICS", "LANGUAGE_ARTS")
            version_type: "published" or "draft" (default: "published")
            version_id: Ignored (kept for interface compatibility)

        Returns:
            {
                "id": str,
                "subject_id": str,
                "version_type": str,
                "graph": {
                    "nodes": [...],
                    "edges": [...]
                },
                "metadata": {...},
                "generated_at": str,
                "last_accessed": str
            }
        """
        try:
            collection_name = (
                "curriculum_published" if version_type == "published"
                else "curriculum_drafts"
            )

            # Strip grade suffix (e.g. MATHEMATICS_GK → MATHEMATICS)
            # and extract grade hints for fast resolution.
            bare_subject_id, grade_hints = self._strip_grade_suffix(subject_id)
            published_only = version_type == "published"

            def _load_graph_blocking():
                resolved_grade = self._resolve_grade_for_subject(
                    bare_subject_id, collection_name, grade_hints
                )
                if not resolved_grade:
                    return None, [], []
                loaded_nodes = self._read_nodes_from_curriculum(
                    resolved_grade, bare_subject_id, collection_name
                )
                loaded_edges = self._read_edges_from_graph(
                    resolved_grade, bare_subject_id, published_only
                )
                return resolved_grade, loaded_nodes, loaded_edges

            # These helpers issue synchronous Firestore .get()/.stream() calls.
            # Run them in a worker thread so a graph build can't block the event
            # loop (and stall every other in-flight request) while Firestore responds.
            grade, nodes, edges = await asyncio.to_thread(_load_graph_blocking)
            if not grade:
                logger.info(
                    f"No {collection_name} document found for {bare_subject_id}"
                )
                return None

            now = datetime.now(timezone.utc).isoformat()
            skill_count = sum(1 for n in nodes if n.get("type") == "skill")
            subskill_count = sum(1 for n in nodes if n.get("type") == "subskill")
            rel_counts = Counter(e.get("relationship", "prerequisite") for e in edges)

            result: Dict[str, Any] = {
                "id": f"{subject_id}_jit_{version_type}",
                "subject_id": subject_id,
                "grade": grade,
                "base_subject_id": bare_subject_id,
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
                "source": "jit_flatten",
            }

            logger.info(
                f"JIT-flattened graph for {bare_subject_id} (grade={grade}): "
                f"{len(nodes)} nodes, {len(edges)} edges"
            )
            return result

        except Exception as e:
            logger.error(f"Error JIT-flattening curriculum graph: {str(e)}")
            return None

    async def get_graph_status(
        self,
        subject_id: str
    ) -> Dict[str, Any]:
        """
        Get status/metadata about cached graphs for a subject

        Returns information about what graph versions are cached.

        Args:
            subject_id: Subject identifier

        Returns:
            {
                "subject_id": str,
                "cached_versions": [...],
                "has_published": bool,
                "has_draft": bool,
                "total_cached": int
            }
        """
        try:
            query = self.curriculum_graphs.where('subject_id', '==', subject_id)
            docs = list(query.stream())

            cached_versions = []
            for doc in docs:
                doc_data = doc.to_dict()
                cached_versions.append({
                    "version_type": doc_data.get("version_type"),
                    "version_id": doc_data.get("version_id"),
                    "generated_at": doc_data.get("generated_at"),
                    "last_accessed": doc_data.get("last_accessed"),
                    "metadata": doc_data.get("metadata", {})
                })

            # Sort by generated_at descending
            cached_versions.sort(key=lambda x: x.get("generated_at", ""), reverse=True)

            status = {
                "subject_id": subject_id,
                "cached_versions": cached_versions,
                "has_published": any(v["version_type"] == "published" for v in cached_versions),
                "has_draft": any(v["version_type"] == "draft" for v in cached_versions),
                "total_cached": len(cached_versions)
            }

            return status

        except Exception as e:
            logger.error(f"Error getting curriculum graph status: {str(e)}")
            raise

    # ============================================================================
    # CURRICULUM PUBLISHED METHODS (READ-ONLY)
    # ============================================================================

    async def get_published_curriculum(
        self,
        subject_id: str,
        grade: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get published curriculum document for a subject.

        Reads from curriculum_published/{grade}/subjects/{subject_id}.
        If grade is provided, does a direct O(1) lookup (tries both
        short-code and long-form keys, e.g. 'K' and 'Kindergarten').
        Otherwise searches across all grades.

        Returns:
            Full curriculum document with hierarchy, subskill_index, and stats,
            or None if not deployed yet.
        """
        # Grade alias map for Firestore doc key lookup
        _GRADE_ALIASES = {
            "K": "Kindergarten", "Kindergarten": "K",
            "PK": "Pre-K", "Pre-K": "PK",
            **{str(i): f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade"
               for i in range(1, 13)},
            **{f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade": str(i)
               for i in range(1, 13)},
        }

        try:
            if grade:
                # Try the grade key as-is first, then its alias
                for key in [grade, _GRADE_ALIASES.get(grade)]:
                    if not key:
                        continue
                    doc_ref = self.client.collection('curriculum_published').document(key).collection('subjects').document(subject_id)
                    doc = doc_ref.get()
                    if doc.exists:
                        return doc.to_dict()
                return None

            # Search across all grades
            for grade_doc in self.client.collection('curriculum_published').stream():
                doc_ref = grade_doc.reference.collection('subjects').document(subject_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting published curriculum for {subject_id}: {str(e)}")
            return None

    async def get_all_published_subjects(self, grade: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all subjects that have published curriculum in Firestore.

        If grade is provided, returns only subjects for that grade (O(1) subcollection read).
        Otherwise returns all subjects across all grades.

        Returns:
            List of dicts with subject_id, subject_name, and grade for each deployed subject.
        """
        try:
            subjects = []

            if grade:
                # O(1) grade-scoped lookup
                docs = self.client.collection('curriculum_published').document(grade).collection('subjects').stream()
                for doc in docs:
                    doc_data = doc.to_dict()
                    subjects.append({
                        "subject_id": doc.id,
                        "subject_name": doc_data.get("subject_name", doc.id),
                        "grade": doc_data.get("grade", grade),
                    })
            else:
                # All subjects across all grades
                for grade_doc in self.client.collection('curriculum_published').stream():
                    grade_id = grade_doc.id
                    grade_subjects = grade_doc.reference.collection('subjects').stream()
                    for doc in grade_subjects:
                        doc_data = doc.to_dict()
                        subjects.append({
                            "subject_id": doc.id,
                            "subject_name": doc_data.get("subject_name", doc.id),
                            "grade": doc_data.get("grade", grade_id),
                        })

            return subjects

        except Exception as e:
            logger.error(f"Error listing published subjects: {str(e)}")
            return []

    # ============================================================================
    # BATCH OPERATIONS FOR MIGRATION
    # ============================================================================

    async def batch_write_attempts(self, attempts: List[Dict[str, Any]]) -> bool:
        """Batch write attempts to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for attempt in attempts:
                student_id = attempt['student_id']
                student_ids_seen.add(student_id)

                attempt_data = self._add_migration_metadata(attempt)
                firestore_data = self._prepare_firestore_data(attempt_data)

                doc_ref = self._attempts_subcollection(student_id).document(attempt['id'])
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(attempts)} attempts to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write attempts: {str(e)}")
            return False

    async def batch_write_reviews(self, reviews: List[Dict[str, Any]]) -> bool:
        """Batch write reviews to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for review in reviews:
                student_id = review['student_id']
                student_ids_seen.add(student_id)

                review_data = self._add_migration_metadata(review)
                firestore_data = self._prepare_firestore_data(review_data)

                doc_ref = self._reviews_subcollection(student_id).document(review['id'])
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(reviews)} reviews to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write reviews: {str(e)}")
            return False

    async def batch_write_competencies(self, competencies: List[Dict[str, Any]]) -> bool:
        """Batch write competencies to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for competency in competencies:
                student_id = competency['student_id']
                student_ids_seen.add(student_id)

                competency_data = self._add_migration_metadata(competency)
                firestore_data = self._prepare_firestore_data(competency_data)

                # Use subcollection doc ID without student_id prefix
                subject = competency.get('subject', '')
                skill_id = competency.get('skill_id', '')
                subskill_id = competency.get('subskill_id', '')
                doc_id = f"{subject}_{skill_id}_{subskill_id}"

                doc_ref = self._competencies_subcollection(student_id).document(doc_id)
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(competencies)} competencies to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write competencies: {str(e)}")
            return False

    # ============================================================================
    # LEARNING PATHS METHODS (per-student unlock state)
    # ============================================================================

    async def save_learning_path(
        self,
        student_id: int,
        subject_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Save computed learning path (unlock state) for a student+subject.

        Stored at: students/{student_id}/learning_paths/{subject_id}
        """
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            path_data = {
                "subject_id": subject_id,
                "unlocked_entities": data.get("unlocked_entities", []),
                "entity_statuses": data.get("entity_statuses", {}),
                "last_computed": timestamp,
                "version_id": data.get("version_id"),
            }

            await self._ensure_student_document(student_id)
            doc_ref = self._learning_paths_subcollection(student_id).document(subject_id)
            doc_ref.set(path_data)

            logger.info(f"Saved learning path for student {student_id}, subject {subject_id}")
            return path_data

        except Exception as e:
            logger.error(f"Error saving learning path: {str(e)}")
            raise

    async def get_learning_path(
        self,
        student_id: int,
        subject_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached learning path (unlock state) for a student+subject.

        Returns None if not yet computed.
        """
        try:
            doc_ref = self._learning_paths_subcollection(student_id).document(subject_id)
            doc = doc_ref.get()

            if doc.exists:
                return doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting learning path: {str(e)}")
            return None

    async def get_student_proficiency_map(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Build a proficiency map from the competencies subcollection.

        Replaces BigQuery get_student_proficiency_map for real-time lookups.

        Returns:
            {
                "SUBSKILL-123": {
                    "proficiency": 0.85,
                    "attempt_count": 10,
                    "last_updated": "2026-02-27T..."
                }
            }
        """
        try:
            query = self._competencies_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)

            docs = query.stream()
            prof_map = {}

            for doc in docs:
                data = doc.to_dict()
                entity_id = data.get("subskill_id")
                if not entity_id:
                    continue

                # current_score is already normalized 0-10 from competency service
                # Convert to 0.0-1.0 scale for learning paths
                raw_score = float(data.get("current_score", 0))
                proficiency = raw_score / 10.0 if raw_score > 1.0 else raw_score

                prof_map[entity_id] = {
                    "proficiency": proficiency,
                    "attempt_count": int(data.get("total_attempts", 0)),
                    "last_updated": data.get("last_updated"),
                }

            logger.info(f"Built proficiency map with {len(prof_map)} entries for student {student_id}")
            return prof_map

        except Exception as e:
            logger.error(f"Error building proficiency map: {str(e)}")
            return {}

    # ============================================================================
    # MASTERY LIFECYCLE METHODS (4-gate mastery model — PRD Sections 3, 6.2)
    # ============================================================================

    def _mastery_lifecycle_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/mastery_lifecycle"""
        return self._student_doc(student_id).collection('mastery_lifecycle')

    async def get_mastery_lifecycle(
        self,
        student_id: int,
        subskill_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single subskill's mastery lifecycle document.

        Resolves through curriculum lineage: tries canonical ID first,
        falls back to original ID with lazy migration trigger.
        """
        try:
            canonical = await self._resolver.resolve(subskill_id)
            collection = self._mastery_lifecycle_subcollection(student_id)

            doc = collection.document(canonical).get()
            if doc.exists:
                return doc.to_dict()

            # Fallback: try original ID if different
            if canonical != subskill_id:
                old_doc = collection.document(subskill_id).get()
                if old_doc.exists:
                    return old_doc.to_dict()

            return None
        except Exception as e:
            logger.error(f"Error getting mastery lifecycle for {subskill_id}: {e}")
            return None

    async def get_mastery_lifecycles_batch(
        self,
        student_id: int,
        subskill_ids: List[str],
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """Batch-read multiple mastery lifecycle docs in a single Firestore call.

        Resolves all IDs through lineage. Returns results keyed by the
        ORIGINAL input IDs so callers don't need to know about resolution.
        """
        if not subskill_ids:
            return {}
        try:
            resolved = await self._resolver.resolve_batch(subskill_ids)
            collection = self._mastery_lifecycle_subcollection(student_id)

            # Build refs for canonical IDs
            canonical_ids = list(set(resolved.values()))
            doc_refs = [collection.document(cid) for cid in canonical_ids]
            docs = self.client.get_all(doc_refs)
            canonical_data: Dict[str, Optional[Dict[str, Any]]] = {}
            for doc in docs:
                canonical_data[doc.id] = doc.to_dict() if doc.exists else None

            # Map back to original input IDs
            result: Dict[str, Optional[Dict[str, Any]]] = {}
            for sid in subskill_ids:
                cid = resolved[sid]
                result[sid] = canonical_data.get(cid)

            # Fallback: for any None result where original != canonical, try original
            for sid in subskill_ids:
                if result[sid] is None and resolved[sid] != sid:
                    old_doc = collection.document(sid).get()
                    if old_doc.exists:
                        result[sid] = old_doc.to_dict()

            return result
        except Exception as e:
            logger.error(f"Error batch-reading mastery lifecycles: {e}")
            return {sid: None for sid in subskill_ids}

    async def upsert_mastery_lifecycle(
        self,
        student_id: int,
        subskill_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update a subskill's mastery lifecycle document.

        Always writes to the canonical (resolved) subskill_id.
        """
        try:
            canonical = await self._resolver.resolve(subskill_id)
            await self._ensure_student_document(student_id)

            # Update the subskill_id field in data to canonical
            if canonical != subskill_id:
                data = {**data, "subskill_id": canonical}

            doc_ref = self._mastery_lifecycle_subcollection(student_id).document(canonical)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted mastery_lifecycle/{canonical} for student {student_id}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting mastery lifecycle: {e}")
            raise

    async def get_mastery_retests_due(
        self,
        student_id: int,
        before_date: str
    ) -> List[Dict[str, Any]]:
        """Get subskills whose mastery retest is due (next_retest_eligible <= before_date).

        Firestore compound queries with range filters on multiple fields require
        composite indexes.  We filter on next_retest_eligible in-query (single
        range filter) and apply the gate filter client-side to avoid index issues.
        """
        try:
            query = (
                self._mastery_lifecycle_subcollection(student_id)
                .where('next_retest_eligible', '<=', before_date)
            )
            results = []
            for doc in query.stream():
                data = doc.to_dict()
                gate = data.get('current_gate', 0)
                if 1 <= gate < 4:
                    results.append(data)
            return results
        except Exception as e:
            logger.error(f"Error getting mastery retests due: {e}")
            return []

    async def get_all_mastery_lifecycles(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all mastery lifecycle docs for a student, optionally filtered by subject."""
        try:
            query = self._mastery_lifecycle_subcollection(student_id)
            if subject:
                query = query.where('subject', '==', subject)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting mastery lifecycles for student {student_id}: {e}")
            return []

    async def update_global_practice_pass_rate(
        self,
        student_id: int,
        passes: int,
        fails: int
    ) -> None:
        """Update the student-level global practice pass rate (PRD 6.4)."""
        try:
            await self._ensure_student_document(student_id)
            total = passes + fails
            pass_rate = passes / total if total > 0 else 0.0
            self._student_doc(student_id).set({
                "global_practice_passes": passes,
                "global_practice_fails": fails,
                "global_practice_pass_rate": round(pass_rate, 4),
            }, merge=True)
            logger.info(
                f"Updated global practice pass rate for student {student_id}: "
                f"{passes}/{total} = {pass_rate:.4f}"
            )
        except Exception as e:
            logger.error(f"Error updating global practice pass rate: {e}")
            raise

    async def get_global_practice_pass_rate(
        self,
        student_id: int
    ) -> Dict[str, Any]:
        """Get the student-level global practice pass rate (PRD 6.4)."""
        try:
            doc = self._student_doc(student_id).get()
            if not doc.exists:
                return {
                    "global_practice_passes": 0,
                    "global_practice_fails": 0,
                    "global_practice_pass_rate": 0.8,  # default prior
                }
            data = doc.to_dict()
            return {
                "global_practice_passes": data.get("global_practice_passes", 0),
                "global_practice_fails": data.get("global_practice_fails", 0),
                "global_practice_pass_rate": data.get("global_practice_pass_rate", 0.8),
            }
        except Exception as e:
            logger.error(f"Error getting global practice pass rate: {e}")
            return {
                "global_practice_passes": 0,
                "global_practice_fails": 0,
                "global_practice_pass_rate": 0.8,
            }

    async def batch_write_mastery_lifecycles(
        self,
        student_id: int,
        lifecycles: List[Dict[str, Any]],
    ) -> bool:
        """Batch write mastery lifecycle documents for a student.

        Used by diagnostic seeding to write many lifecycle docs at once.
        Chunks at 400 per batch (Firestore limit is 500).
        """
        try:
            await self._ensure_student_document(student_id)
            subcol = self._mastery_lifecycle_subcollection(student_id)

            for i in range(0, len(lifecycles), 400):
                chunk = lifecycles[i:i + 400]
                batch = self.client.batch()
                for lc in chunk:
                    subskill_id = lc.get("subskill_id", "")
                    if not subskill_id:
                        continue
                    doc_ref = subcol.document(subskill_id)
                    firestore_data = self._prepare_firestore_data(lc)
                    batch.set(doc_ref, firestore_data, merge=True)
                batch.commit()

            logger.info(
                f"Batch wrote {len(lifecycles)} mastery lifecycles "
                f"for student {student_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Error in batch write mastery lifecycles: {e}")
            return False

    # ============================================================================
    # ITEM CALIBRATION & STUDENT ABILITY (IRT Difficulty Calibration PRD §5–6)
    # ============================================================================

    def _item_calibration_collection(self):
        """Get reference to item_calibration/ (top-level, shared across students)."""
        return self.client.collection('item_calibration')

    def _ability_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/ability"""
        return self._student_doc(student_id).collection('ability')

    async def get_item_calibration(
        self, item_key: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single item calibration document."""
        try:
            doc_ref = self._item_calibration_collection().document(item_key)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting item calibration for {item_key}: {e}")
            return None

    async def upsert_item_calibration(
        self, item_key: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update an item calibration document."""
        try:
            doc_ref = self._item_calibration_collection().document(item_key)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted item_calibration/{item_key}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting item calibration: {e}")
            raise

    async def get_all_item_calibrations(
        self, primitive_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all item calibration docs, optionally filtered by primitive_type."""
        try:
            query = self._item_calibration_collection()
            if primitive_type:
                query = query.where('primitive_type', '==', primitive_type)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting item calibrations: {e}")
            return []

    async def get_student_ability(
        self, student_id: int, skill_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single student ability document. Resolves through lineage."""
        try:
            canonical = await self._resolver.resolve_skill(skill_id)
            doc_ref = self._ability_subcollection(student_id).document(canonical)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()

            # Fallback to original ID
            if canonical != skill_id:
                old_doc = self._ability_subcollection(student_id).document(skill_id).get()
                if old_doc.exists:
                    return old_doc.to_dict()

            return None
        except Exception as e:
            logger.error(f"Error getting student ability for {skill_id}: {e}")
            return None

    async def upsert_student_ability(
        self, student_id: int, skill_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update a student ability document.

        Resolves through lineage before writing — the reader (get_student_ability)
        resolves canonical first, so writing the raw id after a curriculum remap
        would keep feeding an orphaned old-id doc that reads only reach via
        fallback.
        """
        try:
            canonical = await self._resolver.resolve_skill(skill_id)
            if canonical != skill_id:
                skill_id = canonical
                data = {**data, "skill_id": canonical}
            await self._ensure_student_document(student_id)
            doc_ref = self._ability_subcollection(student_id).document(skill_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted ability/{skill_id} for student {student_id}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting student ability: {e}")
            raise

    async def batch_write_student_abilities(
        self,
        student_id: int,
        abilities: List[Dict[str, Any]],
    ) -> bool:
        """Batch-write multiple student ability docs in a single Firestore commit."""
        if not abilities:
            return True
        try:
            await self._ensure_student_document(student_id)
            batch = self.client.batch()
            collection = self._ability_subcollection(student_id)
            for ab in abilities:
                skill_id = ab.get("skill_id", "")
                if not skill_id:
                    continue
                # Same lineage resolution as upsert_student_ability
                canonical = await self._resolver.resolve_skill(skill_id)
                if canonical != skill_id:
                    skill_id = canonical
                    ab = {**ab, "skill_id": canonical}
                doc_ref = collection.document(skill_id)
                batch.set(doc_ref, self._prepare_firestore_data(ab), merge=True)
            batch.commit()
            logger.info(f"Batch-wrote {len(abilities)} ability docs for student {student_id}")
            return True
        except Exception as e:
            logger.error(f"Error in batch write student abilities: {e}")
            return False

    async def get_all_student_abilities(
        self, student_id: int
    ) -> List[Dict[str, Any]]:
        """Get all ability documents for a student."""
        try:
            return [
                doc.to_dict()
                for doc in self._ability_subcollection(student_id).stream()
            ]
        except Exception as e:
            logger.error(f"Error getting student abilities: {e}")
            return []

    # ============================================================================
    # STUDENT PLANNING FIELDS (capacity, development patterns, aggregate metrics)
    # ============================================================================

    async def get_student_planning_fields(
        self,
        student_id: int
    ) -> Dict[str, Any]:
        """Get planning-specific fields from the student document."""
        try:
            doc = self._student_doc(student_id).get()
            if not doc.exists:
                return {}
            data = doc.to_dict()
            fields = {
                "daily_session_capacity": data.get("daily_session_capacity", 25),
                "development_patterns": data.get("development_patterns", {}),
                "aggregate_metrics": data.get("aggregate_metrics", {}),
                # Planning-side grade of record (see set_student_grade_level).
                # Without it every bare-subject graph fetch falls into the
                # first-doc-wins scan and hands K students the Grade 1 graph.
                "grade_level": data.get("grade_level"),
                # Cross-grade progression: per-subject grade overrides
                # ({"MATHEMATICS": "1"}) let one subject advance past the
                # grade of record; promotion_ready records exhausted
                # frontiers awaiting approval (or auto-apply).
                "subject_grade_overrides": data.get("subject_grade_overrides", {}),
                "promotion_ready": data.get("promotion_ready", {}),
            }
            # Only surface when actually set — callers use .get(key, DEFAULT)
            # and a present-but-None key would shadow their default.
            if data.get("daily_budget_minutes") is not None:
                fields["daily_budget_minutes"] = data["daily_budget_minutes"]
            return fields
        except Exception as e:
            logger.error(f"Error getting planning fields for student {student_id}: {e}")
            return {}

    async def set_student_grade_level(
        self, student_id: int, grade_level: str
    ) -> bool:
        """
        Set the planning-side grade of record on the student document.

        The user-facing grade lives on the Cosmos user profile (keyed by the
        CALLER's firebase_uid), which backend services can't reach from a
        bare student_id — this Firestore field is the copy the planner,
        selector, and forecast read. Written through from profile updates
        (user_profiles.py) and settable via scripts/set_student_grade.py.
        """
        try:
            await self._ensure_student_document(student_id)
            self._student_doc(student_id).set(
                {"grade_level": grade_level}, merge=True
            )
            logger.info(f"Set grade_level={grade_level!r} on student {student_id}")
            return True
        except Exception as e:
            logger.error(f"Error setting grade_level for student {student_id}: {e}")
            return False

    async def update_student_planning_fields(
        self,
        student_id: int,
        data: Dict[str, Any]
    ) -> None:
        """Merge planning-specific fields onto the student document."""
        try:
            await self._ensure_student_document(student_id)
            firestore_data = self._prepare_firestore_data(data)
            self._student_doc(student_id).set(firestore_data, merge=True)
            logger.info(f"Updated planning fields for student {student_id}")
        except Exception as e:
            logger.error(f"Error updating planning fields for student {student_id}: {e}")
            raise

    # ============================================================================
    # DAILY SESSION PLANS (structured lesson-block plans — one doc per day)
    #
    # students/{student_id}/dailySessionPlans/{YYYY-MM-DD}
    # A plan is generated once per day and re-read on every visit so the
    # student sees the same blocks (and their completion state) all day.
    # ============================================================================

    def _session_plan_doc(self, student_id: int, plan_date: str):
        return (
            self._student_doc(student_id)
            .collection("dailySessionPlans")
            .document(plan_date)
        )

    async def get_daily_session_plan_doc(
        self,
        student_id: int,
        plan_date: str,
    ) -> Optional[Dict[str, Any]]:
        """Read the persisted session plan for one day, or None if not yet generated."""
        try:
            doc = self._session_plan_doc(student_id, plan_date).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error reading session plan {student_id}/{plan_date}: {e}")
            return None

    async def save_daily_session_plan_doc(
        self,
        student_id: int,
        plan_date: str,
        plan_data: Dict[str, Any],
    ) -> bool:
        """Persist the day's generated session plan (full overwrite on refresh)."""
        try:
            await self._ensure_student_document(student_id)
            data = self._prepare_firestore_data({
                **plan_data,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            self._session_plan_doc(student_id, plan_date).set(data)
            logger.info(f"Saved session plan for student {student_id} on {plan_date}")
            return True
        except Exception as e:
            logger.error(f"Error saving session plan {student_id}/{plan_date}: {e}")
            return False

    async def add_completed_session_block(
        self,
        student_id: int,
        plan_date: str,
        block_id: str,
    ) -> bool:
        """
        Record a finished block on the day's plan (idempotent via ArrayUnion).

        Also stamps the block's completed_at on the time ledger — actual
        block duration is completed_at minus the last recorded start.
        """
        try:
            self._session_plan_doc(student_id, plan_date).set(
                {
                    "completed_block_ids": firestore.ArrayUnion([block_id]),
                    "block_times": {
                        block_id: {
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                },
                merge=True,
            )
            return True
        except Exception as e:
            logger.error(
                f"Error marking block {block_id} complete for {student_id}/{plan_date}: {e}"
            )
            return False

    async def mark_session_block_started(
        self,
        student_id: int,
        plan_date: str,
        block_id: str,
    ) -> bool:
        """
        Append a start timestamp to the block's time ledger.

        Append-only on purpose: a student who abandons and re-launches a block
        adds another entry, so the ledger distinguishes first exposure from
        the run that actually finished. No read-modify-write — ArrayUnion in
        a merge keeps concurrent stamps composable.
        """
        try:
            self._session_plan_doc(student_id, plan_date).set(
                {
                    "block_times": {
                        block_id: {
                            "starts": firestore.ArrayUnion(
                                [datetime.now(timezone.utc).isoformat()]
                            ),
                        }
                    },
                },
                merge=True,
            )
            return True
        except Exception as e:
            logger.error(
                f"Error marking block {block_id} started for {student_id}/{plan_date}: {e}"
            )
            return False

    # ============================================================================
    # FORECAST DOCS (materialized daily — students/{id}/forecasts/{date})
    # ============================================================================

    def _forecast_doc(self, student_id: int, forecast_date: str):
        return (
            self._student_doc(student_id)
            .collection("forecasts")
            .document(forecast_date)
        )

    async def get_forecast_doc(
        self, student_id: int, forecast_date: str
    ) -> Optional[Dict[str, Any]]:
        """Read the materialized forecast for one day, or None."""
        try:
            doc = self._forecast_doc(student_id, forecast_date).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error reading forecast {student_id}/{forecast_date}: {e}")
            return None

    async def save_forecast_doc(
        self, student_id: int, forecast_date: str, data: Dict[str, Any]
    ) -> bool:
        """Persist the day's forecast (full overwrite on refresh)."""
        try:
            await self._ensure_student_document(student_id)
            self._forecast_doc(student_id, forecast_date).set(
                self._prepare_firestore_data(data)
            )
            logger.info(f"Saved forecast for student {student_id} on {forecast_date}")
            return True
        except Exception as e:
            logger.error(f"Error saving forecast {student_id}/{forecast_date}: {e}")
            return False

    async def get_latest_forecast_doc_before(
        self, student_id: int, forecast_date: str
    ) -> Optional[Dict[str, Any]]:
        """Most recent forecast strictly before the given date (for drift)."""
        try:
            docs = (
                self._student_doc(student_id)
                .collection("forecasts")
                .where("date", "<", forecast_date)
                .order_by("date", direction=firestore.Query.DESCENDING)
                .limit(1)
                .get()
            )
            for doc in docs:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error reading prior forecast for {student_id}: {e}")
            return None

    # ============================================================================
    # SCHOOL YEAR CONFIG
    # ============================================================================

    async def get_school_year_config(self) -> Optional[Dict[str, Any]]:
        """Get school year configuration from config/schoolYear."""
        try:
            doc = self.client.collection('config').document('schoolYear').get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting school year config: {e}")
            return None

    async def set_school_year_config(self, data: Dict[str, Any]) -> None:
        """Set school year configuration at config/schoolYear."""
        try:
            firestore_data = self._prepare_firestore_data(data)
            self.client.collection('config').document('schoolYear').set(firestore_data)
            logger.info("School year config saved to Firestore")
        except Exception as e:
            logger.error(f"Error setting school year config: {e}")
            raise

    # ============================================================================
    # VELOCITY HISTORY (PRD Section 15.10)
    # ============================================================================

    async def get_velocity_history(
        self,
        student_id: int,
        limit: int = 9,
    ) -> List[Dict[str, Any]]:
        """
        Get recent weekly velocity snapshots for trend display.

        Reads from students/{studentId}/velocityHistory, ordered by weekOf
        descending, limited to the most recent `limit` entries.
        Returns oldest-first for sparkline rendering.
        """
        try:
            query = (
                self._student_doc(student_id)
                .collection("velocityHistory")
                .order_by("weekOf", direction="DESCENDING")
                .limit(limit)
            )
            docs = [doc.to_dict() for doc in query.stream()]
            docs.reverse()  # oldest first for trend display
            return docs
        except Exception as e:
            logger.error(f"Error getting velocity history for student {student_id}: {e}")
            return []

    async def save_velocity_snapshot(
        self,
        student_id: int,
        week_id: str,
        data: Dict[str, Any],
    ) -> None:
        """
        Write a weekly velocity snapshot.

        Stored at students/{studentId}/velocityHistory/{weekId}
        where weekId is the Monday date (YYYY-MM-DD).
        """
        try:
            await self._ensure_student_document(student_id)
            firestore_data = self._prepare_firestore_data(data)
            (
                self._student_doc(student_id)
                .collection("velocityHistory")
                .document(week_id)
                .set(firestore_data, merge=True)
            )
            logger.info(f"Saved velocity snapshot {week_id} for student {student_id}")
        except Exception as e:
            logger.error(f"Error saving velocity snapshot for student {student_id}: {e}")
            raise

    # ============================================================================
    # PULSE SESSION METHODS (Adaptive Learning Loop — Lumina Pulse PRD)
    # ============================================================================

    async def save_pulse_session(
        self,
        session_id: str,
        data: Dict[str, Any],
    ) -> None:
        """Save or update a Pulse session document."""
        try:
            doc_ref = self.client.collection('pulse_sessions').document(session_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Saved pulse session {session_id}")
        except Exception as e:
            logger.error(f"Error saving pulse session {session_id}: {e}")
            raise

    async def get_pulse_session(
        self,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a Pulse session by ID."""
        try:
            doc_ref = self.client.collection('pulse_sessions').document(session_id)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting pulse session {session_id}: {e}")
            return None

    async def get_student_pulse_sessions(
        self,
        student_id: int,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get all Pulse sessions for a student, optionally filtered by status."""
        try:
            query = (
                self.client.collection('pulse_sessions')
                .where('student_id', '==', student_id)
            )
            if status:
                query = query.where('status', '==', status)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting pulse sessions for student {student_id}: {e}")
            return []

    # ============================================================================
    # PULSE PRIMITIVE HISTORY (rolling window of recently-served primitives)
    # ============================================================================

    async def get_pulse_primitive_history(
        self,
        student_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get the primitive history doc for a student."""
        try:
            doc_ref = (
                self.client.collection('students')
                .document(str(student_id))
                .collection('pulse_state')
                .document('primitive_history')
            )
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting pulse primitive history for student {student_id}: {e}")
            return None

    async def save_pulse_primitive_history(
        self,
        student_id: int,
        data: Dict[str, Any],
    ) -> None:
        """Save/update the primitive history doc for a student."""
        try:
            doc_ref = (
                self.client.collection('students')
                .document(str(student_id))
                .collection('pulse_state')
                .document('primitive_history')
            )
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
        except Exception as e:
            logger.error(f"Error saving pulse primitive history for student {student_id}: {e}")
            raise

    # ============================================================================
    # MONITORING AND VALIDATION
    # ============================================================================

    async def validate_data_consistency(
        self,
        cosmos_data: Dict[str, Any],
        firestore_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate data consistency between CosmosDB and Firestore"""
        validation_result = {
            "consistent": True,
            "differences": [],
            "missing_fields": [],
            "validation_timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Check for missing fields in Firestore
        for key in cosmos_data.keys():
            if key not in firestore_data and key not in ['_rid', '_self', '_etag', '_attachments', '_ts']:
                validation_result["missing_fields"].append(key)
                validation_result["consistent"] = False

        # Check for value differences (excluding system fields)
        system_fields = ['_rid', '_self', '_etag', '_attachments', '_ts', 'migration_timestamp', 'firestore_created_at', 'source_system']

        for key, cosmos_value in cosmos_data.items():
            if key in system_fields:
                continue

            if key in firestore_data:
                firestore_value = firestore_data[key]
                if cosmos_value != firestore_value:
                    validation_result["differences"].append({
                        "field": key,
                        "cosmos_value": cosmos_value,
                        "firestore_value": firestore_value
                    })
                    validation_result["consistent"] = False

        return validation_result

    async def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about Firestore collections using collection group queries"""
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attempts_count": 0,
            "reviews_count": 0,
            "competencies_count": 0
        }

        try:
            # Use collection group queries for subcollections
            attempts_docs = self.client.collection_group('attempts').limit(1).stream()
            stats["attempts_count"] = len(list(attempts_docs))

            reviews_docs = self.client.collection_group('reviews').limit(1).stream()
            stats["reviews_count"] = len(list(reviews_docs))

            competencies_docs = self.client.collection_group('competencies').limit(1).stream()
            stats["competencies_count"] = len(list(competencies_docs))

        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            stats["error"] = str(e)

        return stats
