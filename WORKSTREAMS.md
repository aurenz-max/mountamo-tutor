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

## Where we are (2026-09-28)

The pipeline being built: **primitive check → named miss → the tutor and JEV act on it → a
lever → the record → the next lesson**, each link tested at the cheapest tier that can see
it. Gesture misses are named for bound families; every later link is partial.

| Item | State | As of |
|---|---|---|
| `main` | `87ecb56d`. Branch is 70 commits ahead, plus ~340 UNCOMMITTED paths from three lanes (1.4 spoken misses, M1/M2 levers, literacy L1-L3). `/ship` before any new slice | 09-28 |
| Test ladder | T0 dry sweep J1-J8 (free) · T1 miss/lever `it.each` (free) · T2 JEV observer on recorded packets (NOT BUILT) · T3 text replay, harm checks only · T4 Live, weekly sample (`LIVE_TESTING.md`) | 09-27 |
| Gates | `typecheck:lumina` 0; full tsc 773 (last measured 09-27; re-run at `/ship`) | 09-27 |
| Human checks | 125 open, next free **#176** (`my-tutoring-app/qa/HUMAN-CHECKS.md`) | 09-28 |
| Sessions | handoff 21 M1 done; 1.4, M2 and L3 sessions wrote to the tree 09-28. `runtime/` is no longer held for M1; commit 1.4 before another session edits it | 09-28 |

## Phase 1 — A miss is one contract, detected on both channels (CURRENT)

Exit: every bound mode's misses are defined once as `{ id, pattern }`; gesture checks and
`spoken_miss` both name them; the tutor packet carries the pattern, not a bare id.

| # | Item | Executor · queue | State |
|---|---|---|---|
| 1.1 | W1 binding rollout C10-C19, each with its miss function | `/add-live-tutor-tools` · `qa/workspace-rollout/ROLLOUT.md` | DELEGATED (other session) |
| 1.2 | Gesture misses for bound families | `/add-support-tiers` · handoff 20 A | DONE 09-27 (RP-7 closed) |
| 1.3 | Miss definitions carry their observable pattern (today only in docblocks); the packet and `spoken_miss` read them; doctrine says what to do with a miss | `/add-live-tutor-tools` · handoff 20 (new) | open; packet side needs `runtime/` |
| 1.4 | Spoken misses wired (59 families) | `/add-live-tutor-tools` · handoff 20 Part B | DONE 09-28 (uncommitted): 0 FP in 3630; report `qa/tutor-reports/spoken-miss/wired-2026-09-28.md` |
| 1.5 | Consolidation slices 5-7; RP-3/4/5/6 | `/add-live-tutor-tools`, `/eval-fix` · handoffs 19, 20 | slice 6 evidence merge DONE 09-27 (live-host refusal half open); rest unblocked once 1.4 is committed |

## Phase 2 — The ladder tests a passing student first, then a miss (NEXT)

Exit: for any family, one command runs T0-T3 and fails on a wrong record for a clean pass, a
wrong credit, an unanswered miss or an unresponsive reply. Live stays the weekly sample and
the classes replay cannot see (tool narration, timing, audio).

| # | Item | Executor · queue | State |
|---|---|---|---|
| 2.0a | J10 clean pass: every item right first time completes once, and the submission says so (passed, score, first-try count = items, no assistance). The sweep today only runs wrong-then-right and checks the submission COUNT, never its content | `/add-live-tutor-tools` · handoff 19 slice 9 | open (sweep is in `runtime/`) |
| 2.0b | J11 honest record after a recovery: solved, not first-try, the miss in the attempts, score by the first-response gate | `/add-live-tutor-tools` · handoff 19 slice 9 | open |
| 2.1 | T2: recorded packets sent to the real observer; missed credit (a stall) and false credit per family | `/add-live-tutor-tools` · handoff 19 slice 8 | open |
| 2.2 | T3 responsiveness: after a named miss, does the reply address that pattern with no answer, fix or guessed cause? A typed JEV judgment, calibrated on hand-labelled Live lines | `/add-live-tutor-tools` · handoff 20 Part C | open |
| 2.4 | One gate command per family (T0-T3, pass/fail) | `/add-live-tutor-tools` · `LIVE_TESTING.md` | open |

## Phase 3 — Levers answer misses (CURRENT beside 1; user 09-27 reorder)

Exit: stuck-prone primitives have help and simplify levers; each lists `answers`; each passes
its vitest gate; Live is 1-2 runs per class, never per primitive.

| # | Item | Executor · queue | State |
|---|---|---|---|
| 3.0 | J9 sweep rule + S2 trigger ladder in `runtime/` (2nd wrong auto-pulls help; stuck-first = help only) | `/add-support-tiers`, `/add-live-tutor-tools` · handoff 21 S1-S2 | DONE 09-27 (replay 2/30 vs 3/20 baseline) |
| 3.0b | Measure every math mode: payloads + sweep `leverInventory` | handoff 21 S1b | DONE 09-28: 24/319 graded modes have levers; findings NL-2, BS-3 (`/eval-fix`), CO-6, SW-1..8 (`/add-live-tutor-tools`); backend session-score ruling open |
| 3.1 | Math by class M1-M4; vitest gate per primitive · inventory `qa/support-levers/inventory-2026-09-27/` | `/add-support-tiers` · handoff 21 | M1, M2 tap modes DONE 09-28 (`levers-M2-2026-09-28.md`). Spoken modes name misses since 1.4 (ids in `unanswered`); they still lack levers, so no class is Live-ready. Next: M1 spoken levers, regroup journey fix, then M3 |
| 3.1b | Literacy by class L1-L4; literacy files only, no `runtime/` | `/add-support-tiers` · handoff 22 | L1 DONE (#172), L2 DONE (#173), L3 DONE for 4/5 (#174) 09-28: shared print overlay `LuminaPrintSupport`; phonics-blender inventory drafted, levers wait on a user OK; Live pair per 3.3 rule; next L4 |
| 3.2 | Lever bench misses from Live runs | row executor · `qa/lever-bench/QUEUE.md` | 12 rows |
| 3.3 | Class E2E, 2 Live runs on `--mode mixed` (text + `--audio`). Only when every eval mode of every primitive in the class has misses and levers (user 09-28); tutor pulls unprompted, receipt before narration | `/add-live-tutor-tools` · handoff 21 | no class ready |

## Later (proposed, user to confirm) — misses reach the next lesson

Store misses and lever pulls as observations (other session has started); a Lesson Builder
fill mode turns repeated misses into `preBuiltObjectives`; miss frequency orders which
levers get built. Owner `/student-data-loop` §7. Human sittings: HUMAN-CHECKS.

## Rulings owed (block nothing above unless named)

| Ruling | Where |
|---|---|
| RP-2: after a wrong spoken answer, must the tutor say a plain "not yet", or may a named miss ground "not credited"? | handoff 20 Part C |
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
