import React, { useEffect } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

interface ControlsProps {
  onKnow: () => void;
  onDontKnow: () => void;
  isFlipped: boolean;
  disabled: boolean;
}

export const Controls: React.FC<ControlsProps> = ({ onKnow, onDontKnow, isFlipped, disabled }) => {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (disabled || !isFlipped) return;
        
        if (e.key === 'ArrowLeft') {
            onDontKnow();
        } else if (e.key === 'ArrowRight') {
            onKnow();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isFlipped, onKnow, onDontKnow]);

  if (!isFlipped) {
    return (
        <div className="h-24 flex items-center justify-center text-slate-400 text-sm">
           Flip the card to reveal options
        </div>
    );
  }

  return (
    <div className="flex gap-6 h-24 items-center justify-center animate-slide-in">
      <button
        onClick={onDontKnow}
        disabled={disabled}
        className="flex flex-col items-center gap-2 group focus:outline-none"
        aria-label="I don't know this yet"
      >
        <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 text-red-500 flex items-center justify-center transition-all duration-200 group-hover:bg-red-500 group-hover:text-white group-active:scale-95">
            <X size={32} />
        </div>
        <span className="text-xs font-semibold text-red-400 uppercase tracking-wider group-hover:text-red-300">Study Again</span>
        <span className="text-[10px] text-slate-500 hidden md:block">Left Arrow</span>
      </button>

      <div className="w-px h-12 bg-slate-700/50"></div>

      <button
        onClick={onKnow}
        disabled={disabled}
        className="flex flex-col items-center gap-2 group focus:outline-none"
        aria-label="I know this"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center transition-all duration-200 group-hover:bg-emerald-500 group-hover:text-white group-active:scale-95">
            <Check size={32} />
        </div>
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider group-hover:text-emerald-300">Got It</span>
        <span className="text-[10px] text-slate-500 hidden md:block">Right Arrow</span>
      </button>
    </div>
  );
};
