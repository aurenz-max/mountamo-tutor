"""Attempt notes: one short factual note per finished activity, kept by unit, skill and subskill.

After a submission the frontend's note step reads the attempt's record and
writes what the child was asked and what they gave ("said 'sign' when asked to
blend the sounds for sun"). The backend's part is storage and retrieval:

* ``note_home`` files a note under its canonical unit / skill / subskill from
  the published curriculum, or refuses it. Client ids are a lookup key only.
* ``packet_notes`` flattens the stored notes of a lesson's units into the rows
  that ride the signed launch packet (``learning_observations.delivery_packet``).

Which notes apply to an assignment, and what a generator does with one, is
decided in TypeScript (``service/attemptNotes``). The backend names no
primitive and makes no model call. Notes are a read model: they never select a
lesson, set a gate or feed calibration.
"""
import hashlib
from typing import Literal, Optional

from pydantic import BaseModel, Field

MAX_PACKET_NOTES = 60


class NoteSignalIn(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    kind: Literal["strength", "struggle"]
    what: str = Field(min_length=1, max_length=200)
    evidence: str = Field(default="", max_length=600)


class AttemptNoteIn(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    primitive_type: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    source_attempt_id: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=120)
    grade: Optional[str] = Field(default=None, max_length=30)
    subskill_id: str = Field(min_length=1, max_length=200)
    eval_mode: Optional[str] = Field(default=None, max_length=120)
    score: Optional[float] = Field(default=None, ge=0, le=100)
    did: str = Field(default="", max_length=240)
    signals: list[NoteSignalIn] = Field(default_factory=list, max_length=2)


async def note_home(store, curriculum_service, subject, subskill_id):
    """Canonical unit / skill / subskill of a subskill id, or None when it has no published home."""
    if not subskill_id or subskill_id in ("unknown", "free-form"):
        return None
    subskill = await store._resolver.resolve(subskill_id)
    if not subskill:
        return None
    meta = await curriculum_service.get_subskill_metadata(subskill, subject)
    if not meta or not meta.get("unit_id") or not meta.get("skill_id"):
        return None
    return {"unit_id": meta["unit_id"], "skill_id": await store._resolver.resolve(meta["skill_id"]) or meta["skill_id"],
            "subskill_id": subskill}


def note_record(note, home, subject, grade):
    """The stored document: the note as written plus the home the backend resolved."""
    return {
        "schema_version": 1, "primitive_type": note["primitive_type"], "source_attempt_id": note["source_attempt_id"],
        "subject": subject, "grade": grade, **home,
        "eval_mode": note.get("eval_mode") or "", "score": note.get("score"),
        "did": note.get("did") or "", "signals": note.get("signals") or [], "notable": bool(note.get("signals")),
    }


def packet_notes(records, subject):
    """Stored notes -> packet rows, one per signal, newest first. No attempt ids and no quoted evidence leave here."""
    rows = []
    for record_id, record in records:
        if record.get("subject") != subject:
            continue
        for index, signal in enumerate(record.get("signals") or []):
            what = str(signal.get("what") or "").strip()
            if signal.get("kind") not in ("strength", "struggle") or not what:
                continue
            rows.append({
                "id": "note-" + hashlib.sha256(f"{record_id}:{index}".encode()).hexdigest()[:12],
                "kind": signal["kind"], "what": what[:200], "at": record.get("created_at") or "",
                "grade": record.get("grade") or "", "unitId": record.get("unit_id") or "",
                "skillId": record.get("skill_id") or "", "subskillId": record.get("subskill_id") or "",
                "primitiveType": record.get("primitive_type") or "",
            })
    rows.sort(key=lambda r: r["at"], reverse=True)
    return rows[:MAX_PACKET_NOTES]
