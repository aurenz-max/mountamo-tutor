# backend/app/services/forecast_service.py
"""
Forecast Service — skill-level forward projection ("which skills, when").

Architecture: a PURE projection core (`project`) wrapped by a thin loader.
The core never touches Firestore — it takes assembled state and returns the
forecast. That one decision makes the engine dual-use: the API endpoint and
the (future) pulse-planner harness both call the same core; the harness just
loops it with a synthetic student mutating state between ticks.

Order × rate:
  - ORDER: the current frontier in live selector (IRT) order, successors in
    prerequisite topology (depth, then curriculum unit order). Each row is
    tagged with its `order_basis` so consumers can style certainty honestly.
  - RATE: pace-proportional minutes (same policy the daily allocator ships)
    converted to subskills/week at the ASSUMED per-subskill cost, until the
    block time ledger supplies observed costs. Bands at ×1.15 / ×0.75.

Materialization: one doc per student per day at students/{id}/forecasts/
{date} (get-or-create, like the daily session plan). Consecutive docs yield
drift — "Place Value moved +2 weeks since Monday" — which is a signal in its
own right. The forecast is a projection, not a promise; the daily session
plan remains the only plan of record.
"""

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..models.forecast import (
    EtaBand,
    ForecastDrift,
    RateBand,
    ReviewLoad,
    StudentForecast,
    SubjectForecast,
    SubskillEta,
    UnitDrift,
    UnitForecast,
)
from ..models.lesson_plan import ASSUMED_MIN_PER_SUBSKILL, DEFAULT_DAILY_BUDGET_MINUTES

logger = logging.getLogger(__name__)

# Rate scenario multipliers — placeholder bands until the pulse harness fits
# them to observed velocity variance.
OPTIMISTIC_MULT = 1.15
PESSIMISTIC_MULT = 0.75

# Retest echo: each introduced subskill returns for gate checks at roughly
# wk +1 / +2 / +4 (mastery lifecycle intervals) → ~3 due retests per intro.
RETEST_ECHO = 3.0

# Triage split of non-subsumed retests (see design §3b): most fold into
# nearby lessons as riders; the rest are orphan leaves needing blocks.
RIDER_SHARE = 0.6

# How many frontier picks per subject carry the live selector's order.
SELECTOR_HEAD = 8

# Only report unit drift when the best-estimate ETA moved at least this much.
DRIFT_THRESHOLD_DAYS = 7


# ---------------------------------------------------------------------------
# Pure helpers — no I/O anywhere below until the ForecastService class
# ---------------------------------------------------------------------------

def build_instructional_weeks(
    today: date,
    year_start: date,
    year_end: date,
    breaks: List[Dict[str, str]],
) -> List[date]:
    """
    Week-start dates from max(today, year_start) to year_end, skipping weeks
    that fall entirely inside a break. Anchored to year_start's weekday so
    week boundaries are stable across the year.
    """
    def parse(b: Dict[str, str], key: str) -> Optional[date]:
        try:
            return date.fromisoformat(str(b.get(key, ""))[:10])
        except (ValueError, TypeError):
            return None

    spans = []
    for b in breaks:
        s, e = parse(b, "start"), parse(b, "end")
        if s and e:
            spans.append((s, e))

    weeks: List[date] = []
    d = year_start
    # advance the anchor to the current week if the year already started
    while d + timedelta(days=7) <= today:
        d += timedelta(days=7)
    while d <= year_end:
        week_end = d + timedelta(days=7)
        fully_in_break = any(s <= d and week_end <= e + timedelta(days=1) for s, e in spans)
        if not fully_in_break:
            weeks.append(d)
        d += timedelta(days=7)
    return weeks


def week_date(weeks: List[date], f: float) -> date:
    """Fractional instructional-week index → calendar date (extrapolates past year end)."""
    if not weeks:
        return date.today()
    i = int(f)
    if i < len(weeks):
        return weeks[i] + timedelta(days=round((f - i) * 7))
    return weeks[-1] + timedelta(days=round((f - (len(weeks) - 1)) * 7))


