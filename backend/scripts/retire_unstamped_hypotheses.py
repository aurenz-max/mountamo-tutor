"""List (and with --apply, retire) legacy hypotheses that predate scope stamping.

Primitive-specific by design, and deliberately a script rather than production
code: the 2026-09-12 ruling disabled score/tag resolution for place-value-chart
INCLUDING legacy diagnoses. Production now enforces that by record property (a
stamped ``scope_context``), so pilot-era records without a stamp are retired
here instead of by a primitive branch in the API.

Walks students/{id}/misconceptions directly (no collection-group index needed).

Usage (from backend/):
    venv/Scripts/python scripts/retire_unstamped_hypotheses.py                 # dry run, place-value-chart
    venv/Scripts/python scripts/retire_unstamped_hypotheses.py --primitive bar-model
    venv/Scripts/python scripts/retire_unstamped_hypotheses.py --apply         # writes status=superseded
"""
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')
from app.db.firestore_service import FirestoreService  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--primitive', default='place-value-chart')
    parser.add_argument('--apply', action='store_true', help='retire the listed records (default: dry run)')
    args = parser.parse_args()
    store = FirestoreService()
    unstamped, students = [], 0
    for student in store.client.collection('students').list_documents():
        students += 1
        for snap in student.collection('misconceptions').where('primitive_type', '==', args.primitive).stream():
            record = snap.to_dict()
            if record.get('status') == 'active' and not record.get('scope_context'):
                unstamped.append(snap)
    print(f"{args.primitive}: {len(unstamped)} active hypotheses without a stamped published scope across {students} students")
    for snap in unstamped:
        record = snap.to_dict()
        print(f"  {snap.reference.path}  detected={record.get('last_detected_at')}  scope={record.get('scope')}")
    if not args.apply or not unstamped:
        print('dry run; pass --apply to retire them' if unstamped else 'nothing to do')
        return
    now = datetime.now(timezone.utc).isoformat()
    for snap in unstamped:
        snap.reference.update({'status': 'superseded', 'superseded_at': now,
                               'superseded_reason': 'unstamped-legacy-no-score-resolution'})
    print(f"retired {len(unstamped)} records")


if __name__ == '__main__':
    main()
