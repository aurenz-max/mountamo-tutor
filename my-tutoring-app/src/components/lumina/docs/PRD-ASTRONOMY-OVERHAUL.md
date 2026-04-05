# PRD: Astronomy Primitives Overhaul

**Status:** 0% — Planning
**Date:** 2026-04-04
**Scope:** Consolidate 10 astronomy primitives into 5 high-impact primitives with full eval modes + AI tutoring

---

## 1. Problem Statement

The astronomy domain has 10 primitives but only 2 have eval modes (LightShadowLab, ConstellationBuilder). The remaining 8 are visually impressive sandboxes with no assessment — students can click around and leave without learning anything verifiable.

**Specific issues:**
- **SolarSystemExplorer** — Beautiful D3 visualization, zero pedagogy. Click a planet, read a fact card, done.
- **TelescopeSimulator** — A zoom-in SVG simulator. No meaningful question can be asked.
- **ScaleComparator** — "Look at big numbers" without testing whether students internalize scale.
- **MissionPlanner** — "Pack enough food" isn't astronomy.
- **RocketBuilder** — Engineering primitive wearing an astronomy hat.
- **OrbitMechanicsLab** — Physics sandbox, not astronomy content.

**The fix:** Build one flagship primitive (PlanetaryExplorer) that replaces 3 weak ones, add eval modes to 2 strong concepts (DayNightSeasons, MoonPhasesLab), recategorize 2 misplaced primitives, and cut 1.

---

## 2. Implementation Status

| Primitive | Action | Status | Notes |
|-----------|--------|--------|-------|
| **PlanetaryExplorer** | NEW — flagship | ❌ | Replaces SolarSystemExplorer, absorbs ScaleComparator + MissionPlanner knowledge |
| **DayNightSeasons** | ADD EVAL MODES | ❌ | Solid concept, just needs questions + tutoring |
| **MoonPhasesLab** | ADD EVAL MODES | ❌ | Same — core concept, needs assessment wiring |
| **ConstellationBuilder** | KEEP | ✅ | Already has 4 eval modes + tutoring |
| **LightShadowLab** | KEEP | ✅ | Already has 4 eval modes + tutoring |
| **RocketBuilder** | MOVE → engineering | ❌ | Re-register in engineering catalog/registry |
| **OrbitMechanicsLab** | MOVE → physics | ❌ | Re-register in physics catalog/registry |
| **SolarSystemExplorer** | REPLACE | ❌ | Superseded by PlanetaryExplorer |
| **ScaleComparator** | CUT (absorbed) | ❌ | Scale comparisons become eval mode in PlanetaryExplorer |
| **MissionPlanner** | CUT (absorbed) | ❌ | Destination knowledge folds into PlanetaryExplorer |
| **TelescopeSimulator** | CUT | ❌ | No pedagogical path forward |

**Final astronomy lineup:** PlanetaryExplorer, DayNightSeasons, MoonPhasesLab, ConstellationBuilder, LightShadowLab

---

## 3. New Primitive: PlanetaryExplorer

### 3.1 Purpose

Guided, Gemini-driven deep-dive through the solar system. Students don't just look at planets — they explore them sequentially with targeted questions at every stop. Gemini chooses which planets to cover based on the lesson topic, so a Venus lesson leads with Venus.

### 3.2 Grade Band

K–8 (expandable to high school with advanced astrophysics questions)

### 3.3 Skills Addressed

- Identify planets by name, appearance, and key properties
- Compare planetary characteristics (size, distance, temperature, atmosphere)
- Understand scale relationships in the solar system
- Apply knowledge to reason about habitability, seasons, and orbital mechanics
- Synthesize information across multiple celestial bodies

### 3.4 Interaction Model — The Guided Journey

The core UX is a **sequential planet deep-dive** with the solar system as the navigation canvas.

| Phase | What Happens | Student Action |
|-------|-------------|----------------|
| **Overview** | Full solar system view. AI introduces the topic. Planet indicators show which will be covered. | Read/listen to introduction. |
| **Planet Focus** | Viewport zooms/transitions to the target planet. Rich info panel appears below with key stats, description, and fun facts. Visual shows the planet prominently with scale reference. | Explore the info panel. Tap stats for AI commentary. |
| **Questions** | 2–3 Gemini-generated questions per planet. Multiple choice, comparison, or short reasoning. Tied to the info just presented. | Answer questions. Get immediate feedback + AI tutoring on mistakes. |
| **Transition** | Brief transition animation. AI bridges to next planet ("Now let's visit a planet that's very different..."). | Click "Next Planet" or auto-advance. |
| **Summary** | Return to system view. PhaseSummaryPanel shows per-planet scores. AI gives personalized feedback. | Review results. |

