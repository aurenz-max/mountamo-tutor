# Cognitive Primitives: Renderer Registry Implementation Guide

*A scalable architecture for domain-specific educational content rendering*

---

## Executive Summary

This document outlines an architecture for rendering educational science content that scales across domains (chemistry, physics, biology) without requiring unique schemas for each concept. The key insight is to define **cognitive-operation-oriented primitives** rather than output-structure-oriented primitives.

---

## The Problem

Current approach limitations:

- **Generalized schemas break down** when domain-specific visualization is required (e.g., molecular bonds vs. force diagrams)
- **Custom HTML/JS one-shots don't scale** — each concept requires unique implementation
- **No middle ground** between rigid schemas and fully custom implementations

---

## The Solution: Cognitive Primitives + Domain Adapters

Instead of defining schemas by their visual output (table, timeline, diagram), define them by the **cognitive operation** they represent. The rendering varies by domain, but the schema structure remains consistent.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTENT GENERATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LLM receives prompt template for primitive type (e.g., relational_mapping)│
│                              ↓                                              │
│   LLM generates schema with:                                                │
│   • pedagogicalIntent (what learning outcome)                               │
│   • domain.field + domain.subtype (what subject area)                       │
│   • domain.renderingHints (visual guidance for adapters)                    │
│   • content (primitive-specific structured data)                            │
│   • assessmentHooks (predict/transfer questions)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADAPTER RESOLUTION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Registry.resolve(schema) tries in order:                                  │
│                                                                             │
│   1. EXACT MATCH (confidence: 1.0)                                          │
│      Key: "relational_mapping:chemistry/molecular_bonding"                  │
│      → MolecularBondingAdapter (Three.js 3D molecules)                      │
│                                                                             │
│   2. FIELD MATCH (confidence: 0.8)                                          │
│      Key: "relational_mapping:chemistry/*"                                  │
│      → GenericChemistryAdapter (handles any chemistry content)              │
│                                                                             │
│   3. PRIMITIVE FALLBACK (confidence: 0.6)                                   │
│      Key: "relational_mapping:*/*"                                          │
│      → GenericRelationalMappingAdapter (D3 force graph)                     │
│                                                                             │
│   4. GLOBAL FALLBACK (confidence: 0.4)                                      │
│      → BasicNetworkRenderer (simple nodes + edges)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 RENDERING                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Selected adapter:                                                         │
│   1. Validates schema structure (optional)                                  │
│   2. Reads renderingHints for visual guidance                               │
│   3. Renders to container using appropriate library                         │
│   4. Returns cleanup function for React lifecycle                           │
│                                                                             │
│   Example adapter outputs:                                                  │
│   • chemistry/molecular_bonding → Three.js 3D interactive molecule          │
│   • physics/force_interactions → SVG free-body diagram                      │
│   • biology/ecological_interactions → D3 force-directed food web            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Diagram

```
┌──────────────┐     schema      ┌──────────────────┐
│              │ ───────────────→│                  │
│  LLM Content │                 │  RendererRegistry │
│  Generator   │                 │                  │
└──────────────┘                 └────────┬─────────┘
                                          │ resolve()
                                          ↓
                                 ┌──────────────────┐
                                 │  Adapter Match   │
                                 │  {adapter,       │
                                 │   matchType,     │
                                 │   confidence}    │
                                 └────────┬─────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
           ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
           │  Chemistry    │     │   Physics     │     │   Biology     │
           │  Adapters     │     │   Adapters    │     │   Adapters    │
           │               │     │               │     │               │
           │ • molecular   │     │ • forces      │     │ • ecology     │
           │ • reactions   │     │ • circuits    │     │ • cellular    │
           │ • orbitals    │     │ • waves       │     │ • genetics    │
           └───────┬───────┘     └───────┬───────┘     └───────┬───────┘
                   │                     │                     │
                   └─────────────────────┼─────────────────────┘
                                         ↓
                                 ┌───────────────┐
                                 │   Rendered    │
                                 │   Output      │
                                 │   (React)     │
                                 └───────────────┘
```

---

## Core Cognitive Primitives

These are the four core primitives that capture fundamental learning operations across science domains:

