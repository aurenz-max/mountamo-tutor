# K-8 Biology Visual Primitives
## Product Requirements Document — Lumina Platform

### Overview

This document defines interactive visual primitives for biology education (grades K-8) within the Lumina platform. These primitives are designed to be populated by the Gemini Content API using structured JSON schemas, rendered by Lumina's frontend primitive engine, and tracked by the backend evaluation and recommendation services.

Biology presents a unique challenge: it spans scales from molecular to planetary, requires understanding of both structure and process, and involves systems that are simultaneously mechanical, chemical, and informational. The primitive architecture addresses this by layering from **foundational** (cross-topic, broadly applicable) to **specialized** (domain-specific with unique rendering requirements).

### Design Principles

1. **Scale Awareness**: Biology operates at molecular, cellular, organ, organism, population, and ecosystem levels. Primitives encode their operative scale and can bridge between them.
2. **Living Systems Thinking**: Unlike physics or math, biology content involves emergence, feedback loops, and exceptions. Primitives must handle "usually but not always" gracefully.
3. **Observation Before Mechanism**: K-3 primitives emphasize noticing, sorting, and describing. Mechanism (why/how) layers in at grades 4-8.
4. **Gemini-Native Generation**: Every primitive schema is designed for single-shot Gemini API generation via JSON mode. Prompts include the schema, pedagogical intent, grade band, and topic—Gemini returns structured content the renderer consumes directly.
5. **Evaluation Hooks**: Primitives with assessment capability expose an `evaluationSchema` that captures student interaction data for the backend evaluation service.
6. **State Serialization**: All primitives serialize to JSON for problem authoring, student response capture, and session replay.

### Gemini API Integration Pattern

All primitives follow Lumina's established content generation pattern:

```
Frontend Request → Vercel API Route → Gemini API (JSON mode) → Structured Response → Primitive Renderer
```

**Prompt Template Structure:**
```json
{
  "primitiveType": "organism-card",
  "gradeBand": "K-2",
  "topic": "mammals",
  "learningObjective": "Identify basic mammal characteristics",
  "difficulty": 2,
  "schema": { ... },
  "generationInstructions": "Return valid JSON matching the schema. Content should be age-appropriate for kindergarten through 2nd grade."
}
```

Gemini returns a fully populated instance of the primitive schema. The frontend renderer consumes this directly with no post-processing required.

---

## Tier 1: Foundational Biology Primitives

These primitives cover broadly applicable biology concepts and serve as the workhorse components for K-8 content. They handle classification, observation, life processes, and structural understanding. Each can be reused across dozens of biology topics.

---

### 1. Organism Card (`organism-card`)

**Purpose:** Present a living thing with key biological attributes in a structured, visually rich format. The foundational "unit" of biology content—used for comparison, classification, and reference.

**Grade Band:** K-8 (complexity scales with grade)

**Cognitive Operation:** Identify, describe, classify

**Rendering:** Card layout with image region, attribute grid, and expandable detail sections. K-2 uses icons and simple labels. Grades 3-5 add habitat/diet/reproduction. Grades 6-8 add taxonomy, evolutionary context, and cellular characteristics.

**Schema:**
```json
{
  "primitiveType": "organism-card",
  "organism": {
    "commonName": "string",
    "scientificName": "string | null",
    "imagePrompt": "string (description for image generation or stock lookup)",
    "kingdom": "string",
    "classification": {
      "domain": "string | null",
      "phylum": "string | null",
      "class": "string | null",
      "order": "string | null",
      "family": "string | null"
    }
  },
  "attributes": {
    "habitat": "string",
    "diet": "string",
    "locomotion": "string",
    "lifespan": "string",
    "size": "string",
    "bodyTemperature": "warm-blooded | cold-blooded | N/A",
    "reproduction": "string",
    "specialAdaptations": ["string"]
  },
  "funFact": "string",
  "gradeBand": "K-2 | 3-5 | 6-8",
  "visibleFields": ["string (controls which attributes render at this grade band)"]
}
```

**Gemini Generation Notes:** At K-2, instruct Gemini to use simple vocabulary and limit to 3-4 visible attributes. At 6-8, request full taxonomy and mention cellular characteristics (prokaryotic/eukaryotic, unicellular/multicellular).

**Evaluation:** No direct evaluation. Used as reference material and comparison input.

---

### 2. Classification Sorter (`classification-sorter`)

**Purpose:** Students drag organisms or characteristics into categories. The core "is it a ___?" primitive for biology. Handles binary sorts (vertebrate/invertebrate), multi-category sorts (mammal/reptile/amphibian/bird/fish), and property-based sorts (has bones/no bones, makes own food/eats food).

**Grade Band:** K-8

**Cognitive Operation:** Classify, compare, discriminate

**Rendering:** Drag-and-drop interface with labeled bins and item cards. Items can be text, image, or organism-card mini variants. Incorrect placements trigger a brief hint. Bins can be hierarchical (Kingdom → Phylum → Class) at higher grades.

**Schema:**
```json
{
  "primitiveType": "classification-sorter",
  "title": "string",
  "instructions": "string",
  "categories": [
    {
      "id": "string",
      "label": "string",
      "description": "string (shown on hover/tap)",
      "parentId": "string | null (for hierarchical sorting)"
    }
  ],
  "items": [
    {
      "id": "string",
      "label": "string",
      "imagePrompt": "string | null",
      "hint": "string",
      "correctCategoryId": "string",
      "distractorReasoning": "string (why a student might place this incorrectly)"
    }
  ],
  "sortingRule": "string (the principle being applied: 'Sort by number of legs')",
  "gradeBand": "K-2 | 3-5 | 6-8",
  "allowPartialCredit": "boolean"
}
```

**Evaluation Schema:**
```json
{
  "attempts": [
    {
      "itemId": "string",
      "placedCategoryId": "string",
      "correctCategoryId": "string",
      "isCorrect": "boolean",
      "attemptNumber": "integer",
      "timeMs": "integer"
    }
  ],
  "totalCorrectFirstAttempt": "integer",
  "totalItems": "integer"
}
```

**Gemini Generation Notes:** Request Gemini to include 1-2 items that are intentionally ambiguous or boundary cases (e.g., a platypus when sorting mammals) with appropriate `distractorReasoning`. This drives deeper thinking.

---

### 3. Life Cycle Sequencer (`life-cycle-sequencer`)

