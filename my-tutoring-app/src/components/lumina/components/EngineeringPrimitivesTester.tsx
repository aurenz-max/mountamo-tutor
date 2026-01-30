'use client';

import React, { useState } from 'react';
import LeverLab from '../primitives/visual-primitives/engineering/LeverLab';
import PulleySystemBuilder from '../primitives/visual-primitives/engineering/PulleySystemBuilder';
import RampLab from '../primitives/visual-primitives/engineering/RampLab';
import WheelAxleExplorer from '../primitives/visual-primitives/engineering/WheelAxleExplorer';
import GearTrainBuilder from '../primitives/visual-primitives/engineering/GearTrainBuilder';
import BridgeBuilder from '../primitives/visual-primitives/engineering/BridgeBuilder';
import TowerStacker from '../primitives/visual-primitives/engineering/TowerStacker';
import ShapeStrengthTester from '../primitives/visual-primitives/engineering/ShapeStrengthTester';
import FoundationBuilder from '../primitives/visual-primitives/engineering/FoundationBuilder';
import ExcavatorArmSimulator from '../primitives/visual-primitives/engineering/ExcavatorArmSimulator';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface EngineeringPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'lever-lab' | 'pulley-system-builder' | 'ramp-lab' | 'wheel-axle-explorer' | 'gear-train-builder' | 'bridge-builder' | 'tower-stacker' | 'shape-strength-tester' | 'foundation-builder' | 'excavator-arm-simulator';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'lever-lab', label: 'Lever Lab', icon: '⚖️', topic: 'Understanding levers and balance' },
  { value: 'pulley-system-builder', label: 'Pulley System Builder', icon: '🏗️', topic: 'Understanding pulleys and mechanical advantage' },
  { value: 'ramp-lab', label: 'Ramp Lab', icon: '📐', topic: 'Understanding inclined planes and ramps' },
  { value: 'wheel-axle-explorer', label: 'Wheel & Axle Explorer', icon: '⚙️', topic: 'Understanding wheel and axle machines' },
  { value: 'gear-train-builder', label: 'Gear Train Builder', icon: '🔩', topic: 'Understanding gears and speed ratios' },
  { value: 'bridge-builder', label: 'Bridge Builder', icon: '🌉', topic: 'Understanding bridges and structural engineering' },
  { value: 'tower-stacker', label: 'Tower Stacker', icon: '🏗️', topic: 'Understanding stability and center of gravity' },
  { value: 'shape-strength-tester', label: 'Shape Strength Tester', icon: '🔺', topic: 'Understanding shape strength and triangulation' },
  { value: 'foundation-builder', label: 'Foundation Builder', icon: '🏛️', topic: 'Understanding foundations and soil pressure' },
  { value: 'excavator-arm-simulator', label: 'Excavator Arm Simulator', icon: '🚜', topic: 'Understanding excavators and multi-joint systems' },
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
    case 'lever-lab':
      return <LeverLab data={data as Parameters<typeof LeverLab>[0]['data']} />;
    case 'pulley-system-builder':
      return <PulleySystemBuilder data={data as Parameters<typeof PulleySystemBuilder>[0]['data']} />;
    case 'ramp-lab':
      return <RampLab data={data as Parameters<typeof RampLab>[0]['data']} />;
    case 'wheel-axle-explorer':
      return <WheelAxleExplorer data={data as Parameters<typeof WheelAxleExplorer>[0]['data']} />;
    case 'gear-train-builder':
      return <GearTrainBuilder data={data as Parameters<typeof GearTrainBuilder>[0]['data']} />;
    case 'bridge-builder':
      // BridgeBuilder now supports evaluation - pass the props
      return (
        <BridgeBuilder
          data={{
            ...(data as Parameters<typeof BridgeBuilder>[0]['data']),
            // Evaluation integration props
            instanceId: `bridge-builder-${Date.now()}`,
            skillId: 'engineering-structural-design',
            subskillId: 'bridge-construction',
            objectiveId: 'understand-load-distribution',
            onEvaluationSubmit,
          }}
        />
      );
    case 'tower-stacker':
      // TowerStacker now supports evaluation - pass the props
      return (
        <TowerStacker
          data={{
            ...(data as Parameters<typeof TowerStacker>[0]['data']),
            // Evaluation integration props
            instanceId: `tower-stacker-${Date.now()}`,
            skillId: 'engineering-structural-stability',
            subskillId: 'center-of-gravity',
            objectiveId: 'understand-stability',
            onEvaluationSubmit,
          }}
        />
      );
    case 'shape-strength-tester':
      // ShapeStrengthTester supports evaluation - pass the props
      return (
        <ShapeStrengthTester
          data={{
            ...(data as Parameters<typeof ShapeStrengthTester>[0]['data']),
            // Evaluation integration props
            instanceId: `shape-strength-tester-${Date.now()}`,
            skillId: 'engineering-structural-design',
            subskillId: 'triangulation',
            objectiveId: 'understand-shape-strength',
            onEvaluationSubmit,
          }}
        />
      );
    case 'foundation-builder':
      // FoundationBuilder supports evaluation - pass the props
      return (
        <FoundationBuilder
          data={{
            ...(data as Parameters<typeof FoundationBuilder>[0]['data']),
            // Evaluation integration props
            instanceId: `foundation-builder-${Date.now()}`,
            skillId: 'engineering-foundations',
            subskillId: 'soil-pressure',
            objectiveId: 'understand-foundations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'excavator-arm-simulator':
      // ExcavatorArmSimulator supports evaluation - pass the props
      return (
        <ExcavatorArmSimulator
          data={{
            ...(data as Parameters<typeof ExcavatorArmSimulator>[0]['data']),
            // Evaluation integration props
            instanceId: `excavator-arm-simulator-${Date.now()}`,
            skillId: 'engineering-hydraulics',
            subskillId: 'multi-joint-systems',
            objectiveId: 'understand-excavators',
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
          <div className="text-2xl font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
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
                {/* Show TowerStacker-specific metrics */}
                {result.metrics.type === 'tower-stacker' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Height: {result.metrics.achievedHeight}/{result.metrics.targetHeight}</span>
                    <span>Stability: {Math.round(result.metrics.stabilityScore)}%</span>
                    <span>Pieces: {result.metrics.piecesUsed}</span>
                    <span>Wind: {result.metrics.windTestPassed ? 'Passed' : 'Failed'}</span>
                  </div>
                )}
                {/* Show BridgeBuilder-specific metrics */}
                {result.metrics.type === 'bridge-builder' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Connected: {result.metrics.bridgeConnected ? 'Yes' : 'No'}</span>
                    <span>Load Test: {result.metrics.loadTestPassed ? 'Passed' : 'Failed'}</span>
                    <span>Members: {result.metrics.membersUsed}</span>
                    <span>Max Stress: {Math.round(result.metrics.maxStressObserved)}%</span>
                    <span>Triangles: {result.metrics.triangleCount}</span>
                    <span>Integrity: {Math.round(result.metrics.structuralIntegrity)}%</span>
                  </div>
                )}
                {/* Show ShapeStrengthTester-specific metrics */}
                {result.metrics.type === 'shape-strength-tester' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Shapes Tested: {result.metrics.shapesTested}</span>
                    <span>Total Tests: {result.metrics.totalTests}</span>
                    <span>Triangle Found: {result.metrics.triangleDiscovered ? 'Yes' : 'No'}</span>
                    <span>Bracing Used: {result.metrics.bracingUsed ? 'Yes' : 'No'}</span>
                    <span>Max Load: {result.metrics.maxLoadAchieved}N</span>
                    <span>Challenge: {result.metrics.targetShapeMet && result.metrics.targetLoadMet ? 'Complete' : 'Incomplete'}</span>
                  </div>
                )}
                {/* Show FoundationBuilder-specific metrics */}
                {result.metrics.type === 'foundation-builder' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Soil: {result.metrics.soilType}</span>
                    <span>Load: {result.metrics.buildingLoad} kN</span>
                    <span>Area: {result.metrics.footingArea.toFixed(1)} m²</span>
                    <span>Pressure: {result.metrics.pressure.toFixed(1)} kN/m²</span>
                    <span>Type: {result.metrics.foundationType}</span>
                    <span>Safety: {result.metrics.safetyFactor.toFixed(2)}x</span>
                    <span>Designs: {result.metrics.designsAttempted}</span>
                    <span>Success: {result.metrics.successfulDesigns}</span>
                  </div>
                )}
                {/* Show ExcavatorArmSimulator-specific metrics */}
                {result.metrics.type === 'excavator-arm-simulator' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Excavated: {result.metrics.excavatedAmount}/{result.metrics.targetAmount}</span>
                    <span>Digs: {result.metrics.digOperations}</span>
                    <span>Dumps: {result.metrics.dumpOperations}</span>
                    <span>Efficiency: {result.metrics.efficiency.toFixed(1)}</span>
                    <span>Boom: {Math.round(result.metrics.finalBoomAngle)}°</span>
                    <span>Stick: {Math.round(result.metrics.finalStickAngle)}°</span>
                    <span>Bucket: {Math.round(result.metrics.finalBucketAngle)}°</span>
                    <span>Goal: {result.metrics.goalMet ? 'Met' : 'Not Met'}</span>
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
const EngineeringPrimitivesTesterInner: React.FC<EngineeringPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('tower-stacker'); // Default to tower-stacker to demo evaluation
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
        <h2 className="text-4xl font-bold text-white mb-2">Engineering Primitives Tester</h2>
        <p className="text-slate-400">AI-generated engineering visualizations for any grade level</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Generate</h3>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-1 gap-2">
              {PRIMITIVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedPrimitive(option.value);
                    setGeneratedData(null);
                  }}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
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
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
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
            className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
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

// Main export - wraps with EvaluationProvider for tracking
export const EngineeringPrimitivesTester: React.FC<EngineeringPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider
      sessionId={`engineering-tester-${Date.now()}`}
      exhibitId="engineering-primitives-tester"
      // In production, pass actual studentId from auth context
      // studentId={currentUser?.studentId}
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <EngineeringPrimitivesTesterInner {...props} />
    </EvaluationProvider>
  );
};

export default EngineeringPrimitivesTester;
