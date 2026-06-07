'use client';

import React, { useState } from 'react';
import FractionBar from '../primitives/visual-primitives/math/FractionBar';
import PlaceValueChart from '../primitives/visual-primitives/math/PlaceValueChart';
import AreaModel from '../primitives/visual-primitives/math/AreaModel';
import ArrayGrid from '../primitives/visual-primitives/math/ArrayGrid';
import FactorTree from '../primitives/visual-primitives/math/FactorTree';
import BarModel from '../primitives/visual-primitives/math/BarModel';
import RatioTable from '../primitives/visual-primitives/math/RatioTable';
import DoubleNumberLine from '../primitives/visual-primitives/math/DoubleNumberLine';
import PercentBar from '../primitives/visual-primitives/math/PercentBar';
import TapeDiagram from '../primitives/visual-primitives/math/TapeDiagram';
import BalanceScale from '../primitives/visual-primitives/math/BalanceScale';
import FunctionMachine from '../primitives/visual-primitives/math/FunctionMachine';
import CoordinateGraph from '../primitives/visual-primitives/math/CoordinateGraph';
import type { CoordinateGraphData } from '../primitives/visual-primitives/math/CoordinateGraph';
import SlopeTriangle from '../primitives/visual-primitives/math/SlopeTriangle';
import PolygonAreaBuilder from '../primitives/visual-primitives/math/PolygonAreaBuilder';
import CircleExplorer from '../primitives/visual-primitives/math/CircleExplorer';
import AngleWorkshop from '../primitives/visual-primitives/math/AngleWorkshop';
import TransformationLab from '../primitives/visual-primitives/math/TransformationLab';
import SystemsEquationsVisualizer from '../primitives/visual-primitives/math/SystemsEquationsVisualizer';
import MatrixDisplay from '../primitives/visual-primitives/math/MatrixDisplay';
import DotPlot from '../primitives/visual-primitives/math/DotPlot';
import Histogram from '../primitives/visual-primitives/math/Histogram';
import TwoWayTable from '../primitives/visual-primitives/math/TwoWayTable';
import TenFrame from '../primitives/visual-primitives/math/TenFrame';
import CountingBoard from '../primitives/visual-primitives/math/CountingBoard';
import PatternBuilder from '../primitives/visual-primitives/math/PatternBuilder';
import PracticeProblem from '../primitives/visual-primitives/math/PracticeProblem';
import SkipCountingRunner from '../primitives/visual-primitives/math/SkipCountingRunner';
import RegroupingWorkbench from '../primitives/visual-primitives/math/RegroupingWorkbench';
import MultiplicationExplorer from '../primitives/visual-primitives/math/MultiplicationExplorer';
import MeasurementTools from '../primitives/visual-primitives/math/MeasurementTools';
import ShapeBuilder from '../primitives/visual-primitives/math/ShapeBuilder';
import NumberLine from '../primitives/visual-primitives/math/NumberLine';
import BaseTenBlocks from '../primitives/visual-primitives/math/BaseTenBlocks';
import FractionCircles from '../primitives/visual-primitives/math/FractionCircles';
import ComparisonBuilder from '../primitives/visual-primitives/math/ComparisonBuilder';
import NumberSequencer from '../primitives/visual-primitives/math/NumberSequencer';
import NumberBond from '../primitives/visual-primitives/math/NumberBond';
import AdditionSubtractionScene from '../primitives/visual-primitives/math/AdditionSubtractionScene';
import type { AdditionSubtractionSceneData } from '../primitives/visual-primitives/math/AdditionSubtractionScene';
import OrdinalLine from '../primitives/visual-primitives/math/OrdinalLine';
import SortingStation from '../primitives/visual-primitives/math/SortingStation';
import ShapeSorter from '../primitives/visual-primitives/math/ShapeSorter';
import ThreeDShapeExplorer from '../primitives/visual-primitives/math/ThreeDShapeExplorer';
import ShapeTracer from '../primitives/visual-primitives/math/ShapeTracer';
import NumberTracer from '../primitives/visual-primitives/math/NumberTracer';
import MathFactFluency from '../primitives/visual-primitives/math/MathFactFluency';
import StrategyPicker from '../primitives/visual-primitives/math/StrategyPicker';
import HundredsChart from '../primitives/visual-primitives/math/HundredsChart';
import LengthLab from '../primitives/visual-primitives/math/LengthLab';
import AnalogClock from '../primitives/visual-primitives/math/AnalogClock';
import CoinCounter from '../primitives/visual-primitives/math/CoinCounter';
import TimeSequencer from '../primitives/visual-primitives/math/TimeSequencer';
import SpatialScene from '../primitives/visual-primitives/math/SpatialScene';
import ShapeComposer from '../primitives/visual-primitives/math/ShapeComposer';
import NetFolder from '../primitives/visual-primitives/math/NetFolder';
import EquationBuilder from '../primitives/visual-primitives/math/EquationBuilder';
import CompareObjects from '../primitives/visual-primitives/math/CompareObjects';
import ParameterExplorer from '../primitives/visual-primitives/math/ParameterExplorer';
import EquationWorkspace, { type EquationWorkspaceData } from '../primitives/visual-primitives/math/EquationWorkspace';
import FunctionSketch from '../primitives/visual-primitives/math/FunctionSketch';
import type { FunctionSketchData } from '../primitives/visual-primitives/math/FunctionSketch';

import type { ShapeBuilderData, ComparisonBuilderData, NumberSequencerData, NumberBondData, MeasurementToolsData, EvalModeDefinition, NumberTracerData } from '../types';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { MATH_CATALOG } from '../service/manifest/catalog/math';

interface MathPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'area-model' | 'array-grid' | 'factor-tree' | 'bar-model' | 'ratio-table' | 'double-number-line' | 'percent-bar' | 'tape-diagram' | 'balance-scale' | 'function-machine' | 'coordinate-graph' | 'slope-triangle' | 'polygon-area-builder' | 'circle-explorer' | 'angle-workshop' | 'transformation-lab' | 'systems-equations-visualizer' | 'matrix-display' | 'dot-plot' | 'histogram' | 'two-way-table' | 'ten-frame' | 'counting-board' | 'pattern-builder' | 'practice-problem' | 'skip-counting-runner' | 'regrouping-workbench' | 'multiplication-explorer' | 'measurement-tools' | 'shape-builder' | 'number-line' | 'base-ten-blocks' | 'fraction-circles' | 'comparison-builder' | 'number-sequencer' | 'number-bond' | 'addition-subtraction-scene' | 'ordinal-line' | 'sorting-station' | 'shape-sorter' | '3d-shape-explorer' | 'shape-tracer' | 'number-tracer' | 'math-fact-fluency' | 'strategy-picker' | 'hundreds-chart' | 'length-lab' | 'analog-clock' | 'coin-counter' | 'time-sequencer' | 'spatial-scene' | 'shape-composer' | 'net-folder' | 'equation-builder' | 'compare-objects' | 'parameter-explorer' | 'equation-workspace' | 'function-sketch';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