| Primitive | Cognitive Operation | Key Question | Example Domains |
|-----------|--------------------|--------------| ----------------|
| **relational_mapping** | How entities connect and why | "What are the relationships?" | Molecular bonds, force diagrams, food webs, circuit flows |
| **state_transformation** | Before → mechanism → after | "What changes and how?" | Chemical reactions, phase changes, energy conversions, cellular processes |
| **constraint_satisfaction** | Why configurations work or don't | "What rules must be satisfied?" | Electron configuration, conservation laws, carrying capacity, balanced equations |
| **scale_bridging** | Macro ↔ micro explanations | "How do levels connect?" | Why ice floats, gene → trait, pressure → molecular motion |

### Why These Four?

These primitives were selected because they represent the fundamental ways students need to reason about scientific phenomena:

1. **Relational Mapping** — Understanding systems as interconnected parts
2. **State Transformation** — Understanding change over time with causation
3. **Constraint Satisfaction** — Understanding why certain configurations are valid/invalid
4. **Scale Bridging** — Connecting observable phenomena to underlying mechanisms

Most science content can be expressed through one or a combination of these operations.

---

## Schema Definitions by Primitive Type

### Base Schema (All Primitives Share This)

```typescript
interface BaseSchema {
  primitive: 'relational_mapping' | 'state_transformation' | 
             'constraint_satisfaction' | 'scale_bridging';
  
  pedagogicalIntent: PedagogicalIntent;
  
  domain: {
    field: 'chemistry' | 'physics' | 'biology' | 'earth_science' | 'math';
    subtype: string;
    renderingHints: RenderingHints;
  };
  
  content: { /* Primitive-specific - see below */ };
  
  assessmentHooks: AssessmentHooks;
  
  metadata?: {
    gradeLevel?: string;
    difficulty?: 'intro' | 'standard' | 'advanced';
    estimatedTime?: number;
  };
}
```

---

### 1. Relational Mapping

**Purpose:** Show how entities connect and why those connections exist.

```typescript
interface RelationalMappingContent {
  title: string;
  centralQuestion: string;
  
  entities: Array<{
    id: string;
    label: string;
    properties: Record<string, string | number | boolean>;
    visualState?: Record<string, any>;  // Domain-specific visual data
    position?: { x: number; y: number; z?: number };
  }>;
  
  relationships: Array<{
    from: string;           // Entity ID
    to: string;             // Entity ID
    type: string;           // e.g., "covalent_bond", "gravitational_force", "predation"
    mechanism: string;      // How/why the relationship exists
    properties: Record<string, string | number | boolean>;
    explanation: string;    // Student-facing explanation
  }>;
  
  emergentProperties: Array<{
    property: string;       // What emerges from the relationships
    explanation: string;    // Why it emerges
    consequence: string;    // Real-world implication
  }>;
  
  satisfiedConstraints: string[];  // Rules/laws that are satisfied
}
```

**Example: Water Molecule (Chemistry)**

