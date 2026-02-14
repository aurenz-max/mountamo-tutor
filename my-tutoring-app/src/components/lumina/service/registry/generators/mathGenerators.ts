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

// Legacy Math Primitives (now have dedicated service files)
import { generateBarModel } from '../../math/gemini-bar-model';
import { generateNumberLine } from '../../math/gemini-number-line';
import { generateBaseTenBlocks } from '../../math/gemini-base-ten-blocks';
import { generateFractionCircles } from '../../math/gemini-fraction-circles';
import { generateGeometricShape } from '../../math/gemini-geometric-shape';
import { generatePercentBar } from '../../math/gemini-percent-bar';

// ============================================================================
// Math Visualization Primitives Registration
// ============================================================================

// Place Value Chart
registerGenerator('place-value-chart', async (item, topic, gradeContext) => ({
  type: 'place-value-chart',
  instanceId: item.instanceId,
  data: await generatePlaceValueChart(topic, gradeContext, item.config),
}));

// Fraction Bar
registerGenerator('fraction-bar', async (item, topic, gradeContext) => ({
  type: 'fraction-bar',
  instanceId: item.instanceId,
  data: await generateFractionBar(topic, gradeContext, item.config),
}));

// Area Model
registerGenerator('area-model', async (item, topic, gradeContext) => ({
  type: 'area-model',
  instanceId: item.instanceId,
  data: await generateAreaModel(topic, gradeContext, item.config),
}));

// Array Grid
registerGenerator('array-grid', async (item, topic, gradeContext) => ({
  type: 'array-grid',
  instanceId: item.instanceId,
  data: await generateArrayGrid(topic, gradeContext, item.config),
}));

// Double Number Line
registerGenerator('double-number-line', async (item, topic, gradeContext) => ({
  type: 'double-number-line',
  instanceId: item.instanceId,
  data: await generateDoubleNumberLine(topic, gradeContext, item.config),
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
  data: await generateFunctionMachine(topic, gradeContext, item.config),
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
  data: await generateMatrix(topic, gradeContext, item.config),
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
  data: await generateCountingBoard(topic, gradeContext, item.config),
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
    intent: item.intent || item.title
  }),
}));

// Base Ten Blocks (place value visualization)
registerGenerator('base-ten-blocks', async (item, topic, gradeContext) => ({
  type: 'base-ten-blocks',
  instanceId: item.instanceId,
  data: await generateBaseTenBlocks(topic, gradeContext, {
    intent: item.intent || item.title
  }),
}));

// Fraction Circles (pie chart fractions)
registerGenerator('fraction-circles', async (item, topic, gradeContext) => ({
  type: 'fraction-circles',
  instanceId: item.instanceId,
  data: await generateFractionCircles(topic, gradeContext, {
    intent: item.intent || item.title
  }),
}));

// Geometric Shape (shape properties)
registerGenerator('geometric-shape', async (item, topic, gradeContext) => ({
  type: 'geometric-shape',
  instanceId: item.instanceId,
  data: await generateGeometricShape(topic, gradeContext, {
    intent: item.intent || item.title
  }),
}));

// Percent Bar (percentage visualization)
registerGenerator('percent-bar', async (item, topic, gradeContext) => ({
  type: 'percent-bar',
  instanceId: item.instanceId,
  data: await generatePercentBar(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 23/23 math primitives registered
// All math generators now use dedicated service files in math/ folder
// ============================================================================
