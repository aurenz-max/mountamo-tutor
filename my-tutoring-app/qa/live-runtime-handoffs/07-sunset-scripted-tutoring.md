# Sunset scripted tutoring in favor of the tutor/JEV workspace

Date: 2026-09-19. Status: **S0 + S1 done; S2 wired for Counting Board count and Shape Sorter identify (2026-09-19).**
Per-surface state lives in [07-census.md](07-census.md) — read it before pulling S2.
Owner: [LIVE_LESSON_ROADMAP LA-14](../../src/components/lumina/docs/LIVE_LESSON_ROADMAP.md).

## S2 update and user clarification

Ordinary lessons now wire the two pilot modes through the shared runtime and submit
completion through their existing evaluation pipeline. The user explicitly rejected
a separate practice-only completion abstraction: a student completing the assignment
with the tutor counts. Attempts, corrections, assistance and response provenance ride
the normal evaluation payload. No separate mastery-eligibility gate was introduced.
See [implementation and verification](../tutor-reports/lesson-workspace-wiring-2026-09-19.md).
The [next-session brief](08-lesson-workspace-follow-through.md) starts with the
observed completion stalls and then scopes the first S3 controller retirement.
Other modes still need adoption, and human acceptance remains separate. The baseline
and original instructions below describe earlier states; consult this update and the
census for current ownership before choosing another slice.

## User direction and intended end state

After the Counting Board and Shape Sorter work, the user directed us to sunset the
vestigial highly scripted approach and prepare this handoff. Treat the tutor/JEV
workspace as the architectural destination. The old runner is a temporary migration
dependency, not a second permanent teaching architecture.

The end state is one conversation owner, a primitive-defined assignment and visible
workspace, a shared observer interpreting completed exchanges, and runtime-owned
commits. No active surface should require the tutor to recite a fixed correction,
emit a sentinel phrase, or advance because an error cap was reached.

This turn creates the handoff only. It does not remove runtime code, migrate student
records, or change the current bench-only deployment. The earlier “standalone DI is
unchanged” statements describe the implemented snapshot, not the desired permanent
architecture. Ordinary lessons still need explicit host integration before their
legacy controller can be removed.

## Start here: verified baseline

- Read [TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md)
  for the implementation map, ownership boundaries, TW-1–TW-11 and behavioral matrix.
- Read [the second-adopter report](../tutor-reports/shape-sorter-teaching-2026-09-19.md).
  Counting Board's latest user sitting completed seven items. Shape Sorter `identify`
  passed 42/42 JEV cases and 3/3 full audio journeys. These are bounded proofs, not
  certification of the catalog, normal lessons, or all modes.
- The report preserves an unresolved Counting Board demonstration failure: narration
  without a visible action. Its separate progression regression passed. Keep both facts.
- `rg -n 'liveLessonRuntime=' my-tutoring-app/src --glob '*.tsx'` currently finds only
  `LiveActivitySandbox.tsx`. `LuminaAIContext` supplies a null runtime elsewhere.
  Removing a fallback now would break ordinary entry points or leave them without a tutor.
- Counting Board still derives assignments from `countingBoardScript.ts`, and
  `useCountingTutorController.ts` still uses runner-shaped TypeScript types as a view
  compatibility facade. Shape Sorter still gets its content gates, geometry and aliases
  from `shapeSorterScript.ts`. A filename containing “Script” does not mean all of it is obsolete.
- Preserve the existing working tree. Many files predate this handoff and contain
  uncommitted work. No agents are required; handle the slice and verification locally.

## What goes, what stays

