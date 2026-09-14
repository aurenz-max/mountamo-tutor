"""Learning observations: scope resolution, capture models, delivery and projections.

The backend knows nothing about individual primitives. What it knows:

* A hypothesis is SERVER-DELIVERED when it carries a ``scope_context`` — the
  canonical published scope the backend resolved at capture. The frontend
  catalog declares which primitives capture that way (``observationDelivery``),
  the learner-authenticated capture POST relays the declaration, and the
  backend either resolves a published scope or refuses the write. From then on
  every rule is a record property: the prose never reaches the client manifest,
  a score or client tag never resolves it, generators read it from the signed
  delivery packet issued at lesson launch (``delivery_packet``), and only a
  certified retest receipt (misconception_receipts.py) can resolve it.
* Everything else is the legacy client-delivered loop: prose to the manifest
  as remediationFocus, resolved by a matching tag at score >= 80.
"""
from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, Field, model_validator

SCOPE_KEYS = ("subject", "grade", "skill_id", "subskill_id", "curriculum_version")


def hypothesis_key(primitive_type, skill_id=None):
    """Document id of a hypothesis: primitive alone, or primitive::skill for skill scope."""
    return f"{primitive_type}::{skill_id}" if skill_id else primitive_type


def is_server_delivered(record):
    """A stamped published scope is the certificate that capture went through resolve_scope."""
    return bool(record.get("scope_context"))


async def resolve_scope(store, requested):
    """Canonical parent + published revision, with no skill-ID string slicing.

    Any canonical subject; an unpublished subject/grade simply resolves to None.
    """
    subject = requested.get("subject")
    grade = store.normalize_grade_code(requested.get("grade"))
    if grade == "UNKNOWN" or not isinstance(subject, str) or not subject or not requested.get("subskill_id"):
        return None
    subskill = await store._resolver.resolve(requested["subskill_id"])
    published = await store.get_published_curriculum(subject, grade=grade)
    if not published or not published.get("version_id") or not published.get("deployed_at"):
        return None
    node = published.get("subskill_index", {}).get(subskill)
    if not node or not node.get("skill_id"):
        return None
    skill = await store._resolver.resolve(node["skill_id"])
    if requested.get("skill_id") and await store._resolver.resolve(requested["skill_id"]) != skill:
        return None
    return dict(subject=subject, grade=grade, skill_id=skill, subskill_id=subskill,
                # The draft publisher copies version_id, but always advances
                # deployed_at. Bind both so re-publishing cannot reuse a scope.
                curriculum_version=f"{published['version_id']}@{published['deployed_at']}")


# ---------------------------------------------------------------------------
# Capture models
# ---------------------------------------------------------------------------

class ObservationPhaseIn(BaseModel):
    model_config = {"extra": "forbid"}
    itemId: str = Field(..., max_length=200)
    phase: str = Field(..., max_length=200)
    challenge: str = Field(..., max_length=2000)
    expected: str = Field(..., max_length=2000)
    observed: str = Field(..., max_length=2000)
    support: str = Field(..., max_length=600)


class LearningObservationIn(BaseModel):
    """Inspectable problem/phase packet attached to a misconception hypothesis."""
    model_config = {"extra": "forbid"}
    subject: str = Field(..., max_length=120)
    grade: str = Field(..., max_length=30)
    evalMode: str = Field(..., max_length=120)
    problem: str = Field(..., max_length=2000)
    phases: list[ObservationPhaseIn] = Field(..., max_length=12)
    teachingImplication: str = Field(..., max_length=600)
    checkNext: str = Field(..., max_length=600)


