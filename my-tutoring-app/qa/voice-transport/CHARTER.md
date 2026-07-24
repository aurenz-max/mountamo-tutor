# Voice Transport Unification — Stream Charter (parked 2026-07-23)

**User direction (2026-07-23):** the natural evolution of Lumina is a student who
TALKS to the tutor throughout a lesson — asks questions, discusses ideas, and
verbally refers back to prior sections ("first we learn the excavator's parts,
then hydraulics, then apply it on a construction site — the student should be
able to reach back to any of those"). Gemini's automatic VAD is too brittle to
carry that (run-3 ruling); the client-side turn authority built for DI is the
proven replacement. This stream promotes it from DI-private mode to Lumina's
session-wide voice transport, and raises the live-testing bar to match.

## Why now (evidence base)

- Gemini auto-VAD gates on speech-likeness, not energy — ignored a real 0.171
  hum, committed echo phantoms (`qa/di-bench/` run 3 ruling, memory
  `project_di-bench-live-judged`).
- `hooks/voiceTurnMachine.ts` + `useLiveVoiceTurns.ts` beat it decisively live:
  0 phantom turns, 0 echo-opened turns, ~6× floor margin, native barge-in
  (hook-parity + engine-gate runs, 2026-07-20/21).
- Standing user rulings already describe a LESSON-level open mic:
  `feedback_open-mic-over-turn-windows` (persistent open mic is THE native
  shape) + `feedback_spoken-mic-decoupled-from-tutor` (never gate on tutor-busy).
- The interim state this dissolves: a DI-bearing lesson runs manual VAD
  session-wide, so non-DI primitives in a mixed lesson get no conversational
  turns (L2 wiring 2026-07-23, `qa/tutor-reports/di-letter-sounds-2026-07-23.md`
  "Known trade-off"; HUMAN-CHECKS #45 measures how bad the interim really is).

## Target shape

Lesson sessions always open `manual_activity`; ONE lesson-level turn authority
(a provider-owned `useLiveVoiceTurns` instance) brackets ALL student speech —
conversation included. DI's judged loop becomes a CONSUMER of the shared turn
stream (it already only scans verdicts while an attempt is pending), not the
owner of the mic. The viewport primitive claims the turn by default (the
`switchPrimitive` IntersectionObserver + `useVoiceViewportGate` line of work is
the addressing mechanism); the tutor grounds conversation in the on-screen
content and can reach back through `lesson_context` history.

## Phases (each gates on runtime exercise, not tsc)

1. **Calibration beat** — graduate the ambient/echo EMA floors from groundwork
   to a real measure-then-set-thresholds beat (arbitrary student hardware, not
   hand-tuned to one dev machine). Prereq for everything else.
2. **Session-wide turn authority** — lesson-level `useLiveVoiceTurns` owned at
   the provider/lesson surface; DI packs consume instead of self-bracketing;
   mixed-lesson conversation works. The DI L2 manifest-scan wiring
   (`connectLesson` audioInput) becomes "always on for lessons" rather than
   DI-triggered.
3. **Contextual close-timing + viewport claim** — turn-close config set by the
   active/viewport primitive (held phoneme = tight close; conversation = longer
   silence window). Machine config is already parameterized; the policy is the
   work.
4. **Refer-back journey beats (the raised testing bar)** — extend
   `run_tutor_live.py` journeys: synthetic student on section 3 asks about
   section 1's content (excavator parts → hydraulics → construction-site apply);
   judged by the existing grounding/stale-state oracles + a new
   grounds-in-prior-section check. Data already ships (`lesson_context`
   ordered_components + previous results + the backend "reference previous
   activities" prompt) — what's untested is whether the tutor USES it.

## Notes

- HUMAN-CHECKS #45 still runs as designed; its mixed-lesson question is now
  reframed "acceptable UNTIL this stream lands", not a product fork.
- Watch-item from DI: sentinel discipline (verdict openers) must stay safe when
  free conversation shares the session — the judged loop's attempt-pending scan
  window is the existing guard; re-verify it under chat traffic in phase 2.
- Executors when pulled: `/tutor-test` (Tier-3 journeys), DI backlog standing
  gates, `/reader-fit` for any viewport-claim UI.