| Retire | Preserve or extract before deletion |
|---|---|
| Exact correction/affirmation wording as a control protocol; sentinel scanning and “Say exactly” progression cues | Original assignment, full success condition, accepted alternatives, grading authority and response provenance |
| Forced re-asks, fixed teaching sequences, maximum-correction progression and automatic miss-cap skips | Attempts, support/exposure history, explicit unresolved outcomes and learner-controlled recovery |
| Per-mode packs that prescribe the tutor's next utterance; catalog instructions that insist on those scripts | Grade/topic constraints, task construction, mathematical/linguistic validity gates, source content and instructional resources |
| Tutor-facing answer-record/retry/advance tools on observer workspaces | Internal checked transitions, command scope, deduplication, visible receipts and speech settlement |
| Tests that define good teaching as byte-exact speech, sentinel compliance or a compulsory correction count | Wrong-answer refusal, substep/final distinction, no unearned credit, meaningful help, cancellation, completion and real visible actions |
| Legacy host selection and runner plumbing after their final real consumer migrates | Voice capture, stream assembly, microphone turn detection, playback drain, interruption/reconnect handling, lawful stimulus timing |
| Compatibility types, wrappers and duplicate controller paths after their replacement is verified | Renderers, accessibility, sounds, truthful Pip targets, evaluation-mode identities and objective/plan provenance |

Controlled language can remain **content** where the task needs it: a word to
pronounce, a passage to read, a quoted example, or a deliberately modeled procedure.
It must not remain the transport protocol that decides whether the learner was right.
Direct instruction as a pedagogical choice can remain; mandatory scripted control is
what is being retired. Likewise, keeping a spoken or gesture response channel depends
on the learning task, not on the old controller's convenience.

## Source inventory to refresh before implementation

Paths below are relative to `my-tutoring-app/src/components/lumina/` unless stated.
This is a verified starting map, not a complete consumer census.

| Layer | Starting files | Retirement concern |
|---|---|---|
| New shared lifecycle | `components/live-activity/runtime/{useTeachingWorkspace,TeachingSession,DialogueObserver,LiveLessonRuntime,runtimeTransport}.ts`; `service/typesafe/observeDialogue.ts` | Destination. Do not fork observation logic or rebuild a per-primitive teaching engine. |
| Pilot bindings | `primitives/visual-primitives/math/{CountingBoard,useCountingTutorController,ShapeSorter,ShapeSorterTeaching}.tsx` (controller is `.ts`); corresponding `*Script.ts` | Extract domain content and remove live dependence on runner-shaped APIs first. |
| Legacy shared execution | `hooks/{useJudgedScriptRunner,useJudgedSpeechLoop,judgedLoopModel,judgedScriptContract}.ts`; `components/{JudgedMicPanel,DiActionPanel}.tsx` | Separate reusable audio/UI mechanics from scripted control; remove only after final consumer migration. |
| Family adapters | `components/live-activity/adapters/`; math `use*Runtime.ts` | `di-runner` ownership, replay and scripted speech assumptions still used by other adopted families. |
| Catalog/prompt assembly | `service/manifest/catalog/`; repository `backend/app/api/endpoints/lumina_tutor.py`, `backend/app/services/live_runtime_tools.py` | Prevent old cue instructions entering migrated contexts. Keep backend primitive-agnostic; retire runner-specific branches last. |
| Real lesson entry | `components/ManifestOrderRenderer.tsx`, `components/KindergartenStage.tsx`; repository `my-tutoring-app/src/contexts/LuminaAIContext.tsx` and its callers | Follow actual callers. One active owner, mount metadata, handoff, cancellation and end-of-lesson ownership must work outside the bench. |
| QA and documentation | `service/qa/di/diDrivePlan.ts`; repository `backend/tests/tutor_live/run_tutor_live.py`, `run_live_runtime.py`; `my-tutoring-app/scripts/primitive-runtime-driver.mjs`; `qa/di/BACKLOG.md`; skills | Rewrite assertions around task/evidence contracts. Retire obsolete requirements without discarding unresolved findings. |
| Evaluation/data | `evaluation/`, existing submission handlers and observation consumers | The new session-local summary is not a replacement mastery schema. Use `$student-data-loop` before modifying these paths. |

Inventory executable hook calls/imports, direct `useJudgedSpeechLoop` consumers,
type-only coupling, script-pack builders, catalog directives, host selection and test
fixtures separately. A text match or a count of files is not a count of active runners.
Include composite and mixed-mode surfaces; a migrated mode does not retire its siblings.

Useful initial searches from the repository root:

```powershell
git -c safe.directory='C:/Users/xbox3/claude web tutor' status --short
rg -n 'useJudgedScriptRunner|useJudgedSpeechLoop|JudgedScriptPack|JudgedScriptRun' my-tutoring-app/src --glob '*.{ts,tsx}' --glob '!*.test.*'
rg -n 'scanForSentinel|maxCorrections|DEFAULT_MAX_CORRECTIONS|Say exactly|NEVER_PERFORM' my-tutoring-app/src/components/lumina backend/app --glob '*.{ts,tsx,py}'
rg -n 'liveLessonRuntime=|LuminaAIProvider|useLiveRuntime' my-tutoring-app/src --glob '*.tsx'
```

## Ordered work slices and exit gates

Use LA-14 as the owning queue. Record the census and per-surface status alongside
this handoff; do not create a second portfolio backlog. States should distinguish
`legacy`, `domain extracted`, `workspace verified`, `real entry migrated`, and
`legacy deleted`. Every temporary fallback needs its consumers and removal gate recorded.

### S0 — Establish the retirement boundary

Inventory consumers and active entry points, then mark existing exact-script port
instructions as legacy maintenance. Stop expanding that protocol by default. Fixes
needed to keep unmigrated learners working may continue; new teaching capability
should use the destination contract. Preserve current functionality until each entry
point has a verified replacement.

Exit: a consumer/mode/entry-point table with retained domain dependencies, data sinks,
replacement gaps and exact deletion blockers. Historical reports remain readable;
old architecture wording cannot silently overrule this user direction.

### S1 — Remove pilot coupling to scripted types and content packs

Start with Counting Board and Shape Sorter identification. Extract pure task builders,
geometry/quantity facts, aliases, build gates and stable item identities from script
modules. Both temporary legacy and new controllers import those domain modules.
Give the shared view a teaching/presentation interface rather than a `JudgedScriptRun`
facade. Keep task meaning unchanged; use before/after item-contract tests.

Exit: live pilot imports do not depend on cue packs, sentinel types or runner lifecycle
types. Existing mode-specific scene constraints and legacy regression tests still pass.
The shared observer receives identical assignment meaning. No student writes are added.

### S2 — Replace the actual lesson entry and settle evidence mapping

Trace the ordinary manifest/Kindergarten entry through provider, primitive, evaluation
and completion callbacks. Bring the certified runtime ownership contract into the real
entry instead of treating a bench provider flag as production integration. Resolve one
active task, inactive mounted surfaces, speech ownership, activity switching, reconnect,
completion and cleanup. Keep original objective, plan item and resolved mode identities.

S2's implemented mapping follows the user's clarification above: tutor-completed
assignments submit normally through the existing evaluation pipeline, including with
help. Attempts, corrections and assistance are preserved; absent `begin_help` records
do not establish independence and do not block completion. Use `$student-data-loop`
before any further changes to student-data semantics.