```json
{
  "primitive": "relational_mapping",
  "pedagogicalIntent": "understand_mechanism",
  "domain": {
    "field": "chemistry",
    "subtype": "molecular_bonding",
    "renderingHints": {
      "entityRepresentation": "atom_with_orbitals",
      "connectionVisualization": "electron_sharing",
      "spatialLayout": "molecular_geometry"
    }
  },
  "content": {
    "title": "Water Molecule Formation",
    "centralQuestion": "Why does oxygen bond with two hydrogen atoms?",
    "entities": [
      {
        "id": "oxygen",
        "label": "Oxygen",
        "properties": {
          "valenceElectrons": 6,
          "electronegativity": 3.44,
          "desiredElectrons": 8
        },
        "visualState": {
          "orbitals": ["2s", "2p", "2p", "2p"],
          "unpairedElectrons": 2,
          "lonePairs": 2
        },
        "position": { "x": 0, "y": 0, "z": 0 }
      },
      {
        "id": "hydrogen_1",
        "label": "Hydrogen",
        "properties": {
          "valenceElectrons": 1,
          "electronegativity": 2.20,
          "desiredElectrons": 2
        },
        "position": { "x": -0.96, "y": 0, "z": 0.59 }
      },
      {
        "id": "hydrogen_2",
        "label": "Hydrogen",
        "properties": {
          "valenceElectrons": 1,
          "electronegativity": 2.20,
          "desiredElectrons": 2
        },
        "position": { "x": 0.96, "y": 0, "z": 0.59 }
      }
    ],
    "relationships": [
      {
        "from": "oxygen",
        "to": "hydrogen_1",
        "type": "covalent_bond",
        "mechanism": "electron_sharing",
        "properties": {
          "sharedElectrons": 2,
          "bondPolarity": "polar",
          "bondAngle": 104.5
        },
        "explanation": "Oxygen shares one electron pair with hydrogen. Due to oxygen's higher electronegativity, the shared electrons spend more time near oxygen, creating a polar bond."
      },
      {
        "from": "oxygen",
        "to": "hydrogen_2",
        "type": "covalent_bond",
        "mechanism": "electron_sharing",
        "properties": {
          "sharedElectrons": 2,
          "bondPolarity": "polar",
          "bondAngle": 104.5
        },
        "explanation": "Second O-H bond forms identically. The 104.5° angle results from lone pair repulsion being stronger than bonding pair repulsion (VSEPR)."
      }
    ],
    "emergentProperties": [
      {
        "property": "molecular_polarity",
        "explanation": "The bent geometry (104.5°) combined with polar O-H bonds creates an uneven charge distribution.",
        "consequence": "Water dissolves ionic compounds, exhibits hydrogen bonding, and has high surface tension."
      }
    ],
    "satisfiedConstraints": [
      "Oxygen achieves 8 valence electrons (octet rule)",
      "Each hydrogen achieves 2 valence electrons (duet rule)",
      "VSEPR: 4 electron domains → tetrahedral electron geometry → bent molecular geometry"
    ]
  },
  "assessmentHooks": {
    "predict": "What would happen if you replaced oxygen with sulfur (H₂S)?",
    "transfer": "Why does ammonia (NH₃) have a bond angle of 107° instead of 109.5°?"
  }
}
```

**Example: Force Body Diagram (Physics)**

```json
{
  "primitive": "relational_mapping",
  "pedagogicalIntent": "understand_mechanism",
  "domain": {
    "field": "physics",
    "subtype": "force_interactions",
    "renderingHints": {
      "entityRepresentation": "body_with_mass",
      "connectionVisualization": "force_vectors",
      "spatialLayout": "free_body_diagram"
    }
  },
  "content": {
    "title": "Book Resting on Table",
    "centralQuestion": "Why doesn't the book fall through the table?",
    "entities": [
      {
        "id": "book",
        "label": "Book",
        "properties": { "mass": 2, "massUnit": "kg" }
      },
      {
        "id": "earth",
        "label": "Earth",
        "properties": { "role": "gravitational_source" }
      },
      {
        "id": "table",
        "label": "Table Surface",
        "properties": { "role": "contact_surface" }
      }
    ],
    "relationships": [
      {
        "from": "earth",
        "to": "book",
        "type": "gravitational_force",
        "mechanism": "field_interaction",
        "properties": {
          "magnitude": 19.6,
          "unit": "N",
          "direction": "downward"
        },
        "explanation": "Earth's mass creates a gravitational field that pulls the book downward."
      },
      {
        "from": "table",
        "to": "book",
        "type": "normal_force",
        "mechanism": "contact_interaction",
        "properties": {
          "magnitude": 19.6,
          "unit": "N",
          "direction": "upward"
        },
        "explanation": "Table surface deforms microscopically; electromagnetic repulsion between atoms pushes back."
      }
    ],
    "emergentProperties": [
      {
        "property": "equilibrium",
        "explanation": "Net force = 0, so acceleration = 0 (Newton's First Law).",
        "consequence": "Book remains stationary."
      }
    ],
    "satisfiedConstraints": [
      "Newton's First Law: No net force means no acceleration",
      "Newton's Third Law: Normal force emerges as reaction to gravitational compression"
    ]
  },
  "assessmentHooks": {
    "predict": "What happens to the normal force if you stack another book on top?",
    "transfer": "Draw the free body diagram for a book sliding down a ramp."
  }
}
```

