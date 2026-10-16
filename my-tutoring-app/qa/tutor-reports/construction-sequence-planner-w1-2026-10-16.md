# construction-sequence-planner W1 binding (ROLLOUT C31), 2026-10-16

**Shape P, four modes, all bound** (sequence, dependency_chain, parallel, critical_path). Levers in
`../eval-reports/construction-sequence-planner-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive did not teach its four modes; it taught one thing (drag a list into an order that works) and showed
the answer while doing it. Every card printed "Needs: X, Y", so the order could be read off the cards. A red border
marked each misplaced job as it was dragged. The number circles were coloured by build stage, with a legend listing
the stages in build order. The Hint button named the exact job and its missing need. In parallel and critical_path,
a Gantt preview outlined the critical path and a panel printed its length ("can't finish faster than N weeks"). The
"parallel" and "deadline" tasks were not real: any working order met the deadline automatically, because the target
was the critical path plus a buffer and the schedule was computed as-soon-as-possible whatever the order. The
challenge questions were generated and never shown. The task graph was written by Gemini, so a dependency could be
arbitrary ("windows need electrical") and the learner had no way to work it out.

Rebuilt so each mode is a task with a code-built key (`constructionSequenceWorkspace.ts`). A library of real jobs per
project (house, bridge, tower, road, playground) carries each job's real needs; an item is a convex, connected piece
of one project's graph, so no hidden job sits between two jobs on the screen.
- **sequence** (K-2): 3, 4 or 5 jobs in a straight chain (by tier). The cards do not show their needs: the order
  comes from how buildings go together. The learner taps the cards into a numbered plan and presses Check and build.
- **dependency_chain**: 4, 5 or 6 jobs, each card showing its needs, with at least one job that needs two.
- **parallel**: 5, 6 or 7 one-week jobs, needs shown. The learner taps a card, then a week; jobs in one week happen
  at the same time. The deadline is the fewest weeks any plan can take, so only a plan that shares weeks meets it.
  hard limits the crews to two jobs a week, where that limit lengthens the fewest-weeks plan.
- **critical_path**: 5, 6 or 7 jobs with weeks and needs shown, in branches of different lengths. The learner says or
  taps the fewest weeks the build can take. The three wrong totals are what known mistakes give (every job added, a
  shorter chain, the chain with the most jobs, the number of jobs on the longest chain). hard makes the chain with the
  most jobs not the longest in weeks.
- **Screen**: a checked plan is built block by block and stops, tilted red, at the first job whose need was not
  done ("The build ran the plan and stopped at job 3, "Put on the roof": a job it needs had not been done yet."). It
  never names the missing need. critical_path draws its timeline only after credit. The card order shown is never one
  that already works. No badge, hint, outline or legend gives the order, a week or the total.
- **Generator**: Gemini writes only the title, one neutral sentence and the project. Code builds the items from the
  eval-mode pin and `config.difficulty`. A legacy payload (model-written `tasks`) is rebuilt from its challenge types
  and project. The catalog description, constraints, tutoring block and eval-mode descriptions were rewritten to match;
  eval-mode `challengeTypes` now equal the mode ids (dependency_chain had `['sequence']`). Backend registry: ids and
  betas unchanged, the four descriptions updated (`problem_type_registry.py`).

critical_path is `speech` with `acceptsGesture` (J14), judged by `cspExpectedAnswer` when spoken, with its known
spoken misses (`cspSpokenMisses`, the same ids as the tap). The other three are gestures. Misses (`cspMiss`): sequence
`reversed`, `swapped_neighbors`, `wrong_first`, `job_before_need`; dependency_chain `wrong_first`,
`missed_second_need`, `job_before_need`; parallel `need_same_week`, `need_later`, `crew_over`, `too_many_weeks`;
critical_path `added_all`, `shorter_chain`, `most_jobs_chain`, `counted_jobs`, `off_by_one`.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R9 house animation removed, R11 tap-to-place, R22 job library (grow it when a lesson topic misses).
- **Gemini no longer writes the jobs.** Jobs, needs and weeks come from a 44-job library (5 projects). Topics outside
  these five projects (a treehouse, a spaceship) get the nearest project.
- **The canvas house animation is gone** (walls collapse, roof falls). It drew a house for every project, including a
  bridge or a road. The consequence is now a DOM build strip of the learner's own plan that stops at the first broken job.
- **Drag-and-drop is replaced by tap-to-place** (tap a card into the next slot; tap a placed card to take it out).
- **Removed on-screen aids**: the "Needs:" line on sequence cards, the live red borders, stage colours and legend,
  the Hint button, the critical-path outline and length panel, the live weeks badge. Their useful parts are levers now.
- **The old support tiers (`supportTier`) are gone**; `config.difficulty` now picks the structural band (job count,
  crews, the most-jobs trap). Every lever starts released.
- **critical_path asks for the total, not the chain.** "Identify the critical path" is now "find the fewest weeks",
  which needs the longest chain; tapping the chain itself is not asked.
- **Parallel jobs take one week each**, so weeks equal steps; durations appear only in critical_path.

## Gates
- `typecheck:lumina`: 0 (last run, after the `EngineeringPrimitivesTester.tsx` sample data was cut to the new shape).
  Full `tsc` not run (orchestrator).
- `ConstructionSequencePlanner.workspace.test.tsx` 18/18; rewritten `__tests__/ConstructionSequencePlanner.reader-fit.test.tsx`
  2/2 (the scripted read-aloud reads the ask and the cards in shown order, never a need; a wrong plan stops where it
  breaks; two misses show a working plan).
- `pip/ExhibitWorkspaces.surface.test.tsx` + `catalog/misses.test.ts` 191 passed; `activityContract.test.ts`,
  `lessonWorkspacePlan.test.ts` passed; `runtime/workspaceContract.test.tsx` filtered to this id 25/25.
- Payloads (`save_payload.py`, one generation each): `w1-payloads/construction-sequence-planner.{sequence,dependency_chain,parallel,critical_path}.json`
  (medium; sequence at Grade 1, others Grade 3) and `.parallel-hard`, `.critical_path-hard` (Grade 5). Titles and
  descriptions are model-written and neutral ("Designing a Family House").
- Sweep J1-J15 on the six payloads: 0 findings (14 items). Advisories: the critical_path choice list is in the scene
  facts (it is on screen). Spoken-miss probe on the two J15 spoken requests: 18/18, false positives 0.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 14 items x 5 samples, `--observe`; `replay/construction-sequence-planner-2026-10-16{,-r2,-r3}.json`)
Every start, miss, stuck, lever and credit reply was read on each run. Empty replies on r1 (21) and r2 (6) were 429
quota errors from concurrent agents, not tutor output; r3 had none.
- **r1.** Automatic checks: 0 flags apart from the 429s. By reading: on sequence the stuck reply stated the fix 5/10
  ("Try swapping those last two jobs", "Try swapping "Build the floors" and "Build the center core"", "switch that with
  the job you have after it"). Guidance: never say which jobs to swap, switch or move, or where a job goes.
- **r2.** No swap or move instructions. Sequence miss and stuck replies described the needed card instead of naming
  it, 3/20 ("What does a tower need in the middle to hold up the floors?", "What job needs to stand tall in the tower
  before the floors can attach to it?", "what does running the pipes need to attach to or go inside?"). Guidance: ask
  what a job needs, never describe the needed job by where it is, what it looks like or what it does.
- **r3.** No reply states a key, an order, a week for a job or a total before credit, names or describes the right
  card, states the fix, or claims something not on screen. critical_path replies send the learner to add each chain
  ("see which one takes the most weeks"), which is the method, not the total. Credit replies cite the learner's fix.

Shared lever doctrine (owned by the agent editing `adapterContract.ts`, counted only): first-person lever narration
("I turned on Check As You Go") 11 of 350 replies on each run.

## Undriven modes
None. The sweep taps cards, weeks and totals; the workspace test drives a spoken total on critical_path.

## Open findings
- Needs a browser check: the build strip's timed blocks, the tilted stopped block, card layout at phone width, the
  timeline bars. Only JSDOM has run it. `/eval-test`.
- No `docs/contracts/construction-sequence-planner.md`; the new requirements (code keys, needs hidden on sequence, the
  build names no missing need, cards never shown in a working order) are recorded only here. `/primitive-contract`.
- Pre-readers on the workspace path rely on the tutor reading the cards (the scene lists them); the scripted path has
  a read-aloud. `/reader-fit` for sequence at K.
