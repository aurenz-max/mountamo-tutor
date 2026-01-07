'use client';

import React, { useEffect, useState } from 'react';
import { ComparisonData } from '../types';
import { generateConceptImage } from '../service/geminiClient-api';

interface ComparisonPanelProps {
  data: ComparisonData;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ data }) => {
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<1 | 2 | null>(null);
  const [selectedItem, setSelectedItem] = useState<1 | 2 | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchImages = async () => {
        if(!data.item1.visualPrompt || !data.item2.visualPrompt) return;

        const p1 = generateConceptImage(`A futuristic, abstract symbolic representation of: ${data.item1.visualPrompt}. Blue and Cyan lighting scheme. Minimalist.`);
        const p2 = generateConceptImage(`A futuristic, abstract symbolic representation of: ${data.item2.visualPrompt}. Red and Orange lighting scheme. Minimalist.`);

        const [url1, url2] = await Promise.all([p1, p2]);

        if (mounted) {
            if (url1) setImage1(url1);
            if (url2) setImage2(url2);
        }
    };

    fetchImages();
    return () => { mounted = false; };
  }, [data.item1.visualPrompt, data.item2.visualPrompt]);

  return (
    <div className="w-full max-w-7xl mx-auto my-20 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">Comparative Analysis</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Side-by-Side Comparison</p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      {data.intro && (
        <div className="mb-8 text-center max-w-3xl mx-auto">
          <p className="text-slate-300 font-light leading-relaxed">{data.intro}</p>
        </div>
      )}

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Item 1 Card */}
        <div
          className={`glass-panel rounded-3xl border overflow-hidden transition-all duration-500 cursor-pointer group
            ${selectedItem === 1 ? 'border-blue-500/60 ring-4 ring-blue-500/20' : 'border-blue-500/20 hover:border-blue-500/40'}
            ${hoveredItem === 2 ? 'opacity-60 scale-[0.98]' : 'hover:scale-[1.02]'}
          `}
          onClick={() => setSelectedItem(selectedItem === 1 ? null : 1)}
          onMouseEnter={() => setHoveredItem(1)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Image Section */}
          <div className="relative h-48 overflow-hidden bg-slate-900">
            <div className="absolute inset-0 transition-all duration-700 group-hover:scale-110">
              {image1 ? (
                <img src={image1} alt={data.item1.name} className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-slate-900 animate-pulse"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
            </div>

            {/* Label Badge */}
            <div className="absolute top-4 left-4 px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full backdrop-blur-md">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-300">Option A</span>
            </div>

            {/* Glow effect on hover */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          </div>

          {/* Content Section */}
          <div className="p-8">
            <h3 className="text-2xl font-bold text-blue-300 mb-3 flex items-center gap-2">
              {data.item1.name}
              {selectedItem === 1 && (
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              )}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">{data.item1.description}</p>

            {/* Key Points */}
            <div className="space-y-2.5">
              <div className="text-[10px] uppercase tracking-widest text-blue-500/70 font-bold mb-3 flex items-center gap-2">
                <span className="w-3 h-px bg-blue-500/50"></span>
                Key Features
              </div>
              {data.item1.points.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 transition-all group/point"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 group-hover/point:scale-150 transition-transform"></div>
                  <span className="text-sm text-slate-200 leading-relaxed flex-1">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Item 2 Card */}
        <div
          className={`glass-panel rounded-3xl border overflow-hidden transition-all duration-500 cursor-pointer group
            ${selectedItem === 2 ? 'border-orange-500/60 ring-4 ring-orange-500/20' : 'border-orange-500/20 hover:border-orange-500/40'}
            ${hoveredItem === 1 ? 'opacity-60 scale-[0.98]' : 'hover:scale-[1.02]'}
          `}
          onClick={() => setSelectedItem(selectedItem === 2 ? null : 2)}
          onMouseEnter={() => setHoveredItem(2)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Image Section */}
          <div className="relative h-48 overflow-hidden bg-slate-900">
            <div className="absolute inset-0 transition-all duration-700 group-hover:scale-110">
              {image2 ? (
                <img src={image2} alt={data.item2.name} className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-900/40 to-slate-900 animate-pulse"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
            </div>

            {/* Label Badge */}
            <div className="absolute top-4 right-4 px-3 py-1 bg-orange-500/30 border border-orange-400/40 rounded-full backdrop-blur-md">
              <span className="text-xs font-mono uppercase tracking-wider text-orange-300">Option B</span>
            </div>

            {/* Glow effect on hover */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          </div>

          {/* Content Section */}
          <div className="p-8">
            <h3 className="text-2xl font-bold text-orange-300 mb-3 flex items-center gap-2">
              {data.item2.name}
              {selectedItem === 2 && (
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
              )}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">{data.item2.description}</p>

            {/* Key Points */}
            <div className="space-y-2.5">
              <div className="text-[10px] uppercase tracking-widest text-orange-500/70 font-bold mb-3 flex items-center gap-2">
                <span className="w-3 h-px bg-orange-500/50"></span>
                Key Features
              </div>
              {data.item2.points.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 transition-all group/point"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 group-hover/point:scale-150 transition-transform"></div>
                  <span className="text-sm text-slate-200 leading-relaxed flex-1">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VS Indicator */}
      <div className="flex items-center justify-center -my-3 relative z-10">
        <div className="w-14 h-14 rounded-full bg-slate-800/90 backdrop-blur-md border-2 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.3)] flex items-center justify-center">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">VS</span>
        </div>
      </div>

      {/* Synthesis Section */}
      <div className="mt-8 glass-panel rounded-3xl border border-purple-500/20 p-8 md:p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
            <h4 className="text-lg font-bold uppercase tracking-widest text-purple-400">
              Synthesis & Analysis
            </h4>
          </div>

          {/* Main Insight */}
          <div className="mb-8 pl-7">
            <div className="text-xs uppercase tracking-widest text-purple-500/70 font-bold mb-3 flex items-center gap-2">
              <span className="w-3 h-px bg-purple-500/50"></span>
              Key Insight
            </div>
            <p className="text-xl text-white leading-relaxed font-light italic">
              "{data.synthesis.mainInsight}"
            </p>
          </div>

          {/* Differences & Similarities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Differences */}
            <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
                <h5 className="text-sm font-bold uppercase tracking-wider text-red-400">Key Differences</h5>
              </div>
              <ul className="space-y-2.5">
                {data.synthesis.keyDifferences.map((diff, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                    <span className="text-red-400 mt-1 flex-shrink-0">▸</span>
                    <span className="leading-relaxed">{diff}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Similarities */}
            <div className="p-6 rounded-xl bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <h5 className="text-sm font-bold uppercase tracking-wider text-green-400">Key Similarities</h5>
              </div>
              <ul className="space-y-2.5">
                {data.synthesis.keySimilarities.map((sim, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                    <span className="text-green-400 mt-1 flex-shrink-0">▸</span>
                    <span className="leading-relaxed">{sim}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* When to Use */}
          {data.synthesis.whenToUse && (
            <div className="mb-8 p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <h5 className="text-sm font-bold uppercase tracking-wider text-blue-400">When to Use Each</h5>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/10">
                  <div className="text-xs font-mono uppercase tracking-wider text-blue-300 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    {data.item1.name}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{data.synthesis.whenToUse.item1Context}</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-900/20 border border-orange-500/10">
                  <div className="text-xs font-mono uppercase tracking-wider text-orange-300 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                    {data.item2.name}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{data.synthesis.whenToUse.item2Context}</p>
                </div>
              </div>
            </div>
          )}

          {/* Common Misconception */}
          {data.synthesis.commonMisconception && (
            <div className="p-6 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-bold uppercase tracking-wider text-yellow-400 mb-2">Common Misconception</h5>
                  <p className="text-sm text-slate-200 leading-relaxed italic">{data.synthesis.commonMisconception}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Hint */}
      {!selectedItem && (
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 font-mono">
            💡 Click on either card to highlight and focus
          </p>
        </div>
      )}
    </div>
  );
};
