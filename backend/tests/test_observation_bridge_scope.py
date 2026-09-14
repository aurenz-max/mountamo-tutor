"""The retest read moved into the launch packet: the backend ships the chart's own hypothesis with its
stamped scope and the objective's live published scope; the generation server (learningObservationPacket.ts,
`retestHypothesis`) requires them to match exactly. Here: the packet carries what that comparison needs and
never an attempt reference."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.learning_observations import delivery_packet


def test_packet_carries_the_source_hypothesis_identity_and_the_live_published_scope():
    scope = dict(subject='MATHEMATICS', grade='4', skill_id='NBT004-01', subskill_id='NBT004-01-b', curriculum_version='live@now')
    record = dict(primitive_type='place-value-chart', status='active', scope='skill', hypothesis_id='h', revision=1,
                  misconception_text='bare digit worth', scope_context=scope, source_attempt_id='attempt-secret')
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value)))
    scopes = [{'subskillId': 'NBT004-01-b', 'skillId': 'NBT004-01', 'published': scope}]
    packet = asyncio.run(delivery_packet(store, {'place-value-chart::NBT004-01': record}, scopes, 42))
    [own] = packet['hypotheses']
    assert own['hypothesisId'] == 'h' and own['revision'] == 1 and own['primitiveType'] == 'place-value-chart'
    assert own['scope'] == scope and packet['scopes'][0]['published'] == scope
    assert 'attempt-secret' not in str(packet)
    # A hypothesis stamped under another publication keeps its own stamp; the generation server, not the
    # backend, decides that it cannot be retested against the live scope (and can still be shared).
    stale = asyncio.run(delivery_packet(store, {'k': {**record, 'scope_context': {**scope, 'curriculum_version': 'older'}}}, scopes, 42))
    assert stale['hypotheses'][0]['scope']['curriculum_version'] == 'older' and stale['scopes'][0]['published'] == scope
    # No identity: deliverable for sharing, but no revision to bind a receipt to.
    legacy = asyncio.run(delivery_packet(store, {'k': {**record, 'hypothesis_id': None, 'revision': None}}, scopes, 42))
    assert legacy['hypotheses'][0]['hypothesisId'] == '' and 'revision' not in legacy['hypotheses'][0]