**Purpose:** Students arrange stages of a biological process in correct temporal order. Covers organismal life cycles (frog, butterfly, plant), cellular processes (mitosis phases), and ecological cycles (carbon, water, nitrogen).

**Grade Band:** K-8

**Cognitive Operation:** Sequence, identify temporal relationships, understand transformation

**Rendering:** Horizontal or circular timeline with draggable stage cards. Each card has an image region, stage name, and description. Circular rendering for cycles (water cycle, cell cycle), linear for developmental sequences (embryo → adult). Connecting arrows appear when correctly placed, annotated with what changes between stages.

**Schema:**
```json
{
  "primitiveType": "life-cycle-sequencer",
  "title": "string",
  "instructions": "string",
  "cycleType": "linear | circular",
  "stages": [
    {
      "id": "string",
      "label": "string",
      "imagePrompt": "string",
      "description": "string",
      "correctPosition": "integer (0-indexed)",
      "transitionToNext": "string (what changes/happens between this stage and the next)",
      "duration": "string | null (how long this stage typically lasts)"
    }
  ],
  "scaleContext": "string (e.g., 'This process takes about 30 days' or 'Each division takes ~1 hour')",
  "misconceptionTrap": {
    "commonError": "string",
    "correction": "string"
  },
  "gradeBand": "K-2 | 3-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "stageAttempts": [
    {
      "stageId": "string",
      "placedPosition": "integer",
      "correctPosition": "integer",
      "isCorrect": "boolean"
    }
  ],
  "totalCorrectFirstAttempt": "integer",
  "completionTimeMs": "integer"
}
```

---

### 4. Body System Explorer (`body-system-explorer`)

**Purpose:** Interactive layered diagram of a biological system. Students can toggle layers (skeletal, muscular, circulatory, etc.), tap organs for detail cards, and trace pathways (blood flow, nerve signals, food digestion). The primary anatomy primitive.

**Grade Band:** 2-8

**Cognitive Operation:** Spatial reasoning, part-whole relationships, system tracing

**Rendering:** SVG-based layered body diagram. Toggle buttons for each system layer. Tap/click on organs triggers an info popover. "Trace mode" highlights a pathway through the system (e.g., path of food through digestive system). Zoom capability for detailed regions.

**Schema:**
```json
{
  "primitiveType": "body-system-explorer",
  "system": "string (digestive | circulatory | respiratory | nervous | skeletal | muscular | immune | endocrine | reproductive | urinary)",
  "title": "string",
  "overview": "string",
  "organs": [
    {
      "id": "string",
      "name": "string",
      "svgRegion": "string (CSS selector or coordinate bounds for the clickable region)",
      "function": "string",
      "funFact": "string | null",
      "connectedTo": ["string (other organ ids this connects to)"],
      "layerGroup": "string"
    }
  ],
  "pathways": [
    {
      "id": "string",
      "name": "string (e.g., 'Path of blood through the heart')",
      "description": "string",
      "steps": [
        {
          "organId": "string",
          "action": "string (what happens at this organ)",
          "order": "integer"
        }
      ]
    }
  ],
  "layers": [
    {
      "id": "string",
      "label": "string",
      "defaultVisible": "boolean"
    }
  ],
  "gradeBand": "2-4 | 5-6 | 7-8"
}
```

**Gemini Generation Notes:** Gemini generates the content (organ names, functions, pathways, descriptions). The SVG template and region mappings are maintained as static assets per system—Gemini doesn't generate the visual layout, just the content that populates it. This is a critical architectural distinction: the renderer holds the anatomy SVG; Gemini fills the labels and descriptions.

**Evaluation Schema:**
```json
{
  "pathwayTraceAttempts": [
    {
      "pathwayId": "string",
      "studentSequence": ["string (organ ids in order student selected)"],
      "correctSequence": ["string"],
      "isCorrect": "boolean"
    }
  ],
  "organIdentificationAttempts": [
    {
      "organId": "string",
      "studentAnswer": "string",
      "isCorrect": "boolean"
    }
  ]
}
```

---

### 5. Habitat Diorama (`habitat-diorama`)

**Purpose:** A scene-based primitive that presents an ecosystem with interactive organisms and environmental features. Students explore relationships (who eats whom, where things live, how they interact). Bridges observation (K-2) into ecology concepts (3-8).

**Grade Band:** K-8

**Cognitive Operation:** Observation, spatial reasoning, relational thinking, ecosystem analysis

**Rendering:** Illustrated scene with clickable organisms and features. Tap an organism to see its info card (uses `organism-card` mini variant). "Connection mode" draws arrows between organisms showing relationships (predator/prey, symbiosis, competition). Environmental features (water source, shelter, sunlight) are also interactive.

**Schema:**
```json
{
  "primitiveType": "habitat-diorama",
  "habitat": {
    "name": "string",
    "biome": "string",
    "climate": "string",
    "description": "string"
  },
  "organisms": [
    {
      "id": "string",
      "commonName": "string",
      "role": "producer | primary-consumer | secondary-consumer | tertiary-consumer | decomposer",
      "imagePrompt": "string",
      "position": { "x": "percentage", "y": "percentage" },
      "description": "string",
      "adaptations": ["string"]
    }
  ],
  "relationships": [
    {
      "fromId": "string",
      "toId": "string",
      "type": "predation | symbiosis-mutualism | symbiosis-commensalism | symbiosis-parasitism | competition",
      "description": "string"
    }
  ],
  "environmentalFeatures": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "position": { "x": "percentage", "y": "percentage" }
    }
  ],
  "disruptionScenario": {
    "event": "string (e.g., 'The wolf population is removed from this ecosystem')",
    "cascadeEffects": ["string"],
    "question": "string"
  },
  "gradeBand": "K-2 | 3-5 | 6-8"
}
```

**Gemini Generation Notes:** At K-2, Gemini generates 4-5 organisms with simple descriptions. At 6-8, include full food web relationships and a disruption scenario that requires systems-level thinking. The `disruptionScenario` is the evaluation hook—students predict cascade effects.

---

### 6. Compare & Contrast Viewer (`bio-compare-contrast`)

**Purpose:** Side-by-side (or Venn) comparison of two biological entities—organisms, cells, organs, processes, biomes. The essential "how are these alike and different?" primitive.

**Grade Band:** K-8

**Cognitive Operation:** Compare, contrast, analyze shared vs. unique properties

