'use client';

import React, { useState } from 'react';

export interface RatioTableData {
  title: string;
  description: string;
  rowLabels: [string, string]; // Names for the two quantities
  baseRatio: [number, number]; // The reference ratio (locked first column)
  maxMultiplier?: number; // Maximum multiplier value for the slider
  showUnitRate?: boolean; // Highlight ratio to 1
  showBarChart?: boolean; // Display visual bar chart
}

interface RatioTableProps {
  data: RatioTableData;
  className?: string;
}

const RatioTable: React.FC<RatioTableProps> = ({ data, className }) => {
  const {
    rowLabels,
    baseRatio,
    maxMultiplier = 10,
    showUnitRate = true,
    showBarChart = true,
  } = data;

  // State for the multiplier (starts at 1)
  const [multiplier, setMultiplier] = useState<number>(1);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Calculate the second column based on multiplier
  const secondColumn: [number, number] = [
    baseRatio[0] * multiplier,
    baseRatio[1] * multiplier,
  ];

  // Calculate the constant ratio
  const getConstantRatio = (): string => {
    if (baseRatio[0] === 0) return 'N/A';
    const ratio = baseRatio[1] / baseRatio[0];
    return ratio.toFixed(2);
  };

  // Calculate unit rate
  const getUnitRate = (): string => {
    if (baseRatio[0] === 0) return 'N/A';
    const rate = baseRatio[1] / baseRatio[0];
    return rate.toFixed(2);
  };

  // Handle multiplier input change
  const handleMultiplierChange = (value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    if (numValue > maxMultiplier) {
      setMultiplier(maxMultiplier);
    } else {
      setMultiplier(numValue);
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Ratio Table</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            <p className="text-xs text-teal-400 font-mono uppercase tracking-wider">Proportional Relationships</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-teal-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#14b8a6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Constant Ratio Display */}
          {showUnitRate && (
            <div className="mb-6 p-4 bg-teal-500/20 backdrop-blur-sm rounded-xl border border-teal-400/40 text-center shadow-[0_0_25px_rgba(20,184,166,0.2)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <p className="text-sm text-teal-300 font-mono relative z-10">
                Constant Ratio: <span className="text-2xl font-bold text-teal-100">{getConstantRatio()}</span>
                {' '}
                <span className="text-teal-400">
                  ({rowLabels[1]} per {rowLabels[0]})
                </span>
              </p>
            </div>
          )}

          {/* Ratio Table */}
          <div className="mb-8 p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none rounded-2xl"></div>

            <div className="relative z-10 grid grid-cols-2 gap-6">
              {/* First Column - Reference (Locked) */}
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <span className="text-teal-400 font-mono text-sm uppercase tracking-wider">Reference Ratio</span>
                </div>

                {/* Row 1 - First Column */}
                <div className="p-4 bg-teal-600/20 backdrop-blur-sm rounded-xl border-2 border-teal-500/40 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-teal-400 mb-1 font-medium">{rowLabels[0]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{baseRatio[0]}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-teal-400/0 group-hover:border-teal-400/30 rounded-xl transition-all pointer-events-none"></div>
                </div>

                {/* Row 2 - First Column */}
                <div className="p-4 bg-teal-600/20 backdrop-blur-sm rounded-xl border-2 border-teal-500/40 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-teal-400 mb-1 font-medium">{rowLabels[1]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{baseRatio[1]}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-teal-400/0 group-hover:border-teal-400/30 rounded-xl transition-all pointer-events-none"></div>
                </div>

                {/* Unit Rate */}
                {showUnitRate && (
                  <div className="p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/40 text-center">
                    <p className="text-xs text-slate-400 mb-1">Unit Rate</p>
                    <p className="text-lg font-mono text-slate-300">{getUnitRate()}</p>
                  </div>
                )}
              </div>

              {/* Second Column - Adjustable */}
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <span className="text-purple-400 font-mono text-sm uppercase tracking-wider">Scaled by ×{multiplier.toFixed(1)}</span>
                </div>

                {/* Row 1 - Second Column */}
                <div className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-xl border-2 border-purple-400/50 text-center relative overflow-hidden group hover:border-purple-400/70 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-purple-400 mb-1 font-medium">{rowLabels[0]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{secondColumn[0].toFixed(1)}</p>
                  </div>
                </div>

                {/* Row 2 - Second Column */}
                <div className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-xl border-2 border-purple-400/50 text-center relative overflow-hidden group hover:border-purple-400/70 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-purple-400 mb-1 font-medium">{rowLabels[1]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{secondColumn[1].toFixed(1)}</p>
                  </div>
                </div>

                {/* Unit Rate */}
                {showUnitRate && (
                  <div className="p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/40 text-center">
                    <p className="text-xs text-slate-400 mb-1">Unit Rate</p>
                    <p className="text-lg font-mono text-slate-300">{getUnitRate()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Multiplier Control */}
          <div className="mb-8 p-6 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/50 rounded-2xl relative overflow-hidden shadow-[0_0_25px_rgba(168,85,247,0.2)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <label className="text-purple-200 font-bold text-lg">Adjust Multiplier</label>
                <input
                  type="number"
                  min="0"
                  max={maxMultiplier}
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => handleMultiplierChange(e.target.value)}
                  className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center font-mono font-bold transition-all"
                />
              </div>

              <input
                type="range"
                min="0"
                max={maxMultiplier}
                step="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                style={{
                  background: `linear-gradient(to right, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0.4) ${(multiplier / maxMultiplier) * 100}%, rgba(51,65,85,0.5) ${(multiplier / maxMultiplier) * 100}%, rgba(51,65,85,0.5) 100%)`
                }}
              />

              <div className="flex justify-between mt-2 text-xs text-purple-300 font-mono">
                <span>0</span>
                <span>{maxMultiplier}</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {showBarChart && (
            <div className="mb-8 p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none rounded-2xl"></div>

              <div className="relative z-10">
                <h4 className="text-sm font-mono uppercase tracking-wider text-teal-400 mb-6 text-center">Visual Comparison</h4>

                <div className="space-y-8">
                  {/* Reference Column */}
                  <div>
                    <p className="text-sm text-teal-400 font-mono uppercase tracking-wider mb-3 text-center">Reference Ratio</p>
                    <div className="space-y-3">
                      {/* Reference - First quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[0]}</span>
                        <div
                          className="relative group flex-shrink-0"
                          onMouseEnter={() => setHoveredBar(0)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: '150px' }}
                        >
                          <div className="h-12 bg-teal-500/30 backdrop-blur-sm rounded-lg border-2 border-teal-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-teal-400/80 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{baseRatio[0]}</span>
                          </div>
                        </div>
                      </div>

                      {/* Reference - Second quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[1]}</span>
                        <div
                          className="relative group flex-shrink-0"
                          onMouseEnter={() => setHoveredBar(1)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: '150px' }}
                        >
                          <div className="h-12 bg-teal-500/30 backdrop-blur-sm rounded-lg border-2 border-teal-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-teal-400/80 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{baseRatio[1]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scaled Column */}
                  <div>
                    <p className="text-sm text-purple-400 font-mono uppercase tracking-wider mb-3 text-center">Scaled (×{multiplier.toFixed(1)})</p>
                    <div className="space-y-3">
                      {/* Scaled - First quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[0]}</span>
                        <div
                          className="relative group flex-shrink-0 transition-all duration-300"
                          onMouseEnter={() => setHoveredBar(2)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: `${150 * multiplier}px` }}
                        >
                          <div className="h-12 bg-purple-500/30 backdrop-blur-sm rounded-lg border-2 border-purple-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-purple-400/80 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{secondColumn[0].toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Scaled - Second quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[1]}</span>
                        <div
                          className="relative group flex-shrink-0 transition-all duration-300"
                          onMouseEnter={() => setHoveredBar(3)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: `${150 * multiplier}px` }}
                        >
                          <div className="h-12 bg-purple-500/30 backdrop-blur-sm rounded-lg border-2 border-purple-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-purple-400/80 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{secondColumn[1].toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-teal-500/30 border-2 border-teal-400/50 rounded"></div>
                    <span className="text-slate-300">Reference</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500/30 border-2 border-purple-400/50 rounded"></div>
                    <span className="text-slate-300">Scaled (×{multiplier.toFixed(1)})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <h4 className="text-sm font-mono uppercase tracking-wider text-teal-400 mb-4">How to Use</h4>
              <ul className="text-sm text-slate-200 space-y-2">
                <li className="flex items-start gap-2 hover:text-white transition-colors">
                  <span className="text-teal-400 mt-1">▸</span>
                  <span>The reference ratio shows the base proportional relationship</span>
                </li>
                <li className="flex items-start gap-2 hover:text-white transition-colors">
                  <span className="text-teal-400 mt-1">▸</span>
                  <span>Use the slider to adjust the multiplier and see how values scale</span>
                </li>
                <li className="flex items-start gap-2 hover:text-white transition-colors">
                  <span className="text-teal-400 mt-1">▸</span>
                  <span>The bar chart visualizes how both quantities scale proportionally</span>
                </li>
                <li className="flex items-start gap-2 hover:text-white transition-colors">
                  <span className="text-teal-400 mt-1">▸</span>
                  <span>Notice how the unit rate remains constant regardless of scaling</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatioTable;