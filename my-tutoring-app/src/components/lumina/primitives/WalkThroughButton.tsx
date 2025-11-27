'use client';

import React from 'react';

interface WalkThroughButtonProps {
  onWalkThrough: () => void;
  disabled?: boolean;
}

export const WalkThroughButton: React.FC<WalkThroughButtonProps> = ({
  onWalkThrough,
  disabled = false
}) => {
  return (
    <button
      onClick={onWalkThrough}
      disabled={disabled}
      className="absolute top-4 right-4 z-10 group flex items-center gap-2
                 bg-blue-600/90 hover:bg-blue-500 backdrop-blur-sm
                 px-4 py-2 rounded-full shadow-lg
                 transition-all duration-300 hover:scale-105
                 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Walk me through this"
    >
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
      <span className="text-sm font-medium text-white hidden md:inline">
        Walk Through
      </span>
    </button>
  );
};
