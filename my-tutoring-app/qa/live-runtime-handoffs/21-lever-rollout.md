# Lever rollout: the trigger ladder, then math by class

Date: 2026-09-27 · Executor: `/add-support-tiers` (levers, per primitive), `/add-live-tutor-tools` (the shared trigger in `runtime/`), `/eval-fix` (leaks) · Follows: [18](18-support-levers-pilot.md) (pilot, B1, B2), [20](20-misses-and-tutor-replay.md) (misses) · Plan and inventory: [`qa/support-levers/inventory-2026-09-27/`](../support-levers/inventory-2026-09-27/) (`plan.html` + four JSON files)

## Why this exists

Only number-line `jump`, ten-frame and fraction-circles have levers. About 40 gesture families now name their misses, and the handoff 19 slices that paused lever work (1-4) have landed. This handoff builds the code that decides when a lever is pulled, then rolls levers out to math one class at a time. Each primitive is proved by vitest. Live is limited to 1-2 runs per class.

## User rulings (2026-09-27), do not reopen

1. **Class-first, vitest-gated.** A primitive is done when its vitest gate passes. After every primitive in a class passes, 1-2 Live runs cover the whole class, and they check only what Live can see (item 2 of the gate table below). Never run Live per primitive or to check a specific lever.
2. **The trigger ladder**, all in code:
   - The first wrong answer names the miss and pulls no lever.
   - **The second wrong answer on the same item auto-pulls help**, with no "I'm stuck" needed. It pulls help levers only.
   - "I'm stuck" after any wrong answer pulls the next lever. This is unchanged.
   - **"I'm stuck" before any attempt pulls help only**, never simplify. The next attempt is recorded as assisted.
   - **A wrong answer with help already pulled pulls simplify.**
   - The tutor may pull a lever at any time. Nothing is triggered by a timer.
3. **Removing a choice on a multiple-choice item is assisted work on the same item.** The item is solved but not first-try, and never counts as unaided credit. This is the R4 exception for choice items.
4. **On single-try items, a pull grants one assisted try** on the same item.
5. Math first. Literacy and core follow with the same method.

## The inventory is a draft, not a design

The per-mode levers in `inventory-2026-09-27/*.json` were drafted by four read-only agents from the catalog, components and generators. Nothing was run, and no failure was observed with real learners. For each primitive, `/add-support-tiers` still does its own failure inventory with evidence classes (S1), runs `/primitive-contract` first (B1), and checks every leak rule against the real component. Start from the draft and correct it where it is wrong. Record the corrections in the primitive's contract, not here.

## Before you start (S0)

1. **Check file ownership.** `WORKSTREAMS.md` "Other session" says another session holds `runtime/**`, the math catalog and math primitives. Check `git status` and ask the user before editing those paths. If they are held:
   - Start with **L1 literacy** (cvc-speller, letter-sound-link, letter-spotter, word-workout, interactive-book). They are bound, name their misses, and their files are free.
   - Or start with **knowledge-check**.
   - Queue S2 for when `runtime/` is released.
2. `/ship` any uncommitted surface before editing the same files.
3. File the leaks below as `EVAL_TRACKER.md` rows (executor `/eval-fix`). Each one is fixed before its primitive's lever slice, not all up front.

| Leak | Where | Blocks |
|---|---|---|
| comparison-builder easy `compare_groups` draws every match line during the solve | `gemini-comparison-builder.ts:155` | M2 |
| fast-fact shows "The answer is X" on the first wrong tap while a retry remains, and credits the retry | `FastFact.tsx:388` | core K2 |
| timeline-explorer, how-it-works, vocabulary-explorer: a multiple-choice question reveals the answer on the first wrong tap and never records the wrong answer | components | core K3 |
| regrouping-workbench prints "the correct answer is N" and then allows a retry | `RegroupingWorkbench.tsx:535` | M6 |
| shape-builder `showTargetGhost` draws the target outline | `gemini-shape-builder.ts:141` | M6 |
| analog-clock hand legend can show on a blended `hand_name` item (found by reading the code, not run) | `gemini-analog-clock.ts:131` | M6 |
| formula-card turns the correct option green on a wrong submit, then offers Try Again | component | P3 |
| digital-skills-sim type mode always rings the target key | `DigitalSkillsSim.tsx:549` | core K3 |

Some flags state the answer and **must not become levers as they stand**: ten-frame `showEmptyCount`, fraction-bar `showPartitionNumerals`, coordinate-graph `showHoverReadout`, slope-triangle `showGridCountOverlay`, polygon-area-builder `showRegionAreaLabel`, array-grid `showLabels`, compare-objects `showUnitNumbers`, and two-way-table totals.

## S1: J9, shared (free, first)