**Rendering:** Two modes—side-by-side card comparison with aligned attribute rows (highlighted matching/differing values), or interactive Venn diagram where students drag attributes into correct regions (shared, unique-A, unique-B).

**Schema:**
```json
{
  "primitiveType": "bio-compare-contrast",
  "title": "string",
  "mode": "side-by-side | venn-interactive",
  "entityA": {
    "name": "string",
    "imagePrompt": "string",
    "attributes": [
      {
        "category": "string",
        "value": "string",
        "isShared": "boolean"
      }
    ]
  },
  "entityB": {
    "name": "string",
    "imagePrompt": "string",
    "attributes": [
      {
        "category": "string",
        "value": "string",
        "isShared": "boolean"
      }
    ]
  },
  "sharedAttributes": [
    {
      "category": "string",
      "value": "string"
    }
  ],
  "keyInsight": "string (the 'so what' — why this comparison matters)",
  "gradeBand": "K-2 | 3-5 | 6-8"
}
```

**Evaluation Schema (Venn mode):**
```json
{
  "placements": [
    {
      "attributeValue": "string",
      "placedRegion": "A-only | B-only | shared",
      "correctRegion": "A-only | B-only | shared",
      "isCorrect": "boolean"
    }
  ]
}
```

---

### 7. Process Animator (`bio-process-animator`)

**Purpose:** Step-through animation of a biological process with narrated stages. Students control playback (play, pause, step forward/back) and answer checkpoint questions embedded at key moments. Handles photosynthesis, cellular respiration, digestion, blood flow, pollination, germination—any multi-step process.

**Grade Band:** 2-8

**Cognitive Operation:** Sequence understanding, cause-and-effect, mechanism comprehension

**Rendering:** Central animation viewport (can be SVG, canvas, or structured visual) with stage indicator bar, play controls, and narration panel. Checkpoint questions pause the animation and require student response before continuing.

**Schema:**
```json
{
  "primitiveType": "bio-process-animator",
  "processName": "string",
  "overview": "string",
  "stages": [
    {
      "id": "string",
      "order": "integer",
      "title": "string",
      "narration": "string",
      "visualDescription": "string (describes what the animation should show at this stage)",
      "keyMolecules": ["string | null"],
      "energyChange": "string | null (e.g., 'ATP is consumed', 'Light energy is captured')",
      "duration": "string | null"
    }
  ],
  "checkpoints": [
    {
      "afterStageId": "string",
      "question": "string",
      "options": ["string"],
      "correctIndex": "integer",
      "explanation": "string"
    }
  ],
  "inputs": ["string (what goes into this process)"],
  "outputs": ["string (what comes out)"],
  "equation": "string | null (chemical equation if applicable)",
  "scale": "molecular | cellular | organ | organism | ecosystem",
  "gradeBand": "2-4 | 5-6 | 7-8"
}
```

**Evaluation Schema:**
```json
{
  "checkpointResponses": [
    {
      "checkpointIndex": "integer",
      "selectedIndex": "integer",
      "correctIndex": "integer",
      "isCorrect": "boolean",
      "timeMs": "integer"
    }
  ],
  "completedFullAnimation": "boolean",
  "replayCount": "integer"
}
```

---

### 8. Microscope Viewer (`microscope-viewer`)

**Purpose:** Simulated microscope experience with zoom levels, labeling tasks, and guided observation prompts. Students examine specimens at increasing magnification and identify structures. Bridges the gap between macro observation and micro understanding.

**Grade Band:** 3-8

**Cognitive Operation:** Observation at scale, structure identification, spatial reasoning

**Rendering:** Circular "lens" viewport with zoom slider (low → medium → high power). At each zoom level, different structures become visible and labelable. Guided observation prompts appear in a side panel. Students can pin labels to structures.

**Schema:**
```json
{
  "primitiveType": "microscope-viewer",
  "specimen": {
    "name": "string",
    "type": "string (cell, tissue, organism, mineral)",
    "prepMethod": "string | null (stained, unstained, cross-section, whole mount)"
  },
  "zoomLevels": [
    {
      "magnification": "string (e.g., '40x', '100x', '400x')",
      "imagePrompt": "string (what the student sees at this magnification)",
      "visibleStructures": [
        {
          "id": "string",
          "name": "string",
          "description": "string",
          "labelPosition": { "x": "percentage", "y": "percentage" },
          "function": "string"
        }
      ],
      "observationPrompt": "string (e.g., 'What shape are the cells at this magnification?')"
    }
  ],
  "comparisonNote": "string | null (e.g., 'Compare this to the animal cell you observed earlier')",
  "gradeBand": "3-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "labelingAttempts": [
    {
      "structureId": "string",
      "studentLabel": "string",
      "correctLabel": "string",
      "isCorrect": "boolean"
    }
  ],
  "observationResponses": [
    {
      "zoomLevel": "string",
      "prompt": "string",
      "studentResponse": "string"
    }
  ]
}
```

---

### 9. Food Web Builder (`food-web-builder`)

**Purpose:** Students construct a food web by drawing energy-flow connections between organisms. Tests understanding of producer/consumer relationships, trophic levels, and energy transfer. Can also model disruptions (remove a species, see cascading effects).

**Grade Band:** 3-8

**Cognitive Operation:** Systems thinking, relational mapping, cause-and-effect prediction

**Rendering:** Node-graph interface. Organism nodes are positioned on screen. Students draw directional arrows showing "energy flows from → to" (i.e., prey → predator). Color coding by trophic level. Disruption mode grays out a selected species and highlights affected connections.

**Schema:**
```json
{
  "primitiveType": "food-web-builder",
  "ecosystem": "string",
  "organisms": [
    {
      "id": "string",
      "name": "string",
      "imagePrompt": "string",
      "trophicLevel": "producer | primary-consumer | secondary-consumer | tertiary-consumer | decomposer",
      "position": { "x": "percentage", "y": "percentage" }
    }
  ],
  "correctConnections": [
    {
      "fromId": "string (prey/energy source)",
      "toId": "string (predator/consumer)",
      "relationship": "string (e.g., 'Rabbits eat grass')"
    }
  ],
  "disruptionChallenges": [
    {
      "removeOrganismId": "string",
      "question": "string",
      "expectedEffects": ["string"],
      "explanation": "string"
    }
  ],
  "gradeBand": "3-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "connectionAttempts": [
    {
      "fromId": "string",
      "toId": "string",
      "isCorrect": "boolean"
    }
  ],
  "missingConnections": ["{ fromId, toId }"],
  "extraConnections": ["{ fromId, toId }"],
  "disruptionPredictions": [
    {
      "removedOrganismId": "string",
      "studentPredictions": ["string"],
      "matchedExpected": "integer",
      "totalExpected": "integer"
    }
  ]
}
```