def project(
    subjects_state: List[Dict[str, Any]],
    weeks: List[date],
    budget_minutes: int,
    assumed_min_per_subskill: int,
) -> Tuple[List[SubjectForecast], float, List[str]]:
    """
    PURE core: state → per-subject forecasts + pace signal + warnings.

    Each subjects_state entry:
      subject, total, remaining_ordered: [{subskill_id, description, skill_id,
      unit_title, unit_order, order_basis, reason}], graph_coverage
    """
    n_weeks = len(weeks)
    total_remaining = sum(len(s["remaining_ordered"]) for s in subjects_state) or 1
    year_end_f = float(n_weeks)

    out: List[SubjectForecast] = []
    warnings: List[str] = []

    for st in subjects_state:
        remaining = st["remaining_ordered"]
        n_rem = len(remaining)
        minutes = budget_minutes * n_rem / total_remaining
        r_best = minutes * 5 / assumed_min_per_subskill if assumed_min_per_subskill else 0.0
        if r_best <= 0:
            continue
        r_opt, r_pess = r_best * OPTIMISTIC_MULT, r_best * PESSIMISTIC_MULT

        # --- unit windows: consecutive runs share a unit ---
        units: List[UnitForecast] = []
        etas: List[SubskillEta] = []
        i = 0
        while i < n_rem:
            unit = remaining[i]["unit_title"] or "General"
            j = i
            while j < n_rem and (remaining[j]["unit_title"] or "General") == unit:
                j += 1
            fe = float(j)
            units.append(UnitForecast(
                unit_title=unit,
                subskills=j - i,
                eta_start=week_date(weeks, i / r_best).isoformat(),
                eta_end=EtaBand(
                    optimistic=week_date(weeks, fe / r_opt).isoformat(),
                    best=week_date(weeks, fe / r_best).isoformat(),
                    pessimistic=week_date(weeks, fe / r_pess).isoformat(),
                ),
                # selector-graded only when the WHOLE run is selector-picked —
                # a 40-subskill topology run with 2 selector picks in front
                # must not masquerade as high-confidence ordering.
                order_basis="selector" if all(
                    remaining[k]["order_basis"] == "selector" for k in range(i, j)
                ) else "topology",
                past_year_end=(fe / r_pess) > year_end_f,
            ))
            i = j
        for idx, r in enumerate(remaining):
            etas.append(SubskillEta(
                subskill_id=r["subskill_id"],
                description=r.get("description", ""),
                skill_id=r.get("skill_id", ""),
                unit_title=r.get("unit_title", ""),
                eta_week=week_date(weeks, idx / r_best).isoformat(),
                order_basis=r["order_basis"],
                reason=r.get("reason", ""),
            ))

        # --- retention triage (§3b) ---
        cov = st.get("graph_coverage", 0.0)
        due = r_best * RETEST_ECHO
        subsumed = due * cov
        rest = due - subsumed
        review = ReviewLoad(
            due_per_week=round(due, 1),
            subsumed=round(subsumed, 1),
            riders=round(rest * RIDER_SHARE, 1),
            dedicated_blocks=round(rest * (1 - RIDER_SHARE), 1),
            graph_coverage=round(cov, 2),
        )

        finish_best_f = n_rem / r_best
        if n_rem / r_pess > year_end_f:
            warnings.append(
                f"{st['subject']}: pessimistic scenario misses year end"
            )
        out.append(SubjectForecast(
            subject=st["subject"],
            total_subskills=st["total"],
            remaining_subskills=n_rem,
            allocated_minutes_per_day=round(minutes, 1),
            weekly_rate=RateBand(
                optimistic=round(r_opt, 2), best=round(r_best, 2),
                pessimistic=round(r_pess, 2),
            ),
            review_load=review,
            projected_finish=EtaBand(
                optimistic=week_date(weeks, n_rem / r_opt).isoformat(),
                best=week_date(weeks, finish_best_f).isoformat(),
                pessimistic=week_date(weeks, n_rem / r_pess).isoformat(),
            ),
            units=units,
            subskill_etas=etas,
        ))

    required = (
        total_remaining * assumed_min_per_subskill / (n_weeks * 5)
        if n_weeks > 0 else 0.0
    )
    if required > budget_minutes:
        warnings.append(
            f"Required pace {required:.0f} min/day exceeds the {budget_minutes}-min budget"
        )
    return out, round(required, 1), list(dict.fromkeys(warnings))


