"""Progress report prose — Gemini writes words about computed facts, never facts.

Three outputs, each cached so a report costs at most a few small calls a day:
  - narrative (PR-3): the short answer, section headlines and ledes, written
    from a digest of the report numbers. Code decides every verdict (is the work
    too easy?) and the model only phrases it. Any number in the output that is
    not in the digest rejects the whole narrative; the page then keeps its
    templated sentences. Cached per student per day at
    students/{id}/reports/{yyyy-mm-dd}, keyed by a hash of the digest.
  - parent summaries (PR-2): the curriculum publish pipeline writes
    `parent_summary` onto every subskill (curriculum-authoring-service
    app/services/parent_summaries.py), and the report rows carry it. Only an id
    without one (an unpublished or retired subskill) is summarized here, cached
    at parent_text_subskills/{subskill_id} with a hash of its description.
  - at-home tips (PR-4): one activity per mistake pattern or struggling skill,
    keyed by the pattern (not the student) at parent_tips/{key}, so every child
    with the same pattern shares one reviewed-or-reviewable tip.
Queue: my-tutoring-app/qa/parent-report/ROADMAP.md.
"""

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from google import genai
from google.genai.types import GenerateContentConfig, ThinkingConfig

from ..core.config import settings

logger = logging.getLogger(__name__)

MODEL = "gemini-flash-latest"
LEARNING_BAND = (70, 85)
# A difficulty verdict needs this much recent evidence (2 answers in 1 week is not a pattern).
MIN_VERDICT_WEEKS = 3
MIN_VERDICT_ANSWERS = 30
# Items more than this many grades above the report grade get no home activity.
TIP_GRADE_REACH = 1

