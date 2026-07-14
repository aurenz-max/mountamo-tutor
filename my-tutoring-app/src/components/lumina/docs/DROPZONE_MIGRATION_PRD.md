# PRD — Drop-Zone State Language Migration (~50 primitives)

**Status:** Batches 1–2 code-complete · Batch 3 pilot browser-verified; literacy sweep in progress
**Owner surface:** `lumina/ui` (tokens + `LuminaDropZone`) → all drop-target primitives
**Prereq (shipped):** `dropZoneStateClasses` + `DropZoneState` in [`ui/tokens.ts`](../ui/tokens.ts), [`LuminaDropZone`](../ui/LuminaDropZone.tsx), motion tokens (`motion.pop/shake/reveal`), Design Studio "Drop zones" section.

---

## 1. Goal

Every drop target in Lumina speaks one visual language: **idle** invites (dashed, faint), **dragOver** answers the drag (blue selected-glow, lifts), **filled** holds, **correct** pops emerald, **incorrect** shakes rose. Today every sorter/sequencer/categorizer invents its own — different dashed colors, different hover highlights, different empty prompts. After this migration, "this is a target / release here / right / wrong" looks and moves identically across all ~50 files, and retuning a state in `tokens.ts` moves the whole system.

**Non-goals — explicitly out of scope:**
- **Mechanics.** Drag/click/keyboard handling stays bespoke per primitive (frame, not painting). No primitive's interaction model changes.
- **Grading logic, metrics, evaluation submission, tutor `sendText` hooks.** Byte-for-byte behavior preservation outside visuals.
- **Continuous-drag manipulatives** (canvas sims, sliders, excavator arms, pan/zoom). Those drag *objects*, they don't drop *into targets*. Never wrap them in drop-zone chrome.
- **Full raw-shadcn → Lumina kit migration** of touched files. That's `/migrate-primitive`; do it opportunistically only where trivial.

## 2. The proven pattern (from the ClassificationSorter pilot)

Pilot: [`ClassificationSorter.tsx`](../primitives/visual-primitives/biology/ClassificationSorter.tsx) — browser-verified with real Gemini content (dragOver glow → correct `lumina-pop 0.35s` → settles filled; wrong drop `lumina-shake` → item bounces back; computed-style assertions + screenshots).

```tsx
// 1. Transient grading flash for the zone that just received a drop.
const [dropFlash, setDropFlash] = useState<{ categoryId: string; ok: boolean } | null>(null);
const dropFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current); }, []);

// 2. In the existing drop/tap handler, after grading:
if (dropFlashTimer.current) clearTimeout(dropFlashTimer.current);
setDropFlash({ categoryId, ok: isCorrect });
dropFlashTimer.current = setTimeout(() => setDropFlash(null), 900);

// 3. Derive the zone state — never store it as its own state machine:
const zoneState: DropZoneState =
  hovered === id ? 'dragOver'
  : dropFlash?.categoryId === id ? (dropFlash.ok ? 'correct' : 'incorrect')
  : itemsHere.length > 0 ? 'filled'
  : 'idle';

// 4. Render. Handlers may stay on a larger container (big hit-area for K-2);
//    the zone is the visual surface only.
<LuminaDropZone state={zoneState} emptyPrompt="Drop items here" className="min-h-[128px] flex-col items-stretch">
  {itemsHere.map(renderItem)}
</LuminaDropZone>
```

