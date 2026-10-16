"""
One reader for real and simulated reviews.

A review becomes an `Evidence` row: which subskill, which primitive and eval
mode, when, and the FIRST-TRY result of every challenge. The per-challenge
results are found the way `_find_challenge_results` in
`app/api/endpoints/problems.py` finds them (a list of dicts that each carry a
numeric `attempts`), so the lab sees exactly what the profile's "First-try"
stat sees. Simulated reviews are written in the same shape, so both go
through this file.

`final_score` is the review's own 0-10 score: what production IRT is fed
today (retry-until-correct primitives pin it at 10).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from app.services.learner_model.service import first_try_of

from .graph import Graph


@dataclass
class Evidence:
    node: int
    subskill_id: str
    primitive: str
    mode: str
    ts: str
    first: List[bool]
    final_score: float
    source: str


def _as_dict(v) -> dict:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return {}
    return v if isinstance(v, dict) else {}


def challenge_results(review: dict) -> Optional[list]:
    sw = _as_dict(_as_dict(review.get("problem_content")).get("student_work"))
    metrics = _as_dict(_as_dict(_as_dict(review.get("full_review")).get("metadata")).get("metrics"))
    for src in (sw, metrics):
        for v in src.values():
            if isinstance(v, list) and v and all(isinstance(e, dict) and isinstance(e.get("attempts"), (int, float)) for e in v):
                return v
    return None


def node_lookup(g: Graph) -> Dict[str, int]:
    """Bare subskill id -> node, for ids that occur once in this subject's grades."""
    seen: Dict[str, List[int]] = {}
    for k, nd in enumerate(g.nodes):
        seen.setdefault(nd.sid, []).append(k)
    return {sid: ks[0] for sid, ks in seen.items() if len(ks) == 1}


def from_review(review: dict, lookup: Dict[str, int]) -> Optional[Evidence]:
    node = lookup.get(review.get("subskill_id"))
    res = challenge_results(review)
    if node is None or not res:
        return None
    md = _as_dict(_as_dict(review.get("full_review")).get("metadata"))
    try:
        final = float(review.get("score"))
    except (TypeError, ValueError):
        final = 10.0
    return Evidence(node=node, subskill_id=review["subskill_id"], primitive=md.get("primitive_type") or "unknown",
                    mode=md.get("eval_mode") or "default", ts=str(review.get("timestamp")),
                    first=first_try_of(res),
                    final_score=final, source=review.get("source_system") or "real")


def load_reviews(path: Path, g: Graph) -> List[Evidence]:
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    lookup = node_lookup(g)
    ev = [e for e in (from_review(r, lookup) for r in rows) if e]
    return sorted(ev, key=lambda e: e.ts)
