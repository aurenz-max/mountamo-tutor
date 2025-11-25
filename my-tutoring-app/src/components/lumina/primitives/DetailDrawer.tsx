'use client';

import React, { useEffect, useState } from 'react';
import { ItemDetailData } from '@/types/lumina';
import { generateItemDetail, generateConceptImage } from '@/lib/lumina/geminiService';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextTopic: string;
  itemName: string | null;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ isOpen, onClose, contextTopic, itemName }) => {
  const [data, setData] = useState<ItemDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && itemName && contextTopic) {
      setLoading(true);
      setData(null);
      setImageUrl(null);

      const fetchData = async () => {
        try {
          // Parallel fetch for data and text to feel faster,
          // though we ideally need the visual prompt from text to get the best image.
          // Strategy: Get text first, then image.
          const detail = await generateItemDetail(contextTopic, itemName);
          setData(detail);

          const img = await generateConceptImage(`A high-fidelity educational render of: ${detail.visualPrompt}. Isolated object, dark background, dramatic lighting.`);
          setImageUrl(img);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isOpen, itemName, contextTopic]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-slate-900 border-l border-white/10 shadow-2xl z-[70] transform transition-transform duration-500 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Micro-Exhibit Analysis</h3>
            <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-mono text-xs animate-pulse">Retrieving Archives...</p>
                </div>
            ) : data ? (
                <div className="space-y-8 animate-fade-in">

                    {/* Title */}
                    <div>
                        <div className="inline-block px-2 py-1 bg-white/10 rounded text-[10px] font-mono text-slate-300 mb-2">
                            {contextTopic} / {itemName}
                        </div>
                        <h2 className="text-3xl font-bold text-white leading-tight">{data.title}</h2>
                    </div>

                    {/* Image */}
                    <div className="aspect-video w-full rounded-xl bg-black/40 border border-white/10 overflow-hidden relative flex items-center justify-center">
                        {imageUrl ? (
                            <img src={imageUrl} alt={data.title} className="w-full h-full object-cover animate-fade-in" />
                        ) : (
                            <div className="flex flex-col items-center text-slate-600">
                                <svg className="w-8 h-8 mb-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span className="text-xs uppercase tracking-widest">Generating Visual</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                    </div>

                    {/* Description */}
                    <div>
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Definition</h4>
                         <p className="text-slate-300 leading-relaxed font-light text-lg">{data.description}</p>
                    </div>

                    {/* Application */}
                    <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest">Real World Application</h4>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">{data.realWorldApplication}</p>
                    </div>

                    {/* Fun Fact */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Curiosity Note</h4>
                        <div className="flex gap-4">
                            <div className="w-1 bg-gradient-to-b from-purple-500 to-transparent rounded-full"></div>
                            <p className="text-slate-400 text-sm italic">"{data.funFact}"</p>
                        </div>
                    </div>

                </div>
            ) : null}
        </div>

      </div>
    </>
  );
};
