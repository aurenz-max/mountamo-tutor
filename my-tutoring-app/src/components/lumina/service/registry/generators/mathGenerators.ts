/**
 * Math Generators - Self-registering module for math visualization primitives
 *
 * This module registers all math-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/mathGenerators';
 */

import { registerGenerator, registerContextGenerator } from '../contentRegistry';

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
import { generatePolygonAreaBuilder } from '../../math/gemini-polygon-area-builder';
import { generateCircleExplorer } from '../../math/gemini-circle-explorer';
import { generateAngleWorkshop } from '../../math/gemini-angle-workshop';
import { generateTransformationLab } from '../../math/gemini-transformation-lab';
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
import { generateEquationBuilder } from '../../math/gemini-equation-builder';
import { generateCompareObjects } from '../../math/gemini-compare-objects';
import { generateParameterExplorer } from '../../math/gemini-parameter-explorer';
import { generateEquationWorkspace } from '../../math/gemini-equation-workspace';
import { generateFunctionSketch } from '../../math/gemini-function-sketch';
import { generateDistributionExplorer } from '../../distribution-explorer/gemini-distribution-explorer';
import { generatePracticeProblem } from '../../math/gemini-practice-problem';

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
registerContextGenerator('place-value-chart', async (ctx) => ({
  type: 'place-value-chart',
  instanceId: ctx.instanceId,
  data: await generatePlaceValueChart(ctx),
}));

// Fraction Bar
registerContextGenerator('fraction-bar', async (ctx) => ({
  type: 'fraction-bar',
  instanceId: ctx.instanceId,
  data: await generateFractionBar(ctx),
}));

// Area Model
registerContextGenerator('area-model', async (ctx) => ({
  type: 'area-model',
  instanceId: ctx.instanceId,
  data: await generateAreaModel(ctx),
}));

// Array Grid
registerContextGenerator('array-grid', async (ctx) => ({
  type: 'array-grid',
  instanceId: ctx.instanceId,
  data: await generateArrayGrid(ctx),
}));

// Double Number Line
registerContextGenerator('double-number-line', async (ctx) => ({
  type: 'double-number-line',
  instanceId: ctx.instanceId,
  data: await generateDoubleNumberLine(ctx),
}));

// Tape Diagram
registerContextGenerator('tape-diagram', async (ctx) => ({
  type: 'tape-diagram',
  instanceId: ctx.instanceId,
  data: await generateTapeDiagram(ctx),
}));

// Factor Tree
registerContextGenerator('factor-tree', async (ctx) => ({
  type: 'factor-tree',
  instanceId: ctx.instanceId,
  data: await generateFactorTree(ctx),
}));

// Ratio Table
registerContextGenerator('ratio-table', async (ctx) => ({
  type: 'ratio-table',
  instanceId: ctx.instanceId,
  data: await generateRatioTable(ctx),
}));

// Balance Scale
registerContextGenerator('balance-scale', async (ctx) => ({
  type: 'balance-scale',
  instanceId: ctx.instanceId,
  data: await generateBalanceScale(ctx),
}));

// Function Machine
registerContextGenerator('function-machine', async (ctx) => ({
  type: 'function-machine',
  instanceId: ctx.instanceId,
  data: await generateFunctionMachine(ctx),
}));

// Coordinate Graph
registerContextGenerator('coordinate-graph', async (ctx) => ({
  type: 'coordinate-graph',
  instanceId: ctx.instanceId,
  data: await generateCoordinateGraph(ctx),
}));

// Slope Triangle
registerContextGenerator('slope-triangle', async (ctx) => ({
  type: 'slope-triangle',
  instanceId: ctx.instanceId,
  data: await generateSlopeTriangle(ctx),
}));

// Polygon Area Builder (6-7 area via composing/decomposing polygons)
registerContextGenerator('polygon-area-builder', async (ctx) => ({
  type: 'polygon-area-builder',
  instanceId: ctx.instanceId,
  data: await generatePolygonAreaBuilder(ctx),
}));

// Circle Explorer (grade 7 circles — discover π, circumference, area, reverse, composite)
registerContextGenerator('circle-explorer', async (ctx) => ({
  type: 'circle-explorer',
  instanceId: ctx.instanceId,
  data: await generateCircleExplorer(ctx),
}));