_client: Optional[genai.Client] = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _hash(obj: Any) -> str:
    return hashlib.sha1(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()[:16]


def _grade_num(g: Any) -> Optional[int]:
    g = str(g or "")
    return -1 if g == "PK" else 0 if g == "K" else int(g) if g.isdigit() else None


def _grade_name(g: str) -> str:
    return {"K": "Kindergarten", "PK": "Pre-K"}.get(g, f"Grade {g}")


async def _ask(prompt: str, schema: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """One structured Gemini call; None on any failure (callers fall back)."""
    try:
        resp = await _gemini().aio.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=GenerateContentConfig(response_mime_type="application/json",
                                         response_schema=schema, temperature=0.4,
                                         # Same output at ~5s instead of ~30s with default thinking (probed 10-08).
                                         thinking_config=ThinkingConfig(thinking_budget=512)),
        )
        return json.loads(resp.text)
    except Exception as e:
        logger.warning(f"progress report Gemini call failed: {e}")
        return None


# ---------------------------------------------------------------- digest

def build_digest(report: Dict[str, Any], name: str) -> Dict[str, Any]:
    """The only facts the narrative may use. Verdicts are computed here."""
    weeks = report["weeks"]
    active = [w for w in weeks if w["answers"]]
    recent = active[-8:]
    acc = report.get("accuracy_recent_weeks")
    above = sum(1 for w in recent if (w["accuracy"] or 0) > LEARNING_BAND[1])
    below = sum(1 for w in recent if (w["accuracy"] if w["accuracy"] is not None else 100) < LEARNING_BAND[0])
    if len(recent) < MIN_VERDICT_WEEKS or sum(w["answers"] for w in recent) < MIN_VERDICT_ANSWERS:
        difficulty = "There is not enough recent practice yet to say how hard the lessons are."
    elif acc is not None and acc > LEARNING_BAND[1] and above >= len(recent) / 2:
        difficulty = "They almost never miss, so lessons can be harder."
    elif acc is not None and acc < LEARNING_BAND[0]:
        difficulty = "Lessons are hard for them right now; steady practice on the skills listed below helps most."
    else:
        difficulty = "Lessons are at about the right difficulty."
    gm = report["grade_map"]
    units = sorted((u for s in gm for u in s["units"] if u["mastered"]),
                   key=lambda u: u["mastered"] / max(1, u["total"]), reverse=True)[:2]
    mix_total = sum(g["answers"] for g in report["grade_mix"]) or 0
    rg = _grade_num(report["grade"])
    ahead = sum(g["answers"] for g in report["grade_mix"]
                if _grade_num(g["grade"]) is not None and rg is not None and _grade_num(g["grade"]) > rg)
    practice_only = [p for p in report["needs_practice"]
                     if not any(m["subskill_id"] == p["subskill_id"] for m in report["misconceptions"])]
    return {
        "learner": name,
        "grade": _grade_name(report["grade"]),
        "weeks_shown": len(weeks),
        "weeks_with_practice": len(active),
        "practice_is_steady": len(active) >= len(weeks) * 0.6,
        "mastery_checks_passed_in_weeks_shown": sum(w["checks_passed"] for w in weeks),
        "typical_session_minutes": report.get("typical_session_minutes"),
        "percent_of_answers_right_lately": acc,
        "recent_active_weeks": len(recent),
        "recent_weeks_above_85_percent": above,
        "recent_weeks_below_70_percent": below,
        "difficulty": difficulty,
        "last_30_days": report["recent"],
        "skills_in_the_grade": sum(s["total"] for s in gm),
        "skills_mastered_in_the_grade": sum(s["mastered"] for s in gm),
        "skills_being_learned_in_the_grade": sum(s["learning"] for s in gm),
        "strongest_units": [{"unit": u["title"], "mastered": u["mastered"], "of": u["total"]} for u in units],
        "subjects": [{"subject": s["name"], "mastered": s["mastered"], "learning": s["learning"], "of": s["total"]} for s in gm],
        "percent_of_practice_above_grade": round(ahead / mix_total * 100) if mix_total else 0,
        "mistake_patterns_recorded": len(report["misconceptions"]),
        "skills_needing_practice": len(practice_only),
        "interests": report.get("interests", []),
    }


_NUM = re.compile(r"\d+(?:\.\d+)?")


def numbers_in(obj: Any) -> set:
    found: set = set()
    if isinstance(obj, dict):
        for v in obj.values():
            found |= numbers_in(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            found |= numbers_in(v)
    elif isinstance(obj, bool) or obj is None:
        pass
    else:
        found |= {n.rstrip("0").rstrip(".") if "." in n else n for n in _NUM.findall(str(obj))}
    return found


def ungrounded_numbers(text_fields: Dict[str, str], digest: Dict[str, Any]) -> List[str]:
    """Numbers in the prose that the digest does not contain (the "4" of "4 checks" is allowed)."""
    allowed = numbers_in(digest) | {"4", "70", "85"}
    return sorted(numbers_in(text_fields) - allowed)


# ------------------------------------------------------------- narrative

NARRATIVE_SCHEMA = {
    "type": "object",
    "properties": {
        "short_answer": {"type": "string"},
        "learning_headline": {"type": "string"},
        "learning_lede": {"type": "string"},
        "year_lede": {"type": "string"},
        "help_lede": {"type": "string"},
    },
    "required": ["short_answer", "learning_headline", "learning_lede", "year_lede", "help_lede"],
}

NARRATIVE_PROMPT = """You write the text of a progress report a parent reads about their child's learning app.

Facts (the ONLY information you may use):
{digest}

Write these fields:
- short_answer: 3-5 sentences answering "how is my child doing?". Cover practice habits, how often answers are right, what is mastered, and the one most useful thing to know next (the "difficulty" fact, in your own words). If mistake patterns were recorded, end by saying they are worth a few minutes at home.
- learning_headline: under 10 words, answers "are they learning?".
- learning_lede: 1-2 sentences backing the headline with the weekly numbers.
- year_lede: 1-2 sentences with the skills total, mastered and learning numbers.
- help_lede: 1 sentence introducing the list of patterns below it.

Rules:
- Use digits for every number, and only numbers that appear in the facts. Never compute new numbers (no sums, differences or new percentages).
- Write the way a teacher talks to a parent, not like a data readout: no field names, no "percent correct is 95 percent", no "grade skills".
- Use the child's name once, in the first sentence of short_answer. Everywhere else say "they".
- Do not repeat a number in the same field. Headlines carry no more than one number.
- Leave out counts of zero ("0 weeks below 70 percent"); say nothing about that fact instead.
- Plain, warm, specific sentences. No exclamation marks, no metaphors, no em-dashes.
- Never guess a cause, diagnose, or compare the child with other children.
- Call the child "{learner}". Do not invent details about them.
"""


async def write_narrative(report: Dict[str, Any], name: str) -> Dict[str, Any]:
    digest = build_digest(report, name)
    out = await _ask(NARRATIVE_PROMPT.format(digest=json.dumps(digest, indent=1), grade=digest["grade"],
                                             learner=name), NARRATIVE_SCHEMA)
    if not out or not all(isinstance(out.get(k), str) and out[k].strip() for k in NARRATIVE_SCHEMA["required"]):
        return {"narrative": None, "rejected": "no_output", "digest_hash": _hash([digest, NARRATIVE_PROMPT])}
    text = {k: out[k].strip()[:1].upper() + out[k].strip()[1:] for k in NARRATIVE_SCHEMA["required"]}
    bad = ungrounded_numbers(text, digest)
    if bad:
        logger.warning(f"narrative rejected, ungrounded numbers {bad}")
        return {"narrative": None, "rejected": f"ungrounded_numbers:{','.join(bad)}", "digest_hash": _hash([digest, NARRATIVE_PROMPT])}
    return {"narrative": text, "rejected": None, "digest_hash": _hash([digest, NARRATIVE_PROMPT])}


# ------------------------------------------------------ parent summaries

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {"id": {"type": "string"}, "summary": {"type": "string"}},
        "required": ["id", "summary"]}}},
    "required": ["items"],
}

