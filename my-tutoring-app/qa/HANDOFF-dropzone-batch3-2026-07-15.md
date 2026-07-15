# Handoff: Drop-Zone State Language Migration — Batch 3 tail (13 un-migrated files)

Paste-ready brief for a fresh session. Source of truth: **`src/components/lumina/docs/DROPZONE_MIGRATION_PRD.md`**
(read §2 the proven pattern, §4 acceptance criteria, §5 verification, §7 risks — this brief does
not replace it). Ground-truthed by a 2026-07-15 `/pm` pass.

## Scope correction (read first)

**Batch 1 is already code-complete** (all 10 files migrated; pilot + 2 problem primitives
browser-verified, the other 8 are ◐ "migrated + typechecked, browser spot-check pending"). The
raw-DnD grep is misleading: those files still contain `dataTransfer`/`onDragStart` because **drag
mechanics stay bespoke by design** (PRD non-goal) — only the *zone visuals* migrate. Do NOT
re-migrate Batch 1/2. Their remaining work is browser spot-checks (a human/playwright task, not
code) — leave those to the PRD's ◐ tracking / a browser sitting.

**This delegation = the un-migrated Batch-3 tail: 13 files.** The Batch-3 pilot
(`literacy/SentenceBuilder.tsx`) is ✅ done and browser-verified, so the pattern is proven — this
is a sweep, not a pilot.

## The 13 files (all confirmed NO-kit + hand-typed `border-dashed` in the tree, 2026-07-15)

**Math (do first — testers exist in the math panel):**
`math/NumberSequencer.tsx` (4 dashed surfaces) · `math/PatternBuilder.tsx` · `math/EquationBuilder.tsx`
· `math/ComparisonBuilder.tsx` · `math/OrdinalLine.tsx` · `math/TapeDiagram.tsx` ·
`math/TransformationLab.tsx` · `math/LengthLab.tsx`

**Misc (then these):**
`calendar/TimelineBuilder.tsx` · `engineering/PropulsionTimeline.tsx` ·
`core/deep-dive/blocks/TimelineBlock.tsx` · `biology/ProcessAnimator.tsx` ·
`astronomy/PlanetaryExplorer.tsx`

Already migrated (leave alone): PhonicsBlender, CvcSpeller, TextStructureAnalyzer, WordBuilder (HAS-kit).

## No collision with live sessions
Two sessions are in flight — grade-fidelity (touches **generators** `service/*`) and sorting-station
(touches `SortingStation.tsx` + its catalog/generator). None of the 13 files overlap. `ComparisonBuilder`
is in this list but no active session touches it (its reader-fit PRE work is already shipped). If you
somehow need to touch a generator or `SortingStation`, STOP and coordinate — otherwise you're clear.

## The pattern (from PRD §2 — copy SentenceBuilder / ClassificationSorter, don't invent)

These are **sequence/slot builders**: ordered or structured slots filled from a chip bank. Per file:

1. Transient grading flash per zone: `const [dropFlash, setDropFlash] = useState<{id, ok}|null>(null)`
   + a `dropFlashTimer` ref cleared on unmount and re-fire; 900 ms window then settle.
2. In the existing drop/tap handler, AFTER grading, set the flash — don't touch grading logic.
3. **Derive** `zoneState: DropZoneState` (`dragOver` if hovered → `correct`/`incorrect` if flashing →
   `filled` if occupied → else `idle`). Never store zone state as its own machine.
4. Render `<LuminaDropZone state={zoneState} emptyPrompt="…" className="…">`. Handlers may stay on a
   larger container; the zone is the visual surface only. Import from `lumina/ui` (`LuminaDropZone`,
   `DropZoneState` are exported from `ui/index.ts`).

**Slot-shaped escape hatch (PRD §7 — you WILL hit this here):** many of these slots are small
(number cells, tape segments, inline sequence slots). If the zone chrome (border + min-height) is too
big for the slot, apply **`dropZoneStateClass(state)`** to the bespoke slot element instead of wrapping
in `LuminaDropZone`. The token map is the contract; the component is just convenience. Where a slot is
inline-text-shaped and `LuminaFillBlankSlot` already fits, use it — don't double-wrap.

## Rulings (settled — do NOT relitigate per file; PRD §2)
- Zone colors ONLY from `dropZoneStateClasses` — no hand-typed emerald/rose/blue borders.
- Grading motion (`motion.pop`/`motion.shake`) comes free from the kit — **remove** any old per-file
  shake/pop/ring animation; don't re-add it.
- **Category identity ≠ zone state:** if a primitive colors slots per category/value, the accent moves
  to the label/header (`accentText`/`LuminaSectionLabel`); the zone body speaks only state.
- Always pass `emptyPrompt` (the invitation is part of the language).
- Settle out of `dragOver` in BOTH `dragLeave` and after drop (including null-payload early-returns).

## Ground rules (non-negotiable)
- **Visual layer ONLY.** Mechanics, grading logic, metrics, evaluation submission, tutor `sendText`
  hooks must be byte-equivalent — the diff shows visual-layer changes only (PRD non-goals). Resist
  "while I'm in here" refactors.
- **Prefer complete-file rewrites** over incremental JSX edits (CLAUDE.md — partial JSX edits have
  repeatedly broken structure).
- **Type check exactly:** `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` (project-local
  binary, abs path) + `npm run typecheck:lumina`. Zero NEW errors vs baseline.
- **Verification (PRD §5):** this batch's pilot is already shipped, so per file: tsc + the acceptance
  greps, then a **tester-panel spot-check screenshot** per subject sub-batch (math panel, then the misc
  ones). ⚠ user often has dev servers on :3000/:3001 — a background `npm run dev` lands on **:3002**;
  drive that. Screenshot a correct + an incorrect drop and LOOK at them. A fix not exercised at runtime
  is not verified (Verification Doctrine).
- Don't restart the user's dev servers; don't write under `backend/app/` mid-run.
- Don't commit/push unless the user asks. **Commit per sub-batch (`/ship`), not per file** (PRD §6).

## Per-file acceptance criteria (PRD §4 — all must hold)
1. `grep -n "border-dashed" <file>` returns only kit-sourced classes (nothing hand-typed).
2. Zone state is derived (hover/flash/contents), not stored.
3. `emptyPrompt` on every zone that can be empty.
4. Grading motion via the kit only; old per-file animation removed.
5. Mechanics/grading/metrics/eval/tutor byte-equivalent.
6. tsc + typecheck:lumina clean.

## Batch gate (PRD §5)
After the batch, `grep -rl "border-dashed" src/components/lumina/primitives --include="*.tsx"` shrinks by
exactly these file counts (minus any you correctly triage as decorative — tag
`// dropzone-triage: decorative, out of scope` and leave, like the Batch-4 rule). If a file turns out to
be a static display, not a drop target, triage it rather than forcing a zone.

## Definition of done
All 13 migrated (or explicitly triaged), acceptance greps green per file, tsc + typecheck:lumina clean,
math + misc sub-batch spot-check screenshots captured, PRD §3 Batch-3 status boxes updated, committed per
sub-batch. Then update the WORKSTREAMS "Lumina kit roadmap" row: Batch-3 tail done → next is Batch-4
triage or LuminaCompletionScreen (106 hand-rolled celebration blocks).
