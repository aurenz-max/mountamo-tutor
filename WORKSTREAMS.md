# Workstreams — Portfolio Index

Start here for "what's next?": pull the top open item of the CURRENT phase.
**Queues are authority over this file; this file over memory.** Reset 2026-09-27; the
pre-reset index (57 KB, 30 lanes) is in `git log -p WORKSTREAMS.md`.

## Rules

This file holds state only. Before finishing, all three must hold:

```bash
wc -c < WORKSTREAMS.md                                            # <= 10000 bytes
awk 'length>400 && /^\|/ {print FNR": "length}' WORKSTREAMS.md    # empty
grep -c '^> ### ' WORKSTREAMS.md                                  # 0
```

| The finding… | Home |
|---|---|
| changes how the next slice is done | the executor skill |
| is true about one primitive | `docs/contracts/<id>.md` |
| is a defect class | its own queue item |
| is evidence of a run | `qa/tutor-reports/`, `qa/<lane>/` |
| is state (phase, lane, next pull) | here, as a row |

## Where we are (2026-09-29)

The pipeline being built: **primitive check → named miss → the tutor and JEV act on it → a
lever → the record → the next lesson**, each link tested at the cheapest tier that can see
it. Gesture misses are named for bound families; every later link is partial.

| Item | State | As of |
|---|---|---|
| `main` | `87ecb56d`; branch pushed through `f26c2915` (M1 Live gate). ~127 paths uncommitted 09-29: knowledge-check levers (25), literacy K-2 close (24), `runtime/` (64 paths). `/ship` next | 09-29 |
| Test ladder | T0 dry sweep J1-J8 (free) · T1 miss/lever `it.each` (free) · T2 JEV observer on recorded packets (NOT BUILT) · T3 text replay, harm checks only · T4 Live, weekly sample (`LIVE_TESTING.md`) | 09-27 |
| Gates | `typecheck:lumina` 0; full tsc 770 (handoff 24, 09-29) | 09-29 |
| Human checks | 129 open, next free **#180** (`my-tutoring-app/qa/HUMAN-CHECKS.md`) | 09-29 |
| Sessions | none running 09-29; handoffs 23 (step 1 done), 24 (steps 1-2 done), 25 (done) wait on `/ship` | 09-29 |

## Phase 1 — A miss is one contract, detected on both channels (CURRENT)

Exit: every bound mode's misses are defined once as `{ id, pattern }`; gesture checks and
`spoken_miss` both name them; the tutor packet carries the pattern, not a bare id.

| # | Item | Executor · queue | State |
|---|---|---|---|
| 1.1 | W1 binding rollout C10-C19, each with its miss function | `/add-live-tutor-tools` · `qa/workspace-rollout/ROLLOUT.md` | DELEGATED (other session) |
| 1.2 | Gesture misses for bound families | `/add-support-tiers` · handoff 20 A | DONE 09-27 (RP-7 closed) |
| 1.3 | Miss definitions carry their observable pattern (today only in docblocks); the packet and `spoken_miss` read them; doctrine says what to do with a miss | `/add-live-tutor-tools` · handoff 20 (new) | open; packet side needs `runtime/` |
| 1.4 | Spoken misses wired (59 families) | `/add-live-tutor-tools` · handoff 20 Part B | DONE 09-28 (`b431d545`; route file still untracked): 0 FP in 3630; report `qa/tutor-reports/spoken-miss/wired-2026-09-28.md` |
| 1.5 | Consolidation slices 5-7; RP-3/4/5/6 | `/add-live-tutor-tools`, `/eval-fix` · handoffs 19, 20 | slice 6 evidence merge DONE 09-27 (live-host refusal half open); rest unblocked once 1.4 is committed |

## Phase 2 — The ladder tests a passing student first, then a miss (NEXT)

Exit: for any family, one command runs T0-T3 and fails on a wrong record for a clean pass, a
wrong credit, an unanswered miss or an unresponsive reply. Live stays the weekly sample and
the classes replay cannot see (tool narration, timing, audio).

