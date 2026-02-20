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
    constraints: 'Best for middle-school and above. Use for chemistry, biochemistry, organic chemistry, crystal structures, or any topic involving molecules, atoms, and chemical bonds.',
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
  },
  {
    id: 'periodic-table',
    description: 'Interactive periodic table of all 118 elements with detailed element information, electron shell visualization, stability charts, and category filtering. Perfect for teaching element properties, electron configuration, periodic trends, atomic structure, chemical categories, and the organization of the periodic table. Features clickable elements with modal views showing atomic number, mass, electron shells, valence electrons, phase, and band of stability.',
    constraints: 'Best for middle-school and above. Use for chemistry lessons on periodic trends, element properties, atomic structure, electron configuration, or chemical families. Ideal for introducing the periodic table or exploring specific element groups.',
    tutoring: {
      taskDescription: 'Student is exploring the periodic table. They have clicked on {{elementsExplored}} unique element(s) so far. Currently viewing: {{selectedElementName}} ({{selectedElementSymbol}}, atomic number {{selectedElementNumber}}), a {{selectedElementCategory}} in group {{selectedElementGroup}}, period {{selectedElementPeriod}}. Phase: {{selectedElementPhase}}. Valence electrons: {{selectedElementValence}}. Category filter active: {{hoveredCategory}}.',
      contextKeys: ['title', 'focusCategory', 'selectedElementName', 'selectedElementSymbol', 'selectedElementNumber', 'selectedElementCategory', 'selectedElementGroup', 'selectedElementPeriod', 'selectedElementValence', 'selectedElementPhase', 'hoveredCategory', 'elementsExplored', 'categoriesExplored'],
      scaffoldingLevels: {
        level1: '"Click on an element to learn about it. What do you notice about how the elements are arranged on the table?"',
        level2: '"Look at where {{selectedElementName}} sits — it\'s in group {{selectedElementGroup}}, period {{selectedElementPeriod}}. Elements in the same column share similar properties. Try clicking another element in the same group to compare!"',
        level3: '"Let\'s explore {{selectedElementName}} ({{selectedElementSymbol}}) step by step. It\'s element number {{selectedElementNumber}} in the {{selectedElementCategory}} family. It has {{selectedElementValence}} valence electrons — that\'s the key to how it bonds. All elements in group {{selectedElementGroup}} have similar valence electrons, which is why they behave alike in chemical reactions. Try clicking a neighbor to see the pattern!"',
      },
      commonStruggles: [
        { pattern: 'Student clicks elements randomly without reading the modal details', response: 'Guide: "When you click an element, take a moment to read its properties — the atomic number, electron shells, and phase. Each detail tells a story about how that element behaves!"' },
        { pattern: 'Student does not understand why elements are arranged in rows and columns', response: 'Explain: "The table is organized by atomic number — each element has one more proton than the last. Rows (periods) fill up electron shells. Columns (groups) have the same number of outer electrons, so they behave similarly!"' },
        { pattern: 'Student confuses groups (columns) and periods (rows)', response: 'Clarify: "Groups go UP and DOWN (columns) — elements in the same group are like a family with similar personalities. Periods go LEFT to RIGHT (rows) — they show how shells fill up with electrons."' },
        { pattern: 'Student does not understand category colors or element families', response: 'Connect to properties: "Each color represents a family of elements. Alkali metals (one color) are super reactive. Noble gases (another color) barely react at all. Click the category buttons at the top to highlight a whole family!"' },
      ],
      aiDirectives: [
        {
          title: 'PERIODIC TRENDS',
          instruction:
            'When the student explores multiple elements in the same group or period, highlight periodic trends: '
            + 'atomic radius increases down a group and decreases across a period; '
            + 'electronegativity increases across a period and decreases down a group; '
            + 'reactivity patterns differ for metals vs nonmetals. '
            + 'Keep explanations visual and age-appropriate.',
        },
      ],
    },
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
    id: 'equation-balancer',
    description: 'Interactive chemical equation balancer with adjustable coefficients, live atom counter, molecule visualization, and balance scale. Students adjust coefficients to balance equations while tracking atom counts on each side. Perfect for teaching conservation of mass and systematic problem-solving. ESSENTIAL for grade 6-8 chemistry.',
    constraints: 'Requires equation data with reactants/products and atom counts. Max 10 compounds. Best for grade 6-8.',
    tutoring: {
      taskDescription: 'The student is balancing the chemical equation: {{equationString}}. They adjust coefficients (big numbers in front of formulas) to make atom counts match on both sides. Currently balanced elements: {{balancedElements}}, unbalanced elements: {{unbalancedElements}}.',
      contextKeys: ['currentCoefficients', 'atomCounts', 'elements', 'balancedElements', 'unbalancedElements', 'isBalanced', 'equationString', 'guidedMode', 'guidedElement', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the atom counter — which element has different numbers on each side? Start there."',
        level2: '"Focus on {{guidedElement}} first. There are {{atomCounts.reactants[guidedElement]}} on the left and {{atomCounts.products[guidedElement]}} on the right. What coefficient would make them equal?"',
        level3: '"Let\'s balance {{guidedElement}} step by step. Right now you have {{atomCounts.reactants[guidedElement]}} {{guidedElement}} atoms in the reactants. Each molecule of the product has a certain number — try coefficient 2 and watch the atom counter change."',
      },
      commonStruggles: [
        { pattern: 'Student changes subscripts instead of coefficients', response: 'Remind them: coefficients (big numbers in front) tell HOW MANY molecules. Subscripts (small numbers) tell what the molecule IS. We never change subscripts — that would make a different molecule!' },
        { pattern: 'Student balances one element but unbalances another', response: 'Acknowledge the progress: "Great, you balanced the hydrogen! But notice the oxygen changed too. That happens — it\'s like a seesaw. Try adjusting the coefficient on the compound that has BOTH elements."' },
        { pattern: 'Student uses very large coefficients', response: 'Guide toward simplicity: "Your equation is balanced, but can we use smaller numbers? Try dividing all coefficients by the same number — the smallest balanced set is the conventional answer."' },
        { pattern: 'Student seems stuck after 5+ attempts', response: 'Offer guided mode: "Let\'s try a strategy! Start with the element that appears in the fewest places — it\'s easier to control. Which element only shows up in one compound on each side?"' },
      ],
    },
  },
  {
    id: 'energy-of-reactions',
    description: 'Interactive energy-of-reactions visualization with enthalpy diagrams, temperature gauges, bond energy breakdowns, and catalyst comparisons. Students explore why reactions release or absorb heat through animated energy diagrams and real-world connections. Perfect for teaching exothermic/endothermic classification, activation energy, and bond energies. ESSENTIAL for grade 5-8 chemistry.',
    constraints: 'Requires reaction data with energy values. Bond energy view only for grade 7-8. Best for grade 5-8.',
    tutoring: {
      taskDescription: 'The student is exploring the energy changes in {{reactionName}} ({{equation}}). This is a {{reactionType}} reaction with \u0394H = {{deltaH}} kJ. They are working on a {{challengeType}} challenge: "{{instruction}}".',
      contextKeys: ['reactionName', 'reactionType', 'equation', 'deltaH', 'activationEnergy', 'realWorldExample', 'reactionActive', 'showCatalyst', 'bondEnergiesEnabled', 'challengeType', 'instruction', 'attemptNumber', 'studentAnswer'],
      scaffoldingLevels: {
        level1: '"Look at the energy diagram \u2014 are the products higher or lower than the reactants? What does that tell you about energy?"',
        level2: '"This is a {{reactionType}} reaction. The \u0394H is {{deltaH}} kJ. On the diagram, notice the products are {{reactionType === \'exothermic\' ? \'lower\' : \'higher\'}} \u2014 energy came {{reactionType === \'exothermic\' ? \'out\' : \'in\'}}. Think of {{realWorldExample}}."',
        level3: '"Let\'s trace the energy path step by step. Start at the reactant level. The ball has to climb the activation energy hill ({{activationEnergy}} kJ) to get going. Then it {{reactionType === \'exothermic\' ? \'rolls down below where it started \u2014 releasing\' : \'lands higher than where it started \u2014 absorbing\'}} {{Math.abs(deltaH)}} kJ of energy."',
      },
      commonStruggles: [
        { pattern: 'Student confuses exothermic with endothermic', response: 'Connect to experience: "EXO means OUT \u2014 energy exits the reaction, making it feel HOT. ENDO means IN \u2014 energy enters the reaction, making it feel COLD. A campfire is exo (hot!), a cold pack is endo (cold!)."' },
        { pattern: 'Student does not understand the energy diagram direction', response: 'Use the hill metaphor: "Think of it like a ball rolling. If it ends up LOWER, it released energy on the way down (exothermic). If it ends up HIGHER, something had to push it up there (endothermic)."' },
        { pattern: 'Student confuses activation energy with deltaH', response: 'Clarify: "Activation energy is the push to START the reaction \u2014 like lighting a match. DeltaH is the OVERALL energy change \u2014 did the reaction give off or absorb heat in total? They are different things!"' },
        { pattern: 'Student struggles with bond energy calculations', response: 'Break it into steps: "First, add up ALL the energy to break bonds (that costs energy). Then add up ALL the energy from forming bonds (that releases energy). Subtract: if breaking costs more, it is endothermic. If forming releases more, it is exothermic."' },
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
    id: 'mixing-and-dissolving',
    description: 'Interactive solutions and mixtures explorer with beaker workspace, substance shelf, particle view, temperature control, saturation indicator, concentration meter, and separation tools. Students add substances to water and discover what dissolves and what does not, then use separation techniques to recover solutes. Perfect for teaching dissolving, solutions vs mixtures, and saturation. ESSENTIAL for grade 3-7 chemistry.',
    constraints: 'Requires substance data with solubility values. Best for grade 3-7. Solubility curve only for grade 6-7.',
    tutoring: {
      taskDescription: 'The student is exploring mixing and dissolving in {{solventName}} at {{temperature}}\u00B0C. They have added: {{addedSubstanceNames}}. Current challenge: {{challengeType}} \u2014 "{{instruction}}".',
      contextKeys: ['solventName', 'temperature', 'addedSubstanceNames', 'addedSubstanceTypes', 'isSaturated', 'isStirring', 'particleViewActive', 'selectedSeparation', 'challengeType', 'instruction', 'attemptNumber', 'studentAnswer'],
      scaffoldingLevels: {
        level1: '"Look closely at what happened when you added that substance. Can you still see it? What does that tell you?"',
        level2: '"Try toggling the particle view \u2014 you can see what\u2019s happening at the molecule level. The blue dots are water molecules. What are they doing to the solute particles?"',
        level3: '"When something dissolves, the water molecules surround each solute particle and pull it apart. That\u2019s why it looks like it disappeared \u2014 but it\u2019s still there! You could prove it by evaporating the water."',
      },
      commonStruggles: [
        { pattern: 'Student thinks dissolved substance has disappeared or been destroyed', response: 'Connect to conservation: "It looks gone, but it\u2019s still there! The particles just spread out so small you can\u2019t see them. Try the particle view \u2014 or better yet, how could you PROVE the sugar is still in the water?"' },
        { pattern: 'Student confuses solutions with mixtures', response: 'Clarify the difference: "In a solution, everything looks the same \u2014 you can\u2019t see the parts. In a mixture like sand and water, you CAN still see the different parts. Can you sort these into solutions and mixtures?"' },
        { pattern: 'Student does not understand saturation', response: 'Make it concrete: "Imagine your backpack is FULL \u2014 you can\u2019t fit any more books. The water is like that \u2014 it can only hold so much dissolved stuff. The extra just sits at the bottom!"' },
        { pattern: 'Student picks wrong separation method', response: 'Guide method selection: "Think about what kind of mixture you have. Is the substance dissolved (invisible) or undissolved (you can see it)? Filtration catches big pieces, evaporation recovers dissolved things."' },
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
  {
    id: 'ph-explorer',
    description: 'Interactive pH scale exploration with rainbow gradient (0-14), substance testing with multiple indicators (litmus, cabbage juice, universal, phenolphthalein), acid/base/neutral sorting, neutralization station with real-time pH meter, and particle view showing H+/OH- concentration. Features cabbage juice rainbow mode where students create a color spectrum by testing many substances. Perfect for teaching the pH scale, acids and bases, indicators, and neutralization. ESSENTIAL for grade 4-8 chemistry.',
    constraints: 'Best for grades 4-8. Use for chemistry lessons on pH, acids and bases, indicators, neutralization, acid-base reactions, and the pH scale. Grade-appropriate complexity adjusts automatically.',
    tutoring: {
      taskDescription: 'Student is exploring pH and acids/bases with {{totalSubstances}} substances available. They have tested {{testedCount}} substances so far. Currently on challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Selected indicator: {{selectedIndicator}}. Rainbow substances tested: {{rainbowCount}}. Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'totalSubstances', 'testedCount', 'selectedSubstance', 'selectedIndicator', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'studentAnswer', 'neutralizationPH', 'rainbowCount'],
      scaffoldingLevels: {
        level1: '"What color did the indicator turn? What do you think that tells us about this substance?"',
        level2: '"Remember: acids turn litmus red and have pH below 7. Bases turn litmus blue and have pH above 7. Look at the color you got with {{selectedIndicator}} — is {{selectedSubstance}} an acid, a base, or neutral?"',
        level3: '"Let\'s figure this out step by step. You tested {{selectedSubstance}} with {{selectedIndicator}}. The color tells us the pH. On our scale, red colors mean low pH (acidic), green means neutral (pH 7), and blue/purple means high pH (basic). Where does this color fall?"',
      },
      commonStruggles: [
        { pattern: 'Student confuses acids and bases', response: 'Connect to everyday experience: "Think about taste — acids taste SOUR like lemon juice. Bases feel SLIPPERY like soap. Sour = acid, slippery = base!"' },
        { pattern: 'Student does not understand the pH scale direction', response: 'Use the number line: "pH works like a number line from 0 to 14. The middle is 7 — that\'s neutral, like pure water. Numbers below 7 are acids (the lower, the stronger). Numbers above 7 are bases."' },
        { pattern: 'Student struggles with neutralization concept', response: 'Make it concrete: "When you mix an acid and a base, they cancel each other out — like mixing hot and cold water to get warm. The pH moves toward 7. That\'s neutralization!"' },
        { pattern: 'Student cannot interpret indicator colors', response: 'Guide with the color chart: "Each indicator has its own color code. Litmus is simple: red = acid, blue = base. Cabbage juice is a rainbow: red and pink = acid, purple = neutral, blue and green = base, yellow = very strong base!"' },
      ],
    },
  },
  {
    id: 'safety-lab',
    description: 'Gamified lab safety training with interactive lab scene for hazard identification, PPE selection station with draggable equipment (goggles, gloves, apron, lab coat, face shield), GHS hazard symbol matching, emergency response sequencing, and safe lab design mode. K-2 covers basic safety rules, 3-5 adds hazard symbols and equipment handling, 6-8 includes full GHS symbols, risk assessment, and SDS basics. Every chemistry primitive references this one. ESSENTIAL for K-8 science safety.',
    constraints: 'Best for K-8. Use for lab safety training, science safety rules, PPE selection, hazard identification, emergency procedures, and GHS hazard symbols. Should precede any hands-on chemistry activity.',
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
  },
];