---

### 10. Adaptation Investigator (`adaptation-investigator`)

**Purpose:** Present an organism's physical or behavioral trait and guide students to reason about *why* it exists—connecting structure to function to environment. The "why does the giraffe have a long neck?" primitive, but rigorous.

**Grade Band:** 2-8

**Cognitive Operation:** Causal reasoning, structure-function relationship, evidence-based explanation

**Rendering:** Central organism image with highlighted adaptation feature. Three-panel layout: "The Trait" (what it is), "The Environment" (what pressures exist), "The Connection" (how trait addresses the pressure). At higher grades, includes a "What If?" mode where students predict consequences of changing the environment.

**Schema:**
```json
{
  "primitiveType": "adaptation-investigator",
  "organism": "string",
  "adaptation": {
    "trait": "string",
    "type": "structural | behavioral | physiological",
    "description": "string",
    "imagePrompt": "string"
  },
  "environment": {
    "habitat": "string",
    "pressures": ["string (e.g., 'Predators with excellent eyesight', 'Scarce water during dry season')"],
    "description": "string"
  },
  "connection": {
    "explanation": "string (how the trait addresses the environmental pressure)",
    "evidencePoints": ["string"]
  },
  "whatIfScenarios": [
    {
      "environmentChange": "string",
      "question": "string",
      "expectedReasoning": "string",
      "adaptationStillUseful": "boolean"
    }
  ],
  "misconception": {
    "commonBelief": "string (e.g., 'Giraffes stretched their necks to reach food')",
    "correction": "string"
  },
  "gradeBand": "2-4 | 5-6 | 7-8"
}
```

---

## Tier 2: Specialized Biology Primitives

These primitives address domain-specific biology concepts that require unique rendering approaches, specialized interaction models, or subject matter that doesn't generalize well. They build on foundational primitives and are selected by the recommendation engine when students are working within specific biology subdomains.

---

### 11. Cell Structure Builder (`cell-builder`)

**Purpose:** Interactive cell diagram where students identify, place, and describe organelles. Handles both plant and animal cells, with prokaryotic cells at grade 7-8. The definitive "parts of a cell" primitive.

**Grade Band:** 4-8

**Cognitive Operation:** Part-whole relationships, structure-function mapping, comparison

**Rendering:** Cell outline (plant with wall, animal without) with organelle palette on the side. Students drag organelles into position. Correctly placed organelles snap into canonical positions and reveal their function card. "Compare mode" shows plant and animal cells side by side with shared/unique organelles highlighted.

**Schema:**
```json
{
  "primitiveType": "cell-builder",
  "cellType": "animal | plant | prokaryotic | fungal",
  "organelles": [
    {
      "id": "string",
      "name": "string",
      "function": "string",
      "analogy": "string (e.g., 'Like a power plant for the cell')",
      "uniqueTo": "string | null (e.g., 'plant cells only')",
      "targetPosition": { "x": "percentage", "y": "percentage" },
      "sizeRelative": "small | medium | large"
    }
  ],
  "cellMembrane": {
    "description": "string",
    "function": "string"
  },
  "cellWall": {
    "present": "boolean",
    "description": "string | null"
  },
  "challengeMode": {
    "enabled": "boolean",
    "hiddenLabels": "boolean (organelles must be placed from memory)",
    "functionMatchingRequired": "boolean"
  },
  "gradeBand": "4-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "organellePlacements": [
    {
      "organelleId": "string",
      "placed": "boolean",
      "positionAccuracy": "correct | close | incorrect",
      "functionMatchCorrect": "boolean | null"
    }
  ],
  "completionTimeMs": "integer",
  "challengeModeUsed": "boolean"
}
```

---

### 12. Genetics Inheritance Lab (`inheritance-lab`)

**Purpose:** Interactive Punnett square and trait prediction tool. Students set parent genotypes, predict offspring ratios, and observe simulated offspring populations. Handles single-gene, two-gene (dihybrid), and X-linked inheritance.

**Grade Band:** 6-8

**Cognitive Operation:** Probabilistic reasoning, pattern recognition, prediction

**Rendering:** Interactive Punnett square grid. Students fill in gamete combinations. Results populate with genotype and phenotype labels. "Run Simulation" generates a virtual population of N offspring showing actual vs. predicted ratios. Phenotype visualizations show the observable trait (flower color, eye color, wing shape).

**Schema:**
```json
{
  "primitiveType": "inheritance-lab",
  "trait": {
    "name": "string",
    "gene": "string",
    "dominantAllele": { "symbol": "string", "phenotype": "string" },
    "recessiveAllele": { "symbol": "string", "phenotype": "string" },
    "inheritancePattern": "complete-dominance | incomplete-dominance | codominance | x-linked"
  },
  "parentA": {
    "genotype": "string",
    "phenotype": "string",
    "label": "string (e.g., 'Mother Plant', 'Father')"
  },
  "parentB": {
    "genotype": "string",
    "phenotype": "string",
    "label": "string"
  },
  "punnettSquare": {
    "rows": "integer (2 for monohybrid, 4 for dihybrid)",
    "columns": "integer",
    "cells": [
      {
        "row": "integer",
        "col": "integer",
        "genotype": "string",
        "phenotype": "string"
      }
    ]
  },
  "expectedRatios": {
    "genotypic": { "string": "fraction" },
    "phenotypic": { "string": "fraction" }
  },
  "simulationPopulation": "integer (default 100)",
  "realWorldExample": "string",
  "crossType": "monohybrid | dihybrid | x-linked",
  "gradeBand": "6-7 | 8"
}
```

**Evaluation Schema:**
```json
{
  "punnettSquareFilled": [
    {
      "row": "integer",
      "col": "integer",
      "studentGenotype": "string",
      "correctGenotype": "string",
      "isCorrect": "boolean"
    }
  ],
  "ratioPredictions": {
    "studentPhenotypicRatio": { "string": "fraction" },
    "correctPhenotypicRatio": { "string": "fraction" },
    "isCorrect": "boolean"
  }
}
```

