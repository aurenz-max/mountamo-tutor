# Improvement Report: how-it-works vs machine-profile — 2026-03-31

## Executive Summary

**how-it-works** is functionally correct — challenges work, evaluation submits, AI tutoring hooks fire. But compared to **machine-profile**, it feels like a wireframe. Machine-profile is a rich, magazine-style layout with AI images, themed colors, accordion sections, SpotlightCard effects, and multiple content zones. How-it-works is a single-column text slideshow with dots.

This report identifies the specific capability and visual gaps and recommends concrete upgrades.

---

## Side-by-Side Gap Analysis

| Dimension | machine-profile | how-it-works | Gap |
|-----------|----------------|--------------|-----|
| **Layout** | 2-column grid (image + accordions) | Single column, one step at a time | No spatial richness |
| **Images** | On-demand AI image generation via Gemini 2.5 Flash | `imagePrompt` field exists in data but **never rendered** | Dead data field |
| **Color theming** | 10 category themes (airplane=sky, car=red, etc.) with accent colors, ambient glow | No theming — everything is blue/slate | Monotone |
| **SpotlightCard** | Used on every section — mouse-follow glow effect | Not used at all | Missing polish layer |
| **Content sections** | 7 distinct zones: Header, Image, How It Works, Quick Stats, Key Components, History, Fascinating Facts, Real World Connections, Related Machines | 3 zones: Header, Step content, Challenges | Feels empty |
| **Accordion usage** | Multiple collapsible sections (stats, components, history) — invites exploration | Only "What's Happening?" per step | Underused |
| **Header** | Gradient background, ambient glow orb, large title, designation, era, category badge | Simple CardHeader with gear emoji | No visual impact |
| **Data richness** | QuickStats (7 fields + 3 comparisons), KeyComponents (with fun analogies), History (inventor, milestones, famous examples), FascinatingFacts (with icons) | Steps (title, description, whatsHappening, keyTerm, funFact) — all text | Data model is too flat |
| **Fun factor** | Fascinating Facts grid with themed icons, kid-friendly comparisons | Single inline "Fun Fact" badge per step | Buried, not celebrated |
| **Navigation** | Scroll-based (natural) | Prev/Next buttons with dot indicators | Feels constrained |
| **Footer** | Related Machines badges | Nothing | No "explore more" hook |

---

## Recommended Upgrades (Priority Order)

### P0 — Structural (High Impact, Moderate Effort)

#### 1. Render Step Images
The data already has `imagePrompt` per step but the component ignores it. Add on-demand AI image generation per step, identical to machine-profile's pattern:
- Show the image prompt as placeholder text
- "Generate Visual" button calls `/api/lumina` with `generateMachineImage` action
- Display generated image with gradient overlay caption
- **This single change would dramatically close the visual gap**

#### 2. Add Process Theming
Create a `PROCESS_CATEGORIES` map similar to `CATEGORY_COLORS`:
```
science → emerald/teal
engineering → amber/yellow
nature → green
cooking → orange
technology → blue/cyan
body → rose/pink
```
Add a `category` field to `HowItWorksData`. Use it for accent colors, header glow, and icon tinting throughout the component.

#### 3. Switch to Scroll Layout with All Steps Visible
Instead of showing one step at a time with Prev/Next, show ALL steps in a vertical timeline layout (like machine-profile shows all sections at once). Benefits:
- Students see the full process at a glance — better for comprehension
- Enables a proper 2-column layout for wider screens
- Eliminates the "slideshow" feel
- Steps can still track which ones the student has scrolled into view (IntersectionObserver) for evaluation metrics

### P1 — Visual Polish (Medium Impact, Low-Medium Effort)

#### 4. Add SpotlightCard Wrapping
Wrap each step card and the challenge section in `<SpotlightCard>` for the mouse-follow glow effect. Machine-profile wraps every section this way — it's a small change that adds significant premium feel.

