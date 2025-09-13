"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";

interface LevelBadgeProps {
  level: number;
  className?: string;
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, className = "" }) => {
  // Extract size from className to adjust components accordingly
  const isSmall = className.includes('w-10') || className.includes('h-10');
  
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <div className={`rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center shadow-lg border-2 border-purple-300 ${
        isSmall ? 'w-10 h-10' : 'w-16 h-16'
      }`}>
        <span className={`text-white font-bold ${isSmall ? 'text-sm' : 'text-lg'}`}>
          {level}
        </span>
      </div>
      <Badge 
        variant="secondary" 
        className={`absolute bg-purple-100 text-purple-700 border border-purple-300 font-semibold ${
          isSmall 
            ? '-bottom-0.5 -right-0.5 text-xs px-1.5 py-0.5 min-w-0 h-auto leading-none' 
            : '-bottom-1 -right-1 text-xs'
        }`}
      >
        Level
      </Badge>
    </div>
  );
};