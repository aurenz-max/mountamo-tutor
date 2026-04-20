# Chemistry HS Expansion — Top 5 Primitives PRD

## Overview

Chemistry has 12 shipped K-8 primitives covering atomic structure, bonding (covalent only), basic reactions, energy classification, dissolving, and pH. The K-8 PRD is fully delivered. The AP-level `chemistry-primitives-prd.md` lists ~50 advanced specs but none are built.

This PRD identifies the **5 highest-leverage primitives** to take chemistry from "K-8 strong, HS empty" to a coherent K-12 spine. These five collectively unlock the five canonical units of HS chemistry that are currently unservable.

**Audience:** Grades 8-12 (with 6-7 entry points where natural). Bridges existing K-8 catalog to AP/HS curriculum.

## Strategic Rationale

### Current Coverage Map (12 shipped)

| HS Chem Unit | Coverage Today | Gap |
|---|---|---|
| Atomic structure | atom-builder, periodic-table | Strong K-8; HS-level electron config gap is acceptable |
| Bonding | molecule-constructor (covalent only), molecule-viewer | **No ionic, no metallic, no polarity, no electronegativity** |
| Reactions & stoichiometry | reaction-lab, equation-balancer | Balancing yes; **mole concept and limiting reagent: zero** |
| Thermochemistry | energy-of-reactions | Classification + diagrams covered; bond energy touched |
| **Gas behavior** | none | **Entire unit missing** — no KMT, no gas laws |
| **Kinetics** | none (catalysts mentioned in energy-of-reactions only) | **Entire unit missing** — no rate, no collision theory |
| **Equilibrium** | none | **Entire unit missing** — no Le Chatelier, no Q vs K |
| Acids/bases | ph-explorer | Solid for K-8; titration would extend |
| Solutions | mixing-and-dissolving | Strong K-8; molarity + dilution gap acceptable for now |
| Lab safety | safety-lab | Complete |

### Why These 5

Picking criteria, in order:
1. **Closes a whole HS unit** that students cannot currently learn here.
2. **Fits the living simulation pattern** (`memory/feedback_living-simulation-pattern.md`) — physics-based, controls with real consequences.
3. **Direct manipulation first** (`memory/feedback_direct-manipulation-first.md`) — student touches the simulation, not abstract sliders.
4. **Bridges existing primitives** rather than duplicating them.
5. **Reusable across grade bands** with progressive disclosure of complexity.

| # | Primitive | Closes Unit | Builds On | Living Sim |
|---|---|---|---|---|
| 1 | `stoichiometry-lab` | Stoichiometry | equation-balancer | No (workspace) |
| 2 | `gas-laws-simulator` | Gas behavior + KMT | states-of-matter | **Yes** |
| 3 | `reaction-kinetics-arena` | Kinetics | energy-of-reactions, reaction-lab | **Yes** |
| 4 | `equilibrium-explorer` | Equilibrium | reaction-lab | **Yes** |
| 5 | `bond-character-explorer` | Bonding (ionic/polar/metallic) | molecule-constructor, atom-builder | No (interactive workbench) |

Deferred (next wave): `titration-station`, `electrochemical-cell`, `nuclear-decay-simulator`, `organic-functional-groups`, `molecular-geometry-vsepr`. Strong candidates but each closes a smaller slice or serves a narrower audience than the five above.

---

## Design Principles

- **Manipulation before math.** Every primitive starts with direct manipulation; numerical answers come later phases.
- **KMT as the through-line.** Particles must be visible whenever a unit is fundamentally about particle behavior (gas laws, kinetics, equilibrium). Don't show abstract graphs without a synchronized particle view.
- **One canvas, multiple measurements.** Reuse the live-physics canvas pattern from `states-of-matter` and `reaction-lab` — temperature, concentration, and pressure are read off the same simulation, not from separate widgets.
- **Eval modes match the cognitive ladder.** Build/observe → identify/predict → calculate/explain. Three modes per primitive at launch; densify later via `/lumina-densify-primitives`.

---

## Primitive 1 — `stoichiometry-lab`

**Purpose:** The mole concept is the single biggest "wall" in HS chemistry. Students who can balance equations still can't answer "how many grams of water do I get from 8 grams of hydrogen?" This primitive turns mole conversions into a visible workshop: students stage reactant amounts, watch the products form proportionally, and confront limiting-reagent reality through unreacted leftovers.