---

### 13. DNA Explorer (`dna-explorer`)

**Purpose:** Interactive 3D model of DNA structure covering the double helix, base pairing, nucleotide composition, and the central dogma (DNA → RNA → Protein). This is the molecular-level anchor primitive for genetics. Handles both structural understanding (what DNA looks like) and functional understanding (how it encodes information).

**Grade Band:** 5-8

**Cognitive Operation:** Spatial reasoning at molecular scale, pattern recognition (base pairing), information encoding concepts

**Rendering:** Three.js or WebGL-based 3D double helix that students can rotate, zoom, and interact with. Base pairs are color-coded and clickable. "Build mode" lets students construct a complementary strand by selecting bases. "Zoom levels" move from whole chromosome → gene region → nucleotide sequence → individual base pair → molecular structure.

**Schema:**
```json
{
  "primitiveType": "dna-explorer",
  "mode": "structure | base-pairing | transcription | replication",
  "sequence": {
    "templateStrand": "string (e.g., 'ATCGGCTAA')",
    "complementaryStrand": "string (auto-generated or student-built)",
    "highlightedRegion": {
      "start": "integer",
      "end": "integer",
      "label": "string (e.g., 'Gene for eye color')"
    }
  },
  "nucleotides": [
    {
      "base": "A | T | C | G",
      "fullName": "string",
      "type": "purine | pyrimidine",
      "pairsWith": "string",
      "color": "string (hex)",
      "bondType": "string (e.g., '2 hydrogen bonds' or '3 hydrogen bonds')"
    }
  ],
  "structuralFeatures": {
    "sugarPhosphateBackbone": "string (description)",
    "majorGroove": "string | null",
    "minorGroove": "string | null",
    "antiparallelOrientation": "string (description of 5' to 3' directionality)"
  },
  "zoomLevels": [
    {
      "level": "chromosome | gene | sequence | base-pair | molecular",
      "description": "string",
      "visibleFeatures": ["string"]
    }
  ],
  "centralDogmaStep": "none | transcription | translation | null",
  "buildChallenges": [
    {
      "givenStrand": "string (partial sequence with blanks)",
      "task": "string (e.g., 'Complete the complementary strand')",
      "correctAnswer": "string"
    }
  ],
  "gradeBand": "5-6 | 7-8"
}
```

**Evaluation Schema:**
```json
{
  "basePairingAttempts": [
    {
      "position": "integer",
      "givenBase": "string",
      "studentBase": "string",
      "correctBase": "string",
      "isCorrect": "boolean"
    }
  ],
  "buildChallengeResults": [
    {
      "challengeIndex": "integer",
      "studentAnswer": "string",
      "correctAnswer": "string",
      "accuracy": "number (0-1)"
    }
  ],
  "zoomLevelsExplored": ["string"],
  "interactionTimeMs": "integer"
}
```

**Gemini Generation Notes:** For grade 5-6, Gemini should generate content focused on base pairing rules (A-T, C-G) and the sugar-phosphate backbone concept. For 7-8, include replication and transcription modes, antiparallel orientation, and hydrogen bond specifics. The `buildChallenges` should progress from simple complementary strand completion to identifying errors in given sequences.

---

### 14. Protein Folding Simulator (`protein-folder`)

**Purpose:** Visualize and interact with the relationship between amino acid sequence and protein 3D structure. Students see how a linear chain of amino acids folds based on chemical properties (hydrophobic, hydrophilic, charged, polar) and how misfolding leads to dysfunction.

**Grade Band:** 7-8

**Cognitive Operation:** Spatial reasoning, structure-function relationship at molecular level, cause-and-effect (mutation → misfolding → disease)

**Rendering:** Two-panel layout. Left panel: linear amino acid sequence with color-coded properties. Right panel: simplified 3D folding visualization. Students can "fold" the chain by identifying hydrophobic residues that cluster inward and hydrophilic residues that face outward. "Mutation mode" lets students swap one amino acid and watch the fold change. Simplified model—not AlphaFold-level, but captures the essential concept that sequence determines shape and shape determines function.

**Schema:**
```json
{
  "primitiveType": "protein-folder",
  "proteinName": "string",
  "function": "string (e.g., 'Carries oxygen in blood')",
  "aminoAcidSequence": [
    {
      "position": "integer",
      "threeLetterCode": "string",
      "name": "string",
      "property": "hydrophobic | hydrophilic | charged-positive | charged-negative | polar",
      "color": "string (hex, by property)"
    }
  ],
  "foldingLevels": {
    "primary": "string (description: linear chain of amino acids)",
    "secondary": {
      "type": "alpha-helix | beta-sheet | mixed",
      "description": "string"
    },
    "tertiary": {
      "description": "string",
      "keyInteractions": [
        {
          "position1": "integer",
          "position2": "integer",
          "bondType": "hydrogen | ionic | disulfide | hydrophobic-interaction",
          "description": "string"
        }
      ]
    },
    "quaternary": "string | null (if multi-subunit protein)"
  },
  "mutationChallenges": [
    {
      "originalPosition": "integer",
      "originalAminoAcid": "string",
      "mutatedAminoAcid": "string",
      "effectOnFolding": "string",
      "effectOnFunction": "string",
      "realWorldDisease": "string | null (e.g., 'Sickle cell anemia')"
    }
  ],
  "analogies": {
    "foldingAnalogy": "string (e.g., 'Like origami—the crease pattern determines the final shape')",
    "misfoldingAnalogy": "string (e.g., 'Like a key cut wrong—it won't fit the lock')"
  },
  "gradeBand": "7-8"
}
```

**Evaluation Schema:**
```json
{
  "foldingPredictions": [
    {
      "residueId": "integer",
      "studentPlacement": "interior | surface",
      "correctPlacement": "interior | surface",
      "isCorrect": "boolean"
    }
  ],
  "mutationPredictions": [
    {
      "challengeIndex": "integer",
      "studentPredictedEffect": "string",
      "accuracyScore": "number (0-1)"
    }
  ]
}
```

---

### 15. Photosynthesis-Respiration Engine (`energy-cycle-engine`)

**Purpose:** Interactive model showing the coupled relationship between photosynthesis and cellular respiration—that the outputs of one are the inputs of the other. Students manipulate inputs (light, CO₂, glucose, O₂) and observe outputs, learning that these aren't isolated processes but a continuous energy cycle.

