"use client";

import React, { useState, useEffect } from 'react';
import { Award, TrendingUp } from 'lucide-react';

interface XPCounterProps {
  currentXP: number;
  className?: string;
  showLabel?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const XPCounter: React.FC<XPCounterProps> = ({ 
  currentXP, 
  className = '', 
  showLabel = true, 
  animate = true,
  size = 'md' 
}) => {
  const [displayXP, setDisplayXP] = useState(currentXP);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousXP, setPreviousXP] = useState(currentXP);

  // Animate XP changes
  useEffect(() => {
    if (animate && currentXP !== displayXP) {
      setIsAnimating(true);
      setPreviousXP(displayXP);
      
      // Animate the counter
      const difference = currentXP - displayXP;
      const duration = Math.min(1500, Math.abs(difference) * 10); // Max 1.5 seconds
      const steps = Math.min(50, Math.abs(difference)); // Max 50 steps
      const stepValue = difference / steps;
      const stepDelay = duration / steps;
      
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayXP(currentXP);
          setIsAnimating(false);
          clearInterval(interval);
        } else {
          setDisplayXP(prev => Math.round(prev + stepValue));
        }
      }, stepDelay);
      
      return () => clearInterval(interval);
    } else if (!animate) {
      setDisplayXP(currentXP);
    }
  }, [currentXP, animate, displayXP]);

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

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`flex items-center space-x-1 ${isAnimating ? 'animate-pulse' : ''}`}>
        <Award className={`text-yellow-500 ${currentSize.icon} ${isAnimating ? 'animate-bounce' : ''}`} />
        <span className={`font-medium text-gray-900 ${currentSize.text} ${isAnimating ? 'text-green-600' : ''}`}>
          {displayXP.toLocaleString()}
        </span>
        {showLabel && (
          <span className={`text-gray-600 ${currentSize.label}`}>
            XP
          </span>
        )}
      </div>
      
      {/* Show XP gain indicator */}
      {isAnimating && currentXP > previousXP && (
        <div className="flex items-center space-x-1 transition-all duration-500 ease-out animate-bounce">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium text-green-600">
            +{(currentXP - previousXP).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default XPCounter;