import React from 'react';

interface StackProgressProps {
  total: number;
  current: number;
  results: (boolean | null)[]; // null = skipped/pending, true = correct, false = incorrect
}

export const StackProgress: React.FC<StackProgressProps> = ({ total, current, results }) => {
  return (
    <div className="flex flex-col items-center gap-2 mt-4 animate-fade-in">
        <div className="flex items-center gap-1.5 p-2 rounded-full bg-slate-900/40 backdrop-blur-md border border-white/5">
            {Array.from({ length: total }).map((_, i) => {
                const isPast = i < current;
                const isCurrent = i === current;
                const result = results[i];

                let baseClasses = "h-2 rounded-full transition-all duration-500 ease-out";
                let statusClasses = "w-2 bg-slate-700/50"; // Default future

                if (isCurrent) {
                    statusClasses = "w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]";
                } else if (isPast) {
                    if (result === true) {
                        statusClasses = "w-2 bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.4)]";
                    } else if (result === false) {
                        statusClasses = "w-2 bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]";
                    } else {
                        statusClasses = "w-2 bg-slate-500"; // Should not happen in rapid fire usually
                    }
                }

                return (
                    <div 
                        key={i} 
                        className={`${baseClasses} ${statusClasses}`}
                        aria-hidden="true"
                    />
                );
            })}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
            {current + 1} / {total}
        </span>
    </div>
  );
};