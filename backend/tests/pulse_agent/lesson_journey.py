"""Replay content-aware journey evidence through Pulse's production service stack.

No cloud client is constructed. A frozen published curriculum/graph snapshot is
loaded into InMemoryFirestoreService; every persona/seed gets a separate store.
This audits the submission fan-out, not browser/audio transport. Held-out probe
answers remain private oracle evidence and are never submitted as lesson work.
"""
from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import uuid

from app.services.calibration_engine import CalibrationEngine
from app.services.mastery_lifecycle_engine import MasteryLifecycleEngine
from app.services.learning_paths import LearningPathsService
from app.services.pulse_engine import PulseEngine
from .full_loop import FullLoopRunner
from .in_memory_firestore import InMemoryFirestoreService


def build_stack(snapshot: dict) -> FullLoopRunner:
    fs = InMemoryFirestoreService()
    subject, grade = snapshot['subject'], snapshot['grade']
    fs.load_published_curriculum(subject, snapshot['curriculum'])
    if not snapshot.get('graph'):
        raise ValueError('A frozen published graph is required for next-target auditing')
    fs.load_curriculum_graph(f'{subject}_G{grade}', snapshot['graph'])
    engine = PulseEngine(fs, CalibrationEngine(fs), MasteryLifecycleEngine(fs),
                         LearningPathsService(fs, project_id='in-memory'))
    return FullLoopRunner(fs, engine, seed=42)


def group_submissions(attempts: list[dict], index: dict) -> tuple[list[dict], list[dict]]:
    """One aggregate per block, not N falsely independent lifecycle evaluations.

    Corrected responses use the shipped 100/67 correction weighting (one retry
    modeled in v1). The item ledger retains support, first response and oracle
    knowledge separately so an echo-success can be audited against engine state.
    """
    groups = defaultdict(list)
    skipped = []
    for a in attempts:
        loc = index.get(a.get('subskillId'))
        if not loc or loc.get('skill_id') != a.get('skillId'):
            skipped.append({'instanceId': a['instanceId'], 'itemId': a['itemId'],
                            'reason': 'Missing or mismatched published curriculum lineage'})
            continue
        if not a.get('accessible'):
            skipped.append({'instanceId': a['instanceId'], 'itemId': a['itemId'],
                            'reason': 'Inaccessible interaction: no observed submission'})
            continue
        groups[(a['instanceId'], a['componentId'], a['skillId'], a['subskillId'])].append(a)
    submissions = []
    for (instance, primitive, skill, subskill), rows in groups.items():
        modes = {r['evalMode'] for r in rows}
        mode = next(iter(modes)) if len(modes) == 1 else 'mixed'
        # These are the existing catalog-to-backend spelling conventions.
        if primitive == 'letter-sound-link':
            mode = mode.replace('-', '_')
        score = round(sum(10 if r['firstCorrect'] else 6.7 if r['finalCorrect'] else 0 for r in rows) / len(rows), 2)
        submissions.append({'instanceId': instance, 'primitiveType': primitive,
                            'skillId': skill, 'subskillId': subskill, 'evalMode': mode,
                            'score': score, 'parts': len(rows),
                            'independentParts': sum(bool(r['independent']) for r in rows),
                            'echoParts': sum(r['responseRoute'] == 'echo' for r in rows)})
    return submissions, skipped


