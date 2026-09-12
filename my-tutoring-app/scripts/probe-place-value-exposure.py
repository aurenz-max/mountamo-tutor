"""Real-store S4 transport only. Never claims a valid four-digit curriculum join."""
import asyncio
import json
import secrets
import sys
from pathlib import Path
from uuid import uuid4
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from app.api.endpoints import student_profile
from app.db.firestore_service import FirestoreService

class NoCompetency:
    async def get_competency(self, **_kwargs):
        return None
class NoMapping:
    retrieval_matcher = None

async def main():
    run_id = f'place-value-qa-{uuid4().hex}'
    store = FirestoreService()
    student_id = 900000000 + secrets.randbelow(99999999)
    student_ref = store.client.collection('students').document(str(student_id))
    # Atomic create refuses any existing record, including a concurrently created one.
    student_ref.create({'qa_probe_run': run_id})
    key = 'place-value-chart::NBT003-02'
    record = store._misconceptions_subcollection(student_id).document(key)
    original = student_profile.get_firestore_service
    try:
        if record.get().exists:
            raise RuntimeError('Probe-key collision; refusing to alter existing record')
        await store.add_or_update_misconception(student_id, 'place-value-chart', 'skill',
            'The student interprets digit worth as its face value regardless of position.', run_id,
            subskill_id='NBT003-02-a', skill_id='NBT003-02', confidence='high', evidence_tier='judge')
        student_profile.get_firestore_service = lambda: store
        result = await student_profile.get_generation_context(
            student_profile.GenerationContextRequest(student_id=student_id, topic='Digit worth in three-digit numbers',
                grade_level='3', subject='Mathematics', include_persona=False,
                objectives=[student_profile.ObjectiveIn(id='place-value-qa', text='Identify the value of each digit in a three-digit number',
                    verb='identify', subskill_id='NBT003-02-a', skill_id='NBT003-02')]),
            user_context={}, competency_service=NoCompetency(), mapping_service=NoMapping())
        active = next(r for r in result['activeMisconceptions'] if r['misconceptionKey'] == key)
        assert active['skillId'] == 'NBT003-02' and active['subskillId'] == 'NBT003-02-a'
        result_packet = {'gate': 'S4', 'status': 'PASS', 'synthetic': True, 'key': key,
            'skillId': active['skillId'], 'subskillId': active['subskillId'],
            'boundary': 'Real-store exposure only; manually seeded synthetic diagnosis. Not S1 or four-digit production attribution.'}
    finally:
        student_profile.get_firestore_service = original
        snapshot = record.get()
        if snapshot.exists and snapshot.to_dict().get('source_attempt_id') == run_id:
            record.delete()
        snapshot = student_ref.get()
        if snapshot.exists and snapshot.to_dict().get('qa_probe_run') == run_id:
            student_ref.delete()
    assert not record.get().exists and not student_ref.get().exists, 'Probe cleanup did not complete'
    print(json.dumps({**result_packet, 'cleanup': 'verified absent'}))

asyncio.run(main())
