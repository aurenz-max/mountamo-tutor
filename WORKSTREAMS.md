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
| `main` | `87ecb56d` (09-26); branch pushed through `08673c20`, tree clean. Fast-forward `main` proposed | 09-29 |
| Test ladder | T0 dry sweep J1-J8 (free) · T1 miss/lever `it.each` (free) · T2 JEV observer on recorded packets (NOT BUILT) · T3 text replay, harm checks only · T4 Live, weekly sample (`LIVE_TESTING.md`) | 09-27 |
| Gates | `typecheck:lumina` 0; full tsc 770 (handoff 24, 09-29) | 09-29 |
| Human checks | 129 open, next free **#180** (`my-tutoring-app/qa/HUMAN-CHECKS.md`) | 09-29 |
| Sessions | none running. Ready 09-29: 29 (J12: past Live findings closed at their class, BS-3 cap), 30 (M3 levers), 32 (M4 levers). 31 PARKED | 09-29 |

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
| 2.2 | T3 responsiveness: after a named miss, does the reply address the pattern with no answer or guessed cause? | `/add-live-tutor-tools` · handoff 20 Part C | open. RP-2 DONE 09-29 (handoff 27): words decide on counting-board `count`, ten-frame `subitize`; other modes need a transcript pilot |
| 2.4 | One gate command per family (T0-T3, pass/fail) | `/add-live-tutor-tools` · `LIVE_TESTING.md` | open |

## Phase 3 — Levers answer misses (CURRENT beside 1; user 09-27 reorder)

Exit: stuck-prone primitives have help and simplify levers; each lists `answers`; each passes
its vitest gate; Live is 1-2 runs per class, never per primitive.

