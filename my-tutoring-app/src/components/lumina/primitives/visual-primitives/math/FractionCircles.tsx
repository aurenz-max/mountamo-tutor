'use client';

import React from 'react';

export interface FractionCirclesData {
  title: string;
  description: string;
  fractions: { numerator: number; denominator: number; label?: string }[];
}

interface FractionCirclesProps {
  data: FractionCirclesData;
  className?: string;
}

const FractionCircles: React.FC<FractionCirclesProps> = ({ data, className }) => {
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
          </div>

          {/* Fraction Circles Visualization */}
          <div className="flex flex-wrap justify-center gap-8">
            {data.fractions.map((frac, idx) => {
              const percentage = (frac.numerator / frac.denominator) * 100;
              return (
                <div key={idx} className="flex flex-col items-center gap-3">
                  <div className="relative w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-700 overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `conic-gradient(#3b82f6 0% ${percentage}%, transparent ${percentage}% 100%)`
                      }}
                    ></div>
                    {/* Grid lines */}
                    {Array.from({length: frac.denominator}).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-full h-px bg-slate-900 top-1/2 left-0 origin-center"
                        style={{ transform: `rotate(${(360/frac.denominator) * i}deg)` }}
                      ></div>
                    ))}
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold text-white">{frac.numerator}/{frac.denominator}</span>
                    {frac.label && <p className="text-xs text-slate-400">{frac.label}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FractionCircles;
