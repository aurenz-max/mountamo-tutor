"""Save a generated payload for the dry journey and tutor replay, without a Live session (handoff 20 Part D).

A new binding needs `runtime/testing/w1-payloads/<id>.<mode>.json` before the sweep and the W1 contract can drive
it. It used to come from the smoke drive's saved payload, a paid Live run. The generation alone makes it: the same
`/api/lumina/tutor-test` probe the Live harness calls, one generator call per mode, no Live session.

    python save_payload.py --primitive fraction-bar --mode identify [--mode build ...] [--topic ...] [--grade ...]

Needs the frontend on :3000. The primitive needs a `liveJourneySpec.ts` row (its defaults fill topic and grade).
"""
import argparse
import json
from datetime import date
from pathlib import Path

from activity_capabilities import fetch_journey
from run_tutor_live import fetch_live_context

ROOT = Path(__file__).resolve().parents[3]
PAYLOADS = ROOT / 'my-tutoring-app/src/components/lumina/components/live-activity/runtime/testing/w1-payloads'
REPORTS = ROOT / 'my-tutoring-app/qa/tutor-reports'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--primitive', required=True)
    parser.add_argument('--mode', action='append', help='Eval mode (repeatable); default the journey row\'s mode')
    parser.add_argument('--topic'); parser.add_argument('--grade')
    parser.add_argument('--frontend', default='http://localhost:3000')
    args = parser.parse_args()
    defaults = fetch_journey(args.frontend, args.primitive)['defaults']
    for mode in args.mode or [defaults['mode']]:
        live = fetch_live_context(args.frontend, args.primitive, args.topic or defaults['topic'], args.grade or defaults['grade'],
                                  mode, di=defaults.get('di', False))
        stem = f"{args.primitive}-runtime-{mode.replace('|', '+')}-payload-{date.today().isoformat()}.json"
        (REPORTS / stem).write_text(json.dumps(live, indent=2), encoding='utf-8')
        out = PAYLOADS / f"{args.primitive}.{mode.replace('|', '+')}.json"
        out.write_text(json.dumps({'source': f'qa/tutor-reports/{stem}', 'primitiveId': args.primitive, 'evalMode': mode,
                                   'data': live['generatedData']}, indent=1), encoding='utf-8')
        print(out)


if __name__ == '__main__':
    main()
