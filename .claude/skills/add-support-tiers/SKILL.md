---
name: add-support-tiers
description: >-
  Give a primitive the in-item levers a tutor or JEV can pull when a learner cannot do the
  current item — help levers (the representation shows or does more) and simplify levers (the
  same task, one step simpler in shape) — designed from why learners fail that primitive. Also
  sets where the levers start from config.difficulty. Use when a primitive's live workspace
  offers the tutor nothing but begin_help, or its tiers only toggle text. Not for a new task
  identity or harder-than-full content (/add-eval-modes, /lumina-densify-primitives).
---

# Add Support Levers to a Primitive

This skill gives a primitive the levers that let a learner who cannot do the item in front of them get part of it right and then finish the full item, **without leaving the primitive, the eval mode or the skill**. The manifest already picks the right primitive and mode for the objective; this skill makes that item teachable.

## The outcome you're designing for

> **For every way a learner is known to fail this primitive, there is a lever the tutor or JEV can pull on the current item that changes the screen, never states the answer, and is recorded as help.**

Two kinds of lever, one skill:

| Kind | What changes | Examples |
|---|---|---|
| **help** | The representation shows or does more. The problem is unchanged. | Numbered hops on the learner's own arc; each reference slice split into k parts; a picture beside the spoken word; a denser tick-label window. |
| **simplify** | The problem asks for less, in the same mode and skill. Code builds it. | One operation instead of two; two choices with a far foil instead of three; a far-apart comparison pair; a denominator that is a multiple of the reference. |

`config.difficulty` from the manifest only sets **where the levers start**: easy starts with some help levers pulled, hard starts with all of them released. This skill never makes an item harder than the manifest chose, and adds no within-mode β or routing. Harder content is a harder eval mode, owned by `/add-eval-modes` and `/lumina-densify-primitives`.

The tutor decides when to pull a lever and says it in its own words. There are no scripted responses. A missing prerequisite is not this skill's job: it is a lesson-level finding, acted on in the next lesson.

## Architecture

```
failure inventory (Phase 1)            why learners fail THIS primitive, per mode, with evidence class
        │
        ▼
lever table (Phase 2)                  failure → lever (help | simplify) → carrier → leak rule → cost
        │
        ▼
primitive (Phases 4-5)                 lever state lives in the COMPONENT, not only in challenge props
  workspace.current.levers[]           published with the scene, each { id, kind, when, does, carrier, pulled }
  workspace.current.pullLever(id)      synchronous commit: the screen changes, the scene fact changes
        │
        ▼
shared workspace (useTeachingWorkspace)  operation `pull_lever` { lever }  →  validate → session.assist() → pullLever
        │                                (the tutor and JEV see the levers in the packet; the backend names no primitive)
        ▼
next attempt carries { lever, kind }   assisted, never credited as independent; the item keeps its mode β
        │
        ▼
generator (Phase 6)                    config.difficulty → which levers start pulled; simplify builders live here too
```

