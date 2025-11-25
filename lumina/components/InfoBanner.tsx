import React, { useState, useEffect } from 'react';

interface InfoBannerProps {
  title: string;
  content: string;
  delay?: number;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ title, content, delay = 0 }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    setDisplayedContent('');

    const startTimeout = setTimeout(() => {
        setIsVisible(true);
        let index = 0;
        const interval = setInterval(() => {
            if (index < content.length) {
                setDisplayedContent(prev => prev + content.charAt(index));
                index++;
            } else {
                clearInterval(interval);
            }
        }, 30); // Typing speed

        return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [content, delay]);

  if (!content) return null;

  return (
    <div className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'} w-full max-w-lg mx-auto mt-6`}>
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-blue-400 relative overflow-hidden">
            <div className="flex items-start gap-4">
                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-300 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-1">{title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed font-light">
                        {displayedContent}
                        <span className="animate-pulse ml-1">|</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};
