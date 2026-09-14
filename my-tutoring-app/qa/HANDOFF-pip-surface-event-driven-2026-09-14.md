# HANDOFF — Pip shared surfaces, event-driven (2026-09-14)

**State:** built and verified in tests and headless Chromium; **nothing committed**. Eight math
primitives publish Pip surfaces, Pip joins them from primitive events with no tutor session,
and `/add-pip-surface` documents the path. Next: ship it (item 1), then the open checks.

## What exists

**The path.** Primitive events → pure pose policy → `PipSurfaceStore` → one actor in the
primitive's dock (`CuratorCompanion` → `PipSurfaceActor`). Tutor speech is one input to a pose,
never a precondition. User ruling (memory `feedback_pip-event-driven-not-tutor-gated`): never
gate Pip on `isConnected`.

- **Activation** (`pip/PipSurfaceStore.ts`): first surface to register; then whichever surface's
  pose last changed into a non-idle phase. Hosts add claims: the lesson's focused section
  (`ManifestOrderRenderer`, no session) and the tutor's active block (`LuminaAIProvider`). A claim
  on a block with no surface parks Pip on its perch. Unchanged republishes emit nothing.
- **Publishing** (`pip/PipSurfaceContext.tsx`): `usePipSurface(() => …)` runs every commit — no
  dependency lists. `usePipTargets(scopeId, canTouch)` gives `dock`, stable `ref(id)`,
  `look(id)`, `targets(ids?)`, `clear()`, `lastTouchedId`.
- **Gate** (`pip/pipPhasePose.ts`): celebrate only a confirmed item; neutral before start and over
  the previous item's audio tail; drop invisible targets. Every policy, Counting Board included,
  is built on it. Classic primitives add `useSpeechScope` and count speech only when
  `activePrimitiveId === instanceId`.
- **Actor**: ring + connector for a small object; outline only for a region (>140px or elongated).

**Integrated primitives** — targeting rules in `pip/README.md`: counting-board (pilot),
number-sequencer, number-tracer, number-bond, ordinal-line, sorting-station, compare-objects,
comparison-builder. Families and references are in the skill.

**Verification on record** (`qa/pip-surface/sweep-2026-09-14.md`):
- Vitest 33 suites / 437 tests (Pip + every existing suite of the eight primitives + helper);
  after the Counting Board gate unification, 18 suites / 118 re-run green.
- `typecheck:lumina` 0; full tsc 770 = baseline.
- Headless drives: pointing live for all seven new primitives (real tutor speech on several, injected
  silent `ai_audio` otherwise); with no sign-in, Pip present before Start and `look` on touch;
  regeneration gives a new dock with one body; no dock overlap or page overflow at 1400/760.

## Adjustments to existing approaches

Done in this slice:
- Counting Board's policy now uses the shared gate (was a duplicate of it); its element map
  moved to `usePipTargets`.
- `MathPrimitivesTester` passes the preview `instanceId` to number-tracer and sorting-station;
  `PreviewTutor`'s comment no longer claims it clears Pip.
- Provider no longer nulls Pip on disconnect; companion renders surfaces with no session and
  keeps "Wake Pip up" visible after a session ends.

Not changed — needs a decision (see "Decisions"): the perch for primitives **without** a surface
is still session-gated, and the Codex copy of the skill still teaches the old path.

## Open items (top first)

| # | Item | Executor | Notes |
|---|------|----------|-------|
| 1 | Commit the Pip work | `/ship` | Hub files are shared with other lanes — hunk-split (see "Shipping"). |
| 2 | Browser check of the lesson scroll claim | `/add-pip-surface` Phase 3 (manual drive) | Generate a lesson with ≥2 integrated primitives, no sign-in; scroll — Pip should move to the focused section's dock. Not exercised yet. |
| 3 | Reduced-motion and mouth-timing check | human check | Not inspected in any drive. |
| 4 | Companion corner chrome covers answer buttons at ~760px | CuratorCompanion layout | Pre-existing; affects every primitive in the helper. |
| 5 | ~15 SVG `Expected length` console errors per drive | investigate | Also on the Counting Board control; likely `motion.ellipse`/`motion.circle` in committed `PipCharacter.tsx` animating from undefined. |
| 6 | Shared judged-runner test mock in `pip/testing/` | refactor | Seven surface tests repeat it; two failures came from mock gaps (`onItemOpened`, `useEvaluationContext`). Optional. |

## Decisions for the user

1. **Perch without a surface.** `usePerchAnchor(activePrimitiveId, expanded && isConnected && !surface)`
   still needs a session, and the companion shows Pip `sleeping` when disconnected. Should the
   lesson-focus claim also drive the perch for primitives that have no surface?
2. **Codex skill copy.** `~/.codex/skills/add-pip-surface/SKILL.md` still says activation goes
   "through the existing tutor lifecycle". Update it to match, point it at the Claude skill, or
   delete it.
3. **Lifecycle ladder.** `docs/PRIMITIVE_LIFECYCLE.md` does not list `/add-pip-surface`. Place it
   (e.g. beside `/add-sound` at L5 Polished) or leave it off the ladder.

## Shipping (item 1)

Pip-only paths:
- Untracked: `my-tutoring-app/src/components/lumina/pip/`, `my-tutoring-app/src/app/lumina/pip-surface/`,
  `.claude/skills/add-pip-surface/`, `my-tutoring-app/qa/pip-surface/`, this file.
- Modified, Pip hunks: `CuratorCompanion.tsx`, `LuminaAIContext.tsx`, `ManifestOrderRenderer.tsx`,
  `MathPrimitivesTester.tsx`, `PipCharacter.tsx`, `PipLab.tsx`, and the eight primitive components.

Shared with other lanes — stage by hunk:
- `NumberTracer.tsx` (192-line diff; ~45 lines are Pip, the rest is the digit-evaluation lane with
  `gemini-digit-evaluation.ts` / `gemini-number-tracer.ts`) and `pip/NumberTracer.surface.test.tsx`
  (that lane changed its canvas mock).
- Not Pip, leave out: `next.config.js` (build memory settings), `AreaModel.tsx`, `catalog/math.ts`,
  `gemini-area-model.ts`, misconception skill docs.

The Counting Board pilot, the seven integrations and the event-driven change were built in one
working tree. Committing the pilot separately would give that commit a tutor-gated store the
later commit rewrites, so one Pip commit (or pilot + sweep in dependency order, each typechecked)
is simpler.

## Working notes

- Servers: this session started `:3000` (`npm run dev`) and `:8000` (uvicorn) when both were down;
  they may still be running. Never start a second `next dev`.
- Other sessions edit this tree concurrently (area-model and number-tracer lanes today). Re-read a
  file right before patching; many files are CRLF.
- Bash heredocs strip backslashes and mangle `\n` in Python sources — write scripts with the Write
  tool.
- Drive: copy `.claude/skills/add-pip-surface/scripts/*.mjs` to a scratch folder with
  `playwright-core@1.52.0`. No sign-in unless the actions include `start` or `speak:`.
