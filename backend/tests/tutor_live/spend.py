"""Gemini spend guidance for every live harness (user feedback 2026-09-27: ~$35/day, ~$250 in 28 days).

Each live journey is a full Gemini Live session plus observer and reviewer calls; `--audio` costs most.
One session ran ~40 journeys in a day where ~12 answered every question. The harnesses show this in
`--help` and print SPEND_REMINDER at start so the choice is made before the money is spent.
"""

SPEND_GUIDANCE = """\
Gemini spend (each journey is a paid Live session; --audio costs most). Before running:
  - Name the question this run answers and the fewest runs that answer it. Stop once answered.
  - A harness-only fix (an assertion, an id, a wait) is checked by re-reading the saved report JSON, not a new run.
  - Wording and instruction changes: text runs. --audio only when the change is about timing or playback.
  - A shared-layer change: measure ONE other family, not every adopter.
  - A passed gate (3 text + 1 audio per primitive) is not re-run for later fixes.
  - A run that dies at startup ("never spoke its opening") is a flake: re-run that one, not the batch.
  - Check for another session benching the same families before starting.
Runs per change type: backend/tests/tutor_live/LIVE_TESTING.md"""

SPEND_REMINDER = 'Live run: paid Gemini sessions. Fewest runs that answer the question; text unless timing (see --help, LIVE_TESTING.md).'


def spend_reminder(runs: int = 1, audio: bool = False) -> None:
    print(f'{SPEND_REMINDER} This call: {runs} journey(s){", audio" if audio else ""}.', flush=True)
