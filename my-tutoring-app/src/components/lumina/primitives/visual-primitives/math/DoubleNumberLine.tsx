'use client';

import React, { useState } from 'react';

export interface LinkedPoint {
  topValue: number;
  bottomValue: number;
  label?: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  interval: number;
}

export interface DoubleNumberLineData {
  title: string;
  description: string;
  topLabel: string;
  bottomLabel: string;
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
  linkedPoints?: LinkedPoint[];
  showVerticalGuides?: boolean;
}

interface DoubleNumberLineProps {
  data: DoubleNumberLineData;
  className?: string;
}

const DoubleNumberLine: React.FC<DoubleNumberLineProps> = ({ data, className }) => {
  const {
    topLabel,
    bottomLabel,
    topScale,
    bottomScale,
    linkedPoints = [],
    showVerticalGuides = true,
  } = data;

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Calculate positions for tick marks
  const topTickCount = Math.floor((topScale.max - topScale.min) / topScale.interval) + 1;
  const bottomTickCount = Math.floor((bottomScale.max - bottomScale.min) / bottomScale.interval) + 1;

  const getTopPosition = (value: number): number => {
    return ((value - topScale.min) / (topScale.max - topScale.min)) * 100;
  };

  const getBottomPosition = (value: number): number => {
    return ((value - bottomScale.min) / (bottomScale.max - bottomScale.min)) * 100;
  };

  // Generate tick marks for top line
  const topTicks = Array.from({ length: topTickCount }, (_, i) => {
    const value = topScale.min + i * topScale.interval;
    const position = getTopPosition(value);
    return { value, position };
  });

  // Generate tick marks for bottom line
  const bottomTicks = Array.from({ length: bottomTickCount }, (_, i) => {
    const value = bottomScale.min + i * bottomScale.interval;
    const position = getBottomPosition(value);
    return { value, position };
  });

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Double Number Line</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Proportional Reasoning</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Double Number Line Visualization */}
          <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-24">
            {/* Top Number Line */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                {topLabel}
              </div>

              {/* Line */}
              <div className="relative h-1 bg-slate-600 rounded-full">
                {/* Ticks */}
                {topTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${tick.position}%` }}
                  >
                    <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                      {tick.value}
                    </span>
                  </div>
                ))}

                {/* Linked Points on Top Line */}
                {linkedPoints.map((point, i) => {
                  const position = getTopPosition(point.topValue);
                  const isHovered = hoveredPoint === i;
                  return (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                      onMouseEnter={() => setHoveredPoint(i)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div className={`w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 cursor-help ${isHovered ? 'scale-150' : ''}`}></div>
                      {point.label && (
                        <div className={`absolute bottom-full mb-3 px-3 py-1 bg-purple-600 text-white text-xs rounded transition-opacity whitespace-nowrap pointer-events-none ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                          {point.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vertical Alignment Guides */}
            {showVerticalGuides && linkedPoints.map((point, i) => {
              const topPosition = getTopPosition(point.topValue);
              const isHovered = hoveredPoint === i;
              return (
                <div
                  key={i}
                  className={`absolute h-24 w-px -mt-12 transition-all duration-300 pointer-events-none ${isHovered ? 'bg-purple-400/60' : 'bg-purple-400/20'}`}
                  style={{ left: `${topPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px transition-all duration-300 ${isHovered ? 'bg-purple-400/60' : 'bg-purple-400/20'}`}></div>
                </div>
              );
            })}

            {/* Bottom Number Line */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                {bottomLabel}
              </div>

              {/* Line */}
              <div className="relative h-1 bg-slate-600 rounded-full">
                {/* Ticks */}
                {bottomTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${tick.position}%` }}
                  >
                    <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                      {tick.value}
                    </span>
                  </div>
                ))}

                {/* Linked Points on Bottom Line */}
                {linkedPoints.map((point, i) => {
                  const position = getBottomPosition(point.bottomValue);
                  const isHovered = hoveredPoint === i;
                  return (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                      onMouseEnter={() => setHoveredPoint(i)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div className={`w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 cursor-help ${isHovered ? 'scale-150' : ''}`}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend for Linked Points */}
          {linkedPoints.length > 0 && (
            <div className="mt-16 flex flex-wrap gap-4 justify-center">
              {linkedPoints.map((point, i) => (
                <div
                  key={i}
                  className={`px-4 py-2 rounded-lg border transition-all duration-300 cursor-help ${hoveredPoint === i ? 'bg-purple-500/20 border-purple-400/50' : 'bg-slate-800/40 border-slate-700/50'}`}
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    {point.label || `Point ${i + 1}`}
                  </div>
                  <div className="text-sm font-mono text-white">
                    {topLabel}: <span className="text-purple-400">{point.topValue}</span>
                    {' → '}
                    {bottomLabel}: <span className="text-purple-400">{point.bottomValue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoubleNumberLine;