async def replay_run(run: dict, snapshot: dict, retention_days: int = 2) -> dict:
    stack = build_stack(snapshot)
    fs = stack.fs
    student_id = 990001  # private store per run, never a real student document
    fs._students[student_id] = {'student_id': student_id, 'grade_level': snapshot['grade']}
    fs.virtual_now = datetime(2026, 9, 5, 12, tzinfo=timezone.utc)
    timeline = []
    total_submissions = 0
    for lesson in run['lessons']:
        submissions, skipped = group_submissions(lesson['attempts'], snapshot['curriculum']['subskill_index'])
        for i, s in enumerate(submissions):
            before = await fs.get_student_ability(student_id, s['skillId'])
            attempt_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"journey/{run['profile']}/{run['seed']}/{lesson['packageId']}/{i}"))
            result = await stack.competency.update_competency_from_problem(
                student_id=student_id, subject=snapshot['subject'], skill_id=s['skillId'],
                subskill_id=s['subskillId'], evaluation={'score': s['score'], 'correct': s['score'] >= 7},
                source='lesson', primitive_type=s['primitiveType'], eval_mode=s['evalMode'],
                attempt_id=attempt_id, evidence_parts=s['parts'],
            )
            if not result or result.get('error'):
                raise RuntimeError(f'Production submission failed: {result}')
            after = await fs.get_student_ability(student_id, s['skillId'])
            if after is None or after == before:
                raise RuntimeError(f'Calibration failed silently for {s["primitiveType"]}/{s["evalMode"]}')
            if not await fs.get_mastery_lifecycle(student_id, s['subskillId']):
                raise RuntimeError('Mastery fan-out did not persist a lifecycle')
            total_submissions += 1
            s['attemptId'] = attempt_id
        stack.analytics._cache.clear()
        profile = await stack.analytics.get_student_profile(student_id)
        targets = await stack.analytics.select_session_targets(student_id, snapshot['subject'], grade=snapshot['grade'])
        lifecycles = await fs.get_all_mastery_lifecycles(student_id)
        exercised = {s['subskillId'] for s in submissions}
        mastered = [d['subskill_id'] for d in lifecycles if d.get('current_gate', 0) >= 4 and d.get('subskill_id') in exercised]
        timeline.append({'lessonId': lesson['lessonId'], 'oracleDecision': lesson['decision'],
                         'submissions': submissions, 'skipped': skipped, 'profile': profile,
                         'nextTargets': targets, 'lifecycles': lifecycles,
                         'falseMastery': mastered if lesson['decision'] != 'ADVANCE' else [],
                         'unsupportedConfirmation': [o for o in targets.get('objectives', [])
                             if o.get('subskillId') in exercised and o.get('kind') == 'confirm'
                             and lesson['decision'] != 'ADVANCE'],
                         'supportedSuccess': [s['instanceId'] for s in submissions if s['score'] >= 7 and not s['independentParts']]})
        fs.virtual_now += timedelta(days=retention_days)
    parity = await stack.check_rollup_parity(student_id)
    actual = len(await fs.get_student_attempts(student_id, limit=100000))
    if actual != total_submissions or not parity['match']:
        raise RuntimeError(f'Attempt/rollup mismatch: {actual}/{total_submissions}, {parity}')
    return {'profile': run['profile'], 'seed': run['seed'], 'submissions': total_submissions,
            'timeline': timeline, 'rollupParity': parity,
            'scope': 'Production competency/calibration/mastery/profile/selector; in-memory. Scores simulate component completion; audio, UI and frontend transport are not executed.'}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('--curriculum', type=Path, required=True)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--profile')
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding='utf-8'))
    snapshot = json.loads(args.curriculum.read_text(encoding='utf-8'))
    runs = [r for r in report['runs'] if not args.profile or r['profile'] == args.profile]
    if not runs:
        raise ValueError('No matching persona runs')
    results = []
    for run in runs:
        result = await replay_run(run, snapshot, report['scenario']['retentionDays'])
        results.append(result)
        print(f"{run['profile']} seed {run['seed']}: {result['submissions']} production submissions, rollup parity {result['rollupParity']['match']}")
    output = args.out or args.report.with_suffix('.production.json')
    output.write_text(json.dumps({'sourceReport': str(args.report), 'runs': results}, indent=2, default=str), encoding='utf-8')
    print(f'Production audit: {output}')


if __name__ == '__main__':
    logging.basicConfig(level=logging.ERROR)
    # The production competency class opts into INFO at import time.
    logging.getLogger('app.services.competency').setLevel(logging.ERROR)
    asyncio.run(main())
