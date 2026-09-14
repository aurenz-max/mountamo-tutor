# Primitive bundle code-splitting: stop the production build from growing into an OOM wall

Status: not started. This is a kickoff handoff, not a report of completed work — everything under
"Diagnosis" is verified by reading the code; nothing under "Plan" has been built yet.

## Why this exists

The 2026-09-13 ship (`d038463c`..`2ec88137`, learning-observation sweep + reading-repair-studio +
misc) triggered a Vercel production build failure on `main` at `2ec88137`: "Build ran out of
memory." No single file in that push is unusually large (largest new file is 379 lines) and no
config regression was found — see the investigation in that day's conversation. The working
conclusion is capacity, not a bug: the push added ~150 new source files and grew several already-huge
hub files, and total build memory finally crossed Vercel's build-container ceiling.

Because CLAUDE.md's own priority order puts "more primitives with fine-grained eval modes" above
backend work, primitive count is going to keep climbing indefinitely — that's the product strategy,
not a phase. Raising `NODE_OPTIONS=--max-old-space-size` (recommended as the immediate stopgap, and
it should already be set in Vercel's Production env vars by the time you read this — check first)
buys headroom once; it does not change the growth curve, and it is capped by the actual build
container's physical memory regardless of the flag value. This handoff is the structural fix: stop
the build from having to compile every primitive that exists, every time, whether or not the page
being built ever renders it.

## Diagnosis (verified 2026-09-13)

- `src/components/lumina/config/primitiveRegistry.tsx` is **2421 lines** and statically `import`s
  **216** primitive components at module scope — `grep -c "next/dynamic\|React.lazy"` on that file
  returns **0**. Every primitive (plus its icon/chart/animation dependencies) is pulled into the
  module graph unconditionally.
- `src/components/lumina/components/DevPanelRouter.tsx` (191 lines, `'use client'`) statically
  imports ~30 Tester/dev-panel components (`MathPrimitivesTester`, `LanguageArtsPrimitivesTester`,
  `MisconceptionLoopTester`, `DirectInstructionBench`, etc.), several of which *themselves* import
  large chunks of the primitive tree again for their own manual-QA dropdowns. These are internal
  QA instruments, not the student product, but nothing excludes them from the production bundle —
  `process.env.NODE_ENV === 'development'` is used only as a *runtime prop value* (line 150), which
  does not affect what webpack compiles.
- No file in `src/components/lumina/` uses `next/dynamic` or `React.lazy` anywhere — there is **no
  existing precedent** for this pattern in the codebase. Treat the first primitive as a real pilot,
  not a known-safe copy-paste.
- `next.config.js` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`,
  so full-project `tsc` is **not** what's costing memory during the Vercel build (a stray, inert
  `next.config.ts` also exists — dead on Next 14.0.4, which doesn't read `.ts` config at all; safe
  to delete as unrelated cleanup, not the cause of anything).
- `next` is pinned at **14.0.4** (no stable Turbopack production build at this version).
- For scale, the other hub files in the same import graph: `service/manifest/catalog/math.ts`
  5785 lines, `catalog/literacy.ts` 5250 lines, `evaluation/types.ts` 4165 lines, `types.ts` 2361
  lines. These are catalog **data** and **type** surface, not component code — they don't hold
  React components to lazy-load, but they contribute to the same webpack module graph and are worth
  a follow-up look if code-splitting the components alone doesn't buy enough headroom.

## What "fixed" looks like

`PrimitiveConfig.component` (`primitiveRegistry.tsx:247`,
`React.ComponentType<{ data: any; index?: number; [key: string]: any }>`) is consumed at every call
site the same way: `const Component = config.component; ...; <Component ... />` (confirmed in
`ManifestOrderRenderer.tsx:70`, and the same pattern recurs in the other ~11 consumers —
`KindergartenStage.tsx`, `PulseActivityRenderer.tsx`, `PracticeManifestRenderer.tsx`,
`CuratorCompanion.tsx`, `CuratorConsole.tsx`, `DeepDiveTester.tsx`, `CalibrationSimulator.tsx`,
`FeatureExhibitTester.tsx`, `service/annotated-example/registry.ts`, `app/api/calibration-sim/route.ts`
— grep `PRIMITIVE_REGISTRY\[` to re-find them before starting, this list may drift).

`next/dynamic(() => import('../primitives/.../Foo'))` returns something assignable directly as a
component reference — so in principle **no consumer call site needs to change at all**. The whole
fix is contained to the registry file(s) themselves: replace each static top-of-file `import Foo
from '...'` + `component: Foo` pair with one dynamic import expression assigned inline to
`component:`. That containment is the reason this is worth doing before anything more invasive.

## Non-goals

- Not touching `ComponentId` / `PrimitiveMetrics` / the catalog type unions. `ignoreBuildErrors` means
  they aren't costing the Vercel build anyway (they cost local `tsc`/IDE responsiveness, a separate,
  lower-urgency problem — see CLAUDE.md's `typecheck:lumina` gate, which does still run these).
- Not reducing the number of primitives, not deleting dev tooling, not moving anything to a second
  Vercel project or a monorepo split. Scope is strictly: stop eagerly bundling code the current page
  doesn't need.
- Not fixing `catalog/math.ts` / `catalog/literacy.ts` size in this slice — flagged above as a
  possible follow-up only if step 1 below doesn't recover enough headroom.

## Plan — pilot before sweep (per CLAUDE.md's pilot-then-sweep doctrine; this is a first-of-its-kind
pattern here, so the pilot gate matters more than usual)

1. **Establish a local repro loop first**, so you're not waiting on a Vercel deploy to know if
   anything helped. From `my-tutoring-app`: `node --max-old-space-size=<X> node_modules/next/dist/bin/next build`
   with `<X>` low enough to reliably OOM locally on the current `main` tip (binary-search it once).
   That number, and whether it reproduces at all, is the first thing to record in this file or a
   dated report — a local `next build` on a dev machine may simply have more headroom than Vercel's
   build container and never reproduce, in which case fall back to watching real Vercel build logs
   (peak memory is usually visible in the build output) as the verification signal instead.
2. **Pilot on ~5-10 primitives** in `primitiveRegistry.tsx` — pick a mix (a simple one, a DI-judged
   one like `base-ten-blocks-di`, one with a heavy chart dependency if any exist) rather than
   alphabetically-first. Convert each to `next/dynamic(() => import(...))`. Do **not** touch
   `DevPanelRouter.tsx` yet.
3. **Verify the pilot at runtime, not just `typecheck:lumina`** (Verification Doctrine — a type
   check is never verification of behavior here): actually load a lesson through
   `ManifestOrderRenderer` that renders each piloted primitive, confirm it mounts, confirm no
   hydration-mismatch/SSR warning in the console (Next 14's `dynamic()` defaults to SSR-enabled;
   decide per-primitive whether `{ ssr: false }` is needed — most of these are heavily interactive
   client widgets, so `ssr: false` may be the safer default, but check whether any consumer depends
   on server-rendered markup for SEO/first-paint before blanket-applying it), and confirm the
   build-memory number from step 1 actually moved.
4. **Only after the pilot passes runtime verification**, sweep the remaining ~200 entries in
   `primitiveRegistry.tsx` in one mechanical commit (per `/ship`'s "mechanical sweeps... must contain
   only the sweep" rule — don't mix this with unrelated primitive edits).
5. **Second target, same pattern: `DevPanelRouter.tsx`'s `PANELS` map.** These are `'use client'`
   already and are exercised only from behind an explicit "Developer Tools" click, not the student
   lesson flow, so `{ ssr: false }` is almost certainly correct here. Same pilot-then-sweep
   discipline, verified by actually opening each piloted dev panel.
6. **Re-run the local repro from step 1** (or trigger a real Vercel deploy) as the closing
   verification. State the before/after number in the commit body and in this file's follow-up, per
   the Verification Doctrine — "should work" is not sufficient for a build-health fix; show the
   number moved.

## Risks / things to check before declaring a primitive "done"

- A primitive that reads `document`/`window` at module scope (not inside an effect) will break under
  `ssr: false` differently than it broke under eager import — check for this class of bug
  specifically, it's the most common `next/dynamic` migration failure.
- Some Tester components (`MathPrimitivesTester`, etc.) import the *same* primitive components again
  for their own dropdowns — after this refactor, confirm webpack still dedupes those into one chunk
  rather than double-bundling (bundle analyzer, if one gets added, or just compare `.next` output
  size before/after).
- `component: () => null` entries (e.g., the modal-managed `detail-drawer` at
  `primitiveRegistry.tsx:360`) don't need conversion — leave them alone.
- Confirm whether `DevPanelRouter`/`IdleScreen` are already route-split from the student-facing pages
  by Next's automatic per-page chunking, or whether they share a layout/page bundle with the real
  lesson experience — this changes how much headroom step 5 actually buys, and is worth checking
  with a bundle analyzer before investing in the sweep.

## Files to start with

- `src/components/lumina/config/primitiveRegistry.tsx` (primary target)
- `src/components/lumina/components/DevPanelRouter.tsx` (secondary target)
- Consumers, for the runtime-verification pass only (should not need edits):
  `ManifestOrderRenderer.tsx`, `KindergartenStage.tsx`, `PulseActivityRenderer.tsx`,
  `PracticeManifestRenderer.tsx`, `CuratorCompanion.tsx`, `CuratorConsole.tsx`,
  `DeepDiveTester.tsx`, `CalibrationSimulator.tsx`, `FeatureExhibitTester.tsx`,
  `service/annotated-example/registry.ts`
- `next.config.js` / stray `next.config.ts` — only if you want to fold in the dead-file cleanup;
  unrelated to this fix otherwise.

## Immediate/parallel mitigation (do not duplicate)

`NODE_OPTIONS=--max-old-space-size=8192` (or similar) as a Vercel Production env var was
recommended the same day as the stopgap — check whether it's already set and whether the
`2ec88137` deployment has since been successfully redeployed before assuming production is still
broken.
