"""Count tutor turns that should have spoken and did not, from saved session logs. Free: reads
`backend/logs/lumina-sessions/*.jsonl`, opens no Live session.

A silent turn is one Gemini Live transcribes as markup (`<no speech>{pause}`, `<no speech detected>`)
instead of words. Two moments must always speak: the turn after an `observe_runtime` call (the lesson
opener) and the first turn after a primitive switch. Before 2026-09-23 neither was ever silent; on
2026-09-28 4 of 8 lesson openings were.

    venv/Scripts/python tests/tutor_live/silent_turns.py            # per-day table
    venv/Scripts/python tests/tutor_live/silent_turns.py --since 2026-09-26 --list
"""
import argparse
import collections
import glob
import json
import os
import sys

LOGS = os.path.join(os.path.dirname(__file__), "..", "..", "logs", "lumina-sessions")
STOP = {"user-transcript", "client-disconnected", "text-to-gemini"}


def silent(text):
    return text.lstrip().startswith("<no")


def next_outcome(events, start):
    """What the tutor did next: 'spoke', 'silent', or 'none' (the learner, a disconnect or a new cue came first)."""
    for e in events[start + 1:]:
        if e.get("event") in STOP:
            return "none"
        if e.get("event") == "ai-transcript":
            return "silent" if silent(e.get("text", "")) else "spoke"
    return "none"


def scan(path):
    events = [json.loads(line) for line in open(path, encoding="utf-8")]
    primitive, switched = None, False
    for i, e in enumerate(events):
        kind = e.get("event")
        if kind == "switch-primitive":
            primitive = e.get("to_primitive")
        if kind == "switch-announced":
            switched = True
        elif kind == "text-to-gemini" and switched:
            switched = False
            yield "switch", primitive, next_outcome(events, i)
        elif kind == "activity-tool-call" and e.get("name") == "observe_runtime":
            yield "observe", primitive, next_outcome(events, i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="", help="YYYY-MM-DD, compared to the log's UTC file date")
    ap.add_argument("--list", action="store_true", help="print each silent moment's log and primitive")
    args = ap.parse_args()
    table = collections.defaultdict(collections.Counter)
    hits = []
    for path in sorted(glob.glob(os.path.join(LOGS, "*.jsonl"))):
        day = os.path.basename(path)[:10]
        if day < args.since:
            continue
        try:
            for moment, primitive, outcome in scan(path):
                table[(day, moment)][outcome] += 1
                if outcome == "silent":
                    hits.append((os.path.basename(path), moment, primitive))
        except (OSError, json.JSONDecodeError):
            continue
    print(f"{'day':<11}{'moment':<9}{'silent':>7}{'spoke':>7}{'none':>6}")
    for (day, moment), c in sorted(table.items()):
        print(f"{day:<11}{moment:<9}{c['silent']:>7}{c['spoke']:>7}{c['none']:>6}")
    if args.list:
        for h in hits:
            print(*h)
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