---

### 2. State Transformation

**Purpose:** Show how a system changes from one state to another through a mechanism.

```typescript
interface StateTransformationContent {
  title: string;
  centralQuestion: string;
  
  initialState: {
    label: string;
    properties: Record<string, string | number>;
    visualRepresentation?: string;
  };
  
  finalState: {
    label: string;
    properties: Record<string, string | number>;
    visualRepresentation?: string;
  };
  
  mechanism: {
    name: string;
    description: string;
    conditions: string[];      // What must be true for transformation
    energyChange?: string;     // Endothermic/exothermic
    catalyst?: string;         // If applicable
  };
  
  conservedQuantities: string[];  // What stays the same
  changedQuantities: string[];    // What changes
  
  intermediateStates?: Array<{
    label: string;
    properties: Record<string, string | number>;
    transitionDescription: string;
  }>;
}
```

**Example: Combustion Reaction (Chemistry)**

```json
{
  "primitive": "state_transformation",
  "pedagogicalIntent": "trace_causation",
  "domain": {
    "field": "chemistry",
    "subtype": "reaction_mechanism",
    "renderingHints": {
      "stateRepresentation": "molecular_diagram",
      "transitionVisualization": "reaction_arrow",
      "energyDisplay": "energy_diagram"
    }
  },
  "content": {
    "title": "Combustion of Methane",
    "centralQuestion": "What happens when methane burns?",
    "initialState": {
      "label": "Reactants",
      "properties": {
        "molecules": "CH₄ + 2O₂",
        "totalBonds": 12,
        "energy": "higher"
      }
    },
    "finalState": {
      "label": "Products", 
      "properties": {
        "molecules": "CO₂ + 2H₂O",
        "totalBonds": 12,
        "energy": "lower"
      }
    },
    "mechanism": {
      "name": "Combustion",
      "description": "Rapid oxidation releasing heat and light",
      "conditions": ["Presence of oxygen", "Ignition temperature reached"],
      "energyChange": "Exothermic (-890 kJ/mol)"
    },
    "conservedQuantities": [
      "Total atoms: 1C, 4H, 4O",
      "Total mass"
    ],
    "changedQuantities": [
      "Bond arrangement",
      "Energy state (released as heat/light)",
      "Molecular identity"
    ]
  },
  "assessmentHooks": {
    "predict": "What happens if you limit the oxygen supply?",
    "transfer": "Apply this pattern to explain rusting of iron."
  }
}
```

**Example: Phase Change (Physics)**

```json
{
  "primitive": "state_transformation",
  "pedagogicalIntent": "understand_mechanism",
  "domain": {
    "field": "physics",
    "subtype": "phase_transitions",
    "renderingHints": {
      "stateRepresentation": "particle_model",
      "transitionVisualization": "energy_absorption",
      "spatialLayout": "side_by_side"
    }
  },
  "content": {
    "title": "Ice Melting to Water",
    "centralQuestion": "Why does adding heat melt ice without raising temperature?",
    "initialState": {
      "label": "Solid (Ice)",
      "properties": {
        "temperature": 0,
        "particleMotion": "vibration_only",
        "structure": "crystalline_lattice",
        "intermolecularForces": "strong_hydrogen_bonds"
      }
    },
    "finalState": {
      "label": "Liquid (Water)",
      "properties": {
        "temperature": 0,
        "particleMotion": "translation_and_rotation",
        "structure": "disordered",
        "intermolecularForces": "weaker_hydrogen_bonds"
      }
    },
    "mechanism": {
      "name": "Melting (Fusion)",
      "description": "Energy breaks intermolecular bonds rather than increasing kinetic energy",
      "conditions": ["Temperature at melting point", "Heat energy input"],
      "energyChange": "Endothermic (334 J/g latent heat)"
    },
    "conservedQuantities": [
      "Temperature (during phase change)",
      "Total mass",
      "Molecular composition (H₂O)"
    ],
    "changedQuantities": [
      "Physical state",
      "Particle arrangement",
      "Entropy (increases)"
    ]
  },
  "assessmentHooks": {
    "predict": "Why does sweating cool you down?",
    "transfer": "Explain why pressure cookers cook food faster."
  }
}
```