| # | Item | Executor · queue | State |
|---|---|---|---|
| 2.0a | J10 clean pass: the submission says passed, score, first-try = items, no assistance | `/add-live-tutor-tools` · handoff 19 slice 9 | done 09-28: 228/237 payloads; rulings 19 9a, 9b owed |
| 2.0b | J11 honest record after a recovery: solved, not first-try, the miss in the attempts, score by the first-response gate | `/add-live-tutor-tools` · handoff 19 slice 9 | done 09-28: 224/237 checked; mutation (merge keeps the primitive's score) fails 68 |
| 2.1 | T2: recorded packets sent to the real observer; missed credit (a stall) and false credit per family | `/add-live-tutor-tools` · handoff 19 slice 8 | open |
| 2.2 | T3 responsiveness: after a named miss, does the reply address that pattern with no answer, fix or guessed cause? A typed JEV judgment, calibrated on hand-labelled Live lines | `/add-live-tutor-tools` · handoff 20 Part C | open; RP-2 ruled 09-28 (JEV knows a wrong spoken answer from the learner's words; build in handoff 20) |
| 2.4 | One gate command per family (T0-T3, pass/fail) | `/add-live-tutor-tools` · `LIVE_TESTING.md` | open |

## Phase 3 — Levers answer misses (CURRENT beside 1; user 09-27 reorder)

Exit: stuck-prone primitives have help and simplify levers; each lists `answers`; each passes
its vitest gate; Live is 1-2 runs per class, never per primitive.

| # | Item | Executor · queue | State |
|---|---|---|---|
| 3.0 | J9 sweep rule + S2 trigger ladder (2nd wrong auto-pulls help) | handoff 21 S1-S2 | DONE 09-27 |
| 3.0b | Measure every math mode | handoff 21 S1b | DONE 09-28; findings NL-2, BS-3 (`/eval-fix`), CO-6, SW-1..8 (`/add-live-tutor-tools`) |
| 3.1 | Math by class · `qa/support-levers/reinventory-2026-09-29.md` | `/add-support-tiers` · handoff 21, **23** | M1 all modes DONE, **Live gate PASSED 09-29** (`qa/tutor-reports/m1-live-gate-2026-09-29.md`; LB-15 open). Next: 23 step 2 (M2 spoken: compare-objects, number-sequencer, ordinal-line), M2 Live pair, M3 |
| 3.1b | Literacy by class; literacy files only | `/add-support-tiers` · handoff 22, **24** | 09-29: all 93 modes measured; every K-2 mode levered or ruled out by decision (handoff 24 steps 1-2, [report](my-tutoring-app/qa/eval-reports/levers-literacy-K2-close-2026-09-29.md)). Next: step 3 Live pairs, after the user rules on story-bridge's three spoken comparisons (L4) |
| 3.1c | knowledge-check levers (every subject; near/far tag first) | `/add-support-tiers` · handoff **25** | DONE 09-29: `cue_picture` + `drop_far_choice` on choice items, all 4 modes levered, J9 green (`qa/eval-reports/knowledge-check-levers-2026-09-29.md`). Finding **KC-UB** (`/eval-fix`): 6/12 G1-2 generations run as the tap flow (stem > 24 words, key word in a quoted-sentence stem) |
| 3.2 | Lever bench misses from Live runs | row executor · `qa/lever-bench/QUEUE.md` | 12 rows |
| 3.3 | Class E2E, 2 Live runs on `--mode mixed` (text + `--audio`). Only when every eval mode of every primitive in the class has misses and levers (user 09-28); tutor pulls unprompted, receipt before narration | `/add-live-tutor-tools` · handoff 21 | M1 PASSED 09-29; K-2 literacy classes ready except L4 (story-bridge ruling); knowledge-check ready |

## Later (proposed, user to confirm) — misses reach the next lesson

Store misses and lever pulls as observations (other session has started); a Lesson Builder
fill mode turns repeated misses into `preBuiltObjectives`; miss frequency orders which
levers get built. Owner `/student-data-loop` §7. Human sittings: HUMAN-CHECKS.

## Rulings owed (block nothing above unless named)

| Ruling | Where |
|---|---|
| story-bridge say_alike, say_different, main_idea_compare: spoken misses (Part B), or out of L4's class gate? | handoff 24 step 3 |
| 19-9a: push-pull-arena `success` = passed (67% recovery now records failed)? 19-9b: per-problem records keep their own score? | handoff 19 |
| Do DI families get in-item levers, or keep "my turn" only? | `reinventory-2026-09-29.md` |
| Pip: DECIDE (4 sims) and DESIGN rows | `qa/pip-surface/ROLLOUT.md` |
| TypeSafe (a)-(d): quality study, retrieval gate, hypothesis verifier, shadow in traffic | `qa/typesafe/README.md` |
| C9 content: equation-builder tiles, pattern-builder create, strategy-picker hop; balance-scale `two_step` scoring; scratch pad; spoken evidence capture | `qa/tutor-reports/workspace-rollout-*` |

## Parked (queue trusted as of its date; resume only by user choice)

| Lane | Resume point · queue | As of |
|---|---|---|
| Judged-loop ports, DI for older learners, `di-spoken-practice` | superseded by the workspace for bound packs; residuals in `qa/di/BACKLOG.md` | 09-12 |
| Misconception loop (place value, fraction-bar, fraction-circles) | live teaching/fading acceptance · `qa/misconception/` | 09-13 |
| Pip surface rollout | 184/212 publish; rulings above · `qa/pip-surface/ROLLOUT.md` | 09-24 |
| Coverage, K Math and curriculum fit atlases | `k-grammar-completion` via `/add-eval-modes` · atlas reports | 09-09 |
| `reading-repair-studio` | L3 support tiers · `qa/eval-reports/reading-repair-studio-2026-09-13.md` | 09-13 |
| History suite | birth `source-detective`; G5 3-card chains (`/eval-fix`) | 09-03 |
| Science depth · reader-fit sweep | LCS-1 via `/oracle-test` · item 17 via `/add-eval-modes` | 08-22 |
| LA-15 tutor detour | D2 shipped; prerequisite fallback parked (see Phase 3) · `LIVE_LESSON_ROADMAP.md` | 09-26 |
| TU-6 tutor reads state aloud · IMG-1 tutor blind to images | TU-6 needs a non-voiceable channel (di item 32); IMG-1 parked by user | 09-04 |
| Lesson Bench · lesson ordering | paused / rejected by user; no pull | 09-07 |

Closed and not reopened: student interests themed lessons (09-16), `gemini-3.8-live` default
(09-15), intent contract 174/174 (08-21), pilot onboarding (08-14).

## Recorded once, so it is not re-discovered

- `vercel.json` pins no branch; `cloudbuild.yaml` deploys `ai-tutor-backend`, the live
  service is `mountamo-education` (08-18).
- `parent/link-student` has no verification; the parent portal is vestigial (user 08-14).

## Hygiene

- Close the row in the same slice as the work, and update the owning queue too.
- Re-grep IDs (HUMAN-CHECKS `### #N`, queue items) right before filing: sessions run in parallel.
- Commit at the mechanism boundary; shared files (EVAL_TRACKER, BACKLOG, harness) get their own slice.
