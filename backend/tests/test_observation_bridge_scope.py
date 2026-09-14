import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app.api.endpoints import student_profile as endpoint


def test_context_requires_the_source_hypothesis_exact_published_scope(monkeypatch):
    scope = dict(subject='MATHEMATICS', grade='4', skill_id='NBT004-01', subskill_id='NBT004-01-b', curriculum_version='live@now')
    monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=scope))
    record = dict(hypothesis_id='h', revision=1, misconception_text='bare digit worth', scope_context=scope)
    store = SimpleNamespace(get_active_misconceptions=AsyncMock(return_value={'place-value-chart::NBT004-01': record}))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    async def run():
        request = endpoint.RetestContextIn(primitive_type='place-value-chart', scope=scope)
        assert (await endpoint.misconception_opportunity_context(request, {'student_id': 42}))['available']
        other = endpoint.RetestContextIn(primitive_type='base-ten-blocks', scope=scope)
        assert (await endpoint.misconception_opportunity_context(other, {'student_id': 42}))['reason'] == 'legacy-or-missing-hypothesis'
        for field in ('grade', 'subskill_id', 'curriculum_version'):
            record['scope_context'] = {**scope, field: 'different'}
            assert not (await endpoint.misconception_opportunity_context(request, {'student_id': 42}))['available']
        endpoint.resolve_scope.return_value = None
        assert (await endpoint.misconception_opportunity_context(request, {'student_id': 42}))['reason'] == 'unresolved-published-scope'
    asyncio.run(run())