---

### 3. Constraint Satisfaction

**Purpose:** Show what rules must be satisfied and why certain configurations are valid or invalid.

```typescript
interface ConstraintSatisfactionContent {
  title: string;
  centralQuestion: string;
  
  constraints: Array<{
    id: string;
    rule: string;              // The rule itself
    explanation: string;       // Why this rule exists
    formalExpression?: string; // Mathematical/symbolic expression
  }>;
  
  slots: Array<{
    id: string;
    label: string;
    currentValue: string | number;
    possibleValues: (string | number)[];
    affectedConstraints: string[];  // Which constraints this slot affects
  }>;
  
  validConfiguration: Record<string, string | number>;
  
  invalidExample?: {
    configuration: Record<string, string | number>;
    violatedConstraints: string[];
    explanation: string;
  };
}
```

**Example: Electron Configuration (Chemistry)**

```json
{
  "primitive": "constraint_satisfaction",
  "pedagogicalIntent": "apply_rules",
  "domain": {
    "field": "chemistry",
    "subtype": "electron_configuration",
    "renderingHints": {
      "slotRepresentation": "orbital_boxes",
      "constraintVisualization": "rule_checklist",
      "interactivity": "drag_and_drop"
    }
  },
  "content": {
    "title": "Electron Configuration of Nitrogen",
    "centralQuestion": "How do 7 electrons arrange in nitrogen's orbitals?",
    "constraints": [
      {
        "id": "aufbau",
        "rule": "Aufbau Principle",
        "explanation": "Electrons fill lowest energy orbitals first",
        "formalExpression": "Fill order: 1s → 2s → 2p → 3s → ..."
      },
      {
        "id": "pauli",
        "rule": "Pauli Exclusion Principle", 
        "explanation": "Maximum 2 electrons per orbital with opposite spins",
        "formalExpression": "max(orbital) = 2, spins = ↑↓"
      },
      {
        "id": "hund",
        "rule": "Hund's Rule",
        "explanation": "Electrons occupy empty orbitals before pairing",
        "formalExpression": "Maximize unpaired electrons in degenerate orbitals"
      }
    ],
    "slots": [
      {
        "id": "1s",
        "label": "1s orbital",
        "currentValue": 2,
        "possibleValues": [0, 1, 2],
        "affectedConstraints": ["aufbau", "pauli"]
      },
      {
        "id": "2s", 
        "label": "2s orbital",
        "currentValue": 2,
        "possibleValues": [0, 1, 2],
        "affectedConstraints": ["aufbau", "pauli"]
      },
      {
        "id": "2px",
        "label": "2px orbital",
        "currentValue": 1,
        "possibleValues": [0, 1, 2],
        "affectedConstraints": ["aufbau", "pauli", "hund"]
      },
      {
        "id": "2py",
        "label": "2py orbital",
        "currentValue": 1,
        "possibleValues": [0, 1, 2],
        "affectedConstraints": ["aufbau", "pauli", "hund"]
      },
      {
        "id": "2pz",
        "label": "2pz orbital",
        "currentValue": 1,
        "possibleValues": [0, 1, 2],
        "affectedConstraints": ["aufbau", "pauli", "hund"]
      }
    ],
    "validConfiguration": {
      "1s": 2, "2s": 2, "2px": 1, "2py": 1, "2pz": 1
    },
    "invalidExample": {
      "configuration": {
        "1s": 2, "2s": 2, "2px": 2, "2py": 1, "2pz": 0
      },
      "violatedConstraints": ["hund"],
      "explanation": "Pairing in 2px before filling 2pz violates Hund's rule - electrons should spread out to minimize repulsion."
    }
  },
  "assessmentHooks": {
    "predict": "What's the configuration for oxygen (8 electrons)?",
    "transfer": "Why are half-filled and fully-filled subshells especially stable?"
  }
}
```

---

### 4. Scale Bridging

**Purpose:** Connect macro-level observations to micro-level mechanisms.