type PrimitiveOption = { value: PrimitiveType; label: string; icon: string; topic: string };

// Grouped to mirror a K-12 math curriculum progression. Headers below render as
// section labels in the sidebar; `PRIMITIVE_OPTIONS` (flattened) is used for
// value lookups elsewhere in the file.
const PRIMITIVE_GROUPS: Array<{ label: string; grade: string; items: PrimitiveOption[] }> = [
  {
    label: 'Number Sense',
    grade: 'PreK–K',
    items: [
      { value: 'counting-board', label: 'Counting Board', icon: '🧸', topic: 'Counting objects, subitizing, and one-to-one correspondence' },
      { value: 'ten-frame', label: 'Ten Frame', icon: '🔟', topic: 'Building numbers, subitizing, and making ten' },
      { value: 'number-sequencer', label: 'Number Sequencer', icon: '🔢', topic: 'Number sequences and counting' },
      { value: 'number-tracer', label: 'Number Tracer', icon: '✏️', topic: 'writing numbers 0 to 10' },
      { value: 'number-bond', label: 'Number Bond', icon: '🔗', topic: 'number bonds' },
      { value: 'ordinal-line', label: 'Ordinal Line', icon: '📏', topic: 'Ordinal positions' },
      { value: 'sorting-station', label: 'Sorting Station', icon: '📦', topic: 'sorting shapes and colors' },
      { value: 'comparison-builder', label: 'Comparison Builder', icon: '🐻', topic: 'Compare numbers 1-10' },
      { value: 'compare-objects', label: 'Compare Objects', icon: '🔍', topic: 'Comparing attributes and properties of objects' },
    ],
  },
  {
    label: 'Addition & Subtraction',
    grade: 'K–2',
    items: [
      { value: 'addition-subtraction-scene', label: 'Addition & Subtraction Scene', icon: '🎭', topic: 'Addition and subtraction stories within 10' },
      { value: 'number-line' as PrimitiveType, label: 'Number Line', icon: '📏', topic: 'Addition and subtraction on a number line' },
      { value: 'math-fact-fluency', label: 'Math Fact Fluency', icon: '⚡', topic: 'Addition facts within 5' },
      { value: 'strategy-picker', label: 'Strategy Picker', icon: '🎯', topic: 'Addition strategies within 10' },
      { value: 'equation-builder', label: 'Equation Builder', icon: '➕', topic: 'K-2 Equations' },
      { value: 'hundreds-chart', label: 'Hundreds Chart', icon: '⊞', topic: 'Skip counting by 5s' },
      { value: 'skip-counting-runner', label: 'Skip Counting Runner', icon: '🐸', topic: 'Skip counting, multiplication foundations, and number patterns' },
    ],
  },
  {
    label: 'Place Value',
    grade: '1–3',
    items: [
      { value: 'base-ten-blocks', label: 'Base Ten Blocks', icon: '🧱', topic: 'Place value and regrouping' },
      { value: 'place-value-chart', label: 'Place Value Chart', icon: '🔢', topic: 'Place value and decimal numbers' },
      { value: 'regrouping-workbench', label: 'Regrouping Workbench', icon: '🧮', topic: 'Addition and subtraction with carrying and borrowing' },
    ],
  },
  {
    label: 'Multiplication & Division',
    grade: '3–5',
    items: [
      { value: 'array-grid', label: 'Array / Grid', icon: '⊞', topic: 'Introduction to multiplication' },
      { value: 'multiplication-explorer', label: 'Multiplication Explorer', icon: '✖️', topic: 'Multiplication through multiple representations' },
      { value: 'area-model', label: 'Area Model', icon: '📐', topic: 'Multi-digit multiplication' },
      { value: 'factor-tree', label: 'Factor Tree', icon: '🌳', topic: 'Prime factorization' },
    ],
  },
  {
    label: 'Fractions & Percent',
    grade: '3–6',
    items: [
      { value: 'fraction-bar', label: 'Fraction Bar', icon: '📊', topic: 'Understanding fractions' },
      { value: 'fraction-circles', label: 'Fraction Circles', icon: '🥧', topic: 'Understanding fractions' },
      { value: 'percent-bar', label: 'Percent Bar', icon: '📈', topic: 'Percent concepts and calculations' },
    ],
  },
  {
    label: 'Patterns & Functions',
    grade: '2–8',
    items: [
      { value: 'pattern-builder', label: 'Pattern Builder', icon: '🔁', topic: 'Pattern recognition, extension, and algebraic thinking' },
      { value: 'function-machine', label: 'Function Machine', icon: '⚙️', topic: 'Input-output patterns and functions' },
    ],
  },
  {
    label: 'Ratios & Proportions',
    grade: '6–7',
    items: [
      { value: 'ratio-table', label: 'Ratio Table', icon: '⚖️', topic: 'Equivalent ratios and proportions' },
      { value: 'double-number-line', label: 'Double Number Line', icon: '↔️', topic: 'Unit rates and proportional relationships' },
      { value: 'tape-diagram', label: 'Tape Diagram', icon: '📏', topic: 'Part-part-whole word problems' },
      { value: 'bar-model', label: 'Bar Model', icon: '📊', topic: 'Reading and building bar graphs' },
    ],
  },
  {
    label: 'Equations & Algebra',
    grade: '6–9',
    items: [
      { value: 'balance-scale', label: 'Balance / Scale Model', icon: '⚖️', topic: 'Solving equations' },
      { value: 'equation-workspace', label: 'Equation Workspace', icon: '⚖️', topic: 'Equation Workspace' },
      { value: 'practice-problem', label: 'Practice Problem', icon: '✏️', topic: 'Solve a multi-step linear equation' },
    ],
  },
  {
    label: 'Coordinate Plane & Functions',
    grade: '8–12',
    items: [
      { value: 'coordinate-graph', label: 'Coordinate Graph', icon: '📍', topic: 'Plotting ordered pairs' },
      { value: 'slope-triangle', label: 'Slope Triangle', icon: '📐', topic: 'Understanding slope with rise and run' },
      { value: 'polygon-area-builder', label: 'Polygon Area Builder', icon: '📐', topic: 'Find polygon areas by composing and decomposing shapes' },
      { value: 'circle-explorer', label: 'Circle Explorer', icon: '⭕', topic: 'circles & π' },
      { value: 'angle-workshop', label: 'Angle Workshop', icon: '📐', topic: 'angle relationships' },
      { value: 'transformation-lab', label: 'Transformation Lab', icon: '🔄', topic: 'transformations & similarity' },
      { value: 'systems-equations-visualizer', label: 'Systems of Equations', icon: '📊', topic: 'Solving systems of equations' },
      { value: 'parameter-explorer', label: 'Parameter Explorer', icon: '🎛️', topic: 'Exploring how parameters affect functions and graphs' },
      { value: 'function-sketch', label: 'Function Sketch', icon: '✏️', topic: 'Trigonometric functions' },
      { value: 'matrix-display', label: 'Matrix Display', icon: '▦', topic: 'Matrix operations and transformations' },
    ],
  },
  {
    label: '2D Geometry',
    grade: 'K–5',
    items: [
      { value: 'shape-tracer', label: 'Shape Tracer', icon: '✏️', topic: 'basic shapes' },
      { value: 'shape-sorter', label: 'Shape Sorter', icon: '📐', topic: 'Shapes and Geometry' },
      { value: 'shape-builder', label: 'Shape Builder', icon: '📐', topic: 'Identifying quadrilaterals' },
      { value: 'shape-composer', label: 'Shape Composer', icon: '🧩', topic: 'composing and decomposing shapes' },
      { value: 'spatial-scene', label: 'Spatial Scene', icon: '🗺️', topic: 'spatial positions and directions' },
    ],
  },
  {
    label: '3D Geometry',
    grade: '3–8',
    items: [
      { value: '3d-shape-explorer', label: '3D Shape Explorer', icon: '🔷', topic: '3D shapes for kids' },
      { value: 'net-folder', label: 'Net Folder', icon: '📐', topic: '3D Shapes & Surface Area' },
    ],
  },
  {
    label: 'Measurement, Time & Money',
    grade: 'K–5',
    items: [
      { value: 'length-lab', label: 'Length Lab', icon: '📏', topic: 'Measuring and comparing lengths' },
      { value: 'measurement-tools', label: 'Measurement Tools', icon: '📏', topic: 'Length, weight, capacity, and temperature measurement' },
      { value: 'analog-clock', label: 'Analog Clock', icon: '🕐', topic: 'Reading and setting time on analog clocks' },
      { value: 'time-sequencer', label: 'Time Sequencer', icon: '🕐', topic: 'daily routines and time' },
      { value: 'coin-counter', label: 'Coin Counter', icon: '🪙', topic: 'coins and money' },
    ],
  },
  {
    label: 'Data & Statistics',
    grade: '6–12',
    items: [
      { value: 'dot-plot', label: 'Dot Plot', icon: '⚬', topic: 'Mean, median, and mode with data sets' },
      { value: 'histogram', label: 'Histogram', icon: '📊', topic: 'Distribution shapes and frequency analysis' },
      { value: 'two-way-table', label: 'Two-Way Table', icon: '⊞', topic: 'Categorical data and conditional probability' },
    ],
  },
];

