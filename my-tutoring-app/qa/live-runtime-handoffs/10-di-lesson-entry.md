# Bring the three DI workspace adopters into ordinary lesson entry

Date: 2026-09-20 · Owner: roadmap LA-14 (S2 continuation) · Executor: `/add-live-tutor-tools`
Plan: [07-sunset-scripted-tutoring.md](07-sunset-scripted-tutoring.md) · Per-surface state:
[07-census.md](07-census.md) · Contract:
[TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md)

## Status 2026-09-20: DONE. No mode is withheld from lessons any more

**User ruling 2026-09-20: do not bar an existing mode from being used. If a mode has an error in
a lesson, fix the error.** The rest of this brief is kept as the record of why the gates existed;
its "withhold" and "not in scope" sections are superseded.

- `ELIGIBLE`, `LessonWorkspacePrimitiveId` and the `c.type` check are deleted;
  `lessonWorkspacePlan.ts` names no primitive and lists no mode.
- A family that binds the workspace declares `bindsTeachingWorkspace: true` on its adapter, and
  then EVERY mode in its `modes` binds in an ordinary lesson. All six adopters declare it,
  including the three DI packs. It is a capability fact (the nine LA-04 adapters have no workspace
  binding and must keep their catalog tutoring), not a rollout list.
- `challengeTypes` on the adapter says where a payload spells its challenge type (the DI packs
  use `challengeType`). `modeContentGate.ts` resolves mode -> challenge types from the catalog for
  both the lesson gate and `livePlan.ts`, which had the same `c.type` defect.
- **The gesture blocker was fixed instead of gated.** The learner's Try again / Next challenge
  moved from the dev sandbox into the shared shell (`LiveRuntimeSurface`), and the lesson passes
  its transport's `learnerProgress` to it. So `order_cards` is bound again
  (`NUMBER_SEQUENCER_WORKSPACE_MODES` is every mode) and all ten counting-board modes reach
  lessons. `LessonWorkspace.test.tsx` drives the exact stall — wrong handover, observer abstains,
  Try again reopens the item — in both the Kindergarten stage and the scroll lesson.
- Step 1's question is answered by a tracked real package:
  `qa/lesson-bench/packages/kindergarten-addition-…-xr70.json` pins `di-math-facts` to
  `answer_fact` under one objective, so the manifest does resolve a mode for a DI section.

Still true from the risks below: `di-letter-sounds` cannot be certified with synthetic audio, so
it is wired and spoken-unverified; human acceptance stays HUMAN-CHECKS #167.

## Why this slice exists

Six primitives now bind the shared teaching workspace. **Three of them reach ordinary
lessons; three reach only the development host** — `di-letter-sounds`, `di-word-reading`
and `di-math-facts`. Every adoption report says "ordinary lessons are not wired", and each
treated that as a separate gate inherited from the one before it.

That inheritance should be checked rather than repeated, because **the thing it was
inherited from does not apply to these three.**

The gate is the census's "no learner-owned retry in the lesson shell" blocker. That row is
correct as written — it is scoped to **gesture** modes: a checked-wrong manipulation leaves
the session in `checked` and the surface locked until an observer transition reopens it, and
the explicit **Try again** control exists only in `LiveActivitySandbox`. It is why
`order_cards` is withheld.

**All three DI adopters are speech-only.** No mode in any of them has a gesture channel, so
none of them can reach the locked-`checked` state that blocker describes. On the speech path
a confident `incorrect` verdict already forces a `retry` transition inside `decideDialogue`
(`settledFailure`, the 2026-09-19 completion-stall repair), so a wrong spoken answer reopens
itself with no control at all. That is exactly why the three math adopters already run in
ordinary lessons.

So: do not read the retry blocker as blocking this work. It blocks gesture, and gesture only.

## What is actually in the way: one hardcoded allowlist, and it should go

Everything else on the lesson path is already generic. The gate is a central map of
primitive names that duplicates what each adapter already knows about itself.

