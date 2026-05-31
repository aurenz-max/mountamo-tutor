# Migrate Lumina Primitive to the Lumina UI Kit

This skill migrates existing Lumina primitives onto the **Lumina UI kit** (`lumina/ui/`) — the codified design system that is the single source of truth for the glass aesthetic. It replaces hand-written chrome (custom div styling **and** raw shadcn + copy-pasted Tailwind class strings) with the kit's `Lumina*` components, while preserving all functionality.

## Why this skill changed

The kit exists because `backdrop-blur-xl bg-slate-900/40 border-white/10` was hand-copied 236× across 140 files. Migrating to *raw shadcn* (the old target) just relocated the problem — every primitive still retyped the glass strings, so the theme couldn't evolve at scale. The target is now the kit: edit [`tokens.ts`](../../my-tutoring-app/src/components/lumina/ui/tokens.ts) once → every migrated primitive follows.

## Two starting states (both in scope)

1. **Custom div-based** — `<div className="glass-panel …">`, manual hover handlers, inline styles, custom expand/collapse state. Migrate structure → kit components.
2. **Already shadcn, but hand-typed glass strings** — uses `<Card className="backdrop-blur-xl bg-slate-900/40 …">`. This is the bulk of the catalog. Migration here is a near-mechanical swap to `Lumina*` components.

## Required Reading

- **The kit barrel — read this FIRST, every migration:** [`lumina/ui/index.ts`](../../my-tutoring-app/src/components/lumina/ui/index.ts). It is the authoritative, live list of kit components. The kit grows often; this skill's pattern list is illustrative, not exhaustive — the barrel is the source of truth. If a hand-rolled pattern has a `Lumina*` export, use it.
- The kit catalog with prop tables: `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md` (UI Component Guidelines section).
- Tokens: [`lumina/ui/tokens.ts`](../../my-tutoring-app/src/components/lumina/ui/tokens.ts)
- Background on the custom→shadcn mechanics (still useful for state cleanup): `my-tutoring-app/src/components/lumina/docs/MIGRATING_TO_SHADCN.md`

## When to Use This Skill

- Moving an existing primitive onto the Lumina UI kit
- Eliminating hand-typed glass class strings from a primitive
- Reducing component complexity and line count
- Standardizing chrome so theme changes propagate from `tokens.ts`

**DO NOT use this skill for:**
- Creating new primitives (use the `primitive` skill — it already composes from the kit)
- Migrating non-visual primitives with complex game logic
- Quick bug fixes

## The boundary — frame, not painting

The kit is the **chrome/frame**: cards, buttons, badges, nested panels, text hierarchy. The **bespoke interaction surface** — canvas, SVG simulation, drag targets, the object the student manipulates — stays custom. Per the Direct-Manipulation and Living-Simulation principles, that layer is *supposed* to be unique per primitive. Do NOT force a `<canvas>` or a drag grid into a `LuminaCard`-shaped box. Migrate the frame around the interaction, leave the interaction alone.

## Step-by-Step Migration Workflow

### Phase 1: Preparation

1. **Ask the user which primitive to migrate** — full file path or component name; confirm the domain.

2. **Read the current primitive** and classify it (state 1 vs state 2 above). Identify:
   - Container divs / `<Card …glass…>` → `LuminaCard`
   - Nested section divs (`bg-black/20 …`) → `LuminaPanel`
   - Custom expandable sections → shadcn `Accordion` (not in kit) themed via tokens
   - Custom buttons / `<Button variant="ghost" …>` → `LuminaButton`
   - Custom labels / `<Badge …>` → `LuminaBadge`
   - The **interaction surface** to leave untouched (canvas/SVG/drag).

3. **Analyze complexity** — line count, UI-only state (expand/collapse), removable hover handlers.

### Phase 2: Migration

4. **Swap imports to the kit.** The kit lives at `lumina/ui`; from `primitives/visual-primitives/<domain>/` the path is `../../../ui`.

   ```tsx
   import {
     LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription,
     LuminaCardContent, LuminaButton, LuminaBadge, LuminaPanel,
   } from '../../../ui';
   // shadcn parts the kit doesn't wrap — import directly, theme via tokens:
   import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
   ```

   Remove the now-unused `@/components/ui/card`, `@/components/ui/button`, `@/components/ui/badge` imports.

