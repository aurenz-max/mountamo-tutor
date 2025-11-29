'use client';

import React, { useState } from 'react';
import { EquationData } from '../types';

interface FormulaCardProps {
  data: EquationData;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ data }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);

  const segments = data.segments || [];
  const parameters = data.parameters || [];
  const relationships = data.relationships || [];
  const examples = data.examples || [];

  // Get highlighted parameters
  const highlightedParams = parameters.filter(p => p.isHighlighted);

  return (
    <div className="w-full animate-fade-in">
      {/* Main Formula Display */}
      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-indigo-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.1)]">

        {/* Background Grid Decoration */}
        <div className="absolute inset-0 z-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px'
        }}></div>

        {/* Title and Description */}
        <div className="relative z-10 mb-8 text-center">
          <h3 className="text-xl md:text-2xl font-bold text-indigo-300 mb-3">{data.title}</h3>
          <p className="text-slate-300 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">{data.description}</p>
        </div>

        {/* The Formula Display */}
        <div className="relative z-10 flex flex-wrap justify-center items-baseline gap-2 md:gap-4 p-6 md:p-8 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-inner mb-8">
          {segments.length > 0 ? segments.map((segment, index) => (
            <div
              key={index}
              className="relative group"
              onMouseEnter={() => segment.isVariable && setHoveredSegment(segment.meaning || null)}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={() => segment.isVariable && setSelectedParameter(segment.text)}
            >
              <span
                className={`text-4xl md:text-6xl font-serif tracking-wide transition-all duration-300
                ${segment.isVariable
                  ? 'cursor-pointer text-white hover:text-indigo-300 hover:scale-110 inline-block border-b-2 border-dashed border-indigo-500/30 hover:border-indigo-400'
                  : 'text-slate-500'}`}
              >
                {segment.text}
              </span>

              {/* Tooltip for hover */}
              {segment.isVariable && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-max max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-y-2 group-hover:translate-y-0 z-30">
                  <div className="bg-indigo-600 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-xl relative">
                    {segment.meaning}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-indigo-600"></div>
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="text-slate-500 italic">No formula segments generated.</div>
          )}
        </div>

        {/* Hover Hint */}
        <div className="h-12 relative z-10 w-full flex justify-center items-center mb-8">
          <div className={`transition-all duration-500 transform ${hoveredSegment ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {hoveredSegment && (
              <div className="flex items-center gap-3 bg-indigo-900/40 border border-indigo-500/30 px-6 py-2 rounded-full">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                <span className="text-indigo-200 font-mono text-sm uppercase tracking-wider">{hoveredSegment}</span>
              </div>
            )}
            {!hoveredSegment && (
              <span className="text-slate-600 text-sm font-mono animate-pulse">Hover over variables to decode • Click to see details</span>
            )}
          </div>
        </div>

        {/* Key Focus Section - Highlighted Parameters */}
        {highlightedParams.length > 0 && (
          <div className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <span className="text-amber-400 text-lg">⭐</span>
              </div>
              <h4 className="text-lg font-bold text-amber-300 uppercase tracking-wide">Key Focus</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highlightedParams.map((param, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedParameter(param.symbol)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-200 font-bold text-xl flex-shrink-0">
                      {param.symbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-amber-200 mb-1">{param.name}</div>
                      <div className="text-sm text-slate-300 line-clamp-2">{param.description}</div>
                      {param.unit && (
                        <div className="text-xs text-amber-400/70 mt-1 font-mono">Unit: {param.unit}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parameter Cards Grid */}
        <div className="relative z-10 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <span className="text-purple-400 text-lg">📊</span>
            </div>
            <h4 className="text-lg font-bold text-purple-300 uppercase tracking-wide">Parameters Explained</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parameters.map((param, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                  selectedParameter === param.symbol
                    ? 'bg-indigo-500/20 border-indigo-400 shadow-lg shadow-indigo-500/20'
                    : param.isHighlighted
                    ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/50'
                }`}
                onClick={() => setSelectedParameter(param.symbol)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold flex-shrink-0 ${
                    param.isHighlighted
                      ? 'bg-amber-500/30 text-amber-200 border-2 border-amber-400/50'
                      : 'bg-indigo-500/30 text-indigo-200'
                  }`}>
                    {param.symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white mb-1 flex items-center gap-2">
                      {param.name}
                      {param.isHighlighted && <span className="text-amber-400 text-sm">⭐</span>}
                    </div>
                    {param.unit && (
                      <div className="text-xs text-indigo-400/80 font-mono bg-indigo-500/10 px-2 py-0.5 rounded inline-block">
                        {param.unit}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{param.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Relationships Section */}
        {relationships.length > 0 && (
          <div className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <span className="text-emerald-400 text-lg">🔗</span>
              </div>
              <h4 className="text-lg font-bold text-emerald-300 uppercase tracking-wide">How Parameters Relate</h4>
            </div>
            <div className="space-y-3">
              {relationships.map((rel, idx) => (
                <div key={idx} className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      rel.type === 'proportional' ? 'bg-emerald-500/30 text-emerald-200' :
                      rel.type === 'inverse' ? 'bg-rose-500/30 text-rose-200' :
                      'bg-purple-500/30 text-purple-200'
                    }`}>
                      {rel.type || 'relationship'}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">{rel.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Examples */}
        {examples.length > 0 && (
          <div className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <span className="text-cyan-400 text-lg">🌍</span>
              </div>
              <h4 className="text-lg font-bold text-cyan-300 uppercase tracking-wide">Real-World Applications</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {examples.map((example, idx) => (
                <div key={idx} className="p-5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/15 transition-colors">
                  <div className="font-bold text-cyan-200 mb-2 flex items-center gap-2">
                    <span className="text-cyan-400">💡</span>
                    {example.scenario}
                  </div>
                  {example.calculation && (
                    <div className="text-sm font-mono bg-slate-900/50 px-3 py-2 rounded-lg mb-2 text-indigo-300 border border-slate-700">
                      {example.calculation}
                    </div>
                  )}
                  <p className="text-sm text-slate-300 leading-relaxed">{example.result}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Application Context */}
        {data.applicationContext && (
          <div className="relative z-10">
            <div className="p-5 bg-indigo-900/30 border border-indigo-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-lg">📚</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wide mb-2">When to Use This Formula</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{data.applicationContext}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
