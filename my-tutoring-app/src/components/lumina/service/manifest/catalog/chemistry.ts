/**
 * Chemistry Catalog - Component definitions for chemistry primitives
 *
 * Contains chemistry visualization components for molecular structures,
 * periodic table, chemical reactions, states of matter, and lab safety.
 */

import { ComponentDefinition } from '../../../types';
import type { PeriodicMiss, SpokenPeriodicMiss } from '../../../primitives/chemistry-primitives/periodicTableWorkspace';
import { bossEntry } from '../../../components/live-activity/boss';
import { matterExplorerCard } from '../../../primitives/visual-primitives/chemistry/matterExplorer.card';
import { statesOfMatterCard } from '../../../primitives/visual-primitives/chemistry/statesOfMatter.card';
import type { MoleculeMiss } from '../../../primitives/visual-primitives/chemistry/moleculeConstructorWorkspace';
import type { AtomMiss } from '../../../primitives/visual-primitives/chemistry/atomBuilderWorkspace';
import type { DissolvingMiss } from '../../../primitives/visual-primitives/chemistry/mixingAndDissolvingWorkspace';
import type { PhExplorerMiss } from '../../../primitives/visual-primitives/chemistry/phExplorerWorkspace';
import type { GasLawsMiss } from '../../../primitives/visual-primitives/chemistry/gasLawsWorkspace';
import type { EquationBalancerMiss } from '../../../primitives/visual-primitives/chemistry/equationBalancerWorkspace';
import type { ReactionMiss } from '../../../primitives/visual-primitives/chemistry/reactionLabWorkspace';
import type { EnergyMiss } from '../../../primitives/visual-primitives/chemistry/energyOfReactionsWorkspace';
import type { StoichiometryMiss } from '../../../primitives/visual-primitives/chemistry/stoichiometryLabWorkspace';
import { missLists } from './missLists';

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
    // ── DI MODALITY (2026-08-19) — FIRST chemistry port. The tutor owns the
    // clock in all four task shapes: it asks once, waits, judges the spoken
    // answer in-band (or is handed the CODE-COMPUTED verdict for a tap), and
    // its own line is the advance. No advance timer, no Next button, no
    // push-to-talk mic anywhere in the path.
    // THE PORT CLOSED A FICTION: these three eval modes were declared with
    // supportsEvaluation: true while the generator emitted no challenges and
    // the component rendered none — every lesson slot that pinned a mode got
    // free exploration and no measurement.
    // THE SPLIT (standing gate 1): find answers with a TAP because its answer
    // is a POSITION on the page (the one honest tap shape here); name/compare/
    // valence answer with the VOICE (short_spoken_word / closed_set_choice /
    // number_word_to_20 — all benched or accepted-build-ahead).
    // WHAT THE JUDGED SURFACE HIDES: the search bar (types "gold", gets Au),
    // the category filter chips, and the tap-to-open element modal (shells on
    // screen during a valence item is the answer in pixels). The element card
    // returns as the reveal, after the affirmation.
    // Cue lines and the per-item judging contracts live in
    // `periodicTableScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame. SENTINEL DISCIPLINE re-checked on every line below:
    // no sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription: 'Live-judged Direct Instruction on the periodic table. Right now the round type is "{{challengeType}}" and the question side is "{{stimulus}}". In explore rounds the learner answers by TAPPING a box on a table you cannot see — you stay silent until the application tells you what they tapped. In identify and trend rounds they answer OUT LOUD and you judge what you hear against the exact contract in each bracketed [PT_ITEM] message. You speak the exact scripted lines from those messages and nothing else. Reading the table themselves is the entire skill being practiced, so never volunteer an element\'s location, name, or count first. When the round type says free-exploration, this is instead the free table: react briefly and warmly to the [ELEMENT_SELECTED] and [GROUP_TREND] updates as an exploration guide.',
      // Exactly what the pack pushes through contextFor — every key the
      // click-era block interpolated (selectedElementName, valence, …) was
      // the answer or the material that gives it away.
      contextKeys: ['challengeType', 'stimulus'],
      // 18d: every rung routes through the SCRIPTED correction. A re-spoken
      // ask opens with neither "Yes" nor "My turn:", so the reducer records no
      // verdict and the child waits on a lesson that cannot advance.
      scaffoldingLevels: {
        level1: 'Speak this item\'s scripted correction line, exactly as the application gave it — inside the item message for spoken rounds, inside the tap message for explore rounds. It already re-models the table-reading route and hands the question back, and it opens with "My turn:" where the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a re-spoken question or any other wording however patient: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further — the activity moves the lesson on by itself and carries the next question to you.',
      },
      // Observable behaviours only, with PERFORMABLE responses that produce a
      // VERDICT (defect 7: a sentiment without the verdict line stalls a
      // correct child).
      commonStruggles: [
        { pattern: 'Says the element\'s symbol letters instead of its name', response: 'Run the item\'s scripted correction line — the letters are the question, not the name — then wait in silence for their next try.' },
        { pattern: 'Answers a trend question with the group number instead of the electron count', response: 'Run the item\'s scripted correction line, which re-models counting the tall columns, then wait in silence.' },
        { pattern: 'Taps a box next to the right one', response: 'The tap message hands you the exact line for what they tapped — speak that line and nothing else.' },
        { pattern: 'Goes quiet and neither speaks nor taps for a long time', response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again.' },
      ],
      aiDirectives: [
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'After an affirmation or a correction, the turn is OVER — never run on into another question, '
            + 'another element, or a next round of your own: the application sends every next question itself. '
            + 'A continued turn asks about an item the screen is not showing.',
        },
        {
          title: 'PERIODIC TRENDS (free exploration only)',
          instruction:
            'When the session is free exploration and the student clicks several elements in one group or period, '
            + 'briefly highlight the trend: atomic radius increases down a group and decreases across a period; '
            + 'reactivity patterns differ for metals vs nonmetals. Keep it visual and age-appropriate. '
            + 'During judged rounds this directive is dormant — scripted lines only.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'explore', affordances: { answers: ['tap'] }, label: 'Element Hunt (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['explore'], description: 'DI judged: the tutor names a target — by name, spelled symbol, atomic number, or group and period — and the child taps its box. Verdict computed in code.' },
      { evalMode: 'identify', affordances: { answers: ['spoken'] }, label: 'Name It (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['identify'], description: 'DI judged, spoken: a position, number, or symbol clue; the child reads the table and says the element\'s name.' },
      { evalMode: 'trend', affordances: { answers: ['spoken'] }, label: 'Periodic Trends (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['trend'], description: 'DI judged, spoken: same-group size and reactivity comparisons plus main-group outer-electron counts, all keys computed from the table.' },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      guidance: 'The full periodic table is on screen with group numbers across the top and period numbers down the side; '
        + 'every box shows its atomic number, symbol and name, and there is no search or filter. Element Hunt: the learner '
        + 'taps the box for an element named by name, spelled symbol, atomic number or group and period; the activity '
        + 'checks the tap. Before a tap never say where the box is, and on a group-and-period ask never say which element '
        + 'is there. Name It: the learner reads the table and says the element\'s name; letters of the symbol read back '
        + 'are not a name. Trends: the learner says which of two named elements is bigger or more reactive, or how many '
        + 'electrons are in an element\'s outer shell; the group number is not the outer-electron count. Before an '
        + 'attempt never say the answer or the rule that decides it for this pair. You cannot point at boxes; a lever is '
        + 'the only mark you can put on the table.',
      // The table's own check of an Element Hunt tap (`periodicMiss`), and the spoken answers of Trends and Name It
      // (`periodicSpokenMisses`). Every mode has levers (`periodicTableLevers.ts`); no miss is unanswered.
      levers: true,
      misses: missLists<PeriodicMiss | SpokenPeriodicMiss>({ explore: ['same_first_letter', 'next_box', 'same_row', 'same_column', 'other_box'],
        identify: ['said_symbol', 'next_box'],
        trend: ['other_of_pair', 'group_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more'] }),
    },
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
    description: 'Interactive chemistry experiment station where students combine real substances and observe reactions — fizzing, color changes, temperature changes, gas production, precipitates. Features split Real View / Particle View, observation notebook, and multi-phase workflow (predict → experiment → observe → explain). K-2 uses kitchen chemistry, 3-5 adds classification and particle view, 6-8 adds equation balancing and conservation of mass. Perfect for teaching chemical vs physical change, signs of chemical reactions, and the scientific method. ESSENTIAL for K-8 chemistry and science.',
    constraints: 'Best for K-8. Use for chemistry lessons on chemical reactions, physical vs chemical change, states of matter changes, kitchen chemistry, acid-base reactions, oxidation, dissolution, and the scientific method. Grade-appropriate complexity adjusts automatically.',
    affordances: { representation: 'pictorial', answers: ['type'], role: ['visualize', 'apply'], minutes: 8 },
    tutoring: {
      taskDescription: 'Student is conducting the "{{experimentName}}" experiment ({{experimentCategory}}). Currently in {{currentPhase}} phase. Reaction type: {{reactionType}}. They have recorded {{observationsRecorded}}/{{observationPromptsTotal}} observations and identified {{signsIdentified}}/{{signsTotal}} signs of change. On challenge {{currentChallengeIndex}} of {{totalChallenges}} (type: {{challengeType}}). Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'experimentName', 'experimentCategory', 'reactionType', 'signs', 'currentPhase', 'isReacting', 'reactionComplete', 'predictionSubmitted', 'prediction', 'observationsRecorded', 'observationPromptsTotal', 'signsIdentified', 'signsTotal', 'particleViewActive', 'currentChallengeIndex', 'totalChallenges', 'challengeType', 'instruction', 'attemptNumber', 'equation'],
      scaffoldingLevels: {
        level1: '"What do you notice happening? Look carefully at the substances — is anything changing?"',
        level2: '"Think about the signs of a chemical change: fizzing, color change, temperature change, new smell, or a new substance forming. Which signs can you see in this {{experimentName}} experiment?"',
        // Never names the reaction type: it is the classify answer.
        level3: '"Let\'s look at this step by step. Did something new form, with different properties, or did the substance only change form? Look at the {{currentPhase === \'observe\' ? \'observation prompts\' : \'question\'}} and describe exactly what you see."',
      },
      commonStruggles: [
        { pattern: 'Student confuses chemical and physical change', response: 'Ask: "Is the substance still the same thing, just in a different form? Or has something completely NEW been created? If it\'s new, that\'s a chemical change!"' },
        { pattern: 'Student skips prediction phase or writes minimal prediction', response: 'Encourage: "Scientists always predict before experimenting! What do you THINK will happen? There\'s no wrong prediction — it\'s about thinking like a scientist."' },
        { pattern: 'Student cannot identify signs of chemical change', response: 'Guide: "Look for these clues: Did it fizz or bubble? Did the color change? Did it get hot or cold? Does it smell different? Any of these could be a sign of a chemical change!"' },
        { pattern: 'Student struggles with particle view', response: 'Simplify: "Think of the colored circles as tiny atoms. In a chemical change, the atoms rearrange — they break apart and join together in new ways to make new substances."' },
        { pattern: 'Student struggles to balance equation (grades 6-8)', response: 'Guide: "Count the atoms on each side. The number of each type of atom must be the same before and after — nothing is created or destroyed, just rearranged!"' },
      ],
    },
    evalModes: [
      { evalMode: 'predict', label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'Predict reaction outcomes before mixing' },
      { evalMode: 'observe', label: 'Observe (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['observe', 'identify_signs', 'classify'], description: 'Identify signs of chemical vs physical change' },
      { evalMode: 'explain', label: 'Explain (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['explain', 'balance', 'conservation'], description: 'Explain reactions using particle model and conservation of mass' },
    ],
    // W1 (ROLLOUT C26): `reactionLabWorkspace.ts` owns the items, checks and scene; `reactionLabLevers.ts` the levers.
    // The scripted path (`withWorkspaceController`) still sends the `tutoring` block above.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Every item is one challenge about the experiment on screen. A predict challenge is asked beside the '
        + 'unmixed substances, before the reaction runs: never say what will happen or what the substances do together. '
        + 'Every other challenge opens once the learner presses Mix Substances!; then the beaker, its badges and the '
        + 'temperature badge show what happened, and reading them is the skill. During an observe, signs or classify '
        + 'question never say what the beaker showed, which sign it shows, or whether the change is chemical or physical. '
        + 'On an explain question never give the reason or the particle story, and never say whether mass or atoms stay '
        + 'the same. Never use the experiment\'s real-world example as a clue. Ask the learner what they noticed or to '
        + 'watch again instead. The learner answers by saying it, or by tapping one choice and checking it; the activity '
        + 'checks the tap against the challenge\'s own key. For kindergarten to grade 2, read the question and every '
        + 'choice aloud. You cannot mix, tap, check or point at a choice for the learner.',
      levers: true,
      // The activity's own check (`reactionMiss`), a tap or a spoken choice, in every mode.
      misses: missLists<ReactionMiss>({
        predict: ['no_change', 'chemical_physical_swap', 'true_false_flipped', 'other_choice'],
        observe: ['chemical_physical_swap', 'no_change', 'true_false_flipped', 'other_choice'],
        explain: ['unbalanced_equation', 'chemical_physical_swap', 'true_false_flipped', 'no_change', 'other_choice'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'equation-balancer',
    description: 'Conservation of atoms in real chemical reactions, three tasks. Count: the equation is printed with its numbers in front, and the student says or taps how many atoms of one element are on one side (the number in front times the small number after the symbol, summed over the formulas). Balance: the student sets the number in front of each formula with + and − so every element has the same count on both sides, with the smallest whole numbers; first on equations where each element sits in one formula per side, then where an element is shared between two formulas (combustion, respiration). Every equation comes from a code bank of real reactions and every answer is solved by code. No live atom counter, tipping scale or match marks give the answer away; molecule drawings and an atom tally appear only as help. Perfect for teaching conservation of mass, reading formulas, and systematic balancing. ESSENTIAL for grade 6-8 chemistry.',
    constraints: 'Best for grade 6-8. The manifest must not supply equations, coefficients or answers: the generator picks bank reactions for the topic and code builds every item. Numbers in front go from 1 to 10.',
    affordances: { representation: 'symbolic', answers: ['manipulate'], role: 'apply', minutes: 5 },
    // Scripted fallback only (the tester, no tutor): `withWorkspaceController` keeps it until that path is retired.
    // Its context carries the item's ask and no key.
    tutoring: {
      taskDescription: 'The student is working on item {{itemIndex}} of {{totalItems}}: {{ask}}',
      contextKeys: ['mode', 'ask', 'itemIndex', 'totalItems', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Pick one element. How many of its atoms are on the left side, and how many on the right?"',
        level2: '"The number in front tells how many molecules there are; the small number tells how many atoms of that element are in one molecule. Multiply them."',
        level3: '"Go element by element: start with one that sits in only one formula on each side, make it match, then check the others again."',
      },
      commonStruggles: [
        { pattern: 'Student counts one molecule and leaves out the number in front', response: 'Ask what the big number in front means: how many copies of that molecule are there?' },
        { pattern: 'Student balances one element but unbalances another', response: 'Acknowledge the progress, then ask them to count every element again after each change.' },
        { pattern: 'Student finds a balanced set that is not the smallest', response: 'Ask whether every number can be divided by the same number.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every item from real reactions, and you are not told the key. Count: the equation is printed '
        + 'with its numbers in front; the learner says or taps how many atoms of one element are on one side. Balance: the learner '
        + 'sets the number in front of each formula with + and − and presses Check Balance; it is right only when every element has '
        + 'the same count on both sides with the smallest whole numbers. No atoms are drawn and no totals are shown unless a lever '
        + 'draws them. Never say a number to set, an atom total, or which formula to change, and never name the element that is '
        + 'off or the element to start with: ask the learner which element they will count first, then to count it on each '
        + 'side and say what they find. With the molecules or the atom tally on screen, never say which rows or sides match; '
        + 'ask the learner to compare them. You '
        + 'cannot set a number, tap or check for the learner.',
      // simple: molecule_view and simpler_equation; guided and complex: molecule_view, atom_tally and simpler_equation
      // (`equationBalancerLevers.ts`). Every miss of every mode is answered by a help lever.
      levers: true,
      // The activity's own check (`countMiss`, `balanceMiss`), and the same ids as a spoken count's known misses.
      misses: missLists<EquationBalancerMiss>({
        simple: ['ignored_coefficient', 'ignored_subscript', 'ignored_parentheses', 'one_compound_only', 'added_not_multiplied', 'miscounted'],
        guided: ['not_lowest', 'one_element_off', 'several_off'],
        complex: ['not_lowest', 'shared_element_off', 'one_element_off', 'several_off'],
      }),
    },
    evalModes: [
      { evalMode: 'simple', affordances: { answers: ['tap', 'spoken'] }, label: 'Count atoms (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['simple'], description: 'Count the atoms of one element on one side of an equation printed with its numbers in front' },
      { evalMode: 'guided', label: 'Balance (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['guided'], description: 'Balance an equation where each element sits in one formula on each side, using the smallest whole numbers' },
      { evalMode: 'complex', label: 'Balance, shared element (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['complex'], description: 'Balance an equation where an element is shared between two formulas on one side, such as a combustion' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'energy-of-reactions',
    description: 'Energy-of-reactions lab with three task identities, each built and keyed in code: thermometer evidence (run a named classroom reaction, such as baking soda and vinegar or magnesium and acid, in a beaker of water, read the thermometer, and decide whether it releases or absorbs energy), energy diagrams (read an unlabelled energy diagram on a kJ grid: the direction, the energy change, the activation energy, or how much a catalyst lowers it), and bond energies (from a table of the bonds broken and formed, with counts and energy per bond, choose the energy change). Answers are tapped or said aloud. Perfect for teaching exothermic and endothermic reactions, energy diagrams, activation energy, catalysts and bond energies. ESSENTIAL for grade 5-8 chemistry.',
    constraints: 'Best for grades 5-8. Use for chemistry lessons on energy in reactions: exothermic and endothermic, temperature change as evidence, energy diagrams, activation energy, catalysts, and bond energies (grades 7-8). The manifest must NOT supply reactions, energy values or answer keys: the reactions come from a code library, and every reading, diagram, bond table and key is built in code.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    // The scripted fallback (tester, no tutor) still sends this block through `useLuminaAI`; its context carries no key.
    tutoring: {
      taskDescription: 'Student is in an energy-of-reactions lab, item {{itemIndex}} of {{totalItems}} (mode: {{mode}}). The question on screen: {{ask}} Attempt {{attemptNumber}}. You are not told the answer: help the learner read the thermometer, the levels on the energy diagram, or the bond table, and never name the right choice.',
      contextKeys: ['gradeBand', 'mode', 'itemIndex', 'totalItems', 'ask', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What do you see on the screen? What did the thermometer read before, and what does it read now?"',
        level2: '"Where did the energy go: into the water around the reaction, or out of it? How can you tell?"',
        level3: '"Let us read it together: find the reactants\' line first. What do you measure from there?"',
      },
      commonStruggles: [
        { pattern: 'Student thinks a reaction that cools the water gives out cold', response: 'Ask what the thermometer is measuring: the water around the reaction. Did the water gain energy or lose it?' },
        { pattern: 'Student reads a level from zero instead of from the reactants', response: 'Ask where the reaction starts on the diagram, and what it climbs or drops from there.' },
        { pattern: 'Student confuses activation energy with the energy change', response: 'Ask which part of the drawing is the hill, and which part is the difference between start and end. Do not give either value.' },
        { pattern: 'Student struggles with bond energy arithmetic', response: 'Ask which bonds are broken and which are formed, how many of each, and which side costs energy. Do not do the subtraction.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every item, and you are not told the key; the learner taps a choice and presses Check '
        + 'Answer, or says the answer. Classify: a named reaction and a beaker of water with a thermometer; the learner presses Run '
        + 'the reaction and the reading changes; the question is whether the reaction releases or absorbs energy. Diagram: an energy '
        + 'diagram on a kJ grid with lines labelled Reactants and Products and a hill between them (a dashed catalyst path on some '
        + 'items); no arrows and no values are drawn until a lever writes them. Bond energy: the equation and a table of the bonds '
        + 'broken and formed, each with its count and energy per bond, and no totals. The scene gives you the readings, levels and '
        + 'rows as they are drawn. Never make a comparison the learner is asked to make: never say the reading went up or down, the water '
        + 'warmed or cooled, the products are higher or lower than the reactants, or one total is larger; ask the learner. '
        + 'Never say what a reading means (that the water got colder so the reaction took energy in, that '
        + 'lower products mean energy came out), whether the reaction releases or absorbs energy, which choice is right or how '
        + 'close a choice is, and never do any subtraction or sum for the learner (the climb, the drop, the change, the totals, '
        + 'energy in minus energy out); ask what the learner reads and what it tells them. With the heat-flow card on screen, never '
        + 'say which line of it matches this beaker; ask the learner to find it. Never say which side is energy in or energy out '
        + 'unless that card is on screen. With the bond totals or the rule on screen, never say which total is larger, which sign the '
        + 'answer has, or which number to take from which; ask the learner to use what the card says. After a wrong answer, never say '
        + 'that its number or its sign was right. Never call a reaction hot, cold, warming or cooling as a clue, and never mention what it '
        + 'is used for (a cold pack, a hand warmer). You cannot run the reaction, tap or check for the learner.',
      // classify publishes start_mark and heat_flow_card; diagram level_values, start_line and fewer_choices (not on a
      // direction item); bond_energy row_totals, in_out_totals and simpler_reaction (`energyOfReactionsLevers.ts`).
      levers: true,
      // The activity's own check (`energyMiss`) on a tap, and the same ids as each spoken item's known misses (`energySpokenMisses`).
      misses: missLists<EnergyMiss>({ classify: ['cooling_called_release', 'warming_called_absorb'],
        diagram: ['direction_reversed', 'sign_flipped', 'read_level', 'read_activation', 'read_peak_height', 'read_delta_h',
          'from_products', 'catalysed_ea', 'full_ea'],
        bond_energy: ['subtracted_backwards', 'ignored_counts', 'added_totals'] }),
    },
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
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap', 'type'], role: ['visualize', 'apply'], minutes: 6 },
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
    evalModes: [
      { evalMode: 'dissolve', affordances: { answers: ['manipulate'] }, label: 'Dissolve (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['dissolve_sort', 'particle_explain'], description: 'Test which substances dissolve and which do not' },
      { evalMode: 'classify', affordances: { answers: ['tap'] }, label: 'Classify (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['classify'], description: 'Classify as solution, suspension, or mixture' },
      { evalMode: 'separate', affordances: { answers: ['tap', 'type'] }, label: 'Separate (Hard)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['separate'], description: 'Choose correct separation technique and explain why' },
    ],
    teachingWorkspace: {
      grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
      guidance: 'Every item is one question about a beaker of water and a shelf of substances. The learner may add '
        + 'substances, stir and open the particle view to test them, then answers by saying it, or by tapping one choice '
        + 'and pressing Submit Answer; the activity checks the tap against the question\'s own key. You are told what is '
        + 'in the beaker, never what it looks like: whether a substance dissolved, sank or floats is what the learner '
        + 'looks for. Never say it, never say which choice is right, and never rule a choice out. Ask the learner to add '
        + 'the substance and tell you what they see, then ask what that means for the question. Never state the rule a '
        + 'question asks about (dissolved particles spread out, a suspension has bits you can see, filtering catches '
        + 'solids) during it. Never say a dissolved substance disappeared or is gone, not even when reading a model: it '
        + 'spread out and is still there. With method cards on screen, never point at a card by what it does ("the one '
        + 'that leaves dissolved things behind") or by the mixture it fits, and never name two cards to read: ask what the '
        + 'learner saw in the beaker, then let them read every card. You cannot add, stir, tap or check for the learner.',
      levers: true,
      // The activity's own check (`dissolvingMiss`), a tap or a spoken choice; dissolve also carries the particle question.
      misses: missLists<DissolvingMiss>({
        dissolve: ['chose_dissolves', 'chose_does_not_dissolve', 'chose_disappeared', 'chose_sank', 'other_choice'],
        classify: ['called_solution', 'called_suspension', 'called_layers'],
        separate: ['filter_for_dissolved', 'evaporate_for_undissolved', 'other_method', 'other_choice'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'atom-builder',
    description: 'Interactive atom construction tool where students drag protons, neutrons, and electrons to build atoms from scratch. Features Bohr model visualization with electron shells, mini periodic table with live element highlighting, identity card, charge and mass number display. Supports build, identify, fill-shells, make-ion, and make-isotope challenges. Grades 3-5 focus on element identity and shell filling. Grades 6-8 add ions, isotopes, and electron configuration. ESSENTIAL for chemistry lessons on atomic structure, subatomic particles, and the periodic table.',
    constraints: 'Best for grades 3-8. Use for chemistry lessons on atoms, subatomic particles, electron shells, element identity, ions, isotopes, periodic table connections, and electron configuration.',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['build', 'manipulate', 'type'], role: ['visualize', 'apply'], minutes: 6 },
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
    teachingWorkspace: {
      grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      // Every item publishes levers (`atomBuilderLevers.ts`).
      levers: true,
      guidance: 'The activity checks every build itself, and you are not told the key. The learner adds and removes '
        + 'protons, neutrons and electrons with the + and - buttons, then has the activity check the atom; on make_atom '
        + 'many atoms pass. The check reads only the three particle counts: an item that asks what element an atom is '
        + 'checks the build, not a named answer. The scene gives the learner\'s own counts and the name the identity card '
        + 'shows. Never tell the learner which particle to add or remove or how many, never state a count or a mass number '
        + 'the task does not state, and on make_atom never name an atom that has the asked property. When a lever is on '
        + 'screen, ask the learner what it shows them. You cannot add or remove particles for the learner.',
      // The activity's own checks: `classicMisses` (the target counts, in check order) and `judgeAtomBuild` (make_atom).
      // The generator does not pin the classic modes, so any classic session can hold any classic challenge type.
      misses: missLists<AtomMiss>({
        build: ['protons_off', 'neutrons_off', 'electrons_off'],
        identify: ['protons_off', 'neutrons_off', 'electrons_off'],
        ion_isotope: ['protons_off', 'neutrons_off', 'electrons_off'],
        make_atom: ['no_protons', 'nucleus_off', 'not_neutral', 'shell_not_full', 'valence_off', 'still_neutral',
          'charge_sign', 'charge_size', 'need_two', 'different_element', 'same_neutrons'],
      }),
      // need_two: its words say to press Keep, and the Keep button is on the board.
      unanswered: missLists<AtomMiss>({ make_atom: ['need_two'] }),
    },
    evalModes: [
      { evalMode: 'build', affordances: { answers: ['build'] }, label: 'Build (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['build'], description: 'Build a named element from protons, neutrons, electrons' },
      { evalMode: 'identify', affordances: { answers: ['type', 'manipulate'] }, label: 'Identify (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['identify', 'fill-shells'], description: 'Identify element from particle counts and fill electron shells' },
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
    teachingWorkspace: {
      grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      // make_molecule, build_target, free_build, identify and formula_write publish levers (`moleculeConstructorLevers.ts`).
      levers: true,
      guidance: 'The activity checks every answer itself, and you are not told the key: the learner adds atoms and joins '
        + 'them on the canvas, or types a name or a formula, then presses Check Answer. On make_molecule many molecules '
        + 'pass: the learner makes any one-piece molecule in which every atom uses all its bonds and which has the '
        + 'property asked, then presses "I\'m done!". The scene gives the learner\'s own atoms, bonds and open bonds as '
        + 'numbers: never say which atom is short of a bond, which bond to change, or what molecule to make, and never '
        + 'name a molecule the learner could build. Ask the learner to count the bonds each atom makes. You cannot add, '
        + 'join or type for the learner.',
      // The activity's own checks: `buildTargetMiss` and the typed keys (classic), `moleculeMiss` (make_molecule). The
      // generator does not pin the classic modes, so any classic session can hold any classic challenge type.
      misses: missLists<MoleculeMiss>({
        build: ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'no_bonds'],
        identify: ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'no_bonds'],
        predict: ['atoms_off', 'open_valence', 'name_off', 'formula_off', 'no_bonds'],
        make_molecule: ['not_connected', 'too_many_bonds', 'bond_order_short', 'open_valence', 'no_triple_bond',
          'no_double_bond', 'carbon_count_off', 'element_missing', 'too_many_atoms'],
      }),
      // The board refuses a bond past an atom's valence, so `too_many_bonds` cannot be built: no lever answers it.
      // build: `name_off` and `formula_off` come only from identify/formula_write items, which an unpinned build
      // session can hold. Those items now have levers (show_formula, formula_model, fewer_atoms), but the saved build
      // payload holds none, so the sweep cannot see them answered there.
      // predict: predict_bonds and shape_predict pass any build with one bond and check no prediction (EVAL_TRACKER
      // MC-2), so their `no_bonds` has no lever on those items. An identify session holds them too (the generator does
      // not pin classic modes), so identify lists `no_bonds` as well.
      unanswered: missLists<MoleculeMiss>({ make_molecule: ['too_many_bonds'], build: ['name_off', 'formula_off'],
        identify: ['no_bonds'], predict: ['no_bonds'] }),
    },
    evalModes: [
      { evalMode: 'build', affordances: { answers: ['build'] }, label: 'Build (Easy)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['build'], description: 'Build simple molecules from a name or formula' },
      { evalMode: 'make_molecule', affordances: { answers: ['build'] }, label: 'Make Your Own (Open)', beta: -0.4, scaffoldingMode: 2, challengeTypes: ['make_molecule'], description: 'Make any molecule with the asked property (a double bond, a number of carbon atoms, a given atom) on an empty board; every atom must use all its bonds' },
      { evalMode: 'identify', affordances: { answers: ['type'] }, label: 'Identify (Medium)', beta: 1.0, scaffoldingMode: 3, challengeTypes: ['identify', 'formula'], description: 'Identify molecules and write formulas from structure' },
      { evalMode: 'predict', affordances: { answers: ['type'] }, label: 'Predict (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['predict'], description: 'Predict properties and shape from molecular structure' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'ph-explorer',
    description: 'Interactive pH lab on a rainbow pH scale (0-14), with three task identities, each keyed in code from the substances\' pH values: litmus test (dip a blue and a red litmus paper into a named everyday or lab substance and say acid, base or neutral), indicator colours (read an unnamed sample\'s red cabbage juice colour and choose its pH range), and neutralize (choose how many cups of a strong base make 1 cup of a strong acid neutral, from their two pH values, where each pH step is ten times as strong; a universal-indicator beaker changes colour when they mix). Answers are tapped or said aloud. Perfect for teaching the pH scale, acids and bases, indicators, and neutralization. ESSENTIAL for grade 4-8 chemistry.',
    constraints: 'Best for grades 4-8. Use for chemistry lessons on pH, acids and bases, indicators, neutralization, acid-base reactions, and the pH scale. Grade-appropriate complexity adjusts automatically. The manifest must NOT supply answer keys: every key is computed from the generated substances\' pH values.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    // The scripted fallback (tester, no tutor) still sends this block through `useLuminaAI`; its context carries no key.
    tutoring: {
      taskDescription: 'Student is in a pH lab, item {{itemIndex}} of {{totalItems}} (mode: {{mode}}). The question on screen: {{ask}} Attempt {{attemptNumber}}. You are not told the answer: help the learner read the litmus papers, the cabbage juice colour or the two pH values, and never name the right choice.',
      contextKeys: ['gradeBand', 'mode', 'itemIndex', 'totalItems', 'ask', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What do you see on the screen? What colour is it now?"',
        level2: '"Think about what that colour tells you about the pH. Which part of the scale is it?"',
        level3: '"Let\'s look again together: what was the colour before, and what is it now? What does that change mean?"',
      },
      commonStruggles: [
        { pattern: 'Student confuses acids and bases', response: 'Ask what each paper did: which one changed colour, and from what to what. Do not say which result means which.' },
        { pattern: 'Student does not understand the pH scale direction', response: 'Point at the scale: 7 is the middle. Ask whether the liquid sits below or above it.' },
        { pattern: 'Student struggles with neutralization concept', response: 'Ask how far each liquid is from 7 on the scale, and remind them each step is ten times as strong.' },
        { pattern: 'Student cannot interpret indicator colours', response: 'Ask them to name the colour they see, then think where on the scale that colour sits. Do not name the range.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every item from the substances\' pH values, and you are not told the key; the learner '
        + 'taps a choice and presses Check Answer (Mix and check on neutralize), or says the answer. Test: a named substance '
        + 'beside a blue and a red litmus paper; the learner presses Dip the litmus papers, then says acid, base or neutral. '
        + 'Indicator: an unnamed sample in red cabbage juice; the learner names the pH range its colour shows; no scale is on '
        + 'screen, and no colour chart until its lever is pulled. Neutralize: 1 cup of a strong acid and a bottle of a strong base, each with its pH; the '
        + 'learner chooses how many cups of the base make the beaker neutral, and no pH meter reads a mix until its lever is pulled. The scene names the '
        + 'paper colours, the juice colour and the mixed colour as they are drawn: never say what a colour means (that red '
        + 'paper means an acid, that green juice means a base), which range or amount is right, or whether the two liquids are '
        + 'equally strong; ask what the learner sees and what it tells them. With the litmus key card or the colour chart on '
        + 'screen, never say which row or swatch matches the papers or the tube; ask the learner to find it. With the step '
        + 'counts on screen, never say the two liquids are the same number of steps from 7, equally far, or which is farther; '
        + 'ask the learner to compare the two counts. Never say the substance is sour, slippery, a '
        + 'cleaner or a food as a clue to its kind. A test substance\'s pH and its real-world line show only after credit. You '
        + 'cannot dip, tap, mix or check for the learner.',
      // test publishes litmus_key; indicator color_chart and fewer_choices; neutralize step_count, ph_meter and
      // fewer_choices (`phExplorerLevers.ts`). Every miss of every mode is answered by the mode's help lever.
      levers: true,
      // The activity's own check (`phMiss`) on a tap, and the same ids as each spoken item's known misses (`phSpokenMisses`).
      misses: missLists<PhExplorerMiss>({ test: ['acid_base_swapped', 'said_neutral', 'missed_neutral'],
        indicator: ['other_side', 'next_band', 'far_band'], neutralize: ['equal_amounts', 'too_little', 'too_much'] }),
    },
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
    // The scripted fallback (tester, no tutor) still sends this block through `useLuminaAI`; its context carries no key.
    tutoring: {
      taskDescription: 'Student is in a stoichiometry lab on the reaction {{equation}}, item {{itemIndex}} of {{totalItems}} (mode: {{mode}}). The question on screen: {{ask}} Attempt {{attemptNumber}}. You are not told the answer: help the learner use the molar masses, the coefficients and the units, and never name the right card, reactant or amount.',
      contextKeys: ['gradeBand', 'mode', 'equation', 'itemIndex', 'totalItems', 'ask', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What do you have, and what unit is it in? What unit does the question want?"',
        level2: '"Coefficients count moles, not grams. What would you need to turn these grams into moles?"',
        level3: '"Let\'s go one step at a time: grams to moles first, then what the equation says about moles. What is the first step here?"',
      },
      commonStruggles: [
        { pattern: 'Student multiplies grams by coefficients directly without converting to moles first', response: 'Ask what unit the coefficients count. Do not do the conversion for them.' },
        { pattern: 'Student picks the reactant with the smaller mass as the one that runs out first', response: 'Ask whether a gram of each holds the same number of particles. Do not say which runs out.' },
        { pattern: 'Student skips the mole ratio and goes straight from one substance to another', response: 'Ask what the equation says about how many moles of one go with how many of the other. Do not give the ratio.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      guidance: 'Code builds and checks every item from one balanced reaction, and you are not told the key. The molar masses '
        + 'are printed under the equation. Convert: a start card (grams of one substance), a goal card (moles or grams of a '
        + 'substance) and a tray of six conversion-factor cards, each a fraction; the learner taps cards into the chain in '
        + 'order and presses Check chain. Never say or ask which unit belongs on the top or the bottom of a card (that is the '
        + 'step the item checks), which card goes next, that a card should be flipped or swapped, how many cards the chain '
        + 'needs, or what the chain has reached; ask what unit the start card is in and what unit the goal needs, and, with '
        + 'the unit tracker on screen, what it says under each card. The start card is one amount, with no top or bottom. '
        + 'Limiting: two '
        + 'jars of reactants given by mass; the learner says or taps which runs out first, or that both run out together. '
        + 'Yield: the same two jars; the learner says or types the grams of a product that can form. The jars are drawn the '
        + 'same size, and no mole counts are on screen until their lever is pulled. Never name the reactant that runs out '
        + 'first, say that one is in excess or left over, give a number of moles, runs or grams the screen does not show, or '
        + 'say that the lighter '
        + 'reactant runs out first; ask the learner to turn each mass into moles and compare them using the coefficients. '
        + 'With the mole counts or the recipe card on screen, never compare the two jars for the learner (which has more, '
        + 'which lasts longer); ask the learner to compare. You cannot place cards, tap, type or check for the learner.',
      // convert publishes unit_track and mole_map; limiting and yield mole_counts and recipe_card; a medium or hard item
      // also easier_item (`stoichiometryLabLevers.ts`). Every miss of every mode is answered by a help lever.
      levers: true,
      // The activity's own check (`convertMiss`, `limitingMiss`, `yieldMiss`) on a tap or a typed number, and the same
      // ids as each spoken item's known misses (`stoichSpokenMisses`).
      misses: missLists<StoichiometryMiss>({
        convert: ['stopped_short', 'extra_step', 'upside_down_molar_mass', 'upside_down_ratio', 'skipped_ratio', 'out_of_order', 'other_substance', 'wrong_card'],
        limiting: ['fewer_moles', 'smaller_mass', 'missed_both', 'said_both', 'other_reactant'],
        yield: ['from_excess', 'skipped_ratio', 'upside_down_ratio', 'mass_sum', 'other_amount'],
      }),
    },
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
    tutoring: {
      taskDescription: 'Student is in a gas laws lab ({{mode}}), item {{itemIndex}} of {{totalItems}}: {{ask}} Choices: {{choices}}. Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'mode', 'itemIndex', 'totalItems', 'ask', 'choices', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the container. What does it keep the same while the change happens?"',
        level2: '"Think about the particles. What does this change do to how fast they move, how many there are, or how much room they have? What does that do to how often they hit the walls?"',
        level3: '"Write what stays constant for this container, then put the before values and the change into it. Which quantity is left to work out?"',
      },
      commonStruggles: [
        { pattern: 'Student confuses what holds constant when reading a gas law', response: 'Ask what the container does: a free piston slides until the push inside matches the weight, a steel tank cannot stretch, a water bath keeps the temperature.' },
        { pattern: 'Student predicts the wrong direction for pressure when compressing volume', response: 'Anchor in collisions: less room means the particles reach the walls more often. Ask what that does to the pressure, without saying it.' },
        { pattern: 'Student uses Celsius instead of Kelvin in gas-law calculations', response: 'Every gas-law ratio uses kelvin. Ask the learner to add 273 to each temperature before dividing.' },
        { pattern: 'Student says more moles = higher temperature', response: 'Temperature is how fast each particle moves. Adding particles adds hits on the walls but does not make any particle faster.' },
      ],
      aiDirectives: [
        {
          title: 'KMT NARRATION',
          instruction:
            'Ground every explanation in particle behavior: pressure is how hard and how often particles hit the walls, temperature is how fast they move, volume is the room they have. '
            + 'Never state which choice is right or which way the asked quantity moves.',
        },
      ],
    },
    teachingWorkspace: {
      grades: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      guidance: 'Code builds and checks every item, and you are not told the key; the learner taps a choice and presses Check '
        + 'Answer, or says the answer. The screen shows the container with its gas BEFORE the change and a before/after '
        + 'table with "?" for the asked quantity; the change runs on screen only after the answer is credited, so nothing on '
        + 'screen shows the result first. Observe: say whether the asked quantity goes up, goes down or stays the same. On '
        + 'some items the ask does not say what is held; the learner works it out from the container, and that is the task: '
        + 'never say which quantity the container holds, or ask a yes-or-no question that settles it ("can the steel '
        + 'stretch?", "does the space inside change?", "can the piston move?", "does the bath keep the temperature?"); '
        + 'ask what the container keeps the same and let the learner name it. Predict: one change; choose the new '
        + 'value. Calculate: two changes at once; choose the new value. Temperatures may be in degrees Celsius; the ratios '
        + 'need kelvin. Never say which way the asked quantity moves, which value is right, that it "doubles", "halves" or '
        + '"stays the same", or which factor to multiply or divide by; ask what the container keeps the same, what the '
        + 'change does to the particles, and how big the change is. After a miss, never say what the wrong value came from '
        + 'or which change the learner left out or turned round ("you only used the pressure", "remember the '
        + 'cooling"); ask how each change on the table affects the asked quantity. With a lever card on screen, describe it only by what '
        + 'the scene says it shows, never read it back as the conclusion (never "so the pressure goes up"), and ask the '
        + 'learner what it tells them. No gauge or meter reading is drawn: after the run, the new value is in the table. '
        + 'You cannot tap, check or run the change for the learner.',
      // observe publishes particle_card (and held_label where the ask does not name what is held); predict and
      // calculate relation_card, factor_line, kelvin_scale on Celsius items, and simpler_numbers / one_change
      // (`gasLawsLevers.ts`). Every miss of every mode is answered by a help lever first.
      levers: true,
      // The activity's own check (`gasMiss`) on a tap, and the same ids as each spoken item's known misses (`gasSpokenMisses`).
      misses: missLists<GasLawsMiss>({ observe: ['opposite_direction', 'said_unchanged', 'missed_unchanged'],
        predict: ['inverse_factor', 'kept_value', 'celsius_ratio'],
        calculate: ['first_change_only', 'second_change_only', 'ratio_inverted', 'celsius_ratio'] }),
    },
    evalModes: [
      { evalMode: 'observe', affordances: { answers: ['tap', 'spoken'] }, label: 'KMT Observe (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['observe'], description: 'Predict whether a quantity goes up, goes down or stays the same when a container of gas is heated, squeezed or given more gas (particle model; some items leave what is held to infer from the container)' },
      { evalMode: 'predict', affordances: { answers: ['tap', 'spoken'] }, label: 'Directional Predict (Medium)', beta: 0.5, scaffoldingMode: 3, challengeTypes: ['predict'], description: 'One change to a container of gas: choose the new pressure or volume by proportion (Boyle, Charles, Gay-Lussac; hard items give temperatures in degrees Celsius)' },
      { evalMode: 'calculate', affordances: { answers: ['tap', 'spoken'] }, label: 'Gas Law Calculate (Hard)', beta: 2.5, scaffoldingMode: 5, challengeTypes: ['calculate'], description: 'Two changes at once to a cylinder of gas: choose the new pressure, volume or temperature with the combined gas law' },
    ],
    supportsEvaluation: true,
  },
];
