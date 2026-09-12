# Lesson tutor transitions — 2026-09-12

Reviewed and repaired the shared lesson handoff, preserving existing workspace edits.

| Confirmed code defect | Repair |
| --- | --- |
| KindergartenStage sent SECTION_START in addition to switch narration, including for primitives whose scripted cue owns the opening. | Removed the extra narration; the existing backend switch/opening contract controls the introduction. |
| Stage focus switched before the outgoing animation finished; Back to index zero never switched. | Focus follows the incoming mounted frame, before child passive opening effects, including the first frame and late connection readiness. |
| Every viewport observation restarted the switch timer, postponing focus throughout continuous scrolling. | Keep the timer while the candidate activity is unchanged; cancel when returning to the current activity. Recheck on connection. |
| Delayed switch acknowledgements could restore an old ID with the latest activity's data. | Ignore acknowledgements that do not match the current requested instance. |

Verification: 9 tests passed across LessonTutorTransitions, useLuminaAI.enabled, and primitiveAudioInput. The five new component regressions cover forward/back focus and opening order, late stage connection, continuous scrolling, canceled handoffs, and late scroll connection. Animation is mocked; actual exit timing and live speech have not been verified. No tutoring scaffold or backend prompt changed.

The Lumina typecheck ran and reported only two errors in the existing untracked math/baseTenScript.ts (lines 267 and 295: missing opening/howToPlay options). No errors were reported in the modified lesson components. Those unrelated edits were left intact.

Manual follow-up: run a lesson through an ordinary activity, a scripted activity, Back to the first activity, and continuous scrolling. Listen for a single opening and confirm that speech refers to the visible activity. Live Gemini audio was not exercised in this review.