**Rulings (settled — do not relitigate per file):**
- Zone colors come ONLY from `dropZoneStateClasses` (via `LuminaDropZone`, or `dropZoneStateClass(state)` directly when a bespoke element must stay). No hand-typed emerald/rose/blue zone borders.
- Grading motion comes free from `LuminaDropZone` (`motion.pop`/`motion.shake` composed on correct/incorrect). Don't re-add per-file animation.
- **Category identity ≠ zone state.** If a primitive colors its buckets per category (e.g. WordSorter's violet/sky/emerald), the category accent moves to the bucket *label/header* (`accentText`/`LuminaSectionLabel`); the zone body speaks only state. Batch 2's pilot validates this ruling at runtime before the sweep applies it.
- Always pass an `emptyPrompt` (the invitation is part of the language).
- Flash window is 900 ms, then settle to `filled`/`idle`. Clear the timer on unmount and on re-fire.
- File-upload targets (e.g. ImagePanel) use `idle/dragOver/filled` only — no grading states on non-graded drops.
- Tap-to-place primitives: the held-selection lives on the *chip* (`selected` state); zones stay `idle` until tapped/hovered. Don't light every eligible zone.

**Gotchas from the pilot:**
- `React.Children.count` counts conditional-`false` children — `LuminaDropZone` uses `Children.toArray` internally; don't duplicate empty-checks per file.
- `cn`/tailwind-merge: `className` overrides win (e.g. `min-h-[128px]` replaces the base `min-h-[96px]`; `flex-col items-stretch` replaces row-centering). Use overrides, not wrapper divs.
- If a drop handler can early-return (null payload), make sure the zone still settles out of `dragOver` (settle in `dragLeave` AND after drop).
- Prefer complete-file rewrites over incremental JSX edits (CLAUDE.md rule).

## 3. Archetypes & batches

Pilot-then-sweep **per archetype**: the first file of each batch is a pilot, exercised at runtime (see §5) before the rest of the batch rolls.

### Batch 1 — HTML5 drag-and-drop targets (10 files; template = ClassificationSorter ✅)

True `onDrop` handlers. Closest to the pilot; mostly mechanical.

| File | Notes | Status |
|---|---|---|
| `visual-primitives/biology/ClassificationSorter.tsx` | PILOT | ✅ done, browser-verified |
| `problem-primitives/CategorizationActivityProblem.tsx` | high-traffic problem primitive | ✅ migrated, typechecked, browser-verified 2026-07-14 |
| `problem-primitives/SequencingActivityProblem.tsx` | ordered slots — each slot is a zone | ✅ migrated, typechecked, browser-verified 2026-07-14 |
| `visual-primitives/biology/CellBuilder.tsx` | organelles → cell regions | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/biology/CompareContrast.tsx` | traits → venn regions | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/biology/LifeCycleSequencer.tsx` | ordered slots | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/chemistry/MatterExplorer.tsx` | | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/core/deep-dive/blocks/DiagramBlock.tsx` | labels → diagram anchors; zone may be small — verify fit | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/engineering/ConstructionSequencePlanner.tsx` | ordered slots | ◐ migrated + typechecked; browser spot-check pending |
| `visual-primitives/math/BalanceScale.tsx` | weights → pans; bespoke pan uses `dropZoneStateClass()` | ◐ migrated + typechecked; browser spot-check pending |
| `ImagePanel.tsx` | annotation-image drop — `idle/dragOver/filled` only | ◐ migrated + typechecked; browser spot-check pending |

### Batch 2 — Tap-to-place bucket sorters (pilot = WordSorter)

Buckets graded on tap; no HTML5 DnD. WordSorter pilot must settle the **category-accent ruling** (accent in label, state in zone) at runtime before the sweep.

`visual-primitives/literacy/WordSorter.tsx` (pilot — ✅ migrated, typechecked, browser-verified 2026-07-14) · `math/SortingStation.tsx` (◐ migrated + typechecked; browser spot-check pending) · `core/deep-dive/blocks/HypothesisLabBlock.tsx` (◐ migrated + typechecked; browser spot-check pending)

Triage corrections: `math/CompareObjects.tsx` is answer selection/ordering, not selection→place; `biology/AdaptationInvestigator.tsx` contains only a decorative image placeholder. Both are tagged `dropzone-triage` and are out of scope.

### Batch 3 — Sequence / slot builders (pilot = SentenceBuilder)

Ordered or structured slots filled from a chip bank. Each slot is a small zone; compose with `LuminaChip`/`LuminaFillBlankSlot` where the slot is inline-text-shaped (if `LuminaFillBlankSlot` already fits, use it — don't double-wrap).

`literacy/SentenceBuilder.tsx` (pilot — ✅ migrated, typechecked, browser-verified 2026-07-14; 60×40 compact slot, pop/shake + settle asserted) · `literacy/PhonicsBlender.tsx` (◐ migrated + typechecked) · `literacy/CvcSpeller.tsx` (◐ spell-word slots migrated + typechecked; other dashed surfaces triaged as answer displays) · `literacy/SoundSwap.tsx` (dropzone-triage: transformation-result placeholder, out of scope) · `literacy/TextStructureAnalyzer.tsx` (◐ tap-to-map regions migrated + typechecked) · `literacy/RevisionWorkshop.tsx` (dropzone-triage: arrow reorder + reading annotation, out of scope) · `WordBuilder.tsx` (◐ migrated + typechecked) · `visual-primitives/AlphabetSequence.tsx` (dropzone-triage: static display, out of scope) · `math/NumberSequencer.tsx` · `math/PatternBuilder.tsx` · `math/EquationBuilder.tsx` · `math/ComparisonBuilder.tsx` · `math/OrdinalLine.tsx` · `math/TapeDiagram.tsx` · `math/TransformationLab.tsx` · `math/LengthLab.tsx` · `calendar/TimelineBuilder.tsx` · `engineering/PropulsionTimeline.tsx` · `core/deep-dive/blocks/TimelineBlock.tsx` · `biology/ProcessAnimator.tsx` · `astronomy/PlanetaryExplorer.tsx`

### Batch 4 — Triage the remaining `border-dashed` files

These matched the dashed-border grep but are probably **decorative placeholders**, not drop targets. Triage each: if it's a real selection→place target, assign to batch 2/3; if decorative, tag `// dropzone-triage: decorative, out of scope` and leave.

`AnnotatedExample.tsx` · `FormulaCard.tsx` · `ImageComparison.tsx` · `InteractivePassage.tsx` · `MediaPlayer.tsx` · `biology-primitives/SpeciesProfile.tsx` · `biology/OrganismCard.tsx` · `calendar/…` leftovers · `core/DigitalSkillsSim.tsx` · `core/HowItWorks.tsx` · `core/passage-studio/PassageRenderer.tsx` · `engineering/MachineProfile.tsx` · `literacy/LetterSpotter.tsx` · `literacy/PictureVocabulary.tsx`

## 4. Per-file acceptance criteria

A file is migrated when ALL hold:

1. Zone visuals come from `dropZoneStateClasses` (component or `dropZoneStateClass()`); `grep -n "border-dashed" <file>` returns only kit-sourced classes (i.e. nothing hand-typed).
2. State is **derived** (hover / flash / contents), not a stored zone state machine.
3. `emptyPrompt` present on every zone that can be empty.
4. Grading motion via the kit only; any old per-file shake/pop/ring animation removed.
5. Mechanics, grading logic, metrics, evaluation submission, and tutor hooks byte-equivalent (diff shows visual-layer changes only).
6. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero new errors; `npm run typecheck:lumina` passes.
7. Batch pilots additionally: runtime-driven per §5 before the batch sweeps.

## 5. Verification protocol

- **Pilots (one per batch):** drive in the running app. Pattern from the shipped pilot: `npm run dev` (⚠ user often has servers on :3000/:3001 — a background dev server lands on **:3002**; drive that one), headless Chrome via `playwright-core` + `channel: 'chrome'`, open the relevant tester panel (`DevPanelRouter` panels: biology/math/language-arts/engineering testers), generate real content, then dispatch synthetic `DragEvent`s with a real `DataTransfer` (works with React HTML5 DnD) or `.click()` for tap-to-place. Assert `className` contains the expected state classes AND `getComputedStyle(zone).animationName` is `lumina-pop`/`lumina-shake` at the flash moment. Screenshot correct + incorrect moments and LOOK at them.
- **Sweep files:** tsc + acceptance-criteria greps + tester-panel spot-check screenshot per subject batch.
- **Batch gate:** after each batch, `grep -rl "border-dashed" src/components/lumina/primitives --include="*.tsx"` shrinks by exactly the batch's file count (minus tagged decoratives).

## 6. Sequencing & rough size

1. **Batch 1** (10 files) — smallest, closest to template, testers exist. ~1 session.
2. **Batch 2** (5 files) — pilot resolves the category-accent ruling. ~1 session.
3. **Batch 3** (21 files) — largest; sub-batch by subject (literacy → math → rest) with the SentenceBuilder pilot first. ~2–3 sessions.
4. **Batch 4** (14 files) — triage first (cheap), migrate the true targets found. ~1 session.

Commit per batch (`/ship`), not per file. Update the status boxes in §3 as files land.

## 7. Risks

- **Slot-shaped zones (batch 3)** may be too small for the zone chrome (borders + min-height). Escape hatch: apply `dropZoneStateClass(state)` to the bespoke slot element instead of wrapping in `LuminaDropZone` — the token map is the contract, the component is convenience.
- **Per-category color loss (batch 2)** could hurt K-2 scannability. That's exactly what the WordSorter runtime pilot decides; if labels-only reads poorly, add an `accent` prop to `LuminaDropZone` scoped to the *label row* — never the state colors.
- **Behavior drift** from "while I'm in here" refactors. Resist; visual layer only (non-goal #4 exists for a reason).