```typescript
interface ScaleBridgingContent {
  title: string;
  centralQuestion: string;
  phenomenon: string;  // The observable thing we're explaining
  
  scaleLevels: Array<{
    id: string;
    label: string;
    scale: string;           // e.g., "molecular", "cellular", "organism", "ecosystem"
    description: string;
    keyEntities: string[];
    observables: string[];   // What you can see/measure at this level
  }>;
  
  connections: Array<{
    fromLevel: string;
    toLevel: string;
    mechanism: string;
    explanation: string;
  }>;
  
  macroObservation: string;   // What you see
  microExplanation: string;   // Why it happens
}
```

**Example: Why Ice Floats (Chemistry/Physics)**

```json
{
  "primitive": "scale_bridging",
  "pedagogicalIntent": "understand_mechanism",
  "domain": {
    "field": "chemistry",
    "subtype": "molecular_properties",
    "renderingHints": {
      "levelRepresentation": "zoom_levels",
      "connectionVisualization": "causal_arrows",
      "spatialLayout": "vertical_stack"
    }
  },
  "content": {
    "title": "Why Ice Floats",
    "centralQuestion": "Why does solid water float on liquid water?",
    "phenomenon": "Ice cubes float in a glass of water",
    "scaleLevels": [
      {
        "id": "observable",
        "label": "What We See",
        "scale": "macroscopic",
        "description": "Ice floats on top of liquid water",
        "keyEntities": ["ice cube", "liquid water"],
        "observables": ["Ice stays at surface", "About 10% above water"]
      },
      {
        "id": "bulk_property",
        "label": "Density Difference",
        "scale": "bulk",
        "description": "Ice is less dense than liquid water",
        "keyEntities": ["solid H₂O", "liquid H₂O"],
        "observables": ["Ice: 0.92 g/cm³", "Water: 1.00 g/cm³"]
      },
      {
        "id": "molecular",
        "label": "Molecular Arrangement",
        "scale": "molecular",
        "description": "Hydrogen bonding creates different structures",
        "keyEntities": ["H₂O molecules", "hydrogen bonds"],
        "observables": ["Crystal lattice vs. disordered liquid"]
      }
    ],
    "connections": [
      {
        "fromLevel": "molecular",
        "toLevel": "bulk_property",
        "mechanism": "crystal_lattice_spacing",
        "explanation": "In ice, hydrogen bonds lock molecules into a hexagonal lattice with empty space in the middle. This open structure takes up more volume than the disordered liquid."
      },
      {
        "fromLevel": "bulk_property",
        "toLevel": "observable",
        "mechanism": "buoyancy",
        "explanation": "Less dense objects float on more dense fluids. Since ice is 8% less dense than water, it floats with ~10% above the surface."
      }
    ],
    "macroObservation": "Ice floats on water",
    "microExplanation": "Hydrogen bonds force ice into an open crystalline structure with more space between molecules than liquid water, making it less dense."
  },
  "assessmentHooks": {
    "predict": "What would happen to aquatic life if ice sank?",
    "transfer": "Why does water expand when it freezes, potentially breaking pipes?"
  }
}
```

---

## Assessment Hooks

Assessment hooks are **standardized across all primitives** with three core types:

```typescript
interface AssessmentHooks {
  // What would happen if X changed?
  predict?: string;
  
  // How does this apply to a different context?
  transfer?: string;
  
  // Why does this work the way it does?
  explain?: string;
}
```

### Rationale for Standardization

| Hook | Cognitive Level | What It Tests |
|------|-----------------|---------------|
| **predict** | Application | Can the student apply the model to novel situations? |
| **transfer** | Transfer | Can the student recognize the same pattern in different domains? |
| **explain** | Understanding | Can the student articulate the underlying mechanism? |

This standardization means:
- LLM prompts always request the same three hooks
- Assessment UI components can be reused across primitives
- Question quality can be evaluated consistently

---

## Rendering Hints Vocabulary

Rendering hints use a **controlled vocabulary** per domain field. Adapters interpret these hints to determine visualization strategy.

### Chemistry Rendering Hints

