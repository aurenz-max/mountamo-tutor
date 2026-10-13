"""Progress report — the facts behind "how is my child doing?".

One call composes a parent-readable report from data we already store. Every
number here is deterministic code; prose (PR-3) and at-home tips (PR-4) are
written by an LLM over THIS payload later and never compute anything.
Queue: my-tutoring-app/qa/parent-report/ROADMAP.md (PR-1).

Rules this module holds:
  - The grade map reads the learner model's demonstration states
    (learner_model.engine.demonstration), the same the My Progress card reads:
    evidence and lifecycle gates both travel the Jev graph's R-step and
    easier-form edges, so counting 20 objects shows counting 10, and a retest
    on the harder skill is a retest of the easier one. Dated lists (recently
    mastered, checks passed per week) stay the subskill's own lifecycle events.
  - Mastery is the lifecycle gate (4 = mastered). The legacy competency score
    (proficiency x credibility, averaged over unattempted subskills) is never
    read — it is what made the old card say "50% mastery" beside "MASTERED".
  - Lifecycle ids match curriculum ids EXACTLY. Lowercase twins (OPS001-01-a)
    are real Grade 1 subskills, not case variants of K ids.
  - Machine bursts are excluded: more than BURST_LIMIT attempts on one subskill
    in one UTC day (student 1004 has 1,688 on one subskill on 2026-03-09, about
    one per second). A child cannot do that; counting it inflates everything.
  - This is a history view, so it reads L0 attempts (field-projected) instead
    of the daily rollups: rollups cannot drop bursts or recover session timing.
"""

import logging
import re
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BURST_LIMIT = 40            # attempts on one subskill in one day above this = machine burst
SESSION_GAP_S = 30 * 60     # a gap longer than this starts a new session
WEEKS = 16                  # weekly series length
RECENT_DAYS = 30

_GRADE_DOC = {"K": "Kindergarten", "PK": "Pre-K"}
_GRADE_CODE = {"Kindergarten": "K", "Pre-K": "PK"}
_SUBJECT_NAMES = {
    "LANGUAGE_ARTS": "Reading & Language", "MATHEMATICS": "Math", "SCIENCE": "Science",
    "SOCIAL_STUDIES": "Social Studies", "ENGINEERING": "Engineering",
}

# Curriculum index across every published grade: {subskill_id: meta} plus the
# ordered unit -> skill -> subskill tree per (grade doc, subject). Shared by all
# students; refreshed every 10 minutes.
_CURRICULUM_CACHE: Dict[str, Any] = {"at": 0.0, "index": None, "trees": None}
_CURRICULUM_TTL_S = 600


def _num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _ts(v: Any) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _grade_code(grade: Optional[str]) -> str:
    """"Kindergarten"/"K" -> "K"; "3", "3rd", "3rd Grade", "Grade 3" -> "3"."""
    g = str(grade or "?").strip()
    if g in _GRADE_CODE:
        return _GRADE_CODE[g]
    if g.upper() in ("K", "PK"):
        return g.upper()
    m = re.search(r"\d+", g)
    return m.group(0) if m else g


def _grade_doc_key(code: str, available) -> Optional[str]:
    """The curriculum_published doc id for a grade code ("3" may be stored as "3" or "3rd Grade")."""
    for key in (_GRADE_DOC.get(code, code), code):
        if key in available:
            return key
    return next((k for k in available if _grade_code(k) == code), None)


def _subject_key(raw: Any) -> str:
    """Attempt subject spellings ("Language Arts", "SCIENCE_G1", "Reading") -> canonical key."""
    s = re.sub(r"[\s\-]+", "_", str(raw or "").strip().upper())
    s = re.sub(r"_G\d+$", "", s)
    return {"READING": "LANGUAGE_ARTS", "MATH": "MATHEMATICS"}.get(s, s)


def _clean_description(text: Any) -> str:
    """First line of an author-facing description, without markdown or "(e.g. ...)".

    Stopgap until PR-2 gives each subskill a parent-facing summary.
    """
    t = str(text or "").split("\n")[0].replace("**", "").strip()
    t = re.sub(r"^(Students|Student|Learners)\s+(\w)", lambda m: m.group(2).upper(), t)
    t = re.sub(r"\s*\(e\.g\..*$", "", t)
    t = re.sub(r"\s*Focus:.*$", "", t)
    return t


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