**Grade Band:** 8-12

**Cognitive Operation:** Mole-mass conversions, mole ratios from balanced equations, limiting reagent identification, theoretical and percent yield.

**Multimodal Features:**
- **Visual:** Two side-by-side bins for reactants (with mass slider, gram readout, mole readout). Conversion ladder showing grams → moles → moles → grams as the student adjusts amounts. Reaction "factory" panel that consumes reactants in correct ratio and emits product molecules. Leftover reactant pile sits unreacted, color-coded as the limiting reagent's partner.
- **AI Tutoring:** Sees current reactant amounts, the balanced equation, computed limiting reagent, expected vs actual yield. Walks the mole-map: "You have 8 g of H₂. How many moles is that? Now use the 2:1 ratio…"
- **Interactive:** Drag-to-fill reactant beakers, type a target mass, run reaction. Toggle "show leftovers." Toggle ratio strip. Optional percent-yield slider for actual-vs-theoretical comparisons.

**Learning Progression:**
| Grade | Focus |
|---|---|
| 8 | Concept of mole as a counting unit; ratio reading from a balanced equation |
| 9-10 | Mass↔mole conversions; limiting reagent from given masses |
| 11 | Percent yield, excess reagent calculations |
| 12 (review) | Multi-step problems, gas-volume stoichiometry hand-off to gas-laws-simulator |

**Interaction Model (phases):**
1. Stage — pick a reaction (from generator), set reactant amounts in grams or moles.
2. Predict — student types theoretical product yield before running.
3. React — animation consumes reactants in ratio; products emerge; leftovers visible.
4. Reconcile — compare prediction to actual; identify limiting reagent; calculate percent yield (HS only).

**Eval Modes:**
| Mode | Beta | Description |
|---|---|---|
| `convert` | -0.5 | Single-step gram↔mole conversions for one reactant |
| `limiting` | 1.0 | Identify limiting reagent from two given amounts |
| `yield` | 2.5 | Compute theoretical yield and percent yield |

**Schema sketch:**
```json
{
  "primitiveType": "stoichiometry-lab",
  "reaction": {
    "equation": "string (already balanced)",
    "reactants": [{ "formula": "string", "molarMass": "number", "coefficient": "number" }],
    "products": [{ "formula": "string", "molarMass": "number", "coefficient": "number" }]
  },
  "challenges": [
    { "id": "string", "type": "convert | limiting | yield",
      "givenMasses": { "[formula]": "number" },
      "askFor": "string (e.g., 'mass of H2O produced')",
      "targetAnswer": "number", "tolerance": "number",
      "instruction": "string", "hint": "string", "narration": "string" }
  ],
  "showOptions": {
    "showMoleLadder": "boolean",
    "showLeftovers": "boolean",
    "showRatioStrip": "boolean",
    "showPercentYield": "boolean"
  },
  "gradeBand": "8 | 9-10 | 11-12"
}
```

**Evaluable:** Yes. Metrics: `conversionCorrect/total`, `limitingReagentCorrect`, `yieldWithinTolerance`, `attemptsCount`.

---

## Primitive 2 — `gas-laws-simulator`

**Purpose:** Gas laws are the canonical living-simulation candidate — students should *watch* particles slow when chilled, *watch* them slam the piston harder when heated. PV=nRT becomes obvious when you can squeeze the cylinder and feel the resistance. This primitive replaces the textbook P-V graph with a physics-driven cylinder where every variable is a control with real consequences.

**Grade Band:** 8-12 (KMT-only mode for grade 8; full ideal gas law grade 11+).

**Cognitive Operation:** Pressure-volume-temperature-amount relationships, kinetic molecular theory, ideal vs real gas behavior.

**Multimodal Features:**
- **Visual:** Canvas-rendered cylinder with movable piston. Particles bounce under physics (elastic collisions with walls and piston). Temperature controls particle speed; pressure shown as collision frequency on piston face; volume shown as cylinder height. Live P-V, V-T, and P-T plots track in real time as student manipulates controls. Optional 2-cylinder comparison mode.
- **AI Tutoring:** Sees current P, V, T, n and the law being explored. Walks: "You squeezed the volume in half. What happened to the pressure? Why? Look at how often the particles hit the piston now…"
- **Interactive:** Drag piston up/down (volume). Drag temperature slider on the cylinder wall (heat ramp visible). Add/remove particles via "amount" knob. Lock-and-vary mode: hold T constant, vary V, record pairs.

