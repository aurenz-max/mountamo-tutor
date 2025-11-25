
import React, { useState, useEffect } from 'react';
import { IntroData } from '../types';

interface CuratorBriefProps {
  data: IntroData;
}

export const CuratorBrief: React.FC<CuratorBriefProps> = ({ data }) => {
  const [displayedHook, setDisplayedHook] = useState('');
  const [objectivesVisible, setObjectivesVisible] = useState(false);

  useEffect(() => {
    setDisplayedHook('');
    setObjectivesVisible(false);

    let index = 0;
    const interval = setInterval(() => {
        if (index < data.hook.length) {
            setDisplayedHook(prev => prev + data.hook.charAt(index));
            index++;
        } else {
            clearInterval(interval);
            setTimeout(() => setObjectivesVisible(true), 300);
        }
    }, 20);

    return () => clearInterval(interval);
  }, [data.hook]);

  return (
    <div className="w-full max-w-4xl mx-auto my-8 animate-fade-in-up">
        <div className="glass-panel p-6 md:p-8 rounded-2xl border-t border-b border-blue-500/20 md:border md:rounded-3xl relative overflow-hidden">
            
            {/* Decoration: Corner Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br"></div>

            <div className="flex flex-col md:flex-row gap-8">
                
                {/* Curator Avatar/Icon */}
                <div className="hidden md:flex flex-col items-center justify-start shrink-0 pt-2">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-600 flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:opacity-100 opacity-50 transition-opacity"></div>
                        <svg className="w-8 h-8 text-blue-300 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-mono">Curator AI</span>
                </div>

                <div className="flex-1 space-y-6">
                    {/* Hook Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Briefing</h3>
                        </div>
                        <p className="text-xl md:text-2xl text-white font-light leading-relaxed">
                            {displayedHook}
                            <span className="animate-pulse text-blue-400 ml-1">_</span>
                        </p>
                    </div>

                    {/* Objectives Section */}
                    <div className={`transition-all duration-700 ease-out transform ${objectivesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4"></div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Learning Objectives</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {data.objectives.map((obj, i) => (
                                <div key={i} className="group relative bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-blue-500/30 p-4 rounded-xl transition-all duration-300">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 w-4 h-4 shrink-0 rounded border border-slate-500 group-hover:border-blue-400 flex items-center justify-center transition-colors">
                                            <div className="w-2 h-2 bg-blue-400 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                        <p className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">
                                            {obj}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