### 3.5 How Gemini Drives the Lesson

The generator receives the **topic** and **grade level** and decides:

```
Gemini generates:
{
  introduction: string,          // AI's opening about the topic
  planets: [                     // 3-5 planets, ORDER chosen by Gemini
    {
      planetId: "venus",         // which planet
      focusTheme: string,        // "atmosphere and greenhouse effect"
      description: string,       // grade-appropriate paragraph
      keyStats: [...],           // 4-6 stats relevant to the theme
      funFact: string,
      transition: string,        // bridge to next planet
      questions: [
        {
          question: string,
          questionType: "mc" | "compare" | "true-false",
          options: string[],     // 4 options for MC
          correctIndex: number,
          explanation: string,   // shown after answer
          difficulty: "easy" | "medium" | "hard"
        }
      ]
    }
  ],
  celebration: string            // closing message
}
```

**Key design decision:** Gemini picks the planets AND their order. A lesson on "extreme weather in space" might cover Jupiter (Great Red Spot), Venus (acid rain), Neptune (supersonic winds) and skip Mercury entirely. This prevents the forced Mercury→Venus→Earth→... march that kills engagement.

### 3.6 Visual Design

**Solar system canvas** (top 50-60% of viewport):
- Reuse the D3 orbital animation from SolarSystemExplorer
- During Overview: full system view with orbit paths, animated planets
- During Planet Focus: smooth zoom transition to target planet, other planets fade but remain visible for context
- Planet rendered larger with subtle glow effect indicating it's the active focus
- Scale reference indicator (e.g., "Earth shown at 500x actual size") — absorbs ScaleComparator's purpose

