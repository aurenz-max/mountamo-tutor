# Chemistry Education Visual Primitives
## Product Requirements Document

### Overview

This document defines the complete set of interactive visual primitives required for a comprehensive chemistry education platform spanning middle school through AP/undergraduate levels. Each primitive is a reusable, interactive component that can be embedded in problems, explanations, and assessments across multiple topic areas.

### Design Principles

1. **Scientific Accuracy**: All visualizations must reflect accepted scientific models with appropriate caveats about model limitations
2. **Scale Awareness**: Clearly distinguish macroscopic, particulate, and symbolic representations
3. **Safety Consciousness**: Include safety information where relevant (hazard symbols, proper techniques)
4. **Progressive Complexity**: Simple modes for introductory learners, advanced options for deeper study
5. **Multiple Representations**: Link macroscopic observations to particulate explanations to symbolic notation

---

## Primitives by Domain

### 1. Atomic Structure & The Periodic Table

#### 1.1 Periodic Table Explorer

**Description**: An interactive periodic table with selectable elements displaying comprehensive property data, trend visualizations, and element groupings. The foundational reference tool for all chemistry study.

**Core Interactions**:
- Click element to view detailed information card
- Hover for quick property preview
- Color-code by property (electronegativity, atomic radius, ionization energy, etc.)
- Highlight element groups, periods, blocks
- Filter by category (metals, nonmetals, metalloids)
- Compare multiple elements side-by-side
- Animate trends across periods/groups

