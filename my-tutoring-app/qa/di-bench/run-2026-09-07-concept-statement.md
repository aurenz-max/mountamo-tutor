# DI Bench run — 2026-09-07 · `concept_statement`, the first open-PROPOSITION class

**Subject:** `di-spoken-practice` `explain_concept` (new mode, qa/di/BACKLOG.md item 36; handoff
`qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md`).
**Harness:** `run_tutor_live.py --di-bench --di-bench-item <stimulus>` — one Live session per
stimulus, aggregated by hand (the narrowed workflow item 27's I2 fix made performable). Six sessions:
four stimuli, plus a re-run of `equal-sign` (the first sitting was killed by a backend reload — see
§Method) and a re-run of `ten-rod` (two REFUSE probes drew no verdict on the first sitting).
**Key:** `service/qa/di/conceptStatementBench.ts` (56 hand-authored probes, 14 per stimulus, both
sub-shapes), unit-gated by `conceptStatementBench.test.ts`.

## VERDICT — ✅ PASS · `concept_statement` moves `blocked` → `benched`

| Stimulus | Shape | Hard REFUSE (8) | valid-paraphrase | canonical / childlike | partial (soft) | Verdict |
|---|---|---|---|---|---|---|
| `3 + 2 = 5` (equal sign) | session-wide | **8/8 refused** | **2/2** | 1/2 · 1/1 | affirmed | PASS |
| `2, 4, 6, 8` (growing) | per-item | 7/8 refused · 1 no-verdict (`um`) | **2/2** | 2/2 · 1/1 | refused | PASS |
| `red, blue, red, blue` (repeating) | per-item | 7/8 refused · 1 no-verdict (`um`) | **2/2** | 2/2 · 1/1 | refused | PASS |
| `1 ten rod and 10 ones` (base ten) | session-wide | 7/8 refused · 1 no-verdict (`um`) † | **2/2** | 2/2 · 1/1 | refused | PASS |
| **total (final sittings)** | | **29/32 refused · 0 affirmed · 3 no-verdict** | **8/8 = 100%** (floor 80%) | 7/8 · 4/4 | 1/4 | **0 false affirmations** |

† ten-rod re-run. Its first sitting had 3 no-verdicts (`um` plus two REFUSE probes the tutor answered
with an improvised re-teach and no sentinel — see §What went wrong); the re-run measured both:
`the rod is bigger so it's more` → REFUSED, `the rod is one and the cubes are ten, so the cubes are
more` → REFUSED. First sitting also 0 false affirmations.

The class gate is stricter than the family's (`conceptBenchPasses`): zero false affirmations in the
hard REFUSE buckets **and** `valid-paraphrase` affirmed ≥ 80%, because a judge that refuses every
honest paraphrase never teaches a false thing and never affirms a child who has the idea in their
own words — `closed_set_choice` in disguise. Both halves cleared; the paraphrase half cleared at
100%.

**The headline is the paraphrase side.** Every one of the eight utterances built to carry the idea
with NO anchor phrase in it was affirmed, on the first try, in the tutor's exact scripted line:
*they match* · *this side and that side are even* · *it jumps by two* · *every number is two more
than the one before* · *it takes turns, one color then the other* · *it switches back and forth
between them* · *they're both ten* · *it's just the little cubes stuck together*. And the bucket
that fails a word-matching judge held in every sitting: *they are not the same* · *one side has
more, not equal* · *it's not plus two, it's plus one* · *you take away two each time* · *it's red
then blue then green* · *it does not repeat* · *ten ones is not the same as a ten* — anchor tokens
present, idea reversed, all refused.

The echo-plus-idea case the fixture planted on purpose — *red, blue, red, blue, over and over*
(the stimulus read back WITH the rule attached) — was AFFIRMED while the bare read-back *red blue
red blue* was REFUSED. The contract's "read back, with no idea added" wording is what separates
them, and it separated them.

Evidence: `run-2026-09-07-concept-statement-<stimulus>-console.txt` beside this file (the
`equal-sign` file is the re-run; `ten-rod` has a `-rerun` twin), and
`qa/tutor-reports/di-spoken-practice-live-di-bench-bench-concept-<stimulus>-2026-09-07.md`.

## Misses, none blocking

- **`it means equal` (equal-sign, valid-canonical) → REFUSED on the re-run; AFFIRMED on the
  killed first sitting.** A 1/2 borderline. "Equal" alone is the thinnest canonical in the key
  (the anchor "equal amounts" clipped to one word), and after this run's fresh-draw finding
  (§Yield) an anchor that is a word of the ask is no longer offered as an example at all — the
  judge is left to judge it on meaning, which is where a 1/2 belongs.
- **`valid-partial` (soft) 1/4 affirmed** — *same* affirmed once, *twos* / *it repeats* / *same*
  refused. Recorded, never counted; the key marks the half-answer bucket soft because both
  verdicts are defensible.
- **`um` → no verdict, 3/4 sittings.** The tutor re-asked the question instead of running the
  correction — the catalog's own struggle response for a stalled learner ("re-ask the scripted
  question once"). Not an affirmation; a text-turn stand-in for dead air that the mic row owns.

## What went wrong, honestly

1. **The first `equal-sign` sitting was killed by me.** I edited `backend/…/problem_type_registry.py`
   while the session was open; uvicorn `--reload` restarted and the WS closed `1012`. Twelve of
   fourteen probes had already drawn verdicts (all agreed, *it means equal* affirmed); the two
   off-task probes were lost. Re-run in full after the other three sittings. `NEVER edit backend/
   mid-run` is in memory and I did it anyway — recorded so the next reader does not.
2. **The first `ten-rod` sitting drifted off script.** Five embellished affirmations ("We are doing
   great today! Soon you'll be using…"), one false-completion claim ("we've completed our first
   task!"), and two REFUSE probes answered with an improvised re-teach carrying no sentinel — the
   say-exactly grip decaying under consecutive corrections, the shape the open-set record already
   documents. The gate reads it correctly (no verdict ≠ agreement; nothing affirmed), and the re-run
   held the script on all fourteen probes. **Session variance, not a contract defect** — but it is
   the strongest argument yet for item 30's second correction rung.
3. **`di-correction-verbatim-repeat` WARNs on every sitting** — family-wide (item 30), not this
   pack's.

## Method notes that changed the build

- **The bench needed an adapter before it could run.** `di-spoken-practice` had no `DI_PORTS`
  entry (the compare_choice slice logged "no live drive", #137). Registering one (`build` re-runs
  the shipped gate over the generated items; `benchBuild` pushes the key through the shipped
  `buildSpokenItem`) opened all five modes to `--di`, and the bench to `--di-bench`.
- **`checkPackGates` caught a birth defect the pack had carried since 2026-08-11:** the judging
  contract opened with the imperative *"Then wait for the learner."* — the performed-stage-direction
  shape the 19a sweep removed from nine packs, missed here because nothing ran the testkit gate over
  this pack until the adapter did. Now the fact form (*"You then stay silent while the learner
  answers."*).
- **The fixture goes through the SHIPPED build gate**, and its own test asserts every stimulus
  survives it — a dropped fixture item would have silently thinned the bench to 3/4.

## What this bench cannot answer

The harness sends TEXT. Semantics of the judge, yes; whether a six-year-old's *they're even*
ARRIVES as *they're even*, no. **Mic row: HUMAN-CHECKS #139.**

## Yield — the pilot after the bench (handoff §7.4, `scripts/probe-di-spoken-practice-explain.mjs`)

Selection: both frozen draws (`…ah5w` obj2, `…f00i` obj3), pins stripped, route their spoken slot
to `explain_concept` through the real `resolveLessonEvalModes` — 2/2, every probe run. Refusal: a
procedure ("explain how to solve… step by step") ships nothing — 4/4 runs.

Resolution went **3/6 → 4/6 → 4/6 → 6/6** across four probe runs, each step a gate that was
refusing good items (reports `qa/eval-reports/di-spoken-practice-explain-2026-09-07{,-v2,-v3,-v4}.json`
+ `-v3.log`/`-v4.log`):

| Run | Draws shipping ≥3 | What was refusing them | Lever |
|---|---|---|---|
| v1 | 3/6 | reviewer rejecting two of four → thin; planner `unsupported` 1/3 on the rule objective | over-ask (`count + 2`, ship `count`), pooled survivors, one re-read of an `unsupported` plan under a pin |
| v2 | 4/6 | ids-only drop log — unreadable | `gateSpokenItems` returns reasons |
| v3 | 4/6 | `anchors_not_distinct` on ONE planned "same as" zeroed a whole stamped session (6/6 ×2); `too_many_anchors` (4); an alternate "red blue" echoing the instance; "10, 20, 30, 40" dropped because the number-word map stopped at 20 | `normalizeConceptAnchors` (dedupe, cap 2, drop echo alternates) at plan AND build; spoken-number tokens to 120 |
| v4 | **6/6** | — | — |

Then the fresh full-pipeline draws found one more: the ask names the thing being explained ("what
does the **equal** sign tell us?"), so a planned anchor "equal" leaked into every ask and `…i08t`
shipped 0/6 twice. `reconcileConceptAnchors` drops an alternate the ask contains and hands a
primary the ask contains over to the first safe alternate; `hasConceptCoverage` checks the stamped
set as a subset. Confirm results per objective are in `qa/lesson-bench/BACKLOG.md` item 26(a)/(b)
and `qa/di/BACKLOG.md` item 36.
