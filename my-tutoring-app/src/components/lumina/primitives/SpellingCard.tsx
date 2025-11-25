'use client';

import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { ConceptCardData } from '../types';
import { generateConceptImage } from '../service/geminiService';

interface ConceptCardProps {
  data: ConceptCardData;
  index: number;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({ data, index }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  
  const cardRef = useRef<HTMLDivElement>(null);

  // Image Generation Logic
  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (imageUrl || imageLoading) return;
      setImageLoading(true);
      const url = await generateConceptImage(`A high quality, minimal, abstract, artistic 3d render representation of: ${data.visualPrompt}. Dark background, glowing neon accents matching color ${data.themeColor}. No text.`);
      if (mounted && url) {
        setImageUrl(url);
      }
      if (mounted) setImageLoading(false);
    };

    if (index === 0) {
      fetchImage();
    } else if (isFlipped) {
      fetchImage();
    }
    return () => { mounted = false; };
  }, [data.visualPrompt, index, isFlipped, data.themeColor]);

  // Tilt Effect Logic
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isFlipped) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateXValue = ((y - centerY) / centerY) * -10; // Max 10deg
    const rotateYValue = ((x - centerX) / centerX) * 10; // Max 10deg

    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div 
      className="relative w-full max-w-sm h-[550px] perspective-1000 cursor-pointer group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div 
        ref={cardRef}
        className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
        style={{ 
          transform: isFlipped 
            ? 'rotateY(180deg)' 
            : `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` 
        }}
      >
        
        {/* FRONT OF CARD */}
        <div className="absolute inset-0 w-full h-full backface-hidden">
          <div className="h-full glass-panel rounded-3xl border border-white/10 p-8 flex flex-col justify-between overflow-hidden relative group-hover:border-white/30 transition-colors shadow-2xl">
            {/* Ambient Background Glow */}
            <div 
              className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 transition-opacity duration-500"
              style={{ backgroundColor: data.themeColor }}
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest border border-white/10 px-2 py-1 rounded">Exhibit 0{index + 1}</span>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: data.themeColor }} />
              </div>
              
              {/* Interactive Element/Breakdown Display */}
              <div className="mb-2 flex flex-wrap gap-2 items-baseline">
                {data.conceptElements && data.conceptElements.length > 0 ? (
                    data.conceptElements.map((el, i) => (
                        <div key={i} className="relative group/segment">
                            <span 
                                className="text-3xl font-bold text-white hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-b hover:from-white hover:to-blue-200 transition-all border-b-2 border-transparent hover:border-blue-400/50 cursor-help"
                            >
                                {el.label}
                            </span>
                            {/* Tooltip for Element */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[180px] bg-slate-900/90 backdrop-blur border border-white/20 px-3 py-2 rounded-lg text-xs opacity-0 group-hover/segment:opacity-100 transition-opacity pointer-events-none z-20">
                                <span className="text-white">{el.detail}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <h2 className="text-4xl font-bold text-white">{data.title}</h2>
                )}
              </div>
              
              <p className="text-lg text-slate-400 font-mono tracking-tight">{data.subheading}</p>
            </div>

            {/* Generative Image Frame */}
            <div className="relative flex-grow my-6 rounded-xl overflow-hidden bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 shadow-inner">
                {imageUrl ? (
                    <>
                        <img src={imageUrl} alt={data.title} className="w-full h-full object-cover opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </>
                ) : (
                    <div className="text-center p-4">
                       {imageLoading ? (
                           <div className="flex flex-col items-center gap-3">
                               <div className="relative w-12 h-12">
                                   <div className="absolute inset-0 border-2 border-slate-700 rounded-full"></div>
                                   <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                               </div>
                               <span className="text-xs text-slate-500 font-mono animate-pulse">Synthesizing Visual...</span>
                           </div>
                       ) : (
                           <div className="flex flex-col items-center text-white/20">
                               <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                               <span className="text-xs uppercase tracking-widest">Generative Asset</span>
                           </div>
                       )}
                    </div>
                )}
            </div>

            <div className="relative z-10 flex justify-between items-end">
              <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Context</span>
                  <span className="text-sm text-slate-300 font-mono">{data.timelineContext}</span>
              </div>
              <p className="text-xs text-slate-400 font-medium bg-white/5 py-2 px-4 rounded-full border border-white/5 hover:bg-white/10 transition-colors">
                Flip to Analyze →
              </p>
            </div>
          </div>
        </div>

        {/* BACK OF CARD */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
          <div className="h-full bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-white/20 p-8 flex flex-col relative overflow-hidden shadow-2xl">
            
            {/* Decorative Header Line */}
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: data.themeColor }} />

            <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2">
              
              {/* Definition Block */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-slate-700 rounded-full"></span>
                    Overview
                </h3>
                <p className="text-lg text-white leading-relaxed font-light">{data.definition}</p>
              </div>

              {/* Curiosity Note */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Curiosity Note</h3>
                <p className="text-sm text-emerald-300 leading-relaxed border-l-2 border-emerald-500/50 pl-4 font-mono">
                  {data.curiosityNote}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 text-center border-t border-white/5">
              <button className="text-xs text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 w-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Return to Artifact
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
