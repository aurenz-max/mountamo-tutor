'use client';

import React, { useState, useEffect } from 'react';
import { CustomSVGData, CustomWebData } from '../types';

interface CustomVisualProps {
  data: CustomSVGData | CustomWebData;
}

export const CustomVisual: React.FC<CustomVisualProps> = ({ data }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Reset loading state when data changes
  useEffect(() => {
    if (data.type === 'custom-web') {
      setIsLoading(true);
    }
  }, [data]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode(!isTheaterMode);
  };

  return (
    <div className={`w-full mx-auto animate-fade-in ${isTheaterMode ? 'fixed inset-0 z-50 bg-slate-950/95 p-8 m-0 overflow-y-auto' : 'max-w-7xl my-16'}`}>
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Learning Experience</h2>
          <p className="text-sm text-slate-400 font-mono">
            {data.type === 'custom-svg' ? 'Vector Diagram' : 'Interactive Visualization'}
          </p>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-orange-500/20 relative overflow-hidden flex flex-col items-center">
        <button
          onClick={toggleTheaterMode}
          className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition-all flex items-center gap-2 z-20"
          title={isTheaterMode ? 'Exit Theater Mode' : 'Enter Theater Mode'}
        >
          {isTheaterMode ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              <span className="hidden sm:inline">Exit Theater</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
              <span className="hidden sm:inline">Theater Mode</span>
            </>
          )}
        </button>

        <div className="mb-8 text-center max-w-2xl relative z-10">
          <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
          <p className="text-slate-300 font-light">{data.description}</p>
        </div>

        <div className={`w-full bg-slate-900/50 rounded-xl border border-white/5 p-4 relative z-10 overflow-hidden flex justify-center ${isTheaterMode ? 'min-h-[calc(100vh-300px)]' : 'min-h-[800px]'}`}>
          {/* Loading State */}
          {isLoading && data.type === 'custom-web' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 z-20">
              <div className="animate-spin h-8 w-8 border-3 border-blue-500 rounded-full border-t-transparent"></div>
              <span className="text-slate-400 text-sm font-mono">Loading interactive experience...</span>
            </div>
          )}

          {/* SVG Rendering */}
          {data.type === 'custom-svg' && (
            <div
              className="w-full h-full flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[500px]"
              dangerouslySetInnerHTML={{ __html: data.svgCode }}
            />
          )}

          {/* Custom Web - Iframe Rendering */}
          {data.type === 'custom-web' && (
            <iframe
              className={`w-full h-full border-0 bg-white rounded-lg ${isTheaterMode ? 'min-h-[calc(100vh-300px)]' : 'min-h-[800px]'}`}
              srcDoc={data.htmlContent}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title={data.title}
              onLoad={handleIframeLoad}
            />
          )}
        </div>
      </div>
    </div>
  );
};