> **Status (2026-09-27): the shared lever mechanism exists; the number-line jump pilot built it** (handoff 18, report `qa/eval-reports/number-line-levers-2026-09-27.md`). Copy these, and read the source before relying on a line number:
> - **Scene contract** (`runtime/useTeachingWorkspace.ts`): `TeachingWorkspace.levers?: WorkspaceLever[]`, `pullLever?: (id) => LeverPull` and `endPractice?()` (lines 36-44). `LeverPull` is `true` (help), a refusal string, or `{ practice: TeachingAssignment }` (simplify). `WorkspaceLever` (`id, kind, when, does, carrier, pulled`) and `WorkspaceInput.lever` live in `runtime/contract.ts:28-38`.
> - **Tutor operation**: `pull_lever { lever }` in `getAffordances` (`useTeachingWorkspace.ts:180`), assistance level 2, exposure none. It validates the id, runs `pullLever` inside the synchronous `commit`, opens a practice item for a simplify result, then `session.assist('none', id)`. Not offered during a practice item or after a checked success. The backend relays `lever` as a generic field of `perform_runtime_action` (`backend/app/services/live_runtime_tools.py:149, 234-251`) and names no primitive.
> - **Attempt record** (`runtime/TeachingSession.ts`): `assist(exposure, lever)` records the lever on the item (line 68); each attempt carries `levers` and, on a simpler item, `practice: true` (lines 16-18). `openPractice(id)` / `closePractice()` (lines 79-91) put an ungraded simpler item in place of the session item and bring the same item back; `advance()` refuses while a practice item is open. `scoreSession` and `teachingEvaluation` drop practice attempts; a first try made with a lever pulled is not a first-response success.
> - **Runner** (`runtime/useWorkspaceRunner.ts`): `checkPractice` binds the primitive's own check to the practice item; a practice success never affirms the session item.
> - **Reference primitive**: `NumberLine.tsx` (`leverState`/`practice` state at 328-329, `pullLever`/`endPractice` at 904-926) with the pure module `numberLineLevers.ts` (declarations, `modelHop`, `learnerHops`, `hopsLeak`, `simplerJump`) and tests `numberLineLevers.test.ts`, `NumberLine.levers.workspace.test.tsx`.
> - **Live bench**: `run_live_runtime.py --lesson-entry --lever` (wrong answer, "I'm stuck", unprompted pull, practice item if any, full item credited with the lever recorded, lesson continues). A journey row whose simpler item is not a generated challenge rebuilds it in `inputsFor` with the same builder (see the number-line row).
>
> **Other primitives go one at a time** (handoff 18, Phase B), each through every phase here and its own `--lever` bench, and only after the user has seen the pilot report.

## When to use / not

- **Use** when a primitive's live workspace gives the tutor nothing to do on the screen (the tutor's only choice is `begin_help`), or its tiers only toggle text, or a pre-reader band gets no working support.
- **Not** for a new task identity: `/add-eval-modes`. Not for spacing between modes: `/lumina-densify-primitives`. Not for tutor wiring of an unbound primitive: `/add-live-tutor-tools` first. Not for text hints routed by misstep: `runtime/liveScaffolds.ts` already owns those, and they are the weakest help lever. Prefer a lever that changes the representation.
- **Pilot-then-sweep:** never fan this out across primitives until one pilot has passed Phase 7 at runtime and the user has seen it.

## Phase 1: Failure inventory (per mode)

1. Run `/primitive-contract` for the primitive, or read `docs/contracts/<id>.md`. Levers must not break what other consuming skills depend on.
2. List every eval mode from the catalog entry (what it asks, its β, its defining property).
3. For each mode, list why learners fail it, and tag each failure with an **evidence class**:

