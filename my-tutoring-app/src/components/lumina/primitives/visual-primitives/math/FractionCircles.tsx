'use client';

import React, { useState } from 'react';
import {
  usePrimitiveEvaluation,
  type FractionCirclesMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';

export interface FractionCirclesData {
  title: string;
  description: string;
  fractions: { numerator: number; denominator: number; label?: string }[];

  // NEW: Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  targetFraction?: string;        // e.g., "3/4" for goal-based tasks
  taskType?: 'identify' | 'build' | 'compare' | 'explore';
  allowInteraction?: boolean;     // Enable click to shade/unshade sections
  showMultipleCircles?: boolean;  // Show comparison circles alongside the main one
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FractionCirclesMetrics>) => void;
}

interface FractionCirclesProps {
  data: FractionCirclesData;
  className?: string;
}

const FractionCircles: React.FC<FractionCirclesProps> = ({ data, className }) => {
  const {
    targetFraction,
    taskType = 'explore',
    allowInteraction = false,
    showMultipleCircles = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Interactive state - track which sections are shaded for the first circle
  const [shadedSections, setShadedSections] = useState<number>(
    data.fractions[0]?.numerator || 0
  );
  const [totalSections] = useState<number>(
    data.fractions[0]?.denominator || 4
  );

  // Track exploration - all fractions the student has created
  const [exploredFractions, setExploredFractions] = useState<string[]>([]);
  const [clickCount, setClickCount] = useState(0);

  // Evaluation hook - tracks timing and handles submission
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<FractionCirclesMetrics>({
    primitiveType: 'fraction-circles',
    instanceId: instanceId || `fraction-circles-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Simplify fraction for equivalence checking
  const simplifyFraction = (numerator: number, denominator: number): { num: number; den: number } => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(numerator, denominator);
    return { num: numerator / divisor, den: denominator / divisor };
  };

  // Check if two fractions are equivalent
  const areEquivalent = (frac1: string, frac2: string): boolean => {
    const [num1, den1] = frac1.split('/').map(Number);
    const [num2, den2] = frac2.split('/').map(Number);
    const simplified1 = simplifyFraction(num1, den1);
    const simplified2 = simplifyFraction(num2, den2);
    return simplified1.num === simplified2.num && simplified1.den === simplified2.den;
  };

  // Handle clicking on a section to toggle shading
  const handleSectionClick = (sectionIndex: number) => {
    if (!allowInteraction || hasSubmitted) return;

    setClickCount(prev => prev + 1);

    // Toggle behavior: clicking fills up to and including that section
    const newShaded = sectionIndex < shadedSections ? sectionIndex : sectionIndex + 1;
    setShadedSections(newShaded);

    // Track this fraction in exploration history
    const newFraction = `${newShaded}/${totalSections}`;
    if (!exploredFractions.includes(newFraction)) {
      setExploredFractions(prev => [...prev, newFraction]);
    }
  };

  // Handle evaluation submission
  const handleSubmit = () => {
    if (hasSubmitted) return;

    const selectedFraction = `${shadedSections}/${totalSections}`;

    // Determine correctness
    let isCorrect = true;
    if (targetFraction) {
      isCorrect = areEquivalent(selectedFraction, targetFraction);
    }

    // Calculate score
    let score = isCorrect ? 100 : 0;
    if (taskType === 'explore') {
      // For exploration, reward engagement and discovering equivalents
      const explorationScore = Math.min(50, exploredFractions.length * 10);
      const equivalentsFound = exploredFractions.filter(f =>
        targetFraction ? areEquivalent(f, targetFraction) : false
      ).length;
      score = explorationScore + (equivalentsFound > 0 ? 50 : 0);
    }

    // Check if student understood equivalence
    const understoodEquivalence = targetFraction
      ? exploredFractions.some(f => f !== targetFraction && areEquivalent(f, targetFraction))
      : exploredFractions.length > 1;

    const metrics: FractionCirclesMetrics = {
      type: 'fraction-circles',
      targetFraction: targetFraction || 'none',
      selectedFraction,
      isCorrect,
      equivalentFormsExplored: exploredFractions,
      understoodEquivalence,
    };

    submitResult(isCorrect, score, metrics, {
      finalNumerator: shadedSections,
      finalDenominator: totalSections,
      clickCount,
      explorationPath: exploredFractions,
    });
  };

  // Handle reset
  const handleReset = () => {
    setShadedSections(data.fractions[0]?.numerator || 0);
    setExploredFractions([]);
    setClickCount(0);
    resetAttempt();
  };

  // Render a single circle (either interactive or static)
  const renderCircle = (
    numerator: number,
    denominator: number,
    label: string | undefined,
    isInteractive: boolean,
    size: 'small' | 'large' = 'large'
  ) => {
    const percentage = (numerator / denominator) * 100;
    const sizeClass = size === 'large' ? 'w-40 h-40' : 'w-32 h-32';

    return (
      <div className="flex flex-col items-center gap-3">
        <div className={`relative ${sizeClass} rounded-full bg-slate-800 border-4 ${isInteractive ? 'border-emerald-500' : 'border-slate-700'} overflow-hidden ${isInteractive ? 'ring-2 ring-emerald-500/50' : ''}`}>
          {/* Shaded sections using conic gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: `conic-gradient(#3b82f6 0% ${percentage}%, transparent ${percentage}% 100%)`
            }}
          ></div>

          {/* Interactive clickable sections */}
          {isInteractive ? (
            <svg className="absolute inset-0 w-full h-full" viewBox="-1 -1 2 2">
              {Array.from({length: denominator}).map((_, i) => {
                const startAngle = (i * 360) / denominator - 90;
                const endAngle = ((i + 1) * 360) / denominator - 90;

                // Create SVG path for pie slice
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const x1 = Math.cos(startRad);
                const y1 = Math.sin(startRad);
                const x2 = Math.cos(endRad);
                const y2 = Math.sin(endRad);

                const pathData = `M 0 0 L ${x1} ${y1} A 1 1 0 0 1 ${x2} ${y2} Z`;

                return (
                  <g key={i}>
                    <path
                      d={pathData}
                      fill="transparent"
                      className="cursor-pointer hover:fill-emerald-500/20 transition-all"
                      onClick={() => handleSectionClick(i)}
                    />
                    <title>{`Click to ${i < numerator ? 'unshade' : 'shade'} section ${i + 1}`}</title>
                  </g>
                );
              })}
            </svg>
          ) : null}

          {/* Grid lines */}
          {Array.from({length: denominator}).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-px bg-slate-900 top-1/2 left-0 origin-center pointer-events-none"
              style={{ transform: `rotate(${(360/denominator) * i}deg)` }}
            ></div>
          ))}
        </div>

        <div className="text-center">
          <span className={`text-xl font-bold ${isInteractive ? 'text-emerald-300' : 'text-white'}`}>
            {numerator}/{denominator}
          </span>
          {label && <p className="text-xs text-slate-400">{label}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Fraction Circles</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Fractional Parts</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-emerald-500/20 relative overflow-hidden flex flex-col items-center">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="mb-12 text-center max-w-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
            {targetFraction && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-emerald-300">
                  🎯 <strong>Goal:</strong> Create the fraction <span className="font-mono text-lg">{targetFraction}</span>
                </p>
              </div>
            )}
          </div>

          {/* Fraction Circles Visualization */}
          <div className="flex flex-wrap justify-center gap-8 mb-8">
            {/* Interactive circle (first one) */}
            {allowInteraction && data.fractions[0] && (
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs text-emerald-400 font-mono uppercase tracking-wider">
                  ✨ Click sections to build
                </div>
                {renderCircle(
                  shadedSections,
                  totalSections,
                  'Your Fraction',
                  true,
                  'large'
                )}
              </div>
            )}

            {/* Reference circles (remaining ones, or all if not interactive) */}
            {(allowInteraction && showMultipleCircles
              ? data.fractions.slice(1)
              : !allowInteraction ? data.fractions : []
            ).map((frac, idx) => (
              <div key={idx}>
                {renderCircle(frac.numerator, frac.denominator, frac.label, false, 'small')}
              </div>
            ))}
          </div>

          {/* Exploration Feedback */}
          {allowInteraction && exploredFractions.length > 0 && (
            <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700 max-w-2xl">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-2">
                🔍 Fractions Explored
              </h4>
              <div className="flex flex-wrap gap-2">
                {exploredFractions.map((frac, idx) => {
                  const isEquivalentToTarget = targetFraction && areEquivalent(frac, targetFraction);
                  return (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-lg font-mono text-sm ${
                        isEquivalentToTarget
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {frac}
                      {isEquivalentToTarget && ' ✓'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit/Reset Controls */}
          {(instanceId || onEvaluationSubmit) && allowInteraction && (
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={handleSubmit}
                disabled={hasSubmitted}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  hasSubmitted
                    ? 'bg-green-500/20 border border-green-500/50 text-green-300 cursor-not-allowed'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                }`}
              >
                {hasSubmitted ? (
                  <>
                    <span>✓</span>
                    <span>Submitted</span>
                  </>
                ) : (
                  <>
                    <span>📊</span>
                    <span>Submit Answer</span>
                  </>
                )}
              </button>

              {hasSubmitted && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
                >
                  <span>↺</span>
                  <span>Try Again</span>
                </button>
              )}
            </div>
          )}

          {/* Instructions */}
          {allowInteraction && (
            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700 max-w-2xl">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
                Interactive Controls
              </h4>
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">▸</span>
                  <span>Click on any section of the circle to shade or unshade it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">▸</span>
                  <span>Try building different fractions to explore equivalence</span>
                </li>
                {targetFraction && (
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">▸</span>
                    <span>Match the target fraction shown above to complete the task</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FractionCircles;
