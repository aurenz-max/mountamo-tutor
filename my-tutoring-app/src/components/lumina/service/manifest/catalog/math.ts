import { bossEntry } from '../../../components/live-activity/boss';
import { arrayGridCard } from '../../../primitives/visual-primitives/math/arrayGrid.card';
import { additionSubtractionSceneCard } from '../../../primitives/visual-primitives/math/additionSubtractionScene.card';
import { barModelCard } from '../../../primitives/visual-primitives/math/barModel.card';
import { balanceScaleCard } from '../../../primitives/visual-primitives/math/balanceScale.card';
import { coinCounterCard } from '../../../primitives/visual-primitives/math/coinCounter.card';
import { regroupingWorkbenchCard } from '../../../primitives/visual-primitives/math/regroupingWorkbench.card';
import { percentBarCard } from '../../../primitives/visual-primitives/math/percentBar.card';
import { transformationLabCard } from '../../../primitives/visual-primitives/math/transformationLab.card';
import { netFolderCard } from '../../../primitives/visual-primitives/math/netFolder.card';
import { formulaLabCard } from '../../../primitives/visual-primitives/math/formulaLab.card';
import { parameterExplorerCard } from '../../../primitives/visual-primitives/math/parameterExplorer.card';
import { ratioTableCard } from '../../../primitives/visual-primitives/math/ratioTable.card';
import { matrixDisplayCard } from '../../../primitives/visual-primitives/math/matrixDisplay.card';
import { histogramCard } from '../../../primitives/visual-primitives/math/histogram.card';
import { twoWayTableCard } from '../../../primitives/visual-primitives/math/twoWayTable.card';
import { baseTenBlocksCard } from '../../../primitives/visual-primitives/math/baseTenBlocks.card';
import { fractionCirclesCard } from '../../../primitives/visual-primitives/math/fractionCircles.card';
import { fractionBarCard } from '../../../primitives/visual-primitives/math/fractionBar.card';
import { coordinateGraphCard } from '../../../primitives/visual-primitives/math/coordinateGraph.card';
import { systemsEquationsCard } from '../../../primitives/visual-primitives/math/systemsEquations.card';
import { slopeTriangleCard } from '../../../primitives/visual-primitives/math/slopeTriangle.card';
import { functionSketchCard } from '../../../primitives/visual-primitives/math/functionSketch.card';
import { circleExplorerCard } from '../../../primitives/visual-primitives/math/circleExplorer.card';
import { distributionExplorerCard } from '../../../primitives/distribution-explorer/distributionExplorer.card';
import { doubleNumberLineCard } from '../../../primitives/visual-primitives/math/doubleNumberLine.card';
import { factorTreeCard } from '../../../primitives/visual-primitives/math/factorTree.card';
import { equationWorkspaceCard } from '../../../primitives/visual-primitives/math/equationWorkspace.card';
import { practiceProblemCard } from '../../../primitives/visual-primitives/math/practiceProblem.card';
import { measureLabCard } from '../../../primitives/visual-primitives/math/measureLab.card';
import { measurementToolsCard } from '../../../primitives/visual-primitives/math/measurementTools.card';
import { areaModelCard } from '../../../primitives/visual-primitives/math/areaModel.card';
import { multiplicationExplorerCard } from '../../../primitives/visual-primitives/math/multiplicationExplorer.card';
import { lengthLabCard } from '../../../primitives/visual-primitives/math/lengthLab.card';
import { analogClockCard } from '../../../primitives/visual-primitives/math/analogClock.card';
import { timeSequencerCard } from '../../../primitives/visual-primitives/math/timeSequencer.card';
import { polygonAreaBuilderCard } from '../../../primitives/visual-primitives/math/polygonAreaBuilder.card';
import { compareObjectsCard } from '../../../primitives/visual-primitives/math/compareObjects.card';
import { comparisonBuilderCard } from '../../../primitives/visual-primitives/math/comparisonBuilder.card';
import { countingBoardCard } from '../../../primitives/visual-primitives/math/countingBoard.card';
import { equationBuilderCard } from '../../../primitives/visual-primitives/math/equationBuilder.card';
import { functionMachineCard } from '../../../primitives/visual-primitives/math/functionMachine.card';
import { hundredsChartCard } from '../../../primitives/visual-primitives/math/hundredsChart.card';
import { skipCountingCard } from '../../../primitives/visual-primitives/math/skipCounting.card';
import { mathFactFluencyCard } from '../../../primitives/visual-primitives/math/mathFactFluency.card';
import { additionFactStrategiesCard } from '../../../primitives/visual-primitives/math/additionFactStrategies.card';
import { angleWorkshopCard } from '../../../primitives/visual-primitives/math/angleWorkshop.card';
import { numberBondCard } from '../../../primitives/visual-primitives/math/numberBond.card';
import { numberLineCard } from '../../../primitives/visual-primitives/math/numberLine.card';
import { numberTracerCard } from '../../../primitives/visual-primitives/math/numberTracer.card';
import { shapeTracerCard } from '../../../primitives/visual-primitives/math/shapeTracer.card';
import { ordinalLineCard } from '../../../primitives/visual-primitives/math/ordinalLine.card';
import { patternBuilderCard } from '../../../primitives/visual-primitives/math/patternBuilder.card';
import { placeValueChartCard } from '../../../primitives/visual-primitives/math/placeValueChart.card';
import { spatialSceneCard } from '../../../primitives/visual-primitives/math/spatialScene.card';
import { strategyPickerCard } from '../../../primitives/visual-primitives/math/strategyPicker.card';
import { tenFrameCard } from '../../../primitives/visual-primitives/math/tenFrame.card';
import { shapeSorterCard } from '../../../primitives/visual-primitives/math/shapeSorter.card';
import { threeDShapeExplorerCard } from '../../../primitives/visual-primitives/math/threeDShapeExplorer.card';
import { shapeBuilderCard } from '../../../primitives/visual-primitives/math/shapeBuilder.card';
import { shapeComposerCard } from '../../../primitives/visual-primitives/math/shapeComposer.card';
import { sortingStationCard } from '../../../primitives/visual-primitives/math/sortingStation.card';
import { FRACTION_TOUCH_EVAL_MODES } from '../../../primitives/visual-primitives/math/fractionTouchModes';
import { BASE_TEN_DI_EVAL_MODES } from '../../../primitives/visual-primitives/math/baseTenModes';
import { NUMBER_SEQUENCER_EVAL_MODES } from '../../../primitives/visual-primitives/math/numberSequencerModes';
import { numberSequencerCard } from '../../../primitives/visual-primitives/math/numberSequencer.card';
import { areaModelDeliveryEligible } from '../../math/areaModelRemediation';
import { barModelDeliveryEligible } from '../../math/barModelRemediation';
import { baseTenDeliveryEligible } from '../../math/baseTenRemediation';
import { fractionBarDeliveryEligible } from '../../math/fractionBarRemediation';
import { fractionCompareDeliveryEligible } from '../../math/fractionCirclesRemediation';
import { numberLineDeliveryEligible } from '../../math/numberLineRemediation';
import { countingBoardDeliveryEligible } from '../../math/countingBoardRemediation';
import { tenFrameDeliveryEligible } from '../../math/tenFrameRemediation';
import { numberTracerDeliveryEligible } from '../../math/numberTracerRemediation';
import { placeValueDeliveryEligible, placeValueRetest } from '../../math/placeValueOpportunityContract';
/**
 * Math Catalog - Component definitions for mathematics primitives
 *
 * Contains 25 math visualization components for teaching mathematical concepts
 * from elementary through advanced algebra.
 */

import { ComponentDefinition } from '../../../types';
import { JUDGED_AUDIO_INPUT } from '../../../hooks/judgedScriptContract';

