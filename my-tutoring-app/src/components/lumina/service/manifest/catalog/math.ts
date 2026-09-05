/**
 * Math Catalog - Component definitions for mathematics primitives
 *
 * Contains 25 math visualization components for teaching mathematical concepts
 * from elementary through advanced algebra.
 */

import { ComponentDefinition } from '../../../types';

export const MATH_CATALOG: ComponentDefinition[] = [
  {
    id: 'bar-model',
    description: 'K-5 categorical-data graph: simple comparison bars (K-1), scaled bar graphs with step-2/5/10 axes (3.MD.B.3), and picture graphs where 1 icon = N items (2.MD.D.10). Single home for all bar/picture-graph instruction; not for histograms or numeric distributions.',
    constraints: 'Multi-instance: a session walks the student through 3-6 challenges of the same eval mode, each with its own graph. The manifest MUST NOT supply specific bar values, scales, or datasets — the generator builds every challenge from the eval mode + topic. build_graph requires expectedDataset and expectedScaleStep — student picks the scale themselves.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Work through {{totalChallenges}} {{graphStyle}} graph challenges. Mode: {{evalMode}}. Currently on challenge {{currentChallengeIndex}}. Values: {{values}}.',
      contextKeys: ['values', 'value1', 'value2', 'barCount', 'title', 'graphStyle', 'evalMode', 'scaleStep', 'iconEmoji', 'iconValue', 'currentPrompt', 'attemptNumber', 'currentChallengeIndex', 'totalChallenges'],
      scaffoldingLevels: {
        level1: '"Which bar is taller? What does that tell us?"',
        level2: '"Look at the difference between the bars. How much more is the larger one?"',
        level3: '"The first bar shows {{value1}} and the second shows {{value2}}. Subtract to find the difference."',
      },
      commonStruggles: [
        { pattern: 'Ignoring scale', response: '"Look at the numbers on the axis, not just the bar height. Each tick mark is {{scaleStep}}."' },
        { pattern: 'Confusing more/less', response: '"Taller bar = bigger number. Which bar is taller?"' },
        { pattern: 'Reading picture graph as 1:1', response: '"Each icon stands for {{iconValue}}, not 1. Count the icons, then multiply."' },
        { pattern: 'Pre-picking scale in build_graph', response: '"Look at your largest value. Which step lets the bars fit without leaving lots of empty space?"' },
      ],
      aiDirectives: [
        {
          title: 'COMPARISON & SCALE LANGUAGE COACHING',
          instruction:
            'Model precise comparison language: "more than," "less than," "the difference is." '
            + 'For K-1 (compare_bars): use concrete language — "This bar is taller, so there are MORE." '
            + 'For grades 2-3 (read_scale, picture_graph): tie bar height/icon count to the axis — '
            + '"Each tick is {{scaleStep}}, so this bar reaches {{value}}." For picture graphs, '
            + 'always say "{{iconValue}} per icon" before reading. For grades 3-5 (scaled_bar_graph, '
            + 'graph_word_problem, build_graph): guide toward arithmetic — "How many more? Subtract." '
            + 'Never just say "bigger" — always tie bar size to the actual quantity it represents.',
        },
        {
          title: 'BUILD_GRAPH SCALE-CHOICE COACHING',
          instruction:
            'When the student is constructing a graph, the scale choice IS the learning goal '
            + '(3.MD.B.3). Never tell them what step to use. Instead, ask: "Look at your biggest value. '
            + 'If you used a step of 1, how many tick marks would you need? If you used a step of 10, '
            + 'how many?" Let them discover that bigger data needs bigger steps.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'compare_bars',
        label: 'Compare Bars (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare_bars'],
        description: 'Identify which of two bars is taller. K.MD.A.2.',
      },
      {
        evalMode: 'read_scale',
        label: 'Read Scale (2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['read_scale'],
        description: 'Read the value of a named bar from a scaled axis. 2.MD.D.10.',
      },
      {
        evalMode: 'picture_graph',
        label: 'Picture Graph (2-3)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['picture_graph'],
        description: 'Read an icon-based graph where each icon represents N items. 2.MD.D.10, 3.MD.B.3.',
      },
      {
        evalMode: 'scaled_bar_graph',
        label: 'Scaled Bar Graph (3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['scaled_bar_graph'],
        description: 'Read a bar graph with step 2, 5, or 10 — including values mid-bar. 3.MD.B.3.',
      },
      {
        evalMode: 'graph_word_problem',
        label: 'Graph Word Problem (2-3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['graph_word_problem'],
        description: '"How many more X than Y?" or total questions answered from a scaled graph.',
      },
      {
        evalMode: 'build_graph',
        affordances: { answers: ['tap', 'type'] },
        label: 'Build Graph (3-5)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['build_graph'],
        description: 'Construct a graph from a given dataset; student selects their own scale. 3.MD.B.3.',
      },
    ],
  },
  {
    id: 'number-line',
    description: 'Interactive number line with drag-to-plot, animated jump arcs, ordering, and auto-zoom. Supports integers, fractions, decimals, and mixed numbers. K uses small fully labeled ranges; explicit Grade-1 objectives can use readable local windows within 0-120; grades 3-5 add negatives, fractions, and operations. Perfect for teaching number placement, addition/subtraction as movement, fraction comparison, and ordering. ESSENTIAL for K-5 math.',
    constraints: 'Requires numeric range. Jump mode requires operations array. Challenges drive interactivity.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Work with a number line from {{rangeMin}} to {{rangeMax}} using {{numberType}} numbers in {{interactionMode}} mode.',
      contextKeys: ['rangeMin', 'rangeMax', 'visibleMin', 'visibleMax', 'numberType', 'interactionMode', 'gradeBand', 'instruction', 'challengeType', 'targetValues', 'exactTargetValue', 'placedPoints', 'attemptNumber', 'currentPhase'],
      scaffoldingLevels: {
        level1: '"Look carefully at the number line. Where do you think that value belongs?"',
        level2: '"Find the labeled number just to the left of your target. Count the nearby tick marks one step at a time."',
        level3: '"Use the labels in the visible window. Start at the closest labeled number on screen and count one tick at a time toward the target."',
      },
      commonStruggles: [
        { pattern: 'Placing point far from target value', response: '"Look at the numbers under the tick marks. Find the two numbers your target is between, then place your point between them."' },
        { pattern: 'Confusing addition direction with subtraction', response: '"Remember: adding moves RIGHT on the number line (numbers get bigger), subtracting moves LEFT (numbers get smaller)."' },
        { pattern: 'Ordering fractions incorrectly', response: '"Try zooming in to see the fraction marks. Compare each fraction to 1/2 first — is it more or less than half?"' },
        { pattern: 'Difficulty reading a large range', response: '"Use the labels in the zoomed window on screen. Start from the closest visible label instead of counting from the beginning of the whole range."' },
      ],
      aiDirectives: [
        {
          title: 'INTERACTION MODE COACHING',
          instruction:
            'Adapt your coaching to the interaction mode. '
            + 'In PLOT mode: guide placement — "Find the spot between the tick marks." '
            + 'In JUMP mode: narrate movement — "You jumped 3 to the right, that is adding 3!" '
            + 'In ORDER mode: guide comparison — "Which number is further left? That one is smaller." '
            + 'Always reference the number line visually — point to specific tick marks and positions.',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For K-2: use counting language — "Let\'s count the hops: 1, 2, 3..." Keep to whole numbers. Kindergarten stays on small fully labeled ranges; when an explicit Grade-1 objective extends through 120, coach only the readable auto-zoomed window and never redirect the child back to 0-20. '
            + 'For grades 3-5: introduce fraction/decimal language — "Is 3/4 closer to 1/2 or to 1?" '
            + 'Use benchmark fractions (1/4, 1/2, 3/4) as reference points. '
            + 'For negative numbers: "Numbers left of zero are negative — they are less than zero."',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (K)',
        beta: 0.5,
        scaffoldingMode: 1,
        challengeTypes: ['plot_point'],
        description: 'Identify and place numbers on a fully labeled 0–10 number line.',
      },
      {
        evalMode: 'plot',
        label: 'Plot (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['plot_point'],
        description: 'Place value on number line with full guidance.',
      },
      {
        evalMode: 'jump',
        label: 'Jump (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['show_jump'],
        description: 'Show operation as movement on number line.',
      },
      {
        evalMode: 'order',
        affordances: { answers: ['tap', 'manipulate'] },
        label: 'Order (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order_values'],
        description: 'Sequence multiple values on number line.',
      },
      {
        evalMode: 'between',
        affordances: { reader: 'emerging' },
        label: 'Between (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_between'],
        description: 'Estimate and find values between marks.',
      },
    ],
  },
  {
    id: 'base-ten-blocks',
    description: 'Interactive base-ten manipulative with place value columns, supply tray, and regrouping. Students drag blocks to build numbers, decompose values, regroup (trade 10 ones for 1 ten), and perform addition/subtraction with blocks. Supports decimal mode (tenths/hundredths) and thousands. Challenge modes: build_number, read_blocks, regroup, add_with_blocks, subtract_with_blocks. ESSENTIAL for K-5 place value.',
    constraints: 'Requires a number to work with. Challenges array drives interactivity. Grade band determines complexity.',
    affordances: { representation: 'concrete', answers: ['build', 'manipulate', 'type'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Explore place value using base-ten blocks. Mode: {{interactionMode}}. Target: {{targetNumber}}. Current total: {{currentTotal}}.',
      contextKeys: ['numberValue', 'interactionMode', 'decimalMode', 'gradeBand', 'currentTotal', 'columns', 'targetNumber', 'challengeType', 'instruction', 'attemptNumber', 'regroupsUsed'],
      scaffoldingLevels: {
        level1: '"Look at the columns. How many hundreds, tens, and ones do you see?"',
        level2: '"You have {{columns.hundreds}} hundreds, {{columns.tens}} tens, and {{columns.ones}} ones. What number is that?"',
        level3: '"Each hundred block = 100, each ten stick = 10, each one cube = 1. So {{columns.hundreds}} × 100 + {{columns.tens}} × 10 + {{columns.ones}} × 1 = {{currentTotal}}."',
      },
      commonStruggles: [
        { pattern: 'Adding too many blocks in wrong column', response: '"Check which column you are adding to. Hundreds are the biggest, ones are the smallest."' },
        { pattern: 'Not regrouping when column has 10+', response: '"You have 10 or more in one column! You can trade 10 of those for 1 in the next column."' },
        { pattern: 'Confusing decimal places', response: '"Tenths are 0.1 — ten of them make 1 whole. Hundredths are 0.01 — ten of them make one tenth."' },
      ],
      aiDirectives: [
        {
          title: 'REGROUPING DISCOVERY',
          instruction:
            'The key "aha" moment is when a student realizes that 10 of one unit equals 1 of the next. '
            + 'When a column reaches 10+, guide the discovery: "Can 12 ones fit in the ones column? '
            + 'What if we traded 10 ones for 1 ten?" Celebrate each successful trade. '
            + 'Connect blocks to written numbers: "See how the blocks match the digits in the number?"',
        },
        {
          title: 'CHALLENGE TYPE COACHING',
          instruction:
            'For BUILD_NUMBER: guide adding blocks to match the target — "What digit is in the tens place? Add that many ten sticks." '
            + 'For READ_BLOCKS: guide reading the blocks as a number — "Count each column and combine." '
            + 'For REGROUP: focus entirely on the trading mechanic — "Trade 10 ones for 1 ten!" '
            + 'For ADD/SUBTRACT_WITH_BLOCKS: narrate the operation step by step, starting with the ones column.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'build_number',
        affordances: { answers: ['build'] },
        label: 'Build Number (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_number'],
        description: 'Concrete manipulative: student builds a target number by placing blocks in place value columns.',
      },
      {
        evalMode: 'read_blocks',
        affordances: { representation: 'pictorial', answers: ['type'] },
        label: 'Read Blocks (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['read_blocks'],
        description: 'Pictorial recognition: student identifies the number represented by pre-placed blocks.',
      },
      {
        evalMode: 'regroup',
        affordances: { answers: ['manipulate'] },
        label: 'Regroup (Strategy)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['regroup'],
        description: 'Strategy: student regroups blocks by trading 10 of one unit for 1 of the next.',
      },
      {
        evalMode: 'operate',
        affordances: { answers: ['manipulate', 'type'] },
        label: 'Operate (Transitional)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['add_with_blocks', 'subtract_with_blocks'],
        description: 'Operations: student adds or subtracts using blocks with regrouping/borrowing.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'fraction-circles',
    description: 'Multi-phase fraction learning with circle diagrams. Challenges include identifying fractions from shaded circles, building target fractions by clicking slices, comparing two fractions visually, and discovering equivalent fractions. ESSENTIAL for elementary fraction concepts.',
    constraints: 'Generates 4-6 challenges mixing identify, build, compare, and equivalent types. Denominators 2-12.',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['type', 'tap', 'build'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Complete fraction challenges using circle diagrams. Current challenge: {{instruction}} (type: {{challengeType}}). Circle has {{denominator}} slices.',
      contextKeys: ['challengeType', 'instruction', 'denominator', 'numerator', 'shadedCount', 'attemptNumber', 'currentChallengeIndex', 'totalChallenges'],
      scaffoldingLevels: {
        level1: '"How many total pieces is this circle divided into? Count the lines."',
        level2: '"The circle has {{denominator}} slices. Count the shaded ones — that is your numerator. The total slices is the denominator."',
        level3: '"The numerator (top number) = shaded pieces. The denominator (bottom number) = total pieces = {{denominator}}. So the fraction is shaded/{{denominator}}."',
      },
      commonStruggles: [
        { pattern: 'Counting unshaded instead of shaded slices', response: '"Count only the colored pieces for the numerator — the blue/purple sections."' },
        { pattern: 'Confusing numerator and denominator', response: '"Remember: denominator = total slices (the whole pie), numerator = slices you colored (the part)."' },
        { pattern: 'Not recognizing equivalent fractions', response: '"Both circles have the same amount shaded even though the numbers look different. They are equivalent fractions!"' },
        { pattern: 'Difficulty comparing fractions with different denominators', response: '"Look at how much of each circle is filled with color. Which circle has more color showing?"' },
      ],
      aiDirectives: [
        {
          title: 'FRACTION CIRCLE COACHING',
          instruction:
            'Always tie the fraction to the visual circle. For identify challenges: "Count the colored slices — that is your top number." '
            + 'For build challenges: "Click slices until you have exactly {{numerator}} colored." '
            + 'For compare: "Look at how much of each circle is filled. Which has more color?" '
            + 'For equivalent: "Can you make the same amount of color using {{equivalentDenominator}} slices instead?" '
            + 'Use food analogies for younger students: "Imagine this is a pizza cut into {{denominator}} slices."',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { representation: 'pictorial', answers: ['type'] },
        label: 'Identify (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name the fraction shown on the circle.',
      },
      {
        evalMode: 'build',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Build (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build'],
        description: 'Construct a given fraction by shading slices.',
      },
      {
        evalMode: 'compare',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Compare (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Compare two fractions visually.',
      },
      {
        evalMode: 'equivalent',
        affordances: { representation: 'pictorial', answers: ['build'] },
        label: 'Equivalent (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['equivalent'],
        description: 'Find equivalent fractions with different denominators.',
      },
    ],
  },
  {
    id: 'fraction-bar',
    description: 'Multi-challenge interactive fraction bar. Each session walks the student through 3-6 distinct fractions in the same eval mode. Every fraction runs through three within-challenge phases: (1) identify the numerator via multiple choice, (2) identify the denominator via multiple choice, (3) build the fraction by shading parts on a bar. Progressive scaffolding from vocabulary to hands-on construction. ESSENTIAL for elementary fraction introduction.',
    constraints: 'Session-level configuration. The generator picks fractions locally per eval mode, so do NOT supply specific numerators, denominators, or MC choices from the manifest — they are generated per challenge. Supports challengeTypes: identify (2-3, unit fractions), build (3-4, non-unit proper fractions), compare (4-5, larger denominators), add_subtract (5-6, operation context).',
    affordances: { representation: 'pictorial', answers: ['tap', 'build'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Walk through {{totalChallenges}} fraction problems in {{challengeType}} mode. Current: fraction {{currentChallengeIndex}} of {{totalChallenges}} = {{numerator}}/{{denominator}}. Phase: {{currentPhase}}.',
      contextKeys: ['numerator', 'denominator', 'currentPhase', 'shadedCount', 'currentChallengeIndex', 'totalChallenges', 'challengeType'],
      scaffoldingLevels: {
        level1: '"Look at the fraction. The top number and bottom number each have a special name."',
        level2: '"The numerator is the top number — it tells how many parts are shaded. The denominator is the bottom number — it tells how many equal parts there are."',
        level3: '"In {{numerator}}/{{denominator}}, the numerator is {{numerator}} (top) and the denominator is {{denominator}} (bottom). Now shade exactly {{numerator}} parts on the bar."',
      },
      commonStruggles: [
        { pattern: 'Confusing numerator and denominator', response: '"Remember: the Denominator is Down (bottom). The Numerator is the Number on top."' },
        { pattern: 'Shading wrong number of parts in build phase', response: '"Count the shaded parts carefully. You need exactly {{numerator}} parts shaded out of {{denominator}}."' },
        { pattern: 'Selecting the denominator when asked for numerator', response: '"The numerator is the TOP number. Look at which number sits above the fraction line."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE FRACTION COACHING',
          instruction:
            'In Phase 1 (Identify Numerator): focus on vocabulary — "The numerator is the top number. It tells us how many parts." '
            + 'In Phase 2 (Identify Denominator): reinforce vocabulary — "The denominator is the bottom number. It tells us how many equal parts the whole is divided into." '
            + 'In Phase 3 (Build): connect vocabulary to action — "You said the numerator is {{numerator}}, so shade {{numerator}} parts. '
            + 'The denominator is {{denominator}}, so the bar has {{denominator}} equal parts." '
            + 'Use the mnemonic: "Denominator is Down, Numerator is the Number of parts."',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify Fraction (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'CCSS 3.NF.A.1 unit fractions (1/2, 1/3, 1/4, 1/6, 1/8).',
      },
      {
        evalMode: 'build',
        label: 'Build Fraction (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build'],
        description: 'Non-unit proper fractions (2/3, 3/4, 2/5).',
      },
      {
        evalMode: 'compare',
        label: 'Compare Fractions (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Fractions with larger denominators, harder distractors.',
      },
      {
        evalMode: 'add_subtract',
        label: 'Fraction Operations (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['add_subtract'],
        description: 'Fractions in addition/subtraction context.',
      },
    ],
  },
  {
    id: 'place-value-chart',
    description: 'Live tutor-judged place value (DI modality) over 2- to 5-digit whole numbers. The Live tutor asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. Each session alternates two kinds of number: for a PRINTED number with one glowing digit the child SAYS THE NAME OF ITS PLACE (ones through ten thousands) and then SAYS WHAT IT IS WORTH ("forty", "three hundred" — the spoken place-value vocabulary this primitive has always been about); for a number that is NEVER printed the tutor SAYS it and the child WRITES it into the labeled chart, one digit per column — dictation, where hearing "four hundred six" and writing 4-0-6 rather than 46 is the whole skill. ESSENTIAL for elementary place value instruction, grades 1-5.',
    constraints: 'Requires a microphone: two of the three answer kinds are spoken and judged by the Live tutor, and there is no Check button, no Next button, and no multiple-choice row anywhere. Session-level configuration: the generator selects target numbers locally from the number pool service per the selected eval mode, so do NOT supply specific numbers, place ranges, or answer choices from the manifest. Whole numbers only, 11 to 99,999 — every spoken value word stays inside the place-value vocabulary (digit and decade words plus hundred/thousand), and a highlighted digit is never zero because "zero" is not an accepted spoken answer. A number that was printed for analysis is never dictated, and a dictated number is never printed — each would answer the other. Supports challengeTypes: identify (1-2), build (2-3), compare (3-4), expanded_form (5+).',
    affordances: { representation: 'symbolic', answers: ['spoken', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED place value practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or by WRITING digits into the chart, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ 18d, applied at BIRTH: no level of this ladder may OFFER a quoted
      // replacement line of its own. A quoted hint here is a sanctioned-sounding
      // substitute for the scripted correction at exactly the moment the model
      // wants one — it opens with neither sentinel, so the engine sees no
      // verdict and the correction counter stalls. The ladder commands script
      // fidelity; it never supplies an alternative. The click-era ladder here
      // quoted three hint lines and its level3 printed the full construction.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never name a place, a value, or a digit beyond what the ask names.',
        level2: 'A wrong answer is never met with a hint of your own — speak the scripted "My turn:" correction from the cue again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction walks the places (or the columns) and re-asks for you. Never invent encouragement, a new question, a softer hint, or a walk of your own.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child looking and thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Says the digit\'s value, or the digit itself, when asked for its PLACE', response: 'That answers what the digit is worth, not where it sits, so it is wrong: speak the scripted "My turn:" correction, which walks the places from the end and re-asks.' },
        { pattern: 'Says the bare digit when asked what it is WORTH (four for forty)', response: 'That says how many ones, not what the digit is worth in its place, so it is WRONG however close it sounds: speak the scripted correction, which is where digit and worth get told apart.' },
        { pattern: 'Says the right digit at the wrong place (four hundred for forty)', response: 'Wrong place, wrong worth: speak the scripted "My turn:" correction exactly as written.' },
        { pattern: 'Reads the whole number off the screen instead of answering', response: 'That does not answer the question — only the glowing digit\'s place or worth does. It is wrong: speak the scripted correction.' },
        { pattern: 'Writes the digits in the wrong columns, or leaves a column empty', response: 'The chart is judged in code and you are told whether it matches — speak only the verdict line the cue gives you. The correction models the column walk on a different number and dictates the target again; never walk the target\'s own columns beyond it.' },
        { pattern: 'The same wrong answer comes twice in a row', response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it — '
            + 'and never read the number on the screen out loud before the ask.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants — this activity asks for three different kinds and you must never assume which. '
            + 'On find_place the answer is a PLACE NAME — ones, tens, hundreds, thousands, ten thousands. The digit or its value said instead is the recorded confusion and is wrong. '
            + 'On say_value the answer is the digit\'s WORTH said with place vocabulary — "forty", "three hundred". The bare digit is wrong however close it sounds: it says how many, not what it is worth. '
            + 'Where ten thousands is on the chart, a bare "thousands" for the ten-thousands column is the wrong column and is corrected. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'On a WRITING item (build_number) the child writes the number you dictated into the chart, and you are told what they wrote and whether it matches. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'An affirmation is the WHOLE turn. After it, stop speaking — never carry on into another question, another digit, or the next item, '
            + 'even one you can see on the screen. The next ask always arrives as its own cue, and a question you ask early is about the wrong number.',
        },
        {
          title: 'NEVER READ THE SCREEN OR THE STATE ALOUD',
          instruction:
            'Never read the number on the screen out loud during the child\'s turn — on an analysis item it contains the value they are about to say, and reading it hands the answer over. '
            + 'Never read the [CURRENT STATE] block, its heading, or any of its lines aloud: it is context for you, never content for the child. '
            + 'Never name the columns beyond what the quoted ask names.',
        },
        {
          title: 'WRITING ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers by writing, say nothing at all while they work — no repeating the number, no digit names, no column names, no narration. '
            + 'The dictation is said once in the ask; if the child wants it again they tap to hear it. '
            + 'You will be told what number they wrote and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never count the columns for them, and never prompt while the child is looking at the number. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again. That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer. On a writing item that means dictating the whole number again, because it is never printed.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify Place (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        // β RAISED 1.5 → 2.0 (story-talk's lever): two 1-of-4 MENUS with
        // unlimited Check retries became unaided spoken production — the place
        // name and the value word both leave the child's mouth with no options
        // row to lean on — and the build target no longer prints, so writing a
        // 2-digit number is done from DICTATION (thirteen/thirty is now a real
        // item, which a printed target could never ask).
        description: '2-digit numbers. The child SAYS the glowing digit\'s place and what it is worth ("forty"), and WRITES numbers the tutor says — including the teen/-ty ear (thirteen vs thirty). Spoken production judged by the Live tutor; no choices anywhere.',
      },
      {
        evalMode: 'build',
        label: 'Write Number (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['build'],
        // β RAISED 2.5 → 3.0 — a real STRUCTURAL change, not a channel swap.
        // The click era printed the target above the chart, so building was
        // copying digits left-to-right; the number is DICTATED now and the
        // child translates speech into columns, where "four hundred six" → 406
        // (not 46) is the mode's whole demand. The spoken analysis asks ride
        // the same raise as identify.
        description: '3-digit numbers, dictation-first: the tutor SAYS a number that is never printed and the child WRITES it into the labeled chart — the zero-trap (four hundred six is 4-0-6, not 46) is the target skill. Printed numbers get the two spoken analysis asks.',
      },
      {
        evalMode: 'compare',
        label: 'Compare Places (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        // β RAISED 3.5 → 4.0 — the same two structural changes (menus deleted →
        // unaided production; printed target → dictation) at 4-digit magnitude,
        // where the value words are two-token ("four thousand") and the
        // interior places are the confusable ones.
        description: '4-digit numbers with multiple non-zero digits. Spoken place names through thousands, spoken values like "four thousand", and 4-digit dictation writing. Unaided production judged by the Live tutor.',
      },
      {
        evalMode: 'expanded_form',
        label: 'Expanded Form (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['expanded_form'],
        // β RAISED 4.5 → 5.0 — same structural raise at 4-5 digit magnitude.
        // Decimals are DROPPED from this mode's judged form: decimal place
        // words have no benched spoken class, and the whole-number band
        // already carries the ten-thousands/thousands ear discrimination this
        // tier is for.
        description: '4- to 5-digit whole numbers. The ten-thousands column arrives: the spoken answer must carry the "ten" ("ninety thousand"; bare "thousands" for that column is the recorded miss), and dictation writing runs to five columns. No decimals — decimal place words are not a benched spoken class.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'practice-problem',
    description: 'Standalone canvas-based math derivation surface. Student writes their multi-step solution by hand on a whiteboard; live transcription + step-aware coaching keep them oriented as they solve; pressing Done dispatches a judge that compares their derivation to the canonical solution and reveals a verdict (correct / partial / incorrect) with side-by-side analysis. Perfect for algebra, pre-calculus, and calculus problems where showing work matters more than the final answer. ESSENTIAL for grades 6-12 procedural fluency, multi-step problem solving, and strategy selection.',
    constraints: 'Requires a problem with a canonical multi-step solution (2+ steps). Best for derivation-style math problems (solve equations, simplify expressions, evaluate integrals, prove identities). Not suitable for one-shot computation, multiple choice, or visual-spatial problems where the answer is non-symbolic.',
    affordances: { representation: 'symbolic', answers: ['manipulate'], role: 'apply', minutes: 10 },
    evalModes: [
      { evalMode: 'derive_easy', label: 'Derive — Easy (Tier 1)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['derive'], description: 'Short 2-3 step derivation. Single rule application, simple algebra or arithmetic. Aimed at warm-up / fluency.' },
      { evalMode: 'derive_medium', label: 'Derive — Medium (Tier 2)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['derive'], description: '3-5 step derivation requiring multiple rule applications. Standard practice difficulty.' },
      { evalMode: 'derive_hard', label: 'Derive — Hard (Tier 3)', beta: 0.7, scaffoldingMode: 4, challengeTypes: ['derive'], description: '4-6 step derivation requiring strategy choice (substitution, case split, identity selection). Stretch problems.' },
    ],
    tutoring: {
      taskDescription: 'Student is solving a {{difficulty}}-band math derivation by hand on a whiteboard: "{{problem}}". They are currently in the {{currentPhase}} phase with {{strokeCount}} strokes drawn so far. The canonical solution has {{stepCount}} steps. On-screen support tier: {{supportTier}} (easy = worked-step skeleton + first-step prompt visible; hard = bare problem, scaffolds withdrawn).',
      contextKeys: ['title', 'problem', 'equations', 'difficulty', 'stepCount', 'currentPhase', 'strokeCount', 'supportTier'],
      scaffoldingLevels: {
        level1: '"Take a moment to look at the problem. What do you see, and what do you think the first move should be?"',
        level2: '"Try writing the first transformation on the canvas. What rule applies to the left-hand side of {{equations}}? Don\'t worry about getting all {{stepCount}} steps at once."',
        level3: '"Start by isolating one term. For "{{problem}}", the first canonical step is usually a structural simplification — try rewriting the expression so the variables you care about are on one side."',
      },
      commonStruggles: [
        { pattern: 'Empty canvas after extended time', response: '"You don\'t have to solve it all at once. Just write the first thing that comes to mind, even if you\'re not sure. We can build from there."' },
        { pattern: 'Off-track derivation (live reviewer flagged)', response: '"Pause for a second. Look at the line you just wrote — does the operation you applied actually preserve equality? Re-check the rule."' },
        { pattern: 'Skipped steps (shortcut detected)', response: '"That\'s a valid shortcut, but make sure you can justify each move. Want to write out the intermediate step so the chain is explicit?"' },
        { pattern: 'Got the right answer but messy work', response: '"You landed on it! Looking back at your derivation — which line was the key move that made the rest fall into place?"' },
      ],
      aiDirectives: [
        {
          title: 'COACH PROCESS, NOT ANSWERS',
          instruction:
            'Never reveal the canonical step or final answer at any scaffolding level. The point of this primitive is for the student to derive the solution themselves. '
            + 'Use the live reviewer\'s status (on-track / shortcut / off-track) when the student asks for help — if they\'re on-track, encourage continuation; if off-track, ask them to re-examine the latest line; if shortcut, ask them to articulate the rule they applied. '
            + 'After the verdict returns, focus on metacognition: which step was hardest, what would they try differently next time, what rule did they use. '
            + 'For hard difficulty problems, lean into strategy talk — substitution choice, case-split decisions, identity selection — rather than mechanical hints.',
        },
        {
          title: 'CALIBRATE REVEAL TO THE SUPPORT TIER',
          instruction:
            'The {{supportTier}} support tier mirrors what scaffolds are on screen — match your help to it. '
            + 'easy: the worked-step skeleton (step titles) and a first-step prompt are visible, so you MAY name the strategy and walk the student through the FIRST step only (never compute it, never reveal the answer). '
            + 'medium: the skeleton is visible but no first-step prompt — nudge execution of the step they are on; do not pre-name the first move. '
            + 'hard: NO skeleton and NO first-step prompt are shown — do NOT name any solution step or the strategy; ask what the problem is asking and what they notice, and let them choose the method. Never reveal the final answer at any tier.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'area-model',
    description: 'Multi-challenge visual area model for multiplication, perimeter, and factoring. Each session walks the student through 3-6 distinct factor pairs in the same eval mode. Per-challenge data (factor decompositions, display flags) is built locally from a pool service; Gemini emits only session-level wrapper metadata. Use for multi-digit multiplication, distributive property, partial products, perimeter (4.MD.3), and area-model factoring. ESSENTIAL for grades 3-6 math.',
    constraints: 'The manifest must NOT supply specific factor numbers, decompositions, or display flags — the generator picks 3-6 pairs locally per the selected eval mode. Algebraic mode is reserved for future expansion (no eval mode currently uses it).',
    affordances: { representation: 'pictorial', answers: ['type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Area model session: {{challengeType}}, {{totalChallenges}} problems. Currently on problem {{currentChallengeIndex}}/{{totalChallenges}}.',
      contextKeys: ['title', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'factor1Parts', 'factor2Parts', 'algebraicMode', 'supportTier'],
      scaffoldingLevels: {
        level1: '"What two numbers are multiplied in this cell?"',
        level2: '"This cell is {{factor1Part}} × {{factor2Part}}. What is that product?"',
        level3: '"Multiply the column header by the row header for each cell, then add all the partial products together."',
      },
      commonStruggles: [
        { pattern: 'Wrong partial product', response: '"Check: which number is on top of this column? Which is beside this row? Multiply those two."' },
        { pattern: 'Forgetting to add partial products', response: '"You found all the pieces! Now add them all together for the total product."' },
        { pattern: 'Place value errors in decomposition', response: '"23 breaks into 20 + 3, not 2 + 3. Keep the place values."' },
      ],
      aiDirectives: [
        {
          title: 'NUMERIC VS ALGEBRAIC MODE',
          instruction:
            'For NUMERIC mode (grades 3-5): focus on place value decomposition — "23 breaks into 20 + 3. '
            + 'That is why we have two columns!" Guide partial product calculation one cell at a time. '
            + 'For ALGEBRAIC mode (grades 7+): use proper algebraic language — "Multiply each term in the first '
            + 'binomial by each term in the second." Reference FOIL for binomials. '
            + 'In both modes, emphasize the distributive property: "We are breaking a hard multiplication into easier pieces."',
        },
        {
          title: 'SUPPORT TIER — REVEAL POLICY',
          instruction:
            'The student is at support tier {{supportTier}} (easy = max on-screen scaffolding, hard = min). '
            + 'Keep your reveal level in sync with what is on screen. '
            + 'easy: you may name the method (multiply column header × row header, then add the parts; '
            + 'or Perimeter = 2 × (length + width)) and walk the setup. '
            + 'medium: the method is shown on screen — nudge the next step, let the student do the arithmetic. '
            + 'hard: the on-screen cells are NOT pre-labeled (and the side-sum is hidden) on purpose — '
            + 'do NOT supply that withheld step; ask the student to read the row/column headers (or the labeled sides) '
            + 'and map it themselves. NEVER state a partial product, the total product, the perimeter, '
            + 'or (in factor mode) the dimension numbers at any tier — those are the answer.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_model',
        label: 'Build Model (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_model'],
        description: 'Construct area model from given factors. Simple single-digit factors. Grades 3-4.',
      },
      {
        evalMode: 'find_area',
        label: 'Find Area (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['find_area'],
        description: 'Calculate partial products and total area from shown model. Grades 3-4.',
      },
      {
        evalMode: 'perimeter',
        label: 'Perimeter (Pictorial)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['perimeter'],
        description: 'Find the perimeter of a rectangle with labeled side lengths (CCSS 4.MD.3). Grades 3-4.',
      },
      {
        evalMode: 'multiply',
        label: 'Multiply (Pictorial)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['multiply'],
        description: 'Multi-digit multiplication via area model decomposition. Grades 4-5.',
      },
      {
        evalMode: 'factor',
        label: 'Factor (Transitional)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['factor'],
        description: 'Reverse operation: partial products shown in grid, student discovers the factor decomposition (dimension labels). Grades 5-6.',
      },
    ],
  },
  {
    id: 'array-grid',
    description: 'Multi-challenge rectangular array of discrete objects (dots, squares, stars) arranged in rows and columns. Each session walks the student through 3-6 distinct (rows, columns) pairs in the same eval mode. Per-challenge dimensions are picked locally by a pool service; Gemini emits only session-level wrapper metadata. Teaches multiplication introduction, repeated addition, skip counting, commutative property, and arrays-as-multiplication. ESSENTIAL for elementary multiplication (grades 2-5).',
    constraints: 'The manifest must NOT supply specific row/column counts — the generator picks 3-6 dimension pairs locally per the selected eval mode. Keep arrays within the component caps (rows 2-6, columns 2-8).',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['build', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Array session: {{challengeType}}, {{totalChallenges}} arrays. Currently on array {{currentChallengeIndex}}/{{totalChallenges}}.',
      contextKeys: ['title', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'targetRows', 'targetColumns', 'supportTier'],
      scaffoldingLevels: {
        level1: '"How many rows do you need? How many columns?"',
        level2: '"You need {{targetRows}} rows of {{targetColumns}}. Can you count by {{targetColumns}}s?"',
        level3: '"{{targetRows}} rows × {{targetColumns}} columns = {{targetRows}} groups of {{targetColumns}}. Skip count by rows of {{targetColumns}} to find the total."',
      },
      commonStruggles: [
        { pattern: 'Confusing rows and columns', response: '"Rows go across (left to right). Columns go up and down."' },
        { pattern: 'Counting one-by-one instead of skip counting', response: '"Try counting by rows: each row has {{targetColumns}} items"' },
        { pattern: 'Swapping dimensions', response: '"3 rows of 5 and 5 rows of 3 give the same total — that is the commutative property!"' },
      ],
      aiDirectives: [
        {
          title: 'ARRAY-TO-MULTIPLICATION BRIDGING',
          instruction:
            'Help students see arrays as multiplication, not just counting. '
            + 'For each new array in the session, guide the connection: "You have {{targetRows}} rows. Each row has {{targetColumns}}. '
            + 'That is {{targetRows}} groups of {{targetColumns}}, which is {{targetRows}} × {{targetColumns}}!" '
            + 'Encourage skip counting over one-by-one counting. '
            + 'When the student notices the commutative property across two arrays in the session, celebrate: "You flipped it and got the same total — that always works with multiplication."',
        },
        {
          title: 'MULTI-ARRAY PACING',
          instruction:
            'This is a multi-array session — the student is on array {{currentChallengeIndex}} of {{totalChallenges}}. '
            + 'Each array is a fresh (rows, columns) pair. Do not re-explain the strategy from scratch every time — '
            + 'reinforce on array 1, encourage independence on array 2+, and celebrate completion patterns across the session.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_array',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Build Array (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_array'],
        description: 'Concrete: build array with given dimensions.',
      },
      {
        evalMode: 'count_array',
        affordances: { representation: 'pictorial', answers: ['type'] },
        label: 'Count Array (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count_array'],
        description: 'Pictorial: count total objects in array.',
      },
      {
        evalMode: 'multiply_array',
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['type'] },
        label: 'Multiply Array (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['multiply_array'],
        description: 'Pictorial: write multiplication sentence from array.',
      },
    ],
  },
  {
    id: 'double-number-line',
    description: 'Multi-challenge double-number-line session: students walk through 3-6 ratio challenges that all share ONE proportional relationship (same topLabel/bottomLabel/unitRate) for context coherence. Each challenge highlights one target ask-point on parallel number lines and the student enters the missing value. Critical bridge from additive to multiplicative reasoning. ESSENTIAL for grades 5-8 ratios and proportions practice.',
    constraints: 'Session-level configuration. The generator produces 3-6 ratio challenges per session sharing one scenario, so do NOT supply specific target points, given points, or per-challenge prompts from the manifest — they are derived from the eval mode + generated unit rate. Supports equivalent_ratios, find_missing, and unit_rate challenge types.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'equivalent_ratios',
        label: 'Equivalent Ratios (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['equivalent_ratios'],
        description: 'Unit rate given — scale to find equivalent ratio pairs.',
      },
      {
        evalMode: 'find_missing',
        label: 'Find Missing Value (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['find_missing'],
        description: 'Some points given — find missing values using proportional relationship.',
      },
      {
        evalMode: 'unit_rate',
        label: 'Discover Unit Rate (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['unit_rate'],
        description: 'Given a non-unit pair, discover the unit rate through division.',
      },
    ],
    tutoring: {
      taskDescription: 'Walk through {{totalChallenges}} ratio challenges in {{challengeType}} mode (current: challenge {{currentChallengeIndex}} of {{totalChallenges}}). Shared relationship: 1 {{topLabel}} = {{unitRate}} {{bottomLabel}}. Current prompt: {{currentPrompt}}.',
      contextKeys: ['topLabel', 'bottomLabel', 'unitRate', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'currentPrompt', 'targetTopValue', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What is the relationship between {{topLabel}} and {{bottomLabel}}? Look at the given point on the number lines."',
        level2: '"When {{topLabel}} = 1, what is {{bottomLabel}}? That is the unit rate — the key to every challenge in this session."',
        level3: '"Multiply the {{topLabel}} value by the unit rate to get the {{bottomLabel}} value. {{targetTopValue}} × {{unitRate}} = answer."',
      },
      commonStruggles: [
        { pattern: 'Adding instead of multiplying', response: '"Ratios use multiplication, not addition. If 1 costs $3, then 4 costs 4 × $3, not 1 + $3."' },
        { pattern: 'Cannot find unit rate', response: '"Look at the given point. Divide the bottom value by the top value to find the rate for 1 unit."' },
        { pattern: 'Scaling errors', response: '"Check: does your answer make sense? More {{topLabel}} should mean more {{bottomLabel}}."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-RATIO PACING',
          instruction:
            'This session contains {{totalChallenges}} ratio challenges that all share ONE proportional relationship. '
            + 'After each correct answer the student advances to the next challenge with a new ask-point on the same number lines. '
            + 'Briefly acknowledge each correct answer and preview the next challenge — do not re-explain the unit rate after challenge 1 unless the student gets stuck. '
            + 'The single-mode session is the IRT signal: do not skip ahead or change the relationship across challenges.',
        },
        {
          title: 'PROPORTIONAL REASONING COACHING',
          instruction:
            'The critical concept is the UNIT RATE. Always guide students toward finding it first: '
            + '"If 3 apples cost $6, what does 1 apple cost? Divide!" '
            + 'Once the unit rate is found, coach multiplication: "Now you know 1 costs $2. So 5 costs 5 × $2." '
            + 'Watch for additive thinking (a common misconception): if a student adds instead of multiplies, '
            + 'use a counterexample — "If 1 apple costs $2 and you add $2, you get $4. But 3 apples should cost $6, not $4."',
        },
        {
          title: 'REAL-WORLD CONNECTION',
          instruction:
            'Always connect the abstract ratio to the real-world context: use the labels ({{topLabel}} and {{bottomLabel}}). '
            + '"You are finding how many {{bottomLabel}} for each {{topLabel}}." '
            + 'This helps students see proportional reasoning as practical, not just arithmetic.',
        },
      ],
    },
    supportsEvaluation: true,
  },
    {
      id: 'tape-diagram',
      misconceptionScope: 'primitive',
    description: 'Multi-challenge tape-diagram session: students walk through 3-6 distinct word problems of the same eval mode, each with its own bars and (where applicable) word problem. Rectangular bars divided into labeled segments representing part-part-whole and comparison relationships. The single most versatile visual for word problems from elementary through algebra. Perfect for addition/subtraction word problems, comparison problems (more than, less than), multi-step word problems, ratio and proportion, and algebraic equation setup. Supports unknown segments marked with "?" for algebra. ESSENTIAL for word problem solving (grades 1-algebra).',
    constraints: 'Session-level configuration. The generator fans out N parallel sub-generator calls per the selected eval mode, so do NOT supply specific values, bar segments, or word problems from the manifest — they are generated per challenge.',
    affordances: { representation: 'pictorial', answers: ['type'], role: 'apply', minutes: 5 },
    evalModes: [
      { evalMode: 'represent', label: 'Represent (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['represent'], description: 'Build tape diagram from word problem, identify parts.' },
      { evalMode: 'solve_part_whole', label: 'Part-Whole (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['solve_part_whole'], description: 'Standard part-whole: given parts find total, or vice versa.' },
      { evalMode: 'solve_comparison', label: 'Comparison (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['solve_comparison'], description: 'Comparison problems with different quantity bars.' },
      { evalMode: 'multi_step', label: 'Multi-Step (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['multi_step'], description: 'Multi-step problems requiring multiple operations.' },
    ],
    tutoring: {
      taskDescription: 'Walk through {{totalChallenges}} tape-diagram problems in {{challengeType}} mode. Current: challenge {{currentChallengeIndex}} of {{totalChallenges}}. Phase: {{currentPhase}}. Unknown segments: {{unknownSegments}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'currentPhase', 'totalBars', 'unknownSegments', 'solvedSegments', 'currentWordProblem', 'challengeHintCount', 'title'],
      scaffoldingLevels: {
        level1: '"Look at the parts you can see. What do you notice about their values?"',
        level2: '"Add the known parts together to find the whole. Then use subtraction to find the unknown."',
        level3: '"The whole = all parts added together. If the whole is {{wholeValue}} and the known part is {{knownPart}}, then the unknown = {{wholeValue}} - {{knownPart}}."',
      },
      commonStruggles: [
        { pattern: 'Cannot identify the whole', response: '"The whole is all the parts combined. Add the values you can see."' },
        { pattern: 'Using wrong operation', response: '"If you know the whole and one part, subtract to find the missing part."' },
        { pattern: 'Ignoring phase structure', response: '"Start with Step 1: find the total. You will need it for the next steps."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE GUIDANCE',
          instruction:
            'In Phase 1 (Explore), guide the student to add the known parts. '
            + 'In Phase 2 (Practice), guide subtraction from the total. '
            + 'In Phase 3 (Apply), encourage independence with minimal hints.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'factor-tree',
    description: 'Multi-challenge factor-tree session: students factor 3-6 different composite numbers in a row at the same difficulty tier. Each challenge is a fresh tree with its own composite. Perfect for teaching prime numbers, composite numbers, factor decomposition, greatest common factor (GCF), least common multiple (LCM), and divisibility rules. ESSENTIAL for grades 4-6 number theory.',
    constraints: 'Composites only (not primes). Session-level configuration; rootValues are selected by the local pool service per eval mode, so do NOT supply specific numbers from the manifest.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Walk through {{totalChallenges}} factor trees. Current factorization: {{rootValue}} (challenge {{currentChallengeIndex}} of {{totalChallenges}}).',
      contextKeys: ['rootValue', 'currentFactorization', 'leavesCount', 'allPrime', 'guidedMode', 'currentChallengeIndex', 'totalChallenges'],
      scaffoldingLevels: {
        level1: '"Is this number prime or composite? If composite, can you think of two numbers that multiply to make it?"',
        level2: '"Try dividing {{selectedValue}} by small primes: 2, 3, 5, 7. Which one divides evenly?"',
        level3: '"{{selectedValue}} ÷ {{smallestFactor}} = {{otherFactor}}. So {{selectedValue}} = {{smallestFactor}} × {{otherFactor}}. Now check if each factor is prime."',
      },
      commonStruggles: [
        { pattern: 'Using 1 as a factor', response: '"1 is not useful in factor trees. Find two factors that are both greater than 1."' },
        { pattern: 'Not recognizing primes', response: '"A prime number has exactly 2 factors: 1 and itself. 2, 3, 5, 7, 11, 13 are primes."' },
        { pattern: 'Stopping before all leaves are prime', response: '"Keep splitting until every leaf is a prime number (green). Are there any yellow nodes left?"' },
      ],
      aiDirectives: [
        {
          title: 'GUIDED FACTORING APPROACH',
          instruction:
            'Guide students through divisibility rules as a strategy: '
            + '"Is the number even? Then divide by 2 first! Does it end in 0 or 5? Try dividing by 5." '
            + 'Celebrate when a prime is found: "That one is prime — it is a leaf! No more splitting needed." '
            + 'When the tree is complete, guide the student to read the leaves: '
            + '"Read all the green leaves — those are the prime factors. Write them as a multiplication." '
            + 'Point out that different factor pairs lead to the same prime factorization.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'guided_small',
        label: 'Guided Small (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['guided_small'],
        description: 'Small composites (4-24) with factor pair hints shown. Full scaffolding for learning the concept.',
      },
      {
        evalMode: 'guided_medium',
        label: 'Guided Medium (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['guided_medium'],
        description: 'Medium composites (24-60) with factor pair hints. More prime factors to decompose.',
      },
      {
        evalMode: 'unguided',
        label: 'Unguided (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['unguided'],
        description: 'Medium composites (20-60) without hints. Student must find factor pairs independently.',
      },
      {
        evalMode: 'unguided_large',
        label: 'Unguided Large (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['unguided_large'],
        description: 'Larger composites (40-80) without hints, reset allowed. More factors to decompose.',
      },
      {
        evalMode: 'assessment_intro',
        label: 'Assessment Intro (Tier 4+)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['assessment_intro'],
        description: 'Medium-large composites (40-80), no hints, no reset. Practice no-retry format.',
      },
      {
        evalMode: 'assessment',
        label: 'Assessment (Tier 5)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['assessment'],
        description: 'Larger composites (40-100), no hints, no reset. Formal assessment of factoring skill.',
      },
    ],
  },
  {
    id: 'ratio-table',
    description: 'Multi-challenge ratio table with 4 challenge types: missing-value (find a hidden scaled value), find-multiplier (determine the scaling factor), build-ratio (use a slider to construct an equivalent ratio), and unit-rate (calculate the unit rate). Structured table showing equivalent ratios with columns for each quantity. Progressive difficulty with scaffolded hints. Perfect for teaching equivalent ratios, unit rates, proportional reasoning, scaling relationships, and ratio problem-solving. ESSENTIAL for grades 5-7 ratios and proportions.',
    constraints: 'Requires a ratio relationship between 2-3 quantities. Best with 3-5 rows showing equivalent ratios.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Work through {{totalChallenges}} ratio challenges covering missing values, multipliers, ratio building, and unit rates. Current challenge: {{instruction}} with base ratio {{baseRatio}}.',
      contextKeys: ['baseRatio', 'rowLabels', 'challengeType', 'targetMultiplier', 'studentAnswer', 'targetValue', 'unitRate', 'hintsUsed', 'currentChallengeIndex', 'totalChallenges', 'currentAttempts'],
      scaffoldingLevels: {
        level1: '"What is the relationship between {{rowLabel1}} and {{rowLabel2}}? Look at the base ratio."',
        level2: '"The base ratio is {{baseRatio1}}:{{baseRatio2}}. The unit rate is {{unitRate}}. How can you use that to solve this?"',
        level3: '"Step by step: First find the unit rate ({{baseRatio2}} ÷ {{baseRatio1}} = {{unitRate}}). Then use it: {{unitRate}} × the known value gives the answer."',
      },
      commonStruggles: [
        { pattern: 'Only scaling one value', response: '"To keep the ratio equivalent, multiply BOTH values by the same number."' },
        { pattern: 'Adding instead of multiplying', response: '"Ratios scale by multiplication. 2:3 doubled is 4:6, not 4:5."' },
        { pattern: 'Cannot find unit rate', response: '"Divide the second quantity by the first: {{baseRatio2}} ÷ {{baseRatio1}}."' },
        { pattern: 'Confusing multiplier with unit rate', response: '"The multiplier tells you how many times bigger the scaled ratio is. The unit rate tells you the ratio when the first quantity is 1."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-CHALLENGE RATIO COACHING',
          instruction:
            'This primitive uses 4 challenge types in sequence. Adapt coaching to the current challenge type. '
            + 'For MISSING-VALUE: guide proportional reasoning — "The base ratio is {{baseRatio1}}:{{baseRatio2}}. '
            + 'What multiplier scales the base to this row? Use it to find the hidden value." '
            + 'For FIND-MULTIPLIER: focus on the scaling factor — "Compare the scaled value to the base value. '
            + 'What did you multiply by? That number works for BOTH columns." '
            + 'For BUILD-RATIO: guide slider use — "Slide to build a ratio equivalent to {{baseRatio1}}:{{baseRatio2}}. '
            + 'Both values must scale by the same factor." '
            + 'For UNIT-RATE: guide division — "Divide the second quantity by the first to find the rate per 1 unit." '
            + 'Track progress across challenges: "You have completed {{currentChallengeIndex}} of {{totalChallenges}} challenges." '
            + 'Use hints sparingly — let the student struggle productively before offering the next scaffold level.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_ratio',
        affordances: { answers: ['manipulate'] },
        label: 'Build Ratio (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build-ratio'],
        description: 'Construct ratio from context using slider.',
      },
      {
        evalMode: 'missing_value',
        affordances: { answers: ['type'] },
        label: 'Missing Value (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['missing-value'],
        description: 'Find unknown value in a scaled ratio.',
      },
      {
        evalMode: 'find_multiplier',
        affordances: { answers: ['type'] },
        label: 'Find Multiplier (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find-multiplier'],
        description: 'Discover the scale factor between ratios.',
      },
      {
        evalMode: 'unit_rate',
        affordances: { answers: ['type'] },
        label: 'Unit Rate (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['unit-rate'],
        description: 'Reduce to unit rate and apply.',
      },
    ],
  },
  {
    id: 'percent-bar',
    description: 'Multi-challenge percent-bar session (3-6 percent problems of the same difficulty tier). Each challenge gives a scenario (test score, discount, tax, comparison) and the student drags the bar to the target percent. The generator pre-builds each scenario deterministically; the catalog must NOT supply specific numbers or scenarios. Grade 5-8 percent concepts.',
    constraints: 'The generator pre-selects every scenario (wholeValue, question, targetPercent, hint) per session — the manifest must NOT supply specific numbers, scenarios, questions, or target percents. The manifest may set instanceCount (default 4, max 6), showPercentLabels, showValueLabels, benchmarkLines, doubleBar, and the targetEvalMode.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['manipulate'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'identify_percent',
        label: 'Identify Percent (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['direct'],
        description: 'Place a benchmark percent on the bar — test scores, parts of a quantity.',
      },
      {
        evalMode: 'find_part',
        label: 'Find Remaining / Discount (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['subtraction'],
        description: 'Compute 100 - discount to find the percent of original price that remains.',
      },
      {
        evalMode: 'find_whole',
        label: 'Find the Total with Tax / Tip (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['addition'],
        description: 'Two steps on the bar: place the added rate (tip/tax — value shows the dollars), then place the new total (100% + rate, bar extends past 100%).',
      },
      {
        evalMode: 'convert',
        label: 'Compare Final Prices (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['comparison'],
        description: 'Multi-step: compute each good\'s sale price on the bar, then choose which is cheaper — a bigger % off is not always the better deal.',
      },
    ],
    tutoring: {
      taskDescription: 'Percent bar session: {{title}}. Mode: {{challengeType}}. Challenge {{currentChallengeIndex}} of {{totalChallenges}}. Scenario: {{scenario}}. Question: {{question}}. Whole: {{wholeValue}} ({{wholeValueLabel}}). Current placement: {{currentPercent}}%. Target: {{targetPercent}}%.',
      contextKeys: [
        'challengeType',
        'currentChallengeIndex',
        'totalChallenges',
        'scenario',
        'wholeValue',
        'wholeValueLabel',
        'question',
        'targetPercent',
        'currentPercent',
        'currentValue',
        'attemptNumber',
      ],
      scaffoldingLevels: {
        level1: '"What benchmark percentage is closest — 25%, 50%, or 75%? Start there."',
        level2: '"{{targetPercent}}% means {{targetPercent}} out of 100. What is {{targetPercent}}/100 × {{wholeValue}}?"',
        level3: '"Convert the percent to a decimal: {{targetPercent}}% = {{targetPercent}}/100. Multiply: that × {{wholeValue}} gives the part."',
      },
      commonStruggles: [
        { pattern: 'Not connecting percent to fraction', response: '"Percent means per hundred. 25% = 25/100 = 1/4 of the whole."' },
        { pattern: 'Confusing part and whole', response: '"The whole (100%) is {{wholeValue}}. You are finding a part of it."' },
        { pattern: 'Difficulty with non-benchmark percents', response: '"Break it down: find 10% first (divide by 10), then scale up."' },
        { pattern: 'Subtraction-mode answer = rate, not 100 - rate', response: '"Discount mode: a {{targetPercent}}% discount means 100% - that = what you still pay. Subtract from 100."' },
        { pattern: 'Addition-mode places only the added rate, not the total', response: '"Tax and tip ADD ON TOP. The whole bill is 100% — add the rate to get the total, which lands past the 100% mark."' },
        { pattern: 'Comparison-mode assumes the bigger discount is cheaper', response: '"Bigger % off does not always win — it depends on the original price. Compute each sale price first, then compare the dollars."' },
      ],
      aiDirectives: [
        {
          title: 'MODE-AWARE GUIDANCE',
          instruction:
            'For DIRECT mode: the answer is the percent given in the scenario — student just places it. '
            + 'For SUBTRACTION (discount) mode: answer = 100 - the discount rate. Coach the subtraction explicitly. '
            + 'For ADDITION (tax/tip/markup) mode: a TWO-STEP problem. Step 1 = place the added rate (the dollar value shows the tip/tax). Step 2 = place the TOTAL = 100% + the rate; the bar extends past 100%. Never name the total for them. '
            + 'For COMPARISON mode: a MULTI-STEP shopping problem. Steps 1-2 = place each good\'s sale price as a percent of its own original (value shows the dollar price). Step 3 = choose which is cheaper/pricier. Coach the student to compare the COMPUTED PRICES, not the discount percents — a bigger % off is not always cheaper.',
        },
        {
          title: 'MULTI-PERCENT PACING',
          instruction:
            'After each challenge is solved, give a brief celebration and frame the next one as a fresh scenario. '
            + 'Reference progress ("Challenge {{currentChallengeIndex}} of {{totalChallenges}}") when natural. '
            + 'Do not re-introduce the percent-bar metaphor each time — once is enough.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'balance-scale',
    description: 'Multi-equation balance scale session (3-6 equations of the same difficulty tier). Each equation uses Explore → Solve → Verify pacing; students click blocks to remove from both sides, drag blocks from palette, or use operations panel. The generator pre-builds each equation deterministically; the catalog must NOT supply specific numbers. Grade-banded: K-2 (concrete, mystery number), 3-4 (one-step x equations), 5 (two-step). ESSENTIAL for pre-algebra and algebra.',
    constraints: 'The generator pre-selects every equation (leftSide, rightSide, variableValue) per session — the manifest must NOT supply specific numbers, sides, or solutions. The manifest may set instanceCount (default 4, max 6), showTilt, and the targetEvalMode.',
    affordances: { representation: ['concrete', 'pictorial', 'symbolic'], answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Balance scale session: {{title}}. Mode: {{challengeType}}. Equation {{currentChallengeIndex}} of {{totalChallenges}}. Current: {{currentEquation}}. Phase: {{phase}}. Steps taken: {{stepCount}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'targetEquation', 'currentEquation', 'variableValue', 'gradeBand', 'phase', 'stepCount', 'isSolved', 'isBalanced', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What do you notice about the two sides of the scale?"',
        level2: '"Look for a number that appears on the same side as x. Can you remove it from both sides?"',
        level3: '"The equation is {{currentEquation}}. To isolate x, subtract the constant from both sides. That gives you x = {{variableValue}}."',
      },
      commonStruggles: [
        { pattern: 'Removing from only one side', response: '"Whatever you do to one side, you MUST do to the other side too! That keeps the scale balanced."' },
        { pattern: 'Not knowing which operation to use', response: '"Look at what is next to x. If there is a + number, subtract it. If there is a × number, divide by it."' },
        { pattern: 'Incorrect verification', response: '"Plug your answer back in: replace x with your answer. Does the left side equal the right side?"' },
        { pattern: 'Stuck in explore phase', response: '"Click Start Solving when you are ready. Then click on blocks or use the operations panel."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE GUIDANCE',
          instruction:
            'In EXPLORE phase: let the student click and play freely. Ask: "What happens when you add to one side? Does the scale stay balanced?" '
            + 'In SOLVE phase: guide one step at a time. Never solve multiple steps at once. '
            + 'Ask: "What should we remove first?" After each step, pause and let the student observe the scale. '
            + 'In VERIFY phase: guide substitution — "Replace x with your answer. Does it balance?"',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For K-2: use concrete "mystery number" language — "What number is hiding under the box?" Avoid "x" and "equation." '
            + 'For grades 3-4: introduce "equation" and "x" but tie to the concrete scale — "x is the mystery number on the scale." '
            + 'For grade 5: use algebraic language — "Isolate the variable by performing inverse operations on both sides."',
        },
        {
          title: 'MULTI-EQUATION PACING',
          instruction:
            'After each equation is solved, give a brief celebration and frame the next one as a fresh puzzle. '
            + 'Reference progress ("Equation {{currentChallengeIndex}} of {{totalChallenges}}") when natural. '
            + 'Do not re-introduce the balance metaphor each time — once is enough.',
        },
      ],
      studentPrompts: [
        {
          kind: 'explain',
          label: 'What do I do with {{currentEquation}}?',
          prompt: "I'm looking at {{currentEquation}}. What should my first step be?",
        },
        { kind: 'hint', label: 'Give me a nudge', hintLevel: 1 },
        { kind: 'hint', label: 'Show me the next step', hintLevel: 2 },
        {
          kind: 'check',
          label: 'Did I keep it balanced?',
          prompt: "Did I keep both sides balanced? I'm on step {{stepCount}}.",
        },
        {
          kind: 'advance',
          label: 'Next equation',
          prompt:
            "I solved it! Ready for equation {{currentChallengeIndex}} of {{totalChallenges}}.",
          showWhen: { key: 'isSolved' },
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'equality',
        affordances: { representation: 'concrete' },
        label: 'Equality (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['equality'],
        description: 'Understand balance = equal; missing addend problems.',
      },
      {
        evalMode: 'equality_hard',
        affordances: { representation: 'pictorial' },
        label: 'Equality Hard (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['equality_hard'],
        description: 'Subtraction missing-addend and larger sums (10-20), still □ notation.',
      },
      {
        evalMode: 'one_step',
        affordances: { representation: 'pictorial' },
        label: 'One-Step (Pictorial–)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['one_step'],
        description: 'Solve single-operation equations with x.',
      },
      {
        evalMode: 'one_step_hard',
        label: 'One-Step Hard (Transitional)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['one_step_hard'],
        description: 'One-step equations with multiply/divide (3x=12, x÷2=5).',
      },
      {
        evalMode: 'two_step_intro',
        label: 'Two-Step Intro (Transitional)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['two_step_intro'],
        description: 'Simple two-step equations, small positive coefficients only (2x+1=7).',
      },
      {
        evalMode: 'two_step',
        affordances: { representation: 'symbolic' },
        label: 'Two-Step (Symbolic)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['two_step'],
        description: 'Solve multi-step equations with coefficients.',
      },
    ],
  },
  {
    id: 'function-machine',
    description: 'Visual "machine" with input hopper, rule display, and output chute. Each session walks the student through 3-6 distinct function rules of the same challenge type (observe / predict / discover_rule / create_rule). Numbers enter, get transformed by the rule, and exit. Grade-banded: 3-4 (one-step rules like x+3, x*2), 5 (two-step rules like 2*x+1), advanced (expressions like x^2). ESSENTIAL for grades 3-4 patterns, grades 5-8 function introduction, and Algebra 1-2 function concepts.',
    constraints: 'The generator pre-selects the rules and input queues for each session — the manifest must NOT supply specific rules, inputs, or numeric values. The manifest may set instanceCount (default 3, max 6), ruleComplexity, gradeBand, outputDisplay, and the targetEvalMode.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Function machine session: {{title}}. Mode: {{challengeType}}. Function {{currentChallengeIndex}} of {{totalChallenges}}. Current rule: {{rule}} (visible={{showRule}}). Pairs observed: {{pairsCount}}. Predictions: {{predictionsCorrect}}/{{predictionsTotal}}. Grade band: {{gradeBand}}.',
      contextKeys: ['challengeType', 'title', 'currentChallengeIndex', 'totalChallenges', 'rule', 'showRule', 'processedPairs', 'guessedRule', 'gradeBand', 'ruleComplexity', 'pairsCount', 'predictionsCorrect', 'predictionsTotal', 'guessAttempts', 'ruleDiscovered'],
      scaffoldingLevels: {
        level1: '"Look at the input and output. What changed? What stayed the same?"',
        level2: '"Compare the pairs: input {{input1}} → output {{output1}}, input {{input2}} → output {{output2}}. What pattern do you see?"',
        level3: '"Each output = input {{operation}} {{operand}}. Try it: {{input}} {{operation}} {{operand}} = {{output}}."',
      },
      commonStruggles: [
        { pattern: 'Guessing additively for multiplicative rules', response: '"The change is not the same each time. Try multiplying instead of adding."' },
        { pattern: 'Only looking at one pair', response: '"Look at multiple input-output pairs. The rule works for ALL of them."' },
        { pattern: 'Confusing two-step rules', response: '"Some rules have two steps. Try: first multiply, then add (or subtract)."' },
        { pattern: 'Prediction consistently wrong', response: '"Look at the pairs you already have. Before you predict, check: does your idea work for ALL previous pairs?"' },
      ],
      aiDirectives: [
        {
          title: 'CHALLENGE-TYPE GUIDANCE',
          instruction:
            'In observe mode: let the student explore freely, narrate the transformation. '
            + 'In predict mode: ask "What do you think will come out?" BEFORE revealing the output. Celebrate correct predictions. '
            + 'In discover_rule mode: guide toward the rule using scaffolding. Never reveal the rule directly. '
            + 'In create_rule mode: focus on writing the rule symbolically. Confirm understanding of the operation order.',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For grades 3-4: use simple language, focus on one-step patterns like "add 3" or "double". '
            + 'For grade 5: introduce two-step thinking: "first multiply, then add". '
            + 'For advanced: use algebraic notation f(x), discuss domain and range concepts.',
        },
        {
          title: 'MULTI-RULE PACING',
          instruction:
            'After each rule is complete, give a brief celebration and frame the next one as a fresh puzzle. '
            + 'Reference progress ("Function {{currentChallengeIndex}} of {{totalChallenges}}") when appropriate.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'observe',
        affordances: { answers: ['tap'] },
        label: 'Observe (Tier 1)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['observe'],
        description: 'Watch input/output with rule visible. Full guidance.',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['type'] },
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Predict output for new input with rule visible.',
      },
      {
        evalMode: 'discover_rule',
        affordances: { answers: ['type'] },
        label: 'Discover Rule (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['discover_rule'],
        description: 'Identify the hidden function rule from I/O pairs.',
      },
      {
        evalMode: 'create_rule',
        affordances: { answers: ['type'] },
        label: 'Create Rule (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['create_rule'],
        description: 'Write the rule expression for given I/O pairs.',
      },
    ],
  },
  {
    id: 'coordinate-graph',
    description: 'Interactive coordinate plane with structured challenges. Students plot points by clicking grid intersections, identify coordinates of displayed points, calculate slopes using rise/run triangles, and find y-intercepts of lines. SVG-based with snap-to-grid interaction. ESSENTIAL for Grades 5-8 algebra readiness and Algebra I.',
    constraints: 'Requires gridMin/gridMax (integer bounds for both axes). Challenges must use integer coordinates within the grid range. For plot_point, target must be on a grid intersection. For find_slope, points must have integer coordinates producing clean slope fractions. For find_intercept, the line must cross the y-axis at an integer.',
    affordances: { representation: 'symbolic', answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'plot_point',
        label: 'Plot Point (Foundational)',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['plot_point'],
        description: 'Student clicks the correct grid intersection for given coordinates. Tests ordered pair comprehension.',
      },
      {
        evalMode: 'read_point',
        label: 'Read Point (Developing)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['read_point'],
        description: 'A point is displayed on the grid. Student identifies its coordinates from multiple choice options.',
      },
      {
        evalMode: 'find_slope',
        label: 'Find Slope (Proficient)',
        beta: 0.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_slope'],
        description: 'Two points and a rise/run triangle are shown. Student identifies the slope from multiple choice options.',
      },
      {
        evalMode: 'find_intercept',
        label: 'Find Y-Intercept (Advanced)',
        beta: 1.0,
        scaffoldingMode: 5,
        challengeTypes: ['find_intercept'],
        description: 'A line is drawn across the grid. Student identifies where it crosses the y-axis from multiple choice options.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is working on a coordinate plane challenge: {{challenge.type}}. Current instruction: "{{challenge.instruction}}". Grid range: {{gridMin}} to {{gridMax}}.',
      contextKeys: ['challenges', 'gridMin', 'gridMax', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Can you think about what each number in the ordered pair tells you? Which one is horizontal and which is vertical?"',
        level2: '"Let\'s break this down. Start at the origin (0,0). The x-coordinate tells you how far to go left or right. The y-coordinate tells you how far to go up or down. Try tracing with your finger."',
        level3: '"Step by step: First, find {{challenge.x1}} on the x-axis (horizontal). Now from that spot, count {{challenge.y1}} units up (positive) or down (negative) on the y-axis. That\'s where the point goes."',
      },
      commonStruggles: [
        { pattern: 'Student swaps x and y coordinates when plotting', response: 'Remember: x comes first and goes left-right, y comes second and goes up-down. Think "x across, y up".' },
        { pattern: 'Student confused by negative coordinates', response: 'Negative x means go LEFT from the origin. Negative y means go DOWN. The origin (0,0) is your starting point.' },
        { pattern: 'Student cannot calculate slope from two points', response: 'Slope is rise over run. Rise = how much you go up or down (change in y). Run = how much you go left or right (change in x). Look at the dashed triangle on the graph.' },
        { pattern: 'Student confuses slope and y-intercept', response: 'The y-intercept is WHERE the line crosses the y-axis (the vertical line). The slope is HOW STEEP the line is. They are different properties of the line.' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'slope-triangle',
    description: 'Multi-challenge slope triangle session (3-6 distinct lines of the same challenge type). Each challenge shows a line on a coordinate grid with a right triangle illustrating rise and run; the student reads or constructs the triangle to find slope. ESSENTIAL for grades 7-8 (slope introduction), Algebra 1 (slope calculation, linear equations), Geometry (parallel/perpendicular lines, angles), and Precalculus (connecting slope to tangent). Supports rise/run notation for younger students and Δy/Δx notation for older ones. The system pre-builds the line equations and triangle positions per challenge — the manifest must NOT specify equations, slopes, or triangle dimensions.',
    constraints: 'The manifest must NOT supply equations, slopes, or triangle positions/sizes — these are built per challenge by the pool service. Provide only topic + grade-level context and (optionally) instanceCount and targetEvalMode.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'identify_slope',
        label: 'Identify Rise & Run (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify_slope'],
        description: 'Read rise and run off a pre-drawn slope triangle. Integer slopes, rise/run notation.',
      },
      {
        evalMode: 'calculate',
        label: 'Calculate Slope (Tier 5)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['calculate'],
        description: 'Compute slope = rise ÷ run from a drawn triangle. Mix of integer and fractional slopes.',
      },
      {
        evalMode: 'draw_triangle',
        affordances: { answers: ['manipulate'] },
        label: 'Construct Triangle (Tier 6)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['draw_triangle'],
        description: 'Position and size a slope triangle on a given line to match a target run. Δy/Δx notation.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-line slope triangle session. Mode: {{challengeType}}. Line {{currentChallengeIndex}} of {{totalChallenges}}: {{equation}}. Expected slope = {{expectedSlope}} (rise {{expectedRise}} over run {{expectedRun}}).',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'equation', 'slope', 'expectedRise', 'expectedRun', 'expectedSlope', 'notation', 'gradeBand', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"How steep is this line? Does it go uphill or downhill?"',
        level2: '"Count the rise (vertical change) and the run (horizontal change). Divide rise by run."',
        level3: '"Rise = {{expectedRise}}, Run = {{expectedRun}}. Slope = rise ÷ run = {{expectedRise}} ÷ {{expectedRun}} = {{expectedSlope}}."',
      },
      commonStruggles: [
        { pattern: 'Confusing rise and run', response: '"Rise is vertical (up/down). Run is horizontal (left/right). Rise over run."' },
        { pattern: 'Negative slope confusion', response: '"If the line goes downhill (left to right), the rise is negative. The slope is negative."' },
        { pattern: 'Thinking slope changes with triangle size', response: '"Even a bigger triangle gives the same slope. The ratio rise/run is constant along a line."' },
        { pattern: 'Forgetting to simplify a fractional slope', response: '"Reduce the fraction. 4/6 = 2/3."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-LINE PACING',
          instruction:
            'The session walks through several distinct lines of the same challenge type. '
            + 'After each correct answer, briefly celebrate, then point forward: "Now look at the next line — same idea, different numbers." '
            + 'Do NOT re-introduce the concept from scratch on every line; the second through Nth challenges should feel like fluency practice, not lesson restarts.',
        },
        {
          title: 'SLOPE CONSTANCY DISCOVERY',
          instruction:
            'Across the multi-line session, reinforce that slope is CONSTANT along each individual line. '
            + 'On any line, dragging or resizing the triangle does not change rise ÷ run. '
            + 'Across lines, different equations give different slopes — that is the point of practicing multiple. '
            + 'Connect to rate of change: a slope of 2 means y goes up 2 for every 1 step right; a slope of -1/3 means y goes down 1 for every 3 steps right.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'systems-equations-visualizer',
    description: 'Multi-challenge systems-of-equations session (3-6 distinct systems of the same solution method, surfaced sequentially). Per challenge, students see two linear equations and one integer (x, y) solution, then type the answer for immediate judgment. Wrong answers prompt a hint; correct answers reveal the intersection on the graph and advance. Supports graphing (slope-intercept lines drawn for visual reading), substitution (equations in y = mx + b form, graph hidden until correct), and elimination (equations in a·x + b·y = c form, graph hidden until correct). ESSENTIAL for grade 8 (systems introduction via graphing), Algebra 1 (substitution + elimination), and Algebra 2 (efficient method selection).',
    constraints: 'Manifest must NOT supply specific equations, slopes, intercepts, or solutions — the pool service builds 3-6 distinct systems deterministically from the eval mode and gradeBand. Manifest may supply gradeBand and instanceCount only. Per-mode shape: graph uses integer slopes (m ∈ {±1, ±2, ±3, ±1/2}) and integer intersections in [-4, 4]; substitution uses the same slope-intercept form with mixed integer/fractional slopes; elimination uses small integer coefficients (a, b ∈ {±1, ±2, ±3}) with integer solutions and a·x + b·y = c display form.',
    affordances: { representation: 'symbolic', answers: ['type'], role: 'apply', minutes: 8 },
    evalModes: [
      {
        evalMode: 'graph',
        affordances: { representation: ['pictorial', 'symbolic'] },
        label: 'Graph (Tier 1)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['graph'],
        description: 'Read the intersection of two lines from a drawn graph. Both lines visible; student types (x, y). CCSS 8.EE.C.8. Grade 8.',
      },
      {
        evalMode: 'substitution',
        label: 'Substitution (Tier 2)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['substitution'],
        description: 'Solve algebraically by setting two y = mx + b equations equal. Graph hidden until correct. CCSS A-REI.C.6. Algebra 1.',
      },
      {
        evalMode: 'elimination',
        label: 'Elimination (Tier 3)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['elimination'],
        description: 'Solve a·x + b·y = c systems by adding or scaling. Graph hidden until correct. CCSS A-REI.C.5. Algebra 1 / 2.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-system practice session. Method: {{challengeType}}. System {{currentChallengeIndex}} of {{totalChallenges}}. Equations: {{equationA}} and {{equationB}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'equationA', 'equationB', 'systemForm', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Two equations, one (x, y) that satisfies BOTH. What method are you using?"',
        level2: '"Walk through the method one step at a time. For substitution: set the two y-expressions equal. For elimination: line up x or y columns."',
        level3: '"Plug a candidate solution into both equations — it must work in both. Verify before you commit."',
      },
      commonStruggles: [
        { pattern: 'Reading intersection off the graph wrong', response: '"Trace each line carefully. The intersection is the single point both lines share — read x first, then y."' },
        { pattern: 'Substitution: forgot to back-substitute', response: '"You found x. Now plug that x into either equation to find y."' },
        { pattern: 'Elimination: signs not lined up', response: '"To cancel a variable, the coefficients must be opposites. Multiply one equation by -1 if needed."' },
      ],
      aiDirectives: [
        {
          title: 'METHOD-AWARE COACHING',
          instruction:
            'For GRAPH mode: guide visual inspection — "Trace each line to where they cross. That point is the solution." '
            + 'For SUBSTITUTION mode: guide setting equations equal — "Both are solved for y, so set them equal and solve for x. Then back-substitute." '
            + 'For ELIMINATION mode: guide coefficient alignment — "Can you add or subtract the equations so one variable cancels? Multiply if the coefficients don\'t match yet." '
            + 'Always end with verification: "Plug (x, y) into BOTH equations. It must work in both."',
        },
        {
          title: 'MULTI-SYSTEM PACING',
          instruction:
            'This is a {{totalChallenges}}-system session. After each correct answer the student clicks "Next System →". '
            + 'Encourage progression: "Nice — on to system {{currentChallengeIndex}}!" '
            + 'After a wrong attempt, point at the specific step (set-equal, distribute, eliminate) that needs another look — '
            + 'do NOT just repeat the whole method.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'polygon-area-builder',
    description: 'Multi-figure polygon-area session (3-6 distinct figures of the same eval mode, surfaced sequentially). Students derive and apply area formulas by composing and decomposing shapes on a canvas grid: rearrange a parallelogram into a rectangle by sliding the cut triangle (conservation of area), compute triangle / parallelogram / trapezoid areas from labeled dimensions, decompose composite figures into known rectangles and sum, and find the area of a polygon from its vertex coordinates. Canvas-based with five progressive difficulty tiers (decompose → triangle/parallelogram → trapezoid → composite → coordinate polygon). CCSS 6.G.A.1. Grades 6-7. The system pre-builds each figure (dimensions, coordinates, rectangle parts) deterministically per challenge — the manifest must NOT specify dimensions, coordinates, or areas.',
    constraints: 'The manifest must NOT supply per-figure dimensions, coordinates, rectangle parts, or areas — the pool service builds 3-6 distinct figures deterministically from the selected eval mode and gradeBand. The manifest may supply gradeBand and instanceCount only (default 4, max 6). Each eval mode maps to exactly one challenge type of the same name.',
    affordances: { representation: 'pictorial', answers: ['type'], role: 'apply', minutes: 8 },
    evalModes: [
      {
        evalMode: 'decompose',
        affordances: { answers: ['manipulate', 'type'] },
        label: 'Decompose to Rectangle (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['decompose'],
        description: 'Rearrange a parallelogram into a rectangle by sliding the cut triangle, then find base × height. Conservation of area.',
      },
      {
        evalMode: 'find_area_triangle_parallelogram',
        label: 'Triangle & Parallelogram Area (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['find_area_triangle_parallelogram'],
        description: 'Compute area of a labeled triangle (½·b·h) or parallelogram (b·h).',
      },
      {
        evalMode: 'find_area_trapezoid',
        label: 'Trapezoid Area (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_area_trapezoid'],
        description: 'Trapezoid area using the average-of-bases method ½·(b1+b2)·h.',
      },
      {
        evalMode: 'composite_area',
        label: 'Composite Area (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 5,
        challengeTypes: ['composite_area'],
        description: 'Find the area of an irregular figure by decomposing it into known rectangles and summing.',
      },
      {
        evalMode: 'coordinate_polygon',
        label: 'Coordinate Polygon Area (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 6,
        challengeTypes: ['coordinate_polygon'],
        description: 'Find the area of a polygon from its vertex coordinates on a grid.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-figure polygon-area session. Mode: {{challengeType}}. Figure {{currentChallengeIndex}} of {{totalChallenges}} ({{figureType}}). Expected area = {{expectedArea}} {{unitLabel}}².',
      contextKeys: ['challengeType', 'figureType', 'currentChallengeIndex', 'totalChallenges', 'base', 'base2', 'height', 'expectedArea', 'unitLabel', 'gradeBand', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What kind of shape is this? Can you see a rectangle hiding inside it, or a way to cut it into pieces you already know?"',
        level2: '"Use the right formula for this figure: triangle = ½·b·h, parallelogram = b·h, trapezoid = ½·(b1+b2)·h, composite = decompose into rectangles and add, coordinate polygon = count the whole grid units inside."',
        level3: '"This figure has base {{base}} and height {{height}}. Plug those into the formula for a {{figureType}}: the area works out to {{expectedArea}} {{unitLabel}}². Walk through each multiplication, then write the result."',
      },
      commonStruggles: [
        { pattern: 'Forgetting the ½ for a triangle', response: '"A triangle is exactly HALF of a rectangle with the same base and height. After base × height, remember to take half."' },
        { pattern: 'Using a slant side instead of the perpendicular height', response: '"Height must be perpendicular (straight up) from the base — not the slanted edge. Look for the right-angle mark."' },
        { pattern: 'Adding the two trapezoid bases without halving', response: '"For a trapezoid, average the two bases first: (b1 + b2) ÷ 2, THEN multiply by the height."' },
        { pattern: 'Double-counting the overlap in a composite figure', response: '"When you split into rectangles, make sure the pieces do not overlap. Each square of the figure should be counted exactly once."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-FIGURE PACING',
          instruction:
            'The session walks through several distinct figures of the same eval mode. '
            + 'After each correct answer, briefly celebrate, then point forward: "Now look at the next figure — same method, new shape." '
            + 'Do NOT re-teach the formula from scratch on every figure; the second through Nth challenges should feel like fluency practice, not lesson restarts. '
            + 'The student is on figure {{currentChallengeIndex}} of {{totalChallenges}}.',
        },
        {
          title: 'FORMULA DERIVATION',
          instruction:
            'Reinforce that EVERY polygon area comes from base × height. '
            + 'A triangle is half of a rectangle (½·b·h). A parallelogram rearranges into a rectangle of the same base and height (b·h) — that is the conservation-of-area idea from the decompose tier. '
            + 'A trapezoid averages its two parallel bases, then multiplies by height (½·(b1+b2)·h). '
            + 'A composite figure is just several rectangles added together, and a coordinate polygon decomposes into rectangles and triangles on the grid. '
            + 'Keep returning to this through-line: students who see WHY the formula is base × height stop memorizing four disconnected rules.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'circle-explorer',
    description: 'Multi-circle grade-7 session (3-6 distinct circles of the same eval mode, surfaced sequentially) for discovering and applying the geometry of circles. Students first uncover π itself by measuring C ÷ d across several circles and recognizing the constant ≈ 3.14, then find circumference from a radius or diameter (C = 2πr = πd), find area from a radius (A = πr²), work backward to recover the radius given a circumference or an area, and finally tackle composite figures (semicircle area/perimeter, circle-in-square). Canvas-based with two signature interactions: an unroll-the-circumference animation that straightens the perimeter into a line of length πd, and a slice-into-wedges rearrangement that morphs the circle into a near-rectangle of base πr and height r to reveal A = πr². Five progressive difficulty tiers (discover π → circumference → area → reverse → composite). CCSS 7.G.B.4. Grade 7. Fork-A: the pool service pre-builds each circle (radius, given value, composite dimensions, answer) deterministically per challenge — the manifest must NOT specify radii, given values, dimensions, or answers.',
    constraints: 'The manifest must NOT supply per-circle radii, given values, composite dimensions, or answers — the pool service builds 3-6 distinct circles deterministically from the selected eval mode and gradeBand. The manifest may supply gradeBand and instanceCount only (default 4, max 6). Each eval mode maps to exactly one challengeType of the same name.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['type'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'discover_pi',
        affordances: { answers: ['tap', 'type'] },
        label: 'Discover π (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['discover_pi'],
        description: 'Estimate C ÷ d across circles and recognize the constant π ≈ 3.14.',
      },
      {
        evalMode: 'circumference',
        label: 'Circumference (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['circumference'],
        description: 'Find the circumference from the radius or diameter (C = 2πr = πd).',
      },
      {
        evalMode: 'area',
        label: 'Area (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['area'],
        description: 'Find the area of a circle from its radius (A = πr²).',
      },
      {
        evalMode: 'reverse',
        label: 'Find the Radius (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 5,
        challengeTypes: ['reverse'],
        description: 'Work backward: find the radius given the circumference or the area.',
      },
      {
        evalMode: 'composite',
        label: 'Composite Figures (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 6,
        challengeTypes: ['composite'],
        description: 'Semicircle area/perimeter and circle-in-square composite figures.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-circle session. Mode: {{challengeType}}. Circle {{currentChallengeIndex}} of {{totalChallenges}} (radius {{radius}} {{unitLabel}}). Expected answer = {{expectedAnswer}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'radius', 'given', 'answerKind', 'reverseGiven', 'compositeShape', 'unitLabel', 'expectedAnswer', 'gradeBand', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Every circle answer flows from one number — π. Before you compute anything, ask yourself: does this question want what is AROUND the circle or INSIDE it, and do you need the radius or the diameter to get there?"',
        level2: '"Pick the relationship that matches this mode: circumference is C = 2πr = πd; area is A = πr²; to work backward, divide a circumference by 2π to get the radius, or take √(A/π) for the radius from an area; for a composite, a semicircle is exactly half a circle, and a circle-in-square is the square minus the inscribed circle. This circle has radius {{radius}} {{unitLabel}} — match it to the right formula."',
        level3: '"Start from radius {{radius}} {{unitLabel}}. For circumference, double the radius and multiply by π (2 × {{radius}} × π); for area, square the radius first ({{radius}} × {{radius}}) and then multiply by π; for reverse, undo that chain one step at a time; for a composite, build each circular piece and then combine. I have set up the multiplication for you — now you finish the arithmetic and tell me what you get."',
      },
      commonStruggles: [
        { pattern: 'Using the diameter where the radius is needed (or the radius where the diameter is needed)', response: '"Check which length you have. The radius reaches from the center to the edge; the diameter goes all the way across (d = 2r). C = πd uses the diameter, but C = 2πr and A = πr² both use the radius."' },
        { pattern: 'Forgetting to square the radius for area', response: '"Area is A = πr² — the radius is SQUARED, not just multiplied once. Compute r × r first, then multiply by π."' },
        { pattern: 'Confusing circumference (around) with area (inside), and units with square units', response: '"Circumference measures the distance AROUND the circle and is reported in plain units; area measures the space INSIDE and is reported in square units. Decide which one the question wants before you start."' },
        { pattern: 'For reverse problems, multiplying by 2π instead of dividing', response: '"To go from circumference back to the radius you must UNDO the formula: since C = 2πr, divide the circumference by 2π. Multiplying would make the radius far too big."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-CIRCLE PACING',
          instruction:
            'The session walks through several distinct circles of the same eval mode. '
            + 'After each correct answer, briefly celebrate, then point forward: "Now look at the next circle — same method, new measurements." '
            + 'Do NOT re-teach the formula from scratch on every circle; circles 2 through N should feel like fluency practice, not lesson restarts. '
            + 'The student is on circle {{currentChallengeIndex}} of {{totalChallenges}}.',
        },
        {
          title: 'PI AS A RATIO',
          instruction:
            'Keep returning to the through-line that π is simply C ÷ d — the ratio of any circle\'s circumference to its diameter, the same ≈ 3.14 for every circle. '
            + 'That one constant powers BOTH circumference (C = 2πr = πd) and area (A = πr²). '
            + 'Students who understand π as this single ratio stop memorizing disconnected formulas and instead see every circle answer as the same idea applied two ways.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'angle-workshop',
    description: 'Interactive angle workshop where students measure, classify, and solve for unknown angles on a canvas figure. Perfect for angle relationships (complementary, supplementary, vertical, adjacent), writing and solving equations for unknown angles, and parallel-lines-with-a-transversal reasoning. ESSENTIAL for grade 7-8 geometry (CCSS 7.G.B.5, 8.G.A.5).',
    constraints: 'The manifest must NOT supply specific per-challenge angle values, measures, or relationships — the local pool service builds the challenges deterministically from the selected eval mode. The manifest supplies only session-level wrapper metadata (title, description, challengeType, gradeBand).',
    affordances: { representation: 'pictorial', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'measure',
        label: 'Measure with a Protractor',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['measure'],
        description: 'Read an angle from a protractor.',
      },
      {
        evalMode: 'classify_pairs',
        affordances: { answers: ['tap'] },
        label: 'Classify Angle Pairs',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['classify_pairs'],
        description: 'Identify complementary, supplementary, vertical, or adjacent pairs.',
      },
      {
        evalMode: 'solve_unknown',
        affordances: { answers: ['type'] },
        label: 'Solve for an Unknown Angle',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['solve_unknown'],
        description: 'Use a relationship to find a missing angle.',
      },
      {
        evalMode: 'solve_algebraic',
        affordances: { answers: ['type'] },
        label: 'Algebraic Angle Equations',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['solve_algebraic'],
        description: 'Set up and solve a linear equation for an unknown angle.',
      },
      {
        evalMode: 'transversal',
        affordances: { answers: ['type'] },
        label: 'Transversals & Triangle Angles',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['transversal'],
        description: 'Parallel lines cut by a transversal, and triangle angle-sum / exterior-angle problems.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-problem angle session — the student measures, classifies, or solves for unknown angles across several figures. Currently on {{challengeType}} problem {{currentChallengeIndex}} of {{totalChallenges}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'answerKind', 'relationship', 'solveConfig', 'algConfig', 'transversalShape', 'transRelation', 'knownAngle', 'givenAngle', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Which angles in the figure are connected — do they form a line, a right angle, or cross? Decide how they relate before you reach for any numbers."',
        level2: '"Name the relationship first. This is a {{relationship}} pair, so the two angles have a fixed total or are equal. One angle here measures {{knownAngle}}° — write the relationship as an equation that links it to the unknown, but do NOT compute the answer yet."',
        level3: '"Set it up step by step. Start from the relationship ({{relationship}}) and the known angle {{knownAngle}}°. Write the equation, isolate the unknown on one side, and — if the question asks for an algebraic angle — remember to substitute your value of x back into the expression. I have framed the equation; you finish the arithmetic and tell me what you get."',
      },
      commonStruggles: [
        { pattern: 'Adds to 90 when the angles lie on a straight line', response: 'Point out the straight line means the two angles must total 180°, not 90°.' },
        { pattern: 'Solves for x but submits x instead of the requested angle measure', response: 'Remind them to substitute x back into the expression when the question asks for the angle.' },
        { pattern: 'Calls a straight-line pair "vertical"', response: 'Clarify vertical angles are the opposite pair where two lines cross.' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-PROBLEM PACING',
          instruction:
            'This is a {{totalChallenges}}-problem session. After each correct answer, the student clicks "Next Problem →". '
            + 'Encourage progression: "Nice — on to problem {{currentChallengeIndex}}!" '
            + 'After a wrong attempt, point at the specific step that needs another look — '
            + 'do NOT repeat the whole method from scratch.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'transformation-lab',
    description: 'Interactive coordinate-plane transformation lab where students slide, flip, turn, and scale a polygon and see what stays the same. Students drag image vertices to apply translations, reflections, and rotations; name transformations from a pre-image/image pair; compose sequences of motions to hit a target; and apply dilations to reason about similarity vs congruence. Perfect for rigid motions (translations, reflections, rotations), congruence via sequences of transformations, dilations, and similarity. ESSENTIAL for grade 8 geometry (CCSS 8.G.A.1, 8.G.A.2, 8.G.A.3, 8.G.A.4).',
    constraints: 'The manifest must NOT supply specific per-challenge vertices, coordinates, transformation parameters, or answers — the local pool service builds the challenges deterministically from the selected eval mode. The manifest supplies only session-level wrapper metadata (title, description, challengeType, gradeBand=\'8\').',
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'apply_translation_reflection',
        affordances: { answers: ['manipulate'] },
        label: 'Translate & Reflect (Tier 3)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['apply_translation_reflection'],
        description: 'Produce the image of a translation or reflection by dragging vertices.',
      },
      {
        evalMode: 'apply_rotation',
        affordances: { answers: ['manipulate'] },
        label: 'Rotate about the Origin (Tier 4)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['apply_rotation'],
        description: 'Rotate a figure 90°, 180°, or 270° about the origin.',
      },
      {
        evalMode: 'identify_transformation',
        affordances: { answers: ['tap'] },
        label: 'Identify the Transformation (Tier 4)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['identify_transformation'],
        description: 'Name the single transformation and its parameters from a pre-image and image.',
      },
      {
        evalMode: 'compose_sequence',
        label: 'Compose a Sequence (Tier 5)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['compose_sequence'],
        description: 'Reach a target image with a sequence of two or more transformations; argue congruence.',
      },
      {
        evalMode: 'dilation_similarity',
        affordances: { answers: ['manipulate'] },
        label: 'Dilations & Similarity (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['dilation_similarity'],
        description: 'Apply a scale factor about the origin; reason about similarity vs congruence.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-problem transformation session — the student slides, flips, turns, and scales polygons on a coordinate grid across several figures. Currently on {{challengeType}} problem {{currentChallengeIndex}} of {{totalChallenges}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'answerKind', 'transformLabel', 'isSimilarity', 'scaleFactor', 'supportTier', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Follow ONE corner of the pre-image. Where should it land after this transformation — does it slide, flip across a line, turn around the origin, or scale away from it?"',
        level2: '"Use the coordinate rule for {{transformLabel}}. Apply it to a single vertex first: write the new (x, y), then move that corner. Reflections swap or negate a coordinate; a 90° turn sends (x, y) to (−y, x); a dilation multiplies both coordinates by the scale factor."',
        level3: '"Go vertex by vertex. Take each pre-image point, apply the rule for {{transformLabel}} to get its image coordinates, and place that corner. I will set up the rule for the first corner; you finish the rest and check that the whole figure matches."',
      },
      commonStruggles: [
        { pattern: 'Reflects over the wrong axis (swaps which coordinate is negated)', response: 'Reflection over the x-axis negates y; over the y-axis negates x. Point at which axis is the mirror.' },
        { pattern: 'Confuses rotation direction (90° CW vs CCW)', response: 'A 90° counterclockwise turn about the origin sends (x, y) to (−y, x). Have them test it on one corner.' },
        { pattern: 'Calls a dilation congruent', response: 'A dilation changes size, so the image is similar, not congruent — only rigid motions preserve size.' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-PROBLEM PACING',
          instruction:
            'This is a {{totalChallenges}}-problem session. After each correct answer, the student clicks "Next Problem →". '
            + 'Encourage progression: "Nice — on to problem {{currentChallengeIndex}}!" '
            + 'After a wrong attempt, point at the specific vertex or rule that needs another look — '
            + 'do NOT re-explain the whole method from scratch.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'matrix-display',
    description: 'Multi-challenge matrix practice session (3-6 matrix problems of the same operation, surfaced sequentially). Per challenge, students see Matrix A (and Matrix B for binary operations), enter the result in editable cells (or a single number for determinant), and click "Check Answer" for immediate judgment. Wrong answers prompt hint / "Show steps" walkthrough; correct answers advance to the next matrix. Supports transpose, add, subtract, multiply (row-by-column), determinant (2×2 and 3×3), and inverse (2×2 with det = ±1 so entries stay integer). ESSENTIAL for grade 7-8 (intro to matrix arithmetic), Algebra 2 (operations + determinant), Precalculus (inverses + multiplication), and Linear Algebra (all operations).',
    constraints: 'Manifest must NOT supply specific matrix values, dimensions, or per-challenge content — the pool service builds 3-6 distinct challenges deterministically from the eval-mode operation and gradeBand. Manifest may supply gradeBand and instanceCount only. Per-mode shape constraints: transpose alternates 2×3/3×2; add/subtract uses 2×2 or 2×3 same-shape; multiply alternates 2×2 × 2×2 and 2×3 × 3×2; determinant uses 2×2 (grade 7-8) or 2×2/3×3 (algebra2+); inverse is always 2×2 with det ∈ {±1} so A⁻¹ entries are clean integers.',
    affordances: { representation: 'symbolic', answers: ['type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'transpose',
        label: 'Transpose (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['transpose'],
        description: 'Swap rows and columns — simplest matrix operation.',
      },
      {
        evalMode: 'add_subtract',
        label: 'Add/Subtract (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['add', 'subtract'],
        description: 'Element-wise addition and subtraction of same-dimension matrices.',
      },
      {
        evalMode: 'multiply',
        label: 'Multiply (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['multiply'],
        description: 'Row-by-column matrix multiplication.',
      },
      {
        evalMode: 'determinant_inverse',
        label: 'Determinant/Inverse (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['determinant', 'inverse'],
        description: 'Calculate determinant or find inverse of square matrices.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-matrix practice session. Operation: {{challengeType}}. Matrix {{currentChallengeIndex}} of {{totalChallenges}}.',
      contextKeys: ['title', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"What does {{challengeType}} do to a matrix? Describe the operation in your own words."',
        level2: '"For {{challengeType}}, walk through ONE entry at a time. Start with the top-left position."',
        level3: '"Use the formula directly: substitute the numbers from Matrix A (and Matrix B if there is one), then compute."',
      },
      commonStruggles: [
        { pattern: 'Wrong determinant formula', response: '"For a 2×2 [[a,b],[c,d]], det = ad − bc. Cross-multiply diagonals."' },
        { pattern: 'Matrix multiplication order', response: '"Row from A × column from B. Multiply corresponding entries and sum them."' },
        { pattern: 'Inverse confusion', response: '"For [[a,b],[c,d]] with det = d, A⁻¹ = (1/det) · [[d, −b], [−c, a]]. Swap the diagonal, negate the off-diagonal."' },
        { pattern: 'Transpose dimensions wrong', response: '"The transpose of an m×n matrix is n×m. Row i becomes column i."' },
      ],
      aiDirectives: [
        {
          title: 'OPERATION-AWARE COACHING',
          instruction:
            'For DETERMINANT: walk through the cross-multiplication pattern — "Multiply a×d, then subtract b×c." '
            + 'For MULTIPLICATION: guide row-by-column — "Take row 1 of matrix A and column 1 of matrix B. '
            + 'Multiply matching entries and add: (a₁₁×b₁₁) + (a₁₂×b₂₁)." '
            + 'For INVERSE: emphasize the swap-and-negate pattern — "Swap a and d, negate b and c, then divide by det." '
            + 'For TRANSPOSE: emphasize the shape change — "Each row becomes a column. A 2×3 becomes a 3×2."',
        },
        {
          title: 'MULTI-MATRIX PACING',
          instruction:
            'This is a {{totalChallenges}}-matrix session. After each correct answer, the student clicks "Next Matrix →". '
            + 'Encourage progression: "Nice — on to matrix {{currentChallengeIndex}}!" '
            + 'After a wrong attempt, point at the specific column or row that needs another look — '
            + 'do NOT just repeat the formula.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'dot-plot',
    description: 'Interactive dot plot (also called line plot) with stacked dots representing data values on a number line. Perfect for teaching data representation, frequency concepts, mean, median, mode, data distribution shape, and comparing datasets. Students click to add/remove data points, view frequency at each value, and calculate statistical measures. Supports parallel dot plots for comparing two datasets (e.g., morning vs afternoon temperatures). Stack styles include dots, X marks, or custom icons. ESSENTIAL for grades 2-3 (counting and data representation), grades 3-4 (frequency concepts), grades 5-6 (mean, median, mode), and grades 6-7 (data distribution, comparing datasets).',
    constraints: 'Requires number line range [min, max] and data points array. Data values should be within the range. For younger grades (2-3), use small whole numbers (0-10) and disable statistics. For grades 5+, enable showStatistics for mean/median/mode. For comparison activities, enable parallel mode with labeled datasets. Keep data size manageable: 8-20 values per dataset.',
    affordances: { representation: 'pictorial', role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'whole_number_plot',
        affordances: { answers: ['build'] },
        label: 'Whole Number Plot (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['whole_number_plot'],
        description: 'Plot a given whole-number dataset on a labeled line. CCSS 3.MD.B.4. Grades 2-3.',
      },
      {
        evalMode: 'measure_and_plot',
        affordances: { answers: ['build'] },
        label: 'Measure & Plot (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['measure_and_plot'],
        description: 'Measure objects with visual rulers, then plot the measurements. CCSS 3.MD.B.4. Grade 3.',
      },
      {
        evalMode: 'read_frequency',
        label: 'Read Frequency (Tier 2+)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['read_frequency'],
        description: 'Identify most / least frequent value from an existing dot plot. CCSS 3.MD.B.3. Grades 3-4.',
      },
      {
        evalMode: 'fractional_units',
        affordances: { answers: ['build'] },
        label: 'Fractional Units (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fractional_units'],
        description: 'Plot data with halves / quarters / eighths on a fractional number line. CCSS 3.MD.B.4, 5.MD.B.2. Grades 3-5.',
      },
      {
        evalMode: 'compute_stats',
        label: 'Compute Stats (Tier 3+)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['compute_stats'],
        description: 'Compute median / mode / range from a displayed dot plot. CCSS 6.SP.B. Grades 5-6.',
      },
      {
        evalMode: 'compare_datasets',
        label: 'Compare Datasets (Tier 4)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare_datasets'],
        description: 'Compare centers / spreads across two parallel dot plots. CCSS 7.SP.B. Grades 6-7.',
      },
    ],
    tutoring: {
      taskDescription: 'Explore data using a dot plot. Data points: {{dataCount}}. Statistics: {{showStatistics}}.',
      contextKeys: ['dataPoints', 'showStatistics', 'parallel', 'mean', 'median', 'mode'],
      scaffoldingLevels: {
        level1: '"Which value has the most dots stacked above it? That is the mode."',
        level2: '"To find the median, arrange all values in order and find the middle one."',
        level3: '"Mean = sum of all values ÷ number of values. Add all the numbers, then divide by {{dataCount}}."',
      },
      commonStruggles: [
        { pattern: 'Confusing mean and median', response: '"Mean = average (add all, divide by count). Median = middle value when sorted."' },
        { pattern: 'Ignoring frequency', response: '"If a value has 3 dots, it appears 3 times in the dataset. Count each dot."' },
        { pattern: 'Comparing datasets incorrectly', response: '"Compare the shapes and centers, not just individual values."' },
      ],
      aiDirectives: [
        {
          title: 'STATISTICAL THINKING COACHING',
          instruction:
            'Guide students to "read" the dot plot before calculating: '
            + '"What do you notice about the shape? Is the data bunched up or spread out?" '
            + 'For mode: "The tallest stack wins — that value appears most often." '
            + 'For median: "Line up all the values. Cross off one from each end until you reach the middle." '
            + 'For mean: "Add every value (remember each dot counts!), then divide by the total number of dots." '
            + 'For comparison (parallel plots): "Which dataset is more spread out? Which has a higher center?"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'histogram',
    description: 'Multi-histogram analysis session (3-6 distinct histograms of the same challenge type) for grades 6-8 statistics. Each challenge presents its own dataset with a real-world context (test scores, heights, temperatures, etc.) and a single mode-specific prompt: identify the distribution shape (symmetric, skewed, bimodal, uniform), find the modal bin, read a specific bin frequency, or estimate the mean/median from the visual. Pool-service generator: bin widths, datasets, and answer keys are built deterministically per mode. ESSENTIAL for 6.SP (statistical questions, shape & center), 7.SP (comparing populations from displays).',
    constraints: 'Multi-instance: a session walks the student through 3-6 challenges of the same eval mode, each with its own dataset, bin width, and prompt. The manifest MUST NOT supply specific data arrays, bin widths, bin starts, contexts, or answer keys — the generator builds every challenge deterministically from the eval mode + topic via the pool service. Stats panel is auto-hidden in estimate_center mode to prevent the student from reading the mean/median directly off the UI.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'identify_shape',
        affordances: { answers: ['tap'] },
        label: 'Identify Shape (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify_shape'],
        description: 'Pick the distribution shape (symmetric / right-skewed / left-skewed / bimodal / uniform) from a histogram. Visual recognition, no calculation. CCSS 6.SP.A.2. Grades 6-7.',
      },
      {
        evalMode: 'find_modal_bin',
        affordances: { answers: ['tap'] },
        label: 'Find Modal Bin (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['find_modal_bin'],
        description: 'Click the tallest bar to identify the bin range with the highest frequency. CCSS 6.SP.B.4. Grades 6-7.',
      },
      {
        evalMode: 'read_frequency',
        affordances: { answers: ['type'] },
        label: 'Read Frequency (Tier 2+)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['read_frequency'],
        description: 'Read the frequency (count) of a specific bin from a histogram. Numeric entry. CCSS 6.SP.B.4. Grades 6-8.',
      },
      {
        evalMode: 'estimate_center',
        affordances: { answers: ['type'] },
        label: 'Estimate Center (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['estimate_center'],
        description: 'Estimate the mean or median from a histogram visual. Stats panel is hidden so the answer is not given. Numeric entry with tolerance ±1 bin width. CCSS 6.SP.B.5, 7.SP.B. Grades 7-8.',
      },
    ],
    tutoring: {
      taskDescription: 'Work through {{totalChallenges}} histograms. Mode: {{challengeType}}. Currently on histogram {{currentChallengeIndex}} of {{totalChallenges}} — {{contextTitle}}. Prompt: {{prompt}}.',
      contextKeys: [
        'challengeType',
        'currentChallengeIndex',
        'totalChallenges',
        'contextTitle',
        'prompt',
        'xAxisLabel',
        'binWidth',
        'binStart',
        'attempts',
        'gradeBand',
      ],
      scaffoldingLevels: {
        level1: '"What is the overall shape of the histogram? Is it symmetric, skewed, or bimodal?"',
        level2: '"Which bin has the tallest bar? That is where most data values fall."',
        level3: '"The mean is the balance point. Find where the bars would balance like a seesaw."',
      },
      commonStruggles: [
        { pattern: 'Confusing histogram with bar chart', response: '"Histograms show ranges of continuous data (bins). Bar charts show separate categories."' },
        { pattern: 'Reading bin edges off-by-one', response: '"Each bar covers the range [start, end). The left edge is included; the right edge is not."' },
        { pattern: 'Misidentifying skewness', response: '"The tail tells the skew direction. Long tail on the right = right-skewed."' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-HISTOGRAM PACING',
          instruction:
            'Each session walks through {{totalChallenges}} distinct histograms. After each correct answer the next histogram appears with a fresh dataset and context. '
            + 'When introducing a new histogram, name the context ("Math quiz scores", "Heights of seventh graders") so the student grounds the data in something real. '
            + 'For identify_shape: start with the big picture — "Where are the bars tallest? Are the tails balanced?" '
            + 'For find_modal_bin: "Scan left to right. Which bar is the tallest? What range does that bar cover?" '
            + 'For read_frequency: "Find the bar covering that range. Count up the y-axis to read its height." '
            + 'For estimate_center: "The stats panel is hidden on purpose — use the bars themselves. The mean balances the histogram like a seesaw; the median splits the data into equal halves."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'two-way-table',
    description: 'Multi-challenge two-way table (contingency table) probability practice session (3-6 problems of the same probability concept, surfaced sequentially). Per challenge, students see a real-world scenario (pet preference by gender, sport by grade, transportation by distance, etc.), a frequency table, and a question — they enter a probability as a decimal and click "Check Answer" for immediate judgment. Wrong answers show a hint; correct answers advance to the next table. Supports joint probability, marginal distribution, conditional probability, and the independence test. Mode-specific UI gating: marginal/conditional modes hide row/column totals so the student must compute them; joint/independence modes show totals to support the calculation. ESSENTIAL for grade 7 (categorical data, joint probability), grade 7-Statistics (conditional probability), and Statistics courses (independence testing).',
    constraints: 'Manifest must NOT supply specific scenarios, categories, or per-challenge frequencies — the pool service builds 3-6 distinct contingency-table problems deterministically from the eval-mode concept. Manifest may supply instanceCount only. Per-mode shape: joint/independence modes use 2×2 frequency tables with totals visible; marginal/conditional modes use 2×2 tables with totals hidden to prevent answer leak.',
    affordances: { representation: 'symbolic', answers: ['type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'joint_probability',
        label: 'Joint probability (Tier 4)',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['joint_probability'],
        description: 'Compute P(A AND B) — joint cell divided by grand total. Totals visible.',
      },
      {
        evalMode: 'marginal_distribution',
        label: 'Marginal distribution (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['marginal_distribution'],
        description: 'Compute P(A) by summing across rows or columns. Totals hidden — must derive marginal sum.',
      },
      {
        evalMode: 'conditional_probability',
        label: 'Conditional probability (Tier 5)',
        beta: 5.0,
        scaffoldingMode: 5,
        challengeTypes: ['conditional_probability'],
        description: 'Compute P(A|B) — joint cell divided by B marginal. Totals hidden so student must derive the conditioning marginal.',
      },
      {
        evalMode: 'independence_test',
        label: 'Independence test (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['independence_test'],
        description: 'Compute expected joint under independence: P(A) × P(B). Compare to observed P(A∩B). Totals visible.',
      },
    ],
    tutoring: {
      taskDescription: 'Multi-table probability session. Concept: {{challengeType}}. Table {{currentChallengeIndex}} of {{totalChallenges}}.',
      contextKeys: ['title', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"What two categories does each cell represent? Look at the row and column headers."',
        level2: '"For joint, divide the cell by the grand total. For conditional, divide the cell by ONLY the row or column total of the condition."',
        level3: '"P(A and B) = joint count ÷ grand total. P(A|B) = joint count ÷ B total. P(A)·P(B) = (row total ÷ N) × (column total ÷ N)."',
      },
      commonStruggles: [
        { pattern: 'Confusing joint and marginal', response: '"Joint = inside the table (both categories). Marginal = totals on the edges (one category)."' },
        { pattern: 'Conditional probability errors', response: '"Given B means you only look at column B. Divide the cell by the column total, not the grand total."' },
        { pattern: 'Independence misconception', response: '"Independent means P(A and B) = P(A) × P(B). Multiply the marginal probabilities and compare to the joint."' },
        { pattern: 'Decimal vs percentage confusion', response: '"Both work — 0.25 and 25% are the same answer. Just be sure the decimal matches the fraction you computed."' },
      ],
      aiDirectives: [
        {
          title: 'CONCEPT-AWARE COACHING',
          instruction:
            'For JOINT: start with the cell, then divide by grand total — "Which cell has BOTH the row category AND the column category? Now divide by the total people." '
            + 'For MARGINAL: walk through summing a row or column FIRST — "Add the counts across that row to get the marginal, THEN divide by the grand total." '
            + 'For CONDITIONAL: narrow the focus physically — "Given B, we only look at column B. Divide the cell by THAT column total, not the grand total." '
            + 'For INDEPENDENCE: use the expected-vs-observed frame — "If these were independent, P(A∩B) would equal P(A) × P(B). Compute P(A)·P(B) and we will compare."',
        },
        {
          title: 'MULTI-PROBABILITY PACING',
          instruction:
            'This is a {{totalChallenges}}-table session. After each correct answer, the student clicks "Next Table →". Encourage progression: "Nice — on to table {{currentChallengeIndex}}!" After a wrong attempt, point at the specific cell or total that needs another look — do NOT just repeat the formula.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  // Math Phase 2 Primitives (K-5 Foundations)
  {
    id: 'ten-frame',
    description: 'Live tutor-judged 2×5 grid manipulative for K-2 number sense (DI modality). The Live tutor asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. What the child produces depends on the skill: they SAY the answer out loud for subitizing (counters flash, then hide — say how many you saw), for make-ten at grades 1-2 (how many more fill the frame), and for addition and subtraction on the frame; they answer WITH THEIR HANDS for building a number (place exactly N counters) and for make-ten at Kindergarten (tap the empty cells until the frame is full), where placing the counters IS the skill. Supports single frame (1-10) and double frame (1-20). The most foundational manipulative for early number sense. ESSENTIAL for grades K-2 number sense, subitizing, make-ten strategy, addition, and subtraction.',
    constraints: 'Best for grades K-2. Requires a microphone: spoken answers are judged by the Live tutor and there is no Check button and no typed or stepper answer anywhere. Single frame for K, double frame for grades 1-2. Every spoken answer is a number word from 1 to 20 — challenges whose answer would be 0 (an empty frame, a subtraction down to nothing) or above 20 are discarded before the child sees them.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'build'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'build',
        affordances: { answers: ['build'] },
        label: 'Build (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Place exactly N counters on the frame; the tutor judges the placement. Concrete manipulative — lowest cognitive load.',
      },
      {
        evalMode: 'subitize',
        affordances: { representation: 'pictorial', answers: ['spoken'] },
        label: 'Subitize (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['subitize'],
        description: 'Counters flash and hide; the child says how many they saw. Pictorial recognition — one layer of abstraction above concrete.',
      },
      {
        evalMode: 'make_ten',
        affordances: { answers: ['build', 'spoken'] },
        label: 'Make Ten (Strategy)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['make_ten'],
        description: 'Find the complement to 10 — enacted on the frame at Kindergarten, said aloud at grades 1-2. Strategic decomposition — student must self-organize approach.',
      },
      {
        evalMode: 'operate',
        affordances: { answers: ['spoken'] },
        label: 'Operate (Symbolic)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['add', 'subtract'],
        description: 'Addition and subtraction worked on the frame, with the sum or difference said aloud. Transitional symbolic — bridging concrete and abstract.',
      },
    ],
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription: 'LIVE-JUDGED ten frame practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or WITH THEIR HANDS on the frame, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never count aloud for the child and never name any part of the answer.',
        level2: 'Remind the child of the method in one short sentence — "Look at the frame and think about how many" — without saying any number.',
        level3: 'Invite one try together: "Take your time. Look at the frame. Then tell me." Still never say the answer.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Counts the counters aloud on a flash item', response: 'The scripted correction handles this AFTER the attempt is judged: it re-models looking at the whole group, then re-asks. Never interrupt mid-attempt.' },
        { pattern: 'Says the total instead of how many more', response: 'The scripted correction re-models the number bond and re-elicits. Speak only that line.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER',
          instruction:
            'On spoken items the answer is ONE number word from 1 to 20 and nothing else — never a digit read as a string of words, never a sentence you supply. '
            + 'The cue for each item names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right. Judge by that cue and nothing else. '
            + 'THE LAW: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'HAND ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers with their hands on the frame, say nothing at all while they work — no counting, no narration, no encouragement mid-placement. '
            + 'You will be told what they placed and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never count along, and never prompt while the child is working. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'SHOW-AGAIN ON DEMAND',
          instruction:
            'The child can ask to see the flash again. That re-asks the QUESTION only — speak the scripted line you are given and never describe or count what flashed.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'counting-board',
    description: 'Live tutor-judged Pre-K to Grade 1 counting workspace (DI modality) with tappable objects (bears, apples, stars, fish, butterflies, blocks) in varied arrangements (scattered, line, groups, circle). The child counts by tapping and ANSWERS OUT LOUD: the Live tutor asks with scripted lines, judges the spoken number word from the audio in-band, corrects DISTAR-style, and its own affirmation advances the lesson. Modes: pre-numeric perceptual subitizing (Pre-K, tap the matching hand — fully number-free), count-all (tap each object, say how many), flash subitizing (K: objects flash then hide; say how many you saw), count-on (start from a known group), group counting (count by 2s/5s/10s), and compare (say how many in the group with more). Builds one-to-one correspondence, cardinality principle, and subitizing fluency from pre-numeric perception upward. ESSENTIAL for Pre-K through Grade 1 counting, number sense, and early addition foundations.',
    constraints: 'Best for grades Pre-K to 1. Pre-K: perceptual subitize 1-3 objects with hand answers (no numerals anywhere in the item). K: count 1-20 objects, count_all and subitize. Grade 1: count to 30, count-on and group counting. Answers are spoken number words (or a hand tap at Pre-K) judged by the microphone-enabled Lumina tutor; there is no Check button and no typed answer.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'subitize_perceptual',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Subitize (Pre-Numeric)',
        beta: 0.5,
        scaffoldingMode: 1,
        challengeTypes: ['subitize_perceptual'],
        description: 'Flash 1-3 objects. Student selects matching hand image (no numerals). Pre-K perceptual subitizing.',
      },
      {
        evalMode: 'count',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Count All (Concrete)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['count_all'],
        description: 'Tap each object one by one. Concrete 1:1 correspondence — lowest cognitive load.',
      },
      {
        evalMode: 'subitize',
        affordances: { representation: 'pictorial', answers: ['spoken'] },
        label: 'Subitize (Perceptual)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['subitize'],
        description: 'Quickly recognize quantity without counting. Perceptual recognition of small groups.',
      },
      {
        evalMode: 'group',
        affordances: { answers: ['spoken'] },
        label: 'Group Count (Pictorial)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['group_count'],
        description: 'Count objects in groups of 2s, 5s, or 10s. Pictorial grouping strategy.',
      },
      {
        evalMode: 'count_on',
        affordances: { answers: ['spoken'] },
        label: 'Count On (Reduced Prompts)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['count_on'],
        description: 'Start from a known count and continue. Reduced scaffolding — student self-organizes.',
      },
      {
        evalMode: 'compare',
        affordances: { answers: ['spoken'] },
        label: 'Compare (Reduced Prompts)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Determine which group has more. Comparative reasoning with reduced prompts.',
      },
    ],
    audioInput: { manual_activity: true },
    tutoring: {
      // ANSWER-FREE STATE BLOCK (di-math-facts rule, ten-frame/number-bond
      // precedent). This clause used to read "The correct count for the current
      // board: {{targetCount}}" — the graded spoken answer, standing in the
      // state block for the whole item. The per-turn judging contract inside
      // each cue already names the answer where it is needed, and this copy was
      // the exact text the model was caught NARRATING to a child (19h-i-a). It
      // also contradicted the PRE-NUMERIC directive below, which forbids the
      // tutor any number word, in the same assembled prompt.
      taskDescription: 'LIVE-JUDGED counting practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD (or taps a hand on pre-numeric items), you judge what you HEARD, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. Objects on the board: {{objectType}}. What is on the board right now: {{stimulus}}. Every cue you receive carries the answer for that turn — nothing outside the cue does, and you never state the count on your own.',
      contextKeys: ['challengeType', 'objectType', 'stimulus'],
      // ON A JUDGED LOOP THE CORRECTION *IS* THE SCAFFOLD — there is no third
      // reply channel. These three rungs used to be bare lines ("Touch each one
      // just one time as you count."), and the 2026-08-15 cap drill caught the
      // model speaking level 2 and level 3 VERBATIM on corrections 2 and 3.
      // Neither opens with a sentinel, so the loop recorded no verdict twice
      // and the counter froze with the child still waiting (`di-no-verdict`
      // ×2). Same content, routed through the branch that carries a sentinel.
      scaffoldingLevels: {
        level1: 'Speak the current item\'s scripted correction line, exactly as the cue gives it. It already re-models the count and re-asks — that IS the first scaffold, and it opens with "My turn:" so the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a reminder of the method or any other wording: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all and the lesson stalls.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further — the activity moves the lesson on by itself and carries the next ask to you.',
      },
      commonStruggles: [
        { pattern: 'Double-counts or skips objects while tapping', response: 'The scripted correction re-models the count AFTER the attempt is judged. Never interrupt a child mid-count.' },
        { pattern: 'Long silence', response: 'Silence is the child counting — wait. If they truly seem stuck, re-speak the current ask once; never count for them.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'THE CHILD IS COUNTING — WAIT',
          instruction:
            'Think time is unbounded. Never count along, never prompt mid-count, never fill silence. '
            + 'Counting aloud that ends on the correct number IS a correct answer — the last number said tells the total.',
        },
        {
          title: 'PRE-NUMERIC ITEMS ARE NUMBER-FREE',
          instruction:
            'On subitize_perceptual items say no number word and no digit at any point. The child answers by tapping a hand; '
            + 'you wait in silence and speak only the scripted verdict lines.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    supportsEvaluation: true,
  },
    {
      id: 'comparison-builder',
      misconceptionScope: 'primitive',
    description: 'Multi-phase comparison activity with four challenge types: compare groups of objects visually, compare written numerals with inequality symbols, order numbers least-to-greatest or greatest-to-least, and identify one more / one less. Features animated correspondence lines and alligator mouth mnemonic for < and >. Perfect for teaching quantity comparison and number ordering. ESSENTIAL for K-1 math.',
    constraints: 'Supports numbers 1-20. Groups contain up to 10 objects. Order challenges use 3-5 numbers. Object types: bears, apples, stars, blocks, fish, butterflies, hearts, flowers, cookies, balls.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      // taskDescription is flat — no {{#if}} handlebars. interpolate_template does
      // key substitution only, so conditional blocks render as literal junk in the
      // prompt. The specific counts/numbers/target already appear in RUNTIME STATE.
      taskDescription: 'Student is comparing quantities and numbers. Challenge type: {{challengeType}}. Instruction on screen: {{instruction}}. Attempt: {{attemptNumber}}. See RUNTIME STATE for the exact counts, numbers, or target for this challenge.',
      contextKeys: ['challengeType', 'leftCount', 'rightCount', 'leftNumber', 'rightNumber', 'correctAnswer', 'targetNumber', 'askFor', 'gradeBand', 'useAlligatorMnemonic', 'instruction', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Which group looks like it has more? Can you tell just by looking?"',
        // No {{#if}} handlebars (they render literally). The mnemonic line is
        // always safe to offer; it only bites for compare-numbers.
        level2: '"Count each group carefully, then tell me which side has more. Remember: the alligator always opens its mouth toward the bigger number."',
        // ANSWER-FREE: never interpolate {{correctAnswer}} into a spoken line —
        // this is a script the tutor reads to the child. Coach the counting
        // strategy instead of naming which side wins.
        level3: '"Let\'s count together. Point to each one on the left and count out loud: 1, 2, 3... now do the same on the right. Whichever side you said a bigger number for is the side with more."',
      },
      commonStruggles: [
        { pattern: 'Student confuses < and > symbols', response: 'Use the alligator mnemonic: the alligator mouth always opens toward the bigger number because it wants to eat more!' },
        { pattern: 'Student cannot compare groups without counting', response: 'Encourage one-to-one matching: "Try pointing to one on the left and one on the right. Match them up. Which side has leftovers?"' },
        { pattern: 'Student reverses ascending/descending order', response: 'Clarify the direction: "Least to greatest means we start with the smallest number. Which is the smallest here?"' },
        { pattern: 'Student confuses one-more with one-less', response: 'Use the number line: "If we go forward one step from the target, what do we land on? That is one more."' },
      ],
      // ORIENT + DISAMBIGUATE beat. The live K failure (2026-07-13) was the tutor
      // greeting warmly but never READING the on-screen question or NAMING the
      // specific comparison — the child (a non-reader) never learned what to decide.
      // aiDirectives render into the standalone system prompt AND the lesson
      // [PRIMITIVE SWITCH]/greeting injection, so this survives the "one sentence"
      // transition cap that drops a soft component sendText clause.
      aiDirectives: [
        {
          title: 'READ THE QUESTION ALOUD AND ASK THE SPECIFIC COMPARISON — the student is a K–1 child who cannot read',
          instruction:
            'The student CANNOT read the instruction on screen — you are their voice. '
            + 'Whenever a new challenge begins (a [PRIMITIVE SWITCH], [ACTIVITY_START], or [NEXT_ITEM]), your FIRST action is to '
            + 'say, in one warm child-friendly sentence, exactly what to do — and NAME the specific choice so the child knows what they are deciding. '
            + 'Match the wording to the challenge type ({{challengeType}}): '
            + 'compare-groups → "Which side has MORE — the left side or the right side? Tap that side. If they are the same, tap the equals in the middle."; '
            + 'compare-numbers → "Which number is bigger, {{leftNumber}} or {{rightNumber}}? Tap the bigger number. If they are the same, tap the equals sign in the middle." (a reader who sees alligator mouths can pick the mouth that eats the bigger number instead); '
            + 'one-more-one-less → we start at {{targetNumber}}, and you voice EVERY question the screen shows (askFor: {{askFor}}), giving "one less" exactly the same attention as "one more": '
            + 'if it asks for one more, say "Find the number that is one MORE than {{targetNumber}} and tap it."; if it asks for one less, say "Find the number that is one LESS than {{targetNumber}} and tap it."; '
            + 'if it asks for BOTH, voice both asks equally — "Find one MORE than {{targetNumber}}, and also find one LESS than {{targetNumber}} — tap a number for each." Never skip or shortchange the "one less" side; '
            + 'order → "Let\'s put these numbers in order. Which one is the smallest? Tap it first." '
            + 'Reading and asking the question IS your greeting for this activity — this overrides any instruction to keep the transition to a single sentence. '
            + 'Never just say "let\'s compare!" and stop, and NEVER say which side or which answer is correct — only ask the question. Then wait for the child to act.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'compare_groups',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Compare Groups (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare-groups'],
        description: 'Visual group comparison',
      },
      {
        evalMode: 'one_more_less',
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'One More / One Less (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['one-more-one-less'],
        description: 'Adjacent number reasoning',
      },
      {
        evalMode: 'compare_numbers',
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'Compare Numbers (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare-numbers'],
        description: 'Symbolic comparison (>, <, =)',
      },
      {
        evalMode: 'order',
        affordances: { representation: 'symbolic', answers: ['manipulate', 'tap'] },
        label: 'Order (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['order'],
        description: 'Order multiple values',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'pattern-builder',
    description: 'Interactive pattern recognition, extension, and creation for K-3 algebraic thinking. Students build, extend, identify cores, translate, and create repeating patterns (AB, AAB, ABC), growing patterns (1,3,5,7), and number patterns. Supports color tokens, shape tokens, and numbers. Progressive phases: Copy → Identify → Create → Translate. Connects pattern skills to skip counting, multiplication foundations, and early algebra. ESSENTIAL for grades K-3 algebraic thinking, pattern recognition, and early algebra foundations.',
    constraints: 'Best for grades K-3. K-1: repeating patterns with colors/shapes only (AB, AAB, ABB). Grades 2-3: growing and number patterns, translation and creation challenges.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'build'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Student is working through {{totalChallenges}} pattern challenges (currently {{currentChallengeIndex}}). Pattern type: {{patternType}}. Challenge: {{instruction}}. Given sequence: {{givenSequence}}. Core unit: {{coreUnit}}. Rule: {{rule}}. Student extension: {{studentExtension}}. Attempt: {{attemptNumber}}.',
      contextKeys: ['patternType', 'instruction', 'givenSequence', 'hiddenSequence', 'coreUnit', 'rule', 'challengeType', 'attemptNumber', 'currentPhase', 'studentExtension', 'studentCreation', 'currentChallengeIndex', 'totalChallenges', 'supportTier', 'tutorRevealPolicy'],
      scaffoldingLevels: {
        level1: '"Look at the pattern: {{givenSequence}}. Can you see what repeats? What comes next?"',
        level2: '"Let me help. The repeating part is: {{coreUnit}}. Now that you know the core, what should come next?"',
        level3: '"The pattern rule is: {{rule}}. Each time, the core {{coreUnit}} repeats. So the next tokens are the beginning of the core again!"',
      },
      commonStruggles: [
        { pattern: 'Cannot identify repeating core', response: '"Let\'s look together. Start from the beginning: {{givenSequence}}. Where does the pattern start over? That\'s your core!"' },
        { pattern: 'Growing pattern confusion', response: '"Look at the numbers: {{givenSequence}}. What do you add to each number to get the next one? That\'s the rule!"' },
        { pattern: 'Translation difficulty', response: '"The pattern structure is the same! If red→circle and blue→square, then red-blue-red-blue becomes circle-square-circle-square."' },
      ],
      aiDirectives: [
        {
          title: 'PATTERN COACHING APPROACH',
          instruction:
            'Use warm, encouraging language. For K-1, focus on visual pattern recognition: "I see red, blue, red, blue... what do you think comes next?" '
            + 'For grades 2-3, connect to math: "Your pattern goes 2, 4, 6, 8... that\'s counting by 2s!" '
            + 'Celebrate pattern creation: "You made your own pattern! Can you describe its rule?" '
            + 'Guide core identification: "Can you find the part that keeps repeating?" '
            + 'For translations, emphasize structural similarity: "Same pattern, different look!"',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'extend',
        affordances: { answers: ['build'] },
        label: 'Extend (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['extend'],
        description: 'Continue a given pattern.',
      },
      {
        evalMode: 'identify_core',
        affordances: { answers: ['tap'] },
        label: 'Identify Core (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['identify_core'],
        description: 'Find the repeating unit.',
      },
      {
        evalMode: 'translate',
        affordances: { answers: ['build'] },
        label: 'Translate (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['translate'],
        description: 'Transform pattern to a different representation.',
      },
      {
        evalMode: 'create',
        affordances: { answers: ['build'] },
        label: 'Create (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['create'],
        description: 'Generate a pattern from a rule.',
      },
      {
        evalMode: 'find_rule',
        affordances: { answers: ['tap'] },
        label: 'Find Rule (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['find_rule'],
        description: 'Discover the underlying rule.',
      },
    ],
  },
  {
    id: 'skip-counting-runner',
    description: 'Rhythmic skip counting with animated number line jumps for grades 1-3. A character (frog, kangaroo, rabbit, rocket) jumps along a number line in equal leaps, landing on multiples. Students count along, predict landing spots, identify skip values, fill missing numbers, and connect to multiplication facts. Parallel array visualization links skip counting to multiplication. Supports forward and backward counting. ESSENTIAL for grades 1-3 skip counting, multiplication foundations, and number pattern recognition.',
    constraints: 'Best for grades 1-3. Grades 1-2: skip by 2s, 5s, 10s, forward only, count_along and predict challenges. Grades 2-3: skip by 3s, 4s, backward counting, multiplication connections.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 4 },
    evalModes: [
      {
        evalMode: 'count_along',
        affordances: { answers: ['tap'] },
        label: 'Count Along (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count_along'],
        description: 'Follow a skip-count sequence with visual support.',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['type'] },
        label: 'Predict (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Anticipate the next value in a skip-count sequence.',
      },
      {
        evalMode: 'fill_missing',
        affordances: { answers: ['type'] },
        label: 'Fill Missing (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fill_missing'],
        description: 'Complete missing terms in a skip-count sequence.',
      },
      {
        evalMode: 'find_skip_value',
        affordances: { answers: ['type'] },
        label: 'Find Skip Value (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_skip_value'],
        description: 'Discover the skip interval from a displayed sequence.',
      },
      {
        evalMode: 'connect_multiplication',
        affordances: { answers: ['type'] },
        label: 'Connect Multiplication (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['connect_multiplication'],
        description: 'Link skip counting to multiplication facts.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is skip counting by {{skipValue}}s. Direction: {{direction}}. Current position: {{currentPosition}}. Jump count: {{jumpCount}}. Challenge: {{instruction}}. Challenge type: {{challengeType}}. Attempt: {{attemptNumber}}. Current streak: {{currentStreak}}.',
      contextKeys: ['skipValue', 'direction', 'currentPosition', 'jumpCount', 'instruction', 'challengeType', 'attemptNumber', 'currentPhase', 'currentStreak', 'landingSpots', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Let\'s count together by {{skipValue}}s: {{landingSpots}}... what comes next?"',
        level2: '"You\'re at {{currentPosition}}. Add {{skipValue}} more. What is {{currentPosition}} + {{skipValue}}?"',
        level3: '"You made {{jumpCount}} jumps of {{skipValue}}. That\'s {{jumpCount}} × {{skipValue}} = {{currentPosition}}! Skip counting IS multiplication!"',
      },
      commonStruggles: [
        { pattern: 'Losing count rhythm', response: '"Let\'s slow down. Start from the beginning: {{landingSpots}}. Say each number as the character lands!"' },
        { pattern: 'Prediction errors', response: '"Think about adding {{skipValue}} to {{currentPosition}}. Use your fingers if you need to!"' },
        { pattern: 'Not seeing multiplication connection', response: '"Count the jumps: {{jumpCount}}. Each jump is {{skipValue}}. So {{jumpCount}} groups of {{skipValue}} = {{currentPosition}}. That\'s multiplication!"' },
      ],
      aiDirectives: [
        {
          title: 'RHYTHMIC COUNTING APPROACH',
          instruction:
            'Count along rhythmically with the student: "5... 10... 15... 20!" '
            + 'Use a playful, rhythmic cadence. Celebrate streaks: "3 in a row! You\'re on fire!" '
            + 'Connect to multiplication naturally: "4 jumps of 5 is 4 times 5. That\'s 20!" '
            + 'For digit patterns: "Look at the ones digits when counting by 5s: 5, 0, 5, 0... see the pattern?" '
            + 'For backward counting: "Now let\'s go backwards! Countdown: 20... 15... 10..."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'hundreds-chart',
    description: 'Interactive number grid (10 numbers per row) for counting and skip-counting pattern discovery. The grid ceiling follows the lesson: a "counting to 10" lesson renders a 1-10 board and counting IN ORDER (by 1s), while an unbounded skip-counting lesson renders the full 1-100 chart. Students highlight sequences, complete partially shown patterns, identify visual column/row/diagonal relationships, and determine skip intervals. Connects number grid topology to multiplication foundations. Good for K counting-to-10/20 and ESSENTIAL for grades 1-3 skip counting, pattern recognition, and place value understanding.',
    constraints: 'K: counting in order on a small board (1-10, 1-20), highlight mode. Grades 1-2: skip by 2s, 5s, 10s, highlight and complete modes. Grades 2-3: skip by 3s, 4s, identify and find_skip_value modes. State the ceiling in the topic or intent ("to 10", "within 50") — the grid sizes itself to it and defaults to 1-100 when the lesson names none. Skip intervals too coarse for a small board are dropped automatically.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'highlight_sequence',
        label: 'Highlight Sequence (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['highlight_sequence'],
        description: 'Highlight all cells in a skip-count pattern.',
      },
      {
        evalMode: 'complete_sequence',
        label: 'Complete Sequence (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['complete_sequence'],
        description: 'Complete a partially highlighted skip-count sequence.',
      },
      {
        evalMode: 'identify_pattern',
        // Sentence options ("Every other cell in each row") — a text-only answer
        // surface with no read-aloud; the child decodes alone (reader-fit PRE 2026-09-05).
        affordances: { reader: 'developing' },
        label: 'Identify Pattern (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify_pattern'],
        description: 'Describe the visual pattern formed on the grid.',
      },
      {
        evalMode: 'find_skip_value',
        label: 'Find Skip Value (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_skip_value'],
        description: 'Determine the skip interval from highlighted cells.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is working with a hundreds chart. Challenge type: {{challengeType}}. Instruction: {{instruction}}. Skip value: {{skipValue}}. Start number: {{startNumber}}. Given cells: {{givenCells}}. Attempt: {{attemptNumber}}. Cells selected so far: {{selectedCount}}.',
      contextKeys: ['challengeType', 'instruction', 'skipValue', 'startNumber', 'givenCells', 'attemptNumber', 'currentPhase', 'selectedCount'],
      scaffoldingLevels: {
        level1: '"Look at the chart. Can you see which numbers are highlighted? What do they have in common?"',
        level2: '"The pattern skips by {{skipValue}}. Start at {{startNumber}} and count by {{skipValue}}s: {{startNumber}}, then add {{skipValue}}..."',
        level3: '"Let me help: starting at {{startNumber}}, count by {{skipValue}}s. Look at the column — numbers that end in the same digit are in the same column. The pattern goes: {{startNumber}}, {{startNumber}} + {{skipValue}}, {{startNumber}} + {{skipValue}} + {{skipValue}}..."',
      },
      commonStruggles: [
        { pattern: 'Missing cells in highlight sequence', response: '"Count carefully by {{skipValue}}s from {{startNumber}}. Say each number out loud as you click it: {{startNumber}}, then add {{skipValue}}..."' },
        { pattern: 'Clicking wrong cells in complete sequence', response: '"Look at the numbers already highlighted. What is the difference between each one? That tells you the skip value!"' },
        { pattern: 'Cannot identify the visual pattern', response: '"Look at where the highlighted cells sit. Are they in the same column (vertical line)? The same row? Or do they make a diagonal? Columns mean the ones digit stays the same!"' },
        { pattern: 'Wrong skip value guess', response: '"Pick any two highlighted numbers next to each other. Subtract the smaller from the bigger — that difference IS the skip value!"' },
      ],
      // ORIENT beat (reader-fit PRE 2026-09-05): K lessons open counting-to-10
      // objectives on this board, and the child cannot read the instruction.
      // aiDirectives render into the standalone prompt AND the lesson greeting /
      // [PRIMITIVE SWITCH] injection, so the beat survives the one-sentence cap
      // that drops a component sendText clause alone.
      aiDirectives: [
        {
          title: 'SAY THE INSTRUCTION — THE STUDENT MAY NOT BE ABLE TO READ IT',
          instruction:
            'At the start of the activity ([PRIMITIVE SWITCH] or [ACTIVITY_START]) and on every [NEXT_ITEM], your FIRST action is to say the current instruction out loud in child terms: "{{instruction}}". '
            + 'On a small board (numbers to 10 or 20) the task is counting in order: "Tap 1, then 2, then 3, all the way to the end." '
            + 'Saying the instruction IS your greeting for this activity and overrides any one-sentence cap. Never tell the student to read the screen.',
        },
        {
          title: 'HUNDREDS CHART COACHING',
          instruction:
            'Connect grid position to place value: "Numbers in the same column end in the same digit!" '
            + 'For skip counting: "Let\'s count together: 5, 10, 15, 20... see how they make a pattern on the chart?" '
            + 'Highlight spatial patterns: "Counting by 10s goes straight down — same column!" '
            + 'For Grade 1: keep to 2s, 5s, 10s. For Grade 2-3: introduce 3s, 4s, and diagonals. '
            + 'Celebrate pattern discovery: "You found it! Counting by 5s makes two columns — the 5s and the 0s!"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'regrouping-workbench',
    description: 'Interactive addition and subtraction with regrouping (carrying and borrowing) for grades 1-4. Split view: base-ten blocks workspace (ones cubes, tens rods, hundreds flats) alongside the written algorithm. Students tap to trade 10 ones for 1 ten (carry) or break 1 ten into 10 ones (borrow). The blocks and algorithm update in parallel. Progressive phases from exploration to solving. Supports word problem contexts. ESSENTIAL for grades 1-4 multi-digit addition, subtraction, regrouping, and standard algorithm understanding.',
    constraints: 'Best for grades 1-4. Grades 1-2: two-digit problems with one regroup, addition focus. Grades 3-4: three-digit problems with multiple regroups, addition and subtraction. Supports add_no_regroup, subtract_no_regroup, add_regroup, and subtract_regroup challenge types.',
    affordances: { representation: ['concrete', 'symbolic'], answers: ['manipulate', 'type'], role: 'apply', minutes: 6 },
    evalModes: [
      {
        evalMode: 'add_no_regroup',
        label: 'Add Without Regrouping (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['add_no_regroup'],
        description: 'Addition problems where no carrying is needed. Builds confidence with the algorithm.',
      },
      {
        evalMode: 'subtract_no_regroup',
        label: 'Subtract Without Regrouping (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['subtract_no_regroup'],
        description: 'Subtraction problems where no borrowing is needed.',
      },
      {
        evalMode: 'add_regroup',
        label: 'Add With Regrouping (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['add_regroup'],
        description: 'Addition problems that require carrying (ones sum to 10+).',
      },
      {
        evalMode: 'subtract_regroup',
        label: 'Subtract With Regrouping (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['subtract_regroup'],
        description: 'Subtraction problems that require borrowing.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is solving {{instruction}} using base-ten blocks and the written algorithm. Operation: {{operation}}. Current blocks: {{blocks}}. Carries: {{carries}}. Phase: {{currentPhase}}. Requires regrouping: {{requiresRegrouping}}. Attempt: {{attemptNumber}}.',
      contextKeys: ['operation', 'instruction', 'blocks', 'carries', 'currentPhase', 'requiresRegrouping', 'attemptNumber', 'correctAnswer', 'wordProblem', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Start with the ones column. What do you get when you add those digits?"',
        level2: '"You have {{blocks}} in the ones place. That is more than 9! What can you trade 10 ones for?"',
        level3: '"10 ones = 1 ten. Trade them! See how the 1 appears above the tens column in the algorithm? That is carrying!"',
      },
      commonStruggles: [
        { pattern: 'Forgetting to carry/borrow', response: '"Check the ones column again. You got a number bigger than 9. You need to carry that extra ten!"' },
        { pattern: 'Subtracting smaller from larger in wrong direction', response: '"In subtraction, you subtract the bottom from the top. If the top digit is smaller, you need to borrow first!"' },
        { pattern: 'Not connecting blocks to algorithm', response: '"See how the blocks match the numbers? When you trade 10 ones for a ten, that is the same as carrying a 1 to the tens column!"' },
      ],
      aiDirectives: [
        {
          title: 'REGROUPING COACHING APPROACH',
          instruction:
            'Guide the critical "aha" moment when the student discovers why regrouping is needed. '
            + 'For addition: "7 + 5 = 12. Can 12 fit in the ones place? No! Time to trade 10 ones for 1 ten." '
            + 'For subtraction: "Can you take 7 from 2? No! You need to borrow a ten to help." '
            + 'Always connect blocks to algorithm: "See how the carry/borrow in the written problem matches what you did with the blocks?" '
            + 'Celebrate each successful regroup: "Great trade! 10 ones became 1 ten!"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'multiplication-explorer',
    description: 'Multi-representation multiplication workspace connecting equal groups, arrays, repeated addition, number line jumps, and area model — all synchronized to the same fact. Students progress through 4 phases: build groups → build arrays → connect all 5 representations → use strategies (distributive property, fact families). Includes commutative property toggle, missing-factor challenges, and fluency quiz mode. ESSENTIAL for grades 2-4 multiplication introduction, fact fluency, and multiplicative thinking.',
    constraints: 'Best for single-digit × single-digit facts (grades 2-3) or multi-digit × single-digit (grade 4). Factors should be reasonable for visual display (≤12 for arrays, ≤50 product for number line). Supports build, connect, commutative, distributive, missing_factor, and fluency challenge types.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'build',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Build (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Construct equal groups or arrays for the given fact.',
      },
      {
        evalMode: 'connect',
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap'] },
        label: 'Connect (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['connect'],
        description: 'Link multiple representations of the same fact.',
      },
      {
        evalMode: 'commutative',
        label: 'Commutative (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['commutative'],
        description: 'Apply the commutative property to multiplication facts.',
      },
      {
        evalMode: 'distributive',
        label: 'Distributive (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['distributive'],
        description: 'Break apart harder facts using the distributive property.',
      },
      {
        evalMode: 'missing_factor',
        affordances: { answers: ['type'] },
        label: 'Missing Factor (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['missing_factor'],
        description: 'Solve for an unknown factor given the product.',
      },
      {
        evalMode: 'fluency',
        affordances: { answers: ['type'] },
        label: 'Fluency (Tier 6)',
        beta: 6.5,
        scaffoldingMode: 6,
        challengeTypes: ['fluency'],
        description: 'Rapid fact recall under time pressure.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring multiplication through multiple representations. Fact: {{fact}}. Phase: {{currentPhase}}. Challenge: {{instruction}}. Challenge type: {{challengeType}}. Attempt: {{attemptsCount}}. Score: {{factsCorrect}}/{{factsTotal}}.',
      contextKeys: ['fact', 'currentPhase', 'challengeIndex', 'challengeType', 'instruction', 'flipped', 'attemptsCount', 'factsCorrect', 'factsTotal', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the groups. How many groups are there? How many in each group?"',
        level2: '"You have {{fact}}. Can you see it as an array too? Same number of rows as groups, same number of columns as items per group."',
        level3: '"All 5 pictures show the same fact! {{fact}}. Groups, array, addition, number line, and area — they all equal the same product."',
      },
      commonStruggles: [
        { pattern: 'Confusing groups and items per group', response: '"The first number tells you HOW MANY groups. The second tells you HOW MANY IN EACH group."' },
        { pattern: 'Not connecting representations', response: '"3 groups of 4 and a 3×4 array are the same thing! Count them — same total both ways."' },
        { pattern: 'Difficulty with commutative property', response: '"Flip the array sideways. 3 rows of 4 becomes 4 rows of 3. Count them — still 12!"' },
        { pattern: 'Struggling with distributive property', response: '"Don\'t know 7×8? Break it up: 5×8=40 and 2×8=16. Add them: 40+16=56! Easier, right?"' },
        { pattern: 'Missing factor confusion', response: '"If you know 4 × ? = 20, think: how many groups of 4 make 20? Count by 4s: 4, 8, 12, 16, 20 — that\'s 5 groups!"' },
      ],
      aiDirectives: [
        {
          title: 'REPRESENTATION BRIDGING',
          instruction:
            'When the student explores different tabs, help them see the CONNECTION between representations. '
            + '"You showed 3 groups of 4. Now look at the array — 3 rows with 4 in each row. Same thing!" '
            + 'In the Connect phase, point out how all 5 panels show the same total. '
            + 'In the Strategy phase, celebrate the distributive property as a "trick": "You broke a hard fact into easy ones!"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'measurement-tools',
    description: 'Multi-shape ruler measurement session (3-6 distinct shapes of the same challenge type). Pool-service pattern: the generator picks the mode and unit, the component supplies the shapes deterministically from per-mode width pools. Students walk through each shape sequentially, dragging it onto a ruler and reading the measurement. Modes: measure (whole units, grades 1-3), compare (measure all, then order shortest-to-longest, grades 2-3), estimate (half-inch precision between tick marks, grades 2-3), convert (measure then convert between inches and centimeters, grades 3-4). ESSENTIAL for grades 1-5 measurement and data standards.',
    constraints: 'Ruler-based length measurement session. The manifest must NOT supply specific shape widths, colors, labels, or hints — those are built deterministically from the in-generator pool service. Grades 1-2 use whole-number precision; grades 3-5 add half precision and unit conversion.',
    affordances: { representation: 'pictorial', answers: ['manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Multi-shape measurement session. Mode: {{challengeType}}. Shape {{currentChallengeIndex}} of {{totalChallenges}}: {{currentShape}} (width: {{shapeWidth}} {{unit}}). On ruler: {{isOnRuler}}. Precision: {{precision}}.',
      contextKeys: ['challengeType', 'currentChallengeIndex', 'totalChallenges', 'currentShape', 'shapeWidth', 'unit', 'precision', 'isOnRuler'],
      scaffoldingLevels: {
        level1: '"Count the marks on the ruler starting from 0. Each mark is one unit. How many marks does the shape cover?"',
        level2: '"Look where the right edge of the shape ends on the ruler. What number is it pointing to?"',
        level3: '"Drag the shape so its left edge lines up with 0. Now look at the right edge — it lands on {{shapeWidth}}. That means the shape is {{shapeWidth}} {{unit}} long."',
      },
      commonStruggles: [
        { pattern: 'Counting from 1 instead of 0', response: '"Remember, the ruler starts at 0, not 1. Line up the left edge of the shape with the 0 mark, then count from there."' },
        { pattern: 'Not aligning shape to the edge of the ruler', response: '"Make sure to drag the shape so its left side touches the 0 mark on the ruler. That gives you an accurate reading."' },
        { pattern: 'Reading between marks incorrectly', response: '"Look at where the shape ends between two marks. Count the small lines between the numbers — each small line is one step. Is the edge closer to the lower mark or the higher one?"' },
      ],
      aiDirectives: [
        {
          title: 'DRAG-TO-RULER MEASUREMENT COACHING',
          instruction:
            'Guide students through the drag-to-ruler interaction step by step. '
            + 'First, encourage them to drag the shape onto the ruler: "Grab the shape and slide it onto the ruler." '
            + 'Then, teach alignment: "Line up the left edge with the 0 mark." '
            + 'Finally, teach reading: "Now look where the right edge ends — that number is your measurement."',
        },
        {
          title: 'RULER READING REINFORCEMENT',
          instruction:
            'Reinforce that measurement means finding how many units fit along the object. '
            + 'For whole numbers: "Count the spaces between 0 and where the shape ends." '
            + 'For fractional precision: "Look at the small marks between the numbers. If there are 2 marks between each number, each mark is a half."',
        },
        {
          title: 'MULTI-SHAPE PACING',
          instruction:
            'This is a session of {{totalChallenges}} distinct shapes, not a single measurement. '
            + 'Keep coaching tight per shape: introduce, prompt for the measurement, react to feedback, then transition to the next shape. '
            + 'Track which shape number you are on ({{currentChallengeIndex}} of {{totalChallenges}}) so reminders stay accurate.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'measure',
        label: 'Measure (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['measure'],
        description: 'Direct measurement with ruler.',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['compare'],
        description: 'Measure and compare objects.',
      },
      {
        evalMode: 'estimate',
        label: 'Estimate (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['estimate'],
        description: 'Measure with half-inch precision, reading between marks.',
      },
      {
        evalMode: 'convert',
        affordances: { representation: 'symbolic', answers: ['manipulate', 'type'] },
        label: 'Convert (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['convert'],
        description: 'Measure and convert between units.',
      },
    ],
  },
  {
    id: 'shape-builder',
    description: 'Interactive geometry workspace for constructing shapes on dot/coordinate grids, measuring properties with ruler/protractor tools, classifying shapes into categories, composing/decomposing shapes, and finding lines of symmetry. Supports build, discover, classify, compose, decompose, and symmetry modes. Perfect for teaching shape construction, property discovery, classification hierarchies, and spatial reasoning. ESSENTIAL for K-5 geometry.',
    constraints: 'Requires challenges array with progressive difficulty. Grid-based workspace (dot or coordinate). Supports modes: build, discover, classify, compose, decompose, symmetry.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'build',
        affordances: { representation: 'concrete', answers: ['manipulate'] },
        label: 'Build (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Construct a shape matching given properties.',
      },
      {
        evalMode: 'measure',
        label: 'Measure (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['measure'],
        description: 'Find side lengths and angles of a given shape.',
      },
      {
        evalMode: 'classify_by_lines',
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'Classify by Lines (Tier 2.5)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['classify_by_lines'],
        description: 'Classify shapes by parallel and perpendicular line relationships (CCSS 4.G.1, 4.G.2).',
      },
      {
        evalMode: 'classify',
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'Classify (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['classify'],
        description: 'Identify shape properties to sort into categories.',
      },
      {
        evalMode: 'compose',
        affordances: { representation: 'concrete', answers: ['manipulate'] },
        label: 'Compose (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compose'],
        description: 'Combine shapes using pattern blocks.',
      },
      {
        evalMode: 'find_symmetry',
        label: 'Find Symmetry (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['find_symmetry'],
        description: 'Analyze and draw lines of symmetry.',
      },
      {
        evalMode: 'coordinate_shape',
        affordances: { representation: 'symbolic', answers: ['manipulate'] },
        label: 'Coordinate Shape (Tier 6)',
        beta: 6.5,
        scaffoldingMode: 6,
        challengeTypes: ['coordinate_shape'],
        description: 'Build shapes by plotting vertices on a coordinate plane.',
      },
    ],
    tutoring: {
      taskDescription: 'Complete geometry challenges in {{mode}} mode on a {{grid.type}} grid. Current challenge: "{{challenges[0].instruction}}".',
      contextKeys: ['mode', 'gradeBand', 'targetShape', 'challenges', 'tools', 'classificationCategories'],
      scaffoldingLevels: {
        level1: '"Look at the shape carefully. How many sides does it have? How many corners?"',
        level2: '"Count the sides one by one. Now check — are any sides the same length? Do any angles look like the corner of a book (right angles)?"',
        level3: '"This shape has {{targetShape.properties.sides}} sides. To build it, place {{targetShape.properties.sides}} points on the grid, then click the first point again to close it. For a rectangle, make sure you have 4 right angles."',
      },
      commonStruggles: [
        { pattern: 'Student cannot close the shape (keeps adding vertices)', response: '"To finish your shape, click on the very first point you placed — the yellow one! That will connect your last side."' },
        { pattern: 'Student builds wrong number of sides', response: '"Count your corners — each corner is where two sides meet. You need exactly {{targetShape.properties.sides}} corners for this shape."' },
        { pattern: 'Student confuses shape names in classification', response: '"Let\'s look at the properties: count the sides first, then check for right angles and parallel sides. That will tell us the shape\'s name."' },
        { pattern: 'Student cannot find lines of symmetry', response: '"Imagine folding the shape in half. Where could you fold it so both halves match perfectly? Try drawing a line through the middle."' },
      ],
      aiDirectives: [
        {
          title: 'MODE-AWARE GEOMETRY COACHING',
          instruction:
            'In BUILD mode: guide construction step-by-step — "Place your first point, then your second. How many more do you need?" '
            + 'In DISCOVER mode: let the student explore properties first — "Measure this side, then that side. What do you notice?" '
            + 'In CLASSIFY mode: guide by properties, not just name — "Does it have 4 sides? Are they all equal? Are all angles right angles? Then it is a square!" '
            + 'In COMPOSE mode: "Can you put these two triangles together to make a rectangle?" '
            + 'In DECOMPOSE mode: "Can you cut this hexagon into triangles?" '
            + 'In SYMMETRY mode: "Try folding along this line — do both halves match perfectly?"',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For K-1: use informal language — "pointy corners," "straight sides," "same size." Focus on counting sides and sorting. '
            + 'For grades 2-3: introduce formal names — "vertex," "edge," "right angle." Use the "corner of a book" test for right angles. '
            + 'For grades 4-5: use full classification vocabulary — "parallel sides," "congruent," "perpendicular." '
            + 'Guide hierarchical thinking: "A square IS a rectangle — it just has all sides equal too!"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'number-sequencer',
    description: 'Interactive number sequencing with 5 challenge types: fill-missing (complete number sequences with blanks), before-after (identify numbers before/after a given number), order-cards (arrange shuffled numbers in order), count-from (continue counting forward/backward from a starting number), and decade-fill (fill missing numbers across decade boundaries in a local number window). Uses a "number train" visual metaphor. Perfect for building sequential number understanding. ESSENTIAL for K-1 math.',
    constraints: 'K: 1-20 range. Grade 1: broad practice defaults to 1-100 and may extend through 120 only when the objective/topic/intent requires it. Pinned single or blended eval modes must emit only their catalog challenge types; unpinned mixed sessions may combine all five.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['type', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'count_from',
        affordances: { answers: ['type'] },
        label: 'Count From (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count-from'],
        description: 'Continue counting forward or backward from a given value.',
      },
      {
        evalMode: 'before_after',
        affordances: { answers: ['type'] },
        label: 'Before/After (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['before-after'],
        description: 'Identify numbers immediately before or after a given number.',
      },
      {
        evalMode: 'order_cards',
        affordances: { answers: ['tap'] },
        label: 'Order Cards (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order-cards'],
        description: 'Arrange a set of shuffled numbers in correct order.',
      },
      {
        evalMode: 'fill_missing',
        affordances: { answers: ['type'] },
        label: 'Fill Missing (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['fill-missing'],
        description: 'Complete gaps in a number sequence pattern.',
      },
      {
        evalMode: 'decade_fill',
        affordances: { answers: ['type'] },
        label: 'Decade Fill (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['decade-fill'],
        description: 'Fill missing numbers across decade boundaries.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is working on number sequence challenges. Current challenge type is {{challengeType}}: {{instruction}}. The sequence is {{sequence}} and student must provide {{correctAnswers}}. Direction: {{direction}}.',
      contextKeys: ['challengeType', 'sequence', 'correctAnswers', 'direction', 'attemptNumber', 'startNumber', 'rangeMin', 'rangeMax', 'instruction'],
      scaffoldingLevels: {
        level1: '"Say the numbers in order out loud. What number comes next in the pattern?"',
        level2: '"Count from {{rangeMin}}: what comes after {{startNumber}}? Try saying the numbers: ..., __, ..."',
        level3: '"Let me help you count. After 7 comes 8, and after 8 comes 9. Now look at the pattern: what number fits in the blank?"',
      },
      commonStruggles: [
        { pattern: 'Student skips numbers when counting (e.g., 5, 6, 8)', response: 'Slow down and count with the student. Touch each number as you say it together. "Let\'s count slowly: 5... 6... what comes next?"' },
        { pattern: 'Student reverses number order (e.g., puts 9 before 7)', response: 'Use the number line reference. "Which number is smaller? Smaller numbers go first when we count up."' },
        { pattern: 'Student struggles with decade transitions (e.g., 29 to 30)', response: 'Highlight the pattern: "When we finish counting 21, 22... 29, the next group of ten starts. After twenty-nine comes thirty!"' },
        { pattern: 'Student confuses before and after', response: 'Use physical direction: "Before means the number that comes first when counting. After means the number that comes next. When you count 5, 6, 7 — 6 comes AFTER 5 and BEFORE 7."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'number-bond',
    description: 'Live tutor-judged number bond practice (DI modality) on the classic circle-and-branch part-part-whole diagram. The Live tutor asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. What the child produces depends on the skill: they SAY the missing part OUT LOUD (missing-part, both grades); they answer WITH THEIR HANDS by splitting counters into the two part circles to find every pair (decompose — one judged turn per pair), by writing all four fact-family equations (fact-family), and by building a number sentence from tiles (build-equation) — in those three, constructing it IS the skill. Perfect for K-1 addition/subtraction fluency. ESSENTIAL for Kindergarten and Grade 1 number decomposition.',
    constraints: 'Max number 5 for Kindergarten, 10 for Grade 1, so every spoken answer is a number word from 1 to 9. Requires a microphone: the missing-part answer is spoken and judged by the Live tutor, and there is no Check button, no stepper and no typed number answer anywhere. Kindergarten uses decompose and missing-part only; fact-family and build-equation are Grade 1. Known parts are never 0 and never the whole.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'build', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED number bond practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or WITH THEIR HANDS on the bond, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ No level of this ladder may OFFER a speakable line of its own. The
      // first number-bond cap drill (2026-08-14) proved why: on the SECOND
      // wrong answer the model balked at repeating the byte-identical scripted
      // correction (18c) and recited level2/level3's quoted hints instead —
      // lines that open with neither sentinel, so the engine saw no verdict
      // and the correction counter stalled. The ladder now commands script
      // fidelity; it never supplies an alternative.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never count aloud for the child and never name any part of the answer.',
        level2: 'A wrong answer is never met with a hint of your own — speak the cue\'s scripted "My turn:" correction again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction line re-models and re-asks for you. Never invent encouragement, a new question, or a softer hint.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Says the whole instead of the missing part', response: 'The scripted correction handles this AFTER the attempt is judged: it models counting up from the known part and re-asks. Never interrupt mid-attempt.' },
        { pattern: 'The same wrong answer comes twice in a row', response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.' },
        { pattern: 'Repeats a pair already found', response: 'The verdict cue you are handed names the repeated pair and asks for a new one. Speak only that line.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants. '
            + 'On a SPOKEN item (missing-part) the answer is ONE number word from 1 to 9 and nothing else. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'On a HANDS item (decompose; fact-family; build-equation) the child answers by changing what is on the screen, and you are told what they made and whether it matches. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'HAND ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers with their hands, say nothing at all while they work — no counting, no narration, no encouragement mid-build. '
            + 'You will be told what they made and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never count along, and never prompt while the child is working. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again. That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'decompose',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Decompose (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['decompose'],
        // β HELD — the same split-the-counters construction, one pair at a
        // time, exactly as the Submit Pair loop paced it; it merely gained a
        // judge (and a stillness close instead of a button).
        description: 'Break the whole into parts by splitting counters into the two circles — one judged turn per pair until every way is found. Concrete manipulative.',
      },
      {
        evalMode: 'missing_part',
        affordances: { answers: ['spoken'] },
        label: 'Missing Part (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['missing-part'],
        // β HELD on the ASS solve-story precedent: a −/+ stepper over 0..max
        // became unaided speech — a structural change, but the stepper was a
        // WEAK menu (every numeral in range, no chosen distractors), so the
        // guess floor it removed is small, and β is per MODE.
        description: 'Find the unknown part and SAY it out loud — the tutor judges the spoken number. Unaided spoken production; no stepper and no menu.',
      },
      {
        evalMode: 'fact_family',
        affordances: { representation: 'symbolic', answers: ['type'] },
        label: 'Fact Family (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fact-family'],
        // β HELD — the written surface is untouched (the same four boxes);
        // only the Check button became a stillness close.
        description: 'Write all 4 related equations in the boxes; the tutor judges the written family. Symbolic FORM is the skill, so the answer is written, not spoken. Grade 1.',
      },
      {
        evalMode: 'build_equation',
        affordances: { representation: 'symbolic', answers: ['build'] },
        label: 'Build Equation (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['build-equation'],
        // β HELD — the same tile tray and the same three checks; only the
        // Check button is gone.
        description: 'Construct a number sentence from tiles; the tutor judges the assembled sentence. Any valid form over the bond\'s three numbers is accepted. Grade 1.',
      },
    ],
  },
  {
    id: 'addition-subtraction-scene',
    description: 'Live tutor-judged K-1 addition and subtraction story scenes (DI modality). The Live tutor reads the story aloud, asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. What the child produces depends on the skill: they SAY the number OUT LOUD to solve a word problem (both grades) and to report how many there are now, or how many are left, after acting a story out at Grade 1; they answer WITH THEIR HANDS by acting the story out on the scene at Kindergarten (bring more in, send some away), by building the number sentence from tiles, and by making the scene that matches a given number sentence — in those three, constructing it IS the skill. Supports join, separate, compare, and part-part-whole story types. The bridge from manipulatives to symbolic math. ESSENTIAL for Kindergarten and Grade 1 addition and subtraction.',
    constraints: 'Best for Kindergarten and Grade 1. Requires a microphone: spoken answers are judged by the Live tutor and there is no Check button, no typed answer and no numeral menu anywhere. Numbers limited to maxNumber (5 for K, 10 for Grade 1), so every spoken answer is a number word from 1 to 20. Four challenge types: act-out, build-equation, solve-story, create-story; story contexts must match the scene theme. Stories are read aloud, so a story that states the number the child must find — or whose answer would be 0 — is discarded before the child ever sees it.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'manipulate', 'build'], role: 'apply', minutes: 6 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED addition and subtraction story practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or WITH THEIR HANDS on the scene, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
      // ON A JUDGED LOOP THE CORRECTION *IS* THE SCAFFOLD — there is no third
      // reply channel. The 2026-08-15 cap drill caught the model speaking level
      // 2 and level 3 VERBATIM on corrections 2 and 3 ("…think about what
      // happened in the story", "Take your time. Look at the picture. Then tell
      // me."). Neither opens with a sentinel, so the loop recorded no verdict
      // twice and the counter froze (`di-no-verdict` x2, 19h-i-f, 2nd port).
      // Same content, routed through the branch that carries a sentinel.
        level1: 'Speak the current item\'s scripted correction line, exactly as the cue gives it. It already re-models the story and re-asks — that IS the first scaffold, and it opens with "My turn:" so the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a reminder of the method or any other wording: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all and the lesson stalls.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further — the activity moves the lesson on by itself and carries the next story to you.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Says a number the story already gave', response: 'The scripted correction handles this AFTER the attempt is judged: it re-models the story and re-asks. Never interrupt mid-attempt.' },
        { pattern: 'Confuses joining with taking away', response: 'The scripted correction names the story direction and re-elicits. Speak only that line.' },
      ],
      // R1 (the STIMULUS beat) is RE-BASED, not dropped. It used to be a
      // directive telling the tutor to read {{storyText}} before improvising —
      // necessary when the tutor authored its own turns, and droppable for the
      // same reason. Under the judged loop the story is INSIDE the quoted line
      // of every cue this pack emits, including every correction, so reading it
      // aloud is no longer a rule the tutor might forget: it is the only thing
      // the tutor is given to say. The directive below now defends that line
      // against summarising rather than commanding a first action.
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the story and the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'THE STORY IS INSIDE THE SCRIPTED LINE — SAY IT AS WRITTEN',
          instruction:
            'The child CANNOT read the screen — you are their voice, and the story IS the whole problem. '
            + 'It is already inside the quoted line of every cue, including every correction, so it gets read aloud '
            + 'word for word each time you speak that line. Never summarise it, never shorten it, never replace it '
            + 'with a bare greeting, and never add a sentence of your own to it.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants. '
            + 'On a SPOKEN item (solve-story at either grade; act-out at Grade 1) the answer is ONE number word from 1 to 20 and nothing else. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'On a HANDS item (act-out at Kindergarten; build-equation; create-story) the child answers by changing what is on the screen, and you are told what they made and whether it matches. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'HAND ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers with their hands, say nothing at all while they work — no counting, no narration, no encouragement mid-build. '
            + 'You will be told what they made and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never count along, and never prompt while the child is working. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-STORY ON DEMAND',
          instruction:
            'The child can ask to hear the story again. That re-speaks the STORY and the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'act_out',
        affordances: { answers: ['manipulate'] },
        label: 'Act Out (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['act-out'],
        // β HELD. At Kindergarten this mode is unchanged — enacting the story
        // was already the answer, and it merely gained a judge. At Grade 1 the
        // enactment is unchanged too and only the REPORT moved from a keyboard
        // to the mouth; the modality changed, the production demand did not.
        description: 'Act the story out on the scene: bring objects in, send objects away. Kindergarten answers with the enacted scene itself; Grade 1 enacts and then says the count out loud. Concrete manipulative — lowest cognitive load.',
      },
      {
        evalMode: 'build_equation',
        affordances: { representation: 'symbolic', answers: ['build'] },
        label: 'Build Equation (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build-equation'],
        // β HELD — the answer surface is untouched (the same tile tray, the same
        // three checks), only the Check button is gone.
        description: 'Represent the story as a number sentence built from tiles; the tutor judges the assembled sentence. Symbolic FORM is the skill, so the answer is written, not spoken.',
      },
      {
        evalMode: 'solve_story',
        affordances: { answers: ['spoken'] },
        label: 'Solve Story (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['solve-story'],
        // β HELD, and this is the one worth recording. At Grade 1 nothing
        // changed (typed numeral → spoken numeral, same production). At K a
        // 0…max numeral row became unaided speech, which IS a structural change
        // — but β is per MODE, not per band, and raising it would misprice every
        // Grade-1 item to reprice the K half. The K menu was also a weak one
        // (all numerals in range, no chosen distractors), so the guess floor it
        // removed is smaller than the letter-spotter menu that moved 1.5 → 2.0.
        description: 'Solve a word problem and SAY the answer out loud. The unknown may be the result, the change, or the start (AXIS 2). Unaided spoken production at both grades — no numeral menu and no keyboard.',
      },
      {
        evalMode: 'create_story',
        affordances: { answers: ['manipulate'] },
        label: 'Create Story (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['create-story'],
        // β HELD. Kindergarten's build task already carried this β and is
        // unchanged. Grade 1's scene+object picker is DELETED: it accepted any
        // selection as correct, so it could not produce a wrong answer and had
        // nothing for a judge to do. Grade 1 now does the same construction —
        // that raises what the mode MEASURES from nothing to something, which is
        // a validity fix, not a difficulty change.
        description: 'Represent a given number sentence as a story by BUILDING the scene — a production task, not writing. The child places and removes objects until the picture matches the equation, and the tutor judges what they made. Pre-reader capable at both grades.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'ordinal-line',
    misconceptionScope: 'primitive',
    description: 'Live tutor-judged ordinal positions (DI modality) on a line of characters in a race, parade, lunch line, train or bookshelf. The Live tutor names which end is the FRONT, asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. What the child produces depends on the skill and the grade: at Kindergarten they SAY THE NAME of the one in the place the tutor asks for, and at Grade 1 the tutor names a character and they SAY ITS PLACE (identify — one eval mode, band-split, because naming the place is the harder rung and is the vocabulary the standard is about); they READ ONE PLACE SYMBOL ALOUD, one card at a time (match); they SAY THE NAME of the one right before or right after a marked place (relative-position); they LISTEN to a spoken story and SAY the place one character has in it (sequence-story); and they answer WITH THEIR HANDS by putting pictures into places from spoken clues (build-sequence) — there the arrangement IS the answer. Builds the ordinal vocabulary first through tenth by SAYING it. ESSENTIAL for Kindergarten and Grade 1 number sense.',
    constraints: 'Best for grades K-1. Requires a microphone: four of the five answers are spoken and judged by the Live tutor, and there is no Check button, no Next button, no multiple-choice row, no matching grid and no tap-on-the-line anywhere. Positions run 1-10 so every spoken place word is a single benched word (first..tenth); maxPosition 5 for Kindergarten, up to 10 for Grade 1, and a line shorter than 3 has no ordinal work in it. Character names are read aloud and said back, so they must be plain sayable names, tellable apart by ear, and must never contain a position or a number — a character called First-Place Freddie or Number Three answers the question out loud. Story challenges are HEARD, not read: at most 5 characters, under 60 words, no quotation marks. Build challenges give at most 4 spoken clues, which is what a child can hold from speech. A challenge whose answer key disagrees with its target position, whose printed word and printed symbol are different ordinals, or whose clues leave a gap in the line is discarded before the child ever sees it.',
    // reader: 'none' at the primitive level — every mode but `match` is spoken/hands (no Check,
    // no multiple-choice row, no tap-on-the-line, per constraints above); `match` alone requires
    // reading a printed ordinal symbol aloud ("READ ONE PLACE SYMBOL ALOUD"), so it is overridden
    // to 'emerging' below. No dedicated qa/reader-fit PRE file for this primitive.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED ordinal position practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or WITH THEIR HANDS on the screen, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ 18d, applied at BIRTH: no level of this ladder may OFFER a speakable
      // line of its own. A quoted hint here is a sanctioned-sounding
      // replacement for the scripted correction at exactly the moment 18c makes
      // the model want one — it opens with neither sentinel, so the engine sees
      // no verdict and the correction counter stalls. The ladder commands script
      // fidelity; it never supplies an alternative. The click-era ladder here
      // was a three-rung reveal that ended by counting the answer out for the
      // child, which is now the CORRECTION's job and must never be improvised
      // on top of it.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never count the line aloud and never name any part of the answer.',
        level2: 'A wrong answer is never met with a hint of your own — speak the scripted "My turn:" correction from the cue again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction line counts the line from the front and re-asks for you. Never invent encouragement, a new question, a softer hint, or a counting walk of your own.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child looking and counting — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Counts from the wrong end of the line and names the mirror-image one', response: 'This is the mistake the activity is for, and the scripted correction handles it AFTER the attempt is judged: it counts from the front and re-asks. Speak only that line, and never interrupt mid-count.' },
        { pattern: 'Says the counting number instead of the place word (three for third)', response: 'That says how many, not which one, so it is WRONG however close it sounds: speak the scripted "My turn:" correction, which is where the difference between the two words gets taught.' },
        { pattern: 'Names the character the question POINTS AT instead of its neighbour', response: 'That is the anchor, not the answer, so it is wrong: speak the scripted correction, which counts to the anchor and then names the one beside it.' },
        { pattern: 'Answers with a pointing word instead of a name (that one, the next one)', response: 'That does not answer the question, so it is wrong: speak the scripted correction, which asks for the name again.' },
        { pattern: 'Counts out loud on the way to a place (first, second, third)', response: 'That is the child working, not answering. Only the word they FINISH on is their answer — judge that, and count a correct landing as correct.' },
        { pattern: 'The same wrong answer comes twice in a row', response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it. '
            + 'In particular, never count the line out loud before the first ask and never say which end is which beyond what the cue says.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE AND BY GRADE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants — this activity asks for two different kinds and you must never assume which. '
            + 'On identify the answer is EITHER one character name OR one place word, and the cue says which: at Kindergarten the child names the one in the place you asked for, at Grade 1 you name a character and the child says its place. '
            + 'On match the answer is the PLACE WORD the card shows — first, second, third and so on. '
            + 'On relative-position the answer is ONE character name, and a pointing word with no name does not answer the question. '
            + 'On sequence-story the answer is the PLACE WORD one character has in the story you just read. '
            + 'Wherever the answer is a place word, the plain counting number said on its own — three for third — is WRONG, not close: it says how many rather than which one, and that is the confusion this activity exists to undo. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'On a HANDS item (build-sequence) the child answers by putting the pictures into places, and you are told what line they made and whether it matches. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'An affirmation is the WHOLE turn. After it, stop speaking — never carry on into another question, another place, or the next item, '
            + 'even one you can see on the screen. The next ask always arrives as its own cue, and a question you ask early is about the wrong place.',
        },
        {
          title: 'NEVER COUNT THE LINE ALOUD',
          instruction:
            'Counting the characters from the front is the one thing this activity trains, so it belongs to the child. '
            + 'Never count out loud during their turn, never read the place labels off the screen, and never say how many are in the line. '
            + 'The scripted correction counts it with them, and that is the only time it is ever said.',
        },
        {
          title: 'BUILDING ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers with their hands, say nothing at all while they work — no counting, no narration, no naming which picture goes where. '
            + 'You will be told what line they made and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never count for them, and never prompt while the child is looking at the line. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again. That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer. On a story item that means reading the whole story again, because it is never printed.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        // β HELD. The tap became speech, but the answer SET did not change size:
        // the line is on screen either way, so a child guessing an animal has the
        // same 1-in-N floor a child tapping one had. What changed is that the
        // vocabulary now leaves the child's mouth, which is what the mode's own
        // label always claimed and is not a difficulty tier.
        description: 'BAND-SPLIT, one eval mode. Kindergarten: the tutor names a place and the child SAYS THE NAME of who is there. Grade 1: the tutor names a character and the child SAYS ITS PLACE — first through tenth, the ordinal vocabulary this mode is named for. Spoken production judged by the Live tutor; nothing on the line is tappable.',
      },
      {
        evalMode: 'match',
        affordances: { representation: 'symbolic', reader: 'emerging', answers: ['spoken'] },
        label: 'Match (Scaffold 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['match'],
        // β RAISED 2.5 → 3.0 — a real STRUCTURAL change, not a channel swap.
        // The word column is deleted, so there is no longer a menu of place
        // words to match a symbol against; the child must read the symbol and
        // PRODUCE the word. The click-era column also CONSUMED its entries, so
        // the last pair of every grid had one option left and needed no reading
        // at all — that guess floor is gone with it. One judged ask per symbol,
        // so a correct response now costs one unaided read rather than a
        // process of elimination across a grid.
        description: 'Read a place symbol OUT LOUD, one card at a time — 3rd says "third". Unaided production: there is no word column to match against and no grid, so nothing can be reached by elimination.',
      },
      {
        evalMode: 'relative_position',
        label: 'Relative Position (Scaffold 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['relative-position'],
        // β RAISED 3.5 → 4.0 on the story-talk / letter-spotter precedent: a
        // 1-of-4 MENU was deleted outright, so the guess floor went with it and
        // the child must produce the name unaided. The marked reference place
        // survives as the support-tier lever it always was, withdrawn at hard.
        description: 'SAY THE NAME of the one right before or right after a marked place. Spoken production judged by the Live tutor; the multiple-choice names are deleted.',
      },
      {
        evalMode: 'sequence_story',
        label: 'Sequence Story (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['sequence-story'],
        // β HELD, and the mode's IDENTITY is what actually changed. It used to
        // be the same drag-into-slots interaction as build_sequence with the
        // clues written as prose — two eval modes measuring one interaction. It
        // is a LISTENING task now: the tutor reads the story, nothing prints,
        // and the child says a place. The demand moved channel rather than
        // level — narrower ask, no text to re-read — so the tier stands.
        description: 'LISTEN to a spoken story about who is where, then SAY the place one character has in it. The story is never printed — a pre-reader could not use it and a reader who re-reads it is not listening — and tap-to-hear reads the whole story again. Applying ordinals in context, by ear.',
      },
      {
        evalMode: 'build_sequence',
        affordances: { answers: ['manipulate'] },
        label: 'Build Sequence (Scaffold 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['build-sequence'],
        // β HELD — the same put-them-in-places surface; only the Check button
        // became a stillness close, and a part-filled line now commits (and is
        // corrected) where it used to be refused with a nudge. The clues are
        // SPOKEN rather than printed, which is why at most four of them ship.
        description: 'Put the pictures into their places from clues the tutor SAYS — at most four, which is what a child can hold from speech. The arrangement IS the answer, so this one is answered with hands; the tutor judges the committed line.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'sorting-station',
    misconceptionScope: 'primitive',
    description: 'Live tutor-judged sorting and classifying (DI modality) on picture cards and labelled trays. The Live tutor asks with scripted lines ONE OBJECT AT A TIME, judges the child in-band, and its own affirmation advances the lesson — a challenge is no longer a screenful of objects committed at once, it is a sequence of single judged questions. Every answer is SPOKEN: the child says which group a thing belongs with (sort-by-one, sort-variety), says HOW the set should be sorted (sort-by-attribute), says which card does not belong (odd-one-out), says HOW MANY are in a group (count-and-compare, tally-record), says which group has more, and says YES or NO to whether one thing matches two criteria at once (two-attributes). Covers objective-relevant semantic categories (needs/wants, roles, living/nonliving, kinds) and visible attributes when those attributes are the taught concept. ESSENTIAL for Kindergarten and Grade 1 math and concept classification.',
    constraints: 'Best for K-1. Requires a microphone: EVERY answer is spoken and judged by the Live tutor, and there is no Check button, no drag-to-bin, no attribute buttons, no number steppers and no odd-one-out tap anywhere. The objective category must remain the main modality across challenges; vary objects, not the taught sorting rule. Use color/size/shape as the primary axis only when the objective explicitly teaches it. Objects should be familiar and their names sayable in one or two words. Objects per challenge: 4-6 at Kindergarten, 5-8 at Grade 1. Bins: max 3 at Kindergarten, max 4 at Grade 1. Group counts run 1-20 so every spoken count is a single word, and a group that would be EMPTY is not asked (zero has no benched spoken form). A challenge whose tray labels cannot be told apart by ear, whose object IS one of the tray labels, or whose yes/no set has only one reachable verdict is discarded before the child ever sees it. BAND FLOOR (unchanged by the spoken port — moving it needs a reader-fit re-audit, not a catalog edit): at Kindergarten route only sort_one and odd_one_out. sort_attribute, sort_variety, count_compare, two_attributes and tally_record remain Grade 1+.',
    // reader: 'none' — READY @ PRE for sort_one and odd_one_out after the --fix loop
    // (qa/reader-fit/sorting-station-PRE-2026-07-15.md); the other five modes carry a
    // Grade 1+ band floor stated in their own eval-mode descriptions. The verdict predates
    // the DI port, which only REMOVED demand from the child's path (every answer is now
    // spoken; no Check button, drag-to-bin, attribute buttons or steppers survive), and the
    // mode descriptions record that the port left the band floors unchanged. The re-audit
    // WORKSTREAMS still owes this primitive is about the ported surface, not the reading axis.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED sorting practice (DI modality): you ask with scripted lines sent as cues, ONE object or ONE group at a time, the child answers OUT LOUD, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ 18d, applied at BIRTH: no level of this ladder may OFFER a speakable
      // line of its own. A quoted hint here is a sanctioned-sounding replacement
      // for the scripted correction at exactly the moment 18c makes the model
      // want one — it opens with neither sentinel, so the engine sees no verdict
      // and the correction counter stalls. The ladder commands script fidelity;
      // it never supplies an alternative. The click-era ladder here was the
      // worst offender in the catalog: its level 3 scripted a whole sorting
      // dialogue ("Pick up this object — say what it is…"), which is now the
      // activity's own default interaction and must never be improvised on top.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never name a group for the object in question and never say any part of the answer.',
        level2: 'A wrong answer is never met with a hint of your own — speak the cue\'s scripted "My turn:" correction again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction line names the fact and re-asks for you. Never invent encouragement, a new question, a softer hint, or a sorting walkthrough of your own.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child looking and thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Says the object\'s name back instead of naming a group', response: 'That word is the question, not the answer, so it is wrong: speak the scripted "My turn:" correction, which names the group and re-asks.' },
        { pattern: 'Answers only ONE half of a two-criteria question ("it is a need")', response: 'A true statement about one criterion does not say whether the second holds, so it is wrong: speak the scripted correction, which states both and re-asks.' },
        { pattern: 'Gives the REASON instead of choosing the odd one out ("they all go together")', response: 'That is the thinking the task wants and it is not the answer to the question asked, so it is wrong: speak the scripted correction, which names the card and re-asks.' },
        { pattern: 'Counts out loud on the way to a total ("one, two, three")', response: 'That is the child working, not answering. Only the number they FINISH on is their answer — judge that, and count a correct landing as correct.' },
        { pattern: 'The same wrong answer comes twice in a row', response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it. '
            + 'In particular, never announce the whole activity or read out every group before the first ask — the ask names what the child needs.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants. '
            + 'On a SORT the answer is ONE group name — said plainly, with or without its little words ("need", "the needs", "it is a need" are the same answer). '
            + 'On PICK-THE-RULE the answer is the way to sort them all, not a description of one object. '
            + 'On ODD-ONE-OUT the answer is the NAME of the card that does not belong; the reason on its own is not an answer. '
            + 'On a COUNT the answer is ONE number word, and counting out loud on the way to it is the child working, not answering — only the number they land on counts. '
            + 'On COMPARE the answer is more, fewer, or the same — a group name is not a comparison. '
            + 'On TWO-THINGS the answer is YES or NO in any natural form, and answering only one of the two criteria is not an answer. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'An affirmation is the WHOLE turn. After it, stop speaking — never carry on into another question, another object, or the next item, '
            + 'even one you can see on the screen. The next ask always arrives as its own cue, and a question you ask early is about the wrong object.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never sort anything out loud, and never prompt while the child is looking. The silence is theirs.',
        },
        {
          title: 'NEVER READ THE SCREEN\'S NUMBERS',
          instruction:
            'On a counting question the screen may show the group the child is counting. Never count it aloud, never say how many you can see, '
            + 'and never describe what is in a tray — the number is the answer and it belongs to the child.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again. That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'sort_one',
        label: 'Sort by One (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['sort-by-one'],
        // β HELD. The drag-to-bin became unaided speech — a structural change —
        // but the ask still NAMES the groups aloud (it has to, or a pre-reader
        // has an unanswerable question), so the guess floor is unchanged at
        // 1-in-N. What changed is that the category name now leaves the child's
        // mouth, which is production rather than placement, and one challenge is
        // now one judged turn PER OBJECT rather than a screenful behind a Check.
        description: 'Say which group each thing belongs with, one thing at a time. Spoken production judged by the Live tutor; no bins to drag into.',
      },
      {
        evalMode: 'sort_attribute',
        label: 'Sort by Attribute (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['sort-by-attribute'],
        // β HELD — the metacognitive choice survives intact; only its CHANNEL
        // moved off text buttons and into the child's mouth.
        description: 'Grade 1+ ONLY (the band floor is unchanged by the spoken port; moving it needs a reader-fit re-audit). Objects have several attributes: the child SAYS how the set should be sorted, then sorts it by that rule one thing at a time.',
      },
      {
        evalMode: 'sort_variety',
        label: 'Sort Again — Different Rule (Tier 2+)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['sort-variety'],
        // β HELD — same rule-rotation task, spoken instead of dragged.
        description: 'Grade 1+ ONLY for now (the K voiced-rule variant is the contract\'s G3 follow-up and needs a reader-fit re-audit, not a floor edit). FLEXIBLE CLASSIFICATION: re-sort the SAME set by a DIFFERENT rule each round, saying where each thing goes. Rule rotation IS the declared task — the sanctioned exemption to taught-rule stability, which still holds for every other mode.',
      },
      {
        evalMode: 'count_compare',
        label: 'Count & Compare (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['count-and-compare'],
        // β HELD — the number steppers were already unaided production, so the
        // mouth replaces the keypad without changing the task. The per-tray
        // count badge is now hidden until the tutor affirms, which is an
        // answer-leak fix rather than a difficulty lever.
        description: 'Grade 1+ ONLY (the band floor is unchanged by the spoken port; K comparison routes to comparison-builder). SAY how many are in each group, then SAY which has more, fewer, or the same. Counts 1-20; an empty group is never asked.',
      },
      {
        evalMode: 'odd_one_out',
        label: 'Odd One Out (Tier 3+)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['odd-one-out'],
        // β HELD — a 1-in-N tap became a 1-in-N naming. The ask deliberately
        // does NOT recite the cards (they are pictures, and reciting six labels
        // a round is recitation), so the child must name what they see.
        description: 'SAY the name of the card that does not belong. The tutor never lists the cards, so the answer is produced, not chosen.',
      },
      {
        evalMode: 'two_attributes',
        label: 'Two Attributes (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['two-attributes'],
        // β HELD — the cognition is untouched. The compound instruction is no
        // longer READ at once; it is asked one object at a time as a spoken
        // yes/no, which is the contract's G2 path ("what exceeds a pre-reader is
        // the medium, not the cognition"). The floor stays until that audit runs.
        description: 'Grade 1+ ONLY (the band floor is unchanged by the spoken port; unflooring is the contract\'s G2 re-audit, not a catalog edit). For each thing in turn, SAY YES or NO to whether it matches BOTH criteria at once; the primary criterion expresses the lesson objective.',
      },
      {
        evalMode: 'tally_record',
        label: 'Tally & Record (Tier 4+)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['tally-record'],
        // β HELD — recording a count by voice instead of a stepper.
        description: 'Grade 1+ ONLY (the band floor is unchanged by the spoken port). Sort, then SAY the count of each group aloud. Counts 1-20; an empty group is never asked.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'shape-sorter',
    description:
      'LIVE-JUDGED SPOKEN 2D geometry (Direct Instruction). The tutor points to one shape at a time and the '
      + 'student ANSWERS OUT LOUD — naming the shape, saying how many sides or corners it has, or naming the '
      + 'group it belongs with. The tutor judges the spoken answer from the audio, corrects by re-modelling, and '
      + 'its own affirmation advances the lesson. Nothing is tapped, dragged or typed. REQUIRES A MICROPHONE. '
      + 'Teaches Defining vs Non-Defining Attributes; correctness is derived in code from the geometry, never '
      + 'from the model. ESSENTIAL for Kindergarten and Grade 1 geometry.',
    constraints:
      'REQUIRES A MICROPHONE — every answer is spoken; there is no tap, drag, stepper or button path. '
      + 'Shapes limited to: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval. '
      + 'Grade K-1 only. NAMING items need one defensible name per drawing, so a square must be drawn close to '
      + 'upright (a square turned 45 degrees is a diamond), and diamond and rhombus are the same drawing so '
      + 'either name is accepted for either. COUNTING items are POLYGONS ONLY — a circle has no defensible side '
      + 'count, being arguable at zero and at one. SORTING is by sides, curved or color (never by shape, whose '
      + 'groups would just be the shape names) into 2-3 groups, and a sides sort holds polygons only.',
    // reader: 'none' — "Nothing is tapped, dragged or typed" (description) and every answer is
    // spoken (all 3 modes below); no text surface exists for the child to read.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    // ── DI MODALITY (2026-08-18) — FIFTH math port, item 18. The tutor owns the
    // clock: it asks once, waits, judges the spoken answer in-band, and its own
    // affirmation is the advance. No advance timer, no Next button, no Check,
    // no push-to-talk mic.
    // THE FORK HAS NO SPLIT — a shape's name, a count and a group name are all
    // things a five-year-old says across a table, so all three modes are SPOKEN
    // and every tap is deleted. Three benched response classes, no new sitting.
    // WHAT THE COSTUME TEST DELETED: the select-all identify grid (a child who
    // cannot identify a triangle can tap, read the red ring, and re-tap until it
    // lands), the side/corner steppers, and the shape-tray-into-bin drag.
    // WHAT IS NOT A COSTUME AND STAYS: the drawn shapes and the labelled mats.
    // The screen is the PAGE; it was the ACTION that was the costume.
    // AND THE MATS ARE LABELLED AT EVERY TIER NOW: blanking them at `hard` was
    // legal while the answer was a position you could tap, and is an
    // unanswerable question once the answer is the label said aloud — so that
    // withdrawal moved into the ASK (the hard tier stops SPEAKING the groups to
    // a reader; the K band floor always speaks them).
    // Cue lines, the judging contracts, the geometry table and the build gates
    // live in `shapeSorterScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame. SENTINEL DISCIPLINE (standing gate 2) re-checked on
    // every line below: no sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction shape work for a young child. You ask one question out loud and the '
        + 'child answers OUT LOUD. Right now the task identity is "{{challengeType}}" and what is in front of '
        + 'them is {{stimulus}}. Under "identify" the child SAYS the name of the shape; under "count" the child '
        + 'SAYS how many sides or corners it has; under "sort" the child SAYS which group it belongs with. You '
        + 'speak the exact scripted lines from each bracketed application message, you re-ask when the child '
        + 'asks to hear the question again, and you judge each spoken attempt from the audio you heard using '
        + 'only the two allowed reply branches. Naming, counting and grouping ARE the skills being practised, '
        + 'so the child produces every answer — there is nothing to tap, drag, or point at.',
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory, and every level is a
      // BEHAVIOUR rather than a line you may say. A ladder that quotes speakable
      // hints is a no-verdict stall: on a repeated wrong answer the model
      // reaches for the sanctioned-sounding alternative and says something that
      // opens with neither sentinel, so the loop records no verdict at all and
      // the correction counter freezes (18d, found on number-bond).
      scaffoldingLevels: {
        level1: 'Use the scripted correction line for this shape, then hand the question back and wait.',
        level2: 'Use that same scripted correction line again, unchanged, and give them longer in silence.',
        level3: 'Use that same scripted correction line again — the wording is fixed, the patience is what changes.',
      },
      // Observable behaviours only, and every response is a PERFORMABLE script
      // move: meta-commentary in this field gets recited verbatim to a child.
      // The first entries are the SIGNATURE errors — the wrong answers that
      // arrive fluent, confident, and most likely to be affirmed by mistake.
      commonStruggles: [
        {
          pattern: 'Says a near shape name — "rectangle" at a square, "circle" at an oval, "pentagon" at a hexagon',
          response: 'A different shape name is wrong however close it sounds, and it is the exact error this practice exists to catch. Run the scripted correction, then hand the question back and wait.',
        },
        {
          pattern: 'Says a count that is one more or one less than the true one',
          response: 'A miscount by one is still a wrong count. Run the scripted correction, then ask once more and wait.',
        },
        {
          pattern: 'Names the SHAPE when asked which group it belongs with — "square" instead of the group',
          response: 'That is a true thing to say about the drawing and it is still not a group. Run the scripted correction, then hand the question back and wait.',
        },
        {
          pattern: 'Counts out loud on the way to the answer — one, two, three, and then three',
          response: 'That is a correct answer at this age, not a hesitation: wait for them to finish, judge the number they land on, and affirm it with the scripted line.',
        },
        {
          pattern: 'Says a shape name with young-child pronunciation, or with or without a little word in front',
          response: 'Those are all the same correct answer — affirm with the scripted line. Naming is what is measured, not diction.',
        },
        {
          pattern: 'Goes quiet after the question, or asks to hear it again',
          response: 'Silence is a five-year-old looking carefully at a drawing — wait. If they ask, the application sends the re-ask; never volunteer one.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [SHS_ITEM], [SHS_MOVE], [SHS_HEAR] or [SHS_COMPLETE] contain the only lesson words '
            + 'you may speak, and each one quotes the exact line after "Say exactly:". The square-bracket label '
            + 'is private metadata: never speak, reproduce, or invent it. Affirmations begin with "Yes" and '
            + 'corrections begin with "My turn" — never begin any other sentence with those words. Judge honestly '
            + 'from the audio and do not praise to be kind. YOUR VERDICT LINE IS THE END OF YOUR TURN: you never '
            + 'continue into another question, never ask about another shape, and never announce what is coming. '
            + 'The application decides which shape comes next and sends it to you when the screen is ready — a '
            + 'question you ask early is about the wrong shape, and the child then hears it twice.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [SHS_ITEM] carries the greeting, how the game works and the whole first question inside '
            + 'one quoted line. Speak it and stop. Do not greet the child separately, do not explain the activity '
            + 'in your own words, and do not add a warm-up question — the quoted line is the whole opening.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (it depends on the identity)',
          instruction:
            'Every answer here is SPOKEN, and the [SHS_ITEM] message names the one that is correct. Under '
            + '"identify" it is the NAME OF THE SHAPE — young-child pronunciation counts, a little word in front '
            + 'is optional, and where the message says another name is also accepted, it is the same drawing and '
            + 'you affirm it. Under "count" it is a NUMBER WORD, and counting out loud on the way to it is a '
            + 'correct route: wait until they stop and judge only the number they finish on. Under "sort" it is '
            + 'a GROUP NAME: the label alone, with its ending changed, inside a little phrase, or — for a group '
            + 'like "4 sides" — just the number, are all the same answer. THE LAW: you never say the answer '
            + 'before the child does, in any identity, at any support level. There is nothing on screen for them '
            + 'to tap, so never suggest picking, pointing, dragging or showing you anything.',
        },
        {
          title: 'NEVER NAME THE SHAPE BEFORE THEY ANSWER — IT IS THE ANSWER TWICE OVER',
          instruction:
            'Under "identify" the name of the shape IS the answer. Under "count" it hands the answer over just '
            + 'as completely — a child who hears "triangle" knows the count without looking. So before the child '
            + 'answers, never name the shape and never describe the drawing (how many points it has, whether it '
            + 'is round), under any identity. When the quoted line names the GROUPS ("Curved, or Straight?"), '
            + 'that IS the question — a sort whose groups are unknowable cannot be answered at all, so naming '
            + 'them is never a leak. When the quoted line does NOT name them, they are printed and the student '
            + 'is expected to read them: say only what is quoted and do not helpfully list them.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not offer a clue, and do not name the '
            + 'choices again to nudge them. A long pause is a five-year-old looking hard at a drawing or counting '
            + 'its corners under their breath, and that work IS the activity. Think time is unbounded and the '
            + 'application, not the clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [SHS_HEAR], the child asked to hear the question again. Say ONLY the quoted line, '
            + 'warmly and slowly, then go back to waiting. Add nothing, judge nothing you just heard, and never '
            + 'let the repeat carry more help than the first asking did: no extra stress on any word, no clue '
            + 'about the name, the count or the group. This channel is answered at every grade and support tier.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (Concrete)',
        // β 1.5 → 2.0. STRUCTURAL: the click era was select-all over a printed
        // pool with a green/red ring painted on every tap, so a child could hunt
        // until the rings were green. The answer is now PRODUCED from the
        // child's own vocabulary with no menu on screen at all — the guess floor
        // went from "re-tap until it lands" to one unaided attempt plus two
        // judged corrections. Same lever story-talk and letter-spotter recorded
        // when a menu was deleted outright.
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Say the name of a 2D shape out loud from its drawing.',
      },
      {
        evalMode: 'count',
        label: 'Count (Pictorial)',
        // β 2.5 → 3.0. STRUCTURAL, and not merely stepper-to-mouth (ten-frame
        // held β on that alone, correctly — operating a stepper still required
        // producing the number). What changed here is that the click era printed
        // a numbered "Side 1 / Side 2 / Side 3" button per side directly under
        // the question, so the answer was countable off the UI, and Check could
        // be pressed without limit. Both are gone.
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['count'],
        description: 'Say how many sides or corners a polygon has. One feature per question, alternated.',
      },
      {
        evalMode: 'sort',
        label: 'Sort (Pictorial–)',
        // β HELD at 3.5, deliberately — word-sorter's reasoning, and it applies
        // unchanged: the tap became speech, but the answer SET is the same size,
        // the ask re-states the choices, and the mats never shrank, so the
        // discrimination demand is identical. What the modality added is that a
        // wrong answer is now corrected rather than re-tapped.
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['sort'],
        description: 'Say which group a shape belongs with, by sides, curve or color.',
      },
    ],
  },
  {
    id: '3d-shape-explorer',
    misconceptionScope: 'primitive',
    description: 'LIVE-JUDGED spoken solid-shape exploration for K-1. The child sees one code-drawn solid or familiar object, or hears one code-owned riddle, and SAYS one answer: a mathematical solid name, flat or solid, one property count, a yes/no property verdict, or a flat-face shape. The Live tutor judges the response in-band, teaches the exact misconception after a wrong answer, and its own affirmation advances the run.',
    constraints: 'Requires a microphone. Every answer is spoken; there are no answer buttons, sorting bins, match grid, property grid, Check, or Next controls. Solids are limited to cube, sphere, cylinder, cone, and rectangular-prism; flat drawings are circle, square, triangle, and rectangle. Geometry facts and riddle clues come from the code-owned truth table. Number answers are 1-20; a zero count is reframed as a yes/no any-question. Compound generated collections fan out to one judged item per answer, capped at four children and six session items. Generated content with unknown names, contradictory dimensions or facts, object-name leaks, or non-unique riddles is discarded.',
    // reader: 'none' — every mode below is already spoken-only ("there are no answer buttons,
    // sorting bins, match grid, property grid, Check, or Next controls").
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED solid-shape practice. Ask only the hand-authored cue, wait for one spoken answer, judge it, and let your own verdict advance. Current challenge type: {{challengeType}}. Question-side screen context: {{stimulus}}. Never read the [CURRENT STATE] heading or its lines aloud.',
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never name the hidden solid or property and never offer a second speakable line.',
        level2: 'After a wrong answer, speak the cue\'s scripted "My turn:" correction exactly. Do not add a hint, alternate question, or praise before or after it.',
        level3: 'Stay with the script even when the child is stuck. The correction models the geometry and re-asks. Never improvise a walkthrough, count aloud during the child\'s turn, or reveal a candidate.',
      },
      commonStruggles: [
        { pattern: 'Says a flat look-alike instead of a solid name', response: 'Judge it wrong and use only the scripted correction, which contrasts the whole solid with one flat face.' },
        { pattern: 'Repeats the everyday object name', response: 'That names the stimulus, not its mathematical solid. Use only the scripted correction.' },
        { pattern: 'Counts one face twice or misses one', response: 'Use only the scripted correction, which models touching each face exactly once.' },
        { pattern: 'Confuses rolling, sliding, and stacking', response: 'Judge the property actually asked. A true statement about a different movement is still wrong.' },
        { pattern: 'Long silence', response: 'The child is looking and thinking. Wait. If needed, re-speak the exact current ask once without naming the answer.' },
      ],
      aiDirectives: [
        { title: 'THE SCRIPT OWNS EVERY SPOKEN LINE', instruction: 'The opening cue already contains the greeting, how-to-play, exact ask, exact affirmation, and exact correction. Speak only the quoted line required for this turn. Never replace it with catalog prose or generated instruction text.' },
        { title: 'TWO-BRANCH LAW', instruction: 'Judge only the learner response. If it is right, speak the exact "Yes," affirmation. If it is wrong, speak the exact "My turn:" correction. There is no hint or partial-credit branch.' },
        { title: 'THE VERDICT ENDS THE TURN', instruction: 'An affirmation or correction is the whole turn. Stop immediately afterward. Never ask the next item early; its cue arrives separately.' },
        { title: 'ANSWER MATERIAL', instruction: 'Every item is answered aloud. Shape names must be mathematical names, flat/solid accepts the stated dimensional variants, positive counts are one through twenty, and yes/no accepts the natural variants explicitly listed by the cue. Do not accept an object name, a nearby solid, or a fact about a different property.' },
        { title: 'NEVER PERFORM THE CHILD\'S WORK', instruction: 'Never name a hidden target, read answer options, count faces aloud during the child\'s turn, or select a candidate from the clues. Think time is unbounded. Bracketed text is stage direction and is never spoken.' },
        { title: 'CURRENT STATE IS SILENT CONTEXT', instruction: 'Never read [CURRENT STATE], its heading, or any of its lines aloud. It describes the screen only.' },
      ],
    },
    audioInput: { manual_activity: true },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify_3d',
        affordances: { answers: ['spoken'] },
        label: 'Identify 3D (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify-3d'],
        description: 'Look at one unlabeled solid and SAY its mathematical name. Beta raised from 1.5: the 1-of-4 printed name menu is gone.',
      },
      {
        evalMode: 'match_real_world',
        affordances: { answers: ['spoken'] },
        label: 'Match Real World (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['match-to-real-world'],
        description: 'Look at one familiar object and SAY its solid-shape name. Beta raised from 2.5: the shape word column and elimination grid are gone.',
      },
      {
        evalMode: '2d_vs_3d',
        affordances: { answers: ['spoken'] },
        label: '2D vs 3D (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['2d-vs-3d'],
        description: 'Look at one code-drawn shape and SAY flat or solid. Beta held: the same binary discrimination and closed spoken pair remain.',
      },
      {
        evalMode: 'faces_properties',
        affordances: { answers: ['spoken'] },
        label: 'Faces & Properties (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['faces-and-properties'],
        description: 'Answer one focused property question aloud with a number word, yes/no verdict, or flat-face shape. Beta held: menus are removed while the old bulk grid is decomposed.',
      },
      {
        evalMode: 'shape_riddle',
        affordances: { answers: ['spoken'] },
        label: 'Shape Riddle (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['shape-riddle'],
        description: 'Listen to every code-owned clue and SAY the mystery solid name. Beta raised from 5.5: the 1-of-4 illustrated name menu is gone.',
      },
    ],
  },
  {
    id: 'shape-tracer',
    description: 'Interactive shape construction canvas with 4 progressive challenge types: trace (follow dotted outlines), complete (finish half-drawn shapes), draw-from-description (build shapes from verbal property descriptions), and connect-dots (reveal shapes by connecting numbered dots). Develops geometric reasoning by linking shape properties to motor construction. Perfect for K-1 shape recognition and spatial reasoning. ESSENTIAL for Kindergarten and Grade 1 geometry.',
    constraints: 'Canvas coordinate space is 500x400. All vertex coordinates must be within bounds (x: 40-460, y: 40-360). Shapes should be large enough for small hands to tap. Maximum 6 challenges per activity.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Student is constructing shapes on a drawing canvas. Current challenge type: {{challengeType}}. Target shape: {{targetShape}}. They have completed {{sidesCompleted}} of {{totalSides}} sides. Attempt {{attemptNumber}}.',
      contextKeys: ['challengeType', 'targetShape', 'description', 'requiredProperties', 'sidesCompleted', 'totalSides', 'attemptNumber', 'tracingAccuracy'],
      scaffoldingLevels: {
        level1: '"Follow the dots slowly. Start at the first dot and draw to the next one. Which dot is next?"',
        level2: '"You\'ve drawn {{sidesCompleted}} sides. How many more do you need? Look at the dots \u2014 where does the next side go?"',
        level3: '"A {{targetShape}} has {{totalSides}} sides. You drew {{sidesCompleted}} already \u2014 now connect the last dot back to where you started to close the shape!"',
      },
      commonStruggles: [
        { pattern: 'Student taps vertices out of order repeatedly', response: 'Guide them to the numbered dots: "See the numbers? Let\'s go in order: 1, then 2, then 3. Find number [next] and tap it!"' },
        { pattern: 'Student draws wrong number of sides for draw-from-description', response: 'Redirect to properties: "How many sides does the shape need? Count your corners \u2014 how many do you have? Do you need more or fewer?"' },
        { pattern: 'Student connects dots in wrong order', response: 'Point to the labels: "Look at the numbers on the dots. Which number comes next? Find it and tap!"' },
        { pattern: 'Student struggles with shape completion', response: 'Point to where the shape needs to close: "Look at where the shape started. Can you draw a line back to the beginning to close it up?"' },
      ],
    },
    evalModes: [
      {
        evalMode: 'trace',
        label: 'Trace (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['trace'],
        description: 'Follow a dotted shape outline by tapping vertices in order.',
      },
      {
        evalMode: 'connect_dots',
        label: 'Connect Dots (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['connect-dots'],
        description: 'Connect numbered dots in order to reveal the shape.',
      },
      {
        evalMode: 'complete',
        label: 'Complete (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['complete'],
        description: 'Finish a partially drawn shape by connecting the remaining sides.',
      },
      {
        evalMode: 'draw_from_description',
        affordances: { representation: 'symbolic' },
        label: 'Draw from Description (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['draw-from-description'],
        description: 'Construct a shape from verbal property cues.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'math-fact-fluency',
    description: 'Math fact fluency practice with 5 progressive challenge types: visual facts with dot arrays/ten-frames, bare equation solving, missing number problems, visual-equation matching, and aid-free rapid recall. Builds automaticity for addition and subtraction facts within 3, 5, or 10 through calm, untimed practice (no countdown, no time pressure). Perfect for K-1 fact fluency development. ESSENTIAL for Kindergarten and Grade 1 math fact recall.',
    constraints: 'Facts limited to addition and subtraction within maxNumber (3, 5, or 10). Visual aids only in visual-fact and match phases. Rapid-recall (speed-round) has no multiple choice and no visual aids. No timers — students answer at their own pace; response time is measured silently for the automaticity signal only.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'type'], role: 'apply', minutes: 4 },
    evalModes: [
      {
        evalMode: 'visual_fact',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Visual Fact (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['visual-fact'],
        description: 'Picture-based fact recognition with dot arrays, ten-frames, or fingers.',
      },
      {
        evalMode: 'match',
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap'] },
        label: 'Match (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['match'],
        description: 'Connect visual representations to their equations.',
      },
      {
        evalMode: 'equation_solve',
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'Equation Solve (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['equation-solve'],
        description: 'Solve bare equations with multiple choice.',
      },
      {
        evalMode: 'missing_number',
        affordances: { representation: 'symbolic', answers: ['type'] },
        label: 'Missing Number (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-number'],
        description: 'Find the unknown operand in an equation.',
      },
      {
        evalMode: 'speed_round',
        affordances: { representation: 'symbolic', answers: ['type'] },
        label: 'Rapid Recall (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['speed-round'],
        description: 'Rapid recall of bare facts without visual aids or countdown — the top automaticity rung. Response time is measured silently; the student is never rushed.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is practicing math fact fluency. Current challenge type: {{challengeType}}. Equation: {{equation}} ({{operation}}). Unknown position: {{unknownPosition}}. This is about building automaticity through calm, untimed practice — there is no timer, so never rush the student or mention speed.',
      contextKeys: ['challengeType', 'equation', 'operation', 'unknownPosition', 'correctAnswer', 'operand1', 'operand2', 'result', 'attemptNumber', 'streak', 'accuracy', 'averageTime'],
      scaffoldingLevels: {
        level1: '"Take your time! Look at the numbers. What do you get when you put {{operand1}} and {{operand2}} together?"',
        level2: '"Think: {{operand1}}... then count on {{operand2}} more. Use your fingers if you need to!"',
        level3: '"Let me help: start at {{operand1}}, now count up {{operand2}} more... what number do you land on?"',
      },
      commonStruggles: [
        { pattern: 'Student answers correctly but is still counting on fingers', response: 'Affirm correctness and reassure: "You got it! The more you practice, the more these will just pop into your head — no rush."' },
        { pattern: 'Student struggles with subtraction facts', response: 'Connect to addition: "If 3 + 2 = 5, then 5 - 2 = ?"' },
        { pattern: 'Student struggles with missing-number problems', response: 'Encourage think-backwards strategy: "If 3 + __ = 5, think: what do I add to 3 to get to 5?"' },
        { pattern: 'Student seems anxious or rushed', response: 'Reassure that there is no clock: "Take all the time you need — we are just practicing getting the right answer."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'strategy-picker',
    description: 'An interactive strategy-comparison activity where students solve the same problem using 2-3 different strategies (counting on, make-ten, doubles, tally marks, draw objects), then compare and reflect on which approach they prefer. Builds mathematical flexibility and metacognitive awareness. Perfect for K-1 multi-strategy standards. ESSENTIAL for Kindergarten-Grade 1 addition and subtraction within 10.',
    constraints: 'Numbers within 5 (K) or 10 (Grade 1). Requires 2+ strategies per problem. Compare phase is metacognitive—no wrong answers.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Student is on challenge {{currentChallengeIndex}} of {{totalChallenges}}, solving {{equation}} using {{assignedStrategy}}. Challenge type: {{challengeType}}. They have completed strategies: {{strategiesCompleted}}. Support tier: {{supportTier}}. RECOGNITION RULE: for challenge type "match-strategy" the strategy IS the answer — NEVER name the correct strategy at any tier; at easy describe what features to look for, at hard only ask what the student notices.',
      contextKeys: ['currentChallengeIndex', 'totalChallenges', 'challengeType', 'equation', 'assignedStrategy', 'strategySteps', 'studentAnswer', 'attemptNumber', 'chosenStrategy', 'strategiesCompleted', 'supportTier'],
      scaffoldingLevels: {
        level1: '"Let\'s try this problem a different way! This time, we\'ll use {{assignedStrategy}}. What do you think the answer might be?"',
        level2: '"For counting on, start at {{operand1}} and hop forward {{operand2}} times. Let\'s count together: what comes after {{operand1}}?"',
        level3: '"Watch the number line — we start at {{operand1}} and make {{operand2}} hops: {{operand1}}... [count each hop]. Where did we land? That\'s our answer!"',
      },
      commonStruggles: [
        { pattern: 'Student gives different answers with different strategies', response: 'Highlight that all strategies should give the same answer. Ask them to recheck the strategy that gave a different result.' },
        { pattern: 'Student always chooses the same strategy in choose-your-strategy', response: 'Gently encourage trying a different approach: "You\'re great at counting on! Want to try make-ten this time to see if it works too?"' },
        { pattern: 'Student cannot identify the strategy in match-strategy', response: 'Point out the key visual feature: "Look — do you see a number line with hops? That\'s counting on! Do you see a ten frame? That\'s make-ten!"' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'guided',
        label: 'Guided Strategy (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['guided-strategy'],
        description: 'Follow a given strategy with step-by-step scaffolding.',
      },
      {
        evalMode: 'match',
        label: 'Match Strategy (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['match-strategy'],
        description: 'Identify which strategy a worked solution uses.',
      },
      {
        evalMode: 'try_another',
        label: 'Try Another (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['try-another'],
        description: 'Solve the same problem using a different strategy.',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare'],
        description: 'Evaluate and reflect on multiple strategies.',
      },
      {
        evalMode: 'choose',
        label: 'Choose Your Strategy (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['choose-your-strategy'],
        description: 'Autonomous strategy selection for a new problem.',
      },
    ],
  },
  {
    id: 'number-tracer',
    description: 'Canvas-based numeral writing practice. Students trace dotted digit paths, copy from a model, write from a prompt, or complete counting sequences. Essential for CC.K.CC.3 (write 0-20) and 1.NBT.1 (write to 120).',
    constraints: 'Best for K-Grade 1. Digit range: 0-20 for K, 0-120 for Grade 1. Use trace mode for beginners, sequence for advanced.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['manipulate'], role: 'apply', minutes: 4 },
    tutoring: {
      taskDescription: 'Student is writing the numeral {{digit}}. Challenge type: {{challengeType}}. Attempt {{attemptNumber}}. Model visible: {{showModel}}. Support tier: {{supportTier}}.',
      contextKeys: ['digit', 'challengeType', 'instruction', 'showModel', 'showArrows', 'supportTier', 'attemptNumber', 'lastScore', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Good try! Can you trace the dotted line from top to bottom?"',
        level2: '"Let\'s try together. For the number {{digit}}, start at the green dot and follow the arrows. What direction does the line go first?"',
        level3: '"Watch carefully: for {{digit}}, place your pencil at the top. Draw straight down. Now what shape do you need to add? Let\'s try one stroke at a time."',
      },
      commonStruggles: [
        { pattern: 'Score below 50% on trace mode', response: 'Encourage starting at the green dot and following arrows one step at a time.' },
        { pattern: 'Writing digit with strokes in wrong order', response: 'Refocus on stroke direction: ask "Where does this number start?"' },
        { pattern: 'Sequence input is off by one', response: 'Ask student to count aloud from the first number in the sequence.' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'trace',
        label: 'Trace (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['trace'],
        description: 'Follow dotted numeral path with direction arrows.',
      },
      {
        evalMode: 'copy',
        label: 'Copy (Tier 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['copy'],
        description: 'Write digit with model visible nearby.',
      },
      {
        evalMode: 'write',
        label: 'Write (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['write'],
        description: 'Write digit from text/audio prompt only.',
      },
      {
        evalMode: 'sequence',
        label: 'Sequence (Tier 4)',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['sequence'],
        description: 'Write missing number in counting sequence.',
      },
    ],
  },
  {
    id: 'length-lab',
    description: 'Interactive length measurement lab for Kindergarten. Students compare object lengths visually, tile non-standard units (cubes, paper clips) end-to-end to measure, arrange objects by length, and use indirect comparison via a reference. Perfect for K.MD.1 and K.MD.2 standards. ESSENTIAL for Kindergarten measurement.',
    constraints: 'Objects limited to 1-12 unit lengths. K: compare + tile only. G1: order + indirect.',
    // reader: 'none' — BACKLOG direct-manipulation sibling audit (qa/reader-fit/BACKLOG.md,
    // "Systemic items" section) cleared length-lab: "TilingWorkspace derives from placedUnits =
    // good" — the answer comes from what the child tiles/points at, never a read-then-type proxy.
    affordances: { representation: ['concrete', 'pictorial'], reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'compare',
        affordances: { answers: ['tap'] },
        label: 'Compare (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare'],
        description: 'Which object is longer or shorter? Direct visual comparison.',
      },
      {
        evalMode: 'tile_and_count',
        affordances: { representation: 'concrete', answers: ['manipulate'] },
        label: 'Tile & Count (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['tile_and_count'],
        description: 'Tile non-standard units end-to-end along an object and count them.',
      },
      {
        evalMode: 'order',
        affordances: { answers: ['manipulate'] },
        label: 'Order (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order'],
        description: 'Arrange three objects from shortest to longest.',
      },
      {
        evalMode: 'indirect',
        affordances: { answers: ['tap'] },
        label: 'Indirect (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['indirect'],
        description: 'Compare two objects transitively using a reference object.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is measuring and comparing lengths using {{unitType}}. Grade: {{gradeBand}}. Challenge type: {{challengeType}}. Comparing {{objectName0}} and {{objectName1}}.',
      contextKeys: ['unitType', 'gradeBand', 'challengeType', 'objectName0', 'objectName1', 'correctAnswer', 'challengeCount'],
      scaffoldingLevels: {
        level1: '"Look at both objects carefully. Which one sticks out farther? Which one is longer?"',
        level2: '"Put your finger at the start of each object and slide to the end. The {{objectName0}} goes to here, and the {{objectName1}} goes to here. Which one goes farther?"',
        level3: '"Line up both objects at the same starting point. Now look at the other end — the one that sticks out farther is longer. Count the units if you need to: {{objectName0}} is {{objectLength0}} units, {{objectName1}} is {{objectLength1}} units."',
      },
      commonStruggles: [
        { pattern: 'Student does not align objects at the same starting point', response: '"Make sure both objects start at the same line! If one starts ahead, it might look longer even if it is not."' },
        { pattern: 'Student confuses longer and shorter', response: '"Longer means it takes up MORE space. Shorter means it takes up LESS space. Which object takes up more space?"' },
        { pattern: 'Student leaves gaps between tiles when measuring', response: '"Put each tile right next to the last one with no space in between. Gaps make the count wrong!"' },
        { pattern: 'Student overlaps tiles when measuring', response: '"Each tile should just touch the next one — no stacking on top! Start at one end and line them up carefully."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'analog-clock',
    description:
      'Interactive analog clock with draggable hands, digital display sync, and timeline scrubber. '
      + 'Students read clock faces, set times by dragging hands, match analog to digital, and measure elapsed time with a stopwatch. '
      + 'Perfect for K-5 time-telling standards. ESSENTIAL for K.MD and 1.MD.3.',
    constraints:
      'K: hour and half-hour only (:00/:30). G1-2: quarter-hour (:15 intervals). G3-5: 5-minute intervals. Maximum 6 challenges per session.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'read',
        affordances: { answers: ['tap'] },
        label: 'Read Time (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['read'],
        description: 'Read analog clock face and pick correct time from 4 options',
      },
      {
        evalMode: 'set_time',
        affordances: { representation: 'concrete', answers: ['manipulate'] },
        label: 'Set Time (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['set_time'],
        description: 'Drag clock hands to show a given time',
      },
      {
        evalMode: 'match',
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap'] },
        label: 'Match (Tier 2)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match'],
        description: 'Match analog face to correct digital display from 4 options',
      },
      {
        evalMode: 'elapsed',
        affordances: { answers: ['manipulate'] },
        label: 'Elapsed Time (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['elapsed'],
        description: 'Determine elapsed time using real-time stopwatch',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is working on a {{challengeType}} clock challenge. Target time: {{targetTime}}. '
        + 'Currently showing: {{displayedTime}}. Grade: {{gradeBand}}. Attempt {{attemptNumber}}.',
      contextKeys: ['gradeBand', 'challengeType', 'targetTime', 'displayedTime', 'instruction', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at where the short hand is pointing. Which number is it closest to?"',
        level2:
          '"The short hand shows the hour — it\'s pointing near {{targetTime}}. The long hand shows minutes — when it points straight up, that\'s :00 (o\'clock)."',
        level3:
          '"The short hand (hour) points to the hour number. The long hand (minute) tells us the minutes: pointing up is :00, pointing right is :15, pointing down is :30, pointing left is :45. '
          + 'For {{targetTime}}, the short hand points to the hour and the long hand points to the minutes."',
      },
      commonStruggles: [
        {
          pattern: 'Student confuses hour and minute hands',
          response:
            '"The SHORT hand tells the HOUR — it moves slowly. The LONG hand tells the MINUTES — it moves faster. Look for the short one first!"',
        },
        {
          pattern: 'Student reads the number the minute hand points to as the minute value',
          response:
            '"When the long hand points to 6, it doesn\'t mean 6 minutes — it means 30 minutes! Each number means 5 more minutes: 1=5, 2=10, 3=15..."',
        },
        {
          pattern: 'Student struggles with half-hour positions',
          response:
            '"When the long hand points straight down to 6, that means half past — :30. The hour hand will be halfway between two numbers."',
        },
        {
          pattern: 'Student cannot drag hands to correct position',
          response:
            '"Try dragging the long hand first. Point it straight up for :00, straight down for :30. Then check if the short hand is on the right number."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'coin-counter',
    description: 'Interactive coin workspace for grades K-3. Students identify coins by appearance, count mixed coin sets, drag coins to make target amounts, compare groups, and make change. Supports pennies, nickels, dimes, and quarters with skip-counting scaffolds. Progressive difficulty from single-coin identification through greedy-algorithm fewest-coins challenges. ESSENTIAL for grades K-3 money skills and financial literacy foundations.',
    constraints: 'Best for grades K-3. K-1: identify coins and count like coins only. Grades 2-3: mixed counting, make-amount, compare, and make-change challenges.',
    affordances: { representation: 'concrete', answers: ['tap', 'manipulate', 'type'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Student is working with coins — identifying, counting, or making amounts. Instruction: {{instruction}}. Grade band: {{gradeBand}}.',
      contextKeys: ['instruction', 'targetCoin', 'correctTotal', 'targetAmount', 'correctGroup', 'correctChange', 'displayedCoins', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"What coin is this? Look at its size and color."',
        level2: '"A dime is 10¢. Count by 10s for each dime, then add the pennies."',
        level3: '"You have 2 dimes and 3 pennies. 10, 20... then 21, 22, 23. The total is 23¢."',
      },
      commonStruggles: [
        { pattern: 'Confusing dime/penny (small coin ≠ small value)', response: '"A dime is small but worth 10¢ — more than a big nickel (5¢) or penny (1¢). Size doesn\'t equal value with coins!"' },
        { pattern: 'Skip-counting by mixed values', response: '"Sort the coins first: quarters, then dimes, then nickels, then pennies. Count the big values first: 25, 50... then 60, 70... then 75, 80..."' },
        { pattern: 'Making change requires subtraction', response: '"You paid {{targetAmount}}¢ and the item costs less. Subtract the price from what you paid to find the change."' },
      ],
      aiDirectives: [
        {
          title: 'COIN COACHING APPROACH',
          instruction:
            'For K-1: focus on coin recognition — "This small silver coin is a dime. It\'s worth 10 pennies!" '
            + 'For grade 2: model skip counting — "Let\'s count the dimes: 10, 20, 30. Now add the nickels: 35, 40." '
            + 'For grade 3: guide efficient strategies — "Start with the biggest coins first. Can you use fewer coins?" '
            + 'Always connect coin values to skip counting patterns. '
            + 'Celebrate correct identification and counting streaks.',
        },
        {
          title: 'GRADE 1 COUNT-LIKE — ENACTED TAP COUNT',
          instruction:
            'When gradeBand is 1 and the student is counting LIKE coins (single denomination), the coins '
            + 'on screen are tappable: the student taps each coin once to count it, and the total entry box '
            + 'appears only after every coin is tagged. When you read the counting instruction, ALSO tell the '
            + 'student to tap each coin to count it, then type the total — this protocol line is part of the '
            + 'instruction, even when asked to keep it brief. If the running total is hidden on screen, coach '
            + 'skip counting out loud ("5, 10, 15…") on struggle, but NEVER state the final total.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Identify (Scaffold 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name coins by appearance; match coin to value',
      },
      {
        evalMode: 'count-like',
        affordances: { answers: ['tap'] },
        label: 'Count Like Coins (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count'],
        description: 'Count sets of same coin type (5 pennies = 5¢)',
      },
      {
        evalMode: 'count-mixed',
        affordances: { representation: 'pictorial', reader: 'emerging', answers: ['type'] },
        label: 'Count Mixed Coins (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count'],
        description: 'Count mixed coin sets (2 dimes + 3 pennies = 23¢)',
      },
      {
        evalMode: 'compare',
        affordances: { representation: 'pictorial', answers: ['tap'] },
        label: 'Compare (Scaffold 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['compare'],
        description: 'Which coin group has more money?',
      },
      {
        evalMode: 'make-amount',
        affordances: { answers: ['manipulate'] },
        label: 'Make Amount (Scaffold 2)',
        beta: 3.5,
        scaffoldingMode: 2,
        challengeTypes: ['make-amount'],
        description: 'Drag coins to build a target amount',
      },
      {
        evalMode: 'make-change',
        affordances: { representation: 'pictorial', answers: ['type'] },
        label: 'Make Change (Scaffold 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['make-change'],
        description: 'Calculate change from a purchase',
      },
      {
        evalMode: 'fewest-coins',
        affordances: { answers: ['manipulate'] },
        label: 'Fewest Coins (Scaffold 3)',
        beta: 5.0,
        scaffoldingMode: 3,
        challengeTypes: ['make-amount'],
        description: 'Make amount using minimum coins (greedy algorithm)',
      },
    ],
  },
  {
    id: 'time-sequencer',
    description: 'Event sequencer and time concepts for grades K-2. Students order daily events, match activities to time of day (morning/afternoon/night), reason about before/after relationships, compare durations, and read simple schedules. Progressive difficulty from 3-event sequencing through clock-time schedule reading. Bridges to AnalogClock for formal time-telling. ESSENTIAL for K-2 time and daily routine concepts.',
    constraints: 'Best for grades K-2. K: 3-event sequences and time-of-day matching only. Grades 1-2: 5-event sequences, before/after reasoning, duration comparison, and schedule reading.',
    // reader: 'none' — qa/reader-fit/how-it-works-PRE-2026-07-21.md names time-sequencer as the
    // recommended K routing destination for procedural/ordering content precisely because it is
    // "already K-2, picture-primary"; read-schedule is the one mode that requires reading printed
    // clock times off a schedule, so it is overridden to 'developing' below.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Student is ordering daily events or matching activities to times of day. Connects to personal routines.',
      contextKeys: ['instruction', 'events', 'correctOrder', 'event', 'correctPeriod', 'referenceEvent', 'relation', 'schedule', 'targetTime', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Think about your day. What do you do first when you wake up?"',
        level2: '"Breakfast comes in the morning. Is the morning before or after lunchtime?"',
        level3: '"Here\'s the order: wake up comes first, then breakfast, then school. You got 2 out of 3 right!"',
      },
      commonStruggles: [
        { pattern: 'Confusing afternoon/evening boundary', response: '"Afternoon is after lunch but before dinner. Evening starts around dinnertime when it gets dark."' },
        { pattern: 'Sequencing events they don\'t personally experience (e.g., "go to work")', response: '"Think about what grown-ups do — they go to work after breakfast, like you go to school!"' },
        { pattern: 'Reading clock times on schedules (bridge to AnalogClock)', response: '"Look at the number before the colon. If it\'s small like 7 or 8, that\'s morning. If it\'s bigger like 3 or 4, that\'s afternoon."' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'sequence-3',
        label: 'Sequence 3 Events (Scaffold 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['sequence-events'],
        description: 'Order 3 daily events',
      },
      {
        evalMode: 'time-of-day',
        label: 'Time of Day (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['match-time-of-day'],
        description: 'Match events to morning/afternoon/night',
      },
      {
        evalMode: 'sequence-5',
        label: 'Sequence 5 Events (Scaffold 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['sequence-events'],
        description: 'Order 5 daily events',
      },
      {
        evalMode: 'before-after',
        label: 'Before/After (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['before-after'],
        description: 'What happens before/after X?',
      },
      {
        evalMode: 'duration-compare',
        label: 'Duration Compare (Scaffold 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['duration-compare'],
        description: 'Which takes longer?',
      },
      {
        evalMode: 'read-schedule',
        affordances: { representation: 'symbolic', reader: 'developing', answers: ['tap'] },
        label: 'Read Schedule (Scaffold 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['read-schedule'],
        description: 'Read a simple daily schedule with clock times',
      },
    ],
  },
  {
    id: 'spatial-scene',
    description: 'Grid-based positional language and prepositions. Students identify, place, and describe object positions using spatial words (above, below, beside, next to, on, under, left of, right of) — tapping the grid to ENACT an instruction like "Put the ball under the box". Also serves containment ("Put the ball IN the box" — tap the container itself) and two-reference placement ("Put the ball BETWEEN the box and the tree"). Serves both K.G.1 math positional vocabulary and Kindergarten Language Arts preposition skills. Supports multiple challenge types from simple identification to multi-step direction following. ESSENTIAL for K-1 geometry and K-2 grammar prepositions.',
    constraints: 'Requires a grid layout with placed objects. Challenges array drives interactivity. Grade band K-1. The position-word vocabulary follows whatever words the lesson objective/intent names, widening the grade-band default — so name the target prepositions in the intent. Containment "in/inside" and two-reference "between" are served by their own challenge types (place_in, place_between). NOT supported (do not route these here): viewer-relative "in front of/behind" and path words "through/around/across" — a 3x3 top-down static grid cannot express them.',
    // docs/contracts/spatial-scene.md: R5 populates the grid with pictorial scene objects (icons,
    // not photos or bare symbols); identify/describe alone carry a text options row (R7/R12), which
    // the child must read to disambiguate — the place/place_in/place_between/follow_directions
    // family is pure tap-to-enact with no text answer surface, so 'none' is the primitive default
    // and identify/describe are overridden to 'emerging' below. No formal reader-fit PRE verdict.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription: 'Student identifies, places, or describes positions of objects on a grid using spatial vocabulary (above, below, beside, in, between).',
      contextKeys: ['instruction', 'sceneObjects', 'targetObject', 'correctPosition', 'referenceObjectName', 'referenceObjectName2', 'options', 'steps', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the picture. Can you point to the {{targetObject.name}}?"',
        level2: '"The {{targetObject.name}} is higher up than the {{referenceObjectName}}. What position word means \'higher up\'?"',
        level3: '"When something is higher up, we say it is \'above\'. The {{targetObject.name}} is above the {{referenceObjectName}}."',
      },
      commonStruggles: [
        { pattern: 'Confusing "above" and "below" (vertical reversal)', response: '"Think about where the sky is — above! Where the ground is — below! Now look at the picture again."' },
        { pattern: 'Using "beside" when "between" is more precise (two reference objects)', response: '"Count how many objects are next to it. If there is one on EACH side, we say between."' },
        { pattern: 'Following multi-step directions while keeping track of already-placed objects', response: '"Let\'s go one step at a time. First, where did you put the last object? Now read just the next direction."' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { reader: 'emerging', answers: ['tap'] },
        label: 'Identify (Scaffold 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Multiple-choice: Where is the cat? → above/below/beside',
      },
      {
        evalMode: 'place_in',
        affordances: { answers: ['manipulate'] },
        label: 'Put In — Containment (Scaffold 2)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['place_in'],
        description: 'Containment "in": put an object INSIDE a container — "Put the pencil in the box". Student taps the container itself',
      },
      {
        evalMode: 'place',
        affordances: { answers: ['manipulate'] },
        label: 'Place (Scaffold 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['place'],
        description: 'Place object at described position: Put the ball above the box',
      },
      {
        evalMode: 'describe',
        affordances: { reader: 'emerging', answers: ['tap'] },
        label: 'Describe (Scaffold 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['describe'],
        description: 'Select the position word for a shown arrangement',
      },
      {
        evalMode: 'place_between',
        affordances: { answers: ['manipulate'] },
        label: 'Between — Two References (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['place_between'],
        description: 'Two-reference "between": place an object in the empty spot with one named object on each side',
      },
      {
        evalMode: 'follow_directions',
        affordances: { answers: ['manipulate'] },
        label: 'Follow Directions (Scaffold 4)',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['follow_directions'],
        description: 'Multi-step spatial placement',
      },
    ],
  },
  {
    id: 'shape-composer',
    description: 'Interactive shape composition and decomposition workspace. Students compose larger shapes from smaller pieces (tangram-style), build pictures from shape palettes, and decompose composite shapes into basic components. Supports snap-to-fit placement, rotation, and guided decomposition. Perfect for teaching spatial reasoning, shape relationships, and geometry vocabulary at K-1 level. ESSENTIAL for kindergarten geometry composition standards.',
    constraints: 'Requires K-1 grade band. Challenge types: compose-match, compose-picture, decompose, free-create, how-many-ways.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['build'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'free-create',
        label: 'Free Create (Explore)',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['free-create'],
        description: 'Open-ended shape composition exploration — always succeeds with 2+ shapes',
      },
      {
        evalMode: 'compose-match',
        label: 'Compose Match (Easy)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['compose-match'],
        description: 'Drag pieces to fill a target silhouette with snap-to-fit guidance',
      },
      {
        evalMode: 'compose-picture',
        label: 'Compose Picture (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['compose-picture'],
        description: 'Select and arrange shapes from a palette to recreate a target picture',
      },
      {
        evalMode: 'decompose',
        affordances: { answers: ['tap'] },
        label: 'Decompose (Medium-Hard)',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['decompose'],
        description: 'Identify the basic shape components of a composite shape',
      },
      {
        evalMode: 'how-many-ways',
        label: 'How Many Ways (Hard)',
        beta: 1.0,
        scaffoldingMode: 4,
        challengeTypes: ['how-many-ways'],
        description: 'Determine minimum pieces needed and explore multiple composition solutions',
      },
    ],
    tutoring: {
      taskDescription: 'Compose or decompose shapes. Challenge type: {{challengeType}}. Target: {{targetShape}}.',
      contextKeys: ['challengeType', 'targetShape', 'targetPicture', 'piecesPlaced', 'totalPieces', 'expectedComponents', 'attemptNumber', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the big shape. What smaller shapes could fit inside it?"',
        level2: '"Try the triangle — can you turn it so it fits into the corner? Two triangles can make a square! You\'ve placed {{piecesPlaced}} of {{totalPieces}} pieces."',
        level3: '"Two triangles make one big square. The triangle\'s pointy corner fits right into the square\'s corner. Try rotating the piece — press the rotate button!"',
      },
      commonStruggles: [
        { pattern: 'Piece placed far from target position', response: '"Drag the shape closer to the outline. When it gets close enough, it will snap into place!"' },
        { pattern: 'Student not rotating pieces', response: '"Try the rotate button! Sometimes a shape needs to be turned to fit."' },
        { pattern: 'Wrong shapes selected for decompose', response: '"Look at the edges of the big shape. Can you see where one shape ends and another begins?"' },
        { pattern: 'Stuck on how-many-ways', response: '"Start by trying to fill the shape with just triangles. How many do you need?"' },
      ],
      aiDirectives: [
        {
          title: 'SPATIAL VOCABULARY COACHING',
          instruction:
            'Build spatial vocabulary: "Turn it," "Flip it," "Slide it over," "It fits in the corner." '
            + 'Celebrate creative solutions — there is often more than one way to compose a shape! '
            + 'In free-create mode, describe what you see: "Wow, you used a triangle on top and a square below — that looks like a house!" '
            + 'Never say a solution is wrong if it is geometrically valid.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'net-folder',
    description: '3D shape net folding/unfolding visualization with CSS 3D transforms. Shows relationship between 3D solids and 2D nets. Students rotate solids, unfold into nets, match face correspondence, validate nets, and calculate surface area. Supports cube, rectangular prism, triangular prism, and pyramid. Perfect for teaching spatial reasoning, 3D geometry, and surface area at grades 3-5. ESSENTIAL for geometry standards.',
    constraints: 'Requires grade 3-5. Solid types: cube, rectangular_prism, triangular_prism, square_pyramid, triangular_pyramid. Challenge types: identify_solid, match_faces, valid_net, surface_area, count_faces_edges_vertices.',
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap', 'type'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'count_faces_edges_vertices',
        affordances: { answers: ['type'] },
        label: 'Count FEV (Easy)',
        beta: -0.8,
        scaffoldingMode: 1,
        challengeTypes: ['count_faces_edges_vertices'],
        description: 'Count faces, edges, and vertices of a 3D solid',
      },
      {
        evalMode: 'identify_solid',
        affordances: { answers: ['tap'] },
        label: 'Identify Solid (Easy-Medium)',
        beta: -0.3,
        scaffoldingMode: 2,
        challengeTypes: ['identify_solid'],
        description: 'Identify the 3D solid from its appearance or net',
      },
      {
        evalMode: 'match_faces',
        affordances: { answers: ['tap'] },
        label: 'Match Faces (Medium)',
        beta: 0.2,
        scaffoldingMode: 3,
        challengeTypes: ['match_faces'],
        description: 'Match highlighted net faces to corresponding solid faces',
      },
      {
        evalMode: 'valid_net',
        affordances: { answers: ['tap'] },
        label: 'Valid Net (Medium-Hard)',
        beta: 0.7,
        scaffoldingMode: 4,
        challengeTypes: ['valid_net'],
        description: 'Determine whether a given 2D net folds into a valid solid',
      },
      {
        evalMode: 'surface_area',
        affordances: { representation: 'symbolic', answers: ['type'] },
        label: 'Surface Area (Hard)',
        beta: 1.2,
        scaffoldingMode: 5,
        challengeTypes: ['surface_area'],
        description: 'Calculate surface area by summing face areas from the net',
      },
    ],
    tutoring: {
      taskDescription: 'Explore a 3D {{solidType}} ({{solidName}}) and its 2D net. Challenge type: {{challengeType}}.',
      contextKeys: ['solidType', 'solidName', 'faces', 'edges', 'vertices', 'netLayout', 'gradeBand', 'challengeType', 'instruction', 'attemptNumber', 'isFolded'],
      scaffoldingLevels: {
        level1: '"Look at the 3D shape. How many flat surfaces can you see?"',
        level2: '"Try unfolding the shape. Each face of the solid becomes a flat piece in the net. Can you match the {{highlightedFace}} face?"',
        level3: '"This is a {{solidName}} with {{faces}} faces. When you unfold it, the top face connects to the front. Count each face in the net — they should match the solid exactly."',
      },
      commonStruggles: [
        { pattern: 'Student confuses faces and edges', response: '"A face is a flat surface — like the side of a box. An edge is where two faces meet — like a crease in the box."' },
        { pattern: 'Student cannot match net faces to solid', response: '"Try the fold button to watch it fold up. See how the net piece becomes a face on the 3D shape?"' },
        { pattern: 'Student miscounts surface area', response: '"Count the unit squares on each face separately, then add them all up. Write down each face area first."' },
        { pattern: 'Student thinks invalid net is valid', response: '"Try folding the net in your mind. Do any faces overlap? If two pieces would end up on the same spot, it cannot fold into a solid."' },
      ],
      aiDirectives: [
        {
          title: 'SPATIAL REASONING COACHING',
          instruction:
            'Guide students to build spatial visualization skills. '
            + 'For grade 3: focus on naming shapes, counting faces/edges/vertices. Use concrete language: "This flat surface is called a face." '
            + 'For grade 4: focus on net-solid correspondence. Encourage using the fold/unfold toggle: "Watch what happens when we unfold it!" '
            + 'For grade 5: connect nets to surface area calculation. "Each face in the net has an area — add them all for surface area!" '
            + 'Never give the answer directly — guide toward spatial insight.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'equation-builder',
    description: 'Interactive equation-building manipulative where students construct, evaluate, and balance equations using draggable number and operator tiles. Teaches that the equal sign means "same amount on both sides," not "answer comes next." Supports build, missing-value, true-false, balance, and rewrite challenge types across scaffolding levels. ESSENTIAL for K-2 equation understanding.',
    constraints: 'Requires grade band (K-2). Challenges array drives interactivity. Each challenge specifies a challengeType and target equation.',
    // reader: 'developing' — WRONG-BAND @ PRE (qa/reader-fit/equation-builder-PRE-2026-09-05.md).
    // The build target is stated ONLY in an English sentence and the true/false answer surface is
    // two English words, with no read-aloud directive. No band floor was added (user ruling: make
    // it age-friendly, never floor it) — the demand is recorded here instead.
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['build', 'type', 'tap'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'Build and reason about equations using draggable tiles. Challenge type: {{challengeType}}. Instruction: {{instruction}}. Equation: {{equation}}. Grade band: {{gradeBand}}.',
      contextKeys: ['challengeType', 'instruction', 'equation', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Read the equation out loud. What does each part mean?"',
        level2: '"The equal sign means both sides must show the same amount. What is on the left side? What needs to be on the right side?"',
        level3: '"Let\'s work through it together: count the value on one side first, then think about what makes the other side match."',
      },
      commonStruggles: [
        { pattern: 'Treats = as "answer comes next" — always puts result on right side', response: '"The equal sign doesn\'t mean \'the answer is.\' It means both sides are the SAME amount. Can you check: is the left side the same as the right side?"' },
        { pattern: 'Drags tiles to wrong positions or places operator tiles in number slots', response: '"Look at the shape of each slot. Number tiles go where numbers belong, and the + or − tile goes between them."' },
        { pattern: 'Cannot balance both sides — only changes one side', response: '"Both sides of the equal sign must show the same amount. If you change one side, check: does the other side still match?"' },
        { pattern: 'Guesses randomly on true/false without computing', response: '"Before you pick true or false, figure out the value on each side. Are they the same number?"' },
      ],
      aiDirectives: [
        {
          title: 'EQUAL SIGN CONCEPTUAL COACHING',
          instruction:
            'The equal sign is the most misunderstood symbol in elementary math. Students often think = means "the answer is" rather than "both sides are the same amount." '
            + 'Consistently model relational language: "Is the left side the same as the right side?" '
            + 'For balance and rewrite modes, emphasize that both sides must always show the same value. '
            + 'Never say "the answer is" — always say "both sides equal" or "both sides are the same."',
        },
        {
          title: 'CHALLENGE TYPE COACHING',
          instruction:
            'For BUILD: guide tile placement — "Which number tile goes first? What operation are we using?" '
            + 'For MISSING-VALUE: direct attention to the known side — "What does the complete side equal? The other side must be the same." '
            + 'For TRUE-FALSE: require computation before judgment — "Calculate each side, then compare." '
            + 'For BALANCE: focus on the equal sign — "What is on the left? What do you need on the right to make them the same?" '
            + 'For REWRITE: show equivalence — "Can you write this equation a different way that still means the same thing?"',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build-simple',
        affordances: { answers: ['build'] },
        label: 'Build Simple',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Build a given equation from tiles.',
      },
      {
        evalMode: 'missing-result',
        affordances: { answers: ['type'] },
        label: 'Missing Result',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['missing-value'],
        description: 'Find the result of an equation (? after =).',
      },
      {
        evalMode: 'true-false',
        affordances: { answers: ['tap'] },
        label: 'True or False',
        beta: 2.0,
        scaffoldingMode: 3,
        challengeTypes: ['true-false'],
        description: 'Determine if an equation is true or false.',
      },
      {
        evalMode: 'missing-operand',
        affordances: { answers: ['type'] },
        label: 'Missing Operand',
        beta: 2.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-value'],
        description: 'Find a missing operand (? before =).',
      },
      {
        evalMode: 'balance-both-sides',
        affordances: { answers: ['build'] },
        label: 'Balance Both Sides',
        beta: 3.5,
        scaffoldingMode: 5,
        challengeTypes: ['balance'],
        description: 'Make both sides of = equal.',
      },
      {
        evalMode: 'rewrite',
        affordances: { answers: ['build'] },
        label: 'Rewrite',
        beta: 4.0,
        scaffoldingMode: 6,
        challengeTypes: ['rewrite'],
        description: 'Express an equation in a different form.',
      },
    ],
  },
  {
    id: 'compare-objects',
    misconceptionScope: 'primitive',
    description: 'Live tutor-judged measurement comparison (DI modality) on drawings of real-world objects. The Live tutor asks with scripted lines, judges the child in-band, and its own affirmation advances the lesson. What the child produces depends on the skill: they SAY OUT LOUD what the picture lets us measure — how long, how tall, how heavy, or how much it holds (identify-attribute, both grades); they SAY THE NAME of the object that is longer, taller, heavier or holds more (compare-two, both grades); they SAY THE COUNT of non-standard units laid along an object (non-standard, Grade 1); and they answer WITH THEIR HANDS by touching three objects in order (order-three, Grade 1) — there the arrangement IS the answer. Builds the measurement vocabulary K.MD.1 asks children to SPEAK. ESSENTIAL for Kindergarten and Grade 1 measurement and data (K.MD.1-2).',
    constraints: 'Best for grades K-1. Requires a microphone: three of the four answers are spoken and judged by the Live tutor, and there is no Check button, no attribute chips, no object buttons and no typed number anywhere. Kindergarten uses identify-attribute and compare-two only; order-three and non-standard are Grade 1. Unit counts run 1-20, so every spoken number is a single word. A comparison whose drawing disagrees with its answer, whose two object names cannot be told apart by ear, or whose attribute menu offers both length and height is discarded before the child ever sees it.',
    // reader: 'none' — "no Check button, no attribute chips, no object buttons and no typed
    // number anywhere" (constraints above); three of four modes are spoken, order_three is hands.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription: 'LIVE-JUDGED measurement comparison practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD or WITH THEIR HANDS on the screen, you judge what you heard, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. The question side of what is on screen: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ 18d, applied at BIRTH: no level of this ladder may OFFER a speakable
      // line of its own. A quoted hint here is a sanctioned-sounding
      // replacement for the scripted correction at exactly the moment 18c
      // makes the model want one — it opens with neither sentinel, so the
      // engine sees no verdict and the correction counter stalls. The ladder
      // commands script fidelity; it never supplies an alternative.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never compare the objects aloud and never name any part of the answer.',
        level2: 'A wrong answer is never met with a hint of your own — speak the cue\'s scripted "My turn:" correction again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction line models the comparison and re-asks for you. Never invent encouragement, a new question, or a softer hint.',
      },
      commonStruggles: [
        { pattern: 'Long silence', response: 'Silence is the child looking and thinking — wait. If they truly seem stuck, re-speak the current ask once; never answer for them.' },
        { pattern: 'Names the object that is the other way round (says the longer one when asked which is shorter)', response: 'The scripted correction handles this AFTER the attempt is judged: it models how to compare and re-asks. Never interrupt mid-attempt.' },
        { pattern: 'Answers with a pointing word instead of a name ("that one", "the first one")', response: 'That does not answer the question, so it is wrong: speak the scripted correction, which asks for the name again.' },
        { pattern: 'Counts the object\'s starting edge as a unit and lands one too many', response: 'The scripted correction counts the units with the child and re-asks. Speak only that line.' },
        { pattern: 'The same wrong answer comes twice in a row', response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — IT DIFFERS BY CHALLENGE TYPE',
          instruction:
            'The current type is {{challengeType}}, and every cue states which kind of answer its item wants. '
            + 'On identify-attribute the answer is what the picture lets us measure, in the child\'s words or the grown-up word — both are right. '
            + 'On compare-two the answer is ONE object name and nothing else; a pointing word with no name does not answer the question. '
            + 'On non-standard the answer is ONE number word, and counting out loud on the way to it is the child working, not answering. '
            + 'The cue names the correct answer, the wrong answer most likely to sound right, and the right answer that may not look right — judge by that cue and nothing else. '
            + 'On a HANDS item (order-three) the child answers by touching the objects in order, and you are told what order they made and whether it matches. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'An affirmation is the WHOLE turn. After it, stop speaking — never carry on into another question, another object, or the next item, '
            + 'even one you can see on the screen. The next ask always arrives as its own cue.',
        },
        {
          title: 'ORDERING ITEMS ARE SILENT',
          instruction:
            'When the cue tells you the child answers with their hands, say nothing at all while they work — no counting, no narration, no naming which one comes first. '
            + 'You will be told what order they made and whether it matches; only then do you speak the line the cue gives you.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never compare the objects out loud, and never prompt while the child is looking. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again. That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'identify_attribute',
        affordances: { answers: ['spoken'] },
        label: 'Identify Attribute (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify_attribute'],
        // β HELD. The chips are gone, but the tutor still NAMES the closed menu
        // aloud — it has to, or the question is ambiguous rather than harder —
        // so the guess floor is unchanged at 1-in-N. What changed is that the
        // vocabulary now leaves the child's mouth, which is what K.MD.1 asks
        // for and not a difficulty tier.
        description: 'Say what the picture lets us measure — how long, how tall, how heavy, or how much it holds. The tutor names the choices and judges the spoken answer; the child\'s words and the grown-up word both count.',
      },
      {
        evalMode: 'compare_two',
        affordances: { answers: ['spoken'] },
        label: 'Compare Two (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare_two'],
        // β HELD on the number-bond / ASS precedent: a two-button tap became
        // unaided speech, a structural change, but a 1-of-2 menu is the weakest
        // there is and the ask still names both objects, so the guess floor it
        // removed is small and β is per MODE.
        description: 'Say the NAME of the object that is longer, taller, heavier or holds more. Spoken production, judged by the Live tutor; no buttons.',
      },
      {
        evalMode: 'order_three',
        affordances: { answers: ['manipulate'] },
        label: 'Order Three (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['order_three'],
        // β HELD — the same touch-in-order surface; only the Check button
        // became a stillness close, and an incomplete order now commits (and is
        // corrected) where it used to be refused with a nudge.
        description: 'Put 3 objects in order by a measurable attribute, touching them one at a time; the tutor judges the committed order. The arrangement IS the answer, so this one is answered with hands. Grade 1.',
      },
      {
        evalMode: 'non_standard',
        affordances: { answers: ['spoken'] },
        label: 'Non-Standard Measure (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['non_standard'],
        // β HELD — the keypad was already unaided production, so replacing it
        // with the mouth changes the CHANNEL, not the task. The count-along
        // numbering on the unit boxes is now a post-answer reveal rather than a
        // permanent aid, which is an answer-leak fix, not a difficulty lever.
        description: 'Count non-standard units (paper clips, cubes) laid along an object and SAY how many. Spoken number word, 1-20. Grade 1.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'formula-lab',
    description: 'Interactive Formula Lab for grades 6-12 math and science relationship reasoning. Students hold other variables constant while they explore a living system, predict direction or relative magnitude, construct the symbolic relationship, and transfer the same formula to a new setting with the output withheld. Perfect for building conceptual understanding of direct, inverse, and nonlinear formulas before calculation or memorization. ESSENTIAL for middle-school and high-school algebra, physics, chemistry, and quantitative science.',
    constraints: 'Use only scalar formulas expressible with 2-3 numeric input variables and restricted +, -, *, /, and ^ arithmetic. The manifest must NOT supply specific per-challenge values, variable settings, predictions, or answers — the generator builds the local value pool and derives every challenge deterministically. Supply only topic, grade-level context, and session-level formula metadata.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'type'], role: ['visualize', 'apply'], minutes: 6 },
    tutoring: {
      taskDescription:
        'Investigate how {{changedVariable}} affects {{outputName}} in {{challengeType}} mode. '
        + 'Relationship available to the student: {{formulaContext}}. Experiment {{currentChallengeIndex}} of {{totalChallenges}}.',
      contextKeys: [
        'title',
        'context',
        'formulaContext',
        'outputName',
        'challengeType',
        'changedVariable',
        'currentChallengeIndex',
        'totalChallenges',
        'predictionLocked',
        'predictionDirection',
        'currentInputValue',
        'targetInputValue',
        'challengeComplete',
      ],
      scaffoldingLevels: {
        level1: 'Ask one question that points the student to the role {{changedVariable}} plays in the displayed relationship.',
        level2:
          'Prompt the student to hold every other input constant, compare {{currentInputValue}} with {{targetInputValue}}, '
          + 'and decide whether {{changedVariable}} is multiplied, divided, or raised to a power before testing.',
        level3:
          'Guide a three-step check without supplying the result: identify the structural role of {{changedVariable}}, '
          + 'state a prediction in words, then test it against the living system and explain any mismatch.',
      },
      commonStruggles: [
        {
          pattern: 'Predicts that the output changes in the same direction in every experiment',
          response: 'Ask the student to locate {{changedVariable}} and name whether it is a multiplier, divisor, or exponent before revising the prediction.',
        },
        {
          pattern: 'Tries to move the input before committing a prediction',
          response: 'Pause the test and ask for a signed prediction first; explain that prediction-before-testing makes the experiment informative.',
        },
        {
          pattern: 'Reasons as though several inputs changed at once',
          response: 'Restate that only {{changedVariable}} changes while every other input is held constant, then ask which comparison isolates its effect.',
        },
        {
          pattern: 'Starts arithmetic without interpreting the relationship structure',
          response: 'Ask for a verbal description of the variable role and expected change before any substitution or calculation.',
        },
        {
          pattern: 'Repeatedly assembles the formula tokens in an invalid order',
          response: 'Coach one operation or parenthesized group at a time without naming the next token or revealing the completed expression.',
        },
      ],
      aiDirectives: [
        {
          title: 'FORMULA LAB ANSWER BOUNDARIES',
          instruction:
            'Treat {{formulaContext}} as the exact visibility boundary. If it says the expression is withheld, never infer, state, '
            + 'or confirm the formula or token order. Before predictionLocked is true, never state the actual direction or magnitude. '
            + 'Before challengeComplete is true, never state a withheld output. Scaffold from variable roles, controlled comparison, '
            + 'substitution, and operation order without completing the student\'s response.',
        },
        {
          title: 'TAGGED FORMULA LAB MOMENTS',
          instruction:
            'For [ACTIVITY_START], orient briefly without previewing a result. For [PREDICTION_LOCKED], give one short testing cue '
            + 'without revealing the outcome. For [ANSWER_INCORRECT], give one actionable hint rather than the answer. '
            + 'For [ANSWER_CORRECT], connect the observed evidence to the relationship in one or two sentences. '
            + 'For [NEXT_ITEM], introduce only the supplied visible task data. For [ALL_COMPLETE], celebrate the reasoning habits practiced.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'free-explore',
        affordances: { answers: ['manipulate'] },
        label: 'Free Explore (Tier 1)',
        beta: 1.5,
        discrimination: 1.8,
        scaffoldingMode: 1,
        challengeTypes: ['free-explore'],
        description: 'Move one input with the output visible and observe the response while every other quantity stays fixed.',
      },
      {
        evalMode: 'predict-direction',
        affordances: { answers: ['tap'] },
        label: 'Predict Direction (Tier 2)',
        beta: 2.5,
        discrimination: 1.6,
        scaffoldingMode: 2,
        challengeTypes: ['predict-direction'],
        description: 'Commit whether the output will increase, decrease, or stay about the same before testing the system.',
      },
      {
        evalMode: 'predict-magnitude',
        affordances: { answers: ['manipulate'] },
        label: 'Predict Magnitude (Tier 3)',
        beta: 3.5,
        discrimination: 1.6,
        scaffoldingMode: 3,
        challengeTypes: ['predict-magnitude'],
        description: 'Produce a signed relative-strength prediction and score it by distance from the observed change marker.',
      },
      {
        evalMode: 'construct-formula',
        affordances: { answers: ['build'] },
        label: 'Construct Formula (Tier 4)',
        beta: 5.0,
        discrimination: 1.8,
        scaffoldingMode: 4,
        challengeTypes: ['construct-formula'],
        description: 'Assemble the hidden symbolic expression from variables, numbers, parentheses, and operators.',
      },
      {
        evalMode: 'transfer-apply',
        affordances: { answers: ['type'] },
        label: 'Transfer & Apply (Tier 6)',
        beta: 8.0,
        discrimination: 1.6,
        scaffoldingMode: 6,
        challengeTypes: ['transfer-apply'],
        description: 'Apply the relationship in a related new context and calculate a withheld output from supplied inputs.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'parameter-explorer',
    description: 'Multi-variable formula explorer with interactive sliders. Students adjust parameters via continuous sliders to observe how output changes in real-time. Supports prediction checkpoints and hold-and-vary (lock variables). Perfect for exploring STEM relationships (physics, chemistry, economics). ESSENTIAL for grade 6-12 science and math.',
    constraints: 'Requires jsExpression (JS-evaluable formula) alongside LaTeX formula. Parameters need numeric min/max/step ranges. Works best with 2-3 parameters.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['manipulate'] },
        label: 'Explore (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['explore'],
        description: 'Free exploration with guided observations, no scoring pressure',
      },
      {
        evalMode: 'predict-direction',
        affordances: { answers: ['tap'] },
        label: 'Predict Direction (Tier 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict-direction'],
        description: 'Predict whether output increases, decreases, or stays the same when a parameter changes',
      },
      {
        evalMode: 'identify-relationship',
        affordances: { answers: ['tap'] },
        label: 'Identify Relationship (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['identify-relationship'],
        description: 'Identify which parameter has the strongest effect on the output',
      },
      {
        evalMode: 'predict-value',
        affordances: { answers: ['type'] },
        label: 'Predict Value (Tier 4)',
        beta: 3.5,
        scaffoldingMode: 4,
        challengeTypes: ['predict-value'],
        description: 'Quantitative prediction of the output value after a parameter change',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring the formula {{formula}} by adjusting parameter sliders. They are investigating how changing {{outputName}} relates to the parameters.',
      contextKeys: ['formula', 'outputName', 'paramValues', 'outputValue', 'exploredParams', 'lockedParams', 'currentChallengeType'],
      scaffoldingLevels: {
        level1: '"Which parameter do you think has the biggest effect on the output? Try moving one slider at a time."',
        level2: '"Look at the formula — {{outputName}} depends on the parameters. Try locking all variables except one (click the lock icon) and observe what happens as you change it."',
        level3: '"Let\'s think step by step. The formula is {{formula}}. If you increase {{varyParameter}}, look at where it appears in the formula — is it in the numerator or denominator? What does that tell you about the direction of change?"',
      },
      commonStruggles: [
        { pattern: 'Student has not moved any sliders after 30 seconds', response: 'Encourage the student to start by picking any parameter and moving its slider slowly to see what happens.' },
        { pattern: 'Student is moving all sliders at once', response: 'Suggest using the lock feature to hold all variables constant except one — this is called "controlling variables" and helps isolate each effect.' },
        { pattern: 'Student incorrectly predicts direction for inversely related variable', response: 'Guide the student to look at where the variable appears in the formula — if it is in the denominator, increasing it will decrease the output.' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'equation-workspace',
    description: 'Step-by-step algebraic manipulation workspace where students isolate a target variable by selecting operations (divide, multiply, take arcsin, square root, etc.) applied to both sides of an equation. Supports guided-solve with highlighted hints, identify-operation multiple choice, free-solve, and multi-step challenges requiring 4+ operations. Covers linear, quadratic, trigonometric, and calculus-level equations. Pedagogical moments: STEP_CORRECT (after each correct operation), ANSWER_CORRECT (equation solved), ANSWER_INCORRECT (wrong operation selected), NEXT_ITEM (advancing to next challenge), ALL_COMPLETE (all challenges done). ESSENTIAL for grades 9-12+ algebra through calculus.',
    constraints: 'Best for grades 9-12+. Requires equation string and target variable. Multi-step mode requires equations needing 4+ operations. Guided-solve highlights valid operations as hints.',
    affordances: { representation: 'symbolic', answers: ['tap'], role: 'apply', minutes: 8 },
    evalModes: [
      {
        evalMode: 'guided-solve',
        label: 'Guided Solve (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['guided-solve'],
        description: 'Operations highlighted as hints, student clicks in order',
      },
      {
        evalMode: 'identify-operation',
        label: 'Identify Operation (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify-operation'],
        description: 'Given partially-solved equation, identify the next valid step (MC)',
      },
      {
        evalMode: 'solve',
        label: 'Solve (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 4,
        challengeTypes: ['solve'],
        description: 'Student picks operations freely, single-path validation',
      },
      {
        evalMode: 'multi-step',
        label: 'Multi-Step (Tier 4)',
        beta: 4.0,
        scaffoldingMode: 5,
        challengeTypes: ['multi-step'],
        description: 'Longer equations requiring 4+ steps to solve',
      },
    ],
    tutoring: {
      taskDescription: 'Student is solving the equation {{equation}} for {{targetVariable}} by selecting algebraic operations step by step.',
      contextKeys: ['equation', 'targetVariable', 'solutionSteps', 'context', 'variableDefinitions'],
      scaffoldingLevels: {
        level1: '"What operation would help you move terms away from {{targetVariable}}?"',
        level2: '"Look at what\'s attached to {{targetVariable}} — what\'s the inverse operation? Try working from the outside in."',
        level3: '"To isolate {{targetVariable}}, first {{solutionSteps[0].operation}}, then continue step by step."',
      },
      commonStruggles: [
        { pattern: 'Student repeatedly selects arithmetic operations when algebraic ones are needed', response: 'Guide them to think about what operation "undoes" what is currently applied to the target variable' },
        { pattern: 'Student applies operations in wrong order', response: 'Remind them to work from the outermost operation inward — peel off layers one at a time' },
        { pattern: 'Student uses hints frequently', response: 'Encourage them to read the equation carefully and identify what is being done to the target variable before looking at operations' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'function-sketch',
    description: 'Multi-challenge qualitative function reasoning primitive for grades 9-12. Each session walks the student through 3-6 distinct functions in the same eval mode (orchestrator-same-mode pattern). Students analyze function behavior by shape, key features, and family — without computing exact values. Supports four challenge types: classify-shape (linear/quadratic/exponential/periodic), identify-features (roots, extrema, intercepts, asymptotes), compare-functions (two curves, match to description), and sketch-match (place control points to sketch a described function). Pedagogical moments: FEATURE_FOUND, ANSWER_CORRECT, ANSWER_INCORRECT, NEXT_ITEM, ALL_COMPLETE. ESSENTIAL for Algebra 2, Precalculus, and AP Calculus qualitative reasoning.',
    constraints: 'Best for grades 9-12. The manifest must NOT supply specific functions, expressions, curves, or features — the generator picks 3-6 distinct functions locally per the selected eval mode via N parallel Gemini sub-generator calls. Requires only a title and context string at the session level. Sketch-match requires control-point placement UI; identify-features requires annotatable curve with clickable feature markers.',
    affordances: { representation: 'symbolic', answers: ['tap'], role: 'apply', minutes: 6 },
    evalModes: [
      {
        evalMode: 'classify-shape',
        label: 'Classify Shape (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['classify-shape'],
        description: 'Identify if a curve is linear, quadratic, exponential, or periodic',
      },
      {
        evalMode: 'identify-features',
        label: 'Identify Features (Tier 2)',
        beta: 2.0,
        scaffoldingMode: 3,
        challengeTypes: ['identify-features'],
        description: 'Mark roots, extrema, intercepts, asymptotes on a given curve',
      },
      {
        evalMode: 'compare-functions',
        label: 'Compare Functions (Tier 3)',
        beta: 2.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare-functions'],
        description: 'Two curves shown — identify which matches a description',
      },
      {
        evalMode: 'sketch-match',
        affordances: { answers: ['manipulate'] },
        label: 'Sketch Match (Tier 4)',
        beta: 3.5,
        scaffoldingMode: 5,
        challengeTypes: ['sketch-match'],
        description: 'Place control points to sketch a described function',
      },
    ],
    tutoring: {
      taskDescription: 'Function-sketch session: {{challengeType}}, {{totalChallenges}} functions. Currently on function {{currentChallengeIndex}}/{{totalChallenges}} in "{{title}}" — {{context}}.',
      contextKeys: ['title', 'context', 'challengeType', 'currentChallengeIndex', 'totalChallenges'],
      scaffoldingLevels: {
        level1: '"What do you notice about the shape of this function? What familiar patterns do you see?"',
        level2: '"Look at where the function crosses the x-axis — those are roots. Where does it reach its highest/lowest points? Use {{context}} to guide your thinking."',
        level3: '"Let me walk through this step by step: First, identify the general family (linear, quadratic, trig, exponential). Then look for key features: intercepts, turning points, symmetry, and end behavior."',
      },
      commonStruggles: [
        { pattern: 'Confuses roots with extrema', response: 'Roots are where the curve crosses the x-axis (y=0). Extrema are the peaks and valleys of the curve.' },
        { pattern: 'Places control points too close together', response: 'Try spreading your points across the full x-range. Focus on getting the key features (peaks, zeros, intercepts) in roughly the right positions.' },
        { pattern: 'Cannot distinguish function families', response: 'Linear = straight line. Quadratic = single U or arch. Exponential = starts slow then grows fast (or decays). Periodic = repeats.' },
      ],
      aiDirectives: [
        {
          title: 'MULTI-FUNCTION PACING',
          instruction:
            'This is a multi-function session — the student is on function {{currentChallengeIndex}} of {{totalChallenges}}. '
            + 'Each function is fresh content (different family, expression, or curve pair). Do not re-explain the strategy from scratch every time — '
            + 'scaffold on function 1, encourage independence on function 2+, and celebrate cross-function patterns (e.g. "you spotted the parabola again — what gives it away?").',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'distribution-explorer',
    description: 'Live workbench for probability distributions (binomial, Poisson, exponential). Students manipulate parameter sliders and watch the PMF/PDF, CDF, and moments update in real time. Supports four phase-gated challenge modes: free guided exploration, family identification from shape/moments, basic single-distribution probability computation, and advanced conditional/tail/percentile reasoning. ESSENTIAL for probability, statistics, and actuarial topics.',
    constraints: 'Requires a topic with a probabilistic structure. Each eval mode produces phase-appropriate challenges: explore (no graded answer), identify (family MCQ), compute (numeric input with tolerance), predict_shape (free-text or MCQ description). Math is computed client-side from the chosen family — Gemini authors framing + challenges only.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'type'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['manipulate'] },
        label: 'Explore (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['guided_exploration'],
        description: 'Free parameter manipulation with guided prompts; no graded answer.',
      },
      {
        evalMode: 'identify',
        affordances: { answers: ['tap'] },
        label: 'Identify (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['identify'],
        description: 'Identify the distribution family from shape, moments, or a real-world scenario.',
      },
      {
        evalMode: 'compute_basic',
        affordances: { answers: ['type'] },
        label: 'Compute Basic (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['compute'],
        description: 'Single-distribution probability and moment calculations from a given (family, params) scenario.',
      },
      {
        evalMode: 'compute_advanced',
        affordances: { answers: ['type', 'tap'] },
        label: 'Compute Advanced (Tier 4)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['compute', 'predict_shape'],
        description: 'Conditional probabilities, tail probabilities, percentile lookups, and shape prediction.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring the {{family}} distribution in eval mode "{{evalMode}}" with parameters {{parameters}}. Current challenge: {{currentPrompt}}.',
      contextKeys: ['family', 'evalMode', 'parameters', 'currentPrompt', 'currentChallengeType', 'attemptNumber', 'lastAnswer', 'momentSnapshot'],
      scaffoldingLevels: {
        level1: '"What does the chart tell you about how likely each outcome is? Try changing one parameter and watch what shifts."',
        level2: '"Look at the moments panel — the mean tells you the average, variance tells you the spread. How does that match the {{family}} formulas?"',
        level3: '"For {{family}}, the mean and variance follow specific formulas. For Binomial(n,p): E[X]=np, Var[X]=np(1-p). For Poisson(λ): both equal λ. For Exponential(rate): E[X]=1/rate, Var=1/rate²."',
      },
      commonStruggles: [
        { pattern: 'Confusing rate vs mean for exponential', response: '"For Exponential(rate=λ), the MEAN is 1/λ, not λ. A higher rate means events happen MORE often, so the mean wait time is SHORTER."' },
        { pattern: 'Treating Poisson as continuous', response: '"Poisson is DISCRETE — it counts events. The PMF gives P(X=k) for integer k. There is no probability at non-integer values."' },
        { pattern: 'Ignoring memorylessness on exponential conditionals', response: '"Exponential is memoryless: P(T > s+t | T > s) = P(T > t). The past does not matter — only how much more time you ask about."' },
        { pattern: 'Forgetting Binomial parameter constraints', response: '"Binomial needs an integer n and 0 < p < 1. The mean np must be between 0 and n."' },
        { pattern: 'Reading PMF probabilities as densities', response: '"For discrete families (binomial, Poisson), each bar is the actual probability P(X=k). For continuous (exponential), the curve is a density — you need to integrate to get a probability."' },
      ],
      aiDirectives: [
        {
          title: 'PARAMETER-DRIVEN COACHING',
          instruction:
            'When the student manipulates the sliders, narrate the visible change in pedagogical terms. '
            + '"You raised λ from 2 to 5 — notice how the Poisson distribution shifted right and the variance grew (because mean = variance = λ)." '
            + 'Always tie a parameter change to one of: mean, variance, support, shape (skewness), or tail behavior. '
            + 'Never reveal the answer to a pending challenge through a parameter observation.',
        },
        {
          title: 'EVAL-MODE-AWARE GUIDANCE',
          instruction:
            'For EXPLORE: validate the student\'s observation, do not push to a specific answer. The phase has no graded outcome. '
            + 'For IDENTIFY: contrast distractor families — "Why not Poisson here? Look at the support." Use shape, support, and the mean/variance relationship. '
            + 'For COMPUTE BASIC: walk through the formula, then plug values. Make sure the student understands WHICH probability is being asked (P(X=k), P(X≤k), P(X>k)). '
            + 'For COMPUTE ADVANCED: emphasize the conditional structure. "Given X has already happened, what is the new sample space?" For exponential conditionals, invoke memorylessness explicitly.',
        },
        {
          title: 'NO ANSWER LEAKAGE',
          instruction:
            'Never name the correct family before an identify challenge is committed. '
            + 'Never compute the answer to a compute challenge before the student attempts it — even if asked directly. Instead, restate the problem and offer a structural hint.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
