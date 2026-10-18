"""PreToolUse guard: agents never start paid Gemini Live sessions or tutor replays (USER RULING 2026-10-17).

The user runs these by hand. Blocked: backend/tests/tutor_live/run_*.py (Live sessions) and tutor_replay.py
(gemini-3.8-flash replays; 10-15/10-16 cost ~$90/day at ~11K samples). `tutor_replay.py --rescore` is free
(no model call) and stays allowed.
"""
import json
import re
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
cmd = (data.get('tool_input') or {}).get('command') or ''

# Only an interpreter executing the script counts; a grep, an edit or a doc line that names it does not.
RUN = r'(?<![\w.])(?:python[\w.]*|py)(?:\.exe)?[ \t]+(?:-\S+[ \t]+)*(?:"[^"\n]*?|\'[^\'\n]*?|[^\s"\']*?)'
live = re.search(RUN + r'\b(run_(?:live_[a-z_]+|tutor_live)\.py)\b', cmd)
replay = re.search(RUN + r'\btutor_replay\.py\b', cmd) and '--rescore' not in cmd
if live or replay:
    what = live.group(1) if live else 'tutor_replay.py'
    sys.stderr.write(
        f'BLOCKED: {what} spends real Gemini money (Live session or gemini-3.8-flash replay). '
        'USER RULING 2026-10-17: only the user runs Live tests and tutor replays. '
        'Do not work around this block. Give the user the exact command to run and stop.\n'
    )
    sys.exit(2)
sys.exit(0)
