'use client';

import React from 'react';

interface Bar {
  label: string;
  value: number;
  color: string;
}

interface BarModelData {
  bars: Bar[];
  showValues?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

interface BarModelProps {
  data: BarModelData;
  className?: string;
}

/**
 * BarModel - Visual component for displaying bar models
 * Used for teaching comparison, counting, and part-whole relationships
 */
export const BarModel: React.FC<BarModelProps> = ({ data, className = '' }) => {
  const { bars, showValues = true, orientation = 'horizontal' } = data;

  if (!bars || bars.length === 0) {
    return null;
  }

  // Find max value for scaling
  const maxValue = Math.max(...bars.map(b => b.value));
  const scale = 100 / maxValue;

  if (orientation === 'vertical') {
    // Calculate better visual scaling - use a base height per unit
    // This ensures visible differences even for small values
    const baseHeightPerUnit = 40; // 40px per unit value
    const containerHeight = Math.max(maxValue * baseHeightPerUnit, 160); // At least 160px tall

    return (
      <div className={`flex flex-col ${className}`}>
        {/* Bars container with baseline alignment */}
        <div className={`flex items-end justify-center gap-6`} style={{ height: `${containerHeight}px` }}>
          {bars.map((bar, idx) => {
            const barHeight = bar.value * baseHeightPerUnit;

            return (
              <div
                key={idx}
                className="relative w-20 rounded-t-lg transition-all flex flex-col items-center justify-end p-2"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: bar.color
                }}
              >
                {showValues && (
                  <span className="text-white font-bold text-xl drop-shadow-md">
                    {bar.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Labels container - separate row so word wrapping doesn't affect bar alignment */}
        <div className="flex justify-center gap-6 mt-2">
          {bars.map((bar, idx) => (
            <div key={idx} className="w-20 text-center">
              <span className="text-sm font-medium text-gray-700 leading-tight">
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {bars.map((bar, idx) => {
        const widthPercent = (bar.value / maxValue) * 100;
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 min-w-[80px]">
              {bar.label}
            </span>
            <div
              className="relative h-12 rounded-lg transition-all flex items-center justify-center"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: bar.color,
                minWidth: '60px'
              }}
            >
              {showValues && (
                <span className="text-white font-bold text-lg drop-shadow-md">
                  {bar.value}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
