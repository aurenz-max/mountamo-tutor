/**
 * Chemistry Catalog - Component definitions for chemistry primitives
 *
 * Contains chemistry visualization components for molecular structures,
 * periodic table, chemical reactions, states of matter, and lab safety.
 */

import { ComponentDefinition } from '../../../types';
import { periodicTableCard } from '../../../primitives/periodicTable.card';
import { bossEntry } from '../../../components/live-activity/boss';
import { matterExplorerCard } from '../../../primitives/visual-primitives/chemistry/matterExplorer.card';
import { statesOfMatterCard } from '../../../primitives/visual-primitives/chemistry/statesOfMatter.card';
import { mixingAndDissolvingCard } from '../../../primitives/visual-primitives/chemistry/mixingAndDissolving.card';
import { reactionLabCard } from '../../../primitives/visual-primitives/chemistry/reactionLab.card';
import { phExplorerCard } from '../../../primitives/visual-primitives/chemistry/phExplorer.card';
import { moleculeConstructorCard } from '../../../primitives/visual-primitives/chemistry/moleculeConstructor.card';
import { atomBuilderCard } from '../../../primitives/visual-primitives/chemistry/atomBuilder.card';
import { gasLawsSimulatorCard } from '../../../primitives/visual-primitives/chemistry/gasLawsSimulator.card';
import { equationBalancerCard } from '../../../primitives/visual-primitives/chemistry/equationBalancer.card';
import { energyOfReactionsCard } from '../../../primitives/visual-primitives/chemistry/energyOfReactions.card';
import { stoichiometryLabCard } from '../../../primitives/visual-primitives/chemistry/stoichiometryLab.card';

