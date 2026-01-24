'use client';

import React, { useState } from 'react';
import {
  usePrimitiveEvaluation,
  type FractionBarMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';

export interface FractionBarData {
  title: string;
  description: string;
  partitions: number; // Number of equal parts (denominator)
  shaded: number; // Number of shaded parts (numerator)
  barCount: number; // Number of stacked bars
  showLabels?: boolean; // Display fraction notation
  allowPartitionEdit?: boolean; // Student can change denominator
  showEquivalentLines?: boolean; // Draw alignment guides

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  targetFraction?: string;        // e.g., "3/4" for goal-based tasks
  taskType?: 'build' | 'compare' | 'explore';  // What they should do
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FractionBarMetrics>) => void;
}

interface FractionBarProps {
  data: FractionBarData;
  className?: string;
}

const FractionBar: React.FC<FractionBarProps> = ({ data, className }) => {
  const {
    partitions: initialPartitions = 4,
    shaded: initialShaded,
    barCount = 1,
    showLabels = true,
    allowPartitionEdit = false,
    showEquivalentLines = false,
    // Evaluation props
    targetFraction,
    taskType = 'explore',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Determine initial shaded value based on task type and target
  // For 'build' tasks with a target, start with blank (0)
  // For 'explore' or when no target is provided, use provided value or default to 1
  const defaultShaded = (taskType === 'build' && targetFraction) ? 0 : 1;
  const shadedValue = initialShaded !== undefined ? initialShaded : defaultShaded;

  // State for each bar's configuration
  const [bars, setBars] = useState<Array<{ partitions: number; shaded: number }>>(
    Array.from({ length: barCount }, () => ({
      partitions: initialPartitions,
      shaded: shadedValue,
    }))
  );

  // Track interaction metrics
  const [partitionChangeCount, setPartitionChangeCount] = useState(0);
  const [shadingChangeCount, setShadingChangeCount] = useState(0);

  // Evaluation hook - tracks timing and handles submission
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<FractionBarMetrics>({
    primitiveType: 'fraction-bar',
    instanceId: instanceId || `fraction-bar-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Handle partition change for a specific bar
  const handlePartitionChange = (barIndex: number, newPartitions: number) => {
    if (!allowPartitionEdit) return;
    const validPartitions = Math.max(1, Math.min(24, newPartitions)); // Limit to 1-24
    setBars((prev) =>
      prev.map((bar, idx) =>
        idx === barIndex
          ? { ...bar, partitions: validPartitions, shaded: Math.min(bar.shaded, validPartitions) }
          : bar
      )
    );
    setPartitionChangeCount((prev) => prev + 1);
  };

  // Handle shading toggle for a specific partition in a specific bar
  const togglePartition = (barIndex: number, partitionIndex: number) => {
    setBars((prev) =>
      prev.map((bar, idx) => {
        if (idx !== barIndex) return bar;

        const isCurrentlyShaded = partitionIndex < bar.shaded;

        if (isCurrentlyShaded) {
          // If clicking a shaded partition, unshade from that point onwards
          return { ...bar, shaded: partitionIndex };
        } else {
          // If clicking an unshaded partition, shade up to and including it
          return { ...bar, shaded: partitionIndex + 1 };
        }
      })
    );
    setShadingChangeCount((prev) => prev + 1);
  };

  // Simplify fraction
  const simplifyFraction = (numerator: number, denominator: number): { num: number; den: number } => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(numerator, denominator);
    return { num: numerator / divisor, den: denominator / divisor };
  };

  // Handle evaluation submission
  const handleSubmit = () => {
    if (hasSubmitted) return;

    // Calculate metrics from current state
    const primaryBar = bars[0]; // Use first bar for single-bar scenarios
    const selectedFraction = `${primaryBar.shaded}/${primaryBar.partitions}`;
    const simplified = simplifyFraction(primaryBar.shaded, primaryBar.partitions);
    const simplifiedFraction = `${simplified.num}/${simplified.den}`;

    // Determine success
    let isCorrect = true;
    if (targetFraction) {
      // Parse target (e.g., "3/4" -> {num: 3, den: 4})
      const [targetNum, targetDen] = targetFraction.split('/').map(Number);
      const targetSimplified = simplifyFraction(targetNum, targetDen);
      isCorrect =
        simplified.num === targetSimplified.num && simplified.den === targetSimplified.den;
    }

    // Calculate score based on task type
    let score = 0;
    if (taskType === 'build') {
      // For build tasks: correct answer gets 100, incorrect gets 0
      score = isCorrect ? 100 : 0;
    } else if (taskType === 'explore') {
      // For exploration tasks: score based on engagement (not correctness)
      score = Math.min(100, (shadingChangeCount + partitionChangeCount) * 10);
    } else if (taskType === 'compare') {
      // For comparison tasks: score based on correct comparison
      score = isCorrect ? 100 : 0;
    } else {
      // Default: correctness-based scoring
      score = isCorrect ? 100 : 0;
    }

    const metrics: FractionBarMetrics = {
      type: 'fraction-bar',
      targetFraction: targetFraction || 'none',
      selectedFraction,
      isCorrect,
      numerator: primaryBar.shaded,
      denominator: primaryBar.partitions,
      decimalValue: primaryBar.shaded / primaryBar.partitions,
      simplifiedFraction,
      recognizedEquivalence: selectedFraction !== simplifiedFraction,
      partitionChanges: partitionChangeCount,
      shadingChanges: shadingChangeCount,
      finalBarStates: bars.map((bar) => ({
        partitions: bar.partitions,
        shaded: bar.shaded,
      })),
      barsCompared: barCount,
    };

    submitResult(isCorrect, score, metrics, {
      bars: [...bars],
    });
  };

  // Handle reset
  const handleReset = () => {
    setBars(
      Array.from({ length: barCount }, () => ({
        partitions: initialPartitions,
        shaded: shadedValue,
      }))
    );
    setPartitionChangeCount(0);
    setShadingChangeCount(0);
    resetAttempt();
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Fraction Bar</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Visual Fraction Model</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Fraction Bars */}
          <div className="space-y-6">
            {bars.map((bar, barIndex) => {
              const simplified = simplifyFraction(bar.shaded, bar.partitions);
              const isSimplified = simplified.num === bar.shaded && simplified.den === bar.partitions;

              return (
                <div key={barIndex} className="relative">
                  {/* Bar Label */}
                  {showLabels && (
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-white font-mono">
                          <span className="text-purple-300">{bar.shaded}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-blue-300">{bar.partitions}</span>
                        </div>
                        {!isSimplified && (
                          <div className="text-sm text-slate-400">
                            = <span className="text-purple-200 font-mono">{simplified.num}/{simplified.den}</span>
                          </div>
                        )}
                      </div>
                      {allowPartitionEdit && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 uppercase tracking-wide">Partitions:</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={bar.partitions}
                            onChange={(e) => handlePartitionChange(barIndex, parseInt(e.target.value) || 1)}
                            className="w-16 bg-slate-800/50 border border-slate-600 rounded px-2 py-1 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* The Bar */}
                  <div className="relative">
                    {/* Equivalent lines (alignment guides) */}
                    {showEquivalentLines && barIndex > 0 && (
                      <div className="absolute -top-3 left-0 right-0 h-0.5 bg-yellow-500/30"></div>
                    )}

                    <div className="flex border-2 border-slate-600 rounded-lg overflow-hidden bg-slate-800/30 h-16 shadow-lg">
                      {Array.from({ length: bar.partitions }).map((_, partitionIndex) => {
                        const isShaded = partitionIndex < bar.shaded;
                        return (
                          <button
                            key={partitionIndex}
                            onClick={() => togglePartition(barIndex, partitionIndex)}
                            className={`flex-1 border-r border-slate-600 last:border-r-0 transition-all duration-200 cursor-pointer hover:brightness-110 ${
                              isShaded
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                : 'bg-slate-700/50 hover:bg-slate-700'
                            }`}
                            title={`${isShaded ? 'Unshade' : 'Shade'} partition ${partitionIndex + 1}`}
                          >
                            {/* Partition index (optional, for educational purposes) */}
                            {bar.partitions <= 12 && (
                              <span className="text-xs text-white/40 font-mono m-auto">
                                {partitionIndex + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Decimal representation */}
                  {showLabels && (
                    <div className="mt-2 text-xs text-slate-400 text-right font-mono">
                      ≈ {(bar.shaded / bar.partitions).toFixed(3)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit/Reset Controls */}
          {(instanceId || onEvaluationSubmit) && (
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={handleSubmit}
                disabled={hasSubmitted}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  hasSubmitted
                    ? 'bg-green-500/20 border border-green-500/50 text-green-300 cursor-not-allowed'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]'
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
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              Interactive Controls
            </h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">▸</span>
                <span>Click on any partition to shade or unshade parts of the bar</span>
              </li>
              {allowPartitionEdit && (
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">▸</span>
                  <span>Adjust the number of partitions using the input field</span>
                </li>
              )}
              {barCount > 1 && (
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">▸</span>
                  <span>Compare fractions by observing the shaded portions across bars</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FractionBar;
