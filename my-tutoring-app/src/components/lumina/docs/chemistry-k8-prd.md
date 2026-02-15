# K-8 Chemistry Visual Primitives
## Product Requirements Document — Lumina Platform

### Overview

This document defines interactive visual primitives for K-8 chemistry education within the Lumina platform. The original chemistry PRD (57 primitives spanning middle school through AP/undergraduate) was written as a traditional specification — configuration tables, TypeScript interfaces, comprehensive breadth. It predated the platform's multimodal capabilities: AI tutoring scaffolds, Gemini-native content generation, image generation, and the evaluation system. **This PRD replaces it with a Lumina-native K-8 focus**, giving every primitive the full treatment: wonder-driven pedagogy, grade-by-grade learning progressions, four-phase interaction models, Gemini JSON schemas, AI tutoring scaffolds, image generation hooks, and evaluation metrics.

The existing `periodic-table` and `molecule-viewer` primitives provide a strong foundation — the PeriodicTable's glass-morphism aesthetic, category-driven color system, and interactive detail modals define the **Lumina Chemistry visual identity**. Every new primitive extends this design language: deep slate backgrounds, backdrop blur, category glow effects, smooth 300ms transitions, and the 11-color element palette.

**Why K-8?** Chemistry for young learners isn't miniature AP Chemistry. It's the science of *stuff* — what things are made of, why things change, and how to safely explore the world through experimentation. When a kindergartner mixes baking soda and vinegar and watches it erupt in fizzing foam, they're not learning about acid-base neutralization — they're learning that *mixing things can make something totally new happen*. That wonder is the seed of chemistry. Our job is to nurture it from "whoa, it fizzed!" to "the acetic acid reacted with sodium bicarbonate to produce carbon dioxide gas" — across eight years of increasingly precise understanding.

### Design Principles

1. **Kitchen Chemistry First**: The best chemistry for kids starts in the kitchen — baking soda volcanoes, dissolving sugar, melting ice, mixing colors. Every primitive anchors in experiments a child could do (or has done) at home before lifting to abstract models. When a child sees particles in a simulation, they should think "oh, THAT'S why my volcano fizzed!"

2. **Three Levels of Seeing**: Chemistry lives at three scales simultaneously — what you can *see* (macroscopic: the fizzing, the color change, the gas bubble), what you can *imagine* (particulate: molecules colliding, bonds breaking), and what you can *write* (symbolic: H₂O, chemical equations). Every primitive should bridge at least two of these levels. The AI tutor narrates the bridge: "See the bubbles? Those are carbon dioxide molecules escaping!"

3. **Safe Exploration, Bold Curiosity**: Virtual chemistry labs let kids try things that would be dangerous in real life — mix acids and bases freely, heat things to extreme temperatures, combine reactive elements. Every primitive should encourage fearless exploration while modeling safe lab practices. The AI tutor says "Great question! In real life, we'd wear goggles for this. Let's see what happens..."

4. **The PeriodicTable is Home Base**: The existing Periodic Table primitive is the anchor of Lumina Chemistry. Its glass-card aesthetic, category color system (alkali red, noble gas purple, transition metal gold), and interactive detail modals set the visual language for every chemistry primitive. New primitives should feel like they *live inside* the periodic table's world.

5. **Gemini-Native Generation**: Every primitive schema is designed for single-shot Gemini API generation via JSON mode. Experiment setups, reaction scenarios, mystery substance challenges, and safety contexts are all AI-generated from structured prompts with grade-band awareness.

6. **AI Tutoring at Every Moment**: The AI tutor sees what the student is doing in real-time — which substances they've mixed, what temperature they've set, how they've built their molecule — and responds like a real science teacher: celebrating discoveries, asking "what do you think will happen?", catching misconceptions, and narrating the invisible (particle-level) story behind the visible change.

7. **Evaluation Hooks**: Every interactive primitive exposes evaluation metrics that capture student interaction data for the backend evaluation and competency services.

8. **Cross-Primitive Connections**: Chemistry concepts are deeply interconnected. The Periodic Table connects to the Atom Builder connects to the Molecule Constructor connects to the Reaction Lab. Primitives should reference and bridge to related primitives wherever natural.

9. **State Serialization**: All primitives serialize to JSON for problem authoring, student response capture, and session replay.

---

## Design Language: Lumina Chemistry Identity

All chemistry primitives inherit from the PeriodicTable's established visual system:

### Color System

| Context | Pattern | Example |
|---------|---------|---------|
| **Element categories** | 11-color palette from `getCategoryStyle()` | Alkali metals: `#ef4444`, Noble gases: `#a855f7` |
| **Reaction energy** | Warm → Cool gradient | Exothermic: orange/red glow, Endothermic: blue/cyan glow |
| **States of matter** | Phase-specific accents | Solid: `slate-400`, Liquid: `blue-400`, Gas: `cyan-300` |
| **Safety** | Warning hierarchy | Safe: `emerald-400`, Caution: `amber-400`, Danger: `rose-500` |
| **pH scale** | Rainbow gradient | Acid: `rose-500` → Neutral: `emerald-400` → Base: `indigo-500` |

### Glass Morphism

```css
/* Standard chemistry card */
.chem-card {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
}

/* Reaction glow (exothermic) */
.reaction-glow {
  box-shadow: 0 0 30px rgba(251, 146, 60, 0.3);
  transition: box-shadow 300ms ease;
}

/* Element category glow */
.element-glow {
  box-shadow: 0 0 10px ${categoryColor}33;
}
```

### Interaction Patterns

- **300ms transitions** on all hover/state changes
- **Category dimming**: Non-focused elements → `opacity-20 grayscale blur-[1px]`
- **Scale on hover**: Interactive elements → `scale-105` to `scale-125`
- **Modal detail views**: Click-to-expand with `animate-in fade-in duration-200`
- **Particle animations**: 60fps SVG/Canvas for molecular motion
- **Glow feedback**: Successful actions → category-colored glow pulse

---

## Current State

### Existing Chemistry Primitives

| Primitive | Grade Coverage | Has Evaluation | Has AI Scaffold | Interactivity Level | Status |
|-----------|---------------|----------------|-----------------|--------------------|----|
| `periodic-table` | 6-8+ | No | No | **Interactive** — search, category filter, element modal with Bohr model & stability chart | Strong foundation. Upgrade: add evaluation, AI scaffold, grade-band modes |
| `molecule-viewer` | 6-8+ | No | No | **Interactive** — 3D rotating view, atom selection, bond analysis | Good. Upgrade: add evaluation, AI scaffold, building mode |

### Available Multimodal Infrastructure

| Capability | Service | Phase 2 Chemistry Usage |
|-----------|---------|------------------------|
| **AI Tutoring Scaffold** | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech | Context-aware tutoring at every experiment — the AI sees substances mixed, temperatures, states of matter, and responds with progressive scaffolding |
| **Image Generation** | Gemini image generation | Real-world experiment photos, kitchen chemistry setups, nature examples of chemistry |
| **Rich Evaluation** | `usePrimitiveEvaluation` + metrics system | All new primitives + upgraded existing primitives |
| **Animation/Simulation** | Canvas/SVG animation | Particle motion, reaction animations, phase change visualizations, bubbling/fizzing effects |
| **Drag-and-Drop** | React DnD patterns | Mixing substances, building molecules, placing elements |

---

## TRACK 1: New Primitives (12)

---

## DOMAIN 1: Properties of Matter (K-3)

### 1. `matter-explorer` — What Is Stuff Made Of?

**Purpose:** Before children learn about atoms or molecules, they need to understand that everything around them is *matter* — it has mass and takes up space, and it comes in three familiar forms: solids (their desk), liquids (their water bottle), and gases (the air they breathe). This primitive lets students sort, classify, and explore the observable properties of real-world objects and materials. It's the very first step in chemistry: learning to look at stuff carefully.

**Grade Band:** K-2

**Cognitive Operation:** Classification, observation, property identification, comparison

**Multimodal Features:**
- **Visual:** Object gallery with realistic item cards (ice cube, rock, water, juice, balloon, steam). Each object sits on a glass-card with a subtle state-of-matter accent glow: solid items have a cool slate shimmer, liquids have a gentle blue ripple animation, gases have a soft cyan drift. Three sorting bins (Solid / Liquid / Gas) with category-colored borders. Property inspector panel showing observable properties (color, texture, shape, hardness, flexibility). Comparison mode places two objects side-by-side.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which objects are placed in which bins, which properties are being examined, and the student's classification accuracy. Coaches observation: "Look at the ice cube. Can you hold its shape in your hand? Does it keep its own shape? That's a clue!" Guides classification: "You put water in the solid bin — does water keep its own shape, or does it take the shape of its container?" Celebrates: "You found all the gases! They're tricky because you can't always see them."
- **Image Generation:** AI-generated scenes of matter in daily life — kitchen (ice melting, steam from pot, water pouring), playground (puddles, breath on cold day, sand), bathroom (soap, steam, water).
- **Interactive:** Drag objects from gallery to sorting bins. Tap objects to see property cards. "Mystery material" mode — given properties, guess the state. Temperature slider on objects to show state changes (ice → water → steam). Venn diagram mode for materials that are tricky (is toothpaste a solid or liquid?).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Sort objects into solid, liquid, gas. "What does it look like? Can you hold it?" |
| K | Observable properties: color, size, shape, texture. Describe materials |
| 1 | Properties that help classify: keeps shape (solid), takes container shape (liquid), fills all space (gas) |
| 1 | Heating and cooling change states: ice → water → steam. Reversible changes |
| 2 | Measure properties: weight, temperature. Compare materials by properties |
| 2 | Introduction to mixtures: what happens when you mix sand and water? Can you separate them? |

**Interaction Model:**
- Phase 1 (Sort): Drag objects into Solid, Liquid, or Gas bins. The AI celebrates correct sorts and gently redirects mistakes.
- Phase 2 (Describe): Tap an object and identify its properties from a checklist (hard/soft, rough/smooth, shiny/dull, heavy/light).
- Phase 3 (Predict): Given a temperature slider, predict what will happen to ice as it warms. Watch the state change.
- Phase 4 (Mystery): Given only property descriptions ("It takes the shape of its container, you can see through it, it's cold"), identify the material.