#### 5. Upgrade the Header
- Add gradient background: `bg-gradient-to-br from-slate-900/90 to-slate-800/90`
- Add ambient glow orb (colored circle with `blur-[120px]`)
- Larger title typography
- Add category badge
- Add step count badge (already exists, keep it)

#### 6. Promote Fun Facts & Key Terms
Instead of burying these inline within each step:
- Collect all fun facts into a **"Fascinating Facts"** grid section at the bottom (like machine-profile)
- Collect all key terms into a **"Glossary"** accordion section
- This creates two additional content zones and rewards exploration

### P2 — Content Richness (Medium Impact, Medium Effort)

#### 7. Add "Quick Facts" Section
Add a data field for process-level quick facts (similar to QuickStats):
```typescript
quickFacts?: {
  duration?: string;        // "About 2 hours"
  whereItHappens?: string;  // "Inside your stomach"
  inventedBy?: string;      // "Ancient Egyptians"
  funComparison?: string;   // "Faster than a cheetah!"
  energySource?: string;    // "Electricity from the grid"
}
```
Render as an accordion section in a right column.

#### 8. Add "Real World Examples" Section
```typescript
realWorldExamples?: string[];  // "Your kitchen faucet", "Car wash sprayers"
```
Render as a badge list footer, matching machine-profile's "Related Machines" pattern.

#### 9. Add "Related Processes" Footer
```typescript
relatedProcesses?: string[];  // "Water Treatment", "Evaporation"
```
Badges in a footer bar — gives students a "what to explore next" hook.

### P3 — Interaction Upgrades (Lower Priority)

#### 10. Step Connection Lines
In the scroll/timeline layout, add visual connector lines or arrows between steps to reinforce the sequential nature. Use SVG or CSS borders.

#### 11. Progress Animation
When a student completes all steps, play a brief completion animation (e.g., steps light up in sequence) before showing the summary/challenges.

#### 12. Enhance Sequence Challenge with Drag-and-Drop
The current sequence challenge uses ▲/▼ buttons to reorder. Replace with actual drag-and-drop (using `@dnd-kit/core` which is likely already in the project) for a more tactile feel.

---

## Data Model Changes Required

```typescript
// New fields for HowItWorksData
interface HowItWorksData {
  // EXISTING (keep all)
  title: string;
  subtitle: string;
  overview: string;
  steps: Array<{ ... }>;  // add image rendering support
  summary: { ... };
  challenges?: Array<{ ... }>;

  // NEW
  category?: 'science' | 'engineering' | 'nature' | 'cooking' | 'technology' | 'body' | 'history';
  quickFacts?: {
    duration?: string;
    whereItHappens?: string;
    inventedBy?: string;
    funComparison?: string;
    energySource?: string;
  };
  realWorldExamples?: string[];
  relatedProcesses?: string[];
}
```

Generator changes: Update the Gemini schema in `gemini-how-it-works.ts` to include these new fields. Keep the schema simple (the existing step structure stays the same, just add top-level optional fields).

---

## Implementation Order

| Phase | Changes | Estimated Scope |
|-------|---------|-----------------|
| **Phase 1** | Render step images (#1) + SpotlightCard (#4) + Header upgrade (#5) | ~200 lines changed |
| **Phase 2** | Scroll layout (#3) + Process theming (#2) | ~300 lines (component rewrite) |
| **Phase 3** | Promoted facts/terms (#6) + Quick Facts (#7) + Real World Examples (#8) | ~150 lines + generator schema update |
| **Phase 4** | Related Processes (#9) + Connection lines (#10) + Drag-and-drop (#12) | ~100 lines + dependency |

Phase 1 alone would close ~60% of the visual gap with machine-profile.

---

## What NOT to Change

- **Challenge system**: Works correctly. The identify/sequence/predict/explain types are solid.
- **Evaluation integration**: Properly wired with `usePrimitiveEvaluation`.
- **AI tutoring hooks**: Well-implemented, good directive coverage.
- **Step data model**: The core `steps` array structure is fine — just needs image rendering added.

The primitive's *functionality* is sound. The gap is entirely in **visual richness** and **content density**.
