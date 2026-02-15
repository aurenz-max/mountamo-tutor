'use client';

import React, { useState } from 'react';
import FractionBar from '../primitives/visual-primitives/math/FractionBar';
import PlaceValueChart from '../primitives/visual-primitives/math/PlaceValueChart';
import AreaModel from '../primitives/visual-primitives/math/AreaModel';
import ArrayGrid from '../primitives/visual-primitives/math/ArrayGrid';
import FactorTree from '../primitives/visual-primitives/math/FactorTree';
import RatioTable from '../primitives/visual-primitives/math/RatioTable';
import DoubleNumberLine from '../primitives/visual-primitives/math/DoubleNumberLine';
import PercentBar from '../primitives/visual-primitives/math/PercentBar';
import TapeDiagram from '../primitives/visual-primitives/math/TapeDiagram';
import BalanceScale from '../primitives/visual-primitives/math/BalanceScale';
import FunctionMachine from '../primitives/visual-primitives/math/FunctionMachine';
import CoordinateGraph from '../primitives/visual-primitives/math/CoordinateGraph';
import SlopeTriangle from '../primitives/visual-primitives/math/SlopeTriangle';
import SystemsEquationsVisualizer from '../primitives/visual-primitives/math/SystemsEquationsVisualizer';
import MatrixDisplay from '../primitives/visual-primitives/math/MatrixDisplay';
import DotPlot from '../primitives/visual-primitives/math/DotPlot';
import Histogram from '../primitives/visual-primitives/math/Histogram';
import TwoWayTable from '../primitives/visual-primitives/math/TwoWayTable';
import TenFrame from '../primitives/visual-primitives/math/TenFrame';
import CountingBoard from '../primitives/visual-primitives/math/CountingBoard';
import PatternBuilder from '../primitives/visual-primitives/math/PatternBuilder';
import SkipCountingRunner from '../primitives/visual-primitives/math/SkipCountingRunner';
import RegroupingWorkbench from '../primitives/visual-primitives/math/RegroupingWorkbench';
import MultiplicationExplorer from '../primitives/visual-primitives/math/MultiplicationExplorer';
import MeasurementTools from '../primitives/visual-primitives/math/MeasurementTools';
import ShapeBuilder from '../primitives/visual-primitives/math/ShapeBuilder';
import NumberLine from '../primitives/visual-primitives/math/NumberLine';
import BaseTenBlocks from '../primitives/visual-primitives/math/BaseTenBlocks';
import type { ShapeBuilderData } from '../types';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';