**Grade Band:** 5-8

**Cognitive Operation:** Systems thinking, input-output reasoning, conservation concepts, energy transformation

**Rendering:** Dual-panel visualization. Left: chloroplast (photosynthesis). Right: mitochondrion (cellular respiration). Animated molecules flow between them. Sliders control input levels (light intensity, CO₂ concentration). Gauges show output levels (O₂, glucose, ATP, H₂O). Students can "break" one process and observe the cascade effect on the other.

**Schema:**
```json
{
  "primitiveType": "energy-cycle-engine",
  "mode": "photosynthesis | respiration | coupled",
  "photosynthesis": {
    "location": "string",
    "inputs": [
      { "molecule": "string", "source": "string", "amount": "adjustable | fixed" }
    ],
    "outputs": [
      { "molecule": "string", "destination": "string" }
    ],
    "equation": "string",
    "energySource": "string",
    "stages": [
      { "name": "string", "description": "string", "location": "string" }
    ]
  },
  "cellularRespiration": {
    "location": "string",
    "inputs": [
      { "molecule": "string", "source": "string", "amount": "adjustable | fixed" }
    ],
    "outputs": [
      { "molecule": "string", "destination": "string" }
    ],
    "equation": "string",
    "energyOutput": "string",
    "stages": [
      { "name": "string", "description": "string", "location": "string" }
    ]
  },
  "couplingPoints": [
    {
      "molecule": "string",
      "producedBy": "photosynthesis | respiration",
      "consumedBy": "photosynthesis | respiration",
      "description": "string"
    }
  ],
  "experiments": [
    {
      "scenario": "string (e.g., 'What happens if you block all light?')",
      "affectedInputs": [{ "molecule": "string", "newLevel": "string" }],
      "expectedOutcome": "string",
      "explanation": "string"
    }
  ],
  "gradeBand": "5-6 | 7-8"
}
```

---

### 16. Evolution Timeline (`evolution-timeline`)

**Purpose:** Interactive deep-time timeline showing evolutionary events, branching points, and the emergence of major groups. Students navigate geological time, explore mass extinctions, and trace lineages. Handles the scale problem (4.5 billion years is hard to grasp) with zoom and scale anchors.

**Grade Band:** 4-8

**Cognitive Operation:** Temporal reasoning at extreme scales, pattern recognition, cause-and-effect across time

**Rendering:** Horizontal scrollable/zoomable timeline. Era bands (Precambrian, Paleozoic, Mesozoic, Cenozoic) with distinct colors. Event markers are clickable, expanding to show detail cards. "Lineage Trace" mode highlights a single evolutionary line (e.g., fish → amphibians → reptiles → mammals). Scale anchors ("If Earth's history were 24 hours, humans appear at 11:58 PM") help students grasp deep time.

**Schema:**
```json
{
  "primitiveType": "evolution-timeline",
  "timespan": {
    "startMya": "number (millions of years ago)",
    "endMya": "number"
  },
  "eras": [
    {
      "name": "string",
      "startMya": "number",
      "endMya": "number",
      "color": "string (hex)",
      "description": "string"
    }
  ],
  "events": [
    {
      "id": "string",
      "name": "string",
      "mya": "number",
      "type": "emergence | extinction | adaptation | environmental",
      "description": "string",
      "significance": "string",
      "imagePrompt": "string | null"
    }
  ],
  "lineages": [
    {
      "name": "string (e.g., 'Path to Mammals')",
      "eventIds": ["string (ordered list of event ids in this lineage)"]
    }
  ],
  "scaleAnchors": [
    {
      "analogy": "string (e.g., 'If Earth's history were a football field...')",
      "mappings": [
        { "event": "string", "analogyPosition": "string" }
      ]
    }
  ],
  "massExtinctions": [
    {
      "name": "string",
      "mya": "number",
      "cause": "string",
      "percentSpeciesLost": "string",
      "aftermath": "string"
    }
  ],
  "gradeBand": "4-5 | 6-8"
}
```

---

### 17. Mitosis/Meiosis Stepper (`cell-division-stepper`)

**Purpose:** Stage-by-stage walkthrough of cell division with interactive chromosome visualization. Students identify phases, observe chromosome behavior, and compare mitosis to meiosis. The core cell division primitive.

**Grade Band:** 6-8

**Cognitive Operation:** Sequence, compare processes, understand chromosome mechanics

**Rendering:** Central cell viewport showing chromosomes at each phase. Phase navigation bar. Chromosomes are individually colored and trackable across stages. Split-screen mode for mitosis vs. meiosis comparison. "Chromosome counter" shows ploidy at each stage.

**Schema:**
```json
{
  "primitiveType": "cell-division-stepper",
  "divisionType": "mitosis | meiosis | comparison",
  "startingChromosomes": "integer (diploid number)",
  "phases": [
    {
      "name": "string",
      "order": "integer",
      "description": "string",
      "chromosomeBehavior": "string (what the chromosomes are doing)",
      "visualDescription": "string",
      "chromosomeCount": "integer",
      "ploidy": "string (2n, n, etc.)",
      "keyEvent": "string (e.g., 'Crossing over occurs', 'Sister chromatids separate')"
    }
  ],
  "comparisonPoints": [
    {
      "feature": "string (e.g., 'Number of divisions')",
      "mitosis": "string",
      "meiosis": "string"
    }
  ],
  "purposeStatement": "string (why this type of division matters)",
  "resultingCells": {
    "count": "integer",
    "ploidy": "string",
    "geneticVariation": "identical | unique"
  },
  "checkpointQuestions": [
    {
      "afterPhase": "string",
      "question": "string",
      "answer": "string"
    }
  ],
  "gradeBand": "6-7 | 8"
}
```

---

### 18. Molecular Bonding Visualizer (`molecular-bond-viz`)

**Purpose:** Visualize how atoms combine to form biologically relevant molecules. Focused on the bonds that matter in biology: covalent bonds in organic molecules, hydrogen bonds in water and DNA, peptide bonds in proteins, and phosphodiester bonds in nucleic acids. Not a general chemistry primitive—specifically scoped to molecular biology.

**Grade Band:** 6-8

**Cognitive Operation:** Spatial reasoning at atomic scale, understanding bond types, connecting molecular structure to biological function

