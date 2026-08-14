# HANDOFF — DI modality on `ten-frame` (math port 1)

**Status:** ~~SCOPED, NOT STARTED~~ → **✅ EXECUTED 2026-08-13** (all four eval modes,
uncommitted; four user drives found and fixed three blocking defects, judge still unheard —
**mic row #98**). *Stamped by `/pm` 2026-08-13: this line still read "NOT STARTED" the day
after the port shipped, and a brief that says "not started" is an invitation to redo it.*
**Read this file for the DECISIONS behind the port, never for its status** — status lives in
`qa/di/BACKLOG.md` item 18 and `HUMAN-CHECKS` #98. · **Executor:** `/add-di-loop ten-frame` ·
**Queue of record:** `qa/di/BACKLOG.md` item 18 · **Filed:** 2026-08-12

This is the **first math primitive** to take the tutor-owned judged loop, and it is the
pilot the rest of item 18's Class-A sweep is gated on (pilot-then-sweep — nothing else in
math moves until this one has been driven at runtime).

Read `.claude/skills/add-di-loop/SKILL.md` for the mechanics; this brief carries only what
is **specific to ten-frame** and the decisions already made against its contract.

---

## 0. Do this first

```
/primitive-contract ten-frame --check
```

**A contract exists** (`docs/contracts/ten-frame.md`, 8 requirements, derived 2026-07-16,
0 open conflicts). It is not a formality here — **it already contains a ruling that
contradicts the first draft of the item-18 plan.** See §2.

Also drive **HUMAN-CHECKS #86** (`counting-board`) before or alongside this port if it is
still open: it is math's only existing DI surface, it is undriven, and this port inherits
its engine *and* its number-word handling.

---

## 1. Why ten-frame is the right first math port

The item-18 census found math is **1 of 61** on the DI loop, **0** with any interim voice
hook, **21** taking a typed numeric answer, and **42** carrying an on-screen Check button.
Ten-frame is the best entry because **two of its four modes already report a NUMBER through
a costume** — `subitize` and `make_ten` (Grades 1–2) use `+`/`−` steppers
(`subitizeInput`, `makeTenInput`) and a Check button (`handleCheckAnswer`).

Apply the skill's costume test — *can a child who cannot do the skill still perform this
action correctly?* A child who cannot subitize can still operate a stepper. **The stepper is
a costume; the mouth is the real answer surface.**

It is also the only math primitive that exercises **both** halves of the loop in one port:
spoken answers *and* a judged manipulation. If the split works here it generalises.

---

## 2. ⚠️ THE CONTRACT CORRECTION — `make_ten` @ K IS NOT PORTABLE, AND THAT IS DELIBERATE

The item-18 plan said *"`make_ten` → SPEAK how many more."* **That is wrong at Kindergarten
and must not be built.**

Contract **R6 (REQUIRED)** — the only REQUIRED requirement in the file:

> **`make_ten` @ K:** DIRECT MANIPULATION — seed `targetCount` counters; the child taps empty
> cells to fill the frame; `filledCount - targetCount` is the enacted complement and
> auto-judges when the frame reaches 10. Initial counters are not removable.
> **No make-ten stepper and no Check button.**

That surface was created *on purpose* by reader-fit item 12 and the standing
**direct-manipulation-first** ruling (`qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`):
*the student touches the sim object; sliders never replace it.* It already has no button and
no stepper — **it is not a click-era artifact, it post-dates the click era and is the strong
form of its own modality.**

The skill says click-era requirements that pin buttons get RE-BASED, not forked around. R6 @
K pins the *absence* of buttons. **Re-basing it means preserving the manipulation and letting
the tutor judge it** (`manipulation` response class, benched — the same shape as cvc-speller's
build judge), never replacing it with a spoken count.

> **Generalisation worth carrying to the rest of math:** in literacy, conversion was almost
> always right because the clicking stood in for a mouth. In math the manipulative is often
> the skill. **Check the contract before assuming a stepper is a costume — sometimes it was
> already deleted for a better reason than yours.**

