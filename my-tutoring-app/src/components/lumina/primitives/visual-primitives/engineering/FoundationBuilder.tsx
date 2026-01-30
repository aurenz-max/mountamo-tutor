'use client';

import React, { useState, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type FoundationBuilderMetrics,
} from '../../../evaluation';

/**
 * Foundation Builder - Soil/foundation simulator for K-5 engineering education
 *
 * K-5 Engineering Primitive for understanding:
 * - Buildings need foundations (K-1)
 * - Bigger footings spread weight (1-2)
 * - Different soils hold different loads (2-3)
 * - Pressure = force ÷ area (3-4)
 * - Foundation design for soil types (4-5)
 *
 * Real-world connections: building foundations, soil types, pressure distribution
 *
 * EVALUATION INTEGRATION:
 * - Tracks footing design, testing strategies, and load performance
 * - Submits evaluation metrics on test completion
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

export type SoilType = 'rock' | 'gravel' | 'sand' | 'clay' | 'mud';
export type FoundationType = 'spread' | 'strip' | 'slab' | 'piles';
export type StructureMaterial = 'wood' | 'brick' | 'concrete' | 'steel';

export interface FoundationBuilderData {
  title: string;
  description: string;
  soilType: SoilType;

  // Structure specifications (what the engineer is given)
  structureType: string; // e.g., "house", "apartment building", "warehouse"
  structureMaterial: StructureMaterial; // Material affects weight density
  structureFootprint: number; // Building base area in m² (e.g., 10m x 10m = 100 m²)
  structureStories: number; // Number of floors

  // Optional challenges
  targetFoundationType?: FoundationType; // Optional: must use specific foundation type
  showPressure: boolean; // Display force/area calculation
  showSettlement: boolean; // Animate sinking
  designMode: boolean; // Allow custom footing shapes
  hint?: string;

  // Evaluation integration (optional)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<FoundationBuilderMetrics>) => void;
}

interface FoundationBuilderProps {
  data: FoundationBuilderData;
  className?: string;
}

// Soil bearing capacity (kN/m²)
const SOIL_CAPACITY: Record<SoilType, number> = {
  rock: 500,
  gravel: 200,
  sand: 100,
  clay: 75,
  mud: 30,
};

// Soil colors
const SOIL_COLORS: Record<SoilType, string> = {
  rock: '#78716c',
  gravel: '#a8a29e',
  sand: '#fbbf24',
  clay: '#b45309',
  mud: '#78350f',
};

// Material density (kN per m² per story)
// Represents the dead load (weight) per floor area per story
const MATERIAL_DENSITY: Record<StructureMaterial, number> = {
  wood: 1.5,      // Light wooden construction (~1.5 kN/m² per floor)
  brick: 3.0,     // Brick/masonry construction (~3 kN/m² per floor)
  concrete: 5.0,  // Reinforced concrete (~5 kN/m² per floor)
  steel: 4.0,     // Steel frame (~4 kN/m² per floor)
};

const FoundationBuilder: React.FC<FoundationBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    soilType,
    structureType,
    structureMaterial,
    structureFootprint,
    structureStories,
    targetFoundationType,
    showPressure = true,
    showSettlement = true,
    designMode = true,
    hint,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [foundationType, setFoundationType] = useState<FoundationType>(targetFoundationType || 'spread');
  const [footingWidth, setFootingWidth] = useState<number>(2); // meters
  const [footingLength, setFootingLength] = useState<number>(2); // meters
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: boolean; settlement: number; pressure: number } | null>(null);
  const [testHistory, setTestHistory] = useState<Array<{ foundationType: FoundationType; area: number; pressure: number; passed: boolean }>>([]);
  const [hintMessage, setHintMessage] = useState<string | null>(hint || null);

  const soilCapacity = SOIL_CAPACITY[soilType];
  const soilColor = SOIL_COLORS[soilType];

  // Calculate building load from structure specifications
  // Load = Material Density (kN/m² per story) × Footprint Area (m²) × Number of Stories
  const calculateBuildingLoad = useCallback((): number => {
    const materialDensity = MATERIAL_DENSITY[structureMaterial];
    return materialDensity * structureFootprint * structureStories;
  }, [structureMaterial, structureFootprint, structureStories]);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<FoundationBuilderMetrics>({
    primitiveType: 'foundation-builder',
    instanceId: instanceId || `foundation-builder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Calculate building load from structure specifications
  const buildingLoad = calculateBuildingLoad();

  // Calculate footing area
  const footingArea = useCallback((): number => {
    if (foundationType === 'spread') {
      return footingWidth * footingLength;
    } else if (foundationType === 'strip') {
      return footingWidth * footingLength; // Simplified strip
    } else if (foundationType === 'slab') {
      return footingWidth * footingLength * 1.5; // Larger slab
    } else {
      // Piles - multiple small footings
      const pileCount = Math.max(4, Math.ceil(buildingLoad / 50));
      return pileCount * 0.25; // Each pile 0.5m x 0.5m
    }
  }, [foundationType, footingWidth, footingLength, buildingLoad]);

  // Calculate pressure on soil
  const calculatePressure = useCallback((): number => {
    const area = footingArea();
    if (area === 0) return Infinity;
    return buildingLoad / area;
  }, [buildingLoad, footingArea]);

  // Check if foundation passes
  const checkFoundation = useCallback((): { passed: boolean; settlement: number; pressure: number } => {
    const pressure = calculatePressure();
    const passed = pressure <= soilCapacity;
    const settlement = passed ? 0 : Math.min(50, (pressure - soilCapacity) / soilCapacity * 100);
    return { passed, settlement, pressure };
  }, [calculatePressure, soilCapacity]);

  // Run foundation test
  const runTest = useCallback(async () => {
    setIsTesting(true);
    setHintMessage(null);

    // Simulate testing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = checkFoundation();
    setTestResult(result);
    setTestHistory([...testHistory, {
      foundationType,
      area: footingArea(),
      pressure: result.pressure,
      passed: result.passed,
    }]);

    // Generate feedback
    if (result.passed) {
      setHintMessage(`✓ Success! Foundation holds ${buildingLoad.toFixed(0)} kN with ${result.pressure.toFixed(1)} kN/m² pressure (soil capacity: ${soilCapacity} kN/m²)`);
    } else {
      const neededArea = buildingLoad / soilCapacity;
      setHintMessage(`❌ Failed! Too much pressure: ${result.pressure.toFixed(1)} kN/m² exceeds soil capacity of ${soilCapacity} kN/m². Try increasing footing area to at least ${neededArea.toFixed(1)} m².`);
    }

    setIsTesting(false);
  }, [checkFoundation, footingArea, foundationType, testHistory, soilCapacity, buildingLoad]);

  // Reset design
  const resetDesign = () => {
    setFootingWidth(2);
    setFootingLength(2);
    setTestResult(null);
    setHintMessage(hint || null);
  };

  // Submit evaluation
  const handleSubmitEvaluation = () => {
    if (hasSubmittedEvaluation || !testResult) return;

    const successfulTests = testHistory.filter(t => t.passed).length;
    const pressure = calculatePressure();
    const area = footingArea();
    const safetyFactor = testResult.passed ? soilCapacity / pressure : 0;

    // Check if target goals met
    const foundationTypeGoalMet = targetFoundationType ? foundationType === targetFoundationType : true;
    const optimalArea = buildingLoad / soilCapacity;
    const areaEfficiency = Math.abs(area - optimalArea) / optimalArea;
    const efficientDesign = areaEfficiency <= 0.3; // Within 30% of optimal

    const score =
      (testResult.passed ? 40 : 0) +
      (foundationTypeGoalMet ? 20 : 0) +
      (efficientDesign ? 20 : 0) +
      (successfulTests > 0 ? 10 : 0) +
      (testHistory.length <= 3 ? 10 : Math.max(0, 10 - testHistory.length));

    const metrics: FoundationBuilderMetrics = {
      type: 'foundation-builder',
      soilType,
      buildingLoad,
      footingArea: area,
      pressure,
      soilCapacity,
      foundationPassed: testResult.passed,
      settlementAmount: testResult.settlement,
      safetyFactor,
      foundationType,
      designsAttempted: testHistory.length,
      successfulDesigns: successfulTests,
      targetHeightMet: true, // No longer applicable
      targetAreaMet: efficientDesign,
      efficiency: areaEfficiency,
    };

    submitEvaluation(testResult.passed && foundationTypeGoalMet && efficientDesign, Math.min(100, score), metrics, {
      footingWidth,
      footingLength,
      foundationType,
    });
  };

  const currentPressure = calculatePressure();
  const currentArea = footingArea();
  const optimalArea = buildingLoad / soilCapacity;

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
          <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">
              Foundation Engineering Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-orange-500/20 relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-3xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Challenge Info */}
          <div className={`mb-4 p-4 rounded-xl border ${
            testResult?.passed ? 'bg-green-500/20 border-green-500/50' : 'bg-orange-500/20 border-orange-500/50'
          }`}>
            <div className="flex flex-wrap items-center gap-3 justify-center text-sm">
              <span className="font-semibold text-white">Challenge:</span>
              <span className="text-slate-300">Soil: {soilType} ({soilCapacity} kN/m²)</span>
              <span className="text-slate-300">• Structure: {structureType} ({structureMaterial}, {structureStories} stories)</span>
              <span className="text-slate-300">• Load: {buildingLoad.toFixed(0)} kN</span>
              {targetFoundationType && <span className="text-slate-300">• Required: {targetFoundationType} foundation</span>}
              {testResult?.passed && <span className="text-green-300">✓ Foundation holds!</span>}
            </div>
          </div>

          {/* Status Bar */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-sm font-mono">
                Footing: <span className="text-orange-300">{currentArea.toFixed(1)} m²</span>
              </span>
            </div>

            {showPressure && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                currentPressure <= soilCapacity ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
              }`}>
                <span className="text-sm font-mono">
                  Pressure: <span className={currentPressure <= soilCapacity ? 'text-green-300' : 'text-red-300'}>
                    {currentPressure.toFixed(1)} kN/m²
                  </span>
                </span>
              </div>
            )}

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
              <span className="text-sm font-mono">
                Tests: <span className="text-blue-300">{testHistory.length}</span>
              </span>
            </div>
          </div>

          {/* Visualization */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50 p-6">
            <svg
              viewBox="0 0 400 300"
              className="w-full h-auto"
              style={{ maxHeight: '400px' }}
            >
              <defs>
                <linearGradient id="soilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={soilColor} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={soilColor} stopOpacity="1" />
                </linearGradient>
                <pattern id="soilPattern" patternUnits="userSpaceOnUse" width="10" height="10">
                  <circle cx="5" cy="5" r="1.5" fill="#ffffff" opacity="0.2" />
                </pattern>
              </defs>

              {/* Soil */}
              <rect x={0} y={180} width={400} height={120} fill="url(#soilGradient)" />
              <rect x={0} y={180} width={400} height={120} fill="url(#soilPattern)" />

              {/* Ground line */}
              <line x1={0} y1={180} x2={400} y2={180} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5,5" />

              {/* Foundation visualization */}
              {foundationType === 'spread' && (
                <g>
                  {/* Footing */}
                  <rect
                    x={200 - (footingWidth * 10)}
                    y={180}
                    width={footingWidth * 20}
                    height={footingLength * 4}
                    fill="#6b7280"
                    stroke="#374151"
                    strokeWidth={2}
                  />
                  {/* Pressure arrows */}
                  {showPressure && Array.from({ length: 5 }).map((_, i) => (
                    <g key={i}>
                      <line
                        x1={200 - (footingWidth * 10) + (footingWidth * 20 / 5) * (i + 0.5)}
                        y1={180 + footingLength * 4}
                        x2={200 - (footingWidth * 10) + (footingWidth * 20 / 5) * (i + 0.5)}
                        y2={180 + footingLength * 4 + 20}
                        stroke={currentPressure > soilCapacity ? '#ef4444' : '#22c55e'}
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  ))}
                </g>
              )}

              {foundationType === 'strip' && (
                <g>
                  {/* Long strip foundation */}
                  <rect
                    x={200 - (footingLength * 10)}
                    y={180}
                    width={footingLength * 20}
                    height={footingWidth * 3}
                    fill="#6b7280"
                    stroke="#374151"
                    strokeWidth={2}
                  />
                  {/* Pressure arrows */}
                  {showPressure && Array.from({ length: 5 }).map((_, i) => (
                    <g key={i}>
                      <line
                        x1={200 - (footingLength * 10) + (footingLength * 20 / 5) * (i + 0.5)}
                        y1={180 + footingWidth * 3}
                        x2={200 - (footingLength * 10) + (footingLength * 20 / 5) * (i + 0.5)}
                        y2={180 + footingWidth * 3 + 20}
                        stroke={currentPressure > soilCapacity ? '#ef4444' : '#22c55e'}
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  ))}
                </g>
              )}

              {foundationType === 'slab' && (
                <g>
                  {/* Large slab foundation */}
                  <rect
                    x={200 - (footingWidth * 10)}
                    y={180}
                    width={footingWidth * 20}
                    height={footingLength * 2}
                    fill="#6b7280"
                    stroke="#374151"
                    strokeWidth={2}
                  />
                  <rect
                    x={200 - (footingWidth * 10)}
                    y={180 + footingLength * 2}
                    width={footingWidth * 20}
                    height={5}
                    fill="#4b5563"
                    opacity={0.5}
                  />
                  {/* Pressure arrows */}
                  {showPressure && Array.from({ length: 7 }).map((_, i) => (
                    <g key={i}>
                      <line
                        x1={200 - (footingWidth * 10) + (footingWidth * 20 / 7) * (i + 0.5)}
                        y1={180 + footingLength * 2 + 5}
                        x2={200 - (footingWidth * 10) + (footingWidth * 20 / 7) * (i + 0.5)}
                        y2={180 + footingLength * 2 + 25}
                        stroke={currentPressure > soilCapacity ? '#ef4444' : '#22c55e'}
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  ))}
                </g>
              )}

              {foundationType === 'piles' && (
                <g>
                  {/* Dynamic number of piles based on building load */}
                  {Array.from({ length: Math.max(4, Math.ceil(buildingLoad / 50)) }).map((_, i) => {
                    const pileCount = Math.max(4, Math.ceil(buildingLoad / 50));
                    const spacing = 120 / (pileCount + 1);
                    return (
                      <g key={i}>
                        <rect
                          x={160 + spacing * (i + 1) - 5}
                          y={180}
                          width={10}
                          height={50}
                          fill="#6b7280"
                          stroke="#374151"
                          strokeWidth={2}
                        />
                        {/* Cap on top of pile */}
                        <rect
                          x={160 + spacing * (i + 1) - 8}
                          y={175}
                          width={16}
                          height={5}
                          fill="#4b5563"
                          stroke="#374151"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })}
                  {/* Label */}
                  <text x={200} y={235} textAnchor="middle" fill="#94a3b8" fontSize="10">
                    {Math.max(4, Math.ceil(buildingLoad / 50))} piles
                  </text>
                </g>
              )}

              {/* Building */}
              <rect
                x={185}
                y={180 - structureStories * 15}
                width={30}
                height={structureStories * 15}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth={2}
              />
              {/* Windows */}
              {Array.from({ length: structureStories }).map((_, floor) => (
                <g key={floor}>
                  <rect x={190} y={180 - (floor + 1) * 15 + 5} width={5} height={5} fill="#fbbf24" opacity={0.8} />
                  <rect x={205} y={180 - (floor + 1) * 15 + 5} width={5} height={5} fill="#fbbf24" opacity={0.8} />
                </g>
              ))}

              {/* Settlement animation */}
              {showSettlement && testResult && testResult.settlement > 0 && (
                <g className="animate-bounce">
                  <text x={200} y={160} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">
                    ⚠ Settling!
                  </text>
                </g>
              )}

              {/* Arrow marker */}
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill={currentPressure > soilCapacity ? '#ef4444' : '#22c55e'} />
                </marker>
              </defs>

              {/* Labels */}
              <text x={10} y={150} fill="#94a3b8" fontSize="14" fontWeight="bold">
                {soilType.toUpperCase()}
              </text>
              <text x={10} y={165} fill="#94a3b8" fontSize="10">
                Capacity: {soilCapacity} kN/m²
              </text>
            </svg>
          </div>

          {/* Controls */}
          {designMode && (
            <div className="mb-6 space-y-4">
              {/* Foundation Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Foundation Type</label>
                <div className="flex flex-wrap justify-center gap-3">
                  {(['spread', 'strip', 'slab', 'piles'] as FoundationType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setFoundationType(type)}
                      disabled={isTesting}
                      className={`px-6 py-3 rounded-xl border transition-all capitalize ${
                        foundationType === type
                          ? 'bg-orange-500/30 border-orange-500 text-orange-300'
                          : 'bg-slate-800/40 border-slate-600 text-slate-300 hover:bg-slate-700/40'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footing Size */}
              {foundationType !== 'piles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Width: {footingWidth.toFixed(1)} m
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={footingWidth}
                      onChange={(e) => setFootingWidth(parseFloat(e.target.value))}
                      disabled={isTesting}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Length: {footingLength.toFixed(1)} m
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={footingLength}
                      onChange={(e) => setFootingLength(parseFloat(e.target.value))}
                      disabled={isTesting}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={runTest}
              disabled={isTesting}
              className="px-8 py-3 bg-orange-500/20 hover:bg-orange-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-orange-500/50 text-orange-300 rounded-xl font-semibold transition-all flex items-center gap-2"
            >
              <span>🏗️</span>
              {isTesting ? 'Testing...' : 'Test Foundation'}
            </button>

            {testResult && (
              <>
                <button
                  onClick={resetDesign}
                  className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                >
                  <span>🔄</span> Redesign
                </button>

                {testResult.passed && !hasSubmittedEvaluation && (
                  <button
                    onClick={handleSubmitEvaluation}
                    className="px-8 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                  >
                    <span>✓</span> Submit Results
                  </button>
                )}
              </>
            )}
          </div>

          {/* Hint */}
          {hintMessage && (
            <div className={`mt-6 p-4 backdrop-blur-sm border rounded-xl animate-fade-in ${
              testResult?.passed
                ? 'bg-green-500/10 border-green-500/30'
                : testResult
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-orange-500/10 border-orange-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg">{testResult?.passed ? '✓' : testResult ? '❌' : '💡'}</span>
                <p className={`text-sm ${
                  testResult?.passed
                    ? 'text-green-200'
                    : testResult
                      ? 'text-red-200'
                      : 'text-orange-200'
                }`}>{hintMessage}</p>
              </div>
            </div>
          )}

          {/* Educational Info */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Engineering Guidelines
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-orange-400 font-semibold">Structure:</span> {structureType} • {structureMaterial} • {structureFootprint} m² footprint • {structureStories} stories
              </p>
              <p className="text-slate-300">
                <span className="text-blue-400 font-semibold">Building Load:</span> {buildingLoad.toFixed(0)} kN (calculated from material density × footprint × stories)
              </p>
              <p className="text-slate-300">
                <span className="text-green-400 font-semibold">Soil Capacity:</span> {soilType} can support {soilCapacity} kN/m² pressure
              </p>
              <p className="text-slate-300">
                <span className="text-purple-400 font-semibold">Minimum Foundation Area:</span> {optimalArea.toFixed(1)} m² (Load ÷ Soil Capacity = {buildingLoad.toFixed(0)} ÷ {soilCapacity})
              </p>
              <p className="text-slate-300">
                <span className="text-cyan-400 font-semibold">Your Task:</span> Design a foundation that keeps pressure below {soilCapacity} kN/m²!
              </p>
            </div>
          </div>

          {/* Breakeven Analysis Graphs */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Breakeven Analysis
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Graph 1: Pressure vs Foundation Area */}
              <div>
                <h5 className="text-slate-300 text-sm font-semibold mb-2">Pressure vs Foundation Area</h5>
                <svg viewBox="0 0 300 200" className="w-full h-auto bg-slate-900/50 rounded-lg">
                  {/* Axes */}
                  <line x1={40} y1={160} x2={280} y2={160} stroke="#475569" strokeWidth={2} />
                  <line x1={40} y1={20} x2={40} y2={160} stroke="#475569" strokeWidth={2} />

                  {/* Labels */}
                  <text x={160} y={185} textAnchor="middle" fill="#94a3b8" fontSize="10">Foundation Area (m²)</text>
                  <text x={20} y={90} textAnchor="middle" fill="#94a3b8" fontSize="10" transform="rotate(-90, 20, 90)">Pressure (kN/m²)</text>

                  {/* Soil capacity line (horizontal) */}
                  <line
                    x1={40}
                    y1={160 - (soilCapacity / (soilCapacity * 2)) * 140}
                    x2={280}
                    y2={160 - (soilCapacity / (soilCapacity * 2)) * 140}
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                  <text
                    x={285}
                    y={160 - (soilCapacity / (soilCapacity * 2)) * 140 + 4}
                    fill="#22c55e"
                    fontSize="9"
                  >
                    Capacity
                  </text>

                  {/* Pressure curve (hyperbolic: Pressure = Load / Area) */}
                  {(() => {
                    const points: string[] = [];
                    const maxArea = Math.max(20, optimalArea * 2);
                    for (let area = 1; area <= maxArea; area += 0.5) {
                      const pressure = buildingLoad / area;
                      const x = 40 + (area / maxArea) * 240;
                      const y = 160 - Math.min(140, (pressure / (soilCapacity * 2)) * 140);
                      points.push(`${x},${y}`);
                    }
                    return (
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth={2}
                      />
                    );
                  })()}

                  {/* Current design point */}
                  <circle
                    cx={40 + (currentArea / Math.max(20, optimalArea * 2)) * 240}
                    cy={160 - Math.min(140, (currentPressure / (soilCapacity * 2)) * 140)}
                    r={4}
                    fill={currentPressure <= soilCapacity ? '#22c55e' : '#ef4444'}
                    stroke="white"
                    strokeWidth={2}
                  />

                  {/* Optimal area vertical line */}
                  <line
                    x1={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y1={20}
                    x2={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y2={160}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y={15}
                    textAnchor="middle"
                    fill="#3b82f6"
                    fontSize="9"
                  >
                    Breakeven
                  </text>

                  {/* Y-axis labels */}
                  <text x={35} y={164} textAnchor="end" fill="#94a3b8" fontSize="8">0</text>
                  <text x={35} y={164 - 70} textAnchor="end" fill="#94a3b8" fontSize="8">{soilCapacity}</text>
                  <text x={35} y={24} textAnchor="end" fill="#94a3b8" fontSize="8">{soilCapacity * 2}</text>

                  {/* X-axis labels */}
                  <text x={40} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">0</text>
                  <text x={160} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">{(Math.max(20, optimalArea * 2) / 2).toFixed(0)}</text>
                  <text x={280} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">{Math.max(20, optimalArea * 2).toFixed(0)}</text>
                </svg>
                <p className="text-xs text-slate-400 mt-2">
                  As foundation area increases, pressure decreases (P = Load/Area). Breakeven at {optimalArea.toFixed(1)} m².
                </p>
              </div>

              {/* Graph 2: Safety Factor vs Foundation Area */}
              <div>
                <h5 className="text-slate-300 text-sm font-semibold mb-2">Safety Factor vs Foundation Area</h5>
                <svg viewBox="0 0 300 200" className="w-full h-auto bg-slate-900/50 rounded-lg">
                  {/* Axes */}
                  <line x1={40} y1={160} x2={280} y2={160} stroke="#475569" strokeWidth={2} />
                  <line x1={40} y1={20} x2={40} y2={160} stroke="#475569" strokeWidth={2} />

                  {/* Labels */}
                  <text x={160} y={185} textAnchor="middle" fill="#94a3b8" fontSize="10">Foundation Area (m²)</text>
                  <text x={20} y={90} textAnchor="middle" fill="#94a3b8" fontSize="10" transform="rotate(-90, 20, 90)">Safety Factor</text>

                  {/* Safety factor = 1.0 line */}
                  <line
                    x1={40}
                    y1={160 - (1.0 / 3.0) * 140}
                    x2={280}
                    y2={160 - (1.0 / 3.0) * 140}
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                  <text
                    x={285}
                    y={160 - (1.0 / 3.0) * 140 + 4}
                    fill="#22c55e"
                    fontSize="9"
                  >
                    SF=1.0
                  </text>

                  {/* Safety factor curve (linear: SF = Capacity / Pressure = Capacity * Area / Load) */}
                  {(() => {
                    const points: string[] = [];
                    const maxArea = Math.max(20, optimalArea * 2);
                    for (let area = 1; area <= maxArea; area += 0.5) {
                      const pressure = buildingLoad / area;
                      const safetyFactor = soilCapacity / pressure;
                      const x = 40 + (area / maxArea) * 240;
                      const y = 160 - Math.min(140, (safetyFactor / 3.0) * 140);
                      points.push(`${x},${y}`);
                    }
                    return (
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth={2}
                      />
                    );
                  })()}

                  {/* Current design point */}
                  {(() => {
                    const safetyFactor = currentPressure > 0 ? soilCapacity / currentPressure : 0;
                    return (
                      <circle
                        cx={40 + (currentArea / Math.max(20, optimalArea * 2)) * 240}
                        cy={160 - Math.min(140, (safetyFactor / 3.0) * 140)}
                        r={4}
                        fill={safetyFactor >= 1.0 ? '#22c55e' : '#ef4444'}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  })()}

                  {/* Optimal area vertical line */}
                  <line
                    x1={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y1={20}
                    x2={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y2={160}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={40 + (optimalArea / Math.max(20, optimalArea * 2)) * 240}
                    y={15}
                    textAnchor="middle"
                    fill="#3b82f6"
                    fontSize="9"
                  >
                    Breakeven
                  </text>

                  {/* Y-axis labels */}
                  <text x={35} y={164} textAnchor="end" fill="#94a3b8" fontSize="8">0</text>
                  <text x={35} y={164 - 46.7} textAnchor="end" fill="#94a3b8" fontSize="8">1.0</text>
                  <text x={35} y={164 - 93.3} textAnchor="end" fill="#94a3b8" fontSize="8">2.0</text>
                  <text x={35} y={24} textAnchor="end" fill="#94a3b8" fontSize="8">3.0</text>

                  {/* X-axis labels */}
                  <text x={40} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">0</text>
                  <text x={160} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">{(Math.max(20, optimalArea * 2) / 2).toFixed(0)}</text>
                  <text x={280} y={175} textAnchor="middle" fill="#94a3b8" fontSize="8">{Math.max(20, optimalArea * 2).toFixed(0)}</text>
                </svg>
                <p className="text-xs text-slate-400 mt-2">
                  Safety Factor = Soil Capacity ÷ Pressure. SF ≥ 1.0 means safe. Higher is better (typical: 2.0-3.0).
                </p>
              </div>
            </div>

            {/* Key Insights */}
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-200">
                <span className="font-semibold">💡 Engineering Insight:</span> The breakeven point ({optimalArea.toFixed(1)} m²) is where pressure exactly equals soil capacity.
                Going smaller = failure. Going larger = safer but more expensive. Real engineers target Safety Factor of 2.0-3.0.
              </p>
            </div>
          </div>

          {/* Test History */}
          {testHistory.length > 0 && (
            <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Test History
              </h4>
              <div className="space-y-2 text-sm">
                {testHistory.map((test, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 capitalize">Test {i + 1}: {test.foundationType}</span>
                      <span className="text-slate-500">• {test.area.toFixed(1)} m²</span>
                      <span className="text-slate-500">• {test.pressure.toFixed(1)} kN/m²</span>
                    </div>
                    <span className={test.passed ? 'text-green-400' : 'text-red-400'}>
                      {test.passed ? '✓ Passed' : '❌ Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoundationBuilder;