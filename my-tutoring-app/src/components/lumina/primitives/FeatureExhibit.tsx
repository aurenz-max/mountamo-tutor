'use client';

import React, { useEffect, useState } from 'react';
import { FeatureExhibitData } from '../types';
import { generateConceptImage } from '../service/geminiClient-api';

interface FeatureExhibitProps {
  data: FeatureExhibitData;
  onTermClick: (term: string) => void;
}

export const FeatureExhibit: React.FC<FeatureExhibitProps> = ({ data, onTermClick }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Pages = Sections + 1 (The "Artifacts/Context" page at the end)
  const totalPages = data.sections.length + 1;
  const isArtifactPage = currentPage === data.sections.length;

  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (!data.visualPrompt) return;
      setLoading(true);
      const url = await generateConceptImage(`Cinematic, wide-angle, highly detailed educational illustration for a museum exhibit about: ${data.visualPrompt}. Atmospheric lighting, photorealistic textures, dark minimalist background.`);
      if (mounted && url) {
        setImageUrl(url);
      }
      if (mounted) setLoading(false);
    };

    fetchImage();
    return () => { mounted = false; };
  }, [data.visualPrompt]);

  const handleNext = () => {
    if (currentPage < totalPages - 1) setCurrentPage(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  };

  const progressPercentage = ((currentPage + 1) / totalPages) * 100;

  return (
    <div className="w-full max-w-6xl mx-auto my-20 animate-fade-in">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Deep Dive Analysis</h2>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 grid grid-cols-1 lg:grid-cols-2 min-h-[600px] shadow-2xl relative">
        
        {/* Left: Visual & Title (Sticky Context) */}
        <div className="relative bg-slate-900 p-8 flex flex-col justify-end lg:h-auto h-[300px] overflow-hidden group">
          {/* Background Image Layer */}
          <div className="absolute inset-0 z-0 transition-transform duration-[20s] ease-linear transform scale-100 group-hover:scale-110">
             {imageUrl ? (
               <img src={imageUrl} alt={data.title} className="w-full h-full object-cover opacity-60 transition-opacity duration-1000" />
             ) : (
               <div className="w-full h-full bg-slate-800 animate-pulse"></div>
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/20 to-slate-900/80 lg:bg-gradient-to-r lg:from-slate-900/10 lg:via-slate-900/40 lg:to-slate-900"></div>
          </div>

          <div className="relative z-10 lg:pr-12">
            <span className="inline-block px-3 py-1 mb-4 text-[10px] font-bold tracking-widest text-blue-300 uppercase bg-blue-900/40 border border-blue-500/30 rounded-full backdrop-blur-sm">
                Exhibit Monograph
            </span>
            <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
              {data.title}
            </h3>
            <div className="w-20 h-1 bg-blue-500 rounded-full mb-4"></div>
            <p className="text-sm text-slate-300 font-light opacity-80 hidden lg:block">
                Use the reader controls to navigate through the curated analysis and uncover hidden artifacts.
            </p>
          </div>
        </div>

        {/* Right: Interactive Reader */}
        <div className="relative bg-slate-900/80 backdrop-blur-md flex flex-col h-full border-l border-white/5">
            
            {/* Reader Header: Progress */}
            <div className="h-1 bg-white/5 w-full">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out" 
                    style={{ width: `${progressPercentage}%` }}
                ></div>
            </div>
            
            <div className="p-6 border-b border-white/5 flex justify-between items-center text-xs font-mono text-slate-400 uppercase tracking-widest">
                <span>
                    {isArtifactPage ? 'Appendix' : `Section 0${currentPage + 1}`}
                </span>
                <span>
                    {currentPage + 1} / {totalPages}
                </span>
            </div>

            {/* Reader Body: Content */}
            <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">
                <div key={currentPage} className="animate-fade-in">
                    {!isArtifactPage ? (
                        <>
                            <h4 className="text-2xl font-bold text-blue-100 mb-6 flex items-center gap-3">
                                <span className="text-blue-500 opacity-50 text-sm font-mono">0{currentPage + 1}.</span>
                                {data.sections[currentPage].heading}
                            </h4>
                            <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-light">
                                {data.sections[currentPage].content}
                            </p>
                        </>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="mb-8">
                                <h4 className="text-2xl font-bold text-white mb-2">Contextual Archives</h4>
                                <p className="text-slate-400 text-sm">
                                    The following entities have been extracted for further analysis. Select an artifact to open the Micro-Exhibit viewer.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                {data.relatedTerms && data.relatedTerms.map((term, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => onTermClick(term)}
                                        className="group relative p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 transition-all duration-300 text-left flex items-center justify-between"
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                            </div>
                                            <span className="text-lg font-medium text-slate-200 group-hover:text-white">{term}</span>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-500 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                            Analyze
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Reader Footer: Controls */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center gap-4">
                <button 
                    onClick={handlePrev} 
                    disabled={currentPage === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Previous
                </button>

                <div className="flex gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentPage ? 'bg-blue-400 scale-125' : 'bg-slate-700'}`}
                        />
                    ))}
                </div>

                <button 
                    onClick={handleNext} 
                    disabled={currentPage === totalPages - 1}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all
                        ${currentPage === totalPages - 1 
                            ? 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed' 
                            : 'bg-white text-slate-900 hover:bg-blue-50'
                        }`}
                >
                    {isArtifactPage ? 'End of Exhibit' : 'Next Page'}
                    {!isArtifactPage && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    )}
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};