**Schema:**
```json
{
  "primitiveType": "matter-explorer",
  "objects": [
    {
      "id": "string",
      "name": "string (e.g., 'Ice Cube')",
      "state": "string (solid | liquid | gas)",
      "properties": {
        "color": "string",
        "texture": "string (smooth | rough | bumpy | soft | hard)",
        "transparency": "string (transparent | translucent | opaque)",
        "flexibility": "string (rigid | flexible | flows)",
        "shape": "string (keeps_shape | takes_container | fills_space)",
        "weight": "string (light | medium | heavy)"
      },
      "imagePrompt": "string (realistic image of the object)",
      "canChangeState": "boolean",
      "stateChangeTemp": "number | null (°C where state changes)"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "type": "string (sort | describe | predict | mystery | compare)",
      "instruction": "string",
      "targetAnswer": "string | string[]",
      "hint": "string",
      "narration": "string (AI tutor context)"
    }
  ],
  "showOptions": {
    "showPropertyPanel": "boolean",
    "showTemperatureSlider": "boolean",
    "showParticleView": "boolean (simplified particle animation for grade 2+)",
    "showVennDiagram": "boolean (for tricky materials)"
  },
  "gradeBand": "K-1 | 1-2"
}
```

**Gemini Generation Notes:** At grade K, use everyday objects kids can see and touch — ice, water, air, rock, milk, balloon. Keep properties simple (hard/soft, wet/dry). At grades 1-2, include trickier materials (honey, sand, steam, fog) and introduce state changes with temperature. The `narration` fields should be wonder-driven: "Hmm, the student put honey in the solid bin. It IS thick... but does it flow? Let's explore!" Always include `imagePrompt` with real-world visuals.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'matter-explorer'`
- `sortingCorrect` / `sortingTotal`
- `propertiesIdentified` / `propertiesTotal`
- `stateChangePredicted` (boolean — correctly predicted what happens with temperature)
- `mysteryMaterialsSolved` / `mysteryTotal`
- `trickyMaterialsExplored` (count — engaged with edge cases like honey, sand)
- `temperatureSliderUsed` (boolean)
- `particleViewEngaged` (boolean)
- `attemptsCount`

---

### 2. `reaction-lab` — The Kitchen Chemistry Experiment Station

**Purpose:** This is the baking-soda-and-vinegar primitive — the heart of K-8 chemistry wonder. A virtual experiment station where students combine real substances and observe what happens: fizzing, color changes, temperature changes, gas production, precipitates. The magic is in the *observation* → *explanation* bridge: students see the macroscopic reaction, then toggle to a particle view to see WHY it happened, then (at higher grades) see the symbolic equation. The AI tutor narrates the invisible: "See those bubbles? Each one is filled with carbon dioxide gas — a brand new substance that wasn't there before!"

**Grade Band:** K-8

**Cognitive Operation:** Observation, prediction, evidence-based reasoning, chemical change vs physical change, conservation of matter

**Multimodal Features:**
- **Visual:** Split-panel lab bench: left side is the "Real View" (realistic glassware with animated reactions — fizzing, color changes, precipitates, gas bubbles, temperature gauge), right side is the "Particle View" (simplified molecular animation showing bonds breaking/forming). Substance shelf with labeled bottles/containers (glass-card style with element-category-colored caps). Observation notebook for recording what happened. Equation bar at top (hidden for K-2, revealed for 3-5, interactive for 6-8). Safety badge in corner showing required PPE.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees substances selected, reaction occurring, student observations, and prediction accuracy. Builds scientific thinking: "Before we mix them — what do you THINK will happen? Make a prediction!" Narrates the invisible: "The vinegar (that's acetic acid) is breaking apart the baking soda molecules. The carbon dioxide gas has nowhere to go — POP! Bubbles!" Distinguishes change types: "The ice melted — but is it still water? That's a physical change. But when we mixed baking soda and vinegar, we got something completely NEW. That's a chemical change!" Models safety: "In a real lab, we'd wear safety goggles for this reaction. The gas is safe, but splashing vinegar in your eyes would sting!"
- **Image Generation:** AI-generated real-world experiment setups — kitchen counter with baking soda and vinegar, rusty nail, tarnished penny, milk and food coloring, elephant toothpaste setup.
- **Interactive:** Drag substances from shelf to beaker/test tube. Pour with drag gesture (tilt bottle). Temperature dial for heating/cooling. Stir with circular gesture. Toggle between Real View and Particle View. Record observations in notebook (structured: "I saw... I heard... I felt... I think..."). Equation builder (grades 6-8) — drag element tiles to balance.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K-1 | Mix and observe. "What happened?" Record with drawings/words. Physical vs chemical: "Is it still the same stuff?" |
| 2-3 | Predict → Observe → Explain cycle. Signs of chemical change (gas, color, temperature, new substance). Conservation: "Nothing disappeared — it just changed form!" |
| 3-5 | Classify reactions by type (mixing, dissolving, burning, rusting). Reversible vs irreversible changes. Introduction to reactants → products language. Particle view toggle |
| 6-8 | Chemical equations. Balancing. Reaction types (synthesis, decomposition, single/double replacement). Conservation of mass with atom counting. Energy changes (exo/endothermic) |

**Interaction Model:**
- Phase 1 (Predict): See the substances. "What do you think will happen when we mix baking soda and vinegar?" Record prediction.
- Phase 2 (Experiment): Mix the substances. Watch the Real View reaction animation (fizzing, color change, temperature change, etc.).
- Phase 3 (Observe): Record observations in the structured notebook. Toggle to Particle View to see what happened at the molecular level.
- Phase 4 (Explain): Answer "Was this a chemical change or physical change? How do you know?" At grades 6-8, write or balance the chemical equation.

**Signature Experiments (Pre-built Scenarios):**

| Experiment | Grade | What Happens | Why Kids Love It |
|-----------|-------|--------------|-----------------|
| **Baking Soda Volcano** | K-3 | NaHCO₃ + CH₃COOH → CO₂ gas + H₂O + NaCH₃COO | Explosive fizzing, overflowing foam |
| **Elephant Toothpaste** | 2-5 | H₂O₂ decomposition with yeast catalyst | Massive foam eruption |
| **Milk & Food Coloring** | K-2 | Soap breaks surface tension, colors swirl | Psychedelic color patterns |
| **Rusting Nail** | 3-5 | 4Fe + 3O₂ → 2Fe₂O₃ (slow time-lapse) | Watching metal "eat" itself |
| **Penny Cleaning** | 2-4 | Cu₂O + CH₃COOH → dissolved copper | Tarnished → shiny in seconds |
| **Invisible Ink (Lemon Juice)** | 2-4 | Citric acid oxidizes when heated | Secret messages appear! |
| **Cabbage pH Indicator** | 3-6 | Anthocyanin color changes with pH | Rainbow of colors from one liquid |
| **Mentos & Soda** | 3-5 | Nucleation sites release dissolved CO₂ | Geyser eruption |
| **Dissolving Candy** | K-2 | Dissolution (physical change) | Skittles rainbow in water |
| **Crystallization** | 3-6 | Supersaturated solution → crystal growth | Grow your own crystals! |
| **Density Column** | 2-5 | Liquids layer by density | Rainbow tower in a glass |
| **Elephant Footprint (Cornstarch)** | K-3 | Non-Newtonian fluid | Solid when you punch it, liquid when you pour it |

**Schema:**
```json
{
  "primitiveType": "reaction-lab",
  "experiment": {
    "name": "string (e.g., 'Baking Soda Volcano')",
    "category": "string (acid_base | decomposition | oxidation | dissolution | physical_change | density | combustion)",
    "safetyLevel": "string (safe | caution | supervised)",
    "realWorldConnection": "string (e.g., 'This is the same reaction that makes cake rise in the oven!')"
  },
  "substances": [
    {
      "id": "string",
      "name": "string (e.g., 'Baking Soda')",
      "formula": "string | null (e.g., 'NaHCO₃' — null for K-2)",
      "state": "string (solid | liquid | gas | solution)",
      "color": "string",
      "safetyInfo": "string (e.g., 'Safe to touch, don't eat large amounts')",
      "imagePrompt": "string",
      "amount": "string (e.g., '2 tablespoons')"
    }
  ],
  "reaction": {
    "type": "string (chemical | physical)",
    "signs": ["string (fizzing | color_change | temperature_change | gas_produced | precipitate | light | odor)"],
    "isReversible": "boolean",
    "equation": "string | null (chemical equation for grades 6-8)",
    "energyChange": "string (exothermic | endothermic | neutral)",
    "particleDescription": "string (what happens at molecular level)"
  },
  "animation": {
    "realView": {
      "duration": "number (seconds)",
      "effects": ["string (bubbles | foam | colorShift | steamRise | precipitate | glow | explosion)"],
      "temperatureChange": "number | null (degrees, positive = hotter)"
    },
    "particleView": {
      "reactantMolecules": ["string (simplified molecule names)"],
      "productMolecules": ["string"],
      "bondBreaking": "boolean",
      "bondForming": "boolean"
    }
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (predict | observe | explain | classify | balance | identify_signs | conservation)",
      "instruction": "string",
      "targetAnswer": "string",
      "hint": "string",
      "narration": "string"
    }
  ],
  "notebook": {
    "predictPrompt": "string (e.g., 'What do you think will happen?')",
    "observePrompts": ["string (I saw... | I heard... | I felt... | The temperature...)"],
    "explainPrompt": "string (e.g., 'Was this a chemical or physical change? What's your evidence?')"
  },
  "showOptions": {
    "showParticleView": "boolean",
    "showEquation": "boolean",
    "showSafetyBadge": "boolean",
    "showTemperatureGauge": "boolean",
    "showObservationNotebook": "boolean",
    "showConservationCounter": "boolean (atom count before/after for grades 6-8)"
  },
  "imagePrompt": "string (real-world experiment setup photo)",
  "gradeBand": "K-2 | 3-5 | 6-8"
}
```

**Gemini Generation Notes:** This is the flagship chemistry primitive — invest heavily in the `narration` fields. At K-2, experiments should be familiar kitchen chemistry with simple observations ("it fizzed!", "it changed color!"). At 3-5, introduce the predict-observe-explain cycle and chemical vs physical change classification. At 6-8, include chemical equations and conservation of mass (count atoms before and after). Always include `realWorldConnection` — kids need to know WHY this matters outside the screen. For the particle view, keep molecules simplified: use colored circles for atoms, springs for bonds, and movement arrows for energy.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'reaction-lab'`
- `predictionMade` (boolean — student made a prediction before experimenting)
- `predictionAccuracy` (how close to actual outcome)
- `observationsRecorded` / `observationPromptsTotal`
- `chemicalVsPhysicalCorrect` / `classificationTotal`
- `signsOfChangeIdentified` / `signsTotal`
- `particleViewEngaged` (boolean — toggled to particle view)
- `equationBalanced` (boolean — grades 6-8)
- `conservationUnderstood` (boolean — correctly identified atoms conserved)
- `experimentsCompleted` / `experimentsTotal`
- `safetyAwarenessShown` (boolean — engaged with safety info)
- `attemptsCount`