---

## 3. The answer-material fork — DECIDED (Step 1 of the skill)

| Eval mode | Band | Answer is made of | Class | Status |
|---|---|---|---|---|
| `subitize` | all | the count, said aloud | `number_word_to_20` | ✅ benched · **CONVERT** |
| `make_ten` | **K** | **the enacted complement (taps)** | `manipulation` | ✅ benched · **KEEP SURFACE, add judge** |
| `make_ten` | 1–2 | the complement, said aloud | `number_word_to_20` | ✅ benched · **CONVERT** |
| `build` | all | the constructed frame (taps) | `manipulation` | ✅ benched · **KEEP SURFACE, add judge** |
| `operate` (`add`/`subtract`) | all | the sum/difference, said aloud | `number_word_to_20` | ✅ benched **iff ≤20** · **CONVERT, band-gated** |

Two verbal, two gestural-but-judged, one band-split. Structurally this is the same shape
`letter-sound-link` and `rhyme-studio` already shipped (some modes speak, one taps because
the class demands it) — the extraction has held four times; expect a script + a stage, not
loop wiring.

---

## 4. Content gates specific to ten-frame

These are the ones a generic port will miss.

1. **ZERO IS UNBENCHED.** `"zero"`/`"none"` is not a benched spoken answer (di-shapes rung 2
   residual); counting items floor at 1. An **empty frame is a legitimate subitize stimulus**
   and a subtraction can answer 0. → **Floor every spoken-answer item at 1 and drop items
   whose answer computes to 0.** (K subitize is documented as quantities 1–5, so K is
   naturally safe — the exposure is double-frame and `operate`.)
2. **THE ≤20 CEILING.** `number_word_to_20` is benched; `number_word_to_120` is build-ahead
   with **#63 acceptance owed**. Ten-frame tops out at 20 (double frame), so **this primitive
   fits entirely inside the benched range** — one of the reasons it is the right pilot. Do not
   let `operate` draw past 20.
3. **THE FRAME ITSELF IS AN ANSWER SURFACE — the leak scan must cover pixels, not just
   strings.** Every shipped leak gate in this family scans TEXT. Here the answer is a *visible
   count of counters*. Two existing contract requirements are exactly this defence and must
   survive verbatim:
   - **R4** — subitize is flash-then-hide: counters appear for `flashDuration`, then hide
     *before* the response surface opens; hidden counters cannot be manipulated. **If the DI
     loop leaves counters on screen while the tutor asks, subitizing becomes counting and the
     mode is destroyed.** The tutor's ask must fire against a HIDDEN frame.
   - **R5** — `showEmptyCount` is always false so the make-ten complement is never printed.
4. **"A correct response restores the counters" (R4)** — today that hangs off the Check
   click. **Re-hang it on the tutor's affirm**, not on a button that no longer exists.