5. **Replace containers** → `LuminaCard` + `LuminaCardHeader`/`LuminaCardTitle`/`LuminaCardDescription`/`LuminaCardContent`. Drop the glass `className` entirely — it's baked in. Use `surface="nested"` / `surface="elevated"` instead of hand-tuning the background.

6. **Replace nested section divs** (`bg-black/20 border border-white/10 rounded-lg p-4`) → `LuminaPanel` (add `accent="cyan"` etc. for a category rail).

7. **Replace buttons** → `LuminaButton`. Map the intent to a `tone`: default action = `ghost` (default), emphasized = `primary`, destructive = `danger`, quiet = `subtle`. Remove inline `style`, `onMouseEnter`/`onMouseLeave`, and the `bg-white/5 border border-white/20…` strings.

8. **Replace badges/labels** → `LuminaBadge` with `accent` for the category color. Drop the `bg-slate-800/50 border-slate-700/50 text-orange-300` string.

9. **Theme leftover shadcn parts via tokens, not literals.** For Accordion/Tabs/Slider/Switch, import `surface`, `text`, `accentText` from `lumina/ui` and reference those instead of retyping class strings. If you spot a chrome pattern repeating across primitives, flag it for promotion into the kit rather than copying it.

10. **Clean up** — remove unused expand/collapse state, toggle handlers, inline styles, manual hover effects, and now-redundant nesting.

### Phase 3: Verification

11. **Write the complete migrated file in one operation** (Write tool) to avoid broken JSX.

12. **Run type check:** `cd my-tutoring-app && npx tsc --noEmit`. The kit is fully typed; fix any errors from prop changes (e.g., `variant` → `tone`, `className` glass → removed). Ignore the known pre-existing `ManifestViewer.tsx` `Record<ComponentId,string>` error.

13. **Grep-confirm the strings are gone:**
    ```bash
    grep -nE "backdrop-blur-xl bg-slate-900/40|bg-white/5 border border-white/20|bg-slate-800/50 border-slate-700/50|bg-blue-600|border-blue-500 bg-blue-500/20|bg-black/20 rounded-2xl" <file>
    ```
    A clean migration returns nothing (outside the interaction surface). The added patterns catch the eval-loop debt: `bg-blue-600` (off-brand solid button → `LuminaActionButton`), the answer-FSM selected state, and the hand-rolled feedback banner.

14. **Report results** — original vs new line count, glass-string instances removed, UI state/handlers removed, kit components now used, any shadcn parts retained (and why), any patterns flagged for kit promotion.

### Phase 4: Testing Reminder

15. **Remind the user to test** in the tester: sections expand, buttons fire correct actions, visual appearance matches Lumina, keyboard nav works, the interaction surface is unchanged, no console errors.

## Common Migration Patterns

### Pattern 1: Container → LuminaCard

```tsx
// Before (state 1: custom div)
<div className="w-full glass-panel rounded-2xl shadow-2xl border border-white/10">
  <div className="p-6">
    <h3 className="text-2xl font-bold text-slate-100 mb-1">{data.title}</h3>
    <p className="text-sm text-slate-400">{data.description}</p>
    {/* content */}
  </div>
</div>

// Before (state 2: shadcn + glass string)
<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
  <CardHeader>
    <CardTitle className="text-slate-100">{data.title}</CardTitle>
    <CardDescription className="text-slate-400">{data.description}</CardDescription>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>

// After (both → kit; no glass string, no text-color string)
<LuminaCard>
  <LuminaCardHeader>
    <LuminaCardTitle>{data.title}</LuminaCardTitle>
    <LuminaCardDescription>{data.description}</LuminaCardDescription>
  </LuminaCardHeader>
  <LuminaCardContent>{/* content */}</LuminaCardContent>
</LuminaCard>
```

### Pattern 2: Nested section → LuminaPanel

```tsx
// Before
<div className="bg-black/20 border border-white/10 rounded-lg p-4">{/* readout */}</div>

// After
<LuminaPanel accent="cyan">{/* readout */}</LuminaPanel>
```

### Pattern 3: Buttons → LuminaButton

```tsx
// Before
<Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10">Submit</Button>
<button className="…bg-rose-500/15…" onClick={reset}>Reset</button>

// After
<LuminaButton onClick={submit}>Submit</LuminaButton>
<LuminaButton tone="danger" onClick={reset}>Reset</LuminaButton>
```

### Pattern 4: Labels → LuminaBadge

