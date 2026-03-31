# backend/app/services/firestore_analytics.py
#
# Real-time analytics service backed exclusively by Firestore.
# Replaces BigQueryAnalyticsService for student-facing analytics endpoints.

import asyncio
import logging
import math
from collections import defaultdict
from datetime import datetime, date, timedelta, timezone
from typing import Dict, List, Any, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Avoid circular imports — use TYPE_CHECKING for type hints only
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.db.firestore_service import FirestoreService
    from app.services.curriculum_service import CurriculumService
    from app.services.learning_paths import LearningPathsService


class FirestoreAnalyticsService:
    """
    Analytics service reading exclusively from Firestore subcollections.

    Replaces BigQueryAnalyticsService for 8 student-facing endpoints.
    All data comes from:
        students/{id}/attempts, reviews, competencies, mastery_lifecycle
        curriculum_published (via CurriculumService, cached)
        config/schoolYear
    """

    def __init__(
        self,
        firestore_service: 'FirestoreService',
        curriculum_service: 'CurriculumService',
        learning_paths_service: Optional['LearningPathsService'] = None,
    ):
        self.fs = firestore_service
        self.curriculum = curriculum_service
        self.learning_paths = learning_paths_service

        # Response cache — 2-minute TTL (data is live, cache absorbs rapid re-requests)
        self._cache: Dict[str, Tuple[datetime, Any]] = {}
        self._cache_ttl = timedelta(minutes=2)

    # ========================================================================
    # CACHE HELPERS
    # ========================================================================

    def _cache_key(self, method: str, **kwargs) -> str:
        sorted_params = sorted(
            (k, str(v)) for k, v in kwargs.items() if v is not None
        )
        param_str = "_".join(f"{k}={v}" for k, v in sorted_params)
        return f"{method}_{param_str}"

    def _cache_get(self, key: str) -> Any:
        if key in self._cache:
            ts, data = self._cache[key]
            if datetime.now(timezone.utc) - ts < self._cache_ttl:
                return data
            del self._cache[key]
        return None

    def _cache_set(self, key: str, data: Any):
        self._cache[key] = (datetime.now(timezone.utc), data)

    def clear_cache(self):
        self._cache.clear()

    # ========================================================================
    # SHARED DATA LOADERS
    # ========================================================================

    async def _load_competency_map(
        self, student_id: int, subject: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Load all competency docs into a {subskill_id: metrics} dict.

        Resolves old subskill_ids through curriculum lineage so that
        analytics dashboards show continuous history across renames.
        """
        from app.services.subskill_id_resolver import subskill_id_resolver

        docs = await self.fs.get_all_competencies(student_id, subject)
        result = {}
        for d in docs:
            sid = d.get("subskill_id")
            if not sid:
                continue
            # Resolve to canonical ID
            canonical = await subskill_id_resolver.resolve(sid)
            raw_score = float(d.get("current_score", 0))
            total_attempts = int(d.get("total_attempts", 0))
            credibility = float(d.get("credibility", 0))
            proficiency = raw_score / 10.0 if raw_score > 1.0 else raw_score
            mastery = proficiency * credibility
            entry = {
                "current_score": raw_score,
                "proficiency": proficiency,
                "credibility": credibility,
                "total_attempts": total_attempts,
                "mastery": mastery,
                "last_updated": d.get("last_updated"),
                "subject": d.get("subject"),
                "skill_id": d.get("skill_id"),
            }
            # If canonical already exists, merge (take higher score)
            if canonical in result and canonical != sid:
                existing = result[canonical]
                if entry["current_score"] > existing["current_score"]:
                    result[canonical] = entry
            else:
                result[canonical] = entry
        return result

    async def _load_lifecycle_map(
        self, student_id: int, subject: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Load mastery lifecycle docs into a {subskill_id: lifecycle_data} dict.

        Resolves old subskill_ids through curriculum lineage.
        """
        from app.services.subskill_id_resolver import subskill_id_resolver

        docs = await self.fs.get_all_mastery_lifecycles(student_id, subject)
        result = {}
        for d in docs:
            sid = d.get("subskill_id")
            if not sid:
                continue
            canonical = await subskill_id_resolver.resolve(sid)
            # If canonical already exists (merge scenario), keep higher gate
            if canonical in result and canonical != sid:
                existing_gate = result[canonical].get("current_gate", 0)
                new_gate = d.get("current_gate", 0)
                if new_gate > existing_gate:
                    result[canonical] = d
            else:
                result[canonical] = d
        return result

    async def _load_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Load attempts with optional date range filter."""
        return await self.fs.get_student_attempts_date_range(
            student_id, subject, start_date, end_date, limit
        )

    async def _load_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Load reviews with optional date range filter."""
        return await self.fs.get_problem_reviews_date_range(
            student_id, subject, start_date, end_date, limit
        )

    async def _build_curriculum_hierarchy(
        self, subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build flat subskill lookup and structured hierarchy from CurriculumService.

        Returns:
            {
                "subskill_lookup": {subskill_id: {subject, unit_id, unit_title, skill_id, ...}},
                "hierarchy": {subject: [units...]},
                "total_subskills_by_subject": {subject: int},
            }
        """
        ck = self._cache_key("curriculum_hierarchy", subject=subject)
        cached = self._cache_get(ck)
        if cached:
            return cached

        subskill_lookup: Dict[str, Dict[str, Any]] = {}
        hierarchy: Dict[str, List[Dict]] = {}
        totals: Dict[str, int] = {}

        if subject:
            subjects_to_load = [subject]
        else:
            all_subj = await self.curriculum.get_available_subjects()
            subjects_to_load = [
                s.get("subject_id") or s.get("subject_name") or s
                for s in all_subj
            ]

        for subj in subjects_to_load:
            units = await self.curriculum.get_curriculum(subj)
            hierarchy[subj] = units
            count = 0
            for unit in units:
                for skill in unit.get("skills", []):
                    for ss in skill.get("subskills", []):
                        count += 1
                        subskill_lookup[ss["id"]] = {
                            "subject": unit.get("subject", subj),
                            "unit_id": unit["id"],
                            "unit_title": unit["title"],
                            "skill_id": skill["id"],
                            "skill_description": skill["description"],
                            "subskill_id": ss["id"],
                            "subskill_description": ss["description"],
                            "difficulty_start": ss.get("difficulty_range", {}).get("start"),
                            "difficulty_end": ss.get("difficulty_range", {}).get("end"),
                            "target_difficulty": ss.get("difficulty_range", {}).get("target"),
                        }
            totals[subj] = count

        result = {
            "subskill_lookup": subskill_lookup,
            "hierarchy": hierarchy,
            "total_subskills_by_subject": totals,
        }
        self._cache_set(ck, result)
        return result

    def _enrich_subskill(
        self,
        subskill_meta: Dict[str, Any],
        comp_map: Dict[str, Dict],
        lifecycle_map: Dict[str, Dict],
        unlocked_set: Set[str],
    ) -> Dict[str, Any]:
        """Compute all derived analytics fields for a single subskill."""
        sid = subskill_meta["subskill_id"]
        comp = comp_map.get(sid, {})
        lc = lifecycle_map.get(sid, {})

        avg_score = comp.get("proficiency", 0.0)
        mastery = comp.get("mastery", 0.0)
        attempt_count = comp.get("total_attempts", 0)
        credibility = comp.get("credibility", 0.0)
        is_attempted = attempt_count > 0

        # Mastery lifecycle fields
        gate = lc.get("current_gate", 0)
        completion_pct = lc.get("completion_pct", 0.0)
        passes = lc.get("passes", 0)
        fails = lc.get("fails", 0)
        lesson_eval_count = lc.get("lesson_eval_count", 0)
        next_retest_eligible = lc.get("next_retest_eligible", None)
        estimated_remaining_attempts = lc.get("estimated_remaining_attempts", 0)

        # Readiness: unlocked in learning paths OR already progressing (gate > 0)
        is_ready = sid in unlocked_set or gate > 0
        readiness_status = "Ready" if is_ready else "Not Ready"

        # Priority thresholds matching BigQuery SQL
        if mastery >= 0.8:
            priority_level, priority_order = "Mastered", 4
        elif 0.4 <= mastery < 0.8:
            priority_level, priority_order = "High Priority", 1
        elif 0 < mastery < 0.4:
            priority_level, priority_order = "Medium Priority", 2
        elif mastery == 0 and is_attempted:
            priority_level, priority_order = "Not Started", 3
        else:
            priority_level, priority_order = "Not Assessed", 5

        return {
            "subskill_id": sid,
            "subskill_description": subskill_meta.get("subskill_description", ""),
            "mastery": round(mastery, 4),
            "avg_score": round(avg_score, 4),
            "proficiency": round(avg_score if is_ready else 0.0, 4),
            "completion": 100.0 if is_attempted else 0.0,
            "is_attempted": is_attempted,
            "readiness_status": readiness_status,
            "priority_level": priority_level,
            "priority_order": priority_order,
            "next_subskill": None,
            "recommended_next": None,
            "attempt_count": attempt_count,
            "individual_attempts": [],
            # Mastery lifecycle fields
            "current_gate": gate,
            "completion_pct": round(completion_pct, 4),
            "passes": passes,
            "fails": fails,
            "lesson_eval_count": lesson_eval_count,
            "next_retest_eligible": next_retest_eligible,
            "estimated_remaining_attempts": estimated_remaining_attempts,
        }

    # ========================================================================
    # UTILITY HELPERS
    # ========================================================================

    @staticmethod
    def _parse_timestamp(ts: Any) -> Optional[datetime]:
        """Parse an ISO timestamp string to datetime."""
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        try:
            s = str(ts).replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _group_by_interval(
        items: List[Dict], interval: str, ts_field: str = "timestamp"
    ) -> Dict[str, List[Dict]]:
        """Group items by date interval. Returns sorted dict {key: [items]}."""
        groups: Dict[str, List[Dict]] = defaultdict(list)
        for item in items:
            ts = FirestoreAnalyticsService._parse_timestamp(item.get(ts_field))
            if not ts:
                continue
            if interval == "day":
                key = ts.date().isoformat()
            elif interval == "week":
                iso = ts.isocalendar()
                key = f"{iso[0]}-W{iso[1]:02d}"
            elif interval == "month":
                key = f"{ts.year}-{ts.month:02d}"
            elif interval == "quarter":
                q = (ts.month - 1) // 3 + 1
                key = f"{ts.year}-Q{q}"
            elif interval == "year":
                key = str(ts.year)
            else:
                key = f"{ts.year}-{ts.month:02d}"
            groups[key].append(item)
        return dict(sorted(groups.items()))

    @staticmethod
    def _compute_streaks(daily_dates: List[date]) -> Tuple[int, int]:
        """Compute current and longest streak from active dates."""
        if not daily_dates:
            return 0, 0
        sorted_dates = sorted(set(daily_dates))
        today = date.today()
        current = 1 if sorted_dates[-1] >= today - timedelta(days=1) else 0
        longest = 1
        streak = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                streak += 1
                longest = max(longest, streak)
                if sorted_dates[i] >= today - timedelta(days=1):
                    current = streak
            else:
                streak = 1
        return current, longest

    # ========================================================================
    # PUBLIC ANALYTICS METHODS
    # ========================================================================

    async def health_check(self) -> Dict[str, Any]:
        """Check Firestore connectivity."""
        try:
            doc = self.fs.client.collection("config").document("schoolYear").get()
            return {
                "status": "healthy",
                "backend": "firestore",
                "cache_size": len(self._cache),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    # --------------------------------------------------------------------
    # VELOCITY METRICS
    # --------------------------------------------------------------------

    async def get_velocity_metrics(
        self, student_id: int, subject: Optional[str] = None
    ) -> List[Dict]:
        """Compute live velocity metrics from mastery lifecycle + curriculum."""
        ck = self._cache_key("velocity", student_id=student_id, subject=subject)
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            cur = await self._build_curriculum_hierarchy(subject)
            totals = cur["total_subskills_by_subject"]
            lifecycle_docs = await self.fs.get_all_mastery_lifecycles(student_id, subject)

            # Count closed (gate 4) per subject
            closed_by_subject: Dict[str, int] = defaultdict(int)
            last_updated_by_subject: Dict[str, Optional[str]] = {}
            for lc in lifecycle_docs:
                subj = lc.get("subject", "Unknown")
                if lc.get("current_gate", 0) >= 4:
                    closed_by_subject[subj] += 1
                lu = lc.get("last_updated") or lc.get("updated_at")
                if lu:
                    prev = last_updated_by_subject.get(subj)
                    if prev is None or str(lu) > str(prev):
                        last_updated_by_subject[subj] = lu

            # School year fraction elapsed
            school_cfg = await self.fs.get_school_year_config()
            now = datetime.now(timezone.utc)
            if school_cfg:
                start_str = school_cfg.get("startDate", "2025-08-25")
                end_str = school_cfg.get("endDate", "2026-05-29")
            else:
                start_str, end_str = "2025-08-25", "2026-05-29"
            try:
                year_start = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
                year_end = datetime.fromisoformat(end_str).replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                year_start = datetime(2025, 8, 25, tzinfo=timezone.utc)
                year_end = datetime(2026, 5, 29, tzinfo=timezone.utc)

            total_days = max((year_end - year_start).days, 1)
            elapsed_days = max(min((now - year_start).days, total_days), 0)
            fraction_elapsed = elapsed_days / total_days

            results = []
            subjects_to_report = [subject] if subject else list(totals.keys())
            for subj in subjects_to_report:
                total = totals.get(subj, 0)
                if total == 0:
                    continue
                actual = closed_by_subject.get(subj, 0)
                expected = round(fraction_elapsed * total, 2)
                velocity_pct = round((actual / expected) * 100, 2) if expected > 0 else 100.0
                daily_rate = total / total_days if total_days > 0 else 1
                days_diff = round((actual - expected) / daily_rate, 1) if daily_rate > 0 else 0

                if velocity_pct >= 120:
                    status = "Significantly Ahead"
                elif velocity_pct >= 100:
                    status = "On Track"
                elif velocity_pct >= 80:
                    status = "Slightly Behind"
                elif velocity_pct >= 60:
                    status = "Behind"
                else:
                    status = "Significantly Behind"

                lu = last_updated_by_subject.get(subj) or now.isoformat()
                results.append({
                    "student_id": student_id,
                    "student_name": "Student",
                    "subject": subj,
                    "actual_progress": actual,
                    "expected_progress": expected,
                    "total_subskills_in_subject": total,
                    "velocity_percentage": velocity_pct,
                    "days_ahead_behind": days_diff,
                    "velocity_status": status,
                    "last_updated": self._parse_timestamp(lu) or now,
                    "calculation_date": now,
                })

            self._cache_set(ck, results)
            return results

        except Exception as e:
            logger.error(f"Error computing velocity metrics: {e}")
            return []

    # --------------------------------------------------------------------
    # ENGAGEMENT METRICS
    # --------------------------------------------------------------------

    async def get_engagement_metrics(
        self,
        student_id: int,
        subject: Optional[str] = None,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Compute engagement metrics from recent attempts."""
        ck = self._cache_key("engagement", student_id=student_id, subject=subject, days=days)
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            attempts = await self._load_attempts(student_id, subject, start_date=cutoff)

            # Group by date
            daily: Dict[str, List[Dict]] = defaultdict(list)
            all_subskills: set = set()
            total_score = 0.0
            for a in attempts:
                ts = self._parse_timestamp(a.get("timestamp"))
                if ts:
                    daily[ts.date().isoformat()].append(a)
                all_subskills.add(a.get("subskill_id"))
                total_score += float(a.get("score", 0))

            active_dates = [date.fromisoformat(d) for d in daily.keys()]
            current_streak, longest_streak = self._compute_streaks(active_dates)
            total_attempts = len(attempts)
            total_active_days = len(daily)
            avg_daily = round(total_attempts / max(total_active_days, 1), 1)
            avg_score = round(total_score / max(total_attempts, 1), 2)

            daily_breakdown = []
            for d in sorted(daily.keys()):
                day_attempts = daily[d]
                day_subskills = set(a.get("subskill_id") for a in day_attempts)
                day_score = sum(float(a.get("score", 0)) for a in day_attempts)
                daily_breakdown.append({
                    "date": d,
                    "attempts": len(day_attempts),
                    "avg_score": round(day_score / max(len(day_attempts), 1), 2),
                    "distinct_subskills": len(day_subskills),
                })

            result = {
                "student_id": student_id,
                "subject_filter": subject,
                "days_analyzed": days,
                "summary": {
                    "total_active_days": total_active_days,
                    "total_attempts": total_attempts,
                    "avg_daily_attempts": avg_daily,
                    "distinct_subskills": len(all_subskills),
                    "avg_score": avg_score,
                    "streak_current": current_streak,
                    "streak_longest": longest_streak,
                },
                "daily_breakdown": daily_breakdown,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing engagement metrics: {e}")
            return {
                "student_id": student_id,
                "summary": {"total_active_days": 0},
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

    # --------------------------------------------------------------------
    # DETAILED RECENT ACTIVITY
    # --------------------------------------------------------------------

    async def get_detailed_recent_activity(
        self,
        student_id: int,
        hours: int = 24,
        subject: Optional[str] = None,
        include_reviews: bool = True,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get detailed recent activity with optional review context."""
        ck = self._cache_key(
            "recent_activity", student_id=student_id, hours=hours,
            subject=subject, include_reviews=include_reviews, limit=limit,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            attempts = await self._load_attempts(student_id, subject, start_date=cutoff, limit=limit)

            # Build review lookup if requested
            review_lookup: Dict[str, Dict] = {}
            if include_reviews and attempts:
                reviews = await self._load_reviews(student_id, subject, start_date=cutoff, limit=limit)
                for r in reviews:
                    key = f"{r.get('subskill_id')}_{r.get('timestamp', '')[:16]}"
                    review_lookup[key] = r

            # Curriculum metadata for enrichment
            cur = await self._build_curriculum_hierarchy(subject)
            lookup = cur["subskill_lookup"]

            activities = []
            for a in attempts:
                sid = a.get("subskill_id", "")
                meta = lookup.get(sid, {})
                ts_str = a.get("timestamp", "")

                activity = {
                    "type": "attempt",
                    "timestamp": ts_str,
                    "subject": a.get("subject", meta.get("subject", "")),
                    "skill_id": a.get("skill_id", meta.get("skill_id", "")),
                    "subskill_id": sid,
                    "subskill_description": meta.get("subskill_description", ""),
                    "unit_title": meta.get("unit_title", ""),
                    "skill_description": meta.get("skill_description", ""),
                    "score": a.get("score", 0),
                    "source": a.get("source", "practice"),
                }

                # Attach review if available
                review_key = f"{sid}_{ts_str[:16]}"
                review = review_lookup.get(review_key)
                if review:
                    activity["feedback"] = review.get("feedback", {})
                    activity["analysis"] = review.get("analysis", {})
                    activity["observation"] = review.get("observation", {})
                    activity["has_review"] = True
                else:
                    activity["feedback"] = a.get("feedback", "")
                    activity["analysis"] = a.get("analysis", "")
                    activity["has_review"] = False

                activities.append(activity)

            self._cache_set(ck, activities)
            return activities

        except Exception as e:
            logger.error(f"Error getting recent activity: {e}")
            return []

    # --------------------------------------------------------------------
    # HIERARCHICAL METRICS (core endpoint)
    # --------------------------------------------------------------------

    async def get_hierarchical_metrics(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Compute hierarchical metrics: units → skills → subskills with mastery/proficiency."""
        ck = self._cache_key(
            "hierarchical", student_id=student_id, subject=subject,
            start_date=start_date, end_date=end_date,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            comp_map = await self._load_competency_map(student_id, subject)
            lifecycle_map = await self._load_lifecycle_map(student_id, subject)
            cur = await self._build_curriculum_hierarchy(subject)
            hierarchy = cur["hierarchy"]

            # Get unlocked set for readiness
            unlocked: Set[str] = set()
            if self.learning_paths:
                try:
                    unlocked = await self.learning_paths.get_unlocked_entities(
                        student_id, subject=subject
                    )
                except Exception:
                    pass

            # Walk curriculum tree and enrich
            all_units = []
            total_items = 0
            attempted_items = 0
            ready_items = 0
            all_attempt_count = 0
            mastery_sum = 0.0
            proficiency_sum = 0.0
            score_sum = 0.0

            for subj_name, units in hierarchy.items():
                for unit in units:
                    unit_skills = []
                    unit_mastery_sum = 0.0
                    unit_proficiency_sum = 0.0
                    unit_score_sum = 0.0
                    unit_attempted_skills = 0
                    unit_attempt_count = 0

                    for skill in unit.get("skills", []):
                        skill_subskills = []
                        skill_mastery_sum = 0.0
                        skill_proficiency_sum = 0.0
                        skill_score_sum = 0.0
                        skill_attempted = 0
                        skill_attempt_count = 0

                        for ss in skill.get("subskills", []):
                            meta = {
                                "subskill_id": ss["id"],
                                "subskill_description": ss.get("description", ""),
                            }
                            enriched = self._enrich_subskill(meta, comp_map, lifecycle_map, unlocked)
                            skill_subskills.append(enriched)

                            total_items += 1
                            if enriched["is_attempted"]:
                                attempted_items += 1
                                skill_attempted += 1
                            if enriched["readiness_status"] == "Ready":
                                ready_items += 1
                            skill_mastery_sum += enriched["mastery"]
                            skill_proficiency_sum += enriched["proficiency"]
                            skill_score_sum += enriched["avg_score"]
                            skill_attempt_count += enriched["attempt_count"]

                        n_ss = max(len(skill_subskills), 1)
                        skill_entry = {
                            "skill_id": skill["id"],
                            "skill_description": skill.get("description", ""),
                            "mastery": round(skill_mastery_sum / n_ss, 4),
                            "proficiency": round(skill_proficiency_sum / n_ss, 4),
                            "avg_score": round(skill_score_sum / n_ss, 4),
                            "completion": round(skill_attempted / n_ss * 100, 2),
                            "attempted_subskills": skill_attempted,
                            "total_subskills": len(skill_subskills),
                            "attempt_count": skill_attempt_count,
                            "subskills": skill_subskills,
                        }
                        unit_skills.append(skill_entry)

                        if skill_attempted > 0:
                            unit_attempted_skills += 1
                        unit_mastery_sum += skill_entry["mastery"]
                        unit_proficiency_sum += skill_entry["proficiency"]
                        unit_score_sum += skill_entry["avg_score"]
                        unit_attempt_count += skill_attempt_count

                    n_sk = max(len(unit_skills), 1)
                    unit_entry = {
                        "unit_id": unit["id"],
                        "unit_title": unit.get("title", ""),
                        "mastery": round(unit_mastery_sum / n_sk, 4),
                        "proficiency": round(unit_proficiency_sum / n_sk, 4),
                        "avg_score": round(unit_score_sum / n_sk, 4),
                        "completion": round(unit_attempted_skills / n_sk * 100, 2),
                        "attempted_skills": unit_attempted_skills,
                        "total_skills": len(unit_skills),
                        "attempt_count": unit_attempt_count,
                        "skills": unit_skills,
                    }
                    all_units.append(unit_entry)

                    mastery_sum += unit_entry["mastery"]
                    proficiency_sum += unit_entry["proficiency"]
                    score_sum += unit_entry["avg_score"]
                    all_attempt_count += unit_attempt_count

            n_units = max(len(all_units), 1)
            recommended_items = max(total_items - attempted_items, 0)

            result = {
                "summary": {
                    "mastery": round(mastery_sum / n_units, 4),
                    "proficiency": round(proficiency_sum / n_units, 4),
                    "avg_score": round(score_sum / n_units, 4),
                    "completion": round(attempted_items / max(total_items, 1) * 100, 2),
                    "attempted_items": attempted_items,
                    "total_items": total_items,
                    "attempt_count": all_attempt_count,
                    "ready_items": ready_items,
                    "recommended_items": recommended_items,
                },
                "date_range": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                },
                "hierarchical_data": all_units,
            }

            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing hierarchical metrics: {e}")
            raise

    # --------------------------------------------------------------------
    # SCORE DISTRIBUTION
    # --------------------------------------------------------------------

    async def get_score_distribution(
        self,
        student_id: int,
        subject: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Compute score distribution histograms at subject/unit/skill levels."""
        ck = self._cache_key(
            "score_dist", student_id=student_id, subject=subject,
            start_date=start_date, end_date=end_date,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            start_iso = start_date.isoformat() if start_date else None
            end_iso = end_date.isoformat() if end_date else None
            reviews = await self._load_reviews(student_id, subject, start_iso, end_iso)

            cur = await self._build_curriculum_hierarchy(subject)
            lookup = cur["subskill_lookup"]

            # Build histograms at all three levels
            subject_hist: Dict[str, int] = defaultdict(int)
            unit_hists: Dict[str, Dict[str, Any]] = {}
            skill_hists: Dict[str, Dict[str, Any]] = {}

            subject_scores: List[float] = []

            for r in reviews:
                score = int(round(float(r.get("score", 0))))
                score = max(0, min(10, score))
                sid = r.get("subskill_id", "")
                meta = lookup.get(sid, {})

                subject_hist[str(score)] += 1
                subject_scores.append(score)

                uid = meta.get("unit_id", "unknown")
                if uid not in unit_hists:
                    unit_hists[uid] = {
                        "scores": defaultdict(int),
                        "raw_scores": [],
                        "name": meta.get("unit_title", uid),
                    }
                unit_hists[uid]["scores"][str(score)] += 1
                unit_hists[uid]["raw_scores"].append(score)

                skid = meta.get("skill_id", "unknown")
                if skid not in skill_hists:
                    skill_hists[skid] = {
                        "scores": defaultdict(int),
                        "raw_scores": [],
                        "name": meta.get("skill_description", skid),
                        "parent_unit_id": uid,
                    }
                skill_hists[skid]["scores"][str(score)] += 1
                skill_hists[skid]["raw_scores"].append(score)

            def _build_item(level, item_id, name, hist, raw_scores, parent_unit_id=None):
                total = len(raw_scores)
                avg = sum(raw_scores) / max(total, 1)
                full_hist = {str(i): hist.get(str(i), 0) for i in range(11)}
                return {
                    "level": level,
                    "id": item_id,
                    "name": name,
                    "parent_unit_id": parent_unit_id,
                    "score_histogram": full_hist,
                    "attempt_histogram": {},
                    "total_reviews": total,
                    "avg_score": round(avg, 2),
                    "avg_score_pct": round(avg / 10.0, 4),
                }

            distributions = []
            # Subject level
            distributions.append(
                _build_item("subject", subject, subject, dict(subject_hist), subject_scores)
            )
            # Unit level
            for uid, data in sorted(unit_hists.items()):
                distributions.append(
                    _build_item("unit", uid, data["name"], dict(data["scores"]), data["raw_scores"])
                )
            # Skill level
            for skid, data in sorted(skill_hists.items()):
                distributions.append(
                    _build_item("skill", skid, data["name"], dict(data["scores"]),
                                data["raw_scores"], data["parent_unit_id"])
                )

            result = {
                "distributions": distributions,
                "date_range": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                },
            }
            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing score distribution: {e}")
            raise

    # --------------------------------------------------------------------
    # SCORE TRENDS
    # --------------------------------------------------------------------

    async def get_score_trends(
        self,
        student_id: int,
        granularity: str,
        lookback_weeks: Optional[int] = None,
        lookback_months: Optional[int] = None,
        subjects: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Compute score trends over time grouped by period."""
        ck = self._cache_key(
            "score_trends", student_id=student_id, granularity=granularity,
            lookback_weeks=lookback_weeks, lookback_months=lookback_months,
            subjects=",".join(subjects) if subjects else None,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            now = datetime.now(timezone.utc)
            if granularity == "weekly":
                weeks = lookback_weeks or 52
                cutoff = (now - timedelta(weeks=weeks)).isoformat()
                lookback_val = weeks
            else:
                months = lookback_months or 12
                cutoff = (now - timedelta(days=months * 30)).isoformat()
                lookback_val = months

            # Load reviews for all subjects or filtered
            all_reviews = []
            if subjects:
                for subj in subjects:
                    reviews = await self._load_reviews(student_id, subj, start_date=cutoff)
                    all_reviews.extend(reviews)
            else:
                all_reviews = await self._load_reviews(student_id, start_date=cutoff)

            # Group by (subject, period)
            interval = "week" if granularity == "weekly" else "month"
            by_subject: Dict[str, List[Dict]] = defaultdict(list)
            for r in all_reviews:
                by_subject[r.get("subject", "Unknown")].append(r)

            trends = []
            for subj, subj_reviews in sorted(by_subject.items()):
                grouped = self._group_by_interval(subj_reviews, interval)
                periods = []
                for period_key, items in grouped.items():
                    scores = [float(i.get("score", 0)) for i in items]
                    total = len(scores)
                    score_sum = sum(scores)
                    avg = score_sum / max(total, 1)

                    if granularity == "weekly":
                        label = f"Week {period_key.split('-W')[1]}, {period_key.split('-W')[0]}"
                    else:
                        try:
                            dt = datetime.strptime(period_key, "%Y-%m")
                            label = dt.strftime("%B %Y")
                        except ValueError:
                            label = period_key

                    # Compute period start/end dates from the period_key
                    if granularity == "weekly":
                        # period_key like "2025-W01"
                        try:
                            yr, wk = period_key.split("-W")
                            p_start = datetime.strptime(f"{yr}-W{wk}-1", "%Y-W%W-%w")
                            p_end = p_start + timedelta(days=6)
                        except (ValueError, IndexError):
                            p_start = p_end = now
                    else:
                        # period_key like "2025-01"
                        try:
                            p_start = datetime.strptime(period_key, "%Y-%m")
                            # last day of month
                            next_month = p_start.replace(day=28) + timedelta(days=4)
                            p_end = next_month - timedelta(days=next_month.day)
                        except ValueError:
                            p_start = p_end = now

                    periods.append({
                        "period_key": period_key,
                        "period_label": label,
                        "start_date": p_start.strftime("%Y-%m-%d"),
                        "end_date": p_end.strftime("%Y-%m-%d"),
                        "avg_score": round(avg, 2),
                        "avg_score_pct": round(avg / 10.0, 4),
                        "total_reviews": total,
                        "score_sum": round(score_sum, 2),
                    })

                trends.append({"subject": subj, "periods": periods})

            result = {
                "trends": trends,
                "date_range": {
                    "lookback": lookback_val,
                    "granularity": granularity,
                },
            }
            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing score trends: {e}")
            raise

    # --------------------------------------------------------------------
    # MISTAKE PATTERNS
    # --------------------------------------------------------------------

    async def get_mistake_patterns(
        self,
        student_id: int,
        subject: Optional[str] = None,
        days: int = 30,
        min_feedback_length: int = 20,
    ) -> Dict[str, Any]:
        """Identify recurring mistake patterns from low-score reviews."""
        ck = self._cache_key(
            "mistakes", student_id=student_id, subject=subject,
            days=days, min_feedback_length=min_feedback_length,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            reviews = await self._load_reviews(student_id, subject, start_date=cutoff)

            cur = await self._build_curriculum_hierarchy(subject)
            lookup = cur["subskill_lookup"]

            # Filter to low-score reviews with meaningful feedback
            low_score_reviews: Dict[str, List[Dict]] = defaultdict(list)
            for r in reviews:
                score = float(r.get("score", 10))
                if score >= 7:
                    continue
                # Extract text feedback
                fb = r.get("feedback", "")
                if isinstance(fb, dict):
                    parts = [str(v) for v in fb.values() if v]
                    fb_text = " ".join(parts)
                else:
                    fb_text = str(fb)
                if len(fb_text) < min_feedback_length:
                    continue
                sid = r.get("subskill_id", "unknown")
                low_score_reviews[sid].append({
                    "score": score,
                    "feedback": fb_text,
                    "timestamp": r.get("timestamp"),
                })

            patterns = []
            for sid, entries in sorted(low_score_reviews.items(), key=lambda x: -len(x[1])):
                meta = lookup.get(sid, {})
                avg_score = sum(e["score"] for e in entries) / max(len(entries), 1)
                patterns.append({
                    "subskill_id": sid,
                    "subskill_description": meta.get("subskill_description", ""),
                    "subject": meta.get("subject", subject or ""),
                    "skill_id": meta.get("skill_id", ""),
                    "unit_title": meta.get("unit_title", ""),
                    "occurrence_count": len(entries),
                    "avg_score": round(avg_score, 2),
                    "feedback_samples": [e["feedback"][:200] for e in entries[:3]],
                })

            result = {
                "student_id": student_id,
                "subject_filter": subject,
                "days_analyzed": days,
                "total_low_score_reviews": sum(len(v) for v in low_score_reviews.values()),
                "mistake_patterns": patterns,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing mistake patterns: {e}")
            return {
                "student_id": student_id,
                "mistake_patterns": [],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

    # --------------------------------------------------------------------
    # TIMESERIES METRICS
    # --------------------------------------------------------------------

    async def get_timeseries_metrics(
        self,
        student_id: int,
        subject: Optional[str] = None,
        interval: str = "month",
        level: str = "subject",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        unit_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        include_hierarchy: bool = False,
    ) -> List[Dict]:
        """Compute metrics over time intervals."""
        ck = self._cache_key(
            "timeseries", student_id=student_id, subject=subject,
            interval=interval, level=level, start_date=start_date,
            end_date=end_date, unit_id=unit_id, skill_id=skill_id,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            # Default lookback: 6 months
            if not start_date:
                start_date = datetime.now(timezone.utc) - timedelta(days=180)
            start_iso = start_date.isoformat() if isinstance(start_date, datetime) else str(start_date)
            end_iso = end_date.isoformat() if end_date else None

            attempts = await self._load_attempts(
                student_id, subject, start_date=start_iso, end_date=end_iso
            )

            # Optional unit/skill filtering
            if unit_id or skill_id:
                cur = await self._build_curriculum_hierarchy(subject)
                lookup = cur["subskill_lookup"]
                filtered = []
                for a in attempts:
                    sid = a.get("subskill_id", "")
                    meta = lookup.get(sid, {})
                    if unit_id and meta.get("unit_id") != unit_id:
                        continue
                    if skill_id and meta.get("skill_id") != skill_id:
                        continue
                    filtered.append(a)
                attempts = filtered

            # Get total curriculum items for completion calculation
            cur_data = await self._build_curriculum_hierarchy(subject)
            total_curriculum_items = sum(cur_data["total_subskills_by_subject"].values())

            # Group by interval
            grouped = self._group_by_interval(attempts, interval)

            intervals = []
            for period_key, items in grouped.items():
                scores = [float(i.get("score", 0)) for i in items]
                distinct_subskills = set(i.get("subskill_id") for i in items)
                n = max(len(scores), 1)
                avg_score = sum(scores) / n
                # Mastery approximation: avg_score_normalized * credibility
                credibility = min(n / 10.0, 1.0)
                mastery = (avg_score / 10.0) * credibility
                completion = (len(distinct_subskills) / max(total_curriculum_items, 1)) * 100

                intervals.append({
                    "interval_date": period_key,
                    "summary": {
                        "mastery": round(mastery, 4),
                        "proficiency": round(avg_score / 10.0, 4),
                        "avg_score": round(avg_score, 4),
                        "completion": round(completion, 2),
                        "attempted_items": len(distinct_subskills),
                        "total_items": total_curriculum_items,
                        "attempt_count": len(items),
                        "ready_items": 0,
                        "recommended_items": 0,
                    },
                })

            self._cache_set(ck, intervals)
            return intervals

        except Exception as e:
            logger.error(f"Error computing timeseries metrics: {e}")
            raise

    # ========================================================================
    # KNOWLEDGE GRAPH PROGRESS (Pulse-native)
    # ========================================================================

    async def get_knowledge_graph_progress(
        self,
        student_id: int,
        subject: str,
        include_nodes: bool = True,
        depth_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Compute knowledge graph progress for a student in a subject.

        Combines:
        - DAG structure from curriculum_graphs (via LearningPathsService)
        - Mastery lifecycle gate state per subskill
        - IRT ability (theta) per skill
        - Leapfrog history from pulse_sessions

        Returns a rich summary suitable for both parent-facing views
        (coverage %, frontier description) and developer views
        (per-node status, theta, gate detail).
        """
        ck = self._cache_key(
            "knowledge_graph_progress",
            student_id=student_id,
            subject=subject,
            include_nodes=include_nodes,
            depth_limit=depth_limit,
        )
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        try:
            if not self.learning_paths:
                raise ValueError("LearningPathsService not available")

            # --- Parallel data loading ---
            import asyncio

            student_graph_task = self.learning_paths.get_student_graph(
                student_id, subject
            )
            lifecycle_task = self.fs.get_all_mastery_lifecycles(
                student_id, subject=subject
            )
            ability_task = self.fs.get_all_student_abilities(student_id)

            student_graph, lifecycles_list, abilities_list = await asyncio.gather(
                student_graph_task, lifecycle_task, ability_task
            )

            # Index mastery lifecycle by subskill_id
            lifecycle_map: Dict[str, Dict] = {}
            for lc in lifecycles_list:
                sid = lc.get("subskill_id") or lc.get("id", "")
                lifecycle_map[sid] = lc

            # Index ability by skill_id
            ability_map: Dict[str, Dict] = {}
            for ab in abilities_list:
                sid = ab.get("skill_id") or ab.get("id", "")
                ability_map[sid] = ab

            # --- Build topology depth map ---
            nodes = student_graph.get("nodes", [])
            edges = student_graph.get("edges", [])

            # Build adjacency for topological depth
            children: Dict[str, list] = defaultdict(list)
            parents: Dict[str, list] = defaultdict(list)
            for edge in edges:
                src = edge.get("source", "")
                tgt = edge.get("target", "")
                children[src].append(tgt)
                parents[tgt].append(src)

            # Compute topological depth via BFS from roots
            node_ids = {n["id"] for n in nodes}
            roots = [nid for nid in node_ids if nid not in parents or not parents[nid]]
            depth_map: Dict[str, int] = {}
            queue = [(r, 0) for r in roots]
            while queue:
                nid, d = queue.pop(0)
                if nid in depth_map:
                    # Keep the max depth (longest path)
                    if d > depth_map[nid]:
                        depth_map[nid] = d
                    else:
                        continue
                else:
                    depth_map[nid] = d
                for child in children.get(nid, []):
                    queue.append((child, d + 1))

            # For nodes not reached (disconnected), set depth 0
            for n in nodes:
                if n["id"] not in depth_map:
                    depth_map[n["id"]] = 0

            max_depth = max(depth_map.values()) if depth_map else 0

            # --- Classify each node ---
            counters = {
                "mastered_direct": 0,
                "mastered_inferred": 0,
                "in_progress": 0,
                "in_review": 0,
                "not_started": 0,
                "locked": 0,
            }
            frontier_nodes: List[str] = []
            result_nodes: List[Dict[str, Any]] = []
            leapfrog_inferred_ids: List[str] = []
            leapfrog_retest_passed = 0
            leapfrog_retest_total = 0

            for node in nodes:
                nid = node["id"]
                node_depth = depth_map.get(nid, 0)

                # Apply depth_limit filter
                if depth_limit is not None and node_depth > depth_limit:
                    continue

                entity_type = node.get("type", node.get("entity_type", ""))
                graph_status = node.get("status", "LOCKED")
                skill_id = node.get("skill_id", nid)  # For subskills, parent skill_id
                description = node.get("description", node.get("label", ""))

                lc = lifecycle_map.get(nid, {})
                current_gate = lc.get("current_gate", 0)
                completion_pct = lc.get("completion_pct", 0.0)
                prior_source = lc.get("prior_source", "")

                ab = ability_map.get(skill_id, {})
                theta = ab.get("theta")
                earned_level = ab.get("earned_level")

                # Determine Pulse-native status
                is_inferred = prior_source == "pulse_leapfrog" or (
                    current_gate == 2
                    and lc.get("lesson_eval_count", 0) == 3
                    and any(
                        gh.get("source") == "diagnostic"
                        for gh in lc.get("gate_history", [])
                    )
                )

                if current_gate == 4:
                    status = "mastered"
                    counters["mastered_direct"] += 1
                elif current_gate >= 2 and is_inferred:
                    status = "inferred"
                    counters["mastered_inferred"] += 1
                    leapfrog_inferred_ids.append(nid)
                    # Check if the inferred skill has been retested
                    gate_history = lc.get("gate_history", [])
                    retest_entries = [
                        gh for gh in gate_history
                        if gh.get("source") == "practice" and gh.get("gate", 0) >= 2
                    ]
                    if retest_entries:
                        leapfrog_retest_total += 1
                        if any(gh.get("passed", False) for gh in retest_entries):
                            leapfrog_retest_passed += 1
                elif current_gate in (1, 2, 3) and not is_inferred:
                    status = "in_review"
                    counters["in_review"] += 1
                elif graph_status == "IN_PROGRESS" or (
                    current_gate == 0 and lc.get("lesson_eval_count", 0) > 0
                ):
                    status = "in_progress"
                    counters["in_progress"] += 1
                elif graph_status == "UNLOCKED" and current_gate == 0:
                    status = "frontier"
                    counters["not_started"] += 1
                    frontier_nodes.append(nid)
                elif graph_status == "LOCKED":
                    status = "locked"
                    counters["locked"] += 1
                else:
                    status = "not_started"
                    counters["not_started"] += 1

                if include_nodes:
                    node_detail: Dict[str, Any] = {
                        "subskill_id": nid,
                        "skill_id": skill_id if skill_id != nid else node.get("skill_id", ""),
                        "description": description,
                        "depth": node_depth,
                        "status": status,
                        "current_gate": current_gate,
                        "prerequisite_ids": [
                            e["source"] for e in edges if e.get("target") == nid
                        ],
                        "dependent_ids": [
                            e["target"] for e in edges if e.get("source") == nid
                        ],
                    }
                    if theta is not None:
                        node_detail["theta"] = round(theta, 2)
                    if earned_level is not None:
                        node_detail["earned_level"] = round(earned_level, 1)
                    if is_inferred:
                        node_detail["inferred_from"] = "pulse_leapfrog"

                    result_nodes.append(node_detail)

            # --- Frontier metrics ---
            frontier_depths = [depth_map.get(fid, 0) for fid in frontier_nodes]
            avg_frontier_depth = (
                sum(frontier_depths) / len(frontier_depths) if frontier_depths else 0
            )

            # --- Leapfrog summary from pulse_sessions ---
            # Count leapfrog events from pulse sessions (if available)
            total_leapfrogs = 0
            total_skills_inferred = len(leapfrog_inferred_ids)
            try:
                pulse_sessions = await asyncio.to_thread(
                    self.fs.client.collection("pulse_sessions").where(
                        "student_id", "==", student_id
                    ).where(
                        "subject", "==", subject
                    ).get
                )

                for doc in pulse_sessions:
                    session_data = doc.to_dict()
                    leapfrogs = session_data.get("leapfrogs", [])
                    total_leapfrogs += len(leapfrogs)
            except Exception as e:
                logger.warning(f"Could not load pulse_sessions for leapfrog stats: {e}")

            leapfrog_retest_pass_rate = (
                round(leapfrog_retest_passed / leapfrog_retest_total, 3)
                if leapfrog_retest_total > 0
                else None
            )

            # --- Build response ---
            total_nodes = sum(counters.values())
            result: Dict[str, Any] = {
                "student_id": student_id,
                "subject": subject,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_nodes": total_nodes,
                **counters,
                "frontier_node_ids": frontier_nodes,
                "frontier_depth": round(avg_frontier_depth, 1),
                "max_depth": max_depth,
                "total_leapfrogs": total_leapfrogs,
                "total_skills_inferred": total_skills_inferred,
                "leapfrog_retest_pass_rate": leapfrog_retest_pass_rate,
            }

            if include_nodes:
                result["nodes"] = result_nodes

            self._cache_set(ck, result)
            return result

        except Exception as e:
            logger.error(f"Error computing knowledge graph progress: {e}")
            raise

    # ------------------------------------------------------------------
    # Pulse session history
    # ------------------------------------------------------------------

    async def get_pulse_session_history(
        self,
        student_id: int,
        subject: Optional[str] = None,
        limit: int = 50,
        include_theta_trajectory: bool = True,
    ) -> Dict[str, Any]:
        """Return Pulse session history with band breakdowns and leapfrog events.

        Queries ``pulse_sessions`` collection, computes per-session band
        success rates, aggregates leapfrog events, and optionally builds a
        theta trajectory from the ``ability`` subcollection's theta_history.
        """
        import asyncio

        ck = f"pulse_history:{student_id}:{subject}:{limit}:{include_theta_trajectory}"
        cached = self._cache_get(ck)
        if cached is not None:
            return cached

        # --- Fetch data ---
        sessions_raw = await self.fs.get_student_pulse_sessions(student_id)

        # Filter by subject if provided
        if subject:
            sessions_raw = [s for s in sessions_raw if s.get("subject") == subject]

        # Sort by created_at descending, take limit
        sessions_raw.sort(
            key=lambda s: s.get("created_at", ""), reverse=True
        )
        sessions_raw = sessions_raw[:limit]

        # --- Build per-session summaries ---
        session_items: list = []
        agg_frontier_pass = 0
        agg_frontier_total = 0
        total_leapfrogs = 0
        total_skills_inferred = 0
        total_items_completed = 0
        all_scores: list = []
        completed_count = 0

        for s in sessions_raw:
            items = s.get("items", [])
            leapfrogs = s.get("leapfrogs", [])

            # Band breakdown
            band_items: Dict[str, list] = {"frontier": [], "current": [], "review": []}
            for item in items:
                band = item.get("band", "current")
                if band in band_items:
                    band_items[band].append(item)

            def _band_success(band_list: list) -> Optional[float]:
                scored = [i for i in band_list if i.get("score") is not None]
                if not scored:
                    return None
                passing = sum(1 for i in scored if i["score"] >= 7.0)
                return round(passing / len(scored), 3)

            frontier_sr = _band_success(band_items["frontier"])
            current_sr = _band_success(band_items["current"])
            review_sr = _band_success(band_items["review"])

            # Aggregate frontier stats for overall rate
            frontier_scored = [i for i in band_items["frontier"] if i.get("score") is not None]
            agg_frontier_total += len(frontier_scored)
            agg_frontier_pass += sum(1 for i in frontier_scored if i["score"] >= 7.0)

            # Scores
            completed_items = [i for i in items if i.get("score") is not None]
            session_scores = [i["score"] for i in completed_items]
            avg_score = round(sum(session_scores) / len(session_scores), 2) if session_scores else None
            all_scores.extend(session_scores)

            # Duration
            durations = [i.get("duration_ms", 0) for i in completed_items if i.get("duration_ms")]
            total_duration = sum(durations) if durations else None

            # Leapfrog
            session_inferred = sum(len(lf.get("inferred_skills", [])) for lf in leapfrogs)
            total_leapfrogs += len(leapfrogs)
            total_skills_inferred += session_inferred

            items_completed = s.get("items_completed", len(completed_items))
            items_total = s.get("items_total", len(items))
            total_items_completed += items_completed

            if s.get("status") == "completed":
                completed_count += 1

            leapfrog_summaries = [
                {
                    "lesson_group_id": lf.get("lesson_group_id", ""),
                    "probed_skills": lf.get("probed_skills", []),
                    "inferred_skills": lf.get("inferred_skills", []),
                    "aggregate_score": lf.get("aggregate_score", 0),
                }
                for lf in leapfrogs
            ]

            session_items.append({
                "session_id": s.get("session_id", ""),
                "subject": s.get("subject", ""),
                "status": s.get("status", "unknown"),
                "is_cold_start": s.get("is_cold_start", False),
                "items_completed": items_completed,
                "items_total": items_total,
                "band_breakdown": {
                    "frontier_items": len(band_items["frontier"]),
                    "current_items": len(band_items["current"]),
                    "review_items": len(band_items["review"]),
                    "frontier_success_rate": frontier_sr,
                    "current_success_rate": current_sr,
                    "review_success_rate": review_sr,
                },
                "leapfrogs": leapfrog_summaries,
                "skills_inferred": session_inferred,
                "avg_score": avg_score,
                "duration_ms": total_duration,
                "created_at": s.get("created_at", ""),
                "completed_at": s.get("completed_at"),
            })

        # --- Overall frontier success rate ---
        overall_frontier_sr = (
            round(agg_frontier_pass / agg_frontier_total, 3)
            if agg_frontier_total > 0
            else None
        )
        avg_session_score = (
            round(sum(all_scores) / len(all_scores), 2)
            if all_scores
            else None
        )

        # --- Theta trajectory (from ability theta_history) ---
        theta_trajectory: list = []
        if include_theta_trajectory and sessions_raw:
            try:
                abilities = await self.fs.get_all_student_abilities(student_id)
                # Collect session IDs for quick lookup
                session_ids = {s.get("session_id") for s in sessions_raw}

                for ab in abilities:
                    skill_id = ab.get("skill_id", "")
                    # Filter by subject if we have ability subject info
                    if subject and ab.get("subject") and ab["subject"] != subject:
                        continue
                    for th in ab.get("theta_history", []):
                        # theta_history entries may have session_id linking them to pulse sessions
                        entry_session = th.get("session_id", "")
                        if entry_session and entry_session in session_ids:
                            theta_trajectory.append({
                                "session_id": entry_session,
                                "skill_id": skill_id,
                                "theta_before": round(th.get("old_theta", th.get("theta", 0)), 2),
                                "theta_after": round(th.get("new_theta", th.get("theta", 0)), 2),
                                "delta": round(
                                    th.get("new_theta", 0) - th.get("old_theta", 0), 2
                                ),
                                "timestamp": th.get("timestamp", ""),
                            })
                # Sort by timestamp
                theta_trajectory.sort(key=lambda t: t.get("timestamp", ""))
            except Exception as e:
                logger.warning(f"Could not build theta trajectory: {e}")

        result: Dict[str, Any] = {
            "student_id": student_id,
            "subject": subject,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_sessions": len(session_items),
            "completed_sessions": completed_count,
            "total_items_completed": total_items_completed,
            "total_leapfrogs": total_leapfrogs,
            "total_skills_inferred": total_skills_inferred,
            "overall_frontier_success_rate": overall_frontier_sr,
            "avg_session_score": avg_session_score,
            "sessions": session_items,
            "theta_trajectory": theta_trajectory,
        }

        self._cache_set(ck, result)
        return result
