import React from 'react';
import { Flashcard } from '../types';

interface FlashcardViewProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  direction: 'left' | 'right' | null;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ card, isFlipped, onFlip, direction }) => {
  
  let animationClass = 'animate-slide-in';
  if (direction === 'left') animationClass = 'animate-slide-out-left';
  if (direction === 'right') animationClass = 'animate-slide-out-right';

  return (
    <div 
      className={`relative w-full max-w-md h-80 cursor-pointer perspective-1000 group ${animationClass}`}
      onClick={onFlip}
    >
      <div 
        className={`relative w-full h-full duration-500 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : 'hover:scale-[1.02] hover:-rotate-1'}`}
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden rounded-2xl p-8 flex flex-col items-center justify-center 
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] 
          text-white group-hover:border-white/30 group-hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.2)] transition-all">
            
            <span className="absolute top-4 right-4 text-xs font-bold tracking-wider text-indigo-200/70 uppercase border border-indigo-200/20 px-2 py-1 rounded-full">
                {card.category}
            </span>
            
            <h2 className="text-3xl font-bold text-center leading-tight select-none drop-shadow-md">
                {card.term}
            </h2>
            
            <p className="absolute bottom-6 text-indigo-200/60 text-sm font-medium animate-pulse">
                Click to Reveal
            </p>
        </div>

        {/* Back - Solid background to prevent bleed-through */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-2xl p-8 flex flex-col items-center justify-center 
          bg-indigo-950 border border-indigo-400/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] text-white">
            
            <h3 className="text-xl text-indigo-300 font-semibold mb-3 uppercase tracking-wide text-xs">
                Answer
            </h3>
            
            <p className="text-2xl font-medium text-center leading-snug select-none drop-shadow-sm">
                {card.definition}
            </p>
        </div>
      </div>
    </div>
  );
};