---
name: add-context-axis
description: >-
  Give one primitive's generator a context axis: when a code-owned content pool
  (themes, settings, label pairs, object sets, story shapes) overrides what the
  lesson asked for, read that content from the lesson through the shared
  resolveContextAxis helper, keep the pool as the fallback, and keep code owning
  every number and answer. Use when a design review, fit-ledger row or probe shows
  a primitive serving its birth skill's content on another skill's lesson
  ("Morning vs Afternoon" on a weather lesson, a chair on a farm). Not for numbers
  or answers (/add-item-space, /add-word-space, /add-number-pool-service), a new
  judgment rule or interaction (/add-eval-modes, /primitive), or wrong pool content
  (/eval-fix).
---

# Add a Context Axis

Plan and status: `my-tutoring-app/src/components/lumina/docs/CONTEXT_AXES.md`.
Helper: `service/contextAxis.ts`. Worked example: `service/math/barModelDataset.ts`
and its wiring in `gemini-bar-model.ts` (search `bar-model.dataset`).

## The split

1. **Code owns correctness.** Answer keys, geometry, counts, option sets. Unchanged.
2. **The lesson owns content.** Labels, categories, objects, which two subjects, which way
   a real-world pattern runs. Read through the axis.
3. **The pool is the fallback.** No request → today's output exactly.

## Phase 0 — Confirm it is an axis

- Find the pool in the generator: a `const` theme/setting/object list, a hardcoded label,
  a setting line injected into the prompt. Note which modes read it.
- Classify it. **Content** (what the scene is about) → axis. **Correctness** (numbers,
  words chosen by difficulty, answers) → stop; that is an item space or word space.
- Check the contract ladder. If the lesson needs a new judgment rule (near/far needs a
  distance rule) or a new interaction, this is a mode or a primitive, not an axis.
- Read `docs/contracts/<primitive-id>.md` if it exists. The pool's current consumer must
  come out unchanged; name it — it is your control in Phase 3.
- Get the failing case: the objective text and mode that produced off-lesson content
  (design-review evidence, fit-ledger row, or a probe). It is your Phase 4 probe.

## Phase 1 — Write the spec

New file next to the generator, `<primitive><Axis>.ts`, exporting a `validate…` function
and a `resolve…` wrapper:

```ts
const axis: AxisSpec<MyAxis> = {
  id: '<primitive-id>.<axis>',      // keys the gap log
  activity: 'A picture graph',       // "<activity> is being generated for a lesson."
  instructions: `...`,               // one bullet per field: WHEN to fill it, when to return empty
  schema,                            // enums + bounded arrays; 3-4 types max
  validate,                          // parsed JSON -> value; empty value = no request
  gaps: (v) => v.unsupported,        // optional: asked for, cannot express
};
```

Rules:
- **Absence is absence.** Each field says when to return empty, and that empty means the
  app uses its own content. The resolver must never fill a default.
- **Only what the primitive can render and judge.** Enumerate it in the schema where you
  can. Anything else goes to `unsupported` and the gap log, never into the item.
- **Domain facts, not numbers.** The model may say *which way* a pattern runs (January:
  snowy > rainy > sunny); code turns that into counts. The model never picks a number,
  answer or key.
- **Validate hard.** Drop word emoji, dedupe labels, keep an ordering only if it ranks
  exactly the categories. A partial value that cannot render is "no request".
- **Watch examples.** Example values in the schema or instructions can get copied. If
  Phase 4 draws repeat an example (every weather lesson comes back "January"), replace it
  with a neutral one and probe again.

## Phase 2 — Wire it

- Resolve **once per session**, before the per-challenge fan-out, and **only when the
  session's modes read the pool** (bar-model: `DATASET_MODES`). Other modes make no call.
- Pass the value into the sub-generators as an extra trailing parameter defaulting to
  `null`. Each reader branches: value present → lesson content; null → the pool, as before.
- When the axis supplies everything a mode needed from the model, skip that model call.
- Labels flow wherever the old labels went — check the component, the live adapter and the
  workspace file (`grep` the field names). The tutor reads them from there; do not add a
  tutor-side path.
- One `console.log` line naming what the axis resolved, in the generator's log style.

## Phase 3 — Tests (`<primitive><Axis>.test.ts`)

Mock `../geminiClient` and route by prompt prefix (`'<activity> is being generated'`).

1. `validate…`: no request → empty; bad orderings dropped; word emoji and duplicates dropped.
2. Code invariants on the content path (counts obey the order, the comparison focus is true
   of the pair, keys still computed by code).
3. End to end through the real generator: the axis value reaches every challenge.
4. **Control:** the birth skill's lesson with an empty axis reply → pool output unchanged.
5. A mode outside the axis makes **no** axis call.

Then run the primitive's existing tests and `npm run typecheck:lumina` (0 in your files).

## Phase 4 — Runtime probe (required)

Through the running app (`/api/lumina/eval-test`, see the design review's `probe.mjs`):
the failing objective from Phase 0 for each mode the axis serves, plus the control
objective. Read the generated content, not just the status. Done when the failing case
now shows the lesson's content and the control matches its old behavior. Fix what the
draws show (capitalization, unrealistic counts) and probe again.

## Phase 5 — Close

- If tutor-facing wording or labels changed, one Live run of that mode is due
  (`backend/tests/tutor_live/LIVE_TESTING.md`); say so if you did not run it.
- Add the axis to the primitive's contract (`/primitive-contract`): the pool, the axis id,
  what the fallback guarantees.
- Add a row to the status table in `docs/CONTEXT_AXES.md`, with the probe evidence and
  known limits.
- `node scripts/axis-gap-report.mjs` after real use ranks what lessons asked for and could
  not get — the next mode or primitive to build.