| Class | Where it comes from |
|---|---|
| observed-real | a real learner: human sittings, production attempts |
| observed-synthetic | harness or bench runs, scripted wrong answers (e.g. the live journey's "landing + 1") |
| documented | catalog `commonStruggles`, misconception text, remediation modules |
| inferred | your reasoning from the task |

   Sources to read: `my-tutoring-app/logs/demonstrations/*.jsonl` (the author's diagnoses; grep the primitive id), `qa/tutor-reports/`, `qa/misconception/`, `qa/eval-reports/`, the catalog tutoring block (`commonStruggles`), `service/**/*Remediation.ts` (camelCase, e.g. `tenFrameRemediation.ts`), and the primitive's DI script if it has one (its scripted wrong answers name the misses it was built for). Many of these are empty for a given primitive; say which, and carry on with the rest. Say plainly when a class is empty. The 2026-09-26 and 09-27 audits found no real-learner evidence for any of four primitives, so most inventories will be synthetic, documented or inferred, and the report must say so.
4. **Fix what corrupts the evidence first.** If generated content is broken (a value outside the rendered range, an answer the checker rejects), failures observed on it are artifacts. Queue the fix under `/eval-fix` and do it before measuring any lever.

## Phase 2: Lever table (confirm with the user before building)

Present the table to the user before Phase 4. In a non-interactive run, write it into the report and stop there.

For each failure with at least documented evidence, design ONE lever and fill a row. An inferred failure gets a lever only if it is cheap or the same lever covers a documented one. When no lever can pass the leak rule (every hint for "decompose: one part empty" names a pair), write "no lever" and the reason in the row; that is a finding, not a gap to paper over.

| Mode | Failure (class) | Lever | Kind | Carrier | Leak rule | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| jump | counts the start as hop 1 (synthetic) | numbered hops on the learner's own arc, from the start | help | shown + voiced | never draws past the start or to the landing | no: single endpoint click | interaction state + render |
| jump | loses the intermediate landing on a chained jump (inferred) | drop the second operation | simplify | shown | new item; not the learner's own values | builder exists at generation only | code builder + runtime swap |

Rules for the table:
- **Carrier.** `shown`, `voiced` or `both`. `shown` means what the child can take in without reading: a picture, a mark, a gesture target, a moved or split object. Digits and words are text: for a pre-reader band, a lever that only adds text is real only if the tutor's voice carries it; say how.
- **Leak rule.** State in one sentence what the lever must never draw or say for this mode. Where the relationship IS the answer (recognition, identify), the lever acts on a model outside the item, never on the item itself.
- **Exists today?** Read the COMPONENT, not the generator: `showOptions`, per-challenge fields, render paths, interaction handlers. A lever that exists only as a generation-time flag counts as "no runtime path".
- **Add capability when it is missing.** If the failure needs a degree of freedom the primitive lacks, the lever adds it (render, data field, interaction), with its cost stated. That is the point of this skill: the 2026-09-26 audits found the needed levers mostly did not exist.
- **Simplify stays in the mode.** A simpler item that crosses the mode's defining property is a different mode (production turned into a choice among pictures is identification), so it is not a simplify lever.

Lever families to sweep when looking for help levers (all must pass the leak rule):

| Family | Examples |
|---|---|
| Perception / tracking | counts, tallies, tick labels, arrangement, overlays, highlights |
| Representation (concrete ↔ symbol) | a model beside the symbol; a split or overlay of the model |
| Process made visible | numbered steps, hop-by-hop placement, a partition drawn in |
| Voice | the tutor models a contrast on a pair outside the item, the pair shown as pictures |
| Answer form | fewer or farther choices (as simplify, when the task is unchanged) |

### The table becomes code, not a report

The table's "failure" column is only useful if code can see it. For every failure a check can observe in the learner's work, the primitive's check names it:

- **A miss id per observable pattern.** The domain module exports a pure function from the item and the learner's work to a miss id (`jumpMiss` in `numberLineLevers.ts`: `one_short`, `one_past`, `off_by_more`, `wrong_direction`, `second_jump_off`). Name the PATTERN seen on screen, never a guessed cause: "one hop short" is a fact; "counted the start as hop 1" is the tutor's and the distiller's reading of it.
- **The check reports it.** `progress.commitCheck(describe, correct, miss)` (or `commitGesture({ ..., miss })`); it lands on the attempt as `TeachingAttempt.miss` and reaches the tutor in the packet as a fact.
- **Each lever declares the misses it answers** (`WorkspaceLever.answers`). The shared `nextLever(levers, miss)` picks the first open lever that answers the last miss, else help before simplify. No per-primitive choosing code.
- **"This wrong answer, then this lever" is a unit test**: one `it.each` over the miss function and one over `nextLever(jumpLevers(...), miss)` (`numberLineLevers.test.ts`). Never a question for a live run: which lever comes next is code. A failure a check cannot observe (a spoken-only confusion) stays inferred and gets a lever by `when` text only; say so in the table.

## Phase 3: Contract check

Write the new requirements into `docs/contracts/<id>.md` (`/primitive-contract`, then `--check` on your edit). Each lever adds: its leak rule, its assistance record, and, for simplify, its mode floor.

## Phase 4: Build help levers

1. **Lever state lives in the component**, keyed by item, and resets when the item changes. The generation tier only sets its initial value; a challenge prop alone cannot be pulled.
2. **Pulling is a synchronous commit.** `pullLever(id)` changes state and returns `true`, or returns a refusal string (wrong mode, already pulled, would leak). It never schedules state and reports success.
3. **Publish it.** Add the lever to `workspace.current.levers` with `pulled` state, and add a scene fact that says what is now on screen, in terms the tutor and JEV can read. The fact must not state the answer. The tutor reads scene facts as `task.demand`.
4. **Leak rule in code.** Each lever's leak rule is a pure function beside the domain module, unit-tested per mode.
5. **Refuse a pull that changes nothing.** If the lever has nothing safe to draw yet (number-line: a jump of 1 has no model hop until the learner places it), return a refusal that says what to do instead. A pull the screen does not show breaks S5.

## Phase 5: Build simplify levers

A simplify lever replaces the current item with a simpler item of the same mode, built by code.

1. **Builder.** Count the shape of the current item, and derive the simpler one deterministically: same mode, one structural step less. Recompute its answer from its new values, and keep the solvability rules (subtraction M>S, the options still contain the answer, the comparison still has a winner).
2. **Mode floor and band.** The simpler item keeps the mode's defining property and its magnitude band.
3. **Never the learner's own item.** The simpler item must not repeat the item the learner is stuck on or reveal its answer, and code checks it. The parked LA-15 branch (`park/la15-prerequisite-detour`, `composeDetourActivity.ts` `dropParentRepeats`) has a generic check, and its measured result: a prompt instruction alone still repeated the learner's item in 3 of 5 generations; the code check brought it to 0 of 5.
4. **A new item, and the full item stays open.** The simpler item gets its own item id. Work on it is ungraded: no mastery write (user ruling 1, handoff 17: detour work is ungraded; a fresh parent item checks transfer). The learner then returns to the full item, or to a fresh item of the same mode, and only that answer, given without the lever, is credited.
5. **Retry on the simpler item keeps it.** The workspace's retry reopens the practice item; only `endPractice` (called when the observer's advance returns to the full item) removes it. Do not clear the simpler item in the primitive's `onItemOpened` on a retry.
6. **Where the builders live.** A generation-time builder that already exists (`gemini-regrouping-workbench.ts` operand re-selection, `gemini-bar-model.ts` gap/step clamps) is the starting point. Move the pure part into a module the component can call at runtime. Do not call the LLM at runtime for a simplify lever.

## Phase 6: Starting positions from `config.difficulty`

The generator maps the tier to which levers start pulled, per challenge, from that challenge's own mode. Harness (keep as is where it exists):

```typescript
type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}
```

- New tier code applies per challenge at the end of the generator, from each challenge's own mode, gated only on a tier being present. No tier means the output is unchanged. Some existing harnesses do not do this (ten-frame writes session-level `showOptions` and is gated on a pinned mode, `gemini-ten-frame.ts:510-513`); leave them as they are unless your lever work has to change the same code.
- easy = the help levers that make self-checking possible start pulled; hard = all released. A starting position is not a pull: record only runtime pulls on the attempt, or every easy item reads as assisted. A tier never changes the numbers, the eval mode, or makes the item harder than the manifest chose.
- Existing tier implementations (ten-frame, counting-board, angle-workshop, bar-model, skip-counting-runner, regrouping-workbench) remain valid as starting positions. They are not runtime levers until Phases 4-5 are done.

## Phase 7: Verify

1. **Unit:** each leak rule per lever × mode; each simplify builder over many random items (exact shape, in band, solvable, never the source item).
2. **Workspace test** (`<X>.workspace.test.tsx`, mounted through `runtime/testing/workspaceHarness.tsx`): `pull_lever` changes the screen and the scene fact in the same commit; the next attempt records the lever; a refused pull changes nothing; a simplify pull opens a new item and the full item is reachable after it.
3. **Typecheck:** `npm run typecheck:lumina` = 0; full `tsc` not above baseline.
4. **Runtime:** the lever gate, once per primitive, is free and text-only (`backend/tests/tutor_live/LIVE_TESTING.md`, handoff 20 Part D): the dry journey J1-J8 on the family's payloads, the miss and `nextLever` tables, and a tutor replay of its moments (`TUTOR_REPLAY_OUT=... journeySweep -t "tutor replay"`, then `tutor_replay.py --primitive <id> --samples 5`). The replay's `lever` moment carries the observer's real lever message; its `stuck` moment shows whether the tutor pulls a lever itself and whether it narrates the change before the receipt. No Live run for the gate. The class Live pair (handoff 21) waits until EVERY eval mode of every primitive in the class, spoken modes included, has its miss function and levers, and then runs `--mode mixed` (user ruling 09-28); one finished mode is not ready. What replay cannot see (the tutor voicing its own tool call, timing) is read off the weekly Live sample. When a Live run is warranted, it is `run_live_runtime.py --primitive <id> --lesson-entry --lever` with `--input` a saved payload. Fixes after the gate passes run only what `backend/tests/tutor_live/LIVE_TESTING.md` sets for their change type; unit and mounted tests cover the levers' leak rules and builders, not live runs. After a wrong answer and "I'm stuck", a lever must be pulled, by the tutor or by the observer (user ruling 09-27). The run only drives and records; `lever_checks.py` scores it, and `analyze_run.py <report.json>` re-scores saved runs after a check fix, with no new run. The after-run reviewer (`lever_review.py`) files every miss, with its owning layer and executor, in `qa/lever-bench/QUEUE.md`. Read the transcript too: the tutor must not describe a change before its visible receipt.
5. **Content:** `/eval-test` tier sweep for the starting positions; `/oracle-test` if the primitive has an oracle (add the leak rules to it).
6. **Report** in `qa/eval-reports/<id>-levers-<date>.md`: the failure inventory with evidence classes, the lever table, what was built, what was measured, and which failures still have no lever.

## Getting this wrong

- **A lever that answers the item.** The 2026-09-26 audits found two easy tiers that stated the answer and shipped as "no leak": fraction-circles identify ("N equal pieces, M shaded") and the number-line jump arc drawn to the landing. Review did not catch them; a code leak rule would have.
- **Answer-bearing fields.** If a lever writes a field the checker reads (`hiddenPositions`, `answerBarIndex`), the checker must still accept the correct answer. Give the answer its own field, separate from the display lever.
- **The tutor and JEV read the scene.** A fact added for a lever reaches both. It says what is drawn, never the key. Board counts appear only where the board is what the item asks about.
- **Pre-readers.** A text-only lever does nothing at K. rhyme-studio's K tiers were all no-ops for this reason.
- **Credit.** Assisted work that reaches the first-response gate or the distiller as independent corrupts mastery. Record the lever on the attempt, not only on the item.
- **Simplify becoming a different mode.** Check the mode floor before building the builder, not after.

## Reference

- Design brief and the three audits: `my-tutoring-app/src/components/lumina/docs/SUPPORT_LEVERS_BRIEF.md`.
- Workspace binding rules: `/add-live-tutor-tools`, `docs/TEACHING_WORKSPACE.md`.
- Generation-time starting positions: the tier harness above; `gemini-bar-model.ts` (`resolveSupportStructure`, `resolveProblemShape`), `gemini-regrouping-workbench.ts` (code-enforced operand builders), `gemini-skip-counting-runner.ts` (answer-bearing `hiddenPositions`).
- Runtime lever reference: the number-line jump pilot (`numberLineLevers.ts`, `NumberLine.tsx`, the Status note above).