| # | Item | Executor · queue | State |
|---|---|---|---|
| 3.0 | J9 sweep rule + S2 trigger ladder (2nd wrong auto-pulls help) | handoff 21 S1-S2 | DONE 09-27 |
| 3.0b | Measure every math mode | handoff 21 S1b | DONE 09-28; findings ~~NL-2~~ (`4f65635d`), BS-3 (sweep cap, runtime lane), CO-6, SW-1..8 (`/add-live-tutor-tools`) |
| 3.1 | Math by class · `qa/support-levers/reinventory-2026-09-29.md` | `/add-support-tiers` · handoff 21, **23** | M1 all modes DONE, **Live gate PASSED 09-29** (`qa/tutor-reports/m1-live-gate-2026-09-29.md`). M2 spoken modes DONE 09-29 (`qa/eval-reports/levers-M2-spoken-2026-09-29.md`). M4 (handoff 32): ten-frame all modes DONE 09-29 (`qa/support-levers/m4-lever-tables-2026-09-29.md`); next hundreds-chart. M3 (handoff 30): strategy-picker SKIPPED (user 10-02); math-fact-fluency all modes DONE 10-02, speed_round ruled out (`qa/support-levers/m3-lever-tables-2026-10-02.md`); next addition-subtraction-scene. Next: 23 step 3 (M2 Live pair, needs a mixed M2 payload) |
| 3.1b | Literacy by class | `/add-support-tiers` · handoffs 22, 24 | All 93 modes measured; every K-2 mode levered or ruled out (`levers-literacy-K2-close-2026-09-29.md`). L1-L3 Live PASSED 09-29 (`h26-live-gates-2026-09-29.md`). L4 waits on the story-bridge ruling. **G2-6 (plan `qa/support-levers/literacy-lever-plan-2026-10-03.md`, rulings R1-R9 as recommended):** step 0 DONE 10-04 `f08134f5`; word-builder DONE 10-04, all 4 modes (`qa/eval-reports/word-builder-levers-2026-10-04.md`). sentence-analyzer DONE 10-04, all 4 modes (`qa/eval-reports/sentence-analyzer-levers-2026-10-04.md`). genre-explorer DONE 10-04, all 3 modes (`qa/eval-reports/genre-explorer-levers-2026-10-04.md`). text-structure-analyzer DONE 10-04, all 4 modes (`qa/eval-reports/text-structure-analyzer-levers-2026-10-04.md`). All 15 G2-6 modes have levers. Plan step 5 READY 10-04: mixed payloads driven clean, text replay 4 x 5 0 flags; the class Live gate is paid, user runs or approves (commands in the plan) |
| 3.1c | knowledge-check levers | `/add-support-tiers` · handoff 25 | DONE 09-29, all 4 modes; KC-UB fixed (`e608d16b`); Live PASSED 09-29. Open: LB-18; LB-21 re-run after RP-2 ships (1 run) |
| 3.1d | DI by class (10 families, 37 modes). **User 10-02:** DI gets in-item levers; its correction is a parallel-item model lever (help, never the learner's item) | `/add-support-tiers` | di-math-facts DONE 10-02, all 5 modes (`qa/eval-reports/di-math-facts-levers-2026-10-02.md`); shared `DiTeachingStage` levers prop in. Replay 0 flags; browser HUMAN-CHECKS #183. di-dice-roll DONE 10-03, all 3 modes (`qa/eval-reports/di-dice-roll-levers-2026-10-03.md`). Prep (plan step 0) DONE 10-03 `22db8df0`: R5 vowel ask, R2 no model of the child's item, R10, payloads. di-shapes DONE 10-03, all 5 modes (`qa/eval-reports/di-shapes-levers-2026-10-03.md`). di-letter-sounds DONE 10-03, all 3 modes (`qa/eval-reports/di-letter-sounds-levers-2026-10-03.md`). di-word-reading DONE 10-03, all 4 modes (`qa/eval-reports/di-word-reading-levers-2026-10-03.md`). di-sentence-reading DONE 10-03, all 4 modes (`qa/eval-reports/di-sentence-reading-levers-2026-10-03.md`). di-worked-procedure DONE 10-03, all 2 modes (`qa/eval-reports/di-worked-procedure-levers-2026-10-03.md`). di-deduction DONE 10-03, all 3 modes (`qa/eval-reports/di-deduction-levers-2026-10-03.md`). di-spoken-practice DONE 10-03, all 5 modes (`qa/eval-reports/di-spoken-practice-levers-2026-10-03.md`). di-word-problem-setup DONE 10-03, all 3 modes (`qa/eval-reports/di-word-problem-setup-levers-2026-10-03.md`). All 37 DI modes have levers (plan steps 0-8 DONE 10-03). Next: the class Live gate, plan step 9, READY (commands in `qa/support-levers/di-lever-plan-2026-10-03.md`); paid, user runs or approves. Class Live waits for all 37 modes |
| 3.1e | Lever sweep across every remaining workspace primitive (user 10-08: workflow, 5 at a time, gate each batch) | `/add-support-tiers` | DONE 10-09, committed (a70795d2 shared, efc5fe71 science/other, ec956db8 math, f3934578 ramp-lab, b894451e literacy): 9 batches, 45 primitives, every batch gated (typecheck:lumina 0, batch tests, journey sweep, text replay); reports `my-tutoring-app/qa/eval-reports/<id>-levers-2026-10-08.md`. New sweep check J12 (per-item lever coverage) + queue `my-tutoring-app/qa/support-levers/QUEUE-item-gaps-2026-10-09.md`; shared fixes: practice return opens blank (`onPracticeClosed`), `levers: true` on 13 catalog entries (skill step added). **strategy-picker got levers despite the 10-02 SKIP: user to keep or revert.** Rulings owed: recount_moved, habitat connect gap, balance-scale easy-tier numbers, hundreds-chart practice, 3d 'like a box'. Class findings open: tutor says 'the other card' on two-choice retries; tutor improvises aids on no-lever modes (speed_round); empty tutor turns at lever/credit moments; replay pulls only the first fitting lever. Browser checks owed on every new render |
| 3.2 | Lever bench misses from Live runs | row executor · `qa/lever-bench/QUEUE.md` | 21 rows; open from handoff 26: LB-18, LB-21 |
| 3.3 | Class Live pair (text + `--audio`, mixed payload), only when every mode of every primitive in the class has misses and levers (user 09-28) | `/add-live-tutor-tools` · handoff 21 | PASSED 09-29: M1, L1, L2, L3, knowledge-check. Next: M2 (23 step 3). L4 waits on a ruling. DI class READY 10-03 (3.1d; plan step 9). Literacy G2-6 class READY 10-04 (3.1b; `qa/support-levers/literacy-lever-plan-2026-10-03.md` step 5) |

## Phase 4 — Open build: build is a modality (CURRENT, user 10-07)

| # | Item | Executor · queue | State |
|---|---|---|---|
| 4.1 | Build modes across primitives, by wave (OB-0..6); rulings R1 (stillness auto-submit), R2 (watcher voice) | `/add-eval-modes` · `my-tutoring-app/qa/open-build/ROADMAP.md` | waves 1-2 BUILT 10-07 (10 math build modes, c162eda0); wave 3 literacy (OB-3L) BUILT 10-07/08, committed 0553a6e7: 7 build modes (word-builder, cvc-speller, sound-swap, rhyme-studio, phonics-blender, paragraph-architect, sentence-builder) on the shared word judge, all headless-driven; OB-7L (session 17) BUILT 10-08, committed b894451e: R12 done, opinion-builder, revision-workshop, figurative-language-finder, story-planner workspace-only with build_opinion + build_figurative (report `my-tutoring-app/qa/open-build/literacy-round2-2026-10-08/REPORT.md`); next: literacy class Live gate (needs go-ahead), R13. OB-4 pilot tower-stacker BUILT 10-08, committed f3934578 (3 code-judged build modes, bound; `my-tutoring-app/qa/open-build/tower-stacker-2026-10-08/REPORT.md`); gear-train-builder BUILT 10-08, committed f3934578 (`my-tutoring-app/qa/open-build/gear-train-builder-2026-10-08/REPORT.md`); next OB-4: pulley, bridge, blueprint. OB-9M math wave 3 pilot ten-frame `build_pair` BUILT 10-08, committed ec956db8 (`my-tutoring-app/qa/open-build/ten-frame-2026-10-08/REPORT.md`); pattern-builder `create` open build BUILT 10-08, committed ec956db8 (`my-tutoring-app/qa/open-build/pattern-builder-2026-10-08/REPORT.md`; levers owed); shape-composer `free-create` open build BUILT 10-08, committed ec956db8 (`my-tutoring-app/qa/open-build/shape-composer-2026-10-08/REPORT.md`; workspace + levers owed); OB-9M queue empty. Overnight sweep 10-09 BUILT + merged, committed (ec956db8 math, f3934578 lever-lab, efc5fe71 atom-builder): polygon `build_perimeter`, number-line `build_hops`, lever-lab `build_balance`/`build_lift`, atom-builder `make_atom`, function-machine `make_rule` (drives 20/20-28/29, reports `my-tutoring-app/qa/open-build/*-overnight/REPORT.md`); next = class capabilities `my-tutoring-app/qa/open-build/CAPABILITIES-2026-10-09.md`, 3 rulings owed. Waves 1-2 must `/ship` first; handoff `my-tutoring-app/qa/HANDOFF-open-build-wave3-2026-10-07.md` |

## Phase 5 — Parent report: "how is my child doing?" (CURRENT, user 10-07)

| # | Item | Executor · queue | State |
|---|---|---|---|
| 5.1 | Parent report: facts endpoint, Gemini narrative, parent skill text, at-home tips, report panel atop My Progress | `/student-data-loop` · `my-tutoring-app/qa/parent-report/ROADMAP.md` | PR-1..4 DONE 10-08 (65b072b3), verified in app; open: PR-R1/R2 rulings, PR-D2 cleanup (user) |

## Later (proposed, user to confirm) — misses reach the next lesson

Store misses and lever pulls as observations (other session has started); a Lesson Builder
fill mode turns repeated misses into `preBuiltObjectives`; miss frequency orders which
levers get built. Owner `/student-data-loop` §7. Human sittings: HUMAN-CHECKS.

## Rulings owed (block nothing above unless named)

| Ruling | Where |
|---|---|
| story-bridge say_alike, say_different, main_idea_compare: spoken misses (Part B), or out of L4's class gate? | handoff 24 step 3 |
| 19-9a: push-pull-arena `success` = passed (67% recovery now records failed)? 19-9b: per-problem records keep their own score? | handoff 19 |
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
