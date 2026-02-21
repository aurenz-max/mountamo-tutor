/**
 * Math Catalog - Component definitions for mathematics primitives
 *
 * Contains 23 math visualization components for teaching mathematical concepts
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
  },
  {
    id: 'place-value-chart',
    description: 'Multi-phase interactive place value chart with three learning stages: (1) identify the place of a highlighted digit via multiple choice, (2) find the value of that digit via multiple choice, (3) build the number by entering digits into an interactive chart. Progressive scaffolding from place recognition to value understanding to full number construction. Supports whole numbers and decimals from millions to thousandths. ESSENTIAL for elementary place value instruction.',
    constraints: 'Requires a target number with clear place value structure. Grade level determines digit range and decimal inclusion. Denominator range for places depends on grade band.',
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
  },
  {
    id: 'double-number-line',
    description: 'INTERACTIVE PROBLEM-SOLVING PRIMITIVE: Students find missing values on two parallel number lines by calculating proportional relationships. Perfect for teaching ratios, unit rates, proportional relationships, measurement conversions, percent problems, and speed/distance relationships through active problem-solving. Students enter values in input fields and receive immediate feedback. Critical bridge from additive to multiplicative reasoning. ESSENTIAL for grades 5-8 ratios and proportions practice.',
    constraints: 'Requires two quantity labels and proportional relationship. Automatically generates 2-4 target points for students to solve. Can optionally provide 1-2 hint points (like origin or unit rate). Example config: { targetPoints: [...], givenPoints: [...], showUnitRate: true }',
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
  },
  {
    id: 'percent-bar',
    description: 'Horizontal bar model with percentage markings showing the relationship between a part and whole. Perfect for teaching percentages, percent of a quantity, discounts, tax, tips, percent increase/decrease, and part-to-whole relationships. Visual representation with 0% to 100% scale. ESSENTIAL for grades 6-8 percent concepts.',
    constraints: 'Requires a percent value and context (total amount). Best for concrete percent problems with real-world applications.',
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
  },
  {
    id: 'coordinate-graph',
    description: 'Full-featured 2D Cartesian coordinate plane for plotting points, graphing lines, curves, and functions. Perfect for teaching ordered pairs, linear equations, slope, intercepts, systems of equations, quadratic functions, and function families. Students can click to plot points, view graphed equations, trace curves to read coordinates, and identify key features like intercepts. ESSENTIAL for grades 5-6 (ordered pairs), grades 7-8 (linear equations), Algebra 1-2 (function graphing), and Precalculus (function transformations).',
    constraints: 'Requires axis ranges (xRange, yRange). Supports plotMode: "points" for plotting practice or "equation" for graphing functions. Equations must use y= format with * for multiplication and ** for exponents (e.g., "y = 2*x + 1", "y = x**2 - 4*x + 3").',
    tutoring: {
      taskDescription: 'Work with the coordinate plane. Mode: {{plotMode}}. Equations: {{equations}}.',
      contextKeys: ['plotMode', 'equations', 'points', 'xRange', 'yRange'],
      scaffoldingLevels: {
        level1: '"Where is the origin? Which direction is positive x? Positive y?"',
        level2: '"To plot ({{x}}, {{y}}): start at the origin, go {{x}} units right, then {{y}} units up."',
        level3: '"For the equation y = {{equation}}, pick an x value, calculate y, and plot the point. Repeat for 3-4 points, then connect them."',
      },
      commonStruggles: [
        { pattern: 'Swapping x and y coordinates', response: '"Remember: (x, y) means go RIGHT first, then UP. Alphabetical order: x before y."' },
        { pattern: 'Negative coordinate confusion', response: '"Negative x means go LEFT. Negative y means go DOWN."' },
        { pattern: 'Cannot identify intercepts', response: '"The y-intercept is where the line crosses the vertical axis (x=0). The x-intercept is where it crosses the horizontal axis (y=0)."' },
      ],
      aiDirectives: [
        {
          title: 'GRADE-BAND ADAPTATION',
          instruction:
            'For grades 5-6: focus on Quadrant I with positive coordinates. Use "go right, then up" language. '
            + 'For grades 7-8: introduce all four quadrants. Teach the sign rules: '
            + '"Quadrant I: both positive. Quadrant II: x negative, y positive." etc. '
            + 'For Algebra 1+: focus on equation graphing. Guide table-of-values strategy: '
            + '"Pick 3-4 x values, calculate y for each, plot the points, connect them."',
        },
        {
          title: 'PLOTTING VS EQUATION MODE',
          instruction:
            'In POINTS mode: coach precise point placement — "Start at zero and count the grid lines." '
            + 'In EQUATION mode: guide reading the graph — "Where does the line cross the y-axis? That is the y-intercept (b in y=mx+b)." '
            + 'Always encourage tracing: "Hover over the line to read coordinates at any point."',
        },
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
    constraints: 'Matrix dimensions typically 2×2 to 4×4 (or 2×3 to 3×4 for augmented). Use simple integers for elementary/middle school, include fractions/decimals for advanced topics. For determinant visualization, show step-by-step calculation with cell highlighting. For inverse, show method (adjugate for 2×2, Gaussian elimination for 3×3+). For row operations, label each operation clearly (e.g., "R₂ - 2R₁ → R₂"). Include educational explanations that can be toggled. Ensure all step-by-step operations show intermediate matrices with proper highlighting.',
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
  },
  {
    id: 'skip-counting-runner',
    description: 'Rhythmic skip counting with animated number line jumps for grades 1-3. A character (frog, kangaroo, rabbit, rocket) jumps along a number line in equal leaps, landing on multiples. Students count along, predict landing spots, identify skip values, fill missing numbers, and connect to multiplication facts. Parallel array visualization links skip counting to multiplication. Supports forward and backward counting. ESSENTIAL for grades 1-3 skip counting, multiplication foundations, and number pattern recognition.',
    constraints: 'Best for grades 1-3. Grades 1-2: skip by 2s, 5s, 10s, forward only, count_along and predict challenges. Grades 2-3: skip by 3s, 4s, backward counting, multiplication connections.',
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
    id: 'regrouping-workbench',
    description: 'Interactive addition and subtraction with regrouping (carrying and borrowing) for grades 1-4. Split view: base-ten blocks workspace (ones cubes, tens rods, hundreds flats) alongside the written algorithm. Students tap to trade 10 ones for 1 ten (carry) or break 1 ten into 10 ones (borrow). The blocks and algorithm update in parallel. Progressive phases from exploration to solving. Supports word problem contexts. ESSENTIAL for grades 1-4 multi-digit addition, subtraction, regrouping, and standard algorithm understanding.',
    constraints: 'Best for grades 1-4. Grades 1-2: two-digit problems with one regroup, addition focus. Grades 3-4: three-digit problems with multiple regroups, addition and subtraction.',
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
    description: 'Virtual measurement instruments (ruler, tape measure, scale, balance, measuring cup, thermometer) for teaching length, weight, capacity, and temperature measurement. Students choose tools, estimate first, then measure real-world objects. Supports non-standard units (paper clips, hand spans) for grade 1, standard units for grades 2-5, and unit conversion for grades 3-5. Progressive phases: Explore → Estimate → Precision → Convert. ESSENTIAL for grades 1-5 measurement and data standards.',
    constraints: 'Requires a tool type matching the measurement type (ruler→length, scale→weight, etc.). Best for grades 1-5. Grades 1-2 use whole-number precision and simple objects. Grades 3-5 add half/quarter precision and conversion challenges.',
    tutoring: {
      taskDescription: 'Measure the {{objectName}} using a {{toolType}}. Measurement type: {{measurementType}}. Unit: {{unit}}. Phase: {{currentPhase}}. Actual value: {{actualValue}} {{unit}}.',
      contextKeys: ['toolType', 'measurementType', 'objectName', 'actualValue', 'unit', 'currentPhase', 'measurementValue', 'estimateValue', 'challengeType', 'attemptNumber', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"What tool would you use to measure this? Look at the {{toolType}} — what do the markings mean?"',
        level2: '"Look carefully at where the measurement lines up. Read at the nearest {{precision}} mark. Is your answer close to the markings?"',
        level3: '"The {{objectName}} measures {{actualValue}} {{unit}}. To convert: there are {{conversionFactor}} {{secondaryUnit}} in 1 {{primaryUnit}}. So multiply or divide to convert."',
      },
      commonStruggles: [
        { pattern: 'Choosing wrong tool', response: '"Would you use a ruler or a scale to find how heavy something is? Think about what you are measuring: length, weight, or how much liquid."' },
        { pattern: 'Not starting from zero on ruler', response: '"Make sure the object starts at the 0 mark on the ruler. Line it up carefully!"' },
        { pattern: 'Reading between marks incorrectly', response: '"Look at where the measurement falls between two marks. Is it closer to the lower mark or the higher one?"' },
        { pattern: 'Confusing units within a system', response: '"Remember: 100 centimeters = 1 meter. Centi means one hundred! So 150 cm = 1.5 meters."' },
        { pattern: 'Estimation far from actual', response: '"Compare to something you know. A pencil is about 19 cm. Is this object longer or shorter than a pencil?"' },
      ],
      aiDirectives: [
        {
          title: 'PHASE-AWARE MEASUREMENT COACHING',
          instruction:
            'In Explore phase, let students freely use the tool — celebrate curiosity. '
            + 'In Estimate phase, ask them to compare to known objects before measuring. '
            + 'In Precision phase, teach reading between marks: "Is it exactly on a line or between two lines?" '
            + 'In Convert phase, reference the conversion chart and guide step-by-step multiplication/division.',
        },
        {
          title: 'ESTIMATION CELEBRATION',
          instruction:
            'When a student estimates within 15% of the actual value, celebrate: "Amazing estimate! You were so close!" '
            + 'When further off, encourage: "Good try! After measuring, you\'ll get even better at estimating next time." '
            + 'Build estimation confidence — it is a critical real-world skill.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'shape-builder',
    description: 'Interactive geometry workspace for constructing shapes on dot/coordinate grids, measuring properties with ruler/protractor tools, classifying shapes into categories, composing/decomposing shapes, and finding lines of symmetry. Supports build, discover, classify, compose, decompose, and symmetry modes. Perfect for teaching shape construction, property discovery, classification hierarchies, and spatial reasoning. ESSENTIAL for K-5 geometry.',
    constraints: 'Requires challenges array with progressive difficulty. Grid-based workspace (dot or coordinate). Supports modes: build, discover, classify, compose, decompose, symmetry.',
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
];
