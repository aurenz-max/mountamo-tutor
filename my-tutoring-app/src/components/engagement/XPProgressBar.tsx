"use client";

import React from 'react';
import { Progress } from "@/components/ui/progress";

interface XPProgressBarProps {
  totalXP: number;
  currentLevel: number;
  xpForNextLevel: number;
  className?: string;
}

// Helper function to calculate XP required for the start of current level
const calculateXpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += Math.floor(100 * Math.pow(i, 1.5));
  }
  return totalXP;
};

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  totalXP,
  currentLevel,
  xpForNextLevel,
  className = ""
}) => {
  // Calculate progress within current level
  const xpForCurrentLevelStart = calculateXpForLevel(currentLevel);
  const xpInCurrentLevel = totalXP - xpForCurrentLevelStart;
  const xpNeededForNextLevel = Math.floor(100 * Math.pow(currentLevel, 1.5));
  
  // Ensure we don't show negative progress
  const progressXP = Math.max(0, xpInCurrentLevel);
  const progressPercentage = Math.min(100, (progressXP / xpNeededForNextLevel) * 100);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600">Level {currentLevel} Progress</span>
        <span className="text-gray-800 font-medium">
          {progressXP.toLocaleString()} / {xpNeededForNextLevel.toLocaleString()} XP
        </span>
      </div>
      <Progress 
        value={progressPercentage} 
        className="h-3 bg-gray-200"
      />
      <div className="text-xs text-gray-500 text-right">
        {xpForNextLevel > 0 ? `${xpForNextLevel.toLocaleString()} XP to next level` : 'Max level reached!'}
      </div>
    </div>
  );
};