[`lessonWorkspacePlan.ts:6`](../../src/components/lumina/components/live-activity/lessonWorkspacePlan.ts#L6)

```ts
export type LessonWorkspacePrimitiveId = 'counting-board' | 'shape-sorter' | 'number-sequencer';
```

and [`:22`](../../src/components/lumina/components/live-activity/lessonWorkspacePlan.ts#L22), the
`ELIGIBLE` map of primitive → eval mode → permitted challenge types. A primitive absent from
both gets no binding and silently falls through to its legacy path.

**Do not add three rows to it. Delete it, and let each adapter declare its own binding.**
That is the same rule the rest of this host already follows — "adopting a family is a new
adapter file plus one line, never another ternary" (`liveRenderers.tsx` docblock) — and the
standing ruling that nothing pre-maps primitives centrally. The map is the last place in the
lesson path that knows primitive names.

### Why "delete it" cannot mean "let every live adapter through"

`LIVE_ADAPTERS` has fifteen entries and **only six are workspace bindings.** The other nine
(`number-line`, `ten-frame`, `number-bond`, `ordinal-line`, `sorting-station`,
`number-tracer`, `comparison-builder`, `compare-objects`, `place-value-chart`) are LA-04 live
adoptions that never call `useTeachingWorkspace`. Membership in the registry is not the
signal. Neither is the adapter's existing `modes` field: `counting-board` advertises ten
modes to the live host and **only `count` binds the workspace**, the other nine including
gesture kinds like `give_me_n`.

So the removal needs one new declared field on `LiveActivityAdapter`, not a widened lookup.

### The shape to add

One optional member on the adapter contract — absent means "not a lesson workspace binding",
which is the correct default for the seven LA-04 adapters:

```ts
/** The shared teaching workspace this family binds in an ORDINARY lesson.
 *  Absent = not a workspace binding; the family keeps its existing path. */
workspace?: {
  /** The eval modes that bind. Narrower than `modes` where only some do. */
  modes: readonly string[];
  /** Can THIS generated section actually run that mode? Reuse the domain's own
   *  validity gate and item builder; never a field name spelled here. */
  eligible: (data: T, mode: string) => boolean;
};
```

`lessonWorkspaceItems` then reads `LIVE_ADAPTERS[componentId].workspace`, and
`lessonWorkspacePlan.ts` stops importing any primitive module at all — today it reaches into
`numberSequencerDomain` for one mode list, which is the same coupling in miniature.

### The defect this removal takes with it

[`lessonWorkspacePlan.ts:45`](../../src/components/lumina/components/live-activity/lessonWorkspacePlan.ts#L45)

```ts
data.challenges.some((c: { type: string }) => !expectedTypes.includes(c.type))
```

The three wired primitives name that field `type`. **All three DI packs name it
`challengeType`.** Had the three rows simply been added, this would read `undefined` on every
challenge, fail the `includes`, and skip the section — a binding that never appears, with no
error anywhere. Moving the question to `eligible(data, mode)` removes the shared spelling
assumption instead of adding a branch to it: each pack answers with its own
`mathFactChallengeValid` / `wordReadingChallengeValid` / `letterSoundChallengeValid` and item
builder, which already drop what cannot be asked.

## What needs no work — checked, with evidence

Do not rebuild these.

| Concern | State |
|---|---|
| Mount metadata | [`ManifestOrderRenderer.tsx:191`](../../src/components/lumina/components/ManifestOrderRenderer.tsx#L191) already passes `runtimePlanItemId`, `runtimeEvalMode` and the objective/skill/subskill provenance to any section that has a binding. Nothing is primitive-specific. |
| Catalog script suppression | `lessonPrimitiveContext` returns `tutoring: null, owns_opening: true` whenever a binding exists, so a bound DI surface will not also receive its catalog DI block. Generic already. |
| Focus and primitive switching | `KindergartenStage.tsx:51-57` and `OrderedSection` focus the workspace and switch the tutor's primitive context from the same binding. Generic. |
| Voice turn close timing | `lessonVoiceTurnPolicy.ts:15-26` **already names all three DI packs** — 300 ms for letter sounds, 420 ms for word reading and math facts. This was wired for the legacy lesson path and applies unchanged. |
| Runtime, transport, observer, learner signals | `LessonWorkspaceProvider` builds one `LiveLessonRuntime` and one `RuntimeTransport` for the lesson and bridges every runtime event. No per-primitive wiring; `liveRuntime.learner` rides every `useTeachingWorkspace` binding already. |
| Retry on a wrong spoken answer | `decideDialogue`'s `settledFailure` forces `retry` on a confident `incorrect`. No control needed. |

## The slice

1. **Confirm a DI pack can even be selected into a manifest with a resolved mode.**
   `lessonWorkspaceItems` requires `manifest.config.targetEvalMode` and **exactly one**
   `objectiveId` on the section. Generate a real lesson on a K/G1 fact-fluency or decoding
   objective and inspect the ordered component before writing any code. If the manifest does
   not set `targetEvalMode` for DI sections, that is the actual first problem and this slice
   stops until it is understood. Do not add a curator or manifest rule to force it — standing
   user ruling.
2. **Add `workspace` to `LiveActivityAdapter`** (shape above), then declare it on the six
   adopters and only those:
   - `counting-board`: `{ count }` — deliberately one of its ten modes.
   - `shape-sorter`: `{ identify }`.
   - `number-sequencer`: its five spoken modes, derived from `NUMBER_SEQUENCER_WORKSPACE_MODES`
     so a withheld mode such as `order_cards` cannot reach a lesson through this gate either.
   - `di-math-facts`, `di-word-reading`, `di-letter-sounds`: all their modes, which are already
     exactly their workspace mode lists.
3. **Delete `ELIGIBLE`, `LessonWorkspacePrimitiveId` and the `c.type` check**, and with them
   `lessonWorkspacePlan.ts`'s import of `numberSequencerDomain`. `LessonWorkspaceItem.primitiveId`
   becomes `LivePrimitiveId`. The module should end up knowing no primitive's name.
4. **Test the gate both ways per family** in `lessonWorkspacePlan.test.ts`: a section whose
   generated challenges do not match the resolved mode is skipped; one that matches binds. The
   DI cases are the ones that would have silently skipped under the old spelling, so assert
   them explicitly rather than trusting the new accessor.
5. **Check the `autoStart: true` prop.** `ManifestOrderRenderer` passes it to every bound
   section. The live renderers deliberately omit it for tutor-led surfaces ("no judged runner
   to start"). The workspace components do not declare it, so it should be inert — confirm
   that it is, and that it does not reach the scripted drill on a section that failed to bind.
6. **Verify at runtime.** `--lesson-entry --audio`, three runs per DI pack, and re-drive one
   math adopter to prove the refactor did not move the three surfaces that already worked.
   A `--lesson-entry` run has never been driven against any DI pack.
7. **Update** `07-census.md` (the three DI rows move to `real entry migrated`), the S2 section
   of `07-sunset-scripted-tutoring.md`, `TEACHING_WORKSPACE.md`'s lesson-wiring paragraph, and
   the `WORKSTREAMS.md` row, in the same slice.

## Exit gates

- `npm run typecheck:lumina` = 0; full `tsc --noEmit` at the 770 baseline.
- `lessonWorkspacePlan.test.ts` covers bind and skip per family, DI cases asserted explicitly.
- `rg -n "counting-board|shape-sorter|di-math-facts" lessonWorkspacePlan.ts` returns nothing:
  the module no longer names a primitive.
- `LessonWorkspace.test.tsx` and the mounted renderer tests still pass for the three math
  adopters — this slice touches their shared gate.
- Three `--lesson-entry --audio` runs per pack reach completion, with the transcript
  inspected, not just the pass flag.
- No new backend branch, no primitive named in `live_runtime_tools.py`.

## Risks and things to withhold

- **`di-letter-sounds` may not be certifiable here.** Synthetic audio cannot test a produced
  phoneme — its dev-host audio gate scored 0/3 for that reason, and nothing about lesson entry
  changes it. Wire it if the mechanics hold, but report it as mechanically wired and
  spoken-unverified, and do not claim the channel works. Word reading and math facts both have
  passing synthetic-audio evidence and are the two to lead with.
- **Completion semantics are already settled and must not be re-opened.** A tutor-completed
  assignment submits through the existing evaluation provider (user clarification, S2). Do not
  introduce a practice-only completion or a mastery-eligibility gate. Any change to student
  records goes through `$student-data-loop` first.
- **The demonstration-narrated-not-performed family will follow these packs into lessons.** It
  appeared 6 of 19 journeys on math facts with its modality split inverted from word reading's.
  It is shared-layer work, not a reason to hold this slice, and not something to patch with
  another guidance sentence — one attempt measured 1/3 before and 1/3 after.
- **Not in scope:** the gesture retry control, `order_cards`, counting-board's gesture kinds,
  LA-14 S3 deletion, and LA-13's shared criterion. LA-13 is the other live candidate for next
  pull and is independent of this one.

## Commands

```powershell
# from my-tutoring-app
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/direct-instruction
npm.cmd run typecheck:lumina

# from repo root, with :3000 and :8000 already running — reuse them, never start a second
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive di-math-facts --mode answer_fact --runs 3 --lesson-entry --audio --input my-tutoring-app/qa/tutor-reports/di-math-facts-runtime-answer_fact-payload-2026-09-20.json --output my-tutoring-app/qa/tutor-reports/di-math-facts-lesson-entry-<date>.json
```

`--lesson-entry` cannot be combined with `--startup` (the harness rejects it): lesson entry
uses prepared content. Saved payloads for all five math-facts modes and for the word-reading
modes are already in `qa/tutor-reports/*-runtime-<mode>-payload-2026-09-20.json`.

## Evidence behind this brief

- Sixth adopter report: [di-math-facts-teaching-2026-09-20.md](../tutor-reports/di-math-facts-teaching-2026-09-20.md)
- Fifth: [di-word-reading-teaching-2026-09-20.md](../tutor-reports/di-word-reading-teaching-2026-09-20.md)
- Fourth: [di-letter-sounds-teaching-2026-09-19.md](../tutor-reports/di-letter-sounds-teaching-2026-09-19.md)
- S2 lesson wiring for the three math adopters:
  [lesson-workspace-wiring-2026-09-19.md](../tutor-reports/lesson-workspace-wiring-2026-09-19.md)
- Human acceptance for all of it stays [HUMAN-CHECKS #167](../HUMAN-CHECKS.md). JSDOM paint and
  synthetic audio are not a sitting.