def compute_drift(
    current: StudentForecast, prior: Dict[str, Any]
) -> Optional[ForecastDrift]:
    """Unit-level best-ETA movement vs a prior forecast doc (≥ threshold only)."""
    prior_etas: Dict[Tuple[str, str], str] = {}
    for subj in prior.get("subjects", []):
        for u in subj.get("units", []):
            prior_etas[(subj.get("subject", ""), u.get("unit_title", ""))] = (
                u.get("eta_end", {}).get("best", "")
            )
    if not prior_etas:
        return None
    moved: List[UnitDrift] = []
    for subj in current.subjects:
        for u in subj.units:
            prev = prior_etas.get((subj.subject, u.unit_title))
            if not prev:
                continue
            try:
                delta = (date.fromisoformat(u.eta_end.best) - date.fromisoformat(prev)).days
            except (ValueError, TypeError):
                continue
            if abs(delta) >= DRIFT_THRESHOLD_DAYS:
                moved.append(UnitDrift(
                    subject=subj.subject, unit_title=u.unit_title,
                    previous_eta=prev, current_eta=u.eta_end.best,
                    delta_days=delta,
                ))
    moved.sort(key=lambda m: -abs(m.delta_days))
    return ForecastDrift(compared_to=prior.get("date", ""), units=moved)


# ---------------------------------------------------------------------------
# Service — the thin loader + materialization around the pure core
# ---------------------------------------------------------------------------

