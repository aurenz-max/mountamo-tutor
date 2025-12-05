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
    <div className="w-full max-w-6xl mx-auto my-20 animate-fade-in">
      <div className="flex items-center justify-center mb-10">
         <div className="h-px w-20 bg-gradient-to-r from-transparent to-slate-600"></div>
         <h2 className="mx-6 text-3xl font-bold text-white tracking-tight uppercase text-center">Comparative Analysis</h2>
         <div className="h-px w-20 bg-gradient-to-l from-transparent to-slate-600"></div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/10 z-20 hidden lg:block"></div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hidden lg:flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 border border-white/20 shadow-2xl text-xs font-bold text-slate-500">
            VS
        </div>

        <div className="flex flex-col lg:flex-row">
            
            {/* Left Side - Item 1 */}
            <div className="flex-1 relative group">
                {/* Background Image */}
                <div className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-60">
                    {image1 ? (
                        <img src={image1} alt={data.item1.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-slate-900"></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 p-8 lg:p-12 h-full flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-3xl font-bold text-blue-300 mb-2">{data.item1.name}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{data.item1.description}</p>
                    </div>

                    <div className="space-y-3 mt-auto">
                        {data.item1.points.map((point, i) => (
                            <div key={i} className="flex items-center gap-3 bg-black/30 backdrop-blur-md p-3 rounded-lg border border-blue-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <span className="text-sm text-slate-200 font-mono">{point}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Item 2 */}
            <div className="flex-1 relative group border-t border-white/10 lg:border-t-0">
                {/* Background Image */}
                <div className="absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-60">
                    {image2 ? (
                        <img src={image2} alt={data.item2.name} className="w-full h-full object-cover" />
                    ) : (
                         <div className="w-full h-full bg-gradient-to-bl from-red-900/40 to-slate-900"></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-l from-slate-900/90 via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 p-8 lg:p-12 h-full flex flex-col lg:text-right lg:items-end">
                    <div className="mb-6">
                        <h3 className="text-3xl font-bold text-orange-300 mb-2">{data.item2.name}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{data.item2.description}</p>
                    </div>

                    <div className="space-y-3 mt-auto w-full lg:w-auto">
                        {data.item2.points.map((point, i) => (
                            <div key={i} className="flex items-center gap-3 bg-black/30 backdrop-blur-md p-3 rounded-lg border border-orange-500/20 lg:flex-row-reverse">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                <span className="text-sm text-slate-200 font-mono">{point}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Synthesis Footer */}
        <div className="relative z-20 bg-slate-900/90 backdrop-blur border-t border-white/10 p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Synthesis</span>
            <p className="text-lg text-white font-light italic">"{data.synthesis}"</p>
        </div>
      </div>
    </div>
  );
};
