# Workstreams — Portfolio Index

Start here for "what's next?": pull the top open item of an ACTIVE phase.
**Queues are authority over this file; this file over memory.** Superseded rows and
their evidence: `git log -p WORKSTREAMS.md` (last long form f9ee7e45, 10-15).

## Rules

This file holds state only. Before finishing, all three must hold:

```bash
wc -c < WORKSTREAMS.md                                            # <= 10000 bytes
awk 'length>400 && /^\|/ {print FNR": "length}' WORKSTREAMS.md    # empty
grep -c '^> ### ' WORKSTREAMS.md                                  # 0
```

Findings go to: the executor skill (how) · `docs/contracts/<id>.md` (one primitive) · a
queue item (a defect class) · `qa/<lane>/` (run evidence) · here, as a row (state only).

## Where we are (2026-10-15)

| Item | State |
|---|---|
| Branch | `ship/2026-08-10-judged-loop` pushed; `main` = 56fbda8c, 6 behind (fast-forward owed) |
| Tree | construction3d.ts view tweak + airplane `flight_plan` W1 payload uncommitted (4.2); `my-tutoring-app/sizes.txt` scratch |
| Gates | `typecheck:lumina` 0; full tsc 770 baseline (09-29, re-measure) |
| Human checks | 134 open, next free #185 (`my-tutoring-app/qa/HUMAN-CHECKS.md`); 10-08..10-15 browser debt still lives in queues |
| WIP | 7 phases marked current vs a limit of 2+1. Proposal 10-15 below, user to confirm |

## Phases

| # | Phase | Queue · executor | State · next pull |
|---|---|---|---|
| 1 | A miss is one contract, both channels | `qa/workspace-rollout/ROLLOUT.md` · `/add-live-tutor-tools` | **ACTIVE 10-15 (user).** 158 `teachingWorkspace` blocks. R1 done: batches 1-3 10-15 (15 primitives), batch 4 10-16 (9: engineering + exhibits, all rebuilt; rulings closed 10-16, all accepted). VB-F1 done 10-16 (J15). Next R2 (26 without modes), then VB-2, then phase 2 |
| 2 | The ladder tests a pass, then a miss | handoff 19/20, `LIVE_TESTING.md` · `/add-live-tutor-tools` | J10/J11 done 09-28. Open: T2 observer replay, T3 responsiveness, one gate command per family |
| 3 | Levers answer misses | `qa/support-levers/`, `qa/lever-bench/QUEUE.md` · `/add-support-tiers` | Levers on every workspace primitive (3.1e, 10-09). **Ready, paid, user approves:** DI class Live (`di-lever-plan-2026-10-03.md` step 9), literacy G2-6 class Live (`literacy-lever-plan-2026-10-03.md` step 5). M2 Live needs a mixed payload. Residuals: `QUEUE-item-gaps-2026-10-09.md` |
| 4.1 | Open build is a modality | `qa/open-build/ROADMAP.md` · `/add-eval-modes` | OB waves 1-3, OB-4 pilots, OB-9M, OB-10 committed. Next: OB-4 pulley/bridge/blueprint; capabilities C1-C5; literacy class Live (go-ahead); 3 rulings |
| 4.2 | 3D dioramas (user 10-14) | `qa/eval-reports/airplane-diorama-birth.md` · `/add-eval-modes` | airplane `find_part` + `flight_plan` committed cf15c810. Next: commit payload + site tweak, `preflight` mode, build mode, `/eval-test`, `/curriculum-fit`. **construction-site-diorama BORN 10-15, uncommitted** (user moved to excavator + dump truck): `load_truck` (K-2 count scoops, 3-5 fill to a tons limit), headless-WebGL drive K 18/19 (drive artifact) · 3-5 19/19; `qa/eval-reports/construction-site-diorama-birth.md`. Next: `/add-eval-modes` (`plan_trips`, `limit_with_remainder`, `which_limit`, `operate`), `/curriculum-fit`, tablet fps |
| 5 | Parent report | `qa/parent-report/ROADMAP.md` | PR-1..4 done 10-08. Left: rulings PR-R1/R2, PR-D2 cleanup (user). Proposed CLOSE |
| 6 | Drawers + curator brief | `qa/drawers/ROADMAP.md` | 18 kinds + one-screen brief committed (9e39be02, bbe0a635). Next DR-2 quality, DR-3 leak, DR-5 tutor. Brief findings: K hook with no pattern drawn, empty Pip dock |
| 7 | Prerequisite graph + practice selection | `qa/pulse/ROADMAP.md` · `/pulse-fix`, `/pulse-agent` | Learner model is the sole selector, shipped 10-13. Lifecycle retests retired, gates set by the learner model (C13, 10-16, uncommitted). Next: C14 gate backfill (first), C15 delete retest machinery, C16 browser check, C17 promotion lag, C12 joint knowledge + recall fit; P0.3 backfill, T5 node beta by grade, T6 residual (spacing for passing learn picks), 7.14, 7.8, P5 |
| 8 | Difficulty is code-owned | `my-tutoring-app/qa/difficulty-demo/QUEUE.md` · `/add-item-space`, `/add-word-space` | 24 math spaces, 15 word-space primitives committed. Next: 8.1a/b/c/f/i/j fixes; 8.1d/e/g decided 10-15 and queued; 8.1n ruling; 8.2q one browser sitting |