| Hint | Valid Values | Used By |
|------|--------------|---------|
| `entityRepresentation` | `atom_simple`, `atom_with_orbitals`, `lewis_dot`, `ball_stick`, `space_filling` | How to draw atoms/molecules |
| `connectionVisualization` | `electron_sharing`, `ionic_transfer`, `single_bond`, `double_bond`, `hydrogen_bond` | How to show bonds |
| `spatialLayout` | `molecular_geometry`, `crystal_lattice`, `orbital_diagram`, `reaction_equation` | Overall arrangement |

### Physics Rendering Hints

| Hint | Valid Values | Used By |
|------|--------------|---------|
| `entityRepresentation` | `body_with_mass`, `point_particle`, `extended_body`, `field_source` | How to draw objects |
| `connectionVisualization` | `force_vectors`, `field_lines`, `energy_flow`, `momentum_transfer` | How to show interactions |
| `spatialLayout` | `free_body_diagram`, `motion_diagram`, `energy_bar_chart`, `circuit_schematic` | Overall arrangement |

### Biology Rendering Hints

| Hint | Valid Values | Used By |
|------|--------------|---------|
| `entityRepresentation` | `organism_icon`, `cell_diagram`, `molecule_simple`, `population_bubble` | How to draw organisms/structures |
| `connectionVisualization` | `labeled_arrows`, `energy_flow`, `signal_cascade`, `transport_channel` | How to show relationships |
| `spatialLayout` | `trophic_web`, `cell_cross_section`, `phylogenetic_tree`, `body_system` | Overall arrangement |

### Adapter Behavior

