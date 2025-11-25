'use client';

import React, { useState } from 'react';
import { SentenceSchemaData } from '../types';

interface SentenceAnalyzerProps {
  data: SentenceSchemaData;
}

export const SentenceAnalyzer: React.FC<SentenceAnalyzerProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const parts = data.parts || [];

  return (
    <div className="w-full max-w-4xl mx-auto my-16 animate-fade-in">
      <div className="flex items-center gap-4 mb-6 justify-center md:justify-start">
        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30 text-pink-400">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
        </div>
        <div>
           <h2 className="text-2xl font-bold text-white tracking-tight">Syntactic Analyzer</h2>
           <p className="text-sm text-slate-400 font-mono">Structural Grammar Breakdown</p>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-pink-500/30 relative overflow-hidden flex flex-col items-center text-center shadow-[0_0_50px_rgba(236,72,153,0.1)]">
        
        {/* Background Grid Decoration */}
        <div className="absolute inset-0 z-0 opacity-10" style={{ 
            backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)',
            backgroundSize: '30px 30px' 
        }}></div>

        <div className="relative z-10 mb-10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-pink-300 mb-2">{data.title}</h3>
            <p className="text-slate-300 max-w-xl mx-auto leading-relaxed">{data.description}</p>
        </div>

        {/* The Sentence Display */}
        <div className="relative z-10 flex flex-wrap justify-center items-start gap-3 md:gap-6 p-8 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl w-full">
            {parts.length > 0 ? parts.map((part, index) => (
                <div 
                    key={index}
                    className="relative group flex flex-col items-center"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    {/* The Word */}
                    <span className={`text-2xl md:text-4xl font-serif tracking-wide transition-all duration-300 cursor-help px-2 py-1 rounded
                        ${hoveredIndex === index ? 'text-pink-300 bg-pink-500/10' : 'text-white'}`}
                    >
                        {part.text}
                    </span>
                    
                    {/* Connector Line (Syntactic Tree Metaphor) */}
                    <div className={`h-8 w-px bg-gradient-to-b from-slate-600 to-transparent transition-all duration-300 ${hoveredIndex === index ? 'from-pink-500 h-12' : ''}`}></div>

                    {/* Grammar Role Tag */}
                    <div className={`absolute top-full mt-4 transition-all duration-300 transform ${hoveredIndex === index ? 'opacity-100 translate-y-0 scale-100' : 'opacity-60 translate-y-2 scale-90'}`}>
                        <div className="flex flex-col items-center gap-2 min-w-[120px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/10">
                                {part.partOfSpeech}
                            </span>
                            <span className="text-sm font-bold text-pink-400">
                                {part.role}
                            </span>
                        </div>
                    </div>
                </div>
            )) : (
                <div className="text-slate-500 italic">No sentence parts analyzed.</div>
            )}
        </div>

        {/* Dynamic Explanation Box based on hover */}
        <div className="min-h-[80px] mt-16 relative z-10 w-full flex justify-center items-center">
             <div className={`transition-all duration-500 w-full max-w-lg ${hoveredIndex !== null ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'}`}>
                 {hoveredIndex !== null && parts[hoveredIndex] && (
                     <div className="bg-pink-900/20 border border-pink-500/30 p-4 rounded-xl flex items-start gap-4 text-left">
                         <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center shrink-0 text-lg font-serif italic">
                             i
                         </div>
                         <div>
                             <h4 className="text-pink-200 font-bold text-sm mb-1">
                                 {parts[hoveredIndex].partOfSpeech} Analysis
                             </h4>
                             <p className="text-slate-300 text-sm leading-snug">
                                 {parts[hoveredIndex].definition}
                             </p>
                         </div>
                     </div>
                 )}
             </div>
             {hoveredIndex === null && (
                 <span className="text-slate-600 text-sm font-mono animate-pulse absolute">Hover over words to analyze syntax</span>
             )}
        </div>

      </div>
    </div>
  );
};