---

### 3. `states-of-matter` — Solids, Liquids, Gases & The Particle Dance

**Purpose:** Why does ice melt? Why does water boil? Why can you walk through air but not through a wall? The answer lives at the particle level — and this primitive makes it visible. Students control temperature and watch particles speed up, slow down, break free, or lock into place. The split view shows the macroscopic substance (ice cube, water, steam) alongside its particle model, synchronized in real-time. When a child drags the temperature up and watches ice particles vibrate faster until they break free and start sliding past each other, they *understand* melting — not just memorize it.

**Grade Band:** K-5

**Cognitive Operation:** Particle model of matter, energy transfer, phase transitions, temperature and kinetic energy

**Multimodal Features:**
- **Visual:** Split view: left shows a realistic substance container (beaker with material), right shows the particle simulation (circles with motion trails). Temperature slider along the bottom with state labels (solid range, liquid range, gas range) color-coded. Phase transition markers on the slider (melting point, boiling point) with celebration animations when crossed. Particle behavior: solid = vibrate in place (tight grid), liquid = slide past each other (loose but touching), gas = fly freely (bouncing off walls). Energy indicator showing kinetic energy increasing with temperature.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current temperature, state of matter, particle behavior, and challenge context. Narrates the invisible: "See how the particles are vibrating but staying in their spots? They're holding on tight — that's why ice keeps its shape!" Guides discovery: "Keep raising the temperature... what's happening to the particles? They're starting to slide! The ice is becoming water!" Connects to experience: "Remember when you left your popsicle outside? Same thing happened — the particles got too energetic to stay locked in place."
- **Image Generation:** AI-generated real-world phase change examples (popsicle melting, tea kettle steaming, frost forming, puddle evaporating).
- **Interactive:** Drag temperature slider to control particle speed and state. Tap individual particles to track their path. Toggle between substances (water, wax, iron, chocolate). Zoom in/out on particle view. "Reverse it" — cool it back down and watch particles slow and lock. Pressure control (advanced, grades 6-8). Energy graph showing kinetic energy vs temperature with plateaus during phase changes.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K-1 | Heating makes things melt, cooling makes things freeze. "What happens to ice when it gets warm?" |
| 2-3 | Three states and their particle behavior. Temperature controls the state. Evaporation and condensation in daily life |
| 3-4 | Energy is added/removed during state changes. Melting point and boiling point. The particle model explains why |
| 4-5 | Phase change diagrams (heating curve with plateaus). Conservation of matter during state changes. Energy absorbed/released at transitions. Gas behavior (expand to fill container, compressible) |

**Interaction Model:**
- Phase 1 (Observe): Watch a substance at room temperature. Describe what you see in the particle view.
- Phase 2 (Heat): Slowly raise the temperature. Watch particles speed up. Identify when the phase changes.
- Phase 3 (Cool): Reverse it. Cool the substance back down. Is the process reversible?
- Phase 4 (Explain): "Why does a solid keep its shape but a liquid doesn't?" Use the particle model to explain.

**Schema:**
```json
{
  "primitiveType": "states-of-matter",
  "substance": {
    "name": "string (e.g., 'Water')",
    "formula": "string | null (e.g., 'H₂O')",
    "meltingPoint": "number (°C)",
    "boilingPoint": "number (°C)",
    "currentTemp": "number (starting temperature)",
    "color": {
      "solid": "string",
      "liquid": "string",
      "gas": "string"
    }
  },
  "particleConfig": {
    "count": "number (particles in simulation, 20-60)",
    "size": "string (small | medium | large)",
    "showTrails": "boolean",
    "showBonds": "boolean (dashed lines between solid particles)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (identify_state | predict_change | explain_particles | heating_curve | compare_substances | reversibility)",
      "instruction": "string",
      "targetAnswer": "string",
      "targetTemp": "number | null",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showParticleView": "boolean",
    "showTemperatureSlider": "boolean",
    "showStateLabels": "boolean",
    "showEnergyGraph": "boolean (heating curve)",
    "showPhaseMarkers": "boolean (melting/boiling points on slider)",
    "showParticleSpeed": "boolean (speedometer for average kinetic energy)"
  },
  "substances": [
    "string (available substances: water | wax | iron | chocolate | nitrogen | mercury | butter)"
  ],
  "imagePrompt": "string | null (real-world phase change example)",
  "gradeBand": "K-2 | 3-5"
}
```

