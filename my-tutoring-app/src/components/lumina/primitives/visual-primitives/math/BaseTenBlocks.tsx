'use client';

import React from 'react';

export interface BaseTenBlocksData {
  title: string;
  description: string;
  numberValue: number;
}

interface BaseTenBlocksProps {
  data: BaseTenBlocksData;
  className?: string;
}

const BaseTenBlocks: React.FC<BaseTenBlocksProps> = ({ data, className }) => {
  const num = data.numberValue || 0;
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Base-Ten Blocks</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Place Value Visualization</p>
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

          {/* Base-Ten Blocks Visualization */}
          <div className="flex flex-wrap gap-8 items-end justify-center">
            {hundreds > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: hundreds }).map((_, i) => (
                    <div key={i} className="w-24 h-24 bg-blue-500/20 border border-blue-400 grid grid-cols-10 grid-rows-10 gap-px p-0.5">
                      {Array.from({length: 100}).map((__, j) => <div key={j} className="bg-blue-400/30"></div>)}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">Hundreds</span>
              </div>
            )}

            {tens > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: tens }).map((_, i) => (
                    <div key={i} className="w-2.5 h-24 bg-purple-500/20 border border-purple-400 grid grid-rows-10 gap-px p-px">
                      {Array.from({length: 10}).map((__, j) => <div key={j} className="bg-purple-400/30"></div>)}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">Tens</span>
              </div>
            )}

            {ones > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-wrap gap-1 max-w-[50px]">
                  {Array.from({ length: ones }).map((_, i) => (
                    <div key={i} className="w-2.5 h-2.5 bg-green-500/20 border border-green-400"></div>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">Ones</span>
              </div>
            )}

            <div className="text-4xl font-bold text-white ml-4">= {num}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaseTenBlocks;
