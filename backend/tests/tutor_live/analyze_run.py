"""Re-score saved `--lever` runs without a Live session (user request 2026-09-27: separate the run from its analysis).

    python analyze_run.py <report.json> [<report.json> ...]    # code checks, free; prints and compares to the saved verdict
    python analyze_run.py <report.json> --write                # also store the new analysis and verdict in the report
    python analyze_run.py <report.json> --review               # also re-run the judged reviewer (a Gemini text call; files to QUEUE.md)

A harness or check fix is verified here, against runs already paid for, never by a new run
(backend/tests/tutor_live/LIVE_TESTING.md).
"""
import argparse
import json
from pathlib import Path

from lever_checks import CHECKS, analyze

MARK = {True: 'met', False: 'MISSED', None: '-'}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('reports', type=Path, nargs='+')
    parser.add_argument('--write', action='store_true', help='Store the analysis and verdict in the report')
    parser.add_argument('--review', action='store_true', help='Re-run the judged reviewer and file its misses (paid text call)')
    args = parser.parse_args()
    changed = 0
    for report in args.reports:
        runs = json.loads(report.read_text(encoding='utf-8'))
        for index, run in enumerate(runs, 1):
            result = analyze(run)
            was = run.get('passed')
            now = result['passed']
            changed += was is not now
            print(f"{report.name}#{index}: {'PASS' if now else 'FAIL'} (saved: {'PASS' if was else 'FAIL'})"
                  f"{'' if was is now else '  <-- CHANGED'}")
            for key, value in result['checks'].items():
                if value is not True:
                    print(f"    {MARK[value]:>6}  {key}: {CHECKS[key]}")
            if result['stopped']:
                print(f"    stopped: {result['stopped'][:200]}")
            saved = (run.get('review') or {}).get('checks')
            if saved:
                print(f"    saved judged checks: {saved}")
            if args.review:
                from lever_review import review
                run['review'] = review(run, run.get('primitiveId', '?'), run.get('items', []), f'{report.name}#{index}')
                print(f"    judged: {run['review'].get('checks') or run['review']} -> queued {run['review'].get('queued')}")
            if args.write:
                run['analysis'], run['passed'] = result, now
        if args.write or args.review:
            report.write_text(json.dumps(runs, indent=2), encoding='utf-8')
    print(f'{changed} verdict(s) changed')


if __name__ == '__main__':
    main()
