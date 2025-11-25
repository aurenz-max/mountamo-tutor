'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CustomSVGData, CustomWebData } from '../types';
import { fixVisualScript } from '../service/geminiService';

interface CustomVisualProps {
  data: CustomSVGData | CustomWebData;
}

export const CustomVisual: React.FC<CustomVisualProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLibReady, setIsLibReady] = useState(false);
  const [activeScript, setActiveScript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const retryCount = useRef(0);

  // 1. Init Data
  useEffect(() => {
    if (data.type === 'custom-web') {
      setActiveScript(data.script);
      setError(null);
      setIsFixing(false);
      retryCount.current = 0;
    }
  }, [data]);

  // 2. Poll for Library Availability (Replaces complex loader)
  useEffect(() => {
    if (data.type !== 'custom-web') return;

    const library = data.library; // Type narrowed to CustomWebData
    let attempts = 0;
    const checkLibrary = () => {
      const w = window as any;
      const ready =
        (library === 'chart.js' && w.Chart) ||
        (library === 'd3' && w.d3) ||
        (library === 'echarts' && w.echarts) ||
        (library === 'roughjs' && w.rough) ||
        (library === 'mermaid' && w.mermaid) ||
        (library === 'tone.js' && w.Tone);

      if (ready) {
        setIsLibReady(true);
      } else if (attempts < 50) { // Timeout after 5s
        attempts++;
        setTimeout(checkLibrary, 100);
      } else {
        setError(`Library ${library} failed to load.`);
      }
    };

    checkLibrary();
  }, [data]);

  // 3. Execute Script
  useEffect(() => {
    if (!isLibReady || data.type !== 'custom-web' || !containerRef.current || !activeScript) return;
    if (isFixing) return;

    try {
      // Cleanup previous charts if needed
      containerRef.current.innerHTML = data.html;

      // Execute
      const runScript = new Function(activeScript);
      runScript();

      // Mermaid specific init
      if (data.library === 'mermaid' && (window as any).mermaid) {
        (window as any).mermaid.init(undefined, containerRef.current.querySelectorAll('.mermaid'));
      }

      setError(null);
    } catch (e: any) {
      console.error("Exec Error:", e);
      const msg = e.message || String(e);

      // Self-Healing Logic
      if (retryCount.current < 2) {
        setIsFixing(true);
        retryCount.current++;
        fixVisualScript(activeScript, msg, data.library)
          .then(fixed => {
            setActiveScript(fixed);
            setIsFixing(false);
          })
          .catch(() => {
            setError(msg);
            setIsFixing(false);
          });
      } else {
        setError(msg);
      }
    }
  }, [isLibReady, activeScript, data, isFixing]);

  return (
    <div className="w-full max-w-5xl mx-auto my-16 animate-fade-in">
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Module</h2>
          <p className="text-sm text-slate-400 font-mono">
            {data.type === 'custom-svg' ? 'Vector Diagram' : `Powered by ${data.library}`}
          </p>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-orange-500/20 relative overflow-hidden flex flex-col items-center">
        <div className="mb-8 text-center max-w-2xl relative z-10">
          <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
          <p className="text-slate-300 font-light">{data.description}</p>
        </div>

        <div className="w-full bg-slate-900/50 rounded-xl border border-white/5 p-4 relative z-10 overflow-auto flex justify-center min-h-[300px]">
          {/* Loading State */}
          {!isLibReady && data.type === 'custom-web' && !error && (
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-blue-500 rounded-full border-t-transparent"></div>
              <span className="text-slate-400 text-sm font-mono">Loading {data.library}...</span>
            </div>
          )}

          {/* Error / Fixing State */}
          {(error || isFixing) && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              {isFixing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin h-8 w-8 border-3 border-orange-500 rounded-full border-t-transparent"></div>
                  <div className="text-orange-400 font-mono text-sm">Auto-repairing code...</div>
                </div>
              ) : (
                <div className="text-red-400 font-mono text-sm max-w-md">{error}</div>
              )}
            </div>
          )}

          {/* Render Area */}
          {data.type === 'custom-svg' && (
            <div
              className="w-full h-full flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[500px]"
              dangerouslySetInnerHTML={{ __html: data.svgCode }}
            />
          )}

          {/* Custom Web HTML is injected via useEffect to allow script execution on fresh DOM */}
          {data.type === 'custom-web' && isLibReady && !error && !isFixing && (
            <div
              ref={containerRef}
              className="w-full h-full flex justify-center items-center"
            />
          )}
        </div>
      </div>
    </div>
  );
};
