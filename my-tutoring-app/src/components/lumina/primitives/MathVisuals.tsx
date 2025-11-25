'use client';

import React from 'react';
import { MathVisualData } from '../types';

interface MathVisualsProps {
  data: MathVisualData;
}

export const MathVisuals: React.FC<MathVisualsProps> = ({ data }) => {
  
  // -- RENDERERS --

  const renderBarModel = () => {
    const items = data.data.values || [];
    const maxVal = Math.max(...items.map(i => i.value));
    
    return (
      <div className="w-full max-w-lg space-y-4">
        {items.map((item, i) => (
           <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
              </div>
              <div className="h-10 bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                  <div 
                     className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 relative transition-all duration-1000 ease-out"
                     style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: item.color }}
                  >
                     <div className="absolute right-0 top-0 h-full w-1 bg-white/20"></div>
                  </div>
              </div>
           </div>
        ))}
      </div>
    );
  };

  const renderNumberLine = () => {
    const { min = 0, max = 10 } = data.data.range || {};
    const highlights = data.data.highlights || [];
    const totalRange = max - min;

    return (
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
    );
  };

  const renderBaseTen = () => {
    const num = data.data.numberValue || 0;
    const hundreds = Math.floor(num / 100);
    const tens = Math.floor((num % 100) / 10);
    const ones = num % 10;

    return (
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
    );
  };

  const renderFractionCircles = () => {
      const items = data.data.fractions || [];
      return (
          <div className="flex flex-wrap justify-center gap-8">
              {items.map((frac, idx) => {
                  const percentage = (frac.numerator / frac.denominator) * 100;
                  // SVG pie chart logic
                  // Simple approach: conic-gradient
                  return (
                      <div key={idx} className="flex flex-col items-center gap-3">
                          <div className="relative w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-700 overflow-hidden">
                                <div 
                                    className="absolute inset-0"
                                    style={{
                                        background: `conic-gradient(#3b82f6 0% ${percentage}%, transparent ${percentage}% 100%)`
                                    }}
                                ></div>
                                {/* Grid lines (approximate for common denoms) */}
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
                  )
              })}
          </div>
      );
  };

  const renderGeometricShape = () => {
      const shapeName = data.data.shapeName?.toLowerCase() || 'shape';
      const attrs = data.data.attributes || [];
      
      // Basic shape mapping to CSS Clip paths or SVGs
      let shapePath = "";
      let viewBox = "0 0 100 100";
      
      if (shapeName.includes('triangle')) shapePath = "50,10 90,90 10,90";
      else if (shapeName.includes('square')) shapePath = "10,10 90,10 90,90 10,90";
      else if (shapeName.includes('rectangle')) { shapePath = "5,25 95,25 95,75 5,75"; }
      else if (shapeName.includes('pentagon')) shapePath = "50,5 95,35 80,90 20,90 5,35";
      else if (shapeName.includes('hexagon')) shapePath = "25,5 75,5 95,50 75,95 25,95 5,50";
      else if (shapeName.includes('circle')) {
           // handled separately
      } else {
           // Fallback polygon (octagon-ish)
           shapePath = "30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30";
      }

      return (
          <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-64 h-64 relative drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <svg viewBox={viewBox} className="w-full h-full stroke-blue-400 stroke-2 fill-blue-500/20 overflow-visible">
                      {shapeName.includes('circle') ? (
                          <circle cx="50" cy="50" r="45" />
                      ) : (
                          <polygon points={shapePath} />
                      )}
                      {/* Vertex dots */}
                      {!shapeName.includes('circle') && shapePath.split(' ').map((point, i) => {
                          const [x, y] = point.split(',');
                          return <circle key={i} cx={x} cy={y} r="2" className="fill-white" />
                      })}
                  </svg>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5 w-full max-w-sm">
                  <h4 className="text-blue-300 font-bold uppercase tracking-widest mb-4 border-b border-white/5 pb-2">{shapeName}</h4>
                  <div className="space-y-3">
                      {attrs.map((attr, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                              <span className="text-slate-400">{attr.label}</span>
                              <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">{attr.value}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="w-full max-w-5xl mx-auto my-16 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
            <div className="text-left">
                <h2 className="text-2xl font-bold text-white tracking-tight">Quantitative Visualization</h2>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">{data.visualType.replace(/-/g, ' ')}</p>
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
                
                {/* Dynamic Visual Render */}
                <div className="w-full flex justify-center py-4">
                    {data.visualType === 'bar-model' && renderBarModel()}
                    {data.visualType === 'number-line' && renderNumberLine()}
                    {data.visualType === 'base-ten-blocks' && renderBaseTen()}
                    {data.visualType === 'fraction-circles' && renderFractionCircles()}
                    {data.visualType === 'geometric-shape' && renderGeometricShape()}
                </div>
            </div>
        </div>
    </div>
  );
};
