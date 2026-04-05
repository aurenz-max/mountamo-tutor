/**
 * Math Generators - Self-registering module for math visualization primitives
 *
 * This module registers all math-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/mathGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Math Generator Imports
import { generatePlaceValueChart } from '../../math/gemini-place-value';
import { generateFractionBar } from '../../math/gemini-fraction-bar';
import { generateAreaModel } from '../../math/gemini-area-model';
import { generateArrayGrid } from '../../math/gemini-array-grid';
import { generateDoubleNumberLine } from '../../math/gemini-double-number-line';
import { generateTapeDiagram } from '../../math/gemini-tape-diagram';
import { generateFactorTree } from '../../math/gemini-factor-tree';
import { generateRatioTable } from '../../math/gemini-ratio-table';
import { generateBalanceScale } from '../../math/gemini-balance-scale';
import { generateFunctionMachine } from '../../math/gemini-function-machine';
import { generateCoordinateGraph } from '../../math/gemini-coordinate-graph';
import { generateSlopeTriangle } from '../../math/gemini-slope-triangle';
import { generateSystemsEquations } from '../../math/gemini-systems-equations';
import { generateMatrix } from '../../math/gemini-matrix';
import { generateDotPlot } from '../../math/gemini-dot-plot';
import { generateHistogram } from '../../math/gemini-histogram';
import { generateTwoWayTable } from '../../math/gemini-two-way-table';
import { generateTenFrame } from '../../math/gemini-ten-frame';
import { generateCountingBoard } from '../../math/gemini-counting-board';
import { generatePatternBuilder } from '../../math/gemini-pattern-builder';
import { generateSkipCountingRunner } from '../../math/gemini-skip-counting-runner';
import { generateRegroupingWorkbench } from '../../math/gemini-regrouping-workbench';
import { generateMultiplicationExplorer } from '../../math/gemini-multiplication-explorer';
import { generateMeasurementTools } from '../../math/gemini-measurement-tools';
import { generateShapeBuilder } from '../../math/gemini-shape-builder';
import { generateComparisonBuilder } from '../../math/gemini-comparison-builder';
import { generateNumberSequencer } from '../../math/gemini-number-sequencer';
import { generateNumberBond } from '../../math/gemini-number-bond';
import { generateAdditionSubtractionScene } from '../../math/gemini-addition-subtraction-scene';
import { generateOrdinalLine } from '../../math/gemini-ordinal-line';
import { generateSortingStation } from '../../math/gemini-sorting-station';
import { generateShapeSorter } from '../../math/gemini-shape-sorter';
import { generateThreeDShapeExplorer } from '../../math/gemini-3d-shape-explorer';
import { generateShapeTracer } from '../../math/gemini-shape-tracer';
import { generateMathFactFluency } from '../../math/gemini-math-fact-fluency';
import { generateStrategyPicker } from '../../math/gemini-strategy-picker';
import { generateNumberTracer } from '../../math/gemini-number-tracer';
import { generateHundredsChart } from '../../math/gemini-hundreds-chart';
import { generateLengthLab } from '../../math/gemini-length-lab';
import { generateAnalogClock } from '../../math/gemini-analog-clock';
import { generateCoinCounter } from '../../math/gemini-coin-counter';
import { generateTimeSequencer } from '../../math/gemini-time-sequencer';
import { generateSpatialScene } from '../../math/gemini-spatial-scene';
import { generateShapeComposer } from '../../math/gemini-shape-composer';
import { generateNetFolder } from '../../math/gemini-net-folder';

// Legacy Math Primitives (now have dedicated service files)
import { generateBarModel } from '../../math/gemini-bar-model';
import { generateNumberLine } from '../../math/gemini-number-line';
import { generateBaseTenBlocks } from '../../math/gemini-base-ten-blocks';
import { generateFractionCircles } from '../../math/gemini-fraction-circles';
import { generatePercentBar } from '../../math/gemini-percent-bar';

// ============================================================================
// Math Visualization Primitives Registration
// ============================================================================

// Place Value Chart
registerGenerator('place-value-chart', async (item, topic, gradeContext) => ({
  type: 'place-value-chart',
  instanceId: item.instanceId,
  data: await generatePlaceValueChart(topic, gradeContext, { ...item.config }),
}));

// Fraction Bar
registerGenerator('fraction-bar', async (item, topic, gradeContext) => ({
  type: 'fraction-bar',
  instanceId: item.instanceId,
  data: await generateFractionBar(topic, gradeContext, {
    ...item.config,
  }),
}));

// Area Model
registerGenerator('area-model', async (item, topic, gradeContext) => ({
  type: 'area-model',
  instanceId: item.instanceId,
  data: await generateAreaModel(topic, gradeContext, {
    ...item.config,
  }),
}));

// Array Grid
registerGenerator('array-grid', async (item, topic, gradeContext) => ({
  type: 'array-grid',
  instanceId: item.instanceId,
  data: await generateArrayGrid(topic, gradeContext, {
    ...item.config,
  }),
}));

// Double Number Line
registerGenerator('double-number-line', async (item, topic, gradeContext) => ({
  type: 'double-number-line',
  instanceId: item.instanceId,
  data: await generateDoubleNumberLine(topic, gradeContext, {
    ...item.config,
  }),
}));

// Tape Diagram
registerGenerator('tape-diagram', async (item, topic, gradeContext) => ({
  type: 'tape-diagram',
  instanceId: item.instanceId,
  data: await generateTapeDiagram(topic, gradeContext, item.config),
}));

// Factor Tree
registerGenerator('factor-tree', async (item, topic, gradeContext) => ({
  type: 'factor-tree',
  instanceId: item.instanceId,
  data: await generateFactorTree(topic, gradeContext, item.config),
}));

// Ratio Table
registerGenerator('ratio-table', async (item, topic, gradeContext) => ({
  type: 'ratio-table',
  instanceId: item.instanceId,
  data: await generateRatioTable(topic, gradeContext, item.config),
}));

// Balance Scale
registerGenerator('balance-scale', async (item, topic, gradeContext) => ({
  type: 'balance-scale',
  instanceId: item.instanceId,
  data: await generateBalanceScale(topic, gradeContext, item.config),
}));

// Function Machine
registerGenerator('function-machine', async (item, topic, gradeContext) => ({
  type: 'function-machine',
  instanceId: item.instanceId,
  data: await generateFunctionMachine(topic, gradeContext, { ...item.config }),
}));

// Coordinate Graph
registerGenerator('coordinate-graph', async (item, topic, gradeContext) => ({
  type: 'coordinate-graph',
  instanceId: item.instanceId,
  data: await generateCoordinateGraph(topic, gradeContext, item.config),
}));

// Slope Triangle
registerGenerator('slope-triangle', async (item, topic, gradeContext) => ({
  type: 'slope-triangle',
  instanceId: item.instanceId,
  data: await generateSlopeTriangle(topic, gradeContext, item.config),
}));

// Systems of Equations Visualizer
registerGenerator('systems-equations-visualizer', async (item, topic, gradeContext) => ({
  type: 'systems-equations-visualizer',
  instanceId: item.instanceId,
  data: await generateSystemsEquations(topic, gradeContext, item.config),
}));

// Matrix Display
registerGenerator('matrix-display', async (item, topic, gradeContext) => ({
  type: 'matrix-display',
  instanceId: item.instanceId,
  data: await generateMatrix(topic, gradeContext, {
    ...item.config,
  }),
}));

// Dot Plot
registerGenerator('dot-plot', async (item, topic, gradeContext) => ({
  type: 'dot-plot',
  instanceId: item.instanceId,
  data: await generateDotPlot(topic, gradeContext, item.config),
}));

// Histogram
registerGenerator('histogram', async (item, topic, gradeContext) => ({
  type: 'histogram',
  instanceId: item.instanceId,
  data: await generateHistogram(topic, gradeContext, item.config),
}));

// Two-Way Table
registerGenerator('two-way-table', async (item, topic, gradeContext) => ({
  type: 'two-way-table',
  instanceId: item.instanceId,
  data: await generateTwoWayTable(topic, gradeContext, item.config),
}));

// ============================================================================
// Math Phase 2 Primitives (K-5 Foundations)
// ============================================================================

// Ten Frame (K-2 number sense manipulative)
registerGenerator('ten-frame', async (item, topic, gradeContext) => ({
  type: 'ten-frame',
  instanceId: item.instanceId,
  data: await generateTenFrame(topic, gradeContext, item.config),
}));

// Counting Board (K-1 counting and subitizing)
registerGenerator('counting-board', async (item, topic, gradeContext) => ({
  type: 'counting-board',
  instanceId: item.instanceId,
  data: await generateCountingBoard(topic, gradeContext, {
    ...item.config,
  }),
}));

// Pattern Builder (K-3 algebraic thinking)
registerGenerator('pattern-builder', async (item, topic, gradeContext) => ({
  type: 'pattern-builder',
  instanceId: item.instanceId,
  data: await generatePatternBuilder(topic, gradeContext, item.config),
}));

// Skip Counting Runner (1-3 multiplication foundations)
registerGenerator('skip-counting-runner', async (item, topic, gradeContext) => ({
  type: 'skip-counting-runner',
  instanceId: item.instanceId,
  data: await generateSkipCountingRunner(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Regrouping Workbench (1-4 addition/subtraction with carry/borrow)
registerGenerator('regrouping-workbench', async (item, topic, gradeContext) => ({
  type: 'regrouping-workbench',
  instanceId: item.instanceId,
  data: await generateRegroupingWorkbench(topic, gradeContext, {
    ...item.config,
  }),
}));

// Multiplication Explorer (2-4 multi-representation multiplication)
registerGenerator('multiplication-explorer', async (item, topic, gradeContext) => ({
  type: 'multiplication-explorer',
  instanceId: item.instanceId,
  data: await generateMultiplicationExplorer(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Measurement Tools (1-5 measurement with real-world tools)
registerGenerator('measurement-tools', async (item, topic, gradeContext) => ({
  type: 'measurement-tools',
  instanceId: item.instanceId,
  data: await generateMeasurementTools(topic, gradeContext, {
    ...item.config,
  }),
}));

// Shape Builder (K-5 geometric construction & properties)
registerGenerator('shape-builder', async (item, topic, gradeContext) => ({
  type: 'shape-builder',
  instanceId: item.instanceId,
  data: await generateShapeBuilder(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Comparison Builder (K-1 quantity comparison & inequality symbols)
registerGenerator('comparison-builder', async (item, topic, gradeContext) => ({
  type: 'comparison-builder',
  instanceId: item.instanceId,
  data: await generateComparisonBuilder(topic, gradeContext, item.config),
}));

// Number Sequencer (K-1 sequential number understanding)
registerGenerator('number-sequencer', async (item, topic, gradeContext) => ({
  type: 'number-sequencer',
  instanceId: item.instanceId,
  data: await generateNumberSequencer(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Number Bond (K-1 part-part-whole relationships)
registerGenerator('number-bond', async (item, topic, gradeContext) => ({
  type: 'number-bond',
  instanceId: item.instanceId,
  data: await generateNumberBond(topic, gradeContext, item.config),
}));

// Addition/Subtraction Scene (K-1 story-based addition & subtraction)
registerGenerator('addition-subtraction-scene', async (item, topic, gradeContext) => ({
  type: 'addition-subtraction-scene',
  instanceId: item.instanceId,
  data: await generateAdditionSubtractionScene(topic, gradeContext, item.config),
}));

// Ordinal Line (K-1 ordinal position sequencing)
registerGenerator('ordinal-line', async (item, topic, gradeContext) => ({
  type: 'ordinal-line',
  instanceId: item.instanceId,
  data: await generateOrdinalLine(topic, gradeContext, item.config),
}));

// Sorting Station (K-1 categorization & data organization)
registerGenerator('sorting-station', async (item, topic, gradeContext) => ({
  type: 'sorting-station',
  instanceId: item.instanceId,
  data: await generateSortingStation(topic, gradeContext, {
    ...item.config,
  }),
}));

// Shape Sorter (K-1 shape identification, naming, matching & classification)
registerGenerator('shape-sorter', async (item, topic, gradeContext) => ({
  type: 'shape-sorter',
  instanceId: item.instanceId,
  data: await generateShapeSorter(topic, gradeContext, item.config),
}));

// 3D Shape Explorer (K-1 3D shape identification, properties & comparison)
registerGenerator('3d-shape-explorer', async (item, topic, gradeContext) => ({
  type: '3d-shape-explorer',
  instanceId: item.instanceId,
  data: await generateThreeDShapeExplorer(topic, gradeContext, item.config),
}));

// Shape Tracer (K-1 shape construction through tracing, drawing & completion)
registerGenerator('shape-tracer', async (item, topic, gradeContext) => ({
  type: 'shape-tracer',
  instanceId: item.instanceId,
  data: await generateShapeTracer(topic, gradeContext, {
    ...item.config,
  }),
}));

// Math Fact Fluency (K-1 rapid recall of addition & subtraction facts)
registerGenerator('math-fact-fluency', async (item, topic, gradeContext) => ({
  type: 'math-fact-fluency',
  instanceId: item.instanceId,
  data: await generateMathFactFluency(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Strategy Picker (K-1 multi-strategy problem solving & computational flexibility)
registerGenerator('strategy-picker', async (item, topic, gradeContext) => ({
  type: 'strategy-picker',
  instanceId: item.instanceId,
  data: await generateStrategyPicker(topic, gradeContext, item.config),
}));

// Number Tracer (K-2 canvas-based numeral writing practice)
registerGenerator('number-tracer', async (item, topic, gradeContext) => ({
  type: 'number-tracer',
  instanceId: item.instanceId,
  data: await generateNumberTracer(topic, gradeContext, item.config),
}));

// Hundreds Chart (1-4 skip-counting patterns and sequence discovery)
registerGenerator('hundreds-chart', async (item, topic, gradeContext) => ({
  type: 'hundreds-chart',
  instanceId: item.instanceId,
  data: await generateHundredsChart(topic, gradeContext, item.config),
}));

// Length Lab (K-1 direct comparison & non-standard measurement)
registerGenerator('length-lab', async (item, topic, gradeContext) => ({
  type: 'length-lab',
  instanceId: item.instanceId,
  data: await generateLengthLab(topic, gradeContext, item.config),
}));

// Analog Clock (K-5 telling time, elapsed time, clock reading)
registerGenerator('analog-clock', async (item, topic, gradeContext) => ({
  type: 'analog-clock',
  instanceId: item.instanceId,
  data: await generateAnalogClock(topic, gradeContext, item.config),
}));

// Coin Counter (K-3 coin identification, counting, making amounts, comparing, making change)
registerGenerator('coin-counter', async (item, topic, gradeContext) => ({
  type: 'coin-counter',
  instanceId: item.instanceId,
  data: await generateCoinCounter(topic, gradeContext, item.config),
}));

// Time Sequencer (K-2 event ordering, time-of-day matching, before/after, duration, schedules)
registerGenerator('time-sequencer', async (item, topic, gradeContext) => ({
  type: 'time-sequencer',
  instanceId: item.instanceId,
  data: await generateTimeSequencer(topic, gradeContext, item.config),
}));

// Spatial Scene (K-1 grid-based spatial reasoning: positions, placement, directions)
registerGenerator('spatial-scene', async (item, topic, gradeContext) => ({
  type: 'spatial-scene',
  instanceId: item.instanceId,
  data: await generateSpatialScene(topic, gradeContext, item.config),
}));

// Shape Composer (K-1 shape composition, decomposition & spatial reasoning)
registerGenerator('shape-composer', async (item, topic, gradeContext) => ({
  type: 'shape-composer',
  instanceId: item.instanceId,
  data: await generateShapeComposer(topic, gradeContext, item.config),
}));

// Net Folder (3-5 3D shapes, nets, surface area, spatial reasoning)
registerGenerator('net-folder', async (item, topic, gradeContext) => ({
  type: 'net-folder',
  instanceId: item.instanceId,
  data: await generateNetFolder(topic, gradeContext, item.config),
}));

// ============================================================================
// Legacy Math Primitives (now have dedicated service files)
// ============================================================================

// Bar Model (comparative bar visualization)
registerGenerator('bar-model', async (item, topic, gradeContext) => ({
  type: 'bar-model',
  instanceId: item.instanceId,
  data: await generateBarModel(topic, gradeContext, {
    intent: item.intent || item.title
  }),
}));

// Number Line (linear number representation)
registerGenerator('number-line', async (item, topic, gradeContext) => ({
  type: 'number-line',
  instanceId: item.instanceId,
  data: await generateNumberLine(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Base Ten Blocks (place value visualization)
registerGenerator('base-ten-blocks', async (item, topic, gradeContext) => ({
  type: 'base-ten-blocks',
  instanceId: item.instanceId,
  data: await generateBaseTenBlocks(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Fraction Circles (pie chart fractions)
registerGenerator('fraction-circles', async (item, topic, gradeContext) => ({
  type: 'fraction-circles',
  instanceId: item.instanceId,
  data: await generateFractionCircles(topic, gradeContext, {
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Percent Bar (percentage visualization)
registerGenerator('percent-bar', async (item, topic, gradeContext) => ({
  type: 'percent-bar',
  instanceId: item.instanceId,
  data: await generatePercentBar(topic, gradeContext, {
    ...item.config,
  }),
}));

// ============================================================================
// Migration status: 32/32 math primitives registered
// All math generators now use dedicated service files in math/ folder
// ============================================================================
