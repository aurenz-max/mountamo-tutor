'use client';

import React, { useState } from 'react';

export interface BaseTenBlocksData {
  title: string;
  description: string;
  numberValue: number;
}

interface BaseTenBlocksProps {
  data: BaseTenBlocksData;
  className?: string;
}

type HoveredPlace = 'hundreds' | 'tens' | 'ones' | null;

const BaseTenBlocks: React.FC<BaseTenBlocksProps> = ({ data, className }) => {
  const [hoveredPlace, setHoveredPlace] = useState<HoveredPlace>(null);
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);

  const num = data.numberValue || 0;
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  // Calculate the value contribution of the hovered section
  const getHoveredValue = (): number | null => {
    if (!hoveredPlace) return null;
    if (hoveredPlace === 'hundreds') return hoveredBlockIndex !== null ? 100 : hundreds * 100;
    if (hoveredPlace === 'tens') return hoveredBlockIndex !== null ? 10 : tens * 10;
    if (hoveredPlace === 'ones') return hoveredBlockIndex !== null ? 1 : ones;
    return null;
  };

  const hoveredValue = getHoveredValue();

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
            {/* Hundreds Blocks */}
            {hundreds > 0 && (
              <div
                className="flex flex-col items-center gap-2"
                onMouseEnter={() => setHoveredPlace('hundreds')}
                onMouseLeave={() => { setHoveredPlace(null); setHoveredBlockIndex(null); }}
              >
                <div className="flex gap-1">
                  {Array.from({ length: hundreds }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-24 h-24 grid grid-cols-10 grid-rows-10 gap-px p-0.5 cursor-pointer transition-all duration-300 ${
                        hoveredPlace === 'hundreds' && hoveredBlockIndex === i
                          ? 'bg-blue-500/40 border-2 border-blue-300 shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-105'
                          : hoveredPlace === 'hundreds'
                          ? 'bg-blue-500/30 border border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                          : 'bg-blue-500/20 border border-blue-400'
                      }`}
                      onMouseEnter={() => setHoveredBlockIndex(i)}
                      onMouseLeave={() => setHoveredBlockIndex(null)}
                    >
                      {Array.from({length: 100}).map((__, j) => (
                        <div
                          key={j}
                          className={`transition-colors duration-200 ${
                            hoveredPlace === 'hundreds' && hoveredBlockIndex === i
                              ? 'bg-blue-400/60'
                              : hoveredPlace === 'hundreds'
                              ? 'bg-blue-400/40'
                              : 'bg-blue-400/30'
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <span className={`text-xs font-mono transition-colors duration-200 ${
                  hoveredPlace === 'hundreds' ? 'text-blue-300 font-semibold' : 'text-slate-400'
                }`}>
                  Hundreds
                </span>
                {/* Tooltip */}
                {hoveredPlace === 'hundreds' && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-fade-in whitespace-nowrap z-20">
                    {hoveredBlockIndex !== null
                      ? `1 hundred = 100`
                      : `${hundreds} hundred${hundreds > 1 ? 's' : ''} = ${hundreds * 100}`
                    }
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-600"></div>
                  </div>
                )}
              </div>
            )}

            {/* Tens Blocks */}
            {tens > 0 && (
              <div
                className="flex flex-col items-center gap-2 relative"
                onMouseEnter={() => setHoveredPlace('tens')}
                onMouseLeave={() => { setHoveredPlace(null); setHoveredBlockIndex(null); }}
              >
                <div className="flex gap-1">
                  {Array.from({ length: tens }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-24 grid grid-rows-10 gap-px p-px cursor-pointer transition-all duration-300 ${
                        hoveredPlace === 'tens' && hoveredBlockIndex === i
                          ? 'bg-purple-500/40 border-2 border-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.5)] scale-110'
                          : hoveredPlace === 'tens'
                          ? 'bg-purple-500/30 border border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                          : 'bg-purple-500/20 border border-purple-400'
                      }`}
                      onMouseEnter={() => setHoveredBlockIndex(i)}
                      onMouseLeave={() => setHoveredBlockIndex(null)}
                    >
                      {Array.from({length: 10}).map((__, j) => (
                        <div
                          key={j}
                          className={`transition-colors duration-200 ${
                            hoveredPlace === 'tens' && hoveredBlockIndex === i
                              ? 'bg-purple-400/60'
                              : hoveredPlace === 'tens'
                              ? 'bg-purple-400/40'
                              : 'bg-purple-400/30'
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <span className={`text-xs font-mono transition-colors duration-200 ${
                  hoveredPlace === 'tens' ? 'text-purple-300 font-semibold' : 'text-slate-400'
                }`}>
                  Tens
                </span>
                {/* Tooltip */}
                {hoveredPlace === 'tens' && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-fade-in whitespace-nowrap z-20">
                    {hoveredBlockIndex !== null
                      ? `1 ten = 10`
                      : `${tens} ten${tens > 1 ? 's' : ''} = ${tens * 10}`
                    }
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-purple-600"></div>
                  </div>
                )}
              </div>
            )}

            {/* Ones Blocks */}
            {ones > 0 && (
              <div
                className="flex flex-col items-center gap-2 relative"
                onMouseEnter={() => setHoveredPlace('ones')}
                onMouseLeave={() => { setHoveredPlace(null); setHoveredBlockIndex(null); }}
              >
                <div className="flex flex-wrap gap-1 max-w-[50px]">
                  {Array.from({ length: ones }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 cursor-pointer transition-all duration-300 ${
                        hoveredPlace === 'ones' && hoveredBlockIndex === i
                          ? 'bg-emerald-500/60 border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-150'
                          : hoveredPlace === 'ones'
                          ? 'bg-emerald-500/40 border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                          : 'bg-emerald-500/20 border border-emerald-400'
                      }`}
                      onMouseEnter={() => setHoveredBlockIndex(i)}
                      onMouseLeave={() => setHoveredBlockIndex(null)}
                    />
                  ))}
                </div>
                <span className={`text-xs font-mono transition-colors duration-200 ${
                  hoveredPlace === 'ones' ? 'text-emerald-300 font-semibold' : 'text-slate-400'
                }`}>
                  Ones
                </span>
                {/* Tooltip */}
                {hoveredPlace === 'ones' && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-fade-in whitespace-nowrap z-20">
                    {hoveredBlockIndex !== null
                      ? `1 one = 1`
                      : `${ones} one${ones > 1 ? 's' : ''} = ${ones}`
                    }
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-emerald-600"></div>
                  </div>
                )}
              </div>
            )}

            {/* Total Display with hover effect */}
            <div className={`text-4xl font-bold ml-4 transition-all duration-300 ${
              hoveredPlace
                ? 'text-slate-400'
                : 'text-white'
            }`}>
              = {hoveredPlace && hoveredValue !== null ? (
                <span className="relative">
                  <span className="text-slate-500">{num}</span>
                  <span className={`absolute -top-8 left-1/2 -translate-x-1/2 text-lg px-2 py-1 rounded-lg whitespace-nowrap ${
                    hoveredPlace === 'hundreds' ? 'bg-blue-600 text-white' :
                    hoveredPlace === 'tens' ? 'bg-purple-600 text-white' :
                    'bg-emerald-600 text-white'
                  }`}>
                    +{hoveredBlockIndex !== null
                      ? (hoveredPlace === 'hundreds' ? 100 : hoveredPlace === 'tens' ? 10 : 1)
                      : hoveredValue
                    }
                  </span>
                </span>
              ) : num}
            </div>
          </div>

          {/* Interactive hint */}
          <p className="mt-8 text-xs text-slate-500 font-mono">
            Hover over blocks to see their value
          </p>
        </div>
      </div>
    </div>
  );
};

export default BaseTenBlocks;