// Angle Workshop
registerContextGenerator('angle-workshop', async (ctx) => ({
  type: 'angle-workshop',
  instanceId: ctx.instanceId,
  data: await generateAngleWorkshop(ctx),
}));

// Transformation Lab
registerContextGenerator('transformation-lab', async (ctx) => ({
  type: 'transformation-lab',
  instanceId: ctx.instanceId,
  data: await generateTransformationLab(ctx),
}));

// Systems of Equations Visualizer
registerContextGenerator('systems-equations-visualizer', async (ctx) => ({
  type: 'systems-equations-visualizer',
  instanceId: ctx.instanceId,
  data: await generateSystemsEquations(ctx),
}));

// Matrix Display
registerContextGenerator('matrix-display', async (ctx) => ({
  type: 'matrix-display',
  instanceId: ctx.instanceId,
  data: await generateMatrix(ctx),
}));

// Dot Plot
registerContextGenerator('dot-plot', async (ctx) => ({
  type: 'dot-plot',
  instanceId: ctx.instanceId,
  data: await generateDotPlot(ctx),
}));

// Histogram
registerContextGenerator('histogram', async (ctx) => ({
  type: 'histogram',
  instanceId: ctx.instanceId,
  data: await generateHistogram(ctx),
}));

// Two-Way Table
registerContextGenerator('two-way-table', async (ctx) => ({
  type: 'two-way-table',
  instanceId: ctx.instanceId,
  data: await generateTwoWayTable(ctx),
}));

// ============================================================================
// Math Phase 2 Primitives (K-5 Foundations)
// ============================================================================

// Ten Frame (K-2 number sense manipulative)
registerContextGenerator('ten-frame', async (ctx) => ({
  type: 'ten-frame',
  instanceId: ctx.instanceId,
  data: await generateTenFrame(ctx),
}));

// Counting Board (K-1 counting and subitizing)
registerContextGenerator('counting-board', async (ctx) => ({
  type: 'counting-board',
  instanceId: ctx.instanceId,
  data: await generateCountingBoard(ctx),
}));

// Pattern Builder (K-3 algebraic thinking)
registerContextGenerator('pattern-builder', async (ctx) => ({
  type: 'pattern-builder',
  instanceId: ctx.instanceId,
  data: await generatePatternBuilder(ctx),
}));

// Skip Counting Runner (1-3 multiplication foundations)
registerContextGenerator('skip-counting-runner', async (ctx) => ({
  type: 'skip-counting-runner',
  instanceId: ctx.instanceId,
  data: await generateSkipCountingRunner(ctx),
}));

// Regrouping Workbench (1-4 addition/subtraction with carry/borrow)
registerContextGenerator('regrouping-workbench', async (ctx) => ({
  type: 'regrouping-workbench',
  instanceId: ctx.instanceId,
  data: await generateRegroupingWorkbench(ctx),
}));

// Multiplication Explorer (2-4 multi-representation multiplication)
registerContextGenerator('multiplication-explorer', async (ctx) => ({
  type: 'multiplication-explorer',
  instanceId: ctx.instanceId,
  data: await generateMultiplicationExplorer(ctx),
}));

// Measurement Tools (1-5 measurement with real-world tools)
registerContextGenerator('measurement-tools', async (ctx) => ({
  type: 'measurement-tools',
  instanceId: ctx.instanceId,
  data: await generateMeasurementTools(ctx),
}));

// Shape Builder (K-5 geometric construction & properties)
registerContextGenerator('shape-builder', async (ctx) => ({
  type: 'shape-builder',
  instanceId: ctx.instanceId,
  data: await generateShapeBuilder(ctx),
}));

// Comparison Builder (K-1 quantity comparison & inequality symbols)
registerContextGenerator('comparison-builder', async (ctx) => ({
  type: 'comparison-builder',
  instanceId: ctx.instanceId,
  data: await generateComparisonBuilder(ctx),
}));

// Number Sequencer (K-1 sequential number understanding)
registerContextGenerator('number-sequencer', async (ctx) => ({
  type: 'number-sequencer',
  instanceId: ctx.instanceId,
  data: await generateNumberSequencer(ctx),
}));

// Number Bond (K-1 part-part-whole relationships)
registerContextGenerator('number-bond', async (ctx) => ({
  type: 'number-bond',
  instanceId: ctx.instanceId,
  data: await generateNumberBond(ctx),
}));