SUMMARY_PROMPT = """Rewrite each curriculum skill description below as one short sentence a parent understands.

Rules:
- At most 14 words. Start with a verb ("Hears the first sound in a word, like /c/ in cat").
- Say what the child can do. Drop app and tool names (anything like "sound-wave-explorer", "drag", "toggle", "tap"), teacher notes, "Focus:" text and lesson instructions.
- Keep concrete examples that help (letters, number ranges). Do not add facts.
- Return every id exactly as given.

Skills:
{items}
"""


async def parent_summaries(fs, items: List[Dict[str, Any]]) -> Dict[str, str]:
    """{subskill_id: parent sentence}, generating only missing or stale ones."""
    col = fs.client.collection("parent_text_subskills")
    want = {i["subskill_id"]: i for i in items if i.get("subskill_id") and i.get("source")}
    if not want:
        return {}
    have: Dict[str, str] = {}
    missing = []
    refs = [col.document(sid) for sid in want]
    for snap in fs.client.get_all(refs):
        d = snap.to_dict() if snap.exists else None
        src = want[snap.id]
        if d and d.get("source_hash") == _hash(src["source"]):
            have[snap.id] = d["summary"]
        else:
            missing.append(src)
    for start in range(0, len(missing), 25):
        chunk = missing[start:start + 25]
        out = await _ask(SUMMARY_PROMPT.format(items=json.dumps(
            [{"id": c["subskill_id"], "description": c["source"]} for c in chunk], indent=1)), SUMMARY_SCHEMA)
        for item in (out or {}).get("items", []):
            sid, summary = item.get("id"), (item.get("summary") or "").strip()
            if sid in want and summary and len(summary.split()) <= 20:
                have[sid] = summary
                col.document(sid).set({"summary": summary, "source_hash": _hash(want[sid]["source"]),
                                       "model": MODEL, "reviewed": False,
                                       "created_at": datetime.now(timezone.utc).isoformat()})
    return have


# ---------------------------------------------------------- at-home tips

TIP_SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {"key": {"type": "string"}, "tip": {"type": "string"}},
        "required": ["key", "tip"]}}},
    "required": ["items"],
}

TIP_PROMPT = """For each item below, write one activity a parent can do at home in 5 minutes to help.

Rules:
- 2-3 sentences, at most 50 words. Use ordinary household things (food, toys, socks, spoons).
- Make the child do the thinking; the parent sets it up and asks. Never give the parent a script that hands the child the answer.
- For a mistake pattern, the activity should make the correct idea visible (for subtraction: start with a pile, take some away, count what is left).
- Match the grade given. No screens, no worksheets, no exclamation marks.
- Return every key exactly as given.

Items:
{items}
"""


def tip_key(kind: str, subskill_id: str, pattern: str = "") -> str:
    return f"{kind}-{_hash([subskill_id, pattern])}"