5. **Reflash is question-side audio only.** The child may request another flash; that is the
   equivalent of tap-to-hear and it re-asks the QUESTION. It must never narrate the count
   (cvc's `[ISOLATE_VOWEL]` was an answer leak on demand — same trap).

---

## 5. Script questions (Step 2), answered for this primitive

- **Is the model the answer?** For `subitize` and `operate`, **modelling would say the
  answer** — so model NOTHING before the ask; the count is earned in the correction. The
  correction models the *counted walk* (`countWalk` in `countingBoardScript.ts` already
  builds *"One, two, three"* for ≤10 — reuse the pattern, do not re-roll it).
- **Can the stimulus answer the hand-over?** *"How many?"* against a hidden frame has exactly
  one right completion — this mode is naturally unambiguous, unlike word-flip's. Keep it short.
- **The ask states its problem aloud.** A pre-reader cannot read the screen. For `operate`
  the ask must SAY the fact (*"Three plus two. How many?"*) — this is `findUnspokenStimulus`'s
  rule, and it is the defect that a live drive of `di-spoken-practice` caught.
- **Signature error to name in the judging contract** (per mode):
  - `subitize` — **counting aloud one-by-one after the flash.** It reaches the right number by
    the wrong route and is the exact skill the mode exists to defeat. Refuse it, re-flash,
    re-ask. ⚠ But see the accept clause: a child who says the total *first* and then verifies
    is correct — **land-on-the-total is an ACCEPT** (phoneme-explorer's blend rule, one layer over).
  - `make_ten` (1–2) — **saying the total (10) instead of the complement.** Fluent, confident,
    wrong.
  - `operate` — **saying one of the operands back.**
- **Corrections open `"My turn:"`, affirmations `"Yes,"`** — and nothing else may open with
  either. Numbers are safe here, but run `validateJudgedScriptPack` over live-generated
  content anyway (that scan is the point of the probe).

---

## 6. What gets deleted, and what must survive

**Delete** (Step 3, whole-file rewrite): the `subitize` stepper + its `+`/`−` buttons, the
Grades 1–2 `make_ten` stepper, `handleCheckAnswer`, the Next/advance control, and any
`setTimeout`-driven advance. §1 census greps must return **0 — comments count**, so do not
name the deleted controls in prose.

**Must survive** (contract, re-based not forked):
- R3 — build stays a concrete construction task; the running count remains a tier-controlled
  aid, never the key.
- R4 — flash/hide lifecycle and the hidden-phase guard in `handleCellClick`.
- R5 — one numeric source of truth; complement derived, never printed.
- R6 @ K — the enacted-complement manipulation, untouched.
- R7 — tiers alter scaffolding, not magnitude (`flashDuration` 2000/1500/1000 by tier stays).
- R8 — **needs re-basing, and it is the one that actually changes:** "records one correct
  result before advancement" now means *the tutor's verdict advanced it*, not a Check click.
  Update the requirement's probe in the same slice and append the contract changelog.

---

## 7. Gates + close (pointers, not a re-statement)

Run **all of Step 7**: `typecheck:lumina` 0 · §1 census greps 0 · **live real-pipeline probes,
one per eval mode** against the real generator (`service/math/gemini-ten-frame.ts`), asserting
drops are rare and `validateJudgedScriptPack` passes over packs built from LIVE content ·
full vitest (own only your suites — concurrent-port noise in this lane is normal).
**Delete the probe file after the run** and record the drawn values in the queue block.

Probe specifically for: any item whose answer computes to **0**, and any `operate` draw
**above 20**. Those are this primitive's two drop conditions.

Close per Step 8: dated block in `qa/di/BACKLOG.md` **item 18** (not 16 — 16 is the literacy
campaign), a **HUMAN-CHECKS row** with per-mode wrong answers to say, and the WORKSTREAMS row.
**Re-grep HUMAN-CHECKS for the next free ID immediately before filing** — IDs move in this
lane, and the last reconcile wrote a stale count in the same minute one was filed.

Report it as *"shipped, mic row #N"*. The machine gates prove the pack; **only a mic run
proves the loop**, and a drive that answers everything correctly does not advance the row.

---

## 8. Open decisions — do not resolve these silently

1. **`operate` at Grades 1–2 with a double frame can exceed 20.** Options: band-gate `operate`
   to within-20, or hold it until #63 is accepted. **Recommend band-gating** — it keeps the
   port entirely inside benched territory and #63 is a human row this port should not wait on.
2. **Does `build` need the tutor's verdict at all, or is its auto-judge already the loop?**
   `build` self-checks against `targetCount`. Wrapping it in a judged verdict is the
   cvc-speller precedent (the gesture anchor has a production caller), but it is real work for
   a mode that already advances correctly. **Worth asking whether P1 ships the two spoken modes
   only**, leaving `build`/`make_ten`@K judged in a follow-up. A smaller first math port is
   defensible and gets the pilot driven sooner.
3. **`make_ten` @ K is arguably performable without the skill** (fill until full). That is a
   *pedagogy* question about R6, not a DI question — **file it, do not fix it here.** Changing
   it would reverse a standing user ruling.