// Addition/Subtraction Scene (K-1 story-based addition & subtraction)
registerContextGenerator('addition-subtraction-scene', async (ctx) => ({
  type: 'addition-subtraction-scene',
  instanceId: ctx.instanceId,
  data: await generateAdditionSubtractionScene(ctx),
}));

// Ordinal Line (K-1 ordinal position sequencing)
registerContextGenerator('ordinal-line', async (ctx) => ({
  type: 'ordinal-line',
  instanceId: ctx.instanceId,
  data: await generateOrdinalLine(ctx),
}));

// Sorting Station (K-1 categorization & data organization)
registerContextGenerator('sorting-station', async (ctx) => ({
  type: 'sorting-station',
  instanceId: ctx.instanceId,
  data: await generateSortingStation(ctx),
}));

// Shape Sorter (K-1 shape identification, naming, matching & classification)
registerContextGenerator('shape-sorter', async (ctx) => ({
  type: 'shape-sorter',
  instanceId: ctx.instanceId,
  data: await generateShapeSorter(ctx),
}));

// 3D Shape Explorer (K-1 3D shape identification, properties & comparison)
registerContextGenerator('3d-shape-explorer', async (ctx) => ({
  type: '3d-shape-explorer',
  instanceId: ctx.instanceId,
  data: await generateThreeDShapeExplorer(ctx),
}));

// Shape Tracer (K-1 shape construction through tracing, drawing & completion)
registerContextGenerator('shape-tracer', async (ctx) => ({
  type: 'shape-tracer',
  instanceId: ctx.instanceId,
  data: await generateShapeTracer(ctx),
}));

// Math Fact Fluency (K-1 rapid recall of addition & subtraction facts)
registerContextGenerator('math-fact-fluency', async (ctx) => ({
  type: 'math-fact-fluency',
  instanceId: ctx.instanceId,
  data: await generateMathFactFluency(ctx),
}));

// Strategy Picker (K-1 multi-strategy problem solving & computational flexibility)
registerContextGenerator('strategy-picker', async (ctx) => ({
  type: 'strategy-picker',
  instanceId: ctx.instanceId,
  data: await generateStrategyPicker(ctx),
}));

// Number Tracer (K-2 canvas-based numeral writing practice)
// Context-native: intent/scope/supportTier are threaded by the registry boundary
// (resolveGenerationContext) — the handler no longer shapes config. First migration
// under PRD_GENERATION_CONTEXT_HARMONIZATION.
registerContextGenerator('number-tracer', async (ctx) => ({
  type: 'number-tracer',
  instanceId: ctx.instanceId,
  data: await generateNumberTracer(ctx),
}));

// Hundreds Chart (1-4 skip-counting patterns and sequence discovery)
registerContextGenerator('hundreds-chart', async (ctx) => ({
  type: 'hundreds-chart',
  instanceId: ctx.instanceId,
  data: await generateHundredsChart(ctx),
}));

// Length Lab (K-1 direct comparison & non-standard measurement)
registerContextGenerator('length-lab', async (ctx) => ({
  type: 'length-lab',
  instanceId: ctx.instanceId,
  data: await generateLengthLab(ctx),
}));

// Analog Clock (K-5 telling time, elapsed time, clock reading)
registerContextGenerator('analog-clock', async (ctx) => ({
  type: 'analog-clock',
  instanceId: ctx.instanceId,
  data: await generateAnalogClock(ctx),
}));

// Coin Counter (K-3 coin identification, counting, making amounts, comparing, making change)
registerContextGenerator('coin-counter', async (ctx) => ({
  type: 'coin-counter',
  instanceId: ctx.instanceId,
  data: await generateCoinCounter(ctx),
}));

// Time Sequencer (K-2 event ordering, time-of-day matching, before/after, duration, schedules)
registerContextGenerator('time-sequencer', async (ctx) => ({
  type: 'time-sequencer',
  instanceId: ctx.instanceId,
  data: await generateTimeSequencer(ctx),
}));

// Spatial Scene (K-1 grid-based spatial reasoning: positions, placement, directions)
registerContextGenerator('spatial-scene', async (ctx) => ({
  type: 'spatial-scene',
  instanceId: ctx.instanceId,
  data: await generateSpatialScene(ctx),
}));

// Shape Composer (K-1 shape composition, decomposition & spatial reasoning)
registerContextGenerator('shape-composer', async (ctx) => ({
  type: 'shape-composer',
  instanceId: ctx.instanceId,
  data: await generateShapeComposer(ctx),
}));