const PRIMITIVE_OPTIONS: PrimitiveOption[] = PRIMITIVE_GROUPS.flatMap(g => g.items);

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'toddler', label: 'Toddler' },
  { value: 'preschool', label: 'Preschool' },
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'phd', label: 'PhD' },
];

// Dynamic renderer that maps componentId to the appropriate primitive component
// Now includes evaluation props for primitives that support it
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    case 'fraction-bar':
      // FractionBar supports evaluation - pass the props
      return (
        <FractionBar
          data={{
            ...(data as Parameters<typeof FractionBar>[0]['data']),
            // Evaluation integration props
            instanceId: `fraction-bar-${Date.now()}`,
            skillId: 'math-fractions',
            subskillId: 'fraction-representation',
            objectiveId: 'understand-fraction-models',
            onEvaluationSubmit,
          }}
        />
      );
    case 'fraction-circles':
      // FractionCircles handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <FractionCircles
          data={{
            ...(data as Parameters<typeof FractionCircles>[0]['data']),
            instanceId: `fraction-circles-${Date.now()}`,
            skillId: 'math-fractions',
            subskillId: 'fraction-circles',
            objectiveId: 'understand-fractions-with-circles',
          }}
        />
      );
    case 'place-value-chart':
      // PlaceValueChart now produces multi-challenge sessions (3 numbers × 3 phases each).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <PlaceValueChart
          data={{
            ...(data as Parameters<typeof PlaceValueChart>[0]['data']),
            instanceId: `place-value-chart-${Date.now()}`,
            skillId: 'math-place-value',
            subskillId: 'decimal-numbers',
            objectiveId: 'understand-place-value',
            onEvaluationSubmit,
          }}
        />
      );
    case 'factor-tree':
      // FactorTree supports evaluation - pass the props
      return (
        <FactorTree
          data={{
            ...(data as Parameters<typeof FactorTree>[0]['data']),
            // Evaluation integration props
            instanceId: `factor-tree-${Date.now()}`,
            skillId: 'math-number-theory',
            subskillId: 'prime-factorization',
            objectiveId: 'understand-prime-factors',
            onEvaluationSubmit,
          }}
        />
      );
    case 'bar-model':
      // BarModel supports evaluation - pass the props
      return (
        <BarModel
          data={{
            ...(data as Parameters<typeof BarModel>[0]['data']),
            instanceId: `bar-model-${Date.now()}`,
            skillId: 'math-data-graphs',
            subskillId: 'categorical-graphs',
            objectiveId: 'read-and-build-bar-graphs',
            onEvaluationSubmit,
          }}
        />
      );
    case 'area-model':
      // AreaModel supports evaluation - pass the props
      return (
        <AreaModel
          data={{
            ...(data as Parameters<typeof AreaModel>[0]['data']),
            instanceId: `area-model-${Date.now()}`,
            skillId: 'math-multiplication',
            subskillId: 'area-model-multiplication',
            objectiveId: 'multiply-with-area-models',
            onEvaluationSubmit,
          }}
        />
      );
    case 'array-grid':
      // ArrayGrid supports evaluation - pass the props
      return (
        <ArrayGrid
          data={{
            ...(data as Parameters<typeof ArrayGrid>[0]['data']),
            // Evaluation integration props
            instanceId: `array-grid-${Date.now()}`,
            skillId: 'math-multiplication',
            subskillId: 'array-models',
            objectiveId: 'build-arrays',
            onEvaluationSubmit,
          }}
        />
      );
    case 'ratio-table':
      // RatioTable handles its own evaluation internally — do NOT pass onEvaluationSubmit
      // to avoid double submission.  The generator now produces RatioTableData with a
      // `challenges` array instead of flat task fields.
      return (
        <RatioTable
          data={{
            ...(data as Parameters<typeof RatioTable>[0]['data']),
            instanceId: `ratio-table-${Date.now()}`,
            skillId: 'math-ratios',
            subskillId: 'equivalent-ratios',
            objectiveId: 'understand-ratio-relationships',
          }}
        />
      );
    case 'double-number-line':
      // DoubleNumberLine produces multi-challenge ratio sessions (3-6 challenges of one mode).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <DoubleNumberLine
          data={{
            ...(data as Parameters<typeof DoubleNumberLine>[0]['data']),
            instanceId: `double-number-line-${Date.now()}`,
            skillId: 'math-ratios',
            subskillId: 'proportional-reasoning',
            objectiveId: 'find-equivalent-ratios-on-double-number-line',
            onEvaluationSubmit,
          }}
        />
      );
    case 'percent-bar':
      // PercentBar produces multi-challenge sessions (3-6 percent problems of one mode).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <PercentBar
          data={{
            ...(data as Parameters<typeof PercentBar>[0]['data']),
            instanceId: `percent-bar-${Date.now()}`,
            skillId: 'math-percents',
            subskillId: 'percent-of-a-quantity',
            objectiveId: 'visualize-percentages-on-a-bar',
            onEvaluationSubmit,
          }}
        />
      );
    case 'tape-diagram':
      // TapeDiagram supports evaluation - pass the props
      return (
        <TapeDiagram
          data={{
            ...(data as Parameters<typeof TapeDiagram>[0]['data']),
            instanceId: `tape-diagram-${Date.now()}`,
            skillId: 'math-word-problems',
            subskillId: 'tape-diagram-modeling',
            objectiveId: 'model-word-problems-with-tape-diagrams',
            onEvaluationSubmit,
          }}
        />
      );
    case 'balance-scale':
      // BalanceScale produces multi-equation sessions (3-6 equations of one mode).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <BalanceScale
          data={{
            ...(data as Parameters<typeof BalanceScale>[0]['data']),
            instanceId: `balance-scale-${Date.now()}`,
            skillId: 'math-equations',
            subskillId: 'balance-scale-solving',
            objectiveId: 'solve-equations-with-balance-scale',
            onEvaluationSubmit,
          }}
        />
      );
    case 'function-machine':
      // FunctionMachine produces multi-challenge sessions (3-6 rules of one mode).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <FunctionMachine
          data={{
            ...(data as Parameters<typeof FunctionMachine>[0]['data']),
            instanceId: `function-machine-${Date.now()}`,
            skillId: 'math-functions',
            subskillId: 'function-rules',
            objectiveId: 'identify-function-rules',
            onEvaluationSubmit,
          }}
        />
      );
    case 'coordinate-graph':
      return <CoordinateGraph data={data as CoordinateGraphData} />;
    case 'slope-triangle':
      // SlopeTriangle produces multi-challenge sessions (3-6 lines per mode).
      // Evaluation flows through onEvaluationSubmit per PRD §6a #9.
      return (
        <SlopeTriangle
          data={{
            ...(data as Parameters<typeof SlopeTriangle>[0]['data']),
            instanceId: `slope-triangle-${Date.now()}`,
            skillId: 'math-linear-functions',
            subskillId: 'slope-triangle-reading',
            objectiveId: 'find-slope-from-triangle',
            onEvaluationSubmit,
          }}
        />
      );
    case 'polygon-area-builder':
      return (
        <PolygonAreaBuilder
          data={{
            ...(data as Parameters<typeof PolygonAreaBuilder>[0]['data']),
            instanceId: `polygon-area-builder-${Date.now()}`,
            skillId: 'math-geometry-area',
            subskillId: 'polygon-area',
            objectiveId: 'find-polygon-area',
            onEvaluationSubmit,
          }}
        />
      );
    case 'circle-explorer':
      return (
        <CircleExplorer
          data={{
            ...(data as Parameters<typeof CircleExplorer>[0]['data']),
            instanceId: `circle-explorer-${Date.now()}`,
            skillId: 'math-geometry-circles',
            subskillId: 'circle-explorer',
            objectiveId: 'explore-circles-and-pi',
            onEvaluationSubmit,
          }}
        />
      );
    case 'angle-workshop':
      return (
        <AngleWorkshop
          data={{
            ...(data as Parameters<typeof AngleWorkshop>[0]['data']),
            instanceId: `angle-workshop-${Date.now()}`,
            skillId: 'math-geometry-angles',
            subskillId: 'angle-workshop',
            objectiveId: 'explore-angle-relationships',
            onEvaluationSubmit,
          }}
        />
      );
    case 'transformation-lab':
      return (
        <TransformationLab
          data={{
            ...(data as Parameters<typeof TransformationLab>[0]['data']),
            instanceId: `transformation-lab-${Date.now()}`,
            skillId: 'math-geometry-transformations',
            subskillId: 'transformation-lab',
            objectiveId: 'explore-transformations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'systems-equations-visualizer':
      return (
        <SystemsEquationsVisualizer
          data={{
            ...(data as Parameters<typeof SystemsEquationsVisualizer>[0]['data']),
            instanceId: `systems-equations-${Date.now()}`,
            skillId: 'math-linear-functions',
            subskillId: 'systems-of-equations',
            objectiveId: 'solve-systems-of-equations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'matrix-display':
      return (
        <MatrixDisplay
          data={{
            ...(data as Parameters<typeof MatrixDisplay>[0]['data']),
            instanceId: `matrix-display-${Date.now()}`,
            skillId: 'math-linear-algebra',
            subskillId: 'matrix-operations',
            objectiveId: 'compute-matrix-operations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'dot-plot':
      return <DotPlot data={data as Parameters<typeof DotPlot>[0]['data']} />;
    case 'histogram':
      return (
        <Histogram
          data={{
            ...(data as Parameters<typeof Histogram>[0]['data']),
            instanceId: `histogram-${Date.now()}`,
            skillId: 'math-statistics',
            subskillId: 'histogram',
            objectiveId: 'read-and-interpret-histograms',
            onEvaluationSubmit,
          }}
        />
      );
    case 'two-way-table':
      return (
        <TwoWayTable
          data={{
            ...(data as Parameters<typeof TwoWayTable>[0]['data']),
            instanceId: `two-way-table-${Date.now()}`,
            skillId: 'math-statistics',
            subskillId: 'two-way-table',
            objectiveId: 'compute-probabilities-from-contingency-tables',
            onEvaluationSubmit,
          }}
        />
      );
    case 'ten-frame':
      return (
        <TenFrame
          data={{
            ...(data as Parameters<typeof TenFrame>[0]['data']),
            instanceId: `ten-frame-${Date.now()}`,
            skillId: 'math-number-sense',
            subskillId: 'ten-frame-operations',
            objectiveId: 'build-numbers-make-ten',
            onEvaluationSubmit,
          }}
        />
      );
    case 'counting-board':
      return (
        <CountingBoard
          data={{
            ...(data as Parameters<typeof CountingBoard>[0]['data']),
            instanceId: `counting-board-${Date.now()}`,
            skillId: 'math-counting',
            subskillId: 'one-to-one-correspondence',
            objectiveId: 'count-objects-subitize',
            onEvaluationSubmit,
          }}
        />
      );
    case 'pattern-builder':
      return (
        <PatternBuilder
          data={{
            ...(data as Parameters<typeof PatternBuilder>[0]['data']),
            instanceId: `pattern-builder-${Date.now()}`,
            skillId: 'math-algebraic-thinking',
            subskillId: 'pattern-recognition',
            objectiveId: 'recognize-extend-create-patterns',
            onEvaluationSubmit,
          }}
        />
      );
    case 'practice-problem':
      // PracticeProblem handles its own evaluation via usePrimitiveEvaluation hook
      // — do NOT pass onEvaluationSubmit to avoid double submission.
      return (
        <PracticeProblem
          data={{
            ...(data as Parameters<typeof PracticeProblem>[0]['data']),
            instanceId: `practice-problem-${Date.now()}`,
            skillId: 'math-equations',
            subskillId: 'multi-step-linear-equations',
            objectiveId: 'solve-multi-step-linear-equations',
          }}
        />
      );
    case 'skip-counting-runner':
      return (
        <SkipCountingRunner
          data={{
            ...(data as Parameters<typeof SkipCountingRunner>[0]['data']),
            instanceId: `skip-counting-runner-${Date.now()}`,
            skillId: 'math-multiplication',
            subskillId: 'skip-counting',
            objectiveId: 'count-by-multiples',
            onEvaluationSubmit,
          }}
        />
      );
    case 'regrouping-workbench':
      return (
        <RegroupingWorkbench
          data={{
            ...(data as Parameters<typeof RegroupingWorkbench>[0]['data']),
            instanceId: `regrouping-workbench-${Date.now()}`,
            skillId: 'math-operations',
            subskillId: 'regrouping',
            objectiveId: 'add-subtract-with-regrouping',
            onEvaluationSubmit,
          }}
        />
      );
    case 'multiplication-explorer':
      return (
        <MultiplicationExplorer
          data={{
            ...(data as Parameters<typeof MultiplicationExplorer>[0]['data']),
            instanceId: `multiplication-explorer-${Date.now()}`,
            skillId: 'math-multiplication',
            subskillId: 'multiplicative-thinking',
            objectiveId: 'explore-multiplication-representations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'measurement-tools': {
      const measurementData: MeasurementToolsData = {
        ...(data as Parameters<typeof MeasurementTools>[0]['data']),
        instanceId: `measurement-tools-${Date.now()}`,
        skillId: 'math-measurement',
        subskillId: 'measurement-tools',
        objectiveId: 'measure-estimate-convert',
        onEvaluationSubmit,
      };
      return <MeasurementTools data={measurementData} />;
    }
    case 'number-line':
      return (
        <NumberLine
          data={{
            ...(data as Parameters<typeof NumberLine>[0]['data']),
            instanceId: `number-line-${Date.now()}`,
            skillId: 'math-number-line',
            subskillId: 'number-line-operations',
            objectiveId: 'plot-and-navigate-number-line',
          }}
        />
      );
    case 'base-ten-blocks':
      return <BaseTenBlocks data={data as Parameters<typeof BaseTenBlocks>[0]['data']} />;
    case 'shape-builder':
      return <ShapeBuilder data={data as ShapeBuilderData} />;
    case 'comparison-builder':
      return (
        <ComparisonBuilder
          data={{
            ...(data as ComparisonBuilderData),
            instanceId: `comparison-builder-${Date.now()}`,
            skillId: 'math-comparison',
            subskillId: 'compare-numbers',
            objectiveId: 'compare-and-order-numbers',
          }}
        />
      );
    case 'number-sequencer':
      return (
        <NumberSequencer
          data={{
            ...(data as NumberSequencerData),
            instanceId: `number-sequencer-${Date.now()}`,
            skillId: 'math-number-sequences',
            subskillId: 'number-sequencing',
            objectiveId: 'understand-number-sequences',
          }}
        />
      );
    case 'number-bond':
      return (
        <NumberBond
          data={{
            ...(data as NumberBondData),
            instanceId: `number-bond-${Date.now()}`,
            skillId: 'math-number-bonds',
            subskillId: 'decompose-compose',
            objectiveId: 'understand-number-bonds',
          }}
        />
      );
    case 'addition-subtraction-scene': {
      const testData: AdditionSubtractionSceneData = {
        title: 'Addition & Subtraction Scene: Addition and subtraction stories within 10',
        description: 'Act out stories, build equations, and solve word problems!',
        challenges: [
          { id: 'as-1', type: 'act-out', instruction: 'Count all the ducks in the pond!', storyText: '3 ducks are swimming in the pond. 2 more ducks arrive.', scene: 'pond', objectType: 'ducks', operation: 'addition', storyType: 'join', startCount: 3, changeCount: 2, resultCount: 5, equation: '3 + 2 = 5' },
          { id: 'as-2', type: 'build-equation', instruction: 'Build the equation that matches this story.', storyText: '4 frogs are on a log. 1 more hops on.', scene: 'garden', objectType: 'frogs', operation: 'addition', storyType: 'join', startCount: 4, changeCount: 1, resultCount: 5, equation: '4 + 1 = 5' },
          { id: 'as-3', type: 'solve-story', instruction: 'How many birds are left?', storyText: '5 birds are on a branch. 2 fly away. How many are left?', scene: 'farm', objectType: 'birds', operation: 'subtraction', storyType: 'separate', startCount: 5, changeCount: 2, resultCount: 3, equation: '5 - 2 = 3', unknownPosition: 'result' },
          { id: 'as-4', type: 'create-story', instruction: 'Create a story for this equation!', storyText: 'Can you make up a story for 4 + 3 = 7?', scene: 'playground', objectType: 'butterflies', operation: 'addition', storyType: 'join', startCount: 4, changeCount: 3, resultCount: 7, equation: '4 + 3 = 7' },
        ],
        maxNumber: 10,
        showTenFrame: true,
        showEquationBar: true,
        gradeBand: 'K',
      };
      return <AdditionSubtractionScene data={testData} />;
    }
    case 'ordinal-line':
      // OrdinalLine handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <OrdinalLine
          data={{
            ...(data as Parameters<typeof OrdinalLine>[0]['data']),
            instanceId: `ordinal-line-${Date.now()}`,
            skillId: 'math-number-sense',
            subskillId: 'ordinal-positions',
            objectiveId: 'understand-ordinal-numbers',
          }}
        />
      );
    case 'sorting-station':
      // SortingStation handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <SortingStation
          data={data as any}
          className="w-full"
        />
      );
    case 'shape-sorter':
      // ShapeSorter handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <ShapeSorter
          data={data as any}
          className="w-full"
        />
      );
    case '3d-shape-explorer':
      // ThreeDShapeExplorer handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <ThreeDShapeExplorer
          data={data as any}
          className="w-full"
        />
      );
    case 'shape-tracer':
      // ShapeTracer handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <ShapeTracer
          data={data as any}
          className="w-full"
        />
      );
    case 'number-tracer':
      return <NumberTracer data={data as NumberTracerData} />;
    case 'math-fact-fluency':
      // MathFactFluency handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <MathFactFluency
          data={data as any}
          className="w-full"
        />
      );
    case 'strategy-picker':
      // StrategyPicker handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <StrategyPicker
          data={data as any}
          className="w-full"
        />
      );
    case 'hundreds-chart':
      // HundredsChart handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <HundredsChart
          data={{
            ...(data as Parameters<typeof HundredsChart>[0]['data']),
            instanceId: `hundreds-chart-${Date.now()}`,
            skillId: 'math-number-sense',
            subskillId: 'skip-counting',
            objectiveId: 'skip-count-on-hundreds-chart',
          }}
        />
      );
    case 'length-lab':
      // LengthLab handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <LengthLab
          data={{
            ...(data as Parameters<typeof LengthLab>[0]['data']),
            instanceId: `length-lab-${Date.now()}`,
            skillId: 'math-measurement',
            subskillId: 'measuring-length',
            objectiveId: 'measure-and-compare-lengths',
          }}
        />
      );
    case 'analog-clock':
      // AnalogClock handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <AnalogClock
          data={{
            ...(data as Parameters<typeof AnalogClock>[0]['data']),
            instanceId: `analog-clock-${Date.now()}`,
            skillId: 'math-measurement',
            subskillId: 'telling-time',
            objectiveId: 'read-analog-clock',
          }}
        />
      );
    case 'coin-counter':
      // CoinCounter handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <CoinCounter
          data={{
            ...(data as Parameters<typeof CoinCounter>[0]['data']),
            instanceId: `coin-counter-${Date.now()}`,
            skillId: 'math-money',
            subskillId: 'coin-counting',
            objectiveId: 'count-coins',
          }}
        />
      );
    case 'time-sequencer':
      // TimeSequencer handles its own evaluation via usePrimitiveEvaluation hook
      return (
        <TimeSequencer
          data={{
            ...(data as Parameters<typeof TimeSequencer>[0]['data']),
            instanceId: `time-sequencer-${Date.now()}`,
            skillId: 'math-time',
            subskillId: 'daily-routines-time',
            objectiveId: 'sequence-daily-events',
          }}
        />
      );
    case 'spatial-scene':
      return (
        <SpatialScene
          data={{
            ...(data as Parameters<typeof SpatialScene>[0]['data']),
            instanceId: `spatial-scene-${Date.now()}`,
            skillId: 'math-spatial',
            subskillId: 'spatial-positions-directions',
            objectiveId: 'understand-spatial-relationships',
          }}
        />
      );
    case 'shape-composer':
      return (
        <ShapeComposer
          data={{
            ...(data as Parameters<typeof ShapeComposer>[0]['data']),
            instanceId: `shape-composer-${Date.now()}`,
            skillId: 'math-geometry',
            subskillId: 'compose-decompose-shapes',
            objectiveId: 'compose-shapes-from-parts',
          }}
        />
      );
    case 'net-folder':
      return (
        <NetFolder
          data={{
            ...(data as Parameters<typeof NetFolder>[0]['data']),
            instanceId: `net-folder-${Date.now()}`,
            skillId: 'math-geometry',
            subskillId: '3d-shapes-surface-area',
            objectiveId: 'identify-nets-and-surface-area',
          }}
        />
      );
    case 'equation-builder':
      return (
        <EquationBuilder
          data={{
            ...(data as Parameters<typeof EquationBuilder>[0]['data']),
            instanceId: `equation-builder-${Date.now()}`,
            skillId: 'math-equations',
            subskillId: 'k2-equations',
            objectiveId: 'build-simple-equations',
          }}
        />
      );
    case 'compare-objects':
      return (
        <CompareObjects
          data={{
            ...(data as Parameters<typeof CompareObjects>[0]['data']),
            instanceId: `compare-objects-${Date.now()}`,
            skillId: 'math-comparison',
            subskillId: 'compare-attributes',
            objectiveId: 'compare-object-properties',
          }}
        />
      );
    case 'parameter-explorer':
      return (
        <ParameterExplorer
          data={{
            ...(data as Parameters<typeof ParameterExplorer>[0]['data']),
            instanceId: `parameter-explorer-${Date.now()}`,
            skillId: 'math-parameter-exploration',
            subskillId: 'parameter-effects',
            objectiveId: 'explore-parameter-impact',
          }}
        />
      );
    case 'equation-workspace':
      return (
        <EquationWorkspace
          {...(data as EquationWorkspaceData)}
          instanceId={`equation-workspace-${Date.now()}`}
          skillId="math-equation-workspace"
          subskillId="equation-solving"
          objectiveId="solve-equations-step-by-step"
        />
      );
    case 'function-sketch':
      return (
        <FunctionSketch
          data={{
            ...(data as FunctionSketchData),
            instanceId: `function-sketch-${Date.now()}`,
            skillId: 'math-function-sketch',
            subskillId: 'trigonometric-functions',
            objectiveId: 'sketch-and-classify-functions',
            onEvaluationSubmit,
          }}
        />
      );
    default:
      return <div className="text-slate-400">Unknown primitive: {componentId}</div>;
  }
};

