/**
 * Science Catalog - Component definitions for science/chemistry primitives
 *
 * Contains chemistry visualization components for molecular structures,
 * periodic table, and science-related content.
 */

import { ComponentDefinition } from '../../../types';

export const SCIENCE_CATALOG: ComponentDefinition[] = [
  {
    id: 'molecule-viewer',
    description: 'Interactive 3D molecular structure visualization with CPK-colored atoms and chemical bonds. Perfect for chemistry lessons on molecular structure, bonding, organic compounds, crystal lattices, proteins, and biochemistry. Features interactive atom selection, bond analysis, and auto-rotating 3D view. HIGHLY RECOMMENDED for any chemistry topic involving molecular structure.',
    constraints: 'Best for middle-school and above. Use for chemistry, biochemistry, organic chemistry, crystal structures, or any topic involving molecules, atoms, and chemical bonds.'
  },
  {
    id: 'periodic-table',
    description: 'Interactive periodic table of all 118 elements with detailed element information, electron shell visualization, stability charts, and category filtering. Perfect for teaching element properties, electron configuration, periodic trends, atomic structure, chemical categories, and the organization of the periodic table. Features clickable elements with modal views showing atomic number, mass, electron shells, valence electrons, phase, and band of stability.',
    constraints: 'Best for middle-school and above. Use for chemistry lessons on periodic trends, element properties, atomic structure, electron configuration, or chemical families. Ideal for introducing the periodic table or exploring specific element groups.'
  },
  {
    id: 'matter-explorer',
    description: 'Interactive matter classification activity where students sort everyday objects (ice, water, air, rock, milk, steam) into solid, liquid, and gas bins. Features property inspector, temperature slider for state changes, and mystery material challenges. Perfect for teaching K-2 students about states of matter and observable properties. ESSENTIAL for Kindergarten and Grade 1-2 science.',
    constraints: 'Best for K-2. Use for early science lessons on states of matter, properties of materials, heating/cooling changes, and classification skills.',
    tutoring: {
      taskDescription: 'Student is exploring matter by sorting {{totalObjects}} objects into solid, liquid, and gas bins. Currently on challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). They have sorted {{sortedCount}} objects so far.',
      contextKeys: ['gradeBand', 'totalObjects', 'totalChallenges', 'currentChallengeIndex', 'challengeType', 'instruction', 'sortedCount', 'selectedObject', 'temperature', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What do you notice about this object? Does it keep its own shape, or does it flow?"',
        level2: '"Think about what happens when you pour it. Solids keep their shape. Liquids take the shape of their container. Gases spread out everywhere. Which one is {{selectedObject}}?"',
        level3: '"Let\'s look at {{selectedObject}} together. Can you hold it in your hand? If you put it in a cup, would it keep its shape or fill the cup? That tells us if it\'s a solid or a liquid."',
      },
      commonStruggles: [
        { pattern: 'Student places honey or sand in solid bin', response: 'Ask: "I see why you think that! It IS thick. But try imagining pouring it — does it flow? Solids keep their shape, but honey flows slowly like a liquid."' },
        { pattern: 'Student cannot identify gases', response: 'Say: "Gases are tricky because you can\'t always see them! Think about air — you can\'t see it, but you can feel it when the wind blows. Air is a gas!"' },
        { pattern: 'Student confuses steam and water', response: 'Say: "Great question! Water is a liquid you can see in your glass. Steam is what happens when water gets really hot — it turns into a gas that floats up into the air!"' },
        { pattern: 'Student struggles with temperature slider', response: 'Guide: "Watch what happens to the ice cube as we make it warmer. See it changing? That\'s because heat can turn solids into liquids!"' },
      ],
    },
  },
  {
    id: 'reaction-lab',
    description: 'Interactive chemistry experiment station where students combine real substances and observe reactions — fizzing, color changes, temperature changes, gas production, precipitates. Features split Real View / Particle View, observation notebook, and multi-phase workflow (predict → experiment → observe → explain). K-2 uses kitchen chemistry, 3-5 adds classification and particle view, 6-8 adds equation balancing and conservation of mass. Perfect for teaching chemical vs physical change, signs of chemical reactions, and the scientific method. ESSENTIAL for K-8 chemistry and science.',
    constraints: 'Best for K-8. Use for chemistry lessons on chemical reactions, physical vs chemical change, states of matter changes, kitchen chemistry, acid-base reactions, oxidation, dissolution, and the scientific method. Grade-appropriate complexity adjusts automatically.',
    tutoring: {
      taskDescription: 'Student is conducting the "{{experimentName}}" experiment ({{experimentCategory}}). Currently in {{currentPhase}} phase. Reaction type: {{reactionType}}. They have recorded {{observationsRecorded}}/{{observationPromptsTotal}} observations and identified {{signsIdentified}}/{{signsTotal}} signs of change. On challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'experimentName', 'experimentCategory', 'reactionType', 'signs', 'currentPhase', 'isReacting', 'reactionComplete', 'predictionSubmitted', 'prediction', 'observationsRecorded', 'observationPromptsTotal', 'signsIdentified', 'signsTotal', 'particleViewActive', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'equation'],
      scaffoldingLevels: {
        level1: '"What do you notice happening? Look carefully at the substances — is anything changing?"',
        level2: '"Think about the signs of a chemical change: fizzing, color change, temperature change, new smell, or a new substance forming. Which signs can you see in this {{experimentName}} experiment?"',
        level3: '"Let\'s look at this step by step. The {{reactionType}} change is happening because the substances are {{reactionType === \'chemical\' ? \'forming new substances with different properties\' : \'changing form but staying the same substance\'}}. Look at the {{currentPhase === \'observe\' ? \'observation prompts\' : \'question\'}} and describe exactly what you see."',
      },
      commonStruggles: [
        { pattern: 'Student confuses chemical and physical change', response: 'Ask: "Is the substance still the same thing, just in a different form? Or has something completely NEW been created? If it\'s new, that\'s a chemical change!"' },
        { pattern: 'Student skips prediction phase or writes minimal prediction', response: 'Encourage: "Scientists always predict before experimenting! What do you THINK will happen? There\'s no wrong prediction — it\'s about thinking like a scientist."' },
        { pattern: 'Student cannot identify signs of chemical change', response: 'Guide: "Look for these clues: Did it fizz or bubble? Did the color change? Did it get hot or cold? Does it smell different? Any of these could be a sign of a chemical change!"' },
        { pattern: 'Student struggles with particle view', response: 'Simplify: "Think of the colored circles as tiny atoms. In a chemical change, the atoms rearrange — they break apart and join together in new ways to make new substances."' },
        { pattern: 'Student struggles to balance equation (grades 6-8)', response: 'Guide: "Count the atoms on each side. The number of each type of atom must be the same before and after — nothing is created or destroyed, just rearranged!"' },
      ],
    },
  },
  {
    id: 'states-of-matter',
    description: 'Interactive particle simulation where students control temperature and watch particles speed up, slow down, break free, or lock into place. Split view shows macroscopic substance (beaker) alongside particle model synchronized in real-time. Temperature slider with color-coded state ranges and phase markers. Supports multiple substances (water, wax, iron, chocolate, butter). K-2 focuses on ice/water/steam with simple observations. 3-5 adds heating curves, particle speed indicators, and substance comparison. Perfect for teaching the particle model of matter, phase transitions, and energy transfer. ESSENTIAL for K-5 science.',
    constraints: 'Best for K-5. Use for science lessons on states of matter, particle model, phase changes, melting/boiling/freezing/condensation, temperature and energy, and kinetic theory. Grade-appropriate complexity adjusts automatically.',
    tutoring: {
      taskDescription: 'Student is exploring {{substanceName}} at {{currentTemperature}}°C (currently a {{currentState}}). Melting point: {{meltingPoint}}°C, Boiling point: {{boilingPoint}}°C. Particle energy: {{particleSpeed}}%. They have explored {{substancesExplored}} substance(s). On challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'substanceName', 'substanceFormula', 'meltingPoint', 'boilingPoint', 'currentTemperature', 'currentState', 'particleSpeed', 'substancesExplored', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the particles on the right side. What are they doing right now? Are they moving fast or slow?"',
        level2: '"When {{substanceName}} is a {{currentState}}, the particles {{currentState === \'solid\' ? \'vibrate in place but stay locked together\' : currentState === \'liquid\' ? \'slide past each other but stay close\' : \'fly apart in all directions\'}}. Try changing the temperature and watch what happens!"',
        level3: '"Let\'s think step by step. Right now the temperature is {{currentTemperature}}°C and the melting point is {{meltingPoint}}°C. If you raise the temperature past {{meltingPoint}}°C, the particles will get enough energy to break free from their spots. Try sliding the temperature up slowly and watch for the moment they start to slide!"',
      },
      commonStruggles: [
        { pattern: 'Student cannot identify the current state from the particle view', response: 'Guide: "Look at how the particles are moving. If they\'re shaking but staying in place, it\'s a solid. If they\'re sliding around, it\'s a liquid. If they\'re bouncing off the walls everywhere, it\'s a gas!"' },
        { pattern: 'Student does not understand why solids keep their shape', response: 'Explain: "See how the particles in a solid are packed tightly together and just vibrate? They\'re holding on to each other! That\'s why a solid keeps its shape — the particles can\'t move past each other."' },
        { pattern: 'Student expects instant change at melting/boiling point', response: 'Clarify: "Phase changes happen right at the melting or boiling point. Keep the slider right at that temperature and watch — the particles are using all the energy to break free, not to get hotter!"' },
        { pattern: 'Student struggles with heating curve plateaus', response: 'Guide: "The flat parts on the graph are the exciting moments — that\'s where the substance is changing state! All the energy goes into breaking particles apart, not making them hotter."' },
      ],
    },
  },
  {
    id: 'atom-builder',
    description: 'Interactive atom construction tool where students drag protons, neutrons, and electrons to build atoms from scratch. Features Bohr model visualization with electron shells, mini periodic table with live element highlighting, identity card, charge and mass number display. Supports build, identify, fill-shells, make-ion, and make-isotope challenges. Grades 3-5 focus on element identity and shell filling. Grades 6-8 add ions, isotopes, and electron configuration. ESSENTIAL for chemistry lessons on atomic structure, subatomic particles, and the periodic table.',
    constraints: 'Best for grades 3-8. Use for chemistry lessons on atoms, subatomic particles, electron shells, element identity, ions, isotopes, periodic table connections, and electron configuration.',
    tutoring: {
      taskDescription: 'Student is building an atom with {{protons}} protons, {{neutrons}} neutrons, {{electrons}} electrons (element: {{elementName}}, charge: {{charge}}). Currently on challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Instruction: "{{instruction}}". Attempt {{attemptNumber}}. Shells: {{shells}}. Shells correct: {{shellsCorrect}}.',
      contextKeys: ['protons', 'neutrons', 'electrons', 'charge', 'massNumber', 'elementName', 'elementSymbol', 'shells', 'shellsCorrect', 'valenceElectrons', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the periodic table — what number is next to the element you\'re building? That tells you how many protons it needs!"',
        level2: '"Remember: protons = atomic number = element identity. Once you have the right protons, add the same number of electrons to make it neutral. Neutrons are usually close to the proton count for light elements."',
        level3: '"Let\'s build step by step. First, the atomic number for {{elementName}} tells us it needs {{protons}} protons. For a neutral atom, add {{protons}} electrons too. For the most common isotope, add neutrons — usually the same number or slightly more than the protons."',
      },
      commonStruggles: [
        { pattern: 'Student adds electrons before protons', response: 'Guide: "Start with protons first! Protons tell us WHICH element we\'re building. Then add neutrons to the nucleus, and finally electrons to the shells."' },
        { pattern: 'Student puts too many electrons in the first shell', response: 'Explain: "The first shell can only hold 2 electrons — it\'s the smallest shell! Once it\'s full, the next electrons go in shell 2, which can hold up to 8."' },
        { pattern: 'Student confuses protons and electrons when making ions', response: 'Clarify: "An ion is when the number of electrons is DIFFERENT from the protons. If you remove an electron, you get a positive charge (+1). If you add an extra electron, you get a negative charge (-1). The protons never change!"' },
        { pattern: 'Student does not understand isotopes', response: 'Simplify: "Isotopes are like siblings — they have the same number of protons (same element!) but different numbers of neutrons. Carbon-12 has 6 neutrons, but Carbon-14 has 8 neutrons. Same element, different mass!"' },
        { pattern: 'Student cannot identify element from particle counts', response: 'Guide: "The SECRET to identifying any element is simple: count the protons! The number of protons IS the atomic number, and the atomic number tells you exactly which element it is. Look at the periodic table!"' },
      ],
    },
  },
  {
    id: 'molecule-constructor',
    description: 'Interactive molecule-building workspace where students snap atoms together to form molecules. Atom palette with category-colored elements and valence connection dots. Click-to-bond interaction with single, double, and triple bond support. Live formula display, valence satisfaction indicators, molecule gallery with real-world categories, and multi-challenge progression (build, identify, formula write, predict). Perfect for teaching chemical bonding, molecular structure, valence rules, and molecular formulas. ESSENTIAL for grades 3-8 chemistry.',
    constraints: 'Best for grades 3-8. Use for chemistry lessons on chemical bonding, molecules, valence, molecular formulas, covalent bonds, Lewis structures, molecular shape, and properties from structure.',
    tutoring: {
      taskDescription: 'Student is building molecules by snapping atoms together. Currently on challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Target: {{targetName}} ({{targetFormula}}). Current formula: {{formula}}. Atoms placed: {{atomsPlaced}}, bonds formed: {{bondsFormed}}. All valence satisfied: {{allValenceSatisfied}}. Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'atomsPlaced', 'bondsFormed', 'formula', 'allValenceSatisfied', 'targetFormula', 'targetName', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'placedElements'],
      scaffoldingLevels: {
        level1: '"Look at the connection dots around each atom. How many dots does {{targetName}} need to use up all its connection points?"',
        level2: '"Remember: each element has a set number of bonds it can make. Hydrogen makes 1, Oxygen makes 2, Carbon makes 4. To build {{targetName}} ({{targetFormula}}), count how many of each atom you need and connect them so every dot is used."',
        level3: '"Let\'s build {{targetName}} step by step. First, place the central atom — usually the one that makes the most bonds (like Carbon with 4 or Oxygen with 2). Then attach the other atoms one by one. Watch the formula update as you go. You need: {{instruction}}."',
      },
      commonStruggles: [
        { pattern: 'Student places atoms but does not form bonds', response: 'Guide: "Great start placing atoms! Now click one atom, then click another to snap them together with a bond. Watch for the green dots — those show where bonds can form!"' },
        { pattern: 'Student tries to bond atoms with no available valence', response: 'Explain: "That atom\'s connection points are all used up! Each atom can only make a certain number of bonds — hydrogen makes 1, oxygen makes 2, carbon makes 4. Try connecting to an atom that still has green dots."' },
        { pattern: 'Student has correct atoms but wrong number of bonds', response: 'Guide: "You have the right atoms! Now make sure every green dot is connected. If an atom still has green dots, it needs more bonds. Click two atoms with available dots to connect them."' },
        { pattern: 'Student confuses molecular formula with atom count', response: 'Clarify: "In a formula like H\u2082O, the small 2 after H means there are 2 hydrogen atoms. No number after O means there is 1 oxygen atom. So H\u2082O has 3 atoms total: 2 hydrogens and 1 oxygen."' },
        { pattern: 'Student does not understand double or triple bonds', response: 'Explain: "Some atoms need to share more than one bond! Click two already-bonded atoms again to upgrade to a double bond. Double bonds share 2 connections, triple bonds share 3. Oxygen in O\u2082 uses a double bond because each oxygen needs 2 connections."' },
      ],
    },
  },
];
