# DI bench — `Counting to 120` probe (HUMAN-CHECKS #63) — 2026-08-06

**Verdict: ENCOURAGING, BUT NONE OF #63's THREE CRITERIA WERE EXERCISED. #63 stays
open; DI item 10 (the 1–120 extension) stays BLOCKED.**

The #63 row asks for three things, all of which require *deliberately breaking* items
or reaching items 9–10. This run answered correctly on every item it drove and stopped
at item 4, so (a), (b) and (c) are all still unanswered. What it does establish is a
real negative-control result — see "What this run genuinely proves" below.

Standing gate 1 for the DI family: bench every NEW response class before wiring a
primitive. `di-math-facts` `counting_next` currently saturates honestly at twenty;
Option B (user ruling 08-05) extends it to 120, which introduces **multi-word
numerals** — "fifty-one", "one hundred seven", "one hundred twenty" — as an
unbenched response class. This sitting exists to decide whether they are judgeable
from audio.

Run JSON pasted by the user in-session (bench `direct-instruction`,
`2026-08-06T20:44:40.946Z`, `gemini-3.1-flash-live-preview-audio`).

## What the run actually covered

The probe set has **10 items**; the run reached **4** and ended at `count-13`.

| # | Item | Target | Words | Outcome |
|---|---|---|---|---|
| 1 | `count-12` | thirteen | 1 | ✅ affirmed, alias match |
| 2 | `count-29` | thirty | 1 | ✅ affirmed, alias match |
| 3 | `count-39` | forty | 1 | ❌❌ two corrections → move-on — **but never attempted** (see below) |
| 4 | `count-13` | fourteen | 1 | ✅ affirmed, alias match |
| 5–10 | `count-50 … count-119` | fifty-one, seventy, seventy-seven, one hundred, one hundred seven, one hundred twenty | **2–3** | **never reached** |

Summary counters: `affirmed 3`, `corrected 2`, `offScript 0`,
`unanchoredVerdicts 0`, `aliasAgree 3 / aliasDisagree 0`, `turnsOverTutorAudio 2`,
`meanFrontendResponseMs 2249`, `meanCommitLagMs 1220`.

## What this run genuinely proves — and what it cannot

**Proved (worth having): no FALSE CORRECTION on correct teen/decade words.**
"thirteen", "thirty" and "fourteen" were each spoken correctly, each affirmed, each
with whole-token ASR alias agreement — and critically, **"thirteen" was not heard as
"thirty" nor the reverse**, on a device whose real-speech peaks were 0.045–0.116.
That is the negative-control direction of the teen/decade question and it is clean.
Zero off-script, zero unanchored verdicts.

**NOT proved — and this is the direction that decides the fork.** #63(a) asks for a
**deliberately wrong** answer: say "thirty" on purpose when the target is "thirteen",
and the mirror on item 2. *It MUST correct.* Correct answers being affirmed does not
test this, because a judge that rubber-stamped everything would produce exactly the
transcript above. The row's own wording is explicit: *"An affirm here means Live
cannot hear the distinction from audio… and the honest outcome is to kill Option B."*
This run cannot distinguish a discriminating judge from a permissive one.

This is the same trap the DI family already hit twice — the 07-24 math-facts probe
and the 07-25 di-math-facts L0 gate both ended on all-correct runs and had their
correction branches carried forward to #50 for exactly this reason. Three affirmations
in a row is the shape of an *untested* correction branch, not a passed one.

There were two `corrected` verdicts in the run, but both fired on empty noise-opened
turns (see DI-120-1), not on a spoken wrong numeral — so they say nothing about
teen/decade discrimination either.

`commitLagMs` held steady at 1088 / 1219 / 1353 (mean 1220), consistent with the
~933ms constant measured on the 07-24 math-facts probe. Response-time-as-silent-
fluency-signal survives at these numerals.

`commitLagMs` also held steady at 1088 / 1219 / 1353 (mean 1220), consistent with
the ~933ms constant measured on the 07-24 math-facts probe. Response-time-as-silent-
fluency-signal survives at these numerals.

## Why it does NOT close #63 — all three criteria still open

| # | Criterion | Status |
|---|---|---|
| (a) | Teen/decade — say "thirty" on purpose for `12 →`, "thirteen" for `29 →`. MUST correct. | **Not exercised** — both answered correctly. Negative control clean; discrimination untested. |
| (b) | Completeness + mic timing — answer `106 →` as "hundred seven" (partial compound must correct); answer `119 →` with a beat between "one hundred" and "twenty", watching for `attempt superseded`. | **Not reached** — run ended at item 4. |
| (c) | Cue drag — do the model+guide lines still read at pace when both carry long numerals? Does the tutor ever speak digits instead of words? | **Not reached.** |

