"""
Level A attempt simulator: review records a primitive would really write,
answered by a simulated child.

Templates come from real reviews (student 1004), one per primitive x eval
mode: how many challenges a review holds, and whether the primitive ever
recorded a retry (attempts > 1). A primitive that never recorded a retry is
simulated as one-shot. Whether it CAN record a miss is unknown until the
component is driven for real (Level C).

Playing a review: the truth model gives each challenge's first-try
probability from the item's registry beta and the child's effective ability;
a retry-capable primitive lets a wrong first try be retried (feedback halves
the remaining gap, up to 3 attempts); every challenge is also practice. The
output is a review dict in the real shape, read back by evidence.py.

The simulated child works through the curriculum in order (grade, unit,
skill, subskill), a few reviews per subskill on the primitive real lessons
used for it, which is how real streams look.
"""

from __future__ import annotations

import collections
import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

from app.services.calibration.problem_type_registry import PROBLEM_TYPE_REGISTRY, get_item_discrimination, get_prior_beta

from .evidence import _as_dict, challenge_results
from .graph import Graph, Item
from .truth import TruthStudent

MAX_ATTEMPTS = 3
RETRY_HELP = 0.5


@dataclass
class Template:
    sizes: Dict[int, int]
    retry: bool
    n_reviews: int


DEFAULT = Template(sizes={4: 1}, retry=False, n_reviews=0)


def harvest(review_paths: List[Path]) -> Dict[str, Template]:
    acc: Dict[str, dict] = collections.defaultdict(lambda: {"sizes": collections.Counter(), "retry": False, "n": 0})
    for path in review_paths:
        for r in json.loads(Path(path).read_text(encoding="utf-8")):
            md = _as_dict(_as_dict(r.get("full_review")).get("metadata"))
            res = challenge_results(r)
            if not md.get("primitive_type") or not res:
                continue
            a = acc[f"{md['primitive_type']}|{md.get('eval_mode') or 'default'}"]
            a["n"] += 1
            a["sizes"][len(res)] += 1
            a["retry"] |= any((e.get("attempts") or 1) > 1 for e in res)
    return {k: Template(sizes=dict(v["sizes"]), retry=v["retry"], n_reviews=v["n"]) for k, v in acc.items()}


def usage(review_paths: List[Path]) -> Dict[str, collections.Counter]:
    """subskill id -> Counter of 'primitive|mode' real lessons used for it."""
    u: Dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for path in review_paths:
        for r in json.loads(Path(path).read_text(encoding="utf-8")):
            md = _as_dict(_as_dict(r.get("full_review")).get("metadata"))
            if md.get("primitive_type") and challenge_results(r):
                u[r.get("subskill_id")][f"{md['primitive_type']}|{md.get('eval_mode') or 'default'}"] += 1
    return u


class Simulator:
    def __init__(self, g: Graph, templates: Dict[str, Template], used: Dict[str, collections.Counter], subject: str):
        self.g, self.templates, self.used, self.subject = g, templates, used, subject

    def _choose(self, k: int, rng: random.Random) -> str:
        nd = self.g.nodes[k]
        real = self.used.get(nd.sid)
        if real:
            keys, w = zip(*real.items())
            return rng.choices(keys, weights=w)[0]
        modes = [it.mode for it in nd.items] or ["default"]
        return f"{nd.primitive}|{rng.choice(modes)}"

    def play(self, truth: TruthStudent, k: int, rng: random.Random, when: datetime) -> dict:
        nd = self.g.nodes[k]
        key = self._choose(k, rng)
        prim, mode = key.split("|", 1)
        tpl = self.templates.get(key) or DEFAULT
        n = rng.choices(list(tpl.sizes), weights=list(tpl.sizes.values()))[0]
        a, c = get_item_discrimination(prim, mode)
        it = Item(node=k, mode=mode, beta=get_prior_beta(prim, mode), a=a, c=c)
        results = []
        for i in range(n):
            p = truth.p_right(it)
            correct = rng.random() < p
            attempts = 1
            q = p
            while not correct and tpl.retry and attempts < MAX_ATTEMPTS:
                attempts += 1
                q = q + (1 - q) * RETRY_HELP
                correct = rng.random() < q
            truth._practice(k, p)
            results.append({"challengeId": f"ch{i + 1}", "attempts": attempts, "correct": correct})
        n_correct = sum(r["correct"] for r in results)
        return {
            "subject": self.subject,
            "subskill_id": nd.sid, "skill_id": nd.skill.split(":", 1)[1],
            "timestamp": when.isoformat(), "score": round(10.0 * n_correct / n, 1),
            "source_system": "sim_level_a",
            "full_review": {"metadata": {"primitive_type": prim, "eval_mode": mode, "metrics": {
                "challengesTotal": n, "challengesCorrect": n_correct,
                "attemptsCount": sum(r["attempts"] for r in results),
                "firstTryCount": sum(r["attempts"] == 1 and r["correct"] for r in results)}}},
            "problem_content": {"student_work": {"challengeResults": results}},
        }

    def stream(self, truth: TruthStudent, n_reviews: int, seed: int, per_subskill=(2, 4), grade_band=None) -> List[dict]:
        """Curriculum walk: subskills in published order, a few reviews each."""
        rng = random.Random(seed)
        order = sorted(range(self.g.n), key=lambda k: (self.g.nodes[k].grade.replace("GK", "G0"),
                                                       self.g.nodes[k].unit, self.g.nodes[k].skill, self.g.nodes[k].key))
        if grade_band:
            order = [k for k in order if self.g.nodes[k].grade in grade_band]
        when = datetime(2026, 3, 1, 16, 0, tzinfo=timezone.utc)
        out: List[dict] = []
        i = 0
        while len(out) < n_reviews and order:
            k = order[i % len(order)]
            for _ in range(rng.randint(*per_subskill)):
                out.append(self.play(truth, k, rng, when))
                when += timedelta(minutes=rng.randint(2, 6))
                if len(out) >= n_reviews:
                    break
            if rng.random() < 0.3:
                when += timedelta(days=1)
            i += 1
        return out