class ForecastService:
    def __init__(self, firestore_service, curriculum_service, analytics_service):
        self.firestore = firestore_service
        self.curriculum = curriculum_service
        self.analytics = analytics_service
        logger.info("ForecastService initialized")

    async def get_student_forecast(
        self, student_id: int, force_refresh: bool = False
    ) -> StudentForecast:
        """
        Get-or-create today's materialized forecast (one doc per day, like
        the daily session plan). Drift is computed against the most recent
        prior doc and stored on today's doc at generation time.
        """
        today_str = datetime.now(timezone.utc).date().isoformat()
        if not force_refresh:
            stored = await self.firestore.get_forecast_doc(student_id, today_str)
            if stored:
                try:
                    return StudentForecast.model_validate(
                        {k: v for k, v in stored.items()
                         if k in StudentForecast.model_fields}
                    )
                except Exception as e:
                    logger.warning(
                        f"[FORECAST] Stored doc {student_id}/{today_str} unreadable, "
                        f"regenerating: {e}"
                    )
        forecast = await self._build_forecast(student_id, today_str)
        prior = await self.firestore.get_latest_forecast_doc_before(
            student_id, today_str
        )
        if prior:
            forecast.drift = compute_drift(forecast, prior)
        if forecast.subjects:
            await self.firestore.save_forecast_doc(
                student_id, today_str, forecast.model_dump(mode="json")
            )
        return forecast

    async def _build_forecast(self, student_id: int, today_str: str) -> StudentForecast:
        today = date.fromisoformat(today_str)

        # --- calendar ---
        raw_cfg = await self.firestore.get_school_year_config() or {}
        year_start_s = raw_cfg.get("start_date", "2025-08-25")
        year_end_s = raw_cfg.get("end_date", "2026-05-29")
        try:
            year_start = date.fromisoformat(year_start_s)
            year_end = date.fromisoformat(year_end_s)
        except (ValueError, TypeError):
            year_start, year_end = today, today
        weeks = build_instructional_weeks(
            today, year_start, year_end, raw_cfg.get("breaks", [])
        )

        planning = await self.firestore.get_student_planning_fields(student_id)
        budget = planning.get("daily_budget_minutes", DEFAULT_DAILY_BUDGET_MINUTES)
        # Grade of record — without it the graph fetch guesses (first-doc-
        # wins scan → Grade 1) and the forecast projects the wrong year.
        grade = planning.get("grade_level")

        # --- per-subject state ---
        subjects_state: List[Dict[str, Any]] = []
        subjects = await self._subject_names()
        for subj in subjects:
            try:
                kg = await self.analytics.get_knowledge_graph_progress(
                    student_id, subj, include_nodes=True, grade=grade
                )
            except Exception as e:
                logger.info(f"[FORECAST] No graph for {subj}, skipped ({e})")
                continue
            nodes = [n for n in kg.get("nodes", [])
                     if n.get("entity_type") == "subskill"]
            if not nodes:
                continue
            remaining = [n for n in nodes
                         if n.get("status") not in ("mastered", "inferred")]
            if not remaining:
                continue

            # selector head: live IRT order for the frontier
            selector_ids: List[str] = []
            selector_meta: Dict[str, Dict[str, str]] = {}
            try:
                targets = await self.analytics.select_session_targets(
                    student_id, subj, grade=grade, count=SELECTOR_HEAD
                )
                for o in targets.get("objectives", []):
                    selector_ids.append(o["subskillId"])
                    selector_meta[o["subskillId"]] = {"reason": o.get("reason", "")}
            except Exception as e:
                logger.info(f"[FORECAST] Selector unavailable for {subj}: {e}")

            unit_lookup = await self._unit_order_lookup(subj)
            by_id = {n["subskill_id"]: n for n in remaining}

            def row(sid: str, node: Dict[str, Any], basis: str) -> Dict[str, Any]:
                u = unit_lookup.get(sid, {})
                return {
                    "subskill_id": sid,
                    "description": node.get("description", ""),
                    "skill_id": node.get("skill_id", ""),
                    "unit_title": u.get("unit_title", ""),
                    "unit_order": u.get("unit_order", 999),
                    "sub_order": u.get("sub_order", 999),
                    "order_basis": basis,
                    "reason": selector_meta.get(sid, {}).get("reason", ""),
                }

            head = [row(sid, by_id[sid], "selector")
                    for sid in selector_ids if sid in by_id]
            head_ids = {r["subskill_id"] for r in head}
            tail = [row(n["subskill_id"], n, "topology")
                    for n in remaining if n["subskill_id"] not in head_ids]
            # Unit-major, depth within unit: depth-major ordering interleaves
            # units and shreds the timeline into fragments. Cross-unit
            # prerequisites are approximated by curriculum unit order — the
            # KG unlock model still governs actual delivery; the forecast is
            # a projection.
            tail.sort(key=lambda r: (
                r["unit_order"],
                by_id[r["subskill_id"]].get("depth", 0),
                r["sub_order"],
            ))

            with_deps = sum(1 for n in nodes if n.get("dependent_ids"))
            subjects_state.append({
                "subject": subj,
                "total": len(nodes),
                "remaining_ordered": head + tail,
                "graph_coverage": with_deps / len(nodes),
            })

        subject_forecasts, required, warnings = project(
            subjects_state, weeks, budget, ASSUMED_MIN_PER_SUBSKILL
        )
        return StudentForecast(
            student_id=str(student_id),
            date=today_str,
            generated_at=datetime.now(timezone.utc).isoformat(),
            grade_level=grade,
            year_start=year_start.isoformat(),
            year_end=year_end.isoformat(),
            weeks_remaining=len(weeks),
            budget_minutes=budget,
            assumed_min_per_subskill=ASSUMED_MIN_PER_SUBSKILL,
            required_minutes_per_day=required,
            subjects=subject_forecasts,
            warnings=warnings,
        )

    async def _subject_names(self) -> List[str]:
        """
        Distinct subjects. get_available_subjects returns one entry PER
        PUBLISHED GRADE DOC — without dedupe every subject is forecast ~5×,
        inflating totals and quintupling warnings. Dedupe on the rollup key,
        keep the first spelling (the KG fetch resolves grade internally).
        """
        subjects = await self.curriculum.get_available_subjects()
        seen: Dict[str, str] = {}
        for s in subjects:
            name = (s.get("subject_id") or s.get("subject_name", "")) if isinstance(s, dict) else str(s)
            if not name:
                continue
            key = type(self.firestore).rollup_subject_key(name)
            if key not in seen:
                seen[key] = name
        return list(seen.values())

    async def _unit_order_lookup(self, subject: str) -> Dict[str, Dict[str, Any]]:
        """
        subskill_id → {unit_title, unit_order, sub_order}, merged across ALL
        published grade docs for the subject (grade-aware, same reasoning as
        the planner's curriculum lookup — bare-subject fetch misses ids).
        """
        lookup: Dict[str, Dict[str, Any]] = {}
        docs: List[Tuple[str, Optional[str]]] = []
        try:
            published = await self.firestore.get_all_published_subjects()
            want = type(self.firestore).rollup_subject_key(subject)
            docs = [
                (e.get("subject_id", ""), e.get("grade"))
                for e in published
                if type(self.firestore).rollup_subject_key(e.get("subject_id")) == want
            ]
        except Exception as e:
            logger.warning(f"[FORECAST] Published-subjects listing failed: {e}")
        if not docs:
            docs = [(subject, None)]
        for subj_id, grade in docs:
            try:
                data = await self.curriculum.get_curriculum(subj_id, grade=grade)
            except Exception:
                continue
            for ui, unit in enumerate(data):
                title = unit.get("title", unit.get("id", ""))
                si = 0
                for skill in unit.get("skills", []):
                    for sub in skill.get("subskills", []):
                        sid = sub.get("id", "")
                        if sid and sid not in lookup:
                            lookup[sid] = {
                                "unit_title": title,
                                "unit_order": ui,
                                "sub_order": si,
                            }
                        si += 1
        return lookup