**DONE 09-27.** `J9-miss-answered` in `journeySweep.test.tsx`, checked per `<primitive>.<mode>` over all its payloads (a lever for one item shape, such as two jumps, is on some items only). The explicit unanswered list is catalog `teachingWorkspace.unanswered` (per mode). ten-frame and fraction-circles passed as they were. number-line did not: nothing answered `no_landing` (now `numbered_hops`, whose model hop shows where to begin), and the only jump payload had no two-jump item, so `second_jump_off` was unseen: new payload `number-line.jump-hard` (hard tier, four two-jump items) and a journey row that places every landing. Mutation-checked (dropping `no_landing` fails J9).

On a mode with levers, every miss listed in `teachingWorkspace.misses` must be in some lever's `answers` or in an explicit unanswered list. Add it as a sweep rule beside J8. It should pass today on number-line, ten-frame and fraction-circles; if it doesn't, fix their `answers`.

## S2: the trigger ladder (`runtime/`, `/add-live-tutor-tools`)

**DONE 09-27.** `leverTrigger(state, 'wrong' | 'help')` in `observerLever.ts` is the whole ladder; `nextLever` takes the allowed kind. `RuntimeTransport` pulls after each newly committed wrong attempt (once per `<item>#<attempt>`, in a microtask after the notification, never on a republish) through the same dispatch and after-turn message as a help request; the message names the cause (`LEVER_CAUSES`: stuck, second wrong, wrong with help on screen). Found while wiring: an easy tier starts with its help lever shown as pulled, and counting that as "help pulled" opened simplify on the FIRST wrong answer (sweep J2 on ten-frame and fraction-circles); the ladder now reads help from the wrong attempt's own `levers`, which tier starts never enter. Items 3-5 already held and are now tested: a pull calls `session.assist`, so the next attempt is assisted and carries the lever, the first-response gate excludes it, and every workspace item offers retry after a miss (there is no single-try item on this path, so a pull always leaves one assisted try). Tests: `observerLever.test.ts` (18-row trigger table, `nextLever` kinds, two J11 rows through `teachingEvaluation`), `NumberLine.levers.workspace.test.tsx` (auto-pull once, mutation-checked; stuck-first then wrong opens simplify); live-activity + all math 139 files green, `typecheck:lumina` 0, tsc 773. T3: `TUTOR_REPLAY_LADDER=second_wrong` records the auto-pull path; number-line 2 payloads x 5: 2/30 `no_fix_before_try` flags against 3/20 on the stuck path (same class: the drawn model hop or the practice ask restated, no landing), `qa/tutor-reports/replay/number-line-ladder-*-2026-09-27.json`. Live: `run_live_runtime.py ... --lever --lever-ladder second-wrong` is the auto-pull variant for one of each class's two runs.

Today the only automatic pull is `pullForStuckLearner` (`runtimeTransport.ts:153`), which calls `observerLever(state, helpRequested)` (`observerLever.ts:11`). That function refuses a pull unless there is a wrong attempt on the item and the learner asked for help.

1. **Decide in one pure function.** Given the snapshot and the event, return a lever or null. The events are: a wrong attempt was committed, help was requested, or help was requested before any attempt. The rules are ruling 2. Keep the logic in `observerLever.ts`, and keep `nextLever` choosing within the allowed kind (help only, or simplify only).
2. **Auto-pull after a committed wrong attempt.** It fires once per attempt and never repeats on republish. It uses the same dispatch and after-turn message path as `pullForStuckLearner`: the tutor hears about the pull only after the visible receipt and after its reply to the learner settles (LB-8).
3. **"I'm stuck" before any attempt.** Pull help only, and record the next attempt as assisted.
4. **One assisted try on single-try items.** A pull reopens the item for exactly one more attempt, which is marked assisted. This is `TeachingSession` state, so no primitive is named.
5. **Removing a choice counts as assisted.** An attempt made with a choice-removing lever pulled is assisted, never unaided, and the first-response gate scores it as not first-try. Check that the submission says so; this is the J11 contract from handoff 19 slice 9.
6. **Tests:**
   - An `it.each` trigger table in `observerLever.test.ts`, one row per attempt sequence (wrong; wrong-wrong; wrong-stuck; stuck-first; wrong with help pulled then wrong; single-try wrong then pull).
   - One mounted test showing that an auto-pull reaches the screen exactly once.
   - The full `components/live-activity` suite plus the Counting Board and Shape Sorter regressions.

Levers pulled by code change what the tutor hears. Check the tutor's wording with **text replay** (T3, `backend/tests/tutor_live/tutor_replay.py`) on one family, not with Live.

## S3 onwards: math by class

Work one primitive at a time, `/add-support-tiers` end to end, and never as a workflow sweep. The order within a class is free.