async def home_tips(fs, items: List[Dict[str, Any]]) -> Dict[str, str]:
    """{key: tip} for each item {key, kind, grade, skill, pattern?}; cached by key."""
    col = fs.client.collection("parent_tips")
    want = {i["key"]: i for i in items}
    if not want:
        return {}
    have: Dict[str, str] = {}
    missing = []
    for snap in fs.client.get_all([col.document(k) for k in want]):
        if snap.exists and (snap.to_dict() or {}).get("tip"):
            have[snap.id] = snap.to_dict()["tip"]
        else:
            missing.append(want[snap.id])
    if missing:
        out = await _ask(TIP_PROMPT.format(items=json.dumps(
            [{"key": m["key"], "grade": m["grade"], "skill": m["skill"],
              **({"mistake_pattern": m["pattern"]} if m.get("pattern") else {"situation": "answers on this skill are mostly wrong"})}
             for m in missing], indent=1)), TIP_SCHEMA)
        for item in (out or {}).get("items", []):
            k, tip = item.get("key"), (item.get("tip") or "").strip()
            if k in want and tip and len(tip.split()) <= 70:
                have[k] = tip
                col.document(k).set({"tip": tip, **{f: want[k].get(f) for f in ("kind", "grade", "skill", "pattern")},
                                     "model": MODEL, "reviewed": False,
                                     "created_at": datetime.now(timezone.utc).isoformat()})
    return have


# ----------------------------------------------------------------- compose

async def get_narrative(fs, student_id: int, report: Dict[str, Any], name: str) -> Dict[str, Any]:
    """Summaries, tips and narrative for one report. Every part degrades to absent, never to an error."""
    # Published parent summaries come from the curriculum; generate only for ids without one.
    rows = report["recent_mastered"] + report["in_progress"] + report["needs_practice"] + report["misconceptions"]
    published = {r["subskill_id"]: r["parent_summary"] for r in rows if r.get("parent_summary")}
    index_desc = {r["subskill_id"]: r.get("source_description") or r.get("description")
                  for r in rows if r["subskill_id"] not in published}
    summary_items = [{"subskill_id": sid, "source": src} for sid, src in index_desc.items() if src]

    rg = _grade_num(report["grade"])
    tip_items, tip_keys = [], {}
    practice_only = [p for p in report["needs_practice"]
                     if not any(m["subskill_id"] == p["subskill_id"] for m in report["misconceptions"])]
    for m in report["misconceptions"]:
        g = _grade_num(m.get("grade"))
        if g is not None and rg is not None and g - rg > TIP_GRADE_REACH:
            continue
        k = tip_key("pattern", m["subskill_id"], m["pattern"])
        tip_keys[f'pattern:{m["subskill_id"]}'] = k
        tip_items.append({"key": k, "kind": "pattern", "grade": _grade_name(m.get("grade") or report["grade"]),
                          "skill": m.get("description") or "", "pattern": m["pattern"]})
    for p in practice_only:
        g = _grade_num(p.get("grade"))
        if g is not None and rg is not None and g - rg > TIP_GRADE_REACH:
            continue
        k = tip_key("practice", p["subskill_id"])
        tip_keys[f'practice:{p["subskill_id"]}'] = k
        tip_items.append({"key": k, "kind": "practice", "grade": _grade_name(p.get("grade") or report["grade"]),
                          "skill": p.get("description") or ""})

    # narrative: reuse today's if the facts have not changed
    # The prompt is part of the key, so editing it regenerates today's text.
    digest_hash = _hash([build_digest(report, name), NARRATIVE_PROMPT])
    day_ref = fs._student_doc(student_id).collection("reports").document(report["as_of"])

    async def narrative():
        snap = day_ref.get()
        if snap.exists and (snap.to_dict() or {}).get("digest_hash") == digest_hash and snap.to_dict().get("narrative"):
            return snap.to_dict()["narrative"], None
        res = await write_narrative(report, name)
        if res["narrative"]:
            day_ref.set({"digest_hash": res["digest_hash"], "narrative": res["narrative"], "model": MODEL,
                         "created_at": datetime.now(timezone.utc).isoformat()})
        return res["narrative"], res["rejected"]

    (text, rejected), summaries, tips = await asyncio.gather(
        narrative(), parent_summaries(fs, summary_items), home_tips(fs, tip_items))
    return {
        "as_of": report["as_of"],
        "narrative": text,
        "narrative_rejected": rejected,
        "summaries": {**summaries, **published},
        "tips": {slot: tips[k] for slot, k in tip_keys.items() if k in tips},
    }
