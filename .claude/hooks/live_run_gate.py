"""PreToolUse gate for paid Gemini Live journeys (user request 2026-09-27).

Any Bash/PowerShell command that runs backend/tests/tutor_live/run_*.py is sent to the user
for approval, even in auto mode, with today's Live session count so the choice is made before
the money is spent. `--help` passes through. Policy: backend/tests/tutor_live/LIVE_TESTING.md.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOGS = ROOT / 'backend' / 'logs' / 'lumina-sessions'
RUNNER = re.compile(r'tutor_live[\\/](run_\w+)\.py')


def flag(command, name):
    m = re.search(rf'--{name}[ =]("[^"]*"|\S+)', command)
    return m.group(1).strip('"') if m else None


def sessions_today(primitive):
    # Log names start with the UTC date the session opened; line 3 is session-init with the primitive.
    total = mine = 0
    for f in LOGS.glob(datetime.now(timezone.utc).strftime('%Y-%m-%d') + '-*.jsonl'):
        total += 1
        if not primitive:
            continue
        try:
            with f.open(encoding='utf-8') as fh:
                head = [next(fh, '') for _ in range(6)]
            if any(f'"primitive": "{primitive}"' in line for line in head):
                mine += 1
        except OSError:
            pass
    return total, mine


def main():
    data = json.load(sys.stdin)
    command = (data.get('tool_input') or {}).get('command') or ''
    m = RUNNER.search(command)
    if not m or re.search(r'(^|\s)(--help|-h)(\s|$)', command):
        return
    primitive = flag(command, 'primitive')
    runs = flag(command, 'runs') or ('3 (default)' if m.group(1) == 'run_live_runtime' else '?')
    total, mine = sessions_today(primitive)
    reason = (
        f'PAID Gemini Live run: {m.group(1)}'
        f'{" --primitive " + primitive if primitive else ""}, runs={runs}{", AUDIO" if "--audio" in command else ""}. '
        f'Live sessions today: {total} total'
        f'{f", {mine} on {primitive}" if primitive else ""}. '
        'Is this a meaningful NEW run? Yes only if: a new capability gate not yet passed, or tutor-facing wording '
        'whose question is still unanswered. No if: a gate already passed, a harness fix (re-read saved JSON), '
        'a rare 1-of-N miss, or a repeat of a run already done today. See backend/tests/tutor_live/LIVE_TESTING.md.'
    )
    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'PreToolUse',
        'permissionDecision': 'ask',
        'permissionDecisionReason': reason,
    }}))


if __name__ == '__main__':
    main()
