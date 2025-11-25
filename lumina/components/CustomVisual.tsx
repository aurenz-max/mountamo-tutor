
import React, { useEffect, useRef } from 'react';
import { CustomSVGData, CustomWebData } from '../types';

interface CustomVisualProps {
  data: CustomSVGData | CustomWebData;
}

export const CustomVisual: React.FC<CustomVisualProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data.type !== 'custom-web' || !containerRef.current) return;

    // Safety: Clear previous content that might have been rendered if swapping rapidly (though key prop usually handles this)
    // The HTML is set via dangerouslySetInnerHTML below, but the script needs to run.

    // Execute the script
    try {
        // Wrap in a function to isolate scope slightly, though global vars (libraries) are needed
        // We pass 'container' as a variable if the script wants to use it, though Gemini usually targets ID.
        const runScript = new Function(data.script);
        runScript();
        
        // Handle Mermaid specifically if needed
        if (data.library === 'mermaid' && (window as any).mermaid) {
             (window as any).mermaid.init(undefined, containerRef.current.querySelectorAll('.mermaid'));
        }
    } catch (e) {
        console.error("Custom Visual Script Error:", e);
    }

  }, [data]);

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
                 {data.type === 'custom-svg' ? (
                     <div 
                        className="w-full h-full flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[500px]"
                        dangerouslySetInnerHTML={{ __html: data.svgCode }} 
                     />
                 ) : (
                     <div 
                        ref={containerRef}
                        className="w-full h-full flex justify-center items-center"
                        dangerouslySetInnerHTML={{ __html: data.html }} 
                     />
                 )}
             </div>

        </div>
    </div>
  );
};