Exit: real-entry pilot lesson, both activity orders, preserved work across help/return
where supported, one completion handoff, no double submission, and verified data effects.
Human experience remains a separate gate in [HUMAN-CHECKS #167](../HUMAN-CHECKS.md).
The two pilot modes now have ordinary-lesson wiring; see the S2 report for its limits.

### S3 — Retire each pilot's old controller and policies

After S2, remove each replaced fallback, cue pack, forced correction and obsolete
catalog directive. Count every entry point, including helper/tester and mixed-mode
paths. Shape Sorter `identify` alone cannot justify deleting count/sort/real-object
behavior. Counting Board's ten kinds need their presentation and response constraints
verified, not merely a successful count journey.

Exit: migrated modes have exactly one active teaching controller; importing their
normal surface cannot start the old runner. Old correction-count behavior is absent.
Any remaining sibling-mode fallback is named with an explicit removal dependency.

### S4 — Migrate remaining domains in bounded batches

Use the census to group by response/evidence needs rather than file order. Bounded
spoken names/numbers are the nearest reuse class; gesture workspaces retain their
checker. Timed stimuli, constructing/dragging, reading/phoneme production and open
explanations require truthful operations and evidence contracts before migration.
An `expectedAnswer` string is not an open-ended rubric or a pronunciation assessment.

Select one representative of each new contract class, verify it, then reuse the shared
solution. No new per-primitive Python paths, transcript phrase rules, or exact-speech
replacement scripts. For a migrated surface, delete the obsolete branch in the same
bounded slice once all its callers pass. Keep unsupported capabilities explicit.

Exit per surface: assignment fidelity; real operations; shared lifecycle; applicable
TW matrix; real-model probes; three connected journeys through actual components;
documented human checks and persistence behavior. Exact wording is not the oracle.

### S5 — Remove shared legacy machinery and close the migration

When the census has no remaining runtime consumers, delete the old runner, sentinel
engine, obsolete contracts and adapters. Extract any still-shared voice/UI infrastructure
first. Remove dead backend runner instructions and legacy DI-only test programs/routes
only after checking remaining users; preserve useful generator probes and audio evidence.
Update skills, lifecycle docs, catalog policies and DI backlog states. Transfer residual
content, accessibility and evidence defects to their existing owners with links.

Exit: no active importer or host fallback, no orphaned route/tool/prompt, no tests
requiring scripted correction wording, and no migration flag left as permanent debt.
Every census row is migrated/deleted or has an explicitly justified unresolved task
that prevents claiming the sunset complete. Historical evidence can remain archived.

## Verification contract

Run focused domain/component/runtime/host suites and `npm.cmd run typecheck:lumina`
for each code slice. Include other execution families when shared contracts change.
Use the shared journey with the resolved mode and save generated payloads for replay.
Inspect raw transcript, JEV request/disposition and visible receipt for every run.

Required cases: correct substep without final credit; false praise; final success;
success with an open question; help without an attempt; wrong then corrected response;
multilingual/noisy speech where applicable; demonstration separate from learner work;
assistance retained through retry/fade; fresh item; stale/duplicate commands; interruption,
late result and stop; settled final sound/summary. Test service failure recovery without
success fabrication or silently falling back to the old teaching script.

Classification probabilities are not correctness guarantees. Simulated paint is not
a human visual check. A missing tool call fails a requested visible action. Do not erase
failed reports or change an oracle to accept narration as execution.

## First implementation session — DONE 2026-09-19

What this section asked for, and what it got:

S0 produced [07-census.md](07-census.md): 169 coupled files classified, 20 learner
surfaces plus the DI bench actually calling a runner hook, entry points marked live vs
standalone, and four deletion blockers named with their removal gates. The nine other
live adapters turned out not to be consumers of this machinery at all.

S1 detached both pilots. `hooks/teachingItemContract.ts` now owns the benched
response-class registry and the item base; `countingBoardDomain.ts` and
`shapeSorterDomain.ts` split each pilot's task from its cue protocol, with the script
modules re-exporting so the generator, tester and drive plan keep one address; and
`CountingController` is declared natively rather than as a `Pick<JudgedScriptRun<…>>`
facade, which inverts the dependency the exit gate was about. `typecheck:lumina` 0,
full `tsc` at the 770 baseline, 6947 Lumina tests green. `useJudgedScriptRunner.ts`
was not deleted and no runtime flow was exercised — S1 moved modules and inverted a
type dependency, and the bench-only deployment is unchanged.

One residual, recorded in the census rather than fixed: `shapeSorterDomain` still
imports `opensWithSentinel` for its sayable-label gate, because a generated sort label
opening "Yes"/"My turn" would be read as a verdict for as long as any mode runs on the
judged runner. Its removal gate is S5.

<details><summary>Original instructions for this session</summary>

Execute **S0 + S1 only**: inventory, then detach the two proven live bindings from
script/runner types while preserving assignment identities and current behavior.
Use `$add-live-tutor-tools` with the current workspace branch; use `$tutor-test` for
connection evidence where applicable. Re-run existing pilot/domain/runtime tests,
record the extraction diff and consumer table, and leave S2's real-entry/data contract
as the next explicit slice. Do not begin by deleting `useJudgedScriptRunner.ts`.

This handoff creates no new human-check queue and closes no existing check. The
next session should deliver a smaller legacy dependency graph with a passing pilot,
not a new runner, a wholesale catalog rewrite, or an unverified global mode switch.

</details>