**Info panel** (bottom 40-50% of viewport):
- Glass card (`backdrop-blur-xl bg-slate-900/40 border-white/10`)
- Planet name + type badge
- Description paragraph (grade-appropriate, from Gemini)
- Key stats grid (4-6 cards: distance, radius, temperature, moons, etc.)
- Fun fact callout
- Tappable stats trigger AI commentary (like FactFile's keyStats pattern)

**Question overlay:**
- Slides up over the info panel when questions begin
- Shows question, options as buttons
- Correct: green flash + explanation
- Incorrect: amber flash + AI hint + try again (max 2 attempts)

**Progress indicators:**
- Planet dots along the top showing journey progress (filled = visited, current = pulsing, upcoming = dim)
- Per-planet score badges appear after completing each planet's questions

### 3.7 Data Shape

```typescript
export interface PlanetaryExplorerData {
  title: string;
  description: string;

  // Gemini-generated lesson structure
  introduction: string;
  celebration: string;

  planets: PlanetStop[];

  // Visual configuration
  showOrbits?: boolean;          // default true
  showScale?: boolean;           // show scale reference indicators
  animateTransitions?: boolean;  // smooth zoom between planets, default true

  // Grade adaptation
  gradeLevel?: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlanetaryExplorerMetrics>) => void;
}

interface PlanetStop {
  planetId: string;              // "mercury" | "venus" | "earth" | ...
  focusTheme: string;            // what aspect Gemini chose to highlight
  description: string;           // grade-appropriate paragraph
  keyStats: PlanetStat[];        // 4-6 relevant stats
  funFact: string;
  transition: string;            // bridge text to next planet (empty for last)
  questions: PlanetQuestion[];   // 2-3 questions per planet
}

interface PlanetStat {
  label: string;                 // "Distance from Sun"
  value: string;                 // "108.2 million km"
  unit?: string;                 // "km" (for separate rendering)
  comparisonToEarth?: string;    // "0.72x Earth's distance" — scale context
}

interface PlanetQuestion {
  question: string;
  questionType: 'mc' | 'compare' | 'true-false';
  options: string[];             // 4 for MC, 2 for true-false
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}
```

### 3.8 Eval Modes

| Eval Mode | Label | Beta | Scaffolding | Challenge Focus | Description |
|-----------|-------|------|-------------|-----------------|-------------|
| `explore` | Explore (Tier 1) | 1.5 | 1 | Basic recall after reading planet info | "What is Venus's surface temperature?" — answer is in the stats panel |
| `identify` | Identify (Tier 2) | 3.0 | 3 | Identify planets from descriptions | "Which planet has the Great Red Spot?" — requires knowing planet characteristics |
| `compare` | Compare (Tier 3) | 4.5 | 4 | Compare properties across planets | "Which planet is closer to the Sun: Venus or Mars?" — synthesize multiple stats |
| `apply` | Apply (Tier 4) | 6.0 | 6 | Reasoning about why | "Why can't liquid water exist on Venus's surface?" — apply knowledge of temperature/atmosphere |

**How eval modes affect generation:**
- `explore`: Questions reference info visible in the current planet's panel. Recall-level.
- `identify`: Questions describe a planet without naming it. Student picks from options.
- `compare`: Questions span 2+ planets visited. Requires remembering earlier stops.
- `apply`: Open reasoning questions. "Based on what you learned about Mars's atmosphere..."

### 3.9 AI Tutoring Hooks

```
Context keys: [currentPlanet, focusTheme, questionText, studentAnswer, correctAnswer,
               planetsVisited, planetsRemaining, currentScore, attemptNumber]

Scaffolding levels:
  L1: "Look at the stats panel — one of those numbers will help you."
  L2: "The question is about {{focusTheme}}. Check the {{relevantStat}} value for {{currentPlanet}}."
  L3: "{{currentPlanet}}'s {{relevantStat}} is {{value}}. Compare that to {{comparisonValue}} — what does that tell you?"

Pedagogical moments:
  [JOURNEY_START]      — AI introduces the topic and what planets we'll explore
  [PLANET_ARRIVE]      — AI introduces the current planet and its focus theme
  [STAT_TAPPED]        — Student taps a stat, AI gives context/comparison
  [ANSWER_CORRECT]     — Brief congratulation + reinforce the concept
  [ANSWER_INCORRECT]   — Hint without revealing answer, reference visible info
  [PLANET_COMPLETE]    — Summary of what we learned about this planet
  [TRANSITION]         — Bridge to next planet with connection to previous
  [ALL_COMPLETE]       — Celebrate with per-planet feedback and overall score

Common struggles:
  - Confuses distance and size → "Distance is how far from the Sun, size is how big the planet is"
  - Can't find answer in stats → "Look at the blue stat cards below the description"
  - Struggles with comparison questions → "Think back to the previous planet — what was its temperature?"
```

### 3.10 Grade Progression

| Grade | Planets Covered | Question Types | Focus |
|-------|----------------|----------------|-------|
| K | 2–3 (Earth + 1–2 others) | True/false only | "Planets are different sizes and colors" |
| 1 | 3 planets | True/false + easy MC | Inner vs outer, hot vs cold |
| 2 | 3–4 planets | MC (recall) | Planet names, order, basic properties |
| 3 | 4 planets | MC + compare | Size/distance comparisons, moons, rings |
| 4 | 4–5 planets | MC + compare + identify | Identify from descriptions, scale reasoning |
| 5 | 5 planets | All types including apply | Habitability, atmosphere, orbital mechanics basics |
| 6–8 | 5+ including dwarf planets | Heavy on compare + apply | Kepler's laws, greenhouse effect, tidal forces |

### 3.11 What It Absorbs from Cut Primitives

**From SolarSystemExplorer:**
- D3 solar system canvas with orbital animation
- Planet visual data (colors, sizes, orbital parameters)
- Zoom/pan interaction model
- Planet detail panel layout

**From ScaleComparator:**
- `comparisonToEarth` field on every stat ("11x Earth's diameter")
- Scale reference indicators in the viewport
- Familiar object comparisons for younger grades ("Jupiter is as wide as 11 Earths side by side")

**From MissionPlanner:**
- Destination knowledge (travel times, distances in context)
- "How long would it take to get there" as a stat/fun-fact type
- Gravity and atmosphere info that was in destination panels

---

## 4. Eval Mode Upgrades: DayNightSeasons

### 4.1 Current State

Solid interactive model — Earth rotation, axial tilt, seasons, temperature zones, multiple perspectives. Has metrics interface. No eval modes, no tutoring scaffold, no questions.

### 4.2 Proposed Eval Modes

| Eval Mode | Label | Beta | Scaffolding | Description |
|-----------|-------|------|-------------|-------------|
| `observe` | Observe (Tier 1) | 1.5 | 1 | Drag sun/Earth, MC questions about what changes. "When Earth tilts toward the Sun, what season is it?" |
| `predict` | Predict (Tier 2) | 3.0 | 3 | Given a tilt/position, predict the season BEFORE seeing the result. "If Earth is here in its orbit, what season is it in the Northern Hemisphere?" |
| `explain` | Explain (Tier 3) | 4.5 | 4 | Why questions. "Why is it summer in Australia when it's winter in the US?" Targets the #1 misconception (distance vs tilt). |
| `apply` | Apply (Tier 4) | 6.0 | 6 | Transfer reasoning. "A planet with 0° tilt — would it have seasons?" / "What would happen if Earth's tilt were 45°?" |

### 4.3 AI Tutoring Hooks

```
Context keys: [focusMode, currentSeason, hemisphere, tiltAngle, sunPosition,
               locationsExplored, questionText, studentAnswer]

Scaffolding levels:
  L1: "Try moving Earth to a different position in its orbit and watch what happens."
  L2: "Notice which hemisphere is tilted TOWARD the Sun right now — that's the warm one."
  L3: "Earth's axis tilts 23.5°. Right now the {{hemisphere}} hemisphere points toward the Sun,
       so it gets more direct sunlight — that makes it {{currentSeason}}."

Common struggles:
  - "Seasons are because Earth is closer to the Sun" → "Actually Earth is closest to the Sun
    in January (Northern winter)! It's the TILT that matters. Watch what happens when you
    change the tilt to 0°."
  - Confuses hemisphere seasons → "When the North tilts toward the Sun, the South tilts away.
    They always have opposite seasons."
  - Can't connect tilt to sunlight angle → "Drag the surface view — see how the Sun is higher
    in summer? Higher Sun = more direct rays = warmer."
```

### 4.4 Challenge Structure

Gemini generates 6–8 challenges mixing the eval mode types:
- `observe`: 2–3 MC questions tied to manipulating the simulation
- `predict`: 2 prediction questions where student commits answer before seeing result
- `explain`: 1–2 "why" questions with MC options (including the common misconception as a distractor)
- `apply`: 1 transfer question about hypothetical scenarios

---

## 5. Eval Mode Upgrades: MoonPhasesLab

### 5.1 Current State

Interactive Earth-Moon-Sun model with dual view (from Earth + from space). Drag Moon in orbit, see phase change. Has metrics interface. No eval modes, no tutoring scaffold.

### 5.2 Proposed Eval Modes

| Eval Mode | Label | Beta | Scaffolding | Description |
|-----------|-------|------|-------------|-------------|
| `identify` | Identify (Tier 1) | 1.5 | 1 | See a phase shape, pick the name. "This Moon shape is called a ___." |
| `sequence` | Sequence (Tier 2) | 3.0 | 3 | Put 4–5 phases in correct order. "Arrange these phases from New Moon to Full Moon." |
| `position` | Position (Tier 3) | 4.5 | 4 | Given a phase name, place the Moon in the correct orbital position relative to Earth and Sun. |
| `predict` | Predict (Tier 4) | 6.0 | 6 | "If the Moon is at First Quarter tonight, what phase will it be in 1 week?" / "The Moon is between Earth and Sun — what phase is this and why?" |

### 5.3 AI Tutoring Hooks

```
Context keys: [currentPhase, moonPosition, viewMode, illuminationPercent,
               dayInCycle, challengeType, studentAnswer, correctAnswer]

Scaffolding levels:
  L1: "Look at the Moon's shape — is the lit part growing (waxing) or shrinking (waning)?"
  L2: "Switch to space view. See where the Sun is? The lit side of the Moon always faces the Sun."
  L3: "The Moon is at position {{moonPosition}}. The Sun lights the right side from this angle,
       so from Earth we see {{illuminationPercent}}% illuminated — that's a {{currentPhase}}."

Common struggles:
  - "Moon phases are caused by Earth's shadow" → "That's eclipses! Phases happen because we
    see different amounts of the Sun-lit side as the Moon orbits. Switch to space view to see."
  - Can't distinguish waxing/waning → "Waxing = WAXing bigger (growing). The lit part is on
    the RIGHT side when waxing."
  - Confuses quarter with half-lit → "We call it 'quarter' because it's 1/4 of the way through
    the cycle, even though half the visible face is lit."
```

### 5.4 Challenge Structure

Gemini generates 6–8 challenges:
- `identify`: 2–3 visual identification (show phase shape → pick name)
- `sequence`: 1–2 ordering challenges (drag phases into correct sequence)
- `position`: 1–2 orbital placement challenges (drag Moon to correct position)
- `predict`: 1 reasoning challenge (phase prediction over time)

---

## 6. Domain Recategorization

### 6.1 RocketBuilder → Engineering

**Rationale:** RocketBuilder teaches engineering design (thrust-to-weight ratios, staging, fuel efficiency, budgets). It's an engineering primitive — same family as TowerStacker and TransportChallenge.

**Changes required:**
- Move component file: `astronomy/RocketBuilder.tsx` → `engineering/RocketBuilder.tsx`
- Move generator: `service/astronomy/gemini-rocket-builder.ts` → `service/engineering/gemini-rocket-builder.ts`
- Remove from `catalog/astronomy.ts`, add to `catalog/engineering.ts`
- Remove from `generators/astronomyGenerators.ts`, add to `generators/engineeringGenerators.ts`
- Update import in `primitiveRegistry.tsx`
- Update import in tester component

### 6.2 OrbitMechanicsLab → Physics

**Rationale:** Orbit mechanics is applied physics (forces, velocity, acceleration, Kepler's laws). It belongs with InclinedPlane, ProjectileLauncher, and other physics simulations.

**Changes required:** Same pattern as RocketBuilder — move component, generator, catalog entry, and registry entry to physics domain.

---

## 7. Primitives to Remove from Astronomy

### 7.1 TelescopeSimulator — CUT

**Why:** It's a zoom-in SVG viewer. The interaction is "point and zoom" but there's no meaningful assessment. You can't ask "did you zoom in correctly?" The visual simulation doesn't teach telescope optics or observation techniques — it just shows pre-placed objects getting bigger.

**Action:** Remove from astronomy catalog. Component and generator files can remain for potential future repurposing but should not be registered.

### 7.2 ScaleComparator — ABSORBED into PlanetaryExplorer

**Why:** Scale comparisons are powerful pedagogy but need context. "Jupiter is 11x Earth" means more when you're learning about Jupiter, not when you're looking at a standalone comparison widget. The `comparisonToEarth` field on PlanetaryExplorer's stats delivers the same learning in context.

**Action:** Remove from astronomy catalog after PlanetaryExplorer ships. Keep component for reference.

### 7.3 MissionPlanner — ABSORBED into PlanetaryExplorer

**Why:** The pedagogically valuable parts (travel times, distances, destination facts) fold into PlanetaryExplorer's planet info panels. The non-astronomy parts (packing supplies, launch windows) were engineering/logistics, not astronomy.

**Action:** Remove from astronomy catalog after PlanetaryExplorer ships. Keep component for reference.

### 7.4 SolarSystemExplorer — REPLACED by PlanetaryExplorer

**Why:** PlanetaryExplorer reuses the D3 solar system canvas but adds the guided journey, questions, and assessment that SolarSystemExplorer lacks.

**Action:** Remove from astronomy catalog after PlanetaryExplorer ships. D3 rendering code may be reused directly.

---

## 8. Cross-Primitive Learning Paths

After the overhaul, astronomy has 5 primitives with clear pedagogical progression:

```
LightShadowLab (shadows + sun position)
       ↓
DayNightSeasons (Earth rotation + tilt → seasons)
       ↓
MoonPhasesLab (Moon orbit → phases, NOT shadows)
       ↓
PlanetaryExplorer (full solar system knowledge)
       ↓
ConstellationBuilder (night sky patterns + seasons)
```

**Why this order:**
1. Shadows teach "light comes from the Sun" (foundation)
2. Day/night teaches "Earth spins" and tilt teaches seasons (builds on Sun understanding)
3. Moon phases teach orbital geometry (builds on rotation/orbit concepts)
4. Planetary Explorer requires understanding of distance, temperature, atmosphere (synthesizes prior knowledge)
5. Constellations connect sky patterns to seasons (applies seasonal knowledge to observation)

---

## 9. Priority & Sequencing

### Phase 1: Build PlanetaryExplorer (HIGH)
The flagship. Replaces 4 weak primitives with 1 strong one. Full `/primitive` build with eval modes, tutoring, and generator.

### Phase 2: Add Eval Modes to DayNightSeasons + MoonPhasesLab (HIGH)
Use `/add-eval-modes` for each. These are the two strongest existing concepts that just need assessment wiring.

### Phase 3: Recategorize RocketBuilder + OrbitMechanicsLab (MEDIUM)
Mechanical moves — no code changes to the primitives themselves, just registry/catalog/import updates.

### Phase 4: Remove Cut Primitives from Catalog (LOW)
After Phase 1–2 ship, remove TelescopeSimulator, ScaleComparator, MissionPlanner, SolarSystemExplorer from the astronomy catalog. Leave component files in place (they may be useful as reference or for other domains).

---

## 10. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Eval mode coverage | 5/5 astronomy primitives have eval modes | Catalog audit |
| AI tutoring coverage | 5/5 have tutoring scaffolds | Catalog audit |
| Eval-test pass rate | All eval modes pass G1-G5 sync rules | `/eval-test` |
| Question quality | Gemini-generated questions reference visible info, never leak answers | Manual QA |
| Student engagement | PlanetaryExplorer avg session > 3 min | Analytics |
| Assessment signal | Per-planet scores show meaningful variance (not all 100% or all 0%) | Analytics |
| Domain coherence | All 5 primitives teach astronomy, not engineering/physics | Catalog review |

---

## Appendix A: Generator Guidelines for PlanetaryExplorer

**Schema design:**
- Flat fields for per-question data (question0, option0_0, option0_1, etc.) to prevent malformed nested JSON
- Gemini picks planet order — do NOT hardcode Mercury-first
- Each planet stop must have complete stats + questions — reject incomplete stops
- `comparisonToEarth` on every stat enables scale learning without a separate primitive
- Questions must reference info IN the planet's own stats/description (G4 answer derivability)

**Post-validation:**
- Verify each planet has 2–3 questions with valid correctIndex
- Verify options arrays have no duplicates
- Verify correctIndex is within bounds
- Recompute any derived answers from provided data
- Reject planets with fewer than 3 keyStats (not enough info for questions)

**Anti-patterns:**
- Don't generate all 8 planets — Gemini picks 3–5 based on topic
- Don't force planet order — let Gemini decide relevance order
- Don't include "correct answer" text in the question or description (pedagogy rule #1)
- Don't use `?? "Unknown"` for stat values — reject the planet if stats are incomplete

## Appendix B: Planet Visual Data Reference

The component should include hardcoded visual data for all 8 planets + dwarf planets (colors, relative sizes, orbital radii for the D3 canvas). This is rendering data, not educational content — Gemini provides the educational content.

```typescript
const PLANET_VISUALS: Record<string, { color: string; radiusScale: number; orbitRadius: number }> = {
  mercury: { color: '#b5b5b5', radiusScale: 0.38, orbitRadius: 0.39 },
  venus:   { color: '#e8cda0', radiusScale: 0.95, orbitRadius: 0.72 },
  earth:   { color: '#4a90d9', radiusScale: 1.0,  orbitRadius: 1.0  },
  mars:    { color: '#c1440e', radiusScale: 0.53, orbitRadius: 1.52 },
  jupiter: { color: '#c88b3a', radiusScale: 11.2, orbitRadius: 5.2  },
  saturn:  { color: '#e4d191', radiusScale: 9.45, orbitRadius: 9.54 },
  uranus:  { color: '#b2d8d8', radiusScale: 4.0,  orbitRadius: 19.2 },
  neptune: { color: '#5b5ddf', radiusScale: 3.88, orbitRadius: 30.1 },
};
```

## Appendix C: Files Affected

**New files:**
- `primitives/visual-primitives/astronomy/PlanetaryExplorer.tsx`
- `service/astronomy/gemini-planetary-explorer.ts`

**Modified files:**
- `types.ts` — add `'planetary-explorer'` to ComponentId, add type export
- `config/primitiveRegistry.tsx` — add PlanetaryExplorer entry
- `service/manifest/catalog/astronomy.ts` — add PlanetaryExplorer, add eval modes to DayNightSeasons + MoonPhasesLab, remove cut primitives
- `service/registry/generators/astronomyGenerators.ts` — add PlanetaryExplorer generator, remove cut generators
- `evaluation/types.ts` — add PlanetaryExplorerMetrics
- `evaluation/index.ts` — export PlanetaryExplorerMetrics
- `components/AstronomyPrimitivesTester.tsx` — add PlanetaryExplorer, remove cut primitives
- `backend/app/services/calibration/problem_type_registry.py` — add planetary-explorer, day-night-seasons, moon-phases-lab eval mode betas

**Moved files (Phase 3):**
- `astronomy/RocketBuilder.tsx` → `engineering/RocketBuilder.tsx`
- `astronomy/OrbitMechanicsLab.tsx` → `physics/OrbitMechanicsLab.tsx`
- Corresponding generators, catalog entries, and registry entries

**Deregistered (Phase 4):**
- `telescope-simulator` — removed from catalog + registry
- `scale-comparator` — removed from catalog + registry
- `mission-planner` — removed from catalog + registry
- `solar-system-explorer` — removed from catalog + registry