**Rendering:** Interactive 2D/3D molecular viewer. Atoms are color-coded by element (standard CPK colors). Bonds are rendered with type indicators (single, double, hydrogen shown as dashed). "Build mode" lets students construct molecules by selecting atoms and bond types. "Inspect mode" shows electron sharing/attraction. Overlay shows how molecular shape affects biological function.

**Schema:**
```json
{
  "primitiveType": "molecular-bond-viz",
  "molecule": {
    "name": "string",
    "formula": "string",
    "biologicalRole": "string",
    "category": "carbohydrate | lipid | protein | nucleic-acid | water | other"
  },
  "atoms": [
    {
      "id": "string",
      "element": "string",
      "symbol": "string",
      "position": { "x": "number", "y": "number", "z": "number | null" },
      "electronegativity": "number | null",
      "color": "string (hex, CPK convention)"
    }
  ],
  "bonds": [
    {
      "atom1Id": "string",
      "atom2Id": "string",
      "type": "covalent-single | covalent-double | covalent-triple | hydrogen | ionic | peptide | phosphodiester | glycosidic",
      "strength": "strong | moderate | weak",
      "description": "string",
      "biologicalSignificance": "string (e.g., 'Hydrogen bonds between bases hold the two DNA strands together')"
    }
  ],
  "functionalGroups": [
    {
      "name": "string (e.g., 'hydroxyl', 'amino', 'phosphate')",
      "atomIds": ["string"],
      "properties": "string",
      "significance": "string"
    }
  ],
  "buildChallenges": [
    {
      "task": "string (e.g., 'Build a water molecule using 2 hydrogen atoms and 1 oxygen atom')",
      "availableAtoms": [{ "element": "string", "count": "integer" }],
      "correctBonds": [{ "atom1": "string", "atom2": "string", "type": "string" }],
      "hint": "string"
    }
  ],
  "structureFunctionLink": "string (how this molecule's bonding structure enables its biological role)",
  "gradeBand": "6-7 | 7-8"
}
```

**Evaluation Schema:**
```json
{
  "buildAttempts": [
    {
      "challengeIndex": "integer",
      "studentBonds": [{ "atom1": "string", "atom2": "string", "type": "string" }],
      "correctBonds": [{ "atom1": "string", "atom2": "string", "type": "string" }],
      "accuracy": "number (0-1)"
    }
  ],
  "bondTypeIdentification": [
    {
      "bondIndex": "integer",
      "studentType": "string",
      "correctType": "string",
      "isCorrect": "boolean"
    }
  ]
}
```

---

## Tier 3: Assessment & Synthesis Primitives

These primitives are specifically designed for knowledge checks and competency assessment. They combine content from multiple foundational/specialized primitives to test integrated understanding.

---

### 19. Biology Concept Map Builder (`bio-concept-map`)

**Purpose:** Students construct a concept map by arranging terms and drawing labeled relationships between them. Tests ability to see connections across topics (e.g., linking "mitochondria" to "cellular respiration" to "ATP" to "muscle movement"). High cognitive demand—synthesizes understanding from multiple primitives.

**Grade Band:** 4-8

**Cognitive Operation:** Integration, relational reasoning, knowledge organization

**Rendering:** Blank canvas with a term bank. Students place terms and draw labeled arrows between them. Auto-layout suggestions prevent visual clutter. Comparison overlay shows expert concept map for self-assessment.

**Schema:**
```json
{
  "primitiveType": "bio-concept-map",
  "topic": "string",
  "terms": [
    {
      "id": "string",
      "label": "string",
      "definition": "string",
      "category": "string (e.g., 'organelle', 'process', 'molecule')"
    }
  ],
  "expectedConnections": [
    {
      "fromId": "string",
      "toId": "string",
      "relationshipLabel": "string (e.g., 'produces', 'is found in', 'requires')",
      "bidirectional": "boolean"
    }
  ],
  "minimumConnections": "integer (how many connections count as adequate)",
  "expertMapAvailable": "boolean",
  "gradeBand": "4-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "studentConnections": [
    {
      "fromId": "string",
      "toId": "string",
      "studentLabel": "string",
      "matchesExpected": "boolean",
      "labelAccuracy": "number (0-1)"
    }
  ],
  "totalExpectedConnections": "integer",
  "totalStudentConnections": "integer",
  "matchedConnections": "integer",
  "novelValidConnections": "integer (connections not in expected set but still valid)"
}
```

---

### 20. Lab Experiment Simulator (`virtual-lab`)

**Purpose:** Guided virtual experiment where students form hypotheses, manipulate variables, collect data, and draw conclusions. Not a free-form sandbox—structured around a specific biological question with controlled and experimental groups.

**Grade Band:** 3-8

**Cognitive Operation:** Scientific method, experimental design, data interpretation, evidence-based reasoning

**Rendering:** Multi-step lab interface. Step 1: Question and hypothesis formation. Step 2: Variable setup (drag/select independent and dependent variables). Step 3: "Run experiment" animation with data collection. Step 4: Data table and simple graph auto-generated. Step 5: Conclusion prompt.

**Schema:**
```json
{
  "primitiveType": "virtual-lab",
  "experimentTitle": "string",
  "researchQuestion": "string",
  "background": "string",
  "variables": {
    "independent": {
      "name": "string",
      "options": ["string"],
      "description": "string"
    },
    "dependent": {
      "name": "string",
      "unit": "string",
      "description": "string"
    },
    "controlled": [
      { "name": "string", "value": "string" }
    ]
  },
  "experimentalSetup": [
    {
      "condition": "string",
      "independentValue": "string",
      "expectedResult": "number | string",
      "actualResult": "number | string",
      "trialResults": ["number (multiple trials for variability)"]
    }
  ],
  "dataTable": {
    "columns": ["string"],
    "rows": [["string | number"]]
  },
  "correctConclusion": "string",
  "commonMisconceptions": ["string"],
  "safetyNotes": ["string | null"],
  "gradeBand": "3-5 | 6-8"
}
```

**Evaluation Schema:**
```json
{
  "hypothesisQuality": "string (student's hypothesis)",
  "variableIdentification": {
    "correctIndependent": "boolean",
    "correctDependent": "boolean",
    "controlledIdentified": "integer"
  },
  "conclusionAlignment": {
    "studentConclusion": "string",
    "supportsData": "boolean",
    "mentionsEvidence": "boolean"
  }
}
```

---

## Primitive Catalog Summary