```tsx
// Before
<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">{label}</Badge>

// After
<LuminaBadge accent="orange">{label}</LuminaBadge>
```

### Pattern 5: Custom expandable → LuminaAccordion

```tsx
// Before — hand-rolled expand/collapse state OR shadcn Accordion + glass strings
const [open, setOpen] = useState<string|null>(null); /* …toggle handlers… */

// After
<LuminaAccordion type="single" collapsible defaultValue="stats">
  <LuminaAccordionItem value="stats" accent="amber" icon={<Gauge className="w-5 h-5" />} label="Quick Stats">
    {/* content */}
  </LuminaAccordionItem>
</LuminaAccordion>
```

## Recognize-and-replace catalog

The kit now covers far more than containers. When you see these hand-rolled patterns, replace them. **This table is illustrative — always cross-check the live barrel (`lumina/ui/index.ts`) for the full, current list.**

| Hand-rolled pattern you'll see | Kit replacement |
|---|---|
| Glass card / `backdrop-blur-xl bg-slate-900/40 border-white/10` | `LuminaCard` (+ Header/Title/Description/Content) |
| Nested `bg-black/20` section div | `LuminaPanel` |
| Ghost/primary/danger `<Button>` with glass strings | `LuminaButton` (`tone=`) |
| `<Badge>` with `bg-slate-800/50 …text-{c}-300` | `LuminaBadge` (`accent=`) |
| Expand/collapse sections | `LuminaAccordion` / `LuminaAccordionItem` |
| Data table (`<table>` or shadcn Table + glass) | `LuminaTable` (`columns`/`rows`) |
| Icon-chip + uppercase label + body (KEY DIFFERENCES, IN CONTEXT, MISCONCEPTION) | `LuminaCallout` |
| Uppercase accent section header (SYNTHESIS & ANALYSIS) | `LuminaSectionLabel` |
| Range `<input>` / shadcn Slider | `LuminaSlider` (smooth feel baked in) |
| Boxed metric tile / inline "Counted: 8 / 6" | `LuminaStat` / `LuminaInlineStat` |
| −/value/+ number entry | `LuminaStepper` |
| Eval-mode pill row · "Challenge X of Y" · task banner | `LuminaModeTabs` · `LuminaChallengeCounter` · `LuminaPrompt` |
| Thin progress bar | `LuminaProgress` |
| **Answer option with selected/correct/incorrect states** | `LuminaAnswerChoice` (5-state FSM) |
| **Post-answer result banner** | `LuminaFeedbackCard` (`status="correct"\|"incorrect"\|"insight"`) |
| **Check Answer / Try Again / Next buttons** | `LuminaActionButton` (`action="check"\|"retry"\|"next"`) |
| **"Need a hint?" reveal** | `LuminaHintDisclosure` |
| **Results score ring + tier** | `LuminaScoreRing` (tier from `getPerformanceTier`/`TIERS` in tokens) |

### Pattern 6: Evaluation loop (the highest-value swing for evaluable primitives)

Most evaluable primitives hand-roll an answer-state machine, a feedback banner, and submit/reset buttons. This is where the biggest Tailwind debt lives — migrate it.

```tsx
// Before — hand-rolled statusClass FSM + solid-blue button + black/20 feedback div
let statusClass = "border-white/10 bg-white/5 …";
if (selected === v) statusClass = "border-blue-500 bg-blue-500/20 …";
if (submitted) { /* …correct/incorrect/dimmed branches… */ }
<button className={`… ${statusClass}`}>{label}</button>
<button className="bg-blue-600 …">Verify Answer</button>
{submitted && <div className="bg-black/20 rounded-2xl …">{rationale}</div>}

// After — the state machine is one prop; banner + button are kit
<LuminaAnswerChoice
  state={!submitted ? (selected===v ? 'selected' : 'idle')
         : v===correct ? 'correct'
         : selected===v ? 'incorrect' : 'dimmed'}
  disabled={submitted}
  onClick={() => setSelected(v)}>
  {label}
</LuminaAnswerChoice>

{!submitted
  ? <LuminaActionButton action="check" disabled={selected===null} onClick={submit} />
  : <>
      <LuminaFeedbackCard status={isCorrect ? 'correct' : 'insight'} teachingNote={data.teachingNote}>
        {data.rationale}
      </LuminaFeedbackCard>
      <LuminaActionButton action="retry" onClick={reset} />
    </>}
```

