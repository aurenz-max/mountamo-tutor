"""Component mastery: per-student tallies one level below the subskill.

A component is a small part a subskill is made of (a letter-sound pair, a single
math fact). The frontend owns what the kinds are and how a session's work maps
onto component ids (my-tutoring-app .../service/componentMastery). This module
knows neither: it cleans the rows a submission carries and folds them into
counters keyed by (kind, id). No primitive and no subject is named here.

Storage (FirestoreService):
  L0  attempt doc field `component_evidence`: [{kind, id, attempts, correct}]
  L2  students/{sid}/component_mastery/{kind}:
        {kind, student_id, updated_at,
         components: {id: {attempts, correct, last_at}}}
The L2 doc is incremented inside save_attempt and is rebuildable from L0 by
scripts/backfill_component_mastery.py.

The tallies are a read model. They never select a lesson, set a mastery gate
or feed calibration.
"""

import re
from typing import Any, Dict, List

KIND_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
MAX_ROWS = 200
MAX_ID_LENGTH = 40
MAX_COUNT = 1000


def clean_component_evidence(raw: Any) -> List[Dict[str, Any]]:
    """The valid rows of a submission's component evidence; a bad row is dropped.

    A row needs a kind matching KIND_PATTERN, a printable id of at most
    MAX_ID_LENGTH characters, 1 <= attempts <= MAX_COUNT and
    0 <= correct <= attempts. Rows for the same (kind, id) are added together.
    """
    if not isinstance(raw, list):
        return []
    merged: Dict[tuple, Dict[str, Any]] = {}
    for row in raw[:MAX_ROWS]:
        if not isinstance(row, dict):
            continue
        kind, cid = row.get("kind"), row.get("id")
        attempts, correct = row.get("attempts"), row.get("correct")
        if not isinstance(kind, str) or not KIND_PATTERN.match(kind):
            continue
        if not isinstance(cid, str) or not cid or len(cid) > MAX_ID_LENGTH or not cid.isprintable():
            continue
        if isinstance(attempts, bool) or isinstance(correct, bool):
            continue
        if not isinstance(attempts, int) or not isinstance(correct, int):
            continue
        if not (1 <= attempts <= MAX_COUNT) or not (0 <= correct <= attempts):
            continue
        entry = merged.setdefault((kind, cid), {"kind": kind, "id": cid, "attempts": 0, "correct": 0})
        entry["attempts"] += attempts
        entry["correct"] += correct
    return list(merged.values())


def tally_by_kind(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Dict[str, int]]]:
    """Cleaned rows as {kind: {id: {attempts, correct}}}."""
    out: Dict[str, Dict[str, Dict[str, int]]] = {}
    for row in rows:
        entry = out.setdefault(row["kind"], {}).setdefault(row["id"], {"attempts": 0, "correct": 0})
        entry["attempts"] += row["attempts"]
        entry["correct"] += row["correct"]
    return out


MAX_PACKET_COMPONENTS = 400


def packet_components(docs: List[Dict[str, Any]]) -> Dict[str, Dict[str, List[int]]]:
    """Stored tallies as the launch packet carries them: {kind: {id: [attempts, correct]}}.

    Every kind is passed through; which kinds a generator reads, and how, is the
    frontend's. A malformed entry is dropped. Each kind keeps its
    MAX_PACKET_COMPONENTS most-read ids.
    """
    out: Dict[str, Dict[str, List[int]]] = {}
    for doc in docs:
        kind, comps = doc.get("kind"), doc.get("components")
        if not isinstance(kind, str) or not KIND_PATTERN.match(kind) or not isinstance(comps, dict):
            continue
        rows = []
        for cid, entry in comps.items():
            if not isinstance(cid, str) or not cid or len(cid) > MAX_ID_LENGTH or not isinstance(entry, dict):
                continue
            attempts, correct = entry.get("attempts"), entry.get("correct")
            if isinstance(attempts, bool) or isinstance(correct, bool):
                continue
            if not isinstance(attempts, int) or not isinstance(correct, int) or not (0 <= correct <= attempts) or attempts < 1:
                continue
            rows.append((cid, attempts, correct))
        rows.sort(key=lambda r: -r[1])
        if rows:
            out[kind] = {cid: [a, c] for cid, a, c in rows[:MAX_PACKET_COMPONENTS]}
    return out
