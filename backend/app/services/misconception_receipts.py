"""Certified retest receipts: the only way a server-delivered hypothesis resolves.

Primitive-agnostic. The signed generation server compiles the retest items and
certifies them — that is where primitive knowledge lives. The backend binds the
plan to one hypothesis revision at one published scope, stores it opaquely
(capability, policy and compiler versions are provenance, not policy), and at
submission time checks the ordered browser observations against the plan's own
accepted answers.
"""
import math
import re

from .learning_observations import SCOPE_KEYS

MAX_ITEMS = 50
MAX_EVENTS = 500
PROVENANCE_KEYS = ("primitive_type", "lesson_id", "instance_id", "capability_id", "policy_version", "compiler_version")


def _normalized(text):
    return re.sub(r"[\s,.!?\-]+", " ", str(text).lower()).strip()


def _accepted_answers(item):
    """Normalized transcripts the compiler certified for this item; empty when malformed."""
    answers = item.get("accepted_answers")
    if (not isinstance(answers, list) or not 1 <= len(answers) <= 20
            or any(not isinstance(a, str) or not a.strip() for a in answers)):
        return set()
    return {_normalized(a) for a in answers}


def validate_plan(plan, hypothesis):
    """Bind a compiled plan to one active hypothesis revision at its stamped scope.

    Eligibility of the lesson to host the retest is the signed compiler's call;
    here a plan is valid when its provenance is complete, its scope is the
    hypothesis's published scope, and every eligible item carries the answers
    it will be judged against.
    """
    if any(not isinstance(plan.get(k), str) or not plan[k] for k in PROVENANCE_KEYS):
        return False
    scope = plan.get("scope") or {}
    if any(not isinstance(scope.get(k), str) or not scope[k] for k in SCOPE_KEYS):
        return False
    if not isinstance(plan.get("content_hash"), str) or not re.fullmatch(r"[a-f0-9]{64}", plan["content_hash"]):
        return False
    stamped = hypothesis.get("scope_context") or {}
    if any(stamped.get(k) != scope[k] for k in ("subject", "grade", "skill_id", "curriculum_version")):
        return False
    if (hypothesis.get("status") != "active" or hypothesis.get("scope") != "skill"
            or hypothesis.get("primitive_type") != plan["primitive_type"]
            or not hypothesis.get("hypothesis_id") or not hypothesis.get("revision")
            or plan.get("hypothesis_id") != hypothesis["hypothesis_id"]
            or plan.get("revision") != hypothesis["revision"]):
        return False
    items = plan.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS or any(not isinstance(i, dict) for i in items):
        return False
    ids = [i.get("id") for i in items]
    if len({i for i in ids if isinstance(i, str) and i}) != len(items):
        return False
    targets = [i for i in items if i.get("eligible") is True]
    return bool(targets) and all(_accepted_answers(i) for i in targets)


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def validates_observations(plan, evidence, binding):
    """Ordered browser observations are consistency evidence, not audio attestation.

    Every compiled item must open/close in order. Each eligible item must have
    exactly one voiced response, an agreeing transcript + affirmation, no repeat,
    correction, resync or hint. A failed target vetoes the whole retest.
    """
    if any(plan.get(k) != binding.get(k) for k in ("student_id", "instance_id", "lesson_id", "primitive_type", "scope")):
        return False
    if evidence.get("content_hash") != plan.get("content_hash") or evidence.get("completed") is not True:
        return False
    events = evidence.get("events")
    if not isinstance(events, list) or len(events) > MAX_EVENTS:
        return False
    items = plan["items"]
    index, current, log = 0, None, []
    last_verified_turn_end = -1
    for seq, event in enumerate(events):
        if not isinstance(event, dict) or event.get("seq") != seq:
            return False
        kind = event.get("kind")
        if kind == "presented":
            if current or index >= len(items) or event.get("item_id") != items[index]["id"]:
                return False
            current, log = items[index], []
        elif current is None or event.get("item_id") != current["id"]:
            return False
        elif kind == "completed":
            if current.get("eligible"):
                if [e["kind"] for e in log] != ["response", "transcript", "affirmed"]:
                    return False
                opened, closed = log[0].get("turn_opened_at"), log[0].get("turn_closed_at")
                if (not _finite(opened) or not _finite(closed)
                        or opened <= last_verified_turn_end or closed < opened
                        or log[0].get("during_tutor_audio") is not False
                        or {e.get("turn_opened_at") for e in log} != {opened}):
                    return False
                last_verified_turn_end = closed
                if log[0].get("source") != "voice" or _normalized(log[1].get("text", "")) not in _accepted_answers(current):
                    return False
                if event.get("solved") is not True or event.get("corrections") != 0:
                    return False
            index += 1
            current = None
        elif kind in {"response", "transcript", "affirmed", "corrected", "repeat", "resync", "unavailable"}:
            log.append(event)
        else:
            return False
    return current is None and index == len(items)
