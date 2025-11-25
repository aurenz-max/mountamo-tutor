
import React, { useState } from 'react';
import { EquationData } from '../types';

interface FormulaCardProps {
  data: EquationData;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ data }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const segments = data.segments || [];

  return (
    <div className="w-full max-w-4xl mx-auto my-16 animate-fade-in">
      <div className="flex items-center gap-4 mb-6 justify-center md:justify-start">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
        </div>
        <div>
           <h2 className="text-2xl font-bold text-white tracking-tight">Equation Decoder</h2>
           <p className="text-sm text-slate-400 font-mono">Interactive Formula Analysis</p>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-indigo-500/30 relative overflow-hidden flex flex-col items-center text-center shadow-[0_0_50px_rgba(99,102,241,0.1)]">
        
        {/* Background Grid Decoration */}
        <div className="absolute inset-0 z-0 opacity-10" style={{ 
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px' 
        }}></div>

        <div className="relative z-10 mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-300 mb-2">{data.title}</h3>
            <p className="text-slate-300 max-w-xl mx-auto leading-relaxed">{data.description}</p>
        </div>

        {/* The Equation Display */}
        <div className="relative z-10 flex flex-wrap justify-center items-baseline gap-2 md:gap-4 p-6 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-inner">
            {segments.length > 0 ? segments.map((segment, index) => (
                <div 
                    key={index}
                    className="relative group"
                    onMouseEnter={() => segment.isVariable && setHoveredSegment(segment.meaning || null)}
                    onMouseLeave={() => setHoveredSegment(null)}
                >
                    <span 
                        className={`text-4xl md:text-6xl font-serif tracking-wide transition-all duration-300 
                        ${segment.isVariable 
                            ? 'cursor-help text-white hover:text-indigo-300 hover:scale-110 inline-block border-b-2 border-dashed border-indigo-500/30 hover:border-indigo-400' 
                            : 'text-slate-500'}`}
                    >
                        {segment.text}
                    </span>
                    
                    {/* Tooltip for standard hover interaction */}
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

        {/* Dynamic Explanation Box based on hover */}
        <div className="h-16 mt-8 relative z-10 w-full flex justify-center items-center">
             <div className={`transition-all duration-500 transform ${hoveredSegment ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                 {hoveredSegment && (
                     <div className="flex items-center gap-3 bg-indigo-900/40 border border-indigo-500/30 px-6 py-2 rounded-full">
                         <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                         <span className="text-indigo-200 font-mono text-sm uppercase tracking-wider">{hoveredSegment}</span>
                     </div>
                 )}
                 {!hoveredSegment && (
                     <span className="text-slate-600 text-sm font-mono animate-pulse">Hover over variables to decode</span>
                 )}
             </div>
        </div>

      </div>
    </div>
  );
};
