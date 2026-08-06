# Lesson tutor item 11 — slice report (2026-08-06)

Executes `qa/di/BACKLOG.md` item 11 (opened from the 2026-08-05 real-child
session review, `qa/tutor-reports/lumina-session-review-2026-08-05.md`).
Machine half COMPLETE; residual = the user's real-child acceptance drive
(HUMAN-CHECKS **#64**, criterion (b)).

## What shipped

**Fix A — curiosity-question carve-out (the headline).**
`build_lesson_system_instruction` + `build_lumina_system_instruction`
(`backend/app/api/endpoints/lumina_tutor.py`) gain a **QUESTIONS FROM THE
STUDENT** block that outranks scripted beats: a student's own question gets a
real, age-appropriate answer FIRST (one sentence), then a bridge back. The
unscoped "Never give direct answers" / "Use Socratic questioning" lines the
model over-generalized into deflection are rescoped to **the active
challenge's answer**. A second iteration added the opinion-question line
("what do YOU think?" → offer a genuine guess) after the first post-fix run
showed praise-then-redirect surviving on opinion asks (2/3).

**Fix B — resume conversational continuity.**
The transparent-resume path now injects `[SESSION RESUMED]` steering:
mid-turn drop → finish the thought (floor given); idle drop → silent note
(quiet-by-default preserved). `interrupt_state["mid_turn"]` is stamped from
`turn_had_content` on both reconnect paths (error + GoAway). Both system
prompts document the tag (never spoken, never mention the disconnection).
New ledger event: `resume-steering {mid_turn}`.

**Riders.**
- "(not set)" can no longer reach the model's mouth: unset contextKeys are
  OMITTED from RUNTIME STATE, script lines (scaffolding levels / struggle
  responses) with unresolved `{{placeholders}}` are DROPPED whole
  (`interpolate_line` strict variant), lenient `interpolate_template` drops
  to `''` instead of `'(not set)'`.
- Switch-greeting debounce (`SwitchDebouncer`, 2.5s trailing settle): a child
  flipping lesson tabs no longer triggers a greeting per tap — only the
  landing switch is announced (`switch-announced` ledger event carries
  `coalesced`). Frontend `primitive_switched` confirmation stays immediate.
- Honest counters (`SessionCounters`): audio frames no longer count as
  turns/voice (was `turns: 3059` for a ~30-turn session). Turns = text turns
  + opened voice brackets; voice = `activity_start` count.

**Fault injection — `LUMINA_FAULT_DROP_S` (+`_EPISODES`).**
Companion to `LUMINA_FAULT_MUTE_S` (shared `_fault_flag_allowed` guard: dev
only, process-env only, persisted forms refused loudly). Arms on the first
cue-classified text; N seconds later the receive loop raises, reproducing the
1011/1008 "died mid-sentence" class through the REAL resume path. Ledger:
`fault-drop-armed` / `fault-drop-fired`.

**Harness (`backend/tests/tutor_live/run_tutor_live.py`).**
- `Beat.forbid` (phrases that must NOT be spoken) + `forbidden-phrase-spoken`
  HIGH oracle.
- `Beat.judge` + `judge_beats()` — per-beat LLM judge (gemini-flash, temp 0,
  strict JSON) for answer-vs-deflect, which code oracles cannot decide; a
  judge failure surfaces as WARN `judge-unavailable`, never a silent pass.
- `require_events` journey key + `required-event-missing` HIGH — pins the
  resume probe's premise (a drop that never happened = FAIL, not vacuous pass).
- Journeys: `lesson-curiosity` (the child's turn-8 utterance VERBATIM +
  follow-up opinion ask; machine-profile scaffold copied verbatim from
  `catalog/engineering.ts`) and `lesson-resume-continuity` (forced drop;
  forbid re-greeting anchors; requires session_resuming/session_resumed).

## Evidence (all real Gemini Live, isolated backend :8003/:8004)

- **Pre-fix (non-vacuity):** judge caught genuine deflections — run 1 of the
  first probe: "This page tells us all about the excavator itself — maybe the
  next activity will show us what they're building" (the shipped failure
  class). Rate over text input ≈ 50%/judged beat (2 runs). The pre-fix run
  also proved keyword anchors alone FALSE-PASS (the deflection contained
  "building") — which is why the LLM judge exists.
- **Post-fix gate: `lesson-curiosity --runs 3` → PASS, zero findings.** All
  three runs answered the scene question ("it looks like they're building a
  big home for lots of people") AND offered an own guess on the opinion ask
  ("I think it might be a big store with lots of toys"). No scaffold
  recitation, no "(not set)", no tag syntax.
  Report: `qa/tutor-reports/lesson-curiosity-live-lesson-2026-08-06.md`.
- **Resume probe: PASS, zero findings, premise proven in the ledger**
  (`2026-08-06-112504-lumina-tutor-3a513282d32f.jsonl`): `fault-drop-armed`
  (switch cue) → `fault-drop-fired` turn 2 mid-reply → `gemini-error
  will_resume` → reconnect **350ms** → `resume-steering mid_turn=true` →
  continuation with no re-greeting; coherence beat answered "I was just
  saying that this excavator helps us build big things…".
  Report: `qa/tutor-reports/lesson-resume-continuity-live-lesson-2026-08-06.md`.
- **Units: 22/22** — `backend/tests/test_lumina_tutor_session_units.py` (15:
  counters ignore frames, scaffold placeholder-free, strict line drops,
  debounce coalescing, carve-out present + old unscoped rule GONE in both
  builders) + `tutor_live/test_run_tutor_live.py` (7: forbid oracle
  fires/passes, journey shapes, require_events). Revert-bite: reverting Fix A
  fails the prompt tests ("Never give direct answers" must be absent);
  reverting the riders fails their suites.
- `py_compile` clean on `lumina_tutor.py`, `config.py`, `run_tutor_live.py`.
  Fault-armed server stopped in-slice (no armed processes left).

## Honest residuals

- **Human acceptance rides HUMAN-CHECKS #64** — the user re-driving a real
  lesson with their child is the gate for the audio path (the harness drives
  text turns; the original failure arrived via a 48s open-mic ASR blob).
- The post-fix answers lean on the prompt's example phrasing ("a big home for
  lots of people") in this scene — apt here since the journey mirrors that
  exact scene, but worth an ear during the #64 drive for parroting in other
  topics.
- The user's dev backend on :8000 was running the PRE-fix code throughout —
  restart it to pick up the fixes before the acceptance drive.
- Not addressed (out of scope, unchanged): Gemini-side 1007/1011/1008 causes;
  child-speech ASR language drift (watch-item).
