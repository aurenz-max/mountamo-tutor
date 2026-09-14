"""Project a capture payload into the delivery packet the backend signs at lesson launch, with the
production packet code and no Firestore, Firebase user or login.

    python scripts/project_learning_observation.py <capture.json> <scope.json> [--check-published] [--key KEY]

capture.json: {"misconception_text", "learning_observation": {...}, "primitive_type", "skill_id",
               "hypothesis_id"?, "revision"?} as POSTed to /api/student-profile/misconceptions.
scope.json: the objective's scope {subject, grade, skill_id, subskill_id}.

Prints {"packet": <payload object>} — the unsigned payload `delivery_packet` builds for a lesson whose one
objective is that scope and whose owner holds that one hypothesis. The record is stamped as resolve_scope
would stamp it from the requested scope; --check-published runs the real resolve_scope read-only against the
published curriculum instead. With --key, also prints "signed": {payload, signature} exactly as the
generation-context endpoint would issue it under that key, so the TypeScript verifier can be checked
against a Python-signed packet (replay-delivery.mjs --key).
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.learning_observations import delivery_packet, hypothesis_key


class _IdentityResolver:
    async def resolve(self, value):
        return value


class _OfflineStore:
    _resolver = _IdentityResolver()


async def main():
    capture = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    scope = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    stamped = {**scope, 'curriculum_version': scope.get('curriculum_version', 'offline-projection')}
    if '--check-published' in sys.argv:
        from app.db.firestore_service import FirestoreService
        from app.services.learning_observations import resolve_scope
        stamped = await resolve_scope(FirestoreService(), scope)
        if not stamped:
            print(json.dumps({'packet': None, 'reason': 'scope does not resolve in the published curriculum'}))
            return
    record = {'scope': 'skill', 'status': 'active', 'scope_context': stamped, 'primitive_type': capture['primitive_type'],
              'misconception_text': capture['misconception_text'], 'learning_observation': capture['learning_observation'],
              'hypothesis_id': capture.get('hypothesis_id', 'replay'), 'last_detected_at': '2026-01-01T00:00:00Z',
              **({'revision': capture['revision']} if isinstance(capture.get('revision'), int) else {})}
    key = hypothesis_key(capture['primitive_type'], capture.get('skill_id') or stamped['skill_id'])
    scopes = [{'subskillId': scope['subskill_id'], 'skillId': scope.get('skill_id'), 'published': stamped}]
    packet = await delivery_packet(_OfflineStore(), {key: record}, scopes, 0)
    out = {'packet': packet}
    if '--key' in sys.argv:
        os.environ['LUMINA_GENERATION_SIGNING_KEY'] = sys.argv[sys.argv.index('--key') + 1]
        from app.core.generation_auth import sign_learning_observations
        payload = json.dumps(packet, separators=(',', ':'), ensure_ascii=False)
        out['signed'] = {'payload': payload, 'signature': sign_learning_observations(payload)}
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