**Use Cases**:
- Element identification (Middle School)
- Periodic trends (High School)
- Electron configuration patterns (High School)
- Property prediction (AP/College)
- Research reference (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `colorScheme` | enum | Property to color by |
| `selectedElements` | array | Currently selected elements |
| `highlightGroups` | array | Groups to emphasize |
| `showCategories` | boolean | Display metal/nonmetal regions |
| `detailLevel` | enum | `basic`, `intermediate`, `advanced` |
| `interactionMode` | enum | `select`, `compare`, `quiz` |
| `showTrendArrows` | boolean | Display trend direction indicators |

---

#### 1.2 Atom Builder / Bohr Model

**Description**: An interactive atomic model builder where students construct atoms by adding protons, neutrons, and electrons. Supports Bohr model visualization with electron shells.

**Core Interactions**:
- Drag protons and neutrons to nucleus
- Add electrons to shells (with capacity limits)
- System identifies resulting element/ion/isotope
- Animate electron transitions between energy levels
- Display resulting charge and mass number
- Show energy level diagram alongside
- Toggle between Bohr model and energy level diagram

**Use Cases**:
- Atomic structure introduction (Middle School)
- Isotopes and ions (Middle School/High School)
- Electron configuration (High School)
- Energy level transitions (High School)
- Emission spectra connection (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `targetElement` | number | Atomic number to build |
| `showShellLabels` | boolean | Display n=1, n=2, etc. |
| `maxShells` | number | Number of shells available |
| `allowIsotopes` | boolean | Enable neutron variation |
| `allowIons` | boolean | Enable charge variation |
| `showEnergyDiagram` | boolean | Display parallel energy levels |
| `animateTransitions` | boolean | Show electron jumps |

---

#### 1.3 Electron Configuration Builder

**Description**: A tool for building and visualizing electron configurations using orbital notation, electron configuration notation, and orbital diagrams (boxes with arrows).

**Core Interactions**:
- Fill orbitals following aufbau principle
- Drag electrons into orbital boxes
- System validates Hund's rule and Pauli exclusion
- Toggle between notation styles
- Highlight valence electrons
- Show noble gas shorthand
- Animate filling order

**Use Cases**:
- Electron configuration (High School)
- Orbital concepts (High School)
- Periodic table connection (High School)
- Magnetic properties (AP/College)
- Quantum numbers (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `element` | number | Target atomic number |
| `displayMode` | enum | `orbitalDiagram`, `notation`, `both` |
| `showFillingOrder` | boolean | Display aufbau diagram |
| `validateRules` | boolean | Enforce configuration rules |
| `allowExceptions` | boolean | Handle Cr, Cu, etc. |
| `showQuantumNumbers` | boolean | Display n, l, ml, ms |
| `highlightValence` | boolean | Emphasize outer electrons |

---

#### 1.4 Atomic/Ionic Radius Visualizer

**Description**: A comparative visualization showing relative sizes of atoms and ions, demonstrating periodic trends and the effect of gaining/losing electrons.

**Core Interactions**:
- Select elements to compare
- Toggle between atomic and ionic radii
- Arrange by period or group
- Overlay on periodic table
- Animate ionization size change
- Display numerical values on hover

**Use Cases**:
- Periodic trends (High School)
- Ion formation (High School)
- Isoelectronic series (AP/College)
- Lattice energy concepts (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `elements` | array | Elements to display |
| `radiusType` | enum | `atomic`, `ionic`, `compare` |
| `arrangement` | enum | `period`, `group`, `custom` |
| `showScale` | boolean | Display pm measurements |
| `showTrend` | boolean | Indicate trend direction |
| `animateIonization` | boolean | Show size change on ion formation |

---

#### 1.5 Emission Spectrum Viewer

**Description**: An interactive display of atomic emission and absorption spectra, linking electron transitions to spectral lines.

**Core Interactions**:
- Select element to view spectrum
- Click spectral lines to see corresponding transition
- Compare emission vs absorption spectra
- Overlay multiple element spectra
- Zoom into specific wavelength regions
- Connect to Bohr model transitions
- Calculate energy from wavelength

**Use Cases**:
- Light and color (Middle School)
- Atomic structure evidence (High School)
- Quantum energy levels (High School)
- Spectroscopy introduction (AP/College)
- Astronomical applications (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `element` | string | Element to display |
| `spectrumType` | enum | `emission`, `absorption`, `both` |
| `wavelengthRange` | [min, max] | Visible or extended range |
| `showTransitions` | boolean | Link to energy level diagram |
| `showWavelengths` | boolean | Label line wavelengths |
| `compareElements` | array | Multiple spectra overlay |
| `showContinuum` | boolean | Display continuous spectrum reference |

---

### 2. Chemical Bonding & Molecular Structure

#### 2.1 Lewis Structure Builder

**Description**: A tool for constructing Lewis dot structures showing valence electrons, bonds, and lone pairs. Validates octet rule and formal charges.

**Core Interactions**:
- Select atoms to add to canvas
- Draw single, double, triple bonds
- Add lone pairs to atoms
- System calculates and displays formal charges
- Validate octet/duet rule compliance
- Show resonance structures
- Convert to structural formula

**Use Cases**:
- Introduction to bonding (High School)
- Molecular structure (High School)
- Formal charge (High School/AP)
- Resonance (AP/College)
- Reactivity prediction (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableAtoms` | array | Atoms student can use |
| `targetMolecule` | string | Expected structure |
| `showFormalCharge` | boolean | Display formal charges |
| `validateOctet` | boolean | Check rule compliance |
| `allowResonance` | boolean | Enable resonance arrows |
| `showLonePairs` | boolean | Display non-bonding electrons |
| `guidedMode` | boolean | Step-by-step assistance |

---

#### 2.2 3D Molecular Viewer

**Description**: A three-dimensional, rotatable display of molecular structures supporting multiple representation styles (ball-and-stick, space-filling, wireframe).

**Core Interactions**:
- Rotate molecule freely (orbit)
- Zoom in/out
- Toggle representation style
- Measure bond lengths and angles
- Identify atoms on click
- Highlight functional groups
- Animate vibrations and rotations
- Compare multiple molecules

**Use Cases**:
- Molecular geometry (High School)
- VSEPR theory (High School)
- Organic structures (High School/AP)
- Protein structure (AP/College)
- Stereochemistry (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `molecule` | string | Molecule identifier or structure file |
| `displayStyle` | enum | `ballStick`, `spaceFilling`, `wireframe`, `cartoon` |
| `showLabels` | boolean | Display atom labels |
| `showBondLengths` | boolean | Display measurements |
| `showBondAngles` | boolean | Display angle measurements |
| `highlightGroups` | array | Functional groups to emphasize |
| `allowMeasure` | boolean | Enable measurement tool |
| `symmetryDisplay` | boolean | Show symmetry elements |

---

#### 2.3 VSEPR Geometry Explorer

**Description**: An interactive tool demonstrating how electron domains determine molecular geometry. Shows the connection between Lewis structure and 3D shape.

**Core Interactions**:
- Set number of bonding and lone pairs
- Watch geometry adjust in real-time
- Rotate resulting shape
- Display bond angles
- Identify geometry name and electron geometry
- Compare ideal vs actual angles
- Show dipole moment direction

**Use Cases**:
- Molecular shapes (High School)
- VSEPR theory (High School)
- Polarity (High School)
- Hybridization connection (AP/College)
- Physical properties (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `bondingPairs` | number | Number of bonding domains |
| `lonePairs` | number | Number of lone pair domains |
| `centralAtom` | string | Central atom identity |
| `showElectronGeometry` | boolean | Display vs molecular geometry |
| `showBondAngles` | boolean | Display angle values |
| `showDipole` | boolean | Display molecular dipole |
| `idealVsActual` | boolean | Compare ideal angles |

---

#### 2.4 Orbital Hybridization Visualizer

**Description**: A tool showing how atomic orbitals combine to form hybrid orbitals, with 3D visualization of orbital shapes and orientations.

**Core Interactions**:
- Select hybridization type (sp, sp², sp³, sp³d, sp³d²)
- Watch orbital mixing animation
- Rotate hybrid orbital set
- Connect to molecular geometry
- Show energy level changes
- Overlay on molecular structure
- Compare unhybridized vs hybridized

**Use Cases**:
- Hybridization theory (High School/AP)
- Bonding in organic molecules (AP/College)
- Molecular orbital theory introduction (AP/College)
- Geometry explanation (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `hybridization` | enum | `sp`, `sp2`, `sp3`, `sp3d`, `sp3d2` |
| `showAtomicOrbitals` | boolean | Display original orbitals |
| `showMixingAnimation` | boolean | Animate hybridization |
| `showGeometry` | boolean | Connect to VSEPR shape |
| `showEnergyDiagram` | boolean | Display orbital energies |
| `molecule` | string | Example molecule to display |

---

#### 2.5 Electronegativity & Polarity Tool

**Description**: A visualization of bond polarity and molecular polarity based on electronegativity differences. Shows partial charges and dipole moments.

**Core Interactions**:
- Select two atoms for bond polarity analysis
- Display electronegativity values and difference
- Classify bond type (nonpolar, polar, ionic)
- Show partial charge symbols (δ+, δ-)
- Draw dipole arrow
- For molecules: show individual bond dipoles
- Calculate net molecular dipole

**Use Cases**:
- Chemical bonding types (High School)
- Molecular polarity (High School)
- Intermolecular forces connection (High School)
- Solubility prediction (High School/AP)
- Physical properties (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `atoms` | [string, string] | Atoms in bond |
| `molecule` | string | Full molecule for analysis |
| `showENValues` | boolean | Display electronegativity numbers |
| `showPartialCharges` | boolean | Display δ+/δ- |
| `showDipoleArrow` | boolean | Display bond/molecular dipole |
| `showClassification` | boolean | Label bond type |
| `thresholds` | object | Cutoffs for classification |

---

#### 2.6 Ionic Compound Builder

**Description**: A tool for building ionic compounds from cations and anions, showing crystal lattice structure and formula unit determination.

**Core Interactions**:
- Select cation and anion
- System determines charge balance
- Generate empirical formula
- Build 3D crystal lattice
- Rotate and zoom lattice
- Highlight coordination number
- Calculate lattice energy factors

**Use Cases**:
- Ionic bonding (Middle School/High School)
- Formula writing (High School)
- Crystal structures (High School/AP)
- Lattice energy (AP/College)
- Solid state chemistry (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `cation` | string | Positive ion |
| `anion` | string | Negative ion |
| `showCharges` | boolean | Display ion charges |
| `showFormula` | boolean | Display empirical formula |
| `showLattice` | boolean | Display 3D structure |
| `latticeType` | enum | Crystal structure type |
| `showCoordination` | boolean | Highlight coordination |

---

#### 2.7 Metallic Bonding Model

**Description**: A visualization of the electron sea model of metallic bonding, showing delocalized electrons and explaining metallic properties.

**Core Interactions**:
- Adjust number of metal atoms
- Animate electron delocalization
- Apply stress to show malleability
- Apply voltage to show conductivity
- Heat to show thermal conductivity
- Compare different metals

**Use Cases**:
- Metallic bonding (High School)
- Properties of metals (High School)
- Conductivity explanation (High School)
- Alloys (High School/AP)
- Band theory introduction (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `metal` | string | Metal element |
| `gridSize` | number | Number of atoms displayed |
| `showElectronSea` | boolean | Animate delocalized electrons |
| `demonstrateProperty` | enum | `none`, `malleability`, `conductivity`, `thermal` |
| `animationSpeed` | number | Electron movement speed |

---

### 3. Chemical Reactions & Stoichiometry

#### 3.1 Equation Balancer

**Description**: An interactive tool for balancing chemical equations with coefficient input, atom counting, and visual verification.

**Core Interactions**:
- Enter or select chemical equation
- Adjust coefficients for each species
- Real-time atom count display
- Visual balance indicator (scale metaphor)
- Step-by-step guided balancing mode
- Show conservation of mass
- Classify reaction type

**Use Cases**:
- Introduction to balancing (Middle School)
- Stoichiometry foundation (High School)
- Reaction types (High School)
- Redox balancing (High School/AP)
- Complex equations (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `equation` | string | Unbalanced equation |
| `showAtomCount` | boolean | Display element tallies |
| `showBalance` | boolean | Display balance indicator |
| `guidedMode` | boolean | Step-by-step assistance |
| `allowHints` | boolean | Provide balancing hints |
| `reactionType` | enum | Classify reaction |
| `showParticles` | boolean | Particulate visualization |

---

#### 3.2 Particle-Level Reaction Animator

**Description**: A dynamic visualization showing chemical reactions at the molecular level, with particles breaking and forming bonds.

**Core Interactions**:
- Watch reactant particles collide
- See bonds break and form
- Observe product formation
- Adjust reaction conditions (temperature)
- Count particles before and after
- Slow motion for complex reactions
- Toggle between continuous and stepwise

**Use Cases**:
- Conservation of matter (Middle School)
- Reaction mechanisms concept (High School)
- Collision theory (High School)
- Activation energy (High School/AP)
- Mechanism visualization (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Chemical equation |
| `animationSpeed` | number | Playback speed |
| `showBondBreaking` | boolean | Emphasize bond changes |
| `particleCount` | number | Number of particle sets |
| `showEnergy` | boolean | Display energy changes |
| `temperature` | number | Affects collision frequency |
| `stepByStep` | boolean | Pause at each stage |

---

#### 3.3 Stoichiometry Calculator

**Description**: A structured calculator for mole-mass-particle conversions and stoichiometric calculations with dimensional analysis visualization.

**Core Interactions**:
- Enter known quantity and units
- Select conversion pathway
- Display dimensional analysis setup
- Show conversion factors used
- Calculate unknown quantity
- Identify limiting reagent
- Calculate theoretical yield

**Use Cases**:
- Mole concept (High School)
- Molar mass calculations (High School)
- Stoichiometric calculations (High School)
- Limiting reagent (High School)
- Percent yield (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `equation` | string | Balanced equation |
| `knownQuantity` | object | {value, unit, substance} |
| `targetSubstance` | string | What to solve for |
| `showDimensionalAnalysis` | boolean | Display unit conversion chain |
| `showMolarMass` | boolean | Display molar mass values |
| `limitingReagentMode` | boolean | Multiple reactant inputs |
| `showYield` | boolean | Calculate percent yield |

---

#### 3.4 Limiting Reagent Visualizer

**Description**: A visual representation of limiting reagent concept using particle diagrams showing complete reaction and excess reagent remaining.

**Core Interactions**:
- Set initial amounts of reactants
- Watch reaction proceed
- See limiting reagent consumed
- Count excess remaining
- Display theoretical yield
- Adjust amounts to change limiting reagent
- Calculate percent excess

**Use Cases**:
- Limiting reagent concept (High School)
- Excess reagent (High School)
- Theoretical yield (High School)
- Industrial applications (AP/College)
- Optimization problems (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Balanced equation |
| `reactantAmounts` | object | Initial moles of each |
| `showParticles` | boolean | Particle diagram display |
| `showCalculations` | boolean | Display math work |
| `animateReaction` | boolean | Show consumption |
| `identifyLimiting` | boolean | Highlight limiting reagent |

---

#### 3.5 Reaction Type Classifier

**Description**: A tool for identifying and classifying chemical reactions by type (synthesis, decomposition, single replacement, double replacement, combustion, redox).

**Core Interactions**:
- Enter or select chemical equation
- System analyzes reaction pattern
- Identify reaction type with explanation
- Show general pattern for type
- Predict products for given reactants
- Highlight atoms that change

**Use Cases**:
- Reaction types (Middle School/High School)
- Predicting products (High School)
- Activity series application (High School)
- Solubility rules application (High School)
- Reaction patterns (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `equation` | string | Reaction to classify |
| `showPattern` | boolean | Display general form |
| `showExplanation` | boolean | Explain classification |
| `predictMode` | boolean | Give reactants, predict products |
| `showActivitySeries` | boolean | Reference for single replacement |
| `showSolubilityRules` | boolean | Reference for double replacement |

---

#### 3.6 Oxidation State Tracker

**Description**: A tool for assigning and tracking oxidation states in compounds and reactions, identifying oxidation and reduction.

**Core Interactions**:
- Enter compound or reaction
- System assigns oxidation states
- Show rules applied for assignment
- Track oxidation state changes
- Identify oxidizing and reducing agents
- Balance redox equations (half-reaction method)
- Show electron transfer

**Use Cases**:
- Oxidation states (High School)
- Redox identification (High School)
- Redox balancing (High School/AP)
- Electrochemistry foundation (AP/College)
- Organic redox (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `species` | string | Compound or reaction |
| `showRules` | boolean | Display assignment rules |
| `showChanges` | boolean | Highlight state changes |
| `identifyAgents` | boolean | Label oxidizing/reducing agents |
| `balanceMode` | boolean | Half-reaction balancing |
| `showElectrons` | boolean | Show electron transfer |

---

### 4. States of Matter & Thermochemistry

#### 4.1 Phase Diagram Explorer

**Description**: An interactive pressure-temperature phase diagram showing phase boundaries, triple point, and critical point with state identification.

**Core Interactions**:
- Click to identify phase at any P-T point
- Drag along paths to observe phase changes
- Zoom into regions of interest
- Compare different substances
- Animate heating/cooling curves
- Identify triple and critical points
- Show corresponding heating curve

**Use Cases**:
- States of matter (Middle School/High School)
- Phase changes (High School)
- Pressure effects (High School)
- Critical phenomena (AP/College)
- Supercritical fluids (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `substance` | string | Compound to display |
| `showLabels` | boolean | Label phases |
| `showPoints` | boolean | Mark triple/critical points |
| `interactionMode` | enum | `identify`, `trace`, `compare` |
| `showHeatingCurve` | boolean | Linked heating curve |
| `pressureRange` | [min, max] | Y-axis bounds |
| `temperatureRange` | [min, max] | X-axis bounds |

---

#### 4.2 Heating/Cooling Curve

**Description**: A temperature vs. heat added graph showing phase transitions with plateaus, linked to particle behavior and energy changes.

**Core Interactions**:
- Watch temperature change with heat addition
- Observe plateaus during phase changes
- Click regions to see particle animation
- Display enthalpy values for transitions
- Label phase regions
- Calculate heat for segments
- Compare different substances

**Use Cases**:
- Phase changes (Middle School/High School)
- Heat capacity (High School)
- Enthalpy of fusion/vaporization (High School)
- Calorimetry connection (High School/AP)
- Thermodynamics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `substance` | string | Compound to display |
| `startTemp` | number | Initial temperature |
| `endTemp` | number | Final temperature |
| `showParticles` | boolean | Particle animation inset |
| `showEnthalpy` | boolean | Display ΔH values |
| `showCalculations` | boolean | Heat calculation panel |
| `animationMode` | boolean | Animate curve drawing |

---

#### 4.3 Kinetic Molecular Theory Simulator

**Description**: A particle simulation demonstrating gas behavior, including the effects of temperature, pressure, and volume on particle motion.

**Core Interactions**:
- Adjust temperature (particle speed)
- Adjust volume (container size)
- Observe pressure changes (collision frequency)
- Display Maxwell-Boltzmann distribution
- Track individual particle
- Show RMS speed calculation
- Compare different gases (mass effect)

**Use Cases**:
- Gas behavior (Middle School/High School)
- Kinetic molecular theory (High School)
- Gas laws foundation (High School)
- Maxwell-Boltzmann distribution (AP/College)
- Effusion and diffusion (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `gas` | string | Gas identity (affects mass) |
| `temperature` | number | Temperature in K |
| `volume` | number | Container volume |
| `particleCount` | number | Number of particles |
| `showDistribution` | boolean | Display speed distribution |
| `showPressure` | boolean | Calculate and display pressure |
| `traceParticle` | boolean | Follow one particle |

---

#### 4.4 Gas Law Calculator & Visualizer

**Description**: An interactive tool for exploring gas law relationships (Boyle's, Charles's, Gay-Lussac's, Combined, Ideal) with visual particle representation.

**Core Interactions**:
- Select gas law to explore
- Adjust variables with sliders
- Watch particle simulation respond
- Plot P-V, V-T, or P-T graphs
- Calculate unknown variables
- Show real vs ideal deviations
- Display law equation

**Use Cases**:
- Gas laws introduction (High School)
- Ideal gas law (High School)
- Gas law calculations (High School)
- Real gases (AP/College)
- PV work (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `gasLaw` | enum | `boyles`, `charles`, `gayLussac`, `combined`, `ideal` |
| `variables` | object | P, V, T, n values |
| `showSimulation` | boolean | Particle visualization |
| `showGraph` | boolean | Plot relationships |
| `showCalculation` | boolean | Display work |
| `units` | object | Unit selections |
| `realGasCorrection` | boolean | Van der Waals |

---

#### 4.5 Enthalpy Diagram Builder

**Description**: An energy diagram showing enthalpy changes in reactions, including activation energy, transition states, and ΔH visualization.

**Core Interactions**:
- Set reactant and product energy levels
- Add activation energy barrier
- Draw reaction pathway
- Show ΔH (exothermic vs endothermic)
- Add catalyst pathway for comparison
- Label transition state
- Calculate energies from values

**Use Cases**:
- Energy in reactions (High School)
- Exothermic/endothermic (High School)
- Activation energy (High School)
- Catalysis (High School/AP)
- Reaction mechanisms (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reactantEnergy` | number | Starting energy level |
| `productEnergy` | number | Final energy level |
| `activationEnergy` | number | Ea value |
| `showCatalyst` | boolean | Display catalyzed pathway |
| `catalystEa` | number | Catalyzed activation energy |
| `showLabels` | boolean | Label all parts |
| `showDeltaH` | boolean | Display enthalpy change |

---

#### 4.6 Hess's Law Calculator

**Description**: A tool for calculating enthalpy changes using Hess's Law, showing how to combine reactions to find unknown ΔH values.

**Core Interactions**:
- Enter target reaction
- Input known reactions with ΔH values
- Manipulate reactions (reverse, multiply)
- Combine to match target
- Verify cancellation of intermediates
- Sum ΔH values
- Show step-by-step solution

**Use Cases**:
- Hess's Law (High School/AP)
- Standard enthalpy calculations (AP/College)
- Formation reactions (AP/College)
- Thermochemical cycles (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `targetReaction` | string | Goal reaction |
| `givenReactions` | array | Known reactions with ΔH |
| `showManipulations` | boolean | Display transformations |
| `showCancellation` | boolean | Highlight canceling species |
| `guidedMode` | boolean | Step-by-step assistance |
| `showSum` | boolean | Display final calculation |

---

#### 4.7 Calorimetry Simulator

**Description**: A virtual calorimeter for measuring heat changes in reactions and physical processes, with calculation support.

**Core Interactions**:
- Set up calorimeter (type, contents)
- Add reactants or hot/cold objects
- Record temperature changes
- Calculate heat transfer (q = mcΔT)
- Determine specific heat or ΔH
- Account for heat capacity of calorimeter
- Compare bomb vs coffee cup calorimetry

**Use Cases**:
- Heat and temperature (Middle School/High School)
- Specific heat (High School)
- Enthalpy of reaction (High School/AP)
- Calorimetry calculations (High School/AP)
- Experimental design (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `calorimeterType` | enum | `coffeeCup`, `bomb` |
| `contents` | object | Substance, mass, initial temp |
| `addedSubstance` | object | What is being added |
| `showCalculation` | boolean | Display q = mcΔT |
| `showGraph` | boolean | Temperature vs time |
| `includeHeatCapacity` | boolean | Account for calorimeter |

---

### 5. Solutions & Equilibrium

#### 5.1 Solution Preparation Tool

**Description**: An interactive tool for calculating and visualizing solution preparation, including molarity, dilution, and percent composition calculations.

**Core Interactions**:
- Enter target concentration and volume
- Calculate mass or volume of solute needed
- Animate dissolution process
- Perform dilution calculations (M₁V₁ = M₂V₂)
- Show particle-level concentration
- Convert between concentration units
- Display solution preparation steps

**Use Cases**:
- Solutions introduction (Middle School/High School)
- Molarity calculations (High School)
- Dilution (High School)
- Solution preparation (High School/AP)
- Lab preparation (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `solute` | string | Dissolved substance |
| `solvent` | string | Dissolving medium |
| `targetConcentration` | number | Desired molarity |
| `targetVolume` | number | Desired volume |
| `calculationType` | enum | `preparation`, `dilution` |
| `showParticles` | boolean | Particle visualization |
| `showProcedure` | boolean | Step-by-step instructions |

---

#### 5.2 Solubility Curve Grapher

**Description**: An interactive graph showing solubility vs temperature relationships for various solutes, with saturation analysis.

**Core Interactions**:
- Select solutes to display
- Read solubility at any temperature
- Identify saturation status for given conditions
- Predict crystallization on cooling
- Compare different substances
- Distinguish gases vs solids behavior
- Calculate mass to dissolve/precipitate

**Use Cases**:
- Solubility concepts (Middle School/High School)
- Saturation (High School)
- Crystallization (High School)
- Supersaturation (High School/AP)
- Purification techniques (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `solutes` | array | Substances to graph |
| `temperatureRange` | [min, max] | X-axis bounds |
| `showSaturationPoint` | boolean | Mark current conditions |
| `currentConditions` | object | Temperature, mass, volume |
| `predictOutcome` | boolean | Show crystallization/dissolution |
| `showGases` | boolean | Include gas solubility |

---

#### 5.3 Equilibrium Simulator

**Description**: A dynamic simulation showing the approach to chemical equilibrium, with concentration changes over time and the constant ratio at equilibrium.

**Core Interactions**:
- Start from reactants only
- Watch concentrations change over time
- See equilibrium establishment
- Calculate Q and K at any point
- Disturb equilibrium (add/remove species)
- Observe Le Chatelier's response
- Display concentration vs time graphs

**Use Cases**:
- Equilibrium concept (High School)
- Dynamic equilibrium (High School)
- Equilibrium constant (High School/AP)
- Le Chatelier's principle (High School/AP)
- Q vs K analysis (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Equilibrium reaction |
| `initialConcentrations` | object | Starting [A], [B], etc. |
| `equilibriumConstant` | number | K value |
| `showGraph` | boolean | Concentration vs time |
| `showParticles` | boolean | Particle animation |
| `allowDisturbance` | boolean | Enable Le Chatelier testing |
| `showQvsK` | boolean | Display ratio comparison |

---

#### 5.4 Le Chatelier's Principle Explorer

**Description**: A focused tool for exploring how equilibrium systems respond to stress (concentration, pressure, temperature changes).

**Core Interactions**:
- Select equilibrium system
- Apply stress (add/remove reactant/product)
- Change pressure or volume
- Change temperature
- Predict shift direction
- Watch system respond
- Explain response based on principle

**Use Cases**:
- Le Chatelier's principle (High School)
- Equilibrium shifts (High School)
- Industrial applications (High School/AP)
- Optimization (AP/College)
- Buffer action connection (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Equilibrium reaction |
| `stressType` | enum | `concentration`, `pressure`, `temperature` |
| `deltaH` | number | Reaction enthalpy (for temp changes) |
| `showPrediction` | boolean | Predict before showing |
| `showExplanation` | boolean | Explain why shift occurs |
| `showGraph` | boolean | Before/after concentrations |

---

#### 5.5 ICE Table Builder

**Description**: A structured tool for setting up and solving equilibrium ICE (Initial, Change, Equilibrium) tables.

**Core Interactions**:
- Enter reaction and initial concentrations
- Set up change row with variables
- Express equilibrium in terms of x
- Write K expression
- Solve for x
- Calculate equilibrium concentrations
- Verify with K value

**Use Cases**:
- Equilibrium calculations (High School/AP)
- Weak acid/base equilibria (AP/College)
- Solubility equilibria (AP/College)
- Complex equilibria (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Equilibrium reaction |
| `initialConcentrations` | object | Starting values |
| `Kvalue` | number | Equilibrium constant |
| `guidedMode` | boolean | Step-by-step assistance |
| `showKExpression` | boolean | Display K formula |
| `allowApproximations` | boolean | For weak acid/base |
| `checkAnswer` | boolean | Verify final values |

---

#### 5.6 pH Scale & Calculator

**Description**: An interactive pH scale with calculation tools for pH, pOH, [H⁺], and [OH⁻] conversions, including common substance references.

**Core Interactions**:
- Enter any one value, calculate others
- Place substances on pH scale
- Show relationship between pH and [H⁺]
- Calculate pH of strong acids/bases
- Calculate pH of weak acids/bases (with Ka)
- Show buffer calculations
- Display common substance pH values

**Use Cases**:
- Acids and bases introduction (Middle School/High School)
- pH calculations (High School)
- Strong vs weak acids (High School/AP)
- Buffer chemistry (AP/College)
- Titration connection (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inputType` | enum | `pH`, `pOH`, `H`, `OH` |
| `inputValue` | number | Known value |
| `showScale` | boolean | Display pH scale |
| `showCommonSubstances` | boolean | Reference substances |
| `calculationType` | enum | `simple`, `weakAcid`, `buffer` |
| `Ka` | number | For weak acid calculations |
| `showAllValues` | boolean | Display all four values |

---

#### 5.7 Titration Simulator

**Description**: An interactive titration simulation with burette, pH curve generation, and equivalence point identification.

**Core Interactions**:
- Select acid and base (strong/weak combinations)
- Control addition rate from burette
- Watch pH change in real-time
- Generate titration curve
- Identify equivalence point
- Select appropriate indicator
- Calculate unknowns from data

**Use Cases**:
- Neutralization (High School)
- Titration technique (High School)
- Titration curves (High School/AP)
- Indicator selection (AP/College)
- Polyprotic titrations (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `analyte` | object | Acid/base being analyzed |
| `titrant` | object | Solution in burette |
| `analyteVolume` | number | Starting volume |
| `titrantConcentration` | number | Known concentration |
| `showCurve` | boolean | Display pH vs volume |
| `availableIndicators` | array | Indicator options |
| `showEquivalencePoint` | boolean | Mark on curve |

---

#### 5.8 Buffer Solution Analyzer

**Description**: A tool for understanding and calculating buffer chemistry, including Henderson-Hasselbalch calculations and buffer capacity.

**Core Interactions**:
- Select weak acid/conjugate base pair
- Set concentrations
- Calculate buffer pH
- Add strong acid or base
- Watch pH resist change
- Calculate buffer capacity
- Compare to unbuffered solution

**Use Cases**:
- Buffer introduction (High School/AP)
- Henderson-Hasselbalch equation (AP/College)
- Buffer capacity (AP/College)
- Biological buffers (AP/College)
- Buffer preparation (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `weakAcid` | string | Buffer acid component |
| `conjugateBase` | string | Buffer base component |
| `concentrations` | object | [HA] and [A⁻] |
| `Ka` | number | Acid dissociation constant |
| `showHH` | boolean | Display Henderson-Hasselbalch |
| `addAcidBase` | boolean | Allow stress testing |
| `showCapacity` | boolean | Calculate buffer capacity |

---

### 6. Kinetics

#### 6.1 Reaction Rate Grapher

**Description**: A tool for plotting concentration vs time data and determining reaction rates, including instantaneous and average rate calculations.

**Core Interactions**:
- Input concentration-time data
- Plot [A] vs time graph
- Draw tangent for instantaneous rate
- Calculate average rate between points
- Determine initial rate
- Compare different reaction conditions
- Show rate = -Δ[A]/Δt relationship

**Use Cases**:
- Reaction rates introduction (High School)
- Rate calculations (High School/AP)
- Rate laws (AP/College)
- Experimental kinetics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `data` | array | Time, concentration pairs |
| `species` | string | Which species is tracked |
| `showTangent` | boolean | Draw instantaneous rate |
| `showAverageRate` | boolean | Calculate average rate |
| `compareConditions` | array | Multiple data sets |
| `rateType` | enum | `instantaneous`, `average`, `initial` |

---

#### 6.2 Rate Law Determiner

**Description**: A tool for determining rate laws from experimental initial rate data using the method of initial rates.

**Core Interactions**:
- Enter initial rate data table
- Select trials to compare
- Determine order for each reactant
- Write rate law expression
- Calculate rate constant k
- Check units of k
- Verify with additional trials

**Use Cases**:
- Rate law determination (AP/College)
- Reaction order (AP/College)
- Method of initial rates (AP/College)
- Experimental design (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `trials` | array | Experimental data rows |
| `reactants` | array | Species to determine order |
| `showComparison` | boolean | Highlight ratio calculations |
| `showRateLaw` | boolean | Display final rate law |
| `calculateK` | boolean | Determine rate constant |
| `guidedMode` | boolean | Step-by-step process |

---

#### 6.3 Integrated Rate Law Plotter

**Description**: A tool for analyzing concentration-time data using integrated rate laws to determine reaction order graphically.

**Core Interactions**:
- Input [A] vs time data
- Plot [A] vs t, ln[A] vs t, 1/[A] vs t
- Determine which plot is linear
- Identify reaction order
- Calculate k from slope
- Calculate half-life
- Predict concentration at time t

**Use Cases**:
- Integrated rate laws (AP/College)
- Graphical order determination (AP/College)
- Half-life calculations (AP/College)
- Radioactive decay connection (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `data` | array | Time, concentration pairs |
| `showAllPlots` | boolean | Display all three graphs |
| `highlightLinear` | boolean | Identify linear plot |
| `showR2` | boolean | Display correlation |
| `calculateK` | boolean | Determine from slope |
| `calculateHalfLife` | boolean | Show t₁/₂ |
| `predictConcentration` | boolean | Enable prediction tool |

---

#### 6.4 Collision Theory Simulator

**Description**: An animation demonstrating collision theory concepts including orientation, energy requirements, and successful vs unsuccessful collisions.

**Core Interactions**:
- Watch particles collide
- See successful vs unsuccessful collisions
- Adjust temperature (collision energy)
- Adjust concentration (collision frequency)
- Show activation energy threshold
- Display energy distribution curve
- Count effective collisions

**Use Cases**:
- Collision theory (High School)
- Factors affecting rate (High School)
- Activation energy concept (High School/AP)
- Temperature effect on rate (AP/College)
- Catalyst mechanism (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reaction` | string | Reaction being modeled |
| `temperature` | number | System temperature |
| `concentration` | number | Reactant concentration |
| `activationEnergy` | number | Ea value |
| `showOrientation` | boolean | Display required alignment |
| `showEnergyDistribution` | boolean | Maxwell-Boltzmann |
| `countCollisions` | boolean | Track effective collisions |

---

#### 6.5 Reaction Mechanism Builder

**Description**: A tool for building and analyzing multi-step reaction mechanisms, including intermediate identification and rate-determining step.

**Core Interactions**:
- Build mechanism step by step
- Identify intermediates and catalysts
- Sum elementary steps
- Determine molecularity of each step
- Identify rate-determining step
- Write rate law from mechanism
- Check consistency with experimental rate law

**Use Cases**:
- Mechanism basics (High School/AP)
- Elementary reactions (AP/College)
- Rate-determining step (AP/College)
- Deriving rate laws (College)
- Organic mechanisms (Organic Chemistry)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `overallReaction` | string | Net reaction |
| `steps` | array | Elementary steps |
| `showIntermediates` | boolean | Identify intermediates |
| `showRDS` | boolean | Identify rate-determining step |
| `deriveRateLaw` | boolean | From mechanism |
| `experimentalRateLaw` | string | For verification |

---

### 7. Electrochemistry

#### 7.1 Electrochemical Cell Builder

**Description**: An interactive tool for constructing galvanic and electrolytic cells, showing electron flow, ion movement, and calculating cell potential.

**Core Interactions**:
- Select electrode materials
- Choose electrolyte solutions
- Connect salt bridge
- Identify anode and cathode
- Show electron flow direction
- Show ion migration
- Calculate E°cell from standard potentials
- Determine spontaneity

**Use Cases**:
- Electrochemistry introduction (High School)
- Galvanic cells (High School/AP)
- Electrolytic cells (High School/AP)
- Cell potential calculations (AP/College)
- Applications (batteries, corrosion) (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `cellType` | enum | `galvanic`, `electrolytic` |
| `anode` | object | Electrode and solution |
| `cathode` | object | Electrode and solution |
| `showElectronFlow` | boolean | Animate electrons |
| `showIonFlow` | boolean | Animate ion migration |
| `showPotentials` | boolean | Display E° values |
| `calculateEcell` | boolean | Show calculation |

---

#### 7.2 Standard Reduction Potential Table

**Description**: An interactive table of standard reduction potentials with sorting, searching, and cell potential calculation capabilities.

**Core Interactions**:
- Search for half-reactions
- Sort by E° value
- Select two half-reactions to combine
- Calculate E°cell
- Determine which is oxidized/reduced
- Predict spontaneity
- Show cell notation

**Use Cases**:
- Reduction potentials (High School/AP)
- Predicting reactions (AP/College)
- Cell calculations (AP/College)
- Ranking oxidizing/reducing strength (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `showFullTable` | boolean | Display all potentials |
| `searchEnabled` | boolean | Allow searching |
| `calculatorEnabled` | boolean | Cell potential calculator |
| `showCellNotation` | boolean | Display line notation |
| `highlightRange` | [min, max] | Emphasize E° range |

---

#### 7.3 Electrolysis Simulator

**Description**: A simulation of electrolysis showing the application of external voltage to drive non-spontaneous reactions.

**Core Interactions**:
- Set up electrolytic cell
- Apply voltage
- Watch ion movement
- See reactions at electrodes
- Calculate products formed (Faraday's laws)
- Adjust current and time
- Compare different electrolytes

**Use Cases**:
- Electrolysis concept (High School)
- Electroplating (High School/AP)
- Industrial electrolysis (AP/College)
- Faraday's laws (AP/College)
- Quantitative electrolysis (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `electrolyte` | string | Solution or molten salt |
| `electrodes` | object | Anode and cathode materials |
| `voltage` | number | Applied potential |
| `current` | number | Current in amperes |
| `time` | number | Duration |
| `showReactions` | boolean | Display electrode reactions |
| `calculateProducts` | boolean | Apply Faraday's laws |

---

### 8. Nuclear Chemistry

#### 8.1 Nuclear Decay Simulator

**Description**: An interactive visualization of nuclear decay processes including alpha, beta, gamma emission and their effects on atomic number and mass.

**Core Interactions**:
- Select radioactive isotope
- Choose decay type
- Watch decay animation
- See nuclear equation
- Track changes in A and Z
- Show decay series
- Identify daughter nuclide

**Use Cases**:
- Nuclear chemistry introduction (High School)
- Types of radiation (High School)
- Nuclear equations (High School)
- Decay series (High School/AP)
- Nuclear stability (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `parentIsotope` | string | Starting nuclide |
| `decayType` | enum | `alpha`, `betaMinus`, `betaPlus`, `gamma`, `electronCapture` |
| `showEquation` | boolean | Display nuclear equation |
| `showParticle` | boolean | Animate emitted particle |
| `showDecaySeries` | boolean | Display full decay chain |
| `showChanges` | boolean | Highlight A, Z changes |

---

#### 8.2 Half-Life Calculator & Grapher

**Description**: A tool for calculating and visualizing radioactive decay over time using half-life relationships.

**Core Interactions**:
- Enter isotope or half-life value
- Set initial amount
- Calculate remaining after time t
- Plot decay curve
- Find time to reach specific amount
- Show number of half-lives
- Display decay equation

**Use Cases**:
- Half-life concept (High School)
- Decay calculations (High School)
- Carbon dating (High School/AP)
- First-order kinetics connection (AP/College)
- Medical applications (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `isotope` | string | Radioactive nuclide |
| `halfLife` | object | Value and unit |
| `initialAmount` | number | Starting quantity |
| `elapsedTime` | number | Time passed |
| `showGraph` | boolean | Display decay curve |
| `showCalculation` | boolean | Display math |
| `applicationContext` | enum | `dating`, `medical`, `general` |

---

#### 8.3 Nuclear Binding Energy Calculator

**Description**: A tool for calculating nuclear binding energy and binding energy per nucleon to explain nuclear stability.

**Core Interactions**:
- Enter isotope
- Calculate mass defect
- Convert to binding energy (E = mc²)
- Calculate binding energy per nucleon
- Plot on BE/A vs A curve
- Compare stability of isotopes
- Explain fission vs fusion regions

**Use Cases**:
- Nuclear stability (AP/College)
- Mass-energy equivalence (AP/College)
- Fission and fusion (AP/College)
- Nuclear energetics (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `isotope` | string | Nuclide to analyze |
| `showMassDefect` | boolean | Display calculation |
| `showBindingEnergy` | boolean | Display E = mc² |
| `showPerNucleon` | boolean | Display BE/A |
| `plotOnCurve` | boolean | Show on stability curve |
| `compareIsotopes` | array | Side-by-side analysis |

---

### 9. Organic Chemistry

#### 9.1 Organic Structure Drawing Tool

**Description**: A specialized drawing tool for organic molecules with shortcuts for common groups, automatic hydrogen completion, and structure validation.

**Core Interactions**:
- Draw carbon chains
- Add functional groups
- Use shorthand notation (line structures)
- Auto-complete hydrogens
- Show/hide hydrogens
- Rotate and flip structures
- Name structure (IUPAC)
- Convert between representations

**Use Cases**:
- Introduction to organic (High School)
- Drawing structures (High School/AP)
- Functional groups (High School/AP)
- Nomenclature (AP/Organic)
- Reaction products (Organic)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `drawingStyle` | enum | `bondLine`, `condensed`, `structural` |
| `showHydrogens` | enum | `all`, `none`, `heteroatomOnly` |
| `functionalGroupPalette` | array | Quick-add groups |
| `validateStructure` | boolean | Check valence |
| `autoName` | boolean | Generate IUPAC name |
| `templates` | array | Common structure templates |

---

#### 9.2 Functional Group Identifier

**Description**: A tool for identifying and highlighting functional groups within organic structures, with property and reactivity information.

**Core Interactions**:
- Input structure or draw molecule
- Highlight all functional groups
- Click groups for information
- Show characteristic properties
- Predict reactivity patterns
- Quiz mode for identification
- Sort compounds by functional group

**Use Cases**:
- Functional group recognition (High School/AP)
- Organic classification (AP/Organic)
- Property prediction (Organic)
- Reactivity patterns (Organic)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `molecule` | string | Structure to analyze |
| `highlightStyle` | enum | Color scheme for groups |
| `showProperties` | boolean | Display physical properties |
| `showReactivity` | boolean | Display reaction types |
| `quizMode` | boolean | Identification practice |
| `groupFilter` | array | Specific groups to find |

---

#### 9.3 Isomer Explorer

**Description**: A tool for generating and exploring different types of isomers (structural, geometric, optical) for a given molecular formula.

**Core Interactions**:
- Enter molecular formula
- Generate structural isomers
- Identify geometric (cis/trans) isomers
- Identify chiral centers
- Show enantiomers and diastereomers
- Calculate degrees of unsaturation
- Compare properties of isomers

**Use Cases**:
- Isomerism introduction (High School)
- Structural isomers (High School/AP)
- Stereoisomers (AP/Organic)
- Chirality (Organic)
- Physical property differences (Organic)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `molecularFormula` | string | Formula to explore |
| `isomerType` | enum | `structural`, `geometric`, `optical`, `all` |
| `showAllIsomers` | boolean | Generate complete set |
| `highlightDifferences` | boolean | Show structural variations |
| `showChiralCenters` | boolean | Mark R/S centers |
| `compareProperties` | boolean | Physical property table |

---

#### 9.4 Reaction Mechanism Animator

**Description**: An animated visualization of organic reaction mechanisms showing electron movement with curved arrows.

**Core Interactions**:
- Select reaction type
- Watch step-by-step mechanism
- See curved arrow electron movement
- Identify nucleophile and electrophile
- Track intermediates
- Control animation speed
- Practice drawing mechanisms

**Use Cases**:
- Mechanism introduction (AP/Organic)
- Substitution reactions (Organic)
- Elimination reactions (Organic)
- Addition reactions (Organic)
- Electron pushing (Organic)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `reactionType` | enum | Mechanism category |
| `specificReaction` | string | Particular reaction |
| `animationSpeed` | number | Playback speed |
| `showCurvedArrows` | boolean | Display electron movement |
| `showIntermediates` | boolean | Pause at intermediates |
| `practiceMode` | boolean | Student draws arrows |
| `showLabels` | boolean | Nu, E+, LG labels |

---

#### 9.5 Polymer Builder

**Description**: A tool for visualizing polymerization reactions, showing monomer to polymer conversion for addition and condensation polymers.

**Core Interactions**:
- Select monomer(s)
- Choose polymerization type
- Watch chain growth animation
- Display polymer structure
- Show repeating unit
- Calculate degree of polymerization
- Identify polymer properties

**Use Cases**:
- Polymer introduction (High School)
- Addition polymers (High School/AP)
- Condensation polymers (AP/Organic)
- Copolymers (Organic/Materials)
- Structure-property relationships (Materials)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `monomers` | array | Starting molecules |
| `polymerizationType` | enum | `addition`, `condensation` |
| `chainLength` | number | Number of repeat units |
| `showMechanism` | boolean | Display reaction mechanism |
| `showRepeatingUnit` | boolean | Highlight repeat structure |
| `showProperties` | boolean | Physical properties |

---

### 10. Laboratory & Safety

#### 10.1 Virtual Lab Bench

**Description**: A simulated laboratory workspace with common equipment, glassware, and chemicals for virtual experiments.

**Core Interactions**:
- Select and place equipment
- Add chemicals to glassware
- Perform operations (pour, heat, filter)
- Observe color changes and reactions
- Record observations
- Follow procedures step-by-step
- Safety checks throughout

**Use Cases**:
- Lab technique introduction (all levels)
- Pre-lab preparation (all levels)
- Virtual experiments (all levels)
- Safety training (all levels)
- Procedure practice (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableEquipment` | array | Equipment options |
| `availableChemicals` | array | Chemical options |
| `procedure` | array | Guided steps |
| `freeformMode` | boolean | Open exploration |
| `safetyChecks` | boolean | Enforce safety protocol |
| `recordObservations` | boolean | Data collection |

---

#### 10.2 Safety Data Sheet Reader

**Description**: An interactive SDS viewer with hazard identification, safety information, and proper handling procedures.

**Core Interactions**:
- Search chemical database
- View GHS hazard symbols
- Read hazard statements (H-codes)
- View precautionary statements (P-codes)
- Access first aid information
- View PPE requirements
- Show storage compatibility

**Use Cases**:
- Safety training (all levels)
- Lab preparation (all levels)
- Hazard awareness (all levels)
- Emergency procedures (all levels)
- Chemical storage (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `chemical` | string | Compound to look up |
| `showHazards` | boolean | Display GHS symbols |
| `showPPE` | boolean | Personal protective equipment |
| `showFirstAid` | boolean | Emergency procedures |
| `showStorage` | boolean | Storage requirements |
| `compareChemicals` | array | Side-by-side safety info |

---

#### 10.3 Significant Figures Calculator

**Description**: A calculator that tracks significant figures through calculations, showing proper rounding and precision.

**Core Interactions**:
- Enter measurements with units
- Perform calculations
- Track sig figs through each step
- Show proper rounding
- Identify limiting precision
- Display calculation rules used
- Practice sig fig identification

**Use Cases**:
- Measurement precision (Middle School/High School)
- Significant figures rules (High School)
- Laboratory calculations (High School)
- Error propagation (AP/College)
- Data analysis (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `operationType` | enum | Math operation type |
| `values` | array | Input measurements |
| `showRules` | boolean | Display sig fig rules |
| `showRounding` | boolean | Step-by-step rounding |
| `practiceMode` | boolean | Identify sig figs |
| `includeUnits` | boolean | Unit tracking |

---

#### 10.4 Unit Conversion Tool

**Description**: A comprehensive unit conversion calculator for chemistry-relevant units with dimensional analysis display.

**Core Interactions**:
- Enter value with units
- Select target units
- Show conversion pathway
- Display dimensional analysis
- Handle compound units (g/mL, mol/L)
- Include chemistry-specific conversions
- Save common conversions

**Use Cases**:
- Unit conversion (all levels)
- Dimensional analysis (High School)
- SI units (High School)
- Molar calculations (High School)
- Complex conversions (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `value` | number | Input value |
| `fromUnit` | string | Starting unit |
| `toUnit` | string | Target unit |
| `showDimensionalAnalysis` | boolean | Show conversion factors |
| `significantFigures` | number | Precision of result |
| `unitCategory` | enum | Filter available units |

---

### 11. Cross-Cutting Tools

#### 11.1 Molecular Formula Calculator

**Description**: A tool for calculating molecular formulas, molar masses, percent composition, and empirical formulas.

**Core Interactions**:
- Enter compound formula or name
- Calculate molar mass (with work shown)
- Calculate percent composition
- Determine empirical formula from percent
- Find molecular formula from empirical + molar mass
- Show contributing atomic masses
- Handle hydrates

**Use Cases**:
- Molar mass (High School)
- Percent composition (High School)
- Empirical formulas (High School)
- Molecular formulas (High School)
- Combustion analysis (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inputType` | enum | `formula`, `name`, `percentComp` |
| `compound` | string | Compound input |
| `showWork` | boolean | Display calculations |
| `calculatePercentComp` | boolean | Show percentages |
| `findEmpirical` | boolean | Reduce to empirical |
| `molarMassForMolecular` | number | For molecular from empirical |

---

#### 11.2 Chemical Nomenclature Tool

**Description**: A bidirectional tool for converting between chemical names (IUPAC, common) and formulas for inorganic and organic compounds.

**Core Interactions**:
- Enter name to get formula
- Enter formula to get name
- Show naming rules applied
- Handle ionic, covalent, acids
- Include polyatomic ions
- Show common names when applicable
- Practice mode for both directions

**Use Cases**:
- Chemical naming (Middle School/High School)
- Formula writing (High School)
- Acid nomenclature (High School)
- Organic nomenclature (AP/Organic)
- Stock system (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inputType` | enum | `name`, `formula` |
| `compoundType` | enum | `ionic`, `covalent`, `acid`, `organic` |
| `showRules` | boolean | Display naming rules |
| `showCommonNames` | boolean | Include trivial names |
| `practiceMode` | boolean | Quiz functionality |
| `difficultyLevel` | enum | `basic`, `intermediate`, `advanced` |

---

#### 11.3 Equation Writer (LaTeX/Chemistry)

**Description**: A specialized equation editor for chemical equations, equilibrium expressions, and mathematical chemistry notation.

**Core Interactions**:
- Type chemical formulas with subscripts
- Add reaction arrows (→, ⇌, ↔)
- Insert state symbols (s), (l), (g), (aq)
- Write equilibrium expressions
- Format rate laws
- Export to LaTeX or image
- Use keyboard shortcuts

**Use Cases**:
- Writing equations (all levels)
- Equilibrium expressions (High School/AP)
- Rate law notation (AP/College)
- Lab reports (all levels)
- Homework/assessments (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mode` | enum | `equation`, `expression`, `math` |
| `showToolbar` | boolean | Display formatting buttons |
| `shortcuts` | object | Custom keyboard shortcuts |
| `outputFormat` | enum | `display`, `latex`, `image` |
| `autoFormat` | boolean | Auto-subscript numbers |

---

#### 11.4 Data Table & Graphing Tool

**Description**: A spreadsheet-like interface for entering experimental data with built-in graphing and basic statistical analysis.

**Core Interactions**:
- Enter data in columns
- Add headers and units
- Create XY scatter plots
- Add trendlines (linear, polynomial)
- Calculate slope and intercept
- Calculate mean, std dev
- Export data and graphs

**Use Cases**:
- Lab data collection (all levels)
- Data analysis (all levels)
- Graphical analysis (High School/AP)
- Rate law determination (AP/College)
- Equilibrium analysis (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `columns` | array | Column definitions |
| `data` | 2D array | Data values |
| `graphType` | enum | `scatter`, `line`, `bar` |
| `trendlineType` | enum | `linear`, `polynomial`, `exponential` |
| `showStatistics` | boolean | Display statistics |
| `showEquation` | boolean | Display trendline equation |

---

## Technical Requirements

### State Management

All primitives must implement:

```typescript
interface ChemistryPrimitiveState {
  // Unique identifier
  id: string;
  
  // Configuration
  config: PrimitiveConfig;
  
  // Current state (student interaction)
  state: any;
  
  // Serialization
  serialize(): string;
  deserialize(data: string): void;
  
  // Event emission
  onChange(callback: (state: any) => void): void;
  
  // Validation
  validate(): ValidationResult;
  
  // Chemical accuracy checking
  checkChemicalValidity(): ChemicalValidationResult;
}
```

### Data Sources

Required chemical databases:
- Periodic table data (all elements, isotopes, properties)
- Standard reduction potentials
- Thermodynamic data (ΔH°f, S°, ΔG°f)
- Solubility rules and Ksp values
- Acid/base Ka and Kb values
- Bond energies
- Common molecule library (structure files)
- Safety data (GHS hazards)

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions (including chemical formulas)
- High contrast mode
- Color-blind safe palettes (not relying on red/green)
- Alternative text for molecular structures
- Minimum touch target size (44x44px)

### Performance Requirements

- Initial render: < 100ms
- 3D molecule render: < 500ms
- State update: < 16ms (60fps interactions)
- Particle simulations: 60fps with up to 200 particles
- Maximum bundle size per primitive: 100KB gzipped (excluding molecule libraries)

### Integration Points

Each primitive integrates with:
- Problem generation system
- Assessment and grading system
- Laboratory simulation system
- Safety information system
- Progress tracking
- Audio narration for accessibility

---

## Implementation Priority

### Phase 1: Core Foundations
1. Periodic Table Explorer
2. Atom Builder / Bohr Model
3. Lewis Structure Builder
4. Equation Balancer
5. Molecular Formula Calculator
6. pH Scale & Calculator

### Phase 2: Structure & Bonding
7. 3D Molecular Viewer
8. VSEPR Geometry Explorer
9. Electron Configuration Builder
10. Electronegativity & Polarity Tool
11. Ionic Compound Builder

### Phase 3: Reactions & Stoichiometry
12. Particle-Level Reaction Animator
13. Stoichiometry Calculator
14. Limiting Reagent Visualizer
15. Reaction Type Classifier
16. Oxidation State Tracker

### Phase 4: States of Matter & Energy
17. Phase Diagram Explorer
18. Heating/Cooling Curve
19. Kinetic Molecular Theory Simulator
20. Gas Law Calculator & Visualizer
21. Enthalpy Diagram Builder

### Phase 5: Solutions & Equilibrium
22. Solution Preparation Tool
23. Equilibrium Simulator
24. Le Chatelier's Principle Explorer
25. ICE Table Builder
26. Titration Simulator
27. Buffer Solution Analyzer

### Phase 6: Kinetics & Electrochemistry
28. Reaction Rate Grapher
29. Rate Law Determiner
30. Collision Theory Simulator
31. Electrochemical Cell Builder
32. Standard Reduction Potential Table

### Phase 7: Nuclear & Organic
33. Nuclear Decay Simulator
34. Half-Life Calculator & Grapher
35. Organic Structure Drawing Tool
36. Functional Group Identifier
37. Isomer Explorer
38. Reaction Mechanism Animator

### Phase 8: Laboratory & Advanced
39. Virtual Lab Bench
40. Safety Data Sheet Reader
41. Calorimetry Simulator
42. Hess's Law Calculator
43. Integrated Rate Law Plotter
44. Nuclear Binding Energy Calculator
45. Polymer Builder

### Phase 9: Supporting Tools
46. Significant Figures Calculator
47. Unit Conversion Tool
48. Chemical Nomenclature Tool
49. Equation Writer
50. Data Table & Graphing Tool
51. Solubility Curve Grapher
52. Atomic/Ionic Radius Visualizer
53. Emission Spectrum Viewer
54. Orbital Hybridization Visualizer
55. Metallic Bonding Model
56. Electrolysis Simulator
57. Reaction Mechanism Builder

---

## Appendix A: Level Mapping

| Level | Primary Primitives |
|-------|-------------------|
| Middle School | Periodic Table, Atom Builder, Phase Diagram, Equation Balancer, Particle Animator |
| High School (Intro) | Lewis Structure, VSEPR, Gas Laws, Stoichiometry, Solutions, pH Scale |
| High School (Honors) | Equilibrium, Titration, Electrochemical Cells, Kinetics basics |
| AP Chemistry | ICE Tables, Rate Laws, Thermodynamics, Advanced Equilibrium, Nuclear |
| Organic Chemistry | Structure Drawing, Mechanisms, Isomers, Functional Groups, Polymers |
| College General | All above + Advanced Electrochemistry, Kinetics, Quantum concepts |

---

## Appendix B: Safety Considerations

All primitives must:
1. Never display procedures for synthesizing dangerous materials
2. Include appropriate safety warnings when relevant
3. Show proper PPE in virtual lab contexts
4. Link to safety data when chemicals are used
5. Emphasize safe laboratory practices
6. Include emergency procedure references
7. Avoid glorifying dangerous reactions

---

## Appendix C: Molecule Library Requirements

The system requires a curated library of 3D molecular structures including:

**Inorganic Compounds** (~200)
- Common ionic compounds
- Coordination complexes
- Acids and bases
- Industrial chemicals

**Organic Compounds** (~500)
- Alkanes, alkenes, alkynes (C1-C10)
- Alcohols, aldehydes, ketones, carboxylic acids
- Aromatics and heterocycles
- Amino acids and carbohydrates
- Pharmaceuticals and natural products

**Biomolecules** (~100)
- Proteins (example structures)
- Nucleic acids
- Lipids
- Vitamins and coenzymes

**Polymers** (~50)
- Common addition polymers
- Condensation polymers
- Biopolymers

All structures should include:
- Optimized 3D coordinates
- Bond order information
- Formal charges where applicable
- Multiple conformations where relevant