// Evaluation Results Panel - Shows submitted results from the session
const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();

  if (!context) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-sm">Evaluation tracking not available (no provider)</p>
      </div>
    );
  }

  const { submittedResults, pendingSubmissions, isOnline, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Evaluation Results</h4>
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
          isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Session Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-xs text-slate-400">Attempts</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-xs text-slate-400">Successes</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-xs text-slate-400">Avg Score</div>
        </div>
      </div>

      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-xs">
            {pendingSubmissions.length} evaluation(s) pending sync...
          </p>
        </div>
      )}

      {/* Recent Results */}
      {submittedResults.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-slate-300">Recent Results</h5>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {submittedResults.slice(-5).reverse().map((result) => (
              <div
                key={result.attemptId}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">
                    {result.primitiveType}
                  </span>
                  <span className={`text-sm font-bold ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {Math.round(result.score)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Duration: {Math.round(result.durationMs / 1000)}s
                  {result.success ? ' • Passed!' : ' • Try again'}
                </div>
                {/* Show FractionBar-specific metrics */}
                {result.metrics.type === 'fraction-bar' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show PlaceValueChart-specific metrics */}
                {result.metrics.type === 'place-value-chart' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show FactorTree-specific metrics */}
                {result.metrics.type === 'factor-tree' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Target: {result.metrics.targetNumber}</span>
                    <span>Complete: {result.metrics.factorizationComplete ? 'Yes' : 'No'}</span>
                    <span>Factorization: {result.metrics.finalFactorization}</span>
                    <span>Efficiency: {Math.round(result.metrics.efficiency * 100)}%</span>
                    <span>Primes: {result.metrics.uniquePrimes.join(', ')}</span>
                    <span>Invalid: {result.metrics.invalidSplitAttempts}</span>
                  </div>
                )}
                {/* Show BarModel-specific metrics */}
                {result.metrics.type === 'bar-model' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.evalMode}</span>
                    <span>Style: {result.metrics.graphStyle}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show DoubleNumberLine-specific metrics */}
                {result.metrics.type === 'double-number-line' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show TapeDiagram-specific metrics */}
                {result.metrics.type === 'tape-diagram' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show AreaModel-specific metrics */}
                {result.metrics.type === 'area-model' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show FunctionMachine-specific metrics */}
                {result.metrics.type === 'function-machine' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show ArrayGrid-specific metrics */}
                {result.metrics.type === 'array-grid' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show FunctionSketch-specific metrics */}
                {result.metrics.type === 'function-sketch' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show PercentBar-specific metrics */}
                {result.metrics.type === 'percent-bar' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show BalanceScale-specific metrics */}
                {result.metrics.type === 'balance-scale' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show MeasurementTools-specific metrics */}
                {result.metrics.type === 'measurement-tools' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show Histogram-specific metrics */}
                {result.metrics.type === 'histogram' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show MatrixDisplay-specific metrics */}
                {result.metrics.type === 'matrix-display' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show TwoWayTable-specific metrics */}
                {result.metrics.type === 'two-way-table' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show SlopeTriangle-specific metrics */}
                {result.metrics.type === 'slope-triangle' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show PolygonAreaBuilder-specific metrics */}
                {result.metrics.type === 'polygon-area-builder' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show CircleExplorer-specific metrics */}
                {result.metrics.type === 'circle-explorer' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show AngleWorkshop-specific metrics */}
                {result.metrics.type === 'angle-workshop' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount}/{result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg attempts: {result.metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy.toFixed(0)}%</span>
                  </div>
                )}
                {/* Show TransformationLab-specific metrics */}
                {result.metrics.type === 'transformation-lab' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount}/{result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg attempts: {result.metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy.toFixed(0)}%</span>
                  </div>
                )}
                {/* Show SystemsEquations-specific metrics */}
                {result.metrics.type === 'systems-equations-visualizer' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.challengeType}</span>
                    <span>Correct: {result.metrics.correctCount} / {result.metrics.totalChallenges}</span>
                    <span>First try: {result.metrics.firstTryCount}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                    <span>Avg/challenge: {result.metrics.averageAttemptsPerChallenge}</span>
                    <span>Hints viewed: {result.metrics.hintsViewed}</span>
                    <span>Accuracy: {result.metrics.overallAccuracy}%</span>
                  </div>
                )}
                {/* Show PatternBuilder-specific metrics */}
                {result.metrics.type === 'pattern-builder' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Mode: {result.metrics.evalMode}</span>
                    <span>Extensions: {result.metrics.extensionsCorrect} / {result.metrics.extensionsTotal}</span>
                    <span>Core identified: {result.metrics.coreIdentifiedCorrectly ? 'yes' : 'no'}</span>
                    <span>Rule articulated: {result.metrics.ruleArticulated ? 'yes' : 'no'}</span>
                    <span>Pattern created: {result.metrics.patternCreated ? 'yes' : 'no'}</span>
                    <span>Translation: {result.metrics.translationCorrect ? 'yes' : 'no'}</span>
                    <span>Total attempts: {result.metrics.attemptsCount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submittedResults.length === 0 && pendingSubmissions.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">
          No evaluations yet. Complete a challenge to see results!
        </p>
      )}
    </div>
  );
};

// Inner component that uses the evaluation context
const MathPrimitivesTesterInner: React.FC<MathPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('fraction-bar');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [selectedEvalMode, setSelectedEvalMode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);
  const [showGeneratedJson, setShowGeneratedJson] = useState(false);

  const selectedOption = PRIMITIVE_OPTIONS.find(p => p.value === selectedPrimitive)!;

  // Look up eval modes from the catalog for the selected primitive
  const catalogEntry = MATH_CATALOG.find(c => c.id === selectedPrimitive);
  const evalModes: EvalModeDefinition[] = catalogEntry?.evalModes ?? [];

  // Topic from the selected primitive — used by EvaluationProvider for curriculum mapping
  const topic = selectedOption.topic;

  // Callback when an evaluation is submitted
  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
    setLastEvaluationResult(result);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: selectedOption.topic,
            gradeLevel,
            config: {
              ...(selectedEvalMode ? { targetEvalMode: selectedEvalMode } : {}),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
      setGenerationKey(k => k + 1);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <EvaluationProvider
      sessionId={`math-tester-${Date.now()}`}
      exhibitId="math-primitives-tester"
      topic={topic}
      gradeLevel={gradeLevel}
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950">
      {/* Header bar */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🧮</span>
              <span>Math Primitives Tester</span>
            </h1>
            <span className="hidden md:inline text-xs text-slate-500 ml-2">
              AI-generated math visualizations for any grade level
            </span>
          </div>
        </div>
      </div>

      {/* Main layout: narrow sidebar + flex-1 main */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar — controls */}
        <div className="w-[300px] border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0 space-y-5">
          {/* Primitive Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Primitive</label>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {PRIMITIVE_GROUPS.map((group, groupIdx) => (
                <div key={group.label} className="space-y-1">
                  <div className={`px-1 pb-1 flex items-baseline justify-between gap-2 ${groupIdx > 0 ? 'pt-3' : ''}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-slate-600 tabular-nums">{group.grade}</span>
                  </div>
                  {group.items.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedPrimitive(option.value);
                        setSelectedEvalMode(null);
                        setGeneratedData(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        selectedPrimitive === option.value
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className="text-sm font-medium block truncate flex-1 min-w-0">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Grade Level */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Eval Mode Selector — shown when the primitive has IRT eval modes */}
          {evalModes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Difficulty Mode
                <span className="text-slate-600 font-normal ml-1">(IRT)</span>
              </label>
              <div className="space-y-1">
                {/* "Auto" option — no mode constraint */}
                <button
                  onClick={() => setSelectedEvalMode(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                    selectedEvalMode === null
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Auto (mixed)</span>
                    <span className="text-xs opacity-60">Default</span>
                  </div>
                </button>
                {/* One button per eval mode */}
                {evalModes.map((mode) => (
                  <button
                    key={mode.evalMode}
                    onClick={() => setSelectedEvalMode(mode.evalMode)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                      selectedEvalMode === mode.evalMode
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{mode.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        mode.scaffoldingMode <= 2
                          ? 'bg-green-500/20 text-green-400'
                          : mode.scaffoldingMode <= 4
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}>
                        Mode {mode.scaffoldingMode} / {'\u03B2'} {mode.beta}
                      </span>
                    </div>
                    <p className="text-xs opacity-60 mt-0.5">{mode.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate with AI
              </>
            )}
          </button>

          {/* Info */}
          <p className="text-xs text-slate-500 text-center">
            Gemini will generate a {selectedOption.label.toLowerCase()} appropriate for {gradeLevel} level
            {selectedEvalMode && evalModes.length > 0 && (() => {
              const mode = evalModes.find(m => m.evalMode === selectedEvalMode);
              return mode ? (
                <span className="block mt-1 text-purple-400">
                  Mode: {mode.label} ({'\u03B2'} = {mode.beta})
                </span>
              ) : null;
            })()}
          </p>
        </div>

        {/* Main content area — preview + eval results */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Preview */}
            <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Preview</h3>
                {generatedData != null && (
                  <span className="text-xs text-slate-500">
                    {selectedOption.icon} {selectedOption.label}
                  </span>
                )}
              </div>

              {generatedData ? (
                <PrimitiveRenderer
                  key={generationKey}
                  componentId={selectedPrimitive}
                  data={generatedData}
                  onEvaluationSubmit={handleEvaluationSubmit}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                  <span className="text-5xl mb-4">{selectedOption.icon}</span>
                  <p className="text-base">Click <span className="text-purple-400">Generate with AI</span> to create a {selectedOption.label.toLowerCase()}</p>
                </div>
              )}
            </div>

            {/* Results section */}
            <div>
          <EvaluationResultsPanel />

          {/* Generated Data (Gemini Output) */}
          {generatedData != null && (() => {
            const d = generatedData as Record<string, unknown>;
            const title = typeof d.title === 'string' ? d.title : selectedOption.label;
            const description = typeof d.description === 'string' ? d.description : null;
            const operation = typeof d.operation === 'string' ? d.operation : null;
            const gradeBand = typeof d.gradeBand === 'string' ? d.gradeBand : null;
            const challengeCount = Array.isArray(d.challenges) ? d.challenges.length : null;
            const modeLabel = selectedEvalMode
              ? evalModes.find(m => m.evalMode === selectedEvalMode)?.label ?? selectedEvalMode
              : 'Auto (mixed)';

            return (
              <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                {/* Metadata header */}
                <div className="mb-3 pb-3 border-b border-slate-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-base font-semibold text-white">{title}</h4>
                    <button
                      onClick={() => {
                        const meta = [
                          `# ${title}`,
                          description ? `${description}` : '',
                          '',
                          `Primitive: ${selectedOption.label}`,
                          `Mode: ${modeLabel}`,
                          `Grade: ${gradeBand ?? gradeLevel}`,
                          operation ? `Operation: ${operation}` : '',
                          challengeCount != null ? `Challenges: ${challengeCount}` : '',
                          '',
                          '```json',
                          JSON.stringify(generatedData, null, 2),
                          '```',
                        ].filter(Boolean).join('\n');
                        navigator.clipboard.writeText(meta);
                      }}
                      className="text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      Copy JSON
                    </button>
                  </div>
                  {description && (
                    <p className="text-sm text-slate-400 mb-2">{description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      {selectedOption.label}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Mode: {modeLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      Grade: {gradeBand ?? gradeLevel}
                    </span>
                    {operation && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {operation}
                      </span>
                    )}
                    {challengeCount != null && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {challengeCount} challenge{challengeCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Collapsible JSON */}
                <button
                  onClick={() => setShowGeneratedJson(!showGeneratedJson)}
                  className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1 mb-2"
                >
                  <span className={`inline-block transition-transform ${showGeneratedJson ? 'rotate-90' : ''}`}>&#9654;</span>
                  Raw JSON
                </button>
                {showGeneratedJson && (
                  <pre className="text-xs text-slate-400 overflow-auto max-h-64 bg-slate-900/50 p-3 rounded-lg">
                    {JSON.stringify(generatedData, null, 2)}
                  </pre>
                )}
              </div>
            );
          })()}

          {/* Last Result Quick View */}
          {lastEvaluationResult && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Last Evaluation (Raw JSON)</h4>
              <pre className="text-xs text-slate-400 overflow-auto max-h-48 bg-slate-900/50 p-3 rounded-lg">
                {JSON.stringify(lastEvaluationResult, null, 2)}
              </pre>
            </div>
          )}
          </div>
        </div>
      </div>
      </div>
    </div>
    </EvaluationProvider>
  );
};

// Main export - wraps with ExhibitProvider and LuminaAIProvider
// EvaluationProvider is inside MathPrimitivesTesterInner so it has access to
// the selected primitive's topic and grade level for curriculum mapping.
export const MathPrimitivesTester: React.FC<MathPrimitivesTesterProps> = (props) => {
  return (
    <ExhibitProvider objectives={[]} manifestItems={[]}>
      <LuminaAIProvider>
        <MathPrimitivesTesterInner {...props} />
      </LuminaAIProvider>
    </ExhibitProvider>
  );
};

export default MathPrimitivesTester;