**And no multi-word numeral was ever spoken.** Every judged answer in this run was a
single word. Items 5–10 — the ones carrying "fifty-one", "one hundred seven",
"one hundred twenty" — were never reached. The unbenched response class that blocks
DI item 10 is *still* unbenched.

The specific open risks a 2–3 word answer introduces, none of them exercised here:
- **Turn segmentation.** `silenceCloseMs: 500` is tuned for one-word answers. "One
  hundred… twenty" with a thinking pause mid-numeral will split into TWO voice
  turns — the exact defect found on the 07-25 sentence-reading probe, which needed
  ~1100ms for that pack. A split numeral means the first fragment ("one hundred")
  anchors an attempt and gets judged as wrong.
- **Partial-credit ambiguity.** "One hundred seven" vs "a hundred seven" vs "one
  hundred and seven" are all aliased in the probe set, but nothing has confirmed
  the in-band judge treats them as equivalent.
- **Judge strictness on compound errors.** "One hundred twenty" answered as "one
  hundred two" is a decade error inside a correct hundred — never heard.

## Finding DI-120-1 (NEW, queued not fixed): echo/noise blips cost `count-39`

`count-39` shows as two corrections and a move-on. **The user never answered it.**

```
n=56  36083  tutor  "Listen: the"            ← count-39 lead-in begins
n=58  36992  mic    local voice 0.1s, peak 0.018, opened over tutor audio
n=59  37914  tutor  "My turn:"               → judge: corrected, action retry
...
n=68  39265  tutor  " What is"
n=69  40232  mic    local voice 0.5s, peak 0.018, opened over tutor audio
n=70  41217  tutor  "My turn:"               → judge: corrected, action move-on
n=84  49389  tutor  "Good try. We will practice more later."
```

Both mic events peaked at **0.018** and produced **no learner event and no
transcript**. Real learner speech in the same run peaked at **0.045, 0.115, 0.116**.
The barge-in bar is `silenceThreshold 0.008 × bargeInMultiplier 1.35 = 0.0108`, so
0.018 clears it comfortably.

Mechanism, and it is by-design behaviour producing a bad outcome: DI-1 says an
attempt exists at **local voice-turn close** and transcripts only annotate. So an
88ms blip closed a turn, anchored an empty attempt, interrupted the tutor's own
modeling line via barge-in, and Gemini — having heard nothing usable — opened
"My turn:". Two of those hit the `resyncAfterMisses: 2` cap and the item was
abandoned. The existing `phantomCommitGuard` does not catch this: it protects
against *transcript without local voice*, and this is the inverse — *local voice
without transcript*.

Note `measuredFloors` recorded `ambientRms 0` / `echoRms 0.0002`, i.e. calibration
saw a essentially silent room, while live leakage reached 0.018 — **90× the measured
echo floor**. So either calibration under-samples, or these were ambient (movement,
breath) rather than echo. Either way the bar is in the wrong place for this device.

**Well-supported fix, from this run's own numbers:** a barge-in bar anywhere in
**0.025–0.03** rejects both blips (0.018) while accepting every real answer (min
0.045) — roughly `bargeInMultiplier` 3–4 at the current `silenceThreshold`, or a
raised threshold. This is DI-2's dual-threshold lever doing what it was built for;
it needs re-tuning, not new machinery. **Do this BEFORE the re-run**, or the same
blips will sabotage the multi-word items too.

A secondary question worth deciding at the same time: should an attempt anchored on
a voice turn that yields **no transcript at all** count toward the miss cap? Today
it does, and that is what burned `count-39`.

## Disposition

- **#63 stays OPEN** — a re-run must (1) deliberately answer WRONG on the first two
  items, (2) reach items 9–10, (3) include the partial "hundred seven" and the paused
  "one hundred … twenty". Without the deliberate breaks the sitting cannot decide the
  fork no matter how many items it completes.
- **Raise the barge-in bar BEFORE the re-run**, or the same 0.018 blips will burn
  items again. Also consider `silenceCloseMs` ≥ 1100 for multi-word numerals (the
  sentence-reading pack's setting) so a mid-numeral pause does not split the turn —
  note this overlaps criterion (b), so if you raise it first, (b) tests the raised
  value rather than the current 500ms default. Decide which you want to measure.
- **DI item 10 stays BLOCKED.**
- **DI-120-1 queued** in `qa/di/BACKLOG.md` — executor: bench re-tune, then re-run.
- The teen/decade **negative control** is recorded as clean; a re-run needs only the
  deliberate-wrong direction, not the correct-answer direction again.
