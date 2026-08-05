# Reader-fit 14k — number-line exact missing number

**Date:** 2026-08-04  
**Band / mode:** Grade 1 EMERGING · `between`  
**Scoped verdict:** **READY** — the queued 14k range/window/accept failure is closed.  
**Contract:** `docs/contracts/number-line.md` · **COMPATIBLE**, C1 resolved.

## Finding reproduced

The Grade-1 objective asked for a hidden number around 90–110 within 120, but the old
path collapsed the data range to 0–30, chose a random low local window, and graded any
point inside broad endpoints as correct. The new generator regression failed before the
production edit with the observed 0–30 range while its legacy-between control passed.

The root cause was three linked mechanisms, not grade-band resolution:

1. a protective K-2 maximum of 30 conflicted with the authored Grade-1 ≤120 objective;
2. local pooling ignored the intent's focus window; and
3. `find_between` had no representation for one exact missing value.

## Fix

- The structured scope resolver now separates the full range, the focus range, and the
  exact-missing-number intent.
- A narrow Grade-1 fork permits an explicit resolved range through 120 while ordinary K
  and generic K-2 consumers keep their clamp.
- Exact missing-number cards use adjacent bounds and additive `exactTargetValue`; the
  component and oracle require that exact snapped value.
- Legacy cards without the new field still accept any strictly interior value.
- The tutor receives visible bounds and the exact-task identity. Its scaffolds count from
  a visible label and explain the auto-zoomed window without leaking the target.

## Audit A — words on screen

| String role | Load-bearing? | Spoken carrier | Verdict |
|---|---:|---|---|
| “What number comes right between …?” | Yes | Activity-start / next-item tutor beat | COVERED |
| Endpoint and tick numerals | Yes | Named in the instruction; also visible on the object | COVERED |
| Check / Clear / Next controls | Supportive | Direct manipulation and feedback supply the state change | COVERED |
| Correct / retry feedback | Yes | Object/card feedback, sound, and tutor response | COVERED |

No reading-only instruction remains on the exact path. The visible sentence can support
an EMERGING reader, but the tutor carries the task protocol.

## Audit B — tutor coverage

| Beat | Result | Evidence |
|---|---|---|
| ORIENT | PASS | Tutor tells the learner to place the number that belongs between the two shown values. |
| STIMULUS | PASS | Numeric endpoints and the exact missing-number relationship are carried into context. |
| DISAMBIGUATE | PASS | Exact-task metadata distinguishes “the missing number” from ordinary open-interval estimation. |
| FEEDBACK | PASS | Correct and retry events produce object feedback and tutor coaching. |
| RECOVER | PASS | Guidance starts from the closest visible label; it does not send a 0–120 learner back to 0–20. |

`/tutor-test` passed with zero findings. Tier-3 live runs passed **3/3 standalone** and
**3/3 lesson**, including answer-fishing refusal and no answer leakage.

## Audit C — interaction

| Rule | Result | Notes |
|---|---|---|
| Instructions spoken | PASS | Durable tutor beat covers the protocol. |
| Tap is the answer | PASS | The learner places one point directly on the number line. |
| Picture/object primary | PASS | The number line itself is the answer surface; no prose worksheet proxy. |
| One thing at a time | PASS | One point is placed per card. |
| Immediate object feedback | PASS | Marker/card state and sound respond after checking. |
| No required typing | PASS | Pointer/tap interaction only. |
| Reader-safe task chrome | PASS for 14k scope | No added adult-facing control or new reading dependency; broader component chrome was unchanged. |
| Visible answer target | PASS | Adjacent endpoints make exactly one integer slot semantically correct. |

The explicit Check step is retained because point placement is a small construction task,
not an atomic choose-one picture tap. Clear/repositioning provides a reversible correction.

## Verification

- Pre-fix non-vacuity: the new exact-range regression failed on 0–30 while the legacy
  control passed.
- Focused reader-fit/generator/oracle suites: **29/29**.
- Full Vitest: **1,569/1,569** across 138 files.
- TypeScript: **0 touched-surface errors**. The global run reported 805 errors; the only
  Lumina typecheck failures were two unrelated pre-existing `gemini-story-map.ts` errors.
- Real eval-test after the final edit: PASS with full range 0–120 and exact cards
  104–106→105, 105–107→106, 96–98→97, and 99–101→100.
- Ordinary-between runtime control: PASS, no `exactTargetValue`.
- K counting-to-5 control: PASS, range 0–5.
- Browser: a real Chrome click placed 109, Check produced “Great job!”, and the page
  reported no runtime errors. The browser used an intercepted, production-shaped exact
  fixture; the separate real eval-test above proves generation.

Visual evidence: `qa/reader-fit/number-line-14k-reader-fit.png`.

## Fix loop

1. Reproduced the 0–30 collapse with a failing regression.
2. Implemented the scoped magnitude/focus/exact fork.
3. Browser inspection confirmed the local window and exact click behavior.
4. Tutor inspection exposed stale “keep it 0–20” guidance; catalog scaffolds were fixed.
5. Re-ran focused, full-suite, runtime, tutor, and lesson gates to READY.