| # | Primitive | Type | Grade Band | Eval | Tier |
|---|-----------|------|------------|------|------|
| 1 | `organism-card` | Reference | K-8 | — | Foundational |
| 2 | `classification-sorter` | Interactive | K-8 | ✓ | Foundational |
| 3 | `life-cycle-sequencer` | Interactive | K-8 | ✓ | Foundational |
| 4 | `body-system-explorer` | Exploratory | 2-8 | ✓ | Foundational |
| 5 | `habitat-diorama` | Exploratory | K-8 | Partial | Foundational |
| 6 | `bio-compare-contrast` | Interactive | K-8 | ✓ (Venn) | Foundational |
| 7 | `bio-process-animator` | Guided | 2-8 | ✓ | Foundational |
| 8 | `microscope-viewer` | Exploratory | 3-8 | ✓ | Foundational |
| 9 | `food-web-builder` | Constructive | 3-8 | ✓ | Foundational |
| 10 | `adaptation-investigator` | Inquiry | 2-8 | Partial | Foundational |
| 11 | `cell-builder` | Constructive | 4-8 | ✓ | Specialized |
| 12 | `inheritance-lab` | Simulation | 6-8 | ✓ | Specialized |
| 13 | `dna-explorer` | 3D Interactive | 5-8 | ✓ | Specialized |
| 14 | `protein-folder` | Simulation | 7-8 | ✓ | Specialized |
| 15 | `energy-cycle-engine` | Simulation | 5-8 | Partial | Specialized |
| 16 | `evolution-timeline` | Exploratory | 4-8 | — | Specialized |
| 17 | `cell-division-stepper` | Guided | 6-8 | ✓ | Specialized |
| 18 | `molecular-bond-viz` | 3D Interactive | 6-8 | ✓ | Specialized |
| 19 | `bio-concept-map` | Constructive | 4-8 | ✓ | Assessment |
| 20 | `virtual-lab` | Simulation | 3-8 | ✓ | Assessment |

---

## Gemini API Content Generation Guidelines

### Prompt Engineering for Biology Primitives

Each primitive type requires a tailored system prompt for Gemini. Key guidelines:

1. **Grade Band Calibration:** Include explicit vocabulary constraints. K-2: "Use words a 6-year-old would understand. No terms longer than 3 syllables unless they're fun to say (like 'dinosaur')." Grades 6-8: "Use proper scientific terminology with brief inline definitions on first use."

2. **Accuracy Guardrails:** Biology has many nuanced exceptions. Include in the system prompt: "Do not oversimplify to the point of inaccuracy. If a concept has important exceptions at this grade level, note them. Prefer 'most mammals' over 'all mammals.'"

3. **Image Prompt Quality:** Every `imagePrompt` field should generate a description sufficient for either stock image lookup or generative image creation. Include: subject, perspective, style, and key features. Example: "A cross-section diagram of a leaf showing the mesophyll layers, stomata, and chloroplasts, scientific illustration style, labeled."

4. **Misconception Injection:** Where schemas include `misconception` or `distractorReasoning` fields, prompt Gemini with: "Include the most common student misconception for this concept at this grade level. This is pedagogically intentional—do not avoid misconceptions, surface them."

5. **Schema Validation:** All Gemini responses should be validated against the primitive schema before rendering. Invalid responses trigger a retry with more explicit schema enforcement.

### Temperature & Model Settings

| Content Type | Temperature | Model | Rationale |
|-------------|-------------|-------|-----------|
| Factual content (organism cards, anatomy) | 0.2-0.4 | gemini-2.0-flash | Accuracy-critical, fast generation |
| Creative scenarios (disruption events, what-if) | 0.6-0.8 | gemini-2.0-flash | Need variety across sessions |
| Assessment items (questions, distractors) | 0.3-0.5 | gemini-2.0-pro | Higher quality reasoning for distractor generation |
| Complex schemas (protein folding, DNA) | 0.2-0.3 | gemini-2.0-pro | Schema adherence critical |

---

## Primitive Sequencing Recommendations

For the backend recommendation engine, biology primitives should follow pedagogical sequences within topics:

**Cellular Biology Arc (Grade 5-8):**
`microscope-viewer` → `cell-builder` → `bio-compare-contrast` (plant vs. animal) → `bio-process-animator` (cellular respiration) → `dna-explorer` → `cell-division-stepper`

**Ecology Arc (Grade 3-8):**
`organism-card` (×multiple) → `classification-sorter` → `habitat-diorama` → `food-web-builder` → `adaptation-investigator` → `virtual-lab` (ecosystem experiment)

**Genetics Arc (Grade 6-8):**
`dna-explorer` (structure mode) → `dna-explorer` (base-pairing mode) → `bio-process-animator` (DNA replication) → `dna-explorer` (transcription mode) → `protein-folder` → `inheritance-lab` → `molecular-bond-viz` (peptide bonds)

**Human Body Arc (Grade 2-6):**
`body-system-explorer` (skeletal) → `body-system-explorer` (muscular) → `bio-compare-contrast` (bones vs. muscles) → `body-system-explorer` (circulatory) → `bio-process-animator` (blood flow) → `bio-concept-map` (body systems connections)

---

## Appendix: Common Biology Misconceptions Addressed by Primitives

| Misconception | Addressed By | Grade Band |
|--------------|-------------|------------|
| "Plants get food from the soil" | `energy-cycle-engine` | 3-8 |
| "Bigger animals are more evolved" | `evolution-timeline`, `adaptation-investigator` | 4-8 |
| "All bacteria are harmful" | `organism-card`, `classification-sorter` | 3-8 |
| "Humans evolved from monkeys" | `evolution-timeline` | 6-8 |
| "Cells are flat/2D" | `microscope-viewer`, `cell-builder` | 4-8 |
| "DNA is only about appearance" | `dna-explorer`, `protein-folder` | 5-8 |
| "Seasons are caused by distance from Sun" | `virtual-lab` | 4-6 |
| "Respiration = breathing" | `energy-cycle-engine`, `bio-process-animator` | 5-8 |
| "Traits blend like paint" | `inheritance-lab` | 6-8 |
| "Adaptations are chosen/intentional" | `adaptation-investigator` | 3-8 |
| "Food chains are linear, not webs" | `food-web-builder` | 3-8 |
| "Dead things aren't part of ecosystems" | `habitat-diorama` (decomposers) | 3-8 |