interface MathPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'area-model' | 'array-grid' | 'factor-tree' | 'ratio-table' | 'double-number-line' | 'percent-bar' | 'tape-diagram' | 'balance-scale' | 'function-machine' | 'coordinate-graph' | 'slope-triangle' | 'systems-equations-visualizer' | 'matrix-display' | 'dot-plot' | 'histogram' | 'two-way-table' | 'ten-frame' | 'counting-board' | 'pattern-builder' | 'skip-counting-runner' | 'regrouping-workbench' | 'multiplication-explorer' | 'measurement-tools' | 'shape-builder' | 'number-line' | 'base-ten-blocks';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'fraction-bar', label: 'Fraction Bar', icon: '📊', topic: 'Understanding fractions' },
  { value: 'place-value-chart', label: 'Place Value Chart', icon: '🔢', topic: 'Place value and decimal numbers' },
  { value: 'area-model', label: 'Area Model', icon: '📐', topic: 'Multi-digit multiplication' },
  { value: 'array-grid', label: 'Array / Grid', icon: '⊞', topic: 'Introduction to multiplication' },
  { value: 'factor-tree', label: 'Factor Tree', icon: '🌳', topic: 'Prime factorization' },
  { value: 'ratio-table', label: 'Ratio Table', icon: '⚖️', topic: 'Equivalent ratios and proportions' },
  { value: 'double-number-line', label: 'Double Number Line', icon: '↔️', topic: 'Unit rates and proportional relationships' },
  { value: 'percent-bar', label: 'Percent Bar', icon: '📈', topic: 'Percent concepts and calculations' },
  { value: 'tape-diagram', label: 'Tape Diagram', icon: '📏', topic: 'Part-part-whole word problems' },
  { value: 'balance-scale', label: 'Balance / Scale Model', icon: '⚖️', topic: 'Solving equations' },
  { value: 'function-machine', label: 'Function Machine', icon: '⚙️', topic: 'Input-output patterns and functions' },
  { value: 'coordinate-graph', label: 'Coordinate Graph', icon: '📍', topic: 'Graphing linear equations' },
  { value: 'slope-triangle', label: 'Slope Triangle', icon: '📐', topic: 'Understanding slope with rise and run' },
  { value: 'systems-equations-visualizer', label: 'Systems of Equations', icon: '📊', topic: 'Solving systems of equations' },
  { value: 'matrix-display', label: 'Matrix Display', icon: '▦', topic: 'Matrix operations and transformations' },
  { value: 'dot-plot', label: 'Dot Plot', icon: '⚬', topic: 'Mean, median, and mode with data sets' },
  { value: 'histogram', label: 'Histogram', icon: '📊', topic: 'Distribution shapes and frequency analysis' },
  { value: 'two-way-table', label: 'Two-Way Table', icon: '⊞', topic: 'Categorical data and conditional probability' },
  { value: 'ten-frame', label: 'Ten Frame', icon: '🔟', topic: 'Building numbers, subitizing, and making ten' },
  { value: 'counting-board', label: 'Counting Board', icon: '🧸', topic: 'Counting objects, subitizing, and one-to-one correspondence' },
  { value: 'pattern-builder', label: 'Pattern Builder', icon: '🔁', topic: 'Pattern recognition, extension, and algebraic thinking' },
  { value: 'skip-counting-runner', label: 'Skip Counting Runner', icon: '🐸', topic: 'Skip counting, multiplication foundations, and number patterns' },
  { value: 'regrouping-workbench', label: 'Regrouping Workbench', icon: '🧮', topic: 'Addition and subtraction with carrying and borrowing' },
  { value: 'multiplication-explorer', label: 'Multiplication Explorer', icon: '✖️', topic: 'Multiplication through multiple representations' },
  { value: 'measurement-tools', label: 'Measurement Tools', icon: '📏', topic: 'Length, weight, capacity, and temperature measurement' },
  { value: 'shape-builder', label: 'Shape Builder', icon: '📐', topic: 'Identifying quadrilaterals' },
  { value: 'number-line' as PrimitiveType, label: 'Number Line', icon: '📏', topic: 'Addition and subtraction on a number line' },
  { value: 'base-ten-blocks', label: 'Base Ten Blocks', icon: '🧱', topic: 'Place value and regrouping' },
];

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
    case 'place-value-chart':
      // PlaceValueChart supports evaluation - pass the props
      return (
        <PlaceValueChart
          data={{
            ...(data as Parameters<typeof PlaceValueChart>[0]['data']),
            // Evaluation integration props
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
    case 'area-model':
      return <AreaModel data={data as Parameters<typeof AreaModel>[0]['data']} />;
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
      return <RatioTable data={data as Parameters<typeof RatioTable>[0]['data']} />;
    case 'double-number-line':
      return <DoubleNumberLine data={data as Parameters<typeof DoubleNumberLine>[0]['data']} />;
    case 'percent-bar':
      return <PercentBar data={data as Parameters<typeof PercentBar>[0]['data']} />;
    case 'tape-diagram':
      return <TapeDiagram data={data as Parameters<typeof TapeDiagram>[0]['data']} />;
    case 'balance-scale':
      return <BalanceScale data={data as Parameters<typeof BalanceScale>[0]['data']} />;
    case 'function-machine':
      return <FunctionMachine data={data as Parameters<typeof FunctionMachine>[0]['data']} />;
    case 'coordinate-graph':
      return <CoordinateGraph data={data as Parameters<typeof CoordinateGraph>[0]['data']} />;
    case 'slope-triangle':
      return <SlopeTriangle data={data as Parameters<typeof SlopeTriangle>[0]['data']} />;
    case 'systems-equations-visualizer':
      return <SystemsEquationsVisualizer data={data as Parameters<typeof SystemsEquationsVisualizer>[0]['data']} />;
    case 'matrix-display':
      return <MatrixDisplay data={data as Parameters<typeof MatrixDisplay>[0]['data']} />;
    case 'dot-plot':
      return <DotPlot data={data as Parameters<typeof DotPlot>[0]['data']} />;
    case 'histogram':
      return <Histogram data={data as Parameters<typeof Histogram>[0]['data']} />;
    case 'two-way-table':
      return <TwoWayTable data={data as Parameters<typeof TwoWayTable>[0]['data']} />;
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
    case 'measurement-tools':
      return (
        <MeasurementTools
          data={{
            ...(data as Parameters<typeof MeasurementTools>[0]['data']),
            instanceId: `measurement-tools-${Date.now()}`,
            skillId: 'math-measurement',
            subskillId: 'measurement-tools',
            objectiveId: 'measure-estimate-convert',
            onEvaluationSubmit,
          }}
        />
      );
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
                    <span>Target: {result.metrics.targetFraction || 'N/A'}</span>
                    <span>Selected: {result.metrics.selectedFraction}</span>
                    <span>Numerator: {result.metrics.numerator}</span>
                    <span>Denominator: {result.metrics.denominator}</span>
                    <span>Simplified: {result.metrics.simplifiedFraction}</span>
                    <span>Equivalent: {result.metrics.recognizedEquivalence ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {/* Show PlaceValueChart-specific metrics */}
                {result.metrics.type === 'place-value-chart' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Final Value: {result.metrics.finalValue}</span>
                    <span>Digits: {result.metrics.totalDigitsEntered}</span>
                    <span>Decimals: {result.metrics.usesDecimals ? 'Yes' : 'No'}</span>
                    <span>Changes: {result.metrics.digitChanges}</span>
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find(p => p.value === selectedPrimitive)!;

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
            config: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Math Primitives Tester</h2>
        <p className="text-slate-400">AI-generated math visualizations for any grade level</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Generate</h3>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2">
              {PRIMITIVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedPrimitive(option.value);
                    setGeneratedData(null);
                  }}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Grade Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <p className="mt-4 text-xs text-slate-500 text-center">
            Gemini will generate a {selectedOption.label.toLowerCase()} appropriate for {gradeLevel} level
          </p>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Preview</h3>

          {generatedData ? (
            <PrimitiveRenderer
              componentId={selectedPrimitive}
              data={generatedData}
              onEvaluationSubmit={handleEvaluationSubmit}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <span className="text-4xl mb-4">{selectedOption.icon}</span>
              <p>Click "Generate with AI" to create a {selectedOption.label.toLowerCase()}</p>
            </div>
          )}
        </div>

        {/* Evaluation Results Panel - Third Column */}
        <div className="lg:col-span-2">
          <EvaluationResultsPanel />

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
  );
};

// Main export - wraps with EvaluationProvider, ExhibitProvider, and LuminaAIProvider
export const MathPrimitivesTester: React.FC<MathPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider
      sessionId={`math-tester-${Date.now()}`}
      exhibitId="math-primitives-tester"
      // In production, pass actual studentId from auth context
      // studentId={currentUser?.studentId}
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <LuminaAIProvider>
          <MathPrimitivesTesterInner {...props} />
        </LuminaAIProvider>
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default MathPrimitivesTester;
