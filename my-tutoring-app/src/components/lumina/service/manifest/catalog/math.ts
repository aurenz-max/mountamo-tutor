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
    description: 'Comparative bar visualization showing relative values. Perfect for comparing quantities, showing differences, or teaching basic arithmetic comparisons. ESSENTIAL for elementary math.',
    constraints: 'Requires numeric values to compare',
    tutoring: {
      taskDescription: 'Compare quantities using proportional bars. Values: {{values}}.',
      contextKeys: ['values'],
      scaffoldingLevels: {
        level1: '"Which bar is taller? What does that tell us?"',
        level2: '"Look at the difference between the bars. How much more is the larger one?"',
        level3: '"The first bar shows {{value1}} and the second shows {{value2}}. Subtract to find the difference."',
      },
      commonStruggles: [
        { pattern: 'Ignoring scale', response: 'Look at the numbers on each bar, not just the height' },
        { pattern: 'Confusing more/less', response: '"Taller bar = bigger number. Which bar is taller?"' },
      ],
      aiDirectives: [
        {
          title: 'COMPARISON LANGUAGE COACHING',
          instruction:
            'Model precise comparison language: "more than," "less than," "the difference is." '
            + 'For K-2 students, use concrete language: "This bar is taller, so there are MORE." '
            + 'For grades 3-5, guide toward subtraction: "How many more? Subtract to find out." '
            + 'Never just say "bigger" — always tie bar height to the actual quantity it represents.',
        },
      ],
    },
  },
  {
    id: 'number-line',
    description: 'Interactive number line with drag-to-plot, animated jump arcs, ordering, and zoom. Supports integers, fractions, decimals, and mixed numbers. K-2 mode (0-20, counting) and 3-5 mode (negatives, fractions, operations). Perfect for teaching number placement, addition/subtraction as movement, fraction comparison, and ordering. ESSENTIAL for K-5 math.',
    constraints: 'Requires numeric range. Jump mode requires operations array. Challenges drive interactivity.',
    tutoring: {
      taskDescription: 'Work with a number line from {{rangeMin}} to {{rangeMax}} using {{numberType}} numbers in {{interactionMode}} mode.',
      contextKeys: ['rangeMin', 'rangeMax', 'numberType', 'interactionMode', 'gradeBand', 'instruction', 'challengeType', 'targetValues', 'placedPoints', 'attemptNumber', 'currentPhase'],
      scaffoldingLevels: {
        level1: '"Look carefully at the number line. Where do you think that value belongs?"',
        level2: '"Count the tick marks from {{rangeMin}}. Each mark is one step. How many steps to reach your target?"',
        level3: '"Let me help: start at {{rangeMin}} and count each tick mark. Point to each one as you count: {{rangeMin}}, then the next mark is {{rangeMin}} + 1..."',
      },
      commonStruggles: [
        { pattern: 'Placing point far from target value', response: '"Look at the numbers under the tick marks. Find the two numbers your target is between, then place your point between them."' },
        { pattern: 'Confusing addition direction with subtraction', response: '"Remember: adding moves RIGHT on the number line (numbers get bigger), subtracting moves LEFT (numbers get smaller)."' },
        { pattern: 'Ordering fractions incorrectly', response: '"Try zooming in to see the fraction marks. Compare each fraction to 1/2 first — is it more or less than half?"' },
        { pattern: 'Not using zoom for precision', response: '"Try the zoom buttons to see smaller divisions between the numbers. This helps place fractions and decimals more precisely."' },
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
            'For K-2: use counting language — "Let\'s count the hops: 1, 2, 3..." Keep to whole numbers 0-20. '
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
        label: 'Order (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order_values'],
        description: 'Sequence multiple values on number line.',
      },
      {
        evalMode: 'between',
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
        label: 'Build Number (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_number'],
        description: 'Concrete manipulative: student builds a target number by placing blocks in place value columns.',
      },
      {
        evalMode: 'read_blocks',
        label: 'Read Blocks (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['read_blocks'],
        description: 'Pictorial recognition: student identifies the number represented by pre-placed blocks.',
      },
      {
        evalMode: 'regroup',
        label: 'Regroup (Strategy)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['regroup'],
        description: 'Strategy: student regroups blocks by trading 10 of one unit for 1 of the next.',
      },
      {
        evalMode: 'operate',
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
        label: 'Identify (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name the fraction shown on the circle.',
      },
      {
        evalMode: 'build',
        label: 'Build (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build'],
        description: 'Construct a given fraction by shading slices.',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Compare two fractions visually.',
      },
      {
        evalMode: 'equivalent',
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
    description: 'Multi-phase interactive fraction bar with three learning stages: (1) identify the numerator via multiple choice, (2) identify the denominator via multiple choice, (3) build the fraction by shading parts on a bar. Progressive scaffolding from vocabulary to hands-on construction. ESSENTIAL for elementary fraction introduction.',
    constraints: 'Requires a proper fraction (numerator <= denominator). Denominator range 2-12 for best visual clarity.',
    tutoring: {
      taskDescription: 'Three-phase fraction learning: identify numerator and denominator of {{numerator}}/{{denominator}}, then build it on a bar. Phase: {{currentPhase}}.',
      contextKeys: ['numerator', 'denominator', 'currentPhase', 'shadedCount', 'attemptNumber'],
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
        description: 'Unit fractions with small denominators (1/2, 1/3, 1/4).',
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
    description: 'Multi-phase interactive place value chart with three learning stages: (1) identify the place of a highlighted digit via multiple choice, (2) find the value of that digit via multiple choice, (3) build the number by entering digits into an interactive chart. Progressive scaffolding from place recognition to value understanding to full number construction. Supports whole numbers and decimals from millions to thousandths. ESSENTIAL for elementary place value instruction.',
    constraints: 'Requires a target number with clear place value structure. Grade level determines digit range and decimal inclusion. Supports challengeTypes: identify (K-2), build (2-3), compare (3-4), expanded_form (5+).',
    evalModes: [
      { evalMode: 'identify', label: 'Identify Place (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['identify'], description: 'Simple 2-digit numbers, identify place name and value.' },
      { evalMode: 'build', label: 'Build Number (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['build'], description: '3-digit numbers, construct the number in the chart.' },
      { evalMode: 'compare', label: 'Compare Places (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['compare'], description: '3-4 digit numbers with multiple non-zero digits.' },
      { evalMode: 'expanded_form', label: 'Expanded Form (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['expanded_form'], description: '4+ digit numbers or decimals with expanded form.' },
    ],
    tutoring: {
      taskDescription: 'Three-phase place value learning: identify the place of the highlighted digit in {{targetNumber}}, find its value, then build the number on the chart. Phase: {{currentPhase}}.',
      contextKeys: ['targetNumber', 'highlightedDigit', 'highlightedPlace', 'highlightedValue', 'currentPhase', 'gradeLevel'],
      scaffoldingLevels: {
        level1: '"Look at the highlighted digit. Think about its position in the number. What place is it in?"',
        level2: '"The digit {{highlightedDigit}} is in the {{highlightedPlace}} place. What is {{highlightedDigit}} worth in that position? Multiply the digit by the place value."',
        level3: '"In {{targetNumber}}, the digit {{highlightedDigit}} is in the {{highlightedPlace}} place, so it is worth {{highlightedValue}}. Now place each digit in the correct column on the chart to build the whole number."',
      },
      commonStruggles: [
        { pattern: 'Confusing place name with digit value', response: '"The PLACE tells you the position (ones, tens, hundreds). The VALUE is the digit times its place. A 5 in the tens place is worth 50, not 5."' },
        { pattern: 'Selecting the digit value when asked for the place', response: '"This question asks WHICH PLACE the digit is in — not what it is worth. Look at the column name above the highlighted digit."' },
        { pattern: 'Entering digits in wrong columns during build phase', response: '"Read the number left to right: {{targetNumber}}. Match each digit to its column header. The leftmost digit goes in the highest place."' },
        { pattern: 'Decimal place confusion', response: '"After the decimal point, places get 10 times smaller: tenths, hundredths, thousandths. The first digit after the dot is in the tenths place."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE PLACE VALUE COACHING',
          instruction:
            'In Phase 1 (Identify the Place): focus on position vocabulary — "The highlighted digit is in the {{highlightedPlace}} place. '
            + 'Remember: places go ones, tens, hundreds as you move LEFT." '
            + 'In Phase 2 (Find the Value): connect place to value — "You know the digit {{highlightedDigit}} is in the {{highlightedPlace}} place. '
            + 'Multiply the digit by its place value to find what it is worth." '
            + 'In Phase 3 (Build the Number): guide construction column by column — "Read {{targetNumber}} digit by digit. '
            + 'Which column does each digit go in? Start with the highest place and work right." '
            + 'Use the mnemonic: "Each place is 10 times the one to its right."',
        },
        {
          title: 'GRADE-LEVEL ADAPTATION',
          instruction:
            'For K-2: focus on ones, tens, hundreds with whole numbers only. Use concrete language: "The 3 is in the tens column, so it means 3 tens, which is 30." '
            + 'For grades 3-4: extend to thousands and introduce decimals (tenths). Connect to money: "0.5 is like 50 cents — five tenths of a dollar." '
            + 'For grade 5+: include millions and thousandths. Guide the ×10 pattern: "Moving one place left multiplies by 10. Moving right divides by 10."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'area-model',
    description: 'Visual area model for multiplication using rectangles divided by factor decomposition. Perfect for teaching multi-digit multiplication, distributive property, partial products, binomial multiplication (FOIL), and polynomial expansion. Shows how (a+b)×(c+d) breaks into partial products. ESSENTIAL for grades 3-8 math and algebra.',
    constraints: 'Requires two factors that can be decomposed (e.g., 23×15 or (x+3)(x+5)). Supports both numeric and algebraic modes.',
    tutoring: {
      taskDescription: 'Calculate partial products in the area model. Factors: ({{factor1Parts}}) × ({{factor2Parts}}). Total cells: {{totalCells}}.',
      contextKeys: ['factor1Parts', 'factor2Parts', 'correctCells', 'totalCells', 'algebraicMode'],
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
    description: 'Rectangular array of discrete objects (dots, squares, stars) arranged in rows and columns. Perfect for teaching multiplication introduction, repeated addition, skip counting, commutative property, area concepts, and combinatorics. Interactive highlighting by row, column, or cell. ESSENTIAL for elementary multiplication (grades 2-5).',
    constraints: 'Best for multiplication facts and concrete counting. Keep arrays reasonable size (2-10 rows, 2-12 columns).',
    tutoring: {
      taskDescription: 'Build an array with {{targetRows}} rows and {{targetColumns}} columns, then find the total.',
      contextKeys: ['targetRows', 'targetColumns', 'currentRows', 'currentColumns', 'totalAnswer'],
      scaffoldingLevels: {
        level1: '"How many rows do you need? How many columns?"',
        level2: '"You need {{targetRows}} rows of {{targetColumns}}. Can you count by {{targetColumns}}s?"',
        level3: '"{{targetRows}} rows × {{targetColumns}} columns = {{targetRows}} groups of {{targetColumns}}. Count: {{targetColumns}}, {{targetColumns2}}, {{targetColumns3}}..."',
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
            'Help students see the array as multiplication, not just counting. '
            + 'Guide the connection: "You have {{targetRows}} rows. Each row has {{targetColumns}}. '
            + 'That is {{targetRows}} groups of {{targetColumns}}, which is {{targetRows}} × {{targetColumns}}!" '
            + 'Encourage skip counting over one-by-one counting: "Count by rows: each row adds {{targetColumns}} more." '
            + 'When the student discovers the commutative property, celebrate: "You flipped it and got the same answer! That always works with multiplication."',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_array',
        label: 'Build Array (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_array'],
        description: 'Concrete: build array with given dimensions.',
      },
      {
        evalMode: 'count_array',
        label: 'Count Array (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count_array'],
        description: 'Pictorial: count total objects in array.',
      },
      {
        evalMode: 'multiply_array',
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
    description: 'INTERACTIVE PROBLEM-SOLVING PRIMITIVE: Students find missing values on two parallel number lines by calculating proportional relationships. Perfect for teaching ratios, unit rates, proportional relationships, measurement conversions, percent problems, and speed/distance relationships through active problem-solving. Students enter values in input fields and receive immediate feedback. Critical bridge from additive to multiplicative reasoning. ESSENTIAL for grades 5-8 ratios and proportions practice.',
    constraints: 'Requires two quantity labels and proportional relationship. Automatically generates 2-4 target points for students to solve. Supports equivalent_ratios, find_missing, and unit_rate challenge types.',
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
      taskDescription: 'Find proportional relationships between {{topLabel}} and {{bottomLabel}}. Unit rate: 1 {{topLabel}} = {{unitRate}} {{bottomLabel}}. Phase: {{currentPhase}}.',
      contextKeys: ['topLabel', 'bottomLabel', 'currentPhase', 'unitRateFound', 'correctPoints', 'totalTargetPoints'],
      scaffoldingLevels: {
        level1: '"What is the relationship between {{topLabel}} and {{bottomLabel}}? Look at the given point."',
        level2: '"When {{topLabel}} = 1, what is {{bottomLabel}}? That is the unit rate — the key to everything."',
        level3: '"Multiply the {{topLabel}} value by the unit rate to get the {{bottomLabel}} value. {{topLabel}} × {{unitRate}} = {{bottomLabel}}."',
      },
      commonStruggles: [
        { pattern: 'Adding instead of multiplying', response: '"Ratios use multiplication, not addition. If 1 costs $3, then 4 costs 4 × $3, not 1 + $3."' },
        { pattern: 'Cannot find unit rate', response: '"Look at the given point. Divide the bottom value by the top value to find the rate for 1 unit."' },
        { pattern: 'Scaling errors', response: '"Check: does your answer make sense? More {{topLabel}} should mean more {{bottomLabel}}."' },
      ],
      aiDirectives: [
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
    description: 'Rectangular bars divided into labeled segments representing part-part-whole and comparison relationships. The single most versatile visual for word problems from elementary through algebra. Perfect for addition/subtraction word problems, comparison problems (more than, less than), multi-step word problems, ratio and proportion, and algebraic equation setup. Students click segments to explore values. Supports unknown segments marked with "?" for algebra. ESSENTIAL for word problem solving (grades 1-algebra).',
    constraints: 'Requires clear part-whole or comparison relationship. Use 1 bar for part-whole problems, 2+ bars for comparison. Can include unknown segments for algebra (marked with isUnknown: true).',
    evalModes: [
      { evalMode: 'represent', label: 'Represent (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['represent'], description: 'Build tape diagram from word problem, identify parts.' },
      { evalMode: 'solve_part_whole', label: 'Part-Whole (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['solve_part_whole'], description: 'Standard part-whole: given parts find total, or vice versa.' },
      { evalMode: 'solve_comparison', label: 'Comparison (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['solve_comparison'], description: 'Comparison problems with different quantity bars.' },
      { evalMode: 'multi_step', label: 'Multi-Step (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['multi_step'], description: 'Multi-step problems requiring multiple operations.' },
    ],
    tutoring: {
      taskDescription: 'Solve a part-whole word problem using a tape diagram. Phase: {{currentPhase}}. Total segments: {{totalSegments}}. Unknown segments: {{unknownCount}}.',
      contextKeys: ['currentPhase', 'totalSegments', 'unknownCount', 'wholeFound', 'title', 'description'],
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
    description: 'Visual tree diagram showing prime factorization of a number. Perfect for teaching prime numbers, composite numbers, factor decomposition, greatest common factor (GCF), least common multiple (LCM), and divisibility rules. Interactive branches show the breakdown process from composite numbers to prime factors. ESSENTIAL for grades 4-6 number theory.',
    constraints: 'Requires a composite number (not prime). Best for numbers with interesting factorizations (e.g., 24, 36, 48, 60, 72).',
    tutoring: {
      taskDescription: 'Find the prime factorization of {{rootValue}} by splitting composite numbers into factor pairs.',
      contextKeys: ['rootValue', 'currentFactorization', 'leavesCount', 'allPrime', 'guidedMode'],
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
        label: 'Build Ratio (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build-ratio'],
        description: 'Construct ratio from context using slider.',
      },
      {
        evalMode: 'missing_value',
        label: 'Missing Value (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['missing-value'],
        description: 'Find unknown value in a scaled ratio.',
      },
      {
        evalMode: 'find_multiplier',
        label: 'Find Multiplier (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find-multiplier'],
        description: 'Discover the scale factor between ratios.',
      },
      {
        evalMode: 'unit_rate',
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
    description: 'Horizontal bar model with percentage markings showing the relationship between a part and whole. Perfect for teaching percentages, percent of a quantity, discounts, tax, tips, percent increase/decrease, and part-to-whole relationships. Visual representation with 0% to 100% scale. ESSENTIAL for grades 6-8 percent concepts.',
    constraints: 'Requires a percent value and context (total amount). Best for concrete percent problems with real-world applications. Supports direct, subtraction, addition, and comparison challenge types.',
    evalModes: [
      {
        evalMode: 'identify_percent',
        label: 'Identify Percent (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['direct'],
        description: 'Find a percentage of a number — benchmark percents, test scores.',
      },
      {
        evalMode: 'find_part',
        label: 'Find Part / Discount (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['subtraction'],
        description: 'Calculate what remains after removing a percentage (discounts, decreases).',
      },
      {
        evalMode: 'find_whole',
        label: 'Find Whole / Tax (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['addition'],
        description: 'Calculate total after adding a percentage (tax, tip, markup).',
      },
      {
        evalMode: 'convert',
        label: 'Compare Percentages (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['comparison'],
        description: 'Compare percentages across different contexts.',
      },
    ],
    tutoring: {
      taskDescription: 'Find {{currentPhaseTarget}}% of {{wholeValue}} ({{wholeValueLabel}}). Scenario: {{scenario}}. Phase: {{currentPhase}}.',
      contextKeys: ['wholeValue', 'wholeValueLabel', 'currentPhase', 'currentPercent', 'scenario'],
      scaffoldingLevels: {
        level1: '"What benchmark percentage is closest — 25%, 50%, or 75%? Start there."',
        level2: '"{{targetPercent}}% means {{targetPercent}} out of 100. What is {{targetPercent}}/100 × {{wholeValue}}?"',
        level3: '"Convert the percent to a decimal: {{targetPercent}}% = {{decimalValue}}. Multiply: {{decimalValue}} × {{wholeValue}} = {{result}}."',
      },
      commonStruggles: [
        { pattern: 'Not connecting percent to fraction', response: '"Percent means per hundred. 25% = 25/100 = 1/4 of the whole."' },
        { pattern: 'Confusing part and whole', response: '"The whole (100%) is {{wholeValue}}. You are finding a part of it."' },
        { pattern: 'Difficulty with non-benchmark percents', response: '"Break it down: find 10% first (divide by 10), then scale up."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE GUIDANCE',
          instruction:
            'In Phase 1 (Explore), help the student discover the concept through the bar. '
            + 'In Phase 2 (Practice), reinforce the calculation method. '
            + 'In Phase 3 (Apply), encourage solving the real-world problem independently.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'balance-scale',
    description: 'Interactive balance scale with phase-based equation solving (Explore → Solve → Verify). Students click blocks to remove from both sides, drag blocks from palette, or use operations panel. Rich step tracking with justifications. Grade-banded: K-2 (concrete, mystery number), 3-4 (one-step x equations), 5 (two-step, variables on both sides). ESSENTIAL for pre-algebra and algebra.',
    constraints: 'Requires equation with leftSide, rightSide, and variableValue. Grade band controls complexity. Challenges array for multi-problem sets.',
    tutoring: {
      taskDescription: 'Solve the equation {{targetEquation}} using the balance scale. Phase: {{phase}}. Steps taken: {{stepCount}}.',
      contextKeys: ['targetEquation', 'currentEquation', 'variableValue', 'gradeBand', 'phase', 'stepCount', 'isSolved', 'isBalanced', 'attemptNumber', 'leftSide', 'rightSide'],
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
            + 'In VERIFY phase: guide substitution — "Replace x with your answer. Does 3 + {{variableValue}} really equal {{rightSide}}?"',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For K-2: use concrete "mystery number" language — "What number is hiding under the box?" Avoid "x" and "equation." '
            + 'For grades 3-4: introduce "equation" and "x" but tie to the concrete scale — "x is the mystery number on the scale." '
            + 'For grade 5: use algebraic language — "Isolate the variable by performing inverse operations on both sides."',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'equality',
        label: 'Equality (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['equality'],
        description: 'Understand balance = equal; missing addend problems.',
      },
      {
        evalMode: 'equality_hard',
        label: 'Equality Hard (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['equality_hard'],
        description: 'Subtraction missing-addend and larger sums (10-20), still □ notation.',
      },
      {
        evalMode: 'one_step',
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
    description: 'Visual "machine" with input hopper, rule display, and output chute with 4-phase interaction (Observe → Predict → Discover → Create). Numbers enter, get transformed by the rule, and exit. Supports machine chaining for function composition. Grade-banded: 3-4 (one-step rules like x+3, x*2), 5 (two-step rules like 2*x+1), advanced (expressions like x^2). Perfect for teaching input/output patterns, function concepts, function notation f(x), linear functions, composition of functions, and inverse functions. ESSENTIAL for grades 3-4 patterns, grades 5-8 function introduction, and Algebra 1-2 function concepts.',
    constraints: 'Requires a transformation rule using variable x (e.g., "x+3", "2*x", "x^2"). Phases: observe (watch pairs), predict (guess output before seeing), discover (guess the rule), create (build own machine). Supports chainedMachines for composition. gradeBand controls rule complexity.',
    tutoring: {
      taskDescription: 'Discover or apply the function rule. Rule: {{rule}} ({{showRule}}). Phase: {{phase}}. Processed pairs: {{pairsCount}}. Predictions: {{predictionsCorrect}}/{{predictionsTotal}}. Grade band: {{gradeBand}}.',
      contextKeys: ['rule', 'showRule', 'processedPairs', 'guessedRule', 'gradeBand', 'ruleComplexity', 'phase', 'pairsCount', 'predictionsCorrect', 'predictionsTotal', 'guessAttempts', 'ruleDiscovered', 'chainedMachineCount', 'isChaining'],
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
        { pattern: 'Stuck in observe phase too long', response: '"You have enough pairs! Try moving to the Predict phase to test your understanding, or jump to Discover to guess the rule."' },
        { pattern: 'Cannot compose chained machines', response: '"For chained machines, the output of Machine 1 becomes the INPUT of Machine 2. Follow the number through each machine step by step."' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE GUIDANCE',
          instruction:
            'In Observe phase: let the student explore freely, narrate what is happening. '
            + 'In Predict phase: ask "What do you think will come out?" BEFORE revealing the output. Celebrate correct predictions. '
            + 'In Discover phase: guide toward the rule using scaffolding. Never reveal the rule directly. '
            + 'In Create phase: encourage creativity and ask about the patterns they created.',
        },
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For grades 3-4: use simple language, focus on one-step patterns like "add 3" or "double". '
            + 'For grade 5: introduce two-step thinking: "first multiply, then add". '
            + 'For advanced: use algebraic notation f(x), discuss domain and range concepts.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['observe'],
        description: 'Watch input/output with rule visible. Full guidance.',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Predict output for new input with rule visible.',
      },
      {
        evalMode: 'discover_rule',
        label: 'Discover Rule (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['discover_rule'],
        description: 'Identify the hidden function rule from I/O pairs.',
      },
      {
        evalMode: 'create_rule',
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
    description: 'Interactive right triangle overlay on a linear graph showing rise and run for slope visualization. Perfect for teaching slope concept, rise over run, Δy/Δx notation, rate of change, angle of inclination, and connecting slope to trigonometry. Students can drag triangles along the line, resize them to see different rise/run pairs, toggle between rise/run and delta notation, and view angle measurements. Shows that different-sized triangles on the same line always yield the same slope. ESSENTIAL for grades 7-8 (slope introduction), Algebra 1 (slope calculation, linear equations), Geometry (parallel/perpendicular lines, angles), and Precalculus (connecting slope to tangent).',
    constraints: 'Requires a linear equation to attach triangles to. Equations must use y= format with * for multiplication (e.g., "y = 2*x + 1"). Best for linear functions with clear, visible slopes. Can show 1-3 triangles at different positions or sizes.',
    tutoring: {
      taskDescription: 'Explore slope using rise/run triangles on the line {{equation}}. Slope = {{slope}}.',
      contextKeys: ['attachedLine', 'slope', 'rise', 'run', 'allowDrag', 'allowResize'],
      scaffoldingLevels: {
        level1: '"How steep is this line? Does it go uphill or downhill?"',
        level2: '"Count the rise (vertical change) and the run (horizontal change). Divide rise by run."',
        level3: '"Rise = {{rise}}, Run = {{run}}. Slope = rise ÷ run = {{rise}} ÷ {{run}} = {{slope}}."',
      },
      commonStruggles: [
        { pattern: 'Confusing rise and run', response: '"Rise is vertical (up/down). Run is horizontal (left/right). Rise over run."' },
        { pattern: 'Negative slope confusion', response: '"If the line goes downhill (left to right), the slope is negative."' },
        { pattern: 'Thinking slope changes with triangle size', response: '"Drag the triangle to a different spot. The slope stays the same! The ratio rise/run is constant."' },
      ],
      aiDirectives: [
        {
          title: 'SLOPE CONSTANCY DISCOVERY',
          instruction:
            'The most important insight is that slope is CONSTANT along a line. '
            + 'When the student resizes the triangle: "The triangle is bigger now, but rise/run is STILL {{slope}}. '
            + 'Slope does not change — that is what makes it a straight line!" '
            + 'When the student drags the triangle: "Same slope at every point. That is the defining property of a line." '
            + 'Connect to rate of change: "Slope = how much y changes for every 1 unit of x. '
            + 'A slope of 2 means y goes up 2 for every 1 step to the right."',
        },
      ],
    },
  },
  {
    id: 'systems-equations-visualizer',
    description: 'Comprehensive systems of linear equations visualizer combining graphical and algebraic solution methods. Perfect for teaching solving systems by graphing, substitution, and elimination methods. Displays 2-3 equations graphed simultaneously with intersection points highlighted. Side-by-side panels show graphical solution and step-by-step algebraic work. Students can toggle between solution methods, view animated step-by-step solutions, and understand system classification (one solution, no solution, infinite solutions). ESSENTIAL for grade 8 (systems introduction), Algebra 1 (solving systems, graphing method), and Algebra 2 (complex systems, choosing efficient methods).',
    constraints: 'Requires 2-3 linear equations in y = mx + b format. Equations must use * for multiplication (e.g., "y = 2*x + 1"). Include intersection point for systems with one solution. Provide step-by-step algebraic solution based on chosen method (graphing, substitution, or elimination). Best for integer or simple decimal solutions at grades 8-Algebra 1.',
    tutoring: {
      taskDescription: 'Solve the system of equations: {{equations}}. Method: {{solutionMethod}}. System type: {{systemType}}.',
      contextKeys: ['equations', 'solutionMethod', 'systemType', 'intersectionPoint'],
      scaffoldingLevels: {
        level1: '"Look at the graph. Do the lines cross? How many times?"',
        level2: '"If the lines intersect, the crossing point is the solution. What are its coordinates?"',
        level3: '"The lines meet at ({{x}}, {{y}}). Verify: plug x={{x}} into both equations. Do you get y={{y}} both times?"',
      },
      commonStruggles: [
        { pattern: 'Cannot find intersection visually', response: '"Trace each line carefully. Where do they share the same point?"' },
        { pattern: 'Confusing no solution and infinite solutions', response: '"Parallel lines (same slope, different y-intercept) = no solution. Same line = infinite solutions."' },
        { pattern: 'Algebraic method errors', response: '"Check each step. Did you distribute correctly? Did you combine like terms?"' },
      ],
      aiDirectives: [
        {
          title: 'METHOD-AWARE COACHING',
          instruction:
            'For GRAPHING method: guide visual inspection — "Look where the two lines cross. That point satisfies both equations." '
            + 'For SUBSTITUTION method: guide isolating y — "One equation already says y = ... Plug that into the other equation." '
            + 'For ELIMINATION method: guide coefficient alignment — "Can you multiply one equation so the x-coefficients match? Then subtract!" '
            + 'Always end with verification: "Plug your answer into BOTH equations. It must work in both."',
        },
        {
          title: 'SYSTEM CLASSIFICATION',
          instruction:
            'When lines are parallel: "Same slope but different y-intercepts means the lines never meet. There is NO solution." '
            + 'When lines overlap: "Same slope AND same y-intercept means they are the same line! There are INFINITE solutions." '
            + 'When lines intersect: "Different slopes mean exactly ONE crossing point — that is the unique solution." '
            + 'Help students see how the visual connects to the algebra.',
        },
      ],
    },
  },
  {
    id: 'matrix-display',
    description: 'Interactive m×n matrix display and editor with comprehensive step-by-step operations including determinant calculation, matrix inverse, transpose, multiplication, addition, row operations, and augmented matrix solving. Perfect for teaching matrix concepts, organizing data in rows and columns, matrix arithmetic, determinants, inverse matrices, geometric transformations, and solving systems of linear equations using matrices. Features detailed animated explanations for each operation step, highlighting cells involved in calculations, displaying intermediate results, and providing educational context. Shows formulas, calculations, and WHY each step is performed. Supports 2×2 to 4×4 matrices with optional cell editing, operation buttons, and augmented matrix display for system solving. ESSENTIAL for grade 7-8 (data organization in matrices), Algebra 2 (matrix operations, determinants, solving systems with matrices), Precalculus (matrix transformations, inverses), and Linear Algebra (all matrix operations, eigenvalues).',
    constraints: 'Matrix dimensions typically 2×2 to 4×4 (or 2×3 to 3×4 for augmented). Use simple integers for elementary/middle school, include fractions/decimals for advanced topics. For determinant visualization, show step-by-step calculation with cell highlighting. For inverse, show method (adjugate for 2×2, Gaussian elimination for 3×3+). For row operations, label each operation clearly (e.g., "R₂ - 2R₁ → R₂"). Supports transpose, add, subtract, multiply, determinant, and inverse operation types.',
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
      taskDescription: 'Perform matrix operations. Matrix: {{rows}}×{{columns}}. Operation: {{operationType}}.',
      contextKeys: ['rows', 'columns', 'operationType', 'values'],
      scaffoldingLevels: {
        level1: '"What operation are we performing? What does it do to the matrix?"',
        level2: '"For {{operationType}}: follow the highlighted cells. What values are being combined?"',
        level3: '"Step through the calculation: multiply the highlighted values, then add/subtract as shown in the formula."',
      },
      commonStruggles: [
        { pattern: 'Wrong determinant formula', response: '"For a 2×2 matrix [[a,b],[c,d]], the determinant = ad - bc. Cross-multiply diagonals."' },
        { pattern: 'Matrix multiplication order', response: '"Row from the first matrix × column from the second matrix. Multiply corresponding entries and add."' },
        { pattern: 'Row operation errors', response: '"Write out the operation before applying it: R₂ → R₂ - 2R₁ means replace each entry in row 2."' },
      ],
      aiDirectives: [
        {
          title: 'OPERATION-AWARE COACHING',
          instruction:
            'For DETERMINANT: walk through the cross-multiplication pattern — "Multiply a×d, then subtract b×c." '
            + 'For MULTIPLICATION: guide row-by-column — "Take row 1 of matrix A and column 1 of matrix B. '
            + 'Multiply matching entries and add: (a₁₁×b₁₁) + (a₁₂×b₂₁)." '
            + 'For ROW OPERATIONS: narrate each step — "We are doing R₂ - 2R₁. Take each entry in row 1, '
            + 'multiply by 2, then subtract from row 2." '
            + 'For INVERSE: emphasize the identity check — "Multiply A × A⁻¹. You should get the identity matrix!"',
        },
        {
          title: 'STEP-BY-STEP PACING',
          instruction:
            'Matrix operations have many steps. Guide ONE cell or ONE row at a time. '
            + 'After each step, pause: "Good — now let\'s do the next entry." '
            + 'Never rush through multiple calculations at once. '
            + 'Use the highlighted cells as visual anchors: "See the yellow cells? Those are the values you are combining right now."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'dot-plot',
    description: 'Interactive dot plot (also called line plot) with stacked dots representing data values on a number line. Perfect for teaching data representation, frequency concepts, mean, median, mode, data distribution shape, and comparing datasets. Students click to add/remove data points, view frequency at each value, and calculate statistical measures. Supports parallel dot plots for comparing two datasets (e.g., morning vs afternoon temperatures). Stack styles include dots, X marks, or custom icons. ESSENTIAL for grades 2-3 (counting and data representation), grades 3-4 (frequency concepts), grades 5-6 (mean, median, mode), and grades 6-7 (data distribution, comparing datasets).',
    constraints: 'Requires number line range [min, max] and data points array. Data values should be within the range. For younger grades (2-3), use small whole numbers (0-10) and disable statistics. For grades 5+, enable showStatistics for mean/median/mode. For comparison activities, enable parallel mode with labeled datasets. Keep data size manageable: 8-20 values per dataset.',
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
  },
  {
    id: 'histogram',
    description: 'Interactive histogram (bar chart showing frequency distribution) with adjustable bin widths. Perfect for teaching grouped data, distribution shapes (normal, skewed, bimodal), data analysis, and statistics. Students can adjust bin width to see how distribution shape changes, add/remove data points, and optionally overlay a normal curve. Shows frequency labels on bars and calculates statistics (mean, standard deviation, min, max, skewness). ESSENTIAL for grades 6-7 (grouped data, distribution shape), grades 7-Statistics (comparing distributions), and Statistics courses (normal distribution, data analysis).',
    constraints: 'Requires data array with 15-50 numeric values. binWidth and binStart define the histogram bins. For younger grades (6-7), use showFrequency: true and showCurve: false. For statistics lessons about normal distribution, enable showCurve: true. Set editable: true to allow students to explore bin width adjustments.',
    tutoring: {
      taskDescription: 'Analyze data distribution using a histogram. Data points: {{dataCount}}. Bin width: {{binWidth}}.',
      contextKeys: ['data', 'binWidth', 'showCurve', 'mean', 'standardDeviation', 'skewness'],
      scaffoldingLevels: {
        level1: '"What is the overall shape of the histogram? Is it symmetric, skewed, or bimodal?"',
        level2: '"Which bin has the tallest bar? That is where most data values fall."',
        level3: '"The mean is {{mean}} and the data spreads about {{standardDeviation}} units from the mean. A wider spread means more variability."',
      },
      commonStruggles: [
        { pattern: 'Confusing histogram with bar chart', response: '"Histograms show ranges of continuous data (bins). Bar charts show separate categories."' },
        { pattern: 'Ignoring bin width effects', response: '"Try changing the bin width. Notice how the shape changes? Wider bins smooth out the data."' },
        { pattern: 'Misidentifying skewness', response: '"The tail tells the skew direction. Long tail on the right = right-skewed."' },
      ],
      aiDirectives: [
        {
          title: 'DISTRIBUTION SHAPE COACHING',
          instruction:
            'Start with the big picture before any calculations: "First, describe what you SEE. Is the data piled up in the middle? '
            + 'Does it have one peak or two? Is one side stretched out?" '
            + 'Teach the vocabulary through observation: "One peak in the middle = unimodal. Two peaks = bimodal. '
            + 'Symmetric = mirror image. A long tail = skewed toward that tail." '
            + 'For bin width exploration: "Watch what happens when you widen the bins — the bars get taller but you lose detail. '
            + 'Narrow bins show more detail but can look noisy." '
            + 'Connect shape to statistics: "A right-skewed distribution pulls the mean to the RIGHT of the median."',
        },
      ],
    },
  },
  {
    id: 'two-way-table',
    description: 'Interactive two-way table (contingency table) for categorical data with convertible Venn diagram view. Perfect for teaching categorical data organization, joint and marginal frequencies, conditional probability, set relationships (union, intersection), and independence testing. Students can click cells to see joint, marginal, and conditional probabilities. Supports table view, Venn diagram view, or both. Venn diagram circles dynamically size based on set proportions and intersection. Toggle between frequencies and relative frequencies (probabilities). ESSENTIAL for grade 7 (categorical data, set relationships), grade 7-Statistics (joint probability, conditional probability), and Statistics courses (independence testing, contingency tables).',
    constraints: 'Requires rowCategories and columnCategories arrays (2-4 categories each), and 2D frequencies array matching dimensions. For Venn diagram view, use 2x2 tables. For grade 7, use displayMode: "both" to show table and Venn. For Statistics, use showProbabilities toggle. Set editable: true for exploration, false for assessment. Include questionPrompt for guided probability questions.',
    tutoring: {
      taskDescription: 'Analyze categorical data in a two-way table. Categories: {{rowCategories}} × {{columnCategories}}.',
      contextKeys: ['rowCategories', 'columnCategories', 'frequencies', 'displayMode', 'showProbabilities'],
      scaffoldingLevels: {
        level1: '"What two categories does each cell represent? Look at the row and column headers."',
        level2: '"The row total tells you how many are in that category overall. The cell tells you the joint count."',
        level3: '"P(A and B) = joint count ÷ grand total. P(A given B) = joint count ÷ B total."',
      },
      commonStruggles: [
        { pattern: 'Confusing joint and marginal', response: '"Joint = inside the table (both categories). Marginal = totals on the edges (one category)."' },
        { pattern: 'Conditional probability errors', response: '"Given B means you only look at column B. Divide the cell by the column total, not the grand total."' },
        { pattern: 'Independence misconception', response: '"Independent means P(A and B) = P(A) × P(B). Multiply the marginal probabilities and compare to the joint."' },
      ],
      aiDirectives: [
        {
          title: 'PROBABILITY REASONING COACHING',
          instruction:
            'Build from concrete to abstract: start with frequencies ("How many students like BOTH pizza AND sports?"), '
            + 'then move to probabilities ("What fraction of ALL students is that?"). '
            + 'For conditional probability, physically narrow the focus: "Given that we only look at students who play sports '
            + '(this column), what fraction likes pizza?" '
            + 'For the Venn diagram view, connect regions to table cells: "The overlap region matches this cell in the table." '
            + 'For independence: use the "expected vs observed" frame — "If these were independent, we would EXPECT this value. '
            + 'The actual value is different, so they are NOT independent."',
        },
      ],
    },
  },
  // Math Phase 2 Primitives (K-5 Foundations)
  {
    id: 'ten-frame',
    description: 'Interactive 2×5 grid manipulative for building number sense in K-2. Students place counters to build numbers (0-20), develop subitizing skills (instant quantity recognition), compose and decompose numbers with two-color counters, practice "make ten" strategy, and solve addition/subtraction using the frame. Supports single frame (0-10) and double frame (0-20). The most foundational manipulative for early number sense. ESSENTIAL for grades K-2 number sense, counting, addition, and subtraction.',
    constraints: 'Best for grades K-2. Counter-based manipulative. Single frame for K (numbers 0-10), double frame for grades 1-2 (numbers 0-20).',
    evalModes: [
      {
        evalMode: 'build',
        label: 'Build (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Place counters on the frame with full guidance. Concrete manipulative — lowest cognitive load.',
      },
      {
        evalMode: 'subitize',
        label: 'Subitize (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['subitize'],
        description: 'Flash counters briefly, identify count. Pictorial recognition — one layer of abstraction above concrete.',
      },
      {
        evalMode: 'make_ten',
        label: 'Make Ten (Strategy)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['make_ten'],
        description: 'Find the complement to 10. Strategic decomposition — student must self-organize approach.',
      },
      {
        evalMode: 'operate',
        label: 'Operate (Symbolic)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['add', 'subtract'],
        description: 'Addition and subtraction using the frame. Transitional symbolic — bridging concrete and abstract.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is building numbers on a ten frame. Challenge: {{instruction}}. Target: {{targetCount}} counters. Current count: {{currentCount}}. Empty spaces: {{emptySpaces}}.',
      contextKeys: ['instruction', 'targetCount', 'currentCount', 'mode', 'challengeType', 'emptySpaces', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"How many counters do you see? Can you count them?"',
        level2: '"Look at the empty spaces on the frame. How many empty spaces do you see?"',
        level3: '"You have {{currentCount}} counters. The frame holds 10. So {{currentCount}} + {{emptySpaces}} = 10. That is the make-ten strategy!"',
      },
      commonStruggles: [
        { pattern: 'Counting past 10 on single frame', response: '"A single ten frame only holds 10. Let\'s count the spaces: each row has 5."' },
        { pattern: 'Not seeing empty spaces as meaningful', response: '"The empty spaces are important! They tell us how many more we need to make 10."' },
        { pattern: 'Double-counting counters', response: '"Try touching each counter as you count it. That way you won\'t count any twice."' },
      ],
      aiDirectives: [
        {
          title: 'K-LEVEL COUNTING ENCOURAGEMENT',
          instruction:
            'Use warm, simple language. Count along with the student: "1, 2, 3..." '
            + 'Celebrate each counter placed. Use "how many more?" to build towards make-ten thinking. '
            + 'If the student fills one row (5), note: "You filled a whole row! That is 5!"',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'counting-board',
    description: 'Flexible K-1 counting workspace with tappable objects (bears, apples, stars, fish, butterflies, blocks) arranged in different patterns (scattered, line, groups, circle). Supports counting strategies: count-all (tap each object), subitizing (flash and recognize), count-on (start from a known group), group counting (count by 2s/5s/10s), and compare (which group has more). Builds one-to-one correspondence, cardinality principle, and subitizing fluency. ESSENTIAL for grades K-1 counting, number sense, and early addition foundations.',
    constraints: 'Best for grades K-1. Object counting and subitizing. K: count 1-20 objects, count_all and subitize only. Grade 1: count to 30, count-on and group counting.',
    evalModes: [
      {
        evalMode: 'count',
        label: 'Count All (Concrete)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['count_all'],
        description: 'Tap each object one by one. Concrete 1:1 correspondence — lowest cognitive load.',
      },
      {
        evalMode: 'subitize',
        label: 'Subitize (Perceptual)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['subitize'],
        description: 'Quickly recognize quantity without counting. Perceptual recognition of small groups.',
      },
      {
        evalMode: 'group',
        label: 'Group Count (Pictorial)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['group_count'],
        description: 'Count objects in groups of 2s, 5s, or 10s. Pictorial grouping strategy.',
      },
      {
        evalMode: 'count_on',
        label: 'Count On (Reduced Prompts)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['count_on'],
        description: 'Start from a known count and continue. Reduced scaffolding — student self-organizes.',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Reduced Prompts)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Determine which group has more. Comparative reasoning with reduced prompts.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is counting objects on a counting board. Challenge: {{instruction}}. Target answer: {{targetAnswer}}. Current count: {{currentCount}}. Arrangement: {{arrangement}}. Object type: {{objectType}}. Challenge type: {{challengeType}}. Attempt: {{attemptNumber}}.',
      contextKeys: ['instruction', 'targetAnswer', 'currentCount', 'arrangement', 'objectType', 'challengeType', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Touch each {{objectType}} as you count it. Ready? Let\'s count together: 1, 2, 3..."',
        level2: '"Try grouping the {{objectType}} together. Can you see groups of 5? Count by groups!"',
        level3: '"You already know there are {{startFrom}}. Now count on from {{startFrom}}: {{startFrom}}+1, {{startFrom}}+2... What is the total?"',
      },
      commonStruggles: [
        { pattern: 'Double-counting objects', response: '"Oops, you counted that one already! Try touching each {{objectType}} just once as you count."' },
        { pattern: 'Skipping objects when counting', response: '"Some {{objectType}} got left out! Try starting from one side and moving across so you don\'t miss any."' },
        { pattern: 'Not stating final count (cardinality)', response: '"You counted to {{currentCount}}. So how many {{objectType}} are there altogether? The last number you say tells you the total!"' },
      ],
      aiDirectives: [
        {
          title: 'K-LEVEL COUNTING ENCOURAGEMENT',
          instruction:
            'Use warm, enthusiastic language appropriate for K-1. Count along with the student. '
            + 'Celebrate each correct count. For subitize challenges, express wonder: "Wow, you saw that fast!" '
            + 'Emphasize cardinality: "So there are 7 bears altogether!" '
            + 'For count-on, model the strategy: "We know there are 5 already. Let\'s count on: 6, 7, 8..."',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'comparison-builder',
    description: 'Multi-phase comparison activity with four challenge types: compare groups of objects visually, compare written numerals with inequality symbols, order numbers least-to-greatest or greatest-to-least, and identify one more / one less. Features animated correspondence lines and alligator mouth mnemonic for < and >. Perfect for teaching quantity comparison and number ordering. ESSENTIAL for K-1 math.',
    constraints: 'Supports numbers 1-20. Groups contain up to 10 objects. Order challenges use 3-5 numbers. Object types: bears, apples, stars, blocks, fish, butterflies, hearts, flowers, cookies, balls.',
    tutoring: {
      taskDescription: 'Student is comparing quantities and numbers. Challenge type: {{challengeType}}. {{#if leftCount}}Left group: {{leftCount}}, Right group: {{rightCount}}.{{/if}} {{#if leftNumber}}Left number: {{leftNumber}}, Right number: {{rightNumber}}.{{/if}} {{#if targetNumber}}Target number: {{targetNumber}}, finding {{askFor}}.{{/if}} Attempt: {{attemptNumber}}.',
      contextKeys: ['challengeType', 'leftCount', 'rightCount', 'leftNumber', 'rightNumber', 'correctAnswer', 'targetNumber', 'askFor', 'gradeBand', 'useAlligatorMnemonic', 'instruction', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Which group looks like it has more? Can you tell just by looking?"',
        level2: '"Count each group carefully. Which number is bigger? {{#if useAlligatorMnemonic}}Remember, the alligator eats the bigger number!{{/if}}"',
        level3: '"Left has {{leftCount}}, right has {{rightCount}}. {{leftCount}} is {{correctAnswer}} {{rightCount}}, so we use the {{correctAnswer}} symbol."',
      },
      commonStruggles: [
        { pattern: 'Student confuses < and > symbols', response: 'Use the alligator mnemonic: the alligator mouth always opens toward the bigger number because it wants to eat more!' },
        { pattern: 'Student cannot compare groups without counting', response: 'Encourage one-to-one matching: "Try pointing to one on the left and one on the right. Match them up. Which side has leftovers?"' },
        { pattern: 'Student reverses ascending/descending order', response: 'Clarify the direction: "Least to greatest means we start with the smallest number. Which is the smallest here?"' },
        { pattern: 'Student confuses one-more with one-less', response: 'Use the number line: "If we go forward one step from the target, what do we land on? That is one more."' },
      ],
    },
    evalModes: [
      {
        evalMode: 'compare_groups',
        label: 'Compare Groups (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare-groups'],
        description: 'Visual group comparison',
      },
      {
        evalMode: 'one_more_less',
        label: 'One More / One Less (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['one-more-one-less'],
        description: 'Adjacent number reasoning',
      },
      {
        evalMode: 'compare_numbers',
        label: 'Compare Numbers (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare-numbers'],
        description: 'Symbolic comparison (>, <, =)',
      },
      {
        evalMode: 'order',
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
    tutoring: {
      taskDescription: 'Student is working with patterns. Pattern type: {{patternType}}. Challenge: {{instruction}}. Given sequence: {{givenSequence}}. Core unit: {{coreUnit}}. Rule: {{rule}}. Student extension: {{studentExtension}}. Attempt: {{attemptNumber}}.',
      contextKeys: ['patternType', 'instruction', 'givenSequence', 'hiddenSequence', 'coreUnit', 'rule', 'challengeType', 'attemptNumber', 'currentPhase', 'studentExtension', 'studentCreation'],
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
        label: 'Extend (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['extend'],
        description: 'Continue a given pattern.',
      },
      {
        evalMode: 'identify_core',
        label: 'Identify Core (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['identify_core'],
        description: 'Find the repeating unit.',
      },
      {
        evalMode: 'translate',
        label: 'Translate (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['translate'],
        description: 'Transform pattern to a different representation.',
      },
      {
        evalMode: 'create',
        label: 'Create (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['create'],
        description: 'Generate a pattern from a rule.',
      },
      {
        evalMode: 'find_rule',
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
    evalModes: [
      {
        evalMode: 'count_along',
        label: 'Count Along (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count_along'],
        description: 'Follow a skip-count sequence with visual support.',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Anticipate the next value in a skip-count sequence.',
      },
      {
        evalMode: 'fill_missing',
        label: 'Fill Missing (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fill_missing'],
        description: 'Complete missing terms in a skip-count sequence.',
      },
      {
        evalMode: 'find_skip_value',
        label: 'Find Skip Value (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_skip_value'],
        description: 'Discover the skip interval from a displayed sequence.',
      },
      {
        evalMode: 'connect_multiplication',
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
    description: 'Interactive hundreds chart (10x10 grid, 1-100) for skip-counting pattern discovery. Students highlight skip-count sequences (2s, 5s, 10s), complete partially shown patterns, identify visual column/row/diagonal relationships, and determine skip intervals. Connects number grid topology to multiplication foundations. ESSENTIAL for grades 1-3 skip counting, pattern recognition, and place value understanding.',
    constraints: 'Best for grades 1-3. Grades 1-2: skip by 2s, 5s, 10s, highlight and complete modes. Grades 2-3: skip by 3s, 4s, identify and find_skip_value modes. Grid always 1-100.',
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
      aiDirectives: [
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
    evalModes: [
      {
        evalMode: 'build',
        label: 'Build (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Construct equal groups or arrays for the given fact.',
      },
      {
        evalMode: 'connect',
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
        label: 'Missing Factor (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['missing_factor'],
        description: 'Solve for an unknown factor given the product.',
      },
      {
        evalMode: 'fluency',
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
    description: 'Drag-to-ruler measurement activity where students drag shapes (rectangles and squares) onto a visual ruler, read where the shape ends, and type the measurement. Teaches length measurement, comparison, and unit conversion. Grades 1-2 use whole-number precision; grades 3-5 add half precision and unit conversion. ESSENTIAL for grades 1-5 measurement and data standards.',
    constraints: 'Ruler-based length measurement for grades 1-5. Grades 1-2 use whole-number precision. Grades 3-5 add half precision and unit conversion.',
    tutoring: {
      taskDescription: 'Measurement activity where the student drags shapes onto a ruler and reads the measurement. Current shape: {{currentShape}}. Shape width: {{shapeWidth}} {{unit}}. On ruler: {{isOnRuler}}. Precision: {{precision}}. Attempt: {{currentAttempts}}.',
      contextKeys: ['unit', 'precision', 'currentShape', 'shapeWidth', 'isOnRuler', 'currentAttempts'],
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
    evalModes: [
      {
        evalMode: 'build',
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
        evalMode: 'classify',
        label: 'Classify (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['classify'],
        description: 'Identify shape properties to sort into categories.',
      },
      {
        evalMode: 'compose',
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
    description: 'Interactive number sequencing with 5 challenge types: fill-missing (complete number sequences with blanks), before-after (identify numbers before/after a given number), order-cards (arrange shuffled numbers in order), count-from (continue counting forward/backward from a starting number), and decade-fill (fill missing numbers on a hundred chart). Uses a "number train" visual metaphor. Perfect for building sequential number understanding. ESSENTIAL for K-1 math.',
    constraints: 'Best for numbers 1-100. K: 1-20 range, Grade 1: 1-100 range. Each challenge set should include 5-10 challenges mixing different types.',
    evalModes: [
      {
        evalMode: 'count_from',
        label: 'Count From (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count-from'],
        description: 'Continue counting forward or backward from a given value.',
      },
      {
        evalMode: 'before_after',
        label: 'Before/After (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['before-after'],
        description: 'Identify numbers immediately before or after a given number.',
      },
      {
        evalMode: 'order_cards',
        label: 'Order Cards (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order-cards'],
        description: 'Arrange a set of shuffled numbers in correct order.',
      },
      {
        evalMode: 'fill_missing',
        label: 'Fill Missing (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['fill-missing'],
        description: 'Complete gaps in a number sequence pattern.',
      },
      {
        evalMode: 'decade_fill',
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
    description: 'Classic number bond diagram (circle-and-branch visual) showing part-part-whole relationships. Supports 4 challenge types: decompose (find all pairs), missing-part, fact-family (write all 4 equations), and build-equation (drag tiles). Perfect for K-1 addition/subtraction fluency. ESSENTIAL for Kindergarten and Grade 1 number decomposition.',
    constraints: 'Max number 5 for Kindergarten, 10 for Grade 1. Decompose challenges need allPairs computed. Fact-family requires all 4 equations.',
    tutoring: {
      taskDescription: 'Student is working on number bonds with whole number {{whole}}. Challenge type: {{challengeType}}. They are finding how numbers decompose into parts.',
      contextKeys: ['challengeType', 'whole', 'part1', 'part2', 'missingValue', 'pairsFound', 'totalPairs', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"If the whole is {{whole}}, what two groups could you split it into?"',
        level2: '"You put {{part1}} in one part. How many are left for the other part? Think: {{whole}} take away {{part1}} equals..."',
        level3: '"{{whole}} = {{part1}} + {{part2}}. Now flip it: {{whole}} = {{part2}} + {{part1}}. And the subtraction: {{whole}} - {{part1}} = {{part2}}, {{whole}} - {{part2}} = {{part1}}. That\'s the whole fact family!"',
      },
      commonStruggles: [
        { pattern: 'Student repeats the same pair in decompose mode', response: 'Guide systematic discovery: "You found {{part1}} + {{part2}}. What if we put one more in the left group?"' },
        { pattern: 'Student cannot find the missing part', response: 'Use concrete strategy: "If the whole is {{whole}} and one part is {{part1}}, count up from {{part1}} to {{whole}} — how many more do you need?"' },
        { pattern: 'Student writes only 2 of 4 fact family equations', response: 'Connect addition and subtraction: "You wrote the addition facts. Now think backwards — if {{part1}} + {{part2}} = {{whole}}, what is {{whole}} - {{part1}}?"' },
        { pattern: 'Student arranges equation tiles in wrong order', response: 'Point to bond diagram: "Look at the number bond. The whole is {{whole}} at the top. Which operation connects the parts to the whole?"' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'decompose',
        label: 'Decompose (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['decompose'],
        description: 'Break whole into parts.',
      },
      {
        evalMode: 'missing_part',
        label: 'Missing Part (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['missing-part'],
        description: 'Find unknown part.',
      },
      {
        evalMode: 'fact_family',
        label: 'Fact Family (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fact-family'],
        description: 'Generate related facts.',
      },
      {
        evalMode: 'build_equation',
        label: 'Build Equation (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['build-equation'],
        description: 'Write symbolic equation.',
      },
    ],
  },
  {
    id: 'addition-subtraction-scene',
    description: 'An animated story scene where objects join, leave, or are compared to teach addition and subtraction. Students act out stories by counting objects, build matching equations from tiles, solve word problems, and create their own stories for given equations. Supports join, separate, compare, and part-part-whole story types. Perfect for K-1 students bridging from manipulatives to symbolic math. ESSENTIAL for Kindergarten and Grade 1 addition and subtraction.',
    constraints: 'Numbers limited to maxNumber (5 for K, 10 for Grade 1). Requires 4 challenge types: act-out, build-equation, solve-story, create-story. Story contexts must match scene theme.',
    tutoring: {
      taskDescription: 'The student is working through addition and subtraction story challenges. Current story: "{{storyText}}" ({{operation}}, {{storyType}} type). The equation is {{equation}}. They are in a {{challengeType}} phase where they must {{instruction}}.',
      contextKeys: ['storyText', 'operation', 'storyType', 'startCount', 'changeCount', 'resultCount', 'unknownPosition', 'equation', 'objectType', 'scene', 'challengeType', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What happened in the story? Did the {{objectType}} come or go away?"',
        level2: '"You started with {{startCount}} {{objectType}}. Then {{changeCount}} more came/went away. Can you count them all?"',
        level3: '"Let\'s count together: {{startCount}} {{objectType}} and {{changeCount}} more makes... {{startCount}} + {{changeCount}} = {{resultCount}}. The equation matches the story!"',
      },
      commonStruggles: [
        { pattern: 'Student counts incorrectly in act-out phase', response: 'Encourage tapping each object one at a time while saying the number aloud: "Touch each one as you count: 1, 2, 3..."' },
        { pattern: 'Student confuses addition and subtraction operations', response: 'Connect to the story action: "In our story, the ducks flew AWAY. When things leave, we subtract!"' },
        { pattern: 'Student builds equation with wrong operator', response: 'Ask about the story direction: "Did more objects come, or did some leave? That tells us which symbol to use!"' },
        { pattern: 'Student struggles with unknown position other than result', response: 'Reframe the problem: "We know the answer is {{resultCount}}. We know {{changeCount}} left. So how many were there before?"' },
      ],
    },
    evalModes: [
      {
        evalMode: 'act_out',
        label: 'Act Out (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['act-out'],
        description: 'Manipulate objects in scene',
      },
      {
        evalMode: 'build_equation',
        label: 'Build Equation (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build-equation'],
        description: 'Represent scene as equation',
      },
      {
        evalMode: 'solve_story',
        label: 'Solve Story (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['solve-story'],
        description: 'Solve a word problem',
      },
      {
        evalMode: 'create_story',
        label: 'Create Story (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['create-story'],
        description: 'Write story for given equation',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'ordinal-line',
    description: 'Interactive ordinal positions activity with a horizontal queue of characters. Students identify positions (1st-10th), match ordinal words to symbols, answer relative position questions, solve story-based word problems, and build sequences from clues. Perfect for teaching ordinal numbers in context. ESSENTIAL for K-1 number sense.',
    constraints: 'maxPosition 5 for Kindergarten, 10 for Grade 1. Characters array must have distinct emoji. Each challenge needs correctAnswer matching the expected response.',
    tutoring: {
      taskDescription: 'The student is working with ordinal positions in a {{context}} context. They are on a {{challengeType}} challenge: "{{instruction}}". The line has {{characters}} in positions up to {{maxPosition}}.',
      contextKeys: ['challengeType', 'targetPosition', 'targetOrdinalWord', 'characters', 'context', 'storyText', 'attemptNumber', 'correctAnswer', 'instruction', 'maxPosition', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Count from the front of the line: first, second, third... Which one is in the spot we need?"',
        level2: '"Point to each character and count: 1st, 2nd, 3rd. Which one is in the {{targetOrdinalWord}} spot? Remember, {{targetOrdinalWord}} means position number {{targetPosition}} from the front."',
        level3: '"The {{targetOrdinalWord}} position is number {{targetPosition}} from the front. Start at the first character and count forward: 1st, 2nd, 3rd... stop at {{targetPosition}}. That\'s the one we need!"',
      },
      commonStruggles: [
        { pattern: 'Student counts from the wrong end of the line', response: 'Remind student that ordinal positions start from the front/left: "We always start counting from the front of the line. Who is first in line?"' },
        { pattern: 'Student confuses ordinal word with cardinal number', response: 'Connect ordinal to cardinal: "Third means the 3rd one. Count 1, 2, 3 and stop! That\'s the third one."' },
        { pattern: 'Student selects adjacent position (off by one)', response: 'Guide careful recount: "You are very close! Let\'s count together one more time, touching each character as we go."' },
        { pattern: 'Student struggles with relative position questions', response: 'Anchor from known position: "You found the 3rd one. Now, what is right before it? Count: 1st, 2nd... that is the one just before 3rd."' },
      ],
    },
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name ordinal position',
      },
      {
        evalMode: 'match',
        label: 'Match (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['match'],
        description: 'Connect ordinal to position',
      },
      {
        evalMode: 'relative_position',
        label: 'Relative Position (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['relative-position'],
        description: 'Compare positions (before/after)',
      },
      {
        evalMode: 'sequence_story',
        label: 'Sequence Story (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['sequence-story'],
        description: 'Apply ordinals in context',
      },
      {
        evalMode: 'build_sequence',
        label: 'Build Sequence (Scaffold 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['build-sequence'],
        description: 'Construct ordering from scratch',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'sorting-station',
    description: 'Interactive sorting station where students categorize objects by attributes (color, shape, size). Supports single-attribute sorting, multi-attribute classification, count-and-compare, odd-one-out, and tally recording. Perfect for teaching data organization and logical reasoning. ESSENTIAL for Kindergarten and Grade 1 math.',
    constraints: 'Best for K-1. Objects should be familiar (animals, shapes, food, toys). Max 4 sorting categories. Max 10 objects per challenge.',
    evalModes: [
      {
        evalMode: 'sort_one',
        label: 'Sort by One (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['sort-by-one'],
        description: 'Sort objects by a single visible attribute (color, shape, or size).',
      },
      {
        evalMode: 'sort_attribute',
        label: 'Sort by Attribute (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['sort-by-attribute'],
        description: 'Objects have multiple attributes; student chooses how to sort.',
      },
      {
        evalMode: 'count_compare',
        label: 'Count & Compare (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['count-and-compare'],
        description: 'Count sorted groups and answer a comparison question.',
      },
      {
        evalMode: 'odd_one_out',
        label: 'Odd One Out (Tier 3+)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['odd-one-out'],
        description: 'Identify the object that does not belong in the group.',
      },
      {
        evalMode: 'two_attributes',
        label: 'Two Attributes (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['two-attributes'],
        description: 'Find objects matching two attributes simultaneously.',
      },
      {
        evalMode: 'tally_record',
        label: 'Tally & Record (Tier 4+)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['tally-record'],
        description: 'Sort objects and record group counts using tally marks.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is sorting {{totalObjects}} objects into categories based on {{sortingAttribute}}. Challenge type: {{challengeType}}. Categories: {{categories}}.',
      contextKeys: ['challengeType', 'sortingAttribute', 'categories', 'objectsSorted', 'totalObjects', 'studentAnswer', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the objects. What do you notice about them? Do any look alike?"',
        level2: '"Look at the {{sortingAttribute}} of each object. Can you put all the ones that are the same together? Try the {{categories}} bins."',
        level3: '"Let\'s sort step by step. Pick up this object — what {{sortingAttribute}} is it? Now find the bin that matches. Great! Now do the next one."',
      },
      commonStruggles: [
        { pattern: 'Student places objects in random bins without considering attributes', response: 'Ask "What color/shape/size is this one?" before placing. Point to the bin labels.' },
        { pattern: 'Student confuses "more" and "fewer" in comparisons', response: 'Have the student count each group aloud, then ask "Which number is bigger?"' },
        { pattern: 'Student struggles with two-attribute sorting', response: 'Break into steps: "First, find all the BLUE ones. Now, which of those are also CIRCLES?"' },
        { pattern: 'Student cannot identify the odd one out', response: 'Ask "What do most of these have in common?" then "Which one is different from the rest?"' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'shape-sorter',
    description: 'Attribute-focused geometry primitive with 3 challenge types: identify (find shapes matching a rule), count (count sides and corners), and sort (group by attribute). Teaches Defining vs Non-Defining Attributes through a unified shape pool — correctness derived in code. Perfect for K-1 geometry foundations. ESSENTIAL for Kindergarten and Grade 1 geometry.',
    constraints: 'Shapes limited to: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval. Grade K-1 only. Rules: shape, color, sides, curved.',
    tutoring: {
      taskDescription: 'Student is working on a {{challengeType}} challenge. Rule attribute: {{ruleAttribute}}. Instruction: "{{instruction}}".',
      contextKeys: ['challengeType', 'ruleAttribute', 'targetValue', 'shapeName', 'expectedSides', 'expectedCorners', 'instruction', 'attemptNumber', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the shapes. Which ones look alike? What do you notice about them?"',
        level2: '"Count the sides. How many sides does this one have? Remember, shapes keep their name no matter how big, small, or rotated they are."',
        level3: '"This shape has {{expectedSides}} straight sides and {{expectedCorners}} corners. Even when it is turned sideways, it is still the same shape!"',
      },
      commonStruggles: [
        { pattern: 'Student confuses rotated shapes with different shape types', response: 'Emphasize that shapes keep their identity regardless of orientation. A triangle turned on its side is still a triangle — count the sides together.' },
        { pattern: 'Student counts sides incorrectly for shapes with many sides', response: 'Guide the student to tap each side one at a time. Use the sequential highlighting to make each side visible.' },
        { pattern: 'Student confuses similar shapes like square/rectangle or diamond/rhombus', response: 'Compare the shapes side by side. Point out specific differences: "A square has 4 equal sides, but a rectangle has 2 long sides and 2 short sides."' },
        { pattern: 'Student sorts by non-defining attribute when asked about defining attribute', response: 'Redirect: "Color and size can change, but the number of sides stays the same. Count the sides to decide which group it belongs in."' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name 2D shapes by visual recognition.',
      },
      {
        evalMode: 'count',
        label: 'Count (Pictorial)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count'],
        description: 'Count sides and corners of a given shape.',
      },
      {
        evalMode: 'sort',
        label: 'Sort (Pictorial–)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['sort'],
        description: 'Classify shapes by geometric property.',
      },
    ],
  },
  {
    id: '3d-shape-explorer',
    description: '3D Shape Explorer — introduces cubes, cones, cylinders, spheres, and rectangular prisms through multi-phase challenges: identifying shapes, sorting 2D vs 3D, matching to real-world objects, analyzing properties (faces, rolling, stacking), and comparing shapes side by side. Perfect for building 3D geometry vocabulary and spatial reasoning. ESSENTIAL for Kindergarten and Grade 1 geometry.',
    constraints: 'Shapes limited to: cube, sphere, cylinder, cone, rectangular-prism. Properties must use accurate geometry (e.g., cube has 6 flat faces, sphere has 0). Real-world object matches must be unambiguous.',
    tutoring: {
      taskDescription: 'Student is exploring 3D shapes through {{challengeType}} challenges. Current shape: {{shape3d}}. They need to identify, sort, match, or analyze properties of 3D shapes.',
      contextKeys: ['challengeType', 'shape3d', 'displayShape', 'properties', 'attemptNumber', 'shape1', 'shape2', 'instruction', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at this shape. Is it flat like a piece of paper, or could you pick it up and hold it?"',
        level2: '"Try to think about its flat parts. How many flat faces can you see? What shape are those flat parts?"',
        level3: '"This is a {{shape3d}}. Let me tell you about it: [describe faces, curved surfaces, real-world example]. A cube is like a dice block. A sphere is like a ball. A cylinder is like a can."',
      },
      commonStruggles: [
        { pattern: 'Confuses 2D circle with 3D sphere', response: 'A circle is flat — you can draw it on paper. A sphere is round all the way around, like a ball you can hold. Can you hold a circle? No, but you can hold a sphere!' },
        { pattern: 'Cannot count flat faces on a shape', response: 'Let us look at one side at a time. The top is flat — that is one face. Now the bottom — that is two. What about the sides?' },
        { pattern: 'Struggles to connect real-world objects to shape names', response: 'Think about what you can find at home. A soup can is a cylinder — it has circles on top and bottom. A box is a rectangular prism. What shape is a ball?' },
        { pattern: 'Confuses "roll" and "slide" properties', response: 'Rolling means it can move smoothly like a ball. Sliding means it moves flat on a surface. A cube slides but does not roll. A sphere rolls but does not slide flat.' },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify_3d',
        label: 'Identify 3D (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify-3d'],
        description: 'Name 3D shapes from visual display.',
      },
      {
        evalMode: 'match_real_world',
        label: 'Match Real World (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['match-to-real-world'],
        description: 'Connect 3D shapes to real-world objects.',
      },
      {
        evalMode: '2d_vs_3d',
        label: '2D vs 3D (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['2d-vs-3d'],
        description: 'Compare and sort 2D and 3D shapes.',
      },
      {
        evalMode: 'faces_properties',
        label: 'Faces & Properties (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['faces-and-properties'],
        description: 'Analyze faces, edges, vertices, and movement properties.',
      },
      {
        evalMode: 'shape_riddle',
        label: 'Shape Riddle (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['shape-riddle'],
        description: 'Deductive identification from property clues.',
      },
    ],
  },
  {
    id: 'shape-tracer',
    description: 'Interactive shape construction canvas with 4 progressive challenge types: trace (follow dotted outlines), complete (finish half-drawn shapes), draw-from-description (build shapes from verbal property descriptions), and connect-dots (reveal shapes by connecting numbered dots). Develops geometric reasoning by linking shape properties to motor construction. Perfect for K-1 shape recognition and spatial reasoning. ESSENTIAL for Kindergarten and Grade 1 geometry.',
    constraints: 'Canvas coordinate space is 500x400. All vertex coordinates must be within bounds (x: 40-460, y: 40-360). Shapes should be large enough for small hands to tap. Maximum 6 challenges per activity.',
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
    description: 'Rapid-fire math fact fluency practice with 5 progressive challenge types: visual facts with dot arrays/ten-frames, bare equation solving, missing number problems, visual-equation matching, and timed speed rounds. Builds automaticity for addition and subtraction facts within 3, 5, or 10. Perfect for K-1 fact fluency development. ESSENTIAL for Kindergarten and Grade 1 math fact recall.',
    constraints: 'Facts limited to addition and subtraction within maxNumber (3, 5, or 10). Visual aids only in visual-fact and match phases. Speed round has no multiple choice. Time limits vary by phase (3-8 seconds).',
    evalModes: [
      {
        evalMode: 'visual_fact',
        label: 'Visual Fact (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['visual-fact'],
        description: 'Picture-based fact recognition with dot arrays, ten-frames, or fingers.',
      },
      {
        evalMode: 'match',
        label: 'Match (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['match'],
        description: 'Connect visual representations to their equations.',
      },
      {
        evalMode: 'equation_solve',
        label: 'Equation Solve (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['equation-solve'],
        description: 'Solve bare equations with multiple choice.',
      },
      {
        evalMode: 'missing_number',
        label: 'Missing Number (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-number'],
        description: 'Find the unknown operand in an equation.',
      },
      {
        evalMode: 'speed_round',
        label: 'Speed Round (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['speed-round'],
        description: 'Timed fluency assessment — rapid recall without aids.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is practicing math fact fluency. Current challenge type: {{challengeType}}. Equation: {{equation}} ({{operation}}). Unknown position: {{unknownPosition}}. This is about building SPEED, not just accuracy.',
      contextKeys: ['challengeType', 'equation', 'operation', 'unknownPosition', 'correctAnswer', 'operand1', 'operand2', 'result', 'attemptNumber', 'streak', 'accuracy', 'averageTime'],
      scaffoldingLevels: {
        level1: '"Take your time! Look at the numbers. What do you get when you put {{operand1}} and {{operand2}} together?"',
        level2: '"Think: {{operand1}}... then count on {{operand2}} more. Use your fingers if you need to!"',
        level3: '"Let me help: start at {{operand1}}, now count up {{operand2}} more... what number do you land on?"',
      },
      commonStruggles: [
        { pattern: 'Student answers correctly but slowly (>5 seconds)', response: 'Affirm correctness and encourage speed: "You got it! With more practice, this will feel automatic."' },
        { pattern: 'Student struggles with subtraction facts', response: 'Connect to addition: "If 3 + 2 = 5, then 5 - 2 = ?"' },
        { pattern: 'Student struggles with missing-number problems', response: 'Encourage think-backwards strategy: "If 3 + __ = 5, think: what do I add to 3 to get to 5?"' },
        { pattern: 'Student keeps running out of time', response: 'Reduce pressure: "Don\'t worry about the timer. Let\'s just practice getting the right answer first."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'strategy-picker',
    description: 'An interactive strategy-comparison activity where students solve the same problem using 2-3 different strategies (counting on, make-ten, doubles, tally marks, draw objects), then compare and reflect on which approach they prefer. Builds mathematical flexibility and metacognitive awareness. Perfect for K-1 multi-strategy standards. ESSENTIAL for Kindergarten-Grade 1 addition and subtraction within 10.',
    constraints: 'Numbers within 5 (K) or 10 (Grade 1). Requires 2+ strategies per problem. Compare phase is metacognitive—no wrong answers.',
    tutoring: {
      taskDescription: 'Student is solving {{equation}} using {{assignedStrategy}}. Challenge type: {{challengeType}}. They have completed strategies: {{strategiesCompleted}}.',
      contextKeys: ['challengeType', 'equation', 'assignedStrategy', 'strategySteps', 'studentAnswer', 'attemptNumber', 'chosenStrategy', 'strategiesCompleted'],
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
    tutoring: {
      taskDescription: 'Student is writing the numeral {{digit}}. Challenge type: {{challengeType}}. Attempt {{attemptNumber}}. Model visible: {{showModel}}.',
      contextKeys: ['digit', 'challengeType', 'instruction', 'showModel', 'showArrows', 'attemptNumber', 'lastScore', 'gradeBand'],
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
    evalModes: [
      {
        evalMode: 'compare',
        label: 'Compare (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare'],
        description: 'Which object is longer or shorter? Direct visual comparison.',
      },
      {
        evalMode: 'tile_and_count',
        label: 'Tile & Count (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['tile_and_count'],
        description: 'Tile non-standard units end-to-end along an object and count them.',
      },
      {
        evalMode: 'order',
        label: 'Order (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order'],
        description: 'Arrange three objects from shortest to longest.',
      },
      {
        evalMode: 'indirect',
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
    evalModes: [
      {
        evalMode: 'read',
        label: 'Read Time (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['read'],
        description: 'Read analog clock face and pick correct time from 4 options',
      },
      {
        evalMode: 'set_time',
        label: 'Set Time (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['set_time'],
        description: 'Drag clock hands to show a given time',
      },
      {
        evalMode: 'match',
        label: 'Match (Tier 2)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match'],
        description: 'Match analog face to correct digital display from 4 options',
      },
      {
        evalMode: 'elapsed',
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
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify (Scaffold 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Name coins by appearance; match coin to value',
      },
      {
        evalMode: 'count-like',
        label: 'Count Like Coins (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count'],
        description: 'Count sets of same coin type (5 pennies = 5¢)',
      },
      {
        evalMode: 'count-mixed',
        label: 'Count Mixed Coins (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count'],
        description: 'Count mixed coin sets (2 dimes + 3 pennies = 23¢)',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Scaffold 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['compare'],
        description: 'Which coin group has more money?',
      },
      {
        evalMode: 'make-amount',
        label: 'Make Amount (Scaffold 2)',
        beta: 3.5,
        scaffoldingMode: 2,
        challengeTypes: ['make-amount'],
        description: 'Drag coins to build a target amount',
      },
      {
        evalMode: 'make-change',
        label: 'Make Change (Scaffold 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['make-change'],
        description: 'Calculate change from a purchase',
      },
      {
        evalMode: 'fewest-coins',
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
    description: 'Grid-based spatial reasoning for K.G.1 positional language. Students identify, place, and describe object positions using spatial vocabulary (above, below, beside, between). Supports multiple challenge types from simple identification to multi-step spatial placement. ESSENTIAL for K-1 geometry.',
    constraints: 'Requires a grid layout with placed objects. Challenges array drives interactivity. Grade band K-1.',
    tutoring: {
      taskDescription: 'Student identifies, places, or describes positions of objects on a grid using spatial vocabulary (above, below, beside, between).',
      contextKeys: ['instruction', 'sceneObjects', 'targetObject', 'correctPosition', 'referenceObjectName', 'options', 'steps', 'gradeBand'],
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
        label: 'Identify (Scaffold 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Multiple-choice: Where is the cat? → above/below/beside',
      },
      {
        evalMode: 'place',
        label: 'Place (Scaffold 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['place'],
        description: 'Place object at described position: Put the ball above the box',
      },
      {
        evalMode: 'describe',
        label: 'Describe (Scaffold 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['describe'],
        description: 'Select the position word for a shown arrangement',
      },
      {
        evalMode: 'follow_directions',
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
    evalModes: [
      {
        evalMode: 'count_faces_edges_vertices',
        label: 'Count FEV (Easy)',
        beta: -0.8,
        scaffoldingMode: 1,
        challengeTypes: ['count_faces_edges_vertices'],
        description: 'Count faces, edges, and vertices of a 3D solid',
      },
      {
        evalMode: 'identify_solid',
        label: 'Identify Solid (Easy-Medium)',
        beta: -0.3,
        scaffoldingMode: 2,
        challengeTypes: ['identify_solid'],
        description: 'Identify the 3D solid from its appearance or net',
      },
      {
        evalMode: 'match_faces',
        label: 'Match Faces (Medium)',
        beta: 0.2,
        scaffoldingMode: 3,
        challengeTypes: ['match_faces'],
        description: 'Match highlighted net faces to corresponding solid faces',
      },
      {
        evalMode: 'valid_net',
        label: 'Valid Net (Medium-Hard)',
        beta: 0.7,
        scaffoldingMode: 4,
        challengeTypes: ['valid_net'],
        description: 'Determine whether a given 2D net folds into a valid solid',
      },
      {
        evalMode: 'surface_area',
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
        label: 'Build Simple',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Build a given equation from tiles.',
      },
      {
        evalMode: 'missing-result',
        label: 'Missing Result',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['missing-value'],
        description: 'Find the result of an equation (? after =).',
      },
      {
        evalMode: 'true-false',
        label: 'True or False',
        beta: 2.0,
        scaffoldingMode: 3,
        challengeTypes: ['true-false'],
        description: 'Determine if an equation is true or false.',
      },
      {
        evalMode: 'missing-operand',
        label: 'Missing Operand',
        beta: 2.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-value'],
        description: 'Find a missing operand (? before =).',
      },
      {
        evalMode: 'balance-both-sides',
        label: 'Balance Both Sides',
        beta: 3.5,
        scaffoldingMode: 5,
        challengeTypes: ['balance'],
        description: 'Make both sides of = equal.',
      },
      {
        evalMode: 'rewrite',
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
    description: 'Interactive measurement comparison activity where students describe and compare measurable attributes (length, height, weight, capacity) of real-world objects. Supports identifying attributes, direct comparison of two objects, ordering three objects, and measuring with non-standard units (paperclips, blocks). Builds foundational measurement vocabulary and comparative reasoning. ESSENTIAL for K-1 measurement and data (K.MD.1-2).',
    constraints: 'Best for grades K-1. Requires objects with measurable attributes. K: compare 2 objects directly. Grade 1: order 3 objects and use non-standard units.',
    evalModes: [
      {
        evalMode: 'identify_attribute',
        label: 'Identify Attribute (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify_attribute'],
        description: 'Identify measurable attributes of objects.',
      },
      {
        evalMode: 'compare_two',
        label: 'Compare Two (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare_two'],
        description: 'Direct comparison of 2 objects on a named attribute.',
      },
      {
        evalMode: 'order_three',
        label: 'Order Three (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['order_three'],
        description: 'Order 3 objects by a measurable attribute.',
      },
      {
        evalMode: 'non_standard',
        label: 'Non-Standard Measure (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['non_standard'],
        description: 'Measure using non-standard units (paperclips, blocks).',
      },
    ],
    tutoring: {
      taskDescription: 'Student is comparing {{attribute}} of objects. They need to determine which object is {{comparisonWord}}.',
      contextKeys: ['attribute', 'objects', 'comparisonWord', 'instruction', 'challengeType', 'currentChallengeIndex', 'attemptNumber', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"Look at the two objects carefully. Which one looks {{comparisonWord}}? Point to it!"',
        level2: '"Think about {{attribute}}. Put the objects side by side — which one is {{comparisonWord}}? How can you tell?"',
        level3: '"Let\'s compare step by step: line up the objects at one end. Now look at the other end — which one goes further? That one is {{comparisonWord}}."',
      },
      commonStruggles: [
        { pattern: 'Confuses attributes (e.g., says taller when asked about heavier)', response: '"We are comparing {{attribute}} right now, not how they look. Think about {{attribute}} — which one has more {{attribute}}?"' },
        { pattern: 'Compares using wrong direction (picks shorter when asked for taller)', response: '"{{comparisonWord}} means it has MORE {{attribute}}. Look again — which object has MORE {{attribute}}?"' },
        { pattern: 'Cannot order three objects (only compares two at a time)', response: '"Start by finding the one with the MOST {{attribute}}. Now find the one with the LEAST. The last one goes in the middle!"' },
      ],
      aiDirectives: [
        {
          title: 'MEASUREMENT VOCABULARY COACHING',
          instruction:
            'Model precise measurement comparison language: "longer/shorter," "taller/shorter," "heavier/lighter," "holds more/holds less." '
            + 'For K students, use concrete comparisons: "Put them next to each other. Which one goes past the other?" '
            + 'For Grade 1, introduce transitivity: "If A is longer than B, and B is longer than C, then A is the longest." '
            + 'Never accept vague language like "bigger" — always redirect to the specific attribute being compared.',
        },
        {
          title: 'NON-STANDARD UNITS COACHING',
          instruction:
            'For non-standard measurement challenges, emphasize consistent unit placement: "Line up the paperclips end to end with no gaps and no overlaps." '
            + 'Help students understand why the same object can have different measurements with different units: "It took 5 paperclips but only 3 blocks — the blocks are bigger!" '
            + 'Connect to the idea that measurement means covering the whole length.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'parameter-explorer',
    description: 'Multi-variable formula explorer with interactive sliders. Students adjust parameters via continuous sliders to observe how output changes in real-time. Supports prediction checkpoints and hold-and-vary (lock variables). Perfect for exploring STEM relationships (physics, chemistry, economics). ESSENTIAL for grade 6-12 science and math.',
    constraints: 'Requires jsExpression (JS-evaluable formula) alongside LaTeX formula. Parameters need numeric min/max/step ranges. Works best with 2-3 parameters.',
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore (Tier 1)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['explore'],
        description: 'Free exploration with guided observations, no scoring pressure',
      },
      {
        evalMode: 'predict-direction',
        label: 'Predict Direction (Tier 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict-direction'],
        description: 'Predict whether output increases, decreases, or stays the same when a parameter changes',
      },
      {
        evalMode: 'identify-relationship',
        label: 'Identify Relationship (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['identify-relationship'],
        description: 'Identify which parameter has the strongest effect on the output',
      },
      {
        evalMode: 'predict-value',
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
    description: 'Qualitative function reasoning primitive for grades 9-12. Students analyze function behavior by shape, key features, and family — without computing exact values. Supports four challenge types: classify-shape (linear/quadratic/exponential/periodic), identify-features (roots, extrema, intercepts, asymptotes), compare-functions (two curves, match to description), and sketch-match (place control points to sketch a described function). Pedagogical moments: FEATURE_FOUND, ANSWER_CORRECT, ANSWER_INCORRECT, NEXT_ITEM, ALL_COMPLETE. ESSENTIAL for Algebra 2, Precalculus, and AP Calculus qualitative reasoning.',
    constraints: 'Best for grades 9-12. Requires a title and context string. Each challenge specifies a type (classify-shape | identify-features | compare-functions | sketch-match) and an instruction. Sketch-match requires control-point placement UI; identify-features requires annotatable curve with clickable feature markers.',
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
        label: 'Sketch Match (Tier 4)',
        beta: 3.5,
        scaffoldingMode: 5,
        challengeTypes: ['sketch-match'],
        description: 'Place control points to sketch a described function',
      },
    ],
    tutoring: {
      taskDescription: 'Student is analyzing function behavior in "{{title}}" — {{context}}. Challenge type: {{type}}, instruction: "{{instruction}}".',
      contextKeys: ['title', 'context', 'challenges'],
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
    },
    supportsEvaluation: true,
  },
];
