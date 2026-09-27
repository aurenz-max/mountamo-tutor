# number-line: jump levers pilot (`/add-support-tiers`, handoff 18 Phase A)

Date: 2026-09-27 · Primitive: `number-line`, mode `jump` · Raw runs: `qa/tutor-reports/number-line-levers-2026-09-27/`

**Result: built and unit/workspace-verified; the live gate is NOT passed.** When the tutor pulls a lever, every other gate check holds. The tutor does not pull one in every run: in the last two rounds it pulled in 1 of 3 and 2 of 3 runs.

## Failure inventory (jump)

| Failure | Evidence class | Lever |
|---|---|---|
| Counts the start as hop 1 (lands one hop short) | observed-synthetic (the journey's scripted wrong answer), documented (`numberLineRemediation`, R13 start contrast) | `numbered_hops` |
| Loses count on a longer jump | inferred | `numbered_hops` |
| Loses the intermediate landing on two chained jumps | inferred | `simpler_jump` (one jump instead of two) |
| Cannot manage a jump this long yet | inferred | `simpler_jump` (a shorter jump) |

No real-learner evidence exists for number-line jump (same finding as the 09-26 audit).

## What was built

- **Shared mechanism** (`/add-live-tutor-tools` rules, primitive-agnostic):
  - `pull_lever { lever }` workspace operation in `useTeachingWorkspace`.
  - Levers on the attempt record (`TeachingAttempt.levers`).
  - An ungraded simpler item: `TeachingSession.openPractice` and `closePractice`, `practice: true` attempts, dropped from scoring.
  - A first try made with a lever pulled is not a first-response success.
  - The backend relays `lever` as a generic field of `perform_runtime_action`.
  - Catalog flag `teachingWorkspace.levers` adds `LEVER_DOCTRINE` to that family's guidance only.
- **number-line** (`numberLineLevers.ts`, `NumberLine.tsx`):
  - `numbered_hops` numbers the learner's own hops and draws a model first hop from the start. It never draws to or past the landing, and it refuses a jump of 1 before placement.
  - `simpler_jump`, built in code: two jumps become one; one jump becomes `ceil(change/2)`. It uses a different start, and neither its start nor its landing is a landing of the full item.
- **Leak fixed:** the easy tier's worked arc ended at the landing. Easy now starts with `numbered_hops` pulled, and that starting position is not recorded as a pull.
- **Also fixed:** the learner's second arc used to start at the item's true intermediate landing. It now starts at the learner's own first landing.
- **Harness:**
  - The `--lever` journey was added.
  - Journeys now assert that the correct answer was credited, which closes the 09-26 gap.
  - The number-line journey row rebuilds the simpler item.

Ratio: about 390 production lines (97 in `numberLineLevers.ts`), 290 test lines, and this report.

## Verification

- Unit tests (`numberLineLevers.test.ts`):
  - The leak rule holds over every K-2 jump.
  - The simplify builder was checked over more than 400 items for shape, range, solvability, and never repeating the source start or an answer.
- Workspace tests (`NumberLine.levers.workspace.test.tsx`, real runtime):
  - A pull changes the screen and the scene fact in the same commit.
  - A refused pull changes nothing.
  - The next attempt records the lever.
  - A simplify pull opens the practice item, which returns to the full item; only the full item is credited.
- Other gates:
  - `typecheck:lumina` is at 0.
  - These suites pass: live-activity, Counting Board and Shape Sorter regressions, and every number-line suite (oracle, misconception, reader-fit, session distinctness).
  - Backend `tutor_live` tests pass: 74.

## Live bench (`run_live_runtime.py --primitive number-line --lesson-entry --lever`, text learner)

| Round | Change before it | Pulled / runs started | Notes |
|---|---|---|---|
| pilot | none | 1/1 PASS | `simpler_jump` on the second "stuck"; practice item, back to the full item, which was credited |
| A | none | 1/3 | The one pull failed a harness check that read the "hop 1" in the fact as the landing 1. Fixed by wording the fact without numerals. |
| B | `LEVER_DOCTRINE` in guidance | 0/2 | +1 lesson-start failure: the model never spoke its opening |
| C | `begin_help` description points to `pull_lever` when one is offered | 1/3 PASS | |
| D | `pull_lever` listed first; "begin_help is for words only" | 2/3 (1 PASS) | Run 1's first call omitted `lever` and was refused; its retry pulled `simpler_jump`. The harness wrongly counted the refusal as a pull. Fixed. |

Where the tutor did not pull, it called `begin_help` and coached in words.

**Gate checks when a lever was pulled** (6 pulls):
1. **The pull was unprompted:** the learner never named a tool.
2. **Screen before narration:** the line or the practice item changed in the commit, before the tutor's turn described it ("Notice how each hop is numbered for you now").
3. **No leak:** no lever fact states the landing.
4. **The next attempt records the lever**, as assisted.
5. **Only the full item is credited:** practice attempts are flagged `practice` and excluded.
6. **The lesson continued** to the next item.

**Not done:** the `--audio` run. It waits on the pull-rate decision below.

## Findings

1. **The pull rate is the open problem.** In the latest round the tutor pulled in 2 of 3 runs, and one of those first sent a malformed call. The pull is decided by the model's tool choice, and `begin_help` competes with `pull_lever`. The options are a user decision; see the handoff reply.
2. **The tutor leaks the answer in words when it does not pull.** In four runs it said "…lands on seven. One more hop will land us on our final number", or named the intermediate landing. That is a spoken leak on a gesture item, separate from levers. Queue it under `/add-live-tutor-tools`.
3. **Topic fidelity:** the topic says "starting at 5 to 9", but starts of 2 and 3 were drawn. This is already queued (`/topic-fidelity`).

## Where the skill was wrong (dry-run round 2)

- It assumed the lever id could ride the existing wire. The backend relay forwarded only `targets`, so `lever` had to become a generic field.
- It did not say that a help lever with nothing safe to draw must refuse. The skill now says so (Phase 4.5).
- It did not anticipate that retry on the simpler item must keep it. That needed `endPractice` (Phase 5.5).
- It did not separate starting positions from pulls in the record (Phase 6).
- It put no guidance anywhere that makes the tutor prefer a lever over `begin_help`. That is now `LEVER_DOCTRINE`, still short of 3/3.
