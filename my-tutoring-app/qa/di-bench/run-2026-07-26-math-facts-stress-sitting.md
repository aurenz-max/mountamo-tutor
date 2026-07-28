# DI sitting 2026-07-26 (3rd) — first REAL CHILD run, server-side log triage (CORRECTED)

**Surface:** `di-math-facts` standalone tester; two sessions on test student 1004.
Session A = the user's `fact_review` run (same run as `run-2026-07-26-math-facts-turn-gate-verify.md`,
seen from the backend). Session B = **the user's child, unscripted** — the family's first run with a
real child voice. Evidence: backend `lumina_tutor` log only (NO timestamps in the log format, and
the paste truncated mid-tail) — **no client run JSON survived**, so durations and pack-side
counters are unrecoverable for Session B.

> **CORRECTION (same day):** the first draft of this report called the "not three" correction a
> fabricated contrast. The user then confirmed **the child actually said "three"** — the ASR wrote
> "Please". The finding below is rewritten accordingly; the fabrication claim is withdrawn.

## Finding 1 — THE BIG ONE: mid-run STALL, no verdict ever arrives, primitive dead-ends (→ BACKLOG item 5)

From ~turn 15 of Session B the log becomes repeated `activity_start`/`activity_end` pairs with
**zero AI transcription, zero verdicts** — "Waiting for Gemini response (turn 16)…" is never
satisfied. At least 3-4 voice turns closed into a silent model before the paste truncates: the
child keeps answering, nothing comes back, the surface sits in "Listening…" with no recovery and
no visible failure state. This is the "primitive just broke" experience, and it is the largest
child-facing defect in the family.

**Mechanism candidates (truncation hides which):**
- **(a) GoAway/resume dropped the in-flight turn.** Session A shows GoAways cycling every ~50s by
  end of session with instant re-GoAway on resume. If a GoAway landed mid-attempt in Session B,
  the pending verdict died with the old connection and **nothing re-cues the active item on
  resume** — the resume path restores the session but not the DI turn in flight.
- **(b) Generation wedged under the barge-in storm** (repeated interrupts until the model stopped
  producing).

**What exists vs. what's missing:** the engine's no-verdict timeout → resync is unit-covered and a
same-item `[DI_ITEM]` re-send visible mid-Session-B is likely its first live firing — but re-cueing
into a dead session is not recovery. Missing: an **escalation ladder** past re-cue (N re-cues
without any tutor audio → reconnect the session and re-cue → if still dead, a visible "let's
reconnect" state instead of silent Listening…), and **re-cue-on-resume** server/client-side.

## Finding 2 — ASR collapses on real child speech; the in-band judge kept hearing the numbers

The transcript channel wrote **"Please" / "Yackley" / "¿Qué?" / "It was" / "Yes, for" / "사랑해" /
"sechs"** while the child was (per the user) answering with numbers — e.g. the audio behind
"Please" was **"three"**, and "sechs" is almost certainly ASR rendering an English "six" as German.
The judge judged the AUDIO and got it right: *"My turn: not three — zero plus four is four."* named
the number the child actually said, which no transcript contained. This is the judge-over-transcript
architecture (`feedback_no-live-audio-judging` / the /s/-over-"Shh." proof) holding with its first
real child voice, under barge-in chaos.

**Consequence worth carrying (noted on BACKLOG item 2):** any channel that reads the ASR text as
"what the child said" — server logs, the panel's `attempt-transcript`, and the misconception
packet's transcript field — is UNRELIABLE for young children. The judge's own sentence
(`verdict-text` / `judgeFeedback`, the Tier-A headline) is the only trustworthy record of the
child's answer. Diagnosis must keep leaning on Tier A, never the raw transcript.

## Findings — smaller defects (queued)

- **Free-form DI attribution off-grade/off-family (→ BACKLOG item 6; #50(c) half-closed).**
  Session A's submit fired the FULL data loop under **MATHEMATICS** (override verified:
  retrieval cosine 0.800 → calibration β=2.46/θ=3.60/gate 3/4 → mastery ACTIVATED → +28 XP) but
  landed **`OPS002-04-c @ grade=2`** for a K "facts within 5" session instead of the OPS001
  family. Standalone-path only; standalone DI sittings are calibrating the wrong node.
- **1-second clock skew hard-fails the tutor WebSocket (→ BACKLOG item 7).** `Token used too
  early, 1785081560 < 1785081561` → `InvalidIdTokenError` → dead session, client reconnect.
  `verify_id_token` at `lumina_tutor.py:422` has zero tolerance; firebase-admin supports
  `clock_skew_seconds`.

## Watch-items (logged in BACKLOG)

- **GoAway rapid-resume loop:** post-Session-A, 4× GoAway→resume→instant GoAway until client
  disconnect. No "run complete, stop resuming" exit — and per Finding 1(a), the same loop striking
  MID-run is a stall candidate.
- **Session metrics counters count frames, not turns** (`Turns: 28885` in ~90s).
- **Likely first live RESYNC** (same-item `[DI_ITEM]` re-send after ≥2 misses) — uninstrumented;
  the item-1 recipe sitting confirms.
- **Correction-cap charges under garbage ASR** are fine (the judge, not the transcript, decides
  the branch) — but a capped item's `attempts` are real child answers even when the transcript
  reads as noise. Read outcome data accordingly.

## What HELD (worth as much as the defects)

- **Turn-gate fix** held its real stress test: every short child utterance committed (the 2-frame
  population dropped before the fix).
- **Script discipline** survived ~15 adversarial turns: every correction opened "My turn:", cues
  kept flowing, no `[CONTEXT UPDATE]` fabrication (contrast: the 07-26 morning decoherence).
- **Session A's move-on line log-confirmed spoken** with its completion tail ("Good try. We will
  practice more later. That's the end of our math practice.") — the last ear-only gap in #50(a)
  now has hard evidence.
- Submit recorded the capped item correctly (`dimf-5-1p3: attempts 3, score 0`).