Adapters should:
1. **Check for recognized hints** and use them if present
2. **Fall back to sensible defaults** if hints are missing or unrecognized
3. **Log warnings** for unrecognized hint values (don't fail)

```typescript
// Example adapter logic
const entityStyle = schema.domain.renderingHints.entityRepresentation;

switch (entityStyle) {
  case 'atom_with_orbitals':
    renderWithOrbitals(entity);
    break;
  case 'atom_simple':
  default:
    renderSimpleSphere(entity);  // Fallback
    if (entityStyle && entityStyle !== 'atom_simple') {
      console.warn(`Unknown entityRepresentation: ${entityStyle}, using default`);
    }
}
```

---

## LLM Prompt Strategy

### One Prompt Per Primitive Type

Each primitive type has its **own prompt template** that stays consistent across domains. The prompt:

1. Defines the schema structure for that primitive
2. Provides domain-agnostic examples
3. Requests specific domain via parameters

### Example Prompt Template: Relational Mapping

```markdown
You are generating a Relational Mapping schema for educational content.

## Schema Structure
{full schema definition with field descriptions}

## Requirements
- primitive: "relational_mapping"
- pedagogicalIntent: {intent}
- domain.field: {field}
- domain.subtype: {subtype}

## Content Guidelines
- entities: 2-8 entities with clear properties relevant to the domain
- relationships: Explicit connections with mechanisms and explanations
- emergentProperties: What arises from the relationships (1-3)
- satisfiedConstraints: Domain-specific rules that hold

## Domain-Specific Guidance

### If chemistry:
- Include electronegativity, valence electrons for bonding
- Position atoms in 3D space with realistic geometry
- Use bond types: covalent, ionic, hydrogen, metallic

### If physics:
- Include mass, charge, or other relevant quantities
- Specify force directions and magnitudes with units
- Reference Newton's laws or conservation principles

### If biology:
- Include trophic levels, population sizes, or energy flows
- Specify interaction types: predation, competition, symbiosis
- Consider energy transfer efficiency

## Generate schema for:
Topic: {topic}
Grade Level: {grade_level}
Learning Objective: {objective}
```

### Prompt Per Domain vs. Prompt Per Primitive

| Approach | Pros | Cons |
|----------|------|------|
| **One prompt per primitive** (recommended) | Consistent structure, easier to maintain, domain handled via parameters | Slightly longer prompts with conditional guidance |
| **One prompt per domain** | More tailored examples | Explosion of prompts (4 primitives × 5 domains = 20 prompts), harder to maintain consistency |

**Recommendation:** Use one prompt per primitive with domain-conditional sections.

---

## Implementation Steps

### Phase 1: Core Infrastructure (Week 1-2)

1. **Define TypeScript types** for all primitives and schemas
   - BaseSchema, RelationalMappingSchema, StateTransformationSchema, etc.
   - DomainAdapter interface, RenderContext, AdapterResult

2. **Build the RendererRegistry class**
   - register(), resolve(), render() methods
   - Priority-based resolution logic
   - Change subscription for React integration

3. **Create generic fallback adapters**
   - D3 force-directed graph for relational_mapping
   - Flow diagram for state_transformation
   - Checklist visualization for constraint_satisfaction
   - Zoom/stack layout for scale_bridging

### Phase 2: Domain Adapters (Week 3-4)

4. **Chemistry: Molecular Bonding** (Three.js)
   - 3D molecule visualization with atom colors, radii
   - Electron density clouds showing polarity
   - Interactive rotation, zoom, atom selection

5. **Physics: Force Diagrams** (SVG)
   - Free body diagrams with force vectors
   - Color-coded by force type
   - Net force calculation display

6. **Biology: Ecological Interactions** (D3)
   - Food web with trophic levels
   - Energy transfer visualization
   - Draggable nodes

### Phase 3: React Integration (Week 5)

7. **PrimitiveRenderer component**
   - Takes schema as prop, handles adapter resolution
   - Cleanup on unmount

8. **useRegistry hook**
   - Subscribe to registry changes
   - Query available adapters

9. **Schema validation UI**
   - Show which adapter will be used
   - Display validation errors

### Phase 4: LLM Integration (Week 6)

10. **Create prompt templates** for each primitive type

11. **Build schema validation** for LLM output

12. **Test generation** across domains

---

## Recommended Directory Structure

```
src/
├── lib/
│   └── primitives/
│       ├── types.ts                 # All TypeScript interfaces
│       ├── registry.ts              # RendererRegistry class
│       ├── schemas/                 # Schema validation (Zod)
│       │   ├── base.ts
│       │   ├── relational-mapping.ts
│       │   ├── state-transformation.ts
│       │   ├── constraint-satisfaction.ts
│       │   └── scale-bridging.ts
│       ├── hints/                   # Rendering hint vocabularies
│       │   ├── chemistry.ts
│       │   ├── physics.ts
│       │   └── biology.ts
│       ├── adapters/
│       │   ├── index.ts             # Registration function
│       │   ├── chemistry/
│       │   │   ├── molecular-bonding.ts
│       │   │   └── reaction-mechanism.ts
│       │   ├── physics/
│       │   │   ├── force-body.ts
│       │   │   └── circuit.ts
│       │   ├── biology/
│       │   │   ├── ecology.ts
│       │   │   └── cellular.ts
│       │   └── fallbacks/
│       │       ├── relational-mapping.ts
│       │       ├── state-transformation.ts
│       │       ├── constraint-satisfaction.ts
│       │       └── scale-bridging.ts
│       └── index.ts                 # Public exports
├── components/
│   └── primitives/
│       ├── PrimitiveRenderer.tsx    # Main render component
│       ├── SchemaDebugger.tsx       # Shows adapter resolution
│       └── AssessmentPanel.tsx      # Displays assessment hooks
├── hooks/
│   └── useRegistry.ts               # Registry subscription hook
└── prompts/
    ├── relational-mapping.md
    ├── state-transformation.md
    ├── constraint-satisfaction.md
    └── scale-bridging.md
```

---

## Key Design Decisions

1. **Schemas encode pedagogical intent, not visual output** — this is what makes the system scalable

2. **Domain in renderingHints, not schema structure** — LLM prompt stays consistent

3. **Priority-based resolution with fallbacks** — new content renders immediately with generic adapter

4. **Adapters are self-contained** — each adapter owns its rendering logic, cleanup, and validation

5. **Assessment hooks are standardized** — predict/transfer/explain work across all primitives

6. **Rendering hints use controlled vocabulary** — adapters know what to expect, can fall back gracefully

---

## Next Steps

1. Review this architecture with the team
2. Validate schema structure against existing content types
3. Prototype one adapter end-to-end (recommend: chemistry molecular bonding)
4. Define LLM prompt templates for each primitive type
5. Build schema validation using Zod or similar
6. Determine if additional primitive types are needed beyond the core four