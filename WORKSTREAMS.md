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

## Where we are (2026-10-16)

| Item | State |
|---|---|
| Branch | `ship/2026-08-10-judged-loop` pushed; `main` = 56fbda8c, 6 behind (fast-forward owed) |
| Tree | C15/C18 retest removal in progress (pulse backend + Pulse UI, uncommitted, another session); construction3d.ts view tweak, construction-site birth report, airplane `flight_plan` W1 payload uncommitted (4.2); `my-tutoring-app/sizes.txt` scratch |
| Gates | `typecheck:lumina` 0; full tsc 770 baseline (09-29, re-measure) |
| Human checks | 134 open, next free #185 (`my-tutoring-app/qa/HUMAN-CHECKS.md`); 10-08..10-15 browser debt still lives in queues |
| WIP | 7 phases marked current vs a limit of 2+1. Proposal 10-15 below, user to confirm |
| Handoffs | `my-tutoring-app/qa/HANDOFF-*-2026-10-16.md`: c15-c18 (7), 8.1-item-space-fixes + 8.1-decided-forks (8), r2-workspace-triage (1), 4.2-construction-site-L1 (4.2) |

## Phases

| # | Phase | Queue · executor | State · next pull |
|---|---|---|---|
| 1 | A miss is one contract, both channels | `qa/workspace-rollout/ROLLOUT.md` · `/add-live-tutor-tools` | **ACTIVE 10-15 (user).** R1 done 10-16 (24 primitives, b4e1ae85; rulings and follow-ups closed). VB-F1 done. Next R2 (26 without modes; triage first, handoff r2), then VB-2, then phase 2 |
| 2 | The ladder tests a pass, then a miss | handoff 19/20, `LIVE_TESTING.md` · `/add-live-tutor-tools` | J10/J11 done 09-28. Open: T2 observer replay, T3 responsiveness, one gate command per family |
| 3 | Levers answer misses | `qa/support-levers/`, `qa/lever-bench/QUEUE.md` · `/add-support-tiers` | Levers on every workspace primitive (3.1e, 10-09). **Ready, paid, user approves:** DI class Live (`di-lever-plan-2026-10-03.md` step 9), literacy G2-6 class Live (`literacy-lever-plan-2026-10-03.md` step 5). M2 Live needs a mixed payload. Residuals: `QUEUE-item-gaps-2026-10-09.md` |
| 4.1 | Open build is a modality | `qa/open-build/ROADMAP.md` · `/add-eval-modes` | OB waves 1-3, OB-4 pilots, OB-9M, OB-10 committed. Next: OB-4 pulley/bridge/blueprint; capabilities C1-C5; literacy class Live (go-ahead); 3 rulings |
| 4.2 | 3D dioramas (user 10-14) | birth reports `qa/eval-reports/{airplane,construction-site}-diorama-birth.md` · `/add-eval-modes` | Both born and committed cf15c810 (airplane `find_part` + `flight_plan`; site `load_truck`). Next: commit birth report + view tweak + payload, then site L1 modes (handoff 4.2), `/curriculum-fit`; airplane `preflight`; tablet fps |
| 5 | Parent report | `qa/parent-report/ROADMAP.md` | PR-1..4 done 10-08. Left: rulings PR-R1/R2, PR-D2 cleanup (user). Proposed CLOSE |
| 6 | Drawers + curator brief | `qa/drawers/ROADMAP.md` | 18 kinds + one-screen brief committed (9e39be02, bbe0a635). Next DR-2 quality, DR-3 leak, DR-5 tutor. Brief findings: K hook with no pattern drawn, empty Pip dock |
| 7 | Prerequisite graph + practice selection | `qa/pulse/ROADMAP.md` · `/pulse-fix`, `/pulse-agent` | Learner model selects (10-13) and sets gates (C13, b40aa75a); C14 backfill applied to every student 10-16. In progress: C15 retest deletion + C18 Pulse shows the model gate (handoff c15-c18). Then C16 browser check, C17, C12 joint fit; T5, T6 residual, 7.14, 7.8, P5 |
| 8 | Difficulty is code-owned | `my-tutoring-app/qa/difficulty-demo/QUEUE.md` · `/add-item-space`, `/add-word-space`, `/eval-fix` | 24 math spaces, 15 word-space primitives committed. Next: 8.1a/b/c/f/i/j/o (handoff 8.1-item-space-fixes); 8.1d/e/g (handoff 8.1-decided-forks); 8.1n ruling; 8.2q one browser sitting |

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
