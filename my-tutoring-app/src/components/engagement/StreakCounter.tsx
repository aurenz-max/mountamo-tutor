"use client";

import React, { useState, useEffect } from 'react';
import { Flame, Calendar } from 'lucide-react';

interface StreakCounterProps {
  currentStreak: number;
  className?: string;
  showLabel?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const StreakCounter: React.FC<StreakCounterProps> = ({ 
  currentStreak, 
  className = '', 
  showLabel = true, 
  animate = true,
  size = 'md' 
}) => {
  const [displayStreak, setDisplayStreak] = useState(currentStreak);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousStreak, setPreviousStreak] = useState(currentStreak);

  // Animate streak changes
  useEffect(() => {
    if (animate && currentStreak !== displayStreak) {
      setIsAnimating(true);
      setPreviousStreak(displayStreak);
      
      // Quick animation for streak changes
      const duration = 800;
      const steps = Math.abs(currentStreak - displayStreak);
      const stepDelay = duration / Math.max(steps, 1);
      
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplayStreak(currentStreak);
          setIsAnimating(false);
          clearInterval(interval);
        } else {
          setDisplayStreak(prev => currentStreak > prev ? prev + 1 : prev - 1);
        }
      }, stepDelay);
      
      return () => clearInterval(interval);
    } else if (!animate) {
      setDisplayStreak(currentStreak);
    }
  }, [currentStreak, animate, displayStreak]);

  const sizeClasses = {
    sm: {
      text: 'text-sm',
      icon: 'h-4 w-4',
      label: 'text-xs'
    },
    md: {
      text: 'text-base',
      icon: 'h-5 w-5', 
      label: 'text-sm'
    },
    lg: {
      text: 'text-lg font-semibold',
      icon: 'h-6 w-6',
      label: 'text-base'
    }
  };

  const currentSize = sizeClasses[size];

  // Determine flame intensity based on streak length
  const getFlameColor = (streak: number) => {
    if (streak >= 30) return 'text-purple-500'; // Epic streak
    if (streak >= 14) return 'text-red-500';    // Hot streak  
    if (streak >= 7) return 'text-orange-500';  // Good streak
    if (streak >= 3) return 'text-yellow-500';  // Building streak
    return 'text-gray-400'; // Just started
  };

  const getStreakLabel = (streak: number) => {
    if (streak >= 30) return 'Epic';
    if (streak >= 14) return 'Hot';  
    if (streak >= 7) return 'Strong';
    if (streak >= 3) return 'Growing';
    return '';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`flex items-center space-x-1 ${isAnimating ? 'animate-pulse' : ''}`}>
        <Flame className={`${getFlameColor(displayStreak)} ${currentSize.icon} ${isAnimating ? 'animate-bounce' : ''}`} />
        <span className={`font-medium text-gray-900 ${currentSize.text} ${isAnimating ? 'text-orange-600' : ''}`}>
          {displayStreak}
        </span>
        {showLabel && (
          <span className={`text-gray-600 ${currentSize.label}`}>
            day streak
          </span>
        )}
        
        {/* Show streak label for impressive streaks */}
        {getStreakLabel(displayStreak) && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-800 ${currentSize.label}`}>
            {getStreakLabel(displayStreak)}
          </span>
        )}
      </div>
      
      {/* Show streak gain indicator */}
      {isAnimating && currentStreak > previousStreak && (
        <div className="flex items-center space-x-1 transition-all duration-500 ease-out animate-pulse">
          <Calendar className="h-3 w-3 text-orange-500" />
          <span className="text-xs font-medium text-orange-600">
            +{currentStreak - previousStreak} day{currentStreak - previousStreak !== 1 ? 's' : ''}!
          </span>
        </div>
      )}
    </div>
  );
};

export default StreakCounter;