| Class | Primitives | Notes from the draft |
|---|---|---|
| **M1** number manipulatives | `counting-board`, `number-bond`, `base-ten-blocks`, `place-value-chart` | Reuse ten-frame's running count, which counts only placed items, never the target, plus a smaller-total simplify. base-ten gets a trade model. place-value simplify keeps the same digit count (a number with no zero), because dropping a digit breaks R2 |
| **M2** compare and order | `comparison-builder`, `compare-objects`, `number-sequencer`, `ordinal-line` | Fix the comparison-builder leak first. `match_pairs` replaces the easy tier's live correspondence. An ordering simplify never uses a subset of the item's values (R3). Spoken modes fall back to help-first |
| **M3** operations and facts | `addition-subtraction-scene`, `equation-builder`, `math-fact-fluency`, `bar-model`, `strategy-picker` | No timer on fact fluency. speed_round has no simplify lever. strategy-picker `compare` has no lever |
| **M4** patterns, charts, space, money | `pattern-builder`, `hundreds-chart`, `spatial-scene`, `coin-counter`, `number-tracer`, ten-frame's other modes | hundreds-chart reuses `learnerHops`, and its simpler skip shares no cells with the item's answers |

After M4 come the primitives that need a miss function first (number-line identify, plot and order; balance-scale), then the three all-spoken families once Part B `spoken_miss` lands. Last are the families waiting on a W1 binding (length-lab, fraction-bar, skip-counting-runner and the other M6 rows in `plan.html`).

### The gate for each primitive (vitest only)

| Test | File |
|---|---|
| Miss table (it should already exist; extend it if a lever needs a finer miss) | `<x>Workspace.test.ts` / `<x>Levers.test.ts` |
| Each lever's leak rule on saved payloads. For simplify: the answer is recomputed, the item is not the learner's own (R3), and the mode floor holds (R2) | `<x>Levers.test.ts` |
| A `nextLever` table and J9 green | `<x>Levers.test.ts`, sweep |
| Mounted pull: the DOM changes, the scene fact does not state the answer, the next attempt carries the lever, simplify is ungraded and returns to the full item, and only the unaided answer is credited | `<X>.levers.workspace.test.tsx` |
| `typecheck:lumina` 0; full tsc at or below baseline (773) | |

Copy the three built primitives' test files as the pattern: `NumberLine`, `TenFrame` and `FractionCircles` `.levers.workspace.test.tsx` and `*Levers.test.ts`.

### The gate for each class (Live, paid)

After every primitive in the class passes its vitest gate, pick one primitive and run it:

```
run_live_runtime.py --primitive <id> --mode <mode> --lever --lesson-entry --runs 1
run_live_runtime.py --primitive <id> --mode <mode> --lever --lesson-entry --audio --runs 1
```

This is two sessions per class, or eight for M1-M4. The `--lever` journey today gives a wrong answer, then says "I am stuck". After S2, add a variant with two wrong answers and no "stuck", so the auto-pull is also exercised end to end. Add it to one of the two runs; don't add a third run. Live checks only two things: that the tutor or the auto-pull moves on its own, and that the screen changes before the tutor describes it. A lever-specific failure goes to `qa/lever-bench/QUEUE.md` with its executor. Re-run Live only if a fix changes tool narration or timing. Budget: `LIVE_TESTING.md` (about $35/day).

## Literacy and core (after M1, or in parallel if the math files are held)

These follow the same method and gate, using the classes in `plan.html`:

- **Literacy:**
  - L1 phonics taps (ready now).
  - L2 spoken phonemic awareness, with `rhyme-studio` first (handoff 18 C1). Help acts on a model pair outside the item. Fix the stale `[RS_ITEM]` `aiDirectives` first.
  - L3 decoding: visual levers only, nothing voiced.
  - L4 K-1 vocabulary and story. `phonics-blender` is bound but was not inventoried; draft it first.
- **Core:**
  - `knowledge-check` first; it is used in every subject. Text options need a generator `near|far` tag before `drop_far_choice` can work on them.
  - Then `fast-fact`, after its leak fix and binding.
  - Then the explainer checks, sharing one source-spotlight lever. The anchors already exist in the data.
  - The 8 ungraded core primitives get no levers.

## Closing each slice

- Update the primitive's contract doc, the brief's audit table (`docs/SUPPORT_LEVERS_BRIEF.md`) and handoff 18's rollout table.
- Update `WORKSTREAMS.md` Phase 3, in the same slice.
- At the end of each class, write `qa/eval-reports/levers-<class>-<date>.md`: the vitest counts, the two Live transcripts summarized, and the raw JSON kept.
- File a HUMAN-CHECKS row for one browser sitting per class. A jsdom pass is not a human pass.
- Stop and report to the user at the end of each class.
