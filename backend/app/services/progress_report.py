"""Progress report — the facts behind "how is my child doing?".

One call composes a parent-readable report from data we already store. Every
number here is deterministic code; prose (PR-3) and at-home tips (PR-4) are
written by an LLM over THIS payload later and never compute anything.
Queue: my-tutoring-app/qa/parent-report/ROADMAP.md (PR-1).

Rules this module holds:
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
        index: Dict[str, Dict[str, Any]] = {}
        trees: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(dict)
        # Kindergarten first so a K id wins any (rare) duplicate across grade docs.
        grade_docs = sorted(self.fs.client.collection("curriculum_published").stream(),
                            key=lambda g: 0 if g.id == "Kindergarten" else 1)
        for g in grade_docs:
            for s in g.reference.collection("subjects").stream():
                d = s.to_dict() or {}
                for sid, meta in (d.get("subskill_index") or {}).items():
                    index.setdefault(sid, {**meta, "subject_id": s.id})
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

        def meta(sid: str) -> Dict[str, Any]:
            m = index.get(sid) or {}
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

        # 5. the grade map, one cell per subskill
        subjects_out = []
        # Per-subskill evidence for every grade-map subskill with any (burst-excluded answers,
        # lifecycle gate and lessons). The journey skills panel reads this.
        subskill_stats: Dict[str, Dict[str, Any]] = {}
        for subj_id, units in (trees.get(grade_doc) or {}).items():
            key = _subject_key(subj_id)
            S = {"subject": subj_id, "name": _SUBJECT_NAMES.get(key, key.replace("_", " ").title()),
                 "total": 0, "mastered": 0, "learning": 0, "tried": 0, "units": []}
            for u in units:
                U = {"unit_id": u.get("unit_id"), "title": u["title"], "total": 0, "mastered": 0, "learning": 0, "skills": []}
                for sk in u["skills"]:
                    gates = []
                    for sid in sk["subskills"]:
                        g = state[sid]["gate"] if sid in state else None
                        gates.append(g)
                        S["total"] += 1
                        U["total"] += 1
                        if g == 4:
                            S["mastered"] += 1; U["mastered"] += 1
                        elif g is not None and g >= 1:
                            S["learning"] += 1; U["learning"] += 1
                        elif g == 0:
                            S["tried"] += 1
                    U["skills"].append({"skill_id": sk.get("skill_id"),
                                        "description": _clean_description(sk["description"]), "gates": gates})
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
                m = index.get(a["sid"]) or {}
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

        return {
            "student_id": student_id,
            "grade": _grade_code(grade_doc),
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
