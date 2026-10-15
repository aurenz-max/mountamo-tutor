# Read-only export of published Language Arts subskills (every grade) to .cache/la_subskills.json.
# Run from the repo root: backend/venv/Scripts/python my-tutoring-app/scripts/word-space-lab/export-curriculum.py
import json
import os
import sys

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))
sys.path.insert(0, BACKEND)
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BACKEND, '.env'))
from app.db.firestore_service import FirestoreService  # noqa: E402

client = FirestoreService().client
rows = []
for grade in client.collection('curriculum_published').stream():
    for subject in grade.reference.collection('subjects').stream():
        if 'LANGUAGE' not in subject.id.upper():
            continue
        doc = subject.to_dict() or {}
        for unit in doc.get('curriculum', []):
            for skill in unit.get('skills', []):
                for sub in skill.get('subskills', []):
                    rows.append({
                        'grade': grade.id, 'subject': subject.id, 'unit': unit.get('unit_title'),
                        'skill': skill.get('skill_description'),
                        **{k: v for k, v in sub.items() if isinstance(v, (str, int, float, list))},
                    })
out = os.path.join(os.path.dirname(__file__), '.cache', 'la_subskills.json')
json.dump(rows, open(out, 'w'), default=str, indent=0)
print(len(rows), 'subskills ->', out)