**Gemini Generation Notes:** At K-2, use water as the primary substance (most familiar) and focus on ice/water/steam transitions with real-world connections (popsicles, puddles, breath on cold days). At 3-5, include multiple substances with different melting/boiling points and introduce the heating curve graph. The `narration` fields should be visceral: "Feel the particles getting more and more excited... they can't hold still anymore... POP! They break free! That's melting!" Always include `imagePrompt` with daily-life examples of the target phase change.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'states-of-matter'`
- `stateIdentificationCorrect` / `stateTotal`
- `phaseChangeIdentified` (boolean — correctly identified when phase changed)
- `particleModelExplained` (boolean — connected particle behavior to macroscopic property)
- `heatingCurveRead` (boolean — correctly identified plateaus)
- `reversibilityUnderstood` (boolean)
- `substancesExplored` (count)
- `temperatureControlPrecision` (how accurately they targeted specific temperatures)
- `attemptsCount`

---

## DOMAIN 2: Building Blocks of Matter (3-8)

### 4. `atom-builder` — Constructing Atoms from Scratch

**Purpose:** The atom is chemistry's fundamental building block, and this primitive lets students build one from the ground up. Drag protons and neutrons into a nucleus, fill electron shells one at a time, and watch the element identity change as you add particles. The Bohr model visualization (already established by the PeriodicTable's AtomVisualizer) comes alive as a construction tool: "You have 6 protons — that makes it carbon! Now add the electrons to fill the shells." The connection to the Periodic Table is explicit — as students build, the corresponding element highlights on a mini periodic table.

**Grade Band:** 3-8

**Cognitive Operation:** Atomic structure, subatomic particles, electron shells, element identity, ions and isotopes

**Multimodal Features:**
- **Visual:** Central Bohr model workspace (extending the PeriodicTable's AtomVisualizer SVG style — same shell rings, same electron dots, same category-colored nucleus). Particle supply tray at bottom with proton (red, +), neutron (gray, 0), and electron (blue, -) bins. Running tally panel: protons, neutrons, electrons, charge, mass number. Mini periodic table in corner with current element highlighted. Shell capacity indicators (2, 8, 8, 18...). Identity card that updates in real-time ("You built: Carbon-12, charge: 0"). Ion indicator when electrons ≠ protons.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees particle counts, current element, charge, and shell filling. Guides building: "Add one more proton... 7 protons! Look at the periodic table — element number 7 is nitrogen!" Teaches shells: "The first shell can only hold 2 electrons. It's full! The next electrons go in shell 2." Explores ions: "You have 11 protons but only 10 electrons — that's a +1 charge. This is a sodium ION!" Connects to properties: "You built a noble gas — see how its outer shell is completely full? That's why neon doesn't react with anything!"
- **Interactive:** Drag protons/neutrons to nucleus (nucleus grows). Drag electrons to shells (snap to orbital positions, respect capacity). Tap particles to remove. Element identity updates dynamically. Mini periodic table highlights current element. "Build this element" challenges. "Make an ion" challenges. "Make an isotope" challenges.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 3-4 | Atoms are made of smaller parts. Protons (+), neutrons (0), electrons (-). Proton count = element identity |
| 5-6 | Electron shells and filling order. Valence electrons (outer shell). Connection to periodic table groups |
| 6-7 | Ions: what happens when electrons are gained or lost. Isotopes: same protons, different neutrons |
| 7-8 | Electron configuration shorthand. Atomic number vs mass number. Nuclear stability basics |

**Interaction Model:**
- Phase 1 (Build): Drag particles to build a specific element. "Build oxygen (8 protons)."
- Phase 2 (Identify): Given a pre-built atom, identify the element, mass number, and charge.
- Phase 3 (Shell Fill): Focus on electron shells — fill them correctly following capacity rules.
- Phase 4 (Modify): "Start with sodium. Remove one electron. What happened to the charge? You made an ion!"

**Schema:**
```json
{
  "primitiveType": "atom-builder",
  "targetElement": {
    "atomicNumber": "number | null (null for free build)",
    "massNumber": "number | null",
    "charge": "number (0 for neutral, +1 for cation, -1 for anion)",
    "name": "string | null"
  },
  "currentAtom": {
    "protons": "number",
    "neutrons": "number",
    "electrons": "number",
    "shells": "number[] (electrons per shell)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (build_element | identify | fill_shells | make_ion | make_isotope | find_on_table)",
      "instruction": "string",
      "targetProtons": "number | null",
      "targetNeutrons": "number | null",
      "targetElectrons": "number | null",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showMiniPeriodicTable": "boolean",
    "showIdentityCard": "boolean",
    "showShellCapacity": "boolean (2, 8, 8, 18 labels)",
    "showCharge": "boolean",
    "showMassNumber": "boolean",
    "showElectronConfiguration": "boolean (text notation for 7-8)",
    "showNucleusDetail": "boolean (individual protons/neutrons visible)"
  },
  "constraints": {
    "maxProtons": "number (20 for grades 3-5, 36 for 6-8)",
    "maxShells": "number (3 for grades 3-5, 4 for 6-8)",
    "allowIons": "boolean",
    "allowIsotopes": "boolean"
  },
  "imagePrompt": "string | null (real-world connection: neon signs, gold jewelry, oxygen tanks)",
  "gradeBand": "3-5 | 6-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'atom-builder'`
- `elementsBuiltCorrectly` / `elementsTotal`
- `shellsFilledCorrectly` (boolean — respected capacity rules)
- `elementIdentifiedFromAtom` / `identificationTotal`
- `ionsCreatedCorrectly` / `ionsTotal`
- `isotopesCreatedCorrectly` / `isotopesTotal`
- `periodicTableConnectionMade` (boolean — used mini table to find/verify)
- `valenceElectronsIdentified` (boolean)
- `attemptsCount`

---

### 5. `molecule-constructor` — Snapping Atoms Together

**Purpose:** If the Atom Builder teaches what atoms ARE, the Molecule Constructor teaches what atoms DO — they connect. Students snap atoms together to build molecules, discovering that atoms share or transfer electrons to bond. The visual language bridges from the PeriodicTable's element cards to 2D structural formulas: each atom is a circle in its category color (oxygen is cyan, hydrogen is blue, carbon is yellow) with valence "connection points" shown as dots. Kids build water by snapping two hydrogen atoms to an oxygen atom and see H₂O appear.

**Grade Band:** 3-8

**Cognitive Operation:** Chemical bonding, molecular structure, valence, molecular formulas, properties from structure

**Multimodal Features:**
- **Visual:** Building workspace with atom palette (elements as circles in PeriodicTable category colors with valence dots showing available bonds). Connection lines appear when atoms snap together. Completed molecule displays name, formula, and a real-world image. 2D structural view (default) with optional simple 3D rotation. Valence satisfaction indicator (green check when all bonds filled, red dot when bonds available). Molecule gallery showing real-world uses.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees atoms placed, bonds formed, and molecule progress. Guides bonding: "Oxygen has 2 connection points — it needs 2 more atoms to be happy. Can you attach 2 hydrogens?" Celebrates: "H-O-H — you built water! Every drop of water in the ocean has this exact shape." Teaches formulas: "2 hydrogens and 1 oxygen. We write that as H₂O — the little 2 means 'two hydrogen atoms.'" Connects to experience: "You built carbon dioxide — CO₂. That's what you breathe out and what plants breathe in!"
- **Image Generation:** AI-generated real-world images of the molecule in action (water as ocean/rain, CO₂ as bubbles in soda, O₂ as atmosphere, CH₄ as natural gas flame).
- **Interactive:** Drag atoms from palette to workspace. Snap atoms together (connection points glow when compatible). Rotate bonds. Break bonds by pulling apart. Formula display updates live. "Build this molecule" challenges. "What molecule is this?" identification challenges. Gallery of molecules to unlock by building them.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 3-4 | Atoms connect to make molecules. Water (H₂O), oxygen gas (O₂), carbon dioxide (CO₂). Simple formulas |
| 5-6 | Valence and bonding rules. Why oxygen makes 2 bonds but hydrogen only makes 1. Common molecules (CH₄, NH₃, NaCl). Molecular vs ionic |
| 6-7 | Lewis dot basics — see the shared electrons. Single, double, triple bonds. Organic molecules introduction (methane, ethanol) |
| 7-8 | Molecular shape affects properties. Polar vs nonpolar. Why oil and water don't mix (molecular explanation) |

**Interaction Model:**
- Phase 1 (Snap): Free building. Discover which atoms connect and how many bonds each makes.
- Phase 2 (Build): "Build a molecule of methane (CH₄)." Follow instructions with atom counts.
- Phase 3 (Identify): Given a pre-built molecule, name it and write its formula.
- Phase 4 (Predict): "What happens if you replace one hydrogen in methane with an OH group?" Explore molecular families.

**Schema:**
```json
{
  "primitiveType": "molecule-constructor",
  "targetMolecule": {
    "name": "string | null (e.g., 'Water')",
    "formula": "string | null (e.g., 'H₂O')",
    "atoms": [
      {
        "element": "string (e.g., 'O')",
        "count": "number"
      }
    ],
    "bonds": [
      {
        "atom1": "number (index)",
        "atom2": "number (index)",
        "type": "string (single | double | triple)"
      }
    ],
    "realWorldUse": "string (e.g., 'Water — essential for all life!')",
    "imagePrompt": "string"
  },
  "palette": {
    "availableElements": ["string (element symbols available to use)"],
    "showValence": "boolean (show connection point dots)",
    "showElectronDots": "boolean (Lewis dot style for 6-8)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (free_build | build_target | identify | formula_write | predict_bonds | shape_predict)",
      "instruction": "string",
      "targetFormula": "string | null",
      "hint": "string",
      "narration": "string"
    }
  ],
  "moleculeGallery": [
    {
      "name": "string",
      "formula": "string",
      "category": "string (essential | food | atmosphere | energy | household)",
      "unlocked": "boolean",
      "imagePrompt": "string"
    }
  ],
  "showOptions": {
    "showFormula": "boolean",
    "showName": "boolean",
    "showRealWorldImage": "boolean",
    "showValenceSatisfaction": "boolean",
    "show3DToggle": "boolean",
    "showElectronDots": "boolean",
    "showBondType": "boolean"
  },
  "gradeBand": "3-5 | 6-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'molecule-constructor'`
- `moleculesBuiltCorrectly` / `moleculesTotal`
- `bondsFormedCorrectly` / `bondsTotal`
- `formulasWrittenCorrectly` / `formulasTotal`
- `moleculesIdentifiedCorrectly` / `identificationsTotal`
- `valenceRulesFollowed` (boolean — respected bonding capacity)
- `galleryMoleculesUnlocked` (count)
- `bondTypesExplored` (single, double, triple)
- `attemptsCount`

---

### 6. `periodic-table` (UPGRADE) — From Reference to Interactive Learning Tool

**Purpose:** The existing Periodic Table is a beautiful reference tool. This upgrade transforms it into an active learning primitive with grade-band adaptivity, AI tutoring, evaluation metrics, and challenge modes. For grades 3-5, it's a treasure map of elements with fun facts and real-world connections. For grades 6-8, it's a trend-discovery tool where students explore patterns in properties across periods and groups.

**Current State:** Interactive search, category filtering, element modal with Bohr model and stability chart. No evaluation, no AI scaffold, no grade-band modes, no challenges.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Grade-band modes** | Single adult mode | K-2: hidden (too advanced). 3-5: "Element Explorer" — fun facts, real-world images, simplified properties. 6-8: "Trend Detective" — property trends, electron config, groups/periods |
| **AI Tutoring** | None | AI scaffold in catalog. Narrates element discoveries: "Gold is in the transition metals — same group as silver and copper. See the pattern?" |
| **Evaluation** | None | `usePrimitiveEvaluation` with element identification, trend discovery, classification metrics |
| **Challenges** | None | "Find all the noble gases", "Which element has 8 protons?", "Is atomic radius getting bigger or smaller across this period?" |
| **Element of the Day** | None | AI-generated daily element spotlight with fun facts, real-world images, and connection to current learning |
| **Trend visualization** | Category coloring only | Toggle to color by property (atomic radius, electronegativity, melting point) with gradient heat maps |
| **Quiz mode** | None | Given clues, find the element. Timed element identification challenges. |

**New Schema Fields:**
```json
{
  "gradeBand": "string (3-5 | 6-8)",
  "mode": "string (explore | trends | quiz | element_of_day)",
  "challenges": [
    {
      "id": "string",
      "type": "string (find_element | identify_group | trend_direction | property_compare | element_clues)",
      "instruction": "string",
      "targetElements": "number[] (atomic numbers)",
      "targetAnswer": "string",
      "hint": "string",
      "narration": "string"
    }
  ],
  "trendVisualization": {
    "property": "string (atomic_radius | electronegativity | melting_point | ionization_energy)",
    "direction": "string (across_period | down_group)",
    "showGradient": "boolean"
  },
  "elementSpotlight": {
    "atomicNumber": "number",
    "funFact": "string",
    "realWorldUse": "string",
    "imagePrompt": "string"
  }
}
```

**New Evaluation Metrics:**
- `type: 'periodic-table'`
- `elementsIdentified` / `elementsTotal`
- `groupsRecognized` / `groupsTotal`
- `trendsDiscovered` / `trendsTotal` (correctly identified property trends)
- `quizScore` / `quizTotal`
- `elementCluesSolved` / `cluesTotal`
- `categoriesExplored` (count of element categories clicked into)
- `attemptsCount`

---

## DOMAIN 3: Chemical Reactions & Energy (3-8)

### 7. `equation-balancer` — Counting Atoms Like a Detective

**Purpose:** Balancing chemical equations is the first truly *symbolic* chemistry skill — and it's a puzzle. This primitive makes balancing visual and tangible: each side of the equation shows the molecules as colored atom clusters, and a live atom counter tracks each element. Students adjust coefficients and watch the atom counts change until both sides match. The "balance scale" metaphor (extending from the math primitive!) shows the equation tipping until balanced. Conservation of mass becomes obvious: "The same atoms are on both sides — they just rearranged!"

**Grade Band:** 6-8

**Cognitive Operation:** Conservation of mass, symbolic representation, systematic problem solving, coefficient reasoning

**Multimodal Features:**
- **Visual:** Equation display bar at top with adjustable coefficients (tap +/- or drag). Below each formula, a molecule visualization shows the actual atoms as colored circles (using PeriodicTable category colors). Atom counter table on the side with element-by-element tally for reactants and products (matching = green, not matching = red). Balance scale metaphor below the equation (tips to heavy side). Celebration animation when balanced — atoms glow and the scale levels.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current coefficients, atom counts, and which elements are balanced/unbalanced. Guides strategy: "Start with the element that appears in the fewest places. Oxygen only appears in one compound on each side — try balancing oxygen first." Catches errors: "You balanced the hydrogen, but now the oxygen is off again. That happens! Try adjusting the water coefficient." Celebrates: "Every element matches on both sides! Matter is conserved — nothing was created or destroyed, just rearranged."
- **Interactive:** Tap +/- buttons on coefficients. Atom count table updates in real-time. Molecule visualizations scale with coefficients (2H₂O shows two water molecules). Guided mode steps through one element at a time. Free mode lets students adjust any coefficient. History undo for trial-and-error.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 6 | Conservation of mass concept. "Same atoms, new arrangement." Simple equations with visual atom counting (H₂ + O₂ → H₂O) |
| 7 | Systematic balancing with coefficients. Two-element equations, then three-element. Coefficient vs subscript distinction |
| 8 | Complex equations (combustion, double replacement). Balancing strategy (start with most complex molecule). Connection to stoichiometry |

**Interaction Model:**
- Phase 1 (Count): Given a balanced equation, count atoms on each side to verify balance.
- Phase 2 (Spot): Given an unbalanced equation, identify which elements don't match.
- Phase 3 (Balance): Adjust coefficients to balance the equation. Use the atom counter as feedback.
- Phase 4 (Challenge): Balance increasingly complex equations. Timed challenges for mastery.

**Schema:**
```json
{
  "primitiveType": "equation-balancer",
  "equation": {
    "reactants": [
      {
        "formula": "string (e.g., 'H₂')",
        "coefficient": "number (starting value, usually 1)",
        "atoms": { "H": 2 }
      }
    ],
    "products": [
      {
        "formula": "string (e.g., 'H₂O')",
        "coefficient": "number",
        "atoms": { "H": 2, "O": 1 }
      }
    ],
    "arrow": "string (→ | ⇌)"
  },
  "solution": {
    "coefficients": "number[] (correct coefficients in order)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (count_atoms | spot_imbalance | balance | complex_balance | timed)",
      "instruction": "string",
      "equation": "string (e.g., 'H₂ + O₂ → H₂O')",
      "difficulty": "string (simple | moderate | complex)",
      "timeLimit": "number | null (seconds for timed mode)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showAtomCounter": "boolean",
    "showMoleculeVisual": "boolean (atom circles for each molecule)",
    "showBalanceScale": "boolean",
    "showGuided": "boolean (step through one element at a time)",
    "showHistory": "boolean (undo/redo for trial and error)",
    "maxCoefficient": "number (limit for easier puzzles, e.g., 4)"
  },
  "gradeBand": "6-7 | 7-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'equation-balancer'`
- `equationsBalanced` / `equationsTotal`
- `atomCountingCorrect` / `countingTotal`
- `averageAttemptsPerEquation`
- `usedGuidedMode` (boolean)
- `strategyUsed` (string — started with complex molecule, fewest appearances, etc.)
- `coefficientVsSubscriptConfusion` (boolean — attempted to change subscripts)
- `conservationArticulated` (boolean — explained why balancing matters)
- `attemptsCount`

---

### 8. `energy-of-reactions` — Why Does It Get Hot (or Cold)?

**Purpose:** Every chemical reaction either releases energy (exothermic — the baking soda volcano gets warm!) or absorbs energy (endothermic — instant cold packs get cold!). This primitive makes energy changes visible through animated enthalpy diagrams, temperature gauges, and the particle-level story of bond breaking (costs energy) and bond forming (releases energy). Students discover that whether a reaction heats up or cools down depends on the balance between these two processes.

**Grade Band:** 5-8

**Cognitive Operation:** Energy conservation, exothermic/endothermic classification, activation energy, bond energy concepts

**Multimodal Features:**
- **Visual:** Enthalpy diagram (energy level plot with reactants, activation energy hill, and products). Animated reaction pathway — a "ball" rolls along the energy curve. Temperature gauge showing heat change. Particle view showing bonds breaking (energy cost, red arrows) and forming (energy release, blue arrows). Net energy calculation. Real-world connection panel. Glow effects: exothermic reactions glow warm orange/red, endothermic glow cool blue/cyan.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees reaction type, energy diagram state, and student understanding. Connects to experience: "Remember the volcano experiment? It felt warm — that's because the reaction released energy. We call that exothermic — 'exo' means out!" Explains diagrams: "The products are LOWER on the energy diagram than the reactants. That means energy came OUT — like rolling downhill." Introduces activation energy: "Every reaction needs a little push to get started — like lighting a match. That push is the activation energy."
- **Interactive:** Toggle between real-world experiment view and energy diagram. Drag the reaction "ball" along the energy curve. Adjust activation energy to see how catalysts work. Compare exothermic and endothermic reactions side-by-side. Temperature slider to explore how heat affects reaction rates.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 5 | Some reactions release heat (hand warmers, burning), some absorb heat (cold packs, photosynthesis). Classify by touch |
| 6 | Energy diagrams: reactants above products = exothermic, below = endothermic. ΔH concept |
| 7 | Activation energy — why reactions need a "push" to start. Catalysts lower the hill. Bond energy: breaking costs, forming releases |
| 8 | Calculating energy changes from bond energies. Conservation of energy in reactions. Connection to thermodynamics |

**Interaction Model:**
- Phase 1 (Feel): Experience reactions with temperature gauge. "This one got HOT. This one got COLD. Sort them."
- Phase 2 (Diagram): Read energy diagrams. "Are the products higher or lower? What does that mean?"
- Phase 3 (Explain): "Why does burning wood release heat? Draw an energy diagram for it."
- Phase 4 (Calculate): Use bond energies to predict whether a reaction will be exo- or endothermic.

**Schema:**
```json
{
  "primitiveType": "energy-of-reactions",
  "reaction": {
    "name": "string (e.g., 'Combustion of Methane')",
    "equation": "string (e.g., 'CH₄ + 2O₂ → CO₂ + 2H₂O')",
    "type": "string (exothermic | endothermic)",
    "deltaH": "number (kJ, negative for exo, positive for endo)",
    "activationEnergy": "number (kJ)",
    "realWorldExample": "string (e.g., 'Natural gas stove burner')",
    "imagePrompt": "string"
  },
  "energyDiagram": {
    "reactantLevel": "number (arbitrary energy units)",
    "productLevel": "number",
    "activationPeak": "number",
    "showCatalystPath": "boolean",
    "catalystActivation": "number | null"
  },
  "bondEnergies": {
    "enabled": "boolean (for grades 7-8)",
    "bondsBreaking": [
      { "bond": "string (e.g., 'C-H')", "energy": "number (kJ)", "count": "number" }
    ],
    "bondsForming": [
      { "bond": "string", "energy": "number", "count": "number" }
    ]
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (classify | read_diagram | draw_diagram | catalyst_effect | calculate_deltaH | predict)",
      "instruction": "string",
      "targetAnswer": "string | number",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showEnergyDiagram": "boolean",
    "showTemperatureGauge": "boolean",
    "showBondView": "boolean",
    "showRealWorldPanel": "boolean",
    "showCalculation": "boolean",
    "showCatalystComparison": "boolean",
    "animateReactionPath": "boolean"
  },
  "gradeBand": "5-6 | 7-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'energy-of-reactions'`
- `classificationCorrect` / `classificationTotal` (exo vs endo)
- `diagramReadCorrect` / `diagramTotal`
- `activationEnergyUnderstood` (boolean)
- `catalystEffectExplained` (boolean)
- `bondEnergyCalculationCorrect` / `calculationTotal`
- `realWorldConnectionMade` (boolean — linked diagram to observable temperature change)
- `attemptsCount`

---

## DOMAIN 4: Solutions, Acids & Bases (3-8)

### 9. `mixing-and-dissolving` — What Happens When Things Mix?

**Purpose:** Stirring sugar into water is one of the most common chemistry experiences — and one of the most mysterious. Where did the sugar GO? This primitive explores solutions, mixtures, and the dissolving process at both the macroscopic and particle level. Students add solutes to solvents, stir, heat, and observe: some things dissolve (sugar, salt), some don't (sand, oil). The particle view reveals the truth — water molecules surround and pull apart the sugar crystal, molecule by molecule.

**Grade Band:** 3-7

**Cognitive Operation:** Dissolving, solutions vs mixtures, saturation, factors affecting solubility, separation techniques

**Multimodal Features:**
- **Visual:** Beaker workspace with liquid (water by default). Substance shelf with solids, liquids, and powders to add. Stirring rod animation. Particle view toggle showing solvent molecules (blue) surrounding solute particles (colored by substance). Concentration indicator (color intensity of solution). Temperature control. Saturation indicator — when the solution can't dissolve any more, undissolved solid settles. Separation tools panel (filter, evaporate, magnet, decant).
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees substance added, dissolving state, temperature, and concentration. Narrates dissolving: "Watch the sugar disappear! But it's not really gone — toggle the particle view. See? The water molecules surrounded each sugar molecule and pulled it into the solution." Guides saturation: "You've added a LOT of salt. See how some is sitting at the bottom? The water can't hold any more — it's saturated!" Teaches separation: "The sugar is dissolved in the water. How could you get it back? What if you evaporated the water?"
- **Image Generation:** AI-generated real-world dissolving examples (making lemonade, ocean salt, rock candy growing, water purification, hot chocolate).
- **Interactive:** Drag substances into beaker. Stir with circular gesture. Temperature slider (warm water dissolves more solid, less gas). Add more solute until saturation. Toggle particle view. Choose separation method and observe. Concentration meter. "Can you get it back?" challenge.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 3 | Some things dissolve, some don't. Where did the sugar go? It's still there — prove it (taste/evaporate) |
| 4 | Mixtures vs solutions. Mixtures can be separated by physical means (filtering sand from water). Solutions are harder |
| 5 | Factors affecting dissolving: stirring, temperature, particle size. Saturation — there's a limit |
| 6-7 | Concentration (qualitative → quantitative). Solubility curves. Separation techniques (evaporation, filtration, distillation, chromatography) |

**Interaction Model:**
- Phase 1 (Mix): Add different substances to water. Observe: does it dissolve? Sort into "dissolves" and "doesn't dissolve."
- Phase 2 (Investigate): Toggle particle view. See what dissolving looks like at the molecular level.
- Phase 3 (Experiment): Test factors — does stirring help? Does warm water dissolve more? Does crushing the solid help?
- Phase 4 (Recover): The sugar dissolved. Can you get it back? Choose a separation technique and prove the solute is still there.

**Schema:**
```json
{
  "primitiveType": "mixing-and-dissolving",
  "solvent": {
    "name": "string (e.g., 'Water')",
    "formula": "string (e.g., 'H₂O')",
    "volume": "number (mL)",
    "temperature": "number (°C)"
  },
  "substances": [
    {
      "id": "string",
      "name": "string (e.g., 'Sugar')",
      "formula": "string | null",
      "type": "string (soluble | insoluble | partially_soluble | immiscible_liquid)",
      "maxSolubility": "number | null (g per 100mL at current temp)",
      "solubilityVsTemp": "string (increases | decreases | unchanged)",
      "color": "string",
      "particleColor": "string",
      "imagePrompt": "string"
    }
  ],
  "separationMethods": [
    {
      "method": "string (filtration | evaporation | distillation | chromatography | magnet | decanting)",
      "worksFor": ["string (substance names this method separates)"],
      "description": "string",
      "animation": "string"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "type": "string (dissolve_sort | particle_explain | factor_test | saturation | separate | concentration)",
      "instruction": "string",
      "targetAnswer": "string",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showParticleView": "boolean",
    "showConcentrationMeter": "boolean",
    "showTemperatureControl": "boolean",
    "showSaturationIndicator": "boolean",
    "showSeparationTools": "boolean",
    "showSolubilityCurve": "boolean (grade 6-7)"
  },
  "imagePrompt": "string | null (real-world context: making lemonade, ocean, hot cocoa)",
  "gradeBand": "3-5 | 6-7"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'mixing-and-dissolving'`
- `dissolveSortCorrect` / `sortTotal`
- `particleExplanationGiven` (boolean — explained dissolving using particle model)
- `factorsTestedCorrectly` / `factorsTotal`
- `saturationIdentified` (boolean)
- `separationMethodCorrect` / `separationTotal`
- `substanceRecovered` (boolean — proved solute was still present)
- `concentrationEstimateAccuracy`
- `attemptsCount`

---

### 10. `ph-explorer` — The Acid-Base Rainbow

**Purpose:** Acids and bases are everywhere — lemon juice, soap, stomach acid, baking soda — and the pH scale is how we measure them. This primitive brings pH to life with a colorful, interactive scale, virtual indicator testing, and the spectacular color chemistry of natural pH indicators (red cabbage juice changes to a rainbow of colors!). Students test household substances, predict their pH, and discover the acid-base spectrum through color.

**Grade Band:** 4-8

**Cognitive Operation:** Acid/base classification, pH scale reading, neutralization, indicator color interpretation

**Multimodal Features:**
- **Visual:** Large pH scale (0-14) with rainbow gradient coloring (red at 0, green at 7, purple at 14). Substance cards positioned on the scale at their pH values. Test tube workspace where students add indicator drops (litmus, cabbage juice, universal indicator) and see color changes. Neutralization station: mix acid + base and watch pH move toward 7. Particle view showing H⁺ concentration changing. Real-world substance gallery with pH values.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees tested substances, indicator colors, and pH understanding. Teaches the scale: "Lemon juice has pH 2 — that's very acidic! See how the indicator turned red? Low pH means lots of acid." Guides neutralization: "You're adding baking soda to the vinegar. Watch the pH... it's going up! The base is neutralizing the acid." Connects to life: "Your stomach uses hydrochloric acid (pH 1-2) to break down food. That antacid tablet? It's a base that neutralizes stomach acid!"
- **Image Generation:** AI-generated images of real-world acids and bases (citrus fruits, cleaning products, swimming pool, antacid tablets), cabbage juice rainbow, indicator color charts.
- **Interactive:** Drag substances to the pH scale to guess their position. Add indicator drops to test tubes and observe color changes. Mix acid + base in neutralization station with real-time pH meter. Cabbage juice rainbow mode — test 10+ substances and create a color spectrum. "Design a buffer" challenge for grade 8.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 4 | Acids taste sour, bases taste bitter/feel slippery. Sort household items into acid/base/neutral |
| 5 | pH scale 0-14. Acids < 7, neutral = 7, bases > 7. Test with litmus paper (red/blue) |
| 6 | Indicators change color based on pH. Cabbage juice rainbow. Strong vs weak acids/bases |
| 7 | Neutralization: acid + base → salt + water. pH changes during neutralization |
| 8 | H⁺ and OH⁻ concentration. Logarithmic nature of pH scale. Dilution effects. Buffer introduction |

**Interaction Model:**
- Phase 1 (Sort): Given household substances, sort into acid, base, or neutral based on properties.
- Phase 2 (Test): Use indicators to find pH. Observe color changes and place substances on the scale.
- Phase 3 (Neutralize): Mix an acid and a base. Watch the pH change. Find the neutralization point.
- Phase 4 (Rainbow): Test many substances with cabbage juice indicator. Create a pH rainbow and identify the pattern.

**Schema:**
```json
{
  "primitiveType": "ph-explorer",
  "substances": [
    {
      "id": "string",
      "name": "string (e.g., 'Lemon Juice')",
      "pH": "number (0-14)",
      "type": "string (acid | base | neutral)",
      "strength": "string (strong | weak)",
      "category": "string (food | cleaning | body | nature | lab)",
      "indicatorColors": {
        "litmus": "string (red | blue)",
        "cabbageJuice": "string (red | pink | purple | blue | green | yellow)",
        "universal": "string (color name)"
      },
      "realWorldInfo": "string",
      "imagePrompt": "string"
    }
  ],
  "indicators": [
    {
      "name": "string (litmus | cabbage_juice | universal | phenolphthalein)",
      "colorRange": "object (pH → color mapping)"
    }
  ],
  "neutralization": {
    "enabled": "boolean",
    "acid": "string (substance id)",
    "base": "string (substance id)",
    "showpHMeter": "boolean",
    "showParticleView": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (sort | test | place_on_scale | neutralize | identify_from_color | rainbow | predict_pH)",
      "instruction": "string",
      "targetAnswer": "string | number",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showPHScale": "boolean",
    "showIndicators": "boolean",
    "showNeutralization": "boolean",
    "showParticleView": "boolean (H⁺/OH⁻ concentration)",
    "showRealWorldImages": "boolean",
    "showConcentration": "boolean (for grade 8)"
  },
  "imagePrompt": "string | null (cabbage juice rainbow, pH testing scene)",
  "gradeBand": "4-6 | 7-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'ph-explorer'`
- `sortingCorrect` / `sortingTotal` (acid/base/neutral)
- `pHEstimateAccuracy` (average difference from actual pH)
- `indicatorColorInterpreted` / `interpretationsTotal`
- `neutralizationCompleted` (boolean)
- `neutralizationPointFound` (boolean — identified pH 7)
- `rainbowCreated` (boolean — tested 6+ substances with cabbage juice)
- `substancesExplored` (count)
- `attemptsCount`

---

## DOMAIN 5: Periodic Table & Element Properties (5-8)

### 11. `element-quest` — Element Investigation Missions

**Purpose:** The Periodic Table becomes most powerful when students use it to *answer questions* — not just look up facts. This primitive sends students on investigation missions: "Find the lightest noble gas," "Which metal in period 4 has the highest melting point?," "Arrange these elements by atomic radius." Each quest requires students to navigate the periodic table, read property data, compare elements, and draw conclusions. It transforms the periodic table from a reference poster into a problem-solving tool.

**Grade Band:** 5-8

**Cognitive Operation:** Data reading, comparison, trend analysis, periodic law application, evidence-based reasoning

**Multimodal Features:**
- **Visual:** Full periodic table (linked to existing `periodic-table` primitive) with quest overlay — highlighted search zone, comparison panels, and answer submission area. Quest briefing card (glass-card style) with the mission description and clues. Evidence board where students pin elements they've investigated. Trend arrows overlaying the table when students discover patterns. Leaderboard for quest completion (gamification).
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which elements the student has investigated, what properties they've compared, and their progress toward the answer. Guides exploration: "Good start — you found argon. But is it the LIGHTEST noble gas? Check the one above it in the same group." Teaches strategy: "For periodic trends, try comparing elements in the same group first, then the same period. Do you see a pattern?" Celebrates discovery: "You found it! Atomic radius INCREASES down a group because each period adds a new electron shell."
- **Interactive:** Click elements on the table to add to comparison board. Side-by-side property comparison cards. Drag elements to arrange by property. Draw trend arrows on the table. Submit answers with evidence. Quest log tracking completed missions.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 5 | Element scavenger hunts: "Find all the gases at room temperature," "Which elements are in your body?" |
| 6 | Property-based quests: "Which is heavier: gold or platinum?," "Find the element with the most electrons" |
| 7 | Trend discovery: "Does atomic radius get bigger or smaller across a period? Find evidence." Group/period patterns |
| 8 | Complex investigations: "Predict properties of an unknown element in group 14, period 5." Electronegativity, ionization energy trends |

**Interaction Model:**
- Phase 1 (Hunt): Simple find-the-element quests using names, symbols, or basic properties.
- Phase 2 (Compare): Select elements and compare specific properties. "Which has a higher melting point?"
- Phase 3 (Trend): Investigate a row or column. Discover the pattern. Draw the trend arrow.
- Phase 4 (Predict): Use discovered trends to predict properties of elements you haven't looked up.

**Schema:**
```json
{
  "primitiveType": "element-quest",
  "quest": {
    "id": "string",
    "title": "string (e.g., 'The Noble Gas Mystery')",
    "briefing": "string (mission description)",
    "category": "string (scavenger_hunt | property_compare | trend_discovery | prediction | mystery_element)",
    "difficulty": "string (beginner | intermediate | advanced)",
    "clues": [
      {
        "text": "string",
        "revealsAfter": "string (immediately | first_attempt | hint_requested)"
      }
    ]
  },
  "targetElements": "number[] (atomic numbers of correct answers)",
  "targetAnswer": "string | number (for non-element answers like trend directions)",
  "comparisonProperties": ["string (atomic_mass | atomic_radius | electronegativity | melting_point | boiling_point | density | ionization_energy | electron_affinity)"],
  "challenges": [
    {
      "id": "string",
      "type": "string (find | compare | arrange | trend | predict | mystery)",
      "instruction": "string",
      "hint": "string",
      "narration": "string"
    }
  ],
  "gamification": {
    "questsCompleted": "number",
    "totalQuests": "number",
    "badges": ["string (Trend Detective | Element Master | Noble Gas Expert)"]
  },
  "showOptions": {
    "showComparisonPanel": "boolean",
    "showTrendArrows": "boolean",
    "showEvidenceBoard": "boolean",
    "showHints": "boolean",
    "showBadges": "boolean"
  },
  "gradeBand": "5-6 | 7-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'element-quest'`
- `questsCompleted` / `questsTotal`
- `elementsCorrectlyIdentified` / `elementsTotal`
- `trendsDiscovered` / `trendsTotal`
- `predictionsCorrect` / `predictionsTotal`
- `hintsUsed` (count — fewer is better)
- `comparisonsMade` (count — shows thoroughness)
- `evidenceCited` (boolean — supported answer with data)
- `attemptsCount`

---

## DOMAIN 6: Lab Safety & Scientific Method (K-8)

### 12. `safety-lab` — Lab Safety Training & Virtual PPE

**Purpose:** Before any chemistry happens — real or virtual — students need to understand safety. This primitive gamifies lab safety training: identify hazards in a lab scene, select correct PPE (goggles, gloves, apron), learn safety symbols, and practice emergency procedures. It's the safety training that every science teacher wishes they had time for, delivered through interactive scenarios that kids actually engage with. Every other chemistry primitive references back to this one.

**Grade Band:** K-8 (adapted by grade)

**Cognitive Operation:** Hazard identification, safety protocol, risk assessment, emergency response

**Multimodal Features:**
- **Visual:** Interactive lab scene (glass-card styled) with identifiable hazards (spilled liquid, broken glass, unlabeled bottles, flames near paper). PPE station with draggable equipment (safety goggles, gloves, lab coat, apron, face shield). GHS hazard symbols display with explanations. Emergency station signs (eye wash, fire extinguisher, shower, exit). Safety quiz cards. "Spot the hazard" game with timer.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees hazards identified, PPE selected, and safety quiz answers. Models good practice: "Before we start ANY experiment, what's the first thing we do? Put on our safety goggles!" Teaches symbols: "That skull and crossbones means the chemical is toxic — that means poisonous. Never taste, touch, or breathe it without protection." Praises awareness: "Great catch! You noticed the open flame near the paper towels. That's a fire hazard. What should we do?"
- **Image Generation:** AI-generated lab scenes with varying levels of safety (well-organized lab vs messy lab with hazards), PPE equipment, safety symbol posters.
- **Interactive:** Drag PPE onto character avatar. Tap hazards in lab scene to identify them. Match safety symbols to their meanings. Emergency response sequence (what do you do if chemicals splash in your eyes? — drag steps in order). "Design a safe lab" mode where students arrange equipment properly.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K-2 | Basic safety: don't touch/taste chemicals, wear goggles, wash hands. "Science is fun AND safe!" |
| 3-4 | Lab equipment names and safe handling. Identify 5 basic hazards. PPE selection for simple experiments |
| 5-6 | GHS hazard symbols. Emergency procedures (eye wash, fire extinguisher). SDS basics. Chemical storage |
| 7-8 | Full lab safety protocol. Risk assessment for experiments. Proper disposal. First aid for chemical exposure |

**Interaction Model:**
- Phase 1 (Equip): Select the right PPE for a given experiment. "We're mixing acids today — what do you need?"
- Phase 2 (Spot): Find all hazards in a lab scene. Tap each one and explain why it's dangerous.
- Phase 3 (Respond): Emergency scenario — "Chemical splashed in your eyes. Put the steps in order."
- Phase 4 (Design): Set up a lab workspace safely. Place equipment, chemicals, and safety stations in the right positions.

**Schema:**
```json
{
  "primitiveType": "safety-lab",
  "scenario": {
    "name": "string (e.g., 'Acid-Base Mixing Day')",
    "experiment": "string (what students are preparing for)",
    "hazards": [
      {
        "id": "string",
        "type": "string (fire | chemical | glass | electrical | biological | slip)",
        "description": "string",
        "location": { "x": "number", "y": "number" },
        "severity": "string (low | medium | high)",
        "correction": "string (what should be done)"
      }
    ],
    "requiredPPE": ["string (goggles | gloves | apron | lab_coat | face_shield | closed_shoes)"],
    "safetyEquipment": ["string (eye_wash | fire_extinguisher | shower | first_aid | fume_hood)"]
  },
  "ghsSymbols": [
    {
      "symbol": "string (flame | skull | corrosion | exclamation | health_hazard | environment | oxidizer | gas_cylinder | explosive)",
      "meaning": "string",
      "examples": ["string (chemicals that have this label)"]
    }
  ],
  "emergencySequence": {
    "scenario": "string (e.g., 'Chemical splash in eyes')",
    "correctOrder": ["string (steps in correct order)"]
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (equip_ppe | spot_hazard | match_symbols | emergency_response | design_lab | safety_quiz)",
      "instruction": "string",
      "targetAnswer": "string | string[]",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showLabScene": "boolean",
    "showPPEStation": "boolean",
    "showGHSSymbols": "boolean",
    "showEmergencyStations": "boolean",
    "showTimer": "boolean (for spot-the-hazard game)"
  },
  "imagePrompt": "string | null (lab safety scene)",
  "gradeBand": "K-2 | 3-5 | 6-8"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'safety-lab'`
- `ppeSelectedCorrectly` / `ppeTotal`
- `hazardsIdentified` / `hazardsTotal`
- `symbolsMatchedCorrectly` / `symbolsTotal`
- `emergencySequenceCorrect` (boolean)
- `labDesignSafe` (boolean)
- `safetyQuizScore` / `quizTotal`
- `responseTime` (average time to identify hazards)
- `attemptsCount`

---

## TRACK 2: Existing Primitive Upgrades (2)

### Upgrade 1: `periodic-table` → Full Evaluation + AI Scaffold + Grade Bands

See Primitive #6 above (Domain 2) for complete upgrade specification.

### Upgrade 2: `molecule-viewer` → Building Mode + Evaluation + AI Scaffold

**Current State:** 3D rotating molecular viewer with atom selection and bond analysis. Display-only (no building).

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **AI Tutoring** | None | AI scaffold in catalog. Narrates structure: "This is a tetrahedral shape — the 4 bonds push as far apart as possible, like 4 balloons tied together." |
| **Evaluation** | None | `usePrimitiveEvaluation` with structure identification, property prediction metrics |
| **Building mode** | View only | Add atoms and bonds in 3D space. Validate structure against chemistry rules |
| **Grade-band modes** | Single mode | 3-5: simplified molecules with labels. 6-8: full structural detail, measurements |
| **Property panel** | Basic info | Polarity indicator, molecular weight, state at room temperature, real-world uses |

---

## Technical Requirements

### State Management

All new primitives must implement the standard `PrimitiveState` interface and integrate with the manifest/catalog system.

### Simulation Requirements

| Capability | Used By | Complexity |
|---|---|---|
| **Particle simulation** | `states-of-matter`, `mixing-and-dissolving`, `reaction-lab` | Medium — 20-60 particles with collision, speed control, bonding behavior |
| **Reaction animation** | `reaction-lab`, `energy-of-reactions` | Medium — fizzing bubbles, color transitions, precipitate formation, foam |
| **Bohr model builder** | `atom-builder` | Low — extends existing AtomVisualizer with drag-to-add |
| **Molecule snap** | `molecule-constructor` | Medium — 2D atom placement with bond snapping and valence validation |
| **pH color mapping** | `ph-explorer` | Low — color interpolation on pH scale, indicator color lookup |
| **Energy diagram** | `energy-of-reactions` | Low — SVG curve with animated ball rolling along path |
| **Lab scene** | `safety-lab` | Low — static scene with clickable hotspots |

Performance targets:
- Initial render: < 100ms
- Particle simulation: 60fps with up to 60 particles
- State update: < 16ms (60fps interactions)
- Reaction animations: 60fps for bubbling, color change, foam
- Serialization: < 50ms
- Maximum bundle size per primitive: 60KB gzipped

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions (including chemical formulas read correctly: "H-two-O" not "H-2-O")
- High contrast mode
- Color-blind safe palettes (pH scale must have non-color-only indicators)
- Reduced motion mode (step-by-step instead of particle animations)
- Touch and pointer input (drag-and-drop with touch alternatives)
- Minimum touch target size (44x44px)

### Data Requirements

- Periodic table data (already exists in `chemistry-primitives/constants.ts` — 118 elements with full properties)
- Reaction database: ~50 pre-built reaction scenarios with real-world connections
- pH values for ~30 common household substances
- Molecule library: ~50 common molecules with atom coordinates and bond data
- GHS hazard symbol set
- Safety scenario library

---

## Catalog & Domain Structure

### Updated Catalog: Chemistry joins the SCIENCE_CATALOG

All 12 new primitives (10 new + 2 upgraded) are added to the existing `SCIENCE_CATALOG` in `catalog/science.ts`.

**New entries:**

| Domain | New Primitives |
|---|---|
| Properties of Matter (K-3) | `matter-explorer`, `reaction-lab`, `states-of-matter` |
| Building Blocks (3-8) | `atom-builder`, `molecule-constructor`, `periodic-table` (upgrade) |
| Reactions & Energy (3-8) | `equation-balancer`, `energy-of-reactions` |
| Solutions & Acids/Bases (3-8) | `mixing-and-dissolving`, `ph-explorer` |
| Periodic Table & Elements (5-8) | `element-quest` |
| Lab Safety (K-8) | `safety-lab` |

### Generator Files

New directory: `service/chemistry/` (extends existing `gemini-chemistry.ts`)

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `matter-explorer` | `primitives/visual-primitives/chemistry/MatterExplorer.tsx` | `service/chemistry/gemini-matter-explorer.ts` |
| 2 | `reaction-lab` | `primitives/visual-primitives/chemistry/ReactionLab.tsx` | `service/chemistry/gemini-reaction-lab.ts` |
| 3 | `states-of-matter` | `primitives/visual-primitives/chemistry/StatesOfMatter.tsx` | `service/chemistry/gemini-states-of-matter.ts` |
| 4 | `atom-builder` | `primitives/visual-primitives/chemistry/AtomBuilder.tsx` | `service/chemistry/gemini-atom-builder.ts` |
| 5 | `molecule-constructor` | `primitives/visual-primitives/chemistry/MoleculeConstructor.tsx` | `service/chemistry/gemini-molecule-constructor.ts` |
| 6 | `equation-balancer` | `primitives/visual-primitives/chemistry/EquationBalancer.tsx` | `service/chemistry/gemini-equation-balancer.ts` |
| 7 | `energy-of-reactions` | `primitives/visual-primitives/chemistry/EnergyOfReactions.tsx` | `service/chemistry/gemini-energy-of-reactions.ts` |
| 8 | `mixing-and-dissolving` | `primitives/visual-primitives/chemistry/MixingAndDissolving.tsx` | `service/chemistry/gemini-mixing-and-dissolving.ts` |
| 9 | `ph-explorer` | `primitives/visual-primitives/chemistry/PHExplorer.tsx` | `service/chemistry/gemini-ph-explorer.ts` |
| 10 | `element-quest` | `primitives/visual-primitives/chemistry/ElementQuest.tsx` | `service/chemistry/gemini-element-quest.ts` |
| 11 | `safety-lab` | `primitives/visual-primitives/chemistry/SafetyLab.tsx` | `service/chemistry/gemini-safety-lab.ts` |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 10 new ComponentIds to union (periodic-table and molecule-viewer already exist) |
| `config/primitiveRegistry.tsx` | Add 10 new registry entries + update 2 existing |
| `evaluation/types.ts` | Add 12 metrics interfaces (10 new + 2 upgraded) + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/science.ts` | Add 10 new catalog entries + update 2 existing with tutoring scaffolds |
| `service/registry/generators/coreGenerators.ts` | Import chemistry generators |
| `primitives/PeriodicTable.tsx` | Upgrade: grade-band modes, challenges, trend visualization |
| `primitives/MoleculeViewer.tsx` | Upgrade: building mode, property panel |

**Total: 22 new files + 7 existing file modifications.**

---

## Multimodal Integration Summary

| Modality | Primitives Using It | Infrastructure |
|---|---|---|
| **AI Tutoring Scaffold** | All 12 primitives | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech |
| **AI Image Generation** | `matter-explorer`, `reaction-lab`, `states-of-matter`, `atom-builder`, `molecule-constructor`, `mixing-and-dissolving`, `ph-explorer`, `safety-lab`, `element-quest` (9 primitives) | Gemini image generation — real-world chemistry contexts |
| **Rich Evaluation** | All 12 primitives | `usePrimitiveEvaluation` + metrics system |
| **Particle Simulation** | `states-of-matter`, `mixing-and-dissolving`, `reaction-lab`, `ph-explorer` (4 primitives) | Canvas/SVG particle engine (20-60 particles) |
| **Drag-and-Drop** | `matter-explorer`, `atom-builder`, `molecule-constructor`, `safety-lab`, `reaction-lab`, `ph-explorer` (6 primitives) | React DnD patterns |
| **Reaction Animation** | `reaction-lab`, `energy-of-reactions`, `states-of-matter`, `equation-balancer` (4 primitives) | SVG/Canvas animation — fizzing, color change, glow effects |

---

## Implementation Priority

### Sprint 1: Wonder & Observation (K-5 Core)
1. **`reaction-lab`** — The flagship. Start with the baking soda volcano. Highest engagement potential.
2. **`matter-explorer`** — Foundation for all chemistry. Simple sorting gives quick win for K-2.
3. **`states-of-matter`** — Particle model is core to everything. Beautiful particle simulation.
4. **`safety-lab`** — Must exist before any other lab primitives. Safety first!

### Sprint 2: Building Blocks (3-8)
5. **`atom-builder`** — Extends existing AtomVisualizer. Direct connection to periodic table.
6. **`molecule-constructor`** — Natural follow-up to atom builder.
7. **`periodic-table` upgrade** — Add evaluation, AI scaffold, grade bands, challenges.
8. **`molecule-viewer` upgrade** — Add building mode, evaluation, AI scaffold.

### Sprint 3: Reactions & Properties (5-8)
9. **`equation-balancer`** — Core grade 6-8 skill. Engaging puzzle mechanic.
10. **`energy-of-reactions`** — Connects back to reaction-lab observations.
11. **`ph-explorer`** — Colorful, engaging, connects to kitchen chemistry.
12. **`mixing-and-dissolving`** — Builds on states-of-matter particle model.

### Sprint 4: Advanced & Polish
13. **`element-quest`** — Gamified periodic table investigation. Requires solid periodic-table upgrade first.
14. Full evaluation integration pass across all 12 primitives.
15. Cross-primitive linking (reaction-lab links to equation-balancer, atom-builder links to periodic-table, etc.)

---

## Appendix A: K-8 Grade Coverage

| Grade | Primitives Available | Focus |
|-------|---------------------|-------|
| K-1 | `matter-explorer`, `reaction-lab` (K-2 mode), `safety-lab` | Sorting matter, observing changes, basic safety |
| 2-3 | + `states-of-matter`, `mixing-and-dissolving` (3-5 mode) | Particle model, dissolving, phase changes, physical vs chemical |
| 3-4 | + `atom-builder` (simplified), `molecule-constructor` (simplified) | Atoms are building blocks, simple molecules, safety training |
| 5-6 | + `periodic-table` (explorer mode), `element-quest`, `ph-explorer`, `energy-of-reactions` | Elements, acid/base, energy in reactions, element investigation |
| 7-8 | Full suite: `equation-balancer`, `atom-builder` (ions/isotopes), `molecule-constructor` (bonding), `molecule-viewer` (3D), `periodic-table` (trends) | Chemical equations, bonding, trends, advanced investigation |

**Total: 12 interactive, AI-tutored, evaluated chemistry primitives spanning K-8, progressing from kitchen experiments to chemical equations.**

---

## Appendix B: The Baking Soda Volcano — Full Primitive Walkthrough

To illustrate how these primitives work together, here's how the baking soda + vinegar experiment flows through the system:

1. **`safety-lab`** — "Before we start, put on your safety goggles! This experiment is safe, but good scientists always protect their eyes."

2. **`reaction-lab`** (K-2 mode) — Predict: "What do you think will happen when we add vinegar to baking soda?" → Mix → FIZZ! Observe: "I see bubbles! Lots of foam! It feels warm!" → Explain: "Something new was made — that's a chemical change!"

3. **`reaction-lab`** (3-5 mode) — Same experiment, now with particle view toggle. "See the CO₂ molecules forming? Those are the bubbles!" Signs of chemical change checklist: gas produced ✓, temperature change ✓.

4. **`reaction-lab`** (6-8 mode) — Full equation: NaHCO₃ + CH₃COOH → NaCH₃COO + H₂O + CO₂↑. Toggle to `equation-balancer` — verify it's balanced. Toggle to `energy-of-reactions` — this is endothermic overall (it absorbs heat from surroundings, but the rapid CO₂ production creates the dramatic effect).

5. **`atom-builder`** — "Let's look at the carbon in CO₂. Build a carbon atom: 6 protons, 6 neutrons, 6 electrons."

6. **`molecule-constructor`** — "Now build CO₂: one carbon connected to two oxygens with double bonds."

7. **`element-quest`** — "Carbon is in group 14 of the periodic table. What other elements are in its group? What do they have in common?"

**One experiment. Seven primitives. Eight years of deepening understanding.**

---

## Appendix C: Design Style Reference

All chemistry primitives follow the PeriodicTable's established Lumina Chemistry aesthetic:

```
┌─────────────────────────────────────────────────────────┐
│  Glass Panel: bg-slate-900/70, backdrop-blur-20px       │
│  Border: border-white/10, rounded-2xl                   │
│                                                          │
│  ┌─────────────────────┐  ┌───────────────────────────┐ │
│  │  Element Card        │  │  Property Panel            │ │
│  │  bg-slate-800/40     │  │  bg-slate-900/50           │ │
│  │  border-white/5      │  │  text-slate-200            │ │
│  │  category-glow       │  │  labels: text-slate-400    │ │
│  │                      │  │                            │ │
│  │  Symbol: text-2xl    │  │  Values: font-mono         │ │
│  │  gradient-text       │  │  Accents: category-color   │ │
│  │  category-color      │  │                            │ │
│  └─────────────────────┘  └───────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Interactive Area                                    │ │
│  │  Hover: scale-105, transition-300ms                  │ │
│  │  Active: category-glow, ring-2                       │ │
│  │  Particles: SVG circles with motion trails           │ │
│  │  Animations: 60fps, spin/pulse/fade-in              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Category Colors:                                        │
│  🔴 Alkali #ef4444  🟠 Alkaline #f97316                │
│  🟡 Transition #eab308  🟢 Metalloid #10b981           │
│  🔵 Halogen #3b82f6  🟣 Noble #a855f7                  │
└─────────────────────────────────────────────────────────┘
```

Every new chemistry primitive should feel like it belongs in the same universe as the PeriodicTable — deep space backgrounds with glowing elements, glass cards with soft blur, and category colors that tie everything back to the elements.