## Proposed WIP (10-15, user to confirm)

ACTIVE: **8** (difficulty) and **4.2** (dioramas). Opportunistic: **3** paid class Live gates,
once approved. Park 1, 2, 4.1, 6, 7 at the next pulls above; close 5. **10-15 user:** phase 1
resumed (R1 first), phase 2 follows it.

## Rulings owed (block nothing above unless named)

| Ruling | Where |
|---|---|
| 8.1n fraction-bar add_subtract (8.1d/e/g decided 10-15) | `qa/difficulty-demo/QUEUE.md` |
| strategy-picker levers keep/revert; 3.1e rulings | `qa/support-levers/QUEUE-item-gaps-2026-10-09.md` |
| Learner model: how far ahead a K child may go (T1); target share above grade (T3) | `qa/pulse/ROADMAP.md` |
| story-bridge spoken misses or out of L4's class gate | handoff 24 step 3 |
| 19-9a push-pull-arena `success`; 19-9b per-problem score | handoff 19 |
| Pip DECIDE/DESIGN rows | `qa/pip-surface/ROLLOUT.md` |
| TypeSafe (a)-(d) | `qa/typesafe/README.md` |
| C9 content rows | `qa/tutor-reports/workspace-rollout-*` |
| Open build: mixed sessions, "second way", stillness auto-check | `qa/open-build/CAPABILITIES-2026-10-09.md` |

## Parked (queue trusted as of its date; resume only by user choice)

| Lane | Resume point · queue | As of |
|---|---|---|
| Judged-loop ports, DI for older learners | residuals in `qa/di/BACKLOG.md` | 09-12 |
| Misconception loop | live teaching/fading acceptance · `qa/misconception/` | 09-13 |
| Pip surface rollout | 184/212 publish · `qa/pip-surface/ROLLOUT.md` | 09-24 |
| Coverage / K Math / curriculum-fit atlases | `k-grammar-completion` via `/add-eval-modes` | 09-09 |
| `reading-repair-studio` | L3 support tiers · `qa/eval-reports/reading-repair-studio-2026-09-13.md` | 09-13 |
| History suite | birth `source-detective` | 09-03 |
| Science depth · reader-fit sweep | LCS-1 `/oracle-test` · item 17 `/add-eval-modes` | 08-22 |
| LA-15 tutor detour | D2 shipped · `LIVE_LESSON_ROADMAP.md` | 09-26 |
| TU-6 · IMG-1 | non-voiceable channel (di item 32); IMG-1 parked by user | 09-04 |
| Lesson Bench · lesson ordering | paused / rejected by user | 09-07 |
| Later: misses reach the next lesson | Lesson Builder fill mode · `/student-data-loop` §7 | 09-27 |

Closed and not reopened: themed lessons (09-16), `gemini-3.8-live` default (09-15), intent
contract 174/174 (08-21), pilot onboarding (08-14).

## Recorded once

- `vercel.json` pins no branch; `cloudbuild.yaml` deploys `ai-tutor-backend`, the live
  service is `mountamo-education` (08-18).
- `parent/link-student` has no verification; the parent portal is vestigial (user 08-14).

## Hygiene

- Close the row in the same slice as the work, and update the owning queue too.
- Re-grep IDs (HUMAN-CHECKS `### #N`, queue items) right before filing: sessions run in parallel.
- Commit at the mechanism boundary; shared files get their own slice.