export const CHEMISTRY_CATALOG: ComponentDefinition[] = [
  {
    id: 'molecule-viewer',
    description: 'Interactive 3D molecular structure visualization with CPK-colored atoms and chemical bonds. Perfect for chemistry lessons on molecular structure, bonding, organic compounds, crystal lattices, proteins, and biochemistry. Features interactive atom selection, bond analysis, and auto-rotating 3D view. HIGHLY RECOMMENDED for any chemistry topic involving molecular structure.',
    constraints: 'Best for middle-school and above. Use for chemistry, biochemistry, organic chemistry, crystal structures, or any topic involving molecules, atoms, and chemical bonds.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Student is exploring a 3D model of {{moleculeName}} ({{category}}). The molecule has {{atomCount}} atoms and {{bondCount}} bonds. They can click atoms to learn about each element and examine the bond structure. Help them understand the molecular geometry, bonding patterns, and why this molecule has the shape it does.',
      contextKeys: ['moleculeName', 'category', 'atomCount', 'bondCount', 'uniqueElements', 'bondTypes', 'selectedAtomElement', 'selectedAtomName', 'atomsExplored'],
      scaffoldingLevels: {
        level1: '"Click on different atoms to explore them. What elements make up this molecule? Do you notice a pattern in how they\'re arranged?"',
        level2: '"This is {{moleculeName}}, made of {{uniqueElements}}. Look at how the atoms connect — there are {{bondCount}} bonds. Can you find the different bond types? Try clicking the central atom to see what it connects to."',
        level3: '"Let\'s look at {{moleculeName}} step by step. First, find the central atom — it\'s usually the one with the most bonds. Click it and count its connections. The shape of the molecule depends on how many atoms surround that center. {{bondCount}} bonds arranged around it push apart to get as far from each other as possible — that\'s what gives this molecule its 3D shape."',
      },
      commonStruggles: [
        { pattern: 'Student clicks randomly without examining atom details', response: 'Guide: "When you click an atom, look at the info panel on the left. It tells you the element name, atomic number, and where it sits in the molecule. Try clicking one atom at a time and reading about it!"' },
        { pattern: 'Student does not understand why atoms bond', response: 'Explain: "Atoms bond because they want to fill their outer electron shell. Carbon makes 4 bonds, oxygen makes 2, hydrogen makes 1. Count the bonds on each atom — do they match these numbers?"' },
        { pattern: 'Student confuses single and double bonds', response: 'Clarify: "A single bond is one shared pair of electrons — one stick connecting two atoms. A double bond is TWO shared pairs — shown as two sticks. Double bonds are shorter and stronger. Look at the bond analysis panel to see which types are in this molecule."' },
        { pattern: 'Student does not understand molecular shape', response: 'Use an analogy: "Think of the bonds around a central atom like balloons tied together. If there are 4 balloons, they push apart into a pyramid shape (tetrahedral). If there are 3, they spread into a flat triangle. The bonds push apart the same way!"' },
      ],
      aiDirectives: [
        {
          title: 'STRUCTURE NARRATION',
          instruction:
            'When describing molecular structure, relate the 3D shape to everyday objects. '
            + 'For tetrahedral: "like a camera tripod with a handle pointing up." '
            + 'For linear: "like a straight stick." '
            + 'For bent: "like a boomerang." '
            + 'Keep descriptions visual and age-appropriate.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'explore', label: 'Explore (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['explore'], description: 'Click atoms and identify elements in the molecule' },
      { evalMode: 'identify', label: 'Identify (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['identify'], description: 'Name bond types and molecular geometry' },
      { evalMode: 'analyze', label: 'Analyze (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['analyze'], description: 'Explain bonding patterns and predict molecular shape' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'periodic-table',
    description: 'Interactive periodic table of all 118 elements with group/period axes, element modal views (electron shells, stability, phase), and category filtering. Two surfaces: free EXPLORATION (clickable elements, search, family filters — ideal for introducing the table), and a live-judged DIRECT INSTRUCTION session when an eval mode is pinned — the spoken tutor asks, the child taps a box (Element Hunt) or answers OUT LOUD (element names, trend comparisons, outer-electron counts), and a credited answer advances the lesson. Perfect for element properties, periodic trends, atomic structure, chemical families, and the organization of the table.',
    constraints: 'Best for middle-school and above. Use for chemistry lessons on periodic trends, element properties, atomic structure, electron configuration, or chemical families. Judged sessions require the live tutor and a microphone; the manifest must NOT supply element lists or answer keys — every challenge is drawn and keyed in code from the element table.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['introduce', 'apply'], minutes: 5 },
    // Judged sessions are wired by the card (`periodicTable.card.ts`, boss `periodicTable.boss.ts`).
    ...bossEntry(periodicTableCard),
    // The ungraded exploration table only: a payload with no askable challenge, which no workspace session binds,
    // so this block still reaches its tutor (`chemistry-primitives/PeriodicTableExplorer.tsx`).
    tutoring: {
      taskDescription: 'Student is exploring the periodic table ({{challengeType}}). {{stimulus}} '
        + 'Exploration is not scored: react briefly and warmly to the [ELEMENT_SELECTED], [GROUP_TREND], '
        + '[CATEGORY_EXPLORED] and [EXPLORATION_MILESTONE] updates as an exploration guide.',
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        level1: 'Invite the learner to tap an element, then say one short thing about it.',
        level2: 'Suggest tapping another element in the same column to compare the two.',
        level3: 'Point out one pattern across the elements tapped so far: the same column, the same family.',
      },
      commonStruggles: [
        { pattern: 'Student taps elements at random without looking at where they sit', response: 'Ask them to tap the element just below the last one and say what is the same about the two.' },
      ],
      aiDirectives: [
        {
          title: 'PERIODIC TRENDS',
          instruction:
            'When the student clicks several elements in one group or period, briefly highlight the trend: atomic '
            + 'radius increases down a group and decreases across a period; reactivity patterns differ for metals vs '
            + 'nonmetals. Keep it visual and age-appropriate.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'explore', affordances: { answers: ['tap'] }, label: 'Element Hunt (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['explore'], description: 'DI judged: the tutor names a target — by name, spelled symbol, atomic number, or group and period — and the child taps its box. Verdict computed in code.' },
      { evalMode: 'identify', affordances: { answers: ['spoken'] }, label: 'Name It (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['identify'], description: 'DI judged, spoken: a position, number, or symbol clue; the child reads the table and says the element\'s name.' },
      { evalMode: 'trend', affordances: { answers: ['spoken'] }, label: 'Periodic Trends (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['trend'], description: 'DI judged, spoken: same-group size and reactivity comparisons plus main-group outer-electron counts, all keys computed from the table.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'matter-explorer',
    // -- PORT 23 -- the judged loop, third chemistry port --------------------
    // RUNG 2 (2026-09-03, queue item 28): a FOURTH mode, `change` -- can this
    // everyday change go back, or is it for ever. It is here rather than on
    // `states-of-matter` because that sibling teaches the reversible half from
    // THRESHOLDS ("it melts at zero degrees"), which is a Grade 3-5 ask; the
    // irreversible half had no home in the catalog at all. The LLM picks WHICH
    // change happened from a closed menu; `CHANGE_CATALOG` owns whether it
    // undoes, so no answer is ever read off a generated field.
    // ALL FOUR MODES SPEAK. Zero taps. The click era's three drag-bins, its
    // Check button and its typed mystery box are gone: every answer this
    // primitive wants is a thing a five-year-old says out loud at a table.
    // THE SPLIT (standing gate 1): sort and mystery answer with one word from
    // a three-word set (short_spoken_word, benched); property answers with one
    // proposition from a menu the ask itself states (closed_set_choice) --
    // free production there would be open-set, so the menu stays and the
    // BUTTON is what the port deletes.
    // WHAT THE JUDGED SURFACE HIDES: the three bins as a drop target, the
    // property panel (its `shape` field IS the answer key for two of the three
    // modes), the temperature slider, and the mystery text box. The property
    // panel returns as the reveal, after the affirmation.
    // `property` WAS AN EVAL-MODE FICTION -- declared here and never emitted by
    // the generator, so it was IRT-weighted and unroutable. It is real now,
    // bound to `properties.shape`, which the generator always emitted and
    // nothing ever read.
    // Live-tutor wiring: `matterExplorer.card.ts` + `matterExplorer.boss.ts`
    // (the spoken preset); asks, keys and build gates in `matterExplorerDomain.ts`.
    description: 'Live-judged Direct Instruction on states of matter and everyday change for K-2, spoken end to end. The tutor names an everyday object and the child SAYS whether it is a solid, a liquid or a gas; says what it does when you pour it into a cup; says whether a change that happened to it can go back the way it was or is changed for ever (ice melts and freezes again, a cooked egg does not); and works out the state of a secret object from clues. Requires a microphone. Every answer is spoken aloud and judged from the audio - there is nothing to drag, tap or type. ESSENTIAL for Kindergarten and Grade 1-2 science.',
    constraints: 'Best for K-2. Requires a working microphone and the live tutor - the whole activity is a spoken exchange. Use for early science lessons on states of matter, observable properties of materials, classification, and changes that can or cannot be undone. Reversible and irreversible change is taught here from what a child can picture, never from melting and boiling points - that framing belongs to states-of-matter at Grade 3-5.',
    affordances: { representation: 'pictorial', answers: ['spoken'], role: 'apply', minutes: 5 },
    ...bossEntry(matterExplorerCard),
    evalModes: [
      { evalMode: 'sort', label: 'Sort (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['sort'], description: 'DI judged, spoken: the tutor names an everyday object and the child says whether it is a solid, a liquid or a gas. One judged item per OBJECT - the click era graded a whole screenful as one boolean. Key computed from the object\'s own state field.' },
      { evalMode: 'property', label: 'Property Inspector (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['property'], description: 'DI judged, spoken: the child says what the object DOES in a cup - keeps its own shape, takes the cup\'s shape, or spreads out and fills the room. The observation that sits one step before classification; key computed from properties.shape.' },
      { evalMode: 'change', label: 'Can It Go Back? (Medium-Hard)', beta: 1.2, discrimination: 1.0, scaffoldingMode: 4, challengeTypes: ['change'], description: 'DI judged, spoken: the tutor says what happened to the object - it melted, it was cooked, it was torn - and the child says whether it can go back the way it was or is changed for ever. The K-2 reversible/irreversible standard, asked from what a child can picture rather than from a melting point; the change comes from a closed menu and the key is code-owned.' },
      { evalMode: 'mystery', label: 'Mystery Material (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['mystery'], description: 'DI judged, spoken: the object\'s name is withheld and the child names its state from two or three observable clues. Shape and flow clues are refused in code - they would hand over the answer.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'reaction-lab',
    description: 'Interactive chemistry experiment station where students combine real substances and observe reactions — fizzing, color changes, temperature changes, gas production, precipitates. Features split Real View / Particle View and a predict → mix → observe → explain flow; every challenge is one choice the student taps or says. K-2 uses kitchen chemistry, 3-5 adds classification and particle view, 6-8 adds equation balancing and conservation of mass. Perfect for teaching chemical vs physical change, signs of chemical reactions, and the scientific method. ESSENTIAL for K-8 chemistry and science.',
    constraints: 'Best for K-8. Use for chemistry lessons on chemical reactions, physical vs chemical change, states of matter changes, kitchen chemistry, acid-base reactions, oxidation, dissolution, and the scientific method. Grade-appropriate complexity adjusts automatically.',
    affordances: { representation: 'pictorial', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      { evalMode: 'predict', label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'Predict reaction outcomes before mixing' },
      { evalMode: 'observe', label: 'Observe (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['observe', 'identify_signs', 'classify'], description: 'Identify signs of chemical vs physical change' },
      { evalMode: 'explain', label: 'Explain (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['explain', 'balance', 'conservation'], description: 'Explain reactions using particle model and conservation of mass' },
    ],
    // Live-tutor wiring: `reactionLab.card.ts` + `reactionLab.boss.ts` (the spoken preset, SAY_OR_SHOW).
    ...bossEntry(reactionLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'equation-balancer',
    description: 'Conservation of atoms in real chemical reactions, three tasks. Count: the equation is printed with its numbers in front, and the student says or taps how many atoms of one element are on one side (the number in front times the small number after the symbol, summed over the formulas). Balance: the student sets the number in front of each formula with + and − so every element has the same count on both sides, with the smallest whole numbers; first on equations where each element sits in one formula per side, then where an element is shared between two formulas (combustion, respiration). Every equation comes from a code bank of real reactions and every answer is solved by code. No live atom counter, tipping scale or match marks give the answer away; molecule drawings and an atom tally appear only as help. Perfect for teaching conservation of mass, reading formulas, and systematic balancing. ESSENTIAL for grade 6-8 chemistry.',
    constraints: 'Best for grade 6-8. The manifest must not supply equations, coefficients or answers: the generator picks bank reactions for the topic and code builds every item. Numbers in front go from 1 to 10.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'tap', 'spoken'], role: 'apply', minutes: 5 },
    // Live-tutor wiring: `equationBalancer.card.ts` + `equationBalancer.boss.ts` (the spoken preset: SAY_OR_SHOW count,
    // two balance boards).
    ...bossEntry(equationBalancerCard),
    evalModes: [
      { evalMode: 'simple', affordances: { answers: ['tap', 'spoken'] }, label: 'Count atoms (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['simple'], description: 'Count the atoms of one element on one side of an equation printed with its numbers in front' },
      { evalMode: 'guided', affordances: { answers: ['manipulate'] }, label: 'Balance (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['guided'], description: 'Balance an equation where each element sits in one formula on each side, using the smallest whole numbers' },
      { evalMode: 'complex', affordances: { answers: ['manipulate'] }, label: 'Balance, shared element (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['complex'], description: 'Balance an equation where an element is shared between two formulas on one side, such as a combustion' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'energy-of-reactions',
    description: 'Energy-of-reactions lab with three task identities, each built and keyed in code: thermometer evidence (run a named classroom reaction, such as baking soda and vinegar or magnesium and acid, in a beaker of water, read the thermometer, and decide whether it releases or absorbs energy), energy diagrams (read an unlabelled energy diagram on a kJ grid: the direction, the energy change, the activation energy, or how much a catalyst lowers it), and bond energies (from a table of the bonds broken and formed, with counts and energy per bond, choose the energy change). Answers are tapped or said aloud. Perfect for teaching exothermic and endothermic reactions, energy diagrams, activation energy, catalysts and bond energies. ESSENTIAL for grade 5-8 chemistry.',
    constraints: 'Best for grades 5-8. Use for chemistry lessons on energy in reactions: exothermic and endothermic, temperature change as evidence, energy diagrams, activation energy, catalysts, and bond energies (grades 7-8). The manifest must NOT supply reactions, energy values or answer keys: the reactions come from a code library, and every reading, diagram, bond table and key is built in code.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    // Live-tutor wiring: `energyOfReactions.card.ts` + `energyOfReactions.boss.ts` (the spoken preset, SAY_OR_SHOW).
    ...bossEntry(energyOfReactionsCard),
    evalModes: [
      { evalMode: 'classify', affordances: { answers: ['tap', 'spoken'] }, label: 'Classify (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['classify'], description: 'Run a reaction in a beaker of water, read the thermometer, and decide whether the reaction releases or absorbs energy' },
      { evalMode: 'diagram', affordances: { answers: ['tap', 'spoken'] }, label: 'Read Diagram (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['diagram'], description: 'Read an unlabelled energy diagram on a kJ grid: the direction, the energy change, the activation energy, or how much a catalyst lowers it' },
      { evalMode: 'bond_energy', affordances: { answers: ['tap', 'spoken'] }, label: 'Bond Energy (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['bond_energy'], description: 'From a table of bonds broken and formed (count and energy per bond), choose the energy change: energy in minus energy out' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'states-of-matter',
    description: 'Live-judged DIRECT INSTRUCTION particle simulation. The spoken tutor puts a substance on the bench beside its particle view, asks ONE question, and the child answers OUT LOUD — what state it is, what state it will reach when the tutor heats or cools it, what the change is called, or which of two named substances melts first. The tutor judges from the audio, and its own affirmation runs the experiment and advances the lesson. With no challenges in play the same primitive is a free exploration surface: a temperature slider, a macroscopic beaker and a synchronized particle model, heating curve and substance switcher. Perfect for the particle model of matter, phase transitions, melting and boiling points, and energy transfer. ESSENTIAL for K-5 science.',
    constraints: 'Best for K-5. Use for science lessons on states of matter, the particle model, phase changes, melting/boiling/freezing/condensation, temperature and energy. Judged sessions require the live tutor and a microphone; every answer is SPOKEN, so there is nothing to tap. The manifest must NOT supply substances, temperatures or answer keys — every challenge is drawn and keyed in code from a substance table with real melting and boiling points. Grade-appropriate complexity adjusts automatically; K-2 stays on everyday, above-freezing substances and never hears a below-zero temperature.',
    affordances: { representation: 'pictorial', answers: ['spoken'], role: ['visualize', 'apply'], minutes: 5 },
    // EVERY mode is spoken (third science port, second chemistry port): observe answers with a state word, predict
    // with a state word or a phase-change word, compare with one of two named substances. The judged surface hides the
    // temperature slider, the state badge, the particle caption, the numeric temperature and the substance switcher
    // until credit. Live-tutor wiring: `statesOfMatter.card.ts` + `statesOfMatter.boss.ts` (the spoken preset); asks,
    // keys and build gates in `statesOfMatterDomain.ts`.
    ...bossEntry(statesOfMatterCard),
    evalModes: [
      { evalMode: 'observe', label: 'Observe (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['observe'], description: 'DI judged, spoken: read the particle view and SAY the state of matter. Beta held — the click era offered three labelled buttons and this asks for the same one-word answer unaided, which is harder in production but is still this primitive\'s easiest task identity.' },
      { evalMode: 'predict', label: 'Predict (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['predict'], description: 'DI judged, spoken: given the thresholds aloud, say the state the substance will reach when the tutor heats or cools it — or, at Grade 3-5, name the phase change itself (melting, freezing, boiling, condensing).' },
      { evalMode: 'compare', label: 'Compare (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['compare'], description: 'DI judged, spoken: two substances with real melting points, both solid on the bench — say which melts first, or which is still solid at a stated temperature. Every key computed from the substance table.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'mixing-and-dissolving',
    description: 'Interactive solutions and mixtures explorer with beaker workspace, substance shelf, particle view, temperature control, saturation indicator, concentration meter, and separation tools. Students add substances to water and discover what dissolves and what does not, then use separation techniques to recover solutes. Perfect for teaching dissolving, solutions vs mixtures, and saturation. ESSENTIAL for grade 3-7 chemistry.',
    constraints: 'Requires substance data with solubility values. Best for grade 3-7. Solubility curve only for grade 6-7.',
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'dissolve', affordances: { answers: ['manipulate', 'tap', 'spoken'] }, label: 'Dissolve (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['dissolve_sort', 'particle_explain'], description: 'Test which substances dissolve and which do not' },
      { evalMode: 'classify', affordances: { answers: ['tap', 'spoken'] }, label: 'Classify (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['classify'], description: 'Classify as solution, suspension, or mixture' },
      { evalMode: 'separate', affordances: { answers: ['tap', 'spoken'] }, label: 'Separate (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['separate'], description: 'Choose correct separation technique and explain why' },
    ],
    // Live-tutor wiring: `mixingAndDissolving.card.ts` + `mixingAndDissolving.boss.ts` (the spoken preset, SAY_OR_SHOW).
    ...bossEntry(mixingAndDissolvingCard),
    supportsEvaluation: true,
  },
  {
    id: 'atom-builder',
    description: 'Interactive atom construction tool where students drag protons, neutrons, and electrons to build atoms from scratch. Features Bohr model visualization with electron shells, mini periodic table with live element highlighting, identity card, charge and mass number display. Supports build, identify, fill-shells, make-ion, and make-isotope challenges. Grades 3-5 focus on element identity and shell filling. Grades 6-8 add ions, isotopes, and electron configuration. ESSENTIAL for chemistry lessons on atomic structure, subatomic particles, and the periodic table.',
    constraints: 'Best for grades 3-8. Use for chemistry lessons on atoms, subatomic particles, electron shells, element identity, ions, isotopes, periodic table connections, and electron configuration.',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['build', 'manipulate'], role: ['visualize', 'apply'], minutes: 6 },
    // Live-tutor wiring: `atomBuilder.card.ts` + `atomBuilder.boss.ts` (a bespoke boss: builds on the particle tray the
    // activity checks).
    ...bossEntry(atomBuilderCard),
    evalModes: [
      { evalMode: 'build', affordances: { answers: ['build'] }, label: 'Build (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['build'], description: 'Build a named element from protons, neutrons, electrons' },
      { evalMode: 'identify', affordances: { answers: ['build'] }, label: 'Identify (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['identify', 'fill-shells'], description: 'Identify element from particle counts and fill electron shells' },
      { evalMode: 'make_atom', affordances: { answers: ['build'] }, label: 'Make Your Own Atom (Open)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['make_atom'], description: 'Make any atom with the asked property on an empty board: a number of outer electrons or a full outer shell (3-8), a charge or two isotopes of one element (6-8). Many atoms pass; code checks the build' },
      { evalMode: 'ion_isotope', affordances: { answers: ['build'] }, label: 'Ion & Isotope (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['make-ion', 'make-isotope'], description: 'Create specific ions and isotopes' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'molecule-constructor',
    description: 'Interactive molecule-building workspace where students snap atoms together to form molecules. Atom palette with category-colored elements and valence connection dots. Click-to-bond interaction with single, double, and triple bond support. Live formula display, valence satisfaction indicators, molecule gallery with real-world categories, and multi-challenge progression (build, identify, formula write, predict). Perfect for teaching chemical bonding, molecular structure, valence rules, and molecular formulas. ESSENTIAL for grades 3-8 chemistry.',
    constraints: 'Best for grades 3-8. Use for chemistry lessons on chemical bonding, molecules, valence, molecular formulas, covalent bonds, Lewis structures, molecular shape, and properties from structure.',
    affordances: { representation: ['concrete', 'symbolic'], answers: ['build', 'type'], role: ['visualize', 'apply'], minutes: 7 },
    // Live-tutor wiring: `moleculeConstructor.card.ts` + `moleculeConstructor.boss.ts` (a bespoke boss: builds and
    // typed answers the activity checks).
    ...bossEntry(moleculeConstructorCard),
    evalModes: [
      { evalMode: 'build', affordances: { answers: ['build'] }, label: 'Build (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['build'], description: 'Build simple molecules from a name or formula' },
      { evalMode: 'make_molecule', affordances: { answers: ['build'] }, label: 'Make Your Own (Open)', beta: -0.4, scaffoldingMode: 2, challengeTypes: ['make_molecule'], description: 'Make any molecule with the asked property (a double bond, a number of carbon atoms, a given atom) on an empty board; every atom must use all its bonds' },
      { evalMode: 'identify', affordances: { answers: ['type'] }, label: 'Identify (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['identify', 'formula'], description: 'Identify molecules and write formulas from structure' },
      { evalMode: 'predict', affordances: { answers: ['build'] }, label: 'Predict (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['predict'], description: 'Predict properties and shape from molecular structure' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'ph-explorer',
    description: 'Interactive pH lab on a rainbow pH scale (0-14), with three task identities, each keyed in code from the substances\' pH values: litmus test (dip a blue and a red litmus paper into a named everyday or lab substance and say acid, base or neutral), indicator colours (read an unnamed sample\'s red cabbage juice colour and choose its pH range), and neutralize (choose how many cups of a strong base make 1 cup of a strong acid neutral, from their two pH values, where each pH step is ten times as strong; a universal-indicator beaker changes colour when they mix). Answers are tapped or said aloud. Perfect for teaching the pH scale, acids and bases, indicators, and neutralization. ESSENTIAL for grade 4-8 chemistry.',
    constraints: 'Best for grades 4-8. Use for chemistry lessons on pH, acids and bases, indicators, neutralization, acid-base reactions, and the pH scale. Grade-appropriate complexity adjusts automatically. The manifest must NOT supply answer keys: every key is computed from the generated substances\' pH values.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    // Live-tutor wiring: `phExplorer.card.ts` + `phExplorer.boss.ts` (the spoken preset, SAY_OR_SHOW).
    ...bossEntry(phExplorerCard),
    evalModes: [
      { evalMode: 'test', affordances: { answers: ['tap', 'spoken'] }, label: 'Test (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['test'], description: 'Dip blue and red litmus papers into a named substance and say whether it is an acid, a base or neutral' },
      { evalMode: 'indicator', affordances: { answers: ['tap', 'spoken'] }, label: 'Indicator (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['indicator'], description: 'Read an unnamed sample\'s red cabbage juice colour and choose the pH range it shows' },
      { evalMode: 'neutralize', affordances: { answers: ['tap', 'spoken'] }, label: 'Neutralize (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['neutralize'], description: 'From the pH of a strong acid and a strong base, choose how many cups of base make 1 cup of acid neutral (each pH step is ten times as strong)' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'safety-lab',
    description: 'Gamified lab safety training with interactive lab scene for hazard identification, PPE selection station with draggable equipment (goggles, gloves, apron, lab coat, face shield), GHS hazard symbol matching, emergency response sequencing, and safe lab design mode. K-2 covers basic safety rules, 3-5 adds hazard symbols and equipment handling, 6-8 includes full GHS symbols, risk assessment, and SDS basics. Every chemistry primitive references this one. ESSENTIAL for K-8 science safety.',
    constraints: 'Best for K-8. Use for lab safety training, science safety rules, PPE selection, hazard identification, emergency procedures, and GHS hazard symbols. Should precede any hands-on chemistry activity.',
    affordances: { representation: 'pictorial', answers: ['tap', 'manipulate'], role: ['introduce', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Student is doing lab safety training for "{{scenarioName}}" (preparing for {{experiment}}). They have identified {{hazardsIdentified}}/{{hazardsTotal}} hazards and selected PPE: {{selectedPPE}}. Required PPE: {{requiredPPE}}. Currently on challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'scenarioName', 'experiment', 'hazardsTotal', 'hazardsIdentified', 'requiredPPE', 'selectedPPE', 'ppeSubmitted', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'studentAnswer', 'emergencyScenario', 'ghsSymbolCount'],
      scaffoldingLevels: {
        level1: '"Look around the lab carefully. Is there anything that could be dangerous? What might go wrong?"',
        level2: '"We\'re preparing for {{experiment}}. Think about what could hurt you — chemicals on skin, splashes in eyes, spills on the floor. Which safety equipment protects against each danger?"',
        level3: '"Let\'s go through the checklist together. For {{experiment}}, we need to protect: our EYES (what covers those?), our HANDS (what covers those?), and our BODY (what covers that?). Now look at the PPE station and pick the right items."',
      },
      commonStruggles: [
        { pattern: 'Student forgets goggles', response: 'Emphasize the most critical PPE: "The NUMBER ONE rule in any lab: ALWAYS wear safety goggles! Your eyes cannot heal like your skin can. Goggles are non-negotiable for every experiment."' },
        { pattern: 'Student selects unnecessary PPE', response: 'Guide appropriate selection: "It\'s great that you want to be safe! But wearing too much PPE can actually be a problem — it can make you clumsy and cause accidents. Think about what hazards THIS specific experiment has."' },
        { pattern: 'Student misses a hazard in the lab scene', response: 'Direct attention: "Look more carefully at the lab. Check near the burner — is everything clear? Look at the floor — any spills? Check the bottles — are they all labeled? Every detail matters in lab safety!"' },
        { pattern: 'Student gets emergency sequence wrong', response: 'Walk through the logic: "In an emergency, think: What is the FIRST thing you need to do to stop the harm? Then what comes next? The order matters because each step builds on the last one."' },
      ],
    },
    evalModes: [
      { evalMode: 'hazard', affordances: { answers: ['tap'] }, label: 'Hazard ID (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['hazard'], description: 'Spot hazards in a lab scene' },
      { evalMode: 'ppe', affordances: { answers: ['manipulate'] }, label: 'PPE Selection (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['ppe'], description: 'Select correct PPE for given experiment' },
      { evalMode: 'emergency', affordances: { answers: ['manipulate', 'tap'] }, label: 'Emergency Response (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['emergency', 'ghs'], description: 'Sequence emergency procedures and match GHS symbols' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'stoichiometry-lab',
    description: 'Stoichiometry lab on one balanced reaction, with molar masses printed under the equation and three task identities, each built and keyed in code from the reaction: conversion chain (tap conversion-factor cards, each drawn as a fraction, into the chain that turns a given mass into moles or grams of a substance: molar mass, mole ratio, molar mass), which runs out first (two reactant jars given by mass; say or tap which reactant runs out first, the limiting reactant, or that both run out together), and how much forms (the same two jars; say or type the grams of a product that can form, the theoretical yield). Nothing on screen computes the answer before credit: no mole counts, running units or reaction output. Difficulty is structural: more cards in the chain; a limiting reactant with the larger mass, then with more moles. ESSENTIAL for HS chemistry — closes the largest K-8 → HS gap (the mole concept).',
    constraints: 'Best for grades 8-12. The reaction comes from a built-in library of balanced reactions (hydrogen, methane, propane, ethane and glucose burning; the Haber process; metals with oxygen, chlorine or acid; iron smelting; decompositions); the manifest must NOT supply masses or answer keys. Percent yield is not asked. Not a particle simulation.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type', 'spoken'], role: 'apply', minutes: 9 },
    // Live-tutor wiring: `stoichiometryLab.card.ts` + `stoichiometryLab.boss.ts` (the spoken preset: a conversion-chain
    // board, two SAY_OR_SHOW modes).
    ...bossEntry(stoichiometryLabCard),
    evalModes: [
      { evalMode: 'convert', affordances: { answers: ['tap'] }, label: 'Conversion Chain (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['convert'], description: 'Tap conversion-factor cards into the chain that turns a given mass into moles of the same substance, moles of another, or grams of another (one, two or three cards)' },
      { evalMode: 'limiting', affordances: { answers: ['tap', 'spoken'] }, label: 'Which Runs Out First (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['limiting'], description: 'From two reactant masses, say or tap which reactant runs out first (the limiting reactant), or that both run out together' },
      { evalMode: 'yield', affordances: { answers: ['type', 'spoken'] }, label: 'Theoretical Yield (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['yield'], description: 'From two reactant masses, say or type the grams of a product that can form (the theoretical yield, through the limiting reactant)' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'gas-laws-simulator',
    description: 'Gas laws lab built on a particle model: a container of gas (a rigid steel tank, a cylinder with a free piston, a sealed syringe in a water bath, or a cylinder that is pressed and heated at once) shown with its particles moving, a before/after table of pressure, volume and temperature, and a change. The learner predicts what happens to the quantity that moves, then the change runs on screen. Three eval modes: observe (predict the direction: up, down or stays the same, from the particle model), predict (one change: choose the new value by proportion), calculate (two changes at once: combined gas law). Every item, choice and key is built by code; wrong choices are the classic errors (inverted ratio, old value kept, degrees Celsius in a ratio, only one change applied). ESSENTIAL for HS chemistry: closes the Gas Behavior unit missing from the K-8 catalog.',
    constraints: 'Best for grades 8-12. Grade 8 defaults to observe (qualitative, particle model). Grades 9-10 observe and predict (Boyle, Charles, Gay-Lussac). Grades 11-12 predict and calculate (combined gas law). Ideal gases only; amounts are relative, never in moles, so it does not teach PV=nRT with R or real-gas deviations.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 8 },
    // Live-tutor wiring: `gasLawsSimulator.card.ts` + `gasLawsSimulator.boss.ts` (the spoken preset, SAY_OR_SHOW).
    ...bossEntry(gasLawsSimulatorCard),
    evalModes: [
      { evalMode: 'observe', affordances: { answers: ['tap', 'spoken'] }, label: 'KMT Observe (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['observe'], description: 'Predict whether a quantity goes up, goes down or stays the same when a container of gas is heated, squeezed or given more gas (particle model; some items leave what is held to infer from the container)' },
      { evalMode: 'predict', affordances: { answers: ['tap', 'spoken'] }, label: 'Directional Predict (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['predict'], description: 'One change to a container of gas: choose the new pressure or volume by proportion (Boyle, Charles, Gay-Lussac; hard items give temperatures in degrees Celsius)' },
      { evalMode: 'calculate', affordances: { answers: ['tap', 'spoken'] }, label: 'Gas Law Calculate (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['calculate'], description: 'Two changes at once to a cylinder of gas: choose the new pressure, volume or temperature with the combined gas law' },
    ],
    supportsEvaluation: true,
  },
];
