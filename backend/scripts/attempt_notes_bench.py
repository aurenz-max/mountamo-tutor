"""Attempt-notes harness: real stored attempts in, the production store and launch packet out.

    python scripts/attempt_notes_bench.py dump   <student> <since ISO date> <out.json>
    python scripts/attempt_notes_bench.py store  <student> <notes.json> [--apply]
    python scripts/attempt_notes_bench.py packet <student> <targets.json> <out.json>

dump   Read-only. The student's reviews since the date that carry the workspace's per-item record, each with the
       home the production ``note_home`` files it under (rows with no published home are dropped and counted).
store  Writes the notes produced by ``my-tutoring-app/scripts/attempt-notes-replay.mjs notes`` through the
       production ``save_attempt_note`` (create-once, so a re-run changes nothing). Dry run without --apply.
packet For each target {subject, grade, subskill_id} builds the packet exactly as /generation-context does
       (resolve_scope, note_home, get_attempt_notes, packet_notes, delivery_packet) and signs it with
       LUMINA_GENERATION_SIGNING_KEY. No login; the packet is the credential.

Makes no model call. Pair with the node script for the note writer and the generation replay.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.api.endpoints.student_profile import _normalize_subject  # noqa: E402
from app.core.generation_auth import sign_learning_observations  # noqa: E402
from app.db.firestore_service import FirestoreService  # noqa: E402
from app.services.attempt_notes import note_home, note_record, packet_notes  # noqa: E402
from app.services.curriculum_service import CurriculumService  # noqa: E402
from app.services.learning_observations import delivery_packet, resolve_scope  # noqa: E402


async def services():
    store = FirestoreService()
    curriculum = CurriculumService(firestore_service=store)
    await curriculum.initialize()
    return store, curriculum


async def dump(student, since, out):
    store, curriculum = await services()
    rows, homeless = [], 0
    for snapshot in store._student_doc(student).collection('reviews').where('timestamp', '>=', since).stream():
        r = snapshot.to_dict()
        full, content = r.get('full_review') or {}, r.get('problem_content') or {}
        work, meta = content.get('student_work'), full.get('metadata') or {}
        if not isinstance(work, dict) or not work.get('learningResponses'):
            continue
        subject = _normalize_subject(full.get('subject') or r.get('subject')) or full.get('subject') or r.get('subject')
        home = await note_home(store, curriculum, subject, full.get('subskill_id') or r.get('subskill_id'))
        if not home:
            homeless += 1
            continue
        metrics = {k: v for k, v in (meta.get('metrics') or {}).items() if k != 'componentTallies'}
        rows.append({'attempt_id': r.get('attempt_id') or r.get('id'), 'at': r.get('timestamp'), 'subject': subject, **home,
            'unit': full.get('unit_title'), 'skill': full.get('skill_description'), 'subskill': full.get('subskill_description'),
            'primitive_type': meta.get('primitive_type'), 'eval_mode': meta.get('eval_mode'), 'score': full.get('score'),
            'metrics': metrics, 'work': work})
    rows.sort(key=lambda row: row['at'] or '')
    Path(out).write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({'attempts_with_item_record_and_home': len(rows), 'dropped_no_published_home': homeless}))


async def save(student, path, apply):
    store, _ = await services()
    notes = json.loads(Path(path).read_text(encoding='utf-8'))
    stored = 0
    for n in notes:
        if not n.get('note') or not n.get('primitive_type'):
            continue
        record = note_record({'primitive_type': n['primitive_type'], 'source_attempt_id': n['attempt_id'], 'eval_mode': n.get('eval_mode'),
            'score': None if n.get('score') is None else float(n['score']) * 10, 'did': n['note']['did'], 'signals': n['note']['signals']},
            {k: n[k] for k in ('unit_id', 'skill_id', 'subskill_id')}, n['subject'], n.get('grade') or '')
        record['created_at'] = n['at']
        if apply:
            await store.save_attempt_note(student, record)
        stored += 1
    print(json.dumps({'notes': stored, 'notable': sum(1 for n in notes if (n.get('note') or {}).get('signals')), 'applied': apply}))


async def packet(student, targets_path, out):
    store, curriculum = await services()
    cases = []
    for target in json.loads(Path(targets_path).read_text(encoding='utf-8')):
        subject = target['subject']
        published = await resolve_scope(store, {'subject': subject, 'grade': target.get('grade'), 'subskill_id': target['subskill_id']})
        home = await note_home(store, curriculum, subject, target['subskill_id'])
        scope = {'subskillId': target['subskill_id'], 'skillId': (home or {}).get('skill_id'), 'published': published,
                 **({'unitId': home['unit_id'], 'unitSkillId': home['skill_id']} if home else {})}
        built = await delivery_packet(store, {}, [scope], student)
        notes = packet_notes(await store.get_attempt_notes(student, [scope.get('unitId')]), subject)
        if notes:
            built['notes'] = notes
        payload = json.dumps(built, separators=(',', ':'), ensure_ascii=False)
        cases.append({'target': target, 'packet': built, 'signed': {'payload': payload, 'signature': sign_learning_observations(payload)}})
        print(json.dumps({'subskill': target['subskill_id'], 'unit': scope.get('unitId'), 'published': bool(published), 'notes': len(notes)}))
    Path(out).write_text(json.dumps(cases, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    command, student = sys.argv[1], int(sys.argv[2])
    if command == 'dump':
        asyncio.run(dump(student, sys.argv[3], sys.argv[4]))
    elif command == 'store':
        asyncio.run(save(student, sys.argv[3], '--apply' in sys.argv))
    elif command == 'packet':
        asyncio.run(packet(student, sys.argv[3], sys.argv[4]))
    else:
        raise SystemExit(__doc__)
