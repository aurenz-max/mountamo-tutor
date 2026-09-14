"""Real Firestore transactions with generated items and synthetic observations.

Creates one collision-checked disposable student and deletes only its own docs.
Does not claim HTTP authentication, canonical learning fan-out or microphone QA.
"""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import secrets
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT / 'backend/.env')
from app.db.firestore_service import FirestoreService
from app.services import learning_observations as scoping


async def main():
    artifact = Path(sys.argv[1]).resolve()
    saved = json.loads(artifact.read_text(encoding='utf-8'))
    items = saved['candidateItems']
    # The compiler now certifies accepted answers; older artifacts predate the field.
    items = [dict(i, accepted_answers=[i['answer_text']] + ([str(i['digit'] * 10 ** i['place'])] if i['kind'] == 'say_value' else []))
             for i in items]
    assert items and sum(i['eligible'] for i in items) == 2
    store = FirestoreService()
    scope = await scoping.resolve_scope(store, dict(subject='MATHEMATICS', grade='4',
        skill_id='NBT004-01', subskill_id='NBT004-01-b'))
    assert scope
    run_id = f'place-value-opportunity-qa-{uuid4()}'
    student_id = 900000000 + secrets.randbelow(99999999)
    student = store.client.collection('students').document(str(student_id))
    student.create({'qa_probe_run': run_id})
    hypothesis_ref = store._misconceptions_subcollection(student_id).document('place-value-chart::NBT004-01')
    receipts = student.collection('misconception_opportunities')
    report = dict(synthetic=True, scope=scope, generated_artifact=str(artifact.relative_to(ROOT)),
                  boundary='Real Firestore; synthetic diagnosis and response events; no HTTP, microphone or learning fan-out.', tests=[])

    async def diagnose():
        return await store.add_or_update_misconception(student_id, 'place-value-chart', 'skill',
            'The student gives the bare digit for its worth regardless of position.', run_id,
            skill_id=scope['skill_id'], subskill_id=scope['subskill_id'], scope_context=scope)

    try:
        hypothesis = await diagnose()
        plan = dict(primitive_type='place-value-chart', scope=scope, instance_id=run_id, lesson_id=run_id,
            hypothesis_id=hypothesis['hypothesis_id'], revision=hypothesis['revision'],
            capability_id='digit_face_value_for_worth', capability_version=1, policy_version='place-value-immediate-retest-v1',
            compiler_version='place-value-items-v1', mode='compare', tier='medium',
            content_hash=saved['contentHash'], items=items)
        assert await store.issue_misconception_opportunity(student_id, {**plan, 'items': []}) is None
        report['tests'].append('empty compiled plan rejected')
        receipt = await store.issue_misconception_opportunity(student_id, plan)
        assert receipt
        persisted = receipts.document(receipt).get().to_dict()
        assert persisted['student_id'] == student_id and persisted['items'] == items
        report['tests'].append('issued and persisted against live published scope')
        events = []
        for i, item in enumerate(items):
            turn = (i + 1) * 1000
            sequence = [dict(kind='presented')]
            if item['eligible']:
                sequence.extend([dict(kind='response', source='voice', turn_opened_at=turn,
                    turn_closed_at=turn + 100, during_tutor_audio=False),
                    dict(kind='transcript', text=item['answer_text'], turn_opened_at=turn),
                    dict(kind='affirmed', turn_opened_at=turn)])
            sequence.append(dict(kind='completed', solved=True, corrections=0))
            for event in sequence:
                events.append(dict(event, seq=len(events), item_id=item['id']))
        evidence = dict(content_hash=plan['content_hash'], completed=True, events=events)
        binding = dict(student_id=student_id, instance_id=run_id, lesson_id=run_id,
                       scope=scope, primitive_type='place-value-chart')
        wrong = deepcopy(evidence)
        next(e for e in wrong['events'] if e['kind'] == 'transcript')['text'] = 'wrong'
        assert not await store.resolve_misconception_opportunity(student_id, receipt, run_id, wrong, binding)
        assert hypothesis_ref.get().to_dict()['status'] == 'active'
        report['tests'].append('wrong response preserves active hypothesis')
        # Separate worker threads cause real Firestore transaction contention.
        def consume(attempt):
            return asyncio.run(store.resolve_misconception_opportunity(student_id, receipt, attempt, evidence, binding))
        attempts = [f'{run_id}-a', f'{run_id}-b']
        results = await asyncio.gather(*(asyncio.to_thread(consume, attempt) for attempt in attempts))
        assert sorted(results) == [False, True]
        winner = attempts[results.index(True)]
        assert hypothesis_ref.get().to_dict()['resolved_attempt_id'] == winner
        assert receipts.document(receipt).get().to_dict()['consumed_attempt_id'] == winner
        report['tests'].append('concurrent consumers resolve exactly once with matching attempt references')
        hypothesis = await diagnose()
        plan['revision'] = hypothesis['revision']
        stale_receipt = await store.issue_misconception_opportunity(student_id, plan)
        assert stale_receipt
        replacement = await diagnose()
        assert replacement['revision'] == hypothesis['revision'] + 1
        assert not await store.resolve_misconception_opportunity(student_id, stale_receipt, run_id, evidence, binding)
        assert hypothesis_ref.get().to_dict()['status'] == 'active'
        report['tests'].append('new diagnosis rejects earlier revision receipt')
        report['status'] = 'PASS'
    finally:
        assert student.get().to_dict().get('qa_probe_run') == run_id, 'Refusing cleanup: owner marker changed'
        for snapshot in receipts.stream():
            assert snapshot.to_dict().get('lesson_id') == run_id
            snapshot.reference.delete()
        snapshot = hypothesis_ref.get()
        if snapshot.exists:
            assert snapshot.to_dict().get('source_attempt_id') == run_id
            hypothesis_ref.delete()
        student.delete()
        assert not student.get().exists and not hypothesis_ref.get().exists and not list(receipts.stream())
        report['cleanup'] = 'verified absent'
        (artifact.parent / 'real-store-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
