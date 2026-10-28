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

## Where we are (2026-10-19)

| Item | State |
|---|---|
| Branch | `ship/2026-08-10-judged-loop` = origin (adccebcc); `main` = 6be4994d (10-18), branch 4 ahead (fast-forward owed) |
| Tree | Clean except untracked `backend/tests/tutor_live/replay/*.json` (18 replay outputs 10-16..10-19; move to ignored `qa/tutor-reports/` or ignore the dir) and `my-tutoring-app/sizes.txt` scratch |
| Gates | `typecheck:lumina` 0; full tsc 770 baseline (09-29, re-measure) |
| Human checks | 134 open, next free #185 (`my-tutoring-app/qa/HUMAN-CHECKS.md`); 10-08..10-15 browser debt still lives in queues |
| WIP | Commits 10-17..19 touch 9, 8, 4.2, 7; phase 1 starved since 10-16 (R2 B2 unstarted). Over 2+1; proposal below |
| Handoffs (`qa/HANDOFF-*-2026-10-16.md`) | Done: r1-batch4, 8.1-item-space-fixes, 8.1-decided-forks. Built, browser owed: c15-c18 (C16). In progress: r2 (triage + B1 done; B2-B5 left). Not started: 4.2-construction-site-L1 |

## Phases

| # | Phase | Queue · executor | State · next pull |
|---|---|---|---|
| 1 | A miss is one contract, both channels | `qa/workspace-rollout/ROLLOUT.md` · `/add-live-tutor-tools` | **ACTIVE 10-15 (user).** R1 done 10-16 (b4e1ae85, rulings closed). VB-F1 done. R2 triaged (`workspace-rollout/R2-triage-2026-10-16.md`); B1 astro done. Dialogue credit fix (92e7b9bc) needs a Live run. Next R2 B2 biology, then VB-2, then phase 2 |
| 2 | The ladder tests a pass, then a miss | handoff 19/20, `LIVE_TESTING.md` · `/add-live-tutor-tools` | J10/J11 done 09-28. Open: T2 observer replay, T3 responsiveness, one gate command per family |
| 3 | Levers answer misses | `qa/support-levers/`, `qa/lever-bench/QUEUE.md` · `/add-support-tiers` | Levers on every workspace primitive (3.1e, 10-09). **Ready, paid, user approves:** DI class Live (`di-lever-plan-2026-10-03.md` step 9), literacy G2-6 class Live (`literacy-lever-plan-2026-10-03.md` step 5). M2 Live needs a mixed payload. Residuals: `QUEUE-item-gaps-2026-10-09.md` |
| 4.1 | Open build is a modality | `qa/open-build/ROADMAP.md` · `/add-eval-modes` | OB waves 1-3, OB-4 pilots, OB-9M, OB-10 committed. Next: OB-4 pulley/bridge/blueprint; capabilities C1-C5; literacy class Live (go-ahead); 3 rulings |
| 4.2 | 3D dioramas (user 10-14) | birth reports `qa/eval-reports/{airplane,construction-site,ecosystem}-diorama-birth.md` · `/add-eval-modes` | **10-17 ecosystem-diorama committed (15fb1606):** island tank, 6 modes, browser drives pass; Site view tweak (4d9829c4) needs a browser check. Next: `/curriculum-fit`; L3 levers. Site L1 (handoff 4.2), airplane `preflight` |
| 5 | Parent report | `qa/parent-report/ROADMAP.md` | PR-1..4 done 10-08. Left: rulings PR-R1/R2, PR-D2 cleanup (user). Proposed CLOSE |
| 6 | Drawers + curator brief | `qa/drawers/ROADMAP.md` | 18 kinds + one-screen brief committed (9e39be02, bbe0a635). Next DR-2 quality, DR-3 leak, DR-5 tutor. Brief findings: K hook with no pattern drawn, empty Pip dock |
| 7 | Prerequisite graph + practice selection | `qa/pulse/ROADMAP.md` · `/pulse-fix`, `/pulse-agent` | Model selects (10-13) and sets gates (C13, b40aa75a); C14 backfill on every student 10-16. C15, C18 BUILT 10-16, C19 (Pulse beat back) 10-17, committed ea253f49. Next: C16 browser check (parent report OK), C17, C12 joint fit; T5, T6 residual, 7.14, 7.8, P5 |
| 8 | Difficulty is code-owned | `my-tutoring-app/qa/difficulty-demo/QUEUE.md` · `/add-item-space`, `/add-word-space`, `/eval-fix` | 25 math spaces, 15 word-space primitives. 8.1a-j + o DONE 10-16, both handoffs closed (8.1f + percent-of space committed 09b94299). Next: 8.1p/q levers (`/add-support-tiers`); 8.1n ruling; 8.2q one browser sitting; HUMAN-CHECKS #185-186 |
| 9 | Every primitive is a boss card | `qa/boss-migration/PLAN-2026-10-18.md` · `/add-live-tutor-tools` | **ACTIVE.** Waves 1-4 DONE 10-26. 10-27: queue 4 FIXED, lever ratchet 0, queue 6 measured (8 families within 100 chars of the cap; trim owed). 33 hand-Pip files have no boss (not cleanup). **Next:** user samples; rulings 2, 3, 8, 9, 10, 11; then close |
| 10 | Math G2 design review (user 10-27) | `my-tutoring-app/qa/curriculum-design-review/math-g2-2026-10-27/QUEUE.md` · `/add-eval-modes`, `/eval-fix` | **5/5 BUILT 10-27, committed 40e1b9bf..f9f75d00.** regrouping model evidence, tape two-step patterns, near doubles, clock a.m./p.m., mixed facts. Next: user browser check at phone width |

## Proposed WIP (10-19, user to confirm)

ACTIVE: **9** (bosses, user 10-18) and **1** (R2 B2-B5; user 10-15). Opportunistic: **8**
(8.1p/q levers). Park 2, 3, 4.1, 4.2, 6, 7 at the next pulls above; close 5. Superseded:
the 10-15 proposal (8 + 4.2 ACTIVE).

## Rulings owed (block nothing above unless named)

| Ruling | Where |
|---|---|
| 8.1n fraction-bar add_subtract (8.1d/e/g done 10-16) | `qa/difficulty-demo/QUEUE.md` |
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