export const MATH_CATALOG: ComponentDefinition[] = [
  {
    id: 'bar-model',
    ...bossEntry(barModelCard),
    // Only picture_graph emits selection evidence; other modes supply none, so capture skips them.
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: barModelDeliveryEligible },
    description: 'K-5 categorical-data graph. K one-to-one data (K.MD.B.3): record a pile of objects onto a sticker chart one sticker per object, read a graph where one picture stands for one thing, match a group of objects to the row that shows that many, say which row has the most or the fewest, explain what a graph shows aloud, and compare two related surveys. K-1 also has a two-bar which-is-taller comparison. Grades 2-5: scaled bar graphs with step-2/5/10 axes (3.MD.B.3) and picture graphs where 1 icon = N items (2.MD.D.10). Single home for all bar/picture-graph instruction, from tally-and-sticker recording to scaled construction; not for histograms or numeric distributions.',
    constraints: 'Multi-instance: a session walks the student through 3-6 challenges in a pinned mode or an intent-resolved blend, each with its own graph. The manifest MUST NOT supply specific bar values, scales, or datasets — the generator builds every challenge from the eval mode + topic. K one-to-one modes (build_one_to_one, read_one_to_one, match_to_bar, most_least) show one picture per object with no axis to read, print no numbers on the graph, and keep every count within 1-10; each row carries its own emoji so a pre-reader can tell the rows apart. build_graph requires expectedDataset and expectedScaleStep — student picks the scale themselves.',
    affordances: { representation: 'pictorial', answers: ['tap', 'spoken'], role: 'apply', minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'read_one_to_one',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Read a One-to-One Graph (K)',
        beta: 1.2,
        scaffoldingMode: 1,
        challengeTypes: ['read_one_to_one'],
        description: 'Count the pictures in the row the question names, where one picture = one thing. K.MD.B.3.',
      },
      {
        evalMode: 'most_least',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Most and Fewest (K)',
        beta: 1.4,
        scaffoldingMode: 1,
        challengeTypes: ['most_least'],
        description: 'Tap which of 3-4 one-to-one rows has the most or the fewest. K.MD.B.3.',
      },
      {
        evalMode: 'compare_bars',
        label: 'Compare Bars (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare_bars'],
        description: 'Identify which of two bars is taller. K.MD.A.2.',
      },
      {
        evalMode: 'match_to_bar',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Match a Group to a Row (K)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['match_to_bar'],
        description: 'Count a group of objects, then pick the row that shows that many. K.MD.B.3.',
      },
      {
        evalMode: 'build_one_to_one',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'build'] },
        label: 'Build a Sticker Chart (K)',
        beta: 1.8,
        scaffoldingMode: 1,
        challengeTypes: ['build_one_to_one'],
        description: 'Record a mixed pile of objects onto a chart, one sticker per object. K.MD.B.3.',
      },
      {
        evalMode: 'make_graph',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['build'] },
        label: 'Make a Graph That Fits (K-2)',
        beta: 1.9,
        scaffoldingMode: 1,
        challengeTypes: ['make_graph'],
        description: 'Open build: fill an empty picture graph so a named row has the most or the fewest, two rows are the same, '
          + 'or one row has N more than another. Any data that fits passes. K.MD.B.3, 1.MD.C.4.',
      },
      {
        evalMode: 'say_what_it_shows', label: 'Tell What the Graph Shows (K)',
        beta: 2.0, scaffoldingMode: 2, challengeTypes: ['say_what_it_shows'],
        affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'] },
        description: 'Explain a true more, fewer, most, least, or equal comparison from a one-to-one graph in your own words. MEAS001-03-G.',
      },
      {
        evalMode: 'compare_two_graphs', label: 'Compare Related Graphs (K)',
        beta: 2.2, scaffoldingMode: 2, challengeTypes: ['compare_two_graphs'],
        affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'] },
        description: 'Compare morning and afternoon surveys with matching categories. Say a similarity or difference across the two data sets. MEAS001-09-E.',
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
        affordances: { answers: ['tap', 'build'] },
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
    ...bossEntry(numberLineCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: numberLineDeliveryEligible },
    description: 'Interactive number line with drag-to-plot, animated jump arcs, ordering, and auto-zoom. Supports integers, fractions, decimals, and mixed numbers. K uses small fully labeled ranges; explicit Grade-1 objectives can use readable local windows within 0-120; grades 3-5 add negatives, fractions, and operations. Perfect for teaching number placement, addition/subtraction as movement, fraction comparison, and ordering. ESSENTIAL for K-5 math.',
    constraints: 'Requires numeric range. Jump mode requires operations array. Challenges drive interactivity.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 5 },
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
        evalMode: 'build_hops',
        affordances: { answers: ['build'] },
        label: 'Build Hops (Open Build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['build_hops'],
        description: 'OPEN BUILD of addition as movement (1.OA/2.OA): the line shows only a start; the child picks their own hop sizes to land on a stated number ("land on 12 in two hops"), presses "I am done!", then lands there a different way. Many hop sets pass (5+7, 6+6, 10+2); the line judges the landing, the hop count and that the second way differs in code. Three hops at the hard tier.',
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
    ...bossEntry(baseTenBlocksCard),
    // Only read_blocks emits correction evidence; the other modes supply none,
    // so capture skips them without a model call.
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: baseTenDeliveryEligible },
    description: 'Interactive base-ten manipulative with place value columns, supply tray, and regrouping. TWO MODES ARE LIVE TUTOR-JUDGED AND SPOKEN. read_blocks: the child reads one size of block at a time OUT LOUD — how many are there, and what are they worth altogether ("forty") — and never says the composed numeral; the tutor puts the whole number together. regroup: the child PREDICTS the result of a trade out loud while the mat is still untraded, then makes the trade with their hands. build_number and the operate modes remain hands-and-keypad: students drag blocks to build numbers and perform addition/subtraction with regrouping, with decimal mode (tenths/hundredths) and thousands. ESSENTIAL for K-5 place value.',
    constraints: 'Requires a number to work with. Challenges array drives interactivity. Grade band determines complexity. read_blocks and regroup require a microphone and a targetNumber of at least 10 with a non-zero digit above the ones place — code picks which place is read or traded, and drops any number that cannot carry one. Those two modes must be generated as HOMOGENEOUS sessions: a payload mixing them with build_number or the operate modes falls back to the click surface for all of them.',
    // Only the spoken mat takes the microphone; a card's audio is session-wide, so this stays beside the boss spread.
    audioInputByMode: { read_blocks: JUDGED_AUDIO_INPUT, regroup: JUDGED_AUDIO_INPUT },
    affordances: { representation: 'concrete', answers: ['build', 'manipulate', 'type'], role: ['visualize', 'apply'], minutes: 5 },
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
        // Open build (`/add-eval-modes` references/build-mode.md): build_number's value check on an empty mat, any
        // blocks that make the number, then a second build with different blocks. Equivalent forms (1.NBT.2a, 2.NBT.1a).
        evalMode: 'build_two_ways',
        affordances: { answers: ['build'] },
        label: 'Show It Two Ways (Open Build)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['build_two_ways'],
        description: 'Open build: student shows a number with any blocks on an empty mat, then shows the same number a different way (34 as 3 tens 4 ones, then 2 tens 14 ones).',
      },
      // read_blocks + regroup are PROJECTED from baseTenModes.ts — the DI port's
      // single source for identity, beta, docs and the learner's action story.
      ...BASE_TEN_DI_EVAL_MODES,
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
    ...bossEntry(fractionCirclesCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: fractionCompareDeliveryEligible },
    description: 'DI touch_fraction: hear a fraction and touch its matching shaded circle (halves, thirds, fourths). Multi-phase fraction learning with circle diagrams. Challenges include identifying fractions from shaded circles, building target fractions by clicking slices, comparing two fractions visually, and discovering equivalent fractions. ESSENTIAL for elementary fraction concepts.',
    constraints: 'Generates 4-6 challenges mixing identify, build, compare, and equivalent types. Denominators 2-12.',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['type', 'tap', 'build'], role: 'apply', minutes: 5 },
    // Scoped like base-ten-blocks' audioInputByMode: only touch_fraction is a judged
    // Live session (gesture-judged, no spoken answer); the other modes stay Check-button and
    // must not trigger a mic request. A card's `audio` is session-wide, so this stays beside the boss spread.
    audioInputByMode: { touch_fraction: JUDGED_AUDIO_INPUT },
    supportsEvaluation: true,
    evalModes: [
      ...FRACTION_TOUCH_EVAL_MODES,
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
      {
        evalMode: 'build_equal',
        affordances: { representation: 'pictorial', answers: ['build'] },
        label: 'Equal Fraction, Your Way (open build)',
        beta: 4.6,
        scaffoldingMode: 4,
        challengeTypes: ['build_equal'],
        description: 'Open build: make a fraction equal to a given one in your own way. The circle starts whole; the '
          + 'student chooses how many equal pieces to cut it into (not the given number), shades some, and says done. '
          + 'Many answers pass (1/2 = 2/4 = 3/6). 3.NF.A.3.',
      },
    ],
  },
  {
    id: 'fraction-bar',
    ...bossEntry(fractionBarCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: fractionBarDeliveryEligible },
    description: 'Multi-challenge interactive fraction bar. Each session walks the student through 3-6 distinct fractions in the same eval mode. Every fraction runs through three within-challenge phases: (1) identify the numerator via multiple choice, (2) identify the denominator via multiple choice, (3) build the fraction by shading parts on a bar. Progressive scaffolding from vocabulary to hands-on construction. Open-build mode build_equal skips the three phases: the student makes a fraction equal to a given one on the bar their own way (chooses how many equal parts, shades some), and any equal fraction passes. Mode compare skips the three phases too: two fractions of the same whole are drawn as shaded bars, one above the other, and the student picks <, = or > (3.NF.A.3d, 4.NF.A.2). ESSENTIAL for elementary fraction introduction.',
    constraints: 'Session-level configuration. The generator picks fractions locally per eval mode, so do NOT supply specific numerators, denominators, or MC choices from the manifest — they are generated per challenge. Supports challengeTypes: identify (2-3, unit fractions), build (3-4, non-unit proper fractions), larger_denominators (4-5, name and shade denominators 4-12), compare (3-4, two bars: <, = or >), add_subtract (5-6, operation context), build_equal (open build: make an equal fraction your own way).',
    affordances: { representation: 'pictorial', answers: ['tap', 'build'], role: 'apply', minutes: 5 },
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
        evalMode: 'larger_denominators',
        label: 'Larger Denominators (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['larger_denominators'],
        description: 'Name the numerator and denominator, then shade, on fractions with denominators 4-12. Compares nothing.',
      },
      {
        evalMode: 'compare',
        label: 'Compare Fractions (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Compare two fractions shown as shaded bars of the same whole: pick <, = or >. Same denominator, same numerator, '
          + 'or unlike pairs and pairs against 1/2 (3.NF.A.3d, 4.NF.A.2). Not ordering three or more fractions.',
      },
      {
        evalMode: 'add_subtract',
        label: 'Fraction Operations (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['add_subtract'],
        description: 'Fractions in addition/subtraction context.',
      },
      {
        evalMode: 'build_equal',
        affordances: { representation: 'pictorial', answers: ['build'] },
        label: 'Equal Fraction, Your Way (Tier 4)',
        beta: 4.6,
        scaffoldingMode: 4,
        challengeTypes: ['build_equal'],
        description: 'Open build: make a fraction equal to a given one on the bar your own way; any equal split passes.',
      },
    ],
  },
  {
    id: 'place-value-chart',
    ...bossEntry(placeValueChartCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: placeValueDeliveryEligible, retest: placeValueRetest },
    description: 'Live tutor-judged place value over 2- to 5-digit whole numbers. The Live tutor asks and judges what the child says, and the chart checks what the child writes. Each session alternates two kinds of number: for a PRINTED number with one glowing digit the child SAYS THE NAME OF ITS PLACE (ones through ten thousands) and then SAYS WHAT IT IS WORTH ("forty", "three hundred" — the spoken place-value vocabulary this primitive has always been about); for a number that is NEVER printed the tutor SAYS it and the child WRITES it into the labeled chart, one digit per column — dictation, where hearing "four hundred six" and writing 4-0-6 rather than 46 is the whole skill. ESSENTIAL for elementary place value instruction, grades 1-5.',
    constraints: 'Requires a microphone: two of the three answer kinds are spoken and judged by the Live tutor, and there is no Check button, no Next button, and no multiple-choice row anywhere. Session-level configuration: the generator selects target numbers locally from the number pool service per the selected eval mode, so do NOT supply specific numbers, place ranges, or answer choices from the manifest. Whole numbers only, 11 to 99,999 — every spoken value word stays inside the place-value vocabulary (digit and decade words plus hundred/thousand), and a highlighted digit is never zero because "zero" is not an accepted spoken answer. A number that was printed for analysis is never dictated, and a dictated number is never printed — each would answer the other. Supports challengeTypes: identify (1-2), build (2-3), compare (3-4), expanded_form (5+).',
    affordances: { representation: 'symbolic', answers: ['spoken', 'type'], role: 'apply', minutes: 5 },
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
    ...bossEntry(practiceProblemCard),
    description:'Standalone canvas-based math derivation surface. Student writes their multi-step solution by hand on a whiteboard; live transcription + step-aware coaching keep them oriented as they solve; pressing Done dispatches a judge that compares their derivation to the canonical solution; a wrong check keeps the worked solution hidden for another try, and a correct one reveals the side-by-side analysis. Perfect for algebra, pre-calculus, and calculus problems where showing work matters more than the final answer. ESSENTIAL for grades 6-12 procedural fluency, multi-step problem solving, and strategy selection.',
    constraints: 'Requires a problem with a canonical multi-step solution (2+ steps). Best for derivation-style math problems (solve equations, simplify expressions, evaluate integrals, prove identities). Not suitable for one-shot computation, multiple choice, or visual-spatial problems where the answer is non-symbolic.',
    affordances: { representation: 'symbolic', answers: ['build'], role: 'apply', minutes: 10 },
    evalModes: [
      { evalMode: 'derive_easy', label: 'Derive — Easy (Tier 1)', beta: -0.5, scaffoldingMode: 2, challengeTypes: ['derive'], description: 'Short 2-3 step derivation. Single rule application, simple algebra or arithmetic. Aimed at warm-up / fluency.' },
      { evalMode: 'derive_medium', label: 'Derive — Medium (Tier 2)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['derive'], description: '3-5 step derivation requiring multiple rule applications. Standard practice difficulty.' },
      { evalMode: 'derive_hard', label: 'Derive — Hard (Tier 3)', beta: 0.7, scaffoldingMode: 4, challengeTypes: ['derive'], description: '4-6 step derivation requiring strategy choice (substitution, case split, identity selection). Stretch problems.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'area-model',
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: areaModelDeliveryEligible },
    ...bossEntry(areaModelCard),
    description: 'Multi-challenge visual area model for multiplication, perimeter, and factoring. Each session walks the student through 3-6 distinct factor pairs in the same eval mode. Per-challenge data (factor decompositions, display flags) is built locally from a pool service; Gemini emits only session-level wrapper metadata. Use for multi-digit multiplication, distributive property, partial products, perimeter (4.MD.3), and area-model factoring. ESSENTIAL for grades 3-6 math.',
    constraints: 'The manifest must NOT supply specific factor numbers, decompositions, or display flags — the generator picks 3-6 pairs locally per the selected eval mode. Algebraic mode is reserved for future expansion (no eval mode currently uses it).',
    affordances: { representation: 'pictorial', answers: ['type'], role: 'apply', minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_model',
        affordances: { answers: ['build', 'type'] },
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
    ...bossEntry(arrayGridCard),
    description: 'Multi-challenge rectangular array of discrete objects (dots, squares, stars) arranged in rows and columns. Each session walks the student through 3-6 distinct (rows, columns) pairs in the same eval mode. Per-challenge dimensions are picked locally by a pool service; Gemini emits only session-level wrapper metadata. Teaches multiplication introduction, repeated addition, skip counting, commutative property, and arrays-as-multiplication. ESSENTIAL for elementary multiplication (grades 2-5).',
    constraints: 'The manifest must NOT supply specific row/column counts — the generator picks 3-6 dimension pairs locally per the selected eval mode. Keep arrays within the component caps (rows 2-6, columns 2-8).',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['build', 'type'], role: 'apply', minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_array',
        // Picks the rows and columns (a build), then types the total.
        affordances: { representation: 'concrete', answers: ['build', 'type'] },
        label: 'Build Array (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_array'],
        description: 'Concrete: build array with given dimensions.',
      },
      {
        // Open build (`/add-eval-modes` references/build-mode.md): build_array's grid with no dimensions given. The
        // learner fills an empty grid with N squares as any full rectangle; some items then ask for a different one.
        evalMode: 'make_array',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Make an Array (open build)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['make_array'],
        description: 'Open build: "Make an array with 12 squares." The grid starts EMPTY; the student taps cells to make '
          + 'any rectangular array of N squares (1×12, 2×6, 3×4, 4×3), then presses “I’m done!”. Every second item asks '
          + 'for a different array. No dimensions or running count on screen. 2.OA.C.4, 3.OA.A.1.',
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
    ...bossEntry(doubleNumberLineCard),
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
      { evalMode: 'multi_step', label: 'Multi-Step (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['multi_step'], description: 'Multi-step problems, one bar per step; the lesson sets whether both steps add or the steps mix adding and taking away.' },
      { evalMode: 'two_step_compare', label: 'Combine and Compare (Tier 5)', beta: 5.0, scaffoldingMode: 5, challengeTypes: ['two_step_compare'], description: 'Two-step problems: put two amounts together, then compare the total with another amount (find the other amount or the difference). The learner picks the comparison bar before solving it.' },
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
    ...bossEntry(factorTreeCard),
    description:'Multi-challenge factor-tree session: students factor 3-6 different composite numbers in a row at the same difficulty tier. Each challenge is a fresh tree with its own composite. Perfect for teaching prime numbers, composite numbers, factor decomposition, greatest common factor (GCF), least common multiple (LCM), and divisibility rules. ESSENTIAL for grades 4-6 number theory.',
    constraints: 'Composites only (not primes). Session-level configuration; rootValues are selected by the local pool service per eval mode, so do NOT supply specific numbers from the manifest.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
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
        affordances: { answers: ['type'] },
        label: 'Unguided (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['unguided'],
        description: 'Medium composites (20-60) without hints. Student must find factor pairs independently.',
      },
      {
        evalMode: 'unguided_large',
        affordances: { answers: ['type'] },
        label: 'Unguided Large (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['unguided_large'],
        description: 'Larger composites (40-80) without hints, reset allowed. More factors to decompose.',
      },
      {
        evalMode: 'assessment_intro',
        affordances: { answers: ['type'] },
        label: 'Assessment Intro (Tier 4+)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['assessment_intro'],
        description: 'Medium-large composites (40-80), no hints, no reset. Practice no-retry format.',
      },
      {
        evalMode: 'assessment',
        affordances: { answers: ['type'] },
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
    ...bossEntry(ratioTableCard),
    description:'Multi-challenge ratio table with 4 challenge types: missing-value (find a hidden scaled value), find-multiplier (determine the scaling factor), build-ratio (use a slider to construct an equivalent ratio), and unit-rate (calculate the unit rate). Structured table showing equivalent ratios with columns for each quantity. Progressive difficulty. Perfect for teaching equivalent ratios, unit rates, proportional reasoning, scaling relationships, and ratio problem-solving. ESSENTIAL for grades 5-7 ratios and proportions.',
    constraints: 'Requires a ratio relationship between 2-3 quantities. Best with 3-5 rows showing equivalent ratios.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'type'], role: 'apply', minutes: 5 },
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
    ...bossEntry(percentBarCard),
    description: 'Multi-challenge percent-bar session (3-6 percent problems of the same difficulty tier). Each challenge gives a scenario (test score, discount, tax, comparison, a percent of an amount, a whole from its part) and the student drags the bar to the target percent, and in find-part / find-whole types the amount in dollars. The generator pre-builds each scenario deterministically; the catalog must NOT supply specific numbers or scenarios. Grade 5-8 percent concepts.',
    constraints: 'The generator pre-selects every scenario (wholeValue, question, targetPercent, hint) per session — the manifest must NOT supply specific numbers, scenarios, questions, or target percents. The manifest may set instanceCount (default 4, max 6), showPercentLabels, showValueLabels, benchmarkLines, doubleBar, and the targetEvalMode.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['manipulate', 'type', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'identify_percent',
        label: 'Identify Percent (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['direct'],
        affordances: { answers: ['manipulate'] },
        description: 'Place a benchmark percent on the bar — test scores, parts of a quantity.',
      },
      {
        evalMode: 'find_part',
        label: 'Find a Percent of an Amount (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['part_of'],
        affordances: { answers: ['manipulate', 'type'] },
        description: 'Find a percent of a quantity in dollars (15% of $60): mark the percent on the bar, then type the part. No readout shows an amount (6.RP.3c).',
      },
      {
        // Was find_part until 10-16 (8.1f): it asks the percent still paid, not a part. No calibration was stored.
        evalMode: 'percent_remaining',
        label: 'Find Remaining / Discount (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['subtraction'],
        affordances: { answers: ['manipulate'] },
        description: 'Compute 100 - discount to find the percent of original price that remains.',
      },
      {
        // Was find_whole until 10-16 (8.1f): it asks the percent with a fee added, not a whole.
        evalMode: 'percent_total',
        label: 'Find the Total with Tax / Tip (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['addition'],
        affordances: { answers: ['manipulate'] },
        description: 'Two steps on the bar: place the added rate (tip/tax — value shows the dollars), then place the new total (100% + rate, bar extends past 100%).',
      },
      {
        evalMode: 'find_whole',
        label: 'Find the Whole from a Part (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['whole_of'],
        affordances: { answers: ['manipulate', 'type'] },
        description: 'Find the whole when a part and its percent are given ($12 is 20% of what?): mark the percent, then type the whole. The whole is never shown (6.RP.3c).',
      },
      {
        evalMode: 'convert',
        label: 'Compare Final Prices (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['comparison'],
        affordances: { answers: ['manipulate', 'tap'] },
        description: 'Multi-step: compute each good\'s sale price on the bar, then choose which is cheaper — a bigger % off is not always the better deal.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'balance-scale',
    ...bossEntry(balanceScaleCard),
    description: 'Touch-and-voice weight workshop with six mathematical actions: match and add; compose the same weight two ways; complete a known load; share among identical parcels; separate known weight then share; and connect those moves to equations. Unknown parcels have identical opaque containers; known weights show their quantities. Each challenge includes manipulation and separate spoken interpretation. Numeric pools are code-built. Never supply numbers in the manifest.',
    constraints: 'The generator pre-selects every equation (leftSide, rightSide, variableValue) per session — the manifest must NOT supply specific numbers, sides, or solutions. The manifest may set instanceCount (default 4, max 6), showTilt, and the targetEvalMode.',
    affordances: { representation: ['concrete', 'pictorial', 'symbolic'], answers: ['tap', 'manipulate', 'spoken'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'equality',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Equality - Balance and Add',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['equality'],
        description: 'Build a matching weight, add the chosen right-side blocks aloud, then infer the left weight from equal balance. Manipulation is ungraded exploration.',
      },
      {
        evalMode: 'equality_hard',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Make It Another Way',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['equality_hard'],
        description: 'Build two distinct combinations of the same weight, say their totals, and infer the matching left weight.',
      },
      {
        evalMode: 'one_step',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Complete the Load',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['one_step'],
        description: 'Add weights to a known starting load until balanced. Say the added weight, then name the missing part.',
      },
      {
        evalMode: 'one_step_hard',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Share the Weight',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['one_step_hard'],
        description: 'Distribute weight units into equal groups, one per identical parcel. Say a group weight and infer one parcel weight.',
      },
      {
        evalMode: 'two_step_intro',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Unpack and Share',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['two_step_intro'],
        description: 'Set aside equal known weights, identify the remaining combined weight, then share it equally among parcels.',
      },
      {
        evalMode: 'two_step',
        affordances: { representation: 'symbolic', answers: ['manipulate', 'spoken'] },
        label: 'Build the Equation',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['two_step'],
        description: 'Connect separating and sharing weights to equation transformations. Alternate rounds ask students to demonstrate symbolic instructions.',
      },
    ],
  },
  {
    id: 'function-machine',
    ...bossEntry(functionMachineCard),
    description: 'Visual "machine" with input hopper, rule display, and output chute. Each session walks the student through 3-6 distinct function rules of the same challenge type (observe / predict / discover_rule / create_rule). Numbers enter, get transformed by the rule, and exit. Grade-banded: 3-4 (one-step rules like x+3, x*2), 5 (two-step rules like 2*x+1), advanced (expressions like x^2). ESSENTIAL for grades 3-4 patterns, grades 5-8 function introduction, and Algebra 1-2 function concepts.',
    constraints: 'The generator pre-selects the rules and input queues for each session — the manifest must NOT supply specific rules, inputs, or numeric values. The manifest may set instanceCount (default 3, max 6), ruleComplexity, gradeBand, outputDisplay, and the targetEvalMode.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 5 },
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
      {
        evalMode: 'make_rule',
        affordances: { answers: ['build'] },
        label: 'Make a Machine (Open Build)',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['make_rule'],
        description: 'OPEN BUILD: one input-output pair ("make a machine that turns 4 into 12"); the learner builds their own rule from x, number and sign tiles and presses "I\'m done!", then builds a DIFFERENT rule for the same pair (3x, x + 8, 2x + 4 all pass). Code judges: the rule runs, uses its input, makes the pair, and the second works differently from the first. Shows that one pair does not fix a function.',
      },
    ],
  },
  {
    id: 'coordinate-graph',
    ...bossEntry(coordinateGraphCard),
    description: 'Interactive coordinate plane with structured challenges. Students plot points by clicking grid intersections, identify coordinates of displayed points, calculate slopes using rise/run triangles, and find y-intercepts of lines. SVG-based with snap-to-grid interaction. ESSENTIAL for Grades 5-8 algebra readiness and Algebra I.',
    constraints: 'Requires gridMin/gridMax (integer bounds for both axes). Challenges must use integer coordinates within the grid range. For plot_point, target must be on a grid intersection. For find_slope, points must have integer coordinates producing clean slope fractions. For find_intercept, the line must cross the y-axis at an integer.',
    affordances: { representation: 'symbolic', answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'plot_point',
        label: 'Plot Point (Foundational)',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['plot_point'],
        description: 'Student clicks the correct grid intersection for given coordinates. Tests ordered pair comprehension.',
        // A point placed anywhere on the plane, not a choice among offered ones (shape-tracer's corners are the same).
        affordances: { answers: ['manipulate'] },
      },
      {
        evalMode: 'read_point',
        label: 'Read Point (Developing)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['read_point'],
        description: 'A point is displayed on the grid. Student identifies its coordinates from multiple choice options.',
        affordances: { answers: ['tap'] },
      },
      {
        evalMode: 'find_slope',
        label: 'Find Slope (Proficient)',
        beta: 0.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_slope'],
        description: 'Two points and a rise/run triangle are shown. Student identifies the slope from multiple choice options.',
        affordances: { answers: ['tap'] },
      },
      {
        evalMode: 'find_intercept',
        label: 'Find Y-Intercept (Advanced)',
        beta: 1.0,
        scaffoldingMode: 5,
        challengeTypes: ['find_intercept'],
        description: 'A line is drawn across the grid. Student identifies where it crosses the y-axis from multiple choice options.',
        affordances: { answers: ['tap'] },
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'slope-triangle',
    ...bossEntry(slopeTriangleCard),
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
        description: 'Build a slope triangle on a given line: choose a run and set the rise so the top corner lands back on the line (rise = slope × run). Δy/Δx notation.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'systems-equations-visualizer',
    ...bossEntry(systemsEquationsCard),
    description: 'Multi-challenge systems-of-equations session (3-6 distinct systems of the same solution method, surfaced sequentially). Per challenge, students see two linear equations and one integer (x, y) solution, then type the answer for immediate judgment. A wrong pair stays for another try; a correct pair reveals the intersection on the graph and advances. Supports graphing (slope-intercept lines drawn for visual reading), substitution (equations in y = mx + b form, graph hidden until correct), and elimination (equations in a·x + b·y = c form, graph hidden until correct). ESSENTIAL for grade 8 (systems introduction via graphing), Algebra 1 (substitution + elimination), and Algebra 2 (efficient method selection).',
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
    supportsEvaluation: true,
  },
  {
    id: 'polygon-area-builder',
    ...bossEntry(polygonAreaBuilderCard),
    description: 'Multi-figure polygon-area session (3-6 distinct figures of the same eval mode, surfaced sequentially). Students derive and apply area formulas by composing and decomposing shapes on a canvas grid: rearrange a parallelogram into a rectangle by sliding the cut triangle (conservation of area), compute triangle / parallelogram / trapezoid areas from labeled dimensions, decompose composite figures into known rectangles and sum, and find the area of a polygon from its vertex coordinates. Canvas-based with five progressive difficulty tiers (decompose → triangle/parallelogram → trapezoid → composite → coordinate polygon). CCSS 6.G.A.1. Grades 6-7. One more mode is an OPEN BUILD for Grade 3 (build_area, 3.MD.C.5-6): on an empty square grid the student shades unit squares into a shape with a stated area, then a different shape with the same area; any shape with that area passes. A second open build is for Grade 3 perimeter (build_perimeter, 3.MD.D.8): the student shades a shape whose perimeter is stated, then a different shape with the same perimeter (same perimeter, different area). The system pre-builds each figure (dimensions, coordinates, rectangle parts, build areas) deterministically per challenge — the manifest must NOT specify dimensions, coordinates, or areas.',
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
        evalMode: 'build_area',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Build a Shape with an Area (Open Build)',
        beta: 1.6,
        scaffoldingMode: 2,
        challengeTypes: ['build_area'],
        description: 'Open build (Grade 3, 3.MD.C.5-6): shade unit squares on an empty grid into one shape with a stated area, then a different shape with the same area. Any shape with that area passes; area is measured by counting unit squares.',
      },
      {
        evalMode: 'build_perimeter',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Build a Shape with a Perimeter (Open Build)',
        beta: 2.4,
        scaffoldingMode: 2,
        challengeTypes: ['build_perimeter'],
        description: 'Open build (Grade 3, 3.MD.D.8): shade unit squares on an empty grid into one shape (no holes) with a stated perimeter, then a different shape with the same perimeter. Any shape with that perimeter passes (a 3 by 3 square, a 2 by 4 rectangle, an L); perimeter is measured by counting the unit sides around the outside, so a shape with the same perimeter can have a different area.',
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
    ...bossEntry(circleExplorerCard),
    supportsEvaluation: true,
  },
  {
    id: 'angle-workshop',
    ...bossEntry(angleWorkshopCard),
    description: 'Interactive angle workshop where students measure, classify, and solve for unknown angles on a canvas figure. Perfect for angle relationships (complementary, supplementary, vertical, adjacent), writing and solving equations for unknown angles, and parallel-lines-with-a-transversal reasoning. ESSENTIAL for grade 7-8 geometry (CCSS 7.G.B.5, 8.G.A.5). Also an open build for grades 4-6: the student makes an acute, right, obtuse or straight angle, or one inside a degree range (4.G.A.1, 4.MD.C.5, 4.MD.C.6).',
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
        // Open build (`/add-eval-modes` references/build-mode.md): the learner turns a ray from a fixed ray to make an
        // angle of the asked kind; any such angle passes. β = measure + 0.1, the offset build_n has over give_me_n.
        evalMode: 'make_angle',
        affordances: { answers: ['build'] },
        label: 'Make an Angle (open build)',
        beta: 1.6,
        scaffoldingMode: 2,
        challengeTypes: ['make_angle'],
        description: 'Open build: turn a ray from a fixed ray to make an acute, right, obtuse or straight angle ("bigger than a right angle but smaller than a straight one"), or at higher grades an angle between two given degrees. Any angle of that kind passes; no measure is shown. 4.G.A.1, 4.MD.C.6.',
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
    supportsEvaluation: true,
  },
  {
    id: 'transformation-lab',
    ...bossEntry(transformationLabCard),
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
        affordances: { answers: ['manipulate'] },
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
    supportsEvaluation: true,
  },
  {
    id: 'matrix-display',
    description: 'Multi-challenge matrix practice session (3-6 matrix problems of the same operation, surfaced sequentially). Per challenge, students see Matrix A (and Matrix B for binary operations), enter the result in editable cells (or a single number for determinant), and click "Check Answer" for immediate judgment. The check marks each box right or wrong; a correct answer advances to the next matrix. Supports transpose, add, subtract, multiply (row-by-column), determinant (2×2 and 3×3), and inverse (2×2 with det = ±1 so entries stay integer). ESSENTIAL for grade 7-8 (intro to matrix arithmetic), Algebra 2 (operations + determinant), Precalculus (inverses + multiplication), and Linear Algebra (all operations).',
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
    ...bossEntry(matrixDisplayCard),
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
    ...bossEntry(histogramCard),
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
    supportsEvaluation: true,
  },
  {
    id: 'two-way-table',
    description: 'Multi-challenge two-way table (contingency table) probability practice session (3-6 problems of the same probability concept, surfaced sequentially). Per challenge, students see a real-world scenario (pet preference by gender, sport by grade, transportation by distance, etc.), a frequency table, and a question — they enter a probability as a decimal and click "Check Answer" for immediate judgment. A wrong answer stays on the table for another try; a correct answer moves on to the next table. Supports joint probability, marginal distribution, conditional probability, and the independence test. Mode-specific UI gating: marginal/conditional modes hide row/column totals so the student must compute them; joint/independence modes show totals to support the calculation. ESSENTIAL for grade 7 (categorical data, joint probability), grade 7-Statistics (conditional probability), and Statistics courses (independence testing).',
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
    ...bossEntry(twoWayTableCard),
    supportsEvaluation: true,
  },
  // Math Phase 2 Primitives (K-5 Foundations)
  {
    id: 'ten-frame',
    ...bossEntry(tenFrameCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: tenFrameDeliveryEligible },
    description: 'Live tutor-taught 2×5 grid manipulative for K-2 number sense. The Live tutor teaches each item in its own words; the child\'s answer is checked (a placement by the frame itself, a spoken number from the tutor\'s feedback) and a checked answer advances the lesson. What the child produces depends on the skill: they SAY the answer out loud for subitizing (counters flash, then hide — say how many you saw), for make-ten at grades 1-2 (how many more fill the frame), and for addition and subtraction on the frame; they answer WITH THEIR HANDS for building a number (place exactly N counters), for DECOMPOSING a group (a group of counters arrives all red; turn some yellow to break it into two groups, and a different way each time), and for make-ten at Kindergarten (tap the empty cells until the frame is full), and for TEEN NUMBERS at Kindergarten (place the ones beside a full frame of ten, or find the ten inside a scattered group of 11-19), where working the counters IS the skill. Supports single frame (1-10) and double frame (1-20). The most foundational manipulative for early number sense. ESSENTIAL for grades K-2 number sense, subitizing, decomposing numbers into pairs (K.OA.3), TEEN NUMBERS as ten ones and some further ones (K.NBT.1), make-ten strategy, addition, and subtraction.',
    constraints: 'Best for grades K-2. A microphone is required for the SPOKEN modes (subitize, make-ten at grades 1-2, operate); the hands-only modes (build, decompose) are judged from what the child does on the frame and need no spoken answer. There is no Check button and no typed or stepper answer anywhere. Single frame for K, double frame for grades 1-2 — except the two teen-number modes, which use the double frame at every grade because a ten and some ones will not fit on one frame. Every spoken answer is a number word from 1 to 20 — challenges whose answer would be 0 (an empty frame, a subtraction down to nothing) or above 20 are discarded before the child sees them.',
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
        evalMode: 'decompose',
        affordances: { answers: ['build'] },
        label: 'Decompose (Partition)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['split'],
        description: 'Split a group of counters into two colour groups and, across the session, into a DIFFERENT pair each time. The answer is the partition the child enacts on the frame — CCSS K.OA.3, "decompose numbers less than or equal to 10 into pairs in more than one way". Concrete manipulative; no microphone needed.',
      },
      {
        evalMode: 'build_teen',
        affordances: { answers: ['build'] },
        label: 'Ten and Some More (Teen Numbers)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['build_teen'],
        description: 'A DOUBLE frame whose top half arrives full — that is one ten — and the child places the remaining ones to make a teen number 11-19. CCSS K.NBT.1 composition: 14 is ten and four more. Concrete manipulative; no microphone needed.',
      },
      {
        evalMode: 'build_pair',
        affordances: { answers: ['build'] },
        label: 'Make It Two Colours (Open Build)',
        beta: 2.1,
        scaffoldingMode: 1,
        challengeTypes: ['build_pair'],
        description: 'OPEN BUILD of K.OA.3: the frame starts EMPTY and the child makes the number from red and yellow counters, any pair, then presses "I\'m done!"; the same total comes back asking for a DIFFERENT pair. The child makes both the whole and its parts (decompose hands the group over). Judged by the frame in code. Concrete manipulative; no microphone needed.',
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
        evalMode: 'decompose_teen',
        affordances: { answers: ['build'] },
        label: 'Find the Ten (Teen Numbers)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['decompose_teen'],
        description: 'A teen group of 11-19 counters arrives SCATTERED across a double frame and the child turns exactly ten of them yellow, so the ten is FOUND rather than given. CCSS K.NBT.1 decomposition: 14 is ten and four more. Concrete manipulative; no microphone needed.',
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
    supportsEvaluation: true,
  },
  {
    id: 'counting-board',
    ...bossEntry(countingBoardCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: countingBoardDeliveryEligible },
    description: 'Live tutor-judged Pre-K to Grade 1 counting workspace with tappable objects (bears, apples, stars, fish, butterflies, blocks) in varied arrangements (scattered, line, groups, circle). The child counts by tapping and ANSWERS OUT LOUD: the Live tutor asks, judges the spoken number word, and helps after a miss; the board itself checks a handover, a build and a hand pick. Modes: pre-numeric perceptual subitizing (Pre-K, tap the matching hand — fully number-free), count-all (tap each object, say how many), flash subitizing (K: objects flash then hide; say how many you saw), count-on (start from a known group — at K that group sits under a basket, so it must be counted on from rather than counted), group counting (count by 2s/5s/10s), and compare (say how many in the group with more). It also covers the K counting-OUT family: give-me-N (hand back a named number of objects from a pile), same-number-after-they-move (count a set, watch it rearrange, say how many now — conservation), take-away (take some off and say how many are left), and add-more (put more on and say how many altogether). Builds one-to-one correspondence, cardinality principle, conservation, and subitizing fluency from pre-numeric perception upward. ESSENTIAL for Pre-K through Grade 1 counting, number sense, and early addition foundations.',
    constraints: 'Best for grades Pre-K to 1. Pre-K: perceptual subitize 1-3 objects with hand answers (no numerals anywhere in the item). K: count 1-20 objects; count_all, subitize, and the counting-out family (give_me_n, recount_moved, take_away, add_more), plus count_on with the started group hidden under a basket. Grade 1: count to 30, count-on and group counting. In take_away and add_more the bound the objective names is the number the child ENDS on; the app splits the board and chooses how many change. Answers are spoken number words (or a hand tap at Pre-K) judged by the microphone-enabled Lumina tutor; there is no Check button and no typed answer.',
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
        evalMode: 'give_me_n',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap'] },
        label: 'Give Me N (Concrete)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['give_me_n'],
        description: 'Count out a named number of objects from a bigger pile and hand them over. K.CC.B.5.',
      },
      {
        evalMode: 'build_n',
        affordances: { representation: 'concrete', reader: 'none', answers: ['build'] },
        label: 'Build N (Concrete, open build)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['build_n'],
        description: 'Open build: the scene starts EMPTY (a tree, a pond, the night sky) and the child makes a set of a named size by tapping objects in, then says done. Nothing is drawn to count; the child produces the set. K.CC.B.5.',
      },
      {
        evalMode: 'recount_moved',
        affordances: { answers: ['spoken'] },
        label: 'Same After They Move (Concrete)',
        beta: 1.8,
        scaffoldingMode: 1,
        challengeTypes: ['recount_moved'],
        description: 'Count a set, watch it rearrange, and say how many now — conservation. K.CC.B.4b.',
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
        evalMode: 'add_more',
        affordances: { answers: ['spoken'] },
        label: 'Add More (Pictorial)',
        beta: 2.2,
        scaffoldingMode: 2,
        challengeTypes: ['add_more'],
        description: 'Put more objects on the board and say how many altogether. K.OA.A.1 foundation.',
      },
      {
        evalMode: 'take_away',
        affordances: { answers: ['spoken'] },
        label: 'Take Away (Pictorial)',
        beta: 2.4,
        scaffoldingMode: 2,
        challengeTypes: ['take_away'],
        description: 'Take objects off the board and say how many are left. K.OA.A.1 foundation.',
      },
      {
        evalMode: 'count_on',
        affordances: { answers: ['spoken'] },
        label: 'Count On (Reduced Prompts)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['count_on'],
        description: 'Start from a known count and continue. At K the started group is covered, so counting from one is not available; at Grade 1 it stays visible. Reduced scaffolding — student self-organizes.',
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
    supportsEvaluation: true,
  },
    {
      id: 'comparison-builder',
      misconceptionScope: 'primitive',
    description: 'Multi-phase comparison activity with four challenge types: compare groups of objects visually, compare written numerals with inequality symbols, order numbers least-to-greatest or greatest-to-least, and identify one more / one less. Features animated correspondence lines and alligator mouth mnemonic for < and >. Perfect for teaching quantity comparison and number ordering. ESSENTIAL for K-1 math.',
    constraints: 'Supports numbers 1-20. Groups contain up to 10 objects. Order challenges use 3-5 numbers. Object types: bears, apples, stars, blocks, fish, butterflies, hearts, flowers, cookies, balls.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'manipulate', 'spoken'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'compare_groups',
        affordances: { representation: 'pictorial', answers: ['tap', 'spoken'] },
        label: 'Compare Groups (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare-groups'],
        description: 'Visual group comparison',
      },
      {
        evalMode: 'one_more_less',
        affordances: { representation: 'symbolic', answers: ['tap', 'spoken'] },
        label: 'One More / One Less (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['one-more-one-less'],
        description: 'Adjacent number reasoning',
      },
      {
        evalMode: 'compare_numbers',
        affordances: { representation: 'symbolic', answers: ['tap', 'spoken'] },
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
    ...bossEntry(comparisonBuilderCard),
  },
  {
    id: 'pattern-builder',
    description: 'Interactive pattern recognition, extension, and creation for K-3 algebraic thinking. Students build, extend, identify cores, translate, and create repeating patterns (AB, AAB, ABC), growing patterns (1,3,5,7), and number patterns. Supports color tokens, shape tokens, and numbers. Progressive phases: Copy → Identify → Create → Translate. Connects pattern skills to skip counting, multiplication foundations, and early algebra. ESSENTIAL for grades K-3 algebraic thinking, pattern recognition, and early algebra foundations.',
    constraints: 'Best for grades K-3. K-1: repeating patterns with colors/shapes (AB, AAB, ABB), including creation when the objective asks the child to make their own pattern. Grades 2-3: growing and number patterns, translation, and creation over number tokens.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'build'], role: 'apply', minutes: 5 },
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
        description: 'OPEN BUILD: make your own repeating pattern on an empty row in the shape the ask names (AB, ABB, AAB; ABC, AABB at grades 2-3) with any tokens, repeated at least twice, then "I\'m done!". Many rows pass; the builder checks the shape in code. Try again keeps the row.',
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
    ...bossEntry(patternBuilderCard),
  },
  {
    id: 'skip-counting-runner',
    description: 'Rhythmic skip counting with animated number line jumps for grades 1-3. A character (frog, kangaroo, rabbit, rocket) jumps along a number line in equal leaps, landing on multiples. Students count along, predict landing spots, identify skip values, fill missing numbers, and connect to multiplication facts. Parallel array visualization links skip counting to multiplication. Supports forward and backward counting. ESSENTIAL for grades 1-3 skip counting, multiplication foundations, and number pattern recognition.',
    constraints: 'Best for grades 1-3. Grades 1-2: skip by 2s, 5s, 10s, forward only, count_along and predict challenges. Grades 2-3: skip by 3s, 4s, backward counting, multiplication connections.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type', 'spoken'], role: ['visualize', 'apply'], minutes: 4 },
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
        affordances: { answers: ['type', 'spoken'] },
        label: 'Predict (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Anticipate the next value in a skip-count sequence.',
      },
      {
        evalMode: 'fill_missing',
        // Spoken on a one-gap item (the easy tier); two or more gaps are typed one at a time.
        affordances: { answers: ['type', 'spoken'] },
        label: 'Fill Missing (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fill_missing'],
        description: 'Complete missing terms in a skip-count sequence.',
      },
      {
        evalMode: 'find_skip_value',
        affordances: { answers: ['type', 'spoken'] },
        label: 'Find Skip Value (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_skip_value'],
        description: 'Discover the skip interval from a displayed sequence.',
      },
      {
        evalMode: 'connect_multiplication',
        affordances: { answers: ['type', 'spoken'] },
        label: 'Connect Multiplication (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['connect_multiplication'],
        description: 'Link skip counting to multiplication facts.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(skipCountingCard),
  },
  {
    id: 'hundreds-chart',
    description: 'Interactive number grid (10 numbers per row) for counting and skip-counting pattern discovery. The grid ceiling follows the lesson: a "counting to 10" lesson renders a 1-10 board and counting IN ORDER (by 1s), while an unbounded skip-counting lesson renders the full 1-100 chart. Students highlight sequences, complete partially shown patterns, identify visual column/row/diagonal relationships, and determine skip intervals. Connects number grid topology to multiplication foundations. Good for K counting-to-10/20 and ESSENTIAL for grades 1-3 skip counting, pattern recognition, and place value understanding.',
    constraints: 'K: counting in order on a small board (1-10, 1-20), highlight mode; skip counting by 2s, 5s and 10s at K when the objective names it (the board sizes up to the ceiling the objective states). Grades 1-2: skip by 2s, 5s, 10s, highlight and complete modes. Grades 2-3: skip by 3s, 4s, identify and find_skip_value modes. State the ceiling in the topic or intent ("to 10", "within 50") — the grid sizes itself to it and defaults to 1-100 when the lesson names none. Skip intervals too coarse for a small board are dropped automatically.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'highlight_sequence',
        affordances: { answers: ['tap'] },
        label: 'Highlight Sequence (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['highlight_sequence'],
        description: 'Highlight all cells in a skip-count pattern.',
      },
      {
        evalMode: 'complete_sequence',
        affordances: { answers: ['tap'] },
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
        affordances: { reader: 'developing', answers: ['tap', 'spoken'] },
        label: 'Identify Pattern (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify_pattern'],
        description: 'Describe the visual pattern formed on the grid.',
      },
      {
        evalMode: 'find_skip_value',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Find Skip Value (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['find_skip_value'],
        description: 'Determine the skip interval from highlighted cells.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(hundredsChartCard),
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
    supportsEvaluation: true,
    ...bossEntry(regroupingWorkbenchCard),
  },
  {
    id: 'multiplication-explorer',
    description: 'Multi-representation multiplication workspace connecting equal groups, arrays, repeated addition, number line jumps, and area model — all synchronized to the same fact. Students progress through 4 phases: build groups → build arrays → connect all 5 representations → use strategies (distributive property, fact families). Includes commutative property toggle, missing-factor challenges, and fluency quiz mode. ESSENTIAL for grades 2-4 multiplication introduction, fact fluency, and multiplicative thinking.',
    constraints: 'Best for single-digit × single-digit facts (grades 2-3) or multi-digit × single-digit (grade 4). Factors should be reasonable for visual display (≤12 for arrays, ≤50 product for number line). Supports build, connect, commutative, distributive, missing_factor, and fluency challenge types.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'build',
        // Typed: the groups are drawn, the learner types the product (contract G1).
        affordances: { representation: 'concrete', answers: ['type'] },
        label: 'Build (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['build'],
        description: 'Construct equal groups or arrays for the given fact.',
      },
      {
        evalMode: 'connect',
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['type'] },
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
    supportsEvaluation: true,
    ...bossEntry(multiplicationExplorerCard),
  },
  {
    id: 'measure-lab',
    description: 'Kindergarten weight-and-capacity bench where the child tests the answer instead of being told it (K.MD.A.1, K.MD.A.2). A pan balance TIPS under the objects the child puts on it, and containers FILL as the child pours non-standard cups into them. Four tasks: predict which of two objects is heavier and then weigh them; predict which of two differently-shaped containers holds more and then fill both; fill one container with cups and say how many it took; and put three identical jars in order from least to most. Weights and capacities are never shown as numbers — the tip of the beam and the level in the glass are the only evidence. ESSENTIAL for Kindergarten measurement: heavier/lighter, holds more/holds less, measuring with non-standard units, and ordering by amount.',
    constraints: 'Best for Pre-K to Grade 1 and built for K. Multi-instance: a session walks 3-6 challenges of one task. The manifest MUST NOT supply objects, weights, capacities or counts — the generator picks the vocabulary and code owns every quantity. Counts of cups stay within 3-10 so a K child can count them. A prediction is always recorded before the test runs, and the score is the prediction, never the pouring. Not for standard units (grams, litres) or for reading a scale face — that is measurement-tools.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 6 },
    evalModes: [
      {
        evalMode: 'balance_predict',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap'] },
        label: 'Heavier or Lighter (K)',
        beta: 1.2,
        scaffoldingMode: 1,
        challengeTypes: ['balance_predict'],
        description: 'Predict which object is heavier, then put both on a pan balance and watch it tip. K.MD.A.2.',
      },
      {
        evalMode: 'capacity_predict',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap'] },
        label: 'Which Holds More (K)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['capacity_predict'],
        description: 'Predict which of two differently-shaped containers holds more, then fill both to test it. K.MD.A.2.',
      },
      {
        evalMode: 'pour_count',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap', 'manipulate'] },
        label: 'How Many Cups (K)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['pour_count'],
        description: 'Fill a container with non-standard cups and say how many it took. K.MD.A.1.',
      },
      {
        evalMode: 'order_capacity',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap'] },
        label: 'Least to Most (K)',
        beta: 2.2,
        scaffoldingMode: 2,
        challengeTypes: ['order_capacity'],
        description: 'Put three identical containers in order from least to most. K.MD.A.2.',
      },
    ],
    ...bossEntry(measureLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'measurement-tools',
    description: 'Multi-shape ruler measurement session (3-6 distinct shapes of the same challenge type). Pool-service pattern: the generator picks the mode and unit, the component supplies the shapes deterministically from per-mode width pools. Students walk through each shape sequentially, dragging it onto a ruler and reading the measurement. Modes: measure (whole units, grades 1-3), compare (measure all, then order shortest-to-longest, grades 2-3), estimate (half-inch precision between tick marks, grades 2-3), convert (measure then convert between inches and centimeters, grades 3-4). ESSENTIAL for grades 1-5 measurement and data standards.',
    constraints: 'Ruler-based length measurement session. The manifest must NOT supply specific shape widths, colors, labels, or hints — those are built deterministically from the in-generator pool service. Grades 1-2 use whole-number precision; grades 3-5 add half precision and unit conversion.',
    affordances: { representation: 'pictorial', answers: ['manipulate'], role: 'apply', minutes: 5 },
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
        description: 'Measure, then convert the length to a smaller unit: within one system (feet to inches, meters to '
          + 'centimeters; 4.MD.A.1, 5.MD.A.1) unless the objective asks to convert between systems (inches and centimeters; 6.RP.A.3d).',
      },
    ],
    ...bossEntry(measurementToolsCard),
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
        evalMode: 'make_shape',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Make a Shape (open build)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['make_shape'],
        description: 'Open build: the dot grid starts EMPTY and the learner makes ANY shape with the asked properties (number of sides, right angles, parallel sides, equal sides, lines of symmetry), then says done. Many shapes pass; code writes the ask and judges the shape. 1.G.A.1, 2.G.A.1, 3.G.A.1, 4.G.A.2.',
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
    ...bossEntry(shapeBuilderCard),
    supportsEvaluation: true,
  },
  {
    id: 'number-sequencer',
    // The live wiring is the boss card (`numberSequencer.card.ts`); the behavior is `numberSequencer.boss.ts`.
    ...bossEntry(numberSequencerCard),
    description: 'Live tutor-judged number train practice. Children say missing numbers, continue a count one number at a time, and name the printed number that breaks a sequence. Card ordering remains hands-on arrangement, checked by the train. Six existing task identities for K-1 mathematics.',
    constraints: 'Requires a microphone for spoken modes; order-cards remains hands-on arrangement. K: 1-20 range by default, widened to 1-100 when the objective explicitly names 100. Grade 1: broad practice defaults to 1-100 and may extend through 120 only when the objective/topic/intent requires it. Spot-error positions are chosen in code and never visually pre-marked. Pinned single or blended eval modes must emit only their catalog challenge types; unpinned mixed sessions may combine all six.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken', 'tap'], role: 'apply', minutes: 5 },
    evalModes: NUMBER_SEQUENCER_EVAL_MODES,
    supportsEvaluation: true,
  },
  {
    id: 'number-bond',
    ...bossEntry(numberBondCard),
    description: 'DI-native Number Bond. Students transform one persistent counter model, then express its relationship: Split and Say and Ten and Ones pair hand construction with one spoken count; Missing Part keeps the unknown covered and offers counters as optional support; Related Facts joins, speaks, separates, and speaks again; Build Equation matches a student-chosen action with symbols; Fact Family transforms the same groups through every distinct related form. Students SAY the missing part OUT LOUD where speech is assessed and construct equations where symbolic form is assessed.',
    constraints: 'Wholes are capped at 5 for Kindergarten and 10 for Grade 1, except Ten and Ones uses teen wholes 11-19. Requires a microphone for spoken turns; there is no Check button and no typed numeric substitute for speech. Counter and equation work closes on stillness. Missing Part records independent, counter-supported, and revealed paths. Related Facts requires unequal positive parts and preserves its two linked spoken outcomes. Build Equation requires arithmetic validity, the bond numbers, and a match to the committed action. Fact Family requires four distinct forms for unequal parts and two for equal parts; reversing the sides of = is equivalent notation, not an extra form. Kindergarten supports decompose, missing-part, related-fact and ten-and-ones; symbolic modes remain Grade 1.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'build', 'type'], role: 'apply', minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'decompose',
        affordances: { representation: 'concrete', answers: ['build', 'spoken'] },
        label: 'Split and Say',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['decompose'],
        // β HELD — the same split-the-counters construction, one pair at a
        // time, exactly as the Submit Pair loop paced it; it merely gained a
        // judge (and a stillness close instead of a button).
        description: 'Break the whole into parts by splitting counters into the two circles — one hand construction followed by one spoken part per pair. The same counters can move between parts, and confirmed or coached pairs remain visible.',
      },
      {
        evalMode: 'ten_and_ones',
        affordances: { representation: 'concrete', answers: ['build', 'spoken'] },
        label: 'Ten and Ones (Teen Numbers)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['ten-and-ones'],
        // β sits above `decompose` (1.5) because the accept set is a single
        // pair rather than any pair: a split that makes the whole is still
        // wrong unless one part is a full ten, which is the place-value
        // demand the mode exists to measure.
        description: 'Break a teen number (11-19) into a full TEN and the ones left over by splitting counters into the two circles — the only accepted pair is ten and the rest, so a sum-correct split like 6 and 8 is corrected. CCSS K.NBT.1, "compose and decompose numbers 11-19 into ten ones and some further ones". Move the counters, then say how many ones accompany the ten. Requires a microphone. Kindergarten.',
      },
      {
        evalMode: 'missing_part',
        affordances: { representation: 'concrete', answers: ['spoken', 'manipulate'] },
        label: 'Covered Missing Part',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['missing-part'],
        // β HELD on the ASS solve-story precedent: a −/+ stepper over 0..max
        // became unaided speech — a structural change, but the stepper was a
        // WEAK menu (every numeral in range, no chosen distractors), so the
        // guess floor it removed is small, and β is per MODE.
        description: 'Infer one covered part and say it once. Optional counters let the student set aside the known part; evidence records whether the answer was independent, counter-supported, or followed a reveal.',
      },
      {
        evalMode: 'related_fact',
        affordances: { representation: 'concrete', answers: ['manipulate', 'spoken'] },
        label: 'Join and Undo',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['related-fact'],
        // β sits between `missing_part` (2.5) and `fact_family` (3.5), and the
        // spacing is the point: turn 1 IS a missing_part ask, and turn 2 adds
        // the demand neither neighbour measures — carrying the fact just found
        // into its subtraction form. Both gaps are 0.5, inside the densify rule.
        description: 'Join the same colored groups and say the missing addend, then move that group out and say the remainder. The counters retain identity across both linked spoken outcomes.',
      },
      {
        evalMode: 'fact_family',
        affordances: { representation: ['concrete', 'symbolic'], answers: ['manipulate', 'build', 'type'] },
        label: 'Transform a Fact Family',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['fact-family'],
        // β HELD — unequal parts still require the same four forms, now
        // elicited one transformation-linked equation at a time. Equal parts
        // correctly collapse to their two genuinely distinct forms.
        description: 'Transform the same two groups and build one matching equation at a time. Unequal parts require both addition orders and both subtraction directions; equal parts require the two distinct forms. One aggregate outcome retains per-form evidence. Grade 1.',
      },
      {
        evalMode: 'build_equation',
        affordances: { representation: ['concrete', 'symbolic'], answers: ['manipulate', 'build', 'type'] },
        label: 'Act, Then Build',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['build-equation'],
        // β HELD — the same tile tray and the same three checks; only the
        // Check button is gone.
        description: 'Choose and perform a join or separation, then construct an equation that describes that committed action. Equivalent equality orientation is accepted; a different true fact receives action-specific coaching. Grade 1.',
      },
    ],
  },
  {
    id: 'addition-subtraction-scene',
    ...bossEntry(additionSubtractionSceneCard),
    description: 'Live K-1 addition and subtraction story scenes with a spoken tutor. The tutor reads the story aloud and asks, and a credited answer advances the lesson. What the child produces depends on the skill: they SAY the number OUT LOUD to solve a word problem (both grades) and to report how many there are now, or how many are left, after acting a story out at Grade 1; they answer WITH THEIR HANDS by acting the story out on the scene at Kindergarten (bring more in, send some away), by building the number sentence from tiles, and by making the scene that matches a given number sentence — in those three, constructing it IS the skill. Supports join, separate, compare, and part-part-whole story types. The bridge from manipulatives to symbolic math. ESSENTIAL for Kindergarten and Grade 1 addition and subtraction.',
    constraints: 'Best for Kindergarten and Grade 1. Requires a microphone: spoken answers are judged by the Live tutor and there is no Check button, no typed answer and no numeral menu anywhere. Numbers limited to maxNumber (5 for K, 10 for Grade 1), so every spoken answer is a number word from 1 to 20. Four challenge types: act-out, build-equation, solve-story, create-story; story contexts must match the scene theme. Stories are read aloud, so a story that states the number the child must find — or whose answer would be 0 — is discarded before the child ever sees it.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'manipulate', 'build'], role: 'apply', minutes: 6 },
    evalModes: [
      {
        evalMode: 'act_out',
        affordances: { answers: ['manipulate', 'spoken'] },
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
        description: 'Represent the story as a number sentence built from tiles; the activity checks the assembled sentence. Symbolic FORM is the skill, so the answer is written, not spoken.',
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
        description: 'Represent a given number sentence as a story by BUILDING the scene — a production task, not writing. The child places and removes objects until the picture matches the equation, and the activity checks the picture against the sentence. Pre-reader capable at both grades.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'ordinal-line',
    ...bossEntry(ordinalLineCard),
    misconceptionScope: 'primitive',
    description: 'Live tutor-judged ordinal positions (DI modality) on a line of characters in a race, parade, lunch line, train or bookshelf. The Live tutor names which end is the FRONT, asks one item at a time and judges what the child says; the activity checks a build. What the child produces depends on the skill and the grade: at Kindergarten they SAY THE NAME of the one in the place the tutor asks for, and at Grade 1 the tutor names a character and they SAY ITS PLACE (identify — one eval mode, band-split, because naming the place is the harder rung and is the vocabulary the standard is about); they READ ONE PLACE SYMBOL ALOUD, one card at a time (match); they SAY THE NAME of the one right before or right after a marked place (relative-position); they LISTEN to a spoken story and SAY the place one character has in it (sequence-story); and they answer WITH THEIR HANDS by putting pictures into places from spoken clues (build-sequence) — there the arrangement IS the answer. Builds the ordinal vocabulary first through tenth by SAYING it. ESSENTIAL for Kindergarten and Grade 1 number sense.',
    constraints: 'Best for grades K-1. Requires a microphone: four of the five answers are spoken and judged by the Live tutor, and there is no Check button, no Next button, no multiple-choice row, no matching grid and no tap-on-the-line anywhere. Positions run 1-10 so every spoken place word is a single benched word (first..tenth); maxPosition 5 for Kindergarten, up to 10 for Grade 1, and a line shorter than 3 has no ordinal work in it. Character names are read aloud and said back, so they must be plain sayable names, tellable apart by ear, and must never contain a position or a number — a character called First-Place Freddie or Number Three answers the question out loud. Story challenges are HEARD, not read: at most 5 characters, under 60 words, no quotation marks. Build challenges give at most 4 spoken clues, which is what a child can hold from speech. A challenge whose answer key disagrees with its target position, whose printed word and printed symbol are different ordinals, or whose clues leave a gap in the line is discarded before the child ever sees it.',
    // reader: 'none' at the primitive level — every mode but `match` is spoken/hands (no Check,
    // no multiple-choice row, no tap-on-the-line, per constraints above); `match` alone requires
    // reading a printed ordinal symbol aloud ("READ ONE PLACE SYMBOL ALOUD"), so it is overridden
    // to 'emerging' below. No dedicated qa/reader-fit PRE file for this primitive.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 5 },
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
    ...bossEntry(sortingStationCard),
    misconceptionScope: 'primitive',
    description: 'Live tutor-judged sorting and classifying (DI modality) on picture cards and labelled trays. The Live tutor asks ONE OBJECT AT A TIME and judges the spoken answer; the activity moves on once an answer is credited — a challenge is no longer a screenful of objects committed at once, it is a sequence of single judged questions. Every answer is SPOKEN: the child says which group a thing belongs with (sort-by-one, sort-variety), says HOW the set should be sorted (sort-by-attribute), says which card does not belong (odd-one-out), says HOW MANY are in a group (count-and-compare, tally-record), says which group has more, and says YES or NO to whether one thing matches two criteria at once (two-attributes). Covers objective-relevant semantic categories (needs/wants, roles, living/nonliving, kinds) and visible attributes when those attributes are the taught concept. ESSENTIAL for Kindergarten and Grade 1 math and concept classification.',
    constraints: 'Best for K-1. Requires a microphone: EVERY answer is spoken and judged by the Live tutor, and there is no Check button, no drag-to-bin, no attribute buttons, no number steppers and no odd-one-out tap anywhere. The objective category must remain the main modality across challenges; vary objects, not the taught sorting rule. Use color/size/shape as the primary axis only when the objective explicitly teaches it. Objects should be familiar and their names sayable in one or two words. Objects per challenge: 4-6 at Kindergarten, 5-8 at Grade 1. Bins: max 3 at Kindergarten, max 4 at Grade 1. Group counts run 1-20 so every spoken count is a single word, and a group that would be EMPTY is not asked (zero has no benched spoken form). A challenge whose tray labels cannot be told apart by ear, whose object IS one of the tray labels, or whose yes/no set has only one reachable verdict is discarded before the child ever sees it. BAND: all seven modes are Kindergarten-routable. The five Grade-1 floors came down on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): the port left no printed text on the child\'s path, and the script already forces the groups to be NAMED ALOUD at every tier when the band is Kindergarten, so the five modes were floored against a surface that no longer exists. The K caps that DO bind are the object and bin counts stated above.',
    // reader: 'none' — READY @ PRE for sort_one and odd_one_out after the --fix loop
    // (qa/reader-fit/sorting-station-PRE-2026-07-15.md), and READY @ PRE for the other five
    // on the post-port re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): the port only
    // REMOVED demand from the child's path (every answer is spoken; no Check button,
    // drag-to-bin, attribute buttons or steppers survive), `isPreReader` in
    // sortingStationDomain.ts forces the options to be named aloud at every tier, and K draws
    // of all five modes came back picture-primary with speakable one-or-two-word groups.
    // The re-audit the ported surface owed is DONE; the band floors it was gating are gone.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
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
        description: 'Objects have several attributes: the child SAYS how the set should be sorted, then sorts it by that rule one thing at a time. Kindergarten-routable since the 2026-09-08 reader-fit re-audit — the metacognitive choice is spoken, not read.',
      },
      {
        evalMode: 'sort_variety',
        label: 'Sort Again — Different Rule (Tier 2+)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['sort-variety'],
        // β HELD — same rule-rotation task, spoken instead of dragged.
        description: 'Kindergarten-routable since the 2026-09-08 reader-fit re-audit (the contract\'s G3 follow-up: the voiced rule is said, never read). FLEXIBLE CLASSIFICATION: re-sort the SAME set by a DIFFERENT rule each round, saying where each thing goes. Rule rotation IS the declared task — the sanctioned exemption to taught-rule stability, which still holds for every other mode.',
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
        description: 'SAY how many are in each group, then SAY which has more, fewer, or the same. Kindergarten-routable since the 2026-09-08 reader-fit re-audit; K.MD.3 asks for counts per category, so route here for count-and-compare and to comparison-builder for number comparison. Counts 1-20; an empty group is never asked.',
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
        description: 'Kindergarten-routable since the 2026-09-08 reader-fit re-audit — the contract\'s G2 finding, that what exceeded a pre-reader was the MEDIUM and not the cognition, is what the spoken port fixed. For each thing in turn, SAY YES or NO to whether it matches BOTH criteria at once; the primary criterion expresses the lesson objective.',
      },
      {
        evalMode: 'tally_record',
        label: 'Tally & Record (Tier 4+)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['tally-record'],
        // β HELD — recording a count by voice instead of a stepper.
        description: 'Sort, then SAY the count of each group aloud. Kindergarten-routable since the 2026-09-08 reader-fit re-audit. Counts 1-20; an empty group is never asked.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'shape-sorter',
    ...bossEntry(shapeSorterCard),
    description:
      'LIVE-JUDGED SPOKEN 2D geometry (Direct Instruction). The tutor points to one shape at a time and the '
      + 'student ANSWERS OUT LOUD — naming the shape, saying how many sides or corners it has, or naming the '
      + 'group it belongs with. The tutor judges the spoken answer and teaches with in-item levers (a solved model, '
      + 'marks, an easier item); a credited answer advances the lesson. Nothing is tapped, dragged or typed. REQUIRES A MICROPHONE. '
      + 'Teaches Defining vs Non-Defining Attributes; correctness is derived in code from the geometry, never '
      + 'from the model. When the objective asks for shapes in REAL objects or everyday things, the naming pool '
      + 'is drawn as familiar objects instead of bare figures — a clock face, a door, a window, a slice of pizza — '
      + 'and the child names the shape they can see in each one. ESSENTIAL for Kindergarten and Grade 1 geometry.',
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
        evalMode: 'find_real_object',
        label: 'Find Shape in an Object',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['identify-real-object'],
        description: 'Look at one familiar code-drawn object and SAY the 2D shape of its outline. The object label never contains the answer.',
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
    ...bossEntry(threeDShapeExplorerCard),
    misconceptionScope: 'primitive',
    description: 'LIVE-JUDGED spoken solid-shape exploration for K-1. The child sees one code-drawn solid or familiar object, or hears one code-owned riddle, and SAYS one answer: a mathematical solid name, flat or solid, one property count, a yes/no property verdict, or a flat-face shape. The Live tutor responds to the answer, teaches the exact misconception after a wrong one, and a credited answer advances the run.',
    constraints: 'Requires a microphone. Every answer is spoken; there are no answer buttons, sorting bins, match grid, property grid, Check, or Next controls. Solids are limited to cube, sphere, cylinder, cone, and rectangular-prism; flat drawings are circle, square, triangle, and rectangle. Geometry facts and riddle clues come from the code-owned truth table. Number answers are 1-20; a zero count is reframed as a yes/no any-question. Compound generated collections fan out to one judged item per answer, capped at four children and six session items. Generated content with unknown names, contradictory dimensions or facts, object-name leaks, or non-unique riddles is discarded.',
    // reader: 'none' — every mode below is already spoken-only ("there are no answer buttons,
    // sorting bins, match grid, property grid, Check, or Next controls").
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
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
    ...bossEntry(shapeTracerCard),
  },
  {
    id: 'math-fact-fluency',
    description: 'Math fact fluency practice with 5 progressive challenge types: visual facts with dot arrays/ten-frames, bare equation solving, missing number problems, visual-equation matching, and aid-free rapid recall. Builds automaticity for addition and subtraction facts within 3, 5, or 10 through calm, untimed practice (no countdown, no time pressure). Perfect for K-1 fact fluency development. ESSENTIAL for Kindergarten and Grade 1 math fact recall.',
    constraints: 'Facts limited to addition and subtraction within maxNumber (3, 5, or 10). Visual aids only in visual-fact and match phases. Rapid-recall (speed-round) has no multiple choice and no visual aids. No timers — students answer at their own pace; response time is measured silently for the automaticity signal only.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap', 'type'], role: 'apply', minutes: 4 },
    evalModes: [
      {
        evalMode: 'visual_fact',
        affordances: { representation: 'pictorial', answers: ['spoken', 'tap'] },
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
        affordances: { representation: 'symbolic', answers: ['spoken', 'tap'] },
        label: 'Equation Solve (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['equation-solve'],
        description: 'Solve bare equations with multiple choice.',
      },
      {
        evalMode: 'missing_number',
        affordances: { representation: 'symbolic', answers: ['spoken', 'type'] },
        label: 'Missing Number (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-number'],
        description: 'Find the unknown operand in an equation.',
      },
      {
        evalMode: 'speed_round',
        affordances: { representation: 'symbolic', answers: ['spoken', 'type'] },
        label: 'Rapid Recall (Tier 5)',
        beta: 5.5,
        scaffoldingMode: 5,
        challengeTypes: ['speed-round'],
        description: 'Rapid recall of bare facts without visual aids or countdown — the top automaticity rung. Response time is measured silently; the student is never rushed.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(mathFactFluencyCard),
  },
  {
    id: 'addition-fact-strategies',
    description: 'Strategy-sequenced ADDITION FACTS WITHIN 20 for Grades 1-2 math (1.OA.C.6 add within 20 using strategies; 2.OA.B.2 fluently add within 20 from memory). Single-digit addends, sums 0-18. Each session practises ONE fact family in the classic strategy order: +0 facts, +1 facts (counting on one), doubles (3+3, 7+7), turn-around / commutative facts (3+8 and 8+3), +2 facts (counting on two), then the remaining "big facts" in bands (3s and 4s, 5s and 6s, 7s and 8s, mixed). Opens with a one-card worked example of the strategy (hop strip for counting on, mirrored butterfly wings for doubles, flipped cards for turn-around) on a fact the session never asks, then 6-10 facts the student answers by saying the sum or tapping it on a 0-18 number pad — production recall, no multiple choice. When the student is stuck the tutor can put strategy help on screen (the known flipped fact, hops from the bigger number, a near double, tappable object groups to count) or open a smaller fact first. Untimed; response time is measured silently for automaticity. Use for addition fact strategies and fact fluency within 20. Differs from math-fact-fluency (K-1, within 10, addition AND subtraction, five picture-to-recall challenge types) and from strategy-picker (compares several strategies on ONE equation).',
    constraints: 'Addition only — no subtraction, no missing-addend items. Single-digit addends (0-9), sums 0-18. One strategy family per session, chosen from the lesson topic/intent (a "doubles" lesson gets doubles; a "+1" or "counting on" lesson gets +1; a "turn-around" or "commutative" lesson gets turn-around facts). The manifest must NOT supply specific facts, numbers or answers — the pool service builds the facts deterministically for the chosen family. No timer.',
    affordances: { representation: 'symbolic', answers: ['spoken', 'tap'], role: 'apply', minutes: 5 },
    // Modes follow the source game's strategy path (+0, +1, doubles, turn-around, +2, big facts).
    // The big-fact bands (3s/4s, 5s/6s, 7s/8s, mixed) are one task identity at different number
    // ranges, so they share one mode and the topic picks the band.
    evalModes: [
      { evalMode: 'plus_zero', label: 'Adding Zero (Step 1)', beta: 3.0, scaffoldingMode: 4, challengeTypes: ['plus_zero'], description: 'Recall n + 0 and 0 + n: adding zero keeps the number the same.' },
      { evalMode: 'plus_one', label: 'One More (Step 1)', beta: 3.5, scaffoldingMode: 4, challengeTypes: ['plus_one'], description: 'Recall n + 1 and 1 + n by saying the next counting number.' },
      { evalMode: 'doubles', label: 'Doubles (Step 2)', beta: 4.0, scaffoldingMode: 4, challengeTypes: ['doubles'], description: 'Recall the doubles 1 + 1 through 9 + 9 from memory.' },
      { evalMode: 'near_doubles', label: 'Near Doubles (Step 2b)', beta: 4.3, scaffoldingMode: 4, challengeTypes: ['near_doubles'], description: 'Recall near doubles (6 + 7, 8 + 7) as a double and one more: first right after their double, later on their own.' },
      { evalMode: 'turnaround', label: 'Turn-Around Facts (Step 3)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['turnaround'], description: 'Use commutativity: 3 + 8 has the same sum as 8 + 3; a miss shows the flipped fact as the known fact.' },
      { evalMode: 'plus_two', label: 'Two More (Step 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['plus_two'], description: 'Recall n + 2 and 2 + n by counting on two from the bigger number.' },
      { evalMode: 'big_facts', label: 'Big Facts (Step 5)', beta: 5.5, scaffoldingMode: 5, challengeTypes: ['facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed'], description: 'Recall the remaining facts with addends 3-9 (sums to 17), by band or mixed, toward automatic recall.' },
    ],
    supportsEvaluation: true,
    ...bossEntry(additionFactStrategiesCard),
  },
  {
    id: 'strategy-picker',
    description: 'An interactive strategy-comparison activity where students solve the SAME addition/subtraction equation using 2-3 different strategies (counting on, make-ten, doubles, tally marks, or drawing a circle per addend), then compare and reflect on which approach they prefer. Builds mathematical flexibility and metacognitive awareness. Perfect for K-1 multi-strategy standards. ESSENTIAL for Kindergarten-Grade 1 addition and subtraction within 10. NOT a decomposition primitive: the "draw objects" strategy draws the addends of a FIXED equation to find one sum — it does not find all the ways to split a number into pairs. For "show different ways to break a number into pairs," use number-bond[decompose] instead.',
    constraints: 'Numbers within 5 (K) or 10 (Grade 1) BY DEFAULT — the band sets the default, the objective sets the scope: a K objective that says "within 10" or "making 10" gets 10. Ceiling 10 either way (the ten frame has ten cells). Requires 2+ strategies per problem. Compare phase is metacognitive—no wrong answers.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
    ...bossEntry(strategyPickerCard),
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
    ...bossEntry(numberTracerCard),
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    learningObservations: { eligible: numberTracerDeliveryEligible },
    description: 'Canvas-based numeral writing practice. Students trace dotted digit paths, copy from a model, write from a prompt, or complete counting sequences. Essential for CC.K.CC.3 (write 0-20) and 1.NBT.1 (write to 120).',
    constraints: 'Best for K-Grade 1. Digit range: 0-20 for K, 0-120 for Grade 1. Use trace mode for beginners, sequence for advanced.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['manipulate'], role: 'apply', minutes: 4 },
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
    ...bossEntry(lengthLabCard),
    description: 'Interactive length measurement lab for Kindergarten. Students compare object lengths visually, tile non-standard units end-to-end to measure, arrange objects by length, and use indirect comparison via a reference. The units can be classroom objects (cubes, paper clips, bears, erasers) or the body a child already has (hands, fingers, feet) when the objective asks them to measure with their hands. Two more K tasks: GUESS how many units it will take before any unit appears and then measure to find out, and measure the SAME object with two different-sized units and say which one was needed more of. Perfect for K.MD.1 and K.MD.2 standards. ESSENTIAL for Kindergarten measurement.',
    constraints: 'Objects limited to 1-12 unit lengths. In estimate_then_tile the guess is recorded and never marked wrong — the measuring is what is scored. In two_unit_compare the app picks both units and both counts so the object is a whole number of each, and the bigger unit is drawn wider so "fewer of them reach the end" is visible rather than asserted. K: compare, tile and order. G1 adds indirect (transitive reasoning through a reference object). `order` came down to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): every object is drawn as a length bar and the picker chip carries the same colour, so the child matches a picture rather than reading a name. K.MD.2 asks for exactly this.',
    // reader: 'none' — BACKLOG direct-manipulation sibling audit (qa/reader-fit/BACKLOG.md,
    // "Systemic items" section) cleared length-lab: "TilingWorkspace derives from placedUnits =
    // good" — the answer comes from what the child tiles/points at, never a read-then-type proxy.
    affordances: { representation: ['concrete', 'pictorial'], reader: 'none', answers: ['tap', 'manipulate', 'spoken'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'compare',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Compare (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['compare'],
        description: 'Which object is longer or shorter? Direct visual comparison.',
      },
      {
        evalMode: 'estimate_then_tile',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap', 'manipulate'] },
        label: 'Guess, Then Measure (K)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['estimate_then_tile'],
        description: 'Estimate how many units it will take, then tile and count to find out. K.MD.1.',
      },
      {
        evalMode: 'two_unit_compare',
        affordances: { representation: 'concrete', reader: 'none', answers: ['tap', 'manipulate'] },
        label: 'Two Units (K)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['two_unit_compare'],
        description: 'Measure one object with two different units and say which one you needed more of. K.MD.1.',
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
        description: 'Arrange three objects from shortest to longest. Kindergarten and up.',
      },
      {
        evalMode: 'indirect',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Indirect (Tier 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['indirect'],
        description: 'Compare two objects transitively using a reference object.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'analog-clock',
    ...bossEntry(analogClockCard),
    description:
      'Interactive analog clock with draggable hands, digital display sync, and timeline scrubber. '
      + 'Students read clock faces, set times by dragging hands, match analog to digital, and measure elapsed time with a stopwatch. '
      + 'It also teaches the parts of the clock at Kindergarten, before any time is read: point at the hand that tells the hour or the minutes, '
      + 'count the numbers 1 to 12 all the way round the face, and hear a whole-hour time and pick the clock face that shows it. '
      + 'Perfect for K-5 time-telling standards. ESSENTIAL for K.MD and 1.MD.3.',
    constraints:
      'K clock parts (hand_name, count_face, hear_time) need no time-telling at all — the child points, counts round the face, or matches a spoken hour to a face. '
      + 'K: hour and half-hour only (:00/:30). G1-2: quarter-hour (:15 intervals). G3-5: 5-minute intervals. Maximum 6 challenges per session.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate', 'spoken'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'hand_name',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'spoken'] },
        label: 'Which Hand (K)',
        beta: 0.8,
        scaffoldingMode: 1,
        challengeTypes: ['hand_name'],
        description: 'Point at the hand that tells the hour, or the one that tells the minutes. K.MD.',
      },
      {
        evalMode: 'count_face',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Count the Face (K)',
        beta: 1.0,
        scaffoldingMode: 1,
        challengeTypes: ['count_face'],
        description: 'Tap the numbers 1 to 12 in order all the way round the clock face. K.CC.A.1 on the dial.',
      },
      {
        evalMode: 'hear_time',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Hear the Time (K)',
        beta: 1.3,
        scaffoldingMode: 1,
        challengeTypes: ['hear_time'],
        description: 'Hear a whole-hour time and pick the clock face that shows it. K.MD / 1.MD.3 foundation.',
      },
      {
        evalMode: 'read',
        affordances: { answers: ['tap', 'spoken'] },
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
        affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'] },
        label: 'Match (Tier 2)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match'],
        description: 'Match analog face to correct digital display from 4 options',
      },
      {
        evalMode: 'elapsed',
        affordances: { answers: ['manipulate', 'spoken'] },
        label: 'Elapsed Time (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['elapsed'],
        description: 'Determine elapsed time using real-time stopwatch',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'coin-counter',
    ...bossEntry(coinCounterCard),
    // Records failed sessions' evidence, named misses included, as skill-scoped observations. Recording only:
    // the generator declares no `learningObservations`, so nothing it builds reads them.
    misconceptionScope: 'skill',
    observationDelivery: 'server',
    description: 'Interactive coin workspace for grades K-3. Students identify coins by appearance, count mixed coin sets, drag coins to make target amounts, compare groups, and make change. Supports pennies, nickels, dimes, and quarters with skip-counting scaffolds. Progressive difficulty from single-coin identification through greedy-algorithm fewest-coins challenges. ESSENTIAL for grades K-3 money skills and financial literacy foundations.',
    constraints: 'Best for grades K-3. K-1: identify coins and count like coins only. Grades 2-3: mixed counting, make-amount, compare, and make-change challenges.',
    affordances: { representation: 'concrete', answers: ['tap', 'manipulate', 'type', 'spoken'], role: 'apply', minutes: 5 },
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
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Count Like Coins (Scaffold 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['count'],
        description: 'Count sets of same coin type (5 pennies = 5¢)',
      },
      {
        evalMode: 'count-mixed',
        affordances: { representation: 'pictorial', reader: 'emerging', answers: ['type', 'spoken'] },
        label: 'Count Mixed Coins (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['count'],
        description: 'Count mixed coin sets (2 dimes + 3 pennies = 23¢)',
      },
      {
        evalMode: 'compare',
        affordances: { representation: 'pictorial', answers: ['tap', 'spoken'] },
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
        evalMode: 'show-amount',
        affordances: { answers: ['build'] },
        label: 'Show an Amount (Scaffold 2, open build)',
        beta: 3.6,
        scaffoldingMode: 2,
        challengeTypes: ['show-amount'],
        description: 'Open build: the tray starts EMPTY and the student makes a stated amount ("Show 37¢ any way you like") from coin bins, then presses “I’m done!”. Any coin mix that adds up passes; no target or running total on screen.',
      },
      {
        evalMode: 'make-change',
        affordances: { representation: 'pictorial', answers: ['type', 'spoken'] },
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
    ...bossEntry(timeSequencerCard),
    description: 'Event sequencer and time concepts for grades K-2. Students order daily events, match activities to time of day (morning/afternoon/night), reason about before/after relationships, compare durations, order activity cards that each carry an analog CLOCK FACE at a whole hour, and read simple schedules. Progressive difficulty from 3-event sequencing through clock-time schedule reading. Bridges to AnalogClock for formal time-telling. ESSENTIAL for K-2 time and daily routine concepts.',
    constraints: 'Best for grades K-2. K: 3- and 5-event sequences, time-of-day matching, before/after reasoning, duration comparison and clock-sequence. Grades 1-2 add schedule reading. At Kindergarten NOTHING on screen prints a clock time: the easy tier\'s perception anchor is a sun-position picture the generator derives from each event\'s typicalTime, and instructions, hints and the tutor are all barred from naming a time or a clock. sequence-5, before-after and duration-compare came down to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md); read-schedule stays Grade 1-2 because reading printed clock times off a schedule IS its task. clock-sequence is the ONE exception to the no-clock-at-K rule, and the exception is the objective: K TIME001-03-G asks the child to connect whole-hour times to daily activities in sequence, under the skill "Telling Time to the Hour". Its cards carry an analog FACE, which is a picture, never printed digits — and the generator DROPS any challenge whose times are not all whole hours inside one half of the day, because a 12-hour face cannot separate 8 in the morning from 8 at night.',
    // reader: 'none' — qa/reader-fit/how-it-works-PRE-2026-07-21.md names time-sequencer as the
    // recommended K routing destination for procedural/ordering content precisely because it is
    // "already K-2, picture-primary"; read-schedule is the one mode that requires reading printed
    // clock times off a schedule, so it is overridden to 'developing' below.
    // 2026-09-08: that 'none' was a claim the SCAFFOLD broke. The easy support tier printed a clock
    // time on every card and told the child to read it (10/10 items on the K probe), because
    // resolveSupportStructure had no grade to consult. The tag is true again now that the K band
    // gets a sun-position picture instead — qa/reader-fit/k-band-floor-2026-09-08.md.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate', 'spoken'], role: 'apply', minutes: 5 },
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
        affordances: { answers: ['tap', 'spoken'] },
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
        description: 'Order 5 daily events. Kindergarten and up (K PTRN001-03-F arranges 4-5 picture cards).',
      },
      {
        evalMode: 'before-after',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Before/After (Scaffold 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['before-after'],
        description: 'What happens before/after X? Kindergarten and up — the options are picture cards and the relation word is spoken.',
      },
      {
        evalMode: 'duration-compare',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Duration Compare (Scaffold 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['duration-compare'],
        description: 'Which takes longer? Kindergarten and up (K MEAS001-07-C compares activity durations); no clock time appears at any band.',
      },
      {
        evalMode: 'clock-sequence',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] },
        label: 'Clock Order (Scaffold 3)',
        beta: 3.5,
        scaffoldingMode: 2,
        challengeTypes: ['clock-sequence'],
        // β fills the gap between duration-compare (3.0) and read-schedule
        // (4.0), and the placement is the pedagogy: this IS the bridge from
        // ordering a routine to reading a schedule — the same ordering gesture
        // sequence-5 uses (2.0), plus a clock face to read the order from.
        description: 'Order daily activity cards where each card shows an analog CLOCK FACE at the hour that activity happens — connect the whole-hour time to the activity and put the day in order. Kindergarten and up (K TIME001-03-G, skill "Telling Time to the Hour"). The face is a picture, not printed digits, so it carries no reading demand; the times are always whole hours inside one half of the day, and a challenge that breaks either rule is dropped rather than shown.',
      },
      {
        evalMode: 'read-schedule',
        affordances: { representation: 'symbolic', reader: 'developing', answers: ['tap', 'spoken'] },
        label: 'Read Schedule (Scaffold 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['read-schedule'],
        description: 'Read a simple daily schedule with clock times. Grade 1-2 ONLY — printed clock times ARE the task, so the floor HELD on the 2026-09-08 reader-fit re-audit.',
      },
    ],
  },
  {
    id: 'spatial-scene',
    description: 'Positional language and prepositions in grid and fixed-perspective scenes. Students identify, place, and describe object positions using spatial words (above, below, beside, next to, on, under, left of, right of, in front of, behind) — tapping the grid to ENACT an instruction or describing a visible relation ALOUD. Also serves containment ("Put the ball IN the box" — tap the container itself) and two-reference placement ("Put the ball BETWEEN the box and the tree"). Serves both K.G.1 math positional vocabulary and Kindergarten Language Arts preposition skills. ESSENTIAL for K-1 geometry and K-2 grammar prepositions.',
    constraints: 'Grade band K-1. Existing place/place_in/place_between/follow_directions modes retain the 3x3 grid contract. Spoken describe_scene uses a separate fixed YOU viewpoint with depth lanes so left/right and in-front-of/behind are visually unambiguous; its relation label/model sentence stay hidden until an attempt. The position-word vocabulary follows whatever words the lesson objective/intent names, widening the grade-band default. NOT supported here: path words through/around/across; route geometry belongs to spatial-path.',
    // docs/contracts/spatial-scene.md: R5 populates the grid with pictorial scene objects (icons,
    // not photos or bare symbols); identify/describe alone carry a text options row (R7/R12), which
    // the child must read to disambiguate — the place/place_in/place_between/follow_directions
    // family is pure tap-to-enact with no text answer surface, so 'none' is the primitive default
    // and identify/describe are overridden to 'emerging' below. No formal reader-fit PRE verdict.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate', 'spoken'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
    ...bossEntry(spatialSceneCard),
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { reader: 'emerging', answers: ['tap', 'spoken'] },
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
        affordances: { reader: 'emerging', answers: ['tap', 'spoken'] },
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
      {
        evalMode: 'describe_scene',
        affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'] },
        label: 'Describe Scene Aloud (Scaffold 4)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['describe_scene'],
        description: 'Describe a shown left/right or front/behind relation aloud from a fixed YOU viewpoint; the judge requires the relation and reference object.',
      },
    ],
  },
  {
    id: 'shape-composer',
    ...bossEntry(shapeComposerCard),
    description: 'Interactive shape composition and decomposition workspace. Students compose larger shapes from smaller pieces (tangram-style), build pictures from shape palettes, and decompose composite shapes into basic components. Supports snap-to-fit placement, rotation, and guided decomposition. Perfect for teaching spatial reasoning, shape relationships, and geometry vocabulary at K-1 level. ESSENTIAL for kindergarten geometry composition standards.',
    constraints: 'Requires K-1 grade band. Challenge types: compose-match, compose-picture, decompose, free-create, how-many-ways.',
    affordances: { representation: 'concrete', reader: 'none', answers: ['build'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'compose-match',
        label: 'Compose Match (Easy)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['compose-match'],
        description: 'Drag pieces to fill a target silhouette with snap-to-fit guidance',
      },
      {
        evalMode: 'free-create',
        label: 'Free Create (Open build)',
        beta: -0.3,
        scaffoldingMode: 2,
        challengeTypes: ['free-create'],
        description: 'Open build: compose your own picture from a stated recipe of shapes (e.g. two triangles and one square), every shape touching another. Code judges the shapes used, no piece on top of another, and one connected composite; many pictures pass',
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
        affordances: { answers: ['type'] },
        label: 'How Many Ways (Hard)',
        beta: 1.0,
        scaffoldingMode: 4,
        challengeTypes: ['how-many-ways'],
        description: 'Determine minimum pieces needed and explore multiple composition solutions',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'net-folder',
    ...bossEntry(netFolderCard),
    description: '3D shape net folding/unfolding visualization, the solid drawn in 3D. Shows relationship between 3D solids and 2D nets. Students rotate solids, unfold into nets, match face correspondence, validate nets, and calculate surface area. Supports cube, rectangular prism, triangular prism, and pyramid. Perfect for teaching spatial reasoning, 3D geometry, and surface area at grades 3-5. ESSENTIAL for geometry standards.',
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
    supportsEvaluation: true,
  },
  {
    id: 'equation-builder',
    ...bossEntry(equationBuilderCard),
    description: 'Interactive equation-building manipulative where students construct, evaluate, and balance equations using draggable number and operator tiles. Teaches that the equal sign means "same amount on both sides," not "answer comes next." Supports build, missing-value, true-false, balance, and rewrite challenge types across scaffolding levels. ESSENTIAL for K-2 equation understanding.',
    constraints: 'Requires grade band (K-2). Challenges array drives interactivity. Each challenge specifies a challengeType and target equation.',
    // reader: 'developing' — WRONG-BAND @ PRE (qa/reader-fit/equation-builder-PRE-2026-09-05.md).
    // The build target is stated ONLY in an English sentence and the true/false answer surface is
    // two English words, with no read-aloud directive. No band floor was added (user ruling: make
    // it age-friendly, never floor it) — the demand is recorded here instead.
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['build', 'type', 'tap'], role: 'apply', minutes: 5 },
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
        evalMode: 'make-n',
        affordances: { answers: ['build'] },
        label: 'Make N (open build)',
        beta: 1.1,
        scaffoldingMode: 1,
        challengeTypes: ['make-n'],
        description: 'Open build: make ANY number sentence that equals a stated total from number and sign tiles (4 + 6, 12 - 2, 5 + 5 for 10), then press done; some items then ask for a different way. Many answers pass; the total alone does not. K.OA.3, 1.OA.6.',
      },
      {
        evalMode: 'missing-result',
        affordances: { answers: ['tap'] },
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
        affordances: { answers: ['tap'] },
        label: 'Missing Operand',
        beta: 2.5,
        scaffoldingMode: 4,
        challengeTypes: ['missing-value'],
        description: 'Find a missing operand (? before =).',
      },
      {
        evalMode: 'balance-both-sides',
        affordances: { answers: ['type'] },
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
    ...bossEntry(compareObjectsCard),
    misconceptionScope: 'primitive',
    description: 'Live tutor-taught measurement comparison on drawings of real-world objects. The Live tutor teaches each item in its own words; the child\'s answer is checked (an ordering by the board itself, a spoken answer from the tutor\'s feedback) and a checked answer advances the lesson. What the child produces depends on the skill: they SAY OUT LOUD what the picture lets us measure — how long, how tall, how heavy, or how much it holds (identify-attribute, both grades); they SAY THE NAME of the object that is longer, taller, heavier or holds more (compare-two, both grades); they SAY THE COUNT of non-standard units laid along an object (non-standard, Grade 1); and they answer WITH THEIR HANDS by touching three objects in order (order-three, Grade 1) — there the arrangement IS the answer. Builds the measurement vocabulary K.MD.1 asks children to SPEAK. ESSENTIAL for Kindergarten and Grade 1 measurement and data (K.MD.1-2).',
    constraints: 'Best for grades K-1. Requires a microphone: three of the four answers are spoken and judged by the Live tutor, and there is no Check button, no attribute chips, no object buttons and no typed number anywhere. Kindergarten uses identify-attribute, compare-two and order-three; non-standard is Grade 1. order-three came down to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): the objects are drawings scaled by visualSize and the answer is the order the child touches them in, so nothing on that path is read. Unit counts run 1-20, so every spoken number is a single word. A comparison whose drawing disagrees with its answer, whose two object names cannot be told apart by ear, or whose attribute menu offers both length and height is discarded before the child ever sees it.',
    // reader: 'none' — "no Check button, no attribute chips, no object buttons and no typed
    // number anywhere" (constraints above); three of four modes are spoken, order_three is hands.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 5 },
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
        description: 'Put 3 objects in order by a measurable attribute, touching them one at a time; the board checks the committed order once the child stops touching. The arrangement IS the answer, so this one is answered with hands. Kindergarten and Grade 1 (K.MD.2 orders 3 objects by one attribute).',
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
    ...bossEntry(formulaLabCard),
    description: 'Interactive Formula Lab for grades 6-12 math and science relationship reasoning. Students hold other variables constant while they explore a living system, predict direction or relative magnitude, construct the symbolic relationship, and transfer the same formula to a new setting with the output withheld. Perfect for building conceptual understanding of direct, inverse, and nonlinear formulas before calculation or memorization. ESSENTIAL for middle-school and high-school algebra, physics, chemistry, and quantitative science.',
    constraints: 'Use only scalar formulas expressible with 2-3 numeric input variables and restricted +, -, *, /, and ^ arithmetic. The manifest must NOT supply specific per-challenge values, variable settings, predictions, or answers — the generator builds the local value pool and derives every challenge deterministically. Supply only topic, grade-level context, and session-level formula metadata.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'type'], role: ['visualize', 'apply'], minutes: 6 },
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
        affordances: { answers: ['manipulate'] },
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
    ...bossEntry(parameterExplorerCard),
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
    supportsEvaluation: true,
  },
  {
    id: 'equation-workspace',
    ...bossEntry(equationWorkspaceCard),
    description: 'Step-by-step algebraic manipulation workspace where students isolate a target variable by selecting operations (divide, multiply, take arcsin, square root, etc.) applied to both sides of an equation. Supports guided-solve with highlighted hints, identify-operation multiple choice, free-solve, and multi-step challenges requiring 4+ operations. Covers linear, quadratic, trigonometric, and calculus-level equations. ESSENTIAL for grades 9-12+ algebra through calculus.',
    constraints: 'Best for grades 9-12+. Requires equation string and target variable. Multi-step mode requires equations needing 4+ operations. Guided-solve highlights valid operations as hints.',
    affordances: { representation: 'symbolic', answers: ['tap'], role: 'apply', minutes: 8 },
    evalModes: [
      {
        evalMode: 'guided-solve',
        label: 'Guided Solve (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['guided-solve'],
        // The learner works the equation down, tapping one operation at a time, each applied to both sides.
        affordances: { answers: ['tap'] },
        description: 'Operations highlighted as hints, student clicks in order',
      },
      {
        evalMode: 'identify-operation',
        label: 'Identify Operation (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify-operation'],
        affordances: { answers: ['tap'] },
        description: 'Given partially-solved equation, identify the next valid step (MC)',
      },
      {
        evalMode: 'solve',
        label: 'Solve (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 4,
        challengeTypes: ['solve'],
        // The learner works the equation down, tapping one operation at a time, each applied to both sides.
        affordances: { answers: ['tap'] },
        description: 'Student picks operations freely, single-path validation',
      },
      {
        evalMode: 'multi-step',
        label: 'Multi-Step (Tier 4)',
        beta: 4.0,
        scaffoldingMode: 5,
        challengeTypes: ['multi-step'],
        // The learner works the equation down, tapping one operation at a time, each applied to both sides.
        affordances: { answers: ['tap'] },
        description: 'Longer equations requiring 4+ steps to solve',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'function-sketch',
    ...bossEntry(functionSketchCard),
    description: 'Multi-challenge qualitative function reasoning primitive for grades 9-12. Each session walks the student through 3-6 distinct functions in the same eval mode (orchestrator-same-mode pattern). Students analyze function behavior by shape, key features, and family — without computing exact values. Supports four challenge types: classify-shape (linear/quadratic/exponential/periodic), identify-features (roots, extrema, intercepts, asymptotes), compare-functions (two curves, match to description), and sketch-match (place control points to sketch a described function). ESSENTIAL for Algebra 2, Precalculus, and AP Calculus qualitative reasoning.',
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
    supportsEvaluation: true,
  },
  {
    id: 'distribution-explorer',
    ...bossEntry(distributionExplorerCard),
    description: 'Live workbench for probability distributions (binomial, Poisson, exponential). Students manipulate parameter sliders and watch the PMF/PDF, CDF, and moments update in real time. Supports four phase-gated challenge modes: free guided exploration, family identification from shape/moments, basic single-distribution probability computation, and advanced conditional/tail/percentile reasoning. ESSENTIAL for probability, statistics, and actuarial topics.',
    constraints: 'Requires a topic with a probabilistic structure. Each eval mode produces phase-appropriate challenges: explore (no graded answer), identify (family MCQ), compute (multiple choice), predict_shape (multiple choice). Math is computed client-side from the chosen family — Gemini authors framing + challenges only.',
    affordances: { representation: 'symbolic', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 6 },
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
        affordances: { answers: ['tap'] },
        label: 'Compute Basic (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['compute'],
        description: 'Single-distribution probability and moment calculations from a given (family, params) scenario.',
      },
      {
        evalMode: 'compute_advanced',
        affordances: { answers: ['tap'] },
        label: 'Compute Advanced (Tier 4)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['compute', 'predict_shape'],
        description: 'Conditional probabilities, tail probabilities, percentile lookups, and shape prediction.',
      },
    ],
    supportsEvaluation: true,
  },
];