class ResponseEvidenceIn(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    itemId: str = Field(min_length=1, max_length=200)
    phase: str = Field(min_length=1, max_length=200)
    challenge: str = Field(min_length=1, max_length=2000)
    expected: str = Field(min_length=1, max_length=2000)
    observed: str = Field(min_length=1, max_length=2000)
    verdict: Literal['affirmed', 'corrected']
    source: Literal['voice', 'gesture']
    priorCorrections: int = Field(ge=0, le=100, strict=True)
    hearTapsSoFar: int = Field(ge=0, le=1000, strict=True)
    support: str = Field(min_length=1, max_length=600)


class ResponseObservationIn(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    primitive_type: str = Field(min_length=1, max_length=120, pattern=r'^[a-z0-9-]+$')
    source_attempt_id: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=30)
    subskill_id: str = Field(min_length=1, max_length=200)
    skill_id: str | None = Field(default=None, max_length=200)
    eval_mode: str = Field(min_length=1, max_length=120)
    kind: Literal['strength', 'support']
    summary: str = Field(min_length=1, max_length=600)
    teachingImplication: str = Field(min_length=1, max_length=600)
    checkNext: str = Field(min_length=1, max_length=600)
    evidenceItemIds: list[str] = Field(min_length=2, max_length=40)
    responses: list[ResponseEvidenceIn] = Field(min_length=2, max_length=40)

    @model_validator(mode='after')
    def require_corroborating_evidence(self):
        if self.subskill_id in ('unknown', 'free-form'):
            raise ValueError('A resolved curriculum objective is required')
        ids = set(self.evidenceItemIds)
        affirmed = [r for r in self.responses if r.itemId in ids and r.verdict == 'affirmed']
        if len(ids) < 2 or ids != {r.itemId for r in affirmed} or len({r.phase for r in affirmed}) != 1:
            raise ValueError('Cite distinct successful items in one phase')
        if self.kind == 'support' and any(r.priorCorrections == 0 for r in affirmed):
            raise ValueError('Support observations require recorded corrections on cited successes')
        return self


# ---------------------------------------------------------------------------
# Profile projections (owner-only; no hypothesis, receipt or attempt-key leakage)
# ---------------------------------------------------------------------------

def project_misconception_observation(record_id, record):
    """Hypothesis with an inspectable packet -> profile row. Expected answers stay private."""
    detail = record['learning_observation']
    return dict(id=record_id, kind='pattern',
        status='resolved' if record.get('status') == 'resolved' else 'suspected',
        summary=record.get('misconception_text', ''), problem=detail.get('problem', ''),
        evalMode=detail.get('evalMode', ''), primitiveType=record.get('primitive_type', ''),
        subject=detail.get('subject', ''), grade=detail.get('grade', ''),
        subskillId=record.get('subskill_id') or '', updatedAt=record.get('last_detected_at', ''),
        teachingImplication=detail.get('teachingImplication', ''), checkNext=detail.get('checkNext', ''),
        evidence=[dict(attemptId=record.get('source_attempt_id', ''), task=p.get('challenge', ''),
            response=p.get('observed', ''), support=p.get('support', ''), phase=p.get('phase', ''),
            itemId=p.get('itemId', '')) for p in detail.get('phases', [])])


def project_response_observation(record_id, record):
    """Keep answer keys private, qualify speech, and expose the reference limitation."""
    cited = set(record['evidenceItemIds'])
    return dict(id='response:' + record_id, kind=record['kind'], status='suspected',
        summary=record['summary'], subject=record['subject'], grade=record['grade'],
        subskillId=record['subskill_id'], primitiveType=record['primitive_type'],
        evalMode=record['eval_mode'], updatedAt=record['created_at'],
        teachingImplication=record['teachingImplication'], checkNext=record['checkNext'],
        evidence=[dict(attemptId=record['source_attempt_id'], itemId=r['itemId'], phase=r['phase'],
            task=r['challenge'], response=f"{r['observed']} ({'unverified transcription' if r['source'] == 'voice' else 'recorded manipulation'}; judge {r['verdict']})",
            support=r['support'], referenceKind='client-attempt') for r in record['responses'] if r['itemId'] in cited])


# ---------------------------------------------------------------------------
# Delivery packet (signed once at lesson launch; read by the generation server)
# ---------------------------------------------------------------------------

PACKET_VERSION = 1
PACKET_TTL_SECONDS = 2 * 60 * 60
MAX_PACKET_HYPOTHESES = 50
EVIDENCE_KEYS = ('phase', 'challenge', 'expected', 'observed', 'support')


async def delivery_packet(store, records, scopes, student_id, now=None):
    """The owner's deliverable hypotheses plus the canonical published scope of
    each lesson objective. Retrieval only: which records may be delivered is a
    record property (stamped scope, active, skill scope, non-blank text) and the
    stamped skill is lineage-resolved so the generation server matches by string
    equality. Per-task selection, ordering, evidence bounds and the delivered
    shape are defined in TypeScript (service/generation/learningObservationPacket.ts).
    No attempt ids, receipts or status leave here."""
    issued = now or datetime.now(timezone.utc)
    hypotheses = []
    for record in records.values():
        stamped = record.get('scope_context') or {}
        if (not is_server_delivered(record) or record.get('status') != 'active' or record.get('scope') != 'skill'
                or not str(record.get('misconception_text') or '').strip() or not stamped.get('skill_id')):
            continue
        packet = record.get('learning_observation') or {}
        hypotheses.append({
            'hypothesisId': str(record.get('hypothesis_id') or record.get('created_at') or ''),
            **({'revision': record['revision']} if isinstance(record.get('revision'), int) else {}),
            'primitiveType': record.get('primitive_type') or '',
            'summary': record['misconception_text'][:4000],
            'scope': {k: stamped.get(k) for k in SCOPE_KEYS},
            'skillId': await store._resolver.resolve(stamped['skill_id']),
            'lastDetectedAt': record.get('last_detected_at') or '',
            **({'evidence': {'problem': packet.get('problem') or '', 'evalMode': packet.get('evalMode') or '',
                'phases': [{k: p.get(k) or '' for k in EVIDENCE_KEYS} for p in (packet.get('phases') or [])[:12]]}}
               if packet else {}),
        })
    hypotheses.sort(key=lambda h: h['lastDetectedAt'], reverse=True)
    return {'v': PACKET_VERSION, 'studentId': str(student_id), 'issuedAt': issued.isoformat(),
            'expiresAt': (issued + timedelta(seconds=PACKET_TTL_SECONDS)).isoformat(),
            'scopes': scopes, 'hypotheses': hypotheses[:MAX_PACKET_HYPOTHESES]}
