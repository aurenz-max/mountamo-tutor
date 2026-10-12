"""
Learner graph: the Jev prerequisite graph the learner model runs on.

One graph per subject spanning grades, published by
`scripts/graph_jev_pilot/publish_learner_graph.py` to
`learner_graphs/{SUBJECT}/versions/{active_version}/nodes`. Separate from the
curriculum's typed-edge graph (curriculum_graphs), which Pulse uses for
discovery and variety; this one answers "what must be in place before this
subskill" and "what does this subskill unlock".

Node keys are "{grade}:{subskill_id}" with the curriculum grade key
("Kindergarten", "1".."12") because bare subskill ids repeat across grades.
Each node lists its prerequisites: relation R (performed inside it),
E (an easier version learned first) or related, Jev scores, and in_model
(the top 3 the learner model uses).

Check `validation` before relying on a subject: only hand-labelled subjects
have a measured accuracy.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..db.firestore_service import FirestoreService
from .curriculum_scope import grade_key, subject_key

COLLECTION = "learner_graphs"
_TTL_S = 600
_cache: Dict[str, tuple] = {}


@dataclass
class LearnerGraph:
    subject: str
    version: str
    validation: dict
    nodes: Dict[str, dict]
    _children: Dict[str, List[dict]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for key, node in self.nodes.items():
            for p in node.get("parents", []):
                self._children.setdefault(p["key"], []).append({**p, "key": key})

    @staticmethod
    def key(grade: str, subskill_id: str) -> Optional[str]:
        g = grade_key(grade)
        return f"{g}:{subskill_id}" if g else None

    def prerequisites(self, key: str, in_model_only: bool = True) -> List[dict]:
        """What must be in place before `key`, strongest first."""
        ps = self.nodes.get(key, {}).get("parents", [])
        return [p for p in ps if p["in_model"]] if in_model_only else list(ps)

    def unlocks(self, key: str, in_model_only: bool = True) -> List[dict]:
        """Subskills that list `key` as a prerequisite."""
        cs = self._children.get(key, [])
        return [c for c in cs if c["in_model"]] if in_model_only else list(cs)


async def get_learner_graph(fs: FirestoreService, subject: str) -> Optional[LearnerGraph]:
    """The active learner graph for a subject (any spelling), cached 10 minutes;
    None when the subject has not been published."""
    s = subject_key(subject)
    hit = _cache.get(s)
    if hit and time.time() - hit[0] < _TTL_S:
        return hit[1]
    root = fs.client.collection(COLLECTION).document(s).get()
    if not root.exists or not (root.to_dict() or {}).get("active_version"):
        _cache[s] = (time.time(), None)
        return None
    vid = root.to_dict()["active_version"]
    vref = fs.client.collection(COLLECTION).document(s).collection("versions").document(vid)
    meta = vref.get().to_dict() or {}
    nodes = {d.id: d.to_dict() for d in vref.collection("nodes").stream()}
    lg = LearnerGraph(subject=s, version=vid, validation=meta.get("validation", {}), nodes=nodes)
    _cache[s] = (time.time(), lg)
    return lg
