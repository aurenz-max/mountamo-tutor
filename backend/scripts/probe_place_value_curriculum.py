"""Read-only curriculum fit and published objective evidence for the pilot."""
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
import curriculum_fit_probe
from app.db.firestore_service import FirestoreService


async def main():
    catalog = (ROOT / 'my-tutoring-app/src/components/lumina/service/manifest/catalog/math.ts').read_text(encoding='utf-8')
    description = re.search(r"id: 'place-value-chart',[\s\S]*?description: '([^']*)'", catalog)[1]
    sys.argv = ['curriculum_fit_probe', '--primitive', 'place-value-chart', '--domain', 'math',
                '--grades', '3,4', '--description', description, '--json']
    await curriculum_fit_probe.main()
    store = FirestoreService()
    evidence = {}
    for grade in ('3', '4'):
        published = await store.get_published_curriculum('MATHEMATICS', grade=grade)
        evidence[grade] = published
    output = ROOT / 'artifacts/place-value-published-curriculum.json'
    output.write_text(json.dumps(evidence, default=str, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
