'use client';

import React, { useState } from 'react';

export interface PercentBarData {
  title: string;
  description: string;
  wholeValue: number;
  shadedPercent: number;
  showPercentLabels?: boolean;
  showValueLabels?: boolean;
  benchmarkLines?: number[];
  doubleBar?: boolean;
}

interface PercentBarProps {
  data: PercentBarData;
  className?: string;
}

const PercentBar: React.FC<PercentBarProps> = ({ data, className }) => {
  const {
    wholeValue,
    shadedPercent: initialShadedPercent,
    showPercentLabels = true,
    showValueLabels = true,
    benchmarkLines = [25, 50, 75],
    doubleBar = false,
  } = data;

  const [shadedPercent, setShadedPercent] = useState(initialShadedPercent);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredBenchmark, setHoveredBenchmark] = useState<number | null>(null);

  // Calculate the actual value based on the percentage
  const shadedValue = (shadedPercent / 100) * wholeValue;

  // Handle click or drag to adjust percentage
  const handleBarInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setShadedPercent(Math.round(percentage));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleBarInteraction(e);
    }
  };

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Percent Bar</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Part-Whole Reasoning</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-emerald-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Current Values Display */}
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Percentage</div>
              <div className="text-3xl font-bold text-emerald-400">{shadedPercent.toFixed(0)}%</div>
            </div>
            {showValueLabels && (
              <>
                <div className="text-center">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Part Value</div>
                  <div className="text-3xl font-bold text-white">{shadedValue.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Whole Value</div>
                  <div className="text-3xl font-bold text-slate-400">{wholeValue}</div>
                </div>
              </>
            )}
          </div>

          {/* Percent Bar Visualization */}
          <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-8">
            {/* Main Percent Bar */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Percentage (0% - 100%)
              </div>

              {/* Interactive Bar Container */}
              <div
                className="relative h-16 bg-slate-700 rounded-xl cursor-pointer shadow-inner overflow-hidden border border-slate-600"
                onClick={handleBarInteraction}
                onMouseMove={handleMouseMove}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {/* Shaded Portion */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-200 rounded-l-xl"
                  style={{ width: `${shadedPercent}%` }}
                >
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>

                {/* Benchmark Lines */}
                {benchmarkLines.map((benchmark, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-0.5 bg-slate-400/50 cursor-help"
                    style={{ left: `${benchmark}%` }}
                    onMouseEnter={() => setHoveredBenchmark(benchmark)}
                    onMouseLeave={() => setHoveredBenchmark(null)}
                  >
                    {/* Benchmark Label */}
                    {showPercentLabels && (
                      <div className={`absolute -top-8 left-1/2 -translate-x-1/2 text-xs transition-all ${hoveredBenchmark === benchmark ? 'text-emerald-300 font-bold scale-110' : 'text-slate-400'}`}>
                        {benchmark}%
                      </div>
                    )}
                    {/* Tooltip on Hover */}
                    {hoveredBenchmark === benchmark && showValueLabels && (
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-xs rounded whitespace-nowrap pointer-events-none">
                        {((benchmark / 100) * wholeValue).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}

                {/* End Labels */}
                {showPercentLabels && (
                  <>
                    <div className="absolute -bottom-8 left-0 text-xs text-slate-400 font-mono">0%</div>
                    <div className="absolute -bottom-8 right-0 text-xs text-slate-400 font-mono">100%</div>
                  </>
                )}
              </div>
            </div>

            {/* Double Bar - Value Bar */}
            {doubleBar && (
              <div className="relative mt-16">
                {/* Label */}
                <div className="absolute -top-8 left-0 text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Actual Value (0 - {wholeValue})
                </div>

                {/* Value Bar */}
                <div className="relative h-12 bg-slate-700 rounded-xl shadow-inner border border-slate-600">
                  {/* Shaded Portion */}
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-200 rounded-l-xl"
                    style={{ width: `${shadedPercent}%` }}
                  ></div>

                  {/* Tick Marks for Values */}
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
                    const value = fraction * wholeValue;
                    const percent = fraction * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full w-px bg-slate-400/50"
                        style={{ left: `${percent}%` }}
                      >
                        {showValueLabels && (
                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-mono">
                            {value % 1 === 0 ? value : value.toFixed(1)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Calculation Display */}
          <div className="mt-12 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="text-center text-slate-300">
              <div className="text-sm uppercase tracking-wider text-slate-400 mb-2">Calculation</div>
              <div className="text-lg font-mono">
                <span className="text-emerald-400">{shadedPercent.toFixed(0)}%</span>
                {' of '}
                <span className="text-white">{wholeValue}</span>
                {' = '}
                <span className="text-emerald-300 font-bold">{shadedValue.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                ({shadedPercent.toFixed(0)} ÷ 100) × {wholeValue} = {shadedValue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Interactive Instructions */}
          <div className="mt-8 text-center text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
              </svg>
              Click or drag on the bar to adjust the percentage
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PercentBar;
