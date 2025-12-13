'use client';

import React from 'react';

export interface NumberLineData {
  title: string;
  description: string;
  range: { min: number; max: number };
  highlights: { label: string; value: number }[];
}

interface NumberLineProps {
  data: NumberLineData;
  className?: string;
}

const NumberLine: React.FC<NumberLineProps> = ({ data, className }) => {
  const { min = 0, max = 10 } = data.range || {};
  const highlights = data.highlights || [];
  const totalRange = max - min;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Number Line</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Linear Visualization</p>
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
          </div>

          {/* Number Line Visualization */}
          <div className="w-full max-w-2xl px-8 py-12">
            <div className="relative h-1 bg-slate-600 rounded-full flex items-center">
              {/* Ticks */}
              {Array.from({ length: 11 }).map((_, i) => {
                const val = min + (totalRange * (i / 10));
                return (
                  <div key={i} className="absolute w-px h-3 bg-slate-500 top-full mt-1 flex flex-col items-center" style={{ left: `${i * 10}%` }}>
                    <span className="mt-2 text-[10px] text-slate-500 font-mono">{Math.round(val)}</span>
                  </div>
                );
              })}

              {/* Highlights */}
              {highlights.map((h, i) => {
                const percent = ((h.value - min) / totalRange) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-help transition-all duration-500"
                    style={{ left: `${percent}%` }}
                  >
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10 hover:scale-125 transition-transform"></div>
                    <div className="absolute bottom-full mb-3 px-3 py-1 bg-blue-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {h.label}: {h.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberLine;