This also retires the off-brand solid-`bg-blue-600` button — `LuminaActionButton` ships the on-brand glass version.

## Theming Reference (under the hood)

Prefer kit components and the exported tokens. The raw strings below are what `tokens.ts` encodes — reach for them directly only when no token covers the case:

- **Surfaces:** `surface.glass` / `surface.nested` / `surface.elevated`
- **Text:** `text.primary` (slate-100) / `text.secondary` (slate-400) / `text.muted` (slate-600)
- **Interactive:** `interactive.ghost` / `interactive.hover`
- **Accents (label weight):** `accentText[accent]` (-300), `accentBorder[accent]`, `accentGlow[accent]`
- **Accents (callout/strong weight):** `accentSolidBg` (bars/dots), `accentSoftBg` (-500/5 panels), `accentChipBg` (-500/20 icon chips), `accentSoftBorder` (-500/20), `accentStrongText` (-400)
- Accent union: `'orange'|'emerald'|'cyan'|'amber'|'blue'|'purple'|'pink'|'rose'`
- **Performance tiers:** `getPerformanceTier(score)` + `TIERS` (perfect/great/good/needs-work) — for results/score chrome; never re-declare a local TIER_CONFIG.

## Priority Migration Order

1. **Display cards** (OrganismCard, SpeciesProfile, FactFile) — high visual impact, near-mechanical swap
2. **Info panels** (ConceptCard, CuratorBrief) — moderate
3. **Evaluable problem primitives** (TrueFalseProblem, MultipleChoiceProblem) — highest debt: migrate the answer FSM + feedback + action buttons onto the eval-loop kit (Pattern 6). Biggest payoff per file.
4. **Interactive / multi-phase primitives** — migrate the scaffold + eval chrome; leave canvas/SVG/drag untouched.

When migrating in bulk, the state-2 swaps (already-shadcn) are highly parallelizable — good work for parallel subagents, one primitive each.

## Success Metrics

- ✅ Zero hand-typed glass/button/badge class strings remain (grep-confirmed, outside the interaction surface)
- ✅ Chrome composed entirely from `Lumina*` components + tokens
- ✅ For evaluable primitives: answer FSM → `LuminaAnswerChoice`, feedback → `LuminaFeedbackCard`, submit/reset → `LuminaActionButton`, hint → `LuminaHintDisclosure`, score → `LuminaScoreRing`; no local `TIER_CONFIG`
- ✅ No custom state for expand/collapse; no inline styles or manual hover handlers
- ✅ Interaction surface (canvas/SVG/drag) preserved unchanged
- ✅ TypeScript compiles; component renders correctly in the tester
- ✅ Line-count reduction (typically 30–80% on state-1; smaller on state-2 but the win is string elimination, not lines)

## Important Notes

- **ALWAYS write the complete migrated file in one operation** to avoid broken JSX.
- **Do NOT skip the type check.**
- **Migrate the frame, not the painting** — never wrap the bespoke interaction surface in kit chrome.
- **Theme leftover shadcn via tokens**, never re-introduce literal class strings.
- **Preserve all functionality** — this is visual/structural refactoring; handlers, props, and logic are unchanged.

## Reference Files

- Kit: `my-tutoring-app/src/components/lumina/ui/*`
- Tokens: `my-tutoring-app/src/components/lumina/ui/tokens.ts`
- Custom→shadcn mechanics (state cleanup): `my-tutoring-app/src/components/lumina/docs/MIGRATING_TO_SHADCN.md`
- shadcn components not in the kit: `my-tutoring-app/src/components/ui/*`

## Common Questions

**Q: Migrate all primitives at once?**
A: One at a time with a type check each, OR fan out state-2 (already-shadcn) swaps across parallel subagents — they're mechanical and independent.

**Q: My primitive has a canvas / unique SVG interaction.**
A: Leave it alone. Migrate only the surrounding chrome (card, header, buttons, readout panels). The kit is the frame, not the painting.

**Q: A shadcn part I need isn't in the kit (Tabs, Slider).**
A: Import it from `@/components/ui/*` and theme it with the exported tokens. If you keep doing this for the same part across primitives, flag it for promotion into the kit.

**Q: Will this break functionality?**
A: No — handlers, props, and logic are untouched. Only prop names on chrome change (`variant`→`tone`, glass `className` removed).