**Learning Progression:**
| Grade | Focus |
|---|---|
| 8 | KMT only — particles move faster when hot, hit walls more often = pressure |
| 9-10 | Boyle's (P↔V at const T), Charles's (V↔T at const P), Gay-Lussac's (P↔T at const V) |
| 11 | Combined gas law, Avogadro's law, ideal gas law PV=nRT |
| 12 | Real gas deviations (intro), partial pressures (Dalton's) |

**Interaction Model (phases):**
1. Explore — free-play with all 4 variables; see how everything connects.
2. Lock-and-vary — instructor (or generator) locks two variables; student varies one and records the other.
3. Predict — given a starting P/V/T, predict end state after a change.
4. Calculate — solve for an unknown using the gas law (HS only).

**Eval Modes:**
| Mode | Beta | Description |
|---|---|---|
| `observe` | -1.0 | Identify what changes when one variable is altered (KMT-grounded) |
| `predict` | 0.5 | Predict directional change before applying it |
| `calculate` | 2.5 | Solve for unknown using PV=nRT or combined gas law |

**Schema sketch:**
```json
{
  "primitiveType": "gas-laws-simulator",
  "scenario": {
    "lawFocus": "string (boyle | charles | gay_lussac | combined | ideal | kmt_only)",
    "initialState": { "P": "number (atm)", "V": "number (L)", "T": "number (K)", "n": "number (mol)" },
    "lockedVariables": ["string (P|V|T|n)"]
  },
  "challenges": [
    { "id": "string", "type": "observe | predict | calculate",
      "change": { "variable": "string", "newValue": "number" },
      "askFor": "string", "targetAnswer": "number | string",
      "tolerance": "number", "instruction": "string", "hint": "string" }
  ],
  "showOptions": {
    "showPVPlot": "boolean", "showVTPlot": "boolean", "showPTPlot": "boolean",
    "showCollisionMarkers": "boolean", "showTemperatureColor": "boolean",
    "showSecondCylinder": "boolean"
  },
  "gradeBand": "8 | 9-10 | 11-12"
}
```

**Evaluable:** Yes. Metrics: `directionalPredictionCorrect/total`, `calculationWithinTolerance`, `kmtExplanationGiven`, `attemptsCount`.

**Living simulation note:** Particle physics is owned by the component (canvas + simple elastic-collision loop with thermalized speed distribution). Gemini owns scenarios, challenge prompts, and narrative — never the physics constants.

---

## Primitive 3 — `reaction-kinetics-arena`

**Purpose:** Energy-of-reactions teaches *whether* a reaction releases or absorbs heat. Kinetics teaches *how fast* it happens — and that's where collision theory becomes vivid. Students should *see* concentration as crowding, *see* temperature as faster-moving particles, *see* a catalyst as a lower hill, and *see* surface area as more exposed atoms. The graph follows the simulation, not the other way around.

**Grade Band:** 9-12

**Cognitive Operation:** Reaction rate as collision frequency × successful-collision fraction; effects of concentration, temperature, surface area, and catalyst; activation energy and Arrhenius behavior.

**Multimodal Features:**
- **Visual:** Canvas arena with two reactant species (colored particles) bouncing under physics. Successful collisions (correct orientation + sufficient energy) flash and convert to product particles. Side panel: live rate-vs-time graph (concentration of product over time), running collision counter, Maxwell-Boltzmann distribution overlay showing fraction with energy ≥ Eₐ.
- **AI Tutoring:** Sees concentrations, temperature, catalyst state, current rate. Connects: "Look how many more red-blue collisions happen now that you doubled the blue concentration. Why?"
- **Interactive:** Slider per species for concentration (adds/removes particles in real time). Temperature slider (rescales speed distribution). Catalyst toggle (lowers activation energy threshold visibly). Surface area toggle (one solid block vs many small chunks for a heterogeneous variant).

**Learning Progression:**
| Grade | Focus |
|---|---|
| 9 | Qualitative: more concentration = more collisions = faster reaction |
| 10 | Temperature effect via Maxwell-Boltzmann fraction; catalyst as lower Eₐ |
| 11 | Rate law from method of initial rates; reaction order from log-log plot |
| 12 | Arrhenius equation; mechanism intro (rate-determining step) |

**Interaction Model (phases):**
1. Observe — watch a baseline reaction run, note rate.
2. Manipulate — change one variable, predict effect, run, compare.
3. Quantify — read rate from slope; compute order from doubled-concentration trials.
4. Mechanism — (HS+) student proposes which collision is rate-determining.

**Eval Modes:**
| Mode | Beta | Description |
|---|---|---|
| `qualitative` | -0.5 | Predict direction of rate change when one factor is altered |
| `order` | 1.5 | Determine reaction order from rate data |
| `arrhenius` | 2.8 | Apply Arrhenius equation to compute Eₐ or k at new T |

**Schema sketch:**
```json
{
  "primitiveType": "reaction-kinetics-arena",
  "system": {
    "reactionLabel": "string (e.g., 'A + B → C')",
    "speciesA": { "color": "string", "initialConcentration": "number" },
    "speciesB": { "color": "string", "initialConcentration": "number" },
    "activationEnergy": "number (kJ/mol)",
    "catalystAvailable": "boolean",
    "catalystEa": "number | null"
  },
  "challenges": [
    { "id": "string", "type": "qualitative | order | arrhenius",
      "perturbation": { "factor": "string", "delta": "number | string" },
      "askFor": "string", "targetAnswer": "string | number", "tolerance": "number",
      "instruction": "string", "hint": "string" }
  ],
  "showOptions": {
    "showRatePlot": "boolean", "showCollisionCounter": "boolean",
    "showMaxwellBoltzmann": "boolean", "showActivationLine": "boolean",
    "heterogeneousMode": "boolean"
  },
  "gradeBand": "9-10 | 11-12"
}
```

**Evaluable:** Yes. Metrics: `directionalCorrect/total`, `orderCorrect`, `arrheniusWithinTolerance`, `attemptsCount`.

---

## Primitive 4 — `equilibrium-explorer`

**Purpose:** Equilibrium is the abstraction students struggle with most — "the reaction is still going, both ways, just at the same rate." Le Chatelier's principle is taught as a memorized rule because students never *see* a system shift. This primitive makes shifts physical: particles flow back and forth across an invisible "reaction surface," concentrations on both sides plot in real time, and stressing the system (add reactant, change T, change V) produces a visible re-balancing.

**Grade Band:** 10-12

**Cognitive Operation:** Dynamic equilibrium, equilibrium constant K, reaction quotient Q, Le Chatelier's principle, K dependence on temperature only.

**Multimodal Features:**
- **Visual:** Canvas with two adjacent chambers (reactant box ↔ product box) connected by a forward and a reverse arrow flow. Particles cross both ways at rates proportional to current concentrations and rate constants. Real-time concentration plot with [reactants] and [products] curves converging to equilibrium. K vs Q indicator badge ("Q < K → forward favored"). Stress panel listing applied perturbations.
- **AI Tutoring:** Sees current Q, K, last applied stress, and resulting shift. Narrates: "You added more A. Now Q is below K. Which direction will the system shift to restore equilibrium?"
- **Interactive:** "Add reactant" / "Add product" buttons. Temperature slider (changes K for endo/exo systems). Volume/pressure slider (for gaseous systems — shifts toward fewer moles when compressed). Catalyst toggle (no shift, faster approach — used as a misconception check).

**Learning Progression:**
| Grade | Focus |
|---|---|
| 10 | Dynamic equilibrium concept; predict shift direction qualitatively |
| 11 | K expression, Q vs K comparison, quantitative shift prediction |
| 12 | Temperature effect on K; ICE-table-style reasoning (lightweight) |

**Interaction Model (phases):**
1. Approach — watch system reach equilibrium from different starting concentrations.
2. Stress — apply a perturbation; predict direction; observe shift.
3. Quantify — compute K from equilibrium concentrations; compute Q at non-equilibrium snapshot.
4. Distinguish — catalyst vs stress: which shifts equilibrium, which only changes the speed?

**Eval Modes:**
| Mode | Beta | Description |
|---|---|---|
| `direction` | 0.0 | Predict shift direction after a stress |
| `quantify` | 1.5 | Compute Q or K; compare to determine shift |
| `temp_K` | 2.5 | Reason about K change with T for endo/exothermic systems |

**Schema sketch:**
```json
{
  "primitiveType": "equilibrium-explorer",
  "system": {
    "equation": "string (e.g., 'N2 + 3H2 ⇌ 2NH3')",
    "Keq": "number", "thermicity": "string (exothermic | endothermic)",
    "isGaseous": "boolean",
    "initialConcentrations": { "[species]": "number" }
  },
  "challenges": [
    { "id": "string", "type": "direction | quantify | temp_K",
      "stress": { "kind": "string (add | remove | heat | cool | compress | expand | catalyst)",
                  "species": "string | null", "amount": "number | null" },
      "askFor": "string", "targetAnswer": "string | number", "tolerance": "number",
      "instruction": "string", "hint": "string" }
  ],
  "showOptions": {
    "showConcentrationPlot": "boolean", "showQvsK": "boolean",
    "showFlowArrows": "boolean", "showStressLog": "boolean"
  },
  "gradeBand": "10 | 11-12"
}
```

**Evaluable:** Yes. Metrics: `shiftDirectionCorrect/total`, `QorKWithinTolerance`, `tempKReasoningCorrect`, `catalystMisconceptionAvoided`, `attemptsCount`.

---

## Primitive 5 — `bond-character-explorer`

**Purpose:** `molecule-constructor` teaches students *how* to make covalent bonds mechanically — but it doesn't teach *what kind* of bond will form between any two elements. The covalent/ionic/polar/metallic distinction is foundational to predicting properties (melting point, conductivity, solubility) and is the bridge from atom-builder to molecule-constructor. This primitive uses electronegativity as the unifying lens.

**Grade Band:** 8-12

**Cognitive Operation:** Electronegativity as bond-character predictor, ionic vs polar covalent vs nonpolar covalent vs metallic classification, dipole arrow construction, prediction of bulk properties from bond type.

**Multimodal Features:**
- **Visual:** Two-element selector (drag from mini periodic table). On selection, electronegativity values appear above each atom. ΔEN bar fills along a 0 → 4 spectrum with three labeled zones (nonpolar / polar / ionic). For metals + metals, displays metallic-bonding "sea of electrons" view instead. Resulting bond rendered with dipole arrow (polar) or with explicit electron transfer animation (ionic) or shared-pair animation (covalent). Property panel previews bulk consequences (mp, conductivity, solubility, hardness).
- **AI Tutoring:** Sees the two elements, ΔEN, and predicted character. "ΔEN is 1.9 — that's deep in the ionic zone. Do you expect this compound to conduct electricity when dissolved?"
- **Interactive:** Pick any two elements; system computes character. Toggle dipole arrows. "Predict properties" mode: student answers mp/conductivity/solubility before reveal. Build-a-compound mode: ionic 1:1, 1:2, 2:3 ratio puzzles using charge-balance.

**Learning Progression:**
| Grade | Focus |
|---|---|
| 8 | Atoms can share OR transfer electrons; metals share electrons differently |
| 9-10 | Electronegativity scale; ΔEN thresholds for nonpolar/polar/ionic |
| 11 | Predict bulk properties from bond type; ionic formula construction |
| 12 (review) | Polar molecule shape consequences (hand-off to molecule-viewer/VSEPR) |

**Interaction Model (phases):**
1. Pair — pick two elements; observe ΔEN and bond classification.
2. Predict — predict bond character before reveal.
3. Build — for ionic, balance charges to write the correct formula (e.g., Mg + Cl → MgCl₂).
4. Property — predict melting point ranking, conductivity, solubility for a set of compounds.

**Eval Modes:**
| Mode | Beta | Description |
|---|---|---|
| `classify` | -0.5 | Classify a given pair as ionic, polar covalent, nonpolar covalent, or metallic |
| `formula` | 1.0 | Write the ionic formula by balancing charges |
| `property` | 2.2 | Rank or predict bulk properties from bond character |

**Schema sketch:**
```json
{
  "primitiveType": "bond-character-explorer",
  "elementSet": [
    { "symbol": "string", "electronegativity": "number", "commonCharge": "number | null", "isMetal": "boolean" }
  ],
  "challenges": [
    { "id": "string", "type": "classify | formula | property",
      "pair": ["string", "string"],
      "askFor": "string", "targetAnswer": "string | number",
      "instruction": "string", "hint": "string" }
  ],
  "showOptions": {
    "showENBar": "boolean", "showDipoleArrow": "boolean",
    "showElectronAnimation": "boolean", "showPropertyPanel": "boolean",
    "showMetallicSea": "boolean"
  },
  "gradeBand": "8 | 9-10 | 11-12"
}
```

**Evaluable:** Yes. Metrics: `classificationCorrect/total`, `ionicFormulaCorrect`, `propertyPredictionCorrect/total`, `attemptsCount`.

---

## Implementation Roadmap

Recommended build order. Each one is a separate `/primitive` invocation.

| Wave | Primitive | Why this order |
|---|---|---|
| 1 | `bond-character-explorer` | No physics simulation; lowest risk; immediately fills the most-cited K-8 → HS gap; bridges existing primitives |
| 2 | `stoichiometry-lab` | Workspace-style (no live physics); sits naturally next to existing `equation-balancer` |
| 3 | `gas-laws-simulator` | First true living-sim build — establishes the canvas-particle pattern reused by waves 4-5 |
| 4 | `reaction-kinetics-arena` | Reuses the wave-3 canvas-particle pattern; second-pass on collision physics |
| 5 | `equilibrium-explorer` | Most abstract; benefits from lessons learned in waves 3-4 |

After each wave: `/add-eval-modes` (already specced above), then `/eval-test` and `/lumina-densify-primitives` if beta gaps exceed 1.5.

## Domain Reorganization (post-build)

After all 5 ship, the chemistry sidebar should regroup:

```
SC: Science Core           — molecule-viewer, periodic-table
CM: Matter & Particles     — matter-explorer, states-of-matter, atom-builder, molecule-constructor
CB: Bonding                — bond-character-explorer  ← NEW
CR: Reactions & Energy     — reaction-lab, equation-balancer, energy-of-reactions, stoichiometry-lab  ← +1
CK: Kinetics & Equilibrium — reaction-kinetics-arena, equilibrium-explorer  ← NEW GROUP
CG: Gas Behavior           — gas-laws-simulator  ← NEW GROUP
CS: Solutions & Safety     — mixing-and-dissolving, ph-explorer, safety-lab
```

That's 17 primitives across 7 domain groups — comparable to biology's 17 across 6 groups.

## Out of Scope (Defer)

These would be obvious next picks but are deferred:

- `titration-station` — extends ph-explorer; build after `equilibrium-explorer` (uses Q/K reasoning).
- `electrochemical-cell` — niche-ier audience; AP-only typically.
- `nuclear-decay-simulator` — engaging but tangential to core HS chem flow.
- `organic-functional-groups` — deserves its own focused PRD with a 4-5 primitive suite.
- `molecular-geometry-vsepr` — could ship as a `molecule-viewer` upgrade rather than standalone.

## Standards Alignment

All 5 primitives align to NGSS HS-PS1 (Matter and Its Interactions):
- HS-PS1-2 (bond character → bond-character-explorer)
- HS-PS1-4 (energy of reactions → existing energy-of-reactions; deepened by kinetics-arena)
- HS-PS1-5 (rates → reaction-kinetics-arena)
- HS-PS1-6 (equilibrium and Le Chatelier → equilibrium-explorer)
- HS-PS1-7 (mass conservation in reactions → stoichiometry-lab)
- HS-PS3-4 (KMT and gas behavior → gas-laws-simulator)

## Verification Checklist (per primitive)

- [ ] Component file under `primitives/chemistry-primitives/`
- [ ] Generator at `service/chemistry/gemini-<id>.ts`
- [ ] Generator registered in `service/registry/generators/`
- [ ] Catalog entry in `service/manifest/catalog/chemistry.ts` with eval modes above
- [ ] Backend entry in `problem_type_registry.py`
- [ ] Tester wired
- [ ] `npx tsc --noEmit` clean
- [ ] `/eval-test <id>` passes for all listed eval modes