// Net Folder (3-5 3D shapes, nets, surface area, spatial reasoning)
registerContextGenerator('net-folder', async (ctx) => ({
  type: 'net-folder',
  instanceId: ctx.instanceId,
  data: await generateNetFolder(ctx),
}));

// Equation Builder (K-2 equation understanding — build, evaluate, balance equations)
registerContextGenerator('equation-builder', async (ctx) => ({
  type: 'equation-builder',
  instanceId: ctx.instanceId,
  data: await generateEquationBuilder(ctx),
}));

// Compare Objects (K-1 measurable attribute comparison: length, height, weight, capacity)
registerContextGenerator('compare-objects', async (ctx) => ({
  type: 'compare-objects',
  instanceId: ctx.instanceId,
  data: await generateCompareObjects(ctx),
}));

// Parameter Explorer (6-12+ multi-variable formula exploration with sliders & predictions)
registerContextGenerator('parameter-explorer', async (ctx) => ({
  type: 'parameter-explorer',
  instanceId: ctx.instanceId,
  data: await generateParameterExplorer(ctx),
}));

// Equation Workspace (9-12+ algebraic manipulation)
registerContextGenerator('equation-workspace', async (ctx) => ({
  type: 'equation-workspace',
  instanceId: ctx.instanceId,
  data: await generateEquationWorkspace(ctx),
}));

// Function Sketch (9-12+ qualitative function reasoning)
registerContextGenerator('function-sketch', async (ctx) => ({
  type: 'function-sketch',
  instanceId: ctx.instanceId,
  data: await generateFunctionSketch(ctx),
}));

// Distribution Explorer (probability distributions: explore → identify → compute)
// `targetEvalMode` from item.config drives both the catalog eval mode resolution
// (schema enum constraint + logging) and the orchestrator's per-mode prompt.
registerGenerator('distribution-explorer', async (item, topic, gradeContext) => ({
  type: 'distribution-explorer',
  instanceId: item.instanceId,
  data: await generateDistributionExplorer({
    topic,
    gradeContext,
    ...item.config,
    intent: item.intent || item.title,
  }),
}));

// Practice Problem (6-12 standalone canvas-based math derivation surface)
// Reuses the annotated-example pipeline under the hood; `targetEvalMode` from
// item.config (derive_easy | derive_medium | derive_hard) drives the per-difficulty
// intent string passed to the orchestrator.
registerGenerator('practice-problem', async (item, topic, gradeContext) => ({
  type: 'practice-problem',
  instanceId: item.instanceId,
  data: await generatePracticeProblem(topic, gradeContext, {
    ...item.config,
    // No item.title fallback: when the manifest assigns no explicit intent, leave
    // config.intent undefined so the generator keeps its tuned DIFFICULTY_INTENT
    // default (a generic title would be worse than the per-difficulty default).
    intent: (item.config?.intent as string | undefined) || item.intent,
  }),
}));

// ============================================================================
// Legacy Math Primitives (now have dedicated service files)
// ============================================================================

// Bar Model (K-5 comparison bars, scaled bar graphs, picture graphs)
registerContextGenerator('bar-model', async (ctx) => ({
  type: 'bar-model',
  instanceId: ctx.instanceId,
  data: await generateBarModel(ctx),
}));

// Number Line (linear number representation)
registerContextGenerator('number-line', async (ctx) => ({
  type: 'number-line',
  instanceId: ctx.instanceId,
  data: await generateNumberLine(ctx),
}));

// Base Ten Blocks (place value visualization)
registerContextGenerator('base-ten-blocks', async (ctx) => ({
  type: 'base-ten-blocks',
  instanceId: ctx.instanceId,
  data: await generateBaseTenBlocks(ctx),
}));

// Fraction Circles (pie chart fractions)
registerContextGenerator('fraction-circles', async (ctx) => ({
  type: 'fraction-circles',
  instanceId: ctx.instanceId,
  data: await generateFractionCircles(ctx),
}));

// Percent Bar (percentage visualization)
registerContextGenerator('percent-bar', async (ctx) => ({
  type: 'percent-bar',
  instanceId: ctx.instanceId,
  data: await generatePercentBar(ctx),
}));

// ============================================================================
// Migration status: 32/32 math primitives registered
// All math generators now use dedicated service files in math/ folder
// ============================================================================