class ProgressReportService:
    def __init__(self, firestore_service):
        self.fs = firestore_service

    # ------------------------------------------------------------------ data

    def _curriculum(self):
        now = time.time()
        if _CURRICULUM_CACHE["index"] is not None and now - _CURRICULUM_CACHE["at"] < _CURRICULUM_TTL_S:
            return _CURRICULUM_CACHE["index"], _CURRICULUM_CACHE["trees"]
        # Subskill IDs repeat across grades with unrelated content (278 of
        # them), so each id keeps every published location; get_report picks
        # the one nearest the student's grade.
        index: Dict[str, List[Dict[str, Any]]] = {}
        trees: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(dict)
        for g in self.fs.client.collection("curriculum_published").stream():
            for s in g.reference.collection("subjects").stream():
                d = s.to_dict() or {}
                for sid, meta in (d.get("subskill_index") or {}).items():
                    index.setdefault(sid, []).append({**meta, "subject_id": s.id, "grade_doc": g.id})
                trees[g.id][s.id] = [
                    {
                        "unit_id": u.get("unit_id"),
                        "title": u.get("unit_title"),
                        "skills": [
                            {"skill_id": sk.get("skill_id"), "description": sk.get("skill_description"),
                             "subskills": [ss.get("subskill_id") for ss in sk.get("subskills", [])]}
                            for sk in u.get("skills", [])
                        ],
                    }
                    for u in d.get("curriculum") or []
                ]
        _CURRICULUM_CACHE.update(at=now, index=index, trees=dict(trees))
        return index, _CURRICULUM_CACHE["trees"]

    def _attempts(self, student_id: int) -> List[Dict[str, Any]]:
        fields = ["timestamp", "subskill_id", "subject", "score", "primitive_type"]
        rows = []
        for doc in self.fs._attempts_subcollection(student_id).select(fields).stream():
            a = doc.to_dict() or {}
            t = _ts(a.get("timestamp"))
            if t:
                rows.append({"t": t, "sid": a.get("subskill_id") or "", "subject": a.get("subject"),
                             "score": _num(a.get("score")), "primitive": a.get("primitive_type")})
        rows.sort(key=lambda r: r["t"])
        return rows

    # ---------------------------------------------------------------- report

    async def get_report(self, student_id: int, grade: Optional[str] = None,
                         today: Optional[date] = None) -> Dict[str, Any]:
        today = today or datetime.now(timezone.utc).date()
        planning = await self.fs.get_student_planning_fields(student_id)
        grade = grade or planning.get("grade_level") or "K"
        grade = _grade_code(grade)
        interests = await self.fs.get_student_interests(student_id)
        index, trees = self._curriculum()
        grade_doc = _grade_doc_key(grade, trees) or _GRADE_DOC.get(grade, grade)

        def _n(code: str) -> int:
            return 0 if code == "K" else int(code) if code.isdigit() else 99

        def pick(sid: str) -> Dict[str, Any]:
            """The published location of `sid` nearest the student's grade (lower on a tie)."""
            cands = index.get(sid) or []
            if len(cands) <= 1:
                return cands[0] if cands else {}
            target = _n(grade)
            return min(cands, key=lambda c: (abs(_n(_grade_code(c["grade_doc"])) - target),
                                             _n(_grade_code(c["grade_doc"]))))

        def meta(sid: str) -> Dict[str, Any]:
            m = pick(sid)
            return {"subskill_id": sid,
                    "description": _clean_description(m.get("subskill_description")) or None,
                    "source_description": m.get("subskill_description"),
                    # Published parent-facing sentence (curriculum publish pipeline); None until backfilled.
                    "parent_summary": m.get("parent_summary"),
                    "unit": m.get("unit_title"), "subject": m.get("subject_id"),
                    "grade": _grade_code(m.get("grade")) if m else None}

        # 1. attempts, minus machine bursts
        raw = self._attempts(student_id)
        per_day = Counter((r["t"].date(), r["sid"]) for r in raw)
        bursts = {k: n for k, n in per_day.items() if n > BURST_LIMIT}
        attempts = [r for r in raw if (r["t"].date(), r["sid"]) not in bursts]

        # 2. sessions
        sessions: List[List[Dict[str, Any]]] = []
        for a in attempts:
            if sessions and (a["t"] - sessions[-1][-1]["t"]).total_seconds() < SESSION_GAP_S:
                sessions[-1].append(a)
            else:
                sessions.append([a])

        def minutes(s):  # span plus two minutes for the last item, clamped to a plausible sitting
            return max(3.0, min(90.0, (s[-1]["t"] - s[0]["t"]).total_seconds() / 60 + 2))

        # 3. lifecycle -> per-subskill state and gate-crossing events
        lifecycle = {d.id: d.to_dict() or {} for d in self.fs._student_doc(student_id).collection("mastery_lifecycle").stream()}
        by_sid = defaultdict(list)
        for a in attempts:
            by_sid[a["sid"]].append(a)
        state: Dict[str, Dict[str, Any]] = {}
        crossings: List[tuple] = []
        for sid, L in lifecycle.items():
            if sid not in index:
                continue  # synthetic or retired ids (e.g. "fraction-circles") have no curriculum home
            prev, mastered_on = 0, None
            for e in sorted(L.get("gate_history") or [], key=lambda e: str(e.get("timestamp"))):
                g = int(_num(e.get("gate")))
                t = _ts(e.get("timestamp"))
                if g > prev and t:
                    crossings.append((t.date(), g))
                    if g == 4 and not mastered_on:
                        mastered_on = t.date()
                    prev = g
            at = by_sid.get(sid, [])
            state[sid] = {
                **meta(sid),
                "gate": int(_num(L.get("current_gate"))),
                "lessons": int(_num(L.get("lesson_eval_count"))),
                "answers": len(at),
                "accuracy": round(sum(a["score"] for a in at) / len(at) * 10) if at else None,
                "fails": _num(L.get("fails")),
                "pass_rate": _num(L.get("subskill_pass_rate"), None) if L.get("subskill_pass_rate") is not None else None,
                "mastered_on": mastered_on.isoformat() if mastered_on else None,
                "last_seen": (max(a["t"] for a in at).date().isoformat() if at
                              else str(L.get("updated_at") or "")[:10] or None),
            }

        # 4. weekly series
        this_week = _week_start(today)
        weeks = {this_week - timedelta(weeks=i): {"minutes": 0.0, "days": set(), "answers": 0, "score": 0.0,
                                                    "checks_passed": 0, "mastered": 0}
                 for i in range(WEEKS - 1, -1, -1)}
        for s in sessions:
            w = weeks.get(_week_start(s[0]["t"].date()))
            if w is not None:
                w["minutes"] += minutes(s)
                w["days"].add(s[0]["t"].date())
                w["answers"] += len(s)
                w["score"] += sum(a["score"] for a in s)
        for d, g in crossings:
            w = weeks.get(_week_start(d))
            if w is not None:
                w["checks_passed"] += 1
                w["mastered"] += g == 4

        # 5. the grade map, one cell per subskill, from the demonstration states
        from .learner_model.service import LearnerStateService
        lsv = LearnerStateService(self.fs, background=False)
        demo: Dict[str, Any] = {}
        for subj_id in (trees.get(grade_doc) or {}):
            try:
                demo[subj_id] = await lsv.demonstration(student_id, _subject_key(subj_id))
            except Exception as e:
                logger.warning(f"[PROGRESS_REPORT] demonstration read failed for {student_id} {subj_id}: {e}")
                demo[subj_id] = None

        def cell(subj_id: str, sid: str) -> Dict[str, Any]:
            """{state, gate, via} for one grid subskill. Without a learner graph the
            subskill's own lifecycle gate decides, as before."""
            d = demo.get(subj_id)
            own = state[sid]["gate"] if sid in state else None
            if d:
                key = lsv._resolve_key(d["lg"], sid, grade_doc)
                st = d["states"].get(key) if key else None
                if st:
                    via = st["via"]
                    return {"state": st["state"], "gate": st["gate"] if st["gate"] is not None else own,
                            "via": _clean_description(d["lg"].nodes.get(via, {}).get("label")).split(" Focus:")[0] if via else None}
            legacy = (None if own is None else "mastered" if own == 4 else "learning" if own >= 1 else "tried")
            return {"state": legacy, "gate": own, "via": None}

        subjects_out = []
        # Per-subskill evidence for every grade-map subskill with any (burst-excluded answers,
        # lifecycle gate and lessons). The journey skills panel reads this.
        subskill_stats: Dict[str, Dict[str, Any]] = {}
        for subj_id, units in (trees.get(grade_doc) or {}).items():
            key = _subject_key(subj_id)
            S = {"subject": subj_id, "name": _SUBJECT_NAMES.get(key, key.replace("_", " ").title()),
                 "total": 0, "mastered": 0, "shown": 0, "learning": 0, "tried": 0, "units": []}
            for u in units:
                U = {"unit_id": u.get("unit_id"), "title": u["title"], "total": 0, "mastered": 0, "shown": 0,
                     "learning": 0, "skills": []}
                for sk in u["skills"]:
                    cells = [cell(subj_id, sid) for sid in sk["subskills"]]
                    for c in cells:
                        S["total"] += 1
                        U["total"] += 1
                        if c["state"] in ("mastered", "shown", "learning"):
                            S[c["state"]] += 1; U[c["state"]] += 1
                        elif c["state"] == "tried":
                            S["tried"] += 1
                    U["skills"].append({"skill_id": sk.get("skill_id"),
                                        "description": _clean_description(sk["description"]),
                                        "gates": [c["gate"] for c in cells], "cells": cells})
                    for sid in sk["subskills"]:
                        at = by_sid.get(sid, [])
                        if sid in state or at:
                            subskill_stats[sid] = {
                                "gate": state[sid]["gate"] if sid in state else None,
                                "answers": len(at),
                                "accuracy": round(sum(a["score"] for a in at) / len(at) * 10) if at else None,
                                "lessons": state[sid]["lessons"] if sid in state else 0,
                            }
                S["units"].append(U)
            subjects_out.append(S)

        # 6. strengths, current work, struggles
        def row(s):
            return {k: s[k] for k in ("subskill_id", "description", "source_description", "parent_summary", "unit", "subject", "grade", "gate",
                                      "answers", "accuracy", "mastered_on", "last_seen")}
        recent_mastered = sorted((row(s) for s in state.values() if s["mastered_on"]),
                                 key=lambda r: r["mastered_on"], reverse=True)[:8]
        in_progress = sorted((row(s) for s in state.values() if 1 <= s["gate"] < 4),
                             key=lambda r: r["last_seen"] or "", reverse=True)[:8]
        needs_practice = sorted(
            (row(s) for s in state.values()
             if s["gate"] < 4 and ((s["fails"] >= 2 and (s["pass_rate"] or 1) < 0.7)
                                   or (s["accuracy"] is not None and s["answers"] >= 3 and s["accuracy"] < 70))),
            key=lambda r: (r["accuracy"] if r["accuracy"] is not None else 100))[:6]

        misconceptions = []
        for m in (await self.fs.get_active_misconceptions(student_id)).values():
            sid = m.get("subskill_id") or ""
            misconceptions.append({
                "pattern": m.get("misconception_text"),
                "detected_on": str(m.get("last_detected_at") or "")[:10] or None,
                "confidence": m.get("confidence"),
                **{k: v for k, v in meta(sid).items() if k in ("subskill_id", "description", "source_description", "parent_summary", "grade")},
            })
        misconceptions.sort(key=lambda m: m["detected_on"] or "", reverse=True)

        # 7. interests and where time goes
        interest_words = {w.rstrip("s") for i in interests for w in re.findall(r"[a-z]{4,}", i.lower())}
        subject_minutes: Counter = Counter()
        grade_mix: Counter = Counter()
        prim_n: Counter = Counter()
        prim_score: Dict[str, float] = defaultdict(float)
        interest_answers = 0
        for s in sessions:
            per = minutes(s) / len(s)
            for a in s:
                m = pick(a["sid"])
                subject_minutes[m.get("subject_id") or _subject_key(a["subject"])] += per
                if m:
                    grade_mix[_grade_code(m.get("grade"))] += 1
                if a["primitive"]:
                    prim_n[a["primitive"]] += 1
                    prim_score[a["primitive"]] += a["score"]
                hay = f'{a["primitive"] or ""} {m.get("subskill_description") or ""}'.lower()
                if interest_words and any(w in hay for w in interest_words):
                    interest_answers += 1

        recent_cut = today - timedelta(days=RECENT_DAYS)
        recent = [a for a in attempts if a["t"].date() >= recent_cut]
        last8 = [w for w in weeks.values() if w["answers"]][-8:]

        # Grades grown past (learner model, T1 ruling 10-12): 60% of a grade's
        # skills shown, each one opening the next grade. The report leads with it.
        grown_past: List[Dict[str, Any]] = []
        try:
            for subj in ("MATHEMATICS", "LANGUAGE_ARTS", "SCIENCE", "SOCIAL_STUDIES"):
                prof = await lsv.profile(student_id, subj, top=0)
                for gp in (prof or {}).get("grown_past") or []:
                    grown_past.append({"subject": subj, "name": _SUBJECT_NAMES.get(subj, subj.title()),
                                       "grade": _grade_code(gp["grade"]), "at": gp.get("at"),
                                       "now_learning": _grade_code(prof.get("reach_grade"))})
        except Exception as e:
            logger.warning(f"[PROGRESS_REPORT] grown-past read failed for {student_id}: {e}")

        return {
            "student_id": student_id,
            "grade": _grade_code(grade_doc),
            "grown_past": grown_past,
            "as_of": today.isoformat(),
            "interests": interests,
            "first_activity": attempts[0]["t"].date().isoformat() if attempts else None,
            "last_activity": attempts[-1]["t"].date().isoformat() if attempts else None,
            "recent": {
                "days": RECENT_DAYS,
                "active_days": len({a["t"].date() for a in recent}),
                "minutes": round(sum(minutes(s) for s in sessions if s[0]["t"].date() >= recent_cut)),
                "answers": len(recent),
                "mastered": sum(1 for s in state.values() if s["mastered_on"] and s["mastered_on"] >= recent_cut.isoformat()),
            },
            "accuracy_recent_weeks": (round(sum(w["score"] for w in last8) / sum(w["answers"] for w in last8) * 10)
                                      if last8 else None),
            "typical_session_minutes": (round(sorted(minutes(s) for s in sessions[-40:])[len(sessions[-40:]) // 2])
                                        if sessions else None),
            "weeks": [{"week_of": d.isoformat(), "minutes": round(w["minutes"]), "active_days": len(w["days"]),
                       "answers": w["answers"],
                       "accuracy": round(w["score"] / w["answers"] * 10) if w["answers"] else None,
                       "checks_passed": w["checks_passed"], "mastered": w["mastered"]}
                      for d, w in weeks.items()],
            "grade_map": subjects_out,
            "subskill_stats": subskill_stats,
            "recent_mastered": recent_mastered,
            "in_progress": in_progress,
            "needs_practice": needs_practice,
            "misconceptions": misconceptions,
            "time_by_subject": [{"subject": k, "name": _SUBJECT_NAMES.get(k, k.replace("_", " ").title()),
                                 "minutes": round(v)} for k, v in subject_minutes.most_common()],
            "grade_mix": [{"grade": g, "answers": n} for g, n in sorted(
                grade_mix.items(), key=lambda x: -1 if x[0] in ("PK", "K") else int(x[0]) if x[0].isdigit() else 99)],
            "favorite_activities": [{"primitive_type": p, "answers": n, "accuracy": round(prim_score[p] / n * 10)}
                                    for p, n in prim_n.most_common(8)],
            "interest_answers": interest_answers,
            "evidence": {
                "answers": len(attempts), "sessions": len(sessions),
                "active_days": len({a["t"].date() for a in attempts}),
                "excluded_burst_answers": len(raw) - len(attempts),
                "burst_days": sorted({d.isoformat() for d, _ in bursts}),
            },
        }
